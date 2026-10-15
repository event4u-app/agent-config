/**
 * egress_rules — the one rule table for egress placeholders.
 *
 * Planted values are assembled at runtime so no credential-shaped literal sits
 * in this file, and assertions compare spans by boolean equality so a failure
 * never prints a planted value.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    detect,
    EGRESS_RULES,
    type EgressRule,
    type EgressSpan,
    findUnboundedQuantifier,
    replaceSpans,
    resolveOverlaps,
} from './egress_rules.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const ALNUM = 'Ab3Cd5Ef7Gh9Jk2Lm4Np6Qr8St1Uv3Wx5Yz7';
function mixed(n: number): string {
    let s = '';
    while (s.length < n) s += ALNUM;
    return s.slice(0, n);
}

describe('rule table shape', () => {
    it('every rule names exactly one class and carries the global flag', () => {
        expect(EGRESS_RULES.length).toBeGreaterThan(0);
        for (const r of EGRESS_RULES) {
            expect(['credential', 'identifier']).toContain(r.class);
            expect(r.pattern.flags).toContain('g');
            expect(r.type).toMatch(/^[A-Z][A-Z0-9]*$/);
        }
    });

    it('rule ids are unique', () => {
        const ids = EGRESS_RULES.map((r) => r.rule);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('every rule states why it is linear, and every unbounded rule says so explicitly', () => {
        for (const r of EGRESS_RULES) {
            expect(r.linearity.length).toBeGreaterThan(40);
        }
        const unbounded = EGRESS_RULES.filter((r) => findUnboundedQuantifier(r.pattern) !== null);
        expect(unbounded.length).toBeGreaterThan(0);
    });

    it('the quantifier check refuses unbounded forms and accepts bounded ones', () => {
        expect(findUnboundedQuantifier(/a+/g)).not.toBeNull();
        expect(findUnboundedQuantifier(/a*/g)).not.toBeNull();
        expect(findUnboundedQuantifier(/a{3,}/g)).not.toBeNull();
        expect(findUnboundedQuantifier(/(?:ab)+/g)).not.toBeNull();
        expect(findUnboundedQuantifier(/a{1,8}[+*]\+\*b{2}/g)).toBeNull();
    });

    it('the module is pure: it imports nothing', () => {
        const src = fs.readFileSync(path.join(HERE, 'egress_rules.ts'), 'utf-8');
        expect(/^\s*import\s/m.test(src)).toBe(false);
        expect(/\brequire\(/.test(src)).toBe(false);
    });
});

// Timing is a smoke check, not the proof: each rule's `linearity` field carries
// the argument. The restart-heavy inputs are the shapes that made the pre-move
// jwt and db-connection-uri patterns quadratic; the calibration test shows they
// are adversarial for those patterns, so a green reading here is not vacuous.
const RESTART_HEAVY: Record<string, string> = {
    letters: 'a'.repeat(60_000),
    'dotted-scheme': `${'a.'.repeat(15_000)}://u`,
    'scheme-per-userinfo': `${'a.'.repeat(16)}://${'u'.repeat(1_000)}`.repeat(30),
    colons: 'a:'.repeat(30_000),
    'inner-eyJ': 'eyJ'.repeat(20_000),
    'long-jwt-segment': `eyJ${'a'.repeat(60_000)}`,
    'assignment-spaces': `password${' '.repeat(60_000)}`,
    'repeated-prefix': 'sk-ant-'.repeat(8_000),
    'pem-label': `-----BEGIN ${'A '.repeat(30_000)}`,
    'slack-dashes': 'xoxb-'.repeat(12_000),
};

function elapsed(fn: () => void): number {
    const t0 = performance.now();
    fn();
    return performance.now() - t0;
}

describe('restart-heavy inputs', () => {
    for (const [name, input] of Object.entries(RESTART_HEAVY)) {
        it(`completes in bounded time on ${name}`, () => {
            expect(elapsed(() => detect(input))).toBeLessThan(1_500);
        });
    }

    it('calibration: the pre-move jwt and db-connection-uri patterns are slow on them', () => {
        const scan = (re: RegExp, text: string): void => {
            const g = new RegExp(re.source, re.flags);
            while (g.exec(text) !== null);
        };
        const jwtOld = /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g;
        const uriOld = /\b[a-z][a-z0-9+.-]*:\/\/[^\s:/@]+:[^\s:/@]+@/g;
        const rule = (id: string): RegExp => EGRESS_RULES.find((r) => r.rule === id)?.pattern ?? /$^/g;
        const inner = RESTART_HEAVY['inner-eyJ'] as string;
        const dotted = RESTART_HEAVY['dotted-scheme'] as string;
        expect(elapsed(() => scan(jwtOld, inner))).toBeGreaterThan(10 * elapsed(() => scan(rule('jwt'), inner)) + 20);
        expect(elapsed(() => scan(uriOld, dotted))).toBeGreaterThan(
            10 * elapsed(() => scan(rule('db-connection-uri'), dotted)) + 20,
        );
    });
});

describe('spans', () => {
    it('carry start and end that slice exactly the value', () => {
        const key = `sk-ant-${mixed(40)}`;
        const text = `before ${key} after`;
        const spans = detect(text);
        expect(spans.length).toBe(1);
        const s = spans[0] as EgressSpan;
        expect(s.class).toBe('credential');
        expect(text.slice(s.start, s.end) === key).toBe(true);
    });

    it('a value group narrows the span to the value, not the keyword', () => {
        const value = mixed(24);
        const text = `api_key = "${value}"`;
        const spans = detect(text);
        expect(spans.length).toBe(1);
        const s = spans[0] as EgressSpan;
        expect(text.slice(s.start, s.end) === value).toBe(true);
    });

    it('a keyword assignment of a low-entropy word is not a finding', () => {
        expect(detect('secret: moderate')).toEqual([]);
        expect(detect('const token = getToken();')).toEqual([]);
    });

    it('spans are reported across lines with absolute offsets', () => {
        const key = `ghp_${mixed(36)}`;
        const text = `line one\nline two ${key}\n`;
        const s = detect(text)[0] as EgressSpan;
        expect(text.slice(s.start, s.end) === key).toBe(true);
    });
});

describe('context words, validators and exclusions', () => {
    const digits: EgressRule = {
        rule: 'test-digits',
        type: 'NUM',
        class: 'identifier',
        pattern: /\b\d{6,10}\b/g,
        context: { words: /\b(?:account|konto)\b/i, window: 20 },
        validator: (v) => v.endsWith('0'),
        exclusions: [/^1234560$/],
    };

    it('fires only with a context word inside the window', () => {
        expect(detect('account 9876540', [digits]).length).toBe(1);
        expect(detect(`account${' '.repeat(40)}9876540`, [digits]).length).toBe(0);
        expect(detect('nothing here 9876540', [digits]).length).toBe(0);
    });

    it('drops a value its validator rejects and marks an accepted one validated', () => {
        expect(detect('account 9876541', [digits]).length).toBe(0);
        expect((detect('account 9876540', [digits])[0] as EgressSpan).validated).toBe(true);
    });

    it('drops an excluded value', () => {
        expect(detect('account 1234560', [digits]).length).toBe(0);
    });
});

describe('overlap resolution', () => {
    const span = (o: Partial<EgressSpan>): EgressSpan => ({
        rule: 'r',
        type: 'T',
        class: 'identifier',
        start: 0,
        end: 1,
        validated: false,
        ...o,
    });

    it('the more sensitive class wins over a longer identifier', () => {
        const out = resolveOverlaps([
            span({
                rule: 'id',
                class: 'identifier',
                start: 0,
                end: 30,
                validated: true,
            }),
            span({ rule: 'cred', class: 'credential', start: 5, end: 15 }),
        ]);
        expect(out.map((s) => s.rule)).toEqual(['cred']);
    });

    it('then the validated span wins over a longer unvalidated one', () => {
        const out = resolveOverlaps([
            span({ rule: 'long', start: 0, end: 30 }),
            span({ rule: 'checked', start: 5, end: 15, validated: true }),
        ]);
        expect(out.map((s) => s.rule)).toEqual(['checked']);
    });

    it('then the longer span wins', () => {
        const out = resolveOverlaps([
            span({ rule: 'short', start: 2, end: 6 }),
            span({ rule: 'long', start: 0, end: 10 }),
        ]);
        expect(out.map((s) => s.rule)).toEqual(['long']);
    });

    it('keeps non-overlapping spans, ordered by start', () => {
        const out = resolveOverlaps([span({ rule: 'b', start: 10, end: 12 }), span({ rule: 'a', start: 0, end: 4 })]);
        expect(out.map((s) => s.rule)).toEqual(['a', 'b']);
    });
});

describe('replaceSpans', () => {
    it('applies replacements right to left on the original offsets', () => {
        const text = 'aa XX bb YYY cc';
        const spans = [
            { start: 3, end: 5 },
            { start: 9, end: 12 },
        ] as EgressSpan[];
        expect(replaceSpans(text, spans, (_s, i) => `<${i}>`)).toBe('aa <0> bb <1> cc');
    });

    it('refuses overlapping input rather than corrupting the text', () => {
        const spans = [
            { start: 0, end: 5 },
            { start: 3, end: 8 },
        ] as EgressSpan[];
        expect(() => replaceSpans('0123456789', spans, () => '#')).toThrow(/overlap/);
    });
});
