/**
 * Suprepto object library (issue #34) — searchable, categorized,
 * registry-driven. Data lives in libraryData.js; this module exposes the
 * query helpers and object factory used by LibraryPanel.
 */

import { uid } from './document.js'
import { CATEGORY_META, PRESETS, CORE_LIBRARY } from './libraryData.js'

export function libraryTypes (schemaTypes) {
  if (Array.isArray(schemaTypes) && schemaTypes.length) {
    return schemaTypes.map((t) => ({
      key: t.key, label: t.label, category: t.category,
      dimensionality: t.dimensionality, description: t.description,
      properties: t.properties,
      preset: PRESETS[t.key] || null
    }))
  }
  return CORE_LIBRARY.map(([key, label, category, dim, desc, props]) => ({
    key, label, category, dimensionality: dim, description: desc,
    properties: _propsFor(key, props),
    preset: PRESETS[key] || null
  }))
}

function _propsFor (key, defaults) {
  const entry = CORE_LIBRARY.find((e) => e[0] === key)
  return defaults || (entry ? entry[5] : {})
}

export function categories (types) {
  const seen = []
  for (const t of types) {
    if (!seen.includes(t.category)) seen.push(t.category)
  }
  return seen.map((c) => ({ key: c,
    ...(CATEGORY_META[c] || { label: c, icon: '·' }) }))
}

/** Issue #34 §7: search matches type, label, category and description. */
export function searchTypes (types, query) {
  const q = (query || '').trim().toLowerCase()
  if (!q) return types
  return types.filter((t) =>
    t.key.toLowerCase().includes(q) ||
    t.label.toLowerCase().includes(q) ||
    t.category.toLowerCase().includes(q) ||
    (t.description || '').toLowerCase().includes(q))
}

/** Context-aware suggestions (#34 §8) from declared capabilities. */
const CONTEXT_SUGGESTIONS = {
  'graph.network': ['text.label', 'presentation.callout', 'math.formula',
    'presentation.metric_card'],
  'math.formula': ['math.axes', 'math.curve', 'math.point',
    'presentation.metric_card'],
  'math.axes': ['math.curve', 'math.point', 'math.region',
    'math.distribution'],
  'nn.network': ['math.matrix', 'math.tensor', 'attention.matrix',
    'presentation.metric_card'],
  'biology.protein': ['biology.sequence', 'presentation.callout',
    'presentation.metric_card'],
  'math.matrix': ['math.tensor', 'presentation.table', 'math.formula']
}

export function suggestedTypes (types, selectedType) {
  const keys = CONTEXT_SUGGESTIONS[selectedType] || []
  return keys.map((k) => types.find((t) => t.key === k)).filter(Boolean)
}

export function makeObject (typeEntry, id = null) {
  const preset = typeEntry.preset || {}
  const properties = { ...(preset.properties || {}) }
  return {
    id: id || uid('obj'),
    type: typeEntry.key,
    properties,
    parentId: null,
    space: typeEntry.dimensionality === '3d' ? 'world3d' : 'scene2d',
    label: null,
    transform: { position: [0, 0, 0], rotation: 0, scale: 1 },
    __expression: preset.expression || null
  }
}
