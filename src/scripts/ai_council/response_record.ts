/**
 * How a `CouncilResponse` is shaped for the persisted session record.
 *
 * Extracted from `council_cli.ts` on 2026-08-30. It belongs here on its own
 * merits — it is a pure data-shaping function over a type this directory owns,
 * with no CLI concern in it — and it pays for the lines the same change spent
 * in files that are thousands past `check_source_size_budget`'s ceiling. That
 * gate's own convention is that the total falls through extraction and never
 * rises through a baseline edit.
 *
 * `metadata` values are stringified deliberately, and two consumers depend on
 * it: `ai_council/pricing.ts` coerces them back, and `billable_cost.test.ts`
 * pins the behavior.
 *
 * Side-effect-free, no CLI entry, no `process.exit`.
 */
import type { CouncilResponse } from './clients.js';

type Dict = Record<string, unknown>;

export function serializeResponses(responses: CouncilResponse[]): Dict[] {
    const out: Dict[] = [];
    for (const r of responses) {
        const metadata: Dict = {};
        for (const [k, v] of Object.entries(r.metadata || {})) {
            metadata[k] = String(v);
        }
        out.push({
            provider: r.provider,
            model: r.model,
            text: r.text,
            // Present ONLY when something rewrote `text` in place — today that
            // is the inline-findings harvest, whose emitted marker promises
            // exactly this retention. Omitted otherwise rather than written as
            // a copy of `text`, so an unmodified reply does not carry a
            // duplicate of itself into every session record. The full account
            // of why the field exists is at its single write site in
            // `inline_findings.ts`.
            ...(r.raw_text === null ? {} : { raw_text: r.raw_text }),
            input_tokens: r.input_tokens,
            output_tokens: r.output_tokens,
            cache_creation_input_tokens: r.cache_creation_input_tokens,
            cache_read_input_tokens: r.cache_read_input_tokens,
            latency_ms: r.latency_ms,
            error: r.error,
            metadata,
        });
    }
    return out;
}
