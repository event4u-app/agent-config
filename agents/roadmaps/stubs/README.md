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

## Frontmatter contract — every stub declares when it is next read

```
A STUB WITHOUT A NEXT-READ DATE IS NOT PARKED WORK. IT IS AN ABANDONMENT
WEARING A DIRECTORY NAME.
`review_by:` IS A DEADLINE, NEVER PROOF THAT ANYONE LOOKED.
WHAT WAS ACTUALLY READ, AND WHEN, GOES IN `reviewed_at:` — A SEPARATE FIELD,
BECAUSE ONE FIELD CANNOT BOTH SET AN OBLIGATION AND RECORD ITS DISCHARGE.
```

Three fields, on top of the `complexity:` key the linter already expects.

| Field | Required | What it means |
|---|---|---|
| `review_by:` | yes | An ISO date. The day this file is next read. Passing it is an **overdue** state, surfaced by `agent-config stubs:due` — never a silent lapse. |
| `reviewed_at:` | no | An ISO date. The last day someone actually read the file and re-set `review_by:`. Absent means never re-read since creation. |
| `probe:` | only when there is none | The literal `probe: none`. Present **only** on a stub that carries no promoting probe anywhere in its body — see § Naming the probe. A stub with a real probe omits this key. |

### What `review_by:` means, per shape

The two classes in § The two classes have genuinely different clocks, so they
get different cadences. This adds a number to a distinction the file already
draws rather than inventing one.

| Shape | Cadence | What happens on that date |
|---|---|---|
| **Drain-run transfer** (capability-gated) | **30 days** | The named probe is **re-run**. An environment — a secret, a host session, an admin write, another human — can appear at any time, and the whole file is waiting on exactly that. Re-probing is cheap by construction: every transfer's probe is specified as a small number of readings. |
| **Org-mode stub** (demand-gated) | **120 days** | The demand question is **re-asked**. Customer recruitment, audit funding and ADR sign-off move on a slower clock than an environment does, so a 30-day cadence here would be noise. |

Set `review_by:` to creation date plus the cadence. On a review, move it forward
by the cadence from the review date and set `reviewed_at:` to that date.

**A backfilled date is a first deadline, not a claim of prior review.** The 77
files that predate this contract were given `review_by:` from the **backfill**
date plus their cadence, and deliberately **no** `reviewed_at:`. Dating them from
their creation instead would have marked every one of them overdue on day one —
loud, and carrying no information, since the fact they had never been re-read is
exactly what the absent `reviewed_at:` already says. The first honest `reviewed_at:`
on each of those files is written the first time someone actually reads it.

### The rank-1 risk this field creates, and the thing that answers it

Adding a date to 77 files is **strictly worse than adding nothing** if no
mechanism ever reads the dates: the repository then carries a field that
certifies attention it does not pay, and a stale date reads as evidence.

So the ordering is a rule, not a preference:

```
NO BACKFILL WITHOUT A READER. THE OVERDUE QUERY LANDS FIRST.
```

`agent-config stubs:due` is that reader. It is read-only, it authors nothing
inside `agents/roadmaps/stubs/`, and its two counts appear in the generated
header of `agents/roadmaps-progress.md` — two integers, no rows, nothing for the
deleted inventory table to grow back from.

### Naming the probe

Every stub either carries a promoting probe in its body or says `probe: none` in
its frontmatter. There is no third state, because the third state in practice is
a file nobody can promote and nobody has admitted is dead —
[`later/road-to-ac-deep-capabilities.md`](../later/road-to-ac-deep-capabilities.md)
names that shape as a failure mode for parked files.

A probe is one sentence naming a **reading someone can take**, not a wish. "When
the maintainer has time" is not a probe. "`AGENT_CONFIG_HOOKS_ISOLATED` is set in
that machine's env, shell profile or CI — yes or no" is.

`probe: none` is a legitimate and complete answer. It says out loud that the file
records something worth keeping but has no path back to active work, which is
information; silence in the same position is not.

### Provenance of the cadence numbers

AI council 2026-08-26, 2/2 convergent on the per-shape option
(anthropic/claude-sonnet-4-5 + openai/codex-default, two rounds, blind peer
review), over a uniform 90-day cadence and over author-set-per-file. Both seats
independently added the enforcement-first ordering and the
`review_by:` / `reviewed_at:` split above; neither was in the question.

**30 is unanimous. 120 is not** — one seat argued 180 ("customer recruitment,
audit funding and architectural approval usually change more slowly"), the other
120 ("premises can shift faster than that — a competitor ships, priorities
change, a regulatory landscape moves; the cost of a wasted check every quarter is
lower than the cost of a stale stub that should have been retired at month 4").
120 was taken because both seats named the stale-date risk as dominant and the
shorter interval is the one that reduces it, and because the 180 seat framed its
own number as "a starting point, then tune from observed resolution and overdue
rates" rather than as a floor.

**Revisit-if:** after two review cycles, either class shows a sustained overdue
rate above roughly 20 %; or 120-day reviews repeatedly find org-mode changes that
were actionable months earlier; or capability changes are commonly missed between
30-day checks.

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

## When is this file next read? — `review_by:` and `probe:`

Every stub carries two frontmatter fields. Before 2026-08-26 neither existed:
exactly **one** of 76 stubs carried a next-read date, and nothing scheduled a
re-read of any of them.

**The defect that field closes is not invisibility.** A stub is deliberately not
a backlog item and `update_roadmap_progress.ts` excludes this directory on
purpose — putting 76 of them on a progress dashboard would be wrong, and § What
every stub carries records why the hand-maintained index was deleted rather than
regenerated. The defect is one layer down: nothing ever re-reads them. A transfer
says the scope decision is made, the work is wanted, and only an environment is
missing — and that is a claim about **today**. With no scheduled probe,
*capability-gated* decays silently into *abandoned*, and the only mechanism that
re-surfaces it is the owner asking again.

```
review_by: <YYYY-MM-DD>     # required on every stub
probe: none                 # required ONLY when the file names no probe
```

### What the date means, per class

The two classes have genuinely different clocks, and this directory already
separates them, so the cadence adds a number to a distinction that exists rather
than inventing one.

| class | cadence | why this number |
|---|---:|---|
| **drain-run transfer** | **30 days** | capability-gated: an environment, a secret, a host session can appear at any time, and the probe is cheap to re-run. A stale month is the most a real capability should wait unnoticed. |
| **org-mode stub** | **180 days** | demand-gated: the open question is whether the work *should* be built, and a demand question rarely moves inside a quarter. Re-asking it monthly manufactures churn and teaches the reader to skip the field. |

**These are defaults, not laws.** A file may carry an earlier date when its own
text names one — a stub whose subject expires on a specific day sets that day,
and § The two classes' expiry stubs do exactly that.

### "Last touch" means the last SUBSTANTIVE review

The date is computed from the last time somebody actually re-read the stub, never
from the last commit that touched the file. A formatting sweep, a path migration,
or a link repair must not silently reset the clock — that is how a field starts
certifying attention nobody paid, which is strictly worse than no field because a
fresh date reads as evidence.

### `probe: none` is a real answer and has to be written out loud

68 of 76 stubs name a probe or a promotion condition. For a file that names
none, the honest record is the explicit line rather than silence: a stub with no
probe is an abandonment wearing a directory name, and saying so is what makes it
reviewable. `stubs:due` reports those files separately from the overdue ones,
because they are a different problem — one is late, the other has no finish line.

### What this is NOT

**Not the index the 2026-08-21 council deleted.** That verdict settled *an
inventory of the directory living inside the directory's own README*, and
`check_no_stub_inventory_table` refuses its return. These are frontmatter fields
on the stub files themselves plus a read-only query: the stub stays the single
source, no row is authored twice, and there is no append surface to conflict on.
A different mechanism, so the lock does not apply — recorded here so a later
reader does not have to re-derive the distinction.

**Decided by** AI council 2026-08-26, 2/2 convergent, on the maintainer's
delegation for an autonomous drain run: per-shape cadence over a uniform one
(a uniform clock loses the distinction) and over author-set dates (76 bespoke
decisions with no framework, and every future stub needs another one).
**Revisit if** two consecutive review cycles show most reviews producing no
substantive change, or a material change is found later than the cadence should
have caught it.
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
