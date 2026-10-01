/**
 * Project JSON Validator — v3
 *
 * Validates the project schema: scene, stage, objects, tracks/clips, assets.
 *
 * v3 (Issue #1 — architecture decoupling):
 *   - `sceneType` selects the scene model (scene_2d | moving_camera |
 *     three_d | custom | <any registered scene-type key>)
 *   - `scene` carries the scene class name / custom base class
 *   - `camera` carries per-scene-type camera configuration
 *   - object types and animation names are validated against the compiler
 *     registries (data-driven, not hardcoded lists)
 */

import { z } from 'zod';
import { registries } from './registry/index.js';
import { animationKeys } from './registry/animations.js';

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

const StageSchema = z.object({
  width: z.number().positive().default(1920),
  height: z.number().positive().default(1080),
  backgroundColor: z.string().default('#000000'),
  gridVisible: z.boolean().default(true),
  gridSize: z.number().default(5),
  snapEnabled: z.boolean().default(true),
  snapToGrid: z.boolean().default(true),
  snapToCenter: z.boolean().default(true)
}).passthrough().default({});

/**
 * Scene identity: generated class name + custom base class.
 * `baseClass` is only meaningful for sceneType === 'custom'.
 */
const SceneSchema = z.object({
  className: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/, 'className must be a valid Python class name').default('MainScene'),
  baseClass: z.string().regex(/^[A-Za-z_][A-Za-z0-9_.]*$/, 'baseClass must be a valid Python identifier path').optional()
}).passthrough().default({});

/**
 * Camera configuration — union of all per-scene-type camera knobs.
 * Scene types read only the properties they declare in `supportsCamera`.
 */
const CameraSchema = z.object({
  // 2D moving camera
  zoom: z.number().positive().optional(),
  centerX: z.number().optional(),
  centerY: z.number().optional(),
  frameWidth: z.number().positive().optional(),
  frameHeight: z.number().positive().optional(),
  // 3D camera (degrees for angles)
  phi: z.number().optional(),
  theta: z.number().optional(),
  distance: z.number().positive().optional(),
  gamma: z.number().optional()
}).passthrough().default({});

const AssetSchema = z.object({
  id: z.string().min(1),
  name: z.string().default('Asset'),
  filename: z.string().optional(),
  type: z.enum(['image', 'svg']),
  width: z.number().optional(),
  height: z.number().optional()
}).passthrough();

const ObjectSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),  // validated against the object registry below
  name: z.string().default('Object'),
  x: z.number().default(960),
  y: z.number().default(540),
  width: z.number().positive().default(120),
  height: z.number().positive().default(120),
  rotation: z.number().default(0),
  fill: z.string().default('#3b82f6'),
  stroke: z.string().default('#ffffff'),
  strokeWidth: z.number().default(2),
  opacity: z.number().min(0).max(1).default(1),
  zOrder: z.number().default(0),
  visible: z.boolean().default(true),
  enterTime: z.number().min(0).default(0),
  duration: z.number().positive().default(3),
  enterAnim: z.string().default('fade_in'),
  exitAnim: z.string().default('fade_out'),
  enterAnimDur: z.number().positive().default(0.5),
  exitAnimDur: z.number().positive().default(0.5)
}).passthrough();

const ClipSchema = z.object({
  id: z.string().min(1),
  type: z.string().default('transform'),  // validated against the animation registry below
  startTime: z.number().min(0).default(0),
  duration: z.number().positive().default(1.5),
  easing: z.string().default('ease_in_out'),
  sourceId: z.string().nullable().default(null),
  targetId: z.string().nullable().default(null),
  params: z.record(z.any()).default({}),
  overshoot: z.number().default(0),
  settle: z.number().default(1),
  morphQuality: z.string().default('medium')
}).passthrough();

const TrackSchema = z.object({
  id: z.string().min(1),
  name: z.string().default('Track'),
  clips: z.array(ClipSchema).default([])
}).passthrough();

// ─── Top-level project schema ─────────────────────────────────────────────────

const ProjectSchema = z.object({
  id: z.string().nullable().default(null),
  name: z.string().default('My Animation'),
  editorMode: z.enum(['visual', 'code']).default('visual'),
  codeSource: z.string().default(''),
  sceneType: z.string().default('scene_2d'),   // validated against the scene registry below
  scene: SceneSchema,
  camera: CameraSchema,
  stage: StageSchema,
  assets: z.array(AssetSchema).default([]),
  objects: z.array(ObjectSchema).default([]),
  tracks: z.array(TrackSchema).default([]),
  sceneDuration: z.number().positive().default(10)
}).passthrough();

// ─── Validate ─────────────────────────────────────────────────────────────────

/**
 * Validate a project against the v3 schema.
 * @param {Object} project
 * @returns {{ valid: boolean, errors?: string[], data?: Object }}
 */
export function validateProject(project) {
  try {
    const result = ProjectSchema.safeParse(project);

    if (!result.success) {
      const errors = result.error.errors.map(err =>
        `${err.path.join('.')}: ${err.message}`
      );
      return { valid: false, errors };
    }

    const data = result.data;
    const errors = [];

    // ── Scene type must be a registered scene type (registry-driven) ──
    if (!registries.scenes.has(data.sceneType)) {
      errors.push(
        `sceneType: "${data.sceneType}" is not a registered scene type (available: ${registries.scenes.keys().join(', ')})`
      );
    } else if (data.sceneType === 'custom' && !data.scene?.baseClass) {
      errors.push('scene.baseClass: required when sceneType is "custom"');
    }

    // ── Object types: registry lookup, unknown types fail validation ──
    // (the codegen still emits a neutral placeholder as defence in depth,
    // but typos must not silently render placeholder circles)
    for (const obj of data.objects) {
      if (!registries.objects.has(obj.type)) {
        errors.push(
          `Object ${obj.id}: unknown type "${obj.type}" (registered: ${registries.objects.keys().join(', ')})`
        );
      }
    }

    // ── Animation names: registry-driven validation ──
    const enterKeys = animationKeys('enter');
    const exitKeys = animationKeys('exit');
    const clipKeys = animationKeys('clip');
    for (const obj of data.objects) {
      if (obj.enterAnim && !enterKeys.includes(obj.enterAnim)) {
        errors.push(`Object ${obj.id}: unknown enterAnim "${obj.enterAnim}" (registered: ${enterKeys.join(', ')})`);
      }
      if (obj.exitAnim && !exitKeys.includes(obj.exitAnim)) {
        errors.push(`Object ${obj.id}: unknown exitAnim "${obj.exitAnim}" (registered: ${exitKeys.join(', ')})`);
      }
    }

    // ── Clip object references + clip types ──
    const objectIds = new Set((data.objects || []).map(o => o.id));
    for (const track of data.tracks) {
      for (const clip of track.clips) {
        if (clip.sourceId && !objectIds.has(clip.sourceId)) {
          errors.push(`Clip ${clip.id}: references non-existent source object "${clip.sourceId}"`);
        }
        if (clip.type === 'transform' && clip.targetId && !objectIds.has(clip.targetId)) {
          errors.push(`Clip ${clip.id}: references non-existent target object "${clip.targetId}"`);
        }
        if (!clipKeys.includes(clip.type)) {
          errors.push(`Clip ${clip.id}: unknown clip type "${clip.type}" (registered: ${clipKeys.join(', ')})`);
        }
      }
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    return { valid: true, data };
  } catch (err) {
    return { valid: false, errors: [err.message] };
  }
}

export { ProjectSchema };
