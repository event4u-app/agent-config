# Estate-drawdown residue probe — 2026-08-21

<!-- evidence-type: analysis -->

Measurements taken for the closing pass of `road-to-estate-drawdown`, against
`origin/main` @ `52cfb4bb8`. Every number below was produced by a command in
this checkout on 2026-08-21, not carried from the roadmap's own earlier notes.
Where a shipped instrument and an independent parser disagree, both readings are
printed and the delta is named rather than one being adopted.

The roadmap's three remaining open steps are 1.1, 2.1 and 2.2, plus the `[~]`
1.2. This file measures the subject of each.

## 1 · Phase-1 population — class 0 and class 1

Steps 1.1 and 1.2 act on exactly two blocker classes: 1.1 clears class-0
entries via `gates --execute`, 1.2 schedules a class-1 tranche under the budget
ledger. Both were measured with two independent instruments.

| Instrument | Scope | Open blockers | class 0 | class 1 | class 2 | class 3 | undeclared |
|---|---|---|---|---|---|---|---|
| `roadmap_gates --all --json` | active tree | 35 | **0** | **0** | 20 | 15 | 0 |
| own parser over `### blocker:` sections | active tree | 34 | **0** | **0** | 20 | 14 | 0 |
| own parser over `### blocker:` sections | `later/` | 25 | **0** | **0** | 2 | 5 | 18 |

**The one-row delta is reconciled, not smoothed.** The shipped tool reports one
entry the own parser does not: `legacy`, in `road-to-gated-reach-followup.md`.
That is the entry step 0.1 of this roadmap already documented — it states its
gate as a legacy `> Blocked until …` note rather than a `### blocker:` heading,
so it has no `Class:` field for either instrument to read. The own parser only
walks `### blocker:` headings and therefore misses it; the shipped tool
synthesises it. It is not class 0 or class 1 under either reading, so the
direction that matters is identical in both.

**Widest honest scope: zero class-0 and zero class-1 blockers exist anywhere in
the estate** — 60 open records across the active tree and `later/` combined, and
not one of them is in a class Phase 1 can act on.

### Why this is structural rather than a snapshot

Four independent probes now agree, at four different tree states:

| Date | Instrument | Open blockers | class 0 / class 1 |
|---|---|---|---|
| 2026-08-17 | `gate-class-sweep-2026-08-17.md` § 4c/§ 4d | 49 swept | 12 swept as 0/1, then **reclassified** |
| 2026-08-20 | `agent-config gates --json --all` (sibling AC-2) | 44 | 0 / 0 |
| 2026-08-20 | same, after the sibling's own two resolved out | 42 | 0 / 0 |
| 2026-08-21 | this probe, two instruments | 35 (active) + 25 (`later/`) | 0 / 0 |

The decisive record is the sibling's step 1.3, at
`agents/roadmaps/archive/road-to-gate-autonomy.md:203-234`: all twelve entries
the classification sweep had put in class 0 or 1 were read in full, **none could
carry an honest `Run:` field**, and they were reclassified to what their text
supports — five consent calls, seven human-only. So the emptiness is not a
window that fills. It is the outcome of reading every candidate.

## 2 · Step 1.1's precondition has landed

1.1 opens *"Once the sibling's classification sweep lands"*. Measured live:

- The sibling is `road-to-gate-autonomy`, and it is **archived** —
  `agents/roadmaps/archive/road-to-gate-autonomy.md`, i.e. terminated, not parked.
- Its step **1.2 is `[x]`** (`:158-174`) and the sweep artefact is committed at
  `agents/evidence/analysis/gate-class-sweep-2026-08-17.md`.

So 1.1 is **not** waiting on a producer. The producer delivered and then closed.
What 1.1 has is a delivered precondition and an empty subject.

## 3 · Step 1.2's stated reason is now stale

1.2's own note (`:251-261`) gives two reasons it cannot run. One holds, one no
longer does.

- **Holds** — the class-1 population is empty (§ 1), and the live trigger eval
  it names by name is the pair `skill-activation-window` +
  `human-gated-live-trigger-eval`, which the council dispositioned **B /
  transferred** into one human-gated stub (`drain-blocker-dispositions-a.md:40,61`).
- **Stale** — *"no spend is possible until its settings keys and ledger path
  exist, which is that roadmap's own work."* Those shipped:
  `src/config/agent-settings.template.yml:605-612` carries
  `gate_budget.max_cost_per_run_usd: 5` and
  `max_cost_per_rolling_7d_usd: 25` — exactly the two figures the council
  authorised on `b-gate-budget-preauth` (`drain-blocker-dispositions-b.md:48`);
  `src/agent-src/scripts/gate_budget.ts:43` writes the receipt ledger at
  `agents/runtime/state/gate-budget-ledger.jsonl`;
  `src/server/schemas/settings.ts:208` carries the schema entry; and the
  mechanism is fixture-covered by `tests/scripts/gate_budget.test.ts` plus
  `tests/scripts/gate_execute.test.ts`.

**The mechanism half of Phase 1 is complete. The subject half is empty.** Those
are different facts and the step's note conflated them.

## 4 · Phase-2 triage coverage — the remaining population

`agents/decisions/estate-triage-dispositions.yml` holds **one** batch,
**ten** verdict rows, dated 2026-08-19.

| Measure | Count |
|---|---|
| Roadmap files in the active tree (`agents/roadmaps/*.md`) | 27 |
| …of those, counted by the ratchet (`check_estate_count`) | 24 |
| Roadmap files in `later/` | 53 |
| active + `later/` total | 80 |
| Files carrying a verdict row (by original or `moved_to` path) | 9 |
| **Files carrying no verdict row** | **71** |
| …untriaged in the active tree | 24 |
| …untriaged in `later/` | 47 |

AC-2 requires *"every file in the estate carries a terminal verdict row"*, and
2.1 caps a batch at *"at most ten roadmaps, one PR each"*. **71 files at ten per
PR is eight further pull requests**, none of which is this one.

### The 27-versus-24 gap is three `draft` roadmaps

`collect()` — the dashboard parser `check_estate_count` reads — excludes
`status: draft`. Three active-tree files are `draft`:
`road-to-conformance-round7-followup.md`,
`road-to-demand-gate-audience-followup.md`,
`road-to-plan-gates-measurement.md`.

They are simultaneously (a) in the active tree, (b) invisible to the ratcheted
`active_roadmaps` count, and (c) untriaged. Recorded here as a finding because
the drain-run handoff note already flags the shape: *"`draft` becomes a
permanent hiding place"*. Nothing in this change moves them; naming the class is
the deliverable.

## 5 · The estate baseline as measured today

`./scripts-run src/scripts/check_estate_count` at `52cfb4bb8`:

```
active_roadmaps       24  (baseline 24, +0)
later_roadmaps        52  (baseline 52, +0)
open_blockers         61  (baseline 61, +0)
```

`later_roadmaps` reads 52 against a 53-file directory listing for the same
reason as above — one `later/` file is not in the counted corpus. `open_blockers`
spans the active tree **and** `later/` by design
(`check_estate_count.ts:253,274`), which is why it is 61 rather than the 35 the
active-tree-only gate report prints. Two different denominators, both correct
for their own question.

## 6 · What this roadmap's own blocker now reads as

`b-consolidated-decision-sheet` carries `- **Status:** RESOLVED 2026-08-20`.
`lint_roadmap_blockers.ts:193` matches `Status:\s*resolved` **case-insensitively**,
so `RESOLVED` reads as closed, and the blocker is absent from the 35-row open set
in § 1. The blocker is closed to every gate. No action is needed on it, and none
was taken — PR #1492 (merged 2026-08-20T19:02:16Z, merge commit `866a88096`,
verified an ancestor of this branch) settled all 21 rows and is not re-litigated
here.
