<!-- analyzed: 2026-05-30 | commit: 57588489 | files: 0 -->
# Per-skill model-tier distribution (road-to-model-capability-tiers.md Phase 6)

> Measurement deliverable for the vendor-neutral capability tiers (ADR-035,
> supersedes ADR-034). The **distribution** below is the measured signal; the
> **cost proxy** is modeled from the shipped price table. Realized end-to-end
> saving is invocation-weighted and needs per-skill usage telemetry, which does
> not exist yet — deferred per ADR-035. Re-run via
> `python3 scripts/backfill_model_tier.py --dry-run`.

## From concrete models (ADR-034) to tiers (ADR-035)

ADR-034 shipped vendor-specific `recommended_model` values that recommended
`gpt` to Claude users. ADR-035 replaces them with vendor-neutral
`model_tier` bands. The migration map: `opus → high`, `sonnet → medium`,
`gpt → high`, `inherit → inherit`; a small clearly-trivial set demoted to
`lite`; the genuinely long-context skills gain an orthogonal `context: large`.

| ADR-034 value | n | → ADR-035 tier |
|---|---:|---|
| opus | 45 | high |
| gpt | 31 | high |
| sonnet | 87 | medium |
| inherit | 191 | inherit (2 → lite) |

## Tier distribution (354 skills + commands)

| `model_tier` | Artefacts | Share | Claude resolution (auto) | each agent resolves to |
|---|---:|---:|---|---|
| `high` | 76 | 21% | Opus | its strongest reasoning model |
| `medium` | 87 | 25% | Sonnet (latest) | its balanced daily model |
| `lite` | 2 | <1% | Haiku | its fastest/cheapest model |
| `inherit` | 189 | 53% | (session model) | unchanged |
| **total** | **354** | | | |

`context: large` (orthogonal modifier) on **6** long-context skills
(project-analysis*, universal-project-analysis, repomix-packer, deep-reading-analyst).

## Modeled cost proxy

Shipped Claude prices (`scripts/ai_council/_default_prices.py`, USD per 1M tokens)
anchor the proxy; **each agent's own tiers carry the analogous ratio**:

| Tier | Claude model | input | output | ratio vs `high` |
|---|---|---:|---:|---|
| high | opus | 15.00 | 75.00 | 1.0× |
| medium | sonnet | 3.00 | 15.00 | **~5× cheaper** |
| lite | haiku | ~1 | ~5 | **~15× cheaper** |

- The **87 `medium`** + **2 `lite`** artefacts are the realised saving on Claude
  under `auto`: each invocation that would otherwise run on the session's top
  model drops to a cheaper band (~5× for medium, ~15× for lite).
- The **76 `high`** artefacts are deliberately held at the top tier — the quality
  guard for deep-reasoning work.
- **The cross-vendor bug is fixed**: a Claude user is never recommended `gpt`;
  `high` resolves to Opus for them, to the top model for an OpenAI/Gemini user.

## Realized saving — pending telemetry

Realized total = `Σ (invocations of medium/lite skills) × (tier price delta)`,
which needs per-skill invocation counts. None exists yet (ADR-035 § deferred).
The evidence is the **distribution** (21% high / 25% medium / <1% lite / 53%
inherit) and the **per-tier price ratio**, not an asserted aggregate percentage.

## Staleness audit (ADR-035 guard)

The tier→model mapping is a contract that drifts as vendors rename/retire models.
On each model-line-up change, update the **single** generator-owned Claude
mapping (`high/medium/lite → model` in `scripts/condense.py`) — no artefact
re-tagging needed, since the band is stable and only its resolution moves. Audit
cadence: review at each release touching model pricing/availability, and
whenever a tier's mapped Claude model is deprecated upstream. See ADR-035.
