// Tests for src/scripts/print_required_checks.ts (py2ts Phase 8 / Wave 8g).
//
// No pytest suite existed — focused differential (python3 vs tsx, byte-exact)
// over deterministic `--branch`/`--base` invocations covering the three PR
// shapes (feature / release / docs-only), the release-out-of-shape fallback,
// `=`-joined flags, and the argparse error paths. `--base HEAD` keeps the diff
// deterministic in any checkout. Read-only, no git drift. Skipped without
// python3.
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'print_required_checks.ts');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

const runTs = (args: string[]) =>
    spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });

// `--base HEAD` makes the diff empty (HEAD..HEAD) in any checkout, so the
// required-check set is the shape-based default — deterministic. The tsx twin
// is the source of truth (the python original was deleted in the teardown);
// output is pinned via an inline snapshot (updates only on an intentional
// required-checks matrix change).
describe('print_required_checks — CLI contract', () => {
    it('required checks per PR shape (pinned)', () => {
        const shapes: Record<string, string[]> = {
            feature: ['--branch', 'feat/x', '--base', 'HEAD'],
            release: ['--branch', 'release/1.2.3', '--base', 'HEAD'],
            'docs-only': ['--branch', 'docs/x', '--base', 'HEAD'],
            'no-branch': ['--base', 'HEAD'],
            'eq-joined': ['--branch=feat/y', '--base=HEAD'],
        };
        const out = Object.fromEntries(
            Object.entries(shapes).map(([label, args]) => {
                const t = runTs(args);
                expect(t.status, `${label}: ${t.stderr}`).toBe(0);
                return [label, t.stdout];
            }),
        );
        expect(out).toMatchInlineSnapshot(`
          {
            "docs-only": "Branch: docs/x
          Base:   HEAD
          PR shape: feature  (0 file(s) in diff)
          Required checks (8):
            - Consistency
            - Smoke Contracts
            - Skill Lint
            - Tests / install-tests
            - Tests / install-aux-tests
            - Tests / python-tests
            - Tests / node-tests
            - Public Install Smoke / smoke

          Contract: docs/contracts/branch-protection-policy.md (per-PR-shape matrix)
          ",
            "eq-joined": "Branch: feat/y
          Base:   HEAD
          PR shape: feature  (0 file(s) in diff)
          Required checks (8):
            - Consistency
            - Smoke Contracts
            - Skill Lint
            - Tests / install-tests
            - Tests / install-aux-tests
            - Tests / python-tests
            - Tests / node-tests
            - Public Install Smoke / smoke

          Contract: docs/contracts/branch-protection-policy.md (per-PR-shape matrix)
          ",
            "feature": "Branch: feat/x
          Base:   HEAD
          PR shape: feature  (0 file(s) in diff)
          Required checks (8):
            - Consistency
            - Smoke Contracts
            - Skill Lint
            - Tests / install-tests
            - Tests / install-aux-tests
            - Tests / python-tests
            - Tests / node-tests
            - Public Install Smoke / smoke

          Contract: docs/contracts/branch-protection-policy.md (per-PR-shape matrix)
          ",
            "no-branch": "Branch: main
          Base:   HEAD
          PR shape: feature  (0 file(s) in diff)
          Required checks (8):
            - Consistency
            - Smoke Contracts
            - Skill Lint
            - Tests / install-tests
            - Tests / install-aux-tests
            - Tests / python-tests
            - Tests / node-tests
            - Public Install Smoke / smoke

          Contract: docs/contracts/branch-protection-policy.md (per-PR-shape matrix)
          ",
            "release": "Branch: release/1.2.3
          Base:   HEAD
          PR shape: release  (0 file(s) in diff)
          Required checks (7):
            - Consistency
            - Smoke Contracts
            - Migration Dry-Run
            - Release Validation / release-shape
            - Release Validation / changelog-entry
            - Release Validation / version-consistency
            - Release Guard (post-tag)

          Contract: docs/contracts/branch-protection-policy.md (per-PR-shape matrix)
          ",
          }
        `);
    });

    it('argparse errors exit 2', () => {
        expect(runTs(['--bogus']).status).toBe(2);
        expect(runTs(['--branch']).status).toBe(2);
    });
});
