<!-- evidence-type: analysis -->

# Cold-return calibration — transcript replay, 2026-11-01

Step 4.1 of `road-to-a-return-that-names-its-price`. Reproduce:

```bash
./scripts-run src/scripts/session_eol_report
```

Read on the maintainer's local Claude Code store at tree `5a66c1bf19` plus this
change. Counts only; no transcript content.

| Reading | Value |
|---|---|
| Gaps between two main-chain responses longer than the TTL of the newest cache write, no compaction between | 573 |
| … whose next request still read the cache (paid under half the prediction) — **false cold** | 263 (46 %) |
| … really cold | 310 |
| Size error on really-cold returns, `\|predicted − actual\| / actual` | p50 6.3 %, p90 100 % |
| Really-cold returns under the 50k floor (`COLD_FLOOR_TOKENS`) | 2 |

## What it says

1. **A transcript cannot tell cold from warm.** In 46 % of the gaps it reads as
   cold, the host still served the cache. The transcript records the 5m/1h split
   only on records that wrote, and the replay defaults to 5m when none was seen;
   a plan session on a 1h TTL therefore looks cold after five minutes. This is
   why D1 lets the host's `prompt_cache.warm` / `expires_at` decide, and why the
   shipped notice reads the tap's ledger only.
2. **When it really is cold, the size is predictable.** The previous response's
   whole input plus its output lands within 6.3 % at the median.
3. **The 50k floor almost never silences a real cold return** (2 of 310).

## Consequence for the carried fallback (step 1.2, AC-3)

A transcript-only fallback would show the line on roughly every second return
where nothing was re-paid. Raising the `quota_notice` chunk ceiling to ship it
(a ratified edit) buys a notice that is wrong half the time. The carried item
records this as the reason to decide it, not to build it.

The host figure `recache_tokens_if_cold` is not in a transcript; its error is
the live-host probe parked in `stubs/road-to-a-limit-the-host-actually-signals`.
