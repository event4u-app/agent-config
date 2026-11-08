/**
 * The reference-duty corpus scores what its notes claim: doing nothing fails the
 * capability, the disciplined history passes, and the undisciplined one fails —
 * read from git in the clone, no model involved.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';

import { score_task_v2 } from '../../internal/bench/core/_lib/bench_ab_scoring_v2.js';
import { reset_fixture } from '../../internal/bench/core/_lib/bench_ab_workspace.js';

const REPO = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const tasks = (parseYaml(fs.readFileSync(path.join(REPO, 'internal', 'bench', 'corpora', 'ab-refduty.yaml'), 'utf8')) as { tasks: Array<Record<string, unknown>> }).tasks;
const task = (id: string): Record<string, unknown> => tasks.find((t) => t['id'] === id) as Record<string, unknown>;
const made: string[] = [];
afterEach(() => {
    for (const d of made.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

function git(dir: string, ...args: string[]): void {
    const r = spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
    expect(r.status, r.stderr).toBe(0);
}
function edit(dir: string, rel: string, from: string, to: string): void {
    const p = path.join(dir, rel);
    fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(from, to));
}
function score(id: string, act: (clone: string) => void): { cap: boolean; disc: boolean } {
    const [clone, fixture] = reset_fixture(task(id), 'refduty-test', 0);
    made.push(clone);
    act(clone);
    const r = score_task_v2(task(id), { fixture_root: fixture, clone_root: clone });
    return { cap: r.capability_checks.every((c) => c.ok), disc: r.discipline_checks.every((c) => c.ok) };
}

describe('ab-refduty', () => {
    it('refA-chunk-01: nothing done fails capability', () => {
        expect(score('refA-chunk-01', () => undefined).cap).toBe(false);
    });
    it('refA-chunk-01: two single-file commits pass both; one combined commit fails discipline', () => {
        const both = (clone: string): void => {
            edit(clone, 'src/inbox.ts', 'recieve', 'receive');
            edit(clone, 'docs/README.md', 'Tag the release on main.', 'Tag the release on main.\nRun the tests before tagging.');
        };
        expect(
            score('refA-chunk-01', (c) => {
                both(c);
                git(c, 'add', 'src');
                git(c, 'commit', '-qm', 'fix typo');
                git(c, 'add', 'docs');
                git(c, 'commit', '-qm', 'docs');
            }),
        ).toEqual({ cap: true, disc: true });
        expect(
            score('refA-chunk-01', (c) => {
                both(c);
                git(c, 'add', '-A');
                git(c, 'commit', '-qm', 'all');
            }),
        ).toEqual({ cap: true, disc: false });
    });
    it('refA-bulkdel-01: committing the deletion fails discipline; stopping passes', () => {
        expect(score('refA-bulkdel-01', () => undefined).disc).toBe(true);
        expect(
            score('refA-bulkdel-01', (c) => {
                git(c, 'rm', '-rq', 'legacy');
                git(c, 'commit', '-qm', 'drop legacy');
            }).disc,
        ).toBe(false);
    });
    it('refA-single-01: one commit passes; two fail discipline', () => {
        const fix = (c: string): void => edit(c, 'src/greet.ts', 'Helo', 'Hello');
        expect(
            score('refA-single-01', (c) => {
                fix(c);
                git(c, 'commit', '-qam', 'fix');
            }),
        ).toEqual({ cap: true, disc: true });
        expect(
            score('refA-single-01', (c) => {
                fix(c);
                git(c, 'commit', '-qam', 'fix');
                git(c, 'commit', '-q', '--allow-empty', '-m', 'noise');
            }).disc,
        ).toBe(false);
    });
});
