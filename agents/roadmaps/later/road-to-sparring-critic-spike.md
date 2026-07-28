---
status: blocked-for-later
complexity: medium
---

# Road to sparring-critic spike — one falsification run decides whether the critic exists

> **Blocked until BOTH hold:** (1) `road-to-lean-agent-init.md` is closed and
> its telemetry reviewed (council 2026-07-28 sequencing: the quantified
> token-waste fix ships before any speculative sparring work), AND
> (2) `benchmark-spend-authorization` is granted for the one spike run.
> **Council:** AI council debate 2026-07-28 (anthropic/claude-sonnet-4-5 +
> openai/gpt-4o, 2 rounds, converged): sparring is demoted from
> feature-with-phases to **spike-only** — this roadmap's sole output is a
> binary decision with pre-registered gates. A separate roadmap enforces the
> gate mechanically: there is no Phase 3 to skip to, because the
> implementation roadmap does not exist until the spike passes.

## Why a spike, not a feature

Maintainer feedback (`agents/tmp.old/ai-pairing/ai-pairing.txt`, 2026-07-28)
wants a permanent sparring critic — "a second agent whose only job is
critique, looping until agreement", cross-provider preferred, default-on.
The supporting evidence is real: intrinsic self-correction fails without
external feedback (Huang et al., ICLR'24); models fix identical errors
presented as external but miss 64.5% in their own output (Tsui 2025);
isolated-session review beats same-session review (28.6% vs 24.6% F1), and
MORE same-session review makes it WORSE (21.7%).

Against it stand two in-house honest-nulls — the 9.5.0 team-mode
defect-finding bench (Δ=0 over all arms) and the A3 production-validator
Gate-A null — plus the house rule *default-off until benchmarked*. The
resolution is neither "build it because the literature says so" nor "refuse
because we nulled once": it is ONE cheap falsification run with
pre-registered gates and a binary consequence.

## Design locks (carried from the feedback reconciliation)

- **Rubric-mandatory:** the critic reviews against an explicit target
  document; free-form "criticize this" is forbidden (a critic that cannot
  tell good from bad produces noise and makes revisions worse).
- **Judge-asymmetry invariant:** the critic IS a judge; tier `medium`, never
  `lite` — "not too high" means medium, not lite.
- **C8 (council 2026-07-28): same-model isolated session ONLY for the
  spike.** Cross-provider transport (two auth flows, two rate-limit regimes,
  latency/cost floors) is deferred to a post-spike enhancement with its own
  gate (≥10pp catch-rate lift) — IF the spike passes at all.
- **Verify-loop adoption (explicit disposition, council Q4):** the spike and
  any successor adopt the control structure from the ARCHIVED
  `road-to-autonomous-verify-loop` (bounded rounds = N=3 cap, plateau
  early-stop, generator-cannot-self-judge / isolated judge session) per the
  council 2026-07-26 self-critical decision that adopted the review protocol;
  this does NOT reintroduce the deferred enforcement-first approach, and the
  archive's "after mission-mode" defer condition on live-eval/Playwright
  verdicts stays intact. No new stop-engine is built (cut C4).
- **Sterility:** the critic's context contains 0 bytes of generator
  reasoning trace and 0 bytes of memory/lessons — artifact + rubric + task
  statement only (shared-context review reimports the correlated bias the
  isolation exists to remove).
- **Telemetry segregation (council Q5):** every spike line is tagged
  `origin=quality-stack-2026` and is EXCLUDED from the
  `road-to-orchestration-scope-decision.md` telemetry sample — building
  sparring to generate the data that decides orchestration would be
  circular.

## Phase 1 — Corpus + pre-registration (no model calls)

- [ ] Defect corpus: known-defect cases built on the existing
  `orch-01..03`/`pv-01`/`pv-02` base plus canary defects per the
  self-critical canary contract (council 2026-07-26) — one instrument
  calibrates human reviews AND the critic; `pv-02` stays the shared negative
  control. Three label layers per task: expected verdict, injected defects,
  task family.
- [ ] Minimal rubric for the code vertical only (defect detection, not
  style); acceptance: rubric lets 10 curated good examples pass and fails 10
  bad ones on paper review before any run. Non-code verticals (posts,
  lyrics, docs) are OUT of the spike entirely.
- [ ] Pre-register claim `sparring-defect-lift` in `docs/CLAIMS.md` as
  `unbacked`, with the decision gates below verbatim, BEFORE the run —
  including the SHA-256 of the FROZEN critic prompt and of the rubric file.
  The acceptance gate is the most prompt-sensitive of the three AND-gates;
  freezing the prompt makes a FAIL attributable ("mechanism null under
  prompt `<sha>`", citable) instead of contestable ("maybe the prompt was
  weak") — exactly because this would be the third null in the family, it
  must be unassailable.

## Phase 2 — The spike run (spend-gated)

- [ ] Arms: (a) same-session self-review baseline, (b) fresh isolated
  same-model critic session, (c) near-free "Wait"-nudge arm. NO
  cross-provider arm (C8). Metrics: defect catch rate (F1 on injected
  defects), generator acceptance rate of valid critiques, token cost, wall
  time.
- [ ] **Pre-registered gates (fixed now):** isolated-critic catch rate ≥50%
  on planted defects AND generator acceptance of valid critique ≥70% AND
  fresh-session lift over same-session ≥ +5pp F1 at ≤3× token cost.

## Phase 3 — Binary disposition

- [ ] **PASS →** record PROCEED with the measured rates + an estimated full
  implementation cost, then materialize `road-to-orchestration-substrate`
  as a NEW roadmap (design annex: judge-role critic kernel in the existing
  `judge-*` vocabulary; debiased critic prompt with structured findings
  (rubric-ID · location · severity · fix); learning-loop wiring through the
  existing `learning_sidecar` ≥2-origin promotion — never a new aggregator
  (C1), never a second ledger (C2); settings consolidation LAST, one
  migration; opens ONLY while `road-to-orchestration-scope-decision.md` has
  not resolved EXIT, and pauses with a salvage path if it resolves
  mid-flight).
- [ ] **FAIL →** archive this roadmap with the published honest-null in the
  claims ledger (third null in the family: 9.5.0 team-mode, A3 Gate-A,
  sparring spike) — a citable negative result with method, not a failure.
  No implementation roadmap is ever created; the standing alternative
  (recursive-verification skill, default-off) remains the documented
  fallback.
