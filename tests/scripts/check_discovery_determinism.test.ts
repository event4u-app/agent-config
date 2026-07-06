// Tests for src/scripts/check_discovery_determinism.ts (py2ts Phase 4 / Wave 4c).
//
// No pytest suite exists for this module. The tsx twin is the source of truth
// (the python original was deleted in the teardown). It re-scans discovery on
// the REAL REPO and asserts determinism — the CLI prints an OK line + exit 0.
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check_discovery_determinism.ts');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function runTs() {
    return spawnSync(TSX_BIN, [TS_SCRIPT], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        maxBuffer: 256 * 1024 * 1024,
    });
}

describe('check_discovery_determinism — CLI contract', () => {
    it('prints a deterministic OK line + exit 0', () => {
        const a = runTs();
        expect(a.status, a.stderr).toBe(0);
        expect(a.stdout).toContain('OK');
        expect(runTs().stdout).toBe(a.stdout);
    });
});
