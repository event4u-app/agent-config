<!-- evidence-type: analysis -->

# Council surface inventory — 2026-08-29

Step 0.2 of `road-to-inbox-harvest-2026-08-e-council-topology-evidence`.

**Read at:** the working tree of this branch on 2026-08-29. Every `evidence`
cell is a line this pass opened, or a directory it listed — not a citation
copied from a roadmap.

## Scope rule, stated before the table

A row is here when the surface **routes to, implements, governs, validates, or
stores the output of** the AI council. A file that merely *cites a past council
decision* as provenance ("council 2026-07-28 resolved …") is not a council
surface; those are enumerated under § Incidental mentions so that nothing is
silently dropped.

The eight category strings are fixed by the roadmap step and used verbatim:
`task-side routing` · `council-internal necessity` · `topology-depth` ·
`rendering` · `spend governance` · `replay-evidence` · `compatibility` ·
`dead-duplicate`.

**Two deliberate aggregations**, both named rather than hidden:
`tests/scripts/ai_council/` (46 files) and `agents/evidence/council/` (22 files)
are each one row. Every other row is one file.

## The table

| surface | kind | category | evidence | successor |
|---|---|---|---|---|
| `src/rules/council-availability.md` | rule | task-side routing | Iron Law: availability is decided by the CLI resolver, never the project tree; `agent-config council:status` is the probe — `src/rules/council-availability.md:9-17` | |
| `src/rules/decision-revisit-gate.md` | rule | task-side routing | `council_depth: deep` frontmatter and `skill:ai-council` in `routes_to` — `src/rules/decision-revisit-gate.md:6,19`; "RE-EVALUATION GOES TO THE COUNCIL FIRST, NOT TO THE USER FIRST" | |
| `src/rules/ask-when-uncertain.md` | rule | task-side routing | § Impact-based routing (AI Council): questions route per `decision_resolution` — `src/rules/ask-when-uncertain.md:56-58` | |
| `src/rules/legal-safety-floor.md` | rule | task-side routing | Iron Law: `legal_review_prep.require_council` true (default) ⇒ work-product via multi-model council, fail-closed — `src/rules/legal-safety-floor.md:69-73` | |
| `src/rules/roadmap-progress-sync.md` | rule | task-side routing | preservation test routes a `[~]` disposition to council vs owner — `src/rules/roadmap-progress-sync.md:55,66` | |
| `src/rules/delegation-policy.md` | rule | task-side routing | names `council-availability` as the incident the capability-provenance check exists for — `src/rules/delegation-policy.md:123-124` | |
| `src/rules/fast-path-marker-visibility.md` | rule | rendering | Iron Law: every low-impact fast-path reply opens with the exact marker, verbatim, English, once — `src/rules/fast-path-marker-visibility.md` (Iron Law block + § What "verbatim" means) | |
| `src/rules/low-impact-corpus-privacy-floor.md` | rule | replay-evidence | Iron Law: no entry leaves the repo until the redactor clears it; 8 forbidden-content classes; two gates (write, upstream) — `src/rules/low-impact-corpus-privacy-floor.md:5-30` | |
| `src/rules/evaluator-independence.md` | rule | replay-evidence | a self-commissioned council run is admissible as gate evidence only when the prompt is recorded with the verdict — `src/rules/evaluator-independence.md:39` and the Iron Law block | |
| `src/rules/persona-governance.md` | rule | topology-depth | governs the review-lens/persona set the advisor fan-out draws on; names `ai-council` as the merge/deprecation mechanism — `src/rules/persona-governance.md:52` | |
| `src/rules/no-roadmap-references.md` | rule | compatibility | council clause: no stable artifact links `agents/runtime/council/{questions,responses,sessions}/`; validator declared in frontmatter — `src/rules/no-roadmap-references.md:4,17` | |
| `src/skills/ai-council/SKILL.md` | skill | task-side routing | § Council-first: "tree → council → user"; council leg is the one that gets skipped — `src/skills/ai-council/SKILL.md:20-40` | |
| `src/skills/ai-council/references/procedure.md` | skill | task-side routing | reference bundle of the invocation procedure — listed by `find src/skills/ai-council -type f` | |
| `src/skills/ai-council/references/execution-modes.md` | skill | compatibility | transport/execution-mode reference — same listing | |
| `src/skills/ai-council/references/advanced-modes.md` | skill | topology-depth | carries `council_depth` guidance for the deeper lenses — `grep -l council_depth src/skills/` hit | |
| `src/skills/ai-council/references/cost-and-redaction.md` | skill | spend governance | cost + redaction reference — same listing | |
| `src/skills/ai-council/references/output-and-synthesis.md` | skill | rendering | output/synthesis reference — same listing | |
| `src/skills/decision-review/SKILL.md` | skill | task-side routing | backward audit routes the lock re-evaluation to `ai-council` — `src/skills/decision-review/SKILL.md:297-300` | |
| `src/skills/adversarial-review/SKILL.md` | skill | task-side routing | `council_depth: deep` — `src/skills/adversarial-review/SKILL.md:8` | |
| `src/skills/agent-security-review/SKILL.md` | skill | task-side routing | `council_depth: deep` at `:8`; routes to `ai-council` at `:88,131` | |
| `src/skills/legal-practice-profile/SKILL.md` | skill | task-side routing | `council_depth: deep` at `:7`; § Council gate routes work-product through the council or `research:deep` — `:111-116` | |
| `src/skills/bug-analyzer/SKILL.md` | skill | task-side routing | `council_depth` frontmatter — `grep -l council_depth src/skills/` hit | |
| `src/skills/contract-review/SKILL.md` | skill | task-side routing | `council_depth` frontmatter — same probe | |
| `src/skills/dpa-review/SKILL.md` | skill | task-side routing | `council_depth` frontmatter — same probe | |
| `src/skills/legal-intake-triage/SKILL.md` | skill | task-side routing | `council_depth` frontmatter — same probe | |
| `src/skills/nda-triage/SKILL.md` | skill | task-side routing | `council_depth` frontmatter — same probe | |
| `src/skills/systematic-debugging/SKILL.md` | skill | task-side routing | `council_depth` frontmatter — same probe | |
| `src/skills/technical-specification/SKILL.md` | skill | task-side routing | `council_depth` frontmatter — same probe | |
| `src/skills/threat-modeling/SKILL.md` | skill | task-side routing | `council_depth` frontmatter — same probe | |
| `src/skills/subagent-orchestration/SKILL.md` | skill | topology-depth | Mode 9 `adversarial-verification-council`, default-off behind `subagents.adversarial_council` — `src/skills/subagent-orchestration/SKILL.md:102,217` | |
| `src/skills/recursive-verification/SKILL.md` | skill | task-side routing | routes the cross-vendor critic to `ai-council` — `src/skills/recursive-verification/SKILL.md:205` | |
| `src/domains/meta/council/command.md` | command | task-side routing | cluster orchestrator: "routes to default, pr, design, optimize, analysis, debate" — frontmatter `description` | |
| `src/domains/meta/council/default/command.md` | command | task-side routing | `name: council-default`, neutral framing, advisory output only — frontmatter | |
| `src/domains/meta/council/pr/command.md` | command | task-side routing | `name: council-pr`, PR-diff lens, read-only by default — `src/domains/meta/council/pr/command.md:3,9` | |
| `src/domains/meta/council/design/command.md` | command | task-side routing | `name: council-design`, design-doc/ADR lens — frontmatter | |
| `src/domains/meta/council/optimize/command.md` | command | task-side routing | `name: council-optimize` — `src/domains/meta/council/optimize/command.md:3,9` | |
| `src/domains/meta/council/analysis/command.md` | command | task-side routing | `name: council-analysis`, critiques a local analysis output — frontmatter | |
| `src/domains/meta/council/debate/command.md` | command | topology-depth | `name: council-debate`, multi-round with per-round spend confirmation — frontmatter `description` | |
| `src/domains/product-basic/roadmap/ai-council/command.md` | command | task-side routing | wraps `/council default` pinned to `--input-mode roadmap --depth deep`; `council_depth: deep` — `src/domains/product-basic/roadmap/ai-council/command.md:6-12` | |
| `src/domains/engineering-base/bug/fix/command.md` | command | task-side routing | `^council_depth:` frontmatter — `grep -l '^council_depth:' src/domains/` hit | |
| `src/domains/engineering-base/bug/investigate/command.md` | command | task-side routing | `^council_depth:` frontmatter — same probe | |
| `src/domains/engineering-base/security-audit-config/command.md` | command | task-side routing | `^council_depth:` frontmatter — same probe | |
| `src/domains/engineering-base/threat-model/command.md` | command | task-side routing | `^council_depth:` frontmatter — same probe | |
| `src/domains/meta/memory/learn-low-impact/command.md` | command | council-internal necessity | upstreams Validated corpus entries that let a decision skip a paid pass — `src/domains/meta/memory/learn-low-impact/command.md:25,61,105` | |
| `src/agent-src/commands/evals/council.json` | config | task-side routing | routing eval: 'council' expected for second-opinion prompts — `src/agent-src/commands/evals/council.json:2-3` | |
| `src/agent-src/contexts/execution/auto-dispatch-classification.md` | contract | task-side routing | rung 4 = council; § Relationship to the council's own necessity gate — `:75,98-104` | |
| `src/agent-src/contexts/execution/roadmap-execution-contract.md` | contract | task-side routing | contract screen prints the council roster; `deferred_policy` rows are council-decidable vs owner-reserved — `:79,145` | |
| `src/agent-src/personas/advisors/contrarian.md` | config | topology-depth | one of the five advisor lenses `advisors.ts` plans calls for — `ls src/agent-src/personas/advisors/` | |
| `src/agent-src/personas/advisors/executor.md` | config | topology-depth | same listing | |
| `src/agent-src/personas/advisors/expansionist.md` | config | topology-depth | same listing | |
| `src/agent-src/personas/advisors/first-principles.md` | config | topology-depth | same listing | |
| `src/agent-src/personas/advisors/outsider.md` | config | topology-depth | same listing | |
| `src/scripts/_lib/judgment_ladder.ts` | lib-module | task-side routing | "the ONE resolver that decides which of the five dispatch rungs (0-4), or the silent ∅"; ":16-20" never a fourth parallel classifier; ":21-24" deliberately independent of `ai_council/necessity.ts` — `src/scripts/_lib/judgment_ladder.ts:1-3,16-24` | |
| `src/scripts/_lib/one_resolver_invariant.ts` | lib-module | task-side routing | asserts syntactically that no module outside `judgment_ladder.ts` exports a router-named binding, that the resolver exports a callable one, and that the resolver imports no `ai_council` module — `:61-65`; explicitly asserts nothing needing symbol resolution `:66-69`; `SANCTIONED_RESOLVER` `:99`, `COUNCIL_INTERNAL_DIR` `:102`, `ROUTER_NAMES` `:122-126` | |
| `src/scripts/_lib/auto_dispatch.ts` | lib-module | task-side routing | `classifyTask` supplies rungs 1–2 that the ladder wraps; `SIZE_FLOOR = 1` — `src/scripts/_lib/auto_dispatch.ts:25-26` | |
| `src/scripts/hooks/delegation_nudge_hook.ts` | script | task-side routing | the only runtime carrier that calls `classifyLadder` `:424-430`, and it discards every non-`subagent` verdict including rung 4 — `:440-441` | |
| `src/scripts/explain_run.ts` | script | rendering | renders the ladder decision via `explainLadder` `:770` and cites the resolver as its source `:631` | |
| `src/scripts/_lib/adversarial_council_gate.ts` | lib-module | topology-depth | pure prove-or-drop verdict on the `adversarial-council-finding-coverage` claim for a cross-vendor skeptic panel — `src/scripts/_lib/adversarial_council_gate.ts:1-8` | |
| `src/scripts/_lib/council_fallback_posture.ts` | lib-module | compatibility | "would this seat have an api rung to fall back to?" for `council:status` — `src/scripts/_lib/council_fallback_posture.ts:1-3` | |
| `src/scripts/_lib/council_fallback_wiring.ts` | lib-module | compatibility | api-twin factory + event sink `build_members` hands the orchestrator — `src/scripts/_lib/council_fallback_wiring.ts:1-3` | |
| `src/scripts/_lib/council_settings_block.ts` | lib-module | compatibility | pure `CouncilConfig` → settings-dict projection — `src/scripts/_lib/council_settings_block.ts:1-2` | |
| `src/scripts/council_cli.ts` | script | topology-depth | resolves rounds (`_resolve_rounds` `:1609-1619`), depth `--depth {standard,deep}` `:3611`, `blind_chairman: true` default `:3551`, `_peer_review_active` `:1289-1295`, pass ordering `:2708-2751` | |
| `src/scripts/council_availability_hook.ts` | script | task-side routing | `session_start` concern carrying whether a council is configured and from where — `src/scripts/council_availability_hook.ts:1-8`; bound at `src/scripts/hook_manifest.yaml:491-492` | |
| `src/scripts/check_council_config_location.ts` | script | compatibility | CI guard: council config lives in `.ai-council.yml`, never `.agent-settings.yml` — `src/scripts/check_council_config_location.ts:3`; wired `taskfiles/content.yml:315-318` | |
| `src/scripts/check_council_layout.ts` | script | compatibility | CI guard for the `ai-council` skill's output-path convention — `src/scripts/check_council_layout.ts:3`; wired `taskfiles/content.yml:310-313` | |
| `src/scripts/check_council_references.ts` | script | compatibility | CI guard for the council clause of `no-roadmap-references` — `src/scripts/check_council_references.ts:3`; wired `taskfiles/ci-fast.yml:1876-1879` | |
| `src/scripts/check_council_pin_staleness.ts` | script | compatibility | gate that notices an aged council model pin; corpus = members carrying `model:` in the template — `src/scripts/check_council_pin_staleness.ts:3-9`; registered `src/config/gate-coverage.yml:756-763` | |
| `src/scripts/check_one_off_location.ts` | script | compatibility | every `_one_off_*.py` must live under `src/scripts/ai_council/one_off_archive/<YYYY-MM>/` — `src/scripts/check_one_off_location.ts:11-14`; wired `taskfiles/ci-fast.yml:1988-1991` | |
| `src/scripts/council_attendance_metrics.ts` | script | replay-evidence | replays the four registered attendance metrics over an events log — `src/scripts/council_attendance_metrics.ts:3-8` | |
| `src/scripts/council_parse_rate.ts` | script | replay-evidence | findings-parse outcome rates over the recorded fixture corpus — `src/scripts/council_parse_rate.ts:3-7` | |
| `src/scripts/council_prune.ts` | script | replay-evidence | deletes council artefacts older than `ai_council.session_retention_days` (default 7) across four dirs — `src/scripts/council_prune.ts:7-9`; wired `taskfiles/content.yml:384-386` | |
| `src/scripts/bench_adversarial_council.ts` | script | replay-evidence | two-stage residual-detection benchmark runner for the finding-coverage claim — `src/scripts/bench_adversarial_council.ts:2-8` | |
| `src/scripts/test_council_qualification.ts` | script | replay-evidence | executable probe: a broken seat yields `unavailable`, and a run reports short instead of printing a quorum — `src/scripts/test_council_qualification.ts:2-8` | |
| `src/scripts/ai_council/necessity.ts` | lib-module | council-internal necessity | heuristic pre-flight; three verdicts drive skip / educate / proceed — `src/scripts/ai_council/necessity.ts:1-6` | |
| `src/scripts/ai_council/low_impact.ts` | lib-module | council-internal necessity | narrows the fan-out to opted-in members, caps spend at the fast-path budget, stamps a transparency marker — `src/scripts/ai_council/low_impact.ts:1-8` | |
| `src/scripts/ai_council/low_impact_corpus.ts` | lib-module | council-internal necessity | hardened parser for `agents/decisions/low-impact-decisions.md` — `src/scripts/ai_council/low_impact_corpus.ts:2` | |
| `src/scripts/ai_council/low_impact_intake.ts` | lib-module | council-internal necessity | intake trigger + dedup, pure-text deterministic — `src/scripts/ai_council/low_impact_intake.ts:2-5` | |
| `src/scripts/ai_council/compile_corpus.ts` | lib-module | council-internal necessity | compiles the human-edited corpus markdown to a YAML lockfile — `src/scripts/ai_council/compile_corpus.ts:2`; wired `taskfiles/content.yml:146,151` | |
| `src/scripts/ai_council/probation_gate.ts` | lib-module | council-internal necessity | promote-and-prune for the low-impact corpus — `src/scripts/ai_council/probation_gate.ts:2` | |
| `src/scripts/ai_council/learn_low_impact_preview.ts` | lib-module | council-internal necessity | preview builder for `/memory learn-low-impact` — `src/scripts/ai_council/learn_low_impact_preview.ts:2` | |
| `src/scripts/ai_council/confidence_gate.ts` | lib-module | council-internal necessity | defense-in-depth on shadow SLO: a single member signalling uncertainty escalates — `src/scripts/ai_council/confidence_gate.ts:2-7` | |
| `src/scripts/ai_council/solo_dispatch.ts` | lib-module | council-internal necessity | picks the first enabled, auth-valid member from `routing.solo_member_fallback_chain` — `src/scripts/ai_council/solo_dispatch.ts:2-6` | |
| `src/scripts/ai_council/shadow_dispatch.ts` | lib-module | council-internal necessity | shadow-mode dispatch for low-impact solo-member decisions — `src/scripts/ai_council/shadow_dispatch.ts:2` | |
| `src/scripts/ai_council/orchestrator.ts` | lib-module | topology-depth | sequential fan-out (`:8-12`), `consult` round loop `:438`, `run_debate` `:1300` with `max_rounds` default 2 `:1240`, debate suffix `:1040-1043` | |
| `src/scripts/ai_council/debate_gates.ts` | lib-module | topology-depth | pure novelty (Jaccard ≥ 0.8, `:14-15,32-41`) and dissent-quota (2, `:17-18,60-62`) detectors; repair cap ≤ 1/member/round `:73-89` | |
| `src/scripts/ai_council/argument_exhaustion.ts` | lib-module | topology-depth | four-conjunct stop predicate `evaluateStop`; `MIN_ROUNDS` 2 `:46`; **not imported by any production module** — see § Notes | |
| `src/scripts/ai_council/blind_review.ts` | lib-module | topology-depth | deterministic sha256 label shuffle `:42-46,60-71`; de-anonymisation restored after the verdict `:79-87` | |
| `src/scripts/ai_council/chairman.ts` | lib-module | topology-depth | pure selection; a member that deliberated cannot chair, falls back to host with a visible annotation — `src/scripts/ai_council/chairman.ts:59-65` | |
| `src/scripts/ai_council/consensus.ts` | lib-module | topology-depth | per-finding `consensus_strength = mean(score)/10 × agreement_rate` `:151,196-198`; strong 0.7 / minority 0.4 `:43-44` | |
| `src/scripts/ai_council/stance_tally.ts` | lib-module | topology-depth | option-level tally; `CONSENSUS_FRACTION = 2/3` `:24`; `consensus` null on a split, never a forced winner `:46,205-207` | |
| `src/scripts/ai_council/advisors.ts` | lib-module | topology-depth | thinking-style advisors, replace-mode call planning — `src/scripts/ai_council/advisors.ts:2` | |
| `src/scripts/ai_council/seating.ts` | lib-module | topology-depth | "Selection today is config-static ask-all: every enabled member, every question, no per-question seating" — `src/scripts/ai_council/seating.ts:4-6` | |
| `src/scripts/ai_council/quorum.ts` | lib-module | topology-depth | `k`-of-`n` present ⇒ concluded, else inconclusive `:100-103`; deliberately does not decide what to DO with inconclusive `:9-10` | |
| `src/scripts/ai_council/quorum_wiring.ts` | lib-module | topology-depth | the seam between pure quorum arithmetic and the CLI — `src/scripts/ai_council/quorum_wiring.ts:2-6` | |
| `src/scripts/ai_council/prompts.ts` | lib-module | topology-depth | neutrality system prompts `:1-6`; `DEBATE_MODE` steel-man `:154-156`; stance grammar `:174-176`; `ANTI_CONFORMITY_DIRECTIVE` `:180` | |
| `src/scripts/ai_council/modes.ts` | lib-module | compatibility | pure transport-mode resolver; `VALID_MODES = {api, manual, cli, auto}` `:60`, fallback `manual` `:67` | |
| `src/scripts/ai_council/transport_resolver.ts` | lib-module | compatibility | resolves `mode: auto` plus the two guards that keep it honest — `src/scripts/ai_council/transport_resolver.ts:2-3` | |
| `src/scripts/ai_council/qualification.ts` | lib-module | compatibility | exists because a seat reported `CONFIGURED` while dead and the pass printed a quorum it never reached — `src/scripts/ai_council/qualification.ts:4-6` | |
| `src/scripts/ai_council/qualification_wiring.ts` | lib-module | compatibility | the seam turning a resolved qualification into CLI behaviour — `src/scripts/ai_council/qualification_wiring.ts:2-6` | |
| `src/scripts/ai_council/probe_store.ts` | lib-module | compatibility | "the only thing that observes" for provider qualification — `src/scripts/ai_council/probe_store.ts:2-7` | |
| `src/scripts/ai_council/mid_flight_fallback.ts` | lib-module | compatibility | the cli→api retry's types, establish step and response stamp — `src/scripts/ai_council/mid_flight_fallback.ts:2-3` | |
| `src/scripts/ai_council/fallback_config.ts` | lib-module | compatibility | the two question-ladder config surfaces kept out of `config.ts` — `src/scripts/ai_council/fallback_config.ts:2-5` | |
| `src/scripts/ai_council/airgap.ts` | lib-module | compatibility | airgap detection for the installer / first-run — `src/scripts/ai_council/airgap.ts:2` | |
| `src/scripts/ai_council/clients.ts` | lib-module | compatibility | external-AI clients; tokens exclusively from `~/.event4u/agent-config/<provider>.key` — `src/scripts/ai_council/clients.ts:1-6` | |
| `src/scripts/ai_council/config.ts` | lib-module | compatibility | config loader, single source of truth; `min_rounds: 2` `:1510`, `deep_min_rounds: 3` `:1511`, `debate_gates.enabled` default `false` `:1118` | |
| `src/scripts/ai_council/cli_agency_bounds.ts` | lib-module | compatibility | "a council member is a text-in/text-out oracle … never edits, never runs a command" — `src/scripts/ai_council/cli_agency_bounds.ts:4-6` | |
| `src/scripts/ai_council/cli_least_agency_canary.ts` | lib-module | compatibility | construction gate answering "does the vendor CLI actually HONOUR the agency bound" — `src/scripts/ai_council/cli_least_agency_canary.ts:3-7` | |
| `src/scripts/ai_council/py_parity.ts` | lib-module | compatibility | Python-stdlib parity helpers shared by the council modules — `src/scripts/ai_council/py_parity.ts:2-3` | |
| `src/scripts/ai_council/py_format.ts` | lib-module | compatibility | Python-format helpers whose messages `config.ts`/`clients.ts` raise — `src/scripts/ai_council/py_format.ts:2-6` | |
| `src/scripts/ai_council/_py_json.ts` | lib-module | compatibility | Python-compatible JSON serialisation, byte-parity golden against the deleted Python twin — `src/scripts/ai_council/_py_json.ts:1-6` | |
| `src/scripts/ai_council/spend_gate.ts` | lib-module | spend governance | "the ceilings, the breach decision, and the event a breach raises" — `src/scripts/ai_council/spend_gate.ts:2` | |
| `src/scripts/ai_council/budget_guard.ts` | lib-module | spend governance | per-day rolling cost-budget guard — `src/scripts/ai_council/budget_guard.ts:2` | |
| `src/scripts/ai_council/cli_call_budget.ts` | lib-module | spend governance | the daily counter's durability layer + the one authority resolving a per-provider cap — `src/scripts/ai_council/cli_call_budget.ts:1-2` | |
| `src/scripts/ai_council/pricing.ts` | lib-module | spend governance | runtime pricing layer — `src/scripts/ai_council/pricing.ts:2` | |
| `src/scripts/ai_council/_default_prices.ts` | lib-module | spend governance | shipped baseline prices; values, ordering and `as_rows()` pinned by tests — `src/scripts/ai_council/_default_prices.ts:2-6` | |
| `src/scripts/ai_council/response_render.ts` | lib-module | rendering | the per-member meta line and the one-call helper — `src/scripts/ai_council/response_render.ts:2` | |
| `src/scripts/ai_council/orchestrator_results.ts` | lib-module | rendering | the two result bundles `orchestrator.ts` returns — `src/scripts/ai_council/orchestrator_results.ts:2` | |
| `src/scripts/ai_council/handoff.ts` | lib-module | rendering | machine-readable `HandoffEnvelope` — decision, rejected alternatives — `src/scripts/ai_council/handoff.ts:2-8` | |
| `src/scripts/ai_council/bundler.ts` | lib-module | rendering | context bundling for council consultations — `src/scripts/ai_council/bundler.ts:2` | |
| `src/scripts/ai_council/project_context.ts` | lib-module | rendering | lightweight project-context detector for the handoff preamble — `src/scripts/ai_council/project_context.ts:2` | |
| `src/scripts/ai_council/cli_help.ts` | lib-module | rendering | sub-help rendering for the council CLI — `src/scripts/ai_council/cli_help.ts:2` | |
| `src/scripts/ai_council/cli_hints.ts` | lib-module | rendering | per-provider CLI install hints for `mode: cli` members — `src/scripts/ai_council/cli_hints.ts:2` | |
| `src/scripts/ai_council/replay.ts` | lib-module | replay-evidence | per-session `decision-replay.md` surfacing the audit trail a PR review called missing — `src/scripts/ai_council/replay.ts:1-6` | |
| `src/scripts/ai_council/events_log.ts` | lib-module | replay-evidence | one JSON line per council event to `<project_root>/agents/runtime/council/events.log` — `src/scripts/ai_council/events_log.ts:2-6` | |
| `src/scripts/ai_council/session.ts` | lib-module | replay-evidence | session persistence for council consultations — `src/scripts/ai_council/session.ts:2` | |
| `src/scripts/ai_council/redact_low_impact_entry.ts` | lib-module | replay-evidence | privacy floor for the corpus; regexes and refusal markers matched byte-for-byte — `src/scripts/ai_council/redact_low_impact_entry.ts:2-6` | |
| `src/scripts/ai_council/one_off_archive/` | script | dead-duplicate | archived single-purpose council probes; its own README says new runs go through the CLI instead — `src/scripts/ai_council/one_off_archive/2026-05/README.md:12-17` | `src/scripts/council_cli.ts` (`agent-config council:{estimate,run,render}`) |
| `docs/decisions/ADR-093-ai-council-config-user-global.md` | contract | dead-duplicate | frontmatter `status: superseded`, `superseded_by: 104` — `docs/decisions/ADR-093-ai-council-config-user-global.md:2-6` | `docs/decisions/ADR-104-ai-council-config-global-only.md` |
| `docs/contracts/ai-council-config.md` | contract | compatibility | the config contract (1398 lines) the modules cite as normative — `wc -l` + `necessity.ts:5-6` naming it for the trigger lists | |
| `docs/contracts/low-impact-corpus-format.md` | contract | council-internal necessity | the corpus file format (95 lines) `low_impact_corpus.ts` parses | |
| `docs/decisions/ADR-104-ai-council-config-global-only.md` | contract | compatibility | the live config-location decision the template and loader cite — cited at `agents/templates/.ai-council.yml.example:5` | |
| `agents/templates/.ai-council.yml.example` | config | compatibility | the ONLY in-tree config artefact (600 lines); its header states the project tree is never searched — `agents/templates/.ai-council.yml.example:3-10` | |
| `src/config/agent-settings.template.yml` | config | task-side routing | `commands.offer_council_in_delivery: false` — `src/config/agent-settings.template.yml:368` | |
| `src/config/quorum-attendance-budget.json` | config | replay-evidence | four pre-registered attendance metrics over `events.log`; schema v5 field list at `:8`, phase split at `:9` | |
| `src/config/gate-coverage.yml` | config | compatibility | registers `check_council_pin_staleness` with its corpus and no-canary reason — `src/config/gate-coverage.yml:756-763` | |
| `src/flows/surface-map.yaml` | config | compatibility | declares the seven-member council command cluster as a product surface — `src/flows/surface-map.yaml:119-130` | |
| `src/server/schemas/settings.ts` | config | task-side routing | `offer_council_in_delivery` `:276-286`; `subagents.adversarial_council` enum default `off` `:357` | |
| `src/server/routes/wizard.ts` | script | compatibility | writes the user-global `settings/.ai-council.yml` seeded from the in-tree template — `src/server/routes/wizard.ts:127-135` | |
| `src/cli/registry.ts` | config | task-side routing | the seven `council:*` verbs (`estimate`, `run`, `render`, `status`, `quota`, `grant-billing`, `revoke-billing`) — `src/cli/registry.ts:120-126` | |
| `src/scripts/hook_manifest.yaml` | config | task-side routing | `council-availability` concern declared `:491-492` and bound in `session_start` on five hosts `:1099,1106,1150,1184,1199` | |
| `taskfiles/ci-fast.yml` | config | compatibility | wires `check-council-references` `:1876-1879` and `check-one-off-location` `:1988-1991` | |
| `taskfiles/content.yml` | config | compatibility | wires the corpus compile `:146,151`, both council layout/location gates `:310-318`, and `council-prune` `:384-386` | |
| `agents/decisions/low-impact-decisions.md` | config | council-internal necessity | the human-edited corpus (3477 bytes) the parser reads — `ls -la agents/decisions/` | |
| `agents/decisions/low-impact-decisions.lock.yaml` | config | council-internal necessity | the compiled lockfile `compile_corpus.ts` emits — same listing | |
| `agents/evidence/council/` | contract | replay-evidence | 22 promoted council-verdict records (the durable half of a gitignored session store); cited from prose, e.g. `roadmap-execution-contract.md:117` | |
| `tests/scripts/ai_council/` | test | replay-evidence | 46 test files, one per module family, including `synthesis_check`, `governance_aggregation_steerability`, `billing_cliff_gate` — `ls tests/scripts/ai_council/*.ts \| wc -l` | |
| `tests/ai_council/clients_live_smoke.test.ts` | test | compatibility | live-transport smoke over the real client layer — `ls tests/ai_council/` | |
| `tests/scripts/council_cli.test.ts` | test | topology-depth | pins the CLI's depth/rounds/chairman resolution contract | |
| `tests/scripts/ai_council_blind_review.test.ts` | test | topology-depth | pins the blind-label shuffle and de-anonymisation | |
| `tests/scripts/council_dispatch_routing.test.ts` | test | task-side routing | pins which dispatch path a request routes to | |
| `tests/scripts/council_availability.test.ts` | test | task-side routing | pins the availability-hook fact | |
| `tests/scripts/council_prune.test.ts` | test | replay-evidence | pins the retention pruner | |
| `tests/scripts/check_council_references.test.ts` | test | compatibility | pins the reference gate's CLI contract | |
| `tests/scripts/check_council_layout.test.ts` | test | compatibility | pins the layout gate's CLI contract | |
| `tests/scripts/check_council_config_location.test.ts` | test | compatibility | pins the config-location gate's CLI contract | |
| `tests/scripts/_lib/council_fallback_wiring.test.ts` | test | compatibility | pins the api-twin fallback wiring | |
| `tests/scripts/_lib/adversarial_council_gate.test.ts` | test | topology-depth | pins the prove-or-drop panel verdict — `ls src/scripts/_lib/ \| grep council` surfaced the pair | |
| `tests/scripts/one_resolver_invariant.test.ts` | test | task-side routing | 418 lines, 47 `it(` blocks across 14 `describe` blocks, including a sensitivity block `:76`, a polarity/denial block `:258`, and a deliberate-blind-spot block `:300` | |
| `tests/scripts/_lib_judgment_ladder.test.ts` | test | task-side routing | 47 `it(` blocks; the rung-4 describe covers all three council signals — `:296-312` | |
| `tests/server/wizard.aiCouncil.test.ts` | test | compatibility | pins the wizard's config-file write | |
| `tests/scripts/argument_exhaustion.test.ts` | test | topology-depth | the only importer of `argument_exhaustion.ts` outside the module — see § Notes | |
| `tests/fixtures/council-parse-corpus/` | test | replay-evidence | 9 recorded response fixtures `council_parse_rate.ts` measures over | |
| `tests/fixtures/council-events-schema-span/` | test | replay-evidence | 2 fixtures spanning the events-log schema versions | |
| `tests/eval/routing-matrix/low-impact-corpus-privacy-floor.yaml` | test | replay-evidence | routing matrix pinning the privacy-floor rule's triggers | |

## Contested classifications

Four rows where two categories were genuinely arguable. Each names the evidence
that would settle it.

1. **`src/scripts/council_cli.ts`** — chosen `topology-depth`, alternative
   `rendering`. It is the single largest surface (3975 lines) and does both: it
   resolves rounds, depth, chairman mode and peer-review activation
   (`:1609-1619`, `:3611`, `:3551`, `:1289-1295`) *and* assembles the rendered
   markdown. Decided by depth because the topology decisions have no other
   home; a split of the file into a resolver half and a renderer half would
   make the classification unnecessary rather than merely easier.
2. **`src/scripts/ai_council/redact_low_impact_entry.ts`** — chosen
   `replay-evidence`, alternative `council-internal necessity`. It gates what
   enters the corpus, and the corpus is the necessity-avoidance store. Decided
   by replay-evidence because its subject is *what may be recorded*, not
   *whether a pass is needed*. Settled by whether the redactor ever influences
   a match decision: it does not today (it runs at write and upstream, per
   `src/rules/low-impact-corpus-privacy-floor.md:11-16`), and if a future
   change made redaction affect matching, the row moves.
3. **`src/scripts/bench_adversarial_council.ts`** and
   **`src/scripts/_lib/adversarial_council_gate.ts`** — the pair splits:
   the bench *produces* the measurement (`replay-evidence`), the gate *decides
   the topology's admissibility from it* (`topology-depth`). Both could be read
   as one category. Settled by whether the gate is ever consulted outside a
   benchmark run; it encodes a claim verdict, so it is a depth decision.
4. **`src/scripts/ai_council/cli_agency_bounds.ts`** and
   **`cli_least_agency_canary.ts`** — chosen `compatibility`, alternative
   `spend governance`. They bound what a spawned vendor CLI may do, which is a
   safety property of the transport rather than a cost ceiling. Decided by
   subject: neither reads a price or a budget. Settled by whether an unbounded
   spawn can consume budget in a way `cli_call_budget.ts` does not already
   count — not established here.

## Notes on two rows

**`argument_exhaustion.ts` is not a dead duplicate and has no successor.** A
repo-wide search for `argument_exhaustion|evaluateStop|renderStop` outside the
module returns only `tests/scripts/argument_exhaustion.test.ts` and prose in the
originating roadmap. It is pure, tested, and imported by no production module —
forward work that has not been wired, not a replaced mechanism. Recording it as
`dead-duplicate` would require naming a successor that does not exist.

**`agents/runtime/council/{questions,responses,sessions}/` is deliberately not a
row.** It is gitignored (`.gitignore:319-320`) and auto-pruned after
`ai_council.session_retention_days`, so it is not a tracked surface an inventory
can categorise. Its durable half is `agents/evidence/council/`, which is a row.

## Incidental mentions — accounted for, not categorised

These files match a `council` grep but carry no routing, implementation,
governance, validation, or storage role: they cite a past council decision as
provenance. Verified by reading each match.

Rules: `code-provenance.md:110,123` · `domain-adoption-policy.md:46` ·
`finance-safety-floor.md:71` · `improve-before-implement.md:6` (carries
`council_depth` but its body never routes to the council) ·
`invite-challenge.md:6` (same) · `minimal-safe-diff.md:81` ·
`no-pr-progress-comments.md:57` (names `/council:pr` as a non-gated flow) ·
`self-repair-loop.md:71,120` · `settings-ask-protocol.md:10,81` (subject is
`subagents.adversarial_council`, a subagent mode) · `source-confidentiality.md:98` ·
`token-budget-discipline.md:109` · `persona-governance.md` is a row, not
incidental.

`improve-before-implement.md` and `invite-challenge.md` are the two judgement
calls in this list: both carry `council_depth: deep` frontmatter, which is the
same signal that put nine skills in the table. They are excluded because the
frontmatter is the whole of it — neither body mentions the council, so the field
is a tier hint on a rule that never dispatches. If `council_depth` is later read
as a dispatch trigger rather than a tier hint, both become `task-side routing`
rows.

Contexts and skills with a single provenance citation and no council role:
`src/agent-src/contexts/` — `scope-mechanics.md`, `command-suggestion-flow.md`,
`frugality-charter.md`, `cheap-question-mechanics.md`,
`contract-decision-sheet.md`, `interrupt-examples.md`,
`non-interactive-contract.md`, `orchestration-benchmark-gate.md`,
`orchestration-telemetry.md`, `project-intelligence.md`,
`roadmap-process-loop.md`, `roadmap-writing-source-derived.md`,
`subagent-*.md` (6), `toolchain-resolver.md`, `user-memory-channels.md`,
`verify-budget.md`, `persona-voice-rubric.md`, `model-recommendations.md`,
`subagent-configuration.md`. Skills: `adr-create`, `decision-record`,
`agent-docs-writing`, `code-review`, `command-writing`, `roadmap-writing`,
`design-intelligence`, `design-tokens`, `doc-coauthoring`, `brand-audit`,
`positioning-strategy`, `prompt-optimizer`, `prompt-validator`, `refine-prompt`,
`memory-consolidation`, `script-writing`, `skill-improvement-pipeline`,
`vision-articulation`, `voc-extract`, `feature-planning`,
`judge-bug-hunter`, `judge-synthesis`, `license-compliance-*` (3),
`agents-md-thin-root`, `bug-analyzer` (a row on `council_depth`, not on its
prose), `contract-review`/`dpa-review`/`nda-triage`/`legal-intake-triage` (rows
on `council_depth`).

`src/domains/` files matching the grep but carrying only provenance: 30 of the
53 matches, including `analysis-workbench/analyze/*`,
`engineering-base/{feature/plan,review/changes}`, `git/pr/create`, `fun/*`,
`legal-review-prep/{README,LEGAL_NOTICE,pack.yaml,evals/README}`,
`meta/{challenge-me/*,cost/report,optimize/*,profile/show,sync/gitignore/fix,team/*,memory/promote,README,pack.yaml}`,
`product-basic/roadmap/{command,create,next,process-*}`.

## Dead-duplicate column

Two entries, each naming its successor:

| dead-duplicate | successor |
|---|---|
| `src/scripts/ai_council/one_off_archive/` | `src/scripts/council_cli.ts` — `agent-config council:{estimate,run,render}` |
| `docs/decisions/ADR-093-ai-council-config-user-global.md` | `docs/decisions/ADR-104-ai-council-config-global-only.md` |

The column is otherwise empty. That is the verify clause satisfied in its
second form, not its first.

## Counts

Derived from the table above by counting rows per `category` cell.

Derived mechanically from the `category` column of the table above (rows 32–195
of this file), not counted by hand:

```
awk -F'|' '/^\| `/ && NF>4 {gsub(/^ +| +$/,"",$4); print $4}' \
  agents/evidence/analysis/council-surface-inventory-2026-08-29.md \
  | sort | uniq -c | sort -rn
```

| category | surfaces |
|---|---|
| task-side routing | 48 |
| compatibility | 39 |
| topology-depth | 27 |
| replay-evidence | 18 |
| council-internal necessity | 14 |
| rendering | 10 |
| spend governance | 6 |
| dead-duplicate | 2 |
| **total** | **164** |

Five of those rows are directory aggregations declared in § Scope rule and the
fixture rows: `tests/scripts/ai_council/` (46 files),
`agents/evidence/council/` (22 files), `src/scripts/ai_council/one_off_archive/`,
`tests/fixtures/council-parse-corpus/` (9 files) and
`tests/fixtures/council-events-schema-span/` (2 files). Each is counted as one
surface. Expanding all five would put the file count at 240.

Cross-check against the directory census: `ls src/scripts/ai_council/*.ts | wc -l`
returns **53**, and all 53 appear as rows (the roadmap step's "~55 modules" is
two high). `ls src/scripts/ | grep -i council` returns 11 scripts plus the
`ai_council` directory; all 11 appear as rows (the step's "12 top-level council
scripts" counts the directory).
