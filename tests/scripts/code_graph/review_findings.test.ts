import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { gcBranches, indexBranch, onBranches } from '../../../src/scripts/code_graph/branches.js';
import { readCodeowners } from '../../../src/scripts/code_graph/domains.js';
import { readNpmLock, readPnpmLock } from '../../../src/scripts/code_graph/lanes/systems/lockfiles.js';
import { readSystems } from '../../../src/scripts/code_graph/lanes/systems/index.js';
import { readProvenance } from '../../../src/scripts/code_graph/provenance.js';
import { provenanceAnswer } from '../../../src/scripts/code_graph/provenance_verbs.js';
import { writeProvenanceFixture } from './provenance_fixture.js';

const roots: string[] = [];
const tmp = (): string => {
    const d = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-review-')));
    roots.push(d);
    return d;
};
afterEach(() => {
    for (const r of roots.splice(0)) fs.rmSync(r, { recursive: true, force: true });
});
const git = (cwd: string, name: string, ...args: string[]): string =>
    execFileSync('git', args, { cwd, encoding: 'utf-8', env: { ...process.env, GIT_AUTHOR_NAME: name, GIT_AUTHOR_EMAIL: 'x@x.invalid', GIT_COMMITTER_NAME: name, GIT_COMMITTER_EMAIL: 'x@x.invalid' } });

describe('lockfiles away from the root', () => {
    it('an npm lock in a subfolder roots at its own package.json and declares nothing twice', () => {
        const root = tmp();
        fs.mkdirSync(path.join(root, 'frontend'));
        fs.writeFileSync(path.join(root, 'frontend', 'package.json'), JSON.stringify({ dependencies: { a: '^1.0.0' } }, null, 2));
        fs.writeFileSync(path.join(root, 'frontend', 'package-lock.json'), JSON.stringify({ lockfileVersion: 3, packages: { '': { dependencies: { a: '^1.0.0' } }, 'node_modules/a': { version: '1.0.0' } } }, null, 2));
        const g = readNpmLock('frontend/package-lock.json', fs.readFileSync(path.join(root, 'frontend', 'package-lock.json'), 'utf-8'));
        if ('unread' in g) throw new Error(g.unread);
        expect(g.roots.map((r) => [r.manifest, r.workspace])).toEqual([['frontend/package.json', 'frontend']]);
        const out = readSystems(root);
        expect(out.facts.filter((f) => f.kind === 'package').map((f) => f.id)).toEqual(['package:npm:a@1.0.0']);
        expect(String((out.facts[0]?.attrs['declared'] as string[])[0])).toMatch(/^frontend\/package\.json:\d+ prod/);
    });

    it('a scoped pnpm package gets its own line, and a short name never matches inside a longer one', () => {
        const text = "lockfileVersion: '9.0'\npackages:\n  foo-ms@2.1.2:\n    resolution: {integrity: x}\n  ms@2.1.2:\n    resolution: {integrity: y}\n  '@s/a@1.0.0':\n    resolution: {integrity: z}\n";
        const g = readPnpmLock('pnpm-lock.yaml', text);
        if ('unread' in g) throw new Error(g.unread);
        expect(g.packages.get('ms@2.1.2')?.line).toBe(5);
        expect(g.packages.get('@s/a@1.0.0')?.line).toBe(7);
    });
});

describe('provenance on a branch that merged its parent', () => {
    it('keeps the PR and ticket of commits the parent brought in', () => {
        const root = writeProvenanceFixture();
        roots.push(root);
        git(root, 'Dev One', 'checkout', '-qb', 'feature', 'HEAD~3');
        fs.writeFileSync(path.join(root, 'feature.txt'), 'f\n');
        git(root, 'Dev One', 'add', '.');
        git(root, 'Dev One', 'commit', '-qm', 'feature work');
        git(root, 'Dev One', 'merge', '-q', '--no-edit', 'main');
        const p = readProvenance(root)!;
        const f = p.files['database/migrations/2026_10_01_000000_create_orders_table.php']!;
        expect([p.commits[f.introduced!]?.pr, p.commits[f.introduced!]?.tickets]).toEqual(['#7', ['ABC-12']]);
    });

    it('withholds an author whose name is an address', () => {
        const root = writeProvenanceFixture();
        roots.push(root);
        fs.writeFileSync(path.join(root, 'x.txt'), 'x\n');
        git(root, 'someone@example.org', 'add', '.');
        git(root, 'someone@example.org', 'commit', '-qm', 'by an address');
        const p = readProvenance(root)!;
        expect(p.commits.some((c) => c.author === '(name withheld)')).toBe(true);
        expect(JSON.stringify(p)).not.toContain('someone@example.org');
    });

    it('a query named like an Object member falls through instead of throwing', () => {
        const root = writeProvenanceFixture();
        roots.push(root);
        const p = readProvenance(root)!;
        expect(provenanceAnswer(root, { nodes: [] }, p, 'constructor', tmp()).kind).toBe('none');
    });
});

describe('the branch store', () => {
    it('a remote ref named …/feat/foo does not pin branch foo, and an Object-member query does not throw', async () => {
        const root = tmp();
        git(root, 'd', 'init', '-q', '-b', 'main');
        fs.writeFileSync(path.join(root, 'a.ts'), 'export const a = 1;\n');
        git(root, 'd', 'add', '.');
        git(root, 'd', 'commit', '-qm', 'init');
        git(root, 'd', 'branch', 'foo');
        git(root, 'd', 'remote', 'add', 'origin', 'https://example.invalid/x.git');
        git(root, 'd', 'update-ref', 'refs/remotes/origin/feat/foo', 'HEAD');
        const build = path.join(root, '.cache');
        await indexBranch(root, build, 'foo', { day: '2026-01-01' });
        const r = gcBranches(root, build, { day: '2026-06-01', now: Date.now() + 3_600_000 });
        expect(r.dropped.map((x) => x.ref)).toEqual(['foo']);
        expect(() => onBranches(build, 'constructor')).not.toThrow();
    }, 60_000);
});

describe('CODEOWNERS', () => {
    it('an owner given as an e-mail address never reaches the map', () => {
        const root = tmp();
        fs.writeFileSync(path.join(root, 'CODEOWNERS'), 'app/Orders/ @acme/orders lead@example.org\n');
        expect(readCodeowners(root)!('app/Orders/x.php')).toBe('@acme/orders (address withheld)');
    });
});
