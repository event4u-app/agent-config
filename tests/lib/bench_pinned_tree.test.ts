import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
    BenchTreeError,
    archiveCommit,
    benchSelfTest,
    lastAssistantText,
    openArchive,
    resolveBenchTree,
} from '../../internal/bench/pinned_tree.js';
import { generateCorpus } from '../../internal/bench/tier-downshift/corpus.js';

const dirs: string[] = [];
afterEach(() => {
    for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

function scratch(prefix: string): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    dirs.push(d);
    return d;
}

function git(cwd: string, ...args: string[]): string {
    const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
    if (r.status !== 0) throw new Error(r.stderr);
    return r.stdout.trim();
}

/** A repository whose src/scripts/_lib holds `n` .ts files, committed. */
function repoWithLib(n: number): { repo: string; commit: string } {
    const repo = scratch('pinned-repo-');
    git(repo, 'init', '-q');
    git(repo, 'config', 'user.email', 'bench@example.com');
    git(repo, 'config', 'user.name', 'bench');
    git(repo, 'config', 'commit.gpgsign', 'false');
    const lib = path.join(repo, 'src/scripts/_lib');
    fs.mkdirSync(lib, { recursive: true });
    for (let i = 0; i < n; i++) fs.writeFileSync(path.join(lib, `f${i}.ts`), `export function helper${i}xyz() {}\n`);
    git(repo, 'add', '.');
    git(repo, 'commit', '-q', '-m', 'seed');
    return { repo, commit: git(repo, 'rev-parse', 'HEAD') };
}

describe('resolveBenchTree', () => {
    it('refuses a dirty working tree', () => {
        const { repo } = repoWithLib(3);
        fs.writeFileSync(path.join(repo, 'src/scripts/_lib/extra.ts'), '');
        expect(() => resolveBenchTree({ repo })).toThrow(BenchTreeError);
        expect(() => resolveBenchTree({ repo })).toThrow(/dirty/);
    });

    it('pins a clean working tree at HEAD', () => {
        const { repo, commit } = repoWithLib(3);
        expect(resolveBenchTree({ repo })).toEqual({ root: repo, commit, source: 'working-tree' });
    });

    it('measures a dirty repository only through an archive of a named commit, never its edits', () => {
        const { repo, commit } = repoWithLib(3);
        fs.writeFileSync(path.join(repo, 'src/scripts/_lib/extra.ts'), '');
        const tree = resolveBenchTree({ repo, pin: commit, required: ['src/scripts/_lib'] });
        dirs.push(tree.root);
        expect(tree.commit).toBe(commit);
        expect(tree.source).toBe('archive');
        expect(generateCorpus(tree.root).find((s) => s.id === 'count-ts-src/scripts/_lib')?.answer).toBe('3');
        expect(openArchive(tree.root).commit).toBe(commit);
    });

    it('refuses a directory that is not a pinned archive, and an archive lacking a required path', () => {
        const { repo, commit } = repoWithLib(2);
        expect(() => resolveBenchTree({ repo, archive: scratch('not-archive-') })).toThrow(/not a pinned archive/);
        const dest = path.join(scratch('arch-'), 'tree');
        archiveCommit(repo, commit, dest);
        expect(() => resolveBenchTree({ repo, archive: dest, required: ['agents/roadmaps'] })).toThrow(/lacks required paths/);
    });
});

describe('benchSelfTest', () => {
    it('fails a corpus whose answer disagrees with its pinned archive', () => {
        const { repo, commit } = repoWithLib(3);
        const dest = path.join(scratch('arch-'), 'tree');
        const tree = archiveCommit(repo, commit, dest);
        const truth = generateCorpus(tree.root);
        const wrong = truth.map((s) => (s.id === 'count-ts-src/scripts/_lib' ? { ...s, answer: '4' } : s));
        const problems = benchSelfTest({ commit, slices: wrong }, truth, [], tree);
        expect(problems).toEqual([`slice count-ts-src/scripts/_lib: corpus answer 4, 3 at ${commit}`]);
        expect(benchSelfTest({ commit, slices: truth }, truth, [{ slice_id: 'x', commit }], tree)).toEqual([]);
    });

    it('fails a result row that does not carry the tree commit', () => {
        const { repo, commit } = repoWithLib(1);
        const tree = resolveBenchTree({ repo });
        const truth = generateCorpus(tree.root);
        const problems = benchSelfTest({ commit, slices: truth }, truth, [{ slice_id: 'a' }, { slice_id: 'b', commit: 'f'.repeat(40) }], tree);
        expect(problems).toHaveLength(2);
    });
});

describe('lastAssistantText', () => {
    it('reads the leg’s own last text, not an earlier one or a tool call', () => {
        const lines = [
            { type: 'user', message: { content: 'q' } },
            { type: 'assistant', message: { content: [{ type: 'text', text: 'thinking aloud' }] } },
            { type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Glob' }] } },
            { type: 'assistant', message: { content: [{ type: 'text', text: '460' }] } },
        ];
        expect(lastAssistantText(lines.map((l) => JSON.stringify(l)).join('\n'))).toBe('460');
        expect(lastAssistantText('')).toBeNull();
    });
});
