/**
 * Manim Python Code Exporter + Parser
 *
 * CODEGEN:  delegates to the SHARED registry-driven compiler
 *           (services/api/src/compiler) — one canonical implementation
 *           serves the browser export, the Code tab preview, and the server
 *           render. The client no longer maintains a parallel generator:
 *           the downloaded .py is byte-identical to the scene.py the API
 *           renders for the same project (issue #36 / E2E audit).
 * PARSER:   Manim code -> project JSON (tolerant legacy importer)
 * DETECT:   scene class detection (client mirror of server sceneDetect.js)
 */

// ── The ONE canonical compiler (shared with services/api) ──────────────────
// Both packages are plain ESM with no Node-only imports on this path
// (registry/index.js -> objects/animations/scenes/shared are pure JS), so the
// browser bundler and the Node test runner can import them identically.
import { generatePythonCode } from '../../../api/src/compiler/codegen.js';
import { normalizeProject } from '../../../api/src/compiler/normalizer.js';

import { parseManimScriptTolerant } from './importManim.js';

/**
 * Generate the Manim CE scene for a project (visual/canvas mode).
 * Mirrors the server compile pipeline: normalize -> codegen. The server runs
 * validation first (rejecting broken projects at the API boundary); the
 * client normalizes defensively so the Code tab never crashes mid-edit.
 */
export function generateManimScript(project) {
  return generatePythonCode(normalizeProject(project));
}

// ── Scene detection (Issue #1 — mirrors server sceneDetect.js) ───────────────

const KNOWN_SCENE_BASES = [
  'Scene', 'MovingCameraScene', 'ThreeDScene', 'VectorScene',
  'ZoomedScene', 'SampleSpaceScene', 'LinearTransformationScene'
];

function stripCommentsAndStrings(source) {
  let out = '', i = 0;
  const n = source.length;
  while (i < n) {
    const c = source[i], c3 = source.slice(i, i + 3);
    if (c3 === '"""' || c3 === "'''") {
      const end = source.indexOf(c3, i + 3);
      i = end === -1 ? n : end + 3;
      continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && source[j] !== c) { if (source[j] === '\\') j++; j++; }
      i = j + 1;
      continue;
    }
    if (c === '#') {
      const end = source.indexOf('\n', i);
      i = end === -1 ? n : end;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

/**
 * Detect renderable scene classes in Python source (client-side mirror of
 * the server's sceneDetect.js — never executes the source).
 * @returns {Array<{name, bases, sceneType, known}>}
 */
export function detectScenesClient(source) {
  if (!source || typeof source !== 'string' || source.trim().length === 0) return [];
  const cleaned = stripCommentsAndStrings(source);
  const re = /^[ \t]*class\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*:/gm;
  const scenes = [];
  let m;
  while ((m = re.exec(cleaned)) !== null) {
    const name = m[1];
    const bases = m[2].split(',').map(b => b.trim())
      .filter(b => b.length > 0 && /^[A-Za-z_][A-Za-z0-9_.]*$/.test(b));
    for (const base of bases) {
      const short = base.split('.').pop();
      if (KNOWN_SCENE_BASES.includes(short) || /^[A-Za-z_][A-Za-z0-9_]*Scene$/.test(short)) {
        scenes.push({
          name,
          bases,
          sceneType: short === 'Scene' ? 'scene_2d'
            : short === 'MovingCameraScene' ? 'moving_camera'
            : short === 'ThreeDScene' ? 'three_d' : null,
          known: KNOWN_SCENE_BASES.includes(short)
        });
        break;
      }
    }
  }
  return scenes;
}

// ═════════════════════════════════════════════════════════════════════════════
// PARSER: Manim Python → project JSON (tolerant legacy importer)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Parse Manim Python code back into project objects, tracks, and stage.
 * Delegates to the tolerant importer (importManim.js): arbitrary kwargs,
 * chained calls, multi-line self.play(...), self.add(...), helper-function
 * locals — one constructed mobject becomes one timeline row (issue #33).
 */
export function parseManimScript(code, sw = 1920, sh = 1080) {
  return parseManimScriptTolerant(code, sw, sh);
}

// ═════════════════════════════════════════════════════════════════════════════
// DOWNLOAD helper
// ═════════════════════════════════════════════════════════════════════════════

export function downloadManimScript(project) {
  const script = generateManimScript(project);
  const blob = new Blob([script], { type: 'text/x-python' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'scene.py'; a.click();
  URL.revokeObjectURL(url);
  return script;
}

export default { generateManimScript, parseManimScript, downloadManimScript };
