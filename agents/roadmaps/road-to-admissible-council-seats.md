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

- [ ] **1.1 Give `_OpenAICompatibleClient` and `GeminiClient` a live transport.** Both constructors reach an unconditional `throw new Error('… package not installed. pip install …')` after the api-key check (`src/scripts/ai_council/clients.ts:854`, `:929`), so `mode: api` is dead for gemini, xai and perplexity. `OpenAIClient` already carries the pattern to copy — a `_curlJsonPost` shim installed as the `chat.completions.create` callable (`clients.ts:745-760`).
      verify: a unit test constructs each of `GeminiClient`, `XAIClient` and `PerplexityClient` with an `api_key` and an injected transport double, calls `ask()`, and receives a `CouncilResponse`; the test fails on the current tree with the `pip install` error.
- [ ] **1.2 Settle the Gemini CLI headless contract in the template, either way.** The seat ships `enabled: false` (`agents/templates/.ai-council.yml.example:394-395`) and the client comment records the contract as unverified because the run reached `IneligibleTierError` first (`clients.ts:2108-2121`). Either a dated probe result or an explicit honest null belongs in the template; an undated `enabled: false` teaches nothing.
      verify: the template's `gemini:` block carries either a dated probe outcome or a one-line honest null naming what could not be established, and `./scripts-run src/scripts/council_cli status` reports the seat with that reason rather than silently.
- [ ] **1.3 Make the runtime carrier carry rung-3 and rung-4 verdicts.** `src/scripts/hooks/delegation_nudge_hook.ts:440-441` returns `null` for every verdict that is not `subagent`, and its own comment names "rung-3/4 team/council" among what it discards — so a resolved council verdict produces no output on the only runtime carrier, recorded independently at `agents/evidence/analysis/council-intelligence-baseline.md:103-111`. The output is a pointer line naming `council_cli` / `ask_transport`, never an automatic spawn.
      verify: a fixture in which `classifyLadder` returns a rung-4 verdict makes `buildNudgeLine` emit a non-null line naming the council entry point; the same fixture returns `null` on the current tree.

## Phase 2 — Make a refusal sayable before making a seat admissible

- [ ] **2.1 Extend `AbsentReason` with the policy exclusions it cannot express.** The union is exactly four values — `no_binary | no_auth | timeout | quota` (`src/scripts/ai_council/transport_resolver.ts:65`) — all of which mean "the route is not reachable". A route that is reachable and must not be used has no name, so the resolver cannot fail closed on terms, privacy, unproven cost, or a served model that is not the requested one. Add the exclusion reasons and make the unknown case resolve to absent, never to available.
      verify: a unit test asserts each new reason round-trips through the resolver and appears in `council_cli status` output; a seat configured with an unproven-cost route resolves absent with that reason rather than available.
- [ ] **2.2 Add one binary content ceiling per seat.** Redaction today is a secrets floor and says so (`src/skills/ai-council/references/cost-and-redaction.md`); nothing above it can express "this project's diff may not go to that seat". One attribute — `public-artifact` or `project-content` — carries the decision. Repo-owned artefacts (skill descriptions, trigger corpus, rule text, bench fixtures) are `public-artifact`; everything a consumer supplies defaults to `project-content`.
      verify: a fixture sending consumer diff content to a `public-artifact` seat resolves absent with a content-ceiling reason and the run stays green; the same fixture sends a trigger-corpus fixture to the same seat and it is admitted.
- [ ] **2.3 Record the seat-role boundary as an ADR.** A route this package did not pay for may propose findings and may score them; it may never carry a verdict, chair, or act as evaluator. This narrows a recorded park — `agents/roadmaps/later/road-to-governed-evidence-production.md:269-301`, whose `metered-backend-park` was narrowed on 2026-09-01 to a metered proposer only — onto a second axis, so it is a decision record rather than a rule edit.
      verify: the ADR exists with `status`, `reopen_policy` and its basis set, `docs/decisions/INDEX` regenerates clean, and `src/rules/evaluator-independence.md` cites it by number.

## Phase 3 — One pre-registered claim, on public artefacts only

- [ ] **3.1 File one claim before any measurement runs.** `free-jury-judge-agreement`: on this package's own public evaluation corpus, a family-diverse panel scoring against known ground-truth dispositions reaches Cohen's κ ≥ 0.60, reusing the kappa machinery in `check_quality_regression.ts`. One claim, not two — the proposer-lift question is held behind `metered-backend-park` and is not filed here. The honest-null path is written into the claim: below the bar, the jury stays evaluation-only and no gate consumes it, permanently.
      verify: `docs/CLAIMS.md` carries the claim with `status: unbacked` and a pre-registration date, and the pre-registration commit precedes any commit that records a measurement.
- [ ] **3.2 Build the aggregator beside `consensus.ts`, not inside it.** At least two model families are required or the panel is absent; the aggregate is a trimmed mean or median, never a vote count — `docs/CLAIMS.md:522-531` records that a same-posture second vendor's catches were a strict subset of the first's, so counting agreeing voices measures redundancy. Position order swaps per judge, reusing `src/scripts/ai_council/judge_position_bias.ts`.
      verify: a unit test — a single-family panel returns absent with the family reason; a three-judge panel containing one corrupted score returns the trimmed value and not the arithmetic mean; the position-swap path is exercised and asserted.
- [ ] **3.3 Run it shadow-only, changing no behaviour.** A ledger records which seat would have been used and what it would have scored, on repo-owned public artefacts only, while every production surface keeps its current output.
      verify: at least fourteen days of ledger lines exist and a diff over the same window shows no production surface consuming a jury score.

## Phase 4 — A route beyond the two seats that exist

Every step in this phase is held by `blocker: gateway-seat-admission` below. None may be worked before an owner lifts it.

- [ ] **4.1 Add `base_url` to the config layer and a generic OpenAI-compatible route.** `_VALID_PROVIDERS` is closed at five names and `config.ts` contains no `base_url` at all (`src/scripts/ai_council/config.ts:88-94`; `grep -c base_url` returns 0), while the client class already has the field (`clients.ts:913`) — the gap is config, not transport. A route whose zero-cost property is not proven classifies `per-token`, so it stays inside the existing USD gate rather than escaping it. **corrected-from-reproduction:** this is `agents/roadmaps/later/road-to-gateway-harvest.md` M1, which is unprioritised and not blocked — its ADR-211 freeze was struck by ADR-216 on 2026-08-05, and neither ADR-088 nor ADR-249 governs it.
      verify: a config test — a member declaring `base_url` with no hard-stop evidence resolves to billing class `per-token`, and `council_cli status` names the route and its class.
- [ ] **4.2 Fold the three provider tables into one.** `PROVIDER_CLI_META`, `PROVIDER_ENV_KEY` and `PROVIDER_KEY_FILE` are three parallel maps over the same key set (`src/scripts/_lib/environment_detector.ts:135-159`), so every provider addition is three edits and any one of them can be forgotten silently.
      verify: a test asserts that adding a provider requires exactly one edit — it constructs a provider absent from the table and asserts `knownProviders()`, the env-key lookup and the key-file lookup all fail together rather than partially.
- [ ] **4.3 Close the overlapping parked work this phase implements.** `later/road-to-gateway-harvest.md` M1 and `later/road-to-evidence-calibrated-model-orchestration.md:256` (the loopback-only local member class) describe capabilities 4.1 delivers; leaving both open means the same capability is planned twice.
      verify: both files carry a supersession note naming the step that implements them, and `lint_carrier_integrity` stays green.

## Blockers

### blocker: gateway-seat-admission

- **Status:** open
- **Owner:** maintainer
- **Blocks:** Phase 4 — A route beyond the two seats that exist
- **Recommendation:** none; this is the owner's call — the capability is already argued and parked as `agents/roadmaps/later/road-to-gateway-harvest.md` M1, and only the owner can spend the slot that unparks it.
- **If you do nothing:** Phase 4 stays unopened — 4.1–4.3 remain unauthored, and the two overlapping parked roadmaps (`later/road-to-gateway-harvest.md` M1, `later/road-to-evidence-calibrated-model-orchestration.md`) stay open and undisturbed.
- **What to do:**
  1. Read `agents/roadmaps/later/road-to-gateway-harvest.md` M1 and decide whether to spend the slot it names on a route this package does not own.
  2. Record the decision (a line in that file, or a `docs/decisions/` entry) naming the date and, if authorized, the slot spent; if declined, record the refusal with the same specificity.
- **Resolved when:** a dated decision — authorizing or declining the gateway seat — is recorded in `later/road-to-gateway-harvest.md` or `docs/decisions/`, and this entry's `Status:` is flipped to `resolved` in the same edit.

Phase 4 adds a council seat pointing at a route this package does not own. That capability is already argued and parked as `agents/roadmaps/later/road-to-gateway-harvest.md` M1, whose file states the one remaining condition in its own words: "the maintainer spends a slot on it." Admitting the seat here without that decision would relitigate a parked disposition from a different roadmap. It is owner-reserved rather than council-decidable because it widens what this package may transmit and to whom.

### blocker: free-seat-measurement-spend

- **Status:** open
- **Owner:** maintainer
- **Blocks:** Phase 3 — One pre-registered claim, on public artefacts only
- **Recommendation:** none; this is the owner's call — spend against the two reachable metered/subscription seats is Hard-Floor reserved and is never inferred from an open roadmap step.
- **If you do nothing:** Phase 3's measurement never runs; the pre-registered `free-jury-judge-agreement` claim stays filed with `status: unbacked` and is never resolved to a pass, a fail, or an honest null.
- **What to do:**
  1. Confirm the spend Phase 3's measurement would consume — which of the two reachable seats, and roughly how many calls across the ≥14-day shadow-only window in 3.3.
  2. Record the authorization (a line at this blocker, or a `docs/decisions/` entry) naming the date and the spend ceiling agreed, then flip `Status:` to `resolved`.
- **Resolved when:** a dated spend authorization (or a dated refusal) for Phase 3's measurement is recorded, and `Status:` is flipped in the same edit.

Phase 3's measurement calls the council, and the council's two reachable seats are metered or subscription-consuming. Spend is owner-reserved by the Hard Floor and is never inferred from a roadmap step being open.

### blocker: free-seat-estate-slot

- **Status:** open
- **Owner:** maintainer
- **Blocks:** nothing in this roadmap — it gates whether this roadmap keeps its own trunk or folds into a sibling file, a bookkeeping decision outside these phases.
- **Recommendation:** none; this is the owner's call — the estate-budget decision needs the estate gate run on the actual adopting change, not a prediction made here.
- **If you do nothing:** the roadmap stays adopted as its own file (`active_roadmaps` 1 → 2), which is not itself a problem, but the standalone-vs-fold-in choice against `road-to-council-topology-evidence-followups.md` stays undecided and is re-litigated at the next estate review.
- **What to do:**
  1. Run the estate gate on the actual adopting commit to get the measured growth figure, rather than the prediction stated here.
  2. Decide standalone trunk vs. fold-in and record the decision (a note in this file, or in `road-to-council-topology-evidence-followups.md`), then flip `Status:` to `resolved`.
- **Resolved when:** the standalone-vs-fold-in decision is recorded with the measured growth figure from the estate gate, and `Status:` is flipped in the same edit.

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

- [ ] AC-1 — Every provider in `_VALID_PROVIDERS` produces a `CouncilResponse` under `mode: api` in test; no constructor path reaches a package-not-installed error.
- [ ] AC-2 — The shipped council template states, for the seat it disables, either a dated probe outcome or a named honest null.
- [ ] AC-3 — A resolved rung-3 or rung-4 verdict produces output on the runtime carrier; none is discarded silently.
- [ ] AC-4 — A route can be refused for a policy reason, that reason is machine-readable, and `council:status` prints it.
- [ ] AC-5 — Project content cannot reach a seat whose content ceiling is public artefacts, and the refusal is a green path, not an error.
- [ ] AC-6 — A decision record states that a route this package did not pay for may propose and may score but may never decide, and `evaluator-independence` cites it.
- [ ] AC-7 — One jury-agreement claim stands in `docs/CLAIMS.md` with a pre-registration date preceding every measurement commit and an honest-null path written into it.
- [ ] AC-8 — The aggregator refuses a single-family panel and returns a trimmed statistic rather than a vote count.
- [ ] AC-9 — No production surface consumes a jury score while the shadow ledger is accumulating.
- [ ] AC-10 — No capability in this roadmap is also open in a parked roadmap; each overlap is superseded in the change that implements it.
