/**
 * Document validation — JS mirror of scientific/ir/validate.py.
 *
 * Verdict parity with Python is enforced by the shared corpus
 * (services/api/tests/fixtures/ir/corpus.json) on both sides.  Never throws
 * for content problems; returns { valid, errors: [{path, message}] }.
 */

import { typeEntry } from './schemaTypes.js';
import { validateStateSections } from './validateState.js';

const SCENE_TYPES = ['scene_2d', 'moving_camera', 'three_d', 'custom'];
const SPACES = ['scene2d', 'world3d'];
const RELATION_KINDS = ['arrow', 'distance', 'annotation', 'link',
  'comparison', 'group'];
const STEP_OPS = ['show', 'play', 'highlight', 'annotate', 'wait', 'camera',
  'transform', 'custom', 'set', 'interpolate', 'transition', 'compare'];
const STATE_TARGET_OPS = ['set', 'interpolate', 'transition', 'compare'];
const ANIMATIONS = ['write', 'create', 'uncreate', 'fade_in', 'fade_out',
  'grow', 'indicate', 'draw', 'shift_in'];

function typeOk (value, expected) {
  switch (expected) {
    case 'str': return typeof value === 'string';
    case 'float':
      return typeof value === 'number' && Number.isFinite(value);
    case 'int':
      return typeof value === 'number' && Number.isInteger(value);
    case 'bool': return typeof value === 'boolean';
    case 'list': return Array.isArray(value);
    case 'dict': return value !== null && typeof value === 'object' &&
      !Array.isArray(value);
    default: return true;
  }
}

function validateDocument (doc) {
  const errors = [];
  if (!doc || typeof doc !== 'object') {
    return { valid: false, errors: [{ path: '<root>',
      message: 'document must be an object' }] };
  }
  const schema = doc.schema || 'sci-ir/1';
  if (schema !== 'sci-ir/1') {
    return { valid: false, errors: [{ path: 'schema',
      message: `Unsupported scene schema '${schema}' (this runtime ` +
        "supports 'sci-ir/1'). Migrate the document before editing; see " +
        'docs/development/syntax/VERSIONING.md.' }] };
  }
  if (!SCENE_TYPES.includes(doc.sceneType || 'scene_2d')) {
    errors.push({ path: 'sceneType', message: `unknown scene type ` +
      `'${doc.sceneType}' (known: ${SCENE_TYPES.join(', ')})` });
  }

  const objects = doc.objects || [];
  const expressions = doc.expressions || [];
  const values = doc.values || [];
  const relationships = doc.relationships || [];
  const objectIds = new Set();
  const allIds = new Set();

  for (const node of objects) {
    if (objectIds.has(node.id)) {
      errors.push({ path: `objects/${node.id}`,
        message: `duplicate object id '${node.id}'` });
      continue;
    }
    objectIds.add(node.id);
    allIds.add(node.id);
    let entry;
    try {
      entry = typeEntry(node.type);
    } catch (err) {
      errors.push({ path: `objects/${node.id}`, message: err.message });
      continue;
    }
    for (const [name, spec] of Object.entries(entry.properties)) {
      const value = (node.properties || {})[name] ?? spec.default;
      if (value === undefined || value === null) {
        if (spec.required) {
          errors.push({ path: `objects/${node.id}/${name}`,
            message: `missing required property '${name}'` });
        }
        continue;
      }
      if (!typeOk(value, spec.type || 'any')) {
        errors.push({ path: `objects/${node.id}/${name}`,
          message: `property '${name}' expects ${spec.type}, got ` +
            `${Array.isArray(value) ? 'list' : typeof value}` });
      }
      if (spec.enum && !spec.enum.includes(value)) {
        errors.push({ path: `objects/${node.id}/${name}`,
          message: `'${value}' not in enum ${JSON.stringify(spec.enum)}` });
      }
    }
    for (const name of Object.keys(node.properties || {})) {
      if (!(name in entry.properties)) {
        errors.push({ path: `objects/${node.id}/${name}`,
          message: `unknown property '${name}' for type '${node.type}'` });
      }
    }
    if (node.space && !SPACES.includes(node.space)) {
      errors.push({ path: `objects/${node.id}/space`,
        message: `invalid space '${node.space}'` });
    }
    if (node.parentId && !objects.some((o) => o.id === node.parentId)) {
      errors.push({ path: `objects/${node.id}/parentId`,
        message: `unknown parent '${node.parentId}'` });
    }
  }

  // Parent-chain cycles (mirror of ir/node.py node_parents_form_cycle)
  for (const node of objects) {
    const seen = new Set();
    let current = node;
    while (current) {
      if (seen.has(current.id)) {
        errors.push({ path: `objects/${node.id}/parentId`,
          message: 'parent chain contains a cycle' });
        break;
      }
      seen.add(current.id);
      current = current.parentId
        ? objects.find((o) => o.id === current.parentId) : null;
    }
  }

  for (const expr of expressions) {
    for (const [sym, spec] of Object.entries(expr.bindings || {})) {
      if (spec === null || typeof spec !== 'object' || !('kind' in spec)) {
        errors.push({ path: `expressions/${expr.id}/bindings/${sym}`,
          message: 'binding must be a source spec with \'kind\'' });
      }
    }
  }

  // Expression ids may pair with an object id (canonical math.formula
  // pairing); only same-section duplicates are errors.
  const exprIds = new Set();
  for (const expr of expressions) {
    if (exprIds.has(expr.id)) {
      errors.push({ path: `expressions/${expr.id}`,
        message: `duplicate expression id '${expr.id}'` });
    }
    exprIds.add(expr.id);
    allIds.add(expr.id);
  }
  for (const list of [values, relationships]) {
    for (const item of list) {
      if (allIds.has(item.id)) {
        errors.push({ path: item.id, message: `duplicate id '${item.id}'` });
      }
      allIds.add(item.id);
    }
  }

  for (const rel of relationships) {
    if (!RELATION_KINDS.includes(rel.kind)) {
      errors.push({ path: `relationships/${rel.id}`,
        message: `unknown relationship kind '${rel.kind}'` });
    }
    for (const src of rel.sources || []) {
      if (!allIds.has(src)) {
        errors.push({ path: `relationships/${rel.id}/sources`,
          message: `unknown source '${src}'` });
      }
    }
  }

  const timeline = doc.timeline || [];
  timeline.forEach((stage) => {
    (stage.steps || []).forEach((step) => {
      if (!STEP_OPS.includes(step.op)) {
        errors.push({ path: `timeline/${stage.id}`,
          message: `unknown op '${step.op}'` });
        return;
      }
      if (step.op === 'custom' && !(step.code || '').trim()) {
        errors.push({ path: `timeline/${stage.id}`,
          message: 'custom step requires non-empty code' });
      }
      if (step.op === 'play') {
        if (!ANIMATIONS.includes(step.animation)) {
          errors.push({ path: `timeline/${stage.id}`,
            message: `unknown animation '${step.animation}' (known: ` +
              `${ANIMATIONS.join(', ')})` });
        }
        if (!step.target) {
          errors.push({ path: `timeline/${stage.id}`,
            message: 'play step requires a target' });
        }
      }
      if (['show', 'highlight', 'annotate', 'transform'].includes(step.op) &&
          !step.target) {
        errors.push({ path: `timeline/${stage.id}`,
          message: `${step.op} step requires a target` });
      }
      if (['set', 'interpolate'].includes(step.op) && !step.target) {
        errors.push({ path: `timeline/${stage.id}`,
          message: `${step.op} step requires a target symbol` });
      }
      if (step.op === 'transition' && !step.target) {
        errors.push({ path: `timeline/${stage.id}`,
          message: 'transition step requires a machine id' });
      }
      if (step.op === 'compare' && !step.target) {
        errors.push({ path: `timeline/${stage.id}`,
          message: 'compare step requires a comparison id' });
      }
      if (step.target && !allIds.has(step.target) &&
          !STATE_TARGET_OPS.includes(step.op)) {
        errors.push({ path: `timeline/${stage.id}/${step.target}`,
          message: `step targets unknown id '${step.target}'` });
      }
    });
  });

  errors.push(...validateStateSections(doc));

  return { valid: errors.length === 0, errors };
}

export { validateDocument };
export default validateDocument;
