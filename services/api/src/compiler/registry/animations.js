/**
 * Animation Registry
 *
 * Every enter / exit / clip animation is registered here as a template
 * function. The compiler never hardcodes animation names — it looks them up
 * here by (phase, key).
 *
 * E2E audit (timeline fidelity): every entry returns an ANIMATION EXPRESSION
 * (e.g. `FadeIn(o, run_time=0.5)`), NOT a `self.play(...)` statement. The
 * scene assembler schedules expressions into waves: overlapping animations
 * share one self.play, later starts wrapped in `Succession(Wait(delay),
 * anim)`, so the exported timeline matches the editor EXACTLY — no drift
 * when animations overlap. Constructor-style animations carry their own
 * run_time / rate_func, which is what makes delayed starts possible.
 *
 * Extension point — adding a new animation:
 *   registerAnimation('enter', 'my_enter', {
 *     label: 'My Enter',
 *     codegen({ varName, duration }) { return `FadeIn(${varName}, ...)`; }
 *   });
 *
 * codegen contract:
 *   - receives { varName, duration, clip, project, family }
 *   - returns an animation expression string, or the marker 'add:<varName>'
 *     for instant appearances, or null to skip
 *   - use helpers.rtOpt(duration) / rfOpt(easing) for timing kwargs
 */

import { registries } from './index.js';
import { vn, rfOpt, rtOpt, stageToManim, editorRotationToManim } from './shared.js';

/** Helpers available to every animation codegen function. */
export const animationHelpers = { vn, rfOpt, rtOpt, stageToManim };

/** Instant-appearance marker parsed by the scene assembler. */
export const ADD_MARKER = 'add:';

/**
 * Register an animation.
 * @param {'enter'|'exit'|'clip'} phase
 * @param {string} key - unique within its phase
 * @param {{ label: string, codegen: Function, defaultDuration?: number }} entry
 */
export function registerAnimation(phase, key, entry) {
  const registryKey = `${phase}:${key}`;
  if (!['enter', 'exit', 'clip'].includes(phase)) {
    throw new Error(`[animation registry] invalid phase "${phase}"`);
  }
  if (typeof entry.codegen !== 'function') {
    throw new Error(`[animation registry] "${registryKey}" must provide a codegen() function`);
  }
  return registries.animations.register(registryKey, { ...entry, phase, name: key });
}

/** Look up an animation; returns undefined for unknown keys. */
export function getAnimation(phase, key) {
  return registries.animations.get(`${phase}:${key}`);
}

/** All registered keys for a phase (used by the validator). */
export function animationKeys(phase) {
  return registries.animations
    .list()
    .filter(a => a.phase === phase)
    .map(a => a.name);
}

/**
 * Generate the animation expression for a step, with safe fallbacks:
 *  - unknown enter animation -> fade_in behaviour
 *  - unknown exit animation  -> no exit (skip)
 *  - unknown clip type       -> skipped by the caller
 */
export function animationCode(phase, key, ctx) {
  const entry = getAnimation(phase, key);
  if (!entry) return null;
  return entry.codegen({ ...ctx, helpers: animationHelpers });
}

// ─── Enter animations (11) ────────────────────────────────────────────────────

registerAnimation('enter', 'none', {
  label: 'None',
  codegen: ({ varName }) => `${ADD_MARKER}${varName}`,
  zeroDuration: true
});
registerAnimation('enter', 'fade_in', {
  label: 'Fade In',
  codegen: ({ varName, duration }) => `FadeIn(${varName}${rtOpt(duration)})`
});
registerAnimation('enter', 'grow_in', {
  label: 'Grow In',
  codegen: ({ varName, duration }) => `GrowFromCenter(${varName}${rtOpt(duration)})`
});
registerAnimation('enter', 'fly_in_left', {
  label: 'Fly In (Left)',
  codegen: ({ varName, duration }) => `FadeIn(${varName}, shift=RIGHT${rtOpt(duration)})`
});
registerAnimation('enter', 'fly_in_right', {
  label: 'Fly In (Right)',
  codegen: ({ varName, duration }) => `FadeIn(${varName}, shift=LEFT${rtOpt(duration)})`
});
registerAnimation('enter', 'fly_in_top', {
  label: 'Fly In (Top)',
  codegen: ({ varName, duration }) => `FadeIn(${varName}, shift=DOWN${rtOpt(duration)})`
});
registerAnimation('enter', 'fly_in_bottom', {
  label: 'Fly In (Bottom)',
  codegen: ({ varName, duration }) => `FadeIn(${varName}, shift=UP${rtOpt(duration)})`
});
registerAnimation('enter', 'draw', {
  label: 'Draw',
  codegen: ({ varName, duration }) => `Create(${varName}${rtOpt(duration)})`
});
registerAnimation('enter', 'write', {
  label: 'Write',
  codegen: ({ varName, duration }) => `Write(${varName}${rtOpt(duration)})`
});
registerAnimation('enter', 'spin_in', {
  label: 'Spin In',
  codegen: ({ varName, duration }) => `SpinInFromNothing(${varName}${rtOpt(duration)})`
});
registerAnimation('enter', 'bounce_in', {
  label: 'Bounce In',
  codegen: ({ varName, duration }) => `GrowFromCenter(${varName}, rate_func=rate_functions.ease_out_bounce${rtOpt(duration)})`
});

// ─── Exit animations (9) ──────────────────────────────────────────────────────

registerAnimation('exit', 'none', {
  label: 'None',
  codegen: () => null // exit omitted entirely
});
registerAnimation('exit', 'fade_out', {
  label: 'Fade Out',
  codegen: ({ varName, duration }) => `FadeOut(${varName}${rtOpt(duration)})`
});
registerAnimation('exit', 'shrink_out', {
  label: 'Shrink Out',
  codegen: ({ varName, duration }) => `ShrinkToCenter(${varName}${rtOpt(duration)})`
});
registerAnimation('exit', 'fly_out_left', {
  label: 'Fly Out (Left)',
  codegen: ({ varName, duration }) => `FadeOut(${varName}, shift=LEFT${rtOpt(duration)})`
});
registerAnimation('exit', 'fly_out_right', {
  label: 'Fly Out (Right)',
  codegen: ({ varName, duration }) => `FadeOut(${varName}, shift=RIGHT${rtOpt(duration)})`
});
registerAnimation('exit', 'fly_out_top', {
  label: 'Fly Out (Top)',
  codegen: ({ varName, duration }) => `FadeOut(${varName}, shift=UP${rtOpt(duration)})`
});
registerAnimation('exit', 'fly_out_bottom', {
  label: 'Fly Out (Bottom)',
  codegen: ({ varName, duration }) => `FadeOut(${varName}, shift=DOWN${rtOpt(duration)})`
});
registerAnimation('exit', 'uncreate', {
  label: 'Uncreate',
  codegen: ({ varName, duration }) => `Uncreate(${varName}${rtOpt(duration)})`
});
registerAnimation('exit', 'spin_out', {
  label: 'Spin Out',
  codegen: ({ varName, duration }) => `FadeOut(${varName}, shift=OUT, scale=0.5${rtOpt(duration)})`
});

// ─── Clip (timeline) animations (5) ───────────────────────────────────────────
// All ctor-style so the wave scheduler can delay-start them inside one play.
// Clip pivots use the object's BASE center (the preview's propagation pivot).

registerAnimation('clip', 'transform', {
  label: 'Transform / Morph',
  codegen: ({ varName, clip, project }) => {
    const tn = vn(clip.targetId);
    const srcObj = (project.objects || []).find(o => o.id === clip.sourceId);
    const tgtObj = (project.objects || []).find(o => o.id === clip.targetId);
    const anim = transformAnimFor(srcObj, tgtObj);
    return `${anim}(${varName}, ${tn}${rtOpt(clip.duration)}${rfOpt(clip.easing)})`;
  }
});

registerAnimation('clip', 'move', {
  label: 'Move',
  codegen: ({ varName, clip, project, family }) => {
    const sw = project.stage.width, sh = project.stage.height;
    const tx = clip.params?.targetX ?? 0, ty = clip.params?.targetY ?? 0;
    if (family) {
      // Family move: shift the whole subtree by the SAME delta the preview
      // applies (target - parent base position) — children ride rigidly.
      const mp = stageToManim(tx, ty, sw, sh);
      const dx = mp.x - family.pivot[0];
      const dy = mp.y - family.pivot[1];
      const dz = (family.pivot[2] || 0) * 0; // moves are in the stage plane
      return `ApplyMethod(${varName}.shift, [${dx.toFixed(3)}, ${dy.toFixed(3)}, ${dz.toFixed(3)}]${rtOpt(clip.duration)}${rfOpt(clip.easing)})`;
    }
    const mp = stageToManim(tx, ty, sw, sh);
    return `ApplyMethod(${varName}.move_to, [${mp.x.toFixed(3)}, ${mp.y.toFixed(3)}, 0]${rtOpt(clip.duration)}${rfOpt(clip.easing)})`;
  }
});

registerAnimation('clip', 'scale', {
  label: 'Scale',
  codegen: ({ varName, clip, family }) => {
    const sx = Number(clip.params?.targetScaleX ?? 1) || 1;
    const sy = Number(clip.params?.targetScaleY ?? sx) || sx;
    // Transform to a pre-scaled copy: exact pivot control (family: parent
    // center; single object: its own center), non-uniform X/Y supported.
    const p = family ? family.pivot : null;
    const pivot = p
      ? `, about_point=[${p[0].toFixed(3)}, ${p[1].toFixed(3)}, ${p[2].toFixed(3)}]`
      : '';
    const uniform = Math.abs(sx - sy) < 1e-6;
    const chain = uniform
      ? `.scale(${sx.toFixed(3)}${pivot})`
      : `.stretch(${sx.toFixed(3)}, 0${pivot}).stretch(${sy.toFixed(3)}, 1${pivot})`;
    const tgt = `tgt_${vn(clip.id)}`;
    return `__TARGET__ ${tgt} = ${varName}.copy()${chain}\nTransform(${varName}, ${tgt}${rtOpt(clip.duration)}${rfOpt(clip.easing)})`;
  }
});

registerAnimation('clip', 'fade', {
  label: 'Fade',
  codegen: ({ varName, clip }) => {
    const op = clip.params?.targetOpacity ?? 0;
    return op < 0.01
      ? `FadeOut(${varName}${rtOpt(clip.duration)}${rfOpt(clip.easing)})`
      : `ApplyMethod(${varName}.set_opacity, ${op.toFixed(2)}${rtOpt(clip.duration)}${rfOpt(clip.easing)})`;
  }
});

registerAnimation('clip', 'rotate', {
  label: 'Rotate',
  codegen: ({ varName, clip, project, family }) => {
    const srcObj = (project.objects || []).find(o => o.id === clip.sourceId);
    // Editor rotation is clockwise-positive (canvas y-down); Manim rotates
    // counter-clockwise — negate the delta or the video mirrors the preview.
    const delta = ((clip.params?.targetRotation ?? 360) - (srcObj?.rotation || 0));
    const ang = editorRotationToManim(delta);
    // Pivot: the family's parent center, or the object's own base center.
    const p = family ? family.pivot : null;
    if (p) {
      return `Rotate(${varName}, angle=${ang.toFixed(2)}, about_point=[${p[0].toFixed(3)}, ${p[1].toFixed(3)}, ${p[2].toFixed(3)}]${rtOpt(clip.duration)}${rfOpt(clip.easing)})`;
    }
    const sw = project.stage.width, sh = project.stage.height;
    const mp = stageToManim(srcObj?.x ?? 0, srcObj?.y ?? 0, sw, sh);
    const mz = Number.isFinite(Number(srcObj?.z)) && (srcObj.z || 0) !== 0
      ? (Number(srcObj.z) / sh) * 8 : 0;
    return `Rotate(${varName}, angle=${ang.toFixed(2)}, about_point=[${mp.x.toFixed(3)}, ${mp.y.toFixed(3)}, ${mz.toFixed(3)}]${rtOpt(clip.duration)}${rfOpt(clip.easing)})`;
  }
});

// Raster-involving transforms degrade to FadeTransform (both codegens agree).
export function transformAnimFor(srcObj, tgtObj) {
  const hasRaster = ['image', 'svg_asset'].includes(srcObj?.type) || ['image', 'svg_asset'].includes(tgtObj?.type);
  return hasRaster ? 'FadeTransform' : 'ReplacementTransform';
}
