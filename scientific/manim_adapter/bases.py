"""Manim scene base classes for scientific scenes.

Naming matters: every base ends with ``Scene`` so the repo's scene detection
(the ``*Scene`` convention from issue #1) discovers scenes authored on this
runtime — including exported files — through the standard Code-Only path.
"""

from __future__ import annotations

from manim import MovingCameraScene, Scene, ThreeDScene


class ScientificRenderMixin:
    """Generic construct(): render the document returned by get_scene()."""

    def get_scene(self):
        """Return the ScientificScene (or a SceneDocument) to render."""
        raise NotImplementedError(
            f"{type(self).__name__} must implement get_scene()")

    def construct(self):
        import os
        from ..ir.document import SceneDocument
        from ..runtime.authoring import ScientificScene
        from .render import render_document

        scene = self.get_scene()
        if isinstance(scene, SceneDocument):
            document = scene
        elif isinstance(scene, ScientificScene):
            document = scene.document
        else:
            raise TypeError(
                "get_scene() must return a ScientificScene or SceneDocument, "
                f"got {type(scene).__name__}")
        ctx = render_document(self, document)
        # Issue #28: opt-in diagnostics dump (runner --diagnostics / worker)
        target = os.environ.get("SUPREPTO_DIAGNOSTICS")
        if target and ctx.diagnostics is not None:
            from ..diagnostics import write_json
            try:
                write_json(ctx.diagnostics, target)
            except OSError as exc:  # pragma: no cover - best effort
                ctx.warn(f"could not write diagnostics: {exc}")


class BaseScientificScene(ScientificRenderMixin, Scene):
    """Standard 2D scientific scene."""


class MovingCameraScientificScene(ScientificRenderMixin, MovingCameraScene):
    """2D scientific scene with a movable camera frame."""


class ThreeDScientificScene(ScientificRenderMixin, ThreeDScene):
    """3D scientific scene (phi/theta/distance camera orientation)."""
