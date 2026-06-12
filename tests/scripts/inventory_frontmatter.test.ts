// Tests for src/scripts/inventory_frontmatter.ts (py2ts Phase 8 / Wave 8c).
//
// No pytest suite exists. Reader-only (Markdown to stdout, exit 0, no flags,
// no file writes). This is a golden-parity suite: python3 vs tsx on the REAL
// repo's .agent-src.uncondensed tree — byte-exact stdout/stderr/exit is the
// contract. Skipped without python3.
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'inventory_frontmatter.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'inventory_frontmatter.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

describe.runIf(hasPython3())('inventory_frontmatter — golden parity (python3 vs tsx)', () => {
    it('byte-identical stdout/stderr/exit', () => {
        const py = spawnSync('python3', [PY_SCRIPT], { encoding: 'utf8', cwd: REPO_ROOT });
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT], { encoding: 'utf8', cwd: REPO_ROOT });
        expect(ts.status).toBe(py.status);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
    });
});
