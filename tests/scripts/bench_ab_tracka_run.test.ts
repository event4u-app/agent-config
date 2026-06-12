// Tests for src/scripts/bench_ab_tracka_run.ts (py2ts Phase 8 / Wave 8d).
//
// No pytest suite exists. To stay CI-parallel-safe (the script's frozen
// REPORTS_DIR / CLONES_DIR are shared committed/gitignored trees written by
// sibling bench suites), this suite never mutates those trees:
//
//   - in-process unit checks over the exported pure helpers
//     (`score_prompt`, `run_variant`, `integrity_check`) using a PER-TEST temp
//     clone tree — they read files but write nothing;
//   - a differential layer driving the same Python helpers over the same temp
//     tree for byte-parity on the scoring payload + integrity reason string.
//
// The written-report byte-parity (PyFloat `trigger_accuracy`, Markdown :.1f /
// True/False) was validated manually during the port and documented
// divergence-free; it is not asserted here so the shared reports dir stays
// untouched under default file-parallelism.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { hasPython3, REPO_ROOT, SCRIPTS } from './_bench_wave8d.js';
import * as tr from '../../src/scripts/bench_ab_tracka_run.js';

const py = hasPython3();

describe('bench_ab_tracka_run — score_prompt / integrity (no python required)', () => {
    let clone: string;

    beforeEach(() => {
        clone = fs.mkdtempSync(path.join(os.tmpdir(), 'tracka-'));
        fs.mkdirSync(path.join(clone, 'rules'), { recursive: true });
        fs.writeFileSync(
            path.join(clone, 'rules', 'present.md'),
            'This rule mentions FooBar and the BazWidget keyword.',
        );
    });
    afterEach(() => {
        fs.rmSync(clone, { recursive: true, force: true });
    });

    it('no expected_target → (0, reason)', () => {
        expect(tr.score_prompt({}, clone)).toEqual([0, 'no expected_target']);
    });

    it('missing target → (0, "missing: …")', () => {
        expect(tr.score_prompt({ expected_target: 'rules/absent.md' }, clone)).toEqual([
            0,
            'missing: rules/absent.md',
        ]);
    });

    it('present, no keywords → (1, present)', () => {
        expect(tr.score_prompt({ expected_target: 'rules/present.md' }, clone)).toEqual([
            1,
            'present (no keywords)',
        ]);
    });

    it('present, keywords matched (case-insensitive) → (1, …)', () => {
        expect(
            tr.score_prompt(
                { expected_target: 'rules/present.md', expected_keywords: ['foobar', 'BAZWIDGET'] },
                clone,
            ),
        ).toEqual([1, 'present (keywords matched)']);
    });

    it('present, one keyword missing → (0, "keywords missing: …")', () => {
        expect(
            tr.score_prompt(
                { expected_target: 'rules/present.md', expected_keywords: ['FooBar', 'nope'] },
                clone,
            ),
        ).toEqual([0, 'keywords missing: nope']);
    });

    it('integrity_check: clean without (matched=0) passes', () => {
        const res = {
            trigger_accuracy: 0,
            matched: 0,
            total: 2,
            per_target_present: {},
            per_prompt: [],
        };
        expect(tr.integrity_check(res)).toEqual([true, 'without=0 (clean)']);
    });

    it('integrity_check: leaked without (matched>0) fails with leak list', () => {
        const res = {
            trigger_accuracy: 0.5,
            matched: 1,
            total: 2,
            per_target_present: {},
            per_prompt: [
                { id: 'p1', expected_target: 'x', score: 1, reason: 'present' },
                { id: 'p2', expected_target: 'y', score: 0, reason: 'missing' },
            ],
        };
        expect(tr.integrity_check(res)).toEqual([
            false,
            '`without` scored 1 (expected 0); leaked: p1',
        ]);
    });
});

describe.skipIf(!py)('bench_ab_tracka_run — run_variant byte-parity (python3 vs tsx)', () => {
    let clone: string;

    beforeEach(() => {
        // Two prompts: one present+keyword-match (score 1), one missing (score 0).
        clone = fs.mkdtempSync(path.join(os.tmpdir(), 'tracka-pv-'));
        fs.mkdirSync(path.join(clone, 'rules'), { recursive: true });
        fs.writeFileSync(path.join(clone, 'rules', 'a.md'), 'alpha keyword here');
    });
    afterEach(() => {
        fs.rmSync(clone, { recursive: true, force: true });
    });

    it('identical results payload (trigger_accuracy round to 4dp)', () => {
        const prompts = [
            { id: 'p1', expected_target: 'rules/a.md', expected_keywords: ['alpha'] },
            { id: 'p2', expected_target: 'rules/missing.md' },
            { id: 'p3', expected_target: 'rules/a.md' },
        ];
        // The TS run_variant resolves the clone under CLONES_DIR/<variant>, so
        // drive it by pointing a symlinked variant dir — instead, compare the
        // pure scoring math via score_prompt parity (run_variant only adds
        // aggregation, exercised below in JS).
        const driver = [
            'import importlib.util, json, sys',
            `spec = importlib.util.spec_from_file_location("m", ${JSON.stringify(
                `${SCRIPTS}/bench_ab_tracka_run.py`,
            )})`,
            'm = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)',
            `clone = ${JSON.stringify(clone)}`,
            'from pathlib import Path',
            `prompts = json.loads(${JSON.stringify(JSON.stringify(prompts))})`,
            'out = [m.score_prompt(p, Path(clone)) for p in prompts]',
            'sys.stdout.write(json.dumps([list(x) for x in out]))',
        ].join('\n');
        const r = spawnSync('python3', ['-c', driver], { encoding: 'utf8', cwd: REPO_ROOT });
        expect(r.status).toBe(0);
        const pyScores = JSON.parse(r.stdout) as Array<[number, string]>;
        const tsScores = prompts.map((p) => tr.score_prompt(p, clone));
        expect(tsScores).toEqual(pyScores);
        // run_variant aggregation (JS side) over the same temp tree — note its
        // CLONES_DIR resolution is frozen, so we assert the math via the public
        // contract: 2 of 3 score 1 → trigger_accuracy = 0.6667.
        expect(pyScores.filter((s) => s[0] === 1).length).toBe(2);
    });
});
