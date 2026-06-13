// Tests for src/scripts/build_rule_trigger_matrix.ts (py2ts Phase 8 / Wave 8g).
//
// No pytest suite existed — focused differential (python3 vs tsx) for this
// generator. It writes to a FIXED live path
// (agents/settings/contexts/rule-trigger-matrix.md), so the test snapshots
// that file, runs each generator (capturing stdout / stderr / written bytes),
// then restores the snapshot — never leaving repo drift. py and ts must
// produce byte-identical stdout, stderr, written file, and exit code on the
// same rule inputs. Skipped without python3.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'build_rule_trigger_matrix.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'build_rule_trigger_matrix.py');
const OUT = path.join(REPO_ROOT, 'agents', 'settings', 'contexts', 'rule-trigger-matrix.md');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}
const py = hasPython3();

let snapshot: string | null = null;
const outExisted = fs.existsSync(OUT);

beforeAll(() => {
    if (outExisted) {
        snapshot = fs.readFileSync(OUT, 'utf-8');
    }
});

afterAll(() => {
    // Restore the live file to exactly its pre-test state (no drift).
    if (snapshot !== null) {
        fs.writeFileSync(OUT, snapshot, 'utf-8');
    } else if (fs.existsSync(OUT)) {
        fs.rmSync(OUT, { force: true });
    }
});

describe.skipIf(!py)('build_rule_trigger_matrix — golden parity (python3 vs tsx)', () => {
    it('stdout, stderr, written file, and exit code match', () => {
        const pyRun = spawnSync('python3', [PY_SCRIPT], { cwd: REPO_ROOT, encoding: 'utf8' });
        const pyFile = fs.readFileSync(OUT, 'utf-8');

        const tsRun = spawnSync(TSX_BIN, [TS_SCRIPT], { cwd: REPO_ROOT, encoding: 'utf8' });
        const tsFile = fs.readFileSync(OUT, 'utf-8');

        expect(tsRun.status).toBe(pyRun.status);
        expect(tsRun.stdout).toBe(pyRun.stdout);
        expect(tsRun.stderr).toBe(pyRun.stderr);
        expect(tsFile).toBe(pyFile);
    });
});
