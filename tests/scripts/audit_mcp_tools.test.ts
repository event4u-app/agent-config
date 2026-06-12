// Tests for src/scripts/audit_mcp_tools.ts (py2ts Phase 8 / Wave 8b).
//
// No pytest suite exists, so this is a focused differential suite:
//   - `--check` is deterministic on the real repo → byte-identical
//     stdout/stderr/exit (the repo's on-disk inventory may legitimately be
//     in-sync OR drifted; whichever it is, py and ts agree).
//   - `--write` byte-identical content: built into a snapshot/restore harness
//     (the script always targets the repo file), asserting the written bytes
//     and console output match and that NO git drift is left behind.
// Skipped without python3.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import * as amt from '../../src/scripts/audit_mcp_tools.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'audit_mcp_tools.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'audit_mcp_tools.py');
const TSX_BIN = path.join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

describe('audit_mcp_tools — module shape', () => {
    it('resolves the canonical catalog / tools / output paths under ROOT', () => {
        expect(amt.CATALOG.endsWith('src/scripts/mcp_server/consumer_tool_catalog.json')).toBe(true);
        expect(amt.TOOLS_PY.endsWith('src/scripts/mcp_server/tools.py')).toBe(true);
        expect(amt.OUT.endsWith('docs/contracts/mcp-tool-inventory.md')).toBe(true);
    });
});

describe.runIf(hasPython3())('audit_mcp_tools — golden parity (python3 vs tsx)', () => {
    for (const args of [['--check'], ['--check', '--quiet']]) {
        it(`--check byte-identical for: ${args.join(' ')}`, () => {
            const py = spawnSync('python3', [PY_SCRIPT, ...args], { encoding: 'utf8', cwd: REPO_ROOT });
            const ts = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { encoding: 'utf8', cwd: REPO_ROOT });
            expect(ts.status).toBe(py.status);
            expect(ts.stdout).toBe(py.stdout);
            expect(ts.stderr).toBe(py.stderr);
        });
    }

    it('--write produces byte-identical content + console output, zero git drift', () => {
        const out = amt.OUT;
        const snapshot = fs.existsSync(out) ? fs.readFileSync(out) : null;
        try {
            const py = spawnSync('python3', [PY_SCRIPT, '--write'], { encoding: 'utf8', cwd: REPO_ROOT });
            const pyWritten = fs.readFileSync(out, 'utf-8');
            // restore before the TS write so both start from the same state
            if (snapshot !== null) {
                fs.writeFileSync(out, snapshot);
            } else {
                fs.rmSync(out, { force: true });
            }
            const ts = spawnSync(TSX_BIN, [TS_SCRIPT, '--write'], { encoding: 'utf8', cwd: REPO_ROOT });
            const tsWritten = fs.readFileSync(out, 'utf-8');

            expect(ts.status).toBe(py.status);
            expect(ts.stdout).toBe(py.stdout);
            expect(ts.stderr).toBe(py.stderr);
            expect(tsWritten).toBe(pyWritten);
        } finally {
            if (snapshot !== null) {
                fs.writeFileSync(out, snapshot);
            } else {
                fs.rmSync(out, { force: true });
            }
        }
        // confirm the working tree is unchanged for the inventory file
        const status = spawnSync('git', ['status', '--porcelain', out], { encoding: 'utf8', cwd: REPO_ROOT });
        expect(status.stdout.trim()).toBe('');
    });
});
