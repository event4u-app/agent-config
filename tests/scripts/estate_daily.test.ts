import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { countSessionCalls, readDaily, renderDaily } from '../../src/scripts/_lib/estate_daily.js';

let dir = '';
beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'estate-daily-'));
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

const bash = (command: string, sidechain = false): string =>
    JSON.stringify({
        type: 'assistant',
        isSidechain: sidechain,
        message: { content: [{ type: 'tool_use', name: 'Bash', input: { command } }] },
    });

describe('countSessionCalls', () => {
    it('counts each Bash call that ran the council or vitest once, sidechains included', () => {
        const file = path.join(dir, 's.jsonl');
        fs.writeFileSync(
            file,
            [
                bash('./scripts-run src/scripts/council_cli run q.md --confirm'),
                bash('agent-config council:status'),
                bash('agent-config council:default q.md', true),
                bash('npx vitest run tests/a.test.ts && npx vitest run tests/b.test.ts'),
                bash('npx vitest related src/x.ts --run'),
                bash('npx vitest run', true),
                bash('git status'),
                JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Read', input: { file_path: 'vitest' } }] } }),
                'not json "tool_use"',
            ].join('\n'),
        );
        expect(countSessionCalls(file)).toEqual({ transcript: file, bash: 7, council: 2, vitest: 3 });
    });

    it('a missing transcript counts nothing', () => {
        expect(countSessionCalls(path.join(dir, 'absent.jsonl'))).toMatchObject({ bash: 0, council: 0, vitest: 0 });
    });
});

describe('readDaily', () => {
    const git = (args: string[], date?: string): string =>
        execFileSync('git', ['-C', dir, ...args], {
            encoding: 'utf8',
            env: {
                ...process.env,
                GIT_AUTHOR_NAME: 't',
                GIT_AUTHOR_EMAIL: 't@example.com',
                GIT_COMMITTER_NAME: 't',
                GIT_COMMITTER_EMAIL: 't@example.com',
                ...(date !== undefined ? { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date } : {}),
            },
        });
    const write = (rel: string, body: string): void => {
        fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
        fs.writeFileSync(path.join(dir, rel), body);
    };
    const commit = (msg: string, date: string): void => {
        git(['add', '-A']);
        git(['commit', '-q', '-m', msg], date);
    };
    const roadmap = (ticks: boolean[]): string =>
        ['---', 'status: ready', '---', '# Road', '', ...ticks.map((t, i) => `- [${t ? 'x' : ' '}] **1.${String(i + 1)} Step.**`), ''].join('\n');
    const lines = (n: number): string => `${Array.from({ length: n }, (_, i) => `l${String(i)}`).join('\n')}\n`;

    it('reports the five figures over the last 24 hours', () => {
        const now = new Date('2026-10-24T20:00:00Z');
        git(['init', '-q', '-b', 'main']);
        write('agents/roadmaps/road-to-old.md', roadmap([false, false, false]));
        write('agents/roadmaps/road-to-young.md', roadmap([false, false]));
        commit('old', '2026-10-10T12:00:00Z');
        write('agents/roadmaps/road-to-young.md', roadmap([false, false, false]));
        write('agents/owner-questions.md', '## Open\n\n### OQ-1 — a\n');
        commit('yesterday', '2026-10-23T12:00:00Z');
        write('agents/roadmaps/road-to-old.md', roadmap([true, true, false]));
        write('agents/roadmaps/road-to-young.md', roadmap([true, false, false]));
        write('agents/roadmaps/road-to-new.md', roadmap([true, false]));
        write('agents/evidence/x.md', lines(30));
        write('src/x.ts', lines(10));
        write('tests/x.test.ts', lines(5));
        write('agents/owner-questions.md', '## Open\n\n### OQ-1 — a\n\n### OQ-2 — b\n\n### OQ-3 — c\n');
        commit('today', '2026-10-24T18:00:00Z');

        const d = readDaily(dir, 'HEAD', now, 24, 2);
        expect(d.base).not.toBeNull();
        expect(d.closed).toBe(3);
        expect(d.closedOld).toBe(3);
        expect(d.openBefore).toBe(6);
        expect(d.openNow).toBe(4);
        expect([d.evidenceLines, d.srcLines, d.testLines]).toEqual([30, 10, 5]);
        expect(d.timeboxed).toBe(2);
        expect(d.ownerQuestionsAdded).toBe(2);
        expect(renderDaily(d)).toContain('closed steps        3 (3 from roadmaps older than 7 days)');
        expect(renderDaily(d)).toContain('open steps          4 (-2 vs 6)');
    });

    it('splits closed steps by roadmap age, and reads a young history without a base', () => {
        const now = new Date('2026-10-24T20:00:00Z');
        git(['init', '-q', '-b', 'main']);
        write('agents/roadmaps/road-to-fresh.md', roadmap([false, false]));
        commit('created', '2026-10-21T12:00:00Z');
        write('agents/roadmaps/road-to-fresh.md', roadmap([true, false]));
        commit('ticked', '2026-10-24T19:00:00Z');
        const d = readDaily(dir, 'HEAD', now);
        expect([d.closed, d.closedOld]).toEqual([1, 0]);

        const young = readDaily(dir, 'HEAD', new Date('2026-10-21T13:00:00Z'));
        expect(young.base).toBeNull();
        expect(young.openBefore).toBeNull();
        expect(young.closed).toBe(0);
    });
});
