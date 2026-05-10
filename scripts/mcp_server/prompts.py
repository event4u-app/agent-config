"""Prompt loader — reads `.agent-src/skills/<name>/SKILL.md`.

Phase 1 (A4): exposes 5 hand-picked, stack-agnostic skills as MCP
prompts. The frontmatter `name` + `description` map to MCP prompt
metadata; the body (frontmatter stripped) is the prompt content.

Project-overrides resolution: `.agent-src/skills/<name>/SKILL.md` wins
when both package and project copies exist. Frontmatter `source:`
is forwarded verbatim into the MCP `_meta` field for clients that
inspect it.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

# Phase 1 hand-picked skills — stack-agnostic per roadmap A4. The
# roadmap originally listed `verify-before-complete`, which lives as
# a rule, not a skill; its skill counterpart is
# `verify-completion-evidence` (same evidence-gate obligation).
PHASE_1_SKILLS: tuple[str, ...] = (
    "verify-completion-evidence",
    "systematic-debugging",
    "test-driven-development",
    "refine-ticket",
    "conventional-commits-writing",
)


@dataclass(frozen=True)
class SkillPrompt:
    """Resolved SKILL.md ready for MCP exposure."""

    name: str
    description: str
    body: str
    source: str


def _project_root() -> Path:
    """Walk up from this file to the repo root (parent of `scripts/`)."""
    return Path(__file__).resolve().parent.parent.parent


def _strip_frontmatter(text: str) -> tuple[dict[str, str], str]:
    """Split a Markdown file with `---` frontmatter into (meta, body).

    Tiny YAML-ish parser sufficient for our flat key/value frontmatter.
    Avoids a `pyyaml` dependency for Phase 1; the frontmatter shape is
    enforced by `task lint-skills` upstream.
    """
    if not text.startswith("---\n"):
        return {}, text
    try:
        _, fm, body = text.split("---\n", 2)
    except ValueError:
        return {}, text
    meta: dict[str, str] = {}
    for line in fm.splitlines():
        if not line.strip() or line.startswith("#"):
            continue
        if ":" not in line:
            continue
        key, _, value = line.partition(":")
        meta[key.strip()] = value.strip().strip('"').strip("'")
    return meta, body.lstrip("\n")


def load_skill(name: str, root: Path | None = None) -> SkillPrompt:
    """Load a single skill by name. Raises FileNotFoundError if missing."""
    base = root or _project_root()
    path = base / ".agent-src" / "skills" / name / "SKILL.md"
    if not path.exists():
        raise FileNotFoundError(f"SKILL.md not found: {path}")
    text = path.read_text(encoding="utf-8")
    meta, body = _strip_frontmatter(text)
    return SkillPrompt(
        name=meta.get("name", name),
        description=meta.get("description", "").strip(),
        body=body.rstrip() + "\n",
        source=meta.get("source", "package"),
    )


def load_phase_1_prompts(root: Path | None = None) -> list[SkillPrompt]:
    """Load every skill listed in PHASE_1_SKILLS.

    Skips and logs any skill whose SKILL.md is missing — the server
    still boots so `prompts/list` returns the survivors. Phase 1 ships
    with all five present (verified via tests/test_mcp_server.py).
    """
    prompts: list[SkillPrompt] = []
    errors: list[str] = []
    for name in PHASE_1_SKILLS:
        try:
            prompts.append(load_skill(name, root=root))
        except FileNotFoundError as exc:
            errors.append(str(exc))
    if errors and not prompts:
        raise RuntimeError(
            "No Phase 1 skills loaded. Errors:\n  - "
            + "\n  - ".join(errors)
        )
    return prompts


def to_mcp_prompt_meta(prompt: SkillPrompt) -> dict[str, Any]:
    """Project a SkillPrompt into MCP `Prompt` constructor kwargs."""
    return {
        "name": f"skill.{prompt.name}",
        "title": prompt.name,
        "description": prompt.description,
        "arguments": [],
        "_meta": {"source": prompt.source},
    }
