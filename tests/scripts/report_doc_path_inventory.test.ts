/**
 * road-to-docs-that-sell 1.5 — the doc-path inventory: extraction shape,
 * existing-vs-absent split, and byte-identical regeneration.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    REPO,
    REPORT_REL,
    build,
    collectReferences,
    extractDocPaths,
    render,
} from '../../src/scripts/report_doc_path_inventory.js';

describe('extractDocPaths', () => {
    it('finds root docs, docs/ files and site content, and nothing nested elsewhere', () => {
        const text = [
            "const a = 'README.md';",
            'see docs/contracts/x.md and docs/comparison.yaml',
            'site/src/content/docs/index.mdx',
            'agents/roadmaps/README.md is not a root doc',
            'src/docs/inner.md is not under docs/',
        ].join('\n');
        expect(extractDocPaths(text).sort()).toEqual([
            'README.md',
            'docs/comparison.yaml',
            'docs/contracts/x.md',
            'site/src/content/docs/index.mdx',
        ]);
    });
});

describe('collectReferences + render', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'docinv-'));
        const w = (rel: string, body: string): void => {
            fs.mkdirSync(path.dirname(path.join(tmp, rel)), { recursive: true });
            fs.writeFileSync(path.join(tmp, rel), body);
        };
        w('docs/real.md', '# real\n');
        w('src/scripts/a.ts', "const P = 'docs/real.md'; const Q = 'docs/gone.md';\n");
        w('tests/b.test.ts', "read('docs/real.md'); read('docs/fixture-only.md');\n");
        w('tests/contracts/c.test.ts', "read('docs/real.md');\n");
    });
    afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

    it('maps each path to its sorted referrers', () => {
        const refs = collectReferences(tmp, ['src/scripts', 'tests']);
        expect(refs.get('docs/real.md')).toEqual(['src/scripts/a.ts', 'tests/b.test.ts', 'tests/contracts/c.test.ts']);
    });

    it('lists stale live references but omits test-only fixtures', () => {
        const md = render(collectReferences(tmp, ['src/scripts', 'tests']), {
            updateCountsTargets: ['docs/real.md'],
            supervisionPublicSurfaces: [],
            roleDocs: [],
        }, tmp);
        expect(md).toContain('- `docs/gone.md` — `src/scripts/a.ts`');
        expect(md).not.toContain('fixture-only');
        expect(md).toContain('- `docs/real.md` — `tests/contracts/c.test.ts`');
        expect(md).toContain('- `docs/real.md` (3) —');
    });

    it('treats a git-ignored file as absent, so a local build cannot change the report', () => {
        spawnSync('git', ['init', '-q'], { cwd: tmp });
        fs.writeFileSync(path.join(tmp, '.gitignore'), 'docs/gone.md\n');
        fs.writeFileSync(path.join(tmp, 'docs/gone.md'), '# generated locally\n');
        const md = render(collectReferences(tmp, ['src/scripts', 'tests']), {
            updateCountsTargets: [],
            supervisionPublicSurfaces: [],
            roleDocs: [],
        }, tmp);
        expect(md).toContain('- `docs/gone.md` — `src/scripts/a.ts`');
        expect(md).toContain('- 1 existing doc path(s) named');
    });

    it('counts an absent ADR-shaped probe path instead of listing it as a citation', () => {
        fs.writeFileSync(path.join(tmp, 'src/scripts/probe.ts'), "const P = 'docs/decisions/ADR-901-probe.md';\n");
        const md = render(collectReferences(tmp, ['src/scripts', 'tests']), {
            updateCountsTargets: [],
            supervisionPublicSurfaces: [],
            roleDocs: [],
        }, tmp);
        expect(md).not.toMatch(/ADR-901/);
        expect(md).toContain('- 1 absent ADR-shaped path(s) named outside tests');
        expect(md).toContain('- `docs/gone.md` — `src/scripts/a.ts`');
    });
});

describe('the committed report', () => {
    it('regenerates byte-identically', async () => {
        const committed = fs.readFileSync(path.join(REPO, REPORT_REL), 'utf8');
        expect(await build()).toBe(committed);
    });
});
