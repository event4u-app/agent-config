/**
 * H.2 — frames to symbols by span, read at the first-seen release sha.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { BugRecord } from '../../src/scripts/code_graph/bugs.js';
import { carryLine, mapFrames, readCodeMappings, repoPath } from '../../src/scripts/code_graph/bug_frames.js';
import type { CodeNode } from '../../src/scripts/code_graph/types.js';
import { Repo } from './_bugs/repo.js';

const node = (id: string, file: string, start: number, end: number, kind: CodeNode['kind'] = 'function'): CodeNode => ({ id, label: id, kind, source_file: file, source_location: [start, 1, end, 1] });

const bug = (frames: BugRecord['frames'], release: string | null = 'app@1.0.0'): BugRecord => ({
    id: 'sentry:acme/web/1',
    provider: 'sentry',
    org: 'acme',
    project: 'web',
    issue: '1',
    status: 'unresolved',
    first_seen: '2026-09-02',
    last_seen: '2026-09-03',
    count: 1,
    first_release: release,
    environments: [],
    episodes: [],
    frames,
    suspect_commit: null,
});

let repo: Repo;
let releaseSha: string;
beforeEach(() => {
    repo = new Repo();
    repo.write('src/total.ts', ['export function a() {', '  return 1;', '}', 'export function b() {', '  return 2;', '}', ''].join('\n'));
    releaseSha = repo.commit('feat: totals');
    // Two lines inserted above b(): b's frame line moves by 2; a's first line is rewritten.
    repo.write('src/total.ts', ['export function a() { // edited', '  return 1;', '}', '// one', '// two', 'export function b() {', '  return 2;', '}', ''].join('\n'));
    repo.commit('refactor: comments');
});
afterEach(() => repo.cleanup());

const graph = { nodes: [node('src/total.ts', 'src/total.ts', 1, 9, 'file'), node('src/total.ts#a', 'src/total.ts', 1, 3), node('src/total.ts#b', 'src/total.ts', 6, 8)] };

describe('repoPath', () => {
    it('drops schemes and rewrites the longest stack root', () => {
        const maps = [{ stack_root: 'app/', source_root: 'src/' }, { stack_root: 'app/admin/', source_root: 'packages/admin/' }];
        expect(repoPath('app:///app/admin/x.ts', maps)).toBe('packages/admin/x.ts');
        expect(repoPath('/app/y.ts', maps)).toBe('src/y.ts');
        expect(repoPath('webpack:///./lib/z.ts', [])).toBe('lib/z.ts');
    });

    it('reads code mappings from layers.yaml', () => {
        const f = path.join(repo.dir, 'layers.yaml');
        fs.writeFileSync(f, 'code_mappings:\n  - stack_root: app/\n    source_root: src/\n  - stack_root: 3\n');
        expect(readCodeMappings(f)).toEqual([{ stack_root: 'app/', source_root: 'src/' }]);
        expect(readCodeMappings(path.join(repo.dir, 'none.yaml'))).toEqual([]);
    });
});

describe('carryLine', () => {
    it('shifts lines below a hunk, refuses a changed line', () => {
        const diff = '@@ -1 +1 @@\n-x\n+y\n@@ -3,0 +4,2 @@\n+a\n+b\n';
        expect(carryLine(diff, 1)).toBeNull();
        expect(carryLine(diff, 2)).toBe(2);
        expect(carryLine(diff, 5)).toBe(7);
    });
});

describe('mapFrames', () => {
    it('maps a frame through the release-to-HEAD diff to its enclosing symbol, with the span witness', () => {
        const r = mapFrames(bug([{ file: 'app/total.ts', line: 5, function: 'b' }]), graph, { mappings: [{ stack_root: 'app/', source_root: 'src/' }], releaseSha: () => releaseSha, git: repo.git });
        expect(r.state).toBe('verified');
        expect(r.mapped[0]).toMatchObject({ file: 'src/total.ts', line: 7, symbol: 'src/total.ts#b', witness: { release_line: 5, head_line: 7, span: [6, 8] } });
    });

    it('a line changed since the release is unmapped with a reason, never guessed', () => {
        const r = mapFrames(bug([{ file: 'src/total.ts', line: 1, function: 'a' }, { file: 'src/total.ts', line: 5, function: 'b' }]), graph, { mappings: [], releaseSha: () => releaseSha, git: repo.git });
        expect(r.state).toBe('partial');
        expect(r.unmapped[0]?.reason).toMatch(/line 1 changed since/);
    });

    it('a release without a known sha yields unverifiable', () => {
        const r = mapFrames(bug([{ file: 'src/total.ts', line: 5, function: 'b' }]), graph, { mappings: [], releaseSha: () => null, git: repo.git });
        expect(r.state).toBe('unverifiable');
        expect(r.unmapped[0]?.reason).toMatch(/no known sha/);
    });

    it('lists frames outside the graph and without a line', () => {
        const r = mapFrames(bug([{ file: 'vendor/x.ts', line: 3, function: null }, { file: 'src/total.ts', line: null, function: null }]), graph, { mappings: [], releaseSha: () => releaseSha, git: repo.git });
        expect(r.unmapped.map((u) => u.reason)).toEqual(['vendor/x.ts is not in the graph', 'frame has no line']);
    });
});
