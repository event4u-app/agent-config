"""Strict-YAML gate for artefact frontmatter.

Regression guard for the Zed "invalid yaml formatter" class: the lenient
subset parser in ``validate_frontmatter._parse_yaml_block`` strips matching
outer quotes without checking the inner content, so malformed frontmatter
sailed through schema validation and only broke in stricter consumers
(Zed, any PyYAML-based reader). ``strict_yaml_error`` closes that gap.

Both code paths are exercised: the PyYAML path (source of truth, same parser
real consumers use) and the stdlib structural fallback (so the gate never
silently no-ops when PyYAML is absent).
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "src" / "scripts"))

import validate_frontmatter as V  # noqa: E402

# Each case: (label, frontmatter-body-text, expect_error)
BROKEN_INNER_QUOTES = '---\nname: x\ndescription: "say "hi" now"\n---\nbody\n'
BROKEN_BARE_COLON = "---\nname: x\ndescription: outside DE:/EN: blocks\n---\nbody\n"
OK_ESCAPED_QUOTES = '---\nname: x\ndescription: "say \\"hi\\" now"\n---\nbody\n'
OK_QUOTED_COLON = '---\nname: x\ndescription: "outside DE:/EN: blocks"\n---\nbody\n'
OK_PLAIN = "---\nname: x\ndescription: a plain description\n---\nbody\n"

CASES = [
    ("broken_inner_quotes", BROKEN_INNER_QUOTES, True),
    ("broken_bare_colon", BROKEN_BARE_COLON, True),
    ("ok_escaped_quotes", OK_ESCAPED_QUOTES, False),
    ("ok_quoted_colon", OK_QUOTED_COLON, False),
    ("ok_plain", OK_PLAIN, False),
]


@pytest.mark.parametrize("label,text,expect_error", CASES, ids=[c[0] for c in CASES])
def test_strict_yaml_error_pyyaml_path(label, text, expect_error):
    if V._yaml is None:
        pytest.skip("PyYAML not importable in this environment")
    err = V.strict_yaml_error(text)
    assert (err is not None) is expect_error, f"{label}: {err!r}"


@pytest.mark.parametrize("label,text,expect_error", CASES, ids=[c[0] for c in CASES])
def test_strict_yaml_error_stdlib_fallback(monkeypatch, label, text, expect_error):
    # Force the no-PyYAML branch so the structural fallback is covered even
    # where PyYAML is installed.
    monkeypatch.setattr(V, "_yaml", None)
    err = V.strict_yaml_error(text)
    assert (err is not None) is expect_error, f"{label}: {err!r}"


def test_missing_frontmatter_is_not_an_error():
    assert V.strict_yaml_error("no frontmatter here\n") is None


def test_live_artefacts_all_parse_strictly():
    """Every shipped artefact frontmatter must pass the strict gate."""
    sys.path.insert(0, str(REPO_ROOT / "src" / "scripts"))
    from _lib.agent_src import artefact_roots  # noqa: E402
    from validate_frontmatter import _iter_artefacts  # noqa: E402

    offenders = []
    for root in artefact_roots():
        for _type, path in _iter_artefacts(root):
            err = V.strict_yaml_error(path.read_text(encoding="utf-8"))
            if err is not None:
                offenders.append(f"{path}: {err}")
    assert not offenders, "Frontmatter fails strict YAML:\n" + "\n".join(offenders)
