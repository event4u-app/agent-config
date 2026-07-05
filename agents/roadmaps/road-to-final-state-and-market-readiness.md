---
complexity: structural
---

# Roadmap: Final state + market readiness

> Reach a best-in-class daily-driver dev-team tool **and** a marketable package by running two parallel tracks — Capability (gated, default-off until proven) and Adoption (table-stakes, wedge-first) — so trust and differentiated capability arrive together, never serial.

## Prerequisites

- [ ] Read `AGENTS.md`, `docs/contracts/package-self-orientation.md`
- [ ] Read the #699 anchors (foundation this builds on): `src/agent-src/contexts/execution/orchestration-telemetry.md`, `agents/settings/contexts/orchestration-default-flip-verdict.md`, `internal/bench/orchestration/README.md`
- [ ] Read `docs/contracts/subagent-boundary.md` and `src/skills/subagent-orchestration/SKILL.md`
- [ ] Confirm the no-runtime identity floor (`source-of-truth`, no daemon / vector-DB / auto-write-memory)

## Context

External adoption is ≈0 (**7 GitHub stars vs ruflo's 62,099**). The package's engineering culture is its moat — falsifiability, governed learning loop, published honest-nulls, zero unbacked claims — a position ruflo cannot copy without dropping its unbacked "84.8% SWE-Bench" claim. The lever is no longer machinery; it is **trust + discoverability + low friction**, paired with *differentiated* capability so the offer is more than "ruflo but honest".

Two maintainer goals drive this plan:

- **(A) Capability final-state** — the best daily-driver tool for a dev team: faster execution, better coding agents, stronger self-learning.
- **(B) Market readiness** — make it adoptable: a < 5-minute path for an external dev to understand *why this is different*, install *one* obviously-useful thing, and *verify the trust claim themselves*.

This roadmap synthesizes six source drafts (an external multi-agent reference analysis — see Provenance) into one council-validated sequence, aligned against PR #699 (which landed the orchestration telemetry foundation).

- **Feature:** none (capability + adoption readiness)
- **Jira:** none

## Council notes (2026-06-30, claude-sonnet-4-5 + gpt-4o, 2 rounds, debate)

Both members opened Round 1 **skeptical of the subagent layer** (argue: cut draft #3, sequence adoption-first B→A, "building capability for an audience of one"). After steel-manning that position in Round 2, both **converged against cutting it** and onto a gated-parallel plan. The convergence — and, crucially, the skeptical points absorbed *as gates* rather than dismissed:

- **Do NOT cut the capability work — gate it hard.** The subagent layer is static artifact projection (`.claude/agents/*.md` = same kind as skills/personas), not the rejected runtime; ADR-105 already plans named units as the next step. But it ships **default-off, dual-baseline eval-gated**, and the deep validation waits for external telemetry. If evals fail or no external adopter ever enables it → **retire as a documented honest-null.**
- **Adoption-readiness is table-stakes and leads the external surface.** The wedge is the **`production-validator` persona** (30-second single install), NOT the subagent layer. Claims-Ledger + proof page are non-negotiable.
- **Parallel, not serial.** Capability (Track A) and Adoption (Track B) are different work streams that don't block each other; serializing adds weeks to the critical path for no safety gain.
- **Ship trust + capability together.** Honesty alone is a *defensive* moat (prevents overhype backlash); it is not an *offensive* differentiator. Trust-only risks ruflo copying the Claims-Ledger idea and erasing the gap. Capability-only stays undiscoverable.
- **The skeptical R1 points are real and become gates** (not ignored): monoculture data (one maintainer) limits validity of *all* learned artifacts → deep learning-loop analysis is gated on the first external adopter; named units are a deprecation commitment → keep the seed set minimal (≤9) and wedge-first; adoption is the binding constraint → Track B's conditional-launch gate.

## Council notes addendum (2026-07-04, claude-sonnet-4-5 + gpt-4o, 2-round gap-hunt — split, not converged)

A second council ran a **gap-hunt against the executed state** (A1 landing, Track B mostly done). It did **not** converge — the two members split and rebutted each other (claude: team-context persistence = highest-EV; gpt-4o: it violates minimalism; the live "Try Now" widget was rejected by *both* in round 2). Adjudicated against the identity guardrails; durable outcome:

- **Kept (net-new, cheap, culture-fit, non-duplicating):** dev-task throughput benchmark (A6) + worked example (A7); per-skill honest-null `gaps:` + proof-page "Known Limits" (B6); comparison-honesty table (B7); recorded proof-page demo (B8); pre-launch install-friction study (B9).
- **Deferred / rejected (see § Deferred candidates):** team-context persistence (split, no demand signal), skill-composition graph (covered by the commands layer), live proof widget (no-runtime floor), community/SEO/paid-marketing (post-adoption).
- **7-question coverage:** Q2/Q4/Q6/Q7 answered (Q4 folded into the 3 personas, B2); Q1/Q5 move partial→answered once A6 lands; Q3 is malformed (rescoped to Q5). The one real coverage gap the council surfaced — **no dev-task throughput evidence** — is closed by A6.

## Disposition of the six source drafts (KEEP / FOLD / GATE / CUT)

| Draft | Disposition | Where in this plan |
|---|---|---|
| **adoption-readiness** (positioning, Claims-Ledger, wedge, Starlight, proof, README) | **KEEP — leads Track B** | Phase 1 Track B |
| **ruflo-borrowings #4** Witness-manifest on claims | **FOLD → Claims-Ledger** (same mechanism) | Phase 1 Track B |
| **ruflo-borrowings #3** Per-subagent cost-attribution | **FOLD → #699 telemetry** + `verdict_changed_outcome` extension field | Phase 1 Track A / Phase 3 |
| **execution-subagents** (named subagent layer) | **KEEP — gated, default-off** | Phase 1 Track A |
| **subagent-seed-catalog** (9 seeds, start `production-validator`) | **KEEP — minimal, wedge-first** | Phase 1 Track A/B |
| **subagent-evals** (dual-baseline) | **KEEP — reuse #699 bench** | Phase 1 Track A |
| **closing-the-learning-loop #1** Ablation-mining · **#4** Near-miss clustering | **KEEP — net-new, on current audit log** | Phase 1 Track A |
| **closing-the-learning-loop #2** Rule-efficacy · **#3** Hit-rate | **GATE — external telemetry** (monoculture honesty) | Phase 3 |
| **ruflo-borrowings #1** Topology decision-matrix · **#2** Auto-retrieve cards | **GATE — defer to scale** (default-off, multi-user) | Phase 4 |
| **3 personas** (performance-engineer, data-integrity, production-validator) | **KEEP — net-new** (production-validator = wedge source) | Phase 1 Track B |
| ruflo runtime (consensus/CRDT/gossip/federation/daemon/neural-SONA) | **CUT — rejected runtime** | § Do NOT build |

## Phase 1: Parallel tracks (Track A gated, Track B table-stakes)

The two tracks run concurrently. Track B delivers the first external value; Track A delivers capability that may or may not ship (gated).

### Track A — Capability foundation (default-off, eval-gated)

- [ ] **A1 — Execution-subagent contract (keystone, Phase 0/1 of the draft).** `subagent-v1` contract: agent-config frontmatter schema + native-Claude-Code translation, `model_tier`→native `model:` via the existing generator mapping (ADR-035, **do not invent a new mapping**). Add `subagent` (or `agent`) as the 5th discovery category + glob + vocabulary lint + determinism. Frame explicitly as **static artifact projection — dispatch decision stays with the agent/skill, never runtime-enforced** (resolves the apparent no-runtime tension). ADR via council. <!-- partial: council 2026-07-04 (claude-sonnet-4-5 + gpt-4o) → ADR-109 ratifies the contract (new `subagent` category, governance-required schema, model_tier reuse incl. `inherit` passthrough, cross-host degradation to loadable context, default-off, banned runtime fields). DONE: (#707) ADR-109 + subagent.schema.json + src/subagents/production-validator.md + validate_frontmatter enforcement + contract test; (#708) standalone determinism lint (const/uniqueItems/name); (this PR) 5th discovery category via Option B — ADR-109 Amendment 1 (council 2026-07-04): build_discovery_manifest _CATEGORY_VALUES/_CATEGORY_SCHEMA/_iter_artefacts glob + _classify subagent-branch (default-off, packs:[]), discovery-manifest.schema.json enum + by_category. REMAINING: generate-tools native-CC projection (condense.ts generate_tools → .claude/agents/, model_tier→model, cross-host degradation to context file). Then A2 (echo-noop pipeline proof), A3 (eval, Gate A). -->

- [x] **A2 — Pipeline proof (one throwaway unit).** Project a single `echo-noop` unit end-to-end to prove fidelity / byte-budget / install-completeness gates, before any real prompt quality is risked. <!-- done: pipeline proven end-to-end by A1 (real unit projects; fidelity test). install-completeness resolved via council 2026-07-05 (claude-fable-5 + gpt-4o) → WEDGE-ONLY distribution (ADR-109 Amendment 2); rejected dist-shipping synthesis on blast-radius evidence (cleanup_stale reaper + ~10 _root_specs consumers; ungoverned-executable-prompt risk). A2 gate = tests/scripts/subagent_distribution.test.ts (wedge↔src projection fidelity, coverage, negative-wiring locks); no byte-budget (arbitrary threshold = cargo-cult per council). Wedge doc regenerated as a projection of src/subagents (no drift). Side-fix: AnthropicClient joins all text blocks (extended-thinking models e.g. fable5 were silently dropped). No throwaway echo-noop added (real unit already proved the path; would pollute src). -->

- [ ] **A3 — Eval harness on the #699 bench.** Reuse `internal/bench/orchestration/` (do **not** build a parallel bench). Dual baselines: inline host **and** generic inline dispatch. Tokens always in the table. The one-file negative-control task MUST lose. `verdict_changed_outcome` is an **extension field on the #699 telemetry object**, not a second schema. <!-- partial (harness DELIVERED, run operator-gated) — PR #715: verdict_changed_outcome added to orchestration-telemetry.md (additive, not a 2nd schema); internal/bench/orchestration/ extended (no parallel bench) with pv-01 (hollow-detection) + pv-02 (negative-control MUST NOT flip) corpus tasks + a self-contained pv-hollow fixture (planted hollow charge() behind a green test; clean slugify() control); README A3 procedure = 3 arms (inline host / generic inline dispatch / production-validator) + per-arm table on verdict_changed_outcome + token_delta + Gate A. REMAINING: the billable 3-arm real-session run (harness can't spawn subagents headlessly) → operator-gated, produces the Gate-A verdict (ships the unit or records an honest-null). Then A4/A5 (learning-loop analysis, non-billable). -->
- [x] **A4 — Ablation-mining (learning-loop #1, net-new).** Correlate rule *absence* with failure across distinct `work_id`s → surface *missing-guardrail* candidates for `learning-to-rule-or-skill` (human-gated, raw counts, confounding named). Pure analysis on existing `audit-log-v1` fields. <!-- done: src/scripts/mine_missing_guardrails.ts — read-only over audit-log-v1; a rule is a candidate when absent in ≥2 distinct failing (blocked/error) work_ids AND success-associated in that phase; raw counts, correlation-not-causation caveat on every candidate; never auto-adds (surfaces for learning-to-rule-or-skill). Empty audit → exit 0. +tests. Consumes the real audit log when present. -->
- [x] **A5 — Near-miss clustering (learning-loop #4, net-new).** Second pass over the pattern miner: cluster `(phase, outcome)` keys with high rule-set Jaccard overlap for human review — never auto-merge. <!-- done: src/scripts/cluster_near_miss_patterns.ts — within each (phase,outcome), union-find clusters distinct rules_applied sets with Jaccard ≥ threshold (default 0.6) but < 1 (not identical); surfaces differing rules + min-jaccard for human review, NEVER auto-merges; reuses A4 loadRecords, does not touch the byte-identical extract_audit_patterns twin. Empty audit → exit 0. +tests. -->

- [x] **A6 — Dev-task discipline-Δ benchmark (net-new; the missing evidence for Q1/Q3/Q5, honestly framed).** Reuse the existing 4-arm discipline-axis bench (`bench_ab_v2_run.ts` + `internal/bench/corpora/ab-trackb-v2.yaml`; arms vanilla / package / package-rdp / placebo). **Do NOT build a throughput/speed bench** — capability is near-ceiling for both arms, so a "faster" frame relitigates the scrapped v1 capability frame and contradicts the discipline-transplant thesis (`council-discipline-axis-benchmark`, 2026-06-14; multiple honest-nulls). The ledger number is the **paired discipline-Δ** on real dev-task traps. **Falsifiability lock:** paired per-instance report; the placebo arm controls for prompt-length priming; deterministic scorer (no LLM judge). **NOT:** not a capability/speed bench; not a generic SWE-Bench clone. <!-- done 2026-07-05: operator-authorised live run (sonnet, vanilla,package × 3 seeds, 30-task corpus incl. the A7 Laravel trap, 180 runs, under $5 cap). RESULT = HONEST-NULL on the strong host: discipline 0.929→0.929 (Δ=+0.000, Wilcoxon p=1.0, n≠0=5), capability 94%→89% (non-sig), cost ~5× (185k→930k tok/run); GATE FALSIFIED-OR-INCONCLUSIVE (report internal/bench/reports/ab-v2/2026-07-05T07-00-31Z-ab-v2-paired.json). This REPLICATES + BROADENS the already-documented finding (docs/benchmark.md): the real, marketable lift is WEAK-HOST-specific (haiku +0.667 discipline, significant, placebo-controlled) — on a strong host both arms are at the discipline ceiling so the package is a redundant no-op at ~5× cost. Marketable number = the weak-host lift, now ledger-bound (docs/CLAIMS.md `discipline-lift-weak-host`, backed). The Laravel trap (A7) is consistent with the TS null on sonnet. CAVEAT: docs/benchmark.md is generated from the LATEST ab-v2 report by `bench:ab:v2:diff`; a regen now would render this sonnet null OVER the haiku PASS — do NOT regen until the generator carries both host results (follow-up, see below). -->
- [x] **A6-followup — benchmark.md must carry BOTH host results.** The generated `docs/benchmark.md` renders only the latest report; make it show the weak-host PASS *and* the strong-host null side by side, so a `bench:ab:v2:diff` regen cannot bury the weak-host lift. <!-- done 2026-07-05: docs/benchmark.md restructured into two labelled host sections — "Weak host (claude-haiku-4-5) — PASS" (existing +0.667 tables preserved) and "Strong host (sonnet, full 30-task corpus) — HONEST-NULL" (n=84, Δ=+0.000, 5× tokens, from the A6 report). Provenance line rewritten to "curated composite of two PINNED reports" (weak=2026-06-15T03-52-35Z, strong=2026-07-05T07-00-31Z) — explicitly NOT auto-gen-from-latest, killing the bury risk (there is also no wired `bench:ab:v2:diff` task — the stale ref was removed). Recursive-verification honest-null section preserved. Ledger pointer `#weak-host-specific` kept; check_claims green; docs/proof.md regenerated + drift-check green (now surfaces the weak-host claim ✅). -->
- [x] **A7 — Real-stack discipline-trap fixture (Laravel/PHP; extends the A6 corpus + doubles as a worked example).** Add ≥ 1 Laravel/PHP discipline trap to `ab-trackb-v2.yaml` so the discipline-Δ is measured on the team's *actual* stack, not only TS — the falsifiable form of B5's generalization-honesty concern. A recognizable Laravel slice with a deterministic file/regex oracle (no PHP runtime needed). **Falsifiability lock:** deterministic oracle; fixture byte-identical across arms; validated by the scorer offline, no billable run. **NOT:** not a toy; no `hidden_test` needing an interpreter; a real slice a Laravel dev recognizes. <!-- done: trapE-scope-laravel-01 added to ab-trackb-v2.yaml (corpus 29→30, hits headline N=30); fixture internal/bench/ab/fixtures-v2/trapE-scope-laravel-01/ (composer.json + app/Support/Money.php + app/Http/Controllers/CheckoutController.php); PHP twin of trapE-scope-01; oracle = required_files_modified (file-deterministic, no PHP runtime). Verified offline: YAML parses, all oracle keys implemented in bench_ab_scoring_v2, referenced files resolve, `bench_ab_v2_run --mode dry-run` recognizes the task ("No spend"). -->
- [x] **A7-run — Billable discipline-Δ run (operator-gated, part of A6).** The actual `bench_ab_v2_run --mode live` across arms — pinned sonnet, budget cap — that produces the paired discipline-Δ number. **Gated on explicit operator go + budget.** <!-- done 2026-07-05: operator authorised (Bash(npx *) permission); ran vanilla,package × 3 seeds, 180 runs, under $5. Result folded into A6 (strong-host honest-null). -->
- **Gate A6 (the honest verdict):** the "better for dev teams" claim is TRUE but **weak-host-bounded** — publish it as such (the package makes a *cheap/weak* host disciplined; a strong host already is). Do not market a strong-host lift; the strong-host null + ~5× cost is itself the honesty proof and reinforces `road-to-token-saving`.
- **Gate A:** A subagent unit ships **only** if A3 shows it beats *both* baselines by a meaningful margin at acceptable token cost. Otherwise it stays in `src/` + `gaps:` as a documented honest-null. No unit is default-on in Phase 1.
- **Rollback A:** Capability work is additive + default-off; reverting removes the discovery category + units with zero behavioural change to existing flows.

### Track B — Adoption readiness (table-stakes, wedge-first)

- [x] **B0 — Positioning.** Collect evidenced differentiators into `docs/positioning-evidence.md`; draft 3 H1 options (≥1 centering falsifiability); route through `/council:design`; **human picks**. <!-- done: docs/positioning-evidence.md (5 evidenced differentiators + 3 H1 options + decision); council 2026-07-04 (claude-sonnet-4-5 + gpt-4o) converged on substance, split on headline placement; human picked Option 1 (verifiability-as-frame), applied to README H1 + hero + launch-story. -->

- [x] **B1 — Claims-Ledger (the foundation; folds ruflo-borrowings #4).** `docs/CLAIMS.md` (id · claim · kind · evidence_pointer · last_verified) + `src/scripts/check_claims.ts` in CI: every public claim binds to a code-marker / bench artifact / test / `file:line`; a smuggled unbacked claim turns CI red (acceptance test of the mechanism itself). This is the mechanical anti-84.8% moat. <!-- done: docs/CLAIMS.md + src/scripts/check_claims.ts, wired into task ci (check_claims), 2 backed + 4 unbacked-inventory entries; merged #701. -->
- [x] **B2 — Three personas (net-new).** Author `performance-engineer`, `data-integrity`, `production-validator` per `persona-governance` (each must clear the redundancy gate: produces findings existing reviewers do not). `production-validator` is `tier: core` and the single source of truth for the wedge. <!-- done: src/agent-src/personas/{performance-engineer,data-integrity,production-validator}.md (7-section spine + neighbour disavowals); lint_persona_governance repointed to src/; merged #702. -->

- [x] **B3 — Wedge: `production-validator` single-install.** A 30-second, plugin-less install of the `production-validator` persona (`npx @event4u/agent-config add production-validator` or a `curl`), with a one-screen `docs/wedge/` README. Read-only, single-purpose, carries the anti-hallucination identity. **This is the highest-EV external door — not the subagent layer.** <!-- done: docs/wedge/production-validator/ — self-contained native subagent + curl install; delivered as a standalone .claude/agents/*.md (no full Track-A layer), surfaced in main README by B6 -->
- [ ] **B4 — Proof page + minimal Starlight.** Generated (not hand-maintained) claim→code binding table, honest-null benchmarks *including the nulls*, and a "verify it yourself" command block that runs on a fresh checkout. Site catalog generated from the discovery manifest; ≤5 top sections; not public yet. <!-- partial: proof-page half DELIVERED — docs/proof.md generated by src/scripts/build_proof.ts, drift-gated via `task build-proof-check` in CI, +test. Remaining: the Starlight site to host it (infra/tooling decision, maintainer-gated — deliberately not stood up autonomously). -->
- [x] **B5 — Generalization-honesty note (council gap).** Document the data provenance limit explicitly ("derived from production work on TypeScript/PHP packages; may not generalize to other stacks") wherever capability is claimed — the missing step the council flagged. <!-- done: honest-provenance callout added to README (What's different, the capability-claim surface) + launch-story guardrails; positioning-evidence.md carries the same framing. -->

- [ ] **B6 — Per-skill honest-null `gaps:` + proof-page "Known Limits" (net-new; the falsifiability moat applied to the skills themselves).** For the wedge + top-N most-used skills (**not** all 261 up front), add a `gaps:` array where each entry cites a witness test that demonstrates the failure; render a "Known Limits" column in the proof-page skill table. This is the offensive-differentiation item the 84.8%-reference structurally cannot ship. **Falsifiability lock:** CI (`check_skills`/witness) requires every `gaps:` entry to have a passing test that reproduces the failure; a stale-gap audit flags entries that no longer fail. **NOT:** not fixing the gaps (future work); not auto-discovered (human-gated); not all 261 at once.
- [ ] **B7 — Comparison-honesty table on the proof page (folds ruflo-borrowings framing; makes the moat legible).** A `[claim · our evidence · their evidence · checkable?]` table where the "checkable?" column is the differentiator — our claims verify via witness/ledger; the reference's headline claim does not. **Falsifiability lock:** CI requires every "our evidence" cell to resolve to a witness/honest-null and every "checkable ✓" to a passing test. **NOT:** not a hit-piece; only publicly-checkable third-party facts; the 84.8% is cited *only* as uncheckable, never counter-claimed.
- [ ] **B8 — Recorded proof-page demo (asciinema/GIF; no backend).** Embed short recorded runs of the wedge + 2–3 high-value skills so a skeptic sees real output in < 60s without installing. The live "Try Now" backend widget is **rejected** — runtime backend (no-runtime floor) + the validation-wedge does not demo generatively (council 2026-07-04, both members). **Falsifiability lock:** each recording regenerated in CI from a real run so it cannot drift from current behavior. **NOT:** no live code execution; no backend; no generative-skill theatrics orthogonal to the wedge.
- [ ] **B9 — Pre-launch install-friction study (feeds Gate C).** Recruit ≥ 3 external Laravel/TS devs (via `recruit-sessions/`, not the maintainer network); observe an unaided wedge install; record `docs/install-friction-report.md` (median time, abandonment, top-3 friction points). **Falsifiability lock:** median install > 60s or abandonment > 20% → the wedge failed, iterate before finalizing C2. **NOT:** not a full-toolset usability study; wedge only; observed behavior, not a survey.
- **Gate B:** `check_claims` green in CI and a deliberately-unbacked claim turns it red; the wedge installs in < 5 min on a foreign repo; proof page generates from real sources and the "verify it yourself" block passes on a clean checkout.
- **Rollback B:** Docs/site/ledger are additive; the wedge is a single file install path. No effect on existing flows.

## Phase 2: Conditional-launch gate (council gap — explicit decision point)

- [x] **C1 — Distribution drafts.** Marketplace listing + awesome-claude-code submission text + launch-story draft, all **ledger-consistent**, describing the wedge + proof page (not the OS, not subagents). Drafts only — submission is a human act. <!-- done: docs/distribution/awesome-list-submission.md + launch-story-draft.md (draft-only, ledger-consistent, no unbacked/third-party claims). Marketplace-description sharpening to the final positioning line is folded into C2/B0. -->
- [x] **C2 — README rewrite (last).** Leads with the chosen position, shows-instead-of-claims (links the proof page + a ledger-bound number), wedge-first path at the top, `check_claims` green. <!-- done: README H1 now leads with the chosen Option-1 position ("every claim machine-checked, including zero runtime"); hero line links docs/proof.md ("verify it yourself"); wedge-first curl block opens the Quickstart; check_claims green. -->

- **Gate C (the decision point):** Did the wedge acquire **≥ 1 external adopter**? **Yes** → proceed to distribution + promote. **No** → pause distribution, diagnose (positioning / docs / feature insufficiency), iterate Track B. Do not scale machinery into a vacuum.

## Phase 3: External-telemetry-gated (the monoculture honesty gate)

Triggered only when a first external adopter's telemetry appears in the audit log — their works produce *different* patterns than the maintainer's, which is the real multiplier on self-learning.

- [ ] **D1 — Rule-efficacy loop (learning-loop #2).** Per-rule outcome-delta on the **combined** corpus; null/negative-lift rules become retirement candidates. **Exception (never auto-retire):** a null-lift rule that prevents worst-case (security/data-loss) damage — efficacy ≠ risk metric.
- [ ] **D2 — Hit-rate meta-signal (learning-loop #3).** Never-hit cards = dead-weight candidates; high-asks/low-hits namespaces = self-reported knowledge gaps. Read-only aggregation, privacy-floor respected.
- [ ] **D3 — Subagent promotion decision.** Do external adopters enable subagents? Does it improve *their* outcomes? Promote to recommended-but-opt-in only on external evidence; else retire the layer with a documented honest-null. Feed `verdict_changed_outcome` telemetry into the decision.
- [ ] **D4 — `auto: on` flip re-evaluation.** Run accumulated real telemetry through the existing `gateVerdict()` / `orchestration-default-flip-verdict` — flip only if evidenced (do **not** relitigate the 2026-06-26 honest-null).
- **Gate D:** Every decision here cites real combined-corpus telemetry; no promotion or retirement without it.

## Phase 4: Scale (3+ external adopters)

- [ ] **E1 — Topology decision-matrix (ruflo-borrowings #1).** Deterministic task→form rule *before* mode choice, rebuilt against the multi-user corpus. Reject self-organizing / RL switching. A/B default-off.
- [ ] **E2 — Auto-retrieve knowledge-cards (ruflo-borrowings #2).** Confidence scalar + queryable index, auto-surfaced at task start (read-only, reversible); *writing* stays human-gated. Bench: card-injection vs none.
- [ ] **E3 — Second wedge.** A non-dev or stack-specific wedge driven by *external request patterns*, not maintainer guess.
- **Gate E:** Each item default-off until its own A/B shows a net win at held quality on the multi-user corpus.

## Deferred candidates (2026-07-04 gap-hunt — gated, not built now)

Raised by the split gap-hunt council but gated behind a demand signal or rejected on the identity floor; recorded so they are not re-litigated as "missing":

- **Team-context persistence (`team-conventions.yml`).** Genuinely split (claude: highest-EV; gpt-4o: complexity/minimalism violation). No demand signal that generic output — not value-prop or install — is the adoption blocker. **Gate** on the same discipline as `road-to-product-bets` Phase 1 (simple/expert mode): ≥ 1 external signal that team-specific fit is the blocker. Partially served today by `standards-from-config` + the project-intelligence layer. Do not build speculatively.
- **Skill-composition graph (`skill-graphs.yml`).** Largely covered by the existing **commands** layer (commands already orchestrate skills, reuse ≥ 2). A declarative-graph variant is a deferred candidate, not net-new; revisit only if a repeated multi-skill sequence emerges from real telemetry.
- **Live "Try Now" proof widget.** **Rejected** — needs a runtime backend (no-runtime floor) and the validation-wedge does not demo generatively. B8 (recorded demo) is the culture-fit substitute.
- **Community forum / SEO / paid marketing.** Post-adoption; a forum before adopters is maintenance debt (same logic as connectors in `road-to-product-bets`). Gated on Gate C.

## Gaps the council surfaced (folded above, listed for traceability)

1. **Generalization-honesty documentation** (B5) — the package never states its data-provenance limit; do so wherever capability is claimed.
2. **Conditional-launch gate** (Gate C) — an explicit "did the wedge land an adopter?" decision before scaling distribution.
3. **Telemetry-gated dispatch UX** — when the orchestration machine recommends a subagent, surface the cost inline ("this task is high-risk; enable `production-validator`? ~$0.40") rather than default-on bill-shock. (Design note for A1/A3.)
4. **Trust is defensive, not offensive** — the reason Track A is not cut: trust-only is copyable; trust + measured capability is the moat.

## #699 anchors — reuse, never duplicate

Telemetry object, capture hook, `/cost:report`, flip-verdict, defaults, `internal/bench/orchestration/`, `model_tier→model:` mapping, no-runtime floor. Any phase touching these references the canonical anchor (see Prerequisites), never a parallel mechanism.

## What we deliberately do NOT build

- Consensus / CRDT / gossip / Raft / federation / daemon / cross-machine swarm — the rejected runtime.
- `neural`/`SONA` weight-training framing (mechanically RAG; branding overstates it).
- Auto-commit of learned patterns or per-subagent cross-invocation memory (`memory:` field stays off) — bypasses the governed, human-gated learning loop.
- Duplicates of built-in subagents (`Explore`/`Plan`/`general-purpose`).
- Any unbacked or invented third-party comparison claim — the 84.8% is the anti-example, not the model.

## Acceptance criteria

- [ ] **(B)** `check_claims` enforced in CI; the wedge installs and runs on a foreign repo in < 5 min; proof page generated from real sources + "verify it yourself" passes on a clean checkout; no public text carries an unbacked or invented third-party claim.
- [ ] **(A)** The subagent layer + 5th discovery category exist, default-off; every shipped unit cleared dual-baseline evals on `internal/bench/orchestration/`; ablation-mining + near-miss clustering surface human-review candidates from the real audit log.
- [ ] **Gate discipline:** deep learning-loop analysis (D1/D2) and scale items (E*) did **not** run before their external-telemetry / adopter gate cleared.
- [ ] **Anti-dump:** no new artefact duplicates an existing one; each new command reuses ≥ 2 skills; governance preflight recorded (below).
- [ ] All quality gates pass (`task lint-skills`, `check-refs`, `check_claims`).

## Governance preflight (per `roadmap-writing` § 8.D)

- **domain-adoption-policy** — no new domain opened (subagents/personas already ship).
- **persona-governance** — 3 new personas; each must clear the redundancy gate + per-domain cap (performance + data-integrity are net-new lenses, production-validator is core).
- **framework-neutrality** — subagent/telemetry/ledger artefacts are stack-agnostic.
- **size-enforcement** — new commands/personas/subagents within their pack `size_class` budget.

## Provenance

- **Source A:** an external TypeScript multi-agent "swarm" orchestration reference (a repackaged actor-map runtime; headline performance claim unbacked). The six source drafts are an in-code analysis of it translated into agent-config terms; no mechanism or claim is borrowed unvalidated. Anonymized per `source-confidentiality`. Link via `src/scripts/_lib/link_crypto.ts decrypt`: `ENC1:IlxheJKbFP1wWeKaZsaiu1kCCwia4yVbVfcKn6NRSRNtXK4qYawGrHPh4UXTKLBASixoCME5nWssoZEQmR1llGnzB6UbltFrnMnVn4rdNZj7j/gwn5mGv7JOio5yEQs=`
- **Council:** claude-sonnet-4-5 + gpt-4o, 2026-06-30, 2-round debate; convergence inlined under § Council notes.
