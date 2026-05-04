#!/usr/bin/env python3
"""One-shot helper: add `superseded_by:` + `deprecated_in:` + warning
banner to Phase 2 atomic-command shims.

Idempotent — if a file already has `superseded_by:` set, it is skipped.
"""
from __future__ import annotations
import sys
from pathlib import Path

# (file-stem, "<cluster> <sub>")  — "<cluster> --flag" for flag-based
PHASE2_SHIMS: list[tuple[str, str]] = [
    # chat-history cluster
    ("chat-history-resume",     "chat-history resume"),
    ("chat-history-clear",      "chat-history clear"),
    ("chat-history-checkpoint", "chat-history checkpoint"),
    # agents cluster
    ("agents-audit",   "agents audit"),
    ("agents-cleanup", "agents cleanup"),
    ("agents-prepare", "agents prepare"),
    # memory cluster
    ("memory-add",     "memory add"),
    ("memory-full",    "memory load"),
    ("memory-promote", "memory promote"),
    ("propose-memory", "memory propose"),
    # roadmap cluster
    ("roadmap-create",  "roadmap create"),
    ("roadmap-execute", "roadmap execute"),
    # module cluster
    ("module-create",  "module create"),
    ("module-explore", "module explore"),
    # tests cluster
    ("tests-create",  "tests create"),
    ("tests-execute", "tests execute"),
    # context cluster
    ("context-create",   "context create"),
    ("context-refactor", "context refactor"),
    # override cluster
    ("override-create", "override create"),
    ("override-manage", "override manage"),
    # copilot-agents cluster
    ("copilot-agents-init",     "copilot-agents init"),
    ("copilot-agents-optimize", "copilot-agents optimize"),
    # judge cluster (do-and-judge / do-in-steps now sub-commands)
    ("do-and-judge", "judge on-diff"),
    ("do-in-steps",  "judge steps"),
    # commit / create-pr — flag-based clusters
    ("commit-in-chunks",     "commit --in-chunks"),
    ("create-pr-description", "create-pr --description-only"),
]

DEPRECATED_IN = "1.17.0"
COMMANDS_DIR = Path(".agent-src.uncompressed/commands")


def patch_file(stem: str, target: str) -> str:
    path = COMMANDS_DIR / f"{stem}.md"
    if not path.exists():
        return f"SKIP {stem}: not found"
    text = path.read_text(encoding="utf-8")
    if "superseded_by:" in text.split("---", 2)[1] if text.startswith("---") else False:
        return f"SKIP {stem}: already shimmed"

    if not text.startswith("---\n"):
        return f"SKIP {stem}: no frontmatter"
    end = text.find("\n---\n", 4)
    if end == -1:
        return f"SKIP {stem}: malformed frontmatter"
    fm_block = text[4:end]
    body = text[end + len("\n---\n"):]

    if "superseded_by:" in fm_block:
        return f"SKIP {stem}: already shimmed"

    new_fm_lines = fm_block.rstrip("\n").splitlines()
    new_fm_lines.append(f"superseded_by: {target}")
    new_fm_lines.append(f'deprecated_in: "{DEPRECATED_IN}"')
    new_fm = "\n".join(new_fm_lines)

    is_flag = target.startswith(("commit ", "create-pr "))
    if is_flag:
        cluster_invocation = f"/{target}"
    else:
        cluster_invocation = f"/{target}"
    banner = (
        f"> ⚠️  /{stem} is deprecated; use {cluster_invocation} instead.\n"
        f"> This shim is retained for one release cycle "
        f"({DEPRECATED_IN} → next minor) and forwards to the same "
        f"instructions below. See "
        f"[`docs/contracts/command-clusters.md`]"
        f"(../../docs/contracts/command-clusters.md).\n\n"
    )

    new_text = f"---\n{new_fm}\n---\n\n{banner}{body.lstrip(chr(10))}"
    path.write_text(new_text, encoding="utf-8")
    return f"OK   {stem} → {target}"


def main() -> int:
    results = []
    for stem, target in PHASE2_SHIMS:
        results.append(patch_file(stem, target))
    for r in results:
        print(r)
    return 0


if __name__ == "__main__":
    sys.exit(main())
