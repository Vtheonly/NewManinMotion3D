/**
 * Biology types — generated from scientific/registry/builtin_biology.py.
 *
 * GENERATED FILE — do not edit by hand.  Regenerate with:
 *   python scripts/sync_schema_types.py
 */
'use strict';
const BIOLOGY_PROTEIN = {"category": "biology", "description": "Residue-level protein model (cartoon/trace representations).", "dimensionality": "2d", "key": "biology.protein", "label": "Protein Structure", "properties": {"color": {"default": "accent2", "type": "str"}, "representation": {"default": "cartoon", "enum": ["cartoon", "trace", "schematic"], "type": "str"}, "residues": {"default": 24, "type": "int"}, "seed": {"default": 7, "description": "deterministic fold seed", "type": "int"}, "source": {"description": "DataRef path for residue data", "type": "str"}}};
const BIOLOGY_SEQUENCE = {"category": "biology", "description": "Amino-acid sequence strip with position mapping.", "dimensionality": "2d", "key": "biology.sequence", "label": "Sequence", "properties": {"blockSize": {"default": 0.42, "type": "float"}, "highlight": {"default": [], "description": "residue indices to highlight", "type": "list"}, "sequence": {"required": true, "type": "str"}}};
const BIOLOGY = [
  BIOLOGY_PROTEIN,
  BIOLOGY_SEQUENCE,
];
export { BIOLOGY };
export default BIOLOGY;
