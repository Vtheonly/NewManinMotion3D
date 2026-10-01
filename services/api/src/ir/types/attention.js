/**
 * Attention types — generated from scientific/registry/builtin_attention.py.
 *
 * GENERATED FILE — do not edit by hand.  Regenerate with:
 *   python scripts/sync_schema_types.py
 */
'use strict';
const ATTENTION_FRAME = {"category": "attention", "description": "SO(3) triad anchored in world space (target anchors).", "dimensionality": "3d", "key": "attention.frame", "label": "Orientation Frame", "properties": {"euler": {"default": [0, 0, 0], "description": "XYZ Euler degrees", "type": "list"}, "origin": {"default": [0, 0, 0], "description": "world-space anchor position", "type": "list"}, "size": {"default": 0.5, "type": "float"}}};
const ATTENTION_LINK = {"category": "attention", "description": "Live weighted edge between two anchored artifacts.", "dimensionality": "3d", "key": "attention.link", "label": "Attention Link", "properties": {"fromId": {"description": "source artifact id", "required": true, "type": "str"}, "toId": {"description": "target artifact id", "required": true, "type": "str"}, "weight": {"default": 1.0, "type": "float"}}};
const ATTENTION_MATRIX = {"category": "attention", "description": "Query-key score matrix with distance bias (softmax).", "dimensionality": "2d", "key": "attention.matrix", "label": "Attention Heatmap", "properties": {"distanceBias": {"default": 0.25, "type": "float"}, "keys": {"required": true, "type": "list"}, "queries": {"required": true, "type": "list"}, "temperature": {"default": 1.0, "type": "float"}, "topK": {"default": 3, "type": "int"}}};
const ATTENTION = [
  ATTENTION_FRAME,
  ATTENTION_LINK,
  ATTENTION_MATRIX,
];
export { ATTENTION };
export default ATTENTION;
