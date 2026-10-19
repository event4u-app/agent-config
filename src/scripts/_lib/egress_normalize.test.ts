/**
 * Invisible characters and lookalike letters do not hide a value from the table.
 *
 * The two smuggling fixtures are the global-knowledge redaction gate's own;
 * the evasion corpus is built here at runtime and reports a counted miss per
 * mutation rather than a pass, because most of those mutations are beyond any
 * pattern and the number is the honest reading.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { CONFUSABLE_FOREIGN, LATIN_TWIN } from './confusables.js';
import { detectNormalized, HIDDEN_UNICODE_RE, normalizeForDetection } from './egress_normalize.js';
import { detect } from './egress_rules.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const FIXTURES = path.join(REPO, 'tests', 'fixtures', 'global-knowledge-redaction');
const read = (name: string): string => fs.readFileSync(path.join(FIXTURES, name), 'utf8');
const j = (...p: string[]): string => p.join('');

describe('the smuggling fixtures', () => {
    it('the zero-width-broken key is found, and the span covers the disguised bytes', () => {
        // Its address sits at a documentation domain, which the e-mail row excludes by design.
        const text = read('zerowidth-secret.md');
        expect(detect(text).some((s) => s.type === 'APIKEY')).toBe(false);
        const key = detectNormalized(text).find((s) => s.type === 'APIKEY');
        expect(key !== undefined).toBe(true);
        const covered = text.slice(key!.start, key!.end);
        HIDDEN_UNICODE_RE.lastIndex = 0;
        expect(HIDDEN_UNICODE_RE.test(covered) && covered.startsWith('sk-')).toBe(true);
    });

    it('the Cyrillic homoglyph address is found', () => {
        const text = read('homoglyph-email.md');
        expect(detect(text).some((s) => s.type === 'EMAIL')).toBe(false);
        expect(detectNormalized(text).some((s) => s.type === 'EMAIL')).toBe(true);
    });

    it('text with no hidden or confusable character detects exactly as detect()', () => {
        const text = j('mail ', 'jane', '@acme-kunde.de and IBAN ', 'DE89', '3704', '0044', '0532', '0130', '00');
        expect(detectNormalized(text)).toEqual(detect(text));
    });

    it('every Latin twin is a confusable the lint already flags, and normalising counts what it changed', () => {
        for (const cp of LATIN_TWIN.keys()) expect(CONFUSABLE_FOREIGN.has(cp), cp.toString(16)).toBe(true);
        const n = normalizeForDetection('a​bа');
        expect([n.text, n.hidden, n.folded]).toEqual(['aba', 1, 1]);
    });
});

describe('evasion corpus — counted misses per mutation', () => {
    const EMAIL = j('jane.doe', '@acme-kunde.de');
    const IBAN = j('DE89', '3704', '0044', '0532', '0130', '00');
    const mutations: Record<string, (v: string) => string> = {
        'zero-width inside': (v) => `${v.slice(0, 3)}​${v.slice(3)}`,
        'homoglyph letter': (v) => v.replace('a', 'а').replace('e', 'е'),
        'inserted spaces': (v) => v.split('').join(' '),
        'alternate casing': (v) => v.replace(/[a-z]/g, (c, i: number) => (i % 2 ? c.toUpperCase() : c)),
        'line wrapping': (v) => `${v.slice(0, 8)}\n${v.slice(8)}`,
        'code fence': (v) => `\`\`\`\n${v}\n\`\`\``,
        'markdown link': (v) => `[contact](mailto:${v})`,
        'repeated value': (v) => `${v} ${v}`,
        'overlapping value': (v) => `${v}${v}`,
    };

    it('reports misses per mutation, pinned so a change in either direction is seen', () => {
        const misses: Record<string, number> = {};
        for (const [name, mutate] of Object.entries(mutations)) {
            let miss = 0;
            for (const [type, v] of [['EMAIL', EMAIL], ['IBAN', IBAN]] as const) {
                if (!detectNormalized(mutate(v)).some((s) => s.type === type)) miss += 1;
            }
            misses[name] = miss;
        }
        console.log(`egress evasion corpus — misses per mutation (of 2): ${JSON.stringify(misses)}`);
        expect(misses).toEqual({
            'zero-width inside': 0,
            'homoglyph letter': 0,
            'inserted spaces': 2,
            'alternate casing': 0,
            'line wrapping': 2,
            'code fence': 0,
            'markdown link': 0,
            'repeated value': 0,
            'overlapping value': 1,
        });
    });
});
