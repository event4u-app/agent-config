// Tests for src/scripts/prediction-pool/score_ev.ts (py2ts Phase 8).
//
// No pytest suite exists, so this is a golden-parity suite that runs python3
// vs tsx and asserts byte-identical stdout + stderr + exit code across the
// text and --json output paths, single-lambda and JSON-batch inputs, and the
// error paths.
//
// score_ev is a pure deterministic computation (Poisson grid, NO RNG — its
// siblings poisson_sim / pool_winsim use RNG and are out of scope), so the
// output is fully reproducible cross-runtime; nothing needs normalisation.
//
// The no-input argparse error wraps its usage block to the terminal width,
// which is environment-dependent (lesson #8: argparse error PROSE is
// Python-version / COLUMNS-dependent) — so the error case asserts exit code 2
// and that the stable error LINE is present, not the full byte stream.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'prediction-pool', 'score_ev.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'prediction-pool', 'score_ev.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

const tmpFiles: string[] = [];
function writeTmp(name: string, content: string): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'score-ev-'));
    const p = path.join(d, name);
    fs.writeFileSync(p, content);
    tmpFiles.push(d);
    return p;
}
afterEach(() => {
    while (tmpFiles.length > 0) {
        const d = tmpFiles.pop();
        if (d && fs.existsSync(d)) {
            fs.rmSync(d, { recursive: true, force: true });
        }
    }
});

describe.runIf(hasPython3())('score_ev — golden parity (python3 vs tsx)', () => {
    const cases: Array<{ label: string; args: string[] }> = [
        { label: 'text — moderate favourite', args: ['--lh', '2.0', '--la', '0.7'] },
        { label: 'text — kicktipp 2/3/5 underdog', args: ['--lh', '0.6', '--la', '2.1', '--tendency', '2', '--diff', '3', '--exact', '5'] },
        { label: 'text — even draw-likely', args: ['--lh', '1.5', '--la', '1.5'] },
        { label: 'text — zero rates', args: ['--lh', '0', '--la', '0'] },
        { label: 'text — custom top + max-tip', args: ['--lh', '2.3', '--la', '1.1', '--top', '3', '--max-tip', '4'] },
        { label: 'json — moderate favourite', args: ['--lh', '2.0', '--la', '0.7', '--json'] },
        { label: 'json — kicktipp config', args: ['--lh', '0.6', '--la', '2.1', '--tendency', '2', '--diff', '3', '--exact', '5', '--json'] },
        { label: 'json — fractional lambdas, top 2', args: ['--lh', '1.234', '--la', '0.876', '--top', '2', '--json'] },
    ];
    for (const { label, args } of cases) {
        it(`byte-identical: ${label}`, () => {
            const py = spawnSync('python3', [PY_SCRIPT, ...args], { encoding: 'utf8', cwd: REPO_ROOT });
            const ts = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { encoding: 'utf8', cwd: REPO_ROOT });
            expect(ts.status).toBe(py.status);
            expect(ts.stdout).toBe(py.stdout);
            expect(ts.stderr).toBe(py.stderr);
        });
    }

    it('byte-identical: JSON batch input (text mode)', () => {
        const matches = JSON.stringify([
            { match: 'Senegal-Iraq', lh: 2.0, la: 0.7 },
            { match: 'Qatar-Switzerland', lh: 0.6, la: 2.1 },
        ]);
        const file = writeTmp('m.json', matches);
        const args = [file, '--tendency', '2', '--diff', '3', '--exact', '5'];
        const py = spawnSync('python3', [PY_SCRIPT, ...args], { encoding: 'utf8', cwd: REPO_ROOT });
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { encoding: 'utf8', cwd: REPO_ROOT });
        expect(ts.status).toBe(py.status);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
    });

    it('byte-identical: JSON batch input (--json mode)', () => {
        const matches = JSON.stringify([
            { match: 'A-B', lh: 1.8, la: 1.1 },
            { match: 'C-D', lh: 0.9, la: 0.9 },
        ]);
        const file = writeTmp('m.json', matches);
        const args = [file, '--json'];
        const py = spawnSync('python3', [PY_SCRIPT, ...args], { encoding: 'utf8', cwd: REPO_ROOT });
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { encoding: 'utf8', cwd: REPO_ROOT });
        expect(ts.status).toBe(py.status);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
    });

    // Error path: no input. argparse wraps the usage block to terminal width
    // (env-dependent), so assert exit 2 + the stable error line, not the full
    // byte stream.
    it('no input → exit 2 with the same error line on stderr', () => {
        const py = spawnSync('python3', [PY_SCRIPT], { encoding: 'utf8', cwd: REPO_ROOT });
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT], { encoding: 'utf8', cwd: REPO_ROOT });
        expect(ts.status).toBe(2);
        expect(py.status).toBe(2);
        expect(ts.stdout).toBe('');
        expect(py.stdout).toBe('');
        const line = 'score_ev.py: error: provide either a matches JSON file or --lh and --la';
        expect(ts.stderr).toContain(line);
        expect(py.stderr).toContain(line);
    });
});
