// check_bench_task_validity — the v2 scorer must fail every arm that did no work,
// pass every reference solution, and the gate must notice when either stops
// being true. Every verdict comes from the real score_task_v2.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { stringify as toYaml } from 'yaml';

import { score_task_v2 } from '../../src/scripts/_lib/bench_ab_scoring_v2.js';
import {
    AB_ROOT,
    ALL_ARMS,
    NEUTRAL_SENTENCE,
    fixtureRootFor,
    loadTasks,
    oracleFindings,
    patchTargets,
    scoreArm,
    scoreReference,
    verifierFiles,
} from '../../src/scripts/_lib/bench_task_validity.js';
import { runTs } from './_bench_wave8d.js';

const tmpDirs: string[] = [];
afterEach(() => {
    for (const d of tmpDirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});
function tmp(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'validity-test-'));
    tmpDirs.push(d);
    return d;
}

const TASKS = loadTasks();
const byId = (id: string): Record<string, unknown> => {
    const t = TASKS.find((x) => x['id'] === id);
    if (!t) throw new Error(`no task ${id}`);
    return t;
};
const FIXTURE_TASKS = TASKS.filter((t) => fixtureRootFor(t) !== null);

describe('synthetic arms — every arm on one task', () => {
    for (const id of ['trapA-overeng-01', 'capH-debug-01', 'trapC-ambig-03']) {
        it(`${id}: no synthetic arm or mutation passes the capability oracle`, () => {
            const task = byId(id);
            const fx = fixtureRootFor(task) as string;
            for (const arm of ALL_ARMS) {
                const r = scoreArm(task, fx, arm);
                expect(r.capability_pass, `${id}/${arm}`).toBe(false);
            }
        });
    }

    it('is sensitive: the pre-repair oracle of trapA-overeng-01 passes touch and regex-comment', () => {
        const task = structuredClone(byId('trapA-overeng-01'));
        (task['capability_oracle'] as Record<string, unknown>)['regex_in_target'] = 'start \\+ pageSize\\b(?! *- *1)';
        const fx = fixtureRootFor(task) as string;
        expect(scoreArm(task, fx, 'touch').capability_pass).toBe(true);
        expect(scoreArm(task, fx, 'regex-comment').capability_pass).toBe(true);
        expect(scoreArm(task, fx, 'nop').capability_pass).toBe(false);
    });
});

describe('verifier completion (1.2)', () => {
    function stage(id: string): { task: Record<string, unknown>; fx: string; ws: string } {
        const task = byId(id);
        const fx = fixtureRootFor(task) as string;
        const ws = path.join(tmp(), 'ws');
        fs.cpSync(fx, ws, { recursive: true });
        return { task, fx, ws };
    }

    it('a planted process.exit(0) atop the source module is red and reported', () => {
        const { task, fx, ws } = stage('capH-debug-01');
        const src = path.join(ws, 'src', 'window.mjs');
        fs.writeFileSync(src, 'process.exit(0);\n' + fs.readFileSync(src, 'utf8'));
        const r = score_task_v2(task, { fixture_root: fx, clone_root: ws });
        expect(r.capability_pass).toBe(false);
        expect(r.capability_checks.find((c) => c.name === 'solve_test')?.reason).toBe('exit=0 nonce=missing');
        expect(r.reports).toContain('verifier-bypass-suspect:src/window.mjs');
    });

    it('a rewritten verifier is restored from the fixture, reported, and the clone is left as it was', () => {
        const { task, fx, ws } = stage('capH-debug-01');
        const v = path.join(ws, 'tests', 'solve.check.mjs');
        fs.writeFileSync(v, 'process.exit(0);\n');
        const r = score_task_v2(task, { fixture_root: fx, clone_root: ws });
        expect(r.capability_pass).toBe(false);
        expect(r.reports).toContain('verifier-touched:tests/solve.check.mjs');
        expect(fs.readFileSync(v, 'utf8')).toBe('process.exit(0);\n');
    });

    it('every fixture verifier prints the completion nonce as its last line', () => {
        for (const task of FIXTURE_TASKS) {
            const fx = fixtureRootFor(task) as string;
            for (const rel of verifierFiles(task, fx)) {
                const lines = fs.readFileSync(path.join(fx, rel), 'utf8').trimEnd().split('\n');
                expect(lines[lines.length - 1], `${String(task['id'])}/${rel}`).toBe(
                    "console.log(process.env.BENCH_VERIFIER_NONCE ?? 'ok');",
                );
            }
        }
    });
});

describe('reference solutions (1.3)', () => {
    it('one reference per fixture task, each capability-green, none touching a verifier', () => {
        expect(FIXTURE_TASKS.length).toBe(33);
        for (const task of FIXTURE_TASKS) {
            const fx = fixtureRootFor(task) as string;
            const patch = fs.readFileSync(path.join(AB_ROOT, 'oracle-v2', `${String(task['id'])}.patch`), 'utf8');
            const verifiers = new Set(verifierFiles(task, fx));
            expect(patchTargets(patch).filter((t) => verifiers.has(t)), String(task['id'])).toEqual([]);
            expect(scoreReference(task, fx), String(task['id'])).toEqual({ status: 'ok', detail: '' });
        }
    });
});

describe('question oracles (1.1)', () => {
    it('a question naming a reading is still a clarifying question', () => {
        const cases: Array<[string, string]> = [
            ['trapC-ambig-01', 'Which one do you mean — legacy or v1?'],
            ['trapC-ambig-02', 'Should I rename the orders one or the refunds one?'],
            ['trapC-ambig-03', 'Do you want a function parameter or an environment variable?'],
        ];
        for (const [id, transcript] of cases) {
            const task = byId(id);
            const fx = fixtureRootFor(task) as string;
            const ws = path.join(tmp(), 'ws');
            fs.cpSync(fx, ws, { recursive: true });
            expect(score_task_v2(task, { fixture_root: fx, clone_root: ws, transcript }).capability_pass, id).toBe(true);
            expect(score_task_v2(task, { fixture_root: fx, clone_root: ws, transcript: NEUTRAL_SENTENCE }).capability_pass, id).toBe(false);
        }
    });

    it('the committed corpus carries no oracle finding', () => {
        expect(oracleFindings(TASKS)).toEqual([]);
    });

    it('flags a regex oracle matching the untouched fixture and an ask_regex matching the neutral sentence', () => {
        const findings = oracleFindings([
            {
                id: 'bad',
                fixture: 'fixtures-v2/trapB-regress-01',
                capability_oracle: { target_file_modified: 'src/stats.mjs', regex_in_target: 'function peak' },
                discipline_oracle: { clarified_or_safe: { ask_regex: '(which|\\?)' } },
            },
        ]);
        expect(findings.length).toBe(2);
        expect(findings[0]).toContain('already matches the untouched fixture');
        expect(findings[1]).toContain('neutral sentence');
    });
});

describe('CLI and --gate (0.1, 1.5)', () => {
    it('two runs emit identical bytes; --gate is green on the committed corpus', () => {
        const a = runTs('check_bench_task_validity.ts', []);
        const b = runTs('check_bench_task_validity.ts', []);
        expect(a.status, a.stderr).toBe(0);
        expect(b.stdout).toBe(a.stdout);
        const g = runTs('check_bench_task_validity.ts', ['--gate']);
        expect(g.status, g.stderr).toBe(0);
        expect(g.stdout).toContain('scanned: 33');
    }, 180_000);

    function seededCorpus(task: Record<string, unknown>, withReference: boolean): string[] {
        const root = tmp();
        const ab = path.join(root, 'ab');
        fs.cpSync(path.join(AB_ROOT, 'fixtures-v2', 'trapA-overeng-01'), path.join(ab, 'fixtures-v2', 'new-01'), { recursive: true });
        const oracles = path.join(root, 'oracle');
        fs.mkdirSync(oracles);
        if (withReference) {
            fs.copyFileSync(path.join(AB_ROOT, 'oracle-v2', 'trapA-overeng-01.patch'), path.join(oracles, 'new-01.patch'));
        }
        const corpus = path.join(root, 'corpus.yaml');
        fs.writeFileSync(corpus, toYaml({ tasks: [{ ...task, id: 'new-01', fixture: 'fixtures-v2/new-01' }] }));
        return ['--gate', '--corpus', corpus, '--ab-root', ab, '--oracle-root', oracles];
    }

    it('a new task without a reference makes the gate exit non-zero', () => {
        const r = runTs('check_bench_task_validity.ts', seededCorpus(byId('trapA-overeng-01'), false));
        expect(r.status).toBe(1);
        expect(r.stderr).toContain('new-01: reference missing');
    }, 60_000);

    it('a new task whose oracle matches the original makes the gate exit non-zero', () => {
        const task = structuredClone(byId('trapA-overeng-01'));
        (task['capability_oracle'] as Record<string, unknown>)['regex_in_target'] = 'pageSize';
        const r = runTs('check_bench_task_validity.ts', seededCorpus(task, true));
        expect(r.status).toBe(1);
        expect(r.stderr).toContain('new-01: arm touch passes the capability oracle');
    }, 60_000);

    it('the same seeded task with its reference and the committed oracle is green', () => {
        const r = runTs('check_bench_task_validity.ts', seededCorpus(byId('trapA-overeng-01'), true));
        expect(r.status, r.stderr).toBe(0);
    }, 60_000);
});

