# 💼 The `finance` experience

> Set `profile.id: finance` (wizard, or `agent-config use --profile=finance`).
> **Preset default: `strict`.**

## Who it's for

The CFO / fractional finance / FP&A lead — build a DCF, stress-test the plan,
frame the runway call. Every output carries the finance safety floor (no final
invest/raise verdict; assumptions + sensitivity + confidence band).

> **Domain-soundness status (honest).** These skills are forged on TS/PHP; their embedded domain heuristics are **not independently validated**. Until a skill passes a sourced `evals/domain-truth.json` fixture (`./scripts-run src/scripts/domain_soundness_status`), treat its domain correctness as a general-purpose scaffold, not proven practice. The safety floor bounds *liability*, not *correctness*.

## First three tasks

1. **Value it** — `dcf-modeling` walks WACC / terminal-value / 5-year-hold reasoning.
2. **Cut the scenarios** — `scenario-modeling` produces base / upside / downside.
3. **Frame the runway** — `runway-cognition` shapes the fundraise-vs-cut-vs-grow decision.

## First commands

`/work` · `/council` · `/challenge-me`

## Packs that activate

`finance-basic` + `finance-advanced` (+ `meta`, always on).

## Flows that apply

[Discovery](../flows.md)-style modeling and framing dominate. The engineering
flows (implementation / review / delivery) do not apply — finance work is
pack-skill-driven and gated by the `finance-safety-floor` rule.

## What is NOT loaded

No `engineering-base`, no `ai-video`, no `gtm-marketing`, no `founder-strategy`.
Pure finance surface.

## Example

> *"What's our runway if growth halves?"* → `runway-cognition` frames the shape;
> `scenario-modeling` cuts base/downside; output ends with the mandatory
> *"Not investment advice — figures are model output, sensitivity stated"* footer.

## See also

[Profile (deep)](../profiles.md#profile-finance) ·
[Role guide](../getting-started-by-role.md#finance--ops-cfo-controller-ops-lead-founder-finance) ·
[Flows](../flows.md) ·
key skills: `dcf-modeling` · `forecasting` · `scenario-modeling` · `unit-economics-modeling` · `runway-cognition`.
