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

- [ ] **A1 — Execution-subagent contract (keystone, Phase 0/1 of the draft).** `subagent-v1` contract: agent-config frontmatter schema + native-Claude-Code translation, `model_tier`→native `model:` via the existing generator mapping (ADR-035, **do not invent a new mapping**). Add `subagent` (or `agent`) as the 5th discovery category + glob + vocabulary lint + determinism. Frame explicitly as **static artifact projection — dispatch decision stays with the agent/skill, never runtime-enforced** (resolves the apparent no-runtime tension). ADR via council.
- [ ] **A2 — Pipeline proof (one throwaway unit).** Project a single `echo-noop` unit end-to-end to prove fidelity / byte-budget / install-completeness gates, before any real prompt quality is risked.
- [ ] **A3 — Eval harness on the #699 bench.** Reuse `internal/bench/orchestration/` (do **not** build a parallel bench). Dual baselines: inline host **and** generic inline dispatch. Tokens always in the table. The one-file negative-control task MUST lose. `verdict_changed_outcome` is an **extension field on the #699 telemetry object**, not a second schema.
- [ ] **A4 — Ablation-mining (learning-loop #1, net-new).** Correlate rule *absence* with failure across distinct `work_id`s → surface *missing-guardrail* candidates for `learning-to-rule-or-skill` (human-gated, raw counts, confounding named). Pure analysis on existing `audit-log-v1` fields.
- [ ] **A5 — Near-miss clustering (learning-loop #4, net-new).** Second pass over the pattern miner: cluster `(phase, outcome)` keys with high rule-set Jaccard overlap for human review — never auto-merge.
- **Gate A:** A subagent unit ships **only** if A3 shows it beats *both* baselines by a meaningful margin at acceptable token cost. Otherwise it stays in `src/` + `gaps:` as a documented honest-null. No unit is default-on in Phase 1.
- **Rollback A:** Capability work is additive + default-off; reverting removes the discovery category + units with zero behavioural change to existing flows.

### Track B — Adoption readiness (table-stakes, wedge-first)

- [ ] **B0 — Positioning.** Collect evidenced differentiators into `docs/positioning-evidence.md`; draft 3 H1 options (≥1 centering falsifiability); route through `/council:design`; **human picks**.
- [ ] **B1 — Claims-Ledger (the foundation; folds ruflo-borrowings #4).** `docs/CLAIMS.md` (id · claim · kind · evidence_pointer · last_verified) + `src/scripts/check_claims.ts` in CI: every public claim binds to a code-marker / bench artifact / test / `file:line`; a smuggled unbacked claim turns CI red (acceptance test of the mechanism itself). This is the mechanical anti-84.8% moat.
- [ ] **B2 — Three personas (net-new).** Author `performance-engineer`, `data-integrity`, `production-validator` per `persona-governance` (each must clear the redundancy gate: produces findings existing reviewers do not). `production-validator` is `tier: core` and the single source of truth for the wedge.
- [ ] **B3 — Wedge: `production-validator` single-install.** A 30-second, plugin-less install of the `production-validator` persona (`npx @event4u/agent-config add production-validator` or a `curl`), with a one-screen `docs/wedge/` README. Read-only, single-purpose, carries the anti-hallucination identity. **This is the highest-EV external door — not the subagent layer.**
- [ ] **B4 — Proof page + minimal Starlight.** Generated (not hand-maintained) claim→code binding table, honest-null benchmarks *including the nulls*, and a "verify it yourself" command block that runs on a fresh checkout. Site catalog generated from the discovery manifest; ≤5 top sections; not public yet.
- [ ] **B5 — Generalization-honesty note (council gap).** Document the data provenance limit explicitly ("derived from production work on TypeScript/PHP packages; may not generalize to other stacks") wherever capability is claimed — the missing step the council flagged.
- **Gate B:** `check_claims` green in CI and a deliberately-unbacked claim turns it red; the wedge installs in < 5 min on a foreign repo; proof page generates from real sources and the "verify it yourself" block passes on a clean checkout.
- **Rollback B:** Docs/site/ledger are additive; the wedge is a single file install path. No effect on existing flows.

## Phase 2: Conditional-launch gate (council gap — explicit decision point)

- [ ] **C1 — Distribution drafts.** Marketplace listing + awesome-claude-code submission text + launch-story draft, all **ledger-consistent**, describing the wedge + proof page (not the OS, not subagents). Drafts only — submission is a human act.
- [ ] **C2 — README rewrite (last).** Leads with the chosen position, shows-instead-of-claims (links the proof page + a ledger-bound number), wedge-first path at the top, `check_claims` green.
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
