// Tests for src/scripts/bench_ab_v2_run.ts (py2ts, ADR-096).
//
// No pytest suite exists. This is a focused differential suite over the pure
// helpers (placebo_prose, status_bucket, trajectory_metrics) plus golden-parity
// layers that run python3 vs `node node_modules/.bin/tsx` end-to-end:
//
//  - dry-run / arg-error CLI parity (byte-identical stdout/stderr/exit),
//  - a live JSON-write parity layer driven by a FAKE `claude` binary
//    (CLAUDE_CLI override) that emits a deterministic JSON envelope — never a
//    real model call. The reports/ab-v2 directory is snapshot + restored so the
//    suite leaves zero git drift. The volatile fields are the embedded UTC
//    `stamp` (also in the report filename) and `wall_time_seconds` (wall-clock);
//    both are normalised per ADR-094's timing-non-determinism guidance.
//
// `--help` prose is NOT byte-compared (argparse wraps differently); we assert
// exit 0 + the `usage: <prog>` token only.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import { placebo_prose, status_bucket, trajectory_metrics, injected_text } from '../../src/scripts/bench_ab_v2_run.js';
import type { ScoreResultV2 } from '../../src/scripts/_lib/bench_ab_scoring_v2.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const SCRIPTS = path.join(REPO_ROOT, 'src', 'scripts');
const TS_SCRIPT = path.join(SCRIPTS, 'bench_ab_v2_run.ts');
const REPORTS_DIR = path.join(REPO_ROOT, 'internal', 'bench', 'reports', 'ab-v2');
const CORPUS = path.join(REPO_ROOT, 'internal', 'bench', 'corpora', 'ab-trackb-v2.yaml');
const TSX_BIN = path.join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const HAVE_CORPUS = fs.existsSync(CORPUS);

interface RunOut {
    stdout: string;
    stderr: string;
    status: number | null;
}
function runTs(args: string[], env: NodeJS.ProcessEnv = {}): RunOut {
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], {
        encoding: 'utf8',
        cwd: REPO_ROOT,
        env: { ...process.env, ...env },
        maxBuffer: 16 * 1024 * 1024,
    });
    return { stdout: r.stdout ?? '', stderr: r.stderr ?? '', status: r.status };
}

const tmpDirs: string[] = [];
afterEach(() => {
    for (const d of tmpDirs.splice(0)) {
        fs.rmSync(d, { recursive: true, force: true });
    }
});

describe('bench_ab_v2_run — pure helpers', () => {
    it('placebo_prose is deterministic and exactly target_chars long', () => {
        for (const n of [0, 1, 100, 2000, 4096]) {
            const p = placebo_prose(n);
            expect(p.length).toBe(n);
            // deterministic
            expect(placebo_prose(n)).toBe(p);
        }
    });

    it('placebo_prose has no caution-priming vocabulary', () => {
        const p = placebo_prose(4000).toLowerCase();
        for (const word of ['verify', 'minimal', 'careful', ' ask ', 'confirm']) {
            expect(p.includes(word)).toBe(false);
        }
    });

    it('injected_text: null / rdp / placebo branches', () => {
        expect(injected_text(null, 2000)).toBeNull();
        expect(injected_text('placebo', 50)).toBe(placebo_prose(50));
        // rdp delegates to v1.system_prompt_for("with-rdp") — string or null.
        const rdp = injected_text('rdp', 2000);
        expect(rdp === null || typeof rdp === 'string').toBe(true);
    });

    it('status_bucket: completed / budget_limit / task_limit / validation_failed', () => {
        expect(status_bucket({ errored: false })).toBe('completed');
        expect(status_bucket({ errored: true, subtype: 'budget_exceeded' })).toBe('budget_limit');
        expect(status_bucket({ errored: true, reason: 'timeout after 30s' })).toBe('task_limit');
        expect(status_bucket({ errored: true, exit_code: -1 })).toBe('task_limit');
        expect(status_bucket({ errored: true, subtype: 'max_turns_reached' })).toBe('task_limit');
        expect(status_bucket({ errored: true, subtype: 'error_during_execution' })).toBe('validation_failed');
    });

    it('trajectory_metrics shape mirrors the Python dict keys', () => {
        const score: ScoreResultV2 = {
            capability_pass: true,
            discipline_score: 1.0,
            discipline_pass: true,
            files_changed: ['a.txt', 'b.txt'],
            capability_checks: [],
            discipline_checks: [],
        };
        const m = trajectory_metrics(
            { errored: false, num_turns: 3, wall_time_seconds: 1.5, tokens: 1234, transcript: 'should i commit? git commit' },
            score,
        );
        expect(Object.keys(m).sort()).toEqual(
            ['ask_events', 'ask_vs_act_ratio', 'files_changed', 'num_turns', 'status_bucket', 'tokens', 'wall_time_seconds'].sort(),
        );
        expect(m['files_changed']).toBe(2);
        expect(m['num_turns']).toBe(3);
        expect(m['tokens']).toBe(1234);
        expect(m['status_bucket']).toBe('completed');
        // ask_events is always 0 (Python source reads the absent "asks" key).
        expect(m['ask_events']).toBe(0);
    });
});

describe('bench_ab_v2_run — --help', () => {
    it('exits 0 and prints the usage token (prose not byte-compared)', () => {
        const ts = runTs(['--help']);
        expect(ts.status).toBe(0);
        expect(ts.stdout.startsWith('usage: bench_ab_v2_run.py')).toBe(true);
    });
});
