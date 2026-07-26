---
complexity: structural
status: draft
---

# Road to self-critical — structural review honesty instead of rule #108

> **Source:** `agents/tmp.old/feedback-critical-2.txt` — the maintainer's
> question "can the package be adapted so the misses cannot recur?", with a
> drafted 3-layer plan, an `evaluator` consumer pack (E1–E5) and an
> `enforcement-first` architecture umbrella (ladder L1–L5, promotion law,
> kernel 9→≤4).
> **Premise-checked against the repo** before cutting: the per-host
> enforcement matrix already exists (`docs/enforcement-by-host.md`) and
> records the deliberate "lead with compile-time, not hooks" stance the
> umbrella would reverse; ADR-127 already resolves per-rule enforcement
> honestly; the kernel set is a council-amended contract; the measured
> discipline lift lives on weak hosts WITHOUT hook APIs (compiled
> enforcement cannot replace prose there); the thin-projection quality FAIL
> is a same-direction lock; there is NO usage-distribution data that could
> settle "how much usage is hook-capable".
> **Council:** AI council debate 2026-07-26 (anthropic/claude-sonnet-4-5 +
> openai/gpt-4o, 2 rounds). Notable: round 2 caught one member's own
> "88% weak-host usage" figure as unsupported — the absence of usage data
> disarms BOTH extremes and is itself recorded below. **Draft — pending
> maintainer OK before execution.**

## Goal

Fix the STRUCTURE of how this package gets reviewed — seat, context,
objective, measurement, calibration — instead of adding a "be more
critical" rule #108. Deterministic first-five-minutes checks become a
standing containerized gate (executed as `road-to-credible-install`
Phase 6); the maintainer-solicited review format becomes a recorded
protocol that removes the five root causes by construction; the review
process itself gets calibrated with planted canary defects; and every
external score is published regardless of outcome. The enforcement-first
architecture umbrella is NOT adopted (disposition below) — its useful
vocabulary is recorded, its value-destroying parts are rejected on
evidence, and its revisit conditions are named.

## Root causes accepted (verified against the misses)

R1 inside-out vantage · R2 reading-not-measuring · R3 context
contamination · R4 score-seeking objective · R5 no external baseline.
The deterministic classes (R1/R2) are killed by the outside-in umbrella
gate; R3–R5 are killed by the protocol below; the protocol itself is
calibrated by canaries because every previous "be critical" surface
(adversarial-review, premortem, 11 personas) existed and still missed
everything — exhortation does not generalize, structure does.

## Council convergence (2026-07-26, 2 rounds)

- **Q1 enforcement-first umbrella: NOT adopted as architecture.** It
  reverses the recorded compile-time-first positioning, its "majority of
  the kernel is checkable" hypothesis is contradicted by the kernel's own
  honest `enforced_by: none` entries, and the promotion law would delete
  prose from exactly the projections (static/weak hosts) where the lift is
  measured. Both extremes lack the decisive datum — usage distribution by
  host capability — which does not exist. Ladder vocabulary is recorded as
  a glossary next to the existing enforcement-coverage taxonomy; nothing
  more.
- **Q2 promotion law:** prose-deletion-on-promotion REJECTED; the honest
  form is "bind the check where the host supports it, keep the prose in
  static-host projections". Kernel EXEMPT — the membership contract
  stands; no pre-committed ≤4/≤2k target.
- **Q3 Layer 1:** extend `road-to-credible-install` (its new Phase 6) —
  containerized umbrella, cold-start/surface budgets frozen from measured
  values, budget-owner + annual-review lint, nightly run. Not a separate
  gate project.
- **Q4 Layer 2:** ship as a CONTRACT DOC + solicitation template (the
  /120 reviews are maintainer-solicited chats, not repo machinery — the
  fix is fully in the maintainer's control and cheap). Canary mechanics
  adjusted for a solo maintainer: biannual not quarterly; plant on a
  short-lived branch with a sealed planting record, canary MUST be
  reverted before merge; escape hatch — a review that finds ≥3 genuine
  high-severity non-canary findings is not failed by a canary miss.
- **Q5 Layer 3:** mostly already routed (credible-install Phases 3–4,
  adoption roadmap). Net-new: the publish-regardless rule as a recorded
  contract line, and external score recording folded into the evaluator
  page.
- **Q6 E-vertical: DEFERRED post-launch as a pack.** Shipping evaluator
  skills before the package has proven self-criticism on itself is
  backwards; the freeze also stands. E1's derivation approach is routed
  into the Galawork dogfood item (adoption roadmap) as instrumentation,
  not a shipped skill; E3 is recorded as the pre-registered re-test design
  for the Team-Mode Δ=0 null (run gated on benchmark spend, post-freeze);
  E4's consumer skill waits with the pack — the package-side canary
  mechanism ships now via Q4.
- **Q7 skill consolidation (P2): folded into the existing
  utilization-window sweep** (post ~2026-08-26, owned by
  `road-to-feedback-9.8.0-followups.md` Phase 4). No count target, no
  mandated family collapses; activation evidence used where the
  human-gated eval harness allows.
- **Q8 compliance telemetry (P3): trip counting YES** (extends existing
  gates; lands with credible-install Phase 6); **LLM-sampled prose audits
  REJECTED under the freeze** (post-launch candidate, PII-exclusion audit
  required first).
- **Q9 topology:** this one small roadmap + the Phase-6 extension of
  `road-to-credible-install` + one contract doc. No enforcement-first
  roadmap, no separate gate roadmap.

## Non-goals — routed or rejected

**Routed:**
- Outside-in gate build (harness, budgets, trip counting) →
  `road-to-credible-install.md` Phase 6.
- External referees (registry scores, scanner runs, evaluator page) →
  `road-to-credible-install.md` Phases 3–4; Galawork dogfood + external
  listing → `road-to-adoption-without-narrative-debt.md`.
- Skill consolidation via activation evidence →
  `road-to-feedback-9.8.0-followups.md` Phase 4 (utilization window).
- Launch decision, freeze contract → `road-to-feedback-9.8.0-followups.md`
  Phase 1.

**Rejected (council-confirmed, with revisit conditions):**
- **Enforcement-first architecture migration** (promotion law with prose
  deletion, kernel ≤4 target, hooks-become-the-product re-platforming).
  Revisit ONLY when BOTH: (a) the hook-latency budget is met and holding
  (credible-install Phase 1), and (b) real usage-distribution evidence by
  host capability exists and shows hook-capable hosts carry a substantial
  share with non-ceiling compliance. Until then the recorded
  compile-time-first stance stands.
- **A/B "compiled corpus vs prose" benchmark** as drafted — on strong
  hosts it re-measures a known ceiling-null; designed naively it is the
  locked thin-projection shape re-run. Any future design must measure the
  weak-host reality it would actually change.
- **LLM-sampled prose-compliance audits** — new probabilistic machinery
  under the freeze.
- **Quarterly review cadence** — biannual for a solo maintainer.
- **Evaluator pack (E1–E5) as shipped skills now** — deferred post-launch;
  revisit note carries E3's re-test design.

## Phase 1 — The adversarial review protocol (contract doc + template)

> Cheap, fully maintainer-controlled, removes R3–R5 by construction.

- [ ] **Write `docs/contracts/adversarial-review-protocol.md`**: clean-room
  session (no repo rules, prior reviews, scores or roadmaps in context);
  consumer seat first (registry install in an empty project BEFORE the
  checkout is opened); verbatim rejection mandate ("find the fastest
  credible reasons to reject"); measurement mandate (a finding without an
  executed command + captured output is discarded); competitor quota
  (≥3 cloned and measured on the same metrics + one fresh sweep for new
  entrants); output = severity-tagged findings ledger (S0–S3), NO numeric
  score requested or accepted.
  *Verify:* doc exists; a ready-to-paste solicitation template is included
  and explicitly REPLACES the prompt previously used to solicit the /120
  chat reviews (the fix is fully maintainer-controlled — the old prompt
  must not survive alongside the new one); the findings-ledger format is
  defined.
- [ ] **Retire the /120 format**: the protocol states that numeric
  self/solicited scores are no longer requested and are ignored on
  arrival; severity-tagged findings replace their function. Existing
  historical scores stay as history — nothing is rewritten.
  *Verify:* protocol says so explicitly; the next solicited review uses
  the template.
- [ ] **Publish-regardless rule** recorded in the same contract: every
  external score/scan result (registry scores, scanners, dogfood deltas)
  is published with the same prominence regardless of outcome — burying a
  bad one rebuilds the false-confidence machine.
  *Verify:* rule present; evaluator page (credible-install Phase 4) cites
  it.
- [ ] **Findings→work routing**: each S0/S1 finding from a protocol review
  gets a disposition (fix now / roadmap item / rejected with reason) —
  reusing the normal roadmap flow, no new machinery.
  *Verify:* routing section in the contract; first run produces
  dispositions.

## Phase 2 — Canary calibration (review the reviewer)

> The only way to know the watchdog still bites. Package-side mechanism
> only (the consumer-facing skill is deferred with the E-pack).

- [ ] **Canary procedure in the protocol doc**: biannual, one planted
  defect from a rotating class (vulnerable dep pin, dead script target,
  oversized artifact, stale reference, slow path) on a SHORT-LIVED branch;
  sealed planting record stored outside the review session's reach; the
  canary is reverted before any merge — a canary must never be able to
  ship.
  *Verify:* procedure documented incl. the never-ships safety rule and
  class rotation (no reuse).
- [ ] **Consequence rule**: review misses its canary → the review process
  (not the reviewer) failed; a root-cause entry + protocol fix before the
  next cycle. Escape hatch: ≥3 genuine high-severity non-canary findings
  excuse the miss.
  *Verify:* rule in the contract.
- [ ] **First calibration cycle executed**: one canary planted, one
  protocol review run against it, catch/miss + RCA recorded. This is the
  roadmap's proof-of-life; without one completed cycle the protocol is
  prose.
  *Verify:* recorded cycle artifact (planting record, review findings,
  verdict) exists.

## Phase 3 — Record the architecture disposition (close the umbrella honestly)

- [ ] **Glossary entry, not an ADR-direction**: the enforcement ladder
  (impossible / blocked / verified / just-in-time / prose) is recorded as
  vocabulary alongside the existing enforcement-coverage taxonomy
  (validator / validator-local / observer / none), noting L4 (just-in-time
  injection) as the one genuinely new level worth a future look.
  *Verify:* glossary text merged into the enforcement-coverage contract
  docs; no migration scheduled.
- [ ] **Rejection record with revisit conditions**: the promotion-law /
  kernel-target / hooks-first re-platforming rejection and its two named
  revisit conditions (hook budget met + usage-distribution evidence) are
  recorded where future sessions will find them (decision record; memory
  entry).
  *Verify:* record exists and names both conditions.
- [ ] **E-vertical deferral note** incl. E3's pre-registered re-test
  design sketch (clean-context + consumer-seat + measurement mandate as
  the changed structural variables vs the 9.5.0 Team-Mode Δ=0) so the
  re-test can be picked up post-freeze without re-deriving it.
  *Verify:* deferral note exists with the design sketch and its own
  honest-null consequence (Δ=0 again → publish + layer default-off).

## Acceptance criteria (roadmap-level)

1. The adversarial-review protocol contract exists with template, findings
   ledger, no-score rule and publish-regardless rule — and the next
   solicited review actually uses it (Phase 1).
2. One full canary cycle is completed and recorded, with the never-ships
   safety rule intact (Phase 2).
3. The enforcement-first umbrella has a recorded disposition: vocabulary
   kept, migration rejected, revisit conditions named — no silent limbo
   (Phase 3).
4. The outside-in umbrella gate ships via `road-to-credible-install`
   Phase 6 (routed, not duplicated here).
5. No new skill, rule or engine class ships from THIS roadmap — it is
   contracts, calibration and dispositions only.
