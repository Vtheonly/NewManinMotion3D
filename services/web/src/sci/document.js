/**
 * Suprepto scene document model (JS mirror of scientific/ir/) — issue #29.
 *
 * One canonical in-memory shape used by the scientific editor, save/load
 * and the API (validate/export).  Object identity = semantic ids; the
 * timeline edits the same stages/steps the Python runtime executes.
 */

const SCHEMA = 'sci-ir/1'
export const SCENE_TYPES = ['scene_2d', 'moving_camera', 'three_d', 'custom']
export const STEP_OPS = ['show', 'play', 'highlight', 'annotate', 'wait',
  'camera', 'transform', 'custom', 'set', 'interpolate', 'transition',
  'compare']
export const STATE_KINDS = ['scalar', 'vector', 'matrix', 'tensor',
  'coordinate', 'distance', 'angle', 'probability', 'score', 'percentage',
  'parameter', 'weight', 'bias', 'activation', 'gradient', 'loss',
  'learning_rate', 'counter', 'time', 'derived']
export const COMPARISON_KINDS = ['before_after', 'input_output',
  'prediction_truth', 'model_a_b', 'iteration', 'parameter']
export const HIGHLIGHT_BEHAVIORS = ['outline', 'glow', 'pulse', 'emphasis',
  'dim_others', 'focus', 'arrow', 'label', 'region', 'temporary']

let _counter = 0
export function uid (prefix = 'id') {
  _counter += 1
  return `${prefix}_${Date.now().toString(36)}_${_counter}`
}

export function createDocument (id = 'my_scene', title = 'My Scene') {
  return {
    schema: SCHEMA,
    id,
    title,
    sceneType: 'scene_2d',
    camera: {},
    metadata: {},
    objects: [],        // {id, type, properties, parentId, space, label, transform}
    expressions: [],    // {id, source, terms, bindings, highlights, format}
    values: [],         // {id, source, format}
    relationships: [],  // {id, kind, sources, properties, live}
    state: { symbols: [], derived: [], machines: [] },
    comparisons: [],
    annotations: [],
    bindings: {},
    timeline: []        // {id, title, steps: [{op, target, ...}]}
  }
}

export function toDict (doc) {
  const out = { schema: doc.schema, id: doc.id, title: doc.title,
                sceneType: doc.sceneType }
  if (doc.camera && Object.keys(doc.camera).length) out.camera = doc.camera
  out.objects = doc.objects
  out.expressions = doc.expressions
  out.values = doc.values
  out.relationships = doc.relationships
  const state = {}
  if (doc.state.symbols.length) state.symbols = doc.state.symbols
  if (doc.state.derived.length) state.derived = doc.state.derived
  if (doc.state.machines.length) state.machines = doc.state.machines
  if (Object.keys(state).length) out.state = state
  if (doc.comparisons.length) out.comparisons = doc.comparisons
  if (doc.annotations.length) out.annotations = doc.annotations
  if (Object.keys(doc.bindings).length) out.bindings = doc.bindings
  out.timeline = doc.timeline
  return out
}

export function fromDict (raw) {
  const doc = createDocument(raw.id || 'scene', raw.title || '')
  doc.sceneType = raw.sceneType || 'scene_2d'
  doc.camera = raw.camera || {}
  doc.metadata = raw.metadata || {}
  doc.objects = raw.objects || []
  doc.expressions = raw.expressions || []
  doc.values = raw.values || []
  doc.relationships = raw.relationships || []
  doc.state = {
    symbols: (raw.state && raw.state.symbols) || [],
    derived: (raw.state && raw.state.derived) || [],
    machines: (raw.state && raw.state.machines) || []
  }
  doc.comparisons = raw.comparisons || []
  doc.annotations = raw.annotations || []
  doc.bindings = raw.bindings || {}
  doc.timeline = raw.timeline || []
  return doc
}

export function semanticEqual (a, b) {
  return JSON.stringify(toDict(a)) === JSON.stringify(toDict(b))
}

// ── object helpers ────────────────────────────────────────────────────────

export function objectById (doc, id) {
  return doc.objects.find((o) => o.id === id) || null
}

export function expressionById (doc, id) {
  return doc.expressions.find((e) => e.id === id) || null
}

export function defaultTransform () {
  return { position: [0, 0, 0], rotation: 0, scale: 1 }
}

export function normalizeTransform (transform) {
  const t = transform || {}
  return {
    position: t.position || [0, 0, 0],
    rotation: t.rotation || 0,
    scale: t.scale === undefined ? 1 : t.scale
  }
}

/** One row per object — the #33 identity rule for timeline UIs. */
export function objectRows (doc) {
  return doc.objects.map((obj) => ({
    id: obj.id,
    type: obj.type,
    label: obj.label || obj.id,
    parentId: obj.parentId || null,
    steps: timelineStepsFor(doc, obj.id)
  }))
}

export function timelineStepsFor (doc, objectId) {
  const rows = []
  for (const stage of doc.timeline) {
    for (const step of stage.steps || []) {
      if (step.target === objectId) rows.push({ stageId: stage.id, step })
    }
  }
  return rows
}

/** Children of every node for hierarchical views (identity preserved). */
export function childrenOf (doc, id) {
  return doc.objects.filter((o) => o.parentId === id)
}
