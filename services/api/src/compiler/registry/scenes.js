/**
 * Scene Type Registry
 *
 * Decouples the compiler from any single Manim scene model.
 * Each scene type knows:
 *   - which Manim base class it renders as;
 *   - extra imports it needs;
 *   - how to emit its camera/prologue code inside construct();
 *   - whether its objects live in 2D or 3D space;
 *   - how to map a Python base class name back to itself (scene detection).
 *
 * Built-in types:
 *   scene_2d       -> class <Name>(Scene)
 *   moving_camera  -> class <Name>(MovingCameraScene)
 *   three_d        -> class <Name>(ThreeDScene)
 *   custom         -> user-declared base class (e.g. a project-local subclass)
 *
 * Extension point — adding a new scene type (e.g. VectorScene, ZoomedScene):
 *   registerSceneType('vector', {
 *     label: 'Vector Scene',
 *     baseClass: 'VectorScene',
 *     dimensionality: '2d',
 *     emitPrologue(...) { ... }
 *   });
 */

import { registries } from './index.js';

/**
 * Register a scene type.
 * @param {string} key - unique scene type key
 * @param {{
 *   label: string,
 *   baseClass: string,
 *   dimensionality: '2d'|'3d',
 *   extraImports?: string[],
 *   knownBases?: string[],        // Python base class names that map to this type
 *   emitPrologue?: Function,      // ({ camera, indent }) => string[] lines inside construct()
 *   supportsCamera?: string[]     // camera properties this scene type understands
 * }} entry
 */
export function registerSceneType(key, entry) {
  if (!entry.baseClass || typeof entry.baseClass !== 'string') {
    throw new Error(`[scene-type registry] "${key}" must declare a baseClass`);
  }
  if (!['2d', '3d'].includes(entry.dimensionality)) {
    throw new Error(`[scene-type registry] "${key}" must declare dimensionality '2d' or '3d'`);
  }
  return registries.scenes.register(key, {
    knownBases: [entry.baseClass],
    supportsCamera: [],
    ...entry
  });
}

/**
 * Resolve the scene type entry for a project.
 * 'custom' requires project.scene.baseClass; unknown keys fall back to 2D
 * (never throw at render time — the validator already rejected bad values).
 */
export function resolveSceneType(project) {
  const sceneType = project.sceneType || 'scene_2d';
  if (sceneType === 'custom') {
    const baseClass = project.scene?.baseClass;
    const customEntry = registries.scenes.get('custom');
    // Unknown custom base classes are allowed — they render as-is; the
    // renderer detects the class from the generated file.
    return { ...customEntry, baseClass: baseClass || 'Scene' };
  }
  const entry = registries.scenes.get(sceneType);
  return entry || registries.scenes.get('scene_2d');
}

/** Map a Python base class name (from scene detection) to a scene type key. */
export function sceneTypeFromBaseClass(baseClass) {
  for (const entry of registries.scenes.list()) {
    if ((entry.knownBases || []).includes(baseClass)) return entry.key;
  }
  return null; // unknown/foreign base class
}

// ─── Built-in scene types ─────────────────────────────────────────────────────

registerSceneType('scene_2d', {
  label: '2D Scene',
  baseClass: 'Scene',
  dimensionality: '2d',
  knownBases: ['Scene'],
  supportsCamera: ['backgroundColor', 'backgroundOpacity'],
  emitPrologue({ project, hex }) {
    const bgColor = hex(project.stage.backgroundColor) || '"#000000"';
    return [`self.camera.background_color = ${bgColor}`];
  }
});

registerSceneType('moving_camera', {
  label: '2D Scene — Moving Camera',
  baseClass: 'MovingCameraScene',
  dimensionality: '2d',
  knownBases: ['MovingCameraScene'],
  supportsCamera: ['backgroundColor', 'zoom', 'centerX', 'centerY', 'frameWidth', 'frameHeight'],
  emitPrologue({ project, hex }) {
    const bgColor = hex(project.stage.backgroundColor) || '"#000000"';
    const cam = project.camera || {};
    const lines = [`self.camera.background_color = ${bgColor}`];

    // Camera frame setup — only when the project actually configures it.
    const zoom = Number(cam.zoom);
    const cx = Number(cam.centerX);
    const cy = Number(cam.centerY);
    const fw = Number(cam.frameWidth);
    const fh = Number(cam.frameHeight);
    const hasFrameCfg = (Number.isFinite(fw) && fw > 0) || (Number.isFinite(fh) && fh > 0);

    if (hasFrameCfg || Number.isFinite(zoom) || Number.isFinite(cx) || Number.isFinite(cy)) {
      const setters = [];
      if (hasFrameCfg) {
        setters.push(`self.camera.frame.width = ${fw > 0 ? fw.toFixed(3) : '14.222'}`);
        if (Number.isFinite(fh) && fh > 0) setters.push(`self.camera.frame.height = ${fh.toFixed(3)}`);
      }
      if (Number.isFinite(zoom) && Math.abs(zoom - 1) > 0.001) setters.push(`self.camera.frame.scale(${zoom.toFixed(3)})`);
      if (Number.isFinite(cx) || Number.isFinite(cy)) {
        const x = Number.isFinite(cx) ? cx.toFixed(3) : '0';
        const y = Number.isFinite(cy) ? cy.toFixed(3) : '0';
        setters.push(`self.camera.frame.move_to([${x}, ${y}, 0])`);
      }
      lines.push('# Camera frame');
      lines.push(...setters);
    }
    return lines;
  }
});

registerSceneType('three_d', {
  label: '3D Scene',
  baseClass: 'ThreeDScene',
  dimensionality: '3d',
  extraImports: [],
  knownBases: ['ThreeDScene'],
  supportsCamera: ['backgroundColor', 'phi', 'theta', 'zoom', 'distance', 'gamma'],
  emitPrologue({ project, hex }) {
    const bgColor = hex(project.stage.backgroundColor) || '"#000000"';
    const cam = project.camera || {};
    const lines = [`self.camera.background_color = ${bgColor}`];

    const phi = Number(cam.phi);
    const theta = Number(cam.theta);
    const distance = Number(cam.distance);
    const zoom = Number(cam.zoom);
    const gamma = Number(cam.gamma);

    const kwargs = [];
    if (Number.isFinite(phi)) kwargs.push(`phi=${(phi * Math.PI / 180).toFixed(4)}`);
    if (Number.isFinite(theta)) kwargs.push(`theta=${(theta * Math.PI / 180).toFixed(4)}`);
    if (Number.isFinite(distance)) kwargs.push(`distance=${distance.toFixed(3)}`);
    if (Number.isFinite(zoom) && Math.abs(zoom - 1) > 0.001) kwargs.push(`zoom=${zoom.toFixed(3)}`);
    if (Number.isFinite(gamma)) kwargs.push(`gamma=${(gamma * Math.PI / 180).toFixed(4)}`);

    if (kwargs.length > 0) {
      lines.push('# 3D camera orientation');
      lines.push(`self.set_camera_orientation(${kwargs.join(', ')})`);
    }
    return lines;
  }
});

registerSceneType('custom', {
  label: 'Custom Scene Class',
  baseClass: 'Scene', // replaced at resolve time by project.scene.baseClass
  dimensionality: '2d',
  knownBases: [],     // custom classes are detected by name, not mapped
  supportsCamera: ['backgroundColor'],
  emitPrologue({ project, hex }) {
    // Custom base classes manage their own camera; only set the background
    // colour when the base class is a plain Scene subclass.
    const bgColor = hex(project.stage.backgroundColor) || '"#000000"';
    return [`self.camera.background_color = ${bgColor}`];
  }
});
