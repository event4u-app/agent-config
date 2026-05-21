#!/usr/bin/env python3
"""check_kernel_rule_bundle — Phase 4.2 of road-to-always-budget-relief.

Fails when a single PR (or commit range) modifies more than one
kernel rule under `.agent-src.uncompressed/rules/`. Override via the
PR label `bundled-always-rules-acknowledged`.

Kernel set is the locked 9-rule list in
`docs/contracts/rule-classification.md` § 3.1, mirrored as
`KERNEL_RULES` below. The list is short and stable; on kernel-set
change, update both files in the same PR.

Inputs:
  --base-ref REF   git ref to diff against (default: origin/main, then main)
  --label NAME     PR label that overrides the gate (default:
                   bundled-always-rules-acknowledged)
  --event-path P   GitHub event JSON (defaults to $GITHUB_EVENT_PATH)
  --files F [F …]  override changed-file list (testing only)

Exit codes: 0 = pass · 1 = fail (> 1 kernel rule, no override) ·
3 = internal error.

Source: `agents/settings/contexts/adr-always-budget-relief-strategy.md`.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

KERNEL_RULES = frozenset({
    "agent-authority.md",
    "ask-when-uncertain.md",
    "commit-policy.md",
    "direct-answers.md",
    "language-and-tone.md",
    "no-cheap-questions.md",
    "non-destructive-by-default.md",
    "scope-control.md",
    "verify-before-complete.md",
})

KERNEL_DIR = ".agent-src.uncompressed/rules"
DEFAULT_LABEL = "bundled-always-rules-acknowledged"


def _git_changed_files(base_ref: str) -> list[str]:
    try:
        out = subprocess.check_output(
            ["git", "diff", "--name-only", f"{base_ref}...HEAD"],
            stderr=subprocess.STDOUT,
            text=True,
        )
    except subprocess.CalledProcessError as exc:
        print(f"❌  git diff failed: {exc.output.strip()}", file=sys.stderr)
        return []
    return [line for line in out.splitlines() if line.strip()]


def _resolve_base_ref(explicit: str | None) -> str:
    if explicit:
        return explicit
    for candidate in ("origin/main", "origin/master", "main", "master"):
        try:
            subprocess.check_output(
                ["git", "rev-parse", "--verify", candidate],
                stderr=subprocess.DEVNULL,
            )
            return candidate
        except subprocess.CalledProcessError:
            continue
    return "HEAD~1"


def _pr_labels(event_path: str | None) -> list[str]:
    path = event_path or os.environ.get("GITHUB_EVENT_PATH")
    if not path or not Path(path).exists():
        return []
    try:
        data = json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []
    pr = data.get("pull_request") or {}
    return [lbl.get("name", "") for lbl in pr.get("labels", []) if lbl.get("name")]


def _kernel_changes(files: list[str]) -> list[str]:
    hits: list[str] = []
    for path in files:
        if not path.startswith(f"{KERNEL_DIR}/"):
            continue
        name = Path(path).name
        if name in KERNEL_RULES:
            hits.append(path)
    return sorted(set(hits))


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    ap.add_argument("--base-ref", default=None)
    ap.add_argument("--label", default=DEFAULT_LABEL)
    ap.add_argument("--event-path", default=None)
    ap.add_argument("--files", nargs="*", default=None)
    args = ap.parse_args(argv)

    files = args.files or _git_changed_files(_resolve_base_ref(args.base_ref))
    hits = _kernel_changes(files)

    if len(hits) <= 1:
        if hits:
            print(f"✅  OK  kernel-rule bundle: 1 rule touched ({hits[0]})")
        else:
            print("✅  OK  kernel-rule bundle: no kernel rule touched")
        return 0

    labels = _pr_labels(args.event_path)
    if args.label in labels:
        print(
            f"✅  OK  kernel-rule bundle: {len(hits)} rules touched but "
            f"label '{args.label}' present"
        )
        for h in hits:
            print(f"   · {h}")
        return 0

    print(
        f"❌  FAIL  kernel-rule bundle: {len(hits)} kernel rules touched in "
        f"one PR — slow-rollout requires one-rule-per-PR.",
        file=sys.stderr,
    )
    print("   Touched:", file=sys.stderr)
    for h in hits:
        print(f"   · {h}", file=sys.stderr)
    print(
        f"   Override: add the label '{args.label}' on the PR and "
        f"document the bundle rationale in the PR body.",
        file=sys.stderr,
    )
    print(
        "   Source: agents/settings/contexts/adr-always-budget-relief-strategy.md "
        "(Phase 4.2).",
        file=sys.stderr,
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())
