// GENERATED from the Python registry (scripts/sync_schema_types.py) — do not edit by hand.
// Domain: kinematics (torus, chains, jacobians, obstacles)

export const KINEMATICS = [
  { key: 'kinematics.torus', label: 'Flat Torus Flow', category: 'kinematics',
    dimensionality: '3d',
    description: 'T^2 manifold with flow field and integrated trajectory.',
    properties: {
      'dt': { 'default': 0.045, 'type': 'float' },
      'flowStrength': { 'default': 1.0, 'type': 'float' },
      'majorRadius': { 'default': 2.2, 'type': 'float' },
      'minorRadius': { 'default': 0.8, 'type': 'float' },
      'steps': { 'default': 90, 'type': 'int' }
    } },
  { key: 'kinematics.chain', label: 'PoE Kinematic Chain', category: 'kinematics',
    dimensionality: '3d',
    description: 'Serial revolute chain assembled via product of exponentials.',
    properties: {
      'linkLength': { 'default': 0.9, 'type': 'float' },
      'thetas': { 'required': true, 'type': 'list' }
    } },
  { key: 'kinematics.jacobian', label: 'Jacobian Arrows', category: 'kinematics',
    dimensionality: '3d',
    description: 'Geometric Jacobian column vectors at the end effector.',
    properties: {
      'scale': { 'default': 0.55, 'type': 'float' }
    } },
  { key: 'kinematics.obstacle', label: 'Obstacle', category: 'kinematics',
    dimensionality: '3d',
    description: 'Spherical obstacle for clash/avoidance demonstrations.',
    properties: {
      'center': { 'required': true, 'type': 'list' },
      'radius': { 'default': 0.55, 'type': 'float' }
    } }
];
