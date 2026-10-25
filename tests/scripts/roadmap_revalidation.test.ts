import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    advancePin,
    evaluateRevisitIf,
    freshness,
    parseCitations,
    readPin,
    revalidate,
} from '../../src/scripts/_lib/roadmap_revalidation.js';
import { skeleton } from '../../src/scripts/new_roadmap.js';
import { renderRevalidation, resolveRoadmap } from '../../src/scripts/roadmap_context.js';

let dir: string;

function git(...args: string[]): string {
    return execFileSync('git', ['-C', dir, ...args], {
        encoding: 'utf-8',
        env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' },
    }).trim();
}
function write(rel: string, body: string): void {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), body);
}
function commit(msg: string): string {
    git('add', '-A');
    git('commit', '-q', '-m', msg);
    return git('rev-parse', '--short=10', 'HEAD');
}

const ROADMAP = 'agents/roadmaps/road-to-x.md';
// Interpolated so `lint_code_comments` does not read a template line as a heading.
const H2 = '#'.repeat(2) + ' ';

function roadmap(pin: string, extra = ''): string {
    return `---
complexity: lightweight
status: ready
tree_pin: ${pin}
---
# Road to x

Cites \`src/a.ts:2\`, \`src/b.ts\`, \`src/c.ts:9\` and the planned \`src/new.ts\`.

${H2}Phase 1 — one

- [ ] **1.1 Step.** Rests on \`src/b.ts\`.
      verify: true

${H2}Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | reversible-technical | agent | keep a | \`src/a.ts:2\` | the file grows |
| D2 | reversible-technical | agent | keep c | \`src/c.ts\` | \`test -f src/flag.txt\` |
${extra}`;
}

beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reval-'));
    git('init', '-q', '-b', 'main');
    write('src/a.ts', 'a1\na2\na3\n');
    write('src/b.ts', 'b1\n');
    write('src/c.ts', 'c1\nc2\nc3\nc4\nc5\nc6\nc7\nc8\nc9\nc10\n');
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('readPin', () => {
    it('accepts the field and both older forms, in precedence order', () => {
        expect(readPin('---\ntree_pin: abc1234def\n---')).toEqual({ sha: 'abc1234def', form: 'tree_pin' });
        expect(readPin('drafted-against: fea32452b\n')).toEqual({ sha: 'fea32452b', form: 'drafted-against' });
        expect(readPin('## Context — read at `main@2bc5715c7`')).toEqual({ sha: '2bc5715c7', form: 'read-at' });
        expect(readPin('tree_pin: 1111111\nread at `main@2222222`')?.sha).toBe('1111111');
        expect(readPin('no pin here')).toBeNull();
    });

    it('new_roadmap writes the pin into the skeleton', () => {
        expect(readPin(skeleton('x', 'lightweight', '2026-10-25', 'abcdef1234'))).toEqual({ sha: 'abcdef1234', form: 'tree_pin' });
        expect(readPin(skeleton('x', 'lightweight', '2026-10-25'))).toBeNull();
    });
});

describe('parseCitations', () => {
    it('reads paths with single lines, ranges and lists, keeping the highest line', () => {
        const c = parseCitations('`src/a.ts:2` `src/a.ts:5-9` `src/b.ts` `src/c.ts:209/226/248` `x` `../up.ts:1`');
        expect(c).toEqual([
            { path: 'src/a.ts', maxLine: 9 },
            { path: 'src/b.ts', maxLine: null },
            { path: 'src/c.ts', maxLine: 248 },
        ]);
    });
});

describe('revalidate', () => {
    it('is fresh on the cheap path when nothing cited moved', () => {
        const pin = commit('base');
        write(ROADMAP, roadmap(pin));
        write('src/unrelated.ts', 'x\n');
        commit('roadmap and noise');
        const rep = revalidate({ root: dir, roadmapRel: ROADMAP, text: roadmap(pin) });
        expect(rep.verdict).toBe('fresh');
        expect(rep.cheap).toBe(true);
        expect(rep.decisions.every((d) => d.question === undefined)).toBe(true);
    });

    it('labels drifted, missing and beyond-end, keeps a planned file unchanged, and reads broken', () => {
        const pin = commit('base');
        write('src/a.ts', 'a1\nA2\na3\n');
        fs.rmSync(path.join(dir, 'src/b.ts'));
        write('src/c.ts', 'c1\n');
        commit('moves');
        const rep = revalidate({ root: dir, roadmapRel: ROADMAP, text: roadmap(pin) });
        const state = Object.fromEntries(rep.citations.map((c) => [c.path, c.state]));
        expect(state).toEqual({ 'src/a.ts': 'drifted', 'src/b.ts': 'missing', 'src/c.ts': 'beyond-end', 'src/new.ts': 'unchanged' });
        expect(rep.verdict).toBe('broken');
        expect(rep.cheap).toBe(false);
    });

    it('a decision whose evidence moved yields one question; a step citing a moved path yields none', () => {
        const pin = commit('base');
        write('src/a.ts', 'a1\nA2\na3\n');
        write('src/b.ts', 'B1\n');
        commit('moves');
        const rep = revalidate({ root: dir, roadmapRel: ROADMAP, text: roadmap(pin) });
        expect(rep.verdict).toBe('drifted');
        const withQ = rep.decisions.filter((d) => d.question !== undefined);
        expect(withQ.map((d) => d.id)).toEqual(['D1']);
        expect(withQ[0]?.question).toContain('`holds` | `holds-changed` | `falls`');
        expect(withQ[0]?.question).toContain('-a2');
        expect(rep.decisions.find((d) => d.id === 'D1')?.revisit).toBe('unverifiable');
    });

    it('counts uncommitted edits as drift', () => {
        const pin = commit('base');
        write('src/b.ts', 'edited\n');
        expect(revalidate({ root: dir, roadmapRel: ROADMAP, text: roadmap(pin) }).verdict).toBe('drifted');
        expect(freshness(dir, ROADMAP, roadmap(pin))).toBe('drifted');
    });

    it('is unpinned without a pin or with a pin this repository does not hold', () => {
        commit('base');
        expect(revalidate({ root: dir, roadmapRel: ROADMAP, text: '# no pin' }).verdict).toBe('unpinned');
        expect(revalidate({ root: dir, roadmapRel: ROADMAP, text: roadmap('deadbeef00') }).verdict).toBe('unpinned');
        expect(freshness(dir, ROADMAP, '# no pin')).toBe('unpinned');
    });

    it('freshness reads broken when a cited file that existed at the pin is gone', () => {
        const pin = commit('base');
        fs.rmSync(path.join(dir, 'src/b.ts'));
        expect(freshness(dir, ROADMAP, roadmap(pin))).toBe('broken');
    });
});

describe('evaluateRevisitIf', () => {
    it('evaluates only the closed test -f / test -e forms and never runs anything else', () => {
        write('src/flag.txt', '1');
        expect(evaluateRevisitIf('`test -f src/flag.txt`', dir, false)).toBe('fired');
        expect(evaluateRevisitIf('`test -e src/none.txt`', dir, false)).toBe('unmet');
        expect(evaluateRevisitIf('`test -f src/fl*.txt`', dir, false)).toBe('fired');
        const marker = path.join(dir, 'ran');
        expect(evaluateRevisitIf(`\`touch ${marker}\``, dir, false)).toBe('unverifiable');
        expect(fs.existsSync(marker)).toBe(false);
        expect(evaluateRevisitIf('`test -f ../../etc/passwd`', dir, false)).toBe('unverifiable');
        expect(evaluateRevisitIf('the file grows', dir, false)).toBe('not-evaluated');
        expect(evaluateRevisitIf('the file grows', dir, true)).toBe('unverifiable');
    });
});

describe('advancePin', () => {
    it('moves the pin and records the revalidation, and refuses on broken', () => {
        const out = advancePin(roadmap('1111111111'), '2222222222', '2026-10-25', 'drifted');
        expect(readPin(out)?.sha).toBe('2222222222');
        expect(out).toMatch(/^revalidated: 2222222222 2026-10-25$/m);
        const again = advancePin(out, '3333333333', '2026-10-26', 'fresh');
        expect(again.match(/^revalidated:/gm)).toHaveLength(1);
        expect(() => advancePin(roadmap('1111111111'), '2222222222', '2026-10-25', 'broken')).toThrow(/broken/);
        const noPin = advancePin('---\nstatus: ready\n---\n# r\n', 'abcdef1234', '2026-10-25', 'unpinned');
        expect(readPin(noPin)?.sha).toBe('abcdef1234');
    });
});

describe('roadmap:context --revalidate', () => {
    it('resolves a slug across the roadmap directories and renders the next step on drift', () => {
        const pin = commit('base');
        write('agents/roadmaps/later/road-to-y.md', roadmap(pin));
        expect(resolveRoadmap(dir, 'y')).toBe('agents/roadmaps/later/road-to-y.md');
        expect(resolveRoadmap(dir, 'road-to-y')).toBe('agents/roadmaps/later/road-to-y.md');
        expect(resolveRoadmap(dir, 'nope')).toBeNull();
        write('src/b.ts', 'B\n');
        const rep = revalidate({ root: dir, roadmapRel: 'agents/roadmaps/later/road-to-y.md', text: roadmap(pin) });
        const text = renderRevalidation('agents/roadmaps/later/road-to-y.md', rep);
        expect(text).toContain('verdict: drifted');
        expect(text).toContain('drifted    src/b.ts');
        expect(text).toContain('--advance');
    });
});
