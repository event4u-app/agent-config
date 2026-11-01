/**
 * road-to-docs-that-sell 1.1 — the site workflows must fire on every path
 * `site/sync-docs.mjs` projects into the site. `docs/guides/works-with-agent-switch.md`
 * is the regression case: it was synced into the site while neither workflow's
 * path filter named it, so a PR breaking it never built the site.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import YAML from 'yaml';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** GitHub path-filter glob → RegExp (`**` crosses `/`, `*` does not). */
function globToRe(glob: string): RegExp {
    const re = glob
        .split('**')
        .map((part) => part.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*'))
        .join('.*');
    return new RegExp(`^${re}$`);
}

function filters(workflow: string, event: 'pull_request' | 'push'): string[] {
    const doc = YAML.parse(fs.readFileSync(path.join(REPO, '.github', 'workflows', workflow), 'utf8')) as {
        on: Record<string, { paths?: string[] } | null>;
    };
    return doc.on[event]?.paths ?? [];
}

const SYNCED = [
    'docs/proof.md',
    'docs/benchmark.md',
    'docs/CLAIMS.md',
    'docs/catalog.md',
    'docs/guides/works-with-agent-switch.md',
    'docs/media/proof-demo.gif',
    'docs/getting-started.md',
];

const CASES: Array<[string, 'pull_request' | 'push']> = [
    ['site.yml', 'pull_request'],
    ['site.yml', 'push'],
    ['deploy-site.yml', 'push'],
];

describe('site workflows see the docs they publish', () => {
    for (const [wf, ev] of CASES) {
        it(`${wf} on ${ev} fires for every synced doc path`, () => {
            const globs = filters(wf, ev).map(globToRe);
            const missed = SYNCED.filter((p) => !globs.some((g) => g.test(p)));
            expect(missed).toEqual([]);
        });
    }

    it('every page the manifest names lives under a filtered root', () => {
        const manifest = path.join(REPO, 'site', 'docs-manifest.json');
        if (!fs.existsSync(manifest)) return; // pre-manifest tree: the fixed list above covers it
        const pages = (JSON.parse(fs.readFileSync(manifest, 'utf8')) as { pages: Array<{ src: string }> }).pages;
        const globs = filters('site.yml', 'pull_request').map(globToRe);
        expect(pages.map((p) => `docs/${p.src}`).filter((p) => !globs.some((g) => g.test(p)))).toEqual([]);
    });
});

/**
 * road-to-docs-that-sell 1.3 — `lint_positioning` runs in rule-backstops.yml and
 * `check_claims` in proof-demo.yml (via internal/demo/proof-demo-commands.sh).
 * Both read README.md, package.json and .github/about.yml, and neither workflow
 * fired on them, so a README-only PR skipped the two README gates.
 */
describe('README-surface PRs run the README gates', () => {
    const SURFACES = ['README.md', 'package.json', '.github/about.yml'];
    for (const wf of ['rule-backstops.yml', 'proof-demo.yml']) {
        for (const ev of ['pull_request', 'push'] as const) {
            it(`${wf} on ${ev} fires for README.md, package.json and .github/about.yml`, () => {
                const globs = filters(wf, ev).map(globToRe);
                expect(SURFACES.filter((p) => !globs.some((g) => g.test(p)))).toEqual([]);
            });
        }
    }
});
