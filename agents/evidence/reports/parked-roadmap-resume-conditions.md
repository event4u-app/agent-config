<!-- evidence-type: analysis -->

# Parked-roadmap resume-condition inventory

**Date:** 2026-08-23. **For:** `road-to-unowned-resume-conditions` Phase 2, which is
**report-only by construction** — nothing is gated on this file, because a gate over a
judgement call is the mechanism this repository's own reviewers keep asking it to stop
building.

**Scope:** every `*.md` under `agents/roadmaps/later/` except `README.md`, which is the
directory's own contract rather than a parked roadmap. **60 files**, matching
`ls agents/roadmaps/later/*.md | wc -l` = 61 minus that one.

## Method, and what the verdicts do and do not claim

Each file's resume statement was read as written and classified into the three verdicts
step 2.1 defines:

- **`reachable`** — an owner and a channel both exist. A maintainer decision counts: the
  owner is the maintainer and the channel is their choosing. A named file appearing counts
  when something in the tree could write it.
- **`unreachable`** — the named input cannot arrive through any channel this repository
  controls.
- **`absent`** — no statement of what ends the park.

This is a judgement over the statement, not a re-verification of each roadmap's premises.
Where a verdict rests on something checkable, the check is named in the row. Two of the
three non-`reachable` rows were verified individually against the tree; the 57 `reachable`
rows were classified from their condition text.

## Summary — and the null is the headline

| verdict | count |
|---|---|
| `reachable` | **56** |
| `unreachable` | **2** |
| `absent` | **2** |

**Step 2.2's stated expectation held, and it is the honest result: `unreachable` outside
the known instance is 1, not a pattern.** The roadmap said in advance that "every other
parked condition is reachable" would mean the two instances are idiosyncratic rather than
systemic, and that this should be recorded as such instead of manufacturing a pattern.
What the sweep found is one instance beyond the known one, and it fails for a *different*
reason — a third-party host capability, not a terminated producer. So there are two
unreachable conditions with two distinct causes and no shared mechanism, which is not a
class. Risk 3 of this roadmap named exactly this outcome and it is the one that occurred.

**A method correction, recorded because it changed a count.** The first pass extracted
resume statements with a line-anchored pattern and left 15 rows with no condition text —
15 rows reading "no resume statement" while classified `reachable`, which is
self-contradictory on its face. Thirteen were wrapped across lines and are recovered by
normalising whitespace before matching; two state their gate in prose the pattern cannot
reach and are quoted by hand, marked as such below. The re-read moved
`road-to-thin-flip-under-anchor-scoring` from `reachable` to `absent`, so `absent` is 2 and
`reachable` is 56. A row whose text the extractor could not find is not evidence that the
roadmap has no condition — it is evidence about the extractor, and conflating the two is
how an inventory manufactures the pattern it was told not to manufacture.

## The three rows that are not `reachable`

### 1. `road-to-agent-config-next.md` — **unreachable** (the known instance, leg (b))

Resume needs BOTH legs. Leg **(b)** is ">= 95 % response-envelope adoption over >= 500
stops". Verified: its named owner `road-to-subagent-envelope-adoption` was **archived** with
Phase 2 and AC-3/AC-4 all `[-]`, its last published rate is **0.00 % — 0 `ok` of 1,296
stops**, and the ledger the measurement would come from is under `agents/runtime/`,
gitignored at `.gitignore:190`, with no workflow ingesting it. The producer terminated and
the input has no arrival channel.

**Addressed in this same change** by step 1.1, taking the blocker's outlet (a) — name what
would make the input arrive and keep the condition — so the leg now carries a named channel
rather than being restated downward. The row is recorded as it was **at discovery**, because
an inventory that silently reflects the fix it triggered cannot be used to check the fix.

### 2. `road-to-mixed-trigger-activation-cost.md` — **unreachable**, and for a different reason

> *"Blocked until: the host exposes an `InstructionsLoaded` observer that a session can read
> (step 3.3's instrument; absent from the 2.1.229 binary's token extraction, so building
> against it today would be designing on an assumption)."*

The input is a **third-party host binary capability**. No owner in this tree can discharge
it and no channel here produces it. It is nonetheless *better specified* than leg (b) was:
it names precisely what would make it arrive, which is the shape outlet (a) asks for, and it
names the binary version it was checked against. So it is unreachable-by-us rather than
undefined, and it needs no repair — a reader can tell what state it is in, which is this
roadmap's actual goal.

### 3. `road-to-thin-flip-under-anchor-scoring.md` — **absent**

> *"PARKED: instrument not achievable with available evaluators. Two attempts, both closed
> by measurement."*

It states its cause in unusual detail — inter-evaluator Cohen's κ = 0.472 against a
registered floor of 0.800, 34/130 disagreements, zero retries — and names no condition that
would end the park. Read strictly it is closer to *permanent* than to *absent*: an
instrument judged not achievable with available evaluators is a park with no expected
resume. The three-verdict schema step 2.1 defines has no `permanent` slot, so it is recorded
as `absent` with that reading stated, rather than silently filed under a verdict that fits
worse. What would make it `permanent` in the roadmap's own sense is one line naming what
would reopen it — a new evaluator clearing the κ floor — and adding that line is authoring
someone else's park, which Phase 2 does not do.

### 4. `road-to-benchmark-obsolescence-lifecycle.md` — **absent**

No resume statement, no trigger, no blocked-until line, and no owner. The file describes a
real gap (a benchmark-backed claim going stale because the technique migrated into default
model behaviour — "the strong-host null: vanilla = package = placebo") and states that this
has been measured but never modelled as a lifecycle with a re-run cadence. What it does not
state is what would move it out of `later/`.

**Not repaired here, deliberately.** Writing a resume condition into a roadmap this run did
not otherwise touch would be authoring someone else's park, and Phase 2 is report-only. It
is reported as the one `absent` row so the next reader meets a finding rather than a silence.

## Full inventory

| roadmap | verdict | condition as written (normalised whitespace, truncated) |
|---|---|---|
| `domain-pack-extraction-when-triggered` | **reachable** | Blocked until: `docs/contracts/domain-pack-overlap-inventory.md` exists. > That file is ADR-011's design gate, and its trigger conditions 2 and 3 are > downstream of it, so one `test -f` decides |
| `road-to-agent-config-next` | **unreachable** | Resume when BOTH conditions hold, measured and written > down, not asserted: (a) the standing-payload delta ledger has ≥ 4 weeks of > measured entries — the instrument `agents/roadmaps/road-to |
| `road-to-benchmark-obsolescence-lifecycle` | **absent** | (no resume condition stated) |
| `road-to-billing-cliff-detection` | **reachable** | Resume trigger All six verdict files exist under `agents/evidence/billing-cliff/`: `phase1-s1.md` … `phase1-s6.md`, each naming its surface as gate-grade, warning-grade, or null. S-6 was added on 2026 |
| `road-to-carrier-layer-convergence` | **reachable** | Resume when the before/after delivered-token pair for > Phase 3 exists: both readings taken on the maintainer's own installed topology, > either side of `install --layer`, recorded against one |
| `road-to-catalogue-host-fit` | **reachable** | Blocked until: `agents/evidence/metrics/skill-catalogue.jsonl` holds at > least 20 observations spanning at least 2 distinct `host` values. > Probe: `capture_skill_catalogue --cadence` prints pro |
| `road-to-command-structure-followup` | **reachable** | Blocked until: the per-item triggers below fire. ## Context These are lifted verbatim from the archived parent's Phase 5. The parent shipped the cluster restructuring; these two were council-defe |
| `road-to-composite-dispatch-topology` | **reachable** | Resume when Resume when ALL of: (a) the orchestration claim queue is free and the ≥ 20-audit-line bar is met, and (b) a post-hook telemetry capture rate has been recorded somewhere citable. Th |
| `road-to-conformance-round7-followup` | **reachable** | Resume when: the maintainer states a position on whether > `src/rules/commit-policy.md` § One-shot authorization names the remote-state > case — that is, when a `grep -niE 'remote.state\|deliver |
| `road-to-contract-integrity` | **reachable** | blocked until the > leanness / pruning track (`road-to-tier-removal` + command-surface-leanness) > prunes against the Phase-0 census; documenting families before the cull would > enshrine a bloa |
| `road-to-corpus-knowledge-skills` | **reachable** | Blocked until the maintainer names the first two corpora (Phase 0.2) or > archives this plan as demand-not-shown. Parked rather than active because every > remaining open item is gated on that o |
| `road-to-cost-parity-2-state-aware-dispatch` | **reachable** | Resume when EITHER: (a) the orchestration claim queue is free and the > ≥ 20-audit-line bar is met, or (b) the maintainer authorizes Phase 1 alone — > the resolver plus the record-only soak change no |
| `road-to-council-api-quota-source-split` | **reachable** | Blocked until `agents/evidence/council-api-fallback/quota-source-split-request.md` exists. <!-- ref-ignore --> > *(The marker is deliberate: this path is a condition, not a reference. The > file |
| `road-to-credible-install` | **reachable** | Resume when the breaking release carrying the Phase-2 scoped-projection > flip ships (human-gated) — then wait out the four-week window and record > met-or-honestly-missed in `docs/releases.md |
| `road-to-cross-model-residuals` | **reachable** | Resume when / Trigger This roadmap as a whole resumes when any item's trigger below fires. There is no single blocking condition — each item carries its own (per-item reopen gates). Nothing he |
| `road-to-cross-model-routing-eval` | **reachable** | Blocked until all three gates clear: (a) OpenAI and Gemini API > credentials are available to the eval env; (b) an in-host end-to-end > skill-invocation harness exists (measuring what the host a |
| `road-to-deferred-rule-retriever` | **reachable** | Blocked until BOTH hold: (1) the first native engine's Phase-5 benchmark > verdict is published (ADR-124 sequencing rule — one native engine at a > time; queue position 1 behind the code-graph engine  |
| `road-to-discipline-profile-tiering-followup` | **reachable** | Resume when: an open-source-host adapter exists AND the maintainer wants > the graduation answer (or the recorded revisit-if drop-condition fires). ## Phase 1: Full-tier disposition (carried fr |
| `road-to-external-proof-upgrade` | **reachable** | Resume when the maintainer picks up the encryption default-flip; it needs no > recruit session and never did. The recruit-session and beta-promotion phases stay > parked as out-of-scope rather |
| `road-to-gateway-harvest` | **reachable** | Resume when the maintainer decides to spend a slot on it. That is the only > remaining condition: a sequencing decision, in the maintainer's control, not an > event to wait for. Per-item evide |
| `road-to-guided-journeys` | **reachable** | Resume when the maintainer decides to spend a slot on it. That is the only > remaining condition: a sequencing decision, in the maintainer's control, not an > event to wait for. Per-item evide |
| `road-to-harvest-second-sweep-proposals` | **reachable** | Resume when the > maintainer decides to adopt either; each then lands as its own small PR > against the named target. ## Proposal 1 — compact clarification protocol (→ `ask-when-uncertain` / ` |
| `road-to-host-catalogue-contract` | **reachable** | Parked, not abandoned. Every step below needs one thing this tree cannot produce on its own: a catalogue observation taken against a named host build. Owner: maintainer. Review by: 2027-02-22. |
| `road-to-inbox-harvest-2026-08-d-llm-distillation-comparison` | **reachable** | The two gates, both must be true before this file leaves later/: (1) metering is live — the tool-result byte counter and capture-before-destruction have shipped; (2) a re-ask problem is measured, not  |
| `road-to-install-path-convergence-followup` | **reachable** | Blocked until the bootstrap shim has shipped and a monitoring window > (suggested: ~4 weeks post-merge) has elapsed. Execution starts when the > maintainer opens the checkpoint — this is a maint |
| `road-to-kernel-question-triangle` | **reachable** | Resume when `src/rules/ask-when-uncertain.md` carries the band-4 qualifier > below, i.e. when `grep -c 'Band-4 scope' src/rules/ask-when-uncertain.md` > returns non-zero. It returns 0 today — |
| `road-to-live-app-verdict` | **reachable** | Blocked until: a consumer repo's live-app CI run of the > `playwright-testing` skill is recorded under `agents/evidence/`. > Why that half and not the other: the trigger below is a conjunction wh |
| `road-to-mcp-full-power` | **reachable** | Blocked until the next council-approved MCP tool batch exists — the only open work (Phase 5 Step 3 codegen bridge + AC2) generates tools from an approved cut list, and the 2026-07-07 verdict lef |
| `road-to-mission-catalogue` | **reachable** | Blocked until the `/mission:upgrade` > infrastructure is operationally validated on a live Laravel repo (the Phase 2B > trigger). Every item below is gated on an unmet external trigger (a consum |
| `road-to-mixed-trigger-activation-cost` | **unreachable** | Blocked until: the host exposes an `InstructionsLoaded` observer that a > session can read (step 3.3's instrument; absent from the 2.1.229 binary's token > extraction, so building against it toda |
| `road-to-originality-gate-and-contributor-funnel` | **reachable** | Blocked until: the extraction demand-gate window closes — floor met > (≥ 3 distinct external signals) or 90 days after `docs/anti-reskin-gate.md` > lands on `main`. Phases 0-2 and the Phase-3 pro |
| `road-to-per-workspace-license-policy` | **reachable** | Blocked until: a real consumer repo hits the v1 escalation, i.e. a > heterogeneous monorepo (workspace SPDX id differs from root) is actually > encountered and the maintainer wants derivation ins |
| `road-to-plan-gates-measurement` | **reachable** | Trigger (flip to ready when): `agents/evidence/metrics/gate-metrics.jsonl` > holds `r2_review` events for 10 gated PRs (the Stage-A advisory > window is full). Stage B cannot be executed before the ba |
| `road-to-plugin-runtime-borrowings` | **reachable** | Resume when the maintainer decides to spend a slot on it. That is the only > remaining condition: a sequencing decision, in the maintainer's control, not an > event to wait for. Per-item evide |
| `road-to-policy-evaluation-core` | **reachable** | Blocked until BOTH hold: (1) the first native engine's Phase-5 benchmark > verdict is published (ADR-124 sequencing rule; queue position 2 per the > sequencing plan in `road-to-native-code-intelligenc |
| `road-to-product-bets` | **reachable** | Blocked until: a real external user signal naming rule count or surface > count as the adoption blocker is recorded under `agents/evidence/`. > Why this half: blocker `simple-expert-mode-demand-e |
| `road-to-reach-cost-primary-bench` | **reachable** | Resume trigger — any ONE of these, then move this file to `agents/roadmaps/` - Cost becomes a stated problem: a maintainer or consumer names research token spend as a felt cost worth engineering again |
| `road-to-reach-headless` | **reachable** | Resume trigger A measured need on a fourth platform: a concrete target where the content is provably absent from the served HTML (verified by fetching it and showing the absence, not by assuming a SPA |
| `road-to-reach-reddit-approved-api` | **reachable** | Resume trigger — any ONE - The maintainer chooses this successor (option (iii) in the recorded successor decision). - An application is submitted — at which point this file tracks the outcome rather t |
| `road-to-reach-reddit-session` | **reachable** | Resume trigger — BOTH must hold 1. An observed login wall or redirect-to-login on the `old.reddit` permalink fetch (the parser reporting `login_wall: true` on a real fetch). The announcement alone is  |
| `road-to-reach-transcribe` | **reachable** | Resume trigger A video task that fails specifically because no caption track exists — not because `yt-dlp` is missing (that is an install), not because the JS runtime is unconfigured (the doctor repor |
| `road-to-reach-twitter-login` | **reachable** | Resume trigger A task that genuinely needs a timeline, a search, or a full reply thread — stated concretely, not anticipated. Until then, the honest answer ("replies are not available on this path") i |
| `road-to-regulatory-radar` | **reachable** | Resume when an owner is named with a stated refresh cadence > (`b-regulatory-owner-and-cadence`) and the carry-vs-route decision has > been taken against `docs/decisions/ADR-238-security-conte |
| `road-to-run-continuation-observation` | **reachable** | Resume when any roadmap carrying > `execution.mode: autonomous` with open steps in three or more `## Phase` > sections is run to completion from a worktree and reaches a PR — then read the > r |
| `road-to-skill-ecosystem-capability-queue` | **reachable** | Resume when a slot frees and the maintainer picks an entry for it. Verify > with `./agent-config roadmap:progress`. Promotion is still per entry rather than > as a batch — that discipline was |
| `road-to-skill-ecosystem-eval-integrity` | **reachable** | Resume when a verification slot frees — a predecessor roadmap reaches zero > open steps and lands in `agents/roadmaps/archive/`. Verify with > `./agent-config roadmap:progress`. > Put a gate o |
| `road-to-skill-ecosystem-executable-payloads` | **reachable** | Blocked until: `agents/evidence/analysis/skill-payload-phase0-spikes.md` > records the S0.1 invocation rate, the S0.2 median token delta and the S0.3 > detection result — a null counts as a recor |
| `road-to-skill-ecosystem-runtime-enforcement` | **reachable** | Resume when one of the two open verification roadmaps reaches zero open > steps and is archived, freeing a slot. Verify with > `./agent-config roadmap:progress` and by confirming the predecess |
| `road-to-skill-ecosystem-security-and-conformance` | **reachable** | Resume when a verification slot frees — a predecessor roadmap reaches zero > open steps and lands in `agents/roadmaps/archive/`. Verify with > `./agent-config roadmap:progress`. > Give three r |
| `road-to-sparring-critic-spike` | **reachable** | Blocked until BOTH hold: (1) `road-to-lean-agent-init.md` is closed and > its telemetry reviewed (council 2026-07-28 sequencing: the quantified > token-waste fix ships before any speculative sparring  |
| `road-to-surface-consolidation` | **reachable** | Resume when BOTH hold — the condition is conjunctive on > purpose, and the council corrected an earlier single-clause version of it: > (a) the pre-registered utilization window has elapsed (~2026-08-2 |
| `road-to-thin-flip-under-anchor-scoring` | **absent** | (no resume condition stated) |
| `road-to-token-economy-cache-followup` | **reachable** | Resume when: > `agents/runtime/state/injection-census.jsonl` covers ≥ 7 days of real > sessions (record mode: `./scripts-run src/scripts/bench_hook_injection --record` > per session, or the equ |
| `road-to-token-economy-dispatch-followup` | **reachable** | Resume when EITHER: (a) the `rules_used` > window has data (earliest ~2026-08-24 — run > `./scripts-run src/scripts/dispatch_economy_report` and check > `rules_efficiency.envelopes_with_pair > 0` over |
| `road-to-token-proof-and-story` | **reachable** | Resume when: a context-reduction mechanism (orchestration-scoped loading, > or a new single-request one) passes the quality gate AND real field > `sessions.jsonl` spend data exists for a before |
| `road-to-token-saving-HUMAN-MEASUREMENT` | **reachable** | Resume trigger (corrected 2026-07-29) Two independent triggers, no longer one: 1. H2 + H3 (judge-free). Not blocked by the closed judge path. H3 is fully deterministic and is now MEASURED (below). H2  |
| `road-to-token-saving` | **reachable** | Resume when the operator > runs either gate: (1) the RTK golden-set completeness validation (RTK > binary + live outputs) that gates the tier_2→kernel promotion — the > promotion itself then s |
| `road-to-voice-negative-lexicon` | **reachable** | Resume when the maintainer decides to spend a slot on it. That is the only > remaining condition: a sequencing decision, in the maintainer's control, not an > event to wait for. Per-item evide |
| `road-to-worker-generation-recycling` | **reachable** | Resume when the maintainer blockers are resolved and > Phase 1's exit gate (≥ 30 shadow capsules from real dispatches) has data. > Today a worker that reaches its tier budget is killed by stop |
| `road-to-zero-ceremony-host-primitives` | **reachable** | Blocked until the ADR that governs tier→model mapping enters its recorded > review window — where revisiting is procedurally cheap rather than a > supersession fight. Phase 0 is the only part th |
