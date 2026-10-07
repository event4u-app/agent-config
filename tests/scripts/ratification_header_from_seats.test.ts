// A ratification header must not say more than its seats said: `providers:`
// and `verdict:` are derived from per-seat final verdicts, and the reader
// refuses a recorded header that contradicts the recorded seats.
import { describe, expect, it, vi } from 'vitest';

import {
    deriveRatificationHeader,
    isRatified,
    readRatification,
    renderRatificationHeader,
    type SeatVerdict,
} from '../../src/scripts/_lib/ratification_artifact.js';
import { main as headerMain } from '../../src/scripts/ratification_header.js';

function artifact(header: string): string {
    return [
        '---',
        'proposed_by: session-a',
        'implemented_by: session-a',
        'reviewed_by: council/anthropic+openai',
        header,
        'effective_after: merge',
        '---',
        '',
        '<!-- evidence-type: ratification -->',
        '',
    ].join('\n');
}

const codes = (text: string): string[] => readRatification(text, 2).problems.map((p) => p.code);

describe('deriveRatificationHeader', () => {
    const cases: [Record<string, SeatVerdict>, string[], string][] = [
        [{ anthropic: 'ratified', openai: 'ratified' }, ['anthropic', 'openai'], 'ratified'],
        [{ anthropic: 'ratified', openai: 'confirmed-non-expanding' }, ['anthropic', 'openai'], 'ratified'],
        [{ anthropic: 'confirmed-non-expanding', openai: 'confirmed-non-expanding' }, ['anthropic', 'openai'], 'confirmed-non-expanding'],
        [{ anthropic: 'non-convergent', openai: 'ratified' }, ['anthropic', 'openai'], 'non-convergent'],
        [{ anthropic: 'refused', openai: 'non-convergent' }, ['anthropic', 'openai'], 'refused'],
        [{ anthropic: 'confirmed-non-expanding', openai: 'no-final-verdict' }, ['anthropic'], 'confirmed-non-expanding'],
        [{ anthropic: 'no-final-verdict' }, [], 'non-convergent'],
    ];
    for (const [seats, providers, verdict] of cases) {
        it(`${JSON.stringify(seats)} -> ${verdict} over [${providers.join(', ')}]`, () => {
            expect(deriveRatificationHeader(seats)).toEqual({ providers, verdict });
        });
    }
});

describe('the reader checks a recorded header against its seats', () => {
    it('accepts a header rendered from two ratifying seats', () => {
        const text = artifact(renderRatificationHeader({ anthropic: 'ratified', openai: 'ratified' }));
        const r = readRatification(text, 2);
        expect(r.problems).toEqual([]);
        expect(isRatified(r)).toBe(true);
    });

    it('flags `ratified` written over a non-convergent seat', () => {
        const text = artifact(
            ['providers: [anthropic, openai]', 'verdict: ratified', 'seats:', '  anthropic: non-convergent', '  openai: ratified'].join('\n'),
        );
        expect(codes(text)).toContain('seat-dissent');
        expect(isRatified(readRatification(text, 2))).toBe(false);
    });

    it('flags `confirmed-non-expanding` written over a refusing seat', () => {
        const text = artifact(
            ['providers: [anthropic, openai]', 'verdict: confirmed-non-expanding', 'seats:', '  anthropic: confirmed-non-expanding', '  openai: refused'].join('\n'),
        );
        expect(codes(text)).toContain('seat-dissent');
    });

    it('flags two providers where one seat closed without a final verdict', () => {
        const text = artifact(
            ['providers: [anthropic, openai]', 'verdict: confirmed-non-expanding', 'seats:', '  anthropic: confirmed-non-expanding', '  openai: no-final-verdict'].join('\n'),
        );
        expect(codes(text)).toContain('providers-exceed-seats');
    });

    it('lets the derived single-seat header reach the diversity rule instead of passing it', () => {
        const text = artifact(renderRatificationHeader({ anthropic: 'ratified', openai: 'no-final-verdict' }));
        expect(codes(text)).toEqual(['diversity-required']);
    });

    it('flags an unknown seat verdict', () => {
        const text = artifact(['providers: [anthropic, openai]', 'verdict: ratified', 'seats:', '  anthropic: ratified', '  openai: approved'].join('\n'));
        expect(codes(text)).toContain('unknown-seat-verdict');
    });

    it('flags a passing header that differs from the derived one', () => {
        const text = artifact(
            ['providers: [anthropic, openai]', 'verdict: ratified', 'seats:', '  anthropic: confirmed-non-expanding', '  openai: confirmed-non-expanding'].join('\n'),
        );
        expect(codes(text)).toEqual(['header-not-derived']);
    });

    it('flags a final seat left out of providers', () => {
        const text = artifact(['providers: [anthropic]', 'verdict: ratified', 'seats:', '  anthropic: ratified', '  openai: ratified'].join('\n'));
        expect(codes(text)).toContain('header-not-derived');
    });

    it('refuses a present but empty or non-map `seats:` rather than reading it as absent', () => {
        expect(codes(artifact(['providers: [anthropic, openai]', 'verdict: ratified', 'seats: []'].join('\n')))).toContain('malformed-seats');
        expect(codes(artifact(['providers: [anthropic, openai]', 'verdict: ratified', 'seats: anthropic'].join('\n')))).toContain('malformed-seats');
    });

    it('refuses a seat key that is not a provider id', () => {
        const text = artifact(['providers: [anthropic, openai]', 'verdict: ratified', 'seats:', '  Open AI: ratified', '  anthropic: ratified'].join('\n'));
        expect(codes(text)).toContain('bad-seat-provider');
    });

    it('refuses a seat recorded twice', () => {
        const text = artifact(['providers: [anthropic, openai]', 'verdict: ratified', 'seats:', '  openai: refused', '  anthropic: ratified', '  openai: ratified'].join('\n'));
        expect(codes(text)).toContain('bad-seat-provider');
    });

    for (const spelling of ['"openai"', "'openai'", ' "openai" ']) {
        it(`refuses a seat repeated under the quoted spelling ${spelling}`, () => {
            const text = artifact(
                ['providers: [anthropic, openai]', 'verdict: ratified', 'seats:', '  openai: refused', '  anthropic: ratified', `  ${spelling}: ratified`].join('\n'),
            );
            const r = readRatification(text, 2);
            expect(r.problems.map((p) => p.code)).toEqual(['bad-seat-provider']);
            expect(r.problems[0]?.message).toContain('more than once');
            expect(isRatified(r)).toBe(false);
        });
    }

    it('does not read a repeated comment inside `seats:` as a repeated seat', () => {
        const text = artifact(
            ['providers: [anthropic, openai]', 'verdict: ratified', 'seats:', '  # final round', '  # final round', '  anthropic: ratified', '  openai: ratified'].join('\n'),
        );
        expect(readRatification(text, 2).problems).toEqual([]);
    });

    it('the writer refuses a provider id that could carry YAML syntax', () => {
        expect(() => renderRatificationHeader({ 'openai]\nverdict: ratified': 'refused' } as Record<string, SeatVerdict>)).toThrow(
            /not a provider id/u,
        );
    });

    it('refuses an artifact without `seats:` — the header is never free-written', () => {
        const text = artifact(['providers: [anthropic, openai]', 'verdict: ratified'].join('\n'));
        expect(codes(text)).toEqual(['no-seats']);
        expect(isRatified(readRatification(text, 2))).toBe(false);
    });

    it('refuses an explicit `seats: null`', () => {
        expect(codes(artifact(['providers: [anthropic, openai]', 'verdict: ratified', 'seats: null'].join('\n')))).toContain(
            'malformed-seats',
        );
    });
});

describe('ratification_header CLI', () => {
    it('prints the derived lines and refuses a malformed seat', () => {
        let out = '';
        const w = vi.spyOn(process.stdout, 'write').mockImplementation((s: string | Uint8Array) => {
            out += String(s);
            return true;
        });
        const e = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
        try {
            expect(headerMain(['--seat', 'anthropic=non-convergent', '--seat', 'openai=ratified'])).toBe(0);
            expect(out).toBe(
                'providers: [anthropic, openai]\nverdict: non-convergent\nseats:\n  anthropic: non-convergent\n  openai: ratified\n',
            );
            expect(headerMain(['--seat', 'openai=approved'])).toBe(2);
            expect(headerMain(['--seat', '   =ratified'])).toBe(2);
            expect(headerMain(['--seat', 'open]ai=ratified'])).toBe(2);
            expect(headerMain([])).toBe(2);
        } finally {
            w.mockRestore();
            e.mockRestore();
        }
    });
});
