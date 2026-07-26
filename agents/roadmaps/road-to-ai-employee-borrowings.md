---
complexity: structural
status: draft
---

# Road to AI-employee borrowings — measure first, harden the kernel, gate the builds

> **Source:** `agents/tmp.old/ai-employees/` — an external analysis of an
> autonomous "AI employee" agent project (**Source P**: persistent process,
> self-modifying config bounded by deterministic post-write invariants,
> 3-layer constitution immutability, cost-tiered learning loop, role YAML
> with outcome feedback signals, a one-turn "first hour of work"
> deliverable) plus five drafted roadmaps (borrowings parent,
> governed-evolution, role-objects, first-60-seconds, readme-narrative).
> The drafts self-flag `[DOC-ONLY]` (Source-P behavior read from docs, not
> source) and `[UNVERIFIED-AC]` (agent-config state written from memory) —
> the AC side was re-verified before this cut; verification deltas below.
> **Council:** AI council debate 2026-07-27 (anthropic/claude-sonnet-4-5 +
> openai/gpt-4o, 2 rounds); the round-2 correction (the 60-seconds BUILD is
> not freeze-exempt; only its measurement phases are) is folded in.
> **Draft — pending maintainer OK before execution.**

## Provenance

Anonymized per source-confidentiality; maintainer-recoverable links:

- Source P: `ENC1:WOgzPN15oVtTX89kzkTrrFV7QJs+vT8SHFk/wLVBtT3T9A3mZVV+6ScQTOA4sdvw3EA7T43b3YN7aJYiTG8EXowXqOU4Nw1bmdz9Bw+c+ka3jq0y4oXVA4PdDT4gIMLylJZCxaqO`
- Category taxonomy list: `ENC1:wurFzrWpQA82Z0zCVJq0SajVartNUj4HT0uR+J20zoJMM2tNrjdbNXJBm5HAxa60xtWFnE0xGSDt9OZ4gV9WCjLSAyXJvs/xfPnCQMIv1wDiZzrG8UEb/oZ9TytzCOlu16XHakkDxkdlnBjKvVfXA6uch9CyfQ==`
- Coworker capability rubric: `ENC1:DmxPF1cfir7hfRCzeqiHA4+B8d4whj+laDD6SsEFlNwiZinWIrPPLLGKLFch2bsYP0u4sLYdIpLB6MW86kTwmUJcY8na2I/vlijykzqvXWLzNMshSdVwOxHbYRyklewIpiUd4wLpyLJudXdAzQ==`

## Goal

Extract the durable value of the AI-employee analysis without building an
AI employee: run the three cheap decision-bearing MEASUREMENTS now
(baseline correction-repeat rate, outcome-signal availability,
rules-in-the-wild coverage), ship the one small SAFETY hardening the
verification confirmed missing (tool-call-time kernel deny = Layer 1 of
three-layer immutability), record the cheap positioning/honesty artifacts —
and gate every BUILD (the 60-seconds first-run finding, the governed
self-evolution loop, outcome-signal telemetry) behind pre-registered
thresholds and the standing freeze, with the designs preserved here so the
gates can fire without re-derivation.

## Verification deltas (drafts' [UNVERIFIED-AC] claims vs 9.8.0 reality)

- "Credential gate on config writes missing" → substantially SHIPPED
  (secret-vcs-guard write-time rule + own detector + CI leak scan); any
  invariant work REUSES that library.
- "Role = skill selection + rule scoping is a gap" → largely EXISTS
  (profiles / workspaces / packs scope projection; per-skill tool
  allow/deny lists; role modes). The genuinely new element is
  `feedback_signals` only.
- "Kernel immutability is single-layer" → PARTIALLY TRUE: SHA/condensation
  verification exists (post-write); NO tool-call-time deny on kernel paths
  (Layer 1 gap confirmed); no explicit projected immutability statement
  (Layer 2).
- "No enforced growth budget" → partially false (budgets.yml +
  check_always_budget cap the always-loaded surface); a per-run growth
  budget exists nowhere because no evolvable surface exists.
- The draft's "prior negative results" note targets a roadmap that is now
  ARCHIVED → the note lands on the stable ai-council contract surface
  instead.
- Learning-loop overlap: post-task learning capture already exists
  (skill-improvement pipeline, session mining, memory consolidation);
  Source P's delta is the MACHINE-CHECKED WRITE-BACK, not the idea.

## Council convergence (2026-07-27, 2 rounds)

- **Governed evolution:** split. Safety artifacts + measurement now; the
  loop (invariant sweep over an evolvable surface, queue/drain/escalation,
  CRR benchmark) parks freeze-gated with its pre-registered design
  preserved (§ Parked). Spike-04 (TODAY's baseline correction-repeat rate)
  is the category-existence test and runs first.
- **Role objects:** the primitive is REJECTED (duplicates
  profiles/workspaces/packs — a fourth way to configure the same
  projection). Extract only `feedback_signals` via a signal-availability
  spike; record the no-self-assessment signal-tier table either way.
- **First-60-seconds:** measurement phases (fixture set, coverage/FPR
  baseline of EXISTING rule packs) run now; the wrapper BUILD is
  freeze-gated (round-2 correction: "smaller than the rejected
  proposal-loop" does not make it freeze-compliant). Thresholds are fixed
  NOW, before any data. Precision over coverage is load-bearing.
- **README narrative:** the falsifiable H1–H4 adoption-hypothesis frame +
  30-day thresholds route to the adoption roadmap; the positioning
  candidate ("governance substrate underneath AI coworkers — Source P is a
  customer, not a competitor") routes to the launch-ADR as INPUT, not a
  fork; the proof exhibits route to their natural owners.
- **Cheap unconditional items:** all three proceed (prior-negative-results
  note, taxonomy finding, capability audit).
- **Standing precondition:** any borrow of a Source-P MECHANISM requires
  reading its source first ([DOC-ONLY] → VERIFIED-SRC) — doc-derived
  behavior claims are hypotheses, per this week's own S1 lesson.

## Non-goals — routed or rejected

**Rejected (council-confirmed):**
- The AI-employee surface itself: VM, channels (chat/email), persistent
  daemon, container-socket mounts, runtime tool creation — contradicts the
  no-runtime identity and the spawn-hardening posture; six-month scope
  duplication of an established Apache-2.0 project. The position is
  "governance substrate underneath AI coworkers", to be tested, not
  asserted (routed to launch ADR).
- The `role` primitive (duplication; see deltas).
- Free prompt-text injection via any role/config object (bypasses verifier
  + originality lint) — non-negotiable, recorded.
- Model self-assessment as a feedback signal (tier-4, excluded — same
  principle as the council neutrality contract).

**Routed:**
- H1–H4 adoption hypotheses + pre-registered 30-day thresholds + proof
  exhibits (honest-null story, capability audit, security self-fix
  narrative) → `road-to-adoption-without-narrative-debt.md`.
- Positioning candidate → the launch-decision ADR
  (`road-to-feedback-9.8.0-followups.md` Phase 1) as one of the inputs.
- Kernel deny-hook implementation timing → sequenced with the hook
  precompilation work in `road-to-credible-install.md` Phase 1 (touch the
  hook layer once).

## Phase 0 — Decision-bearing measurements (cheap, all pre-registered)

- [ ] **Spike A — baseline correction-repeat rate (CRR).** Over a
  hand-labelled set of ≥30 existing session transcripts: how often does an
  operator correction semantically repeat one already issued in an earlier
  session? Pre-registered decision rule: **CRR < 0.15 → the self-evolution
  category solves a non-problem for this package**; publish that as a
  standalone honest null and keep § Parked closed. (Also record extraction
  precision/recall — if corrections cannot be reliably identified, the
  CRR metric itself is unmeasurable; that finding parks the category too.)
  *Verify:* labelled set + measurement committed; decision rule applied in
  writing.
- [ ] **Spike B — outcome-signal availability.** Across the Phase-0 fixture
  repos (below): what fraction emit machine-readable tier-1/tier-2 outcome
  signals (CI red/green, revert-of-agent-commit, PR merged without change
  request) without new credentials? Pre-registered: **<50% tier-1
  availability → `feedback_signals` stays parked** (a schema nobody can
  populate). Record the signal-trust tier table (tier-4 = model
  self-assessment = excluded) in the eval/telemetry docs regardless.
  *Verify:* availability numbers committed; tier table recorded.
- [ ] **Spike C — rules-in-the-wild coverage baseline.** Assemble a frozen
  fixture set of ≥20 real, unaffiliated repositories (PHP/Laravel,
  TypeScript, mixed). Run the EXISTING deterministic verifiers/rule packs
  (no new rules, no LLM) and measure: on what fraction do they produce ≥1
  true-positive finding, and what is the first-finding false-positive
  rate? This simultaneously baselines the freeze-gated build (§ Phase 3)
  and tests adoption-hypothesis H2 ("our rules encode house style, not
  wild violations"). Honest-null: low coverage is a PRODUCT finding that
  reframes the adoption gap — publish it, do not treat as failure.
  *Verify:* fixture list frozen + committed; coverage + FPR numbers
  published.

## Phase 1 — Kernel immutability: complete the three layers (safety, ships regardless)

> Verified gap: today only the post-write layer exists. Three independent
> failure modes beat one. No new subsystem — hardening of an existing
> surface.

- [ ] **Layer 1 — tool-call-time deny** on writes/edits to kernel rule
  paths (hook), implemented on the precompiled hook path (sequence with
  `road-to-credible-install` Phase 1 so the hook layer is touched once);
  red/green test proves the deny fires.
- [ ] **Layer 2 — projected immutability statement**: the projected rule
  set states explicitly that kernel rules are immutable and must never be
  proposed for edit (tighten-only, per the existing override hardening).
- [ ] **Layer 3 — post-write SHA comparison**: already exists
  (condensation hashes / kernel bundle check) — document it as Layer 3 of
  the now-complete stack, plus the honest **residual-risk statement**: a
  technically valid change inside a writable surface is not caught by any
  layer; provenance makes it auditable, not preventable.
  *Verify (all):* deny-hook red/green test; statement present in the
  projection; security doc carries the three-layer description + residual
  risk.

## Phase 2 — Cheap unconditional records

- [ ] **Prior-negative-results note on the ai-council contract surface:**
  an unaffiliated project DELETED its 6-judge LLM content review as "cost
  without signal" — record the finding, the distinction (config-delta
  judging ≠ artifact judging under a neutrality contract with
  pre-registered thresholds), and the criterion that would falsify OUR
  council design. External falsification pressure gets answered in
  writing, not left for readers to notice.
  *Verify:* note merged on a stable (non-roadmap) surface.
- [ ] **Capability audit as a publishable artifact:** the external
  8-capability coworker rubric self-assessed honestly — six N/A/No rows
  (cross-functional reach, cross-system action, sandboxed compute,
  proactive operation…), two Strong rows (identity/permissions/audit;
  model flexibility). The honest table IS the positioning artifact; route
  its publication into the adoption roadmap's exhibit set.
  *Verify:* table exists with the N/A rows intact; adoption roadmap
  references it.
- [ ] **Category-absence finding recorded as launch-ADR input:** the
  AI-employee category maps list ~12 software-engineering agents and zero
  governance layers — our category does not exist on that map. One
  paragraph, filed with the positioning inputs.
  *Verify:* filed where the launch ADR will read it.

## Phase 3 — First-run finding ("60 seconds"), BUILD — freeze-gated

> The deliverable: within ~60s of install, ONE concrete, checkable,
> UNAPPLIED finding from the USER'S repository — detection deterministic
> (existing verifiers), LLM only for ranking/explanation, `why` walks the
> provenance. Trust before mutation. **Gate:** starts only when the freeze
> unblock list clears OR the launch ADR explicitly pulls it as the launch
> artifact. Thresholds are FIXED NOW (pre-registration precedes data):

- [ ] Coverage ≥60% of the Spike-C fixture set within the cap; **first-
  finding false-positive rate ≤5%** (precision over coverage — if forced
  to trade, lower coverage); p90 ≤60s / p99 ≤90s cold; **zero mutation**
  (a single fixture where the first run modifies a tracked file fails the
  phase outright); partial-output affordance on timeout; locked reason-code
  taxonomy; idempotent (marker + run ledger).
- [ ] Honest-null consequence: thresholds missed → do NOT ship; publish
  the coverage/precision numbers as the H2 product finding.
- [ ] Standing precondition: any mechanism borrowed from Source P is
  implemented only after reading its source ([DOC-ONLY] → VERIFIED-SRC).
  *Verify:* gate condition documented; thresholds committed before any
  build data; ship/no-ship decision recorded against them.

## Parked — preserved designs with named un-park conditions

- **Governed evolution loop** (agent rewrites maintainer-side rules under
  deterministic bounds). Un-parks only when ALL: freeze unblock list
  cleared; Spike A shows CRR ≥ 0.15 with reliable extraction; the
  invariant sweep can reuse existing detectors (secret detector, shingle
  lint, budgets) rather than duplicating them. Preserved essentials:
  10-invariant post-write sweep incl. **provenance stamp per added rule**
  (an unattributed rule is an unbacked claim) and poison-queue after 3
  fails; no daemon — drain attaches to an existing lifecycle event;
  escalation never model-self-report alone (deterministic trigger
  alongside); pre-registered benchmark: arms static/evolution/
  evolution+escalation, ≥40 sessions across ≥4 workspaces, success = CRR
  −30% at p<0.05, cost ≤$0.50/session, zero hard-invariant escapes,
  honest-null → publish + keep safety artifacts + ship default-off.
  Consumer repos NEVER self-modify — evolution writes maintainer-side
  only, then projects.
- **`feedback_signals` telemetry extension** (outcome grounding). Un-parks
  when Spike B shows ≥50% tier-1 availability; lands as an extension of
  the existing telemetry/eval machinery (PII-exclusion-by-construction),
  never as a new primitive.

## Acceptance criteria (roadmap-level)

1. All three Phase-0 measurements executed with their pre-registered
   decision rules applied in writing (incl. any honest nulls published).
2. Kernel immutability is three-layer with a tested deny-hook and a
   recorded residual-risk statement (Phase 1).
3. The three records exist on stable surfaces (Phase 2) and the adoption/
   launch owners reference their inputs.
4. No build started ahead of its gate; every parked design carries its
   un-park condition; no [DOC-ONLY] mechanism implemented without a source
   read.
5. Nothing from the rejected list (AI-employee surface, role primitive,
   prompt-injection via config, self-assessment signals) was smuggled in.
