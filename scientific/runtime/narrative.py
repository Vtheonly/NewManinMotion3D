"""Narrative mixin — stages and quick actions on ScientificScene."""

from __future__ import annotations

from contextlib import contextmanager
from typing import TYPE_CHECKING, Optional

from ..ir import validate_document
from .stages import StageBuilder, make_stage

if TYPE_CHECKING:  # pragma: no cover
    from .authoring import ScientificScene


class NarrativeMixin:
    """stage()/custom()/validate()/to_json() for ScientificScene.

    Quick ``highlight``/``annotate`` actions live in StatefulMixin so the
    Suprepto signatures (behaviors, providers) and the legacy calls share
    one implementation.
    """

    _stage_counter: int
    _current_stage: Optional[StageBuilder]
    document: "ScientificScene.document"  # type: ignore[assignment]

    @contextmanager
    def stage(self: "ScientificScene", title: str = "",
              stage_id: Optional[str] = None):
        self._stage_counter += 1
        sid = stage_id or f"stage_{self._stage_counter:02d}"
        stage, builder = make_stage(sid, title)
        self.document.add_stage(stage)
        self._current_stage = builder
        try:
            yield builder
        finally:
            self._current_stage = None

    def _auto_stage(self: "ScientificScene") -> StageBuilder:
        if self._current_stage is not None:
            return self._current_stage
        if self.document.timeline:
            return StageBuilder(self.document.timeline[-1])
        stage, builder = make_stage("stage_01", "")
        self.document.add_stage(stage)
        return builder

    def custom(self: "ScientificScene", code: str) -> None:
        self._auto_stage().custom(code)

    def validate(self: "ScientificScene") -> list[dict]:
        return validate_document(self.document)

    def to_json(self: "ScientificScene", indent: int = 2) -> str:
        from ..ir import to_json
        return to_json(self.document, indent=indent)
