/**
 * Manim Studio Compiler
 *
 * Compiles project JSON to Manim Python code.
 * Pipeline: Validate -> Normalize -> Codegen
 *
 * v5 (Issue #1 — architecture decoupling):
 *   - all capability knowledge lives in the registries (objects/animations/scenes)
 *   - scene detection re-exports for the render routes
 *   - compileProject returns the scene class name so the renderer no longer
 *     assumes a fixed "MainScene"
 */

import { validateProject } from './validator.js';
import { normalizeProject } from './normalizer.js';
import { generatePythonCode, safeClassName } from './codegen.js';
import { resolveSceneType } from './registry/scenes.js';

/**
 * Compile a project JSON to Manim Python code.
 * @param {Object} project - The project JSON
 * @param {string} assetsBasePath - Base path for assets (e.g. /data/assets/proj_1)
 * @returns {{ success: boolean, code?: string, errors?: string[], sceneName?: string, sceneType?: string }}
 */
export function compileProject(project, assetsBasePath) {
  // Step 1: Validate
  const validation = validateProject(project);
  if (!validation.valid) {
    return {
      success: false,
      errors: validation.errors
    };
  }

  // Step 2: Normalize
  const normalized = normalizeProject(project);

  // Step 3: Resolve the scene (registry-driven; may be 2D, moving-camera, 3D, custom)
  const sceneType = resolveSceneType(normalized);
  const sceneName = safeClassName(normalized.scene?.className, 'MainScene');

  // Step 4: Generate Python code
  const code = generatePythonCode(normalized, assetsBasePath);

  return {
    success: true,
    code,
    sceneName,
    sceneType: normalized.sceneType
  };
}

export { validateProject, normalizeProject, generatePythonCode, safeClassName };
export { detectScenes, pickScene, baseClassToSceneType, KNOWN_SCENE_BASES } from './sceneDetect.js';
export { registries, describeCapabilities, createRegistry } from './registry/index.js';
export { resolveSceneType } from './registry/scenes.js';
export { registerObjectType } from './registry/objects.js';
export { registerAnimation } from './registry/animations.js';
export { registerSceneType } from './registry/scenes.js';
