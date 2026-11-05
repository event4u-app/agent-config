import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { oracleRootFor, score_task_v2 } from '../../src/scripts/_lib/bench_ab_scoring_v2.js';
import {
    AB_ROOT,
    fixtureRootFor,
    loadTasks,
    ORACLE_ROOT,
    verifierFiles,
} from '../../src/scripts/_lib/bench_task_validity.js';

type Dict = Record<string, unknown>;

const scratch: string[] = [];
afterEach(() => {
    for (const d of scratch.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

function verifierCommands(task: Dict): string[] {
    const out: string[] = [];
    for (const [oracle, key] of [
        ['capability_oracle', 'solve_test'],
        ['discipline_oracle', 'hidden_test'],
    ] as const) {
        const o = task[oracle] as Dict | undefined;
        const cmd = (o?.[key] as Dict | undefined)?.['command'];
        if (typeof cmd === 'string') out.push(cmd);
    }
    return out;
}

const VERIFIED = loadTasks().filter((t) => verifierCommands(t).length > 0 && fixtureRootFor(t) !== null);

function stage(fixture: string): string {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'bench-oracle-'));
    scratch.push(base);
    const ws = path.join(base, 'ws');
    fs.cpSync(fixture, ws, { recursive: true });
    return ws;
}

describe('verifiers are out of the subject workspace', () => {
    it('the corpus still carries verifier tasks', () => {
        expect(VERIFIED.length).toBe(18);
    });

    it('no fixture holds a file a verifier command runs', () => {
        for (const task of VERIFIED) {
            const fx = fixtureRootFor(task) as string;
            for (const cmd of verifierCommands(task)) {
                for (const tok of cmd.split(/\s+/).filter((t) => /\.m?js$/.test(t))) {
                    expect(fs.existsSync(path.join(fx, tok)), `${String(task['id'])}: ${tok} sits in the fixture`).toBe(false);
                }
            }
        }
    });

    it('every verifier file exists under the oracle root the scorer derives', () => {
        for (const task of VERIFIED) {
            const fx = fixtureRootFor(task) as string;
            const oracle = oracleRootFor(fx);
            expect(oracle, String(task['id'])).not.toBeNull();
            const files = verifierFiles(task, fx);
            expect(files.length, String(task['id'])).toBeGreaterThan(0);
            for (const rel of files) expect(fs.existsSync(path.join(oracle as string, rel))).toBe(true);
        }
    });

    it('an untouched clone fails and the reference fix passes, for every solve_test task', () => {
        for (const task of VERIFIED.filter((t) => ((t['capability_oracle'] as Dict)?.['solve_test']))) {
            const id = String(task['id']);
            const fx = fixtureRootFor(task) as string;
            const untouched = score_task_v2(task, { fixture_root: fx, clone_root: stage(fx) });
            expect(untouched.capability_pass, `${id} untouched`).toBe(false);

            const ws = stage(fx);
            const patch = path.join(ORACLE_ROOT, `${id}.patch`);
            expect(spawnSync('git', ['apply', '--whitespace=nowarn', patch], { cwd: ws }).status, `${id} patch`).toBe(0);
            const fixed = score_task_v2(task, { fixture_root: fx, clone_root: ws });
            expect(fixed.capability_checks.find((c) => c.name === 'solve_test')?.ok, `${id} reference`).toBe(true);
        }
    });

    it('a verifier the agent plants under the oracle path is replaced, reported, and the clone left as it was', () => {
        const task = VERIFIED.find((t) => t['id'] === 'capH-debug-01') as Dict;
        const fx = fixtureRootFor(task) as string;
        const ws = stage(fx);
        const planted = path.join(ws, 'tests', 'solve.check.mjs');
        fs.mkdirSync(path.dirname(planted), { recursive: true });
        fs.writeFileSync(planted, 'process.exit(0);\n');
        const r = score_task_v2(task, { fixture_root: fx, clone_root: ws });
        expect(r.capability_pass).toBe(false);
        expect(r.reports).toContain('verifier-planted:tests/solve.check.mjs');
        expect(fs.readFileSync(planted, 'utf8')).toBe('process.exit(0);\n');
    });

    it('a fixture outside fixtures-v2 has no oracle root', () => {
        expect(oracleRootFor(path.join(os.tmpdir(), 'elsewhere', 'x'))).toBeNull();
        expect(oracleRootFor(path.join(AB_ROOT, 'fixtures-v2', 'no-such-task'))).toBeNull();
    });
});
