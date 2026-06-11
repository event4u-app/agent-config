// Tests for src/scripts/lint_commit_subjects.ts (py2ts Phase 4 / Wave 4b).
//
// The pytest suite tests/test_lint_commit_subjects.py is ported 1:1 over the
// `check_subject` surface, plus a golden-parity layer running python3 vs tsx
// on the REAL REPO (skipped without python3). The commit-subjects workflow
// runs `--base <sha> --head <sha>`, so parity probes that shape.
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import * as lcs from '../../src/scripts/lint_commit_subjects.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_commit_subjects.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_commit_subjects.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

// --- Clean subjects — must pass with zero issues. ---
describe('lint_commit_subjects.check_subject — clean', () => {
    it.each([
        'feat(roadmaps): add Iron Law 3 — block silent archive of [~] deferred items',
        'fix: prevent silent archive of deferred items',
        'fix(wizard): prefill roles + packs from saved state for returning users',
        'chore(roadmaps): regenerate dashboard after archiving',
        'docs(adr): land ADR-033 distribution-identity npm-primary',
        'refactor: split parse_frontmatter into loader + injector helpers',
        'feat!: drop Composer surface; npm-primary per ADR-033',
        'chore: bump @event4u/agent-config to 5.1.0',
    ])('passes: %s', (subject) => {
        expect(lcs.check_subject(subject)).toEqual([]);
    });
});

// --- Short subjects — body after type-prefix < MIN_SUBJECT_LEN. ---
describe('lint_commit_subjects.check_subject — short', () => {
    it.each(['fix: bug', 'feat: x', 'chore: typo', 'wip', 'tmp', 'fix'])(
        'flags: %s',
        (subject) => {
            expect(lcs.check_subject(subject).length).toBeGreaterThan(0);
        },
    );
});

// --- Blocklist tokens. ---
describe('lint_commit_subjects.check_subject — blocklist', () => {
    it.each([
        'chore: commit leftovers from yesterday',
        'fix: wip on the wizard prefill logic',
        'chore: temp commit to capture progress',
        'chore(roadmaps): fixup the dashboard regen',
        'fix: tmp shim until the loader patch lands',
        'feat: add LEFTOVER cleanup script',
    ])('flags blocklist token: %s', (subject) => {
        const issues = lcs.check_subject(subject);
        expect(issues.length).toBeGreaterThan(0);
        expect(issues.some((i) => i.includes('blocklist token'))).toBe(true);
    });
});

// --- Whole-word matching — no false positives. ---
describe('lint_commit_subjects.check_subject — whole-word', () => {
    it.each(['feat: add template for new roadmaps', 'docs: clarify temporary auth flow'])(
        'no blocklist false-positive: %s',
        (subject) => {
            const issues = lcs.check_subject(subject);
            expect(issues.some((i) => i.includes('blocklist'))).toBe(false);
        },
    );
});

// --- Carve-outs — merge/revert subjects skipped. ---
describe('lint_commit_subjects.check_subject — carve-outs', () => {
    it.each([
        'Merge pull request #287 from event4u-app/feat/preserve-deferred-roadmap-scope',
        "Merge branch 'main' into feat/distribution-identity",
        "Merge remote-tracking branch 'origin/main'",
        'Revert "fix: wip on the dashboard regen"',
    ])('skips: %s', (subject) => {
        expect(lcs.check_subject(subject)).toEqual([]);
    });
});

// --- Golden parity on the REAL REPO ----------------------------------------

const py3 = hasPython3();

describe.skipIf(!py3)('lint_commit_subjects — golden parity (python3 vs tsx)', () => {
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

    it('default (origin/main..HEAD) matches', () => same([]));
    it('--quiet matches', () => same(['--quiet']));
    // The commit-subjects workflow shape: explicit --base / --head.
    it('--base HEAD~3 --head HEAD matches', () => same(['--base', 'HEAD~3', '--head', 'HEAD']));
    it('empty range (--base HEAD --head HEAD) matches', () =>
        same(['--base', 'HEAD', '--head', 'HEAD']));
});
