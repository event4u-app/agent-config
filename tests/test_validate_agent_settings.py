"""Tests for the agent-settings schema enum + the cost_profile untangle (R1).

Backfills the `rule_loading_tier` enum contract and the legacy
`cost_profile` handling that shipped with the 2026-06-01 untangle with
+0 dedicated coverage.

Scope note (AI council, claude-sonnet-4-5 + gpt-4o, analysis, 2026-06-02):
the roadmap step's wording ("the legacy `cost_profile` key is rejected
with a clear, actionable error") describes a guard that was **never
shipped** — `additionalProperties: true` tolerates the key and three
call-sites read it as a soft alias for `rule_loading_tier`. The council
converged on Option A (test what shipped, do NOT add a hard rejection: a
hard fail would break every consumer still carrying the legacy key, with
no deprecation window). These tests therefore pin (a) the project's enum
contract, (b) that the legacy key is *tolerated* (current reality), and
(c) the alias-rename contract that is the genuine shipped untangle logic.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import jsonschema

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

SCHEMA_PATH = ROOT / "scripts" / "schemas" / "agent-settings.schema.json"
_SCHEMA = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
_VALIDATOR = jsonschema.Draft7Validator(_SCHEMA)

VALID_TIERS = ("minimal", "balanced", "full", "custom")


def _errors(doc: dict) -> list[jsonschema.ValidationError]:
    return list(_VALIDATOR.iter_errors(doc))


# --- positive: the project schema accepts every valid tier -----------------

def test_all_valid_rule_loading_tiers_accepted():
    """Pins the project's enum contract — all four shipped values, incl.
    `custom` (which the roadmap step omitted)."""
    for tier in VALID_TIERS:
        assert _errors({"rule_loading_tier": tier}) == [], tier


# --- negative enum: an out-of-enum value is rejected -----------------------

def test_invalid_rule_loading_tier_rejected_with_enum_message():
    """Guards against the field silently losing its enum (or being widened):
    a legacy cost-profile-vocabulary value like `lean` must not validate."""
    errs = _errors({"rule_loading_tier": "lean"})
    assert errs, "schema must reject an out-of-enum rule_loading_tier"
    msg = errs[0].message
    # error names the field's allowed values — actionable for the user
    assert any(t in msg for t in VALID_TIERS), msg


# --- legacy key tolerance: the SHIPPED reality (not a rejection) -----------

def test_legacy_cost_profile_key_is_tolerated_not_rejected():
    """Documents shipped behaviour: `additionalProperties: true` means the
    legacy `cost_profile` key validates clean. The roadmap's assumed
    hard-rejection was never implemented — see module docstring (Option A)."""
    assert _errors({"cost_profile": "minimal"}) == []


# --- alias contract: the genuine untangle project logic --------------------

def test_cost_profile_aliases_rule_loading_tier_in_rename_map():
    """The real shipped untangle: the migration rename map aliases the
    legacy key to `rule_loading_tier` (install.py LEGACY_RENAME_MAP)."""
    from scripts import install  # heavy import; mirrors test_cmd_settings_migrate

    assert install.LEGACY_RENAME_MAP["cost_profile"] == "rule_loading_tier"
