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
import { makeObjectContext, unknownObjectLines } from './registry/objects.js';
import { animationCode, getAnimation } from './registry/animations.js';
import { resolveSceneType } from './registry/scenes.js';
import {
  hex, safeNum, safeOpacity, vn, rtOpt, stageToManim, isSystemFont
} from './registry/shared.js';

export { EASING_MAP } from './registry/shared.js';

/** Sanitize a scene class name into a valid Python identifier. */
export function safeClassName(name, fallback = 'MainScene') {
  if (!name || typeof name !== 'string') return fallback;
  const n = name.replace(/[^A-Za-z0-9_]/g, '_');
  if (!/^[A-Za-z_]/.test(n) || n.length === 0) return fallback;
  return n;
}

// ── Main generator ──────────────────────────────────────────────────────────

export function generatePythonCode(project, assetsPath) {
  const L = [];
  const sw = project.stage.width;
  const sh = project.stage.height;
  const assetMap = project._assetMap || {};

  // ── Scene type resolution (registry-driven, no hardcoded Scene base) ──
  const sceneType = resolveSceneType(project);
  const className = safeClassName(project.scene?.className, 'MainScene');

  // ── Font collection (text objects only, unchanged behaviour) ──
  const usedFonts = new Set();
  for (const obj of (project.objects || [])) {
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

  if (!project.objects || project.objects.length === 0) {
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

  // ── Object definitions (registry-driven) ──
  const ctx = makeObjectContext({ stage: project.stage, assetsPath, assetMap });
  const oMap = {};
  L.push(`${indent}# Objects`);
  for (const obj of project.objects) {
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

    // Uniform placement (every object), preserved from v4
    const mp = stageToManim(obj.x, obj.y, sw, sh);
    L.push(indent + `${vn(obj.id)}.move_to([${mp.x.toFixed(3)}, ${mp.y.toFixed(3)}, 0])`);
    if (obj.rotation) L.push(indent + `${vn(obj.id)}.rotate(${(obj.rotation * Math.PI / 180).toFixed(4)})`);
    L.push('');
  }

  // ── Groups ──
  const groups = project.groups || [];
  if (groups.length > 0) {
    L.push(`${indent}# Groups`);
    for (const g of groups) {
      if (!g.childIds || g.childIds.length === 0) continue;
      const childVars = g.childIds.map(id => vn(id)).filter(Boolean).join(', ');
      const gn = vn(g.id);
      L.push(`${indent}${gn} = VGroup(${childVars})`);
    }
    L.push('');
  }

  // ── Collect clips ──
  const clips = [];
  for (const track of project.tracks) {
    for (const clip of track.clips) clips.push(clip);
  }
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
  for (const obj of project.objects) {
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

  // Clip animations
  for (const c of clips) {
    const sn = vn(c.sourceId);
    const code = animationCode('clip', c.type, {
      varName: sn, clip: c, duration: c.duration, project
    });
    if (code) steps.push({ time: c.startTime, order: 1, code, dur: c.duration });
  }

  // Exit animations
  for (const obj of project.objects) {
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

  // Sort & emit
  steps.sort((a, b) => a.time - b.time || a.order - b.order);

  L.push(`${indent}# Animation`);
  let t = 0;
  for (const step of steps) {
    const wait = step.time - t;
    if (wait > 0.05) L.push(`${indent}self.wait(${wait.toFixed(1)})`);
    L.push(`${indent}${step.code}`);
    t = step.time + (step.dur || 0.5);
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
