#!/usr/bin/env python3
"""P4.3 — Surgical compression of 22 compress-and-keep auto-rules.

Writes new bodies for the largest rules (Iron Laws preserved verbatim,
extended rationale relocated to contexts/communication/rules-auto/).
Adds `triggers:` to all 22 so the router has a manifest entry per rule.
Idempotent — re-running rewrites the same content.
"""
from __future__ import annotations

import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
RULES = ROOT / ".agent-src.uncompressed" / "rules"
CTXDIR = ROOT / ".agent-src.uncompressed" / "contexts" / "communication" / "rules-auto"

# Triggers per rule (keyword / phrase / file_pattern / path_prefix / intent / command)
TRIGGERS: dict[str, list[dict]] = {
    "architecture":              [{"keyword": "controller"}, {"keyword": "service"}, {"keyword": "module"}, {"intent": "structural decision"}],
    "artifact-drafting-protocol": [{"intent": "create new skill"}, {"intent": "create new rule"}, {"intent": "create new command"}, {"intent": "create new guideline"}],
    "augment-source-of-truth":   [{"path_prefix": ".agent-src/"}, {"path_prefix": ".augment/"}, {"path_prefix": ".claude/"}, {"path_prefix": ".cursor/"}],
    "autonomous-execution":      [{"intent": "trivial workflow question"}, {"intent": "autonomy mode"}, {"keyword": "personal.autonomy"}],
    "context-hygiene":           [{"intent": "long conversation"}, {"intent": "tool loop"}, {"intent": "fresh chat"}, {"keyword": "3-failure"}],
    "downstream-changes":        [{"intent": "after code edit"}, {"keyword": "callers"}, {"keyword": "imports"}, {"keyword": "downstream"}],
    "guidelines":                [{"intent": "writing code"}, {"intent": "reviewing code"}, {"keyword": "convention"}],
    "improve-before-implement":  [{"intent": "implement feature"}, {"intent": "architectural change"}, {"keyword": "refactor"}],
    "markdown-safe-codeblocks":  [{"intent": "markdown with code blocks"}, {"keyword": "triple backticks"}, {"file_pattern": "*.md"}],
    "minimal-safe-diff":         [{"intent": "writing a diff"}, {"intent": "reviewing a diff"}, {"keyword": "drive-by"}],
    "missing-tool-handling":     [{"keyword": "command not found"}, {"keyword": "not installed"}, {"intent": "install tool"}],
    "no-attribution-footers":    [{"intent": "PR body"}, {"intent": "commit message"}, {"intent": "Jira comment"}, {"keyword": "co-authored"}],
    "no-roadmap-references":     [{"path_prefix": "agents/roadmaps/"}, {"intent": "link from stable artifact"}],
    "preservation-guard":        [{"intent": "merge skill"}, {"intent": "compress rule"}, {"intent": "refactor artifact"}, {"keyword": "Iron Law"}],
    "role-mode-adherence":       [{"keyword": "active_role"}, {"keyword": "role-mode"}, {"intent": "mode marker"}],
    "runtime-safety":            [{"keyword": "execution"}, {"keyword": "automated"}, {"keyword": "assisted"}, {"keyword": "handler"}],
    "security-sensitive-stop":   [{"keyword": "auth"}, {"keyword": "billing"}, {"keyword": "tenant"}, {"keyword": "secret"}, {"keyword": "webhook"}],
    "size-enforcement":          [{"intent": "create rule"}, {"intent": "create skill"}, {"intent": "create command"}, {"intent": "create guideline"}],
    "think-before-action":       [{"intent": "before coding"}, {"intent": "before debugging"}, {"intent": "before modifying"}],
    "token-efficiency":          [{"intent": "verbose CLI output"}, {"intent": "fetching logs"}, {"keyword": "minimize tool calls"}],
    "tool-safety":                [{"keyword": "allowed_tools"}, {"keyword": "tool registry"}, {"intent": "external API"}],
    "user-interaction":          [{"intent": "ask user a question"}, {"intent": "numbered options"}, {"intent": "summarizing progress"}],
}


def _read(p: pathlib.Path) -> str:
    return p.read_text(encoding="utf-8")


def _split_frontmatter(text: str) -> tuple[str, str]:
    """Return (frontmatter_inner, body) — assumes leading ---\\n…---\\n\\n."""
    m = re.match(r"^---\n(.*?)\n---\n*", text, re.DOTALL)
    if not m:
        raise ValueError("no frontmatter")
    return m.group(1), text[m.end():]


def _format_triggers(items: list[dict]) -> str:
    out = ["triggers:"]
    for it in items:
        ((k, v),) = it.items()
        out.append(f'  - {k}: "{v}"')
    return "\n".join(out)


def _strip_old_triggers(fm: str) -> str:
    """Remove an existing triggers: block (with its inline children)."""
    lines = fm.splitlines()
    out: list[str] = []
    i = 0
    while i < len(lines):
        if lines[i].rstrip() == "triggers:":
            i += 1
            while i < len(lines) and lines[i].startswith(("  ", "\t")):
                i += 1
            continue
        out.append(lines[i])
        i += 1
    return "\n".join(out)


def patch_triggers_only(rule_id: str) -> bool:
    """Inject triggers: into rule frontmatter without touching the body."""
    p = RULES / f"{rule_id}.md"
    if not p.exists():
        print(f"  ✗ missing: {rule_id}", file=sys.stderr)
        return False
    text = _read(p)
    fm, body = _split_frontmatter(text)
    fm = _strip_old_triggers(fm).rstrip()
    triggers = TRIGGERS.get(rule_id)
    if triggers:
        fm = fm + "\n" + _format_triggers(triggers)
    p.write_text(f"---\n{fm}\n---\n\n{body.lstrip()}", encoding="utf-8")
    return True


def write_rule(rule_id: str, fm_extra: str, body: str) -> None:
    """Overwrite a rule with given body + standard frontmatter additions."""
    p = RULES / f"{rule_id}.md"
    text = _read(p)
    fm, _ = _split_frontmatter(text)
    fm_clean = _strip_old_triggers(fm).rstrip()
    triggers = TRIGGERS.get(rule_id)
    parts = [fm_clean]
    if fm_extra:
        parts.append(fm_extra.rstrip())
    if triggers:
        parts.append(_format_triggers(triggers))
    full_fm = "\n".join(parts)
    p.write_text(f"---\n{full_fm}\n---\n\n{body.lstrip()}\n", encoding="utf-8")


if __name__ == "__main__":
    # Imported by _p43_bodies.py — when run directly, only stamp triggers.
    for rid in TRIGGERS:
        patch_triggers_only(rid)
    print("✓ triggers stamped on all 22 compress-and-keep rules")
