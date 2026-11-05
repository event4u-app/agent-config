import { describe, expect, it } from 'vitest';

import { interpret, REMOVAL_SENTENCE, renderRecord } from '../../src/scripts/bench_ab_interpret.js';

type Dict = Record<string, unknown>;

function run(cap: boolean, dis: number, opts: { errored?: string; input?: number } = {}): Dict {
    return {
        errored: opts.errored !== undefined,
        reason: opts.errored ?? null,
        capability_pass: cap,
        discipline_score: dis,
        metrics: { tokens: 0, status_bucket: opts.errored ? 'errored' : 'completed' },
        tokens_breakdown: { input_tokens: opts.input ?? 100_000, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
    };
}

/** 24 pairs on Haiku: capability 100 % both arms, discipline 0.833 → 1.000, 4 discordant all for the package. */
function haikuSweep(): Dict {
    const records: Dict[] = [];
    for (let i = 0; i < 24; i += 1) {
        const lift = i < 4;
        records.push({
            id: `t${i}`,
            arms: {
                vanilla: [run(true, lift ? 0.333 : 1.0, { input: 100_000 })],
                package: [run(true, 1.0, { input: 790_000 })],
            },
        });
    }
    return { stamp: '2026-11-05T10-05-05Z', model: 'claude-haiku-4-5', arms: ['vanilla', 'package'], records };
}

/** The package arm failed its load check on every trial. */
function notDelivered(): Dict {
    const records: Dict[] = [];
    for (let i = 0; i < 12; i += 1) {
        records.push({
            id: `t${i}`,
            arms: {
                vanilla: [run(i % 2 === 0, 0.5)],
                package: [run(false, 0, { errored: 'load_mismatch: 0 package skills in system/init' })],
            },
        });
    }
    return { stamp: 'x', model: 'claude-haiku-4-5', arms: ['vanilla', 'package'], records };
}

function labels(rec: Dict, compLabel = 'package lift'): string[] {
    const c = (rec['comparisons'] as Dict[]).find((x) => x['arm_treatment'] === 'package') as Dict;
    void compLabel;
    return (c['labels'] as Array<{ label: string }>).map((l) => l.label).sort();
}

describe('bench_ab_interpret', () => {
    it('reads the 2026-11-05 Haiku sweep as ceiling + underpowered + cost-overhead', () => {
        const rec = interpret(haikuSweep());
        expect(labels(rec)).toEqual(['ceiling', 'cost-overhead', 'underpowered']);
    });

    it('reads a sweep whose package arm never loaded as not-delivered', () => {
        expect(labels(interpret(notDelivered()))).toContain('not-delivered');
    });

    it('never supports removal, whatever the input', () => {
        for (const payload of [haikuSweep(), notDelivered(), { arms: [], records: [] }]) {
            const rec = interpret(payload);
            expect(rec['removal_supported']).toBe(false);
            expect(rec['note']).toBe(REMOVAL_SENTENCE);
            expect(JSON.stringify(rec)).not.toMatch(/"(recommendation|remove|action)"\s*:/);
        }
    });

    it('lists the questions data cannot answer as open', () => {
        const c = (interpret(haikuSweep())['comparisons'] as Dict[])[0] as Dict;
        const open = c['open_questions'] as string[];
        expect(open.some((q) => /construct/i.test(q))).toBe(true);
        expect(open.some((q) => /real-world|real use/i.test(q))).toBe(true);
    });

    it('renders the record with the removal sentence on every output', () => {
        const md = renderRecord(interpret(haikuSweep()));
        expect(md).toContain(REMOVAL_SENTENCE);
        expect(md).toMatch(/ceiling/);
    });
});
