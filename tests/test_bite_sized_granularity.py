"""Tests for scripts/check_bite_sized_granularity.py — P1.5.

CI contract per `agents/roadmaps/road-to-superpowers-harvest.md` Phase 1
verification table:

    P1.5 | pytest tests/test_bite_sized_granularity.py
         | structural-complexity gate fires; lightweight skips

The gate must be **complexity-aware**: structural roadmaps fail on
placeholders, lightweight (or untagged) roadmaps skip silently.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "src" / "scripts"))

import check_bite_sized_granularity as bsg  # noqa: E402


STRUCTURAL_CLEAN = """\
---
complexity: structural
---

# Roadmap — Structural Clean

## Phase 1
- [ ] Edit `app/Http/Controllers/AuthController.php`: add `logout()` method that calls `Auth::logout()` and returns `redirect('/')`. Run `php artisan route:list | grep logout`.
- [x] Add migration `database/migrations/2026_05_09_add_last_seen.php` with `$table->timestamp('last_seen')->nullable()`. Run `php artisan migrate`. Expect `Migrated: 2026_05_09_add_last_seen`.
"""

STRUCTURAL_WITH_PLACEHOLDERS = """\
---
complexity: structural
---

# Roadmap — Structural Dirty

## Phase 1
- [ ] Edit `<file>` and add the new method.
- [ ] TODO: write the migration.
- [ ] Run the tests???
"""

LIGHTWEIGHT_WITH_PLACEHOLDERS = """\
---
complexity: lightweight
---

# Roadmap — Lightweight

## Phase 1
- [ ] Add login endpoint
- [ ] TODO: write tests later
- [ ] Update <docs>
"""

UNTAGGED_WITH_PLACEHOLDERS = """\
# Roadmap — Untagged

## Phase 1
- [ ] TODO: do the thing
"""


def test_read_complexity_structural() -> None:
    assert bsg.read_complexity(STRUCTURAL_CLEAN) == "structural"


def test_read_complexity_lightweight() -> None:
    assert bsg.read_complexity(LIGHTWEIGHT_WITH_PLACEHOLDERS) == "lightweight"


def test_read_complexity_untagged() -> None:
    assert bsg.read_complexity(UNTAGGED_WITH_PLACEHOLDERS) is None


def test_structural_clean_passes() -> None:
    result = bsg.check_granularity(STRUCTURAL_CLEAN)
    assert result.complexity == "structural"
    assert result.gated is True
    assert result.violations == []


def test_structural_with_placeholders_fails() -> None:
    result = bsg.check_granularity(STRUCTURAL_WITH_PLACEHOLDERS)
    assert result.complexity == "structural"
    assert result.gated is True
    kinds = {v.kind for v in result.violations}
    assert "angle-placeholder" in kinds
    assert "todo" in kinds
    assert "triple-question" in kinds
    assert len(result.violations) >= 3


def test_lightweight_skips_gate() -> None:
    """Lightweight roadmaps are NOT gated even when they contain placeholders."""
    result = bsg.check_granularity(LIGHTWEIGHT_WITH_PLACEHOLDERS)
    assert result.complexity == "lightweight"
    assert result.gated is False
    assert result.violations == []


def test_untagged_skips_gate() -> None:
    result = bsg.check_granularity(UNTAGGED_WITH_PLACEHOLDERS)
    assert result.complexity is None
    assert result.gated is False
    assert result.violations == []


def test_scan_only_inspects_task_bullets() -> None:
    """Placeholders in prose / headings must NOT trigger the gate."""
    text = """\
---
complexity: structural
---

# Roadmap

Prose with <placeholder> and TODO and ???.

## Phase 1
- [ ] Clean task on `path/to/file.py` — no placeholders here.
"""
    result = bsg.check_granularity(text)
    assert result.gated is True
    assert result.violations == []


def test_violation_carries_line_and_kind() -> None:
    result = bsg.check_granularity(STRUCTURAL_WITH_PLACEHOLDERS)
    todo_hits = [v for v in result.violations if v.kind == "todo"]
    assert len(todo_hits) == 1
    assert todo_hits[0].line > 1
    assert "TODO" in todo_hits[0].text


@pytest.mark.parametrize(
    "needle,kind",
    [
        ("FIXME: refactor this", "fixme"),
        ("XXX something", "xxx"),
        ("TBD later", "tbd"),
        ("tbd later", "tbd"),
    ],
)
def test_other_placeholder_kinds(needle: str, kind: str) -> None:
    text = f"""---
complexity: structural
---
- [ ] task — {needle}
"""
    result = bsg.check_granularity(text)
    assert result.gated is True
    assert any(v.kind == kind for v in result.violations), (
        f"expected kind={kind!r} for {needle!r}, got {result.violations}"
    )
