# Per-skill model distribution — before/after (road-to-per-skill-model-autoswitch.md Phase 6)

> Measurement deliverable for the per-skill model auto-switch (ADR-034). The
> **distribution shift** below is the measured signal; the **cost proxy** is
> modeled from the shipped price table. Realized end-to-end saving is
> invocation-weighted and requires per-skill usage telemetry, which does not
> exist yet — deferred per ADR-034. Re-run the distribution via
> `python3 scripts/backfill_recommended_model.py --dry-run`.

## Baseline (pre-backfill)

Before this roadmap, **0** of 354 skills/commands carried a `recommended_model`.
Every artefact ran on the session model (the user's `/model` choice — for
agent-config maintenance work, typically `opus`). Effective distribution:
**354 / 354 = session model (no per-skill optimisation)**.

## Post-backfill distribution

| recommended_model | Artefacts | Share | Projection behaviour (auto mode) |
|---|---:|---:|---|
| `opus` | 45 | 13% | kept on the top tier — deep reasoning (architecture, review, security, debugging) |
| `sonnet` | 87 | 25% | native `model: sonnet` on Claude — the cheapest tier, mechanical work |
| `gpt` | 31 | 9% | suggestion only (no Claude tier) — large-context / analysis |
| `inherit` | 191 | 54% | no change — session model (meta / ambiguous, conservatively untagged) |
| **total** | **354** | | |

## Modeled cost proxy

Shipped prices (`scripts/ai_council/_default_prices.py`, USD per 1M tokens):

| Model | input | output | ratio vs opus |
|---|---:|---:|---|
| opus (`claude-opus-4-1`) | 15.00 | 75.00 | 1.0× |
| sonnet (`claude-sonnet-4-5`) | 3.00 | 15.00 | **5.0× cheaper** |
| gpt-4o | 2.50 | 10.00 | ~6× in / 7.5× out cheaper |

- The **87 `sonnet`-tagged** artefacts are the realised auto-saving on Claude:
  each invocation that would otherwise have run on `opus` now runs on `sonnet`
  — a **5× per-turn token-cost reduction** on that work.
- The **31 `gpt`-tagged** artefacts surface as a suggestion (no native Claude
  GPT tier); if the user switches, ~6–7.5× cheaper than opus.
- The **45 `opus`** artefacts are deliberately retained on the top tier — the
  quality guard. No downgrade where deep reasoning is required.
- **118 / 354 (33%)** of artefacts are downgrade candidates; the rest are held
  at the top tier or left model-agnostic (`inherit`).

## Realized saving — pending telemetry

The realized total saving is `Σ (invocations of downgraded skills) ×
(opus−sonnet/gpt delta)`, which needs per-skill invocation counts. No such
telemetry exists today (ADR-034 § Deferred). The evidence here is the
**distribution shift** (0% → 33% downgrade-tagged) and the **per-turn price
ratio** (5× on the sonnet tier), not an asserted aggregate percentage.

## Quality guard + tuning loop

- `sonnet` is the cheapest tier (no `haiku`) — a deliberate quality floor for a
  structured-agent suite (ADR-034; council 2026-05-30 flagged the exclusion as
  measurement-gated).
- Default `model.auto_switch: suggest` means no silent auto-downgrade ships
  until an operator opts into `auto`.
- The tuning loop: if a `sonnet`-tagged skill regresses, re-tag it `opus` (or
  `inherit`) and re-run the backfill. The error-level coverage linter
  (`scripts/lint_recommended_model_coverage.py`) keeps every artefact tagged.
