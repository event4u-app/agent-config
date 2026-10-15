<!-- evidence-type: analysis -->
# Subagent cold start, re-taken — 2026-10-14

`road-to-bytes-the-model-actually-receives` step 4.1. Re-runs the method of
`downshift-vs-cache.md` (2026-08-16) at `main@90ed4e697`, on 2026-10-14, so the
spawn-cost figure the delegation nudge is decided on is current rather than two
months old. **Machine-local**: the corpus is this machine's Claude Code
transcripts.

## Instrument and corpus

`./scripts-run src/scripts/cache_realization_report --format json` — the same
instrument, unchanged, reading `~/.claude/projects` (full tree) over the last
14 days. Every figure is computed from
`billable_input = input_tokens + cache_read_input_tokens + cache_creation_input_tokens`.

| Property | 2026-08-16 | 2026-10-14 |
|---|---:|---:|
| Host | Claude Code 2.1.233 | Claude Code 2.1.300 |
| Records (unique of seen) | 58,231 of 116,056 | 65,721 of 116,711 |
| Subagent legs | 611 | 517 |
| Subagent calls | 16,612 | 50,684 |

## The reading

| Measure | 2026-08-16 | 2026-10-14 |
|---|---:|---:|
| First-call cache-read share | 2.8 % | **9.8 %** |
| Median first-call written-or-uncached tokens | 242,891 | **182,257** |
| Mean first-call written-or-uncached tokens | — | 179,883 |
| Cold start as a share of subagent write volume | 64.6 % | 26.8 % |
| Subagent cache-read share, all calls | 96.9 % | 98.2 % |

The cold start fell by about a quarter — consistent with the scoped projection
shrinking the standing payload a leg loads — and a leg still opens by writing or
reading uncached a median 182,257 tokens. That is above the 100,000-token
threshold D5 set, so step 4.2's advisory clause applies.

## What this does not say

- Legs are longer now (98 calls per leg on average against 27), so the cold start
  is a smaller share of what a leg spends; the per-spawn cost a short slice pays
  is unchanged in kind.
- The figure is tokens, not money: a cache write is priced above an uncached
  read, and neither is broken out by model here.
- One machine, one 14-day window. A different working pattern gives different
  legs.
