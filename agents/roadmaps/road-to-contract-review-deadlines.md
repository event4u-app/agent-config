---
complexity: structural
status: draft
execution:
  mode: phase-checkpoints
owner: maintainer
review_by: 2026-11-24
relates: []
# relates: `agent-config roadmap:context --roadmap contract-review-deadlines
# --relates` returned one UNANSWERED hit, `road-to-contract-review-deadlines` --
# the file itself, not a sibling. Grepped `keep-beta-until`,
# `beta_review_markers` and `beta-review-markers` across agents/roadmaps/: hits
# in archive/ only, none in active/ or later/. No live relation to declare.
estate_growth_exempt: "Charges +0 on the COUNT half (status-scoped, this file is draft) and +1 on one-in-one-out, which is file-based. Warranted on a measurement: 86 of 121 beta contracts (71.1 per cent) carry a lapsed review deadline against a re-audit trigger their own STABILITY.md sets at 25 per cent, and the gate that exists for the marker checks only that the date is not too far in the FUTURE. No active or later roadmap carries the item."
estate_offset_exempt: "No archive move is available in this change. The addition is the residue of a 4,640-line bundle whose two largest artefacts are not landed: a 2,354-line analysis document with zero checkboxes and zero verify lines, and its superseded 1,667-line predecessor."
---
# Road to contract review deadlines — 86 lapsed dates, and a gate that checks the other direction

> **Source:** `agents/tmp.old/atomic-claude-graph/` (2026-08-24). The bundle's own
> proposals are largely not landed — see § Dropped. This roadmap carries a defect
> found while verifying one of its claims: the bundle cited
> `docs/contracts/no-runtime-boundary.md` as an authority, and its review
> deadline had lapsed seven days earlier. Sweeping that construct produced the
> population below. Every figure was re-derived at HEAD `b15b63d38`.

## Goal

Every `stability: beta` contract in this repository is inside its declared
review window, or its lapse is visible to something that runs. Finished means:
the marker gate checks the deadline it exists to record, it runs where a pull
request can see it, the 86 lapsed contracts have a disposition each, and
`STABILITY.md`'s own 25 % re-audit trigger is evaluated by a command rather than
by whoever happens to look.

## Context — measured 2026-08-24 at HEAD `b15b63d38`

| # | Defect | Evidence |
|---|---|---|
| **D1** | **86 of 121 `stability: beta` contracts carry a lapsed `keep-beta-until`** — 71.1 %. The oldest cluster is 2026-08-12, twelve days over; the most recent is 2026-08-23. Zero beta contracts lack a marker entirely, so the presence half is healthy and the date half is not. | frontmatter of `docs/contracts/*.md`, parsed |
| **D2** | **`STABILITY.md`'s own re-audit trigger has fired and nothing noticed.** `docs/contracts/STABILITY.md:98-100`: *"The audit is repeated whenever the `keep-beta-until` date passes for ≥ 25 % of beta contracts."* Measured 71.1 %, nearly three times the trigger. The condition is recorded, met, and nothing acted on it. | `STABILITY.md:98-100` plus the count above |
| **D3** | **The gate checks the opposite direction.** `check_beta_review_markers.ts:149-156` compares `keep-beta-until` against `today + MAX_REVIEW_WINDOW_DAYS` and fails when the date is **too far in the future**. There is no comparison against today. A date twelve days in the past is indistinguishable from a fresh one. | `check_beta_review_markers.ts:35, 149-156` |
| **D4** | **Its only live finding is a compliant record.** Run at HEAD it reports exactly one violation: `docs/contracts/ui-authority.md: keep-beta-until=2026-11-23 exceeds the 90-day window (max: 2026-11-22)` — over by **one day**, on a forward-dated contract, while 86 lapsed ones pass. A gate whose whole output is a one-day overshoot on a healthy record, next to 86 silent lapses, is inverted relative to what the field means. | the run above |
| **D5** | **It runs where no pull request can see it.** The only invocation is the task target `check-beta-review-markers` at `taskfiles/ci-fast.yml:1575-1578`, reachable via `task ci` / `task ci-fast`. `grep -rn beta .github/workflows/` returns nothing. So D4's violation is red on `main` and invisible — the failure class the repository's own workflow comments name twice: *"`task ci`, which no workflow invokes"*. | `taskfiles/ci-fast.yml:1575-1578`; `.github/workflows/consistency.yml:159, :183` |
| **D6** | **Two instances of D1 were already filed today as separate one-offs.** `road-to-channel-contract-and-profile-drift` D1 names `write-engine.md` (lapsed 2026-08-13); this run then found `no-runtime-boundary.md` (lapsed 2026-08-17) while checking an unrelated claim. Per [`downstream-changes`](../../src/rules/downstream-changes.md) § Defect-pattern search, one instance is a sample until the tree is searched. It was not, until now. | the two roadmap entries plus this count |

**What is NOT wrong, recorded so the fix does not overshoot:** the gate does
exactly what its `desc` says — *"Verify every stability=beta contract carries
promote-to / keep-beta-until / superseded-by"* — and that presence check passes
on all 121. The 90-day ceiling is also a real rule from `STABILITY.md:95`
(*"max 90 days from the last review"*). Neither is the defect. The defect is
that the deadline itself is enforced by nothing.

## Phase 0 — disposition before enforcement

- [ ] **0.1 Produce the lapsed inventory with a proposed disposition per contract.**
      Enforcing D3 before the backlog is dispositioned turns one silent red into
      86 loud ones on the next PR, which is how a gate gets bypassed. Each of
      the 86 gets: promote to stable · extend with a reason · supersede · or
      record as unmaintained.
      verify: a committed table under `agents/evidence/analysis/` with 86 rows,
      each carrying the lapsed date, the age in days and one of the four
      dispositions; the four counts sum to 86 and are stated.

- [ ] **0.2 Decide whether a lapsed deadline is a failure or a report.**
      86 of 121 says the 90-day cadence may be a cadence nobody can sustain,
      in which case the honest fix is a longer window or a report — not a red
      gate that gets waived 86 times. This is a maintainer decision and the
      number is its input.
      verify: the decision is recorded in `STABILITY.md` with the measured
      71.1 % as its stated basis, whichever way it went.

## Phase 1 — make the gate check its own field

- [ ] **1.1 Add the lower-bound comparison, behind whatever 0.2 decided.**
      `keep-beta-until < today` is currently unexpressible in the gate. Extend
      `check_one()` rather than adding a sibling: the scan, the frontmatter
      parse and the `--json` contract already exist, and a second gate costs
      three ratchets for nothing.
      verify: a fixture contract dated in the past is reported; a fixture dated
      inside the window is not; the existing upper-bound fixture still fails.

- [ ] **1.2 Sabotage it before believing it.**
      Set one live contract's date to yesterday, confirm the gate reports it,
      restore. A check never seen fire has unknown sensitivity.
      verify: the deliberate lapse produces the expected exit code and names the
      file; after restore the count returns to its 0.1 baseline. Record both.

- [ ] **1.3 Keep the run reproducible.**
      The gate already warns *"unpinned run — using the wall clock … this verdict
      is not reproducible"* and accepts `--as-of` / `AC_AS_OF`. A date check is
      exactly the class where an unpinned verdict drifts between two runs of the
      same tree.
      verify: two runs at the same `--as-of` over the same tree produce
      byte-identical output.

## Phase 2 — put it where a pull request can see it

- [ ] **2.1 Wire the task target into the workflow that owns contract surfaces.**
      `consistency.yml` already runs 24 individual `task` targets, so this is one
      more step in an existing job rather than new infrastructure. Its own
      comments record two incidents of a ratchet sitting red on `main` because it
      lived only in `task ci`.
      verify: `grep -rn beta .github/workflows/` returns the step, and a branch
      with a deliberately lapsed contract reds the check on its PR.

- [ ] **2.2 Register it in gate-coverage.**
      `grep -n beta .github/gate-coverage.yml` returns nothing today, so the
      gate is outside the coverage census that exists to notice exactly this.
      verify: the entry exists with its `scanned:` line, and the coverage census
      counts it.

- [ ] **2.3 Resolve the one live violation, or record why it stands.**
      `ui-authority.md` is over by a single day. Either the date moves inside the
      window or the 90-day ceiling gets the same 0.2 treatment as the floor.
      verify: the gate is green at HEAD, or the exception carries a written
      reason at the contract.

## Phase 3 — close the two one-off filings

- [ ] **3.1 Fold the `write-engine.md` and `no-runtime-boundary.md` instances into the sweep.**
      `road-to-channel-contract-and-profile-drift` step 1.1 fixes one of the 86
      by hand. Once Phase 0 dispositions all of them, that step is either
      redundant or is the sweep's first row — it must not be both, and two
      roadmaps quietly fixing the same contract is the duplication this
      repository's estate discipline exists to prevent.
      verify: that roadmap's step 1.1 either cites this sweep's row for
      `write-engine.md` or is closed as covered; the two files do not both
      change the same frontmatter.

- [ ] **3.2 State the trigger evaluation as a command, not as a habit.**
      `STABILITY.md`'s 25 % condition is prose. Whatever Phase 1 lands can
      compute it, and a trigger nobody can run is how this one reached 71.1 %.
      verify: a command prints the current percentage and whether the trigger has
      fired; running it at HEAD reproduces 0.1's number.

## Dropped — the bundle's own proposals

| Artefact | Verdict |
|---|---|
| `road-to-evidence-routed-local-agent-runtime-v2.md` (2,354 lines) | **not landed on two independent grounds — form and premise.** *Form:* Measured: no frontmatter, **0** checkboxes, **0** `verify:` lines, no `## Goal`, no `## Risk Register`, no `## Blockers`, no `- [ ] AC-N` items. Its headings are `## 1.1`, `## Challenge 1`, `## Risk 1`. This is the exact category the 2026-08-24 08:06 triage declined for ten files — *"design frames, not executable roadmaps … with acceptance criteria as bullets and no phases and no `verify:` lines"* (`agents/evidence/analysis/feedback-14-11-0-triage.md`). It proposes an 11-phase local runtime against a program already parked in `later/road-to-agent-config-next.md` whose two resume conditions are measured unmet, one falsified. *Premise:* its central lever is refuted at HEAD. It proposes to supersede a *"Class-B blanket prohibition"* in ADR-124; `ADR-124:151-156` contains no prohibition but an **extension clause** — Class B *"requires its own ADR with: a named consumer demand signal, a measured Class-A failure … and a security review under ADR-123. This clause exists so the next escalation is a decision, not a drift."* It supplies none of the three and proposes to remove the gate, which is the drift that clause was written against. It also cites ADR-124 for *"interop over build"*; `ADR-124:119-124` is the **reversal** of that ceiling — *"orchestrator first … owner where it wins"* — so the citation names the clause ADR-124 superseded. Two further refutations, both against the document's own transcript, which is the more accurate artefact of the pair: the PKM boundary at `docs/second-brain-scope.md:85-89` is a **scope** decision (*"a different product for a different consumer (a person, not an agent)"*), not a runtime one, so a boundary change does not reach it; and the proposed cheapest path, a read-only vault corpus via `fold_intake`, cannot run — `fold_intake.ts:67` filters `events-*.jsonl` and the tool writes rather than reads. Preserve as evidence, anonymised per [`source-confidentiality`](../../src/rules/source-confidentiality.md) — 22 lines match the live denylist. |
| `road-to-evidence-routed-local-agent-runtime.md` (1,667 lines) | superseded by the above within the same bundle. Consumed, nothing to plan. |
| the runtime-doctrine reopen and the "Reopen Register" | **already carried by this PR.** `road-to-decision-conformance` Phase 3 sets the runtime-doctrine ADRs to `challenged` — status only, no successor, no prototype authorised — and its Phase 2 builds the corpus-wide conformance loop the bundle calls a Reopen Register. The bundle adds one measurement worth keeping: **20 ADRs** carry a no-runtime / no-daemon / no-persistence premise, which sizes that phase. Folded in as an amendment rather than a second roadmap. |
| Graphify / Obsidian / Ruflo / memory-service reopens | **behind the same gate, and correctly so in the bundle's own analysis** — it states that the memory honest null survives a boundary change because it closed on *"counterfactual not on disk"*, which no daemon supplies. Nothing to land before `road-to-decision-conformance` Phase 3 resolves. |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-24 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The lower bound lands before the backlog and 86 reds teach the maintainer to waive | implementation | This repository documents the pattern directly: a gate that floods is a gate that gets bypassed, and 86 simultaneous violations on the next PR is a flood by any reading. | Phase 0 dispositions all 86 before Phase 1 changes any comparison, and 0.2 admits "report, not failure" as a complete outcome; Phase 2 wires the gate only after Phase 1 is green. | Phase 0 — disposition before enforcement |
| 2 | The 90-day cadence is unsustainable and the fix encodes it harder | product | 71.1 % lapsed is not 86 individual oversights; it is evidence about the cadence. Enforcing the floor without questioning the window would make a real constraint out of a number nobody has met. | 0.2 puts the window itself in scope with the measured rate as its input, and 2.3 applies the same treatment to the ceiling rather than defending it by default. | Phase 0 — disposition before enforcement |
| 3 | Two roadmaps edit the same contract frontmatter | implementation | `road-to-channel-contract-and-profile-drift` step 1.1 already changes `write-engine.md`; this sweep would change it again, and the two are in the same PR. | 3.1 makes the reconciliation an explicit step with a verify that forbids both files touching the same frontmatter; the sweep treats the earlier filing as its first row rather than as a competing fix. | Phase 3 — close the two one-off filings |
| 4 | Wiring a previously-unwired gate reds the branch that wires it | implementation | D4's single violation is live at HEAD, so step 2.1 turns an invisible red into a blocking one on its own PR. | 2.3 resolves that violation before or with 2.1, and it is one day on one file; the sequencing is stated rather than discovered. | Phase 2 — put it where a PR can see it |
| 5 | The disposition pass becomes a promotion pass | product | The cheapest disposition for 86 lapsed contracts is "promote to stable", and promotion by exhaustion turns a review backlog into a stability claim nobody reviewed. | 0.1 requires one of four dispositions per row with a reason, and promotion is not the default; the four counts are reported separately so a 86-way promotion is visible as one number. | Phase 0 — disposition before enforcement |

## Acceptance Criteria

- [ ] **AC-1** — all 86 lapsed contracts carry a recorded disposition, with the four counts stated and no blank reason.
- [ ] **AC-2** — `STABILITY.md` records a decision on whether a lapsed deadline fails or reports, citing the measured 71.1 % as its basis.
- [ ] **AC-3** — `check_beta_review_markers` reports a contract whose deadline is in the past, proven by a fixture, and still reports the existing upper-bound case.
- [ ] **AC-4** — the new comparison was observed firing against a deliberately lapsed live contract, and both the red and the restored output are recorded.
- [ ] **AC-5** — two runs at the same `--as-of` over the same tree produce byte-identical output.
- [ ] **AC-6** — the gate runs in a workflow, a deliberately lapsed contract reds its PR, and the gate is registered in `gate-coverage.yml`.
- [ ] **AC-7** — the gate is green at HEAD, `ui-authority.md` included, or its exception carries a written reason at the contract.
- [ ] **AC-8** — `write-engine.md` and `no-runtime-boundary.md` are each fixed exactly once across this PR's roadmaps, and no two files change the same frontmatter.
- [ ] **AC-9** — a command prints the current lapsed percentage and whether `STABILITY.md`'s 25 % trigger has fired, and reproduces AC-1's number at HEAD.
