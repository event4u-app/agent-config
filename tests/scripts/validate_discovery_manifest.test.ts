// Tests for src/scripts/validate_discovery_manifest.ts (py2ts Phase 4 / Wave 4c).
//
// No pytest suite exists. The tsx twin is the source of truth (the python
// original was deleted in the teardown). It re-scans discovery and diffs the
// fresh build against the committed dist/discovery/discovery-manifest.json.
// The committed manifest is gitignored and can drift, so the contract is a
// defined, deterministic exit — not a fixed code. Skipped without the manifest.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'validate_discovery_manifest.ts');
const COMMITTED = path.join(REPO_ROOT, 'dist', 'discovery', 'discovery-manifest.json');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

const big = { maxBuffer: 256 * 1024 * 1024, cwd: REPO_ROOT, encoding: 'utf8' as const };

describe.runIf(fs.existsSync(COMMITTED))('validate_discovery_manifest — CLI contract', () => {
    function runTs(args: readonly string[]) {
        return spawnSync(TSX_BIN, [TS_SCRIPT, ...args], big);
    }

    for (const args of [[], ['--quiet']] as const) {
        it(`runs deterministically against the committed manifest: ${
            args.join(' ') || '(no args)'
        }`, () => {
            const a = runTs(args);
            expect(a.status, a.stderr).not.toBeNull();
            const b = runTs(args);
            expect(b.stdout).toBe(a.stdout);
            expect(b.status).toBe(a.status);
        });
    }
});
