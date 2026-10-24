---
complexity: lightweight
review_by: 2026-12-24
---

# Stub: road to command effect declarations and a deferred-delivery advisory

> **Stub — not active work.** Split off 2026-10-24 from
> `road-to-an-order-the-work-chooses` (source `agents/tmp.old/inbox-2026-10-ag/`)
> because each item here needs a reading that does not exist yet. That roadmap
> ships the invocation-plan linearizer, the composed-stage contract and a reader
> for superseded CI waits; this file holds what only that reader can justify.

## What is parked

1. **Effect frontmatter on every command** (`effects: [commit, push, pr-open,
   ci-settle, …]`) and a `lint_command_effects` sweep that fails a command whose
   body pushes, opens a PR or settles CI without the declaration.
2. **A plan record** written per composed invocation, validated deterministically
   (no intermediate push before a later write to the same branch).
3. **A pre-push advisory hook** that names the later stage writing the same ref —
   shadow first, deny only after a measured miss rate.
4. **A 14-day baseline** of superseded waits and intermediate sinks per composed
   invocation, against a bar pre-registered before reading.

## Probe

`./scripts-run src/scripts/probe_turnaround` over the 14 days after the
invocation-plan context shipped reports `ci-wait-superseded` above zero — yes or
no. Yes promotes items 1–3; no closes this stub as unneeded.
