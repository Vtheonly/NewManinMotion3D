"""Domain modules — pure numerical/semantic logic, no manim imports.

Rendering adapters live in scientific.manim_adapter.bindings and consume these
modules.  Keeping numerics manim-free makes them independently testable
(issue #32 §15: scientific correctness tests).
"""

from __future__ import annotations
