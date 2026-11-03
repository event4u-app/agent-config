/**
 * cold_return — is this session's prompt cache cold, and what does the next
 * request re-process? (road-to-a-return-that-names-its-price 2.1)
 *
 * Reads the host's own numbers, carried into the quota ledger by the
 * status-line tap (`prompt_cache_reading.ts`). A compaction, idle compaction
 * included, is itself a request that rewrites the cache, so the host reports a
 * fresh `expires_at` after it and no separate compaction check is needed here.
 *
 * Without the tap there is no reading and the line stays silent, on purpose:
 * a transcript cannot tell cold from warm (46 % false cold in the calibration
 * replay, `session_eol_report`), so no transcript fallback exists.
 */

import type { QuotaSnapshot } from './quota_ledger.js';

/** Stated default, not measured (D4): with no measured start, a re-write below this is not an event. */
export const COLD_FLOOR_TOKENS = 50_000;

/** D4: a re-write is worth a line at twice the measured `/clear` start, or at the floor when none is measured. */
export function overThreshold(recache: number, start: number | undefined): boolean {
    return recache >= (start ? 2 * start : COLD_FLOOR_TOKENS);
}

export const k = (x: number): string => `${Math.round(x / 1000)}k`;

/**
 * The line for a cold cache, or `null` while warm, without a reading, or below
 * the threshold (D4: 2× the measured `/clear` start). Receipt wording on
 * purpose: `UserPromptSubmit` runs after Enter, so the cost is being paid.
 */
export function coldLine(snap: QuotaSnapshot | undefined, now: number): string | null {
    const c = snap?.cache;
    const recache = c?.recache_tokens_if_cold ?? 0;
    const start = snap?.clear_start;
    if (c?.expires_at === undefined || now < c.expires_at || !overThreshold(recache, start)) return null;
    return (
        `AC: prompt cache cold for ${Math.max(1, Math.round((now - c.expires_at) / 60_000))} min (TTL ${c.ttl ?? '?'}) — ` +
        `this message is re-processing ~${k(recache)} tokens. A /clear start here is ` +
        (start ? `~${k(start)} (+ continuity record ≤ 1.5k).` : 'not measured yet.')
    );
}
