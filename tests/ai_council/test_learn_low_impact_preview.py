"""Tests for ``scripts.ai_council.learn_low_impact_preview`` (step-9 P7)."""

from __future__ import annotations

from pathlib import Path

import pytest

from scripts.ai_council.learn_low_impact_preview import (
    LearnLowImpactPreview,
    build_preview,
)


CORPUS_HEADER = (
    "# Low-Impact Decisions Corpus\n\n"
    "last-upstreamed: abc1234\n\n"
    "## On Probation\n\n"
    "<!-- intake-anchor: probation -->\n\n"
    "## Validated\n\n"
    "<!-- intake-anchor: validated -->\n\n"
)


def _write_corpus(tmp_path: Path, validated: list[str],
                  *, header: str = CORPUS_HEADER) -> Path:
    body = header + "\n".join(f'- "{p}"' for p in validated) + "\n"
    body += "\n## Anti-Examples (Always Ask User)\n\n"
    p = tmp_path / "low-impact-decisions.md"
    p.write_text(body, encoding="utf-8")
    return p


def _write_seed(tmp_path: Path, validated: list[str]) -> Path:
    body = (
        "# Seed\n\n"
        "## On Probation\n\n<!-- intake-anchor: probation -->\n\n"
        "## Validated\n\n<!-- intake-anchor: validated -->\n\n"
        + "\n".join(f'- "{p}"' for p in validated) + "\n"
        "\n## Anti-Examples (Always Ask User)\n\n"
    )
    p = tmp_path / "seed.md"
    p.write_text(body, encoding="utf-8")
    return p


def test_build_preview_promotes_new_clean_entries(tmp_path: Path) -> None:
    corpus = _write_corpus(tmp_path, [
        "rename a private helper",
        "tighten a docstring",
    ])
    seed = _write_seed(tmp_path, ["rename a private helper"])
    plan = build_preview(corpus, seed, repo_slug="acme/widget")
    assert isinstance(plan, LearnLowImpactPreview)
    assert len(plan.promoted) == 1
    assert plan.promoted[0].phrase == "tighten a docstring"
    assert plan.already_seeded == ("rename a private helper",)
    assert plan.refused == ()
    assert plan.would_open_pr is True
    assert plan.last_upstreamed_sha == "abc1234"


def test_build_preview_refuses_entries_with_email(tmp_path: Path) -> None:
    corpus = _write_corpus(tmp_path, [
        "ping alice@corp.example about the rename",
        "tighten a docstring",
    ])
    seed = _write_seed(tmp_path, [])
    plan = build_preview(corpus, seed)
    assert len(plan.promoted) == 1
    assert len(plan.refused) == 1
    refused = plan.refused[0]
    assert "alice@corp.example" in refused.phrase
    assert any(v.category == "email" for v in refused.violations)
    # Refusal blocks the PR even when other entries are clean.
    assert plan.would_open_pr is False


def test_build_preview_empty_when_seed_matches_corpus(tmp_path: Path) -> None:
    corpus = _write_corpus(tmp_path, ["tighten a docstring"])
    seed = _write_seed(tmp_path, ["tighten a docstring"])
    plan = build_preview(corpus, seed)
    assert plan.promoted == ()
    assert plan.refused == ()
    assert plan.already_seeded == ("tighten a docstring",)
    assert plan.has_work is False
    assert plan.would_open_pr is False


def test_build_preview_missing_seed_seeds_everything(tmp_path: Path) -> None:
    corpus = _write_corpus(tmp_path, ["tighten a docstring"])
    seed = tmp_path / "does-not-exist.md"
    plan = build_preview(corpus, seed)
    assert len(plan.promoted) == 1
    assert plan.would_open_pr is True


def test_build_preview_missing_corpus_returns_empty(tmp_path: Path) -> None:
    corpus = tmp_path / "no-corpus.md"
    seed = _write_seed(tmp_path, [])
    plan = build_preview(corpus, seed)
    assert plan.promoted == ()
    assert plan.refused == ()
    assert plan.last_upstreamed_sha == "0" * 40


def test_render_preview_lists_promoted_and_refused(tmp_path: Path) -> None:
    corpus = _write_corpus(tmp_path, [
        "tighten a docstring",
        "ping alice@corp.example about the rename",
    ])
    seed = _write_seed(tmp_path, [])
    out = build_preview(corpus, seed, repo_slug="acme/widget").render()
    assert "## learn-low-impact preview" in out
    assert "repo=acme/widget" in out
    assert "### Promoted (1)" in out
    assert "### Refused (1)" in out
    assert "alice@corp.example" in out
    assert "Refusals block the PR" in out


def test_render_preview_apply_hint_when_clean(tmp_path: Path) -> None:
    corpus = _write_corpus(tmp_path, ["tighten a docstring"])
    seed = _write_seed(tmp_path, [])
    out = build_preview(corpus, seed).render()
    assert "Re-run with `--apply`" in out
    assert "upstream-contribute" in out


def test_render_diff_emits_plus_lines(tmp_path: Path) -> None:
    corpus = _write_corpus(tmp_path, ["tighten a docstring"])
    seed = _write_seed(tmp_path, [])
    diff = build_preview(corpus, seed).render_diff()
    assert diff.startswith("--- ")
    assert '+- "tighten a docstring"' in diff


def test_render_pr_body_includes_provenance(tmp_path: Path) -> None:
    corpus = _write_corpus(tmp_path, ["tighten a docstring"])
    seed = _write_seed(tmp_path, [])
    body = build_preview(
        corpus, seed, repo_slug="acme/widget",
    ).render_pr_body()
    assert "feat(low-impact-seed): add 1 validated entries from acme/widget" in body
    assert '- "tighten a docstring"' in body
    assert "Provenance baseline: `abc1234`" in body
    assert "low-impact-corpus-privacy-floor" in body
