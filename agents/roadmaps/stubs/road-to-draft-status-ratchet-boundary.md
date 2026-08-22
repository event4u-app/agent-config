---
complexity: lightweight
---

# Stub: road to closing the `draft` hole in the estate ratchet

> **Stub — not active work.** Drain-run transfer, 2026-08-21, from
> [`road-to-estate-drawdown.md`](../archive/road-to-estate-drawdown.md) — target
> **T2, anti-regrowth**. Council disposition **B**, outcome state
> **transferred**, both seats confirming in round 2 —
> [`drain-estate-drawdown-residue`](../../evidence/council/drain-estate-drawdown-residue.md),
> framework of record
> [`drain-blocker-dispositions-a`](../../evidence/council/drain-blocker-dispositions-a.md).
> Moved here rather than fixed in the parent because the fix changes a **shipped
> gate's counting semantics and its committed baseline**, which Rule 3 may reach.

## The defect, in one sentence

**The measured party controls whether its work enters the measurement boundary.**

An author writes `status: draft` into a roadmap's own frontmatter, and the file
leaves the ratcheted `active_roadmaps` metric while still sitting in the active
tree. Nothing else has to happen. The parent roadmap's **T2** promises an
anti-regrowth ratchet whose baseline *"walks down only"*; a metric whose
population the authors can opt out of, one line at a time, does not deliver that
promise.

This is not a hypothesis. Measured 2026-08-21: `agents/roadmaps/*.md` holds
**26** roadmap files and `check_estate_count` reports `active_roadmaps 23`. The
**three-file gap is exactly the `draft` set.**

**The gap, not either number, is the defect** — and this stub was drafted with
`27` and `24` in it, from a reading taken earlier in the very change that
transferred it, before that change archived its own parent roadmap. Both absolute
figures moved by one within a single commit series; the difference did not. The
figures are corrected here and the episode is left recorded, because it is a
small live demonstration of why the probe below is written as a **comparison**
rather than as a pinned number.

## The mechanism, with file:line

`check_estate_count` reads the dashboard's own parser rather than scraping its
markdown (deliberately — the parent's step 3.1 records that choice so the gate
cannot disagree with the page it is named after). That parser excludes drafts:

- `src/agent-src/scripts/update_roadmap_progress.ts:91` —
  `const DRAFT_VALUES: ReadonlySet<string> = new Set(['draft']);`
- `:284-286` — `is_draft(fm)` returns true when frontmatter `status` is in that set.
- `:747` and `:815` — two `continue` sites, one in the active collector and one in
  the parked inventory, that skip a draft file outright.

So the exclusion is a property of the **dashboard**, and the ratchet inherits it
by being honest about reading the dashboard. Both halves are individually
reasonable, and the hole is in their composition — which is why the fix is a
decision rather than a patch.

## The three files, at transfer

All three were simultaneously (a) in the active tree, (b) invisible to the
ratcheted `active_roadmaps` count, and (c) carrying no triage verdict row. **Two
still are** — the third was archived on 2026-08-22 and is kept in the table with
its new path, because removing the row would erase the evidence that the shape
existed while leaving the shape itself unfixed.

| File | `status` |
|---|---|
| `agents/roadmaps/later/road-to-conformance-round7-followup.md` | `draft` |
| `agents/roadmaps/archive/road-to-demand-gate-audience-followup.md` | `draft` — **left the active tree 2026-08-22**, transferred to [`road-to-demand-gate-audience-default.md`](road-to-demand-gate-audience-default.md). One of the three, resolved by drain rather than by this stub; the shape it illustrates is unchanged. |
| `agents/roadmaps/later/road-to-plan-gates-measurement.md` | `draft` |

Naming them is not the same as fixing it. The drain-run handoff note had already
flagged the shape — *"`draft` becomes a permanent hiding place"* — and the note
alone did not stop three files from being in it.

## Why this was not fixed in the parent

The openai seat raised Rule 3 and did not resolve it by assertion: *"changing a
shipped gate's counting semantics and baseline appears to fall under Rule 3 …
unless the framework explicitly distinguishes repository code changes from
shipped-default flips."* `check_estate_count` ships to consumers and runs in their
CI, so changing what it counts changes behaviour outside this repository, and its
committed baseline would have to move in the same change.

Rule 3 is **categorical**, so an ambiguous reading of it resolves conservatively:
the metric is not touched. The parent recorded the finding and closed; the fix
lives here.

The same seat also required a rollout shape before any expansion ships, and it is
part of this stub's scope rather than an afterthought: *"Expanding the ratchet to
drafts could immediately fail CI or block drains. The proposal needs an
observed-only rollout, an explicit baseline migration, rollback criteria, and a
named authority for disabling enforcement."*

## What moved here — the complete list

1. The **decision**: does the estate ratchet count `draft` roadmaps?
2. If yes, the **counting change** in `check_estate_count` / its parser, its
   **baseline migration** (23 → 26 on today's tree, an accounting change that
   earns a `baseline_history` entry saying so — and one whose two numbers will
   both have moved again by the time anyone acts on this, which is why the
   entry must state the *reason*, never just the delta), an **observe-only first release**,
   **rollback criteria**, and a **named authority** who can disable enforcement.
3. If no, a written reason recorded against T2 stating that the ratchet
   deliberately measures non-draft files only, so the hole is a documented
   scope rather than an unnoticed one.

Nothing else moved. The parent keeps the whole gate: `check_estate_count.ts`, the
budget file, the one-in-one-out lint, and all of AC-3, which is **met** and is not
in question here.

### Named producer

**The repository maintainer**, who owns the estate metric — the parent states in
two places that both the ceiling numbers and the window belong to the maintainer,
and this is the same authority. A repository-code change to a shipped gate plus a
committed-baseline move is exactly the class the parent's own § 2 T2 reserves for
*"a PR citing evidence in a real sentence rather than a number change."*

### Probe, and its measured baseline at transfer

Two clauses; re-entry needs **either** the fix **or** the written no-fix reason,
so the probe is satisfied by either branch resolving.

```bash
# Clause 1 — does the gate's population still exclude drafts?
#   Compares the raw file count against what the gate counts.
ls agents/roadmaps/*.md | wc -l                        # 26 at transfer
./scripts-run src/scripts/check_estate_count | grep active_roadmaps
#   -> "active_roadmaps       23  (baseline 23, +0)" at transfer
#   The DIFFERENCE (3) is the defect. Both absolutes drift with every archival.

# Clause 2 — is there a written decision either way?
grep -rn "draft" src/config/estate-count-budget.json    # 0 matches at transfer
```

**Measured 2026-08-21: 26 files, gate counts 23 — a gap of 3 — and the budget
file records nothing about drafts (0 matches).** Re-entry completes when the two
numbers agree **or** the budget file carries a decision naming `draft`.

The first clause is deliberately a *comparison* rather than a fixed number: the
raw count and the gate count both move as the estate drains, and only their
**difference** is the defect. A probe pinned to "26" would report FIRED the first
time an unrelated roadmap archived, which is the false-fired failure the parent's
own triage batch recorded three times — and, as § The defect records, both
absolutes in this stub's own first draft went stale inside a single commit series,
which is that argument arriving before the ink dried.

## Dissent, recorded

The anthropic seat argued `D / satisfied` in round 1: naming the gap in the
evidence artefact is a sufficient disposition for *this* roadmap, and changing a
ratcheted metric's semantics is future ratchet maintenance rather than a hasty fix
in a closing PR. It confirmed `B` in round 2. The dissent is kept because it is
right about one thing that constrains this stub: **the fix must not be hasty**,
which is why the observe-only rollout and the rollback criteria are inside the
transferred scope rather than left to whoever picks it up.
