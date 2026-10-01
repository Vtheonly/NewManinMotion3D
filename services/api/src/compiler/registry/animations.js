/**
 * Animation Registry
 *
 * Every enter / exit / clip animation is registered here as a template
 * function. The compiler never hardcodes animation names — it looks them up
 * here by (phase, key).
 *
 * Extension point — adding a new animation:
 *   registerAnimation('enter', 'my_enter', {
 *     label: 'My Enter',
 *     codegen({ varName, duration }) { return `self.play(...)`; }
 *   });
 *
 * codegen contract:
 *   - receives { varName, duration, clip, project, helpers }
 *   - returns a single Python statement string (one self.play/self.add call)
 *   - `duration` is already normalized; use helpers.rtOpt(duration)
 */

import { registries } from './index.js';
import { vn, rfOpt, rtOpt, stageToManim } from './shared.js';

/** Helpers available to every animation codegen function. */
export const animationHelpers = { vn, rfOpt, rtOpt, stageToManim };

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
 * Generate the Python statement for an animation, with safe fallbacks:
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
  codegen: ({ varName }) => `self.add(${varName})`,
  zeroDuration: true
});
registerAnimation('enter', 'fade_in', {
  label: 'Fade In',
  codegen: ({ varName, duration }) => `self.play(FadeIn(${varName})${rtOpt(duration)})`
});
registerAnimation('enter', 'grow_in', {
  label: 'Grow In',
  codegen: ({ varName, duration }) => `self.play(GrowFromCenter(${varName})${rtOpt(duration)})`
});
registerAnimation('enter', 'fly_in_left', {
  label: 'Fly In (Left)',
  codegen: ({ varName, duration }) => `self.play(FadeIn(${varName}, shift=RIGHT)${rtOpt(duration)})`
});
registerAnimation('enter', 'fly_in_right', {
  label: 'Fly In (Right)',
  codegen: ({ varName, duration }) => `self.play(FadeIn(${varName}, shift=LEFT)${rtOpt(duration)})`
});
registerAnimation('enter', 'fly_in_top', {
  label: 'Fly In (Top)',
  codegen: ({ varName, duration }) => `self.play(FadeIn(${varName}, shift=DOWN)${rtOpt(duration)})`
});
registerAnimation('enter', 'fly_in_bottom', {
  label: 'Fly In (Bottom)',
  codegen: ({ varName, duration }) => `self.play(FadeIn(${varName}, shift=UP)${rtOpt(duration)})`
});
registerAnimation('enter', 'draw', {
  label: 'Draw',
  codegen: ({ varName, duration }) => `self.play(Create(${varName})${rtOpt(duration)})`
});
registerAnimation('enter', 'write', {
  label: 'Write',
  codegen: ({ varName, duration }) => `self.play(Write(${varName})${rtOpt(duration)})`
});
registerAnimation('enter', 'spin_in', {
  label: 'Spin In',
  codegen: ({ varName, duration }) => `self.play(SpinInFromNothing(${varName})${rtOpt(duration)})`
});
registerAnimation('enter', 'bounce_in', {
  label: 'Bounce In',
  codegen: ({ varName, duration }) => `self.play(GrowFromCenter(${varName}, rate_func=rate_functions.ease_out_bounce)${rtOpt(duration)})`
});

// ─── Exit animations (9) ──────────────────────────────────────────────────────

registerAnimation('exit', 'none', {
  label: 'None',
  codegen: () => null // exit omitted entirely
});
registerAnimation('exit', 'fade_out', {
  label: 'Fade Out',
  codegen: ({ varName, duration }) => `self.play(FadeOut(${varName})${rtOpt(duration)})`
});
registerAnimation('exit', 'shrink_out', {
  label: 'Shrink Out',
  codegen: ({ varName, duration }) => `self.play(ShrinkToCenter(${varName})${rtOpt(duration)})`
});
registerAnimation('exit', 'fly_out_left', {
  label: 'Fly Out (Left)',
  codegen: ({ varName, duration }) => `self.play(FadeOut(${varName}, shift=LEFT)${rtOpt(duration)})`
});
registerAnimation('exit', 'fly_out_right', {
  label: 'Fly Out (Right)',
  codegen: ({ varName, duration }) => `self.play(FadeOut(${varName}, shift=RIGHT)${rtOpt(duration)})`
});
registerAnimation('exit', 'fly_out_top', {
  label: 'Fly Out (Top)',
  codegen: ({ varName, duration }) => `self.play(FadeOut(${varName}, shift=UP)${rtOpt(duration)})`
});
registerAnimation('exit', 'fly_out_bottom', {
  label: 'Fly Out (Bottom)',
  codegen: ({ varName, duration }) => `self.play(FadeOut(${varName}, shift=DOWN)${rtOpt(duration)})`
});
registerAnimation('exit', 'uncreate', {
  label: 'Uncreate',
  codegen: ({ varName, duration }) => `self.play(Uncreate(${varName})${rtOpt(duration)})`
});
registerAnimation('exit', 'spin_out', {
  label: 'Spin Out',
  codegen: ({ varName, duration }) => `self.play(FadeOut(${varName}, shift=OUT, scale=0.5)${rtOpt(duration)})`
});

// ─── Clip (timeline) animations (5) ───────────────────────────────────────────

registerAnimation('clip', 'transform', {
  label: 'Transform / Morph',
  codegen: ({ varName, clip, project }) => {
    const tn = vn(clip.targetId);
    const srcObj = (project.objects || []).find(o => o.id === clip.sourceId);
    const tgtObj = (project.objects || []).find(o => o.id === clip.targetId);
    const hasRaster = ['image', 'svg_asset'].includes(srcObj?.type) || ['image', 'svg_asset'].includes(tgtObj?.type);
    const anim = hasRaster ? 'FadeTransform' : 'ReplacementTransform';
    return `self.play(${anim}(${varName}, ${tn})${rtOpt(clip.duration)}${rfOpt(clip.easing)})`;
  }
});

registerAnimation('clip', 'move', {
  label: 'Move',
  codegen: ({ varName, clip, project }) => {
    const sw = project.stage.width, sh = project.stage.height;
    const mp = stageToManim(clip.params?.targetX || 0, clip.params?.targetY || 0, sw, sh);
    return `self.play(${varName}.animate.move_to([${mp.x.toFixed(2)}, ${mp.y.toFixed(2)}, 0])${rtOpt(clip.duration)}${rfOpt(clip.easing)})`;
  }
});

registerAnimation('clip', 'scale', {
  label: 'Scale',
  codegen: ({ varName, clip }) =>
    `self.play(${varName}.animate.scale(${(clip.params?.targetScaleX || 1).toFixed(2)})${rtOpt(clip.duration)}${rfOpt(clip.easing)})`
});

registerAnimation('clip', 'fade', {
  label: 'Fade',
  codegen: ({ varName, clip }) => {
    const op = clip.params?.targetOpacity ?? 0;
    return op < 0.01
      ? `self.play(FadeOut(${varName})${rtOpt(clip.duration)}${rfOpt(clip.easing)})`
      : `self.play(${varName}.animate.set_opacity(${op.toFixed(2)})${rtOpt(clip.duration)}${rfOpt(clip.easing)})`;
  }
});

registerAnimation('clip', 'rotate', {
  label: 'Rotate',
  codegen: ({ varName, clip, project }) => {
    const srcObj = (project.objects || []).find(o => o.id === clip.sourceId);
    const ang = ((clip.params?.targetRotation || 360) - (srcObj?.rotation || 0)) * Math.PI / 180;
    return `self.play(Rotate(${varName}, angle=${ang.toFixed(2)})${rtOpt(clip.duration)}${rfOpt(clip.easing)})`;
  }
});
