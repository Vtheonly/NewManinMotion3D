/**
 * Project Normalizer — v3
 *
 * Applies defaults, clamps values, and prepares the project schema
 * (scene/sceneType/camera/stage/objects/tracks/clips/assets) for code
 * generation.
 *
 * v3 (Issue #1): normalizes the new scene identity + camera configuration
 * and keeps every value within the bounds its scene type understands.
 */

import { resolveSceneType } from './registry/scenes.js';

/**
 * Normalize a validated project.
 * @param {Object} project - Validated project JSON (v3 schema)
 * @returns {Object} Normalized project ready for codegen
 */
export function normalizeProject(project) {
  const norm = JSON.parse(JSON.stringify(project)); // deep clone

  // ── Scene type + identity ──
  norm.sceneType = norm.sceneType || 'scene_2d';
  norm.scene = {
    className: norm.scene?.className || 'MainScene',
    ...(norm.scene || {})
  };
  if (norm.sceneType === 'custom' && !norm.scene.baseClass) {
    // Defensive: validator rejects this, but never render with a broken base
    norm.scene.baseClass = 'Scene';
  }

  // ── Camera: keep only finite numeric values ──
  const cam = norm.camera || {};
  const camOut = {};
  for (const [k, v] of Object.entries(cam)) {
    if (v === null || v === undefined) continue;
    const n = typeof v === 'number' ? v : parseFloat(v);
    if (Number.isFinite(n)) camOut[k] = n;
  }
  norm.camera = camOut;

  // ── Stage ──
  norm.stage = {
    width: norm.stage?.width ?? 1920,
    height: norm.stage?.height ?? 1080,
    backgroundColor: norm.stage?.backgroundColor ?? '#000000',
    ...(norm.stage || {})
  };

  // ── Objects ──
  norm.objects = (norm.objects || []).map(obj => ({
    ...obj,
    x: obj.x ?? norm.stage.width / 2,
    y: obj.y ?? norm.stage.height / 2,
    width: Math.max(1, obj.width ?? 120),
    height: Math.max(1, obj.height ?? 120),
    rotation: obj.rotation ?? 0,
    opacity: clamp(obj.opacity ?? 1, 0, 1),
    enterTime: Math.max(0, obj.enterTime ?? 0),
    duration: Math.max(0.1, obj.duration ?? 3),
    enterAnim: obj.enterAnim ?? 'fade_in',
    exitAnim: obj.exitAnim ?? 'fade_out',
    enterAnimDur: Math.max(0.1, obj.enterAnimDur ?? 0.5),
    exitAnimDur: Math.max(0.1, obj.exitAnimDur ?? 0.5)
  }));

  // ── Groups ──
  norm.groups = (norm.groups || []).map(g => ({
    ...g,
    childIds: g.childIds || [],
    margin: g.margin ?? 10
  }));

  // ── Asset lookup map ──
  norm._assetMap = {};
  for (const asset of norm.assets || []) {
    norm._assetMap[asset.id] = asset;
  }

  // ── Tracks & clips ──
  norm.tracks = (norm.tracks || []).map(track => ({
    ...track,
    clips: (track.clips || []).map(clip => ({
      ...clip,
      startTime: Math.max(0, clip.startTime ?? 0),
      duration: Math.max(0.1, clip.duration ?? 1.5),
      easing: clip.easing ?? 'ease_in_out',
      params: clip.params ?? {}
    }))
  }));

  // Expose the resolved scene type for codegen / API responses
  norm._resolvedScene = describeSceneResolution(norm);

  return norm;
}

/** Human-readable scene resolution summary (metadata only, not used by codegen). */
function describeSceneResolution(norm) {
  const entry = resolveSceneType(norm);
  return {
    key: norm.sceneType,
    baseClass: entry.baseClass,
    dimensionality: entry.dimensionality,
    className: norm.scene.className
  };
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

export { normalizeProject as default };
