// Tests for src/scripts/ai_council/response_render.ts — the per-member meta
// line written into the council artefact.
//
// road-to-unknowns-that-say-so 4.2: a size-fit downgrade was visible on stdout
// only. The artefact now names the configured model beside the transport note.
import { describe, expect, it } from 'vitest';

import { CouncilResponse } from '../../../src/scripts/ai_council/clients.js';
import { renderResponseMeta } from '../../../src/scripts/ai_council/response_render.js';

const deps = { pyFixed: (x: number, n: number): string => x.toFixed(n) };

function answered(metadata: Record<string, unknown>): CouncilResponse {
    return new CouncilResponse({
        provider: 'anthropic',
        model: 'claude-small',
        text: 'ok',
        error: null,
        input_tokens: 10,
        output_tokens: 20,
        latency_ms: 7,
        metadata,
    });
}

describe('renderResponseMeta', () => {
    it('renders-size-fit-downgrade', () => {
        const line = renderResponseMeta(
            answered({
                billable: true,
                cost_usd: 0.0012,
                configured_model: 'claude-big',
                size_fit_reason: 'short prompt, no complexity triggers',
            }),
            deps,
        );
        expect(line).toBe(
            '*cost: $0.0012 · tokens: 10 in / 20 out · 7 ms · ' +
                'model: claude-small (downgraded from claude-big: short prompt, no complexity triggers)*',
        );
    });

    it('a seat that was not downgraded keeps its line', () => {
        const line = renderResponseMeta(answered({ billable: true, cost_usd: 0.0012 }), deps);
        expect(line).toBe('*cost: $0.0012 · tokens: 10 in / 20 out · 7 ms*');
    });

    it('the downgrade note sits beside the transport note', () => {
        const line = renderResponseMeta(
            answered({
                billable: true,
                fallback_from: 'cli',
                fallback_reason: 'binary_missing',
                configured_model: 'claude-big',
                size_fit_reason: 'r',
            }),
            deps,
        );
        expect(line).toBe(
            '*tokens: 10 in / 20 out · 7 ms · transport: api (fell back from cli: binary_missing) · ' +
                'model: claude-small (downgraded from claude-big: r)*',
        );
    });
});
