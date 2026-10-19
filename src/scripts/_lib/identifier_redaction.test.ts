/**
 * The two stores that keep text tag a genuine identifier whether or not a
 * context word stands next to it. Values are assembled at runtime and compared
 * by boolean, so a failure never prints one.
 */
import { describe, expect, it } from 'vitest';

import { redact as ingestRedact } from '../../cli/python/knowledge_ingest.js';
import { redact as crossRepoRedact } from '../cross_repo_retrieve.js';

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
 * Differential parity with the phone regex the two stores carried before the
 * table (frozen verbatim). Every phone-shaped value it tagged is still tagged;
 * the shapes it tagged that are not phone numbers are listed as deliberate losses.
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

    it('compact US numbers, which the legacy regex never tagged, are tagged now', () => {
        for (const v of [j('212555', '0142'), j('1212555', '0142')]) {
            expect(legacyTags(`x ${v}`)).toBe(false);
            const counters: Record<string, number> = {};
            ingestRedact(`x ${v}`, counters);
            expect(counters['PHONE'], v).toBe(1);
        }
    });

    it('deliberate losses: shapes the legacy regex tagged that are not phone numbers', () => {
        for (const v of ['2026-10-19', '10.20.30', '1999 2000 2001']) {
            expect(legacyTags(`x ${v}`), v).toBe(true);
            const counters: Record<string, number> = {};
            ingestRedact(`x ${v}`, counters);
            expect(counters['PHONE'], v).toBeUndefined();
        }
    });
});

