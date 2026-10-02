/**
 * Manim Python Code Generator — v5 (server-side, registry-driven)
 *
 * Generates a Manim CE scene from the normalized project JSON.
 * The generator itself contains NO knowledge of:
 *   - object types   (-> compiler/registry/objects.js)
 *   - animations     (-> compiler/registry/animations.js)
 *   - scene types    (-> compiler/registry/scenes.js)
 *
 * It only orchestrates: header -> scene prologue -> objects -> groups ->
 * animation steps -> epilogue. Scene types inject prologue code
 * (camera setup) through their registered `emitPrologue`.
 *
 * Output for legacy scene_2d projects is byte-identical to v4 except for
 * one added documentation line ("Scene type: ...") in the module docstring
 * (regression-tested in tests/compiler.test.mjs).
 */

import { registries } from './registry/index.js';
import { makeObjectContext, unknownObjectLines, objectDimensionality } from './registry/objects.js';
import { animationCode, getAnimation } from './registry/animations.js';
import { resolveSceneType } from './registry/scenes.js';
import {
  hex, safeNum, safeOpacity, vn, rtOpt, stageToManim, editorRotationToManim,
  isSystemFont, FRAME_HEIGHT
} from './registry/shared.js';

export { EASING_MAP } from './registry/shared.js';

/** Sanitize a scene class name into a valid Python identifier. */
export function safeClassName(name, fallback = 'MainScene') {
  if (!name || typeof name !== 'string') return fallback;
  const n = name.replace(/[^A-Za-z0-9_]/g, '_');
  if (!/^[A-Za-z_]/.test(n) || n.length === 0) return fallback;
  return n;
}

/** Family wrapper variable for an object that has children: animating the
 *  wrapper propagates the transform to every descendant (VGroup holds
 *  references, so individually-added children follow). */
export function familyVar(id) {
  return `fam_${vn(id)}`;
}

/** Variable to animate for a clip targeting `objId`: the family wrapper when
 *  the object has visible children, the bare mobject otherwise. */
function clipTargetVar(objects, objId) {
  const hasKids = objects.some(o => o.parentId === objId && o.visible !== false);
  return hasKids ? familyVar(objId) : vn(objId);
}

/** Depth of an object's descendant chain (for bottom-up family emission). */
function subtreeDepth(objects, id, seen = new Set()) {
  if (seen.has(id)) return 0;          // cycle guard — treated as leaf
  seen.add(id);
  let depth = 0;
  for (const o of objects) {
    if (o.parentId === id && o.visible !== false) {
      depth = Math.max(depth, 1 + subtreeDepth(objects, o.id, seen));
    }
  }
  return depth;
}

/** Stage-relative depth (pixels, 0 = stage plane) -> Manim z units. */
function stageZToManim(z, sh) {
  const n = Number(z);
  return Number.isFinite(n) ? (n / sh) * FRAME_HEIGHT : 0;
}

// ── Main generator ──────────────────────────────────────────────────────────

/**
 * Emit one same-time step group and return the timeline time it consumes.
 *
 * Editor semantics (issue #36): animations that start together play in
 * parallel. Instant `self.add` steps merge into one add (zero duration).
 * `self.play` steps merge into ONE play call:
 *   - constructor animations only (FadeIn/Write/Transform/…) -> each
 *     animation carries its OWN run_time (and rate_func), exactly matching
 *     the editor's parallel, independent-duration playback;
 *   - groups containing `.animate` chains (which cannot carry per-animation
 *     run_time) -> one play-level run_time = max(duration), rate_func at
 *     play level when uniform (documented approximation for that case).
 *
 * @returns {number} duration the group advances the timeline by
 */
function emitStepGroup(L, indent, group) {
  const adds = [];
  const plays = [];
  for (const step of group) {
    if (typeof step.code === 'string' && step.code.startsWith('self.add(')) {
      adds.push(step.code.slice('self.add('.length, -1).trim());
    } else {
      plays.push(step);
    }
  }

  if (adds.length > 0) {
    L.push(`${indent}self.add(${adds.join(', ')})`);
  }
  if (plays.length === 0) return 0;
  if (plays.length === 1) {
    // Single animation: emit the registry statement verbatim.
    L.push(`${indent}${plays[0].code}`);
    return plays[0].dur || 0.5;
  }

  const parts = plays.map((step) => {
    const { anim, rateFunc } = splitPlayKwargs(step.code);
    return { anim, rateFunc, dur: step.dur || 0.5 };
  });

  if (parts.some((p) => p.anim.includes('.animate.'))) {
    const runTime = Math.max(...parts.map((p) => p.dur));
    const rates = [...new Set(parts.filter((p) => p.rateFunc).map((p) => p.rateFunc))];
    const decorated = parts.map((p) =>
      (isCtorAnim(p.anim) && p.rateFunc) ? withKwargs(p.anim, [`rate_func=${p.rateFunc}`]) : p.anim);
    const rateTail = rates.length === 1 ? `, rate_func=${rates[0]}` : '';
    L.push(`${indent}self.play(${decorated.join(', ')}${rateTail}, run_time=${runTime.toFixed(1)})`);
    return runTime;
  }

  const decorated = parts.map((p) => {
    const kws = [];
    if (p.rateFunc) kws.push(`rate_func=${p.rateFunc}`);
    kws.push(`run_time=${p.dur.toFixed(1)}`);
    return withKwargs(p.anim, kws);
  });
  L.push(`${indent}self.play(${decorated.join(', ')})`);
  return Math.max(...parts.map((p) => p.dur));
}

const isCtorAnim = (expr) => /^[A-Z]\w*\(/.test(String(expr).trim());

/** Strip `self.play(…)` and the trailing play-level kwargs the registry
 *  appended (run_time / rate_func, in either order); the caller re-attaches
 *  them per animation when batching. */
function splitPlayKwargs(code) {
  let s = String(code).trim();
  let rateFunc = null;
  if (s.startsWith('self.play(') && s.endsWith(')')) s = s.slice('self.play('.length, -1);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const m = /,\s*(run_time=[\d.]+|rate_func=[\w.]+)\s*$/.exec(s);
    if (!m) break;
    if (m[1].startsWith('rate_func')) rateFunc = m[1].slice('rate_func='.length);
    s = s.slice(0, m.index);
  }
  return { anim: s.trim(), rateFunc };
}

/** Append kwargs to a balanced call expression `Name(…)` → `Name(…, kw, …)`.
 *  Non-call expressions get them appended as plain trailing args. */
function withKwargs(expr, kws) {
  const s = String(expr).trim();
  if (s.endsWith(')')) {
    let depth = 0;
    for (let i = s.length - 1; i >= 0; i--) {
      if (s[i] === ')') depth += 1;
      else if (s[i] === '(') {
        depth -= 1;
        if (depth === 0) {
          const head = s.slice(0, i);
          const inner = s.slice(i + 1, -1).trim();
          return inner ? `${head}(${inner}, ${kws.join(', ')})` : `${head}(${kws.join(', ')})`;
        }
      }
    }
  }
  return `${s}, ${kws.join(', ')}`;
}

export function generatePythonCode(project, assetsPath) {
  const L = [];
  const sw = project.stage.width;
  const sh = project.stage.height;
  const assetMap = project._assetMap || {};

  // ── Canonical object set (E2E audit):
  //    - `visible: false` objects are never emitted (preview, timeline and
  //      codegen agree on the same contract)
  //    - objects are emitted in zOrder (layer) order — Manim's render order
  //      is creation order, so the video layers match the editor canvas
  //      (stable sort: equal zOrder keeps insertion order)
  //    - clips referencing dropped objects are dropped with them
  const visibleObjects = (project.objects || [])
    .filter(o => o.visible !== false)
    .sort((a, b) => (a.zOrder || 0) - (b.zOrder || 0));
  const visibleIds = new Set(visibleObjects.map(o => o.id));
  const liveClips = [];
  for (const track of project.tracks || []) {
    for (const clip of track.clips || []) {
      const srcOk = !clip.sourceId || visibleIds.has(clip.sourceId);
      const tgtOk = !clip.targetId || visibleIds.has(clip.targetId);
      if (srcOk && tgtOk) liveClips.push(clip);
    }
  }

  // ── Scene type resolution (registry-driven, no hardcoded Scene base) ──
  const sceneType = resolveSceneType(project);
  const className = safeClassName(project.scene?.className, 'MainScene');

  // ── Font collection (visible text objects only — invisible objects
  //    never render, so their fonts are not registered) ──
  const usedFonts = new Set();
  for (const obj of visibleObjects) {
    if (obj.type === 'text' && obj.fontFamily && !isSystemFont(obj.fontFamily)) {
      usedFonts.add(obj.fontFamily);
    }
  }
  const fontsArray = Array.from(usedFonts);

  // ── Header ──
  L.push('"""');
  L.push(`Manim Studio – ${project.name}`);
  L.push(`Scene type: ${sceneType.label}`);
  L.push(`Run:  manim -qh scene.py ${className}`);
  L.push('"""');
  L.push('');
  L.push('from manim import *');
  L.push('import numpy as np');
  for (const imp of (sceneType.extraImports || [])) L.push(imp);
  if (fontsArray.length > 0) {
    L.push('from manim_fonts import RegisterFont');
  }
  L.push('');
  L.push('');
  L.push(`class ${className}(${sceneType.baseClass}):`);
  L.push('    def construct(self):');

  // ── Scene prologue (camera setup — delegated to the scene type) ──
  const prologue = sceneType.emitPrologue
    ? sceneType.emitPrologue({ project, hex, safeNum, safeOpacity })
    : [];
  for (const line of prologue) L.push(`        ${line}`);
  L.push('');

  if (visibleObjects.length === 0) {
    L.push('        self.wait(1)');
    return L.join('\n');
  }

  // ── Font registration blocks (unchanged behaviour) ──
  let indent = '        ';
  if (fontsArray.length > 0) {
    L.push(`${indent}# Register Google Fonts`);
    for (let i = 0; i < fontsArray.length; i++) {
      const font = fontsArray[i];
      const fontVar = `fonts_${i}`;
      L.push(`${indent}with RegisterFont("${font}") as ${fontVar}:`);
      indent += '    ';
    }
    L.push('');
  }

  // ── Object definitions (registry-driven, zOrder-sorted) ──
  const ctx = makeObjectContext({ stage: project.stage, assetsPath, assetMap });
  const oMap = {};
  L.push(`${indent}# Objects`);
  for (const obj of visibleObjects) {
    oMap[obj.id] = obj;

    const typeEntry = registries.objects.get(obj.type);
    let lines;
    if (typeEntry) {
      lines = typeEntry.codegen(obj, ctx);
    } else {
      // Unknown type: neutral placeholder, never crash (matches v4 fallback)
      lines = unknownObjectLines(obj);
    }
    for (const l of lines) L.push(indent + l);

    // Uniform placement (every object), preserved from v4.
    // 3D objects carry a stage-relative z (default 0); rotation is negated
    // because the editor's y-axis points down while Manim's points up.
    const is3d = objectDimensionality(obj.type) === '3d';
    const mp = stageToManim(obj.x, obj.y, sw, sh);
    const mz = is3d ? stageZToManim(obj.z, sh) : 0;
    L.push(indent + `${vn(obj.id)}.move_to([${mp.x.toFixed(3)}, ${mp.y.toFixed(3)}, ${mz.toFixed(3)}])`);
    if (obj.rotation) L.push(indent + `${vn(obj.id)}.rotate(${editorRotationToManim(obj.rotation).toFixed(4)})`);
    L.push('');
  }

  // ── Parent/child families (E2E audit: hierarchy is canonical) ──
  // A parent with children gets a VGroup wrapper holding itself + children
  // (a child with its own children contributes ITS family group — nesting).
  // Animating the wrapper in Manim moves/rotates/scales every descendant,
  // exactly like the editor preview's parent transform propagation.
  const families = visibleObjects.filter(o =>
    visibleObjects.some(c => c.parentId === o.id)
  );
  if (families.length > 0) {
    L.push(`${indent}# Parent/child families`);
    // Deepest subtrees first so nested families exist before their parents.
    const ordered = [...families].sort((a, b) =>
      subtreeDepth(visibleObjects, b.id) - subtreeDepth(visibleObjects, a.id)
    );
    for (const parent of ordered) {
      const kids = visibleObjects.filter(c => c.parentId === parent.id);
      const refs = [vn(parent.id), ...kids.map(c =>
        visibleObjects.some(k => k.parentId === c.id) ? familyVar(c.id) : vn(c.id)
      )];
      L.push(`${indent}${familyVar(parent.id)} = VGroup(${refs.join(', ')})`);
    }
    L.push('');
  }

  // ── Groups (childIds may reference objects AND other groups — nesting) ──
  const groups = project.groups || [];
  const emittedGroups = new Set();
  function emitGroup(g, stack) {
    if (!g || emittedGroups.has(g.id) || stack.has(g.id)) return;  // cycle guard
    if (!g.childIds || g.childIds.length === 0) return;
    stack.add(g.id);
    const refs = [];
    for (const cid of g.childIds) {
      if (visibleIds.has(cid)) refs.push(vn(cid));
      else {
        const child = groups.find(x => x.id === cid);
        if (child) {
          emitGroup(child, stack);            // inner groups first
          if (emittedGroups.has(child.id)) refs.push(vn(child.id));
        }
      }
    }
    stack.delete(g.id);
    if (refs.length === 0) return;            // group fully filtered out
    emittedGroups.add(g.id);
    L.push(`${indent}${vn(g.id)} = VGroup(${refs.join(', ')})`);
  }
  if (groups.length > 0) {
    L.push(`${indent}# Groups`);
    for (const g of groups) emitGroup(g, new Set());
    L.push('');
  }

  // ── Collect clips (clips referencing invisible objects were dropped) ──
  const clips = liveClips.slice();
  clips.sort((a, b) => a.startTime - b.startTime);

  // Transform relationship tracking (unchanged)
  const transformSources = new Set();
  const transformTargets = new Set();
  for (const c of clips) {
    if (c.type === 'transform') {
      transformSources.add(c.sourceId);
      if (c.targetId) transformTargets.add(c.targetId);
    }
  }

  // ── Animation steps (registry-driven) ──
  const steps = [];

  // Enter animations
  for (const obj of visibleObjects) {
    if (transformTargets.has(obj.id)) continue;
    const t = obj.enterTime || 0;
    const n = vn(obj.id);
    const dur = obj.enterAnimDur || 0.5;
    const enterAnim = obj.enterAnim || 'fade_in';

    const entry = getAnimation('enter', enterAnim);
    let code;
    if (entry) {
      // Registered animation — use its emission (may legitimately be null)
      code = animationCode('enter', enterAnim, { varName: n, duration: dur });
    } else {
      // Unknown enter animation: fall back to fade_in (v4 behaviour)
      code = animationCode('enter', 'fade_in', { varName: n, duration: dur });
    }
    if (code) steps.push({ time: t, order: 0, code, dur: entry?.zeroDuration ? 0 : dur });
  }

  // Clip animations — the animated var is the FAMILY wrapper when the
  // target object has children (parent transforms affect children), with
  // the parent's base center as the pivot the preview propagates around.
  for (const c of clips) {
    const targetObj = visibleObjects.find(o => o.id === c.sourceId);
    const sn = clipTargetVar(visibleObjects, c.sourceId);
    const isFamily = sn !== vn(c.sourceId);
    let family = null;
    if (isFamily && targetObj) {
      const mp = stageToManim(targetObj.x, targetObj.y, sw, sh);
      family = { pivot: [mp.x, mp.y, stageZToManim(targetObj.z, sh)] };
    }
    const code = animationCode('clip', c.type, {
      varName: sn, clip: c, duration: c.duration, project, family
    });
    if (code) steps.push({ time: c.startTime, order: 1, code, dur: c.duration });
  }

  // Exit animations
  for (const obj of visibleObjects) {
    if (transformSources.has(obj.id)) continue;
    let exitTime = (obj.enterTime || 0) + (obj.duration || 3);
    for (const c of clips) {
      const end = c.startTime + c.duration;
      if ((c.sourceId === obj.id || c.targetId === obj.id) && end > exitTime) exitTime = end + 0.1;
    }
    const n = vn(obj.id);
    const exitAnim = obj.exitAnim || 'none';
    const dur = obj.exitAnimDur || 0.5;

    let code;
    if (getAnimation('exit', exitAnim)) {
      // Registered animation — use its emission ('none' legitimately returns null)
      code = animationCode('exit', exitAnim, { varName: n, duration: dur });
    } else {
      // Unknown exit animation: fall back to fade_out (v4 behaviour)
      code = animationCode('exit', 'fade_out', { varName: n, duration: dur });
    }
    if (code) steps.push({ time: exitTime, order: 2, code, dur });
  }

  // Sort & emit. Steps that start at the same time are SIMULTANEOUS in the
  // editor timeline (issue #36): they are batched into one self.play(...)
  // instead of running back-to-back, so the exported duration matches the
  // editor instead of inflating by the sum of every same-time animation.
  steps.sort((a, b) => a.time - b.time || a.order - b.order);

  L.push(`${indent}# Animation`);
  let t = 0;
  const EPS = 0.05;
  let i = 0;
  while (i < steps.length) {
    let j = i;
    while (j + 1 < steps.length && Math.abs(steps[j + 1].time - steps[i].time) <= EPS) j++;
    const group = steps.slice(i, j + 1);
    const gTime = group[0].time;

    const wait = gTime - t;
    if (wait > 0.05) L.push(`${indent}self.wait(${wait.toFixed(1)})`);
    t = gTime + emitStepGroup(L, indent, group);
    i = j + 1;
  }

  L.push('');
  L.push(`${indent}self.wait(1)`);
  return L.join('\n');
}

// ── Legacy export kept for compatibility (not used by the pipeline anymore) ──

export function objectCode(obj, sw, sh, assetsPath, assetMap) {
  const ctx = makeObjectContext({
    stage: { width: sw, height: sh },
    assetsPath, assetMap
  });
  const entry = registries.objects.get(obj.type);
  return entry ? entry.codegen(obj, ctx) : unknownObjectLines(obj);
}

/** Sort objects by zOrder with insertion order as the tiebreaker. */
export function sortObjectsByZOrder(objects) {
  return [...(objects || [])].sort((a, b) => (a.zOrder || 0) - (b.zOrder || 0));
}
