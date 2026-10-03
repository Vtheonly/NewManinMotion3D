/**
 * Playback Engine
 * 
 * Drives 60fps preview playback using requestAnimationFrame.
 * Evaluates all active clips at current time, computes morph states,
 * and produces a frame state that the canvas renders.
 */

import { getEasing, evaluateEasing } from './easing.js';
import { generateShapePoints, pointsToFlat } from './geometry.js';
import { resamplePoints, computeMorphState, lerp, interpolateColor } from './transform.js';
import { blendClipResults, isClipActive, getClipProgress, isClipCompleted, applyOverrides } from './blending.js';
import { propagateParentTransforms } from './hierarchy.js';

/**
 * @typedef {Object} FrameState
 * @property {Object} objectOverrides - Per-object property overrides
 * @property {Array} morphShapes - Active morph shapes to render
 * @property {Set} hiddenIds - Object IDs that should be hidden
 */

export class PlaybackEngine {
  constructor() {
    this.playing = false;
    this.currentTime = 0;
    this.loop = true;
    this.duration = 10;
    this._frameId = null;
    this._lastTimestamp = null;
    this._onFrame = null;
    this._onTimeUpdate = null;

    // Cache for resampled points (cleared when project changes)
    this._pointsCache = new Map();
  }

  /**
   * Set callback for frame updates.
   */
  onFrame(callback) {
    this._onFrame = callback;
  }

  /**
   * Set callback for time updates (for UI sync).
   */
  onTimeUpdate(callback) {
    this._onTimeUpdate = callback;
  }

  /**
   * Clear the points cache (call when objects change).
   */
  clearCache() {
    this._pointsCache.clear();
  }

  /**
   * Start playback.
   */
  play(tracks, objects, duration) {
    if (this.playing) return;
    this.playing = true;
    this.duration = duration || this.duration;
    this._lastTimestamp = null;
    this._tracks = tracks;
    this._objects = objects;
    this._objectMap = new Map(objects.map(o => [o.id, o]));
    this._tick = this._tick.bind(this);
    this._frameId = requestAnimationFrame(this._tick);
  }

  /**
   * Pause playback.
   */
  pause() {
    this.playing = false;
    if (this._frameId) {
      cancelAnimationFrame(this._frameId);
      this._frameId = null;
    }
    this._lastTimestamp = null;
  }

  /**
   * Stop and reset to start.
   */
  stop() {
    this.pause();
    this.currentTime = 0;
    if (this._onTimeUpdate) this._onTimeUpdate(0);
    // Emit a final frame at time 0
    if (this._onFrame) {
      this._onFrame({ objectOverrides: {}, morphShapes: [], hiddenIds: new Set() });
    }
  }

  /**
   * Seek to a specific time.
   */
  seekTo(time, tracks, objects) {
    this.currentTime = Math.max(0, Math.min(time, this.duration));
    if (tracks) this._tracks = tracks;
    if (objects) {
      this._objects = objects;
      this._objectMap = new Map(objects.map(o => [o.id, o]));
    }
    if (this._onTimeUpdate) this._onTimeUpdate(this.currentTime);

    // Compute and emit frame at this time
    if (this._tracks && this._objects) {
      const frame = this.computeFrame(this.currentTime, this._tracks, this._objects);
      if (this._onFrame) this._onFrame(frame);
    }
  }

  /**
   * Internal tick: advance time and compute frame.
   */
  _tick(timestamp) {
    if (!this.playing) return;

    if (this._lastTimestamp === null) {
      this._lastTimestamp = timestamp;
    }

    const deltaMs = timestamp - this._lastTimestamp;
    this._lastTimestamp = timestamp;

    // Advance time (cap delta to avoid huge jumps after tab switch)
    const deltaSec = Math.min(deltaMs / 1000, 0.05);
    this.currentTime += deltaSec;

    // Loop or stop
    if (this.currentTime >= this.duration) {
      if (this.loop) {
        this.currentTime = this.currentTime % this.duration;
      } else {
        this.currentTime = this.duration;
        this.pause();
        if (this._onTimeUpdate) this._onTimeUpdate(this.currentTime);
        return;
      }
    }

    if (this._onTimeUpdate) this._onTimeUpdate(this.currentTime);

    // Compute frame
    const frame = this.computeFrame(this.currentTime, this._tracks, this._objects);
    if (this._onFrame) this._onFrame(frame);

    // Schedule next frame
    if (this.playing) {
      this._frameId = requestAnimationFrame(this._tick);
    }
  }

  /**
   * Compute the full frame state at a given time.
   *
   * Canonical timeline contract (E2E audit):
   *   - an object is ON SCREEN only inside [enterTime, enterTime+duration)
     *     — before it enters and after it exits it is hidden, exactly like
     *     the exported video (previously the preview rendered everything at
     *     all times, so the canvas never matched the render)
   *   - `visible: false` objects are always hidden (mirrored by the codegen,
     *     which never emits them)
   *   - clips that FINISHED hold their final value (a move clip is a
     *     permanent state change in the export — the preview used to snap
     *     objects back to their base position after the clip ended)
   *   - parent deltas propagate to descendants (hierarchy.js) the same way
     *     the exporter's family VGroups animate
   *
   * @param {number} time - Current time in seconds
   * @param {Array} tracks - Track array with clips
   * @param {Array} objects - Object array
   * @returns {FrameState}
   */
  computeFrame(time, tracks, objects) {
    if (!tracks || !objects) {
      return { objectOverrides: {}, morphShapes: [], hiddenIds: new Set() };
    }

    const objectMap = this._objectMap || new Map(objects.map(o => [o.id, o]));
    const windows = this._visibilityWindows(tracks, objects);
    const evaluatedClips = [];

    for (let trackIdx = 0; trackIdx < tracks.length; trackIdx++) {
      const track = tracks[trackIdx];
      if (!track.clips) continue;

      for (const clip of track.clips) {
        const result = this._evaluateClip(clip, time, objectMap);
        if (result) {
          evaluatedClips.push({ trackIndex: trackIdx, clipResult: result });
        }
      }
    }

    const frame = blendClipResults(evaluatedClips, objectMap);

    // Timeline window + visibility contract (issue #43 — exact exporter
    // parity):
    //   - base window [enter, exit) with exit ADJUSTED past every
    //     referencing clip's end (+0.1) exactly like the codegen's
    //     exitTime, so clips that outlive an object keep it on stage;
    //   - exitAnim 'none' never removes a mobject in the export — the
    //     object stays until the scene ends, so the window is open-ended;
    //   - a transform TARGET never enters on its own (the codegen skips
    //     its enter animation): it exists on screen only from the morph's
    //     completion onward.
    for (const obj of objects) {
      if (obj.visible === false) { frame.hiddenIds.add(obj.id); continue; }
      const w = windows.get(obj.id);
      if (!w) { frame.hiddenIds.add(obj.id); continue; }
      const start = w.morphEnter != null ? w.morphEnter : w.enter;
      if (time < start || time >= w.exit) frame.hiddenIds.add(obj.id);
    }

    // Apply entrance/exit animations on top (in-window objects only)
    this._applyEnterExitAnims(frame, time, objects, windows);

    // Parent transforms propagate to children (canonical hierarchy)
    propagateParentTransforms(frame, objects);

    return frame;
  }

  /**
   * Per-object visibility windows mirroring the exporter exactly (issue #43).
   *
   * - enter — the authored enterTime (own entrance).
   * - exit — adjusted exit: max(enter + duration, latest referencing clip
   *   end + 0.1) when an exit ANIMATION plays; Infinity when the exit is
   *   'none' (the export never removes such mobjects — they stay until the
   *   scene ends).
   * - morphEnter — end of the FIRST transform clip targeting this object:
   *   its own entrance is suppressed in the export (transform targets skip
   *   enter animations) so it first exists on screen as the morph result.
   */
  _visibilityWindows(tracks, objects) {
    const windows = new Map();
    for (const obj of objects) {
      const enter = obj.enterTime || 0;
      const exitNone = (obj.exitAnim || 'none') === 'none';
      windows.set(obj.id, {
        enter,
        // exitStart — when the exit animation begins (= the codegen's
        // exitTime: lifetime end, extended past referencing clip ends)
        exitStart: enter + (obj.duration ?? 999),
        // exit — when the object is gone: exitStart + exitAnimDur for
        // animated exits; Infinity for 'none' (the export never removes
        // such mobjects — they stay until the scene ends)
        exit: Infinity,
        exitAnim: exitNone ? null : (obj.exitAnim || 'none'),
        exitDur: exitNone ? 0 : (obj.exitAnimDur || 0.5),
        morphEnter: null,
        morphEnterStart: null
      });
    }
    for (const track of tracks) {
      if (!track.clips) continue;
      for (const clip of track.clips) {
        // Clips referencing missing objects are dropped by the exporter —
        // they must not extend windows here either.
        if (clip.sourceId && !windows.has(clip.sourceId)) continue;
        if (clip.targetId && !windows.has(clip.targetId)) continue;
        const start = clip.startTime || 0;
        const end = start + (clip.duration || 0);

        for (const oid of [clip.sourceId, clip.targetId]) {
          if (!oid) continue;
          const w = windows.get(oid);
          // Exit extends past any referencing clip (codegen exitTime rule:
          // `if (end > exitTime) exitTime = end + 0.1`)
          if (end > w.exitStart) w.exitStart = end + 0.1;
          if (clip.type === 'transform' && clip.targetId === oid) {
            // First (earliest-starting) morph targeting this object wins
            if (w.morphEnter == null || start < w.morphEnterStart) {
              w.morphEnter = end;
              w.morphEnterStart = start;
            }
          }
        }
      }
    }
    for (const w of windows.values()) {
      // Object is removed once its exit animation completes; 'none' exits
      // never remove (open-ended window, exactly like the export).
      w.exit = w.exitAnim ? w.exitStart + w.exitDur : Infinity;
    }
    return windows;
  }

  /**
   * Apply entrance/exit animations to objects.
   * These are per-object properties (enterAnim, exitAnim) that animate
   * how objects appear and disappear, independent of timeline clips.
   */
  _applyEnterExitAnims(frame, time, objects, windows) {
    for (const obj of objects) {
      const enterTime = obj.enterTime || 0;
      const enterDur = obj.enterAnimDur || 0.5;
      const exitDur = obj.exitAnimDur || 0.5;
      const enterAnim = obj.enterAnim || 'none';
      const exitAnim = obj.exitAnim || 'none';
      const w = windows ? windows.get(obj.id) : null;
      // Adjusted exit (clip-extended); Infinity for 'none' exits
      const exitTime = w ? w.exitStart : enterTime + (obj.duration || 999);
      const goneAt = w ? w.exit : exitTime;
      // Transform targets never enter on their own (exporter suppresses it)
      const enterSuppressed = w && w.morphEnter != null;

      // Object not yet visible or already gone
      if (time < (w && w.morphEnter != null ? w.morphEnter : enterTime) || time >= goneAt) continue;

      // Skip if hidden by a transform clip
      if (frame.hiddenIds.has(obj.id)) continue;

      let overrides = frame.objectOverrides[obj.id] || {};
      let changed = false;

      // ── Entrance animation ──
      // Transform targets never enter on their own — the exporter skips
      // their enter animation (they first exist as the morph result).
      if (enterAnim !== 'none' && !enterSuppressed && time < enterTime + enterDur) {
        const rawT = (time - enterTime) / enterDur;
        const t = Math.max(0, Math.min(1, rawT));
        // Use ease_out_cubic for smooth entrance
        const eased = 1 - Math.pow(1 - t, 3);

        switch (enterAnim) {
          case 'fade_in':
            overrides.opacity = eased * (obj.opacity ?? 1);
            changed = true;
            break;
          case 'grow_in':
            overrides.scaleX = eased;
            overrides.scaleY = eased;
            overrides.opacity = Math.min(1, eased * 2) * (obj.opacity ?? 1);
            changed = true;
            break;
          case 'fly_in_left':
            overrides.x = obj.x - (1 - eased) * 600;
            overrides.opacity = eased * (obj.opacity ?? 1);
            changed = true;
            break;
          case 'fly_in_right':
            overrides.x = obj.x + (1 - eased) * 600;
            overrides.opacity = eased * (obj.opacity ?? 1);
            changed = true;
            break;
          case 'fly_in_top':
            overrides.y = obj.y - (1 - eased) * 400;
            overrides.opacity = eased * (obj.opacity ?? 1);
            changed = true;
            break;
          case 'fly_in_bottom':
            overrides.y = obj.y + (1 - eased) * 400;
            overrides.opacity = eased * (obj.opacity ?? 1);
            changed = true;
            break;
          case 'draw':
          case 'write':
            // Simulated with opacity + scale for preview; real effect in Manim
            overrides.opacity = eased * (obj.opacity ?? 1);
            overrides.scaleX = 0.8 + 0.2 * eased;
            overrides.scaleY = 0.8 + 0.2 * eased;
            changed = true;
            break;
          case 'spin_in':
            overrides.rotation = (obj.rotation || 0) - (1 - eased) * 360;
            overrides.opacity = eased * (obj.opacity ?? 1);
            overrides.scaleX = eased;
            overrides.scaleY = eased;
            changed = true;
            break;
          case 'bounce_in': {
            // Bounce easing
            let bt;
            if (t < 0.5) {
              bt = 2 * t * t;
            } else {
              const n = 7.5625;
              const d = 2.75;
              let p = t;
              if (p < 1 / d) bt = n * p * p;
              else if (p < 2 / d) bt = n * (p -= 1.5 / d) * p + 0.75;
              else if (p < 2.5 / d) bt = n * (p -= 2.25 / d) * p + 0.9375;
              else bt = n * (p -= 2.625 / d) * p + 0.984375;
            }
            overrides.scaleX = bt;
            overrides.scaleY = bt;
            overrides.opacity = Math.min(1, t * 3) * (obj.opacity ?? 1);
            changed = true;
            break;
          }
        }
      }

      // ── Exit animation ──
      // Issue #43: the exporter runs the exit animation AT exitTime
      // (`steps.push({time: exitTime, code: FadeOut, dur})`) — the mobject
      // is removed at exitTime + exitAnimDur. The preview must fade on the
      // SAME side of exitTime (it used to pre-fade, going dark before the
      // video did and vanishing exitAnimDur early).
      if (exitAnim !== 'none' && time >= exitTime && time < exitTime + exitDur) {
        const rawT = (time - exitTime) / exitDur;
        const t = Math.max(0, Math.min(1, rawT));
        // ease-in cubic: settles to invisible as the removal completes
        const eased = t * t * t;
        const fade = 1 - eased;   // 1 → 0 across the exit window

        switch (exitAnim) {
          case 'fade_out':
            overrides.opacity = fade * (overrides.opacity ?? obj.opacity ?? 1);
            changed = true;
            break;
          case 'shrink_out':
            overrides.scaleX = fade * (overrides.scaleX ?? 1);
            overrides.scaleY = fade * (overrides.scaleY ?? 1);
            overrides.opacity = fade * (overrides.opacity ?? obj.opacity ?? 1);
            changed = true;
            break;
          case 'fly_out_left':
            overrides.x = (overrides.x ?? obj.x) - (1 - fade) * 600;
            overrides.opacity = fade * (overrides.opacity ?? obj.opacity ?? 1);
            changed = true;
            break;
          case 'fly_out_right':
            overrides.x = (overrides.x ?? obj.x) + (1 - fade) * 600;
            overrides.opacity = fade * (overrides.opacity ?? obj.opacity ?? 1);
            changed = true;
            break;
          case 'fly_out_top':
            overrides.y = (overrides.y ?? obj.y) - (1 - fade) * 400;
            overrides.opacity = fade * (overrides.opacity ?? obj.opacity ?? 1);
            changed = true;
            break;
          case 'fly_out_bottom':
            overrides.y = (overrides.y ?? obj.y) + (1 - fade) * 400;
            overrides.opacity = fade * (overrides.opacity ?? obj.opacity ?? 1);
            changed = true;
            break;
          case 'uncreate':
            overrides.opacity = fade * (overrides.opacity ?? obj.opacity ?? 1);
            overrides.scaleX = 0.8 + 0.2 * fade;
            overrides.scaleY = 0.8 + 0.2 * fade;
            changed = true;
            break;
          case 'spin_out':
            overrides.rotation = (overrides.rotation ?? obj.rotation ?? 0) + (1 - fade) * 360;
            overrides.opacity = fade * (overrides.opacity ?? obj.opacity ?? 1);
            overrides.scaleX = fade * (overrides.scaleX ?? 1);
            overrides.scaleY = fade * (overrides.scaleY ?? 1);
            changed = true;
            break;
        }
      }

      if (changed) {
        frame.objectOverrides[obj.id] = overrides;
      }
    }
  }

  /**
   * Evaluate a single clip at the given time.
   * A COMPLETED clip holds its final value (progress = 1): in the export a
   * move/scale/fade/rotate clip permanently changes the object, so the
   * preview must not snap back to the base state after the clip ends.
   */
  _evaluateClip(clip, time, objectMap) {
    const active = isClipActive(clip, time);
    const completed = isClipCompleted(clip, time);

    if (clip.type === 'transform') {
      return this._evaluateTransformClip(clip, time, active, completed, objectMap);
    }

    if (!active && !completed) return null;               // before start: no effect
    const progress = completed ? 1 : getClipProgress(clip, time);
    const easedT = evaluateEasing(progress, clip.easing || 'ease_in_out', clip.overshoot || 0, clip.settle || 1.0);

    const sourceObj = objectMap.get(clip.sourceId);
    if (!sourceObj) return null;

    const overrides = {};

    switch (clip.type) {
      case 'move': {
        const params = clip.params || {};
        overrides.x = lerp(sourceObj.x, params.targetX !== undefined ? params.targetX : sourceObj.x, easedT);
        overrides.y = lerp(sourceObj.y, params.targetY !== undefined ? params.targetY : sourceObj.y, easedT);
        break;
      }
      case 'scale': {
        const params = clip.params || {};
        const targetSX = params.targetScaleX !== undefined ? params.targetScaleX : 1;
        const targetSY = params.targetScaleY !== undefined ? params.targetScaleY : 1;
        overrides.scaleX = lerp(1, targetSX, easedT);
        overrides.scaleY = lerp(1, targetSY, easedT);
        break;
      }
      case 'fade': {
        const params = clip.params || {};
        const startOpacity = sourceObj.opacity !== undefined ? sourceObj.opacity : 1;
        const targetOpacity = params.targetOpacity !== undefined ? params.targetOpacity : 0;
        overrides.opacity = lerp(startOpacity, targetOpacity, easedT);
        break;
      }
      case 'rotate': {
        const params = clip.params || {};
        const startRot = sourceObj.rotation || 0;
        const targetRot = params.targetRotation !== undefined ? params.targetRotation : 360;
        overrides.rotation = lerp(startRot, targetRot, easedT);
        break;
      }
    }

    return {
      objectId: clip.sourceId,
      overrides,
      clipId: clip.id
    };
  }

  /**
   * Evaluate a transform (morph) clip.
   */
  _evaluateTransformClip(clip, time, active, completed, objectMap) {
    const sourceObj = objectMap.get(clip.sourceId);
    const targetObj = objectMap.get(clip.targetId);
    if (!sourceObj || !targetObj) return null;

    // After completion: source hidden, target visible
    if (completed) {
      return {
        clipId: clip.id,
        hideIds: [clip.sourceId],
        objectId: clip.sourceId,
        overrides: {}
      };
    }

    // Before start: no effect
    if (!active) return null;

    // During: compute morph
    const progress = getClipProgress(clip, time);
    const easedT = evaluateEasing(progress, clip.easing || 'ease_in_out', clip.overshoot || 0, clip.settle || 1.0);

    // Get or compute resampled points
    const quality = clip.morphQuality || 'medium';
    const sourcePoints = this._getResampledPoints(sourceObj, quality);
    const targetPoints = this._getResampledPoints(targetObj, quality);

    const morphState = computeMorphState(sourceObj, targetObj, sourcePoints, targetPoints, easedT);

    return {
      clipId: clip.id,
      morphState: {
        ...morphState,
        flatPoints: pointsToFlat(morphState.points)
      },
      hideIds: [clip.sourceId, clip.targetId],
      objectId: clip.sourceId,
      overrides: {}
    };
  }

  /**
   * Get resampled points for an object (cached).
   */
  _getResampledPoints(obj, quality) {
    const cacheKey = `${obj.id}_${obj.type}_${obj.width}_${obj.height}_${quality}`;
    if (this._pointsCache.has(cacheKey)) {
      return this._pointsCache.get(cacheKey);
    }

    const QUALITY_COUNTS = { low: 32, medium: 64, high: 128 };
    const count = QUALITY_COUNTS[quality] || 64;
    const raw = generateShapePoints(obj.type, obj.width, obj.height, quality);
    const resampled = resamplePoints(raw, count);
    this._pointsCache.set(cacheKey, resampled);
    return resampled;
  }

  /**
   * Destroy the engine, clean up.
   */
  destroy() {
    this.pause();
    this._onFrame = null;
    this._onTimeUpdate = null;
    this._pointsCache.clear();
  }
}

// Singleton instance
let _instance = null;

export function getPlaybackEngine() {
  if (!_instance) {
    _instance = new PlaybackEngine();
  }
  return _instance;
}

export default { PlaybackEngine, getPlaybackEngine };
