/**
 * The enforcement surface for the frontend benchmark corpus (step 0.2).
 *
 * `frontend_corpus_hash.ts` is deliberately not a CI gate; this file is what
 * makes the frozen population real. An edit to a case without a rehash fails
 * here rather than silently moving the population under an already-published
 * number.
 */
import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
    CORPUS_ROOT,
    MANIFEST_NAME,
    buildManifest,
    corpusDigest,
    manifestText,
    walk,
} from '../../src/scripts/frontend_corpus_hash.js';

const manifestPath = path.join(CORPUS_ROOT, MANIFEST_NAME);

describe('frontend corpus manifest', () => {
    it('matches the committed CORPUS.sha256 byte-for-byte', () => {
        expect(fs.existsSync(manifestPath)).toBe(true);
        expect(fs.readFileSync(manifestPath, 'utf8')).toBe(buildManifest());
    });

    it('carries a rolling digest a published number can cite', () => {
        expect(corpusDigest(fs.readFileSync(manifestPath, 'utf8'))).toMatch(/^[0-9a-f]{64}$/);
    });

    it('is order-independent of filesystem readdir order', () => {
        // The digest folds a SORTED line list, so shuffling the input pairs must
        // not move it. Asserting this on the pure core rather than on disk is the
        // only way to exercise the ordering guarantee without a second checkout.
        const pairs: ReadonlyArray<readonly [string, Buffer]> = [
            ['b.txt', Buffer.from('two')],
            ['a.txt', Buffer.from('one')],
        ];
        const forward = manifestText([...pairs].sort((x, y) => x[0].localeCompare(y[0])));
        const reverse = manifestText([...pairs].sort((x, y) => y[0].localeCompare(x[0])));
        expect(corpusDigest(forward)).not.toBe(corpusDigest(reverse));
        // …and the walk is what supplies sorted order to buildManifest.
        const walked = walk(CORPUS_ROOT, 'cases');
        expect(walked).toStrictEqual([...walked].sort());
    });

    it('excludes the manifest from its own hash', () => {
        expect(walk(CORPUS_ROOT)).not.toContain(MANIFEST_NAME);
    });
});

describe('frontend corpus population', () => {
    const cases = fs.readdirSync(path.join(CORPUS_ROOT, 'cases')).sort();
    const nearMiss = fs.readdirSync(path.join(CORPUS_ROOT, 'near-miss')).sort();

    it('carries the twenty cases step 0.2 enumerates', () => {
        expect(cases).toHaveLength(20);
    });

    it('carries the three near-miss fixtures step 0.2 names', () => {
        expect(nearMiss).toStrictEqual([
            'artifact-source-not-rederived',
            'refine-preserves-world',
            'surface-mode-not-product-mode',
        ]);
    });

    it.each([...cases, ...nearMiss])('%s declares a full authority label set', (id) => {
        const dir = fs.existsSync(path.join(CORPUS_ROOT, 'cases', id))
            ? path.join(CORPUS_ROOT, 'cases', id)
            : path.join(CORPUS_ROOT, 'near-miss', id);
        const y = fs.readFileSync(path.join(dir, 'case.yaml'), 'utf8');
        expect(y).toMatch(/^ {2}surface_mode: (persuade|operate|read|experience)$/m);
        expect(y).toMatch(/^ {2}register: (brand|product)$/m);
        expect(y).toMatch(/^ {2}change_intent: (preserve|extend|redesign|new-world)$/m);
        expect(y).toMatch(
            /^ {2}reference_maturity: (wireframe|prototype|finished-comp|runnable-artifact|production-incumbent|null)$/m,
        );
        // Every file the case declares must exist — a label set pointing at a
        // missing fixture is the failure mode a hash cannot catch.
        for (const f of y.matchAll(/^ {2}- (.+)$/gm)) {
            expect(fs.existsSync(path.join(dir, f[1]))).toBe(true);
        }
    });

    it('covers every reference_maturity value the contract admits except prototype', () => {
        // `prototype` is deliberately absent: no case in step 0.2's enumeration is
        // a prototype handover, and inventing one to fill a column would be a
        // fixture authored to a table rather than to a real request shape.
        const seen = new Set(
            [...cases, ...nearMiss].map((id) => {
                const dir = fs.existsSync(path.join(CORPUS_ROOT, 'cases', id))
                    ? path.join(CORPUS_ROOT, 'cases', id)
                    : path.join(CORPUS_ROOT, 'near-miss', id);
                return /^ {2}reference_maturity: (\S+)$/m.exec(
                    fs.readFileSync(path.join(dir, 'case.yaml'), 'utf8'),
                )![1];
            }),
        );
        expect([...seen].sort()).toStrictEqual([
            'finished-comp',
            'null',
            'production-incumbent',
            'runnable-artifact',
            'wireframe',
        ]);
    });
});
