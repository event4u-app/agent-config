#!/usr/bin/env python3
"""PreToolUse guard: block git --no-verify and hook-bypass patterns.

Intercepts the agent's Bash tool calls BEFORE git runs so that
`git --no-verify` / `git -n` / `git -c core.hooksPath=` cannot silently
bypass the pre-commit and pre-push hooks that enforce code quality gates.

Exit codes (per docs/contracts/hook-architecture-v1.md):
  0 — allow (command is safe)
  1 — block (command would bypass hooks; agent is told to stop)
  2 — warn  (not used by this guard)

No ALLOW_NO_VERIFY-style env bypass is provided. See src/rules/git-history-discipline.md
"""
from __future__ import annotations

import argparse
import json
import re
import shlex
import sys

_SHELL_SEPARATORS = {"&&", "||", ";", "|"}
_NO_VERIFY_FLAGS = {"--no-verify"}
_NO_VERIFY_SHORT = {"-n"}
_HOOKS_PATH_RE = re.compile(r"^core\.hooksPath\s*=", re.IGNORECASE)


def _is_env_assignment(token: str) -> bool:
    return bool(re.match(r"^[A-Za-z_][A-Za-z0-9_]*=", token))


def _split_subcommands(tokens: list[str]) -> list[list[str]]:
    groups: list[list[str]] = []
    current: list[str] = []
    for tok in tokens:
        if tok in _SHELL_SEPARATORS:
            if current:
                groups.append(current)
            current = []
        else:
            current.append(tok)
    if current:
        groups.append(current)
    return groups


def _git_base(tokens: list[str]) -> list[str] | None:
    i = 0
    while i < len(tokens) and _is_env_assignment(tokens[i]):
        i += 1
    if i < len(tokens) and tokens[i] == "git":
        return tokens[i:]
    return None


def _is_blocked(git_tokens: list[str]) -> tuple[bool, str]:
    i = 1  # skip 'git'
    while i < len(git_tokens):
        tok = git_tokens[i]
        if tok in _NO_VERIFY_FLAGS:
            return True, f"'{tok}' bypasses git hooks (git-history-discipline)"
        if tok in _NO_VERIFY_SHORT:
            return True, f"'{tok}' is short for --no-verify and bypasses git hooks (git-history-discipline)"
        # Short flag bundles containing 'n': -nm, -mn, etc.
        if re.match(r"^-[a-zA-Z]*n[a-zA-Z]*$", tok) and not tok.startswith("--"):
            return True, f"'{tok}' contains -n (--no-verify) and bypasses git hooks (git-history-discipline)"
        if tok == "-c":
            if i + 1 < len(git_tokens):
                val = git_tokens[i + 1]
                if _HOOKS_PATH_RE.match(val):
                    return True, f"'-c {val}' disables git hooks via hooksPath (git-history-discipline)"
                i += 1
        elif tok.startswith("-c="):
            val = tok[3:]
            if _HOOKS_PATH_RE.match(val):
                return True, f"'{tok}' disables git hooks via hooksPath (git-history-discipline)"
        elif tok == "--config":
            if i + 1 < len(git_tokens):
                val = git_tokens[i + 1]
                if _HOOKS_PATH_RE.match(val):
                    return True, f"'--config {val}' disables git hooks via hooksPath (git-history-discipline)"
                i += 1
        i += 1
    return False, ""


def _check_command(cmd: str) -> tuple[bool, str]:
    """Return (blocked, reason). Fail-closed on parse error for git commands."""
    try:
        tokens = shlex.split(cmd)
    except ValueError:
        if re.search(r"\bgit\b", cmd):
            return True, "command parse failed (shlex) on a git-containing command — fail-closed (git-history-discipline)"
        return False, ""

    for sub in _split_subcommands(tokens):
        git_tokens = _git_base(sub)
        if git_tokens is None:
            continue
        blocked, reason = _is_blocked(git_tokens)
        if blocked:
            return True, reason
    return False, ""


def _extract_command(envelope: dict) -> str | None:
    payload = envelope.get("payload") or {}
    tool_input = payload.get("tool_input") or {}
    cmd = tool_input.get("command")
    if isinstance(cmd, str):
        return cmd
    cmd = payload.get("command")
    if isinstance(cmd, str):
        return cmd
    return None


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--command", default="", help="Command string to check (overrides stdin envelope)")
    ap.add_argument("--platform", default="", help="Platform name (supplied by dispatch_hook.py)")
    args = ap.parse_args(argv)

    if args.command:
        cmd = args.command
    else:
        raw = sys.stdin.read() if not sys.stdin.isatty() else ""
        if raw.strip():
            try:
                envelope = json.loads(raw)
            except (ValueError, TypeError):
                envelope = {}
        else:
            envelope = {}
        cmd = _extract_command(envelope) or ""

    if not cmd:
        return 0

    blocked, reason = _check_command(cmd)
    if blocked:
        sys.stderr.write(
            f"block-no-verify: BLOCKED — {reason}\n"
            f"  Legitimate bypass requires a human action outside the agent session:\n"
            f"  disable or remove the 'block-no-verify' entry in src/scripts/hook_manifest.yaml.\n"
            f"  Rule: src/rules/git-history-discipline.md\n"
        )
        return 1  # EXIT_BLOCK

    return 0  # EXIT_ALLOW


if __name__ == "__main__":
    raise SystemExit(main())
