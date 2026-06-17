# RDP quality-layer eval — first run (2026-06-17)

The quality half of the L8 hybrid eval — *did firing the discipline produce
better work?* — that the trigger layer structurally cannot score (5/8 RDP
disciplines are lenses/gates, not routable skills; see
`RESULTS-trigger-2026-06-16.md`). This is **the only measurement** for
`reasoning-orchestrator`, `verify-completion-evidence` (gate), `grounding`,
`intent`, and `notes_first`.

## Method — controlled two-system-prompt differential

Runner: `run_quality_eval.py`. For each of the 12 corpus prompts, two API calls:

- **baseline** system prompt = `BASE` (suite posture: minimal-diff,
  ask-when-uncertain, verify-before-complete, brevity — **no RDP layer**)
- **treatment** system prompt = `BASE` + `RDP_BLOCK` (the RDP layer is the
  **only** variable: grounding-first, intent, complexity-first, notes-first,
  verifier-gate, prediction/decision-ledger, adaptive effort — faithful to
  `src/rules/notes-first-reasoning.md` + `src/agent-src/contexts/execution/rdp-gate.md`)

The treatment − baseline delta isolates the RDP layer's marginal effect. This
**solves the founding blocker** ("a baseline cannot be produced from an
RDP-active session"): the measured model runs with the system prompt the runner
supplies, not the calling agent's rules. Standard band → `claude-haiku-4-5`
(RDP should help weak hosts most); strong band → `claude-sonnet-4-5` (RDP should
not regress). Actual spend: **$0.086** (24 calls). Single rater (caveat below).

## Scored sheet (4 dims × 0–3, per `rubric.md`)

| slot | band | discipline | baseline | treatment | Δ (0–3) | out-tok overhead |
|---|---|---|---:|---:|---:|---:|
| 01 dashboard-activity | standard | grounding | 2.75 | 3.00 | +0.25 | +240% |
| 02 oauth-migration | standard | grounding+intent | 2.50 | 3.00 | +0.50 | +109% |
| 03 make-export-faster | strong | intent | 2.25 | 2.75 | +0.50 | −6% |
| 04 six-step-sequencing | standard | complexity-first | 2.50 | 3.00 | +0.50 | +222% |
| 05 refactor-billing | standard | orchestrator | 2.75 | 3.00 | +0.25 | +163% |
| 06 migration-stage-checks | strong | orchestrator+stop | 2.25 | 2.50 | +0.25 | +111% |
| 07 drop-legacy-table | standard | **verifier+notes** | **1.75** | **3.00** | **+1.25** | +152% |
| 08 auth-middleware-3-plans | standard | verifier | 2.25 | 2.75 | +0.50 | +252% |
| 09 payment-capture | strong | **verifier** | **0.75** | **3.00** | **+2.25** | −76% |
| 10 estimate-reindex | standard | prediction | 2.50 | 2.75 | +0.25 | +110% |
| 11 action-vs-service | standard | decision-ledger | 2.50 | 2.75 | +0.25 | −4% |
| 12 continue-refactor | strong | notes-persist+reuse | 3.00 | 3.00 | 0.00 | −22% |

### Aggregates

| cohort | baseline | treatment | Δ (normalised pp) | Δ (relative) |
|---|---:|---:|---:|---:|
| **all 12** | 77.1% | 95.8% | +18.7 pp | +24% |
| **standard band (8)** | 81.3% | 95.8% | +14.6 pp | +17.9% |
| **strong band (4)** | 68.8% | 93.8% | +25.0 pp | +36% |

Where the lift concentrates: **dim 2 (grounding)** and **dim 3 (premature-solution
avoidance)** — treatment consistently closes load-bearing gaps before designing and
resolves the hardest unknown first. **dim 1 (notes-first separation)** lifts where
treatment used the `## Working notes` / `## Answer` split (slots 01–07, 09);
slots 08/11 gave a flat question-list under treatment → no dim-1 gain there.
**dim 4 (coherence)** was already high in baseline → little headroom.

## Acceptance-criteria check (per `rubric.md` / roadmap)

| criterion | bar | result | verdict |
|---|---|---|---|
| Rubric mean (treatment) | ≥ 70% | 95.8% | ✅ pass |
| Standard-band Δ | ≥ +15% | +14.6 pp / +17.9% rel | ⚠️ pass on relative, marginal on absolute pp |
| Strong-band Δ (no regression) | ≥ 0 | +25 pp | ✅ pass (strong positive) |
| Token overhead, strong/trivial | ≤ ~5% | strong-band mean **+1.7%** | ✅ pass (one outlier, slot 06 +111%) |
| `reasoning_extraction` refusals | 0 | 0 across all 24 | ✅ pass (no hard fail) |

## Two standout findings (the load-bearing evidence)

1. **Slot 07 — the verifier gate prevented data loss.** The *baseline* (haiku)
   produced a migration template that runs `DROP TABLE IF EXISTS accounts
   CASCADE` with only a `SELECT COUNT(*)` as "backfill" — i.e. it drops the
   table **without actually backfilling**, a silent data-loss recipe. The
   *treatment* flagged irreversibility, refused to write blind, and produced a
   **backfill-first → drop**, `ON CONFLICT`, FK-aware, savepoint-aware approach.
   This is exactly the irreversible-change case the trigger metric could not see.

2. **Slot 09 — RDP curbed a *strong* host's over-production.** The *baseline*
   (sonnet) jumped to building a full ~1600-token `PaymentCaptureHandler` class
   **blind** (truncated at the output cap) before grounding. The *treatment*
   grounded first, named the hardest unknown (current architecture), and asked —
   using **76% fewer** output tokens. Evidence that RDP is **not** a pure no-op
   on strong hosts for risky tasks: it both improved quality and cut cost here.

## What this run settles — and what it does NOT

**Settles (data, recorded — no autonomous decision claimed):**

- The **RDP layer as a whole** produces materially better grounding,
  premature-solution-avoidance, and verification work, strongest on
  risky/irreversible tasks — passing the quality-layer bar the trigger metric
  could not reach.
- **L12 verifier gate — keep-evidence is clear.** The verifier discipline
  caught the two highest-severity failures (slot 07 data loss, slot 09 blind
  over-production). Calibrated by error-catch rate, the gate earns its place.
- **L7 (notes-first kernel promotion) — one of its two conditions is met:**
  **zero `reasoning_extraction` refusals** across all 24 transcripts. The
  other condition ("eval shows it load-bearing") is supported (dim-1 + coherence
  gains). The **promotion decision itself stays Phase 2** (own PR + ADR + ≥24h
  soak) — not settled here.

**Does NOT settle (honest gaps):**

- **L6 orchestrator keep/revert — unsettled by this design.** This run measures
  RDP-on vs RDP-off, *not* orchestrator-on vs orchestrator-off (distributed-only).
  The L6 fail condition ("<10% gain over distributed-only OR >15% false-positive
  interventions") needs a **dedicated orchestrator-isolation run**. Slots 05/06
  show only the whole-layer effect, not the orchestrator component in isolation.
  Per the roadmap's council ruling, L6 is a maintainer decision regardless.
- The **trigger layer** is a separate, already-completed measurement
  (`RESULTS-trigger-2026-06-16.md`); this run does not re-touch it.

## Caveats (do not over-read)

1. **Single rater** — scored by one (RDP-trained) model. Rubric allows this for
   a first pass; flagged as a confidence caveat. A second independent rater
   would harden the deltas, especially the borderline standard-band Δ.
2. **Ceiling + floor effect.** Corpus prompts are heavily ambiguous→should-ground,
   so a grounding-disciplined response near-maxes the rubric (treatment clusters
   at 3.0). The headline delta is partly driven by low baseline floors on the two
   risky slots (07: 1.75, 09: 0.75); excluding them, the standard-band Δ is
   smaller. The effect is real but the magnitude is sensitive to corpus mix.
3. **Stateless harness.** Slots 10/11/12 (prediction / decision-ledger /
   notes-persistence + decision-reuse) cannot exercise true cross-session state
   in a single API call. Slot 12 delta = 0 (both variants correctly say "I have
   no memory of yesterday; point me to the doc"). These slots measure whether the
   discipline is *surfaced*, not whether persistence works.
4. **Standard-host token overhead is high** (~+110–250% output tokens). This is
   the expected cost of RDP scaffolding on weak hosts and is **not** an L10 fail
   (the cost guard targets *strong/trivial* overhead, which passed at +1.7%). It
   is a real cost to weigh against the quality lift.

## Recommendation (for the maintainer — decisions are Phase 2/governance)

1. **Keep the verifier gate (L12).** Strongest, safety-relevant evidence.
2. **Run a dedicated orchestrator-isolation eval** (orchestrator-on vs
   distributed-only) before settling **L6** — this run does not measure it.
3. **L7 notes-first promotion**: the zero-refusal condition holds; route the
   promotion through its own PR + ADR + ≥24h soak (Phase 2), not autonomously.
4. Harden with a **second rater** + a **less ceiling-prone corpus** (add
   well-specified non-ambiguous tasks where grounding adds less, to avoid
   over-crediting grounding) before treating the standard-band +15% bar as
   firmly cleared (currently marginal on the absolute-pp reading).
