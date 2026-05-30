"""skill_discovery — local, explained skill-recommendation surface.

Phase 3 of `road-to-leaner-core-and-discovery`. Covers the four recommendation
classes, the non-empty-`why` invariant, the analytics opt-out short-circuit,
graceful degradation when analytics is empty, and the analytics-signal path.
Pure-local, no network — these run anywhere.
"""
from __future__ import annotations

import importlib
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "scripts"))
sd = importlib.import_module("skill_discovery")

NOW = datetime(2026, 5, 30, 12, 0, 0, tzinfo=timezone.utc)


def _catalog() -> dict:
    return {
        "refine-prompt": sd.Skill("refine-prompt", "tighten a brief", "product"),
        "voice-and-tone-design": sd.Skill("voice-and-tone-design", "lock voice", "product"),
        "messaging-architecture": sd.Skill("messaging-architecture", "value proof", "product"),
        "api-design": sd.Skill("api-design", "design APIs", "backend"),
        "threat-modeling": sd.Skill("threat-modeling", "abuse cases", "security"),
        "funnel-analysis": sd.Skill("funnel-analysis", "stage discipline", "product"),
        "stakeholder-tradeoff": sd.Skill("stakeholder-tradeoff", "competing pulls", "product"),
        # product-domain skill NOT in the shortlist → surfaces via related-to-current-task
        "activation-design": sd.Skill("activation-design", "aha moment", "product"),
    }


def _shortlist() -> list[dict]:
    return [
        {"id": "refine-prompt", "why": "tightens fuzzy briefs"},
        {"id": "voice-and-tone-design", "why": "locks the deal voice"},
        {"id": "messaging-architecture", "why": "builds value proof"},
        {"id": "funnel-analysis", "why": "stage discipline"},
        {"id": "stakeholder-tradeoff", "why": "competing pulls"},
    ]


def _event(skill: str, role: str = "sales", days: int = 1) -> dict:
    ts = datetime(2026, 5, 30 - days, 12, 0, 0, tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")
    return {"ts": ts, "schema": "workspace_event/v0", "event": "session.completed",
            "data": {"role": role, "skill": skill}}


def _recs(events, use_analytics, limit=3):
    return sd.recommend("sales", _catalog(), _shortlist(), events, use_analytics, NOW, limit)


def test_every_recommendation_has_nonempty_why():
    recs = _recs([], use_analytics=False)
    assert recs, "expected at least one recommendation"
    assert all(r.why and r.why.strip() for r in recs), "every result must carry a non-empty why"


def test_first_class_is_role_shortlist():
    recs = _recs([], use_analytics=False)
    role_recs = [r for r in recs if r.cls == "most-useful-for-role"]
    assert role_recs, "most-useful-for-role class must produce results"
    assert role_recs[0].skill == "refine-prompt"
    assert role_recs[0].why == "tightens fuzzy briefs"


def test_related_class_uses_domain_signal():
    recs = _recs([], use_analytics=False)
    related = [r for r in recs if r.cls == "related-to-current-task"]
    assert related, "related-to-current-task must surface same-domain peers"
    assert all("same domain" in r.why for r in related)
    # only skills not already in the shortlist
    short = {s["id"] for s in _shortlist()}
    assert all(r.skill not in short for r in related)


def test_optout_short_circuits_to_catalog_and_role():
    # analytics disabled → analytics-backed classes fall back to the shortlist with honest why.
    recs = _recs([_event("api-design")], use_analytics=False)
    analytics_classes = [r for r in recs if r.cls in ("recently-adopted", "popular-in-role")]
    assert analytics_classes, "fallback must still populate the analytics-backed classes"
    assert all("no local usage signal yet" in r.why for r in analytics_classes)


def test_empty_analytics_degrades_gracefully():
    recs = _recs([], use_analytics=True)  # analytics on but zero events
    assert recs, "empty analytics must not crash or empty the result"
    analytics_classes = [r for r in recs if r.cls in ("recently-adopted", "popular-in-role")]
    assert all("no local usage signal yet" in r.why for r in analytics_classes)


def test_analytics_signal_is_used_when_present():
    # threat-modeling is in a domain (security) not shared by the sales shortlist,
    # so it is not claimed by most-useful or related — it can surface via analytics.
    events = [_event("threat-modeling", days=2), _event("threat-modeling", days=1)]
    recs = _recs(events, use_analytics=True)
    tm = [r for r in recs if r.skill == "threat-modeling"]
    assert tm, "an analytics-only skill must surface via the analytics classes"
    assert any(r.cls in ("recently-adopted", "popular-in-role") for r in tm)
    assert any(("used" in r.why and "ago" in r.why) or "launched" in r.why for r in tm)


def test_all_four_classes_reachable():
    events = [_event("threat-modeling", days=1)]
    recs = _recs(events, use_analytics=True)
    classes = {r.cls for r in recs}
    assert "most-useful-for-role" in classes
    assert "related-to-current-task" in classes
    assert classes & {"recently-adopted", "popular-in-role"}


def test_cli_unknown_role_exits_2():
    proc = subprocess.run(
        [sys.executable, str(REPO_ROOT / "scripts" / "skill_discovery.py"),
         "--role", "not-a-real-role", "--format", "json"],
        capture_output=True, text=True, cwd=REPO_ROOT,
    )
    assert proc.returncode == 2, f"unknown role must exit 2, got {proc.returncode}: {proc.stderr}"


def test_cli_real_role_smoke():
    proc = subprocess.run(
        [sys.executable, str(REPO_ROOT / "scripts" / "skill_discovery.py"),
         "--role", "sales", "--format", "json", "--now", "2026-05-30T12:00:00Z"],
        capture_output=True, text=True, cwd=REPO_ROOT,
    )
    assert proc.returncode == 0, proc.stderr
    payload = json.loads(proc.stdout)
    assert payload["role"] == "sales"
    assert payload["recommendations"], "real role must yield recommendations"
    assert all(r["why"].strip() for r in payload["recommendations"])


# ---- in-process coverage of loaders, render, and main() ----

def test_load_catalog_reads_real_skills():
    cat = sd.load_catalog()
    assert len(cat) > 100, "the real catalog has 200+ skills"
    assert all(isinstance(s, sd.Skill) for s in cat.values())


def test_available_roles_and_shortlist():
    roles = sd.available_roles()
    assert "sales" in roles
    short = sd.load_role_shortlist("sales")
    assert short and all("id" in s for s in short)
    assert sd.load_role_shortlist("not-a-role") == []


def test_analytics_enabled_env_and_config(monkeypatch):
    monkeypatch.delenv("AGENT_CONFIG_NO_LOCAL_ANALYTICS", raising=False)
    assert sd.analytics_enabled({}) is True
    assert sd.analytics_enabled({"analytics": {"local": "off"}}) is False
    monkeypatch.setenv("AGENT_CONFIG_NO_LOCAL_ANALYTICS", "1")
    assert sd.analytics_enabled({}) is False


def test_load_analytics_events_with_fixture(tmp_path, monkeypatch):
    adir = tmp_path / "workspace" / "analytics"
    adir.mkdir(parents=True)
    (adir / "events.jsonl").write_text(
        '{"event":"session.completed","data":{"role":"sales","skill":"api-design"}}\n'
        'not-json-skip-me\n'
        '{"event":"x","data":{"role":"sales"}}\n',
        encoding="utf-8",
    )
    monkeypatch.setattr(sd, "event4u_root", lambda env=None: tmp_path)
    events = sd.load_analytics_events()
    assert len(events) == 2, "malformed line is skipped, valid lines kept"


def test_render_text_includes_analytics_note():
    recs = _recs([], use_analytics=False)
    txt = sd.render_text("sales", recs, analytics_on=False)
    assert "role shortlist only" in txt
    assert "| skill | class | why | first command |" in txt


def test_first_command_maps_existing_command():
    # a real command file exists for skills:discover under commands/skills/
    assert sd.first_command("discover").startswith(("/", "Skill"))


def test_main_unknown_role_returns_2(capsys):
    assert sd.main(["--role", "definitely-not-a-role"]) == 2


def test_main_json_happy_path(capsys):
    rc = sd.main(["--role", "sales", "--format", "json", "--now", "2026-05-30T12:00:00Z"])
    assert rc == 0
    payload = json.loads(capsys.readouterr().out)
    assert payload["role"] == "sales" and payload["recommendations"]


def test_main_text_happy_path(capsys):
    rc = sd.main(["--role", "sales", "--now", "2026-05-30T12:00:00Z"])
    assert rc == 0
    assert "Suggested skills" in capsys.readouterr().out
