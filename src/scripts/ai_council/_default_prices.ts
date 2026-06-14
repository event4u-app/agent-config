/**
 * Shipped baseline prices for the AI Council.
 *
 * TypeScript twin of `src/scripts/ai_council/_default_prices.py` (ADR-096 —
 * Python→TS migration, Phase 8 / Wave 8g; ported as a prerequisite of
 * `update_prices.ts`). Values + ordering + `as_rows()` semantics mirror the
 * Python original EXACTLY.
 *
 * This module is the bootstrap source for `agents/runtime/.agent-prices.md`
 * when the runtime file is missing, and the network-fallback source for
 * `update_prices.ts` when the upstream feed (LiteLLM) is unreachable.
 *
 * Prices are USD per 1 000 000 tokens.
 */

// YYYY-MM-DD of when this table was last hand-edited.
export const LAST_UPDATED = '2026-05-14';

/**
 * (provider, model) -> (input_per_1m_usd, output_per_1m_usd).
 *
 * Python keys a dict with `(provider, model)` tuples; TS uses a "provider model"
 * string key with a parallel ordered entry list so insertion order (which
 * `as_rows`'s sort depends on as a stable tie-break) is preserved exactly.
 */
export const DEFAULT_PRICES_ENTRIES: ReadonlyArray<readonly [string, string, number, number]> = [
    // ── Anthropic ────────────────────────────────────────────────────
    ['anthropic', 'claude-sonnet-4-5', 3.0, 15.0],
    ['anthropic', 'claude-opus-4-1', 15.0, 75.0],
    ['anthropic', 'claude-haiku-4-5', 1.0, 5.0],
    // ── OpenAI ───────────────────────────────────────────────────────
    ['openai', 'gpt-4o', 2.5, 10.0],
    ['openai', 'gpt-4o-mini', 0.15, 0.6],
    ['openai', 'o1', 15.0, 60.0],
    ['openai', 'o3-mini', 1.1, 4.4],
    // ── Google Gemini ────────────────────────────────────────────────
    ['gemini', 'gemini-2.5-pro', 1.25, 10.0],
    ['gemini', 'gemini-2.5-flash', 0.3, 2.5],
    // ── xAI Grok ─────────────────────────────────────────────────────
    ['xai', 'grok-4', 3.0, 15.0],
    ['xai', 'grok-3-mini', 0.3, 0.5],
    // ── Perplexity ───────────────────────────────────────────────────
    ['perplexity', 'sonar-pro', 3.0, 15.0],
    ['perplexity', 'sonar', 1.0, 1.0],
];

/** Stable "provider model" composite key (mirrors the Python tuple key). */
export function priceKey(provider: string, model: string): string {
    return `${provider} ${model}`;
}

/** DEFAULT_PRICES as a Map keyed by (provider, model) — value is [input, output]. */
export const DEFAULT_PRICES: ReadonlyMap<string, readonly [number, number]> = new Map(
    DEFAULT_PRICES_ENTRIES.map(([p, m, i, o]) => [priceKey(p, m), [i, o] as const]),
);

/**
 * Return the table sorted (provider, model) for stable Markdown output.
 * Mirrors `sorted(DEFAULT_PRICES.items())` — lexicographic on (provider, model).
 */
export function as_rows(): Array<[string, string, number, number]> {
    return [...DEFAULT_PRICES_ENTRIES]
        .map(([p, m, i, o]) => [p, m, i, o] as [string, string, number, number])
        .sort((a, b) => {
            if (a[0] !== b[0]) {
                return a[0] < b[0] ? -1 : 1;
            }
            if (a[1] !== b[1]) {
                return a[1] < b[1] ? -1 : 1;
            }
            return 0;
        });
}
