---
complexity: lightweight
review_by: 2026-09-23
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

**Re-measured 2026-08-22: 23 files, `active_roadmaps 3` — a gap of 20.** The
transfer reading (26 / 23, gap 3) is kept above rather than overwritten, because
the two readings together are the argument: the gap is not a stable property of
the tree, it is whatever the draft set happens to be that day, and it grew by a
factor of nearly seven in one day without the defect changing at all.

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
ls agents/roadmaps/*.md | wc -l                        # 26 at transfer; 23 on 2026-08-22
./scripts-run src/scripts/check_estate_count | grep active_roadmaps
#   -> "active_roadmaps       23  (baseline 23, +0)" at transfer; baseline 3 on 2026-08-22
#   The DIFFERENCE is the defect: 3 at transfer, 20 on 2026-08-22.
#   Both absolutes drift with every archival, and so does the gap.

# Clause 2 — is there a written decision either way?
#   A DEDICATED KEY, never a substring test. `grep -c draft` on this file
#   returned 4 at transfer, not the 0 this stub first claimed, and 13 on
#   2026-08-22 — every match is prose or the `non-draft` in the
#   active_roadmaps definition, which entered 2026-08-18 (6f808e6b8), three
#   days before this stub was written. A substring cannot tell a recorded
#   decision from a history entry that mentions the word.
python3 -c "import json; d = json.load(open('src/config/estate-count-budget.json')); \
raise SystemExit(0 if 'draft_roadmaps_gated' in d else 1)"
#   -> exit 1 (key absent) at transfer and on 2026-08-22. Exit 0 is the decision.
#   Whoever takes the fix names the key; `draft_roadmaps_gated` is the proposal,
#   and any dedicated key satisfies the clause as long as it is not prose.
```

**Measured 2026-08-21: 26 files, gate counts 23 — a gap of 3 — and no dedicated
decision key.** The stub's original clause-2 figure, *"0 matches at transfer"*,
was **never true**: the measured value was 4, which is exactly the false
confidence a substring probe buys and the reason clause 2 now reads a key. The
wrong figure is corrected rather than deleted, on the same principle § The defect
applies to its own two stale absolutes. Re-entry completes when the two counts
agree **or** the budget file carries a dedicated key deciding `draft`.

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

## The asymmetry, measured 2026-08-24 — the defect has a second half

Everything above is about the *population*: `status: draft` lets a file leave the
measured set. This section is about what the gate then does to the files that
stayed in it, and it is the half that produces recurrence.

**Promotion is charged. Addition is exempted. Both by the same gate, in the same
run.**

`archive/road-to-release-publication-integrity.md`, blocker
`b-stub-promotion-authority`, resolved 2026-08-23 by an AI council 2/2 that split
1-1 and converged on this tiebreak, verbatim:

> *"promoting a stub is an estate decision this roadmap itself routes to the
> maintainer, and the estate runs a shrink-only ratchet with `one_in_one_out` — so
> promotion is growth requiring an offset **this run did not identify**."*

So a fix that was fully specified, whose three refusal causes had all been cleared
and measured, was **not refused on its merits**. It was refused because the
promotion needed an offset. The council also recorded the general question — *may
an autonomous run override an explicitly deferred estate decision?* — as
precedent-setting and *"not a drain run's to settle"*, and left it open for the
maintainer.

**The next day, the same gate was waived thirteen times.** Measured across PR
#1612 (`0f7c26ee9..3cf0077d9`), by counting tree entries at each ref:

| Corpus | before | after | delta |
|---|---|---|---|
| `agents/roadmaps/*.md` (top level) | 4 | 12 | **+8** |
| `agents/roadmaps/stubs/` | 69 | 73 | **+4** |
| `agents/roadmaps/later/` | 61 | 64 | **+3** |
| `agents/roadmaps/archive/` | 601 | 603 | **+2** |

**Fifteen planning artefacts opened, two closed.** And:

```bash
git diff 0f7c26ee9..3cf0077d9 | grep -c '^+estate_offset_exempt'   # -> 13
git diff 0f7c26ee9..3cf0077d9 | grep '^+estate_offset_exempt' \
  | grep -c 'never counted'                                         # -> 13
```

**Thirteen claims, thirteen carrying the same boilerplate sentence** — *"this run
archived only `status: draft` roadmaps, which were never counted and so are
unavailable as offsets."* Which is true, and is also the point: the reason no
offset was available is the draft hole this stub already documents. The exemption
mechanism is fed by the population defect.

## Why this is the recurrence engine, and not just an inconsistency

Three subjects the reviewer keeps re-raising — the release-placeholder guard, stub
hygiene, the package diet — share no technical content. What they share is that
each was **blocked at the estate boundary rather than on the merits**:

| Subject | Where it stopped | Record |
|---|---|---|
| publication guard | `one_in_one_out`, offset not identified | `archive/road-to-release-publication-integrity.md` `b-stub-promotion-authority` |
| stub hygiene | disposition `E` (abandon), council **split 1/1**, dissent stands | `archive/road-to-estate-drawdown.md` Step 4.1 |
| package diet | refused on ROI at one payload size, then the cap rose 6.4 → 9.2 | `archive/road-to-zero-ceremony-install.md` Phase 4 |

So the recurrence is predictable **without reading their content**, which is what
makes this a mechanism finding rather than three separate ones. The tree already
states the principle against itself, one section up: *"the measured party controls
whether its work enters the measurement boundary."* The asymmetry is the same
sentence applied to promotion — the party that would be charged decides whether to
issue itself an exemption.

## What this adds to § What moved here

7. Decide whether `one_in_one_out` should treat a **stubs→active promotion**
   differently from a **new addition**. A promotion moves work already agreed and
   already recorded; an addition creates it. The gate charges both identically,
   which prices remediation and appetite the same.
8. Decide whether `estate_offset_exempt` may be **self-issued by an autonomous
   run** at all, or whether the thirteen-in-one-PR pattern is the signal that it
   needs a cap, a distinct key, or an owner countersignature. This is the
   maintainer question the 2026-08-23 council explicitly declined to settle — it is
   recorded here so it has an address, not so an agent can answer it.
9. If either is changed, state the interaction with items 1–6 above: the
   population defect and the exemption asymmetry are the same key seen from two
   sides, and fixing one without the other moves the hole rather than closing it.

**Not proposed here, deliberately:** tightening the gate. A shrink-only ratchet
that also refuses promotions of agreed remediation would make this worse, not
better, and nothing above establishes which direction is right. The finding is the
asymmetry; the remedy is the maintainer's.
