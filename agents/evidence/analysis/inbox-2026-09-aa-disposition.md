<!-- evidence-type: analysis -->

# Inbox round `inbox-2026-09-aa` — disposition

**Source set:** `agents/tmp.old/inbox-2026-09-aa/` — three files, 305 KB,
one topic. **Verified against** `58f1f2ae2` (main, 2026-09-12), which is
**29 commits past** the `cf5a3b4f` baseline every source was drafted against.

## The one status correction that moves most of the round

Every source in this round reads PR #2017 as **open, mergeable, not merged**,
and `main` as **15.0.0**. Checked live: `gh pr view 2017` returns
`state: MERGED`, `mergedAt: 2026-09-12T08:11:06Z`, and `package.json` at
`origin/main` reads `16.0.0`. So every demand of the form *"before merging
#2017 I would require X"* — one source lists five — is **overtaken as a gate**.
Its *content* is not: two of the five name defects that shipped, and those are
the two roadmaps below.

## What the source set actually is

The census (`inbox_source_census`) counted **831 anchors** across three files:
`chat.txt` 818 (13 separators · 646 headings · 159 enumerations),
`road-to-cross-corpus-parity-v17.md` 7, `w1-status-update-v15.0.0.md` 6.
Decision ids argued in the set: `L1`, `L2`, `P0`–`P10`, `W1`.

`chat.txt` reads as a transcript and is not one. The 13 separators divide
**fourteen independent reviewer outputs**, each answering the same standing
prompt ("go into the code"), and there are **no user turns in the file at all**.
The transcript-walk obligation therefore has zero targets here, and the demand
bucket is the reviewers' own recommendations rather than a person's stated
wants. Recorded because a run that treated the separators as user turns would
have produced fourteen phantom rows.

**Bucket ratio, stated because it inverts the usual warning:** this set is
claim-heavy by construction — fourteen code reviews of one window — and the
demands are recommendations, not complaints. A low demand-to-claim ratio here
is the genre, not a missed reading.

## Point ledger

```
claims       verified: 21 → still-true 11 / already-fixed 6 / never-true 3 / unverifiable 1
             (the set carries several hundred assertions about the tree; the 21
              verified are every claim that carries a demand or a contradiction.
              The rest are descriptions of code all fourteen agree on and none
              of which any disposition depends on. Named rather than counted.)
instructions extracted: 0 → n/a
             (no source carries a runnable procedure addressed to an agent —
              fourteen reviews, one comparison plan, one status update. Phase 4b
              has an empty selection, which is a real answer and not a skipped step.)
demands      extracted: 29 → adopted 3 / already-satisfied 9 / declined 11 / owner-decision 6
```

## Anchor census — the source-side denominator

```
anchors      831 counted → rows produced 29 · no-demand 802 · unaccounted 0
```

802 anchors produce no demand row. That is the genre: 646 of the 818 in
`chat.txt` are the reviewers' own section headings (`# 1.`, `# 2.`, …), and a
heading over a paragraph praising a mechanism is an anchor with nothing to
dispose. Every one is accounted for by the sweep below, none is unread.

```
passes       pass 1: 24 rows · pass 2: +5 rows · pass 3: 0 adopted-not-found
             converged at pass 2 (a third extraction pass added nothing)
```

Pass 2's five: the corpus-score gate rule (D25), the stale-transitional-comment
sweep (D26), the forgotten-beta time bound (D27), the turn-end kernel
extraction (D28), and the stale `HONEST LOSS` check (D07) — the last found only
by closing a reading gap between two segments.

## Verified claims — the eleven that carry something

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| C01 | 16.0.0 ships `Known limitations: _none_` while the code documents its own residuals | **still-true** | `CHANGELOG.md:686`; `src/scripts/_lib/dropped_decision.ts:86-90` |
| C02 | `Known limitations` is the one curated label nothing derives | **still-true** | `src/scripts/_lib/release_highlights.ts:184,207`; `_DERIVED_REASON` at `:186-191` carries four of five |
| C03 | 15.0.0's BREAKING section announces a retirement its tree does not contain | **still-true** | `docs/archive/CHANGELOG-pre-16.0.0.md:31` vs `src/scripts/hooks/block_kernel_rule_writes.ts` at HEAD |
| C04 | The deny is still bound, blocking, fail-closed | **still-true** | `src/scripts/hook_manifest.yaml:183-188`, `:1318` |
| C05 | The 24 h soak text stands unchanged | **still-true** | `src/agent-src/contexts/authority/kernel-rule-edits.md:11`, and `:24` calls the ratification gate an ADDITION |
| C06 | `docs/MIGRATION.md` carries no 15.0.0 or 16.0.0 entry | **still-true** | `grep -n '^## ' docs/MIGRATION.md` → 14.22.x, 14.21.x, 9.0.0, 1.15.0 only |
| C07 | The migration index "ends at 9.0.0", seven majors back | **never-true** | same grep — 14.21.x and 14.22.x sections exist. The defect is the two missing entries, not a table frozen at 9 |
| C08 | `turn_end_gate_hook.ts` is past its own 1500-line ratchet | **never-true at HEAD** | `wc -l` → **1400** |
| C09 | `run_continuation_hook.ts` is 1,529 lines and unproven | **still-true** | `wc -l` → 1529; `later/road-to-run-continuation-observation.md` |
| C10 | A stale `HONEST LOSS` for the reverted deny may sit in the threat model | **already-fixed** | `grep -n 'HONEST LOSS' docs/threat-model.md` → empty; `:36` names the guard as registered |
| C11 | `analyze:repo-loop` does not exist under that name | **still-true** | only `src/domains/analysis-workbench/analyze/roadmap-repos/command.md` |
| C12 | `check_kernel_edit_ratified.ts`'s header is stale about the parallel deny | **never-true** | the deny does still stand, so the header describing a two-mechanism state is correct; the head is what is wrong, not the header |
| C13 | The `main` ruleset enforces no required checks | **never-true** | live `gh api …/rulesets/17749383` → `enforcement: active`, required: `Sync + Generate Tools Consistency`, `Standing payload delta + budget gate` |
| C14 | An org admin can always bypass that ruleset | **still-true** | same call → `OrganizationAdmin`, `bypass_mode: always` |
| C15 | The subagent-return stub stands at 24 arrivals | **still-true** | `agents/roadmaps/stubs/road-to-subagent-return-gate.md`, now 25 |
| C16 | The runtime-orchestration stub stands at 10 arrivals | **still-true** | `agents/roadmaps/stubs/road-to-runtime-orchestration-substrate.md`, now 11 |
| C17 | A detector demotion contract exists | **already-fixed** | `docs/contracts/turn-end-detector-demotion.md` |

### The cross-source contradiction this round resolves

C13 and C14 come from **two reviewers who disagree**. One read the legacy
branch-protection endpoint, saw `required_status_checks.enforcement_level: off`,
and concluded the forge enforces nothing — making "connect forge-side
protection" their P1. The other read the **rulesets** endpoint and found the
enforcement plus the admin bypass. Checked live today: the second is right and
the first is a wrong-surface read, and the second's own qualifier is the
accurate statement — *required for the normal merge flow, not physically
impossible for an admin to bypass*. The P1 built on the first reading is
declined on that basis, not on preference.

## Demand dispositions — all 29

**Adopted (3)** — into two roadmaps:

| # | Demand | Where |
|---|---|---|
| D04 | `Known limitations: _none_` is false and the field is underivable | `road-to-a-release-head-field-nothing-derives` |
| D05 | 15.0.0's BREAKING line contradicts the shipped tree | `road-to-a-breaking-line-the-tree-does-not-contain` Phase 1 |
| D06 | Two majors with BREAKING changes and no migration entry | same roadmap, Phase 2 |

**Already satisfied (9)** — the tree does this:

| # | Demand | Evidence |
|---|---|---|
| D01 | Detectors need a demotion path before more are added | `docs/contracts/turn-end-detector-demotion.md` |
| D02 | Per-detector fire/precision measurement | `measure_turn_end_gate.ts` measures per detector, turn-based |
| D07 | Check the stale `HONEST LOSS` | already absent; recorded as roadmap-2 step 1.2 so the null is on the record rather than in this file only |
| D13 | Shared runtime-state substrate | `stubs/road-to-runtime-orchestration-substrate.md`, arrivals 10 → **11** |
| D17 | Finish typed grants to the executor | `road-to-typed-grants-that-persist` (draft, active) |
| D19 | Graph-wins benchmark | `later/road-to-a-graph-that-wins.md` |
| D20 | Subagent return contract | `stubs/road-to-subagent-return-gate.md`, arrivals 24 → **25**; both reviewers reaching it answer the posed question as option 1 (keep the parking) |
| D22 | ADR-134 expiry | `stubs/road-to-adr-134-expiry.md` |
| D24 | Kill criterion for `run_continuation_hook` | `later/road-to-run-continuation-observation.md` |

**Declined (11)** — one sentence each, per the floor:

| # | Demand | Reason |
|---|---|---|
| D03 | Extract detectors A–F out of the turn-end hook | rests on C08, which is false at HEAD — the file is 1400 lines, inside its ratchet, so the stated trigger has not fired |
| D08 | Freeze the release-findings path for 3–5 releases | a recommendation to make no change; nothing to build, and no artifact records a do-nothing better than the absence of one |
| D10 | Stop-path p50/p95 runtime SLO | the stop slot was measured once this very span (`bf0bc033`), and a second instrument before that one's reading is read is the accretion four of the same reviewers warn against |
| D11 | Surface payload grants in doctor/release summary | no grant has ever been issued; an observability surface over an empty set measures nothing |
| D18 | Connect forge-side required checks | refuted by C13 live — they are connected; the residual (admin bypass, C14) is owned by `stubs/road-to-main-protection-ruleset-changes.md` |
| D25 | A rule barring any detector from the enforcement baseline without a corpus score | a new gate class over a population of six, five of which are already scored; the cost is a standing obligation, the gain one detector |
| D26 | Sweep stale transitional-state comments | rests on C12, which is false — the header describes the state that actually shipped |
| D27 | Keep an upper time bound on forgotten betas | the beta model already forces a decision at the date rather than auto-promoting; the demand describes what the tree does |
| D28 | Build a "turn-end kernel" | same basis as D03, and it proposes a restructure with no defect behind it |
| — | Governance-to-consumer ratio (57:16) | a measurement all fourteen report and none turns into an action; recorded, not actionable as an artifact |
| — | Estate growth (+17 % since 2026-08-24) | owned by the estate ratchet and its budget file; this round adds no reading the gate does not already take |

**Owner decisions (6)** — none escalated to a block this round, because none
reaches the third arrival as a *new* demand:

| # | Demand | State |
|---|---|---|
| D09 | Continuity outcome funnel — record → consumed → useful successor | no owner in the estate; first arrival as a demand, and it asks for a measurement of a default flipped two days before the round |
| D12 | Evidence hot/cold lifecycle | named by two reviewers as their P0.1; no owner. The subject is the estate growth the ratchet already gates from the other side |
| D14 | Skill-routing eval coverage stuck at 100/299 | the seed file this cites is not findable in the tree under any name searched; the claim is **unverifiable** here and is the round's one such |
| D15 | Explicit-invocation census for the 189 reference-declared skills (L1, ADR-263) | one reviewer states ADR-263 makes it a duty; that reading of the ADR is the owner's to confirm |
| D16 | Guard-strength ratchet (L2, the #1964 class) | one reviewer's standing lever, unaddressed by any commit in the span |
| D23 | `analyze:repo-loop` as a public command contract | verified absent (C11); it is a naming the owner stated wanting, not a defect |

## What this round did not do

- **No deep read of the 14 reviewers' scorecards.** They occupy a large share of
  the 646 headings and produce no demand: a score is a judgement about the tree,
  not a request of it. They are counted in the anchor census and disposed as
  no-demand, not skipped.
- **No claim verification beyond the 21.** Named above rather than implied away.
- **No arrival increment on the stubs this round did not reach** — four held
  objects carry no arrival line at all (`check_held_object_arrivals` reports
  them, advisory); they are pre-existing and untouched here.
