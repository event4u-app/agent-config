// Contract tests for src/scripts/print_required_checks.ts (py2ts Phase 8).
//
// Covers the PR shapes (feature / release / docs-only), `=`-joined flags, and
// the argparse error paths over deterministic `--branch`/`--base HEAD`
// invocations (`--base HEAD` → empty diff in any checkout). Read-only, no git
// drift. The tsx twin is the source of truth (the python original was deleted
// in the teardown).
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
        // Every case passes an explicit --branch: the no-flag path auto-detects
        // the current git branch (env-dependent — differs local vs CI), so it is
        // intentionally excluded from the pinned snapshot.
        const shapes: Record<string, string[]> = {
            feature: ['--branch', 'feat/x', '--base', 'HEAD'],
            release: ['--branch', 'release/1.2.3', '--base', 'HEAD'],
            'docs-only': ['--branch', 'docs/x', '--base', 'HEAD'],
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
          Checks this PR will face (16):
            ! Sync + Generate Tools Consistency
            - Smoke — kernel
            - Smoke — router
            - Smoke — schema
            - Smoke — skills
            - skill-lint
            - Static Checks (ESLint · typecheck · prepack)
            - Install Script Tests (matrix: {ubuntu,macos}-latest × shard 1-4/4)
            - Install Aux Tests (matrix: {ubuntu,macos}-latest)
            - Node Tests (matrix: {ubuntu,macos}-latest × shard 1-4/4)
            - Golden Tests (matrix: {ubuntu,macos}-latest)
            - Workspace Tests (matrix: {ubuntu,macos}-latest)
            - Public Install Smoke (matrix: {ubuntu,macos,windows}-latest × node {20,22})
            - Rule backstops
            - no-python-in-src
            - lint commit subjects

          ! = blocks merge (1 of 16); - = runs, visible, advisory
          Contract: docs/contracts/branch-protection-policy.md (per-PR-shape matrix)
          ",
            "eq-joined": "Branch: feat/y
          Base:   HEAD
          PR shape: feature  (0 file(s) in diff)
          Checks this PR will face (16):
            ! Sync + Generate Tools Consistency
            - Smoke — kernel
            - Smoke — router
            - Smoke — schema
            - Smoke — skills
            - skill-lint
            - Static Checks (ESLint · typecheck · prepack)
            - Install Script Tests (matrix: {ubuntu,macos}-latest × shard 1-4/4)
            - Install Aux Tests (matrix: {ubuntu,macos}-latest)
            - Node Tests (matrix: {ubuntu,macos}-latest × shard 1-4/4)
            - Golden Tests (matrix: {ubuntu,macos}-latest)
            - Workspace Tests (matrix: {ubuntu,macos}-latest)
            - Public Install Smoke (matrix: {ubuntu,macos,windows}-latest × node {20,22})
            - Rule backstops
            - no-python-in-src
            - lint commit subjects

          ! = blocks merge (1 of 16); - = runs, visible, advisory
          Contract: docs/contracts/branch-protection-policy.md (per-PR-shape matrix)
          ",
            "feature": "Branch: feat/x
          Base:   HEAD
          PR shape: feature  (0 file(s) in diff)
          Checks this PR will face (16):
            ! Sync + Generate Tools Consistency
            - Smoke — kernel
            - Smoke — router
            - Smoke — schema
            - Smoke — skills
            - skill-lint
            - Static Checks (ESLint · typecheck · prepack)
            - Install Script Tests (matrix: {ubuntu,macos}-latest × shard 1-4/4)
            - Install Aux Tests (matrix: {ubuntu,macos}-latest)
            - Node Tests (matrix: {ubuntu,macos}-latest × shard 1-4/4)
            - Golden Tests (matrix: {ubuntu,macos}-latest)
            - Workspace Tests (matrix: {ubuntu,macos}-latest)
            - Public Install Smoke (matrix: {ubuntu,macos,windows}-latest × node {20,22})
            - Rule backstops
            - no-python-in-src
            - lint commit subjects

          ! = blocks merge (1 of 16); - = runs, visible, advisory
          Contract: docs/contracts/branch-protection-policy.md (per-PR-shape matrix)
          ",
            "release": "Branch: release/1.2.3
          Base:   HEAD
          PR shape: release  (0 file(s) in diff)
          Checks this PR will face (11):
            ! Sync + Generate Tools Consistency
            - Smoke — kernel
            - Smoke — router
            - Smoke — schema
            - Smoke — skills
            - Release-PR shape detector
            - CHANGELOG entry exists for head version
            - package.json / marketplace.json / pack manifests agree
            - Release install E2E (pack → install → upgrade → boot)
            - npm audit (runtime deps, high+)
            - skill-lint-strict

          ! = blocks merge (1 of 11); - = runs, visible, advisory
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
