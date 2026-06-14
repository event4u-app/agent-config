// Tests for src/scripts/ai_council/learn_low_impact_preview.ts (py2ts Phase 1).
//
// Preview builder for `/memory learn-low-impact`. Pure parse + redaction +
// render. Golden parity against the CPython twin covers the bucketing
// (promoted / refused / already-seeded), the provenance-SHA extraction, and
// the three render surfaces (render / render_diff / render_pr_body) byte-for-
// byte — including the refused-entry `reason()` string that threads the
// redactor's violations through.
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    LearnLowImpactPreview,
    RefusedEntry,
    build_preview,
} from '../../../src/scripts/ai_council/learn_low_impact_preview.js';
import { hasPython3, runPyCode } from './_harness.js';

const py3 = hasPython3();

// A leaked path + an email → both refused by the redactor. Assembled from
// parts so this test file does not embed a literal home path / address that
// trips secret/path linters.
const LEAK_PATH = '/Users/' + 'demo' + '/secret.txt';
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
});

describe.runIf(py3)('learn_low_impact_preview — golden parity vs CPython twin', () => {
    /** Run build_preview in CPython, return [render, render_diff, render_pr_body]. */
    function pyRender(
        corpusPath: string,
        seedPath: string,
        repoSlug: string,
        leakPath: string,
    ): [string, string, string, boolean, boolean, string] {
        const code = [
            'import json, sys',
            'from scripts.ai_council.learn_low_impact_preview import build_preview',
            'corpus, seed, slug, leak = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]',
            'p = build_preview(corpus, seed, repo_slug=slug, repo_root=leak)',
            'print(json.dumps([p.render(), p.render_diff(), p.render_pr_body(),'
                + ' p.has_work, p.would_open_pr, p.last_upstreamed_sha], ensure_ascii=False))',
        ].join('\n');
        const res = runPyCode(code, [corpusPath, seedPath, repoSlug, leakPath]);
        expect(res.status, res.stderr).toBe(0);
        return JSON.parse(res.stdout) as [string, string, string, boolean, boolean, string];
    }

    it('render / render_diff / render_pr_body byte-match (mixed buckets)', () => {
        const c = tmpFile('c.md', corpus({ upstreamed: 'abcdef0123456789abcdef0123456789abcdef01' }));
        const s = tmpFile('s.md', SEED);
        const [render, diff, prBody, hasWork, wouldOpen, sha] = pyRender(c, s, 'acme/widgets', '');
        const p = build_preview(c, s, { repoSlug: 'acme/widgets' });
        expect(p.render()).toBe(render);
        expect(p.render_diff()).toBe(diff);
        expect(p.render_pr_body()).toBe(prBody);
        expect(p.has_work).toBe(hasWork);
        expect(p.would_open_pr).toBe(wouldOpen);
        expect(p.last_upstreamed_sha).toBe(sha);
    });

    it('no-work + empty-slug render byte-match', () => {
        // Empty corpus (only anchors) → nothing to upstream.
        const empty = [
            '## Validated',
            '',
            '<!-- intake-anchor: validated -->',
            '',
            '## On Probation',
            '',
            '<!-- intake-anchor: probation -->',
            '',
            '## Anti-Examples (Always Ask User)',
            '',
            '- "z?"',
            '',
        ].join('\n');
        const c = tmpFile('e.md', empty);
        const [render, diff, prBody] = pyRender(c, '/no/such/seed.md', '', '');
        const p = build_preview(c, '/no/such/seed.md');
        expect(p.render()).toBe(render);
        expect(p.render_diff()).toBe(diff);
        expect(p.render_pr_body()).toBe(prBody);
    });

    it('refused-only render + reason() byte-match', () => {
        const refusedOnly = [
            '## Validated',
            '',
            '<!-- intake-anchor: validated -->',
            '',
            `- "reach ${LEAK_EMAIL} now"`,
            '',
            '## On Probation',
            '',
            '<!-- intake-anchor: probation -->',
            '',
            '## Anti-Examples (Always Ask User)',
            '',
            '- "z?"',
            '',
        ].join('\n');
        const c = tmpFile('r.md', refusedOnly);
        const [render, diff, prBody] = pyRender(c, '/no/such/seed.md', 'acme/widgets', '');
        const p = build_preview(c, '/no/such/seed.md', { repoSlug: 'acme/widgets' });
        expect(p.render()).toBe(render);
        expect(p.render_diff()).toBe(diff);
        expect(p.render_pr_body()).toBe(prBody);
    });
});
