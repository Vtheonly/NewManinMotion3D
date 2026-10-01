// GENERATED from the Python registry (scripts/sync_schema_types.py) — do not edit by hand.
// Domain: attention (matrix, frames, links)

export const ATTENTION = [
  { key: 'attention.matrix', label: 'Attention Heatmap', category: 'attention',
    dimensionality: '2d',
    description: 'Query-key score matrix with distance bias (softmax).',
    properties: {
      'distanceBias': { 'default': 0.25, 'type': 'float' },
      'keys': { 'required': true, 'type': 'list' },
      'queries': { 'required': true, 'type': 'list' },
      'temperature': { 'default': 1.0, 'type': 'float' },
      'topK': { 'default': 3, 'type': 'int' }
    } },
  { key: 'attention.frame', label: 'Orientation Frame', category: 'attention',
    dimensionality: '3d',
    description: 'SO(3) triad anchored in world space (target anchors).',
    properties: {
      'euler': { 'default': [0, 0, 0], 'description': 'XYZ Euler degrees', 'type': 'list' },
      'origin': { 'default': [0, 0, 0], 'description': 'world-space anchor position', 'type': 'list' },
      'size': { 'default': 0.5, 'type': 'float' }
    } },
  { key: 'attention.link', label: 'Attention Link', category: 'attention',
    dimensionality: '3d',
    description: 'Live weighted edge between two anchored artifacts.',
    properties: {
      'fromId': { 'description': 'source artifact id', 'required': true, 'type': 'str' },
      'toId': { 'description': 'target artifact id', 'required': true, 'type': 'str' },
      'weight': { 'default': 1.0, 'type': 'float' }
    } }
];
