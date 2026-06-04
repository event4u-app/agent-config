#!/usr/bin/env python3
"""One-off (Phase 10.3) — add `silent: true` to safe Taskfile tasks.

Inserts a `    silent: true` line directly after each `  <taskname>:` opener,
unless the task is in CARVE_OUTS or the line already exists.

Carve-outs stay loud:
  - install / install-hooks / first-run / install-anthropic-key /
    install-openai-key / setup-evals / test-triggers-live
  - runtime-e2e (per roadmap explicit list)
  - all release* tasks (release.yml — file-level skip)
  - _ci-start / _ci-end / ci (root Taskfile orchestration)

Idempotent — running twice is a no-op.

Lifecycle: archive after Phase 10.3 lands per one-off-script-lifecycle.md.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent

CARVE_OUTS = {
    "install",
    "install-hooks",
    "first-run",
    "install-anthropic-key",
    "install-openai-key",
    "setup-evals",
    "test-triggers-live",
    "runtime-e2e",
}

# Regex matches a top-level task opener: 2 spaces + name + colon + EOL.
TASK_OPENER_RE = re.compile(r"^  ([a-z_][a-z0-9_:.-]*):$")


def patch_file(path: Path, skip_all: bool = False) -> tuple[int, int]:
    """Insert `    silent: true` after each safe task opener.

    Returns (added, skipped).
    """
    if skip_all:
        return (0, 0)

    text = path.read_text()
    lines = text.splitlines(keepends=False)
    out: list[str] = []
    added = 0
    skipped = 0
    i = 0
    while i < len(lines):
        line = lines[i]
        out.append(line)
        m = TASK_OPENER_RE.match(line)
        if m:
            name = m.group(1)
            # Look ahead one line — already silent?
            next_line = lines[i + 1] if i + 1 < len(lines) else ""
            already = next_line.strip() == "silent: true"
            if name in CARVE_OUTS:
                skipped += 1
            elif already:
                pass  # idempotent
            else:
                out.append("    silent: true")
                added += 1
        i += 1
    new_text = "\n".join(out) + ("\n" if text.endswith("\n") else "")
    if new_text != text:
        path.write_text(new_text)
    return (added, skipped)


def main() -> int:
    targets = [
        (ROOT / "taskfiles" / "content.yml", False),
        (ROOT / "taskfiles" / "ci-fast.yml", False),
        (ROOT / "taskfiles" / "engine.yml", False),
        (ROOT / "taskfiles" / "release.yml", True),  # all release* loud
    ]
    total_added = 0
    total_skipped = 0
    for path, skip_all in targets:
        added, skipped = patch_file(path, skip_all=skip_all)
        rel = path.relative_to(ROOT)
        print(f"  {rel}: +{added} silent · {skipped} carved-out")
        total_added += added
        total_skipped += skipped
    print(f"\n  total: +{total_added} silent · {total_skipped} carved-out")
    return 0


if __name__ == "__main__":
    sys.exit(main())
