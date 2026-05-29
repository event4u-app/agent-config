#!/usr/bin/env python3
"""Lint that every command in `hooks/hooks.json` resolves to a real
dispatcher subcommand in `scripts/_dispatch.bash`.

Phase 6 of `road-to-hooks-actually-fire-in-consumers`.

The linter checks **plugin-side completeness** — the package ships a
valid `hooks.json` whose every command line points at a subcommand
the dispatcher knows about. It does NOT check consumer-side
scaffolding (that's the runtime `dispatch-issues.jsonl` log's job
from Phase 1).

This distinction is load-bearing — see Council R3 finding #1:
"A valid plugin against an unscaffolded consumer is a PASS;
the linter must not produce a false-positive on that state."

Exit codes:
  0 — every command resolves; clean.
  1 — at least one command references an unknown subcommand.
  2 — schema / file error.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parent.parent
HOOKS_JSON = REPO_ROOT / "hooks" / "hooks.json"
DISPATCH_BASH = REPO_ROOT / "scripts" / "_dispatch.bash"


# Map agent-config-cli subcommand → dispatcher function name. The
# subcommand is what appears after `./agent-config <subcommand>` in
# the hooks.json command line; the function is what's defined in
# _dispatch.bash. The user-facing subcommand uses colons; the
# function uses underscores (e.g. `dispatch:hook` → `cmd_dispatch_hook`).
def subcommand_to_function(subcommand: str) -> str:
    # Normalise: replace `:` and `-` with `_`.
    sanitised = subcommand.replace(":", "_").replace("-", "_")
    return f"cmd_{sanitised}"


def load_hook_commands(hooks_path: Path) -> list[tuple[str, str]]:
    """Return [(event_name, command_line)] for every hook entry."""
    try:
        data = json.loads(hooks_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise SystemExit(f"lint-marketplace-install: cannot read {hooks_path}: {exc}")

    hooks = data.get("hooks") or {}
    if not isinstance(hooks, dict):
        raise SystemExit(f"lint-marketplace-install: {hooks_path} `hooks` is not an object")

    out: list[tuple[str, str]] = []
    for event, groups in hooks.items():
        if not isinstance(groups, list):
            continue
        for group in groups:
            if not isinstance(group, dict):
                continue
            for entry in group.get("hooks", []) or []:
                if not isinstance(entry, dict):
                    continue
                cmd = entry.get("command")
                if isinstance(cmd, str) and cmd.strip():
                    out.append((str(event), cmd))
    return out


# Pattern: `"$CLAUDE_PROJECT_DIR"/agent-config <subcommand> [args...]`.
# Accepts both quoted and bare CLAUDE_PROJECT_DIR.
_CMD_RE = re.compile(
    r'(?:"?\$\{?CLAUDE_PROJECT_DIR\}?"?/)?agent-config\s+([a-zA-Z0-9:_-]+)'
)


def extract_subcommand(command_line: str) -> str | None:
    """Pull the agent-config subcommand out of a hooks.json command line."""
    m = _CMD_RE.search(command_line)
    if m:
        return m.group(1)
    return None


def load_dispatcher_subcommands(dispatch_path: Path) -> set[str]:
    """Return the set of subcommand identifiers the dispatcher knows.

    Reads `cmd_<name>` function definitions from _dispatch.bash and
    converts back to subcommand form (underscores → colons / hyphens
    is ambiguous, so we keep BOTH forms in the set — `dispatch_hook`
    AND `dispatch:hook` — so the linter accepts either).
    """
    try:
        text = dispatch_path.read_text(encoding="utf-8")
    except OSError as exc:
        raise SystemExit(f"lint-marketplace-install: cannot read {dispatch_path}: {exc}")

    out: set[str] = set()
    for match in re.finditer(r"^cmd_([a-zA-Z0-9_]+)\(\)", text, flags=re.MULTILINE):
        ident = match.group(1)
        # Add the underscore form.
        out.add(ident)
        # Also add a colon-substituted variant — agent-config supports
        # `:` in user-facing subcommand names; the function strips them
        # to underscores. We accept either spelling on the hook side.
        # First _ → `:`, the rest stay (heuristic; covers `dispatch:hook`,
        # `mcp:render`, `hooks:install` etc.).
        if "_" in ident:
            head, _, tail = ident.partition("_")
            out.add(f"{head}:{tail}")
    return out


def lint(hooks_path: Path = HOOKS_JSON, dispatch_path: Path = DISPATCH_BASH) -> int:
    if not hooks_path.is_file():
        sys.stderr.write(f"lint-marketplace-install: {hooks_path} not found\n")
        return 2
    if not dispatch_path.is_file():
        sys.stderr.write(f"lint-marketplace-install: {dispatch_path} not found\n")
        return 2

    commands = load_hook_commands(hooks_path)
    known = load_dispatcher_subcommands(dispatch_path)

    issues: list[str] = []
    checked = 0
    for event, cmd in commands:
        sub = extract_subcommand(cmd)
        if sub is None:
            issues.append(
                f"  {event}: command does not reference `agent-config <subcommand>`: "
                f"{cmd!r}"
            )
            continue
        checked += 1
        if sub not in known:
            issues.append(
                f"  {event}: unknown_dispatcher_subcommand: {sub!r} "
                f"(not in scripts/_dispatch.bash)"
            )

    if issues:
        try:
            relative = hooks_path.resolve().relative_to(REPO_ROOT)
        except ValueError:
            relative = hooks_path
        sys.stderr.write(
            f"lint-marketplace-install: {len(issues)} issue(s) in {relative}:\n"
        )
        for line in issues:
            sys.stderr.write(line + "\n")
        return 1

    print(
        f"✅  lint-marketplace-install: {checked} hook command(s) checked, "
        f"all resolve to known dispatcher subcommands."
    )
    return 0


def parse_args(argv: list[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument(
        "--hooks-json",
        type=Path,
        default=HOOKS_JSON,
        help="Path to hooks/hooks.json (default: %(default)s)",
    )
    p.add_argument(
        "--dispatch-bash",
        type=Path,
        default=DISPATCH_BASH,
        help="Path to scripts/_dispatch.bash (default: %(default)s)",
    )
    return p.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv if argv is not None else sys.argv[1:])
    return lint(args.hooks_json, args.dispatch_bash)


if __name__ == "__main__":
    raise SystemExit(main())
