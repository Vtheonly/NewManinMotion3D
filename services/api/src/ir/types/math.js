/**
 * Mathematical types — generated from scientific/registry/builtin_math.py.
 *
 * GENERATED FILE — do not edit by hand.  Regenerate with:
 *   python scripts/sync_schema_types.py
 */
'use strict';
const MATH_AXES = {"category": "math", "description": "Coordinate axes with ranges for curves/plots.", "dimensionality": "2d", "key": "math.axes", "label": "Axes", "properties": {"xLabel": {"type": "str"}, "xMax": {"default": 3.0, "type": "float"}, "xMin": {"default": -3.0, "type": "float"}, "yLabel": {"type": "str"}, "yMax": {"default": 2.0, "type": "float"}, "yMin": {"default": -2.0, "type": "float"}}};
const MATH_CURVE = {"category": "math", "description": "Function curve y=f(x) on an axes artifact.", "dimensionality": "2d", "key": "math.curve", "label": "Curve", "properties": {"axes": {"description": "axes node id", "required": true, "type": "str"}, "color": {"default": "accent", "type": "str"}, "function": {"description": "safe-evaluator expression of x", "required": true, "type": "str"}}};
const MATH_DISTRIBUTION = {"category": "math", "description": "pdf curve of a named distribution on an axes artifact.", "dimensionality": "2d", "key": "math.distribution", "label": "Probability Distribution", "properties": {"a": {"default": 2.0, "description": "beta alpha / uniform low", "type": "float"}, "axes": {"required": true, "type": "str"}, "b": {"default": 2.0, "description": "beta beta / uniform high", "type": "float"}, "color": {"default": "accent2", "type": "str"}, "kind": {"enum": ["normal", "uniform", "laplace", "beta"], "required": true, "type": "str"}, "mu": {"default": 0.0, "type": "float"}, "sigma": {"default": 1.0, "type": "float"}}};
const MATH_FORMULA = {"category": "math", "description": "Structured LaTeX expression with terms/bindings/highlights.", "dimensionality": "2d", "key": "math.formula", "label": "Formula", "properties": {"fontSize": {"default": 44, "type": "float"}, "source": {"required": true, "type": "str"}}};
const MATH_MATRIX = {"category": "math", "description": "Numeric matrix with optional cell heat-coloring.", "dimensionality": "2d", "key": "math.matrix", "label": "Matrix", "properties": {"heat": {"default": false, "description": "color cells by value", "type": "bool"}, "label": {"type": "str"}, "rows": {"required": true, "type": "list"}}};
const MATH_NUMBER_LINE = {"category": "math", "description": "1D axis with ticks and optional highlight interval.", "dimensionality": "2d", "key": "math.number_line", "label": "Number Line", "properties": {"includeTicks": {"default": true, "type": "bool"}, "max": {"default": 5.0, "type": "float"}, "min": {"default": -5.0, "type": "float"}, "step": {"default": 1.0, "type": "float"}, "unit": {"default": 0.9, "description": "scene units per unit of value", "type": "float"}}};
const MATH_POINT = {"category": "math", "description": "Dot placed on an axes artifact at (x, f(x)).", "dimensionality": "2d", "key": "math.point", "label": "Point on Axes", "properties": {"axes": {"description": "axes node id", "required": true, "type": "str"}, "color": {"default": "warn", "type": "str"}, "function": {"description": "optional y = f(x) (safe expression)", "type": "str"}, "text": {"description": "rendered point label", "type": "str"}, "x": {"required": true, "type": "float"}, "y": {"default": 0.0, "type": "float"}}};
const MATH_REGION = {"category": "math", "description": "Shaded region or interval on an axes artifact.", "dimensionality": "2d", "key": "math.region", "label": "Region / Interval", "properties": {"axes": {"required": true, "type": "str"}, "fill": {"default": "accent", "type": "str"}, "function": {"default": "0", "description": "upper bound y = f(x)", "type": "str"}, "opacity": {"default": 0.25, "type": "float"}, "xMax": {"required": true, "type": "float"}, "xMin": {"required": true, "type": "float"}}};
const MATH_TENSOR = {"category": "math", "description": "N-dimensional numeric tensor rendered as nested cells.", "dimensionality": "2d", "key": "math.tensor", "label": "Tensor View", "properties": {"data": {"description": "flat values (row-major) or nested lists", "type": "list"}, "heat": {"default": true, "type": "bool"}, "label": {"type": "str"}, "shape": {"description": "dimensions, e.g. [2, 3, 4]", "required": true, "type": "list"}}};
const MATH_VECTOR = {"category": "math", "description": "Arrow vector with optional live magnitude binding.", "dimensionality": "2d", "key": "math.vector", "label": "Vector", "properties": {"color": {"default": "accent", "type": "str"}, "components": {"description": "[x, y] (or [x, y, z]) components", "required": true, "type": "list"}, "text": {"description": "rendered vector label", "type": "str"}}};
const MATH = [
  MATH_AXES,
  MATH_CURVE,
  MATH_DISTRIBUTION,
  MATH_FORMULA,
  MATH_MATRIX,
  MATH_NUMBER_LINE,
  MATH_POINT,
  MATH_REGION,
  MATH_TENSOR,
  MATH_VECTOR,
];
export { MATH };
export default MATH;
