"""Resolver-level tests for :mod:`work_engine.resolvers.diff`.

R3 Phase 1 contract: the diff resolver wraps a unified-diff / git-diff
payload as a schema-valid :class:`Input` envelope with placeholder slots
for the refiner. Heuristic header check rejects free-form prose without
loading the diff into context. Quality judgement (is the diff applicable?
does it land on the right files?) is the audit/analyze step's job.
"""
from __future__ import annotations

import pytest

from work_engine.resolvers.diff import (
    KIND,
    DiffResolverError,
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


_GIT_DIFF = """diff --git a/foo.py b/foo.py
index 1234567..89abcde 100644
--- a/foo.py
+++ b/foo.py
@@ -1,3 +1,3 @@
-print("old")
+print("new")
"""

_UNIFIED_DIFF = """--- a/foo.py
+++ b/foo.py
@@ -1 +1 @@
-x
+y
"""

_HUNK_ONLY = "@@ -1,3 +1,3 @@\n-old\n+new\n"

_INDEX_HEADER = "Index: foo.py\n===================================================================\n"


class TestEnvelopeShape:
    def test_kind_constant_matches_schema_enum(self) -> None:
        assert KIND == "diff"
        assert KIND in KNOWN_INPUT_KINDS

    def test_envelope_carries_raw_and_empty_refinement_slots(self) -> None:
        envelope = build_envelope(_GIT_DIFF)
        assert isinstance(envelope, Input)
        assert envelope.kind == "diff"
        assert envelope.data == {
            "raw": _GIT_DIFF,
            "reconstructed_ac": [],
            "assumptions": [],
        }

    def test_envelope_preserves_diff_text_verbatim(self) -> None:
        envelope = build_envelope(_GIT_DIFF)
        assert envelope.data["raw"] == _GIT_DIFF

    def test_envelope_round_trips_through_state(self) -> None:
        envelope = build_envelope(_GIT_DIFF)
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
        "raw",
        [_GIT_DIFF, _UNIFIED_DIFF, _HUNK_ONLY, _INDEX_HEADER],
        ids=["git", "unified", "hunk-only", "index-header"],
    )
    def test_accepts_known_diff_shapes(self, raw: str) -> None:
        envelope = build_envelope(raw)
        assert envelope.kind == "diff"

    def test_marker_must_be_anchored_at_line_start(self) -> None:
        # "--- " inside prose ("the function `--- foo`") does not pass.
        prose = "the function `--- foo` failed when bar++ was called"
        with pytest.raises(DiffResolverError, match="does not look like"):
            build_envelope(prose)


class TestRejection:
    def test_rejects_non_string(self) -> None:
        with pytest.raises(DiffResolverError, match="must be a string"):
            build_envelope(None)  # type: ignore[arg-type]

    def test_rejects_int(self) -> None:
        with pytest.raises(DiffResolverError, match="must be a string"):
            build_envelope(42)  # type: ignore[arg-type]

    def test_rejects_empty_string(self) -> None:
        with pytest.raises(DiffResolverError, match="empty or whitespace-only"):
            build_envelope("")

    def test_rejects_whitespace_only(self) -> None:
        with pytest.raises(DiffResolverError, match="empty or whitespace-only"):
            build_envelope("   \n\t  ")

    def test_rejects_free_form_prose(self) -> None:
        with pytest.raises(DiffResolverError, match="does not look like"):
            build_envelope("Please rewrite the dashboard so it looks nicer.")

    def test_rejects_code_snippet_without_diff_headers(self) -> None:
        snippet = "def foo():\n    return 42\n"
        with pytest.raises(DiffResolverError, match="does not look like"):
            build_envelope(snippet)
