# Roadmap Progress

> Auto-generated — do not edit. Regenerate with `task roadmap-progress` or by running the `update_roadmap_progress` script for your install; rewritten on every roadmap create / execute / completion change (timestamp lives in git history).
>
> 11 open roadmaps · [roadmaps/](roadmaps/) · [archive/](roadmaps/archive/) · [skipped/](roadmaps/skipped/) · [later/](roadmaps/later/) · **18** open blockers in the active tree, **10** need you → `agent-config gates`

## Overall

**136 / 216 steps done · 63%**

```text
█████████████████████████░░░░░░░░░░░░░░░   63%
```

## Open roadmaps

| # | Roadmap | Phases | Steps | Open | Done | Deferred | Cancelled | Blocker | Progress |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| 1 | [road-to-always-on-orchestration.md](roadmaps/road-to-always-on-orchestration.md) | 7 | 36 | 1 | 35 | 0 | 0 | [5](#blockers-road-to-always-on-orchestration) | ██████████ 97% |
| 2 | [road-to-condensed-link-repair.md](roadmaps/road-to-condensed-link-repair.md) | 1 | 6 | 6 | 0 | 0 | 0 | 0 | ░░░░░░░░░░ 0% |
| 3 | [road-to-drain-commands.md](roadmaps/road-to-drain-commands.md) | 6 | 39 | 8 | 29 | 2 | 0 | [1](#blockers-road-to-drain-commands) | ████████░░ 78% |
| 4 | [road-to-estate-drawdown.md](roadmaps/road-to-estate-drawdown.md) | 5 | 8 | 3 | 3 | 2 | 0 | 0 | █████░░░░░ 50% |
| 5 | [road-to-gated-reach-followup.md](roadmaps/road-to-gated-reach-followup.md) | 1 | 12 | 12 | 0 | 0 | 0 | [1](#blockers-road-to-gated-reach-followup) | ░░░░░░░░░░ 0% |
| 6 | [road-to-per-turn-hook-economy.md](roadmaps/road-to-per-turn-hook-economy.md) | 6 | 18 | 3 | 11 | 2 | 2 | [6](#blockers-road-to-per-turn-hook-economy) | ████████░░ 79% |
| 7 | [road-to-rule-coherence-followup.md](roadmaps/road-to-rule-coherence-followup.md) | 5 | 9 | 7 | 2 | 0 | 0 | [2](#blockers-road-to-rule-coherence-followup) | ██░░░░░░░░ 22% |
| 8 | [road-to-solution-minimalism.md](roadmaps/road-to-solution-minimalism.md) | 4 | 36 | 1 | 31 | 0 | 4 | 0 | ██████████ 97% |
| 9 | [road-to-standing-context-40k.md](roadmaps/road-to-standing-context-40k.md) | 5 | 9 | 4 | 3 | 1 | 1 | [1](#blockers-road-to-standing-context-40k) | ████░░░░░░ 43% |
| 10 | [road-to-subagent-lifecycle-integrity.md](roadmaps/road-to-subagent-lifecycle-integrity.md) | 8 | 22 | 4 | 13 | 0 | 5 | 0 | ████████░░ 76% |
| 11 | [road-to-user-out-of-the-loop.md](roadmaps/road-to-user-out-of-the-loop.md) | 9 | 40 | 31 | 9 | 0 | 0 | [2](#blockers-road-to-user-out-of-the-loop) | ██░░░░░░░░ 22% |

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

### [road-to-always-on-orchestration.md](roadmaps/road-to-always-on-orchestration.md)

**Road to always-on orchestration — subagents, council, and team stop being features and become how this suite works** — 35 / 36 done (97%)

| # | Phase | State | Open | Done | Deferred | Cancelled | % |
|---|---|---|---:|---:|---:|---:|---:|
| 1 | settings teardown, contract first | ✅ done | 0 | 6 | 0 | 0 | 100% |
| 2 | one judgment ladder instead of three scattered classifiers | ✅ done | 0 | 5 | 0 | 0 | 100% |
| 3 | CLI-first shipped as the default transport, quorum-resilient | ✅ done | 0 | 4 | 0 | 0 | 100% |
| 4 | verdict handoff + the wiring the resolved blocker was waiting for | ✅ done | 0 | 3 | 0 | 0 | 100% |
| 5 | team readiness: verify first, doctrine second | 🟡 in progress | 1 | 3 | 0 | 0 | 75% |
| 6 | the measurement that replaces the switch | ✅ done | 0 | 2 | 0 | 0 | 100% |
| 7 | what this roadmap will not do | ✅ done | 0 | 12 | 0 | 0 | 100% |

<a id="blockers-road-to-always-on-orchestration"></a>
**Blockers**

- **gate-council-auto-dispatch** (owner: maintainer) — blocks auto-firing the council at the release-gate escalation
  - **What to do:**
    after Phase 3 has soaked (transport reconciliation
    verified in real passes) and the F6/F4 + council-attendance telemetry has
    a usable window, wire the gate escalation to dispatch the pass itself
    (quorum rules from 3.3; inconclusive holds). Guards named by council:
    loop protection, metered-fallback cap via `cost_budget`, latency budget,
    unactioned-verdict kill criterion (6.2).
  - **Resolved when:** the wiring lands citing the soak evidence, or the telemetry says auto-fire adds nothing and the gate stays recommend-only.
- **point-of-action-carrier** (owner: maintainer) — blocks any pre-tool-use mid-session delegation carrier + escalation ladder (Sources E/H harvest)
  - **What to do:**
    run the main-vs-subagent discrimination spike (upstream
    closed the identity request as NOT_PLANNED; the per-agent-permission fix
    landed with unverified scope — probe a real host). No discriminator → the
    carrier ships only with scope reduction (source-file writes above a size
    threshold, generous exemptions) or not at all. Pre-registered null: "no
    discriminator" is publishable and does not block this roadmap.
  - **Resolved when:** the spike note exists and the build/no-build decision cites it plus the F3-lite adoption telemetry.
- **f4-full-stop-block** (owner: maintainer) — blocks single-shot stop-block continuation for the end-review obligation
  - **What to do:**
    carried from the carriers roadmap, upgraded by two
    verified facts: `additionalContext` on Stop IS documented at exit 0 (the
    advisory path may already reach the model — verify live first), and
    `stop_hook_active` is gone from the docs, so the loop guard must be a
    self-built session-scoped marker (the end-review once-per-session state is
    the template). Calibrate the threshold on `review_skipped` telemetry
    (`exact` lines only).
  - **Resolved when:** live delivery evidence exists and the block/advisory decision cites the telemetry distribution.
- **team-telemetry-behind-flag** (owner: maintainer) — blocks Phase 5.4 (team telemetry concerns, TaskCompleted artifact-check)
  - **What to do:**
    when the experimental flag is on in a real environment,
    run the 5.1 spike, then bind the concerns with the same fail-open
    discipline as the #1223 set.
  - **Resolved when:** payload evidence exists and the concerns ship, or teams leave the experimental state and this re-cuts.
- **cross-vendor-worker-slices** (owner: maintainer) — blocks routing ordinary work slices to second-vendor CLI workers (huge-context analysis, independence-critical review — Source G shape)
  - **What to do:**
    the drafts cited a direction-policy artefact that does not
    exist; before any cross-vendor worker ships, write the direction policy
    (which vendor may review which, what may be sent — extending the existing
    egress discipline), then add the two resolver entries (report-only
    workers).
  - **Resolved when:** the policy artefact exists and the resolver entries cite it.

### [road-to-condensed-link-repair.md](roadmaps/road-to-condensed-link-repair.md)

**Road to condensed-link repair** — 0 / 6 done (0%)

| # | Phase | State | Open | Done | Deferred | Cancelled | % |
|---|---|---|---:|---:|---:|---:|---:|
| 1 | Repair the two links, then decide about the gate | ⬜ not started | 6 | 0 | 0 | 0 | 0% |

### [road-to-drain-commands.md](roadmaps/road-to-drain-commands.md)

**Road to drain commands** — 29 / 37 done (78%)

| # | Phase | State | Open | Done | Deferred | Cancelled | % |
|---|---|---|---:|---:|---:|---:|---:|
| 1 | Security hotfix: the guard window | ✅ done | 0 | 2 | 0 | 0 | 100% |
| 2 | The bundle is verified by content, not by timestamp | ✅ done | 0 | 3 | 0 | 0 | 100% |
| 3 | `/pr:merge` — prepare one PR or drain the queue | ✅ done | 0 | 10 | 0 | 0 | 100% |
| 4 | `/roadmap:process-full --all [--merge]` | ✅ done | 0 | 6 | 2 | 0 | 100% |
| 5 | Governance record | ✅ done | 0 | 3 | 0 | 0 | 100% |
| 6 | Gates, evals, delivery | 🟡 in progress | 8 | 5 | 0 | 0 | 38% |

<a id="blockers-road-to-drain-commands"></a>
**Blockers**

- **merge-authority** (owner: user) — blocks steps 4.4 and 4.7 — activating `--merge` on `/roadmap:process-full` and amending the canonical loop's "merge is out of scope in every mode" sentence. Everything else in this roadmap, including all of `/pr:merge` except its § 9 merge step, ships without it.
  - **What to do:**
    decide whether an explicit `--merge` typed by the user in
    the invocation may serve as the per-turn confirmation
    `non-destructive-by-default` requires for a production-branch merge, and
    therefore as an amendment to ADR-237 § 4, whose current words are "no
    invocation extends it". This is owner-reserved rather than council-decidable
    because it lowers a recorded safety floor
    ([`decision-revisit-gate`](../../src/rules/decision-revisit-gate.md)
    § owner-reserved set), and three independent reviews reached the same
    answer without it: the AI council's Q1 verdict (2026-08-21, mergeability-only
    until authorization is target-bound and tamper-resistant), the committed
    `road-to-gate-preauth-authorization` stub (an authorization the agent can
    write is not an authorization), and the runtime classifier, which refused
    this roadmap's own attempt to edit the loop contract. The design the decision
    would activate is already written and inert: no new grant store, the existing
    prompt-derived per-session ledger only, an immutable `(PR number, head SHA)`
    manifest, and a clean stop-and-report at window expiry.
  - **Resolved when:** either the owner accepts the amendment and an ADR records it — after which 4.4 and 4.7 land and `--merge` becomes active — or the owner declines, in which case 4.4 and 4.7 are cancelled, the flag is removed from the `argument-hint`, and both command files keep only their mergeability-delivery half.

### [road-to-estate-drawdown.md](roadmaps/road-to-estate-drawdown.md)

**Road to estate drawdown — an agent-run campaign that ends with fewer roadmaps, enforced** — 3 / 6 done (50%)

| # | Phase | State | Open | Done | Deferred | Cancelled | % |
|---|---|---|---:|---:|---:|---:|---:|
| 0 | One sitting, thirteen answers | ✅ done | 0 | 2 | 0 | 0 | 100% |
| 1 | Execute everything runnable | ⬜ not started | 1 | 0 | 1 | 0 | 0% |
| 2 | Triage sweep over the whole estate, in batches, with terminal verdicts | ⬜ not started | 2 | 0 | 0 | 0 | 0% |
| 3 | The ratchet lands | ✅ done | 0 | 1 | 0 | 0 | 100% |
| 4 | The recurring agent pass, so this never regrows | ⏭️ skipped | 0 | 0 | 1 | 0 | 0% |

### [road-to-gated-reach-followup.md](roadmaps/road-to-gated-reach-followup.md)

**Follow-up to Road to gated reach — exercise the YouTube channel** — 0 / 12 done (0%)

| # | Phase | State | Open | Done | Deferred | Cancelled | % |
|---|---|---|---:|---:|---:|---:|---:|
| 1 | YouTube — exercise and score the channel | ⬜ not started | 12 | 0 | 0 | 0 | 0% |

<a id="blockers-road-to-gated-reach-followup"></a>
**Blockers**

- **legacy** (owner: user) — blocks entire roadmap
  - **What to do:**
    `yt-dlp` and a JavaScript runtime are installed **by a human** on the machine that runs this. Execution starts when the condition clears. The package never auto-installs — that is a contract (`missing-tool-handling`), not a limitation to work around.
  - **Resolved when:** condition described above clears

### [road-to-per-turn-hook-economy.md](roadmaps/road-to-per-turn-hook-economy.md)

**Road to per-turn hook economy — the latency tax no registered budget can see** — 11 / 14 done (79%)

| # | Phase | State | Open | Done | Deferred | Cancelled | % |
|---|---|---|---:|---:|---:|---:|---:|
| 0 | Falsify or localise the report | 🟡 in progress | 3 | 3 | 0 | 0 | 50% |
| 5 | Host-native prefiltering (runs first, deliberately) | ✅ done | 0 | 1 | 1 | 1 | 100% |
| 1 | Serialize once (D-2) | ✅ done | 0 | 1 | 0 | 1 | 100% |
| 2 | Payload opt-in per concern (D-2, second lever) | ✅ done | 0 | 2 | 0 | 0 | 100% |
| 3 | Take the two spawns off the hot path (D-3) | ✅ done | 0 | 2 | 0 | 0 | 100% |
| 4 | Register the number the user feels (D-1) | ✅ done | 0 | 2 | 1 | 0 | 100% |

<a id="blockers-road-to-per-turn-hook-economy"></a>
**Blockers**

- **b-per-turn-composite-bar** (owner: user) — blocks Phase 4 step 4.2 only. Step 4.1 registers the composite as a measured row and 4.3 refreshes the census; both proceed without the bar.
  - **Recommendation:** **option (b) — register the row observe-only for one release.** No prior exists for a per-turn composite in this tree, so any number named today would be invented, and an invented bar on a summed metric is the flappiest possible gate. One release of observation produces the distribution the bar should come from. Option (a) is right afterwards, not now; option (c) leaves D-1 permanently unmeasurable, which is the defect itself.
  - **If you do nothing:** the per-turn cost stays structurally invisible — every slot green, the number the user feels unrepresented — and Phases 1, 2, 3 and 5 land with no bar to prove they helped. The budget-ownership discipline this repo follows says the bar precedes the lever, so the phases would be shipping against no registered target at all.
  - **What to do:**
    pre-register the per-turn composite bar. The composite itself is
    defined in step 4.1 — `(pre + post) × 10 + ups + stop` — so only the ceiling is
    open. Options: (a) adopt a composite p50 ceiling on CI hardware, naming the
    number; the source draft proposed **p50 ≤ 1.5 s at ten tool calls** and that is
    a candidate to accept or reject, not a measurement — no run in this tree
    produced it; (b) register the row as **observe-only** for one release and set the
    bar from the observed distribution, which is the honest choice if no prior exists;
    (c) decline the composite, in which case D-1 stays an unmeasured structural cost
    and this phase closes with that recorded. Note the latency file's existing
    posture: an absolute cap plus a pathology net, not a tight creep window, because
    shared CI runners flap.
  - **Resolved when:** one option is recorded at this blocker and — for (a) or (b) — the row exists in `hook-latency-budget.json` with its bar or its observe-only marker.
- **b-stdin-read-failure-policy** (owner: user) — blocks nothing — F-1's trigger is fixed and the residual failure is now loud. This records the half that is a policy call rather than a bug fix.
  - **Recommendation:** **option (c).** The bypass F-1 records is only consequential where a guard can refuse, and `pre_tool_use` is the one block-capable slot on this host; denying there costs a retryable refusal on an I/O error the retry budget already survived ten seconds of, while denying on `stop` or `post_tool_use` would refuse nothing and could break a turn end. Option (b) is the status quo and leaves a documented allow-on-failure on a security path; option (a) is right in spirit and pays for it on slots where it buys nothing.
  - **If you do nothing:** the residual failure stays an allow. It is no longer silent — that was the actual defect and it is fixed — but a reader of `hook-architecture-v1`'s fail-closed contract would still expect a refusal that does not happen, and nothing in the tree records the gap except this blocker.
  - **What to do:**
    decide what the dispatcher does when the stdin read **fails**,
    as distinct from stdin being empty. Both `_readStdin` and `readHookStdin` still
    convert any residual failure — an exhausted EAGAIN budget (~10 s), `EIO`,
    `EBADF` — into an empty string, after which the whole chain runs with no
    `tool_name` and the dispatcher exits 0. For a `fail_closed: true`,
    `severity: blocking` guard that is an allow. Options: (a) **deny** on a failed
    read for block-capable events that carry at least one fail-closed concern —
    the honest reading of fail-closed, at the cost of refusing a tool call on a
    transient I/O error; (b) keep allowing but treat the loud stderr line and the
    dispatch issue that now ship as sufficient, which is the current state;
    (c) deny only on the block-capable slot and allow elsewhere, which is (a)
    narrowed to where a guard can actually refuse.
  - **Resolved when:** one option is recorded at this blocker and, for (a) or (c), `_readStdin`'s failure path returns a deny for the named slots with a test that fails when it allows.
- **b-guard-tool-partition** (owner: user) — blocks nothing in this roadmap — step 5.1 is cancelled and Phases 1-4 proceed without it. It records the one reachable form of 5.1's goal so a later attempt starts from the decision rather than re-deriving it.
  - **Recommendation:** **option (c) — decline, and revisit only if Phase 4's registered composite exceeds its bar.** The gain is real but unmeasured, and the cost is a silently-skippable filter in front of the two guards that exist because a bypass must be impossible: `matcher` is a plain non-match, so unlike `if` it does not fail open, and a Claude tool-name addition (a renamed Bash variant, a new edit tool) would disable a guard with nothing in the tree noticing. Option (a) is the version worth having *after* the composite says the dispatch count is the binding cost; option (b) is strictly waste.
  - **If you do nothing:** the dispatcher keeps firing on every tool call regardless of whether any concern can act, the in-process `tools:` filter keeps absorbing the per-concern half on all eight platforms, and Phase 4's composite row is what tells anyone whether the remaining per-turn cost is worth a security-surface decision at all.
  - **What to do:**
    decide whether the three blocking `pre_tool_use` guards
    (`block-no-verify`, `block-kernel-rule-writes`, `block-config-weakening`) may
    carry a **claude-only** host tool filter. Only that unlocks a zero-dispatch
    path for tools no concern can act on — `WebFetch`, `WebSearch`, `TodoWrite`,
    `Skill`, MCP tools — which is a large share of calls in an agentic turn.
    Options: (a) partition the claude tool space into disjoint classes and assign
    every concern, guards included, per class; (b) partition only the advisory
    concerns and keep one unscoped group for the guards, which keeps the guards
    safe and buys **nothing** (finding 2 of step 5.1 — the unscoped group still
    fires on every call); (c) decline, and D-1 is addressed only by Phase 4's
    measurement plus the in-process `tools:` filter that already ships.
  - **Resolved when:** one option is recorded at this blocker, and — for (a) — the partition ships with a per-class absent-invocation proof and a test that fails when a claude tool name is added to no class.
- **b-payload-read-parse-dominates** (owner: user) — blocks nothing — Phase 2 has landed and published its null. This records the finding that null produced, so the next attempt at D-2 starts from the measurement rather than from the roadmap's original attribution.
  - **Recommendation:** **(a) first, and it is cheap.** The read-and-exit measurement is one small script plus one bench cell and it settles whether option (b) is a conclusion or a shrug. Without it "the host makes us pay this" is an assumption of exactly the kind Phase 1 and Phase 2 have each already falsified once in this file.
  - **If you do nothing:** the large-payload cell stays roughly 60 % above the small one with no owner, and D-2's remaining cost keeps being attributed to per-concern churn in any future reading of § 0 — which is the specific error two phases of measurement have now refuted.
  - **What to do:**
    decide whether to open a step against the dispatcher's OWN
    read + parse of the payload, which two independent measurements now name as the
    dominant term of the large-payload cell. Phase 1 removed ten of eleven
    stringifies and moved nothing; Phase 2 removed the body from six of eleven
    concerns and moved nothing (82 ms small vs 130–143 ms large, and the two arm
    pairs do not reproduce each other). What remains between the two cells happens ONCE per event, before any
    concern runs: `readFd0ToEnd` reads the whole payload from the pipe and
    `_build_envelope` `JSON.parse`s it. Options: (a) open a phase to measure that
    step in isolation — a dispatcher that reads and immediately exits, against the
    same fixture, which would say how much of the ~50 ms gap is unavoidable transport;
    (b) accept the cell as host-imposed and close D-2 as mis-attributed, keeping
    the two landed levers as the strictly-less-work outcome; (c) treat it as a
    streaming/incremental-parse question, which is a much larger change than
    anything this roadmap scoped.
  - **Resolved when:** one option is recorded at this blocker and — for (a) — the read-and-exit cell exists on the § 2 matrix, so the unavoidable transport share of the large-payload cell is a number rather than an assumption.
- **b-injection-scan-unwrap-security** (owner: user) — blocks nothing in this roadmap. It is the half of `b-payload-mis-nested-readers` that option (b) deliberately did not ship, kept as a blocker rather than a prose note so it stays visible to the estate's own blocker count.
  - **Recommendation:** **(a), as its own PR.** The fixtures are the deliverable, not the one-line change — without them the fix is a coverage change nobody can review, which is exactly the reason the council split it out of the `ship-diff-volume` PR rather than shipping the pair.
  - **If you do nothing:** the scanner's production coverage stays a property of its fallback rather than of its contract, and the next envelope change can remove it with every test still green.
  - **What to do:**
    decide whether to fix `injection_scan_hook.ts`'s unwrap.
    `_tool_output` reads `tool_response` / `tool_result` / `toolResponse` /
    `output` / `result` off the envelope ROOT, where the dispatcher never puts
    them, and then falls through to serialising the WHOLE envelope. So the scanner
    does run and does see the tool output today — inside a serialisation of
    everything else as well. It works by accident, and nothing tests the accident.
    **Why this is not a drive-by edit.** Fixing the unwrap NARROWS what the
    scanner reads, on a security surface. The current fallback is a superset: it
    can raise a hit on text that is not tool output at all (a false positive that
    currently costs a warning), and the narrowed version could drop a host shape
    nobody enumerated (a false negative that costs coverage). Neither direction is
    decidable without first writing down what the scanner is contractually
    supposed to read.
    Options: (a) establish the intended output-envelope contract with fixtures for
    the valid, missing and malformed payload shapes, then fix the unwrap against
    it; (b) fix the unwrap and keep the whole-envelope serialisation as an
    explicit second pass, trading precision for coverage; (c) leave it and record
    in the concern itself that its production coverage is fallback-dependent.
  - **Resolved when:** one option is recorded at this blocker and — for (a) or (b) — `injection-scan` carries a test that fails against the pre-fix unwrap, with the valid / missing / malformed payload shapes named.
- **b-stop-async-split-prerequisites** (owner: user) — blocks step 5.3 only. Phases 1-4 are unaffected and Phase 2 has landed.
  - **Recommendation:** **(a), and P3 before anything else.** P3 is a live data-integrity defect that does not need the split to matter: `dispatch-issues.jsonl` already has no lock today, and any second concurrent dispatcher — two platforms installed into one workspace, which the manifest supports — can truncate it. Fixing it is small, independently valuable, and turns the riskiest part of a future split into a non-issue. Option (b) is tempting and is the wrong first move: it pays P1's contract change for one concern while leaving the collisions in place. Option (c) is defensible only if Phase 4's composite says turn-end wall clock is not the binding cost.
  - **If you do nothing:** turn-end wall clock keeps carrying eight concerns that cannot refuse anything, `dispatch-issues.jsonl` stays corruption-capable under any concurrent dispatch, and the classification above rots — it is pinned to `hook_manifest.yaml` as it stands today, and every added `stop` concern makes it less true.
  - **What to do:**
    decide whether to open the prerequisite work that makes 5.3
    buildable. The classification it needed is DONE and is recorded at the step —
    eleven concerns on claude's `stop`, three sync-required (`turn-end-gate`,
    `end-review-nudge`, `session-eol`), eight async-capable. The host capability is
    also settled: the installed binary carries `asyncRewake`. What is open is five
    prerequisites, each verified against the tree:
    · **(P1)** `build_claude_hook_matrix` returns ONE command per native event and
    `claude_hook_matrix_parity.test.ts` asserts exactly one group with exactly one
    command; a sync/async split needs two `Stop` entries, i.e. a deliberate change
    to the type that carries the hook matrix into every claude consumer's settings.
    · **(P2)** `turn_end_gate_hook` reads `agents/state/verify-before-complete.json`
    and its producer is async-capable, so the split puts a refusal surface's input
    behind a race whose losing branch makes the gate ALLOW.
    · **(P3)** two parallel dispatches collide on `summary.json` (lossy overwrite),
    `rule-trips.json` (lost update — the read is outside the lock), and
    `dispatch-issues.jsonl` (**no lock, no tmp+rename — corruption-capable**, and
    written precisely when something already went wrong).
    · **(P4)** `state_io`'s lock names concurrent dispatcher invocations as the case
    it guards and then `rmSync`s the other holder's sentinel after a 5000 ms
    deadline, so under contention it stops guarding that case.
    · **(P5)** the step's `verify:` — an artefact diff proving every async concern
    still writes its artefact — is a claim about what the HOST does with
    `async: true` and is not observable from this repository.
    Options: (a) open a phase that lands P3 and P4 first (locking and per-invocation
    discriminators are useful on their own, independent of any split), then P1 and P2
    as one reviewed change, then the split behind P5's live check; (b) land ONLY
    `roadmap-progress` async — the single best candidate, the only concern whose cost
    is a `spawnSync` with a 30 s timeout the in-process runner cannot preempt — which
    still needs P1 and P3 but not P2; (c) cancel 5.3 the way 5.1 was cancelled and
    record that turn-end wall clock is addressed only by Phase 4's measurement.
  - **Resolved when:** one option is recorded at this blocker and — for (a) or (b) — P3's three files are written under a lock with a tmp+rename and a test that fails against the current unlocked write, before any group split ships.

_2 blockers resolved._

### [road-to-rule-coherence-followup.md](roadmaps/road-to-rule-coherence-followup.md)

**Follow-up to road-to-rule-coherence** — 2 / 9 done (22%)

| # | Phase | State | Open | Done | Deferred | Cancelled | % |
|---|---|---|---:|---:|---:|---:|---:|
| 1 | The default flip (human release gate) | ⬜ not started | 4 | 0 | 0 | 0 | 0% |
| 2 | Measure, with the comparison that is actually open | ⬜ not started | 1 | 0 | 0 | 0 | 0% |
| 3 | Architecture, owned elsewhere | ⬜ not started | 1 | 0 | 0 | 0 | 0% |
| 4 | Re-adjudicate what the audit left open | ✅ done | 0 | 1 | 0 | 0 | 100% |
| 5 | Retire the two provisional numbers | 🟡 in progress | 1 | 1 | 0 | 0 | 50% |

<a id="blockers-road-to-rule-coherence-followup"></a>
**Blockers**

- **default-flip-release-gate** (owner: maintainer) — blocks Phase 1
  - **What to do:**
    rule on whether the measured configuration becomes the shipped
    default. The evidence is prepared and cited in F1.1–F1.4; the settings
    template's own comment on `rule_packs` — "Do not set this from automation" —
    is why this cannot be an agent decision.
  - **Resolved when:** the maintainer merges the flip with the census attached, or records a decision to keep the current default and ship the preset as opt-in.
- **bench-spend-and-methodology** (owner: maintainer) — blocks Phase 2
  - **What to do:**
    authorize the A/B run and confirm the methodology. The council
    was explicit that an LLM-judged probe has no power against the original
    human-judged production measurement, so a real claim needs human judging at
    adequate N.
  - **Resolved when:** thresholds are pre-registered here and the run is authorized, or F2.1 is cancelled and the preset ships documentation-only.

### [road-to-solution-minimalism.md](roadmaps/road-to-solution-minimalism.md)

**Road to solution minimalism — a first-class discipline against over-building** — 31 / 32 done (97%)

| # | Phase | State | Open | Done | Deferred | Cancelled | % |
|---|---|---|---:|---:|---:|---:|---:|
| 0 | Verification spikes (read-only, no authoring) | ✅ done | 0 | 3 | 0 | 0 | 100% |
| 1 | The ladder, as rule text | ✅ done | 0 | 12 | 0 | 1 | 100% |
| 2 | Over-build review lens | ✅ done | 0 | 4 | 0 | 0 | 100% |
| 3 | Pinned public-repo benchmark (the proof exhibit) | 🟡 in progress | 1 | 12 | 0 | 3 | 92% |

### [road-to-standing-context-40k.md](roadmaps/road-to-standing-context-40k.md)

**Road to standing context 40k — the registered destination, given a route** — 3 / 7 done (43%)

| # | Phase | State | Open | Done | Deferred | Cancelled | % |
|---|---|---|---:|---:|---:|---:|---:|
| 0 | Rule out the double-delivery layer first | ⬜ not started | 1 | 0 | 0 | 0 | 0% |
| 1 | Pull the lever that already exists | ✅ done | 0 | 1 | 0 | 1 | 100% |
| 2 | Shrink the structural payload without touching reach | ⬜ not started | 2 | 0 | 0 | 0 | 0% |
| 3 | Give rules a runtime carrier, or retire the dead triggers | ⬜ not started | 1 | 0 | 1 | 0 | 0% |
| 4 | Per-turn injection aggregate | ✅ done | 0 | 2 | 0 | 0 | 100% |

<a id="blockers-road-to-standing-context-40k"></a>
**Blockers**

- **b-rules-efficiency-signal** (owner: maintainer) — blocks Phase 3 step 3.1 only. Step 3.0's observer is repo work and proceeds without it.
  - **Recommendation:** **land step 3.0's observer first and re-date this blocker against it.** The fork cannot be decided today in either direction: option (a) needs a demand signal that does not exist, and option (b) would delete trigger frontmatter on the *absence* of a measurement rather than on a measured null — which is the unbacked-claim failure this repo gates against. The observer converts the metric from an emitter simulation into a per-session ground truth, and it is repo work needing no decision.
  - **If you do nothing:** roughly a hundred `type: auto` rules keep carrying `triggers:` blocks that no runtime consumer reads on this host — documentation presenting itself as mechanism — and the fork stays open indefinitely, which is the third state AC-3 explicitly forbids. - **Correction B, 2026-08-20 — the window is unfilled because NOTHING PRODUCES THE FIELD, not because no sessions occurred.** Kept alongside Correction A rather than replacing it: A found step 3.0's named filler unavailable, B finds that no *other* filler exists either, so the two together are why this cannot converge by waiting. Evidence, all re-run today and cited at step 3.1's `decision 2026-08-20:` comment: `dispatch_economy_report` prints **`no data`** for `rules_efficiency`, never `0.00`; the telemetry contract states `null` = *not measured* for both fields; `orchestration_record_hook.ts` — the concern that fires per dispatch — contains **zero** occurrences of either field name in any branch; and the audit log holds **579 orchestration lines for 2026-08 with `rules_carried` null on 579 of 579, zero numeric**. Abundant dispatch with the field absent on every line is a property of the code, not of the sessions. **By the disposition framework's own rule 4 ("instrument broken → `B`") this is a TRANSFER, not a measured null**, and it is recorded as one here even though the recorded disposition was `C`. The recording half of `C` still stands and is still applied: the clause licenses it and the window genuinely is unfilled. - **Recorded resolution 2026-08-20 (checkpoint only — this blocker stays OPEN).** Council disposition `C`, outcome `narrowed`, from [`drain-blocker-dispositions-a.md`](../evidence/council/drain-blocker-dispositions-a.md). The `rules_efficiency` window is hereby recorded **unfilled**: 0 envelopes carrying the pair, median quota unreadable, low-quota bar (< 0.2) not evaluable. Step 3.0's observer is **preserved** (still `[ ]`, premise unchanged). The fork is **re-dated to 2026-09-17**. No retriever work starts before the pre-registered comparison against `src/scripts/_lib/lexical_index.ts`. **The new date is a checkpoint, not a forecast** — per Correction B nothing in the tree will fill this window by 2026-09-17 or any later date without a producer, so a bare re-date on that day would be the parking-lot failure the framework's rule 1 names. No metric file was edited and no line was appended to fill the window; the emptiness is reported as found. - **Re-entry producer + probe (the transfer half, per framework rule 6).** Producer: whatever first writes a numeric `rules_carried`/`rules_used` pair — either the worker thin projection of `road-to-token-economy-dispatch` Phase 3 (whose own `projection_quality.status` still reads `armed-awaiting-projection`), or an explicit extension of `orchestration_record_hook.buildRecordInput` to emit the pair. Probe, one command and mechanically decidable: `./scripts-run src/scripts/dispatch_economy_report` reports `envelopes with pair` **> 0** for `rules_efficiency`. Until that reads non-zero, neither fork arm has evidence: (a) has no demand signal, and (b) would delete trigger frontmatter on an absence-of-measurement rather than a measured null — the unbacked-claim failure this repository gates against.
  - **What to do:**
    the fork needs the registered `rules_efficiency` metric in
    `dispatch-economy-metrics.json` to have accumulated enough sessions to read
    against its low-quota bar. Either wait for the observer from step 3.0 to fill
    it, or record here that the window is unfilled and re-date the fork — which is
    itself progress, per the same discipline the telemetry-count gates use. Do not
    build a retriever before the comparison against `src/scripts/_lib/lexical_index.ts`
    that `later/road-to-deferred-rule-retriever` pre-registered.
  - **Resolved when:** the metric reads against its bar and the fork resolves to (a) or (b), or the window is recorded as unfilled with a new date.

### [road-to-subagent-lifecycle-integrity.md](roadmaps/road-to-subagent-lifecycle-integrity.md)

**Road to subagent lifecycle integrity — turn three production symptoms into deterministic guards** — 13 / 17 done (76%)

| # | Phase | State | Open | Done | Deferred | Cancelled | % |
|---|---|---|---:|---:|---:|---:|---:|
| 0 | Spikes — pin the host, reproduce the two upstream premises | ✅ done | 0 | 2 | 0 | 2 | 100% |
| 1 | Measure — lifecycle capture, no behaviour change | 🟡 in progress | 1 | 3 | 0 | 0 | 75% |
| 2 | Return-channel integrity — validate, fall back to disk, retry once | 🟡 in progress | 2 | 1 | 0 | 0 | 33% |
| 3 | Runaway containment — spawn guard, ledger-aware stop gate, shadow stop-loss | ✅ done | 0 | 3 | 0 | 0 | 100% |
| 4 | Role axis binds on payload, not env | ✅ done | 0 | 2 | 0 | 1 | 100% |
| 5 | Tier routing has a caller — measure whether it moved the distribution | ✅ done | 0 | 2 | 0 | 0 | 100% |
| 6 | Frontend amendments — SUPERSEDED by road-to-source-first-frontend | ⏭️ skipped | 0 | 0 | 0 | 2 | 0% |
| 7 | The `do_not_touch` write-guard — relocated, and deliberately its own phase | ⬜ not started | 1 | 0 | 0 | 0 | 0% |

### [road-to-user-out-of-the-loop.md](roadmaps/road-to-user-out-of-the-loop.md)

**Road to user-out-of-the-loop** — 9 / 40 done (22%)

| # | Phase | State | Open | Done | Deferred | Cancelled | % |
|---|---|---|---:|---:|---:|---:|---:|
| 0 | Measurement foundation | ✅ done | 0 | 3 | 0 | 0 | 100% |
| 1 | One elicitation surface | 🟡 in progress | 1 | 6 | 0 | 0 | 86% |
| 2 | Set scope, serial then parallel | ⬜ not started | 5 | 0 | 0 | 0 | 0% |
| 3 | Merge decoupling | ⬜ not started | 3 | 0 | 0 | 0 | 0% |
| 4 | Question-elimination ladder | ⬜ not started | 5 | 0 | 0 | 0 | 0% |
| 5 | Asynchronous disposition of deferred items | ⬜ not started | 2 | 0 | 0 | 0 | 0% |
| 6 | Session continuity | ⬜ not started | 4 | 0 | 0 | 0 | 0% |
| 7 | Unattended backlog operation | ⬜ not started | 3 | 0 | 0 | 0 | 0% |
| 8 | Standing measurement | ⬜ not started | 8 | 0 | 0 | 0 | 0% |

<a id="blockers-road-to-user-out-of-the-loop"></a>
**Blockers**

- **kernel-soak-window** (owner: user) — blocks Phase 1 (batch elicitation carve-out — the only true kernel delta), Phase 2 (set-scoped autonomy form), Phase 4 (late-artifact policy), Phase 5 (deferred-policy delta)
  - **Recommendation:** Authorize `ask-when-uncertain` on its own with the soak, and let the other three proceed as ordinary rule edits in the order 5-2, 4-4, 2-3 — the deferred-policy delta first because it is the smallest. Holding three non-kernel edits behind a soak window they do not need is the cost this blocker was accidentally imposing.
  - **If you do nothing:** Phases 1, 2, 4, and 5 each stop at their rule-delta step. Everything else in the plan still runs — the measurement foundation, the mode-derivation ladder, the decision sheet, the set command, stacking, the merge train, the memo channel, and the session work touch no kernel rule. The plan degrades to roughly two thirds of its scope rather than stalling.
  - **What to do:**
    1. Confirm the deltas are in scope at all. **Corrected 2026-08-17, verified against the tree — this blocker overstated its own scope 4:1.** Only `ask-when-uncertain` (batch elicitation) is in the locked kernel set (`docs/contracts/kernel-membership.md § 4`, row 142) and needs the own-PR + soak guarantee. `autonomy-mechanics` (set-scoped form) is **not a rule at all** — it is a context at `src/agent-src/contexts/execution/autonomy-mechanics.md`, so the rules-tree path for it does not exist. `artifact-drafting-protocol` (late artifacts) and `roadmap-progress-sync` (deferred policy) ARE rules but are **absent from the locked nine**. Three of the four therefore need no soak window; the phase text calling them "kernel-adjacent" is what carried the error forward.
    2. Name the order, or accept the recommended one.
    3. Confirm the soak interval per `src/agent-src/contexts/authority/kernel-rule-edits.md` — for `ask-when-uncertain` only. The agent will not shorten it and cannot self-authorize it.
  - **Resolved when:** the user authorizes or declines the `ask-when-uncertain` delta, and says whether the three non-kernel deltas proceed independently.
- **autonomy-defaults-sheet** (owner: user) — blocks Phase 1 (preselection), Phase 2 (lane cap), Phase 4 (late-artifact default), Phase 5 (policy breadth)
  - **Recommendation:** Preselect `autonomous` at the contract screen, cap lanes at two, default late artifacts to `auto-research`, and keep the deferred policy limited to the follow-up-draft option. Rationale: each is reversible, each carries its own kill criterion in the phase text, and the conservative variant of all four together produces a plan that measures nothing because nothing changes.
  - **If you do nothing:** the phases can still be built with the conservative variant of each; the measurement in Phase 0 then compares a smaller delta and takes proportionally longer to reach significance.
  - **What to do:**
    1. Confirm or override the preselection for `/roadmap:next`: `autonomous` versus `phase-checkpoints`.
    2. Confirm or override the lane cap: 2 versus the configured `subagents.max_parallel`.
    3. Confirm or override the late-artifact default: `auto-research` versus `halt`.
    4. Confirm whether the deferred policy offers only the follow-up-draft option or also an explicit cancellation with a reasoning memo.
  - **Resolved when:** the four values are named, and they are recorded in the decision sheet the Phase 1 contract screen renders.

---

## Ticket bundles

Materialised ticket bundles under [`agents/tickets/`](tickets/) (via `/roadmap:materialize`), counted from `agents/tickets/_registry.yml`.

| Bundle | Tickets | Status | Source roadmap |
|---|---:|---|---|
| road-to-ticket-bundles | 6 | in_progress | agents/roadmaps/archive/road-to-ticket-bundles.md |

