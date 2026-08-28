---
stability: superseded
superseded_by: resident-process-governance.md
---

# No-Runtime Boundary Contract — SUPERSEDED

> **This contract is superseded.** Read
> [`resident-process-governance.md`](resident-process-governance.md) instead.
>
> Superseded 2026-08-27 by
> **[ADR-249](../decisions/ADR-249-supervised-resident-process-permitted-under-governance.md)**,
> a maintainer-directed reversal: a **supervised** resident process is permitted
> in core under four governance conditions. This document's blanket prohibition
> on background processes no longer holds.

This file is kept as a pointer rather than deleted. Fifty files across the tree
referenced it, and a deleted contract turns every one of them into a dead link
that a reader resolves by guessing.

## What moved, and what did not

| This document said | Now |
|---|---|
| **Background processes / daemons** — prohibited outright | **Governed.** A supervised process is class **P1** in the successor and is permitted under four conditions; an unsupervised one is class **P2** and stays prohibited. |
| **Cross-session persistent state stores** — prohibited | **Unchanged.** Class **P3**. The 2026-06-14 agent-memory / Layer-2 sunset is explicitly **not reopened** (ADR-249 § Not reopened). The ADR-124 § 6 build-artifact carve-out and its state-store test survive verbatim. |
| **Event loops / polling** | Folded into P1/P2: the question is now whether the loop has a supervisor, a declared write scope and a stop path — not whether it exists. |
| **Auto-PR / auto-push** | **Unchanged**, and never this contract's to decide — it is the `non-destructive-by-default` Hard Floor. |
| **Network egress from mission scripts** | **Unchanged.** |
| The whole **Allowed** table | **Unchanged**, carried over almost verbatim. |

## Two things a citation of this file should know

**Its literal scope was Mission-Mode.** The header read *"every Mission-Mode
decision, skill author, and recipe reviewer"*, and the prohibited row spoke of
subprocesses outliving *"the current agent turn"*. It was nonetheless cited as
the suite's general no-runtime authority — including by
`src/scripts/validate_reach_prescriptions.ts:13`. `ADR-124:34` had already noticed
that *"the 'no runtime' identity rests on instruments whose literal scope is
narrower"*. The successor is **suite-wide and says so**, which is a deliberate
widening rather than an inherited one.

**Its beta window had expired.** The frontmatter carried
`keep-beta-until: 2026-08-17` — ten days before it was superseded — while it was
being cited as settled. The successor ships `stability: stable`.

**A citation of this file is therefore not automatically re-scoped.** Read it
against the successor's class table rather than assuming the mapping above
covers your case.

## Where the original text is

Git history, and — for the public claim that rested on it —
`docs/CLAIMS.md`'s `no-runtime-daemon` entry, preserved at `status: withdrawn`
with a `retired_by: ADR-249` pointer rather than deleted.
