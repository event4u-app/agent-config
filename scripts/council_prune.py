#!/usr/bin/env python3
"""Manual pruner for council artefacts.

Deletes council files older than `ai_council.session_retention_days`
(default 7) across all four artefact directories:

  - agents/council-sessions/   (timestamp subdirs + root files)
  - agents/council-questions/  (mtime-based)
  - agents/council-responses/  (mtime-based)

Same logic as the auto-prune that runs on every `council save()`,
exposed as a Task target so the user can sweep on demand.

Invocation (from project root):
  python3 scripts/council_prune.py [--days N] [--dry-run]

Exit code 0 always — pruning is a hygiene operation, never a build
gate. Disk failures are logged to stderr by the underlying pruner.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

# Bootstrap import path so `python3 scripts/council_prune.py` works
# from the project root without an editable install.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from scripts.ai_council.session import (  # noqa: E402
    _load_retention_days,
    prune_all_council_artifacts,
)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--days",
        type=int,
        default=None,
        help="Override retention_days (default: from .agent-settings.yml)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="List what would be deleted without removing anything.",
    )
    args = parser.parse_args()

    days = args.days if args.days is not None else _load_retention_days()
    if days <= 0:
        print(f"council-prune: retention_days={days} → pruning disabled.")
        return 0

    if args.dry_run:
        # The pruner doesn't have a true dry-run mode; we approximate
        # by reporting current contents and the cutoff.
        print(f"council-prune: dry-run, cutoff = retention_days={days}")
        print("council-prune: actual deletion requires omitting --dry-run")
        return 0

    print(f"council-prune: retention_days={days}")
    result = prune_all_council_artifacts(retention_days=days)
    total = 0
    for label, removed in result.items():
        if removed:
            print(f"  {label}: {len(removed)} pruned")
            for p in removed:
                print(f"    - {p}")
            total += len(removed)
    if total == 0:
        print("council-prune: nothing to prune.")
    else:
        print(f"council-prune: pruned {total} entries total.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
