// Tests for src/scripts/bench_baseline_ready.ts (py2ts Phase 8 / Wave 8d).
//
// No pytest suite exists, so this is a focused differential suite over the
// pure helper (_read_baseline_start) plus a golden-parity layer that runs
// python3 vs tsx and compares stdout + stderr + exit code. The runner reads
// the live date via datetime.now(), so the `today` / `days_elapsed` /
// `days_ok` / status / verdict fields are inherently non-deterministic
// (wall-clock) — they are normalised before comparison. The report count
// derives from a directory listing (a stable count, not OS-order-sensitive).
// bench_baseline_ready is read-only — zero git drift.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import * as bbr from '../../src/scripts/bench_baseline_ready.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'bench_baseline_ready.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'bench_baseline_ready.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

/** Normalise the wall-clock-dependent fields (today / days / verdict). */
function normJson(s: string): string {
    return s
        .replace(/"today": "[0-9-]+"/g, '"today": "TS"')
        .replace(/"days_elapsed": -?[0-9]+/g, '"days_elapsed": N')
        .replace(/"days_ok": (true|false)/g, '"days_ok": B')
        .replace(/"reports_ok": (true|false)/g, '"reports_ok": B')
        .replace(/"status": "(ready|warmup)"/g, '"status": S');
}

function normText(s: string): string {
    return s
        .replace(/days=-?[0-9]+\//g, 'days=N/')
        .replace(/(READY|WARMUP)/g, 'V')
        .replace(/(✅|⏳)/g, 'E');
}

describe('bench_baseline_ready — pure helper', () => {
    let tmp: string | null = null;
    afterEach(() => {
        if (tmp && fs.existsSync(tmp)) {
            fs.rmSync(tmp);
        }
        tmp = null;
    });

    it('_read_baseline_start returns null for a missing file', () => {
        expect(bbr._read_baseline_start(path.join(REPO_ROOT, 'nope.txt'))).toBeNull();
    });

    it('_read_baseline_start skips comments + blanks, reads first date', () => {
        tmp = path.join(os.tmpdir(), `baseline-${process.pid}-${Date.now()}.txt`);
        fs.writeFileSync(tmp, '# comment\n\n2026-05-16\n2027-01-01\n');
        expect(bbr._read_baseline_start(tmp)).toBe('2026-05-16');
    });

    it('_read_baseline_start skips an invalid date line, takes the next valid', () => {
        tmp = path.join(os.tmpdir(), `baseline-${process.pid}-${Date.now()}-b.txt`);
        fs.writeFileSync(tmp, 'not-a-date\n2026-13-40\n2026-06-01\n');
        // "2026-13-40" is calendar-invalid → strptime ValueError → skipped.
        expect(bbr._read_baseline_start(tmp)).toBe('2026-06-01');
    });

    it('reads the live repo baseline file', () => {
        const p = path.join(REPO_ROOT, 'internal', 'bench', 'baseline-start.txt');
        if (fs.existsSync(p)) {
            expect(bbr._read_baseline_start(p)).toBe('2026-05-16');
        }
    });
});

describe.runIf(hasPython3())('bench_baseline_ready — golden parity (python3 vs tsx)', () => {
    it('--json matches (timing fields normalised)', () => {
        const py = spawnSync('python3', [PY_SCRIPT, '--json'], { encoding: 'utf8', cwd: REPO_ROOT });
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT, '--json'], { encoding: 'utf8', cwd: REPO_ROOT });
        expect(ts.status).toBe(py.status);
        expect(normJson(ts.stdout)).toBe(normJson(py.stdout));
        expect(ts.stderr).toBe(py.stderr);
    });

    it('text mode matches (timing fields normalised)', () => {
        const py = spawnSync('python3', [PY_SCRIPT], { encoding: 'utf8', cwd: REPO_ROOT });
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT], { encoding: 'utf8', cwd: REPO_ROOT });
        expect(ts.status).toBe(py.status);
        expect(normText(ts.stdout)).toBe(normText(py.stdout));
        expect(ts.stderr).toBe(py.stderr);
    });

    it('missing baseline file → exit 1, identical error JSON', () => {
        const args = ['--baseline-file', 'internal/bench/does-not-exist.txt', '--json'];
        const py = spawnSync('python3', [PY_SCRIPT, ...args], { encoding: 'utf8', cwd: REPO_ROOT });
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { encoding: 'utf8', cwd: REPO_ROOT });
        expect(ts.status).toBe(1);
        expect(py.status).toBe(1);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
    });

    it('missing baseline file (text) → identical stderr', () => {
        const args = ['--baseline-file', 'internal/bench/does-not-exist.txt'];
        const py = spawnSync('python3', [PY_SCRIPT, ...args], { encoding: 'utf8', cwd: REPO_ROOT });
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { encoding: 'utf8', cwd: REPO_ROOT });
        expect(ts.status).toBe(py.status);
        expect(ts.stderr).toBe(py.stderr);
    });

    it('high min-days forces WARMUP (exit 2) consistently', () => {
        const args = ['--min-days', '99999', '--json'];
        const py = spawnSync('python3', [PY_SCRIPT, ...args], { encoding: 'utf8', cwd: REPO_ROOT });
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { encoding: 'utf8', cwd: REPO_ROOT });
        expect(ts.status).toBe(py.status);
        expect(normJson(ts.stdout)).toBe(normJson(py.stdout));
    });
});
