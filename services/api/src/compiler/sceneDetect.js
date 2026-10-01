/**
 * Python Scene Detection (JS)
 *
 * Identifies renderable Manim scene classes inside arbitrary Python source
 * WITHOUT executing it. Used by:
 *   - the render-code route (find scene names the user actually wrote);
 *   - the render route fallback (verify the generated class exists);
 *   - the frontend code-mode editor (same logic, mirrored client-side).
 *
 * Detection rules (see docs/development/architecture/ARCHITECTURE.md):
 *   1. Strip comments and string literals (best-effort, no execution).
 *   2. Find `class <Name>(<BaseA, BaseB>)` definitions.
 *   3. A class is a *renderable scene* when at least one direct base:
 *        a. is a known Manim scene base (KNOWN_SCENE_BASES), or
 *        b. matches the `*Scene` naming convention (user-defined subclasses
 *           of custom scene classes, e.g. `class Demo(MyBaseScene)`).
 *   4. Classes that only inherit from non-scene bases (VMobject, Mobject,
 *      object, ...) are never treated as scenes.
 *
 * This module never throws on weird input — it returns an empty list and a
 * `reason` so callers can produce helpful errors.
 */

/** Manim CE scene base classes that are directly renderable. */
export const KNOWN_SCENE_BASES = [
  'Scene',
  'MovingCameraScene',
  'ThreeDScene',
  'VectorScene',
  'ZoomedScene',
  'SampleSpaceScene',
  'LinearTransformationScene'
];

const SCENE_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*Scene$/;

/** Best-effort removal of Python comments and string literals. */
function stripCommentsAndStrings(source) {
  let out = '';
  let i = 0;
  const n = source.length;
  while (i < n) {
    const c = source[i];
    const c2 = source.slice(i, i + 3);

    // Triple-quoted strings (docstrings / multi-line)
    if (c2 === '"""' || c2 === "'''") {
      const quote = c2;
      const end = source.indexOf(quote, i + 3);
      i = end === -1 ? n : end + 3;
      continue;
    }
    // Single / double quoted strings with escape handling
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && source[j] !== c) {
        if (source[j] === '\\') j++; // skip escaped char
        j++;
      }
      i = j + 1;
      continue;
    }
    // Comments
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

const CLASS_RE = /^[ \t]*class\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*:/gm;

/**
 * Detect renderable scene classes in Python source.
 * @param {string} source - Python source code
 * @returns {{
 *   scenes: Array<{ name: string, bases: string[], sceneType: string|null, known: boolean }>,
 *   classes: Array<{ name: string, bases: string[] }>,
 *   reason?: string
 * }}
 *   sceneType maps known bases to project scene-type keys (scene_2d |
 *   moving_camera | three_d | vector | zoomed | ...), null for unknown bases.
 */
export function detectScenes(source) {
  if (!source || typeof source !== 'string' || source.trim().length === 0) {
    return { scenes: [], classes: [], reason: 'empty-source' };
  }

  const cleaned = stripCommentsAndStrings(source);
  const classes = [];

  let match;
  CLASS_RE.lastIndex = 0;
  while ((match = CLASS_RE.exec(cleaned)) !== null) {
    const name = match[1];
    const bases = match[2]
      .split(',')
      .map(b => b.trim())
      .filter(b => b.length > 0 && /^[A-Za-z_][A-Za-z0-9_.]*$/.test(b)); // skip **kwargs / keyword-only bases
    classes.push({ name, bases });
  }

  const scenes = [];
  for (const cls of classes) {
    for (const base of cls.bases) {
      const short = base.split('.').pop(); // handle manim.Scene style paths
      if (KNOWN_SCENE_BASES.includes(short) || SCENE_NAME_RE.test(short)) {
        scenes.push({
          name: cls.name,
          bases: cls.bases,
          sceneType: baseClassToSceneType(short),
          known: KNOWN_SCENE_BASES.includes(short)
        });
        break; // a class is listed once even with multiple scene bases
      }
    }
  }

  return {
    scenes,
    classes,
    reason: scenes.length === 0 ? 'no-scene-classes-found' : undefined
  };
}

/** Map a Python base class name to a project scene-type key. */
export function baseClassToSceneType(baseClass) {
  switch (baseClass) {
    case 'Scene': return 'scene_2d';
    case 'MovingCameraScene': return 'moving_camera';
    case 'ThreeDScene': return 'three_d';
    default: return null; // VectorScene, ZoomedScene, custom *Scene bases
  }
}

/**
 * Pick the scene to render for a job.
 * Priority: explicit requested name (if it exists) > first detected scene.
 * @returns {{ name: string, detected: boolean } | null}
 */
export function pickScene(source, requestedName) {
  const { scenes } = detectScenes(source);
  if (scenes.length === 0) return null;

  if (requestedName) {
    const exact = scenes.find(s => s.name === requestedName);
    if (exact) return { name: exact.name, detected: false };
    // Requested name not found — fall through to first detected scene so the
    // render still succeeds; the worker reports the substitution.
  }
  return { name: scenes[0].name, detected: true };
}
