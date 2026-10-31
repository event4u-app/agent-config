---
complexity: lightweight
review_by: 2026-12-31
---

# Stub: a write-scope guard for bracket lines

> **Stub — not active work.** Created 2026-10-31 by
> `road-to-a-loss-that-can-be-appealed`.

A bracket line agent should write only `agents/runtime/bracket/<run>/lines/<id>.md`.
Today that is prose in `/judge bracket` § 2 — model-carried.

**Trigger.** The first recorded bracket run in which a line wrote outside its
file, or the owner asks for the guard.

**Then.** A `pre_tool_use` concern that denies Write/Edit outside the run folder
while a bracket line is active, registered in `src/scripts/hook_manifest.yaml`;
it denies on `claude` only and stays model-carried elsewhere
(`agent-config hooks:status`), which the command must then say.
