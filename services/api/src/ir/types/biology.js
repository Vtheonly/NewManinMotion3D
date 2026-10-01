// GENERATED from the Python registry (scripts/sync_schema_types.py) — do not edit by hand.
// Domain: biology (protein, sequence)

export const BIOLOGY = [
  { key: 'biology.protein', label: 'Protein Structure', category: 'biology',
    dimensionality: '2d',
    description: 'Residue-level protein model (cartoon/trace representations).',
    properties: {
      'color': { 'default': 'accent2', 'type': 'str' },
      'representation': { 'default': 'cartoon', 'enum': ['cartoon', 'trace', 'schematic'], 'type': 'str' },
      'residues': { 'default': 24, 'type': 'int' },
      'seed': { 'default': 7, 'description': 'deterministic fold seed', 'type': 'int' },
      'source': { 'description': 'DataRef path for residue data', 'type': 'str' }
    } },
  { key: 'biology.sequence', label: 'Sequence', category: 'biology',
    dimensionality: '2d',
    description: 'Amino-acid sequence strip with position mapping.',
    properties: {
      'blockSize': { 'default': 0.42, 'type': 'float' },
      'highlight': { 'default': [], 'description': 'residue indices to highlight', 'type': 'list' },
      'sequence': { 'required': true, 'type': 'str' }
    } },
  { key: 'nn.network', label: 'Neural Network', category: 'nn',
    dimensionality: '2d',
    description: 'Deterministic MLP scoring network with live activations.',
    properties: {
      'input': { 'default': [], 'description': 'input vector (empty -> zeros)', 'type': 'list' },
      'layers': { 'description': 'neuron counts, e.g. [4, 6, 1]', 'required': true, 'type': 'list' },
      'seed': { 'default': 11, 'type': 'int' },
      'showActivations': { 'default': true, 'type': 'bool' }
    } }
];
