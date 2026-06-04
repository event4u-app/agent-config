"""Unit tests for ``scripts/adoption_status.py``.

Phase C Step 6 of ``road-to-adoption-proof-and-ci-green.md``. Covers
the parser path (registry-row counting, recruit-report counting) and
the JSON render. Live ``gh`` invocations are not exercised — the CI
color resolution is best-effort and exits via the `unknown` branch
when ``gh`` is absent.
"""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parent.parent
MODULE_PATH = REPO_ROOT / "src" / "scripts" / "adoption_status.py"


def _load_module():
    spec = importlib.util.spec_from_file_location("adoption_status", MODULE_PATH)
    assert spec is not None and spec.loader is not None
    mod = importlib.util.module_from_spec(spec)
    sys.modules["adoption_status"] = mod
    spec.loader.exec_module(mod)
    return mod


SAMPLE_REGISTRY = """\
# Registry Submissions — tracking sheet

## Status legend

| Status | Meaning |
|---|---|
| `pending` | Pre-submission. |

## Tracking rows

| # | Registry | Submission shape | Status | PR / form URL | Date | Maintainer notes |
|---|---|---|---|---|---|---|
| 1 | A | shape A | `pending` | — | — | note |
| 2 | B | shape B | `submitted` | url-b | 2026-05-26 | note |
| 3 | C | shape C | `accepted` | url-c | 2026-05-26 | note |
| 4 | D | shape D | `rejected` | url-d | 2026-05-26 | note |
| 5 | E | shape E | `stalled` | url-e | 2026-03-01 | note |

## How to update a row

(Out of scope for parser.)
"""


def test_parser_counts_each_status_once() -> None:
    mod = _load_module()
    counts = mod.parse_registry_statuses(SAMPLE_REGISTRY)
    assert counts == {
        "pending": 1,
        "submitted": 1,
        "accepted": 1,
        "rejected": 1,
        "stalled": 1,
    }


def test_parser_handles_table_with_no_rows() -> None:
    mod = _load_module()
    counts = mod.parse_registry_statuses("# Doc\n\n## Tracking rows\n\nNo rows yet.\n")
    assert counts == {s: 0 for s in mod.STATUS_VALUES}


def test_parser_stops_at_next_h2_section() -> None:
    mod = _load_module()
    doc = SAMPLE_REGISTRY + "\n| 99 | not | counted | `pending` | x | y | z |\n"
    counts = mod.parse_registry_statuses(doc)
    # Row 99 sits after `## How to update a row` so the parser ignored it.
    assert counts["pending"] == 1


def test_count_recruit_reports_skips_template_and_runbook(tmp_path) -> None:
    mod = _load_module()
    (tmp_path / "_template.md").write_text("")
    (tmp_path / "_runbook.md").write_text("")
    (tmp_path / "README.md").write_text("")
    (tmp_path / "01-galabau-owner.md").write_text("")
    (tmp_path / "02-content-creator.md").write_text("")
    n = mod.count_recruit_reports(tmp_path)
    assert n == 2


def test_count_recruit_reports_missing_dir() -> None:
    mod = _load_module()
    n = mod.count_recruit_reports(REPO_ROOT / "does-not-exist")
    assert n == 0


def test_render_text_includes_all_five_status_values() -> None:
    mod = _load_module()
    counts = {"pending": 2, "submitted": 1, "accepted": 0, "rejected": 0, "stalled": 0}
    out = mod.render_text(counts, 3, ("green", "5 green"), "main")
    for s in mod.STATUS_VALUES:
        assert s in out
    assert "Recruit-session reports filed: 3" in out
    assert "main" in out
    assert "5 green" in out


def test_render_json_shape() -> None:
    import json as json_mod
    mod = _load_module()
    counts = {"pending": 1, "submitted": 0, "accepted": 0, "rejected": 0, "stalled": 0}
    out = mod.render_json(counts, 0, ("green", "all green"), "main")
    parsed = json_mod.loads(out)
    assert parsed["registries"]["pending"] == 1
    assert parsed["recruit_reports"] == 0
    assert parsed["ci"]["color"] == "green"
    assert parsed["ci"]["branch"] == "main"
