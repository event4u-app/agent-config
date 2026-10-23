/**
 * The two stores that keep text tag a genuine identifier whether or not a
 * context word stands next to it. Values are assembled at runtime and compared
 * by boolean, so a failure never prints one.
 */
import { describe, expect, it } from 'vitest';

import { redact as ingestRedact } from '../../src/cli/python/knowledge_ingest.js';
import { redact as crossRepoRedact } from '../../src/scripts/cross_repo_retrieve.js';

const j = (...p: string[]): string => p.join('');
const CASES: ReadonlyArray<readonly [string, string, string]> = [
    ['card, no card word', j('Account: ', '4111', '1111', '1111', '1111'), 'CC'],
    ['national phone, no phone word', j('reach the desk at 030 ', '1234 5678'), 'PHONE'],
    ['US phone, no phone word', j('desk ', '212-555-', '0142'), 'PHONE'],
    ['IBAN', j('IBAN ', 'DE89', '3704', '0044', '0532', '0130', '00'), 'IBAN'],
    ['SSN', j('file ', '123-', '45-', '6789'), 'SSN'],
    ['e-mail at a .md domain', j('write ', 'person', '@company.md'), 'EMAIL'],
    ['German tax ID, no tax word', j('ref ', '8609', '5742', '719'), 'TAXID'],
];

describe.each([
    ['knowledge_ingest', (t: string, c: Record<string, number>) => ingestRedact(t, c)[0]],
    ['cross_repo_retrieve', (t: string, c: Record<string, number>) => crossRepoRedact(t, c)[0]],
] as const)('%s redacts before it stores', (_name, redact) => {
    it.each(CASES)('%s', (_label, text, tag) => {
        const counters: Record<string, number> = {};
        const out = redact(text, counters);
        expect(out.includes(`[${tag}]`)).toBe(true);
        expect(counters[tag]).toBe(1);
    });

    it('leaves a number that fails its checksum, and ordinary prose, alone', () => {
        const counters: Record<string, number> = {};
        const text = j('build 1760912000000 shipped; see README.md and v2.3.4');
        expect(redact(text, counters) === text).toBe(true);
        expect(counters).toEqual({});
    });
});

/**
 * Curated compatibility with the phone regex the two stores carried before the
 * table (frozen verbatim): each listed phone shape it tagged is still tagged by
 * both stores, and the listed shapes it tagged that are not phone numbers are
 * deliberate losses. A sample of its input space, not an exhaustive differential.
 */
const LEGACY_PHONE = new RegExp(
    '(?:(?<=\\s)|(?<=^))' +
        '(?:\\+?\\d{1,3}[\\s.\\-]?)?' +
        '(?:\\(\\d{2,4}\\)[\\s.\\-]?|\\d{2,4}[\\s.\\-])' +
        '\\d{2,4}[\\s.\\-]?\\d{2,4}(?:[\\s.\\-]?\\d{2,4})?',
    'gm',
);
const legacyTags = (text: string): boolean => {
    LEGACY_PHONE.lastIndex = 0;
    return LEGACY_PHONE.test(text);
};

describe('phone parity with the legacy store regex', () => {
    const PHONES = [
        j('212-555-', '0142'),
        j('212.555.', '0142'),
        j('212 555 ', '0142'),
        j('(212) 555-', '0142'),
        j('(212)555-', '0142'),
        j('1-212-555-', '0142'),
        j('1 212 555 ', '0142'),
        j('+1 212 555 ', '0142'),
        j('+1-212-555-', '0142'),
        j('+49 30 ', '1234 5678'),
        j('+49 (30) ', '1234 5678'),
        j('+44 20 ', '7946 0958'),
        j('030 ', '1234 5678'),
        j('030-', '1234-5678'),
        j('(030) ', '1234 5678'),
        j('0221 ', '987 6543'),
    ];
    it.each(PHONES)('%s — tagged by the legacy regex and by both stores', (v) => {
        const text = `x ${v}`;
        expect(legacyTags(text)).toBe(true);
        for (const redact of [ingestRedact, crossRepoRedact]) {
            const counters: Record<string, number> = {};
            redact(text, counters);
            expect(counters['PHONE'], v).toBe(1);
        }
    });

    it('compact US numbers tag only next to a phone word: a bare 10-digit int is not a phone', () => {
        for (const v of [j('212555', '0142'), j('1212555', '0142')]) {
            expect(legacyTags(`x ${v}`)).toBe(false);
            for (const redact of [ingestRedact, crossRepoRedact]) {
                const bare: Record<string, number> = {};
                redact(`x ${v}`, bare);
                expect(bare['PHONE'], v).toBeUndefined();
                const worded: Record<string, number> = {};
                redact(`call ${v}`, worded);
                expect(worded['PHONE'], v).toBe(1);
            }
        }
    });

    it('deliberate losses: shapes the legacy regex tagged that are not phone numbers', () => {
        for (const v of ['2026-10-19', '10.20.30', '1999 2000 2001']) {
            expect(legacyTags(`x ${v}`), v).toBe(true);
            for (const redact of [ingestRedact, crossRepoRedact]) {
                const counters: Record<string, number> = {};
                redact(`x ${v}`, counters);
                expect(counters['PHONE'], v).toBeUndefined();
            }
        }
    });
});


/**
 * Store-rule precision (road-to-a-tick-the-shipped-path-earns 4.4): shapes the
 * tree carries in ordinary code that the context-free store rows tagged.
 */
describe('store rows leave code-shaped digits alone', () => {
    const HEX = 'a3f9c2e1b07d4f6e8a2c';
    const UNTOUCHED: ReadonlyArray<readonly [string, string]> = [
        ['int32 max', j('const MAX = ', '2147', '483647', ';')],
        ['int32 max, bare', j('2147', '483647')],
        ['dotted quad after a plus', j('route ', '+192', '.168', '.100', '.200')],
        ['dotted quad on a diff line', j('@@ -1 +1 @@\n-127.0.0.1\n', '+192', '.168', '.100', '.200', '\n')],
        ['digit-led hex SHA, card-shaped head', j('4111', '1111', '1111', '1111', HEX)],
        ['digit-led hex SHA, phone-shaped head', j('0301', '2345', '67', HEX)],
        ['digit-led hex SHA, US-shaped head', j('2125', '5501', '42', HEX)],
        ['digit-led hex SHA after a commit word', j('commit ', '4111', '1111', '1111', '1111', HEX, ' fixes it')],
        ['digits ending a hex token', j(HEX, '4111', '1111', '1111', '1111')],
        ['a decimal fraction', j('y = 0.', '0514', '4599', '29', ' * b')],
        ['a slash list of record numbers', j('ADR-', '046/', '047/', '048')],
        ['an abbreviated diff index line', j('index ', 'ed2a931e0..', '0705', '6353', '1 100644')],
    ];
    describe.each([
        ['knowledge_ingest', (t: string, c: Record<string, number>) => ingestRedact(t, c)[0]],
        ['cross_repo_retrieve', (t: string, c: Record<string, number>) => crossRepoRedact(t, c)[0]],
    ] as const)('%s', (_name, redact) => {
        it.each(UNTOUCHED)('%s', (_label, text) => {
            const counters: Record<string, number> = {};
            expect(redact(text, counters) === text).toBe(true);
            expect(counters).toEqual({});
        });

        it('a grouped international number on a diff line is still a phone', () => {
            const counters: Record<string, number> = {};
            redact(j('@@ -1 +1 @@\n', '+49 30 ', '1234 5678', '\n'), counters);
            expect(counters['PHONE']).toBe(1);
        });
    });
});
