---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
owner: maintainer
review_by: 2026-12-31
estate_growth_exempt: "The later/ estate grows by one because a live-harness SUFFIX was split out of road-to-routing-assurance, which was archived in the same change -- so the ACTIVE estate shrank by one while later/ gained one, and the total plan count is unchanged. AI council 2026-08-25, 2/2, authorised the carry at that roadmap's own declared cut line; the alternative to this file was dropping four acceptance criteria, which the preservation test reserves to the owner. Growth here is preservation, not accumulation."
estate_growth_exempt: "open_blockers +1: b-live-baseline-independence existed since the 2026-10-26 un-park but lacked the `blocker:` prefix, so lint_roadmap_blockers was red on main and the estate never counted it. Prefixing it adds no new gate, only counts the one the owner decision already names. 2026-10-27: open_blockers net +1 (b-live-baseline-independence resolved, b-live-spend-beyond-pilot and b-rate-canary-ceiling raised) -- both record owner-set limits the drain reached (the 25 USD pilot cap of OQ-15 and MAX_WEEKLY_QUERIES), so they are stops that already existed in owner decisions, now counted."
estate_offset_exempt: "Not a new plan. This is the live-harness SUFFIX of road-to-routing-assurance, parked under agents/roadmaps/later/ by AI council verdict (2/2, 2026-08-25) at that roadmap's own declared cut line. later/ is excluded from the dashboard and from /roadmap:process-*, so it adds no active roadmap and needs no offset; the work is preserved rather than created."
---
# Road to routing assurance — the live-harness floors

> **Arrivals:** 5 (at least) — latest `inbox-2026-10-at` (2026-10-25): a plan built on a third party's advice — compare automatic selection with explicit invocation on identical tasks, and investigate loading before adding review agents — reaches this file's question again and recommends option (1); its inputs are under § Inputs for the protocol session. Not un-parked: the active estate is at its cap, and the pilot spend is the owner's (`agents/owner-questions.md` OQ-15). The count before it read: 4 (at least) — latest `inbox-2026-10-an` (2026-10-25): two parallel plans both open with this file's question and recommend option (1); new inputs are listed under § Inputs for the protocol session. Not un-parked by that round: the active estate was at its five-roadmap cap. The count before it read: 3 (at least) — latest `inbox-2026-10-i` (2026-10-11): an audit names the host's own skill evaluator (with/without delta, ablation) as the independent grader this file was parked for. The count before it read: 2 (at least) — latest `inbox-2026-09-l` (2026-09-05); earlier: agents/roadmaps/archive/road-to-routing-assurance.md.

> **Owner decision, 2026-10-26 (OQ-15):** un-parked into the free active slot,
> with option (1) below and one pilot on the host evaluator capped at **25 USD**
> (`agents/evidence/owner-directives/2026-10-26-owner-questions-14-15-16.md`).
> The cap is for the pilot run, cumulative; crossing it pauses the run and
> reports before spending more.
>
> **Owner, 2026-10-27 (OQ-22):** CLI first. Runs through the host CLI need no
> budget question; the USD figures the CLI prints are estimates, not API
> billing. A USD ceiling applies only to an arm that must use the API (AC-7). Blocker `b-live-baseline-independence` still
> holds: the protocol is frozen by a session that did not author the corpus
> before any baseline is captured.

> **The posed question — 3 arrivals, council-decidable per this file's own Authority paragraph.**
> Does a scored run on the host's own skill evaluator, with the execution protocol
> (model version, prompts, runs, retries, exclusions, aggregation) frozen in a file
> by a session that did not author the corpus BEFORE any baseline is captured,
> satisfy the un-park condition below? Exactly one of: (1) yes — step 0.2 runs on
> the host evaluator through the print-only command of
> `road-to-a-trigger-suite-the-host-grades`, protocol file first; (2) no — the
> existing live harness stays the only admissible instrument; (3) stay parked, the
> question recorded as open.

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

- [x] **0.2 Run the existing live harness once as a frozen baseline** (canary <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/routing_baseline.ts -->
      budget), storing per-unit results as the regression reference.
      verify: the baseline artifact exists, names its commit and model, and its
      per-unit rows are machine-readable.
      production entry: src/scripts/compile_trigger_evals.ts
      reach exempt: the step ships the baseline artefact and the grader fix compile_trigger_evals uses; classifyRow in the same module is step 5.3, which stays open until something calls it.

      Done 2026-10-27: `agents/evidence/metrics/routing-baseline-20261027.json`
      (135 of 179 units), the protocol frozen by a non-authoring session first.
- [x] **0.4 Derive the floors, never invent them.** Each per-unit floor = its <!-- receipt: class=R1 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=test-only change -->
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

- [x] **3.1 Selection accuracy as a function of catalogue size:** run the Phase <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/routing_arms.ts -->
      2 corpus at N in {12, 20, 50, full} with distractor sets sampled
      deterministically (FNV-1a order, the same discipline as
      `rule_trigger_eval.ts:20-21`, `:147`).
      verify: the same seed reproduces the same distractor set across runs.
      production entry: src/scripts/routing_arms.ts
      Done 2026-10-27: recall 0.793 / 0.785 / 0.741 / 0.541 at N=12 / 20 / 50 / full
      over 135 units (`agents/evidence/metrics/routing-arms-20261027.md`).
- [x] **3.2 Near-duplicate probe:** for the top-invoked skills, inject one <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/routing_arms.ts -->
      paraphrased description twin and measure confusion. **This step measures
      confusion only.** It is not a tiering justification — see 3.3.
      verify: the confusion figure is published per skill pair, with the twin
      text archived.
      production entry: src/scripts/routing_arms.ts
      Done 2026-10-27: confusion 0 on all ten pairs, 30 runs.
- [x] **3.3 Resolve the pre-registered null:** "selection accuracy at full <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/routing_arms.ts -->
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
      production entry: src/scripts/routing_arms.ts
      Done 2026-10-27: **broken** — 0.541 < 0.785 − 0.10; recorded as input to
      the archived MCP roadmap's measurement.

**Exit:** one archived pressure run with a recorded verdict; no follow-up work
item created unless the null broke.

## Phase 4 — Delivery-path parity (actionable now)

- [x] **4.1 Parametrize the Phase 2 corpus over delivery path:** host-native <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/routing_arms.ts -->
      listing versus MCP-tool listing. Same prompts, same floors. Both paths
      exist in the tree today (D4), so this step has no external dependency.
      verify: one corpus file runs on both paths and produces two comparable
      result rows.
      production entry: src/scripts/routing_arms.ts
- [x] **4.2 Parity gate:** MCP-path recall may not undercut native-path recall <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/routing_arms.ts -->
      by more than a pre-registered epsilon on the same corpus. A breach blocks
      any MCP default-on decision; default-off holds until then.
      verify: a synthetic recall gap larger than epsilon turns the gate red.
      production entry: src/scripts/routing_arms.ts
      Done 2026-10-27: `routing_arms --report` calls `parityVerdict`; on the real
      rows it is **breached** (native 0.552, MCP 0.448, delta 0.103).
- [x] **4.3 Publish the parity table** as evidence against the archived MCP <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/routing_arms.ts -->
      roadmap's measured-null outcome, not as a separate claim.
      verify: the table cites the archived roadmap and adds no new claim id.
      production entry: src/scripts/routing_arms.ts

**Exit:** parity table exists for the full Phase 2 corpus on both paths.

## Phase 5 — Production traces close the loop

- [x] **5.1 Harvest routing events from own sessions** via the existing hook <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/routing_trace_ledger.ts -->
      dispatch (skill invoked, prompt text, catalogue hash) into a LOCAL,
      gitignored ledger. Prompt text stays local because 5.2 needs it verbatim;
      anything that leaves the machine carries hashes only. Batch-read, no
      runtime daemon.
      verify: the ledger path is gitignored; an export contains no free text.
      production entry: src/scripts/routing_trace_ledger.ts
- [x] **5.2 A drain command proposes corpus candidates** from traces where a <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/routing_trace_ledger.ts -->
      skill was invoked but its corpus has no matching positive (recall blind
      spots) — maintainer-confirmed before landing.
      verify: one real drain session produces at least one candidate, and an
      unconfirmed candidate cannot land.
      production entry: src/scripts/routing_trace_ledger.ts
- [ ] **5.3 Regression states on the frozen 0.2 baseline:** PASSED,
      ROUTING_CHANGED, REGRESSION — only REGRESSION (floor breach) gates.
      verify: three fixtures, one per state.
      Built, not wired (2026-10-27): `classifyRow` and its four fixtures are green, but no rotation or gate calls it yet; it is ticked when the canary run classifies its rows against the frozen baseline.
- [x] **5.4 Proxy-fidelity report:** for prompts appearing in BOTH the trace <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/proxy_fidelity.ts -->
      ledger and the Phase 2 corpus, compare the checker's would-load verdict
      against what the session actually consulted. If it degrades, the Phase 1
      gate's verdicts are downgraded to advisory until repaired.
      verify: one report published; the downgrade path is executable and
      demonstrated on a synthetic degradation.
      production entry: src/scripts/routing_trace_ledger.ts

**Exit:** ledger populated from at least one real drain session, one
proxy-fidelity report published, at least one trace-sourced corpus candidate
landed or rejected with a reason.

**Trace candidates, 2026-10-27 — both rejected with a reason (orchestrator, not the proposing lane).**
`using-git-worktrees`: the prompt is a harness task-notification, not a user
request, so the invocation is no routing signal. `image-provider-routing`: a
genuine positive, but the verbatim prompt names a third-party asset and would
carry it into the tracked corpus; a paraphrased positive belongs in an ordinary
corpus edit, not a trace import. The exit's "landed or rejected with a reason"
is met; the ledger and `--propose` stay the intake for the next drain.

## Phase 6 — Repetition and variance (live path only)

- [x] **6.1 Add a repetition parameter to the live harness** (default 1; <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/trigger_eval_rotation.ts -->
      repetitions are opt-in per run, canary only) and report trigger RATE
      rather than binary fire. A run whose projected weekly peak exceeds
      `MAX_WEEKLY_QUERIES` is refused unless explicitly overridden, and the
      override is recorded.
      verify: a single case run twice reports a rate, not a boolean; a test
      shows a run projected over the ceiling refused.
      Was (restated 2026-10-27 per OQ-23 (c)): "(default 3 per case, canary only)".
- [x] **6.2 Floors move from "fired" to "rate >= x"**, with x pre-registered <!-- receipt: class=R0 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural -->
      per tier.
      verify: the 0.1 contract carries the restated floors before the first
      rate-gated run.
- [x] **6.3 Cost note in the run report.** The report carries projected and <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/trigger_eval_rotation.ts -->
      actual queries and the CLI's own USD estimate. The first lever is the
      repetition count: the rotation cap can no longer be halved (the 12-week
      cycle is bound to the 90-day window).
      verify: the report carries a cost line; the repetition count is the
      documented first lever.
      Was (restated 2026-10-27 per OQ-23 (c)): "If the 3x cost breaks the canary
      budget, halve the rotation cap before touching repetition — coverage
      breadth via the ratchet matters more than per-case confidence."

**Exit:** floors restated as rates in the pre-registration, one canary cycle
completed at the new measurement.

## Inputs for the protocol session

Offered by round `inbox-2026-10-an`, for the independent session that freezes
the protocol to take or refuse. None is a step; none changes the un-park
condition.

- **A listing snapshot before each run.** The host drops the descriptions of
  little-used skills when its listing overflows; a pilot skill whose
  description is not in the listing is "not interpretable", not "did not fire".
- **Two arms besides plugin on/off:** the `skill-route` hook on and off, to
  read whether the pointer duplicates, helps or hurts native routing; and a
  root built from the previous release, run at `task release` only.
- **Two control fixtures:** a typo fix must pull no spec, council or security
  skill; an authorisation change must pull `security-audit`.
- **Four separate report axes** — selection, execution, outcome, efficiency —
  with an infrastructure failure reported `UNKNOWN`, never green.
- **The gate reading** of `road-to-a-measured-pointer-gate-and-true-records`
  2.2 is the no-model baseline for the hook arm.

Offered by round `inbox-2026-10-at`, same terms:

- **Natural and explicit as a pair.** Every `trigger: true` query is emitted
  twice — the corpus text unchanged, and the same task prefixed with the explicit
  invocation form (whether `/name` loads the skill in print mode is checked once
  first). Per skill the run then yields one of four cells: `healthy` (both fire
  and pass), `load-defect` (explicit passes, natural does not fire),
  `content-defect` (explicit fails too), `over-fire` (fires on a near-miss).
- **Three listing arms.** As shipped (alphabetical, fixed window); priority order
  at the real window; no override at all. Selection is read on the consumer path
  (throwaway HOME, real install, `skillOverrides` active), because the host's
  evaluator loads skills as a plugin and plugin skills ignore `skillOverrides`.
- **A fingerprint per row.** Skill byte hash, case hash, listing snapshot hash,
  settings hash, host version, model, scoring version and partition; a compare
  refuses a score delta across differing fingerprints and still shows a verdict
  change.
- **A fail-closed start guard.** The harness refuses to start when HOME is not
  throwaway, settings are inherited or `--no-publish` is missing — before any
  credential is read.

## Blockers

### blocker: b-live-baseline-independence

- **Status:** resolved — 2026-10-27, option (a). A session that authored no
  corpus file froze the protocol in
  `agents/evidence/preregistration/routing-baseline-protocol-20261027.md`,
  committed before the first corpus case ran; the baseline artefact landed in a
  later commit and names that file's sha256.
- **Owner:** implementer — a session that did not author the Phase-2 corpus;
  the 2026-10-26 owner decision (OQ-15) already settled spend and scope.
- **Blocks:** every step in this roadmap.
- **Recommendation:** (a) — a fresh session freezes the protocol first; it is
  the only order in which the baseline stays neutral.
- **If you do nothing:** no step runs, and the 25 USD pilot the owner approved
  stays unspent.
- **What to do:** pick exactly one — (a) start a session that did not author
  the Phase-2 corpus and have it write the frozen execution protocol before
  any baseline capture, or (b) re-park this roadmap under `later/` until such
  a session is scheduled.
- **Resolved when:** a session that did NOT author the Phase-2 corpus has
  frozen the execution protocol (model/provider version, prompts, sampling,
  retry and exclusion policy) in writing, before capturing any baseline.
- **Why it is a blocker and not a note:** 0.2's artifact is the reference every
  floor below derives from. A baseline captured under discretionary choices made
  by the session being evaluated is not neutral, and the defect would be
  invisible afterwards — the numbers would look like measurements.

### blocker: b-live-spend-beyond-pilot

- **Status:** resolved — 2026-10-27, the owner answered OQ-22 (a), then
  narrowed it the same day: runs go CLI first (`claude plugin eval`), and a
  CLI run needs no budget question — the USD the CLI prints is its own
  estimate, not API billing. A USD ceiling (about 95 USD for Phases 3–4)
  applies only to an arm that has to go through the API (AC-7). Was: open, the
  25 USD pilot of OQ-15 stood at 23.56 USD and the cap paused the run.
- **Owner:** the owner — the cap is an owner decision (OQ-22 in
  `agents/owner-questions.md`).
- **Blocks:** 3.1, 3.2, 3.3, 4.1, 4.3. The code for 3.1/3.2 (seeded FNV-1a
  subsets, `injectTwin`) is on the branch; only the live runs are missing.
- **Recommendation:** release about 95 USD (Phase 3 at N=12/20/50 over 135
  units ≈ 69 USD at the measured 0.17 USD per run, one MCP arm ≈ 23 USD).
- **If you do nothing:** Phases 3 and 4 stay unmeasured; the baseline and the
  Phase 5 loop already on the branch are unaffected.
- **What to do:** answer OQ-22 — (a) a new ceiling, (b) a cheaper design
  (smaller model or a subset), or (c) re-park Phases 3–4 under `later/`.
- **Resolved when:** OQ-22 sits under `## Answered` and its answer is recorded
  here.

### blocker: b-rate-canary-ceiling

- **Status:** resolved — 2026-10-27, option (c): the owner recommended (c) and
  sent it to the AI council, which converged 2/2 (anthropic + openai) on (c):
  default 1, repetitions opt-in, the ceiling stays 200, 6.1/6.3 restated. Its
  additions are in the restated steps: a run projected over the ceiling is
  refused unless overridden, and the cost line names the repetition count as
  the first lever. Revisit only when the owner raises the ceiling AND a
  controlled variance study (firing, non-firing and the 44 unbaselined units,
  host/model/CLI pinned) shows n=1 produces materially wrong ratchet or
  regression decisions. Was: open — three repetitions raise the weekly peak
  from 200 to 600 queries against the owner-set `MAX_WEEKLY_QUERIES` of 200,
  and 6.3's named first lever no longer exists.
- **Owner:** the owner — the ceiling is owner-set (OQ-23).
- **Blocks:** 6.1 (default 3), 6.3.
- **Recommendation:** (c) — keep default 1 and restate 6.1/6.3; a 3x per-case
  confidence buys less than the breadth the ceiling protects.
- **If you do nothing:** the mechanism ships at default 1 and reports rates;
  no canary cycle runs at three repetitions.
- **What to do:** answer OQ-23 — (a) raise the ceiling to 600, (b) three
  repetitions only for units with floor 0.90, (c) keep default 1 and restate
  6.1/6.3.
- **Resolved when:** OQ-23 sits under `## Answered` and its answer is recorded
  here.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-27 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A parked roadmap becomes a dropped one | product | `later/` is excluded from the dashboard and from `/roadmap:process-*`, so nothing surfaces this again on its own | `review_by: 2026-12-31` plus the un-park condition stated in one place at the top; the parent's completion note points here by name | Why this is parked, and what un-parks it |
| 2 | The frozen baseline ages out of comparability | implementation | Model and harness versions move, so a baseline frozen now may not be reproducible against a later run | The un-park condition requires the protocol to be frozen in writing including the provider version, so a later run can state whether it reproduced it or not | Phase 0 — the parked baseline steps |
| 3 | A null gets resolved by the party that wants an outcome | implementation | Both nulls below are resolvable in a direction that flatters whoever is running the harness | Both are quoted verbatim and may not be paraphrased on resolution; the Phase-3 scope restriction travels inside its own quote | What is preserved verbatim |
| 4 | CLI-first runs stall on the subscription, not on a budget | product | Runs through the host CLI need no budget question (AC-7), but the CLI draws on the organisation's plan; on 2026-10-27 the org's monthly limit stopped two lanes mid-run, and the CLI's printed USD is an estimate a reader can mistake for billing | Each run record names the CLI version and labels the USD as the CLI's estimate; a run stopped by the plan limit resumes in its worktree from the last recorded unit instead of restarting | Acceptance Criteria |

## Acceptance Criteria

- [x] AC-1 — The 0.2 baseline artifact exists, names its commit, model and
      frozen protocol, and its per-unit rows are machine-readable.
- [x] AC-2 — Every floor in `routing-assurance-metrics.md` traces to a 0.2 row,
      and no floor was raised in the same PR that changed what it measures.
- [x] AC-3 — The Phase 3 null carries an archived verdict in either direction,
      and its text claims no authority over tiering.
- [x] AC-4 — A parity table exists for the full Phase 2 corpus on both delivery
      paths, citing the archived MCP roadmap rather than raising a new claim.
- [x] AC-5 — One proxy-fidelity report is published, and the
      downgrade-to-advisory path has been demonstrated on a synthetic
      degradation.
- [x] AC-6 — Every floor is restated as a rate in the pre-registration before
      the first rate-gated canary cycle.
- [ ] AC-7 — CLI first: every live run of this roadmap goes through the host
      CLI (`claude plugin eval`, or the print-only command of
      `road-to-a-trigger-suite-the-host-grades`), and its record names the CLI
      version. A direct API path is used only for an arm the CLI cannot run,
      the record says why, and only such an arm is held to a USD ceiling.
