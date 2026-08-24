/**
 * The recorded findings-parse corpus, pinned.
 *
 * Step 2.4 of `road-to-council-evidence-integrity`. `council_parse_rate` is the
 * human-facing reproducer that prints the rates; this is the same scoring run
 * as a CI assertion, so a change to `_extract_json_array` that silently
 * reclassifies a recorded answer fails here rather than being discovered by a
 * paid re-ask in production.
 *
 * The corpus is NOT live traffic and no rate asserted here may be read as one —
 * `tests/fixtures/council-parse-corpus/README.md` and the `docs/CLAIMS.md` row
 * both state the denominator in the same breath as the number, and so does this
 * file, because a test is exactly where a number gets quoted from without its
 * caveat.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

import { scoreCorpus } from '../../../src/scripts/council_parse_rate.js';

const CORPUS = path.resolve(__dirname, '../../fixtures/council-parse-corpus');

describe('council findings-parse corpus', () => {
    it('holds at least six recorded answers plus its pins', () => {
        const files = fs.readdirSync(CORPUS).filter((f) => f.endsWith('.txt'));
        expect(files.length).toBeGreaterThanOrEqual(6);
        expect(fs.existsSync(path.join(CORPUS, 'expected.json'))).toBe(true);
    });

    it('every fixture resolves to its pinned outcome', () => {
        const expected = JSON.parse(fs.readFileSync(path.join(CORPUS, 'expected.json'), 'utf8')) as Record<string, string>;
        const rows = scoreCorpus(CORPUS);
        expect(rows.length).toBe(Object.keys(expected).length);
        for (const r of rows) {
            expect(expected[r.file], `${r.file} is not pinned in expected.json`).toBeDefined();
            expect(r.outcome, `${r.file} drifted`).toBe(expected[r.file]);
        }
    });

    it('the corpus covers all three outcomes — a corpus missing one proves nothing about separability', () => {
        const outcomes = new Set(scoreCorpus(CORPUS).map((r) => r.outcome));
        expect(outcomes).toContain('parsed');
        expect(outcomes).toContain('empty');
        expect(outcomes).toContain('parse_failed');
    });

    // The shape Phase 2 does NOT close, recorded rather than hidden: an answer
    // whose array parses but whose items lack the required `{id, text}` keys
    // resolves `parsed` with zero findings — indistinguishable in the outcome
    // field from a member that genuinely found nothing. Pinned here so a later
    // phase that closes it has a red test to turn green, and so nobody reads
    // `parsed` as "the findings arrived".
    it('a readable array with no usable items is `parsed` with zero findings — the open case', () => {
        const rows = scoreCorpus(CORPUS);
        const missing = rows.find((r) => r.file === '06-missing-keys.txt');
        expect(missing?.outcome).toBe('parsed');
        expect(missing?.findings).toBe(0);
    });
});
