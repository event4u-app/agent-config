---
complexity: lightweight
---

# Roadmap Stubs — successor placeholders

> **Status** · stubs only. Created by Phase 9 of
> [`road-to-employee-product-and-external-proof.md`](../archive/road-to-employee-product-and-external-proof.md)
> so cross-references from the deployment-posture document and the
> archived `road-to-internal-ai-os-deployment.md` resolve.

This directory holds two classes of file, and **none of them is active work** —
see § The two classes. The stub files themselves are the inventory; this file
carries only what is true of all of them.

The stubs live under `stubs/` (not `agents/roadmaps/*.md` directly)
so they do not register with `task lint-roadmap-complexity` and do
not appear on `agents/roadmaps-progress.md`. Promotion to active
status moves the file up one directory and adds the complexity
frontmatter expected by the linter.

## The two classes

This directory holds two structurally different classes of stub, and the
distinction decides which gates apply.

**Org-mode stubs** are *empty-named placeholders*: each enumerates the
prerequisites a future maintainer (or external contributor with funding) must
satisfy before it can be promoted. They are **demand-gated** — the work is
buildable today and the open question is whether it *should* be built. They are
governed by § Promotion criteria (shared).

**Drain-run transfers** are the opposite shape. They were not created
speculatively: they are work that was already planned and specified in an active
roadmap, then transferred out when an autonomous drain run reached it and found
it needed something no repository automation can supply — a live host session, a
repo secret, a repo-admin write, a legal signature, another human, or a
capability nobody is building. The parent roadmap closes against an explicit
outcome state (`transferred`), so a completed roadmap can never be read as an
achieved goal. They are **capability-gated**: the scope decision is already
made, the work is wanted, and the only thing missing is an environment the run
did not have. They are governed by their own probe, never by the shared
criteria.

```
THE SHARED PROMOTION CRITERIA BELOW — RECRUITED CUSTOMER, FUNDED SECURITY
AUDIT, ADR SIGN-OFF — DO **NOT** GOVERN A DRAIN-RUN TRANSFER.
A TRANSFER IS PROMOTED BY ITS OWN NAMED PROBE RETURNING TRUE. NOTHING ELSE.
```

Applying a recruited customer or a funded security audit to a capability-gated
transfer is a category error: there is no customer to recruit for a tool surface
that simply is not connected, and no audit clears a missing capability. Promote
**per item**, not per file, and delete a stub when its last item is gone.

**A transfer crossing no *new* surface is not a transfer crossing no Hard
Floor.** Some pending acts here — a repo-admin ruleset write, a
branch-protection change — **are** Hard-Floor actions in their own right, and
each such stub says so.

**A gate is not always a measurement.** For such a row the gate is the
*authority* itself, exercised by a named human — not a number anyone can read.
Requiring a recruited customer and a funded audit before a maintainer may edit
their own repository settings would gate on nothing and make the stub unclosable.

Framework of record for drain-run dispositions:
[`drain-blocker-dispositions-a.md`](../../evidence/council/drain-blocker-dispositions-a.md)
and its batch-B sibling. That pointer is kept here deliberately: it is the only
central path to where disposition B and the numbered rules are formally defined,
and most transfer stubs do not link it themselves.

## What every stub carries — and why this file no longer lists them

Each stub carries the framework's three-point stub-integrity check: the original
criterion **verbatim**, the complete list of dependent steps moved, and a **named
producer with a detection probe** (never "when some subsystem exists", which
names nobody) — plus the probe's measured baseline on the transfer date, so a
later reader can tell real movement from noise, and any reasoning that would
otherwise die with the parent. Council disposition **B — transferred**,
2026-08-20 (anthropic/claude-sonnet-4-5 + openai/codex-default, quorum 2/2) for
the always-on-orchestration set; see each parent roadmap for the others.

Where several stubs come from one roadmap, that is deliberate and merging them
was refused: two host-probe cases can look adjacent while probing different
mechanisms against different telemetry streams, and the council assigned them
separate re-entry producers. One stub per distinct evidence gap; a merged stub
would have one probe standing in for two facts.

**The inventory is the directory listing, not a table in this file.** Until
2026-08-21 this file carried two index tables — 6 demand-gated rows and 27
transfer rows. They were deleted, and the reason is measured rather than
stylistic:

- The tables were an **authored append surface**: every transfer added a row by
  hand, and the file conflicted in **every** open PR GitHub reported
  `CONFLICTING`. It was the largest *authored* conflict path in the repository —
  everything above it in the ranking is generated.
- They **duplicated** the stubs. All 33 rows were checked cell by cell against
  their stub file before deletion; every measured number in every row was
  already there. Two facts that were not literally spelled out — one `grep -c`
  result and one parent item number — were written into their stubs first.
- The index **did not stay true**. It had drifted stale within a day of its own
  last repair, missing a stub created that same afternoon. An index that lies is
  worse than no index, because a reader trusts it.
- An earlier repair had already had to fix *two competing tables and
  non-rendering markdown* produced by six parallel union merges. That is the
  failure mode of a hand-maintained index under concurrent work, and it does not
  get better with more rules.

**It was restored once by a merge, and removed again.** On 2026-08-22 a merge
resolution reintroduced the transfer table — PR #1505, merge commit
`28ba2f592`, whose body records it as *"regenerated, not hand-merged"*. Both
parents of that merge lacked the table, so this was not a mis-resolved
`modify/delete`; it was a deliberate restore, taken against the note in
`agents/evidence/notes/drain-run-handoff.md` that had been written in the same
change as the deletion precisely to prevent one. The restored section said to
delete it if the removal had been deliberate, and the removal was: the AI
council chose deletion over generating the table (2026-08-21, both seats).

It was removed again by re-running the check the deletion had run, not by
citing it. All **15** rows standing at that point were verified cell by cell
against their stub file, and every measured value was already there —
including the three rows appended *after* the restore
(`road-to-instructions-loaded-observer`,
`road-to-per-turn-hook-economy-host-repro`,
`road-to-standing-rule-delivery-per-machine`), which the 2026-08-21 pass had
never seen and which the restore's own note miscounted as part of its twelve.

**If you are resolving a conflict on this file, the resolution without a table
is the correct one.** `check_no_stub_inventory_table` enforces that in CI — a
restored table fails the build rather than relying on this paragraph, which is
the one that lost last time.

To see what is here, list the directory:

```bash
ls agents/roadmaps/stubs/*.md
# or, with each stub's first heading:
head -n 20 agents/roadmaps/stubs/road-to-*.md | grep -E '^(==>|# )'
```

## Promotion criteria (shared)

Governs the **demand-gated** org-mode stubs only — never a drain-run transfer,
which names its own probe in its own file (§ The two classes). Any such stub may move from `stubs/`
to `agents/roadmaps/` only when **all three** of these are true:

1. A real first customer has been recruited and is named in
   `agents/recruit-sessions/<role>/`. No speculative promotion.
2. A funded, human-reviewed security audit covers the surface the
   stub introduces.
3. A current maintainer signs off on lifting the Hard-Floor item
   the stub crosses, in a written ADR.

Until then, the answer to "team X when?" is the cancelled-with-reason
matrix in [`docs/deploy/team-deployment-posture.md`](../../../docs/deploy/team-deployment-posture.md).

### Closing a drain-run transfer — either direction counts

A drain-run transfer is promoted when **its own probe reads positive**, and
**closed when its criterion is satisfied in either direction** — including the
honest-null direction, where one is registered. Two of the six carry such a null
already: the point-of-action carrier's "no discriminator is publishable", and the
auto-dispatch gate's "telemetry says auto-fire adds nothing and the gate stays
recommend-only". **A measured null closes a stub as legitimately as shipped work
does**, and saying so is what keeps a probe-gated stub from becoming the parking
lot the disposition framework's fifth disposition (`E — abandon`) exists to
avoid.
