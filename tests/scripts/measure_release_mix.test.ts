// Pins the two properties the council's replacement mechanism rests on:
// classification reads changed paths and never the commit subject, and `mixed`
// is never collapsed into a category. Both are gaming surfaces — a subject-based
// reading is rewritable, and a collapsed `mixed` recreates the exact loophole the
// declined per-PR gate carried, where one consumer file legitimises a
// governance-only change.
//
// Each case builds a throwaway git repository under the OS temp directory. None
// of this touches the working tree.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    auditTree,
    classifyCommit,
    classifyPath,
    loadTaxonomy,
    measureRange,
    type Reading,
} from '../../src/scripts/measure_release_mix.js';

const TAX = loadTaxonomy();

function run(cwd: string, args: string[]): void {
    const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
}

function write(repo: string, rel: string, body: string): void {
    const abs = join(repo, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, body, 'utf8');
}

/** The classification-bearing part of a reading — everything except the SHAs. */
function shape(r: Reading): unknown {
    return { commit_view: r.commit_view, diff_view: r.diff_view, diagnostics: r.diagnostics, response_obligation: r.response_obligation };
}

describe('measure_release_mix', () => {
    let repo: string;

    beforeEach(() => {
        repo = mkdtempSync(join(tmpdir(), 'release-mix-'));
        run(repo, ['init', '-q', '-b', 'main']);
        run(repo, ['config', 'user.email', 'test@example.com']);
        run(repo, ['config', 'user.name', 'test']);
        write(repo, 'README.md', 'base\n');
        run(repo, ['add', 'README.md']);
        run(repo, ['commit', '-qm', 'base']);
        run(repo, ['tag', 'base']);
    });

    afterEach(() => {
        rmSync(repo, { recursive: true, force: true });
    });

    it('classifies from changed paths, so rewriting the subject changes nothing', () => {
        write(repo, 'agents/roadmaps/road-to-x.md', 'roadmap\n');
        run(repo, ['add', '.']);
        run(repo, ['commit', '-qm', 'feat(skills): a subject claiming consumer work']);

        const before = measureRange('base', 'HEAD', TAX, 'probe', repo);
        run(repo, ['commit', '-q', '--amend', '-m', 'chore(governance): an entirely different subject']);
        const after = measureRange('base', 'HEAD', TAX, 'probe', repo);

        expect(shape(after)).toEqual(shape(before));
        expect(before.commit_view.governance).toBe(1);
        expect(before.commit_view.consumer).toBe(0);
    });

    it('puts a governance commit carrying one consumer file in mixed, not consumer', () => {
        write(repo, 'agents/roadmaps/road-to-y.md', 'roadmap\n');
        write(repo, 'agents/evidence/reports/y.md', 'evidence\n');
        write(repo, 'src/skills/y/SKILL.md', 'one consumer file\n');
        run(repo, ['add', '.']);
        run(repo, ['commit', '-qm', 'chore: governance plus one token consumer file']);

        const r = measureRange('base', 'HEAD', TAX, 'probe', repo);
        expect(r.commit_view.mixed).toBe(1);
        expect(r.commit_view.consumer).toBe(0);
        expect(r.commit_view.governance).toBe(0);
        expect(r.diagnostics.mixed_combinations['consumer+governance']).toBe(1);
    });

    it('reports mixed as its own bucket in the diff view too', () => {
        write(repo, 'agents/roadmaps/road-to-z.md', 'a\nb\nc\n');
        write(repo, 'src/skills/z/SKILL.md', 'x\n');
        run(repo, ['add', '.']);
        run(repo, ['commit', '-qm', 'mixed']);

        const r = measureRange('base', 'HEAD', TAX, 'probe', repo);
        expect(r.diff_view.governance!.added).toBe(3);
        expect(r.diff_view.consumer!.added).toBe(1);
    });

    it('excludes generated projections from both views and counts them separately', () => {
        write(repo, 'dist/agent-src/rules/a.md', 'projected\n');
        run(repo, ['add', '.']);
        run(repo, ['commit', '-qm', 'chore: regenerate']);

        const r = measureRange('base', 'HEAD', TAX, 'probe', repo);
        expect(r.diagnostics.generated_only_commits).toBe(1);
        expect(r.commit_view.maintenance).toBe(0);
        expect(r.diff_view.maintenance!.added).toBe(0);
    });

    it('keeps unclassified separate from mixed', () => {
        expect(classifyPath('src/shared/thing.ts', TAX)).toBe('unclassified');
        const v = classifyCommit(['src/skills/a/SKILL.md', 'src/shared/thing.ts'], TAX);
        expect(v.bucket).toBe('consumer');
        expect(v.has_unclassified).toBe(true);

        const only = classifyCommit(['src/shared/thing.ts'], TAX);
        expect(only.bucket).toBe('unclassified');
    });

    it('triggers the response obligation on strict inequality only', () => {
        const tie = classifyCommit(['agents/roadmaps/a.md'], TAX);
        expect(tie.bucket).toBe('governance');

        write(repo, 'agents/roadmaps/a.md', 'g\n');
        run(repo, ['add', '.']);
        run(repo, ['commit', '-qm', 'g']);
        write(repo, 'src/skills/a/SKILL.md', 'c\n');
        run(repo, ['add', '.']);
        run(repo, ['commit', '-qm', 'c']);

        const r = measureRange('base', 'HEAD', TAX, 'probe', repo);
        expect(r.response_obligation.governance_only).toBe(1);
        expect(r.response_obligation.consumer_only).toBe(1);
        expect(r.response_obligation.triggered).toBe(false);
    });

    it('resolves every tracked path in this repository to a rule', () => {
        const { rows, unmatched } = auditTree(TAX);
        expect(unmatched).toEqual([]);
        expect(rows.length).toBeGreaterThan(10);
    });

    it('carries a version so a later reading is comparable to an earlier one', () => {
        expect(TAX.taxonomy_version).toMatch(/^\d+\.\d+\.\d+$/);
    });
});
