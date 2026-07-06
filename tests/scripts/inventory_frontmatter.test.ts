// Tests for src/scripts/inventory_frontmatter.ts (py2ts Phase 8 / Wave 8c).
//
// No pytest suite exists. Reader-only (Markdown to stdout, exit 0, no flags,
// no file writes). The tsx twin is the source of truth (the python original
// was deleted in the teardown); output is repo-derived → asserted structurally
// (exit 0, non-empty, deterministic).
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'inventory_frontmatter.ts');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function runTs() {
    return spawnSync(TSX_BIN, [TS_SCRIPT], { encoding: 'utf8', cwd: REPO_ROOT });
}

describe('inventory_frontmatter — CLI contract', () => {
    it('runs deterministically over the repo (exit 0, non-empty)', () => {
        const a = runTs();
        expect(a.status, a.stderr).toBe(0);
        expect(a.stdout.length).toBeGreaterThan(0);
        expect(runTs().stdout).toBe(a.stdout);
    });
});
