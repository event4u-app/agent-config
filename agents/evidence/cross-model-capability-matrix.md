# Cross-Model Capability Matrix (T-000)

## Purpose

Before running the cross-model parity smoke, fix an explicit capability matrix
so that any later parity failure can be attributed correctly:

- **Capability gap** — the host model lacks the feature the test exercises. A
  per-model behavioral overlay cannot fix this; it is a host limitation.
- **Behavior gap** — the host *has* the feature but applies it undisciplined
  (ignores a rule, skips a gate). This is the only legitimate overlay
  candidate, and even then the overlay stays gated on evidence.

This artifact precedes the smoke because the overlay gate (per-model overlays
ship only against a confirmed behavior gap) is meaningless without first
ruling out a capability gap. Attributing a capability gap to "bad discipline"
would burn overlay budget on a fix that can't work.

## What the repo already encodes

The package maintains **one** per-vendor mapping: tier → native Claude model
(`src/scripts/_lib/model_tier.ts:27-31` — `high→opus`, `medium→sonnet`,
`lite→haiku`). It deliberately does **not** encode per-capability bands or
cross-vendor model line-ups; the module comment states other agents "resolve
the tier band to their own line-up" (`model_tier.ts:25-26`). So `model_tier.ts`
is **not** a source for the capability cells below — it tells us nothing about
whether OpenAI or Gemini support tool-calls.

The capability surface the package *does* track is orchestration primitives, in
`src/scripts/_lib/host_capability.ts:16-22`: `subagent_spawn`, `parallel_spawn`,
`status_polling`, `separate_quota_pool`. Its contract is **safe-default-false**
(`host_capability.ts:24-30`, `asBool` at `:33-35`): an unknown host is assumed
to have **no** primitive until proven otherwise. The matrix below adopts the
same posture — unconfirmed cells read `UNKNOWN`, never an optimistic guess.

## Matrix

Columns = the three eval hosts: Claude (Anthropic), OpenAI (the roadmap's
"Codex" host), Gemini. `UNKNOWN — confirm in smoke` = not derivable from this
repo or a primary source; do not guess.

| Capability | Claude | OpenAI | Gemini | Source |
|---|---|---|---|---|
| tool-calls (function/tool invocation) | Yes | Yes | Yes | Widely-documented primary feature of all three vendors' chat APIs |
| structured-output (JSON / schema-constrained) | Yes | Yes | Yes | All three expose schema-constrained / JSON output modes |
| long-context (≥100k tokens) | Yes | UNKNOWN — confirm in smoke | UNKNOWN — confirm in smoke | Claude long-context is well-established; exact host model + window in scope for OpenAI/Gemini not pinned in repo |
| function-routing (model selects among many tools/skills) | UNKNOWN — confirm in smoke | UNKNOWN — confirm in smoke | UNKNOWN — confirm in smoke | Distinct from raw tool-calls; routing *quality* across a large skill set is behavioral and only observable under the smoke |
| subagent_spawn (any delegation) | UNKNOWN — confirm in smoke | UNKNOWN — confirm in smoke | UNKNOWN — confirm in smoke | `host_capability.ts` safe-default is `false`; per-host truth set by `.agent-settings.yml` override or live observation, not by this repo |
| parallel_spawn (concurrent subagents) | UNKNOWN — confirm in smoke | UNKNOWN — confirm in smoke | UNKNOWN — confirm in smoke | Same — `host_capability.ts:18`, safe-default `false` |
| status_polling (mid-run monitoring) | UNKNOWN — confirm in smoke | UNKNOWN — confirm in smoke | UNKNOWN — confirm in smoke | Same — `host_capability.ts:19`, safe-default `false` |

Note: tool-calls / structured-output are marked `Yes` from solid widely-known
vendor facts, not from this repo. Every orchestration row is `UNKNOWN` by the
`host_capability.ts` contract — those booleans are host-instance facts, not
model facts, so they cannot be filled from model identity alone.

## How to read a parity failure

For each failing test, locate the capability it exercises in the matrix:

1. **Cell = `No` (or confirmed-absent in the smoke)** → **capability gap**. The
   host lacks the feature. This is **not** an overlay candidate; record it as a
   host limitation and scope the test out for that host (or gate the feature).
2. **Cell = `Yes`** → **behavior gap**. The host can do it but didn't. This
   *is* an overlay candidate — but still gated: an overlay ships only with
   evidence the failure is reproducible and that the overlay closes it.
3. **Cell = `UNKNOWN`** → unresolved. Do not classify the failure yet. The
   smoke must first confirm presence/absence; only then does it become a
   capability gap or behavior gap per rules 1–2.

## Status — planning artifact, not confirmed evidence

This is a **planning** document. Actual per-host capability confirmation
requires the cross-model smoke, which is currently **BLOCKED on vendor
credentials**: no Gemini API key is available, and the Anthropic transport is
unstable. Until the smoke runs, every `UNKNOWN` cell stays `UNKNOWN` — they are
not to be promoted to `Yes`/`No` by inference. Honesty over completeness.
