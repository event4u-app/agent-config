# Roadmap Progress

> Auto-generated — do not edit. Regenerate with `task roadmap-progress` or by running the `update_roadmap_progress` script for your install; rewritten on every roadmap create / execute / completion change. A repository that does not commit this file has no git history for it — regenerate to see the current state.
>
> 3 open roadmaps · [roadmaps/](roadmaps/) · [archive/](roadmaps/archive/) · [skipped/](roadmaps/skipped/) · [later/](roadmaps/later/) · **2** open blockers in the active tree, **2** need you → `agent-config gates`

## Overall

**41 / 59 steps done · 69%**

```text
████████████████████████████░░░░░░░░░░░░   69%
```

## ⚠️ Iron Law 3 — unresolved deferred items

These roadmaps have `count_open == 0` but carry `[~]` deferred items. Per `roadmap-progress-sync` Iron Law 3 they do NOT auto-archive — the user must resolve the deferrals first (spawn follow-up, restore, or cancel). See [`roadmap-management § 4b`](../packages/core/.agent-src.uncondensed/skills/roadmap-management/SKILL.md).

| Roadmap | Done | Deferred | Cancelled |
|---|---:|---:|---:|
| [road-to-per-turn-hook-economy.md](roadmaps/road-to-per-turn-hook-economy.md) | 11 | 2 | 5 |

## Open roadmaps

| # | Roadmap | Phases | Steps | Open | Done | Deferred | Cancelled | Blocker | Progress |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| 1 | [road-to-evidence-based-adr-governance.md](roadmaps/road-to-evidence-based-adr-governance.md) | 7 | 34 | 15 | 16 | 3 | 0 | [2](#blockers-road-to-evidence-based-adr-governance) | █████░░░░░ 52% |
| 2 | [road-to-per-turn-hook-economy.md](roadmaps/road-to-per-turn-hook-economy.md) | 6 | 18 | 0 | 11 | 2 | 5 | 0 | ██████████ 100% |
| 3 | [road-to-subagent-lifecycle-integrity.md](roadmaps/road-to-subagent-lifecycle-integrity.md) | 8 | 22 | 3 | 14 | 0 | 5 | 0 | ████████░░ 82% |

---

## Parked — `later/` (55 roadmaps, not active backlog)

> Excluded from the table above and from `/roadmap:process-*` by design. Listed here so a resume condition is visible without opening the file.

> Carrying **29** open blockers, **13** owned by you — parking resolves nothing, so these are NOT in the active-tree count above.

| Roadmap | Open blockers | Resume when |
|---|---:|---|
| [domain-pack-extraction-when-triggered.md](roadmaps/later/domain-pack-extraction-when-triggered.md) | 0 | Blocked until: `docs/contracts/domain-pack-overlap-inventory.md` exists. That file is ADR-011's design gate, and its trigger conditions 2 and 3 are downstream of it, so one `test -f` decides the wh... | <!-- ref-ignore -->
| [road-to-benchmark-obsolescence-lifecycle.md](roadmaps/later/road-to-benchmark-obsolescence-lifecycle.md) | 0 | _condition present but unlabelled — see file_ | <!-- ref-ignore -->
| [road-to-carrier-layer-convergence.md](roadmaps/later/road-to-carrier-layer-convergence.md) | 1 (1 you) | Parked 2026-08-19. Resume when the before/after delivered-token pair for Phase 3 exists: both readings taken on the maintainer's own installed topology, either side of `install --layer`, recorded a... | <!-- ref-ignore -->
| [road-to-catalogue-host-fit.md](roadmaps/later/road-to-catalogue-host-fit.md) | 1 (1 you) | Blocked until: `agents/evidence/metrics/skill-catalogue.jsonl` holds at least 20 observations spanning at least 2 distinct `host` values. Probe: `capture_skill_catalogue --cadence` prints progress... | <!-- ref-ignore -->
| [road-to-command-structure-followup.md](roadmaps/later/road-to-command-structure-followup.md) | 0 | Blocked until: the per-item triggers below fire. | <!-- ref-ignore -->
| [road-to-conformance-round7-followup.md](roadmaps/later/road-to-conformance-round7-followup.md) | 1 (1 you) | Resume when: the maintainer states a position on whether `src/rules/commit-policy.md` § One-shot authorization names the remote-state case — that is, when a `grep -niE 'remote.state\|deliverable' sr... | <!-- ref-ignore -->
| [road-to-contract-integrity.md](roadmaps/later/road-to-contract-integrity.md) | 0 | only open work — Phase 2 family-first presentation — is blocked until the leanness / pruning track (`road-to-tier-removal` + command-surface-leanness) prunes against the Phase-0 census; documenting... | <!-- ref-ignore -->
| [road-to-corpus-knowledge-skills.md](roadmaps/later/road-to-corpus-knowledge-skills.md) | 2 | Blocked until the maintainer names the first two corpora (Phase 0.2) or archives this plan as demand-not-shown. Parked rather than active because every remaining open item is gated on that one deci... | <!-- ref-ignore -->
| [road-to-cost-parity-2-state-aware-dispatch.md](roadmaps/later/road-to-cost-parity-2-state-aware-dispatch.md) | 2 (1 you) | Resume when EITHER: (a) the orchestration claim queue is free and the ≥ 20-audit-line bar is met, or (b) the maintainer authorizes Phase 1 alone — the resolver plus the record-only soak change no v... | <!-- ref-ignore -->
| [road-to-council-api-quota-source-split.md](roadmaps/later/road-to-council-api-quota-source-split.md) | 0 | Blocked until `agents/evidence/council-api-fallback/quota-source-split-request.md` exists. *(The marker is deliberate: this path is a condition, not a reference. The file MUST NOT exist yet — its a... | <!-- ref-ignore -->
| [road-to-credible-install.md](roadmaps/later/road-to-credible-install.md) | 0 | Resume when the breaking release carrying the Phase-2 scoped-projection flip ships (human-gated) — then wait out the four-week window and record met-or-honestly-missed in `docs/releases.md` § Verif... | <!-- ref-ignore -->
| [road-to-cross-model-residuals.md](roadmaps/later/road-to-cross-model-residuals.md) | 0 | ## Resume when / Trigger | <!-- ref-ignore -->
| [road-to-cross-model-routing-eval.md](roadmaps/later/road-to-cross-model-routing-eval.md) | 0 | Blocked until all three gates clear: (a) OpenAI and Gemini API credentials are available to the eval env; (b) an in-host end-to-end skill-invocation harness exists (measuring what the host actually... | <!-- ref-ignore -->
| [road-to-deferred-rule-retriever.md](roadmaps/later/road-to-deferred-rule-retriever.md) | 0 | Blocked until BOTH hold: (1) the first native engine's Phase-5 benchmark verdict is published (ADR-124 sequencing rule — one native engine at a time; queue position 1 behind the code-graph engine p... | <!-- ref-ignore -->
| [road-to-discipline-profile-tiering-followup.md](roadmaps/later/road-to-discipline-profile-tiering-followup.md) | 0 | Resume when: an open-source-host adapter exists AND the maintainer wants the graduation answer (or the recorded revisit-if drop-condition fires). | <!-- ref-ignore -->
| [road-to-external-proof-upgrade.md](roadmaps/later/road-to-external-proof-upgrade.md) | 0 | Resume when the maintainer picks up the encryption default-flip; it needs no recruit session and never did. The recruit-session and beta-promotion phases stay parked as out-of-scope rather than pen... | <!-- ref-ignore -->
| [road-to-gateway-harvest.md](roadmaps/later/road-to-gateway-harvest.md) | 0 | Resume when the maintainer decides to spend a slot on it. That is the only remaining condition: a sequencing decision, in the maintainer's control, not an event to wait for. Per-item evidence disci... | <!-- ref-ignore -->
| [road-to-guided-journeys.md](roadmaps/later/road-to-guided-journeys.md) | 0 | Resume when the maintainer decides to spend a slot on it. That is the only remaining condition: a sequencing decision, in the maintainer's control, not an event to wait for. Per-item evidence disci... | <!-- ref-ignore -->
| [road-to-harvest-second-sweep-proposals.md](roadmaps/later/road-to-harvest-second-sweep-proposals.md) | 0 | they are tracked, not lost — neither is auto-applied. Resume when the maintainer decides to adopt either; each then lands as its own small PR against the named target. | <!-- ref-ignore -->
| [road-to-inbox-harvest-2026-08-d-llm-distillation-comparison.md](roadmaps/later/road-to-inbox-harvest-2026-08-d-llm-distillation-comparison.md) | 0 | _condition present but unlabelled — see file_ | <!-- ref-ignore -->
| [road-to-install-path-convergence-followup.md](roadmaps/later/road-to-install-path-convergence-followup.md) | 1 (1 you) | Blocked until the bootstrap shim has shipped and a monitoring window (suggested: ~4 weeks post-merge) has elapsed. Execution starts when the maintainer opens the checkpoint — this is a maintainer c... | <!-- ref-ignore -->
| [road-to-kernel-question-triangle.md](roadmaps/later/road-to-kernel-question-triangle.md) | 0 | Resume when `src/rules/ask-when-uncertain.md` carries the band-4 qualifier below, i.e. when `grep -c 'Band-4 scope' src/rules/ask-when-uncertain.md` returns non-zero. It returns 0 today — re-measur... | <!-- ref-ignore -->
| [road-to-live-app-verdict.md](roadmaps/later/road-to-live-app-verdict.md) | 0 | Blocked until: a consumer repo's live-app CI run of the `playwright-testing` skill is recorded under `agents/evidence/`. Why that half and not the other: the trigger below is a conjunction whose fi... | <!-- ref-ignore -->
| [road-to-mcp-full-power.md](roadmaps/later/road-to-mcp-full-power.md) | 1 (1 you) | Blocked until the next council-approved MCP tool batch exists — the only open work (Phase 5 Step 3 codegen bridge + AC2) generates tools from an approved cut list, and the 2026-07-07 verdict left z... | <!-- ref-ignore -->
| [road-to-mission-catalogue.md](roadmaps/later/road-to-mission-catalogue.md) | 0 | Status: later (parked). Blocked until the `/mission:upgrade` infrastructure is operationally validated on a live Laravel repo (the Phase 2B trigger). Every item below is gated on an unmet external... | <!-- ref-ignore -->
| [road-to-mixed-trigger-activation-cost.md](roadmaps/later/road-to-mixed-trigger-activation-cost.md) | 1 (1 you) | Blocked until: the host exposes an `InstructionsLoaded` observer that a session can read (step 3.3's instrument; absent from the 2.1.229 binary's token extraction, so building against it today woul... | <!-- ref-ignore -->
| [road-to-originality-gate-and-contributor-funnel.md](roadmaps/later/road-to-originality-gate-and-contributor-funnel.md) | 1 | Blocked until: the extraction demand-gate window closes — floor met (≥ 3 distinct external signals) or 90 days after `docs/anti-reskin-gate.md` lands on `main`. Phases 0-2 and the Phase-3 probe are... | <!-- ref-ignore -->
| [road-to-per-workspace-license-policy.md](roadmaps/later/road-to-per-workspace-license-policy.md) | 0 | Blocked until: a real consumer repo hits the v1 escalation, i.e. a heterogeneous monorepo (workspace SPDX id differs from root) is actually encountered and the maintainer wants derivation instead o... | <!-- ref-ignore -->
| [road-to-plan-gates-measurement.md](roadmaps/later/road-to-plan-gates-measurement.md) | 0 | Blocked until / Resume when: `agents/evidence/metrics/gate-metrics.jsonl` carries at least 10 `r2_review` events (Stage B); Phase 2 additionally needs 20. Probe: `grep --line-number 'r2_review' age... | <!-- ref-ignore -->
| [road-to-plugin-runtime-borrowings.md](roadmaps/later/road-to-plugin-runtime-borrowings.md) | 0 | Resume when the maintainer decides to spend a slot on it. That is the only remaining condition: a sequencing decision, in the maintainer's control, not an event to wait for. Per-item evidence disci... | <!-- ref-ignore -->
| [road-to-policy-evaluation-core.md](roadmaps/later/road-to-policy-evaluation-core.md) | 0 | Blocked until BOTH hold: (1) the first native engine's Phase-5 benchmark verdict is published (ADR-124 sequencing rule; queue position 2 per the sequencing plan in `road-to-native-code-intelligence... | <!-- ref-ignore -->
| [road-to-product-bets.md](roadmaps/later/road-to-product-bets.md) | 1 (1 you) | Blocked until: a real external user signal naming rule count or surface count as the adoption blocker is recorded under `agents/evidence/`. Why this half: blocker `simple-expert-mode-demand-evidenc... | <!-- ref-ignore -->
| [road-to-reach-cost-primary-bench.md](roadmaps/later/road-to-reach-cost-primary-bench.md) | 0 | _condition present but unlabelled — see file_ | <!-- ref-ignore -->
| [road-to-reach-headless.md](roadmaps/later/road-to-reach-headless.md) | 0 | _condition present but unlabelled — see file_ | <!-- ref-ignore -->
| [road-to-reach-reddit-approved-api.md](roadmaps/later/road-to-reach-reddit-approved-api.md) | 0 | _condition present but unlabelled — see file_ | <!-- ref-ignore -->
| [road-to-reach-reddit-session.md](roadmaps/later/road-to-reach-reddit-session.md) | 0 | _condition present but unlabelled — see file_ | <!-- ref-ignore -->
| [road-to-reach-transcribe.md](roadmaps/later/road-to-reach-transcribe.md) | 0 | _condition present but unlabelled — see file_ | <!-- ref-ignore -->
| [road-to-reach-twitter-login.md](roadmaps/later/road-to-reach-twitter-login.md) | 0 | _condition present but unlabelled — see file_ | <!-- ref-ignore -->
| [road-to-run-continuation-observation.md](roadmaps/later/road-to-run-continuation-observation.md) | 1 | Parked 2026-08-19. Resume when any roadmap carrying `execution.mode: autonomous` with open steps in three or more `## Phase` sections is run to completion from a worktree and reaches a PR — then re... | <!-- ref-ignore -->
| [road-to-skill-ecosystem-capability-queue.md](roadmaps/later/road-to-skill-ecosystem-capability-queue.md) | 2 (1 you) | Resume when a slot frees and the maintainer picks an entry for it. Verify with `./agent-config roadmap:progress`. Promotion is still per entry rather than as a batch — that discipline was about mai... | <!-- ref-ignore -->
| [road-to-skill-ecosystem-eval-integrity.md](roadmaps/later/road-to-skill-ecosystem-eval-integrity.md) | 1 | Resume when a verification slot frees — a predecessor roadmap reaches zero open steps and lands in `agents/roadmaps/archive/`. Verify with `./agent-config roadmap:progress`. | <!-- ref-ignore -->
| [road-to-skill-ecosystem-executable-payloads.md](roadmaps/later/road-to-skill-ecosystem-executable-payloads.md) | 1 | Blocked until: `agents/evidence/analysis/skill-payload-phase0-spikes.md` records the S0.1 invocation rate, the S0.2 median token delta and the S0.3 detection result — a null counts as a recorded re... | <!-- ref-ignore -->
| [road-to-skill-ecosystem-runtime-enforcement.md](roadmaps/later/road-to-skill-ecosystem-runtime-enforcement.md) | 2 (2 you) | Resume when one of the two open verification roadmaps reaches zero open steps and is archived, freeing a slot. Verify with `./agent-config roadmap:progress` and by confirming the predecessor moved... | <!-- ref-ignore -->
| [road-to-skill-ecosystem-security-and-conformance.md](roadmaps/later/road-to-skill-ecosystem-security-and-conformance.md) | 2 (1 you) | Resume when a verification slot frees — a predecessor roadmap reaches zero open steps and lands in `agents/roadmaps/archive/`. Verify with `./agent-config roadmap:progress`. | <!-- ref-ignore -->
| [road-to-sparring-critic-spike.md](roadmaps/later/road-to-sparring-critic-spike.md) | 0 | Blocked until BOTH hold: (1) `road-to-lean-agent-init.md` is closed and its telemetry reviewed (council 2026-07-28 sequencing: the quantified token-waste fix ships before any speculative sparring w... | <!-- ref-ignore -->
| [road-to-surface-consolidation.md](roadmaps/later/road-to-surface-consolidation.md) | 2 (1 you) | Parked 2026-08-19. Resume when BOTH hold — the condition is conjunctive on purpose, and the council corrected an earlier single-clause version of it: (a) the pre-registered utilization window has e... | <!-- ref-ignore -->
| [road-to-thin-flip-under-anchor-scoring.md](roadmaps/later/road-to-thin-flip-under-anchor-scoring.md) | 0 | _no resume line recorded_ | <!-- ref-ignore -->
| [road-to-token-economy-cache-followup.md](roadmaps/later/road-to-token-economy-cache-followup.md) | 0 | external trigger: one instrumented week of real sessions. Resume when: `agents/runtime/state/injection-census.jsonl` covers ≥ 7 days of real sessions (record mode: `./scripts-run src/scripts/bench_... | <!-- ref-ignore -->
| [road-to-token-economy-dispatch-followup.md](roadmaps/later/road-to-token-economy-dispatch-followup.md) | 0 | or a maintainer blocker. Resume when EITHER: (a) the `rules_used` window has data (earliest ~2026-08-24 — run `./scripts-run src/scripts/dispatch_economy_report` and check `rules_efficiency.envelop... | <!-- ref-ignore -->
| [road-to-token-proof-and-story.md](roadmaps/later/road-to-token-proof-and-story.md) | 2 | Resume when: a context-reduction mechanism (orchestration-scoped loading, or a new single-request one) passes the quality gate AND real field `sessions.jsonl` spend data exists for a before/after w... | <!-- ref-ignore -->
| [road-to-token-saving-HUMAN-MEASUREMENT.md](roadmaps/later/road-to-token-saving-HUMAN-MEASUREMENT.md) | 0 | _condition present but unlabelled — see file_ | <!-- ref-ignore -->
| [road-to-token-saving.md](roadmaps/later/road-to-token-saving.md) | 0 | operator-gated; nothing is agent-workable now. Resume when the operator runs either gate: (1) the RTK golden-set completeness validation (RTK binary + live outputs) that gates the tier_2→kernel pro... | <!-- ref-ignore -->
| [road-to-voice-negative-lexicon.md](roadmaps/later/road-to-voice-negative-lexicon.md) | 0 | Resume when the maintainer decides to spend a slot on it. That is the only remaining condition: a sequencing decision, in the maintainer's control, not an event to wait for. Per-item evidence disci... | <!-- ref-ignore -->
| [road-to-worker-generation-recycling.md](roadmaps/later/road-to-worker-generation-recycling.md) | 3 | construction. Resume when the maintainer blockers are resolved and Phase 1's exit gate (≥ 30 shadow capsules from real dispatches) has data. | <!-- ref-ignore -->
| [road-to-zero-ceremony-host-primitives.md](roadmaps/later/road-to-zero-ceremony-host-primitives.md) | 1 | Blocked until the ADR that governs tier→model mapping enters its recorded review window — where revisiting is procedurally cheap rather than a supersession fight. Phase 0 is the only part that prod... | <!-- ref-ignore -->

---

## Per-roadmap phase breakdown

### [road-to-evidence-based-adr-governance.md](roadmaps/road-to-evidence-based-adr-governance.md)

**Road to evidence-based ADR governance — provenance, E0–E4 evidence grades, full-corpus re-adjudication** — 16 / 31 done (52%)

| # | Phase | State | Open | Done | Deferred | Cancelled | % |
|---|---|---|---:|---:|---:|---:|---:|
| 1 | Schema: two descriptive axes, staged so the tree stays valid | ✅ done | 0 | 5 | 0 | 0 | 100% |
| 2 | Tooling (surfacing only; no authority) | 🟡 in progress | 2 | 4 | 0 | 0 | 67% |
| 3 | Full-corpus challenge sweep (no frontmatter writes) | 🟡 in progress | 1 | 2 | 0 | 0 | 67% |
| 4 | Autonomy-blocker lane | 🟡 in progress | 2 | 1 | 1 | 0 | 33% |
| 5 | Doctrine, proposed not accepted | ✅ done | 0 | 2 | 0 | 0 | 100% |
| 6 | Shadow-mode measurement | 🟡 in progress | 1 | 2 | 0 | 0 | 67% |
| 7 | The authority question (separate decision, default-off) `[~]` | ⬜ not started | 9 | 0 | 2 | 0 | 0% |

<a id="blockers-road-to-evidence-based-adr-governance"></a>
**Blockers**

- **owner-autonomy-batch** (owner: user) — blocks Phase 0B (all three rows), Phase 4 step 4.2 (blocker-lane rows 1, 2, 6)
  - **Recommendation:** Take (c) first and close it as stale — Amendment E and ADR-216 both say the freeze is lifted, so the sweep row contradicts the tree and costs nothing to correct. Hold (a) and (b): both widen agent write authority, and this roadmap's own Phase 7 argues that authority changes belong behind measurement rather than alongside a schema change.
  - **If you do nothing:** Phases 1–3, 5 and 6 run in full and blocker-lane rows 3, 4, 5, 7–13 all dispose normally. Rows 1, 2 and 6 stay `[~]`, so three of thirteen lane rows and AC-4's owner-gate clause remain open. Nothing else stalls.
  - **What to do:**
    Answer (a), (b), (c) in one sitting. Each `yes` executes its
    lane row with the carve-out inheriting ADR-237's excluded list verbatim
    (trunk, deploy, prod data, irreversible external); each `no` lands a
    RE-AFFIRMED row whose blocking cost is recorded as sourced observations per
    Phase 3's `blocking_cost` shape.
  - **Resolved when:** all three rulings are recorded in the sweep artifact and blocker-lane rows 1, 2 and 6 each carry a landed outcome.
- **authority-coupling-decision** (owner: user) — blocks Phase 7 (both steps)
  - **Recommendation:** Do not decide it now. Let Phase 6 run in shadow mode first: the question is only answerable once `adr-grade-accuracy-vs-gold`, `adr-evidence-discovery-recall` and `adr-beneficiary-grade-bias` have numbers, and a suspension drill has passed. A published null is an acceptable answer.
  - **If you do nothing:** Everything in Phases 0A–6 still lands. The estate gains provenance, evidence grades, substantive review triggers, a full 184-record challenge disposition and cite-time surfacing — all of it descriptive. What stays absent is any autonomous reopen path derived from a grade, which is exactly the state the council ruled the safe default.
  - **What to do:**
    Read the Phase 6 measurements when they land, then rule
    once: enabled default-off with a named re-enabler and a chosen rollback
    unit, or not enabled with the null published.
  - **Resolved when:** an owner ruling is recorded either way, and — if enabled — the rollback unit is one of the four named options and the suspension drill has passed before the first grade-derived action.

### [road-to-per-turn-hook-economy.md](roadmaps/road-to-per-turn-hook-economy.md)

**Road to per-turn hook economy — the latency tax no registered budget can see** — 11 / 11 done (100%)

| # | Phase | State | Open | Done | Deferred | Cancelled | % |
|---|---|---|---:|---:|---:|---:|---:|
| 0 | Falsify or localise the report | ✅ done | 0 | 3 | 0 | 3 | 100% |
| 5 | Host-native prefiltering (runs first, deliberately) | ✅ done | 0 | 1 | 1 | 1 | 100% |
| 1 | Serialize once (D-2) | ✅ done | 0 | 1 | 0 | 1 | 100% |
| 2 | Payload opt-in per concern (D-2, second lever) | ✅ done | 0 | 2 | 0 | 0 | 100% |
| 3 | Take the two spawns off the hot path (D-3) | ✅ done | 0 | 2 | 0 | 0 | 100% |
| 4 | Register the number the user feels (D-1) | ✅ done | 0 | 2 | 1 | 0 | 100% |

### [road-to-subagent-lifecycle-integrity.md](roadmaps/road-to-subagent-lifecycle-integrity.md)

**Road to subagent lifecycle integrity — turn three production symptoms into deterministic guards** — 14 / 17 done (82%)

| # | Phase | State | Open | Done | Deferred | Cancelled | % |
|---|---|---|---:|---:|---:|---:|---:|
| 0 | Spikes — pin the host, reproduce the two upstream premises | ✅ done | 0 | 2 | 0 | 2 | 100% |
| 1 | Measure — lifecycle capture, no behaviour change | ✅ done | 0 | 4 | 0 | 0 | 100% |
| 2 | Return-channel integrity — validate, fall back to disk, retry once | 🟡 in progress | 2 | 1 | 0 | 0 | 33% |
| 3 | Runaway containment — spawn guard, ledger-aware stop gate, shadow stop-loss | ✅ done | 0 | 3 | 0 | 0 | 100% |
| 4 | Role axis binds on payload, not env | ✅ done | 0 | 2 | 0 | 1 | 100% |
| 5 | Tier routing has a caller — measure whether it moved the distribution | ✅ done | 0 | 2 | 0 | 0 | 100% |
| 6 | Frontend amendments — SUPERSEDED by road-to-source-first-frontend | ⏭️ skipped | 0 | 0 | 0 | 2 | 0% |
| 7 | The `do_not_touch` write-guard — relocated, and deliberately its own phase | ⬜ not started | 1 | 0 | 0 | 0 | 0% |

---

## Ticket bundles

Materialised ticket bundles under [`agents/tickets/`](tickets/) (via `/roadmap:materialize`), counted from `agents/tickets/_registry.yml`.

| Bundle | Tickets | Status | Source roadmap |
|---|---:|---|---|
| road-to-ticket-bundles | 6 | in_progress | agents/roadmaps/archive/road-to-ticket-bundles.md |

