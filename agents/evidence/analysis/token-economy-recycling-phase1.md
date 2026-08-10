# Phase 1 measurements — road-to-token-economy-recycling

First-party session end-of-life baseline over this machine's own Claude Code
transcript store. Nothing below is carried over from third-party reporting or
a prior session's claim — every number was produced by the reproduce command
on this store, and the compaction-marker shapes were read from a real
observed compaction, not inferred from docs.

**Measured:** 2026-08-10 · **Host:** Claude Code (observed records up to v2.1.222) ·
**Store:** `~/.claude/projects` (2026-06-25 .. 2026-08-10, 1,146 JSONL files, 205 non-empty sessions)

**Reproduce:** `./scripts-run src/scripts/session_eol_report` (add `-- --json`
for the machine shape). Token unit throughout: **parsed transcript tokens** —
`billable_input = input_tokens + cache_read + cache_creation` of the last
main-chain assistant record (`src/scripts/_lib/cc_transcript.ts`), never a
byte proxy.

## 1. Compaction-marker shape — OBSERVED, blocker resolved

A real auto-compaction (2026-08-06, host v2.1.222) writes **two** markers
into the transcript:

| marker | shape |
|---|---|
| boundary | `{"type":"system","subtype":"compact_boundary","compactMetadata":{"trigger":"auto","preTokens":1000410,"postTokens":15870,"cumulativeDroppedTokens":984540,"durationMs":123281,...}}` |
| summary | `{"type":"user","isCompactSummary":true,...}` carrying the summarizer's prose |

The detector (`src/scripts/_lib/session_eol.ts`) is pinned to the boundary
shape with a structural fixture (`tests/scripts/_lib_session_eol.test.ts`),
and counts BOTH markers independently — on this store they agree exactly
(31 boundary events, 31 summary records, drift: no). A host update that
changes one shape makes the counters diverge, which the report surfaces as
`marker drift: YES` instead of silently zeroing the metric.

Bonus observation the third-party framing missed: `compactMetadata` carries
the exact pre/post token counts and the compaction duration (123 s of
wall-clock in the observed event — a paid model run, as the roadmap header
hypothesized).

## 2. Session-length distribution — CONFIRMED long-tailed and expensive

| metric | value |
|---|---|
| sessions with parseable final usage | 201 of 205 |
| final context tokens | median **519,349** · p90 807,937 · p95 902,355 · max 986,876 |
| turns per session | median 6 · p90 27 · max 136 |
| sessions ending ≥ 200k / 400k / 600k / 800k | 187 / 140 / 72 / 23 |
| window split (peak > 210k ⇒ 1M window) | **190 sessions on the 1M window**, 11 on ≤ 200k |

This store runs almost entirely on the 1M-context window — the threshold in
Phase 3 targets that population; the 11 ≤ 200k-window sessions are a stated
limitation (they auto-compact near ~160–206k, far below any 1M-derived
threshold) recorded in the threshold file for the review date.

## 3. Auto-compact incidence and trigger point — MEASURED

| metric | value |
|---|---|
| sessions with ≥ 1 compaction | 23 of 205 (11.2%) |
| compaction events | 31 — **all `trigger:"auto"`, zero manual** |
| trigger point (preTokens) | min **941,636** · median 1,000,551 · max 1,031,366 |
| post-compaction context (postTokens) | median 17,116 |

The observed auto-compact trigger sits at ~94–103% of the 1M window. The
median compaction discards ~98% of the accumulated context into one
unreviewable summary — the loss profile the recycle envelope replaces with
validated selection.

## 4. Cost of a late-session turn vs an early one — MEASURED 2.1×

Over the 145 sessions with ≥ 200 main-chain API calls: mean billable input
per call across the first 20 calls vs the last 20 calls of each session —
median early **279,859** tokens/call, median late **594,985** tokens/call:
**late/early ratio median 2.1×, p90 3.3×**. Every late-session turn re-pays
roughly double the context of an early one, before any quality effect.

## 5. Fallback-path check (1.2) — incidence > 0, byte proxy FALSIFIED as a unit

4 of 205 sessions yielded no parseable assistant usage (transcripts with
user/tool records only). Per the roadmap, the bytes↔tokens correlation over
the readable set is therefore published: **Pearson r = 0.387** (n = 194,
file bytes vs final context tokens). That is far too weak to stand in for
the parsed unit — file bytes accumulate sidechain and tool payloads that
never enter the main-chain context. Consequence, recorded as the honest
fallback policy: unparseable transcripts are recorded as **incidence with
`final_context_tokens: null`** — never as a byte-derived token estimate.

## 6. Post-compaction verify-fail incidence — NOT DERIVABLE RETROACTIVELY

The transcript records carry no verify-outcome field, so a retroactive
verify-fail rate would be invented, not measured. The forward-looking
instrument ships instead: the `session-eol` Stop-slot concern records
per-session compaction events, and the `post_recycle_verify_fail_vs_baseline`
metric registration (`src/config/hook-token-budget.json`) names the
comparison + publish-if-worse commitment. This gap is stated rather than
back-filled.

## Threshold derivation (consumed by Phase 3.1)

Committed shape per roadmap 3.1 — comfortably below the measured auto-compact
trigger, above the median healthy session:

> **recycle_threshold_tokens = 800,000** — ≈ p90 of the 201 measured final
> sizes (807,937), 54% above the median healthy session (519,349), 15% below
> the minimum observed auto-compact trigger (941,636). At this line, ~10% of
> historical sessions would have been advised to recycle, and every one of
> the 23 sessions that actually auto-compacted would have been advised first.
