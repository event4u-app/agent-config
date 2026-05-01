"""Resolver-level tests for :mod:`work_engine.resolvers.file`.

R3 Phase 1 contract: the file resolver wraps a path reference as a
schema-valid :class:`Input` envelope. The resolver is thin — it does NOT
read, stat, or otherwise touch the filesystem; that is the audit/analyze
step's job. It only rejects payloads that obviously are not paths
(empty strings, NUL bytes, URLs).
"""
from __future__ import annotations

import pytest

from work_engine.resolvers.file import (
    KIND,
    FileResolverError,
    build_envelope,
)
from work_engine.state import (
    DEFAULT_DIRECTIVE_SET,
    DEFAULT_INTENT,
    KNOWN_INPUT_KINDS,
    SCHEMA_VERSION,
    Input,
    WorkState,
    from_dict,
    to_dict,
)


class TestEnvelopeShape:
    def test_kind_constant_matches_schema_enum(self) -> None:
        assert KIND == "file"
        assert KIND in KNOWN_INPUT_KINDS

    def test_envelope_carries_path_and_empty_refinement_slots(self) -> None:
        envelope = build_envelope("resources/views/dashboard.blade.php")
        assert isinstance(envelope, Input)
        assert envelope.kind == "file"
        assert envelope.data == {
            "path": "resources/views/dashboard.blade.php",
            "reconstructed_ac": [],
            "assumptions": [],
        }

    def test_strips_surrounding_whitespace(self) -> None:
        envelope = build_envelope("  src/components/Sidebar.tsx  ")
        assert envelope.data["path"] == "src/components/Sidebar.tsx"

    def test_normalises_windows_separators_on_posix(self) -> None:
        envelope = build_envelope("resources\\views\\dashboard.blade.php")
        # POSIX runs normalise; the audit step's identity comparison
        # against directory listings stays trivial.
        assert envelope.data["path"] == "resources/views/dashboard.blade.php"

    def test_envelope_round_trips_through_state(self) -> None:
        envelope = build_envelope("src/pages/index.tsx")
        state = WorkState(
            input=envelope,
            intent=DEFAULT_INTENT,
            directive_set=DEFAULT_DIRECTIVE_SET,
        )
        rebuilt = from_dict(to_dict(state))
        assert rebuilt.input == envelope
        assert rebuilt.version == SCHEMA_VERSION


class TestAccepts:
    @pytest.mark.parametrize(
        "path",
        [
            "src/components/Card.tsx",
            "resources/views/dashboard.blade.php",
            "./relative/path.vue",
            "/absolute/path/to/page.tsx",
            "a",
            "components.json",
        ],
    )
    def test_accepts_path_shapes(self, path: str) -> None:
        envelope = build_envelope(path)
        assert envelope.kind == "file"


class TestRejection:
    def test_rejects_non_string(self) -> None:
        with pytest.raises(FileResolverError, match="must be a string"):
            build_envelope(None)  # type: ignore[arg-type]

    def test_rejects_int(self) -> None:
        with pytest.raises(FileResolverError, match="must be a string"):
            build_envelope(42)  # type: ignore[arg-type]

    def test_rejects_empty_string(self) -> None:
        with pytest.raises(FileResolverError, match="empty or whitespace-only"):
            build_envelope("")

    def test_rejects_whitespace_only(self) -> None:
        with pytest.raises(FileResolverError, match="empty or whitespace-only"):
            build_envelope("   \n\t  ")

    def test_rejects_nul_byte(self) -> None:
        with pytest.raises(FileResolverError, match="NUL byte"):
            build_envelope("foo\x00bar")

    @pytest.mark.parametrize(
        "url",
        [
            "http://example.com/foo.tsx",
            "HTTPS://example.com/page.vue",
            "ftp://internal/path.blade.php",
            "file:///etc/passwd",
        ],
    )
    def test_rejects_urls(self, url: str) -> None:
        with pytest.raises(FileResolverError, match="looks like a URL"):
            build_envelope(url)
