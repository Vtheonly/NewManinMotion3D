/**
 * Kinematics types — generated from scientific/registry/builtin_kinematics.py.
 *
 * GENERATED FILE — do not edit by hand.  Regenerate with:
 *   python scripts/sync_schema_types.py
 */
'use strict';
const KINEMATICS_CHAIN = {"category": "kinematics", "description": "Serial revolute chain assembled via product of exponentials.", "dimensionality": "3d", "key": "kinematics.chain", "label": "PoE Kinematic Chain", "properties": {"linkLength": {"default": 0.9, "type": "float"}, "thetas": {"required": true, "type": "list"}}};
const KINEMATICS_JACOBIAN = {"category": "kinematics", "description": "Geometric Jacobian column vectors at the end effector.", "dimensionality": "3d", "key": "kinematics.jacobian", "label": "Jacobian Arrows", "properties": {"scale": {"default": 0.55, "type": "float"}}};
const KINEMATICS_OBSTACLE = {"category": "kinematics", "description": "Spherical obstacle for clash/avoidance demonstrations.", "dimensionality": "3d", "key": "kinematics.obstacle", "label": "Obstacle", "properties": {"center": {"required": true, "type": "list"}, "radius": {"default": 0.55, "type": "float"}}};
const KINEMATICS_TORUS = {"category": "kinematics", "description": "T^2 manifold with flow field and integrated trajectory.", "dimensionality": "3d", "key": "kinematics.torus", "label": "Flat Torus Flow", "properties": {"dt": {"default": 0.045, "type": "float"}, "flowStrength": {"default": 1.0, "type": "float"}, "majorRadius": {"default": 2.2, "type": "float"}, "minorRadius": {"default": 0.8, "type": "float"}, "steps": {"default": 90, "type": "int"}}};
const KINEMATICS = [
  KINEMATICS_CHAIN,
  KINEMATICS_JACOBIAN,
  KINEMATICS_OBSTACLE,
  KINEMATICS_TORUS,
];
export { KINEMATICS };
export default KINEMATICS;
