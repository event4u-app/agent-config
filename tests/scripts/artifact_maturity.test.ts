/**
 * `spec.maturity` resolution — the artefact-maturity axis as a field.
 *
 * The verify clause of `road-to-design-intent-conformance` 3.1 names two cases
 * by hand: a wireframe fixture resolves `low` and a runnable-artifact fixture
 * resolves `finished`, **both with the signal that decided it**. Those two run
 * against the real files on disk rather than against strings, because a
 * resolver that works on a hand-written snippet and not on the committed
 * artefact is a resolver nothing uses.
 *
 * The rest pin the ladder's ORDER, which is the part a later edit can silently
 * invert: user beats declaration beats inference beats default, and the default
 * is `finished` because the rule says silence is not a licence to redesign.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
    isGreyscaleOnly,
    mapReferenceMaturity,
    resolveArtifactMaturity,
} from '../../src/scripts/_lib/artifact_maturity.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const FIXTURES = path.join(REPO_ROOT, 'tests', 'design-artifacts', 'fixtures');

function fixture(name: string): string {
    return fs.readFileSync(path.join(FIXTURES, name), 'utf-8');
}

describe('the two cases 3.1 names by hand', () => {
    it('the wireframe fixture resolves low, and names what decided it', () => {
        const v = resolveArtifactMaturity({
            filename: 'wireframe.html',
            body: fixture('wireframe.html'),
        });
        expect(v.maturity).toBe('low');
        expect(v.signal).not.toBe('');
        // The signal must be a fact about the artefact, not a restatement of
        // the verdict — "it is low fidelity" would pass a non-empty check and
        // tell the reader nothing.
        expect(v.signal).toMatch(/wireframe|lorem|placeholder|greyscale/i);
    });

    it('the runnable-artifact fixture resolves finished, and names what decided it', () => {
        const v = resolveArtifactMaturity({
            filename: 'design.html',
            body: fixture('design.html'),
            referenceMaturity: 'runnable-artifact',
        });
        expect(v.maturity).toBe('finished');
        expect(v.signal).toContain('runnable-artifact');
    });

    // The harder half of the same case: the committed finished artefact must
    // resolve `finished` on its CONTENT alone, with no upstream label to lean
    // on. A resolver that only works when told the answer is not a resolver.
    it('the finished fixture resolves finished with no reference label at all', () => {
        const v = resolveArtifactMaturity({
            filename: 'design.html',
            body: fixture('design.html'),
        });
        expect(v.maturity).toBe('finished');
    });
});

describe('the tells that must NOT fire', () => {
    // Regression, found by running the resolver against the committed finished
    // fixture rather than against a hand-written snippet: a bare
    // `\bplaceholder\b` fired on `<input placeholder="you@example.com">`,
    // which is ordinary markup present in most real forms. The tell is the
    // artefact calling its own CONTENT placeholder.
    it('an HTML placeholder attribute is not a low-fidelity tell', () => {
        const v = resolveArtifactMaturity({
            body: '<input type="email" placeholder="you@example.com"> <p>Sign up today.</p>',
        });
        expect(v.maturity).toBe('finished');
    });

    it('but prose calling the content placeholder still is', () => {
        const v = resolveArtifactMaturity({ body: 'All images here are placeholder art.' });
        expect(v.maturity).toBe('low');
    });
});

describe('the resolution ladder, in order', () => {
    it('a user signal beats a contrary declaration', () => {
        const v = resolveArtifactMaturity({ userSignal: 'finished', declared: 'wireframe' });
        expect(v.maturity).toBe('finished');
        expect(v.source).toBe('user');
    });

    it('a declaration beats a contrary inference', () => {
        const v = resolveArtifactMaturity({
            declared: 'finished',
            filename: 'checkout-wireframe.html',
            body: 'Lorem ipsum',
        });
        expect(v.maturity).toBe('finished');
        expect(v.source).toBe('declaration');
    });

    it('an inference beats the default', () => {
        const v = resolveArtifactMaturity({ body: 'Lorem ipsum dolor sit amet' });
        expect(v.maturity).toBe('low');
        expect(v.source).toBe('inference');
    });

    // The clause the rule states in as many words. Guessing `low` here would
    // authorise exactly the redesign the rule exists to prevent.
    it('an undeclared, tell-free artefact defaults to finished', () => {
        const v = resolveArtifactMaturity({ body: '<h1>Pricing</h1><p>Three plans.</p>' });
        expect(v.maturity).toBe('finished');
        expect(v.source).toBe('default');
    });

    it('an empty input defaults to finished rather than throwing', () => {
        expect(resolveArtifactMaturity().maturity).toBe('finished');
    });

    // An unreadable declaration is reported, not silently dropped to inference.
    it('an unrecognised declaration says so instead of guessing', () => {
        const v = resolveArtifactMaturity({ declared: 'medium-ish' });
        expect(v.maturity).toBe('finished');
        expect(v.signal).toContain('medium-ish');
    });
});

describe('mapReferenceMaturity — the one seam between the two enums', () => {
    it('maps the values that decide the question', () => {
        expect(mapReferenceMaturity('wireframe')).toBe('low');
        expect(mapReferenceMaturity('finished-comp')).toBe('finished');
        expect(mapReferenceMaturity('runnable-artifact')).toBe('finished');
        expect(mapReferenceMaturity('production-incumbent')).toBe('finished');
    });

    // Deliberate, and pinned so a later edit has to argue with it: the word
    // covers both a greybox click-through and a pixel-complete build, so
    // mapping it either way decides by vocabulary rather than by evidence.
    it('leaves `prototype` undecided so inference reads the artefact instead', () => {
        expect(mapReferenceMaturity('prototype')).toBeNull();
    });

    it('leaves an absent or unknown value undecided', () => {
        expect(mapReferenceMaturity(null)).toBeNull();
        expect(mapReferenceMaturity('something-else')).toBeNull();
    });
});

describe('isGreyscaleOnly', () => {
    it('accepts a palette where every channel triple is equal', () => {
        expect(isGreyscaleOnly('#fff #333333 #cccccc')).toBe(true);
    });

    it('rejects a palette carrying one real colour', () => {
        expect(isGreyscaleOnly('#fff #333333 #3b82f6')).toBe(false);
    });

    // A single stray `#fff` in an otherwise colourless file decides nothing —
    // without this floor every token file with one neutral would read as a
    // wireframe.
    it('needs at least two colours before it decides anything', () => {
        expect(isGreyscaleOnly('#ffffff')).toBe(false);
        expect(isGreyscaleOnly('no colours here at all')).toBe(false);
    });
});
