// GENERATED from the Python registry (scripts/sync_schema_types.py) — do not edit by hand.
// Domain: core, layout, text and presentation chrome

export const CORE = [
  { key: 'core.group', label: 'Group', category: 'core',
    dimensionality: '2d',
    description: 'Logical/visual grouping container for child artifacts.',
    properties: {
      'title': { 'description': 'optional group caption', 'type': 'str' }
    } },
  { key: 'text.label', label: 'Text Label', category: 'core',
    dimensionality: '2d',
    description: 'Editable text or caption.',
    properties: {
      'color': { 'default': 'fg', 'description': 'palette token or hex', 'type': 'str' },
      'fontSize': { 'default': 28, 'description': 'manim font size', 'type': 'float' },
      'text': { 'description': 'label content', 'required': true, 'type': 'str' },
      'weight': { 'default': 'normal', 'enum': ['normal', 'bold'], 'type': 'str' }
    } },
  { key: 'ui.panel', label: 'Panel', category: 'ui',
    dimensionality: '2d',
    description: 'Rounded background panel/banner with optional title.',
    properties: {
      'fill': { 'default': 'panel', 'type': 'str' },
      'height': { 'default': 3.0, 'type': 'float' },
      'radius': { 'default': 0.18, 'type': 'float' },
      'stroke': { 'default': 'border', 'type': 'str' },
      'title': { 'type': 'str' },
      'width': { 'default': 6.0, 'type': 'float' }
    } },
  { key: 'ui.grid', label: 'Grid', category: 'ui',
    dimensionality: '2d',
    description: 'Cell layout grid used by walls/arrays of artifacts.',
    properties: {
      'cellHeight': { 'default': 1.5, 'type': 'float' },
      'cellWidth': { 'default': 1.5, 'type': 'float' },
      'columns': { 'min': 1, 'required': true, 'type': 'int' },
      'gap': { 'default': 0.2, 'type': 'float' },
      'rows': { 'min': 1, 'required': true, 'type': 'int' }
    } },
  { key: 'ui.stamp', label: 'Validation Stamp', category: 'ui',
    dimensionality: '2d',
    description: 'OK/FAIL validation stamp for candidate artifacts.',
    properties: {
      'label': { 'type': 'str' },
      'verdict': { 'enum': ['ok', 'fail'], 'required': true, 'type': 'str' }
    } },
  { key: 'ui.badge', label: 'Badge', category: 'ui',
    dimensionality: '2d',
    description: 'Small colored pill with short text (scores, tags).',
    properties: {
      'text': { 'required': true, 'type': 'str' },
      'tone': { 'default': 'info', 'enum': ['ok', 'warn', 'fail', 'info'], 'type': 'str' }
    } },
  { key: 'hud.fixed', label: 'Fixed HUD', category: 'presentation',
    dimensionality: '2d',
    description: 'Camera-independent HUD element (fixed in frame).',
    properties: {
      'corner': { 'default': 'UL', 'enum': ['UL', 'UR', 'LL', 'LR'], 'type': 'str' },
      'fontSize': { 'default': 22, 'type': 'float' },
      'text': { 'required': true, 'type': 'str' }
    } }
];
