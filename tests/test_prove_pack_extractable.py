"""road-to-6.0.0-D Phase 1 Step 6 — extraction-proof regression lock.

Proves the flattened `laravel` pack stays standalone-extractable (no hard
cross-pack frontmatter dependency outside its `requires` closure). This is
the de-risking guarantee for the Phase 3 monorepo collapse: if a later edit
adds a `skills:`/`rules:` include pointing outside laravel's closure, this
test fails loudly.
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import prove_pack_extractable as ppe  # noqa: E402


def test_laravel_is_extractable() -> None:
    ok, hard, _advisory, closure = ppe.prove("laravel")
    assert ok, f"laravel not standalone-extractable — hard dangling: {hard}"
    assert hard == []
    # closure is laravel + its requires (php, engineering-base) + foundation
    assert {"laravel", "php", "engineering-base"} <= closure


def test_unknown_pack_reports_cleanly() -> None:
    ok, msgs, _advisory, closure = ppe.prove("definitely-not-a-pack")
    assert ok is False
    assert closure == set()
    assert msgs and "unknown pack" in msgs[0]
