// GENERATED from the Python registry (scripts/sync_schema_types.py) — do not edit by hand.
// Domain: mathematics (formulas, axes, curves, matrices)

export const MATH = [
  { key: 'math.formula', label: 'Formula', category: 'math',
    dimensionality: '2d',
    description: 'Structured LaTeX expression with terms/bindings/highlights.',
    properties: {
      'fontSize': { 'default': 44, 'type': 'float' },
      'source': { 'required': true, 'type': 'str' }
    } },
  { key: 'math.axes', label: 'Axes', category: 'math',
    dimensionality: '2d',
    description: 'Coordinate axes with ranges for curves/plots.',
    properties: {
      'xLabel': { 'type': 'str' },
      'xMax': { 'default': 3.0, 'type': 'float' },
      'xMin': { 'default': -3.0, 'type': 'float' },
      'yLabel': { 'type': 'str' },
      'yMax': { 'default': 2.0, 'type': 'float' },
      'yMin': { 'default': -2.0, 'type': 'float' }
    } },
  { key: 'math.curve', label: 'Curve', category: 'math',
    dimensionality: '2d',
    description: 'Function curve y=f(x) on an axes artifact.',
    properties: {
      'axes': { 'description': 'axes node id', 'required': true, 'type': 'str' },
      'color': { 'default': 'accent', 'type': 'str' },
      'function': { 'description': 'safe-evaluator expression of x', 'required': true, 'type': 'str' }
    } },
  { key: 'math.matrix', label: 'Matrix', category: 'math',
    dimensionality: '2d',
    description: 'Numeric matrix with optional cell heat-coloring.',
    properties: {
      'heat': { 'default': false, 'description': 'color cells by value', 'type': 'bool' },
      'label': { 'type': 'str' },
      'rows': { 'required': true, 'type': 'list' }
    } }
];
