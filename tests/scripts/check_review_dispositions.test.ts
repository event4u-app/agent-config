/**
 * Archived-review disposition check (contract §2.7).
 *
 * The regression that motivates this file is this repo's own: five findings in
 * `postmerge-blindpass-review.md` sat recorded as `open` for a day after two of
 * them were already fixed. The record had been renamed out of the
 * `*.findings.md` glob, so `check_completion_review` never looked at it and
 * nothing else did either. Every case below is anchored to that failure.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { checkRecord, isArchivedRecord, main } from '../../src/scripts/check_review_dispositions.js';

const REPO = path.resolve(__dirname, '../..');

function record(rows: string): string {
    return [
        '# Round review',
        '',
        '| # | Severity | File:line | Finding | Status | Reason/Ref |',
        '|---|---|---|---|---|---|',
        rows,
        '',
    ].join('\n');
}

function withReviews(files: Record<string, string>, run: (root: string, repo: string) => void): void {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'disp-'));
    const root = path.join('agents', 'evidence', 'reviews');
    fs.mkdirSync(path.join(repo, root), { recursive: true });
    for (const [name, body] of Object.entries(files)) {
        fs.writeFileSync(path.join(repo, root, name), body);
    }
    try {
        run(root, repo);
    } finally {
        fs.rmSync(repo, { recursive: true, force: true });
    }
}

describe('isArchivedRecord — which files this gate owns', () => {
    it('claims a renamed round record', () => {
        expect(isArchivedRecord('agents/evidence/reviews/round4-review.md')).toBe(true);
    });

    it('does NOT claim a live artefact — that is check_completion_review territory', () => {
        // The two gates must not both own one file: a live `open` row is legal
        // and is exactly what R2 is meant to surface to the reviewer.
        expect(isArchivedRecord('agents/evidence/reviews/scope-abc.findings.md')).toBe(false);
    });

    it('ignores unrelated files in the reviews root', () => {
        expect(isArchivedRecord('agents/evidence/reviews/README.md')).toBe(false);
        expect(isArchivedRecord('agents/evidence/reviews/prompt.md')).toBe(false);
    });
});

describe('checkRecord — the observed failure mode', () => {
    it('blocks an `open` row in an archived record (the blind-pass regression)', () => {
        const text = record('| 1 | major | a.ts:1 | thing | open | — |');
        const v = checkRecord('r-review.md', text, { repo: REPO });
        expect(v).toHaveLength(1);
        expect(v[0]?.kind).toBe('open-in-archived-record');
    });

    it('blocks EVERY open row, not just the first — the real slip had two', () => {
        const text = record(
            ['| 1 | major | a.ts:1 | one | open | — |', '| 2 | minor | b.ts:2 | two | open | — |'].join('\n'),
        );
        expect(checkRecord('r-review.md', text, { repo: REPO })).toHaveLength(2);
    });

    it('accepts the three terminal statuses', () => {
        const text = record(
            [
                '| 1 | major | a.ts:1 | one | fixed | 1234abc — did the thing |',
                '| 2 | minor | b.ts:2 | two | accepted-risk | cost outweighs benefit |',
                '| 3 | minor | c.ts:3 | three | deferred | carrier roadmap x |',
            ].join('\n'),
        );
        expect(checkRecord('r-review.md', text, { repo: REPO })).toEqual([]);
    });

    it('blocks an unknown status rather than treating it as terminal', () => {
        // `wontfix` is not in the §2.2 vocabulary. Silently accepting anything
        // non-`open` would make the vocabulary opt-out.
        const text = record('| 1 | major | a.ts:1 | thing | wontfix | because |');
        const v = checkRecord('r-review.md', text, { repo: REPO });
        expect(v).toHaveLength(1);
        expect(v[0]?.kind).toBe('bad-status');
    });

    it('blocks a terminal row whose Reason/Ref is empty', () => {
        const text = record('| 1 | major | a.ts:1 | thing | deferred |  |');
        const v = checkRecord('r-review.md', text, { repo: REPO });
        expect(v).toHaveLength(1);
        expect(v[0]?.kind).toBe('missing-reference');
    });

    it('does NOT grade the reference beyond non-empty', () => {
        // Measured decision, not a preference: shape-checking the reference
        // produced 8 unfixable blocks on frozen records. See the module header.
        const text = record('| 1 | major | a.ts:1 | thing | fixed | prose describing the change, no sha |');
        expect(checkRecord('r-review.md', text, { repo: REPO })).toEqual([]);
    });
});

describe('main — scope and exit contract', () => {
    it('passes on a clean scope and reports what it read', () => {
        withReviews({ 'a-review.md': record('| 1 | major | a.ts:1 | x | fixed | abc — done |') }, (root, repo) => {
            expect(main(['--repo', repo, '--reviews-root', root, '--quiet'])).toBe(0);
        });
    });

    it('exits 1 on a violation', () => {
        withReviews({ 'a-review.md': record('| 1 | major | a.ts:1 | x | open | — |') }, (root, repo) => {
            expect(main(['--repo', repo, '--reviews-root', root, '--quiet'])).toBe(1);
        });
    });

    it('skips live `.findings.md` artefacts even when they carry open rows', () => {
        withReviews({ 'a.findings.md': record('| 1 | major | a.ts:1 | x | open | — |') }, (root, repo) => {
            // Scope is now empty, which is a DEAD SCOPE (exit 1) — but crucially
            // NOT an `open-in-archived-record` block against a live artefact.
            expect(main(['--repo', repo, '--reviews-root', root, '--quiet'])).toBe(1);
        });
    });

    it('treats a dead scan scope as a POLICY violation, never a silent pass', () => {
        // exit 2 is warn-and-allow at every call site (§6/§7.0), so a moved
        // reviews root must not be reportable as an internal error.
        withReviews({}, (root, repo) => {
            expect(main(['--repo', repo, '--reviews-root', root, '--quiet'])).toBe(1);
        });
    });

    it('passes against the REAL corpus', () => {
        // The corpus is already terminal, so a failure here is a finding about
        // this checker, not about the corpus.
        expect(main(['--repo', REPO, '--quiet'])).toBe(0);
    });
});
