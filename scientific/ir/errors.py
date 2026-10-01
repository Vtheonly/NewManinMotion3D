"""Canonical scientific scene IR errors.

Every failure mode in the IR layer raises a subclass of IRError so callers
(including the API and the renderer) can distinguish authoring mistakes from
programmer bugs.
"""

from __future__ import annotations


class IRError(Exception):
    """Base class for all scene-IR failures."""


class SchemaError(IRError):
    """The document declares an unknown/unsupported schema version."""

    def __init__(self, found: str, supported: str):
        self.found = found
        self.supported = supported
        super().__init__(
            f"Unsupported scene schema {found!r} "
            f"(this runtime supports {supported!r}). "
            "Migrate the document before editing; see "
            "docs/development/syntax/VERSIONING.md."
        )


class ValidationError(IRError):
    """A document failed validation. `errors` is a list of dicts:

    [{"path": "objects/protein/properties/representation", "message": "..."}]
    """

    def __init__(self, errors):
        self.errors = list(errors or [])
        detail = "; ".join(
            f"{e.get('path', '<root>')}: {e.get('message', e)}" for e in self.errors
        ) or "unknown validation failure"
        super().__init__(f"Invalid scene document ({len(self.errors)} error(s)): {detail}")


class UnknownTypeError(IRError):
    """A node references a type key that is not registered."""

    def __init__(self, type_key: str):
        self.type_key = type_key
        super().__init__(
            f"Unknown object type {type_key!r}. Register it via "
            "scientific.registry.register_type() before use."
        )


class DuplicateRegistrationError(IRError):
    """A type key / id was registered or declared twice."""


class DataError(IRError):
    """A DataRef could not be resolved (missing file, bad format)."""
