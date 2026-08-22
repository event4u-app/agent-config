import { describe, expect, it } from 'vitest';

import { computeRate } from '../../src/scripts/report_envelope_rate.js';

const row = (o: Record<string, unknown>) => JSON.stringify({ event: 'subagent_stop', ...o });

describe('valid_envelope_rate', () => {
    it('reports the rate, the stop count and the window — never the rate alone', () => {
        // Step 1.2's whole point: a rate with no denominator is a claim, not a
        // measurement.
        const r = computeRate(
            [
                row({ envelope_parse: 'ok', ts: '2026-08-20T00:00:00Z', agent_type: 'Explore' }),
                row({ envelope_parse: 'no_envelope', ts: '2026-08-21T00:00:00Z' }),
            ],
            ['agents/runtime/state/subagent-ledger/2026-08.jsonl'],
        );
        expect(r.stops).toBe(2);
        expect(r.ok).toBe(1);
        expect(r.rate).toBe(0.5);
        expect(r.window_start).toBe('2026-08-20T00:00:00Z');
        expect(r.window_end).toBe('2026-08-21T00:00:00Z');
        expect(r.ledger_paths).toHaveLength(1);
    });

    it('EXCLUDES the retired `absent` vocabulary and counts the exclusion', () => {
        // Mixing the vocabularies would report a number that is about neither:
        // `absent` collapsed no_message and no_envelope into one bucket.
        const r = computeRate(
            [
                row({ envelope_parse: 'absent', ts: '2026-08-01T00:00:00Z' }),
                row({ envelope_parse: 'absent', ts: '2026-08-02T00:00:00Z' }),
                row({ envelope_parse: 'no_envelope', ts: '2026-08-20T00:00:00Z' }),
            ],
            ['x.jsonl'],
        );
        expect(r.stops).toBe(1);
        expect(r.excluded_absent).toBe(2);
        // The window is the POST-SPLIT window, not the file's span.
        expect(r.window_start).toBe('2026-08-20T00:00:00Z');
    });

    it('publishes the agent-type composition, null included', () => {
        // AC-3 requires the composition, and the null majority is the finding:
        // it is why no stop can be attributed to a dispatcher.
        const r = computeRate(
            [
                row({ envelope_parse: 'no_envelope', ts: '2026-08-20T00:00:00Z' }),
                row({ envelope_parse: 'no_envelope', ts: '2026-08-20T00:00:01Z', agent_type: 'Explore' }),
            ],
            ['x.jsonl'],
        );
        expect(r.by_agent_type).toEqual({ '(null)': 1, Explore: 1 });
    });

    it('is 0 and not NaN on an empty set, so the denominator still reads', () => {
        const r = computeRate([], []);
        expect(r.rate).toBe(0);
        expect(r.stops).toBe(0);
        expect(Number.isNaN(r.rate)).toBe(false);
    });

    it('ignores rows that are not subagent stops, and unparseable lines', () => {
        const r = computeRate(
            [
                row({ envelope_parse: 'ok', ts: '2026-08-20T00:00:00Z' }),
                JSON.stringify({ event: 'subagent_start', envelope_parse: 'ok' }),
                '{ not json',
                '',
            ],
            ['x.jsonl'],
        );
        expect(r.stops).toBe(1);
    });
});
