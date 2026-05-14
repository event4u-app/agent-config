"""Replace-mode advisor contract (Phase 6).

Covers the four cases called out in roadmap Phase 6 Step 6:

1. One advisor enabled → correct call plan (member key + persona text +
   display name).
2. Multiple advisors stack on distinct providers → no duplicate calls;
   two advisors on the same provider is a hard error.
3. Advisor referencing a disabled (or missing) member fails closed at
   `load_council_config` time.
4. Advisor `model` override survives the plan-build round trip.

Plus persona resolution edges — frontmatter `role` wins the display
name, missing frontmatter falls back to titleized advisor key, missing
file is a `CouncilConfigError`. Tests stage their own persona files
under `tmp_path/.agent-src.uncompressed/personas/advisors/` so the suite
stays hermetic from the real package tree.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest
import yaml

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from scripts.ai_council.advisors import (  # noqa: E402
    AdvisorPlan,
    build_persona_labels,
    plan_advisor_swap,
    resolve_persona_text,
)
from scripts.ai_council.config import (  # noqa: E402
    AdvisorConfig,
    CouncilConfigError,
    MemberConfig,
    load_council_config,
)


# ── fixtures ────────────────────────────────────────────────────────────────


def _write_persona(root: Path, name: str, *, role: str | None = None,
                   body: str = "Persona body text.") -> Path:
    target = root / ".agent-src.uncompressed" / "personas" / "advisors" / f"{name}.md"
    target.parent.mkdir(parents=True, exist_ok=True)
    if role is None:
        target.write_text(body, encoding="utf-8")
    else:
        fm = {"id": name, "role": role}
        target.write_text(
            "---\n" + yaml.safe_dump(fm) + "---\n" + body, encoding="utf-8",
        )
    return target


def _write_yaml(tmp_path: Path, payload: dict) -> Path:
    p = tmp_path / "ai-council.yml"
    p.write_text(yaml.safe_dump(payload), encoding="utf-8")
    return p


_BASE_PAYLOAD = {
    "enabled": True,
    "defaults": {"mode": "api"},
    "members": {
        "anthropic": {
            "enabled": True,
            "model": "claude-sonnet-4-5",
            "api_key_ref": "env:ANTHROPIC_API_KEY",
        },
        "openai": {
            "enabled": True,
            "model": "gpt-4o",
            "api_key_ref": "env:OPENAI_API_KEY",
        },
    },
}


# ── plan_advisor_swap ───────────────────────────────────────────────────────


def test_one_advisor_enabled_produces_call_plan(tmp_path: Path) -> None:
    _write_persona(tmp_path, "contrarian", role="Contrarian Advisor",
                   body="Argue against. Probe assumptions.")
    advisors = {
        "contrarian": AdvisorConfig(
            name="contrarian", enabled=True, member="anthropic",
            persona="personas/advisors/contrarian.md", model=None,
        ),
    }
    plans = plan_advisor_swap(advisors, tmp_path)
    assert set(plans) == {"anthropic"}
    plan = plans["anthropic"]
    assert plan.name == "contrarian"
    assert plan.display_name == "Contrarian Advisor"
    assert plan.member == "anthropic"
    assert "Argue against" in plan.persona_text
    assert plan.model_override is None


def test_multiple_advisors_stack_on_distinct_providers(tmp_path: Path) -> None:
    _write_persona(tmp_path, "contrarian", role="Contrarian Advisor")
    _write_persona(tmp_path, "expansionist", role="Expansionist Advisor")
    advisors = {
        "contrarian": AdvisorConfig(
            name="contrarian", enabled=True, member="anthropic",
            persona="personas/advisors/contrarian.md",
        ),
        "expansionist": AdvisorConfig(
            name="expansionist", enabled=True, member="openai",
            persona="personas/advisors/expansionist.md",
        ),
    }
    plans = plan_advisor_swap(advisors, tmp_path)
    assert set(plans) == {"anthropic", "openai"}
    assert plans["anthropic"].name == "contrarian"
    assert plans["openai"].name == "expansionist"


def test_two_advisors_same_provider_is_rejected(tmp_path: Path) -> None:
    _write_persona(tmp_path, "contrarian", role="Contrarian Advisor")
    _write_persona(tmp_path, "executor", role="Executor Advisor")
    advisors = {
        "contrarian": AdvisorConfig(
            name="contrarian", enabled=True, member="anthropic",
            persona="personas/advisors/contrarian.md",
        ),
        "executor": AdvisorConfig(
            name="executor", enabled=True, member="anthropic",
            persona="personas/advisors/executor.md",
        ),
    }
    with pytest.raises(CouncilConfigError, match="only one advisor per provider"):
        plan_advisor_swap(advisors, tmp_path)


def test_disabled_advisors_are_skipped(tmp_path: Path) -> None:
    _write_persona(tmp_path, "contrarian", role="Contrarian Advisor")
    advisors = {
        "contrarian": AdvisorConfig(
            name="contrarian", enabled=False, member="anthropic",
            persona="personas/advisors/contrarian.md",
        ),
    }
    assert plan_advisor_swap(advisors, tmp_path) == {}



def test_model_override_propagates(tmp_path: Path) -> None:
    _write_persona(tmp_path, "contrarian", role="Contrarian Advisor")
    advisors = {
        "contrarian": AdvisorConfig(
            name="contrarian", enabled=True, member="anthropic",
            persona="personas/advisors/contrarian.md",
            model="claude-opus-4",
        ),
    }
    plans = plan_advisor_swap(advisors, tmp_path)
    assert plans["anthropic"].model_override == "claude-opus-4"


def test_missing_persona_file_is_hard_error(tmp_path: Path) -> None:
    advisors = {
        "contrarian": AdvisorConfig(
            name="contrarian", enabled=True, member="anthropic",
            persona="personas/advisors/contrarian.md",
        ),
    }
    with pytest.raises(CouncilConfigError, match="Persona file not found"):
        plan_advisor_swap(advisors, tmp_path)


# ── persona resolution ─────────────────────────────────────────────────────


def test_resolve_persona_strips_frontmatter(tmp_path: Path) -> None:
    _write_persona(tmp_path, "contrarian", role="Contrarian Advisor",
                   body="Strongest counterargument first.")
    body, meta = resolve_persona_text(
        "personas/advisors/contrarian.md", tmp_path,
    )
    assert body == "Strongest counterargument first."
    assert meta["role"] == "Contrarian Advisor"


def test_missing_frontmatter_falls_back_to_titleized_name(tmp_path: Path) -> None:
    _write_persona(tmp_path, "first-principles", role=None,
                   body="From first principles.")
    advisors = {
        "first-principles": AdvisorConfig(
            name="first-principles", enabled=True, member="anthropic",
            persona="personas/advisors/first-principles.md",
        ),
    }
    plan = plan_advisor_swap(advisors, tmp_path)["anthropic"]
    assert plan.display_name == "First Principles"


# ── peer-review labels ─────────────────────────────────────────────────────


def test_build_persona_labels_keys_by_provider_model(tmp_path: Path) -> None:
    plans = {
        "anthropic": AdvisorPlan(
            name="contrarian", display_name="Contrarian Advisor",
            member="anthropic", persona_text="…",
        ),
    }
    members = [
        MemberConfig(name="anthropic", enabled=True,
                     model="claude-sonnet-4-5",
                     api_key_ref="env:ANTHROPIC_API_KEY"),
        MemberConfig(name="openai", enabled=True, model="gpt-4o",
                     api_key_ref="env:OPENAI_API_KEY"),
    ]
    labels = build_persona_labels(plans, members)
    assert labels == {"anthropic:claude-sonnet-4-5": "Contrarian Advisor"}


# ── config-load cross-validation ───────────────────────────────────────────


def test_advisor_referencing_disabled_member_fails_closed(tmp_path: Path) -> None:
    payload = {
        **_BASE_PAYLOAD,
        "members": {
            "anthropic": {
                "enabled": False,
                "model": "claude-sonnet-4-5",
                "api_key_ref": "env:ANTHROPIC_API_KEY",
            },
        },
        "advisors": {
            "contrarian": {"enabled": True, "member": "anthropic"},
        },
    }
    with pytest.raises(CouncilConfigError, match="disabled"):
        load_council_config(_write_yaml(tmp_path, payload))


def test_advisor_referencing_unknown_member_fails_closed(tmp_path: Path) -> None:
    payload = {
        **_BASE_PAYLOAD,
        "advisors": {
            "contrarian": {"enabled": True, "member": "gemini"},
        },
    }
    with pytest.raises(CouncilConfigError, match="no such member"):
        load_council_config(_write_yaml(tmp_path, payload))


def test_advisor_persona_defaults_to_convention_path(tmp_path: Path) -> None:
    payload = {
        **_BASE_PAYLOAD,
        "advisors": {
            "contrarian": {"enabled": False, "member": "anthropic"},
        },
    }
    cfg = load_council_config(_write_yaml(tmp_path, payload))
    assert cfg.advisors["contrarian"].persona == "personas/advisors/contrarian.md"


def test_advisor_invalid_model_type_fails_closed(tmp_path: Path) -> None:
    payload = {
        **_BASE_PAYLOAD,
        "advisors": {
            "contrarian": {
                "enabled": False, "member": "anthropic",
                "model": ["claude-opus-4"],
            },
        },
    }
    with pytest.raises(CouncilConfigError, match="model must be a string"):
        load_council_config(_write_yaml(tmp_path, payload))
