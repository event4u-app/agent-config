// Tests for src/scripts/prediction-pool/poisson_sim.ts (py2ts Phase 1).
//
// No pytest suite exists, so this is a golden-parity suite that runs python3
// vs tsx and asserts byte-identical stdout + stderr + exit code. The sim uses
// `random.Random(seed)`, so with a FIXED `--seed` the runs are fully
// deterministic across runtimes (PyRandom reproduces CPython MT19937
// bit-for-bit) — nothing needs normalisation; there are no wall-clock fields.
//
// The no-config argparse error wraps its usage block to the terminal width,
// which is environment-dependent (lesson #8: argparse error PROSE is
// Python-version / COLUMNS-dependent), so the no-args case asserts exit code 2
// and the stable error LINE, not the full byte stream. Likewise `-h` full help
// is COLUMNS-dependent and is not byte-asserted.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'prediction-pool', 'poisson_sim.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'prediction-pool', 'poisson_sim.py');
const TSX_BIN =
    process.env.TSX_BIN ??
    path.join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

const tmpDirs: string[] = [];
function writeTmp(name: string, content: string): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'poisson-sim-'));
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

const TEAMS = JSON.stringify({
    base_goals: 1.35,
    teams: {
        Germany: { att: 1.4, def: 0.7 },
        Scotland: { att: 0.8, def: 1.2 },
        Hungary: { att: 1.0, def: 1.0 },
        Switzerland: { att: 1.1, def: 0.9 },
        Spain: { att: 1.5, def: 0.75 },
        Croatia: { att: 1.05, def: 0.95 },
        Italy: { att: 1.2, def: 0.8 },
        Albania: { att: 0.7, def: 1.3 },
    },
    groups: [
        ['Germany', 'Scotland', 'Hungary', 'Switzerland'],
        ['Spain', 'Croatia', 'Italy', 'Albania'],
    ],
    advance_per_group: 2,
});

const NO_GROUPS = JSON.stringify({
    base_goals: 1.4,
    teams: { A: { att: 1.2, def: 0.9 }, B: { att: 0.9, def: 1.1 }, C: { att: 1.0, def: 1.0 } },
});

describe.runIf(hasPython3())('poisson_sim — golden parity (python3 vs tsx)', () => {
    const cases: Array<{ label: string; seed: string; runs: string; fixture: string }> = [
        { label: 'groups runs=500 seed=0', seed: '0', runs: '500', fixture: TEAMS },
        { label: 'groups runs=500 seed=1', seed: '1', runs: '500', fixture: TEAMS },
        { label: 'groups runs=500 seed=7', seed: '7', runs: '500', fixture: TEAMS },
        { label: 'groups runs=300 seed=42', seed: '42', runs: '300', fixture: TEAMS },
        { label: 'groups runs=1000 seed=999', seed: '999', runs: '1000', fixture: TEAMS },
        { label: 'no-groups runs=600 seed=8', seed: '8', runs: '600', fixture: NO_GROUPS },
    ];

    it.each(cases)('$label', ({ seed, runs, fixture }) => {
        const cfg = writeTmp('config.json', fixture);
        const args = [cfg, '--runs', runs, '--seed', seed];
        const py = runPy(args);
        const ts = runTs(args);
        expect(ts.status).toBe(py.status);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
    });

    it('missing config file → exit 2, byte-identical', () => {
        const args = [path.join(os.tmpdir(), 'definitely-missing-poisson.json'), '--seed', '1'];
        const py = runPy(args);
        const ts = runTs(args);
        expect(ts.status).toBe(2);
        expect(py.status).toBe(2);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
    });

    it("config without 'teams' → exit 2, byte-identical", () => {
        const cfg = writeTmp('noteams.json', JSON.stringify({ base_goals: 1.3 }));
        const args = [cfg, '--seed', '1'];
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
        // The usage block wraps to terminal width (env-dependent); assert the
        // stable error line both runtimes emit.
        expect(ts.stderr).toContain('the following arguments are required: config');
        expect(py.stderr).toContain('the following arguments are required: config');
    });
});
