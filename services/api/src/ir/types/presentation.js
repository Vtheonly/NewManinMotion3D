/**
 * Presentation & comparison types — generated from scientific/registry/builtin_presentation.py.
 *
 * GENERATED FILE — do not edit by hand.  Regenerate with:
 *   python scripts/sync_schema_types.py
 */
'use strict';
const COMPARISON_PANEL = {"category": "comparison", "description": "Visual comparison driven by a declared comparison spec.", "dimensionality": "2d", "key": "comparison.panel", "label": "Comparison Panel", "properties": {"comparison": {"description": "comparison id from the comparisons section", "required": true, "type": "str"}, "fontSize": {"default": 22, "type": "float"}}};
const HUD_FIXED = {"category": "presentation", "description": "Camera-independent HUD element (fixed in frame).", "dimensionality": "2d", "key": "hud.fixed", "label": "Fixed HUD", "properties": {"corner": {"default": "UL", "enum": ["UL", "UR", "LL", "LR"], "type": "str"}, "fontSize": {"default": 22, "type": "float"}, "text": {"required": true, "type": "str"}}};
const PRESENTATION_CALLOUT = {"category": "presentation", "description": "Labeled pointer that visually connects text to a target.", "dimensionality": "2d", "key": "presentation.callout", "label": "Callout", "properties": {"fontSize": {"default": 24, "type": "float"}, "side": {"default": "RIGHT", "enum": ["LEFT", "RIGHT", "UP", "DOWN"], "type": "str"}, "target": {"description": "target artifact id", "type": "str"}, "text": {"required": true, "type": "str"}}};
const PRESENTATION_LEGEND = {"category": "presentation", "description": "Color/label legend entries.", "dimensionality": "2d", "key": "presentation.legend", "label": "Legend", "properties": {"entries": {"description": "[{label, color}]", "required": true, "type": "list"}, "fontSize": {"default": 22, "type": "float"}}};
const PRESENTATION_METRIC_CARD = {"category": "presentation", "description": "Live metric bound to a state symbol or live value (issue #4 visual consumer).", "dimensionality": "2d", "key": "presentation.metric_card", "label": "Metric Card", "properties": {"accent": {"default": "accent", "type": "str"}, "format": {"default": "{value}", "description": "value template", "type": "str"}, "live": {"default": true, "type": "bool"}, "provider": {"description": "state symbol / live value id", "required": true, "type": "str"}, "title": {"required": true, "type": "str"}}};
const PRESENTATION_TABLE = {"category": "presentation", "description": "Text table; cells support {value} live templates.", "dimensionality": "2d", "key": "presentation.table", "label": "Table", "properties": {"fontSize": {"default": 22, "type": "float"}, "headers": {"default": [], "type": "list"}, "rows": {"required": true, "type": "list"}}};
const PRESENTATION_TITLE = {"category": "presentation", "description": "Scene title with optional subtitle.", "dimensionality": "2d", "key": "presentation.title", "label": "Title", "properties": {"color": {"default": "fg", "type": "str"}, "fontSize": {"default": 40, "type": "float"}, "subtitle": {"type": "str"}, "text": {"required": true, "type": "str"}}};
const PRESENTATION = [
  COMPARISON_PANEL,
  HUD_FIXED,
  PRESENTATION_CALLOUT,
  PRESENTATION_LEGEND,
  PRESENTATION_METRIC_CARD,
  PRESENTATION_TABLE,
  PRESENTATION_TITLE,
];
export { PRESENTATION };
export default PRESENTATION;
