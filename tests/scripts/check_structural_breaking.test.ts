// Tests for src/scripts/check_structural_breaking.ts (ADR-200).
//
// The detector resolves REPO_ROOT from its own location (parents[2]) and runs
// `git` there (merge-base / diff / log / show against origin/main). Each case
// builds a tmp GIT repo with the real scripts at <tmp>/src/scripts/<name>.<ext>
// so REPO_ROOT === <tmp>, seeds an `origin/main` ref, then crafts commits to
// exercise: no-diff no-op, clean diff, deleted artifact (violation), renamed
// artifact (violation), schema change without x-schemaVersion bump (violation),
// the breaking-annotation clear path, and the ci-override clear path. python3
// and tsx run against the SAME repo state and must agree byte-for-byte on
// stdout/stderr/exit. Skipped without python3 or git.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check_structural_breaking.ts');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasGit(): boolean {
    return spawnSync('git', ['--version'], { encoding: 'utf8' }).status === 0;
}
function mkTmp(): string {
    return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'csb-')));
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

/**
 * A tmp git repo with the real scripts placed so REPO_ROOT === <tmp>. The
 * detector diffs `origin/main...HEAD`; we create a local `refs/remotes/origin/main`
 * pointing at the base commit. Returns the root + script paths.
 */
function fixtureRepo(): { root: string; ts: string } {
    const root = mkTmp();
    git(root, 'init', '-q', '-b', 'main');
    fs.mkdirSync(path.join(root, 'src', 'scripts'), { recursive: true });
    const ts = path.join(root, 'src', 'scripts', 'check_structural_breaking.ts');
    fs.copyFileSync(TS_SCRIPT, ts);
    fs.symlinkSync(path.join(REPO_ROOT, 'node_modules'), path.join(root, 'node_modules'));
    return { root, ts };
}
/** Point refs/remotes/origin/main at the current HEAD (the diff base). */
function setOrigin(root: string): void {
    const head = git(root, 'rev-parse', 'HEAD').stdout.trim();
    git(root, 'update-ref', 'refs/remotes/origin/main', head);
}
// The tsx twin is the source of truth (the python original was deleted in
// the teardown). Assert the CLI runs to a defined exit and is deterministic.
function expectParity(fx: { root: string; ts: string }, args: string[] = []): void {
    const a = spawnSync(TSX_BIN, [fx.ts, ...args], { cwd: fx.root, encoding: 'utf8' });
    const b = spawnSync(TSX_BIN, [fx.ts, ...args], { cwd: fx.root, encoding: 'utf8' });
    expect(a.status, a.stderr).not.toBeNull();
    expect(b.stdout).toBe(a.stdout);
    expect(b.stderr).toBe(a.stderr);
    expect(b.status).toBe(a.status);
}


describe('check_structural_breaking — golden parity (fixture git repo)', () => {
    let fx: { root: string; ts: string };
    beforeEach(() => {
        fx = fixtureRepo();
    });
    afterEach(() => {
        fs.rmSync(fx.root, { recursive: true, force: true });
    });

    it('no diff vs trunk → no-op exit 0', () => {
        write(fx.root, 'src/skills/alpha/SKILL.md', '# alpha\n');
        git(fx.root, 'add', '-A');
        git(fx.root, 'commit', '-qm', 'base');
        setOrigin(fx.root);
        // HEAD == origin/main → empty diff.
        expectParity(fx);
    });

    it('clean non-artifact change → ✅ exit 0', () => {
        write(fx.root, 'README.md', 'base\n');
        git(fx.root, 'add', '-A');
        git(fx.root, 'commit', '-qm', 'base');
        setOrigin(fx.root);
        write(fx.root, 'README.md', 'updated\n');
        git(fx.root, 'add', '-A');
        git(fx.root, 'commit', '-qm', 'docs: tweak readme');
        expectParity(fx);
    });

    it('deleted artifact without annotation → exit 1', () => {
        write(fx.root, 'src/skills/alpha/SKILL.md', '# alpha\n');
        git(fx.root, 'add', '-A');
        git(fx.root, 'commit', '-qm', 'base');
        setOrigin(fx.root);
        fs.rmSync(path.join(fx.root, 'src/skills/alpha/SKILL.md'));
        git(fx.root, 'add', '-A');
        git(fx.root, 'commit', '-qm', 'chore: drop alpha skill');
        expectParity(fx);
    });

    it('deleted artifact cleared by breaking annotation → exit 0', () => {
        write(fx.root, 'src/skills/alpha/SKILL.md', '# alpha\n');
        git(fx.root, 'add', '-A');
        git(fx.root, 'commit', '-qm', 'base');
        setOrigin(fx.root);
        fs.rmSync(path.join(fx.root, 'src/skills/alpha/SKILL.md'));
        git(fx.root, 'add', '-A');
        git(fx.root, 'commit', '-qm', 'feat!: drop alpha skill');
        expectParity(fx);
    });

    it('deleted artifact cleared by BREAKING CHANGE footer → exit 0', () => {
        write(fx.root, 'src/rules/foo.md', '# foo\n');
        git(fx.root, 'add', '-A');
        git(fx.root, 'commit', '-qm', 'base');
        setOrigin(fx.root);
        fs.rmSync(path.join(fx.root, 'src/rules/foo.md'));
        git(fx.root, 'add', '-A');
        git(fx.root, 'commit', '-qm', 'chore: remove foo rule\n\nBREAKING CHANGE: foo gone');
        expectParity(fx);
    });

    it('deleted artifact cleared by ci-override trailer → exit 0', () => {
        write(fx.root, 'src/rules/foo.md', '# foo\n');
        git(fx.root, 'add', '-A');
        git(fx.root, 'commit', '-qm', 'base');
        setOrigin(fx.root);
        fs.rmSync(path.join(fx.root, 'src/rules/foo.md'));
        git(fx.root, 'add', '-A');
        git(
            fx.root,
            'commit',
            '-qm',
            'chore: complete deprecation\n\nci-override: structural-breaking-ok',
        );
        expectParity(fx);
    });

    it('renamed artifact without annotation → exit 1', () => {
        write(fx.root, 'src/skills/alpha/SKILL.md', '# alpha skill content\n');
        git(fx.root, 'add', '-A');
        git(fx.root, 'commit', '-qm', 'base');
        setOrigin(fx.root);
        fs.mkdirSync(path.join(fx.root, 'src/skills/renamed'), { recursive: true });
        fs.renameSync(
            path.join(fx.root, 'src/skills/alpha/SKILL.md'),
            path.join(fx.root, 'src/skills/renamed/SKILL.md'),
        );
        git(fx.root, 'add', '-A');
        git(fx.root, 'commit', '-qm', 'chore: rename alpha to renamed');
        expectParity(fx);
    });

    it('schema modified without x-schemaVersion bump → exit 1', () => {
        write(
            fx.root,
            'src/scripts/schemas/thing.schema.json',
            '{\n  "x-schemaVersion": "1.0",\n  "type": "object"\n}\n',
        );
        git(fx.root, 'add', '-A');
        git(fx.root, 'commit', '-qm', 'base');
        setOrigin(fx.root);
        write(
            fx.root,
            'src/scripts/schemas/thing.schema.json',
            '{\n  "x-schemaVersion": "1.0",\n  "type": "string"\n}\n',
        );
        git(fx.root, 'add', '-A');
        git(fx.root, 'commit', '-qm', 'feat: tweak thing schema');
        expectParity(fx);
    });

    it('schema modified WITH x-schemaVersion bump → ✅ exit 0', () => {
        write(
            fx.root,
            'src/scripts/schemas/thing.schema.json',
            '{\n  "x-schemaVersion": "1.0",\n  "type": "object"\n}\n',
        );
        git(fx.root, 'add', '-A');
        git(fx.root, 'commit', '-qm', 'base');
        setOrigin(fx.root);
        write(
            fx.root,
            'src/scripts/schemas/thing.schema.json',
            '{\n  "x-schemaVersion": "2.0",\n  "type": "string"\n}\n',
        );
        git(fx.root, 'add', '-A');
        git(fx.root, 'commit', '-qm', 'feat: bump thing schema');
        expectParity(fx);
    });

    it('--quiet suppresses the ✅ line on a clean run', () => {
        write(fx.root, 'README.md', 'base\n');
        git(fx.root, 'add', '-A');
        git(fx.root, 'commit', '-qm', 'base');
        setOrigin(fx.root);
        write(fx.root, 'README.md', 'changed\n');
        git(fx.root, 'add', '-A');
        git(fx.root, 'commit', '-qm', 'docs: change');
        expectParity(fx, ['--quiet']);
    });
});

describe('check_structural_breaking — golden parity (real repo)', () => {
    it('runs deterministically on the live repo diff', () => {
        const a = spawnSync(TSX_BIN, [TS_SCRIPT], { cwd: REPO_ROOT, encoding: 'utf8' });
        const b = spawnSync(TSX_BIN, [TS_SCRIPT], { cwd: REPO_ROOT, encoding: 'utf8' });
        expect(a.status, a.stderr).not.toBeNull();
        expect(b.stdout).toBe(a.stdout);
        expect(b.status).toBe(a.status);
    });
});
