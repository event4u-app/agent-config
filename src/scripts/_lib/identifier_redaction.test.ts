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
