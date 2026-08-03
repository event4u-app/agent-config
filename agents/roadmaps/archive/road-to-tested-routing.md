---
complexity: structural
status: ready
execution:
  mode: autonomous
---

# Roadmap: Road to tested routing

> Make rule/hook routing AND agent-orchestration routing deterministically
> testable end-to-end (live doctor, composed-chain tests, per-rule and
> per-dispatch coverage matrices), fix the matcher's root-cause defect, add
> budget-aware cheap-request delegation, and close the active-routing question
> with a superseding decision record that carries a falsifiable reopen trigger.

## Goal

Every routing layer this package controls (projection, trigger matching, hook
dispatch, settings gates, subagent/council/team dispatch, model-tier
selection) is covered by a deterministic test or a live doctor probe; a cheap
request on an expensive host is delegated to the cheapest adequate tier WITH
available budget (never blocking work when only the strong tier has budget);
and the "active runtime router" question is decided by recorded evidence
instead of recurring as a complaint.

## Context

A delivery failure (session-canary hook gate read only the project settings
layer while the name lived user-globally) exposed that no test runs against
the live installation and no test covers the composed session_start chain.
A full architecture map (2026-08-03) confirmed: there is no runtime router —
`dist/router.json` is consumed offline only; on Claude Code all in-scope rules
project full-bodied and activation is model judgment; the hook layer is the
only deterministic runtime routing and its per-concern self-gates are exactly
where the bug lived.

**Council convergence (AI council, claude-sonnet-4-5 + gpt-4o, 2 rounds,
2026-08-03):** both members converged AGAINST building the pre-registered
layer-1 resolver now and FOR hardening the declarative pipeline: (1) the
resolver's "intelligence" is the same lexical matcher the declarative pipeline
uses — if word-boundary anchoring makes matching good enough for the
resolver's recall floor, it makes declarative routing good enough without
resolver overhead; (2) validation must precede infrastructure — coverage data
first, resolver only if that data shows systematic failure; (3) the failure
asymmetry (under-injection silently drops a guardrail) means kernel + tier-1
must stay always-loaded under ANY future resolver; (4) LLM evals never gate —
deterministic replay is the verdict instrument. Dissent recorded: one member
initially argued injection-on-match differs materially from the nulled
thin-pointer variant; it withdrew this in round 2 for the build-now question,
retaining it only as framing for the reopen condition.

Prior decisions honored, not relitigated: ADR-054 (adherence restate —
rejected on an honest null; different mechanism, untouched), the
thin-projection null (36.2% vs 48% floor), and
`internal/bench/layer1-resolver-PREREG.md` (T1–T4 thresholds + P1–P3
preconditions stay the binding bar for any future spike).

## Prerequisites

- [x] Read `docs/contracts/rule-router.md`, `docs/contracts/kernel-membership.md`, `internal/bench/layer1-resolver-PREREG.md`, and `src/scripts/hooks/dispatch_hook.ts` (`_resolve_concerns`, stdout contract). <!-- done 2026-08-03 during the run -->

## Phase 1 — Trust floor: live doctor + composed-chain tests

The two surfaces that would have caught the canary bug in seconds.

- [x] `routing:doctor` CLI command (dispatcher-wired, read-only): against the LIVE installation report (a) host hook registration (e.g. SessionStart entry in the host settings), (b) dispatch bundle reachability, (c) the manifest concern chain for the detected platform, (d) per-session_start-concern gate status WITH reason and the settings layer that decided it (e.g. `session-canary: ACTIVE for "X" (user-global identity)` / `INACTIVE — no name on project/global-settings/global-identity`), (e) projection + `dist/router.json` freshness. <!-- verify: npx vitest run tests/scripts/routing_doctor.test.ts --> <!-- done 2026-08-03: src/scripts/routing_doctor.ts (composes hooks_status + _resolve_concerns + CONCERN_REGISTRY probes over the PROBE_SAFE read-only set; stateful concerns explicitly not probed), dispatcher verb routing:doctor, 9/9 tests green, live run shows session-canary ACTIVE for "Matze" -->
- [x] Composed session_start chain test per hook-capable platform: run the real dispatcher against a fixture workspace + fixture `EVENT4U_CONFIG_HOME`, assert concern order, which concerns inject context, aggregate injected-context size against a declared budget, and per-gate settings-layer resolution (canary regression: project override beats global settings beats global identity). <!-- verify: npx vitest run tests/scripts/hooks/session_start_chain.test.ts --> <!-- done 2026-08-03: child-process dispatcher runs per platform (7 hook-capable), dry-run order-subsequence assertion, 20k-char empty-workspace context budget, 4-case canary layer matrix incl. the no-config incident case; 19/19 green -->
- [x] `lint_hook_manifest` gets real assertions (today: one missing-file check) — chain names resolve to registry entries, platform×event tables well-formed, `fail_closed` values match the registry. <!-- done 2026-08-03: 6 red-fixture cases (schema_version, ghost concern, missing script, unknown platform, dead-concern warn/strict, missing file) + shipped-manifest green + bound-concern↔CONCERN_REGISTRY completeness; 8/8 -->
- [x] Doctor documented in the command docs; `routing:doctor` listed from the README troubleshooting path. <!-- done 2026-08-03: dispatcher --help block + README § Troubleshooting routing paragraph (routing:doctor vs hooks:doctor split named) -->

Exit criteria: doctor exits 0 on this machine and prints a gate table naming
every session_start concern with an ACTIVE/INACTIVE reason; chain tests green
on all platforms in `hook_manifest.yaml`; canary layer-resolution pinned.
Rollback: doctor is additive (new command) — remove the dispatcher wiring;
chain tests are test-only.

## Phase 2 — Coverage corpus: per-rule routing matrices

Generalize the ROUTING_MATRIX pattern (today: 1 of ~97 trigger-carrying
rules) into data-driven per-rule matrices. This corpus is ALSO the
layer1-resolver PREREG P2 precondition (≥ 50 labelled non-kernel rule ids),
so the resolver question becomes decidable by data either way.

- [x] Matrix format + runner: per-rule YAML (positive prompts EN + DE, pinned near-misses that must stay silent, optional open_files), executed against the real matcher (`router_telemetry.trigger_matches`) + the rule's real frontmatter. <!-- verify: npx vitest run tests/scripts/routing_matrix.test.ts --> <!-- done 2026-08-03: tests/eval/routing-matrix/*.yaml + README (schema) + tests/scripts/routing_matrix.test.ts (integrity, verdicts, tier-1 hard floor, tier-2 ratchet), 52/52 green -->
- [x] Author matrices for ALL tier-1 rules (24) — floor: ≥ 3 positives + ≥ 2 near-misses each; failures are hard test failures. <!-- done 2026-08-03: 24/24 tier-1 ids covered, 78 positives (≥1 German each) / 48 near-misses, verified against the real matcher -->
- [x] Author matrices for tier-2 rules — presence ratchet (count only rises), starting with every rule that carries `enforced_by: hook:*` or a safety-adjacent pack. <!-- done 2026-08-03: FULL tier-2 coverage 73/73 (subagents + 7 hand-authored after two agent crashes), ratchet TIER2_MATRIX_FLOOR=73; 198/198 green -->
- [x] Label `intended_triggers` into `internal/bench/corpora/router-coverage/` from the same data until ≥ 50 distinct non-kernel rule ids are covered (PREREG P2 satisfied or the shortfall documented with a power analysis). <!-- done 2026-08-03: generate_router_coverage_from_matrix.ts (two-gate: generator + --check drift gate) emits routing-matrix-derived.yaml — 302 prompts, 97 distinct rule ids (P2 bar was ≥50); lint-bench 8 corpora clean; also removed the dead telegraph-speak corpus row that failed lint -->
- [x] Baseline report: per-tier floor pass-rate + false-fire census (which near-misses currently route) committed as the pre-anchoring measurement. <!-- verify: npx tsx src/scripts/router_telemetry.ts --replay must emit the report --> <!-- done 2026-08-03: replay over 6 corpora (cap 400, profile full) → internal/bench/reports/router-telemetry/2026-08-03T07-09-11 + latest.json; unintended histogram documents the substring noise (markdown-safe-codeblocks 33, think-before-action 27, …) as the Phase-3 before-measurement -->

Exit criteria: every tier-1 rule has a green matrix or a documented trigger
fix; ≥ 50 non-kernel rule ids labelled; pre-anchoring baseline report exists.
Rollback: additive test data — delete matrices; no shipped behavior changes.

## Phase 3 — Matcher remediation: word-boundary anchoring as a measured change

The deliberately-parked durable repair. It changes shipped activation
semantics for all ~457 keyword triggers, so it lands alone, measured.

- [x] Implement word-boundary anchoring for `keyword` matching in the single shared matcher; define and document the `keyword` vs `phrase` distinction this creates (phrase stays substring). <!-- verify: npx vitest run tests/scripts/router_telemetry.test.ts --> <!-- done 2026-08-03: keyword_matches_anchored in router_telemetry.ts (Unicode word-chars; punctuation edges keep substring; optional plural-s relief); trigger_coverage.ts now imports the same helper — one matcher source of truth -->
- [x] Before/after over the Phase-2 corpus + telemetry replay, two hard bounds: the false-fire census count strictly decreases, and zero previously-passing matrix positives go silent — either bound violated reverts the change. <!-- verify: npx tsx src/scripts/router_telemetry.ts --replay comparison committed next to the Phase-2 baseline --> <!-- done 2026-08-03: unintended census 495 → 433 (−12.5%), 262/262 matcher-suite tests green, zero positives lost; reports 07-09-11 (before) + 07-22-38 (after) committed. Residual top false-firer markdown-safe-codeblocks (33×) is file_pattern-driven — keyword anchoring cannot touch it; noted as follow-up trigger tuning -->
- [x] Sweep rules whose triggers relied on substring behavior (the short-keyword set ratcheted at 22) — re-author as anchored keywords or explicit phrases; retire `lint_trigger_precision`'s budget if the anchor makes it obsolete. <!-- done 2026-08-03: sweep hit 8 matrix positives — 2 solved by the plural-s relief, 6 re-authored to standalone-token phrasings (German verb inflection = documented accepted recall cost). lint_trigger_precision KEPT, not retired: anchoring kills in-word false fires but exact-word short-keyword collisions ("ac" as a token) remain real; the ratchet still guards those -->
- [x] Update `docs/contracts/rule-router.md` matching-semantics section in the same change (also fix its stale `*.py` references). <!-- done 2026-08-03: § keyword-vs-phrase rewritten (anchored semantics, reliefs, before/after numbers, phrase = opt-out of anchoring); .py owner + check-router refs fixed -->

Exit criteria: anchored matcher shipped with committed before/after report
showing precision up, recall non-regressed; contract updated.
Rollback: single revert of the matcher change; matrices stay valid.

## Phase 4 — LLM-side diagnostics (advisory only, never gating)

- [x] Rules mode for the live trigger-eval harness: "which rules would you consult for this prompt" against the rule catalog, scored precision/recall against the Phase-2 matrices; `--dry-run` (MockRouter) covered by tests, live runs stay human-gated per the existing `/dev/tty` contract. <!-- verify: npx vitest run tests/scripts/skill_trigger_eval.test.ts --> (shipped as sibling `src/scripts/rule_trigger_eval.ts` + `tests/scripts/rule_trigger_eval.test.ts` — the pinned skill CLI and its /dev/tty gate are untouched)
- [x] Add the rules mode to the weekly cross-model canary rotation (advisory: a floor breach fails only the scheduled job, mirroring the skills mode).
- [x] Port the orphaned golden-outcomes scorer to TS (≤ 50 LOC, stdlib-only, per its original design) so `tests/golden/outcomes/*.json` execute again — or delete the corpus AND its two shipped citations in the same change; a cited-but-dead contract is the one forbidden state. <!-- verify: npx vitest run tests/golden/outcomes.test.ts (or citations grep returns zero) --> <!-- done 2026-08-03: faithful port of the recovered scorer.py into tests/golden/outcomes.test.ts (4/4 green; picked up by the Golden Tests CI job's tests/golden glob); README CI-entry updated; the shipped citations are true again -->

Exit criteria: rules mode runs dry in CI; weekly canary includes it; golden
outcomes either execute or are consistently removed.
Rollback: diagnostics are additive; remove the rotation entry.

## Phase 5 — Decision record: supersede ADR-040, close the loop

- [x] Author the superseding/amending ADR: corrects ADR-040's stale premise (hooks exist, with a latency budget), records the 2026-08-03 council verdict (declarative + tests now; resolver not built), and fixes the REOPEN trigger deterministically: if after Phase 3 ≥ 30% of tier-2 rules still fail their matrix floor, the layer-1 resolver spike runs per `internal/bench/layer1-resolver-PREREG.md` (T1–T4 unchanged) with two added invariants — kernel + tier-1 always full-bodied everywhere, and resolver failure fails open to eager. P1 (user_prompt_submit stdout transport) remains its own contract change if and only if the reopen fires. <!-- verify: npx tsx src/scripts/adr/regenerate_index.ts --dir docs/decisions --> <!-- done 2026-08-03: ADR-212 (amends ADR-040, quantified review_trigger, both invariants, weak-host + funded-run reopen paths); INDEX.md regenerated (151 numbered) -->
- [x] ADR-054 explicitly referenced as untouched (different mechanism: adherence vs delivery); the PREREG file gets a pointer to the new ADR under P3. Context note for the reopen path (anonymized per source-confidentiality): an external operator-runtime reference now ships semantic rule-shard retrieval with an always-include core-rules invariant — corroborates the PREREG's stance that IF the lexical ceiling is hit, semantic retrieval is the mechanism to evaluate, and that kernel-always-full is the industry-mirrored safety invariant. <!-- done 2026-08-03: ADR-212 § Status names ADR-054 untouched; PREREG § P3 marked CLEARED with the ADR-212 pointer + P2-satisfied note; landscape note inlined anonymized in ADR-212 § Context -->
- [x] Fix the stale consumer pointer `src/agent-src/templates/AGENTS.md` (`dist/agent-src/router.json` → `dist/router.json`). <!-- done 2026-08-03 -->

Exit criteria: ADR accepted into `docs/decisions/` with the reopen trigger
quantified; PREREG P3 pointer updated; stale references gone.
Rollback: ADR supersession is itself the recorded, reversible instrument —
a later ADR can supersede it.

## Phase 6 — Orchestration-routing coverage: which subagent, which council path, which tier

Scope discipline: this phase tests the ROUTING DECISIONS. The public
orchestration-adoption claim stays in
[`road-to-orchestration-scope-decision.md`](road-to-orchestration-scope-decision.md);
telemetry seeding stays in
[`road-to-subagent-value-realization-followup.md`](road-to-subagent-value-realization-followup.md).
Council locks honored: `subagents.auto` stays governed by `gateVerdict()`
(ADR-117 demotion gate) — no default flips ride with this phase.

- [x] Dispatch-decision matrices (same data-driven pattern as Phase 2): signals → expected decision for `classifyTask` (delegable? activation gate), `inferSliceTier` (lite/medium/high), and `resolveSubagentRouting` (which subagent type) — positive rows + pinned near-misses (e.g. trivial single-step tasks must NOT classify delegable). <!-- verify: npx vitest run tests/scripts/orchestration_routing_matrix.test.ts --> <!-- done 2026-08-03: tests/eval/orchestration-matrix/decisions.yaml (28 rows incl. 7 near-misses across classify/tier/routing/lookup) + runner; also covers classifyLookup primitives; 29/29 green -->
- [x] Council-path routing tests: `decision_resolution` class dispatch (low_impact fast-path vs high_impact vs user_required) pinned deterministically, including the fast-path marker contract and the "high_impact/user_required ALWAYS reach the user" invariant. <!-- verify: npx vitest run tests/scripts/council_dispatch_routing.test.ts --> <!-- done 2026-08-03: classify_impact row matrix (7 classes incl. DE fence), fence-beats-high-impact, LOCKED_IMPACT_CLASSES pinned, fast-path unavailable degrades loudly + marker shape; 14/14 -->
- [x] Guard coverage: failure-type stop (two verification-failed returns stop the type) and ordered-slice dependency gate have direct tests where missing. <!-- done 2026-08-03: already directly covered — tests/scripts/_lib_subagent_steering.test.ts (39 green) pins typeStop (N=3-derived, stop at 2 consecutive) and sliceDispatchAllowed (ordered-slice parent gate); no duplicate suite authored -->
- [x] `routing:doctor` orchestration section: report `subagents.enabled/auto`, host `subagent_spawn` capability, the tier map, cost-budget state, and a dry-run classification for a sample prompt ("this request would dispatch as: <mode>, tier <t>") — same ACTIVE/INACTIVE-with-reason shape as the hook section. <!-- verify: npx vitest run tests/scripts/routing_doctor.test.ts --> <!-- done 2026-08-03: collect_orchestration() (settings gates via load_agent_settings, normalizeHostManifest, real classifyTask activation probe with deciding-gate reason, cost.budgets + ledger presence, --classify dry-run over classifyLookup+classifyTask); 11/11 green -->

Exit criteria: dispatch matrices green for all three decision functions;
council-class invariants pinned; doctor explains a live dispatch decision.
Rollback: additive tests + doctor section; no shipped routing behavior changes.

## Phase 7 — Budget-aware cheap-request delegation (model-tier routing)

User mandate (2026-08-03): a "cheap" request on an expensive host (e.g. Fable
active) routes to a cheaper model to save tokens — PROVIDED budget for the
cheap tier exists; if the cheap tier has no budget but the strong tier does,
the strong tier is used. Work is never blocked to save money. Mechanism
boundary: the session model is never switched silently (that stays the user's
`/model` call) — routing happens as DELEGATION to a subagent with a model
override, which the delegation layer already owns.

- [x] Design note (contract-level, before code): <!-- done 2026-08-03: docs/contracts/budget-routing.md (relation, settings surface, mechanism requirements incl. atomic reserve + cool-down, v1 signal floor, owners) --> decision function `pickTier(classification, budgets)` — cheapest tier the classifier marks adequate AND with available budget; budget exhausted on cheap tier → next tier up; all budgets exhausted or signals unreadable → session model + surfaced notice (fail-open, never fail-closed on budget). Includes the quality floor: only task classes `classifyTask` marks cheap-adequate are ever delegated down. Three mechanism requirements: the budget check acquires its answer BEFORE the dispatch is created (pre-dispatch permit, no spend-then-check); the permit is an ATOMIC reserve against the ledger (sum + pending entry in one transaction — check-then-spend races two concurrent requests past the ceiling; council finding 2026-08-03); and a quota/rate-limit error from a tier trips a cool-down for that tier (pause, don't retry-loop) with automatic fallback to the next tier per the relation above.
- [x] Feasibility probe, committed as an evidence report: <!-- done 2026-08-03: agents/evidence/analysis/budget-signal-feasibility-2026-08.md — v1 floor = own ledger + declared per-tier ceilings + 429 cool-down; host quota + API headers verified NOT reliably readable, deferred --> which budget/quota signals are reliably readable per host (host usage surfaces, API billing signals, the package's own ledger `agents/cost-tracking/sessions.jsonl` + `cost.budgets` via `scripts/cost/budget.mjs`); the design consumes only signals the probe verified — declared per-tier budgets in settings are the portable floor.
- [x] Settings schema per council convergence (claude-sonnet-4-5 + gpt-4o, 2026-08-03): `cost.budgets.per_tier.{cheap,medium,strong}` with null defaults (null = no per-tier cap, feature gated by the global daily/weekly/monthly ceilings only) + the switch as `subagents.budget_routing: ask|auto|off`, shipped default `ask` — namespaced under the delegation subsystem, NOT a new top-level `routing.*` section, and NOT an overload of `subagents.downshift` (quality knob ≠ resource gate; dissent for downshift-consolidation recorded). A later default flip to `auto` follows the ADR-117 telemetry-gated pattern. The cost ledger gains a `tier` field; `scripts/cost/budget.mjs` sums per tier. <!-- verify: npx vitest run tests/server/schemas/parity.test.ts -->
- [x] Implementation in the dispatch path: <!-- done 2026-08-03: tier_budget_routing.ts (pickTier + acquireBudgetPermit atomic reserve + tripCooldown/readCooldowns), budget.mjs `tier` subcommand (ledger+reserve sum, rolling-24h), subagent-routing context § Policy step 4 wires the agent-side flow incl. the orchestration_record telemetry line --> budget check before tier choice; one telemetry line per routed request (reuse `orchestration_record`, provenance-tagged) so realized savings are measurable, not asserted. <!-- verify: npx vitest run tests/scripts/_lib_auto_dispatch.test.ts -->
- [x] Budget-relation test matrix (deterministic): <!-- done 2026-08-03: 14/14 green incl. the council race case (pending reserves counted), lock-busy conservative deny, cool-down expiry, quality floor --> cheap-adequate + cheap budget → cheap; cheap-adequate + cheap exhausted + strong available → strong; all exhausted → session model + notice; expensive-classified request → never downshifted regardless of budget. <!-- verify: npx vitest run tests/scripts/tier_budget_routing.test.ts -->
- [x] `routing:doctor` shows the live tier decision inputs: per-tier budget state, ledger freshness, and the switch value. <!-- done 2026-08-03: orchestration section reports budget_routing switch, per-tier ceilings + COOLING flags, ledger presence; 11/11 -->

Exit criteria: budget-relation matrix green; probe report names every signal
the implementation reads; doctor explains a tier decision end-to-end;
telemetry line emitted per routed request.
Rollback: `routing.cheap_delegation: off` restores today's behavior (single
settings flip); delegation layer unchanged when off.

## Acceptance criteria

- [x] `routing:doctor` answers "why did/didn't X fire" for every session_start concern on a live installation, with the deciding settings layer named. <!-- verified 2026-08-03 live: `session-canary: ACTIVE for "Matze" (user-global identity)`; canary hook reason now carries the deciding layer -->
- [x] The composed session_start chain and its per-gate layer resolution are pinned by tests on every hook-capable platform. <!-- 19/19, 7 platforms, 4-case layer matrix -->
- [x] 100% of tier-1 rules and ≥ 50 non-kernel rule ids have routing matrices; the tier-2 count only ratchets up. <!-- 24/24 tier-1 hard floor + 73/73 tier-2, ratchet 73; 97 labelled ids in the derived corpus -->
- [x] Keyword matching is word-boundary anchored with a committed before/after report (precision up, recall non-regressed). <!-- census 495→433, zero positives lost; both replay reports committed -->
- [x] LLM evals exist for rules AND remain advisory — no LLM judge in any gate path. <!-- rule_trigger_eval (dry 14/14) + weekly canary leg; floors advisory; /dev/tty gate untouched -->
- [x] The active-routing question is closed by an accepted decision record with a quantified, deterministic reopen trigger — not by silence. <!-- ADR-212; PREREG P3 cleared, P2 satisfied -->
- [x] Every orchestration routing decision (delegable?, tier, subagent type, council class) has a pinned decision matrix, and `routing:doctor` explains a live dispatch + tier decision with the deciding inputs named. <!-- 29/29 matrix + 14/14 council invariants; doctor orchestration section incl. --classify dry-run + tier budgets -->
- [x] Cheap-request delegation respects the budget relation (cheapest adequate tier with budget; strong tier when only it has budget; never blocked), is off-switchable with one settings flip, and emits telemetry per routed request. <!-- pickTier relation 14/14 incl. race + cool-down; subagents.budget_routing: off = single flip; telemetry line mandated in subagent-routing § Policy 4 -->
