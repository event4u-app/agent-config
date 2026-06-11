// Tests for src/scripts/lint_media_policy_linkage.ts (py2ts Phase 4 / Wave 4b).
//
// No pytest suite exists. Focused differential over the public helpers
// (collect_policies, collect_scan_files, referrers_for) against the REAL REPO,
// plus a golden-parity layer running python3 vs tsx (skipped without python3).
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import * as mpl from '../../src/scripts/lint_media_policy_linkage.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_media_policy_linkage.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_media_policy_linkage.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

describe('lint_media_policy_linkage — helpers (real repo)', () => {
    it('collect_policies returns sorted *.md excluding README', () => {
        const policies = mpl.collect_policies();
        // Either zero (dir absent) or a sorted list with no README.
        const names = policies.map((p) => path.basename(p));
        expect(names.includes('README.md')).toBe(false);
        expect([...names].sort()).toEqual(names); // already sorted
    });

    it('collect_scan_files only returns existing *.md files', () => {
        const files = mpl.collect_scan_files();
        for (const f of files) {
            expect(f.endsWith('.md')).toBe(true);
        }
    });

    it('every policy has at least one referrer (the CI invariant)', () => {
        const policies = mpl.collect_policies();
        const scan = mpl.collect_scan_files();
        for (const p of policies) {
            expect(mpl.referrers_for(p, scan).length).toBeGreaterThan(0);
        }
    });

    it('a policy never satisfies its own linkage requirement', () => {
        const policies = mpl.collect_policies();
        if (policies.length === 0) {
            return; // dir absent — nothing to assert
        }
        const p = policies[0]!;
        // Scanning only itself yields no referrers (self is excluded).
        expect(mpl.referrers_for(p, [p])).toEqual([]);
    });
});

// --- Golden parity on the REAL REPO ----------------------------------------

const py3 = hasPython3();

describe.skipIf(!py3)('lint_media_policy_linkage — golden parity (python3 vs tsx)', () => {
    function runPy(args: readonly string[]) {
        return spawnSync('python3', [PY_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    }
    function runTs(args: readonly string[]) {
        return spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    }
    function same(args: readonly string[]): void {
        const py = runPy(args);
        const ts = runTs(args);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    }

    it('default run matches byte-for-byte', () => same([]));
    it('--quiet matches byte-for-byte', () => same(['--quiet']));
});
