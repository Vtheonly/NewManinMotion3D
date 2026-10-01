/**
 * Core types (groups, text, UI, math) — generated from scientific/registry/builtin_core.py.
 *
 * GENERATED FILE — do not edit by hand.  Regenerate with:
 *   python scripts/sync_schema_types.py
 */
'use strict';
const CORE_GROUP = {"category": "core", "description": "Logical/visual grouping container for child artifacts.", "dimensionality": "2d", "key": "core.group", "label": "Group", "properties": {"title": {"description": "optional group caption", "type": "str"}}};
const NN_NETWORK = {"category": "nn", "description": "Deterministic MLP scoring network with live activations.", "dimensionality": "2d", "key": "nn.network", "label": "Neural Network", "properties": {"input": {"default": [], "description": "input vector (empty -> zeros)", "type": "list"}, "layers": {"description": "neuron counts, e.g. [4, 6, 1]", "required": true, "type": "list"}, "seed": {"default": 11, "type": "int"}, "showActivations": {"default": true, "type": "bool"}}};
const TEXT_LABEL = {"category": "core", "description": "Editable text or caption.", "dimensionality": "2d", "key": "text.label", "label": "Text Label", "properties": {"color": {"default": "fg", "description": "palette token or hex", "type": "str"}, "fontSize": {"default": 28, "description": "manim font size", "type": "float"}, "text": {"description": "label content", "required": true, "type": "str"}, "weight": {"default": "normal", "enum": ["normal", "bold"], "type": "str"}}};
const UI_BADGE = {"category": "ui", "description": "Small colored pill with short text (scores, tags).", "dimensionality": "2d", "key": "ui.badge", "label": "Badge", "properties": {"text": {"required": true, "type": "str"}, "tone": {"default": "info", "enum": ["ok", "warn", "fail", "info"], "type": "str"}}};
const UI_GRID = {"category": "ui", "description": "Cell layout grid used by walls/arrays of artifacts.", "dimensionality": "2d", "key": "ui.grid", "label": "Grid", "properties": {"cellHeight": {"default": 1.5, "type": "float"}, "cellWidth": {"default": 1.5, "type": "float"}, "columns": {"min": 1, "required": true, "type": "int"}, "gap": {"default": 0.2, "type": "float"}, "rows": {"min": 1, "required": true, "type": "int"}}};
const UI_PANEL = {"category": "ui", "description": "Rounded background panel/banner with optional title.", "dimensionality": "2d", "key": "ui.panel", "label": "Panel", "properties": {"fill": {"default": "panel", "type": "str"}, "height": {"default": 3.0, "type": "float"}, "radius": {"default": 0.18, "type": "float"}, "stroke": {"default": "border", "type": "str"}, "title": {"type": "str"}, "width": {"default": 6.0, "type": "float"}}};
const UI_STAMP = {"category": "ui", "description": "OK/FAIL validation stamp for candidate artifacts.", "dimensionality": "2d", "key": "ui.stamp", "label": "Validation Stamp", "properties": {"label": {"type": "str"}, "verdict": {"enum": ["ok", "fail"], "required": true, "type": "str"}}};
const CORE = [
  CORE_GROUP,
  NN_NETWORK,
  TEXT_LABEL,
  UI_BADGE,
  UI_GRID,
  UI_PANEL,
  UI_STAMP,
];
export { CORE };
export default CORE;
