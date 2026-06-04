"""Skill preview — non-destructive "what will this skill do?" summary.

Phase 5 of `road-to-leaner-core-and-discovery`. Reads a skill's declared intent
(frontmatter + `## Steps` body) and renders a plain-language summary BEFORE the
skill runs. Read-only, no network, no execution.

NOT a sandbox: it surfaces declared intent, it does not run the skill or prove
side-effect-freeness (contract: docs/contracts/skill-dry-run.md). For
`execution: manual` skills (the default) it states "instructional only".

Usage:
    python3 scripts/skill_preview.py <name> [--technical] [--format text|json]
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
SKILLS_DIR = REPO_ROOT / ".agent-src" / "skills"

_CMD_RE = re.compile(r"`(python3?|bash|node|php|npm|task|pytest)\s+[^`]+`")
_PATH_RE = re.compile(r"`([\w./-]+\.(?:py|sh|md|json|yml|yaml|ts|js|php))`")


class PreviewError(Exception):
    """Raised for a missing or malformed SKILL.md — rendered, never crashed on."""


def _split_frontmatter(text: str) -> tuple[dict, str]:
    if not text.startswith("---"):
        raise PreviewError("SKILL.md has no YAML frontmatter (missing leading `---`).")
    end = text.find("\n---", 3)
    if end == -1:
        raise PreviewError("SKILL.md frontmatter is not closed (missing terminating `---`).")
    try:
        fm = yaml.safe_load(text[3:end]) or {}
    except yaml.YAMLError as exc:
        raise PreviewError(f"SKILL.md frontmatter is not valid YAML: {exc}")
    if not isinstance(fm, dict):
        raise PreviewError("SKILL.md frontmatter did not parse to a mapping.")
    return fm, text[end + 4:]


def _steps(body: str) -> list[str]:
    out: list[str] = []
    in_steps = False
    for line in body.splitlines():
        if re.match(r"^##\s+Steps\b", line, re.IGNORECASE):
            in_steps = True
            continue
        if in_steps and re.match(r"^##\s+\S", line):  # next top-level section
            break
        if in_steps:
            m = re.match(r"^###\s+(.*)", line)
            if m:
                out.append(m.group(1).strip())
    return out


def _targets(body: str) -> tuple[list[str], list[str]]:
    cmds = sorted({m.group(0).strip("`") for m in _CMD_RE.finditer(body)})
    paths = sorted({m.group(1) for m in _PATH_RE.finditer(body)})
    return cmds, paths


def load_preview(name: str) -> dict:
    skill_dir = SKILLS_DIR / name
    sk = skill_dir / "SKILL.md"
    if not sk.is_file():
        try:
            shown = sk.relative_to(REPO_ROOT)
        except ValueError:
            shown = sk
        raise PreviewError(f"no skill named {name!r} (looked for {shown}).")
    fm, body = _split_frontmatter(sk.read_text(encoding="utf-8", errors="replace"))
    execution = fm.get("execution") or {}
    if not isinstance(execution, dict):
        execution = {}
    cmds, paths = _targets(body)
    return {
        "name": fm.get("name") or name,
        "description": (fm.get("description") or "").strip(),
        "domain": fm.get("domain") or "",
        "execution_type": (execution.get("type") or "manual"),
        "handler": (execution.get("handler") or "none"),
        "allowed_tools": execution.get("allowed_tools") or [],
        "command": execution.get("command") or [],
        "steps": _steps(body),
        "commands_named": cmds,
        "paths_named": paths,
    }


def render_plain(p: dict) -> str:
    lines = [f"# Preview — `{p['name']}`", ""]
    if p["description"]:
        lines += [p["description"], ""]
    etype = p["execution_type"]
    if etype == "manual":
        lines.append("**Execution: instructional only.** This skill does not run anything "
                     "automatically — it guides the agent step by step.")
    elif etype == "assisted":
        lines.append(f"**Execution: assisted** (handler `{p['handler']}`). It will *propose* actions "
                     "for you to approve — it never executes silently.")
    else:
        lines.append(f"**Execution: {etype}** (handler `{p['handler']}`). It can run actions; review the "
                     "declared tools and commands below before allowing it.")
    lines.append("")
    if p["steps"]:
        lines.append("This skill will walk these steps:")
        lines += [f"- {s}" for s in p["steps"]]
        lines.append("")
    if p["allowed_tools"]:
        lines.append(f"Declared tools: {', '.join(p['allowed_tools'])}")
    if p["command"]:
        lines.append(f"Declared command: `{' '.join(str(c) for c in p['command'])}`")
    if p["commands_named"]:
        lines.append("Commands it may run:")
        lines += [f"- `{c}`" for c in p["commands_named"]]
    if p["paths_named"]:
        lines.append("Files / scripts it references:")
        lines += [f"- `{f}`" for f in p["paths_named"]]
    if not (p["allowed_tools"] or p["command"] or p["commands_named"] or p["paths_named"]):
        lines.append("_No tools, commands, or file targets declared — pure guidance._")
    lines.append("")
    lines.append("> Preview shows declared intent only — it does not run the skill or guarantee "
                 "side-effect-freeness. Contract: docs/contracts/skill-dry-run.md")
    return "\n".join(lines)


def render_technical(p: dict) -> str:
    lines = [f"# Preview (technical) — {p['name']}", "", "## Frontmatter (execution)", "```yaml"]
    lines.append(f"execution_type: {p['execution_type']}")
    lines.append(f"handler: {p['handler']}")
    lines.append(f"allowed_tools: {p['allowed_tools']}")
    if p["command"]:
        lines.append(f"command: {p['command']}")
    lines += ["```", "", "## Declared steps"]
    lines += [f"{i+1}. {s}" for i, s in enumerate(p["steps"])] or ["(none)"]
    if p["commands_named"]:
        lines += ["", "## Commands named in body"] + [f"- `{c}`" for c in p["commands_named"]]
    if p["paths_named"]:
        lines += ["", "## Paths named in body"] + [f"- `{f}`" for f in p["paths_named"]]
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Preview a skill's declared intent (read-only, no execution).")
    ap.add_argument("name", help="Skill name (directory under .agent-src/skills/).")
    ap.add_argument("--technical", action="store_true", help="Show raw frontmatter + step list.")
    ap.add_argument("--format", choices=("text", "json"), default="text")
    args = ap.parse_args(argv)

    try:
        preview = load_preview(args.name)
    except PreviewError as exc:
        if args.format == "json":
            print(json.dumps({"error": str(exc), "name": args.name}, indent=2))
        else:
            print(f"❌  Cannot preview {args.name!r}: {exc}", file=sys.stderr)
        return 2

    if args.format == "json":
        print(json.dumps(preview, indent=2))
    elif args.technical:
        print(render_technical(preview))
    else:
        print(render_plain(preview))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
