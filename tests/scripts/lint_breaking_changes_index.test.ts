// Tests for src/scripts/lint_breaking_changes_index.ts (road-to-feedback-9.0 P1.4).
//
// Two layers:
//   1. Pure-function fixtures (no git) — the MUST-FAIL / PASS matrix over the
//      `evaluate` decision: a released BREAKING added without an index change
//      FAILS; with the index changed passes; with the override passes; and a
//      breaking note under [Unreleased] never trips.
//   2. A fixture git repo mirroring check_structural_breaking.test.ts — proves
//      the CLI wires the diff/blob/log reads to the same decision and exits
//      non-zero then zero.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    added_released_breaking_majors,
    evaluate,
    released_breaking_majors,
} from '../../src/scripts/lint_breaking_changes_index.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_breaking_changes_index.ts');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

// ─── layer 1: pure-function fixtures ─────────────────────────────────────────

const RELEASED_WITH_BREAKING =
    '# Changelog\n\n## [Unreleased]\n\n' +
    '## [9.0.0](https://example/compare/8.13.0...9.0.0) (2026-07-13)\n\n' +
    '### BREAKING CHANGES\n\n* installer path changed\n';
const RELEASED_NO_BREAKING =
    '# Changelog\n\n## [Unreleased]\n\n' +
    '## [9.0.0](https://example/compare/8.13.0...9.0.0) (2026-07-13)\n\n' +
    '### Features\n\n* a feature\n';
const UNRELEASED_BREAKING_ONLY =
    '# Changelog\n\n## [Unreleased]\n\n### BREAKING CHANGES\n\n* wip break\n';

const L = (s: string): string[] => s.split('\n');

describe('lint_breaking_changes_index — pure decision fixtures', () => {
    it('MUST-FAIL: released BREAKING added, index untouched, no override', () => {
        const r = evaluate(L(RELEASED_NO_BREAKING), L(RELEASED_WITH_BREAKING), false, false);
        expect(r.violation).toBe(true);
        expect(r.addedMajors).toEqual(['9.0.0']);
    });

    it('PASS: index changed in the same diff', () => {
        const r = evaluate(L(RELEASED_NO_BREAKING), L(RELEASED_WITH_BREAKING), true, false);
        expect(r.violation).toBe(false);
    });

    it('PASS: override token present', () => {
        const r = evaluate(L(RELEASED_NO_BREAKING), L(RELEASED_WITH_BREAKING), false, true);
        expect(r.violation).toBe(false);
    });

    it('PASS: BREAKING only under [Unreleased] (WIP) does not trip', () => {
        const r = evaluate(L('# Changelog\n'), L(UNRELEASED_BREAKING_ONLY), false, false);
        expect(r.violation).toBe(false);
        expect(r.addedMajors).toEqual([]);
    });

    it('released_breaking_majors sees released, skips Unreleased', () => {
        expect([...released_breaking_majors(L(RELEASED_WITH_BREAKING))]).toEqual(['9.0.0']);
        expect([...released_breaking_majors(L(UNRELEASED_BREAKING_ONLY))]).toEqual([]);
    });

    it('added_released_breaking_majors is empty when BREAKING pre-existed', () => {
        expect(
            added_released_breaking_majors(L(RELEASED_WITH_BREAKING), L(RELEASED_WITH_BREAKING)),
        ).toEqual([]);
    });
});

// ─── layer 2: fixture git repo (end-to-end CLI) ──────────────────────────────

function hasGit(): boolean {
    return spawnSync('git', ['--version'], { encoding: 'utf8' }).status === 0;
}
function mkTmp(): string {
    return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'lbci-')));
}
function write(root: string, rel: string, content: string): void {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content, 'utf-8');
}
function git(root: string, ...args: string[]) {
    return spawnSync('git', args, {
        cwd: root,
        encoding: 'utf8',
        env: {
            ...process.env,
            GIT_AUTHOR_NAME: 'T',
            GIT_AUTHOR_EMAIL: 't@e',
            GIT_COMMITTER_NAME: 'T',
            GIT_COMMITTER_EMAIL: 't@e',
        },
    });
}
function fixtureRepo(): { root: string; ts: string } {
    const root = mkTmp();
    git(root, 'init', '-q', '-b', 'main');
    fs.mkdirSync(path.join(root, 'src', 'scripts'), { recursive: true });
    const ts = path.join(root, 'src', 'scripts', 'lint_breaking_changes_index.ts');
    fs.copyFileSync(TS_SCRIPT, ts);
    fs.symlinkSync(path.join(REPO_ROOT, 'node_modules'), path.join(root, 'node_modules'));
    return { root, ts };
}
function setOrigin(root: string): void {
    const head = git(root, 'rev-parse', 'HEAD').stdout.trim();
    git(root, 'update-ref', 'refs/remotes/origin/main', head);
}
function runCli(fx: { root: string; ts: string }) {
    return spawnSync(TSX_BIN, [fx.ts], { cwd: fx.root, encoding: 'utf8' });
}

const CHANGELOG_BASE = '# Changelog\n\n## [Unreleased]\n\n';
const CHANGELOG_WITH_BREAKING =
    CHANGELOG_BASE +
    '## [9.0.0](https://example/compare/8.13.0...9.0.0) (2026-07-13)\n\n### BREAKING CHANGES\n\n* installer path changed\n';

(hasGit() ? describe : describe.skip)('lint_breaking_changes_index — fixture git repo', () => {
    let fx: { root: string; ts: string };
    beforeEach(() => {
        fx = fixtureRepo();
        write(fx.root, 'CHANGELOG.md', CHANGELOG_BASE);
        write(fx.root, 'BREAKING_CHANGES.md', '# Breaking Changes\n');
        git(fx.root, 'add', '-A');
        git(fx.root, 'commit', '-qm', 'base');
        setOrigin(fx.root);
    });
    afterEach(() => {
        fs.rmSync(fx.root, { recursive: true, force: true });
    });

    it('released BREAKING added without index change → exit 1', () => {
        write(fx.root, 'CHANGELOG.md', CHANGELOG_WITH_BREAKING);
        git(fx.root, 'add', '-A');
        git(fx.root, 'commit', '-qm', 'chore(release): 9.0.0');
        const r = runCli(fx);
        expect(r.status, r.stderr).toBe(1);
        expect(r.stderr).toContain('## [9.0.0]');
    });

    it('released BREAKING added WITH index change → exit 0', () => {
        write(fx.root, 'CHANGELOG.md', CHANGELOG_WITH_BREAKING);
        write(fx.root, 'BREAKING_CHANGES.md', '# Breaking Changes\n\n## 9.0.0\n\n* installer path\n');
        git(fx.root, 'add', '-A');
        git(fx.root, 'commit', '-qm', 'chore(release): 9.0.0 + index');
        const r = runCli(fx);
        expect(r.status, r.stderr).toBe(0);
    });

    it('released BREAKING added, index untouched, override trailer → exit 0', () => {
        write(fx.root, 'CHANGELOG.md', CHANGELOG_WITH_BREAKING);
        git(fx.root, 'add', '-A');
        git(fx.root, 'commit', '-qm', 'chore(release): 9.0.0\n\nci-override: breaking-index-override');
        const r = runCli(fx);
        expect(r.status, r.stderr).toBe(0);
    });

    it('BREAKING only under [Unreleased] → exit 0 (does not trip)', () => {
        write(
            fx.root,
            'CHANGELOG.md',
            '# Changelog\n\n## [Unreleased]\n\n### BREAKING CHANGES\n\n* wip break\n',
        );
        git(fx.root, 'add', '-A');
        git(fx.root, 'commit', '-qm', 'docs(changelog): note upcoming break');
        const r = runCli(fx);
        expect(r.status, r.stderr).toBe(0);
    });
});
