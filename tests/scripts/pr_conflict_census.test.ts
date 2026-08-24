// Tests for src/scripts/pr_conflict_census.ts.
//
// The measurement's correctness rests on one property of git: `git show
// --name-only` on a MERGE commit prints the combined diff — only paths differing
// from BOTH parents. So a clean merge prints nothing and a resolved merge prints
// exactly the resolved paths. Every case here builds a real merge, one clean and
// one conflicted, and asserts that property rather than trusting it.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { census, isGenerated, main } from '../../src/scripts/pr_conflict_census';

const tmpDirs: string[] = [];
afterAll(() => {
    for (const d of tmpDirs) fs.rmSync(d, { recursive: true, force: true });
});

function git(cwd: string, ...args: string[]): string {
    const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
    if (r.status !== 0 && !args.includes('merge')) {
        throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
    }
    return r.stdout ?? '';
}

function write(root: string, rel: string, body: string): void {
    const p = path.join(root, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, body);
}

/** A repo with one clean merge and one conflicted merge. */
function repoWithMerges(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'census-'));
    tmpDirs.push(dir);
    git(dir, 'init', '-q', '-b', 'main');
    git(dir, 'config', 'user.email', 'a@b.c');
    git(dir, 'config', 'user.name', 't');
    git(dir, 'config', 'commit.gpgsign', 'false');
    write(dir, 'hot.txt', 'base\n');
    write(dir, 'cold.txt', 'base\n');
    git(dir, 'add', '-A');
    git(dir, 'commit', '-qm', 'base');

    // A CLEAN merge: the branch touches only cold.txt, main touches nothing.
    git(dir, 'checkout', '-qb', 'clean-branch');
    write(dir, 'cold.txt', 'branch\n');
    git(dir, 'add', '-A');
    git(dir, 'commit', '-qm', 'cold on branch');
    git(dir, 'checkout', '-q', 'main');
    git(dir, 'merge', '-q', '--no-ff', '--no-edit', 'clean-branch');

    // A CONFLICTED merge: both sides edit hot.txt.
    git(dir, 'checkout', '-qb', 'conflict-branch');
    write(dir, 'hot.txt', 'from the branch\n');
    git(dir, 'add', '-A');
    git(dir, 'commit', '-qm', 'hot on branch');
    git(dir, 'checkout', '-q', 'main');
    write(dir, 'hot.txt', 'from main\n');
    git(dir, 'add', '-A');
    git(dir, 'commit', '-qm', 'hot on main');
    git(dir, 'merge', '--no-edit', 'conflict-branch'); // conflicts
    write(dir, 'hot.txt', 'resolved\n');
    git(dir, 'add', '-A');
    git(dir, 'commit', '-qm', 'merge with resolution');
    return dir;
}

describe('the census counts RESOLUTIONS, not touches', () => {
    it('reports the conflicted path and NOT the cleanly-merged one', () => {
        // The whole method in one assertion: `cold.txt` was edited on a branch
        // and merged, `hot.txt` was edited on both. Only the second is a merge
        // surface, and a churn count could not tell them apart.
        const c = census(repoWithMerges(), { since: '10 years ago' });
        const paths = c.rows.map((r) => r.path);
        expect(paths).toContain('hot.txt');
        expect(paths).not.toContain('cold.txt');
    });

    it('counts the clean merge as examined but not as conflicted', () => {
        const c = census(repoWithMerges(), { since: '10 years ago' });
        expect(c.merges).toBe(2);
        expect(c.conflicted).toBe(1);
    });

    it('reports the window it SCANNED, and flags truncation', () => {
        // The defect this exists for: on the real repository a 60-day `--since`
        // holds ~1,800 merges, so a default limit measured the newest three days
        // while the header said sixty. A mislabelled window reads as a trend.
        const repo = repoWithMerges();
        const c = census(repo, { since: '10 years ago', limit: 1 });
        expect(c.available).toBe(2);
        expect(c.merges).toBe(1);
        expect(c.scannedFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(c.scannedTo).toBe(c.scannedFrom); // one merge → one date
    });

    it('an untruncated run reports available === merges', () => {
        const c = census(repoWithMerges(), { since: '10 years ago', limit: 1000 });
        expect(c.available).toBe(c.merges);
    });

    it('a window with no merges reports empty rather than throwing', () => {
        const c = census(repoWithMerges(), { since: '2099-01-01' });
        expect(c.merges).toBe(0);
        expect(c.rows).toEqual([]);
    });
});

describe('isGenerated names the paths a PR should not be carrying', () => {
    it('recognises the four hotspots the first version missed', () => {
        // Measured: these four were the top of the 60-day census and were
        // classified AUTHORED, which understated the generated share at 10 %
        // where it is 50 %.
        for (const p of [
            'agents/roadmaps-progress.md',
            'agents/roadmaps/archive/index.json',
            'agents/roadmaps/archive/INDEX.md',
            'agents/roadmaps/stubs/README.md',
            'internal/.condensation-hashes.json',
        ]) {
            expect(isGenerated(p), `${p} should classify as generated`).toBe(true);
        }
    });

    it('recognises the originally-listed generated paths', () => {
        for (const p of [
            'docs/proof.md',
            'docs/catalog.md',
            'agents/index.md',
            'src/domains/meta/pack.yaml',
            'internal/reports/exec-evidence-feasibility.json',
            'llms.txt',
        ]) {
            expect(isGenerated(p), `${p} should classify as generated`).toBe(true);
        }
    });

    it('does NOT claim hand-authored paths are generated', () => {
        // The failure in the other direction: over-classifying would report a
        // generated share that flatters the diagnosis.
        for (const p of [
            'docs/CLAIMS.md',
            'src/config/estate-count-budget.json',
            'src/config/gate-coverage.yml',
            'taskfiles/ci-fast.yml',
            'README.md',
            'docs/architecture.md',
            'src/skills/laravel/SKILL.md',
        ]) {
            expect(isGenerated(p), `${p} must NOT classify as generated`).toBe(false);
        }
    });
});

describe('the CLI', () => {
    it('exits 0 — it is an instrument, never a gate', () => {
        const orig = process.stdout.write.bind(process.stdout);
        process.stdout.write = (() => true) as typeof process.stdout.write;
        try {
            expect(main(['--top', '3'], repoWithMerges())).toBe(0);
        } finally {
            process.stdout.write = orig;
        }
    });

    it('--json emits the machine shape including the window fields', () => {
        const out: string[] = [];
        const orig = process.stdout.write.bind(process.stdout);
        process.stdout.write = ((c: string) => {
            out.push(c);
            return true;
        }) as typeof process.stdout.write;
        try {
            main(['--json'], repoWithMerges());
        } finally {
            process.stdout.write = orig;
        }
        const parsed = JSON.parse(out.join('')) as Record<string, unknown>;
        for (const k of ['rows', 'merges', 'conflicted', 'available', 'scannedFrom', 'scannedTo']) {
            expect(parsed).toHaveProperty(k);
        }
    });
});
