// Golden-parity rig for the py2ts `archive_completed_roadmaps` twin (ADR-200).
//
// The PR-gate sweep: a roadmap with `count_open == 0 && count_deferred == 0`
// is complete and gets `git mv`'d to `agents/roadmaps/archive/`, with inbound
// refs rewritten. Both engines resolve the repo root from
// `git rev-parse --show-toplevel` (cwd-based) and shell out to `git mv` /
// `git grep` / `git log`, so each case builds a throwaway *git* repo under a
// fresh mkdtemp dir and drives BOTH scripts there, comparing stdout / stderr /
// exit byte-for-byte. For the mutating (`--all`, non-dry) path each engine
// runs in its OWN cloned repo so the `git mv` of one does not perturb the
// other; the resulting tree (which files moved to `archive/`, which inbound
// refs were rewritten) is compared via `git status` + on-disk bytes.
//
// `--dry-run` is byte-compared in a single shared repo (it touches nothing).
// `--help` PROSE is not byte-compared (only exit + usage token); the
// unknown-arg banner IS compared in full. No real repo / real roadmaps / real
// push is ever touched — every fixture is a self-contained `git init` tmp repo.
// COLUMNS pinned to 80.
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'agent-src', 'scripts', 'archive_completed_roadmaps.py');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'agent-src', 'scripts', 'archive_completed_roadmaps.ts');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}
function hasGit(): boolean {
    return spawnSync('git', ['--version'], { encoding: 'utf8' }).status === 0;
}

function childEnv(): NodeJS.ProcessEnv {
    return {
        ...process.env,
        COLUMNS: '80',
        // The .py inserts its own dir on sys.path to import the sibling
        // update_roadmap_progress module; PYTHONPATH covers src/ packages too.
        PYTHONPATH: `${path.join(REPO_ROOT, 'src')}:${path.dirname(PY_SCRIPT)}`,
    };
}

function runPy(args: string[], cwd: string): SpawnSyncReturns<string> {
    return spawnSync('python3', [PY_SCRIPT, ...args], { cwd, env: childEnv(), encoding: 'utf8' });
}
function runTs(args: string[], cwd: string): SpawnSyncReturns<string> {
    return spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd, env: childEnv(), encoding: 'utf8' });
}

function git(cwd: string, ...args: string[]): SpawnSyncReturns<string> {
    return spawnSync('git', args, { cwd, encoding: 'utf8' });
}

/** A self-contained git repo with the given roadmap files committed. */
function initRepo(dir: string, files: Record<string, string>): void {
    fs.mkdirSync(dir, { recursive: true });
    git(dir, 'init', '-q');
    git(dir, 'config', 'user.email', 'parity@test.local');
    git(dir, 'config', 'user.name', 'parity');
    git(dir, 'config', 'commit.gpgsign', 'false');
    for (const [rel, body] of Object.entries(files)) {
        const fp = path.join(dir, rel);
        fs.mkdirSync(path.dirname(fp), { recursive: true });
        fs.writeFileSync(fp, body, 'utf-8');
    }
    git(dir, 'add', '-A');
    git(dir, 'commit', '-qm', 'init');
}

const COMPLETE = ['# Complete', '', '## Phase 1 — All', '- [x] all done', ''].join('\n');
const OPEN = ['# Open', '', '## Phase 1 — Go', '- [ ] not done', ''].join('\n');
const DEFERRED = ['# Deferred', '', '## Phase 1 — Wait', '- [x] done', '- [~] later', ''].join('\n');

const ready = hasPython3() && hasGit();

describe.runIf(ready)('archive_completed_roadmaps — golden parity (python3 vs tsx)', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'acr-parity-'));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    /** `--dry-run` touches nothing → drive both engines in the SAME repo and byte-compare. */
    function expectDryMatch(args: string[], files: Record<string, string>): void {
        const repo = path.join(tmp, 'shared');
        initRepo(repo, files);
        const py = runPy(args, repo);
        const ts = runTs(args, repo);
        expect(ts.status, 'exit').toBe(py.status);
        expect(ts.stdout, 'stdout').toBe(py.stdout);
        expect(ts.stderr, 'stderr').toBe(py.stderr);
    }

    it('--all --dry-run: lists complete roadmaps, skips open/deferred — byte-identical', () => {
        expectDryMatch(['--all', '--dry-run'], {
            'agents/roadmaps/road-to-complete.md': COMPLETE,
            'agents/roadmaps/road-to-open.md': OPEN,
            'agents/roadmaps/road-to-deferred.md': DEFERRED,
        });
    });

    it('--all --dry-run: ref-migration count reported when an inbound ref exists', () => {
        expectDryMatch(['--all', '--dry-run'], {
            'agents/roadmaps/road-to-complete.md': COMPLETE,
            // An inbound full-path reference → " (1 ref(s) migrated)" suffix.
            'docs/some-adr.md': 'See agents/roadmaps/road-to-complete.md for detail.\n',
        });
    });

    it('changed-only default with unresolvable base → stderr warning, exit 0, byte-identical', () => {
        // A fresh `git init` repo has no `origin/main`, so the changed-only
        // scope cannot resolve → the conservative "skipping" warning fires.
        expectDryMatch([], {
            'agents/roadmaps/road-to-complete.md': COMPLETE,
        });
    });

    it('--all: no completed roadmaps → "ℹ️ No completed roadmaps" byte-identical', () => {
        expectDryMatch(['--all'], {
            'agents/roadmaps/road-to-open.md': OPEN,
            'agents/roadmaps/road-to-deferred.md': DEFERRED,
        });
    });

    it('--all: no agents/roadmaps dir → "ℹ️ No completed roadmaps" byte-identical', () => {
        expectDryMatch(['--all'], {
            'README.md': '# repo\n',
        });
    });

    it('--all (mutating): both engines git-mv the same files to archive/ + rewrite the same refs', () => {
        const files: Record<string, string> = {
            'agents/roadmaps/road-to-complete.md': COMPLETE,
            'agents/roadmaps/road-to-open.md': OPEN,
            'docs/some-adr.md': 'See agents/roadmaps/road-to-complete.md for detail.\n',
        };
        const pyRepo = path.join(tmp, 'py-repo');
        const tsRepo = path.join(tmp, 'ts-repo');
        initRepo(pyRepo, files);
        initRepo(tsRepo, files);

        const py = runPy(['--all'], pyRepo);
        const ts = runTs(['--all'], tsRepo);
        expect(ts.status, 'exit').toBe(py.status);
        expect(ts.stdout, 'stdout').toBe(py.stdout);
        expect(ts.stderr, 'stderr').toBe(py.stderr);

        // The complete roadmap moved to archive/ in BOTH repos; the open one did not.
        for (const repo of [pyRepo, tsRepo]) {
            expect(fs.existsSync(path.join(repo, 'agents/roadmaps/archive/road-to-complete.md')), repo).toBe(true);
            expect(fs.existsSync(path.join(repo, 'agents/roadmaps/road-to-complete.md')), repo).toBe(false);
            expect(fs.existsSync(path.join(repo, 'agents/roadmaps/road-to-open.md')), repo).toBe(true);
            // Inbound ref rewritten to the archive path.
            const adr = fs.readFileSync(path.join(repo, 'docs/some-adr.md'), 'utf-8');
            expect(adr.includes('agents/roadmaps/archive/road-to-complete.md'), repo).toBe(true);
            expect(adr.includes('agents/roadmaps/road-to-complete.md for'), repo).toBe(false);
        }

        // The two repos' staged trees match (port-name diff is impossible — repo
        // names never appear in tracked content). Compare `git status --porcelain`.
        const norm = (s: string): string => s.trim();
        expect(norm(git(tsRepo, 'status', '--porcelain').stdout)).toBe(
            norm(git(pyRepo, 'status', '--porcelain').stdout),
        );
    });

    it('unknown arg → exit 2, usage banner byte-identical', () => {
        const repo = path.join(tmp, 'r');
        initRepo(repo, { 'README.md': '# r\n' });
        const py = runPy(['--bogus'], repo);
        const ts = runTs(['--bogus'], repo);
        expect(ts.status, 'exit').toBe(py.status);
        expect(py.status).toBe(2);
        expect(ts.stderr, 'stderr').toBe(py.stderr);
        expect(ts.stdout, 'stdout').toBe(py.stdout);
    });

    it('--help → exit 0, usage token present (prose not byte-compared)', () => {
        const repo = path.join(tmp, 'rh');
        initRepo(repo, { 'README.md': '# r\n' });
        const py = runPy(['--help'], repo);
        const ts = runTs(['--help'], repo);
        expect(ts.status, 'exit').toBe(py.status);
        expect(py.status).toBe(0);
        expect(py.stdout.includes('usage: archive_completed_roadmaps.py')).toBe(true);
        expect(ts.stdout.includes('usage: archive_completed_roadmaps.py')).toBe(true);
    });
});

// Untracked-safe archival (road-to-roadmap-archival-robustness, gap A).
// TS-only enhancement (the Python twin was deleted in ADR-200), so this is
// driven against the `.ts` engine alone — no python parity. A pre-first-commit
// / untracked consumer (the canonical capisco repro: zero commits, everything
// untracked) must still get a completed roadmap archived, with inbound refs
// rewritten on the filesystem and the dashboard regenerated, and WITHOUT a
// `git mv failed` / `could not archive` warning on stderr.
describe.runIf(hasGit())('archive_completed_roadmaps — untracked-safe (TS-only)', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'acr-untracked-'));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    /** A git repo with files written but NEVER committed (everything untracked). */
    function initUncommitted(dir: string, files: Record<string, string>): void {
        fs.mkdirSync(dir, { recursive: true });
        git(dir, 'init', '-q');
        git(dir, 'config', 'user.email', 'untracked@test.local');
        git(dir, 'config', 'user.name', 'untracked');
        for (const [rel, body] of Object.entries(files)) {
            const fp = path.join(dir, rel);
            fs.mkdirSync(path.dirname(fp), { recursive: true });
            fs.writeFileSync(fp, body, 'utf-8');
        }
        // deliberately NO `git add` / `git commit` — the whole point.
    }

    it('--all on a no-commit repo: archives via plain-mv fallback, rewrites refs on disk, exit 0, no warning', () => {
        const repo = path.join(tmp, 'untracked');
        initUncommitted(repo, {
            'agents/roadmaps/road-to-complete.md': COMPLETE,
            'agents/roadmaps/road-to-open.md': OPEN,
            'docs/some-adr.md': 'See agents/roadmaps/road-to-complete.md for detail.\n',
        });

        const ts = runTs(['--all'], repo);

        expect(ts.status, 'exit').toBe(0);
        // The untracked fallback must NOT emit the failure warning.
        expect(ts.stderr).not.toMatch(/git mv failed|could not archive/);
        expect(ts.stdout, 'stdout').toMatch(/✅\s+Archived: agents\/roadmaps\/road-to-complete\.md/);

        // Complete roadmap relocated to archive/ (plain rename); open one stayed.
        expect(fs.existsSync(path.join(repo, 'agents/roadmaps/archive/road-to-complete.md'))).toBe(true);
        expect(fs.existsSync(path.join(repo, 'agents/roadmaps/road-to-complete.md'))).toBe(false);
        expect(fs.existsSync(path.join(repo, 'agents/roadmaps/road-to-open.md'))).toBe(true);

        // Inbound ref rewritten on the filesystem (git grep would have missed it
        // — the file is untracked — so this proves the fs-walk fallback ran).
        const adr = fs.readFileSync(path.join(repo, 'docs/some-adr.md'), 'utf-8');
        expect(adr.includes('agents/roadmaps/archive/road-to-complete.md')).toBe(true);
        expect(adr.includes('agents/roadmaps/road-to-complete.md for')).toBe(false);

        // Dashboard regenerated even in the untracked tree.
        expect(fs.existsSync(path.join(repo, 'agents/roadmaps-progress.md'))).toBe(true);
    });
});
