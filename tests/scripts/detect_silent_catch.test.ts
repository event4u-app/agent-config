/**
 * Polarity of the silent-catch detector — BOTH directions, plus the scope.
 *
 * The scope case is the one that matters most and is easiest to lose: the
 * check reads the lines a diff ADDS, and a pre-existing empty catch is debt it
 * does not own. `neg-preexisting-empty-catch` pins that direction; if it ever
 * starts firing, the check has silently become a whole-tree sweep with a
 * false-positive budget nobody measured.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

import { boundName, judgeBody, loadCorpus, scanDiff } from '../../src/scripts/detect_silent_catch.js';

const CORPUS = path.resolve(__dirname, '../fixtures/silent-catch-corpus');
const fixtures = loadCorpus(CORPUS);
const read = (rel: string): string => fs.readFileSync(path.join(CORPUS, rel), 'utf-8');

describe('the corpus itself', () => {
    it('covers both ids with a positive fixture', () => {
        const covered = new Set(fixtures.filter((f) => f.kind === 'positive').flatMap((f) => f.expect));
        expect([...covered].sort()).toEqual(['catch-discards-error', 'catch-empty']);
    });

    it('has not shrunk below the committed floor', () => {
        expect(fixtures.filter((f) => f.kind === 'positive').length).toBeGreaterThanOrEqual(7);
        expect(fixtures.filter((f) => f.kind === 'negative').length).toBeGreaterThanOrEqual(5);
    });
});

describe('sensitivity — every added silent catch fires, with a location', () => {
    for (const f of fixtures.filter((x) => x.kind === 'positive')) {
        it(`fires ${f.expect.join(', ')} on ${f.id}`, () => {
            const found = scanDiff(read(f.diff));
            expect(found.map((x) => x.id).sort()).toEqual([...f.expect].sort());
            for (const finding of found) {
                expect(finding.file).not.toBe('');
                expect(finding.line).toBeGreaterThan(0);
                expect(finding.evidence.trim()).not.toBe('');
            }
        });
    }
});

describe('specificity — a handled error stays silent', () => {
    for (const f of fixtures.filter((x) => x.kind === 'negative')) {
        it(`stays silent on ${f.id}`, () => {
            expect(scanDiff(read(f.diff))).toEqual([]);
        });
    }
});

describe('scope — added lines only', () => {
    it('does not report an empty catch that appears as unchanged context', () => {
        const diff = read('diffs/neg-preexisting-empty-catch.diff');
        expect(diff).toContain('    } catch (err) {');
        expect(diff).toContain('+    metrics.increment');
        expect(scanDiff(diff)).toEqual([]);
    });
});

describe('a comment is not a statement — the one-token evasion does not work', () => {
    it('still reports an empty block carrying an explanatory comment', () => {
        expect(judgeBody('err', ['        // best effort, intentional'])).toBe('catch-empty');
    });

    it('still reports a python block whose only statement is pass with a comment', () => {
        expect(judgeBody(null, ['        pass  # intentional'])).toBe('catch-empty');
    });
});

describe('judgeBody reads the three exits from a catch', () => {
    it('accepts a rethrow', () => {
        expect(judgeBody('err', ['throw new Wrapped(err);'])).toBeNull();
    });

    it('accepts a log', () => {
        expect(judgeBody('err', ["logger.warn('x');"])).toBeNull();
    });

    it('accepts a body that uses the bound value', () => {
        expect(judgeBody('err', ['return { ok: false, error: err };'])).toBeNull();
    });

    it('reports a body that uses none of the three', () => {
        expect(judgeBody('err', ['return null;'])).toBe('catch-discards-error');
    });

    it('does not guess about an unbound catch carrying real statements', () => {
        expect(judgeBody(null, ['return fallback();'])).toBeNull();
    });
});

describe('boundName', () => {
    it('reads a javascript binding', () => {
        expect(boundName('err')).toBe('err');
    });

    it('reads a php binding past its type', () => {
        expect(boundName('\\Throwable $e')).toBe('e');
    });

    it('reads a python as-binding', () => {
        expect(boundName(' ValueError as exc')).toBe('exc');
    });

    it('returns null for an unbound catch', () => {
        expect(boundName('')).toBeNull();
    });
});
