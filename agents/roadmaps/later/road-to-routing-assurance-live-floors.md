---
complexity: structural
status: later
execution:
  mode: phase-checkpoints
owner: maintainer
review_by: 2026-12-31
estate_growth_exempt: "The later/ estate grows by one because a live-harness SUFFIX was split out of road-to-routing-assurance, which was archived in the same change -- so the ACTIVE estate shrank by one while later/ gained one, and the total plan count is unchanged. AI council 2026-08-25, 2/2, authorised the carry at that roadmap's own declared cut line; the alternative to this file was dropping four acceptance criteria, which the preservation test reserves to the owner. Growth here is preservation, not accumulation."
estate_offset_exempt: "Not a new plan. This is the live-harness SUFFIX of road-to-routing-assurance, parked under agents/roadmaps/later/ by AI council verdict (2/2, 2026-08-25) at that roadmap's own declared cut line. later/ is excluded from the dashboard and from /roadmap:process-*, so it adds no active roadmap and needs no offset; the work is preserved rather than created."
---
# Road to routing assurance — the live-harness floors

> **Arrivals:** 2 (at least) — latest `inbox-2026-09-l` (2026-09-05); earlier: agents/roadmaps/archive/road-to-routing-assurance.md.

> **Parent:** `road-to-routing-assurance`, closed at its Phase 2 cut line on
> 2026-08-25. That roadmap's own text declares the stop: *"Stopping after Phase
> 2 is a VALID end state: D1 and D2 are then repaired on the gated surface.
> Phases 3-6 each carry their own justification and none is a dependency of the
> ones before it — an estate decision can park any suffix of them in `later/`
> without stranding work."*

## Why this is parked, and what un-parks it

**AI council 2026-08-25, 2/2 convergent** (`anthropic/claude-sonnet-4-5` +
`openai/codex-default`), asked as one of two questions on the parent roadmap.
The maintainer delegated every would-ask-the-user decision to the council for
that autonomous drain run.

Every step below needs a **live LLM harness run** or production-trace
harvesting. Cost was explicitly not the objection — token spend was
pre-authorised. The objection is **evaluator independence**, and one seat
sharpened it past where the question had put it:

> The evaluator-independence issue isn't just about same-turn evaluation — it's
> about evaluating an artifact you authored. Capturing a baseline of a corpus
> you just fixed, even without interpretation, crosses that line.

The session that would have captured the 0.2 baseline is the session that
authored the Phase-2 corpus. That is why **0.2 is parked too**, and why the
middle option — capture the baseline now, resolve the null later — was rejected
by both seats rather than taken as the cautious compromise it looks like. The
second seat added the independent reason: the parent roadmap froze no execution
protocol for 0.2, so model version, retries, exclusions and aggregation would
all have been discretionary choices made by the session under evaluation.

**Authority.** Both seats: council-decidable, not owner-reserved. The parent's
cut line pre-authorises exactly this disposition, the move is reversible, it
creates no external commitment, and the preservation test passes — every
criterion below stays active in the estate rather than being dropped.

**What un-parks it:** an independent session (not the one that authored the
corpus) freezes the execution protocol — model/provider version, prompts,
sampling, retry and exclusion policy — BEFORE capturing any baseline, then runs
0.2. Everything after 0.2 follows in order.

## What is preserved verbatim

The two pre-registered nulls below are quoted from the parent and **must not be
paraphrased when they are resolved**. The pre-registration itself lives in
`docs/contracts/routing-assurance-metrics.md` and is already merged; the
tolerance (0.10 absolute recall) and the Phase-4 epsilon (0.05) were fixed there
before any baseline existed, so neither can be tuned to a result.

## Phase 0 — the parked baseline steps

- [ ] **0.2 Run the existing live harness once as a frozen baseline** (canary
      budget), storing per-unit results as the regression reference.
      verify: the baseline artifact exists, names its commit and model, and its
      per-unit rows are machine-readable.

      **Open, and it gates 0.4.** This is a live LLM run against the canary
      budget. Token spend is authorised for this drain run, but a *frozen
      baseline* is only worth freezing if it is taken on the surface and model
      the regression reference will be compared against later — and a baseline
      captured mid-run by an autonomous session, then used to derive floors in
      the same session, is the shape 0.4's own title warns about. Recorded as
      the next real step rather than attempted here.
- [ ] **0.4 Derive the floors, never invent them.** Each per-unit floor = its
      0.2 baseline value minus a fixed tolerance, written into the
      pre-registration BEFORE Phase 1 activates.
      verify: every floor in the contract traces to a 0.2 row; no floor is
      raised in the same PR that changes the thing it measures.

      **Open, blocked on 0.2 by construction** — there are no rows to trace to.
      What 0.1 could register in advance, and did, is the **derivation rule and
      the tolerance** (0.10 absolute recall), fixed before any baseline exists so
      the tolerance cannot be chosen after seeing the numbers. That is the half
      of 0.4 that does not need the baseline, and it is the half that is
      gameable if left until after.

## Phase 3 — Catalogue-pressure suite (pre-registered null)

- [ ] **3.1 Selection accuracy as a function of catalogue size:** run the Phase
      2 corpus at N in {12, 20, 50, full} with distractor sets sampled
      deterministically (FNV-1a order, the same discipline as
      `rule_trigger_eval.ts:20-21`, `:147`).
      verify: the same seed reproduces the same distractor set across runs.
- [ ] **3.2 Near-duplicate probe:** for the top-invoked skills, inject one
      paraphrased description twin and measure confusion. **This step measures
      confusion only.** It is not a tiering justification — see 3.3.
      verify: the confusion figure is published per skill pair, with the twin
      text archived.
- [ ] **3.3 Resolve the pre-registered null:** "selection accuracy at full
      catalogue is not worse than at N=20 by more than the floor delta."
      **Reframed at landing.** The source made this null cancel tiering work
      ("no tiering work is justified by this suite"). It can no longer do that:
      tiering already shipped, for a different reason — the host listing budget,
      via `compute_skill_tiers.ts`. So this null now settles exactly one
      question, the confusion measurement, and cancels nothing. If it holds,
      record it and stop. If it breaks, the result feeds the archived MCP
      roadmap's routable-skills-per-standing-token measurement rather than
      duplicating it.
      verify: one full pressure run archived with the null verdict either way,
      and the verdict text does not claim authority over tiering.

**Exit:** one archived pressure run with a recorded verdict; no follow-up work
item created unless the null broke.

## Phase 4 — Delivery-path parity (actionable now)

- [ ] **4.1 Parametrize the Phase 2 corpus over delivery path:** host-native
      listing versus MCP-tool listing. Same prompts, same floors. Both paths
      exist in the tree today (D4), so this step has no external dependency.
      verify: one corpus file runs on both paths and produces two comparable
      result rows.
- [ ] **4.2 Parity gate:** MCP-path recall may not undercut native-path recall
      by more than a pre-registered epsilon on the same corpus. A breach blocks
      any MCP default-on decision; default-off holds until then.
      verify: a synthetic recall gap larger than epsilon turns the gate red.
- [ ] **4.3 Publish the parity table** as evidence against the archived MCP
      roadmap's measured-null outcome, not as a separate claim.
      verify: the table cites the archived roadmap and adds no new claim id.

**Exit:** parity table exists for the full Phase 2 corpus on both paths.

## Phase 5 — Production traces close the loop

- [ ] **5.1 Harvest routing events from own sessions** via the existing hook
      dispatch (skill invoked, prompt text, catalogue hash) into a LOCAL,
      gitignored ledger. Prompt text stays local because 5.2 needs it verbatim;
      anything that leaves the machine carries hashes only. Batch-read, no
      runtime daemon.
      verify: the ledger path is gitignored; an export contains no free text.
- [ ] **5.2 A drain command proposes corpus candidates** from traces where a
      skill was invoked but its corpus has no matching positive (recall blind
      spots) — maintainer-confirmed before landing.
      verify: one real drain session produces at least one candidate, and an
      unconfirmed candidate cannot land.
- [ ] **5.3 Regression states on the frozen 0.2 baseline:** PASSED,
      ROUTING_CHANGED, REGRESSION — only REGRESSION (floor breach) gates.
      verify: three fixtures, one per state.
- [ ] **5.4 Proxy-fidelity report:** for prompts appearing in BOTH the trace
      ledger and the Phase 2 corpus, compare the checker's would-load verdict
      against what the session actually consulted. If it degrades, the Phase 1
      gate's verdicts are downgraded to advisory until repaired.
      verify: one report published; the downgrade path is executable and
      demonstrated on a synthetic degradation.

**Exit:** ledger populated from at least one real drain session, one
proxy-fidelity report published, at least one trace-sourced corpus candidate
landed or rejected with a reason.

## Phase 6 — Repetition and variance (live path only)

- [ ] **6.1 Add a repetition parameter to the live harness** (default 3 per
      case, canary only) and report trigger RATE rather than binary fire.
      verify: a single case run twice reports a rate, not a boolean.
- [ ] **6.2 Floors move from "fired" to "rate >= x"**, with x pre-registered
      per tier.
      verify: the 0.1 contract carries the restated floors before the first
      rate-gated run.
- [ ] **6.3 Cost note in the run report.** If the 3x cost breaks the canary
      budget, halve the rotation cap before touching repetition — coverage
      breadth via the ratchet matters more than per-case confidence.
      verify: the report carries a cost line; the rotation cap is the documented
      first lever.

**Exit:** floors restated as rates in the pre-registration, one canary cycle
completed at the new measurement.

## Blockers

### b-live-baseline-independence

- **Blocks:** every step in this roadmap.
- **Owner:** maintainer.
- **Resolved when:** a session that did NOT author the Phase-2 corpus has
  frozen the execution protocol (model/provider version, prompts, sampling,
  retry and exclusion policy) in writing, before capturing any baseline.
- **Status:** open.
- **Why it is a blocker and not a note:** 0.2's artifact is the reference every
  floor below derives from. A baseline captured under discretionary choices made
  by the session being evaluated is not neutral, and the defect would be
  invisible afterwards — the numbers would look like measurements.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-25 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A parked roadmap becomes a dropped one | product | `later/` is excluded from the dashboard and from `/roadmap:process-*`, so nothing surfaces this again on its own | `review_by: 2026-12-31` plus the un-park condition stated in one place at the top; the parent's completion note points here by name | Why this is parked, and what un-parks it |
| 2 | The frozen baseline ages out of comparability | implementation | Model and harness versions move, so a baseline frozen now may not be reproducible against a later run | The un-park condition requires the protocol to be frozen in writing including the provider version, so a later run can state whether it reproduced it or not | Phase 0 — the parked baseline steps |
| 3 | A null gets resolved by the party that wants an outcome | implementation | Both nulls below are resolvable in a direction that flatters whoever is running the harness | Both are quoted verbatim and may not be paraphrased on resolution; the Phase-3 scope restriction travels inside its own quote | What is preserved verbatim |

## Acceptance Criteria

- [ ] AC-1 — The 0.2 baseline artifact exists, names its commit, model and
      frozen protocol, and its per-unit rows are machine-readable.
- [ ] AC-2 — Every floor in `routing-assurance-metrics.md` traces to a 0.2 row,
      and no floor was raised in the same PR that changed what it measures.
- [ ] AC-3 — The Phase 3 null carries an archived verdict in either direction,
      and its text claims no authority over tiering.
- [ ] AC-4 — A parity table exists for the full Phase 2 corpus on both delivery
      paths, citing the archived MCP roadmap rather than raising a new claim.
- [ ] AC-5 — One proxy-fidelity report is published, and the
      downgrade-to-advisory path has been demonstrated on a synthetic
      degradation.
- [ ] AC-6 — Every floor is restated as a rate in the pre-registration before
      the first rate-gated canary cycle.
