---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
estate_growth_exempt: "Phase 1 repairs a live defect — the api transport is dead for three of five configured providers and the only runtime carrier discards every council verdict — which the tree carries today independently of any free-intelligence story, and no existing roadmap owns either."
estate_offset_exempt: "It offsets nothing: it is the only roadmap this inbox round produces, and the four drafts it consolidates were never in the estate."
---
# Road to admissible council seats

> **Source:** `agents/tmp.old/inbox-2026-09-n/` — verified against the tree at 93d63073e on 2026-09-05.

## Goal

The council can today reach exactly two seats, both subscription CLIs from the two vendors whose joint panel this package already measured at zero finding-coverage lift; the API transport throws a package-not-installed error for the other three providers; and the one runtime carrier that resolves a council verdict discards it. This roadmap makes the council's own transports work, gives the resolver a vocabulary for refusing a route on policy rather than only on absence, and files one pre-registered claim for the one role a non-paid seat can hold without contradicting recorded evidence — scoring, never deciding. Success is checkable: every configured provider produces a `CouncilResponse` under `mode: api` in test; a seat can be refused with a named policy reason that `council:status` prints; a project diff cannot reach a seat whose ceiling is public artefacts; and a jury-agreement claim exists in `docs/CLAIMS.md` with its honest-null path written before any run. Work this roadmap does **not** contain, because the inbox round's verification showed it already exists or is already settled: the discovery, admissibility, health, quota, identity, blind-review, disagreement-signal, argument-exhaustion, secret-scan and finding-disposition modules four drafts proposed building are all present in `src/scripts/ai_council/` and `src/scripts/_lib/`; the separate money and entitlement budgets one draft called for are `budget_guard.ts` and `cli_call_budget.ts`; and a re-measurement of cross-vendor *reviewer* lift is excluded because the tree's own re-open condition for that null requires a judge-survivable corpus that does not exist here.

## Phase 1 — Repair the transports the council already claims

- [x] **1.1 Give `_OpenAICompatibleClient` and `GeminiClient` a live transport.** Both constructors reach an unconditional `throw new Error('… package not installed. pip install …')` after the api-key check (`src/scripts/ai_council/clients.ts:854`, `:929`), so `mode: api` is dead for gemini, xai and perplexity. `OpenAIClient` already carries the pattern to copy — a `_curlJsonPost` shim installed as the `chat.completions.create` callable (`clients.ts:745-760`).
      verify: a unit test constructs each of `GeminiClient`, `XAIClient` and `PerplexityClient` with an `api_key` and an injected transport double, calls `ask()`, and receives a `CouncilResponse`; the test fails on the current tree with the `pip install` error.
      <!-- done 2026-09-07 -->
      DONE. `tests/scripts/ai_council/api_transport.test.ts` — 9 tests, green. Each case passes a REAL `api_key` together with a transport double (`ApiClientOptions.transport`), which exercises the shim-building path an injected `client:` object skips; that path is the code that used to throw. SABOTAGE PROBE: restoring both `throw new Error('… package not installed …')` lines turned 4 of 9 RED with exactly `google-genai package not installed. \`pip install google-genai\`.` and `openai package not installed. \`pip install openai\`.` — the errors the verify names. Undone by the inverse edit. Transport + the three shims live in `src/scripts/ai_council/api_transport.ts` (new); `curlJsonPost` moved there from `clients.ts`, which is ~1,370 lines past the source-size ceiling where every added line costs one excess line.
- [x] **1.2 Settle the Gemini CLI headless contract in the template, either way.** The seat ships `enabled: false` (`agents/templates/.ai-council.yml.example:394-395`) and the client comment records the contract as unverified because the run reached `IneligibleTierError` first (`clients.ts:2108-2121`). Either a dated probe result or an explicit honest null belongs in the template; an undated `enabled: false` teaches nothing.
      verify: the template's `gemini:` block carries either a dated probe outcome or a one-line honest null naming what could not be established, and `./scripts-run src/scripts/council_cli status` reports the seat with that reason rather than silently.
      <!-- done 2026-09-07 -->
      DONE, as an HONEST NULL rather than a probe — the contract still could not be established, and saying so is the outcome. `agents/templates/.ai-council.yml.example` gemini block now carries `disabled_reason:` dated 2026-09-07 naming what is UNKNOWN (whether a piped stdin alone keeps the CLI headless without `-p/--prompt`) and why it could not be reached (the free tier fails with `IneligibleTierError` first). Status half: `MemberConfig.disabled_reason` (`config.ts`) + `disabledSeats` / `NO_DISABLED_REASON` (`src/scripts/ai_council/status_surface.ts`, new) make `council_cli status` print every DISABLED seat — it listed only enabled members before, which is why the seat was silent. A disabled seat with no reason prints `disabled, no reason recorded` rather than vanishing. `tests/scripts/ai_council/disabled_seat_reason.test.ts` — 7 tests, green. SABOTAGE PROBE: deleting the status print AND the template reason turned 3 of 7 RED; undone by the inverse edit.
- [x] **1.3 Make the runtime carrier carry rung-3 and rung-4 verdicts.** `src/scripts/hooks/delegation_nudge_hook.ts:440-441` returns `null` for every verdict that is not `subagent`, and its own comment names "rung-3/4 team/council" among what it discards — so a resolved council verdict produces no output on the only runtime carrier, recorded independently at `agents/evidence/analysis/council-intelligence-baseline.md:103-111`. The output is a pointer line naming `council_cli` / `ask_transport`, never an automatic spawn.
      verify: a fixture in which `classifyLadder` returns a rung-4 verdict makes `buildNudgeLine` emit a non-null line naming the council entry point; the same fixture returns `null` on the current tree.
      <!-- done 2026-09-07 -->
      DONE. `classifyPrompt` now returns a result for `team` (rung 3) and `council` (rung 4) instead of collapsing them into the `verdict !== "subagent"` return, and `buildNudgeLine` gained a branch per rung. The rung-4 line names `./scripts-run src/scripts/council_cli run --input <file>` plus `agent-config council:status` for reachability. It is a POINTER: `delegable: false`, `action` never `dispatch`, `sliceCount: 0`, and the literal text `Not a spawn, and not run for you` — this roadmap's Risk 2, asserted rather than asserted-about. `tests/scripts/delegation_nudge_council_rungs.test.ts` — 6 tests, green, including two that pin the rungs which must stay SILENT (a bounded question, and routine ADR maintenance). SABOTAGE PROBE: restoring the single collapsed `return null` turned 3 of 6 RED; undone by the inverse edit.

## Phase 2 — Make a refusal sayable before making a seat admissible

- [x] **2.1 Extend `AbsentReason` with the policy exclusions it cannot express.** The union is exactly four values — `no_binary | no_auth | timeout | quota` (`src/scripts/ai_council/transport_resolver.ts:65`) — all of which mean "the route is not reachable". A route that is reachable and must not be used has no name, so the resolver cannot fail closed on terms, privacy, unproven cost, or a served model that is not the requested one. Add the exclusion reasons and make the unknown case resolve to absent, never to available.
      verify: a unit test asserts each new reason round-trips through the resolver and appears in `council_cli status` output; a seat configured with an unproven-cost route resolves absent with that reason rather than available.
      <!-- done 2026-09-07 -->
      DONE. `src/scripts/ai_council/seat_policy.ts` (new) adds `policy_terms | policy_privacy | policy_unproven_cost | policy_model_mismatch | policy_content_ceiling | policy_unknown`; `AbsentReason` is now `UnreachableReason | PolicyExclusion`. The check runs FIRST in `resolveTransport`, before the mode dispatch, because the `api`/`cli` branches return `available: true` unconditionally — a refusal placed after them would be unreachable for exactly the seats it exists to stop. UNKNOWN FAILS CLOSED: `classifyPolicyExclusion` maps any unrecognised token to `policy_unknown`, which is itself an absent reason, so a config typo refuses a seat instead of authorising it (Risk 3). `council_cli status` prints `policy <seat>: <reason>` and carries `absent_reason` / `policy_exclusion` in `--json`. `tests/scripts/ai_council/seat_policy_and_ceiling.test.ts` — 17 tests, green. TWO SABOTAGE PROBES: (a) moving the policy check after the `api`/`cli` early return turned the ordering test RED; (b) making `classifyPolicyExclusion` return `null` on an unknown token turned the two fail-closed tests RED. Both undone by the inverse edit.
- [x] **2.2 Add one binary content ceiling per seat.** Redaction today is a secrets floor and says so (`src/skills/ai-council/references/cost-and-redaction.md`); nothing above it can express "this project's diff may not go to that seat". One attribute — `public-artifact` or `project-content` — carries the decision. Repo-owned artefacts (skill descriptions, trigger corpus, rule text, bench fixtures) are `public-artifact`; everything a consumer supplies defaults to `project-content`.
      verify: a fixture sending consumer diff content to a `public-artifact` seat resolves absent with a content-ceiling reason and the run stays green; the same fixture sends a trigger-corpus fixture to the same seat and it is admitted.
      <!-- done 2026-09-07 -->
      DONE. `src/scripts/ai_council/content_ceiling.ts` (new): two values only, `public-artifact | project-content`, with `project-content` the default on BOTH axes so an unclassified payload is treated as private and an unrecognised ceiling NARROWS rather than widens. `resolveTransport` gains `seatCeiling` / `contentClass`; the single refusal is project content into a public-artifact seat, returned as `available: false` + `absentReason: 'policy_content_ceiling'` — a verdict, not a throw, so the run stays green (asserted with `.not.toThrow()`). A public artefact into the same seat is admitted, and an UNDECLARED content class runs no check at all, which is what keeps every pre-2.2 caller identical. The secrets floor underneath is untouched, not replaced. Covered by the same 17-test file.
- [x] **2.3 Record the seat-role boundary as an ADR.** A route this package did not pay for may propose findings and may score them; it may never carry a verdict, chair, or act as evaluator. This narrows a recorded park — `agents/roadmaps/later/road-to-governed-evidence-production.md:269-301`, whose `metered-backend-park` was narrowed on 2026-09-01 to a metered proposer only — onto a second axis, so it is a decision record rather than a rule edit.
      verify: the ADR exists with `status`, `reopen_policy` and its basis set, `docs/decisions/INDEX` regenerates clean, and `src/rules/evaluator-independence.md` cites it by number.
      <!-- done 2026-09-07 -->
      DONE. `docs/decisions/ADR-257-unpaid-route-may-propose-and-score-never-decide.md` — `status: accepted`, `reopen_policy: directional`, `evidence.basis` with six entries, `review_trigger` set. `./scripts-run src/scripts/adr/regenerate_index --dir docs/decisions/` wrote 195 numbered + 1 legacy; `check_adr_frontmatter` reports no errors. `src/rules/evaluator-independence.md:148` cites it by number, and the projection carries it (`dist/agent-src/rules/evaluator-independence.md:148`). The rule edit was made PAYLOAD-NEUTRAL: `check_preamble_payload_budget` has ~8 tokens of headroom under its CI grace ceiling, so the citation was compressed and two passages the rule's own mechanics-guideline pointer already carries verbatim (the four-host binding detail, the `severity: blocking` gloss) were dropped rather than duplicated — net −27 tokens against `origin/main`, gate green.

## Phase 3 — One pre-registered claim, on public artefacts only

- [x] **3.1 File one claim before any measurement runs.** `free-jury-judge-agreement`: on this package's own public evaluation corpus, a family-diverse panel scoring against known ground-truth dispositions reaches Cohen's κ ≥ 0.60, reusing the kappa machinery in `check_quality_regression.ts`. One claim, not two — the proposer-lift question is held behind `metered-backend-park` and is not filed here. The honest-null path is written into the claim: below the bar, the jury stays evaluation-only and no gate consumes it, permanently.
      verify: `docs/CLAIMS.md` carries the claim with `status: unbacked` and a pre-registration date, and the pre-registration commit precedes any commit that records a measurement.
      <!-- done 2026-09-07 -->
      DONE. `docs/CLAIMS.md` carries `claim: free-jury-judge-agreement`, `status: unbacked`, pre-registered 2026-09-07. The ordering requirement is satisfied VACUOUSLY AND STRONGLY: `free-seat-measurement-spend` was resolved DECLINED in this same change, so no measurement commit exists or can exist under this round's authorization — a threshold fixed while the measurement is impossible cannot have been fitted to a result. `check_claims` green (99 entries, 60 backed, 31 unbacked inventory). DEVIATION FROM THE STEP TEXT, recorded rather than made silently: the step says the honest-null path is written in "permanently". It is written WITHOUT that word. The run-19 council's session-5 refinement is that writing "permanent" into a published scope note prejudges a future owner ruling, which the scoped-refusal rule forbids; the claim instead says the jury stays evaluation-only and no gate consumes it, that lifting this is not authorized by the claim, and that doing so requires a new pre-registered claim. The floor is identical in strength and carries no unbounded commitment.
- [x] **3.2 Build the aggregator beside `consensus.ts`, not inside it.** At least two model families are required or the panel is absent; the aggregate is a trimmed mean or median, never a vote count — `docs/CLAIMS.md:522-531` records that a same-posture second vendor's catches were a strict subset of the first's, so counting agreeing voices measures redundancy. Position order swaps per judge, reusing `src/scripts/ai_council/judge_position_bias.ts`.
      verify: a unit test — a single-family panel returns absent with the family reason; a three-judge panel containing one corrupted score returns the trimmed value and not the arithmetic mean; the position-swap path is exercised and asserted.
      <!-- done 2026-09-07 -->
      DONE. `src/scripts/ai_council/jury_aggregate.ts` (new), BESIDE `consensus.ts`: that module aggregates a council whose members carry verdicts, and per ADR-257 a jury never does — folding them together would put a scorer on the verdict path, which is Risk 5. `juryAggregate` refuses a single-family panel with `absentReason: 'single_family'`; the aggregate is a trimmed mean (drop one from each end at n>=3, which at n=3 IS the median) and reports `trimmed: 0` at n=2 rather than implying robustness it lacks; the result shape carries no vote count. `juryPairwise` runs the position swap PER JUDGE by reusing `judge_position_bias.ts::judgeBothOrders` rather than re-implementing the reconciliation, and inconsistent judges stay in the denominator. `tests/scripts/ai_council/jury_aggregate.test.ts` — 13 tests, green: the corrupted-score case pins the exact surviving value (0.82) as well as the destroyed arithmetic mean (>30), because "not the mean" alone would pass for any wrong number. SABOTAGE PROBE: relaxing the family floor to 1 and setting `trimmed = 0` turned 3 of 13 RED; undone by the inverse edit.
- [~] **3.3 Run it shadow-only, changing no behaviour.** A ledger records which seat would have been used and what it would have scored, on repo-owned public artefacts only, while every production surface keeps its current output.
      verify: at least fourteen days of ledger lines exist and a diff over the same window shows no production surface consuming a jury score.
      <!-- deferred-resolution: merged-into=road-to-governed-evidence-production -->
      DEFERRED 2026-09-07 — not skipped, and not silently. Two independent gates, either of which alone is disqualifying. (1) SPEND: a shadow run calls the council, and both reachable seats are metered or subscription-consuming; `free-seat-measurement-spend` was resolved DECLINED for this round, so the run is unauthorized. (2) ELAPSED TIME: the verify asks for ">= fourteen days of ledger lines", which no amount of work performed today satisfies — synthesising lines to fill the window would be a false green, and shortening the window to stop the shortfall would change the indicator rather than the evidence. Carried to `later/road-to-governed-evidence-production.md`, which owns `metered-backend-park`, the park that governs exactly this spend; that file carries the structured `relates:` back-link. The HALF that was doable now is done: the aggregator (3.2) exists and the claim (3.1) is filed, so the measurement has something to run and something to answer.

## Phase 4 — A route beyond the two seats that exist

~~Every step in this phase is held by `blocker: gateway-seat-admission` below. None may be worked before an owner lifts it.~~

**CLOSED UNOPENED, 2026-09-07.** `gateway-seat-admission` resolved **declined** —
the slot was not spent, so the hold was never lifted and no step here was worked.
All three are `[~]` and merged back into `later/road-to-gateway-harvest.md` M1,
which stays parked and undisturbed. The capability is planned in exactly one
place, which is the outcome 4.3 was written to reach; it simply reached it by
refusal rather than by implementation.

- [~] **4.1 Add `base_url` to the config layer and a generic OpenAI-compatible route.** `_VALID_PROVIDERS` is closed at five names and `config.ts` contains no `base_url` at all (`src/scripts/ai_council/config.ts:88-94`; `grep -c base_url` returns 0), while the client class already has the field (`clients.ts:913`) — the gap is config, not transport. A route whose zero-cost property is not proven classifies `per-token`, so it stays inside the existing USD gate rather than escaping it. **corrected-from-reproduction:** this is `agents/roadmaps/later/road-to-gateway-harvest.md` M1, which is unprioritised and not blocked — its ADR-211 freeze was struck by ADR-216 on 2026-08-05, and neither ADR-088 nor ADR-249 governs it.
      verify: a config test — a member declaring `base_url` with no hard-stop evidence resolves to billing class `per-token`, and `council_cli status` names the route and its class.
      <!-- deferred-resolution: merged-into=road-to-gateway-harvest -->
      DEFERRED 2026-09-07. `gateway-seat-admission` was resolved DECLINED: the slot is preserved, not spent, so Phase 4 stays unopened exactly as the blocker's own "If you do nothing" line describes. This step IS `later/road-to-gateway-harvest.md` M1 by the roadmap's own reading, so it is merged back into that file rather than left planned in two places; the dated refusal is recorded there and that file carries the structured `relates:` back-link.
- [~] **4.2 Fold the three provider tables into one.** `PROVIDER_CLI_META`, `PROVIDER_ENV_KEY` and `PROVIDER_KEY_FILE` are three parallel maps over the same key set (`src/scripts/_lib/environment_detector.ts:135-159`), so every provider addition is three edits and any one of them can be forgotten silently.
      verify: a test asserts that adding a provider requires exactly one edit — it constructs a provider absent from the table and asserts `knownProviders()`, the env-key lookup and the key-file lookup all fail together rather than partially.
      <!-- deferred-resolution: merged-into=road-to-gateway-harvest -->
      DEFERRED 2026-09-07, with the rest of Phase 4. The three-table fold exists to make ADDING a provider one edit, and the provider this phase would add is the gateway route the refusal declined; doing the refactor with no provider to add would be a speculative change to a shared table on a phase an owner blocker holds closed.
- [~] **4.3 Close the overlapping parked work this phase implements.** `later/road-to-gateway-harvest.md` M1 and `later/road-to-evidence-calibrated-model-orchestration.md:256` (the loopback-only local member class) describe capabilities 4.1 delivers; leaving both open means the same capability is planned twice.
      verify: both files carry a supersession note naming the step that implements them, and `lint_carrier_integrity` stays green.
      <!-- deferred-resolution: merged-into=road-to-gateway-harvest -->
      DEFERRED 2026-09-07. Its own verify makes the deferral mandatory rather than convenient: it asks both parked files to carry "a supersession note naming the step that implements them", and 4.1 implements nothing this round. Writing a supersession note for unwritten work would be the false green this roadmap's own discipline forbids. The parked files are left OPEN and undisturbed, which is what the blocker's "If you do nothing" line promised; `road-to-gateway-harvest.md` instead carries a dated NON-supersession — the slot was not spent — and the `relates:` link recording where the three steps went.

## Blockers

### blocker: gateway-seat-admission

- **Status:** resolved
- **Owner:** maintainer
- **Blocks:** Phase 4 — A route beyond the two seats that exist
- **Recommendation:** none; this is the owner's call — the capability is already argued and parked as `agents/roadmaps/later/road-to-gateway-harvest.md` M1, and only the owner can spend the slot that unparks it.
- **If you do nothing:** Phase 4 stays unopened — 4.1–4.3 remain unauthored, and the two overlapping parked roadmaps (`later/road-to-gateway-harvest.md` M1, `later/road-to-evidence-calibrated-model-orchestration.md`) stay open and undisturbed.
- **What to do:**
  1. Read `agents/roadmaps/later/road-to-gateway-harvest.md` M1 and decide whether to spend the slot it names on a route this package does not own.
  2. Record the decision (a line in that file, or a `docs/decisions/` entry) naming the date and, if authorized, the slot spent; if declined, record the refusal with the same specificity.
- **Resolved when:** a dated decision — authorizing or declining the gateway seat — is recorded in `later/road-to-gateway-harvest.md` or `docs/decisions/`, and this entry's `Status:` is flipped to `resolved` in the same edit.

**RESOLUTION 2026-09-07 — DECIDED, and the decision is a REFUSAL. The gateway slot
was NOT spent.** AI council, 2 seats (anthropic, openai), run 19 of 2026-09-06,
under the maintainer's standing delegation, on the framework that refusing a
proposal which would widen what this package transmits and to whom is
council-decidable *as preservation of the status quo*, while accepting one is not.

What was decided: **decline** to spend the slot on a route this package does not
own. The slot is preserved. `later/road-to-gateway-harvest.md` M1 stays parked and
undisturbed — nothing there is deleted, superseded, or re-scoped — and the dated
refusal is recorded in that file, which is the location this entry's own
`Resolved when:` names.

**Roadmap closure is not substantive resolution, and the two are separated here on
purpose.** What closed is this roadmap's DEPENDENCY on the question: Phase 4 stays
unopened, its three steps carry back to `road-to-gateway-harvest.md`, and the
roadmap can be completed without them. The QUESTION — should this package admit a
seat on an unowned route — stays open and is the owner's, exactly as before.

**Scope.** Not authorized in this round; current behaviour unchanged; no future
ruling prejudged. This is not "the project will never admit a gateway seat". The
condition that file already states ("the maintainer decides to spend a slot on
it") is unchanged and is still the only thing holding M1.

Phase 4 adds a council seat pointing at a route this package does not own. That capability is already argued and parked as `agents/roadmaps/later/road-to-gateway-harvest.md` M1, whose file states the one remaining condition in its own words: "the maintainer spends a slot on it." Admitting the seat here without that decision would relitigate a parked disposition from a different roadmap. It is owner-reserved rather than council-decidable because it widens what this package may transmit and to whom.

### blocker: free-seat-measurement-spend

- **Status:** resolved
- **Owner:** maintainer
- **Blocks:** Phase 3 — One pre-registered claim, on public artefacts only
- **Recommendation:** none; this is the owner's call — spend against the two reachable metered/subscription seats is Hard-Floor reserved and is never inferred from an open roadmap step.
- **If you do nothing:** Phase 3's measurement never runs; the pre-registered `free-jury-judge-agreement` claim stays filed with `status: unbacked` and is never resolved to a pass, a fail, or an honest null.
- **What to do:**
  1. Confirm the spend Phase 3's measurement would consume — which of the two reachable seats, and roughly how many calls across the ≥14-day shadow-only window in 3.3.
  2. Record the authorization (a line at this blocker, or a `docs/decisions/` entry) naming the date and the spend ceiling agreed, then flip `Status:` to `resolved`.
- **Resolved when:** a dated spend authorization (or a dated refusal) for Phase 3's measurement is recorded, and `Status:` is flipped in the same edit.

**RESOLUTION 2026-09-07 — DECIDED as a dated REFUSAL, which is one of the two
outcomes this entry's own `Resolved when:` accepts.** AI council, 2 seats, run 19
of 2026-09-06, under the maintainer's standing delegation.

**Decline** to consume either reachable metered/subscription seat this round. A
future request is not foreclosed, but it must specify four things this one did
not: **which seat**, an **estimated call count**, a **spend ceiling**, and a
**termination rule**. An open roadmap step is not a spend authorization, and the
Hard Floor that says so is untouched by this resolution.

**The honest outcome, published as such rather than worked around.** The
pre-registered `free-jury-judge-agreement` claim in `docs/CLAIMS.md` stays filed
`status: unbacked`. It is not a pass, not a fail, and not an honest null — it is
a question that was asked properly and has no answer yet, and the ledger's
`unbacked` status is exactly the word for that. Filing it as `resolved-null`
would claim a measurement was attempted and came back empty, which is false.

Consequence, accepted rather than avoided: step 3.3 cannot run, and it is
`[~]` deferred with its carrier rather than ticked. Steps 3.1 and 3.2 were NOT in
this position and are done — the claim is filed and the aggregator is built, so
the measurement has both something to run and something to answer whenever a
future authorization arrives.

**Scope.** Not authorized in this round; current behaviour unchanged; no future
ruling prejudged.

Phase 3's measurement calls the council, and the council's two reachable seats are metered or subscription-consuming. Spend is owner-reserved by the Hard Floor and is never inferred from a roadmap step being open.

### blocker: free-seat-estate-slot

- **Status:** resolved
- **Owner:** maintainer
- **Blocks:** nothing in this roadmap — it gates whether this roadmap keeps its own trunk or folds into a sibling file, a bookkeeping decision outside these phases.
- **Recommendation:** none; this is the owner's call — the estate-budget decision needs the estate gate run on the actual adopting change, not a prediction made here.
- **If you do nothing:** the roadmap stays adopted as its own file (`active_roadmaps` 1 → 2), which is not itself a problem, but the standalone-vs-fold-in choice against `road-to-council-topology-evidence-followups.md` stays undecided and is re-litigated at the next estate review.
- **What to do:**
  1. Run the estate gate on the actual adopting commit to get the measured growth figure, rather than the prediction stated here.
  2. Decide standalone trunk vs. fold-in and record the decision (a note in this file, or in `road-to-council-topology-evidence-followups.md`), then flip `Status:` to `resolved`.
- **Resolved when:** the standalone-vs-fold-in decision is recorded with the measured growth figure from the estate gate, and `Status:` is flipped in the same edit.

**RESOLUTION 2026-09-07 — DECIDED: standalone.** AI council, 2 seats, run 19 of
2026-09-06, under the maintainer's standing delegation. The placement note is
folded into `road-to-council-topology-evidence-followups.md`, the file this entry
names as the fold-in alternative.

**MEASURED, not predicted — and the prediction was wrong, which is why the
disposition required a measurement on the actual adopting change.** This entry
predicted `active_roadmaps` 1 → 2. Measured on the real adopting commit
`708b57545` ("docs(roadmaps): add road-to-admissible-council-seats", 2026-09-05):
top-level roadmaps under `agents/roadmaps/` went **7 → 8, delta +1**. The levels
were wrong; the delta was right. On the branch that completes and archives this
roadmap, `./scripts-run src/scripts/check_estate_count` reports the estate
**within its ratchet** and the archival returns the slot — a net **−1** active
roadmap, so the roadmap pays back what it took.

**Why standalone.** `road-to-council-topology-evidence-followups.md` is a
`status: carrier` receiver whose whole purpose is to give 38 deferred items from
one specific parent a verifiable destination. Absorbing an unrelated,
independently-scoped roadmap into it would make that inventory unreadable and
would put completed work inside a file whose reason to exist is that its items
are not done.

**Scope.** This settles placement and nothing else. It is a bookkeeping decision
outside these phases, exactly as the entry's `Blocks:` line says.

The active estate holds one roadmap at HEAD. Adopting this one moves `active_roadmaps` 1 → 2; whether it earns its own trunk or folds into `road-to-council-topology-evidence-followups.md` is an estate-budget decision, and the growth figure must be measured with the estate gate on the adopting change rather than predicted here.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-05 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A working api transport lets a seat spend where none could before | implementation | Three providers currently fail closed by accident — the constructor throws. Repairing that removes an unintended cost barrier for anyone who has a key configured | The USD gate in `budget_guard.ts` and the per-provider daily cap in `cli_call_budget.ts` both predate this change and both apply; 1.1 adds no new provider and changes no cap | Phase 1 — Repair the transports the council already claims |
| 2 | The carrier fix turns a silent path into an automatic one | implementation | Making the nudge hook emit on rung-3/4 could be read as authorising an automatic council spawn | 1.3's output is a pointer line only; the verify fixture asserts a line, never a spawn, and the spend floor is unchanged | Phase 1 — Repair the transports the council already claims |
| 3 | A new refusal vocabulary defaults open instead of closed | implementation | Adding reasons without changing the default leaves the unknown case resolving to available, which is the failure the phase exists to prevent | 2.1's verify asserts the unproven case resolves absent, not available | Phase 2 — Make a refusal sayable before making a seat admissible |
| 4 | The jury claim is written so it cannot fail | product | A pre-registered claim whose bar is set after seeing data is not evidence, and this package has recorded that failure shape before | 3.1 requires the pre-registration commit to precede the measurement commit, and the honest-null path is written into the claim text | Phase 3 — One pre-registered claim, on public artefacts only |
| 5 | Scoring quietly becomes deciding | product | A jury score that a gate begins consuming turns an evaluation aid into a verdict carrier, contradicting the role boundary 2.3 records | 3.3 is shadow-only with a no-behaviour-change verify, and 2.3's ADR states the boundary before any consumer exists | Phase 3 — One pre-registered claim, on public artefacts only |
| 6 | A public-artifact ceiling leaks project content through a helper | implementation | The ceiling is only as good as the paths that respect it; a caller that bypasses the resolver sends content the attribute forbids | 2.2's verify exercises the refusal from the resolver, and the existing secret-scan floor stays underneath it rather than being replaced | Phase 2 — Make a refusal sayable before making a seat admissible |
| 7 | Phase 4 duplicates a capability another roadmap owns | implementation | Two parked roadmaps already describe a `base_url` seat and a loopback member class; building here without closing them plans the same work twice | 4.3 supersedes both in the same change, and the phase is held by an owner blocker until the ownership question is settled | Phase 4 — A route beyond the two seats that exist |

## Acceptance Criteria

- [x] AC-1 — Every provider in `_VALID_PROVIDERS` produces a `CouncilResponse` under `mode: api` in test; no constructor path reaches a package-not-installed error. <!-- 1.1 · `tests/scripts/ai_council/api_transport.test.ts`, incl. an explicit `not.toThrow(/package not installed/)` over all three repaired constructors; anthropic + openai already had live transports. -->
- [x] AC-2 — The shipped council template states, for the seat it disables, either a dated probe outcome or a named honest null. <!-- 1.2 · gemini `disabled_reason`, dated 2026-09-07, an honest null naming the unestablished headless contract; test asserts a date OR the words `honest null`, plus that the null names what it could not establish. -->
- [x] AC-3 — A resolved rung-3 or rung-4 verdict produces output on the runtime carrier; none is discarded silently. <!-- 1.3 · `classifyPrompt` returns a result for both verdicts and `buildNudgeLine` emits a pointer line per rung; sabotage probe confirmed the old collapse. -->
- [x] AC-4 — A route can be refused for a policy reason, that reason is machine-readable, and `council:status` prints it. <!-- 2.1 · six `PolicyExclusion` values on `AbsentReason`; `policy <seat>: <reason>` on the human surface and `absent_reason` / `policy_exclusion` in `--json`. -->
- [x] AC-5 — Project content cannot reach a seat whose content ceiling is public artefacts, and the refusal is a green path, not an error. <!-- 2.2 · `admitsContent` refuses exactly that pairing; the resolver returns `available: false`, and the test asserts `.not.toThrow()` on the same call. -->
- [x] AC-6 — A decision record states that a route this package did not pay for may propose and may score but may never decide, and `evaluator-independence` cites it. <!-- 2.3 · ADR-257 (accepted, `reopen_policy: directional`); cited at `src/rules/evaluator-independence.md:148` and carried into the projection. -->
- [x] AC-7 — One jury-agreement claim stands in `docs/CLAIMS.md` with a pre-registration date preceding every measurement commit and an honest-null path written into it. <!-- 3.1 · `free-jury-judge-agreement`, `status: unbacked`, 2026-09-07. There is no measurement commit to precede — the spend was declined — so the ordering holds by construction rather than by luck. The honest-null path is written scoped rather than 'permanent'; see the step note. -->
- [x] AC-8 — The aggregator refuses a single-family panel and returns a trimmed statistic rather than a vote count. <!-- 3.2 · `juryAggregate` returns `absentReason: 'single_family'`; `method: 'trimmed-mean'` with the trim count reported, and the result shape carries no vote field. -->
- [~] AC-9 — No production surface consumes a jury score while the shadow ledger is accumulating.
      <!-- deferred-resolution: merged-into=road-to-governed-evidence-production -->
      DEFERRED with 3.3, whose ledger this criterion is about. No ledger is accumulating, so ticking this would be vacuous — the condition it states cannot be observed. What IS established today, and is the half worth having early, is the stronger property the criterion presumes: `tests/scripts/ai_council/jury_aggregate.test.ts` greps `src/` and asserts that NOTHING outside the module and its own tests imports `jury_aggregate`, so no production surface consumes a jury score at all. That test travels with the carrier.
- [~] AC-10 — No capability in this roadmap is also open in a parked roadmap; each overlap is superseded in the change that implements it.
      <!-- deferred-resolution: merged-into=road-to-gateway-harvest -->
      DEFERRED with Phase 4, which is the only phase carrying an overlap. Its second clause is why this cannot be ticked: "each overlap is superseded in the change that implements it", and the refusal means no change implements one. The overlap is instead RESOLVED IN THE OTHER DIRECTION — the three steps are merged back into `later/road-to-gateway-harvest.md` M1 and are no longer planned here, so the capability is open in exactly one file. That is the criterion's intent satisfied by a different route than its text describes, which is a deferral rather than a pass.
