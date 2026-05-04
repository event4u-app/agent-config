"""Phase 1 (TDD red-pass) tests for ``scripts/sync_yaml_rt``.

Every test here is expected to FAIL until the matching phase of
``agents/roadmaps/road-to-additive-settings-sync.md`` lands. The
tests are grouped by phase and named so a single ``-k`` selector can
target a phase later.

Tests in this module fall into the following groups:

* ``test_round_trip_*``      — Phase 2 (parse/emit user-line preservation)
* ``test_preservation_*``    — Phase 5 (sync preserves every user line)
* ``test_additive_merge_*``  — Phase 3 (merge inserts missing keys)
* ``test_healer_*``          — Phase 4 (_user._user.foo collapse)
* ``test_idempotent_*``      — Phase 5 (second sync = no-op)
* ``test_parser_edge_*``     — Phase 2 edge cases
"""
from __future__ import annotations

from pathlib import Path

import pytest

from scripts import sync_yaml_rt
from scripts.sync_yaml_rt import Node, emit, heal_user_block, merge, parse, sync


FIXTURE_DIR = Path(__file__).parent / "fixtures" / "sync_yaml_rt"


def _read(name: str) -> str:
    return (FIXTURE_DIR / name).read_text(encoding="utf-8")


# --- Phase 2: round-trip property (user-line preservation) -----------

@pytest.mark.parametrize(
    "fixture",
    [
        "with-custom-comments.yml",
        "with-legacy-_user.yml",
        "non-ascii.yml",
        "mixed-indent.yml",
        "inline-and-block-lists.yml",
        "current-real.yml",
    ],
)
def test_round_trip_user_lines_preserved(fixture: str) -> None:
    """Every user source line attached to a node survives parse→emit."""
    text = _read(fixture)
    tree = parse(text)
    rendered = emit(tree)
    # User-line preservation: every non-empty line of the original
    # appears verbatim in the output, in the same order. (Trailing
    # whitespace normalisation, if the parser does any, must be
    # documented; for the v1 contract we assert exact equality.)
    assert rendered == text, (
        f"emit(parse({fixture})) is not byte-equal to source"
    )


def test_round_trip_empty_file() -> None:
    """parse('') returns a root-only tree; emit roundtrips to ''."""
    tree = parse("")
    assert tree.children == []
    assert emit(tree) == ""


# --- Phase 5: preservation under full sync ---------------------------

def test_preservation_custom_comments_unchanged() -> None:
    """sync against a hand-edited file leaves every user line intact."""
    user_text = _read("with-custom-comments.yml")
    template_text = _read("template-basic.yml")
    out = sync(user_text, template_text)
    for line in user_text.splitlines():
        assert line in out.splitlines(), f"User line lost: {line!r}"


def test_preservation_custom_comments_relative_order() -> None:
    """User lines retain their relative order after sync.

    Walks a cursor through ``out_lines`` so duplicate lines (blanks,
    repeated comment markers) are matched in source order rather than
    collapsing to the first occurrence.
    """
    user_text = _read("with-custom-comments.yml")
    template_text = _read("template-basic.yml")
    out = sync(user_text, template_text)
    user_lines = user_text.splitlines()
    out_lines = out.splitlines()
    cursor = 0
    for ln in user_lines:
        try:
            idx = out_lines.index(ln, cursor)
        except ValueError:
            raise AssertionError(
                f"User line lost or reordered after sync: {ln!r} "
                f"(searched from out_lines[{cursor}:])"
            ) from None
        cursor = idx + 1


# --- Phase 3: additive merge -----------------------------------------

def test_additive_merge_missing_leaf_inserted_in_parent() -> None:
    """Missing leaf is inserted under the right parent, siblings untouched."""
    user_text = (
        "personal:\n"
        "  ide: phpstorm\n"
        "  user_name: Matze\n"
    )
    template_text = (
        "personal:\n"
        "  ide: ''\n"
        "  open_edited_files: false\n"
        "  user_name: ''\n"
    )
    out = sync(user_text, template_text)
    assert "open_edited_files: false" in out
    assert out.index("ide: phpstorm") < out.index("user_name: Matze")
    # New key inserted between siblings (after ide, before user_name)
    ide_pos = out.index("ide: phpstorm")
    new_pos = out.index("open_edited_files: false")
    user_pos = out.index("user_name: Matze")
    assert ide_pos < new_pos < user_pos


def test_additive_merge_missing_top_section_appended_at_eof() -> None:
    """Missing top-level section is appended at root EOF with one blank."""
    user_text = "personal:\n  ide: phpstorm\n"
    template_text = (
        "personal:\n"
        "  ide: ''\n"
        "\n"
        "onboarding:\n"
        "  onboarded: false\n"
    )
    out = sync(user_text, template_text)
    assert out.startswith("personal:\n  ide: phpstorm\n")
    assert "onboarding:" in out
    assert "onboarded: false" in out
    # Exactly one blank line separator between user content and new section
    assert "\n\nonboarding:" in out
    assert "\n\n\nonboarding:" not in out


def test_additive_merge_user_reordered_keys_keeps_order() -> None:
    """User has a, c, b — template adds d. d goes after b at user-section EOF."""
    user_text = "section:\n  a: 1\n  c: 3\n  b: 2\n"
    template_text = "section:\n  a: 0\n  b: 0\n  c: 0\n  d: 0\n"
    out = sync(user_text, template_text)
    a_pos = out.index("a: 1")
    c_pos = out.index("c: 3")
    b_pos = out.index("b: 2")
    d_pos = out.index("d: 0")
    assert a_pos < c_pos < b_pos < d_pos


def test_additive_merge_inserts_between_existing_siblings() -> None:
    """Template inserts new key between b and c when user has a, c, b."""
    user_text = "section:\n  a: 1\n  c: 3\n  b: 2\n"
    template_text = "section:\n  a: 0\n  b: 0\n  b2: x\n  c: 0\n"
    out = sync(user_text, template_text)
    # b2 is inserted after the user's existing b sibling
    b_pos = out.index("b: 2")
    b2_pos = out.index("b2: x")
    assert b_pos < b2_pos


def test_additive_merge_three_level_nested_leaf() -> None:
    """Three-level nested missing leaf is inserted as a sibling of its peer."""
    user_text = "a:\n  x:\n    p: 1\n"
    template_text = "a:\n  x:\n    p: 0\n    q: 9\n"
    out = sync(user_text, template_text)
    assert "p: 1" in out
    assert "q: 9" in out
    assert out.index("p: 1") < out.index("q: 9")


def test_scalar_value_not_overwritten_by_section_template() -> None:
    """Scalar→section drift: user's explicit scalar is preserved verbatim.

    Regression — previously the merger would recurse into the template's
    section-shaped child even when the user value was a scalar leaf,
    inserting children under a scalar header and producing invalid YAML
    such as ``personal: null\\n  ide: …``.
    """
    user_text = "personal: null\ncost_profile: minimal\n"
    template_text = (
        "cost_profile: minimal\n"
        "personal:\n"
        "  ide: ''\n"
        "  user_name: ''\n"
    )
    out = sync(user_text, template_text)
    # User's scalar is kept verbatim; no children injected under it.
    assert "personal: null\n" in out
    assert "personal: null\n  ide" not in out
    assert "personal: null\n  user_name" not in out
    # Sibling top-level keys still merge normally (sanity).
    assert "cost_profile: minimal" in out


def test_scalar_value_with_quoted_string_not_overwritten() -> None:
    """Same drift case with a quoted scalar value — same outcome."""
    user_text = 'personal: ""\n'
    template_text = "personal:\n  ide: ''\n"
    out = sync(user_text, template_text)
    assert 'personal: ""\n' in out
    assert 'personal: ""\n  ide' not in out


def test_empty_section_user_still_populated_by_template() -> None:
    """Empty section (raw_value None, no children) → template children inserted.

    This is the *correct* recursion case — only a non-null scalar value
    blocks template-children injection, not an empty mapping.
    """
    user_text = "personal:\n"
    template_text = "personal:\n  ide: ''\n  user_name: ''\n"
    out = sync(user_text, template_text)
    assert "ide: ''" in out
    assert "user_name: ''" in out


def test_crlf_user_lf_template_yields_uniform_user_eol() -> None:
    """User CRLF + LF template → cloned template subtrees rewritten to CRLF.

    Regression — without normalisation, inserted template lines kept
    their LF endings, producing a mixed-EOL output file that breaks
    Windows tooling.
    """
    user_text = "personal:\r\n  ide: phpstorm\r\n"
    template_text = "personal:\n  ide: ''\n  user_name: ''\n"
    out = sync(user_text, template_text)
    # User content unchanged
    assert "  ide: phpstorm\r\n" in out
    # Inserted template line uses user's CRLF, not template's LF
    assert "  user_name: ''\r\n" in out
    # No bare-LF lines slip in (every newline must be preceded by \r)
    bare_lf_count = sum(
        1 for i, ch in enumerate(out)
        if ch == "\n" and (i == 0 or out[i - 1] != "\r")
    )
    assert bare_lf_count == 0, f"mixed EOL: {bare_lf_count} bare LF in output"


def test_synthetic_header_no_value_with_comment_no_double_space() -> None:
    """Healer rendering: ``key:`` (no value) with inline comment uses 2 spaces.

    Regression — the f-string ``{key}: {value}{tail}`` produced
    ``key:   # c`` (three spaces) when value was empty. YAML accepts
    it but it defeats byte-idempotency vs. the user's original spacing.
    """
    # Construct a healer scenario where a leaf has no value but an
    # inline comment, then an orphan path forces synthesis.
    user_text = "_user:\n  custom_orphan:  # only a comment\n"
    template_text = ""
    out = sync(user_text, template_text)
    # Two spaces before the comment, not three
    assert "custom_orphan:  # only a comment" in out
    assert "custom_orphan:   # only a comment" not in out


# --- Phase 4: _user healer -------------------------------------------

def test_healer_strips_multi_prefix() -> None:
    """``_user._user._user.cost_profile`` collapses to a known top-level key."""
    user_text = _read("with-legacy-_user.yml")
    template_text = _read("template-basic.yml")
    out = sync(user_text, template_text)
    # The corruption is gone — no nested _user._user
    assert "_user._user" not in out
    assert "_user:\n  _user:" not in out


def test_healer_rehomes_known_keys() -> None:
    """Legacy keys with a template home migrate up; orphans stay single-level."""
    user_text = (
        "_user:\n"
        "  _user:\n"
        "    cost_profile: balanced\n"
        "  custom_orphan_key: keep\n"
    )
    template_text = "cost_profile: minimal\n"
    out = sync(user_text, template_text)
    # cost_profile re-homed to top level, value preserved
    assert "cost_profile: balanced" in out
    # Orphan stays at single-level under _user
    assert "custom_orphan_key: keep" in out
    # No multi-prefix remains
    assert "_user._user" not in out
    assert "_user:\n  _user:" not in out


def test_healer_is_idempotent_unit() -> None:
    """``heal_user_block`` produces the same tree when run on its own output.

    Pin the unit-level idempotency contract — the full ``sync()`` path
    is already covered, but a regression in ``heal_user_block`` alone
    would slip past those tests if the second pass is masked by merge.
    """
    user_text = _read("with-legacy-_user.yml")
    template_text = _read("template-basic.yml")
    user_tree = parse(user_text)
    template_tree = parse(template_text)
    heal_user_block(user_tree, template_tree)
    once = emit(user_tree)
    heal_user_block(user_tree, template_tree)
    twice = emit(user_tree)
    assert once == twice


# --- Phase 5: idempotency --------------------------------------------

@pytest.mark.parametrize(
    "fixture",
    [
        "with-custom-comments.yml",
        "with-legacy-_user.yml",
        "current-real.yml",
    ],
)
def test_idempotent_second_sync_is_noop(fixture: str) -> None:
    """A second sync against the output of the first produces zero diff."""
    user_text = _read(fixture)
    template_text = _read("template-basic.yml")
    once = sync(user_text, template_text)
    twice = sync(once, template_text)
    assert once == twice


# --- Phase 2: parser edge cases --------------------------------------

class TestParserEdgeCases:
    """Edge cases the parser must handle without losing user lines."""

    def test_duplicate_keys_last_wins(self) -> None:
        """Duplicate keys: the parser keeps last-wins YAML semantics."""
        text = "a: 1\na: 2\n"
        tree = parse(text)
        # Either the tree exposes only one 'a' (last value), or the
        # parser raises; the contract is "no silent corruption".
        # We assert the documented behaviour: last-wins.
        keys = [c.key for c in tree.children if c.key is not None]
        assert keys.count("a") == 1
        a_node = next(c for c in tree.children if c.key == "a")
        assert a_node.raw_value == "2"

    def test_comment_between_key_and_value(self) -> None:
        """``key:  # comment`` followed by indented value parses cleanly."""
        text = "section:  # leading comment on parent\n  child: value\n"
        tree = parse(text)
        section = next(c for c in tree.children if c.key == "section")
        assert section.inline_comment is not None
        assert "leading comment on parent" in section.inline_comment
        child = next(c for c in section.children if c.key == "child")
        assert child.raw_value == "value"

    def test_blank_lines_preserved_in_emit(self) -> None:
        """Blank lines between mappings survive parse → emit."""
        text = "a: 1\n\nb: 2\n"
        assert emit(parse(text)) == text

    def test_null_scalars_preserved(self) -> None:
        """``~``, ``null``, and ``None`` are kept verbatim, not normalised."""
        for token in ("~", "null", "None"):
            text = f"a: {token}\n"
            tree = parse(text)
            a = next(c for c in tree.children if c.key == "a")
            assert a.raw_value == token

    def test_quoted_keys_kept_quoted(self) -> None:
        """A quoted key (e.g. ``\"yes\":``) round-trips with its quotes."""
        text = '"yes": x\n'
        assert emit(parse(text)) == text

    def test_crlf_line_endings_preserved(self) -> None:
        """CRLF line endings are reproduced per node, not normalised."""
        text = "a: 1\r\nb: 2\r\n"
        assert emit(parse(text)) == text

    def test_tabs_in_indent_raise(self) -> None:
        """Tabs in indent are an error with a clear message + line number."""
        text = "section:\n\tchild: value\n"
        with pytest.raises(ValueError, match=r"line 2"):
            parse(text)

    def test_inline_list_preserved(self) -> None:
        """``[a, b, c]`` is preserved verbatim through round-trip."""
        text = "items: [a, b, c]\n"
        assert emit(parse(text)) == text


# --- Sanity check: the module under test is the stub at this point ---

def test_module_is_stub_during_phase_1() -> None:
    """Phase 1 sanity: the module exists, the API names are exported."""
    assert hasattr(sync_yaml_rt, "Node")
    assert callable(sync_yaml_rt.parse)
    assert callable(sync_yaml_rt.emit)
    assert callable(sync_yaml_rt.merge)
    assert callable(sync_yaml_rt.heal_user_block)
    assert callable(sync_yaml_rt.sync)
