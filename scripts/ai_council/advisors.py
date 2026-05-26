"""Thinking-style advisors — replace-mode call planning (Phase 6).

When `agents/settings/.ai-council.yml` enables an advisor (e.g. `contrarian`
bound to `member: anthropic`), the orchestrator REPLACES the matching
plain-member call with an advisor-persona call on the same provider.
Same total call count as a plain run; bounded extra cost beyond the
persona-prompt token delta.

This module owns:

- `AdvisorPlan`  — resolved swap for a single provider (persona text,
  display name, optional model override).
- `plan_advisor_swap()` — walks the enabled advisors, reads their
  persona files, and returns the per-provider plan map consumed by
  `orchestrator.consult()` / `estimate()` and by the CLI.
- `resolve_persona_text()` — reads a persona file with condensed-tree
  preference and frontmatter strip.

Cross-validation against the members block already ran at config load
(`config._build_config`); this module trusts that contract and only
enforces the **one-advisor-per-provider** rule (replace-mode invariant).
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

import yaml

from scripts.ai_council.config import AdvisorConfig, CouncilConfigError


@dataclass(frozen=True)
class AdvisorPlan:
    """Resolved advisor swap for a single provider."""

    name: str
    display_name: str
    member: str
    persona_text: str
    model_override: str | None = None


_FRONTMATTER_RE = re.compile(r"\A---\n(.*?)\n---\n", re.DOTALL)


def _split_frontmatter(raw: str) -> tuple[dict, str]:
    """Return ``(frontmatter_dict, body)``. Missing frontmatter → ``({}, raw)``."""
    match = _FRONTMATTER_RE.match(raw)
    if not match:
        return {}, raw
    try:
        meta = yaml.safe_load(match.group(1)) or {}
    except yaml.YAMLError:
        meta = {}
    if not isinstance(meta, dict):
        meta = {}
    body = raw[match.end():]
    return meta, body


def _display_name_from(advisor_name: str, frontmatter: dict) -> str:
    """Prefer frontmatter ``role``; fall back to titleized advisor key."""
    role = frontmatter.get("role")
    if isinstance(role, str) and role.strip():
        return role.strip()
    return advisor_name.replace("-", " ").replace("_", " ").title()


def resolve_persona_text(
    persona_path: str,
    repo_root: Path,
) -> tuple[str, dict]:
    """Read a persona file, returning ``(body, frontmatter)``.

    Condensed tree (``.agent-src/``) wins so production runs match the
    same projection the rest of the package consumes. Uncondensed tree
    (``.agent-src.uncondensed/``) is the fallback for in-repo
    development before ``task sync`` has projected the file.
    """
    candidates = [
        repo_root / ".agent-src" / persona_path,
        repo_root / ".agent-src.uncondensed" / persona_path,
    ]
    for candidate in candidates:
        if candidate.exists():
            raw = candidate.read_text(encoding="utf-8")
            meta, body = _split_frontmatter(raw)
            return body.strip(), meta
    searched = "\n  - ".join(str(c) for c in candidates)
    raise CouncilConfigError(
        f"Persona file not found for advisor (path={persona_path!r}). "
        f"Searched:\n  - {searched}"
    )


def plan_advisor_swap(
    advisors: dict[str, AdvisorConfig],
    repo_root: Path,
) -> dict[str, AdvisorPlan]:
    """Return ``{provider_name: AdvisorPlan}`` for every ENABLED advisor.

    Two enabled advisors targeting the same provider is a
    ``CouncilConfigError`` — replace-mode runs one advisor per provider
    so the call plan never doubles up by accident.
    """
    plans: dict[str, AdvisorPlan] = {}
    for adv in advisors.values():
        if not adv.enabled:
            continue
        if adv.member in plans:
            existing = plans[adv.member].name
            raise CouncilConfigError(
                f"advisors.{adv.name} and advisors.{existing} both bind "
                f"member={adv.member!r}; only one advisor per provider "
                f"per run (replace-mode invariant)."
            )
        body, meta = resolve_persona_text(adv.persona, repo_root)
        plans[adv.member] = AdvisorPlan(
            name=adv.name,
            display_name=_display_name_from(adv.name, meta),
            member=adv.member,
            persona_text=body,
            model_override=adv.model,
        )
    return plans


def build_persona_labels(
    plans: dict[str, AdvisorPlan],
    members: list,
) -> dict[str, str]:
    """Build the peer-review ``source → display_name`` map.

    ``source`` is the ``provider:model`` string the peer-review
    pipeline uses for anonymisation; ``members`` is the post-swap
    member list (model_override already applied), so the model field
    matches what the response carries.
    """
    labels: dict[str, str] = {}
    for m in members:
        plan = plans.get(m.name)
        if plan is None:
            continue
        labels[f"{m.name}:{m.model}"] = plan.display_name
    return labels
