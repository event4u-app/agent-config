"""Skill discovery recommender — local-only, explained, no network.

Phase 3 of `road-to-leaner-core-and-discovery`. Turns existing local signals
(skill catalog frontmatter, role shortlists, optional local-analytics JSONL)
into a short, *explained* skill shortlist. Every recommendation carries a
non-empty `why` (contract: docs/contracts/skill-discovery.md). Adds no
always-loaded layer; reads local files only.

Four classes:
  most-useful-for-role   — role skills.yml priority order
  related-to-current-task— skills sharing the role's core domains
  recently-adopted       — analytics events (last 14d) with a skill id
  popular-in-role        — analytics skill-events filtered by role, by frequency

Analytics is optional; missing / empty / opted-out degrades gracefully to
the role shortlist with an honest `why`. Honours the same opt-out as
local-analytics.md (AGENT_CONFIG_NO_LOCAL_ANALYTICS env + analytics.local config).

Usage:
    python3 scripts/skill_discovery.py [--role ROLE] [--format text|json] [--limit N]
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parent.parent
SKILLS_DIR = REPO_ROOT / ".agent-src" / "skills"
ROLES_DIR = REPO_ROOT / "agents" / "roles"
COMMANDS_DIR = REPO_ROOT / ".agent-src" / "commands"
RECENT_DAYS = 14

sys.path.insert(0, str(REPO_ROOT / "scripts"))
try:
    from _lib.user_global_paths import event4u_root  # type: ignore
except Exception:  # pragma: no cover - fallback when run outside repo
    def event4u_root(env=None):  # type: ignore
        return Path.home() / ".event4u" / "agent-config"

CLASSES = ("most-useful-for-role", "related-to-current-task", "recently-adopted", "popular-in-role")


@dataclass
class Skill:
    name: str
    description: str
    domain: str


@dataclass
class Rec:
    skill: str
    cls: str
    why: str
    first_command: str = ""


def _frontmatter(text: str) -> dict:
    if not text.startswith("---"):
        return {}
    end = text.find("\n---", 3)
    if end == -1:
        return {}
    try:
        return yaml.safe_load(text[3:end]) or {}
    except yaml.YAMLError:
        return {}


def load_catalog() -> dict[str, Skill]:
    out: dict[str, Skill] = {}
    if not SKILLS_DIR.exists():
        return out
    for d in sorted(SKILLS_DIR.iterdir()):
        sk = d / "SKILL.md"
        if not sk.is_file():
            continue
        fm = _frontmatter(sk.read_text(encoding="utf-8", errors="replace"))
        name = str(fm.get("name") or d.name).strip().strip('"')
        out[name] = Skill(name, str(fm.get("description", "")).strip(), str(fm.get("domain", "")).strip())
    return out


def load_role_shortlist(role: str) -> list[dict]:
    f = ROLES_DIR / role / "skills.yml"
    if not f.is_file():
        return []
    data = yaml.safe_load(f.read_text(encoding="utf-8", errors="replace")) or {}
    return [s for s in (data.get("skills") or []) if isinstance(s, dict) and s.get("id")]


def available_roles() -> list[str]:
    if not ROLES_DIR.exists():
        return []
    return sorted(d.name for d in ROLES_DIR.iterdir() if (d / "skills.yml").is_file())


def analytics_enabled(settings: dict) -> bool:
    if os.environ.get("AGENT_CONFIG_NO_LOCAL_ANALYTICS", "").strip():
        return False
    val = ((settings.get("analytics") or {}).get("local"))
    return str(val).strip().lower() not in ("off", "false", "0", "no")


def load_settings() -> dict:
    try:
        from _lib.agent_settings import load_agent_settings  # type: ignore
        return load_agent_settings(cwd=Path.cwd()) or {}
    except Exception:
        return {}


def load_analytics_events() -> list[dict]:
    path = event4u_root() / "workspace" / "analytics" / "events.jsonl"
    if not path.is_file():
        return []
    events: list[dict] = []
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            events.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return events


def _days_ago(ts: str, now: datetime) -> int | None:
    try:
        dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return (now - dt).days
    except (ValueError, AttributeError):
        return None


def first_command(name: str) -> str:
    for cand in (COMMANDS_DIR / f"{name}.md", *COMMANDS_DIR.glob(f"*/{name}.md")):
        if cand.is_file():
            return f"/{name}"
    return f"Skill › {name}"


def recommend(role: str, catalog: dict[str, Skill], shortlist: list[dict],
              events: list[dict], use_analytics: bool, now: datetime, limit: int) -> list[Rec]:
    recs: list[Rec] = []
    claimed: set[str] = set()

    def add(name: str, cls: str, why: str) -> None:
        if name in claimed or name not in catalog or not why:
            return
        claimed.add(name)
        recs.append(Rec(name, cls, why, first_command(name)))

    # 1. most-useful-for-role — role shortlist priority order.
    short_ids = [s["id"] for s in shortlist]
    for s in shortlist[:limit]:
        why = (s.get("why") or "").strip() or f"on the {role} role's priority shortlist"
        add(s["id"], "most-useful-for-role", why)

    # 2. related-to-current-task — same domain as the role's core skills, not yet shortlisted.
    role_domains = {catalog[i].domain for i in short_ids if i in catalog and catalog[i].domain}
    related = [sk for n, sk in sorted(catalog.items())
               if sk.domain in role_domains and n not in short_ids and sk.domain]
    for sk in related[:limit]:
        add(sk.name, "related-to-current-task", f"same domain ({sk.domain}) as your {role} core skills")

    # 3 + 4. analytics-backed, or graceful role-shortlist fallback.
    skill_events = [e for e in events if isinstance(e.get("data"), dict) and e["data"].get("skill")]
    if use_analytics and skill_events:
        recent = sorted(
            ((e["data"]["skill"], _days_ago(e.get("ts", ""), now)) for e in skill_events),
            key=lambda kv: (kv[1] is None, kv[1] if kv[1] is not None else 1e9),
        )
        for name, days in recent:
            if days is not None and days <= RECENT_DAYS:
                add(name, "recently-adopted", f"used {days}d ago in this workspace")
        role_counts = Counter(
            e["data"]["skill"] for e in skill_events if e["data"].get("role") == role
        )
        for name, n in role_counts.most_common(limit):
            add(name, "popular-in-role", f"launched {n}× by the {role} role locally")
    else:
        reason = "from your role shortlist — no local usage signal yet"
        for s in shortlist[limit: limit * 2]:
            add(s["id"], "recently-adopted", reason)
        for s in shortlist:
            add(s["id"], "popular-in-role", reason)
    return recs


def render_text(role: str, recs: list[Rec], analytics_on: bool) -> str:
    lines = [f"# Suggested skills for the `{role}` role", ""]
    note = "local analytics: on" if analytics_on else "local analytics: off (role shortlist only)"
    lines.append(f"_{note}_\n")
    lines += ["| skill | class | why | first command |", "|---|---|---|---|"]
    for r in recs:
        lines.append(f"| `{r.skill}` | {r.cls} | {r.why} | `{r.first_command}` |")
    lines.append("")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Local skill-discovery recommender (read-only, explained).")
    ap.add_argument("--role", default=None, help="Role id (defaults to active role experience, else prompts).")
    ap.add_argument("--format", choices=("text", "json"), default="text")
    ap.add_argument("--limit", type=int, default=5)
    ap.add_argument("--now", default=None, help="ISO timestamp override for tests.")
    args = ap.parse_args(argv)

    settings = load_settings()
    role = args.role or ((settings.get("roles") or {}).get("active_role") or "").strip()
    roles = available_roles()
    if not role:
        print(f"No role given and no active role set. Available roles: {', '.join(roles) or '(none)'}", file=sys.stderr)
        print("Re-run with --role <role>.", file=sys.stderr)
        return 2
    if role not in roles:
        print(f"Unknown role {role!r}. Available: {', '.join(roles) or '(none)'}", file=sys.stderr)
        return 2

    catalog = load_catalog()
    shortlist = load_role_shortlist(role)
    use_analytics = analytics_enabled(settings)
    events = load_analytics_events() if use_analytics else []
    now = datetime.fromisoformat(args.now.replace("Z", "+00:00")) if args.now else datetime.now(timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)

    recs = recommend(role, catalog, shortlist, events, use_analytics, now, args.limit)

    if args.format == "json":
        print(json.dumps({
            "role": role,
            "analytics": use_analytics,
            "recommendations": [r.__dict__ for r in recs],
        }, indent=2))
    else:
        print(render_text(role, recs, use_analytics))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
