"""Tests for scripts/check_proposal.py — the Stage-4 gate."""

from __future__ import annotations

import json
import subprocess
import textwrap
from pathlib import Path

SCRIPT = Path("scripts/check_proposal.py")
TEMPLATE = Path(".agent-src.uncompressed/templates/agents/proposal.example.md")


def _run(path: Path, fmt: str = "text") -> subprocess.CompletedProcess:
    return subprocess.run(
        ["python3", str(SCRIPT), "--format", fmt, str(path)],
        capture_output=True, text=True,
    )


def _valid_proposal() -> str:
    return textwrap.dedent("""\
        ---
        proposal_id: sample-one
        type: rule
        scope: package
        stage: proposed
        author: team-x
        created: 2026-04-01
        last_updated: 2026-04-22
        ---

        # Proposal: sample

        ## 1. Learning

        Pattern description.

        ## 2. Classification

        Scope / Type / etc.

        ## 3. Evidence

        ```yaml
        evidence:
          - kind: pr
            ref: https://github.com/org-a/repo-a/pull/1
            summary: first.
          - kind: review-comment
            ref: https://gitlab.com/org-b/repo-b/pull/42
            summary: second.
        ```

        ## 4. Proposed artefact

        Draft body.

        ## 5. Quality gate expectations

        Checks.

        ## 6. Replacement justification

        N/A.

        ## 7. Success signal

        - Metric: reviewer comments per month
        - Baseline: 3
        - Target: < 1
        - Evaluation date: 2026-07-22

        ## 8. Risks and alternatives rejected

        Risks.

        ## 9. Gate verdict

        Pending.

        ## 10. Upstream PR

        Pending.
    """)


def test_example_template_passes():
    result = _run(TEMPLATE)
    assert result.returncode == 0, result.stdout + result.stderr
    assert "PASS" in result.stdout


def test_valid_proposal_passes(tmp_path):
    p = tmp_path / "p.md"
    p.write_text(_valid_proposal(), encoding="utf-8")
    result = _run(p)
    assert result.returncode == 0, result.stdout


def test_missing_frontmatter_fields_fails(tmp_path):
    p = tmp_path / "p.md"
    p.write_text("---\nproposal_id: x\n---\n\n# body\n", encoding="utf-8")
    result = _run(p)
    assert result.returncode == 1
    assert "missing: type" in result.stdout
    assert "missing: author" in result.stdout


def test_invalid_vocabulary_fails(tmp_path):
    body = _valid_proposal().replace("type: rule", "type: widget")
    body = body.replace("scope: package", "scope: cosmic")
    body = body.replace("stage: proposed", "stage: bogus")
    p = tmp_path / "p.md"
    p.write_text(body, encoding="utf-8")
    result = _run(p)
    assert result.returncode == 1
    assert "invalid type 'widget'" in result.stdout
    assert "invalid scope 'cosmic'" in result.stdout
    assert "invalid stage 'bogus'" in result.stdout


def test_insufficient_evidence_fails(tmp_path):
    body = _valid_proposal().replace(
        "  - kind: review-comment\n"
        "    ref: https://gitlab.com/org-b/repo-b/pull/42\n"
        "    summary: second.\n",
        "",
    )
    p = tmp_path / "p.md"
    p.write_text(body, encoding="utf-8")
    result = _run(p)
    assert result.returncode == 1
    assert "need ≥2 evidence refs" in result.stdout


def test_todo_markers_fail(tmp_path):
    body = _valid_proposal().replace("Draft body.", "Draft body. TODO: finish")
    p = tmp_path / "p.md"
    p.write_text(body, encoding="utf-8")
    result = _run(p)
    assert result.returncode == 1
    assert "draft placeholder" in result.stdout


def test_html_comments_strip_todo_markers(tmp_path):
    body = _valid_proposal() + "\n<!-- checklist: [ ] TODO items handled -->\n"
    p = tmp_path / "p.md"
    p.write_text(body, encoding="utf-8")
    result = _run(p)
    assert result.returncode == 0, result.stdout


def test_missing_success_signal_fields_fail(tmp_path):
    body = _valid_proposal().replace("- Target: < 1\n", "")
    p = tmp_path / "p.md"
    p.write_text(body, encoding="utf-8")
    result = _run(p)
    assert result.returncode == 1
    assert "missing 'Target:'" in result.stdout


def test_missing_section_fails(tmp_path):
    body = _valid_proposal().replace("## 7. Success signal", "## 7. Something else")
    p = tmp_path / "p.md"
    p.write_text(body, encoding="utf-8")
    result = _run(p)
    assert result.returncode == 1
    assert "missing section: 7. Success signal" in result.stdout


def test_nonexistent_path_returns_3(tmp_path):
    result = _run(tmp_path / "nope.md")
    assert result.returncode == 3


def test_json_format_output(tmp_path):
    p = tmp_path / "p.md"
    p.write_text("---\nproposal_id: x\n---\n\n# body\n", encoding="utf-8")
    result = _run(p, fmt="json")
    assert result.returncode == 1
    payload = json.loads(result.stdout)
    assert any("missing: type" in f["message"] for f in payload["findings"])



def test_originating_project_required_when_stage_upstream(tmp_path):
    p = tmp_path / "p.md"
    text = _valid_proposal().replace("stage: proposed", "stage: upstream")
    # Section 10 is "Pending." — no Originating project line.
    p.write_text(text, encoding="utf-8")
    result = _run(p)
    assert result.returncode == 1
    assert "Originating project" in result.stdout


def test_originating_project_placeholder_blocks(tmp_path):
    p = tmp_path / "p.md"
    text = _valid_proposal().replace("stage: proposed", "stage: upstream")
    text = text.replace(
        "## 10. Upstream PR\n\nPending.",
        "## 10. Upstream PR\n\n- Originating project: "
        "<consumer repo slug; metadata only>",
    )
    p.write_text(text, encoding="utf-8")
    result = _run(p)
    assert result.returncode == 1
    assert "originating-project" in result.stdout


def test_originating_project_filled_passes(tmp_path):
    p = tmp_path / "p.md"
    text = _valid_proposal().replace("stage: proposed", "stage: upstream")
    text = text.replace(
        "## 10. Upstream PR\n\nPending.",
        "## 10. Upstream PR\n\n- Originating project: acme-app",
    )
    p.write_text(text, encoding="utf-8")
    result = _run(p)
    assert result.returncode == 0, result.stdout


def test_rate_limit_warns_when_dir_full(tmp_path):
    import datetime as dt
    proposals = tmp_path / "proposals"
    proposals.mkdir()
    today = dt.date.today().isoformat()
    for i in range(6):
        (proposals / f"p{i}.md").write_text(
            f"---\nproposal_id: p{i}\ntype: rule\nscope: project\n"
            f"stage: proposed\nauthor: t\ncreated: {today}\n"
            f"last_updated: {today}\n---\n\n# body\n",
            encoding="utf-8",
        )
    target = proposals / "current.md"
    target.write_text(_valid_proposal(), encoding="utf-8")
    result = _run(target)
    assert "rate-limit" in result.stdout
    # Rate-limit is a warning, not a blocker — exit 0 as long as the
    # proposal itself is valid.
    assert result.returncode == 0, result.stdout
