#!/usr/bin/env python3
"""One-off: inject {{.QUIET_FLAG}} into Taskfile cmds for --quiet-aware scripts."""
from __future__ import annotations
import re
from pathlib import Path

# Scripts that accept --quiet (verified: 20 total = 3 pre-existing + 17 patched).
QUIET_AWARE = {
    "check_always_budget", "check_one_off_location", "check_safety_floor_untouched",
    "check_augmentignore", "check_command_count_messaging", "check_condensed_paths",
    "check_council_layout", "check_council_references", "check_iron_law_prominence",
    "check_md_language", "check_memory_proposal", "check_public_catalog_links",
    "check_reply_consistency", "check_roadmap_trackable",
    "lint_examples", "lint_handoffs", "lint_load_context", "lint_roadmap_complexity",
    "lint_rule_interactions", "lint_rule_tiers",
}

TASKFILES = sorted(Path("taskfiles").glob("*.yml")) + [Path("Taskfile.yml")]
patched = 0
for tf in TASKFILES:
    text = tf.read_text()
    new = text
    for name in QUIET_AWARE:
        # Match: cmd: python3 scripts/<name>.py [args]
        # Insert {{.QUIET_FLAG}} after the script path, before any other args.
        pat = re.compile(rf"(python3 scripts/{name}\.py)(\s|$)(?!.*QUIET_FLAG)")
        new, n = pat.subn(r"\1 {{.QUIET_FLAG}}\2", new)
        if n:
            patched += n
    if new != text:
        tf.write_text(new)
        print(f"  patched: {tf}")
print(f"\nTotal injections: {patched}")
