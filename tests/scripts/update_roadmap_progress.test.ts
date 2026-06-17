// Golden-parity rig for the py2ts `update_roadmap_progress` twin (ADR-200).
//
// `update_roadmap_progress.{py,ts}` is the roadmap dashboard generator — the
// script CI runs with `--check`, so byte-identical parity is load-bearing.
// Both engines accept `--repo-root <dir>` (default cwd), so each case builds a
// throwaway `<tmp>/agents/roadmaps/` fixture tree and drives BOTH scripts as a
// direct CLI invocation (`python3 …py` vs `tsx …ts`), then compares:
//   - the generated `agents/roadmaps-progress.md` bytes,
//   - stdout + stderr,
//   - exit code,
// all byte-for-byte. argparse `--help` PROSE is not byte-compared (only the
// exit code + the `usage:` token); the unknown-arg error path IS compared in
// full (it is a one-line deterministic banner, not multi-line help prose).
//
// Fixtures: phases always carry a NAME (or a blank line follows the heading).
// `## Phase 1` immediately followed by `- [ ] x` is a PHASE_RE quirk shared by
// both engines — the `[\s:—-]+(.*?)` name group swallows the next line, so the
// checkbox is consumed into the heading and not counted. That divergence is a
// property of the shared regex (identical py vs tsx), not a twin defect; real
// roadmaps always name their phases, so the fixtures do too.
//
// No env mutation, no real repo / real roadmaps touched — every fixture lives
// under a fresh mkdtemp dir cleaned in afterEach. COLUMNS pinned to 80.
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// tests/scripts/update_roadmap_progress.test.ts → two levels up is the repo root.
const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'agent-src', 'scripts', 'update_roadmap_progress.py');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'agent-src', 'scripts', 'update_roadmap_progress.ts');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

// PYTHONPATH=src + the script dir so the `import update_roadmap_progress`
// sibling resolution + any `src/` packages are importable when run directly.
function childEnv(): NodeJS.ProcessEnv {
    return {
        ...process.env,
        COLUMNS: '80',
        PYTHONPATH: `${path.join(REPO_ROOT, 'src')}:${path.dirname(PY_SCRIPT)}`,
    };
}

function runPy(args: string[], cwd: string): SpawnSyncReturns<string> {
    return spawnSync('python3', [PY_SCRIPT, ...args], { cwd, env: childEnv(), encoding: 'utf8' });
}

function runTs(args: string[], cwd: string): SpawnSyncReturns<string> {
    return spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd, env: childEnv(), encoding: 'utf8' });
}

const py3 = hasPython3();

describe.runIf(py3)('update_roadmap_progress — golden parity (python3 vs tsx)', () => {
    let tmp: string;
    let root: string;
    let roadmaps: string;

    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'urp-parity-'));
        root = path.join(tmp, 'proj');
        roadmaps = path.join(root, 'agents', 'roadmaps');
        fs.mkdirSync(roadmaps, { recursive: true });
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    function mkRoadmap(rel: string, body: string): void {
        const fp = path.join(roadmaps, rel);
        fs.mkdirSync(path.dirname(fp), { recursive: true });
        fs.writeFileSync(fp, body, 'utf-8');
    }

    const DASH = path.join('agents', 'roadmaps-progress.md');

    /** Run the regen (write) path on both engines into two sibling repo roots and compare. */
    function expectRegenMatch(): void {
        // Clone the fixture roadmaps tree into a py-root and a ts-root so each
        // engine writes its own dashboard without clobbering the other.
        const pyRoot = path.join(tmp, 'py-root');
        const tsRoot = path.join(tmp, 'ts-root');
        fs.cpSync(root, pyRoot, { recursive: true });
        fs.cpSync(root, tsRoot, { recursive: true });

        const py = runPy(['--repo-root', pyRoot], tmp);
        const ts = runTs(['--repo-root', tsRoot], tmp);

        expect(ts.status, 'exit').toBe(py.status);
        // stdout names the repo-relative target only — root-name differs, so
        // normalize the two root basenames to a placeholder before comparing.
        const norm = (s: string): string => s.split('py-root').join('R').split('ts-root').join('R');
        expect(norm(ts.stdout), 'stdout').toBe(norm(py.stdout));
        expect(norm(ts.stderr), 'stderr').toBe(norm(py.stderr));

        const pyDash = fs.readFileSync(path.join(pyRoot, DASH), 'utf-8');
        const tsDash = fs.readFileSync(path.join(tsRoot, DASH), 'utf-8');
        expect(tsDash, 'dashboard bytes').toBe(pyDash);
    }

    /** Run `--check` on both engines against the SAME root (read-only) and compare. */
    function expectCheckMatch(preRegen: boolean): void {
        if (preRegen) {
            // Write a fresh dashboard first so `--check` sees an up-to-date file.
            runPy(['--repo-root', root], tmp);
        }
        const py = runPy(['--repo-root', root, '--check'], tmp);
        const ts = runTs(['--repo-root', root, '--check'], tmp);
        expect(ts.status, 'check exit').toBe(py.status);
        expect(ts.stdout, 'check stdout').toBe(py.stdout);
        expect(ts.stderr, 'check stderr').toBe(py.stderr);
    }

    it('regen: mixed states (done/open/deferred/cancelled) byte-identical', () => {
        mkRoadmap(
            'road-to-alpha.md',
            [
                '# Roadmap: Alpha',
                '',
                '## Phase 1 — Setup',
                '- [x] done one',
                '- [ ] open one',
                '- [~] deferred one',
                '',
                '## Phase 2: Build',
                '- [x] done two',
                '- [-] cancelled two',
                '',
            ].join('\n'),
        );
        mkRoadmap(
            'road-to-beta.md',
            ['# Roadmap: Beta', '', '## Phase A — Track', '- [ ] beta open', ''].join('\n'),
        );
        expectRegenMatch();
    });

    it('regen: excluded dirs (archive/later/skipped/stubs) + excluded names ignored identically', () => {
        mkRoadmap('road-to-live.md', ['# Live', '', '## Phase 1 — Go', '- [x] a', '- [ ] b', ''].join('\n'));
        // None of these may appear in the dashboard.
        mkRoadmap('archive/road-to-old.md', ['# Old', '', '## Phase 1 — X', '- [x] z', ''].join('\n'));
        mkRoadmap('later/road-to-parked.md', ['# Parked', '', '## Phase 1 — Y', '- [ ] q', ''].join('\n'));
        mkRoadmap('skipped/road-to-dropped.md', ['# Dropped', '', '## Phase 1 — W', '- [ ] r', ''].join('\n'));
        mkRoadmap('stubs/road-to-stub.md', ['# Stub', '', '## Phase 1 — S', '- [ ] s', ''].join('\n'));
        mkRoadmap('README.md', ['# Readme', '', '## Phase 1 — N', '- [ ] no', ''].join('\n'));
        mkRoadmap('template.md', ['# Template', '', '## Phase 1 — T', '- [ ] tpl', ''].join('\n'));
        mkRoadmap('open-questions.md', ['# OQ', '', '## Phase 1 — O', '- [ ] oq', ''].join('\n'));
        expectRegenMatch();
    });

    it('regen: draft frontmatter hidden, ready frontmatter listed — byte-identical', () => {
        mkRoadmap(
            'road-to-draft.md',
            ['---', 'status: draft', '---', '# Draft', '', '## Phase 1 — D', '- [ ] hidden', ''].join('\n'),
        );
        mkRoadmap(
            'road-to-ready.md',
            ['---', 'status: ready', '---', '# Ready', '', '## Phase 1 — R', '- [x] shown', ''].join('\n'),
        );
        expectRegenMatch();
    });

    it('regen: roman + letter + numeric-sub phase ids round-trip identically', () => {
        mkRoadmap(
            'road-to-ids.md',
            [
                '# Roadmap: Ids',
                '',
                '## Phase 0 — Zero',
                '- [x] z',
                '',
                '## Phase III — Roman',
                '- [ ] r',
                '',
                '## Phase 2a — Sub',
                '- [x] s',
                '',
                '## Phase B1 — Letter track',
                '- [ ] l',
                '',
            ].join('\n'),
        );
        expectRegenMatch();
    });

    it('regen: merge-gated open item surfaces in dashboard identically', () => {
        mkRoadmap(
            'road-to-gated.md',
            [
                '# Roadmap: Gated',
                '',
                '## Phase 1 — Final',
                '- [x] done',
                '- [ ] last item <!-- merge-gated: pr=365 archives on merge -->',
                '',
            ].join('\n'),
        );
        expectRegenMatch();
    });

    it('regen: no open roadmaps (only excluded) → "_No open roadmaps._" identically', () => {
        mkRoadmap('archive/road-to-old.md', ['# Old', '', '## Phase 1 — X', '- [x] z', ''].join('\n'));
        expectRegenMatch();
    });

    it('regen: complete-unarchived roadmap emits stderr warning identically', () => {
        mkRoadmap('road-to-complete.md', ['# Complete', '', '## Phase 1 — All', '- [x] all done', ''].join('\n'));
        expectRegenMatch();
    });

    it('--check: stale (no dashboard yet) + complete + deferred → exit 1, stderr identical', () => {
        mkRoadmap('road-to-complete.md', ['# Complete', '', '## Phase 1 — All', '- [x] all done', ''].join('\n'));
        mkRoadmap(
            'road-to-deferred.md',
            ['# Deferred', '', '## Phase 1 — Wait', '- [x] done', '- [~] later', ''].join('\n'),
        );
        expectCheckMatch(false);
    });

    it('--check: up-to-date dashboard (open work) → exit 0 identically', () => {
        mkRoadmap(
            'road-to-active.md',
            ['# Active', '', '## Phase 1 — Go', '- [x] done', '- [ ] todo', ''].join('\n'),
        );
        expectCheckMatch(true);
    });

    it('--check: no roadmaps directory → exit 0 silent identically', () => {
        // Point both engines at a root WITHOUT agents/roadmaps.
        const bare = path.join(tmp, 'bare');
        fs.mkdirSync(bare, { recursive: true });
        const py = runPy(['--repo-root', bare, '--check'], tmp);
        const ts = runTs(['--repo-root', bare, '--check'], tmp);
        expect(ts.status).toBe(py.status);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(py.status).toBe(0);
    });

    it('regen: no roadmaps directory → "No roadmaps directory" stdout identically', () => {
        const bare = path.join(tmp, 'bare2');
        fs.mkdirSync(bare, { recursive: true });
        const py = runPy(['--repo-root', bare], tmp);
        const ts = runTs(['--repo-root', bare], tmp);
        expect(ts.status).toBe(py.status);
        // stdout names the absolute roadmap_root path — normalize the tmp prefix.
        const norm = (s: string): string => s.split(bare).join('ROOT');
        expect(norm(ts.stdout)).toBe(norm(py.stdout));
        expect(ts.stderr).toBe(py.stderr);
    });

    it('unknown arg → exit 2, usage banner byte-identical', () => {
        const py = runPy(['--bogus'], tmp);
        const ts = runTs(['--bogus'], tmp);
        expect(ts.status, 'exit').toBe(py.status);
        expect(py.status).toBe(2);
        expect(ts.stderr, 'stderr').toBe(py.stderr);
        expect(ts.stdout, 'stdout').toBe(py.stdout);
    });

    it('--help → exit 0, usage token present (prose not byte-compared)', () => {
        const py = runPy(['--help'], tmp);
        const ts = runTs(['--help'], tmp);
        expect(ts.status, 'exit').toBe(py.status);
        expect(py.status).toBe(0);
        // argparse renders a multi-line help body; the twin emits only the
        // usage line. Assert the exit + the shared usage token, not the prose.
        expect(py.stdout.includes('usage: update_roadmap_progress.py')).toBe(true);
        expect(ts.stdout.includes('usage: update_roadmap_progress.py')).toBe(true);
    });
});
