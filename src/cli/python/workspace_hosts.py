#!/usr/bin/env python3
"""Host-agent tier detection — ADR-068.

The workspace shells out to a host agent per ADR-023. This module reports a
host's **effective tier** so the launcher knows whether the host is CLI-
drivable (Tier 1) or needs the inbox hand-off (Tier 3). Detection is
**deterministic and side-effect-free** — it never spawns a host CLI; it only
checks the inventory tier and whether the host's CLI is on PATH (`shutil.which`).

`HOST_INVENTORY` mirrors the source-of-truth table in
`docs/contracts/host-agent-protocol.md`; `tests/test_workspace_hosts.py`
asserts the two agree, so the human-readable contract stays canonical without
fragile runtime markdown parsing (ADR-068 H1).

Effective tier (ADR-068 H2): `1` iff the inventory tier is 1 **and** the CLI is
on PATH; otherwise `3` (the contract's fail-closed rule — a Tier-1 host whose
CLI is missing demotes to the inbox hand-off). An **unknown** host id fails
**soft** to Tier 3 with ``known: false`` (so a launcher never 500s on a host
string), while the ``detect`` CLI exits non-zero on an unknown id (so tooling /
tests catch typos — ADR-068 § unknown-host).

NOTE — what this does NOT do: it does not execute a Tier-1 drive (the
`claude -p` turn loop is unbuilt) and it does not claim one. v1 debt (ADR-068):
a `--version` probe (vs PATH-only), a generated inventory manifest, and
detection circuit-breaker metrics.

CLI::

    workspace_hosts.py detect <host-id> [--json]
    workspace_hosts.py list [--json]
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys

# Mirrors docs/contracts/host-agent-protocol.md § Today's inventory. `cli` is
# the PATH binary that proves the Tier-1 surface is reachable; Tier-3 hosts
# have no drivable CLI (None).
HOST_INVENTORY: dict[str, dict] = {
    "claude-code": {"tier": 1, "cli": "claude"},
    "codex": {"tier": 1, "cli": "codex"},
    "gemini": {"tier": 1, "cli": "gemini"},
    "augment": {"tier": 3, "cli": None},
    "cursor": {"tier": 3, "cli": None},
    "cline": {"tier": 3, "cli": None},
    "windsurf": {"tier": 3, "cli": None},
}


def detect(host_id: str, *, which=shutil.which) -> dict:
    """Resolve a host id → effective-tier classification.

    Never raises. Unknown id → fail-soft to Tier 3 with ``known: False``.
    ``which`` is injectable for tests.
    """
    entry = HOST_INVENTORY.get(host_id)
    if entry is None:
        return {
            "host": host_id, "known": False, "inventory_tier": None,
            "cli": None, "cli_present": False, "effective_tier": 3,
            "mode": "handoff",
        }
    cli = entry["cli"]
    cli_present = bool(cli) and which(cli) is not None
    effective = 1 if (entry["tier"] == 1 and cli_present) else 3
    # Honest mode: Tier-1-with-CLI would be drivable, but the drive loop is
    # unbuilt — so report 'tier1-drive-pending', never a fake 'driven'. Tier-3
    # (or demoted) → 'handoff' (the inbox path).
    if effective == 1:
        mode = "tier1-drive-pending"
    else:
        mode = "handoff"
    return {
        "host": host_id, "known": True, "inventory_tier": entry["tier"],
        "cli": cli, "cli_present": cli_present, "effective_tier": effective,
        "mode": mode,
    }


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="workspace_hosts")
    sub = p.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("detect")
    s.add_argument("host_id")
    s.add_argument("--json", action="store_true")
    sl = sub.add_parser("list")
    sl.add_argument("--json", action="store_true")
    args = p.parse_args(argv)
    if args.cmd == "detect":
        result = detect(args.host_id)
        print(json.dumps(result, sort_keys=True))
        # Fail-loud for tooling/tests: an unknown host id is almost always a
        # typo or a missing inventory row. The detect() function stays
        # fail-soft for in-process launcher callers.
        return 0 if result["known"] else 1
    if args.cmd == "list":
        rows = [detect(h) for h in sorted(HOST_INVENTORY)]
        print(json.dumps(rows, sort_keys=True) if args.json
              else "\n".join(f"{r['host']}\ttier{r['inventory_tier']}\t"
                             f"{'cli' if r['cli_present'] else 'no-cli'}" for r in rows))
        return 0
    return 2


if __name__ == "__main__":
    sys.exit(main())
