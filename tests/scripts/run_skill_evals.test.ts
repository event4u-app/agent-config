// Tests for src/scripts/run_skill_evals.ts (py2ts Phase 8 / Wave 8e).
//
// No Python pytest suite exists. Three layers:
//   1. A pure unit test of _grade_assertions (the only branch that does not
//      need the SKILLS_ROOT seam).
//   2. Golden parity (python3 vs tsx) on the deterministic error paths
//      (skill-not-found, missing evals.json, missing --run) — no timestamps.
//   3. A self-contained happy-path differential. SKILLS_ROOT is a module
//      constant derived from the repo root, so the fixture skill is created
//      under that real legacy root and FULLY removed afterwards (the entire
//      `.agent-src.uncondensed/` subtree is reaped when this suite created
//      it, so the working tree is left exactly as found). The scaffold/
//      aggregate timestamp is non-deterministic, so the happy path drives
//      aggregate→report with a hand-written benchmark and compares the
//      timestamp-free report output byte-for-byte.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    REPO_ROOT as MOD_REPO_ROOT,
    SKILLS_ROOT,
    _grade_assertions,
    cmd_report,
} from '../../src/scripts/run_skill_evals.js';
import { hasPython3, runPy, runTs } from './_wave8e.js';

const py3 = hasPython3();

describe('run_skill_evals — _grade_assertions (pure)', () => {
    it('contains hit / miss', () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'grade-'));
        try {
            const r = _grade_assertions('hello world', tmp, [
                { kind: 'contains', value: 'world' },
                { kind: 'contains', value: 'absent' },
            ]);
            expect(r[0]).toEqual({ kind: 'contains', value: 'world', pass: true });
            expect(r[1]).toEqual({ kind: 'contains', value: 'absent', pass: false });
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });

    it('file_exists checks run_dir then cwd-relative path', () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'grade-'));
        try {
            fs.writeFileSync(path.join(tmp, 'out.txt'), 'x');
            const r = _grade_assertions('', tmp, [
                { kind: 'file_exists', path: 'out.txt' },
                { kind: 'file_exists', path: 'nope.txt' },
            ]);
            expect(r[0]!.pass).toBe(true);
            expect(r[1]!.pass).toBe(false);
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });

    it('rubric is deferred (pass=null); unknown kind fails', () => {
        const r = _grade_assertions('', '/tmp', [
            { kind: 'rubric', criterion: 'is good' },
            { kind: 'mystery' },
        ]);
        expect(r[0]!.pass).toBeNull();
        expect(r[0]!.kind).toBe('rubric');
        expect(r[1]!.pass).toBe(false);
        expect(r[1]!.note).toContain("unknown assertion kind 'mystery'");
    });

    it('REPO_ROOT / SKILLS_ROOT resolve consistently', () => {
        expect(SKILLS_ROOT).toBe(path.join(MOD_REPO_ROOT, '.agent-src.uncondensed', 'skills'));
    });
});

describe.skipIf(!py3)('run_skill_evals — golden parity, error paths', () => {
    function bothEqual(args: string[]): void {
        const p = runPy('run_skill_evals', args);
        const t = runTs('run_skill_evals', args);
        expect(t.stdout).toBe(p.stdout);
        expect(t.stderr).toBe(p.stderr);
        expect(t.status).toBe(p.status);
    }

    it('scaffold <missing skill> → identical not-found error', () => {
        bothEqual(['scaffold', '__no_such_skill_wave8e__']);
    });

    it('aggregate <missing skill> --run x → identical not-found error', () => {
        bothEqual(['aggregate', '__no_such_skill_wave8e__', '--run', 'x']);
    });

    it('report <missing skill> --run x → identical not-found error', () => {
        bothEqual(['report', '__no_such_skill_wave8e__', '--run', 'x']);
    });

    it('aggregate without --run → identical argparse error (exit 2)', () => {
        const p = runPy('run_skill_evals', ['aggregate', 'x']);
        const t = runTs('run_skill_evals', ['aggregate', 'x']);
        expect(t.status).toBe(p.status);
        expect(t.status).toBe(2);
        // argparse prose differs across CPython versions — assert channel +
        // exit only (migration contract for --help / error prose).
        expect(t.stderr.length).toBeGreaterThan(0);
        expect(p.stderr.length).toBeGreaterThan(0);
    });

    it('no subcommand → exit 2 on both', () => {
        const p = runPy('run_skill_evals', []);
        const t = runTs('run_skill_evals', []);
        expect(t.status).toBe(2);
        expect(p.status).toBe(2);
    });
});

// --- Self-contained happy-path differential against the real SKILLS_ROOT ---
//
// Creates a unique fixture skill under the legacy root, runs cmd_report on a
// hand-written benchmark (deterministic — no timestamp), then reaps anything
// this suite created so the working tree is left exactly as found.
describe('run_skill_evals — report happy path (self-contained fixture)', () => {
    const skill = `__wave8e_fixture_${process.pid}__`;
    const evalsDir = path.join(SKILLS_ROOT, skill, 'evals');
    const runsDir = path.join(evalsDir, 'runs');
    const legacyRoot = path.join(MOD_REPO_ROOT, '.agent-src.uncondensed');
    // The topmost ancestor we had to create (reaped wholesale on teardown) —
    // leaves the working tree exactly as found.
    let reapTarget: string;

    beforeEach(() => {
        reapTarget = !fs.existsSync(legacyRoot)
            ? legacyRoot
            : !fs.existsSync(SKILLS_ROOT)
              ? SKILLS_ROOT
              : path.join(SKILLS_ROOT, skill);
        fs.mkdirSync(runsDir, { recursive: true });
    });

    afterEach(() => {
        fs.rmSync(reapTarget, { recursive: true, force: true });
    });

    it('cmd_report renders the benchmark table deterministically', () => {
        fs.writeFileSync(
            path.join(evalsDir, 'evals.json'),
            JSON.stringify({ scenarios: [{ id: 'sc1', prompt: 'p' }] }) + '\n',
            'utf-8',
        );
        const benchmark = {
            skill,
            run: 'RUNID',
            generated_at: 'FIXED',
            scenarios: [
                {
                    id: 'sc1',
                    arms: {
                        baseline: { status: 'graded', pass_count: 1, total: 2, elapsed_s: 1.0, tokens_in: 10, tokens_out: 100 },
                        'with-skill': { status: 'graded', pass_count: 2, total: 2, elapsed_s: 0.5, tokens_in: 8, tokens_out: 80 },
                    },
                },
            ],
            totals: { baseline_pass: 0, with_skill_pass: 1, scenarios: 1 },
        };
        fs.writeFileSync(
            path.join(runsDir, 'RUNID-benchmark.json'),
            JSON.stringify(benchmark, null, 2) + '\n',
            'utf-8',
        );

        const stdout = captureStdout(() => {
            expect(cmd_report(skill, 'RUNID')).toBe(0);
        });
        // Δ tokens_out = 80 - 100 = -20 ; Δ elapsed = 0.5 - 1.0 = -0.50
        expect(stdout).toContain('| sc1 | 1/2 | 2/2 | -20 | -0.50 |');
        expect(stdout).toContain('# Skill eval report — ' + skill + ' @ RUNID');
        expect(stdout).toContain('**Totals:** baseline 0/1 · with-skill 1/1');

        if (py3) {
            const p = runPy('run_skill_evals', ['report', skill, '--run', 'RUNID']);
            expect(p.status).toBe(0);
            expect(p.stdout).toBe(stdout);
        }
    });
});

function captureStdout(fn: () => void): string {
    const chunks: string[] = [];
    const orig = process.stdout.write.bind(process.stdout);
    (process.stdout.write as unknown) = (chunk: string | Uint8Array): boolean => {
        chunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf-8'));
        return true;
    };
    try {
        fn();
    } finally {
        process.stdout.write = orig;
    }
    return chunks.join('');
}
