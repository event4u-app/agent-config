# Cache economy — measured verdicts and recorded refusals

Durable record of what was measured about prompt-cache economics on 2026-07-30
(host Claude Code ≈ 2.1.220) and what was refused as a result. This file exists
so the refusals survive the roadmap that produced them: a roadmap is archived, a
context is not.

## What was measured (first-party, this repo's own transcripts)

Method: read `~/.claude/projects/**/*.jsonl`, keep assistant records carrying
`message.usage`, **dedupe by `message.id` + `requestId`**, split on the presence
of a top-level `agentId` / `isSidechain`. Weights: cache read 0.1× · 5-minute
write 1.25× · 1-hour write 2.0× · uncached input 1.0×. Metric definition:
`billable_input = input_tokens + cache_read_input_tokens + cache_creation_input_tokens`,
where `input_tokens` **excludes** cache tokens.

| finding | measured |
|---|---|
| main-session cache read share | 98.5–98.6% |
| subagent-leg cache read share | 96.7–97.0% |
| subagent write TTL split | 100% `ephemeral_5m`, 0% 1h |
| subagent cold start (first call per leg) | median ≈235k tokens written-or-uncached, 3.5–3.8% read share |
| cold starts as a share of subagent write volume | 69.4–69.7% |
| duplicate rule set across user + project scope | 110 shared filenames, ≈86.8k redundant tokens per spawn, ≈38% of subagent write volume |
| transcript replay rate (why dedup is mandatory) | 51–57% of raw records |

**The popular framing is wrong for this host.** A widely-shared report claimed
Claude Code subagents miss prompt caching entirely. They do not — they cache at
~97%. The cost is the **write rate** (5-minute TTL, cold start re-written per
spawn), not a missing cache. Reproduce with `cache_realization_report` +
`preamble_byte_census`; re-run if the read share drops below 90% or the
cold-start share below 50%.

## Refusals — do not rebuild these

- **An interception proxy** (any `ANTHROPIC_BASE_URL` shim, however packaged) —
  a resident process on a listening socket with network egress. Prohibited by
  the no-runtime boundary and the embedded-engine doctrine, and **unnecessary**:
  the host already emits per-leg cache attribution locally in its own
  transcripts.
- **A beta-flag OTel join** (`agent_id` spans carrying cache tokens) — richer,
  but gated on two beta environment flags and an OTLP sink. The transcript
  reader gets the same numbers with zero setup. Revisit only if the transcript
  fields disappear.
- **Blanket 1-hour cache TTL** anywhere — measured **+8.6% worse** upstream. A
  1h write costs 2.0× against a 5m write's 1.25×, and ~98% of cache reuse
  happens within ~34 seconds, so paying the premium on every write to rescue the
  rare >5-minute gap is a net loss. 1h is defensible only where the next read is
  known to cross the 5-minute cliff.
- **Env-var recommendations that were not verified in official documentation** —
  three of four originally proposed levers failed verification: git-instruction
  disabling does not save "~1,800 tokens per call" (git status is a startup
  snapshot), legacy-model-remap pinning gives no cache-prefix stability across
  host upgrades, and the Bedrock-suffixed 1h TTL variable is deprecated and does
  not apply to subagents.
- **Cache-hit-driven auto-tuning** — `cache_hit` is a proxy for host-controlled
  behaviour. The loop-engineering boundary requires a direct measure before any
  measure→adjust automation. Report it; never act on it.
- **Worktree practice changes for cache reasons** — the pre-registered claim was
  **falsified**: pooled first-call read share across 24 worktree directories vs
  the established checkout came out 2.8% vs 4.0%, a ratio of 69% where the claim
  required <10%. Per-directory cache scoping does not cost what its framing
  implies. No guidance ships, and governance isolation is never traded for a
  cache rate.
- **A caching mechanism for teams or subagents** — subagent request
  construction is host-owned and unreachable from this package. What this
  package controls is the **payload size** it authors, not the cache mechanism.
  Measurement and authoring discipline only.
- **The subscription-quota argument** — the claim that cache writes burn
  Q5h/Q7d quota, making flat-rate paths non-free, has **no primary source**. It
  was dropped rather than shipped as a hedge. Do not reintroduce it without one.

## What is genuinely ours to fix

Only the payload the package authors: the always-loaded rule set, the CLAUDE.md
hierarchy, preloaded skill content. That is a **second, independent** lever
distinct from the context-window budget — an artefact can sit inside the
context-window cap and still dominate the write bill because it is re-written on
every spawn. Per-rule per-spawn costs are reported by `preamble_byte_census`;
a dormancy decision needs the same evidence bar the telegraph-speak dormancy met
(a measurement first, never a preference).

## See also

- [`api-cost-levers`](../../../docs/guidelines/agent-infra/api-cost-levers.md) — the consumer-facing lever guidance and the `## Known upstream costs` block.
- [`no-runtime-boundary`](../../../docs/contracts/no-runtime-boundary.md) — the boundary the proxy refusal rests on.
- `src/scripts/cache_realization_report.ts`, `src/scripts/preamble_byte_census.ts` — the two reproductions.
