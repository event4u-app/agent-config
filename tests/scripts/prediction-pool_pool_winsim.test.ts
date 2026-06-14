// Tests for src/scripts/prediction-pool/pool_winsim.ts (py2ts Phase 1).
//
// No pytest suite exists, so this is a golden-parity suite that runs python3
// vs tsx and asserts byte-identical stdout + stderr + exit code across the
// text and --json output paths. The sim uses `random.Random(seed)`, so with a
// FIXED `--seed` the runs are fully deterministic across runtimes (PyRandom
// reproduces CPython MT19937 bit-for-bit, and `round()` is replicated
// half-to-even on the exact IEEE-754 value) — nothing needs normalisation;
// there are no wall-clock fields.
//
// The no-config argparse error wraps to terminal width (lesson #8: argparse
// PROSE is Python-version / COLUMNS-dependent), so the no-args case asserts
// exit code 2 + the stable error LINE; `-h` full help is likewise not
// byte-asserted.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'prediction-pool', 'pool_winsim.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'prediction-pool', 'pool_winsim.py');
const TSX_BIN =
    process.env.TSX_BIN ??
    path.join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

const tmpDirs: string[] = [];
function writeTmp(name: string, content: string): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'pool-winsim-'));
    const p = path.join(d, name);
    fs.writeFileSync(p, content);
    tmpDirs.push(d);
    return p;
}
afterEach(() => {
    while (tmpDirs.length > 0) {
        const d = tmpDirs.pop();
        if (d && fs.existsSync(d)) {
            fs.rmSync(d, { recursive: true, force: true });
        }
    }
});

interface RunOut {
    stdout: string;
    stderr: string;
    status: number | null;
}

function runPy(args: string[]): RunOut {
    const r = spawnSync('python3', [PY_SCRIPT, ...args], { encoding: 'utf8' });
    return { stdout: r.stdout, stderr: r.stderr, status: r.status };
}

function runTs(args: string[]): RunOut {
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { encoding: 'utf8' });
    return { stdout: r.stdout, stderr: r.stderr, status: r.status };
}

const POOL = JSON.stringify({
    rule: { exact: 5, diff: 3, tendency: 2 },
    participants: 120,
    my_lead: 0,
    field_temperature: 0.6,
    matches: [
        { match: 'A', lh: 2.0, la: 0.7 },
        { match: 'B', lh: 0.6, la: 2.1 },
        { match: 'C', lh: 1.3, la: 1.3 },
        { match: 'D', lh: 1.8, la: 1.1 },
    ],
});

// Negative float lead + non-default temperature exercises the PyFloat
// rendering paths (`-3.0`, `1.0`) and the signed text formatter.
const POOL_NEG = JSON.stringify({
    rule: { exact: 4, diff: 3, tendency: 2 },
    participants: 50,
    my_lead: -3,
    field_temperature: 1.0,
    matches: [
        { match: 'X', lh: 1.7, la: 1.2 },
        { match: 'Y', lh: 0.9, la: 0.9 },
    ],
});

describe.runIf(hasPython3())('pool_winsim — golden parity (python3 vs tsx)', () => {
    const seeds = ['1', '2', '3', '7', '42', '99', '12345'];

    it.each(seeds)('text — seed=%s runs=800 max-flips=2', (seed) => {
        const cfg = writeTmp('pool.json', POOL);
        const args = [cfg, '--runs', '800', '--max-flips', '2', '--seed', seed];
        const py = runPy(args);
        const ts = runTs(args);
        expect(ts.status).toBe(py.status);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
    });

    it.each(seeds)('json — seed=%s runs=800 max-flips=2', (seed) => {
        const cfg = writeTmp('pool.json', POOL);
        const args = [cfg, '--runs', '800', '--max-flips', '2', '--seed', seed, '--json'];
        const py = runPy(args);
        const ts = runTs(args);
        expect(ts.status).toBe(py.status);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
    });

    it('default args (seed=1 runs=4000) json', () => {
        const cfg = writeTmp('pool.json', POOL);
        const args = [cfg, '--json'];
        const py = runPy(args);
        const ts = runTs(args);
        expect(ts.status).toBe(py.status);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
    });

    it('small field (max-opponents=3) text — flips often none', () => {
        const cfg = writeTmp('pool.json', POOL);
        const args = [cfg, '--runs', '1000', '--max-opponents', '3', '--seed', '3'];
        const py = runPy(args);
        const ts = runTs(args);
        expect(ts.status).toBe(py.status);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
    });

    it('top-flip=6 json — seed=9', () => {
        const cfg = writeTmp('pool.json', POOL);
        const args = [cfg, '--runs', '1500', '--top-flip', '6', '--seed', '9', '--json'];
        const py = runPy(args);
        const ts = runTs(args);
        expect(ts.status).toBe(py.status);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
    });

    it.each([
        ['text', false],
        ['json', true],
    ] as Array<[string, boolean]>)('negative float lead + temp 1.0 — %s', (_label, asJson) => {
        const cfg = writeTmp('pool-neg.json', POOL_NEG);
        const args = [cfg, '--runs', '1000', '--seed', '4', ...(asJson ? ['--json'] : [])];
        const py = runPy(args);
        const ts = runTs(args);
        expect(ts.status).toBe(py.status);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
    });

    it('invalid int for --runs → exit 2, byte-identical', () => {
        const cfg = writeTmp('pool.json', POOL);
        const args = [cfg, '--runs', 'abc'];
        const py = runPy(args);
        const ts = runTs(args);
        expect(ts.status).toBe(2);
        expect(py.status).toBe(2);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
    });

    it('no args → exit 2 with the stable required-config error line', () => {
        const py = runPy([]);
        const ts = runTs([]);
        expect(py.status).toBe(2);
        expect(ts.status).toBe(2);
        expect(ts.stderr).toContain('the following arguments are required: config');
        expect(py.stderr).toContain('the following arguments are required: config');
    });
});
