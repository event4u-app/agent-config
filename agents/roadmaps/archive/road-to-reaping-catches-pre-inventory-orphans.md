---
complexity: lightweight
status: completed
---

# Roadmap: Reaping catches pre-inventory tagged orphans

> Goal: make global-deploy stale-reaping **self-healing** — a
> package-tagged `.md` orphan must be deleted on the next global deploy
> regardless of inventory history, not only on the one first-run window
> when the tool is absent from `deployed-files.json`.
>
> Shipped together with the implementation in this PR; archived complete.

## Context — the bug

`install.py` (call site `src/scripts/install.py`) picked **one** reaping
path per tool, mutually exclusively:

```python
if tool_id in inventory.get("tools", {}):
    reaped = inv_mod.reap_stale(...)          # diff vs PREVIOUS inventory only
else:
    reaped = inv_mod.bootstrap_reap_tagged(...)  # tag-based, FIRST-run only
```

Consequence: once a tool is recorded in the inventory, the tag-based
sweep never runs again, and `reap_stale` only deletes files that were in
the *prior* inventory. A package-tagged file deployed by a
**pre-inventory** installer version — never recorded in any inventory and
surviving the single bootstrap window — rots forever.

Observed 2026-06-13 on a v6.0.0 global install (3 tagged orphans the
6.0.0 upgrade left under `~/.claude/`):

- `commands/create-pr.md` (v6 rename → `pr/create`)
- `commands/create-pr/description-only.md` (→ `pr/create/description-only`)
- `rules/augment-source-of-truth.md` (v6 rename → `source-of-truth`, PR #427)

Each carries the `package:` tag, sits under a deploy dest-sub, and is
absent from the current bundle — provably ours and provably stale — yet
both reaping paths skipped them. Affects every consumer who upgraded
from a pre-inventory version.

## Fix shape

The tag-based sweep is the only path with ownership proof independent of
inventory history (the injected `package:` tag). Run it on **every**
deploy, in addition to `reap_stale`, and union the deletions. Untagged
user files stay untouched. Idempotent: after the first always-run pass
the orphans are gone, so subsequent deploys find nothing.

## Phase 1 — always-run the tag sweep

- [x] In `src/scripts/install.py`, replace the exclusive `if/else` with:
  run `reap_stale` when the tool has an inventory entry, **and
  unconditionally** run the tag sweep; union + dedup the two deleted-path
  lists.
- [x] Inline comment at the call site stating the tag sweep is no longer
  first-run-only and documenting the unlink-before-rglob ordering so it is
  not "optimised" back.
- [x] Confirmed no double-delete hazard: `reap_stale` unlinks first, the
  tag sweep's `rglob` cannot re-find an already-deleted path.

## Phase 2 — rename for honesty

- [x] Renamed `bootstrap_reap_tagged` → `reap_tagged_orphans` in
  `src/scripts/_lib/global_deploy_inventory.py`; docstring rewritten
  (drops "first-run" framing, states it runs every deploy).
- [x] Updated the call site in `src/scripts/install.py` and all references
  in `tests/test_global_deploy_inventory.py`.
- [x] `grep -rn bootstrap_reap_tagged src/ tests/` → zero stale references.

## Phase 3 — regression test

- [x] Added `test_deploy_reaps_tagged_orphan_absent_from_recorded_inventory`
  reproducing the miss (tool with an inventory entry whose `files` omits a
  tagged on-disk orphan → must be reaped; untagged sibling survives).
  Verified RED under restored old behaviour, GREEN with the fix.
- [x] Added `test_reap_tagged_orphans_is_idempotent` (second pass deletes
  nothing, raises nothing).
- [x] `python3 -m pytest tests/test_global_deploy_inventory.py -q` → green.

## Phase 4 — surfacing

- [x] `agent-config doctor`: added read-only `stale-orphans` check
  (`src/scripts/_cli/cmd_doctor.py`) scanning recorded anchors for
  `package:`-tagged `.md` files absent from the inventory; reports the
  count + remedy, deletes nothing. Registered in `CHECK_IDS` +
  `GLOBAL_CHECK_IDS` + both runner dicts.
- [x] Added `stale-orphans` doctor tests (no-inventory → ok, tagged orphan
  → warn, clean → ok). `pytest tests/test_cmd_doctor.py` → green.

## Acceptance criteria

- [x] Tag-based reaping runs on every global deploy; a pre-inventory
  tagged orphan is deleted on the next `agent-config global` without
  manual intervention.
- [x] Union/dedup of `reap_stale` + tag sweep — no double-delete, no
  untagged user file touched.
- [x] Regression + idempotency tests pass.
- [x] `doctor` surfaces residual tagged orphans without deleting them.

## Out of scope

- Marketplace-plugin drift (`~/.claude/plugins/…`) — a separate channel
  npm/install.py does not own; `doctor` already surfaces binary↔plugin
  version drift.
- `event4u/agent-memory` pinning `@event4u/agent-config@1.11.0` via
  `github:…#main` — separate dependency-hygiene issue.
