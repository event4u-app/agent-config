# Golden-transcript corpus — the 12 quality-layer task prompts

The concrete tasks for the L8 quality layer (rubric in `../rubric.md`). Each is
run **twice** — baseline (suite, no RDP) and treatment (suite + RDP) — and
hand-scored on the 4 dimensions. Capture into `<NN>-<slug>.md` per `_template.md`.

**Why this is the load-bearing half.** The trigger layer (RESULTS-trigger-2026-06-16)
can only score 3/8 disciplines; the other 5 — `reasoning-orchestrator`,
`verify-completion-evidence` (gate), `grounding`, `intent`, `notes_first` — are
lenses/gates that don't show up in skill-routing. **This corpus is their only
measurement.** Slots 5–9 deliberately carry the orchestrator + verifier cases the
trigger metric could not see.

Seeds drawn from `../trigger-fixtures.json` (vetted discipline-targeting queries)
where marked. Host band is agent-self-assessed (table-free, L17); the split below
covers both bands per family.

| slot | family | host band | discipline focus | prompt |
|---|---|---|---|---|
| 01 | ambiguous-discovery | standard | grounding | add a feature to the dashboard so users can see their activity *(grounding seed)* |
| 02 | ambiguous-discovery | standard | grounding + intent | we need to migrate auth to OAuth and we're not sure the legacy token format maps cleanly |
| 03 | ambiguous-discovery | strong | intent | make the export faster *(literal = speed; surface the real underlying goal first)* |
| 04 | multi-stage-impl | standard | complexity-first | which part of this 6-step build should we tackle first? *(sequencing)* |
| 05 | multi-stage-impl | standard | orchestrator | refactor the entire billing module to be cleaner and safer *(orchestrator FN — lens)* |
| 06 | multi-stage-impl | strong | orchestrator + adaptive-stop | plan and implement the migration with checks at each stage *(orchestrator FN)* |
| 07 | verification | standard | verifier (gate) + notes-first | write the migration that drops the legacy accounts table and backfills from users *(verifier seed — irreversible)* |
| 08 | verification | standard | verifier (gate) | rewrite this auth middleware to branch on three plan types with different rate limits *(verifier seed — branching ≥3 constraints)* |
| 09 | verification | strong | verifier (gate) | change the payment-capture flow to handle partial refunds, chargebacks, and retries *(risky)* |
| 10 | cross-run-calibration | standard | prediction | estimate how long the search-reindex job will take — we'll check it against the actual *(calibration)* |
| 11 | cross-run-calibration | standard | decision ledger | should we use the Action pattern or a Service class for this workflow? *(decision seed)* |
| 12 | cross-run-calibration | strong | notes persistence + decision-reuse | continue yesterday's refactor — what did we decide about the locking strategy? *(decision-reuse from the ledger)* |

Band split: 8 standard / 4 strong (slots 03, 06, 09, 12). On a strong host the L10
auto-gate means treatment ≈ baseline (no regression is the pass bar there); the
lift, if any, shows on the standard-host slots.

## Run plan (when capture is authorized — billable + human-scored)

1. **Baseline pass** — run all 12 prompts on the suite with RDP **off**; capture
   transcripts + token accounting into `<NN>-<slug>.md` (variant: baseline).
2. **Treatment pass** — same 12, RDP **on**; capture into the same files (variant:
   treatment). Token-overhead delta vs the baseline slot is the L10 cost guard.
3. **Score** — fill the rubric sheet (`../rubric.md`); two raters where possible.
4. **Verdict** — rubric mean ≥ 70%; treatment − baseline ≥ +15% (standard) / ≥ 0
   (strong); no hard fail (reasoning_extraction refusal, >5% token overhead,
   orchestrator <10% gain or >15% false-positive interventions).

Capture is **not** turnkey-scriptable (no app runtime; transcripts are real
host-model sessions) and scoring is **human** — both are the billable/human-gated
Phase-1 steps, separate from this (free) corpus authoring.
