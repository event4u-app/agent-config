// Tests for src/scripts/ai_council/learn_low_impact_preview.ts (py2ts Phase 1).
//
// Preview builder for `/memory learn-low-impact`. Pure parse + redaction +
// render. Covers the bucketing (promoted / refused / already-seeded), the
// provenance-SHA extraction, and the refused-entry `reason()` string that
// threads the redactor's violations through.
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import type {
    RefusedEntry} from '../../../src/scripts/ai_council/learn_low_impact_preview.js';
import {
    LearnLowImpactPreview,
    PACKAGE_SEED_PATH,
    build_preview,
} from '../../../src/scripts/ai_council/learn_low_impact_preview.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');

// A leaked path + an email → both refused by the redactor. Assembled from
// parts so this test file does not embed a literal home path / address that
// trips secret/path linters.
const LEAK_EMAIL = 'admin' + '@' + 'example.com';

function corpus(opts: { upstreamed?: string } = {}): string {
    const lines = [
        '## Validated',
        '',
        '<!-- intake-anchor: validated -->',
        '',
        '- "what port should the dev server use"',
        `- "ping ${LEAK_EMAIL} for access"`,
        '- "already seeded phrase"',
        '',
        '## On Probation',
        '',
        '<!-- intake-anchor: probation -->',
        '',
        '- "x phrase"',
        '',
        '## Anti-Examples (Always Ask User)',
        '',
        '- "delete prod?"',
        '',
    ];
    if (opts.upstreamed !== undefined) {
        lines.push(`last-upstreamed: ${opts.upstreamed}`);
        lines.push('');
    }
    return lines.join('\n');
}

const SEED = [
    '## Validated',
    '',
    '<!-- intake-anchor: validated -->',
    '',
    '- "already seeded phrase"',
    '',
    '## On Probation',
    '',
    '<!-- intake-anchor: probation -->',
    '',
    '- "y"',
    '',
    '## Anti-Examples (Always Ask User)',
    '',
    '- "z?"',
    '',
].join('\n');

function tmpFile(name: string, content: string): string {
    const dir = mkdtempSync(path.join(tmpdir(), 'llip-'));
    const p = path.join(dir, name);
    writeFileSync(p, content, { encoding: 'utf-8' });
    return p;
}

describe('learn_low_impact_preview — bucketing + flags', () => {
    it('promoted / refused / already-seeded split', () => {
        const c = tmpFile('c.md', corpus({ upstreamed: 'abcdef0123456789abcdef0123456789abcdef01' }));
        const s = tmpFile('s.md', SEED);
        const p = build_preview(c, s, { repoSlug: 'acme/widgets' });
        expect(p.promoted.map((e) => e.phrase)).toEqual(['what port should the dev server use']);
        expect(p.refused.map((r) => r.phrase)).toEqual([`ping ${LEAK_EMAIL} for access`]);
        expect([...p.already_seeded]).toEqual(['already seeded phrase']);
        expect(p.last_upstreamed_sha).toBe('abcdef0123456789abcdef0123456789abcdef01');
        // A refusal blocks the PR even though there is a promoted entry.
        expect(p.has_work).toBe(true);
        expect(p.would_open_pr).toBe(false);
    });

    it('missing provenance footer → 40 zeros', () => {
        const c = tmpFile('c.md', corpus());
        const p = build_preview(c, '/no/such/seed.md');
        expect(p.last_upstreamed_sha).toBe('0'.repeat(40));
        // No seed → nothing already-seeded; the clean phrase promotes.
        expect(p.promoted.map((e) => e.phrase)).toContain('what port should the dev server use');
    });

    it('RefusedEntry.reason joins category: snippet', () => {
        const c = tmpFile('c.md', corpus());
        const p = build_preview(c, '/no/such/seed.md');
        const refused = p.refused[0] as RefusedEntry;
        expect(refused.reason()).toBe(`email: ${LEAK_EMAIL}`);
    });

    it('would_open_pr true only when promoted and no refusals', () => {
        const clean = [
            '## Validated',
            '',
            '<!-- intake-anchor: validated -->',
            '',
            '- "a brand new clean validated phrase"',
            '',
            '## On Probation',
            '',
            '<!-- intake-anchor: probation -->',
            '',
            '## Anti-Examples (Always Ask User)',
            '',
            '- "drop everything?"',
            '',
        ].join('\n');
        const p = build_preview(tmpFile('clean.md', clean), '/no/such/seed.md', {
            repoSlug: 'acme/widgets',
        });
        expect(p.would_open_pr).toBe(true);
        expect(p.has_work).toBe(true);
    });

    it('build_preview returns a LearnLowImpactPreview', () => {
        const p = build_preview(tmpFile('c.md', corpus()), '/no/such/seed.md');
        expect(p).toBeInstanceOf(LearnLowImpactPreview);
    });

    // The module docstring and `low-impact-corpus-privacy-floor` both rest on
    // one claim about the tree: the package ships no seed corpus, so every
    // preview diffs against an empty baseline. Asserting the claim rather than
    // the sentence means shipping a seed reds this test instead of silently
    // changing what every preview promotes.
    it('the package seed named by PACKAGE_SEED_PATH is absent from the tree', () => {
        expect(PACKAGE_SEED_PATH).toBe('data/low-impact-decisions-seed.md');
        expect(existsSync(path.join(REPO_ROOT, PACKAGE_SEED_PATH))).toBe(false);
    });

    it('an absent package seed leaves every validated phrase unseeded', () => {
        const p = build_preview(
            tmpFile('absent-seed.md', corpus()),
            path.join(REPO_ROOT, PACKAGE_SEED_PATH),
        );
        expect(p.already_seeded).toEqual([]);
        expect(p.promoted.map((e) => e.phrase)).toContain('already seeded phrase');
    });

    // `--apply` was retired on 2026-10-13: the preview opens nothing, and the
    // one gated outward step is `self-repair:release`. The rendered body is the
    // text a person reads before deciding, so a body still advertising the
    // retired flag would send them to a route that no longer exists.
    // `render()` is the surface the command orders printed VERBATIM, so it is
    // the one place a retired route actually reaches a person. The first
    // version of this file guarded only `render_pr_body()` and the regression
    // shipped green behind it — an independent review found the live
    // `--apply` line still in `render()` one function above the one tested.
    it('the printed preview block advertises no retired --apply route', () => {
        // A CLEAN corpus, deliberately: the retired line sat in the
        // promoted-and-nothing-refused branch, so a corpus carrying a refusal
        // takes the other branch and never reaches it. The first draft of
        // this case used the shared fixture, which does carry one, and passed
        // for that reason rather than on the subject.
        const clean = [
            '## Validated',
            '',
            '<!-- intake-anchor: validated -->',
            '',
            '- "a clean validated phrase for the render branch"',
            '',
            '## On Probation',
            '',
            '<!-- intake-anchor: probation -->',
            '',
            '## Anti-Examples (Always Ask User)',
            '',
            '- "drop everything?"',
            '',
        ].join('\n');
        const p = build_preview(tmpFile('render.md', clean), '/no/such/seed.md', {
            repoSlug: 'acme/widgets',
        });
        expect(p.would_open_pr).toBe(true);

        const block = p.render();
        expect(block).not.toContain('--apply');
        expect(block).toContain('sends nothing');
    });

    it('the rendered body advertises no retired --apply route', () => {
        const p = build_preview(tmpFile('body.md', corpus()), '/no/such/seed.md', {
            repoSlug: 'acme/widgets',
        });
        const body = p.render_pr_body();
        expect(body).not.toContain('--apply');
        expect(body).toContain('/memory learn-low-impact');
        expect(body).toContain('sends nothing');
    });
});
