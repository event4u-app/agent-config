# Spike s03 — independence fields on the council result, without the consensus path

**Date:** 2026-08-17
**Roadmap:** [road-to-metric-loop-and-review-integrity.md](../../roadmaps/road-to-metric-loop-and-review-integrity.md) Phase 0
**Tree:** `6a679cc19` (branch base `origin/main`)
**Kill criterion (pre-registered):** the consensus code must change.

## Question

Can a `review_independence` / `acceptance_status` pair be derived and attached to
the council result **without editing `consensus.ts`**?

## Method

Two structural checks plus a pure-function proof.

**1. Coupling.** `consensus.ts` imports exactly one module —
`../_lib/value_ladder.js` — and does not import `quorum.ts` at all:

```
grep -n "import" src/scripts/ai_council/consensus.ts
32:import { pyRound } from '../_lib/value_ladder.js';
```

The object that already carries "who actually answered" is `QuorumResult`
(`src/scripts/ai_council/quorum.ts:31`: `status`, `threshold`, `total`, `present`).
Its consumers are `orchestrator.ts`, `session.ts`, `events_log.ts`, `config.ts`, and
`council_cli.ts` — **`consensus.ts` is not among them**. Extending that object is
therefore disjoint from the consensus path by construction, not by discipline.

**2. Derivability.** Independence is a pure function of the responding member set.
Member identity is already `MemberConfig.name` (`config.ts:401`), restricted to the
five providers in `_VALID_PROVIDERS` (`config.ts:87`): `anthropic`, `openai`,
`gemini`, `xai`, `perplexity`. No new input is needed.

**3. Proof.** A scratch pure function (`spike_s03_independence.ts`, scratchpad-only)
over that member set:

| Member set | `review_independence` | `acceptance_status` |
|---|---|---|
| `anthropic, openai` | `cross-family` | `accepted` |
| `anthropic` | `single-member` | `provisional` |
| `anthropic, anthropic` | `same-family` | `provisional` |
| `gemini, xai, openai` | `cross-family` | `accepted` |
| *(empty)* | `unknown` | `provisional` |

5/5 cases pass, exit 0. **Zero lines of `consensus.ts` touched** — kill not triggered.

## Design note carried into Phase 2

`acceptance_status` derives from `review_independence` rather than being set
independently. That is deliberate: two fields a producer can set inconsistently
reintroduce the exact ambiguity the pair exists to remove — a `same-family` set
carrying `accepted` would be a self-contradicting artifact that still reads as
acceptance to a consumer scanning one field. Derivation makes the contradiction
unrepresentable instead of merely forbidden.

`unknown` maps to `provisional`, not to a third acceptance value. An absent member
set is not evidence of independence, and the safe direction on an integrity field
is the weaker claim.

## Verdict

**PASS.** The fields are addable on the quorum-side result object with no consensus
change. Phase 2 extends the shipped `review-findings.schema.json` rather than adding
a second schema, per the roadmap's own FOLD row.
