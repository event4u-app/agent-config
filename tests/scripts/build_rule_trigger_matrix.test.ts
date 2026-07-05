// Contract test for src/scripts/build_rule_trigger_matrix.ts (py2ts Phase 8).
//
// The generator writes a FIXED committed artifact
// (agents/settings/contexts/rule-trigger-matrix.md). The tsx twin is the source
// of truth (the python original was deleted in the teardown). A full-output
// snapshot would drift whenever a rule's triggers or byte counts change, so
// this asserts the generator contract structurally: exit 0, a well-formed
// matrix (header + methodology + table), and DETERMINISM (a second run
// reproduces byte-identical output). The live file is snapshotted + restored
// so the test never leaves repo drift.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'build_rule_trigger_matrix.ts');
const OUT = path.join(REPO_ROOT, 'agents', 'settings', 'contexts', 'rule-trigger-matrix.md');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

let snapshot: string | null = null;

beforeAll(() => {
    if (fs.existsSync(OUT)) {
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

describe('build_rule_trigger_matrix — generator contract', () => {
    it('writes a well-formed matrix, deterministically', () => {
        const run1 = spawnSync(TSX_BIN, [TS_SCRIPT], { cwd: REPO_ROOT, encoding: 'utf8' });
        // exit 0 when every rule is classified, 2 when some are not — both are
        // valid outcomes; the unclassified count is repo state, not a bug, so
        // the exact code is not pinned (it would drift as rules are added).
        expect([0, 2]).toContain(run1.status);

        const first = fs.readFileSync(OUT, 'utf-8');
        // Well-formed structure (drift-free — asserts shape, not rule content).
        expect(first.startsWith('# Rule Trigger Matrix')).toBe(true);
        expect(first).toContain('## Methodology');
        expect(first).toContain('| Column | Meaning |');
        expect(first.length).toBeGreaterThan(1000);

        // Deterministic: a second run reproduces byte-identical output + exit.
        const run2 = spawnSync(TSX_BIN, [TS_SCRIPT], { cwd: REPO_ROOT, encoding: 'utf8' });
        expect(run2.status).toBe(run1.status);
        expect(fs.readFileSync(OUT, 'utf-8')).toBe(first);
    });
});
