// The narrowed `source-header` class, against a labeled corpus.
//
// `road-to-source-silence-cutover` step 3.1, AI council 2026-08-30 (2/2 seats
// present). The council chose option (a) — narrow the heuristic and lower the
// baseline from 243 to 148 — and made a labeled fixture corpus a CONDITION of
// that choice, for a stated reason:
//
//   "The largest glossed-over trust boundary is control of the detector and its
//    baseline. If the same change can redefine 'debt', regenerate the count, and
//    approve the reduction, the ratchet is self-attesting."
//
// So the reduction is only legitimate if the revised detector keeps recall for
// the prohibited behaviour while dropping findings that never represented it.
// That is what these three fixtures test, and the third one is the half that
// matters: a narrowing nobody probed from the positive side is indistinguishable
// from deletion.
//
// ROLLBACK, as the seat specified: revert the matcher and restore the 243
// baseline if a readable external identifier in a `**Source:**` fixture escapes
// detection, if the full-tree count is not reproducibly 148, or if the observed
// 95-item delta contains anything outside the audited `source-header` set.

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    legacySourceHeaderHits,
    readableIdentifierIn,
    sourceHeaderHits,
} from '../../src/scripts/_lib/source_shape.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(HERE, '..', 'fixtures', 'source-headers');

/** Every `**Source:**` line in a fixture, with its 1-based line number. */
function headerLines(name: string): { line: string; n: number }[] {
    const raw = fs.readFileSync(path.join(FIXTURES, `${name}.md`), 'utf8');
    return raw
        .split('\n')
        .map((line, i) => ({ line, n: i + 1 }))
        // Only real header LINES: the explanatory HTML comment at the top of
        // each fixture mentions `**Source:**` in prose, and counting it would
        // make the corpus one case larger than the fixture actually declares.
        .filter((e) => /^>\s*\*\*Source\*?\*?:/.test(e.line));
}

describe('compliant.md — anonymised headers score ZERO', () => {
    const cases = headerLines('compliant');

    it('has a non-trivial corpus', () => {
        // A fixture file that stopped matching would make every assertion below
        // vacuously true — the "gate that scans nothing exits green" shape.
        expect(cases.length).toBeGreaterThanOrEqual(8);
    });

    it.each(cases)('does not flag: $line', ({ line }) => {
        expect(sourceHeaderHits(line)).toEqual([]);
    });

    it('is exactly what the OLD detector flagged — which is the whole finding', () => {
        // Every one of these scored under the pre-narrowing predicate. Six of
        // the tracked-tree findings were the anonymisation notice itself, so the
        // detector was reporting adherence to `source-confidentiality` as debt.
        const flaggedByLegacy = cases.filter((c) => legacySourceHeaderHits(c.line).length > 0);
        expect(flaggedByLegacy.length).toBe(cases.length);
    });
});

describe('internal-ref.md — headers pointing inside this repo score ZERO', () => {
    const cases = headerLines('internal-ref');

    it('has a non-trivial corpus', () => {
        expect(cases.length).toBeGreaterThanOrEqual(8);
    });

    it.each(cases)('does not flag: $line', ({ line }) => {
        expect(sourceHeaderHits(line)).toEqual([]);
    });

    it('includes the two strings that made the FIRST narrowed matcher over-report', () => {
        // `.agent-src.uncondensed/rules/…` yielded `uncondensed/rules` and
        // `packages/installer/src/…` yielded `installer/src`: two path segments
        // side by side look exactly like a repository slug, and the difference
        // is entirely in what surrounds them. Pinned here because the first
        // full-tree run produced 150 rather than 148 on precisely these, and a
        // fix with no test is a fix that comes back.
        expect(readableIdentifierIn('`.agent-src.uncondensed/rules/autonomous-execution.md`')).toBeNull();
        expect(readableIdentifierIn('packages/installer/src/index.ts')).toBeNull();
    });
});

describe('leaking.md — headers naming something a reader could look up MUST flag', () => {
    const cases = headerLines('leaking');

    it('has a non-trivial corpus', () => {
        expect(cases.length).toBeGreaterThanOrEqual(5);
    });

    it.each(cases)('flags: $line', ({ line }) => {
        const hits = sourceHeaderHits(line);
        expect(hits.length, 'a readable identifier must be detected').toBeGreaterThan(0);
        expect(hits[0]?.cls).toBe('source-header');
        // The reported value is the IDENTIFIER, not the whole header — a finding
        // should name the thing that leaked.
        expect((hits[0]?.value ?? '').length).toBeGreaterThan(0);
        expect(hits[0]?.value).not.toContain('**Source');
    });

    // removing_this_constraint_reds_it: make `readableIdentifierIn` return null
    // unconditionally — every case in this block reds and the other two stay
    // green, which is the asymmetry that separates a narrowing from a deletion.

    it('covers all three identifier shapes the grammar recognises', () => {
        expect(readableIdentifierIn('somevendor/some-agent-suite')).toBe('somevendor/some-agent-suite');
        expect(readableIdentifierIn('see https://not-a-real-vendor.dev/blog/x')).toBe(
            'not-a-real-vendor.dev',
        );
        expect(readableIdentifierIn('the @notreal-scope/agent-kit package')).toBe(
            '@notreal-scope/agent-kit',
        );
    });
});

describe('the grammar itself', () => {
    it('does not treat a bare date, version or prose as an identifier', () => {
        for (const value of [
            'external adversarial review of 9.8.0',
            'AI council on guard severity (anthropic + openai, 2026-08-12)',
            'a 50-session review run on 2026-08-22 over the transcripts',
            'maintainer handover 2026-08-21',
            'Items carried over from completed roadmaps',
        ]) {
            expect(readableIdentifierIn(value), value).toBeNull();
        }
    });

    it('keeps the allowlist meaning it already had', () => {
        // `ALLOWED_OWNERS` is a precision guard for a URL host pattern, and the
        // narrowed grammar reuses it rather than growing a second list — a
        // second list is how an exemption register starts.
        // The own-org owner is `event4u-app`, which is what `ALLOWED_OWNERS`
        // carries — `event4u/…` is a different owner and correctly flags.
        expect(readableIdentifierIn('event4u-app/agent-config')).toBeNull();
    });

    it('the legacy predicate still exists and still flags broadly', () => {
        // Shadow metric, a council condition: kept until a subsequent
        // corpus-changing release has passed both detectors. It gates nothing.
        expect(legacySourceHeaderHits('> **Source:** an external analysis session')).toHaveLength(1);
        expect(sourceHeaderHits('> **Source:** an external analysis session')).toEqual([]);
    });
});
