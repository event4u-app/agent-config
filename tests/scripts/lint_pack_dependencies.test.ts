// Tests for src/scripts/lint_pack_dependencies.ts (py2ts Phase 4 / Wave 4b).
//
// No pytest suite exists, and the module exposes only `main()`. The tsx twin
// is the source of truth (the python original was deleted in the teardown).
// The CLI contract runs the bare `lint_pack_dependencies` (no flags) on the
// REAL REPO: exit 0 + deterministic. Invoked in CI via the
// `task generate-pack-manifests` lint cadence.
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_pack_dependencies.ts');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function runTs() {
    return spawnSync(TSX_BIN, [TS_SCRIPT], { cwd: REPO_ROOT, encoding: 'utf8' });
}

describe('lint_pack_dependencies — CLI contract', () => {
    it('default run passes cleanly over the repo (exit 0, deterministic)', () => {
        const a = runTs();
        expect(a.status, a.stderr).toBe(0);
        expect(runTs().stdout).toBe(a.stdout);
    });
});
