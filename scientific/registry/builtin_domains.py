"""Built-in scientific domain types: biology, NN, kinematics, attention.

Pure-data property schemas; the numerical engines live in scientific/domains
and the renderers in scientific/manim_adapter/bindings.
"""

from __future__ import annotations

from . import register_type

register_type(
    "biology.protein",
    label="Protein Structure", category="biology", dimensionality="2d",
    description="Residue-level protein model (cartoon/trace representations).",
    properties={
        "source": {"type": "str", "description": "DataRef path for residue data"},
        "representation": {"type": "str",
                           "enum": ["cartoon", "trace", "schematic"],
                           "default": "cartoon"},
        "seed": {"type": "int", "default": 7, "description": "deterministic fold seed"},
        "residues": {"type": "int", "default": 24},
        "color": {"type": "str", "default": "accent2"},
    },
)

register_type(
    "biology.sequence",
    label="Sequence", category="biology", dimensionality="2d",
    description="Amino-acid sequence strip with position mapping.",
    properties={
        "sequence": {"type": "str", "required": True},
        "blockSize": {"type": "float", "default": 0.42},
        "highlight": {"type": "list", "default": [],
                      "description": "residue indices to highlight"},
    },
)

register_type(
    "nn.network",
    label="Neural Network", category="nn", dimensionality="2d",
    description="Deterministic MLP scoring network with live activations.",
    properties={
        "layers": {"type": "list", "required": True,
                   "description": "neuron counts, e.g. [4, 6, 1]"},
        "seed": {"type": "int", "default": 11},
        "input": {"type": "list", "default": [],
                  "description": "input vector (empty -> zeros)"},
        "showActivations": {"type": "bool", "default": True},
    },
)

register_type(
    "kinematics.torus",
    label="Flat Torus Flow", category="kinematics", dimensionality="3d",
    description="T^2 manifold with flow field and integrated trajectory.",
    properties={
        "majorRadius": {"type": "float", "default": 2.2},
        "minorRadius": {"type": "float", "default": 0.8},
        "flowStrength": {"type": "float", "default": 1.0},
        "steps": {"type": "int", "default": 90},
        "dt": {"type": "float", "default": 0.045},
    },
)

register_type(
    "kinematics.chain",
    label="PoE Kinematic Chain", category="kinematics", dimensionality="3d",
    description="Serial revolute chain assembled via product of exponentials.",
    properties={
        "thetas": {"type": "list", "required": True},
        "linkLength": {"type": "float", "default": 0.9},
    },
)

register_type(
    "kinematics.jacobian",
    label="Jacobian Arrows", category="kinematics", dimensionality="3d",
    description="Geometric Jacobian column vectors at the end effector.",
    properties={"scale": {"type": "float", "default": 0.55}},
)

register_type(
    "kinematics.obstacle",
    label="Obstacle", category="kinematics", dimensionality="3d",
    description="Spherical obstacle for clash/avoidance demonstrations.",
    properties={
        "center": {"type": "list", "required": True},
        "radius": {"type": "float", "default": 0.55},
    },
)

register_type(
    "attention.matrix",
    label="Attention Heatmap", category="attention", dimensionality="2d",
    description="Query-key score matrix with distance bias (softmax).",
    properties={
        "queries": {"type": "list", "required": True},
        "keys": {"type": "list", "required": True},
        "temperature": {"type": "float", "default": 1.0},
        "distanceBias": {"type": "float", "default": 0.25},
        "topK": {"type": "int", "default": 3},
    },
)

register_type(
    "attention.frame",
    label="Orientation Frame", category="attention", dimensionality="3d",
    description="SO(3) triad anchored in world space (target anchors).",
    properties={
        "euler": {"type": "list", "default": [0, 0, 0],
                  "description": "XYZ Euler degrees"},
        "origin": {"type": "list", "default": [0, 0, 0],
                   "description": "world-space anchor position"},
        "size": {"type": "float", "default": 0.5},
    },
)

register_type(
    "attention.link",
    label="Attention Link", category="attention", dimensionality="3d",
    description="Live weighted edge between two anchored artifacts.",
    properties={
        "fromId": {"type": "str", "required": True,
                   "description": "source artifact id"},
        "toId": {"type": "str", "required": True,
                 "description": "target artifact id"},
        "weight": {"type": "float", "default": 1.0},
    },
)

register_type(
    "hud.fixed",
    label="Fixed HUD", category="presentation", dimensionality="2d",
    description="Camera-independent HUD element (fixed in frame).",
    properties={
        "text": {"type": "str", "required": True},
        "corner": {"type": "str", "enum": ["UL", "UR", "LL", "LR"], "default": "UL"},
        "fontSize": {"type": "float", "default": 22},
    },
)
