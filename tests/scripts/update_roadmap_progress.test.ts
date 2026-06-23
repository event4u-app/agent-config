// Intent tests for the py2ts `update_roadmap_progress` twin (ADR-200).
//
// `update_roadmap_progress.ts` is the roadmap dashboard generator — the script
// CI runs with `--check`. The python twin is gone (py2ts teardown), so these
// assert the tsx twin's OWN contract directly — the same surface the former
// byte-parity rig exercised: the dashboard sections/markers a regen renders,
// the exclusion rules, the frontmatter (draft/ready) gating, the
// complete-unarchived stderr warning, the `--check` exit codes (stale → 1,
// fresh → 0, no dir → 0), and the unknown-arg / `--help` usage banner.
//
// The twin accepts `--repo-root <dir>` (default cwd), so each case builds a
// throwaway `<tmp>/proj/agents/roadmaps/` fixture tree and drives the script as
// a direct CLI invocation. COLUMNS pinned to 80.
//
// Fixtures: phases always carry a NAME (or a blank line follows the heading).
// `## Phase 1` immediately followed by `- [ ] x` is a PHASE_RE quirk — the name
// group swallows the next line, so the checkbox is consumed into the heading
// and not counted. Real roadmaps always name their phases, so the fixtures do
// too. No env mutation, no real repo touched — every fixture lives under a
// fresh mkdtemp dir cleaned in afterEach.
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// tests/scripts/update_roadmap_progress.test.ts → two levels up is the repo root.
const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'agent-src', 'scripts', 'update_roadmap_progress.ts');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function childEnv(): NodeJS.ProcessEnv {
    return { ...process.env, COLUMNS: '80' };
}

function runTs(args: string[], cwd: string): SpawnSyncReturns<string> {
    return spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd, env: childEnv(), encoding: 'utf8' });
}

describe('update_roadmap_progress — intent', () => {
    let tmp: string;
    let root: string;
    let roadmaps: string;

    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'urp-intent-'));
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

    /** Run a regen against `root` and return the written dashboard + run result. */
    function regen(): { result: SpawnSyncReturns<string>; dashboard: string } {
        const result = runTs(['--repo-root', root], tmp);
        const dashPath = path.join(root, DASH);
        const dashboard = fs.existsSync(dashPath) ? fs.readFileSync(dashPath, 'utf-8') : '';
        return { result, dashboard };
    }

    it('regen: mixed states (done/open/deferred/cancelled) render the expected sections', () => {
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
        const { result, dashboard } = regen();
        expect(result.status, 'exit').toBe(0);
        // Generic header (auto-generated banner) is always present.
        expect(dashboard).toContain('# Roadmap Progress');
        expect(dashboard).toContain('> Auto-generated — do not edit.');
        expect(dashboard).toContain('2 open roadmaps');
        // Overall tally: 2 done of 4 counted steps (50%).
        expect(dashboard).toContain('**2 / 4 steps done · 50%**');
        // Both roadmaps listed in the open-roadmaps table.
        expect(dashboard).toContain('[road-to-alpha.md](roadmaps/road-to-alpha.md)');
        expect(dashboard).toContain('[road-to-beta.md](roadmaps/road-to-beta.md)');
        // Per-roadmap phase breakdown reflects the per-phase states.
        expect(dashboard).toContain('## Per-roadmap phase breakdown');
        expect(dashboard).toContain('🟡 in progress');
        expect(dashboard).toContain('✅ done');
        expect(dashboard).toContain('⬜ not started');
    });

    it('regen: excluded dirs + excluded names never appear in the dashboard', () => {
        mkRoadmap('road-to-live.md', ['# Live', '', '## Phase 1 — Go', '- [x] a', '- [ ] b', ''].join('\n'));
        // None of these may appear in the dashboard.
        mkRoadmap('archive/road-to-old.md', ['# Old', '', '## Phase 1 — X', '- [x] z', ''].join('\n'));
        mkRoadmap('later/road-to-parked.md', ['# Parked', '', '## Phase 1 — Y', '- [ ] q', ''].join('\n'));
        mkRoadmap('skipped/road-to-dropped.md', ['# Dropped', '', '## Phase 1 — W', '- [ ] r', ''].join('\n'));
        mkRoadmap('stubs/road-to-stub.md', ['# Stub', '', '## Phase 1 — S', '- [ ] s', ''].join('\n'));
        mkRoadmap('README.md', ['# Readme', '', '## Phase 1 — N', '- [ ] no', ''].join('\n'));
        mkRoadmap('template.md', ['# Template', '', '## Phase 1 — T', '- [ ] tpl', ''].join('\n'));
        mkRoadmap('open-questions.md', ['# OQ', '', '## Phase 1 — O', '- [ ] oq', ''].join('\n'));
        const { result, dashboard } = regen();
        expect(result.status, 'exit').toBe(0);
        // Only the live roadmap is listed.
        expect(dashboard).toContain('1 open roadmap ');
        expect(dashboard).toContain('road-to-live.md');
        for (const excluded of [
            'road-to-old.md',
            'road-to-parked.md',
            'road-to-dropped.md',
            'road-to-stub.md',
            'README.md',
            'template.md',
            'open-questions.md',
        ]) {
            expect(dashboard, `excluded: ${excluded}`).not.toContain(excluded);
        }
    });

    it('regen: draft frontmatter hidden, ready frontmatter listed', () => {
        mkRoadmap(
            'road-to-draft.md',
            ['---', 'status: draft', '---', '# Draft', '', '## Phase 1 — D', '- [ ] hidden', ''].join('\n'),
        );
        mkRoadmap(
            'road-to-ready.md',
            ['---', 'status: ready', '---', '# Ready', '', '## Phase 1 — R', '- [x] shown', ''].join('\n'),
        );
        const { result, dashboard } = regen();
        expect(result.status, 'exit').toBe(0);
        expect(dashboard).toContain('1 open roadmap ');
        expect(dashboard).toContain('road-to-ready.md');
        expect(dashboard).not.toContain('road-to-draft.md');
    });

    it('regen: roman + letter + numeric-sub phase ids round-trip into the breakdown', () => {
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
        const { result, dashboard } = regen();
        expect(result.status, 'exit').toBe(0);
        // All four phase ids appear in the per-roadmap phase breakdown rows.
        expect(dashboard).toContain('| 0 | Zero |');
        expect(dashboard).toContain('| III | Roman |');
        expect(dashboard).toContain('| 2a | Sub |');
        expect(dashboard).toContain('| B1 | Letter track |');
    });

    it('regen: merge-gated open item still surfaces as an open step', () => {
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
        const { result, dashboard } = regen();
        expect(result.status, 'exit').toBe(0);
        expect(dashboard).toContain('road-to-gated.md');
        // 1 done + 1 open = the gated item counts as open work (not complete).
        expect(dashboard).toContain('**1 / 2 steps done · 50%**');
    });

    it('regen: no open roadmaps (only excluded) → "_No open roadmaps._"', () => {
        mkRoadmap('archive/road-to-old.md', ['# Old', '', '## Phase 1 — X', '- [x] z', ''].join('\n'));
        const { result, dashboard } = regen();
        expect(result.status, 'exit').toBe(0);
        expect(dashboard).toContain('0 open roadmaps');
        expect(dashboard).toContain('_No open roadmaps._');
    });

    it('regen: complete-unarchived roadmap emits the stderr warning', () => {
        mkRoadmap('road-to-complete.md', ['# Complete', '', '## Phase 1 — All', '- [x] all done', ''].join('\n'));
        const { result } = regen();
        expect(result.status, 'exit').toBe(0);
        // The "Completed — pending archival" banner goes to stderr.
        expect(result.stderr).toContain('Completed roadmaps not yet archived');
        expect(result.stderr).toContain('road-to-complete.md');
    });

    it('--check: stale (no dashboard yet) + complete + deferred → exit 1 with the markers', () => {
        mkRoadmap('road-to-complete.md', ['# Complete', '', '## Phase 1 — All', '- [x] all done', ''].join('\n'));
        mkRoadmap(
            'road-to-deferred.md',
            ['# Deferred', '', '## Phase 1 — Wait', '- [x] done', '- [~] later', ''].join('\n'),
        );
        const ts = runTs(['--repo-root', root, '--check'], tmp);
        expect(ts.status, 'check exit').toBe(1);
        // `--check` diagnostics are written to stderr.
        expect(ts.stderr, 'stale marker').toContain('is stale');
        expect(ts.stderr, 'complete-unarchived marker').toContain(
            'Completed roadmaps are still in `agents/roadmaps/`',
        );
        expect(ts.stderr, 'Iron Law 3 marker').toContain('Iron Law 3');
        expect(ts.stderr).toContain('road-to-complete.md');
        expect(ts.stderr).toContain('road-to-deferred.md');
    });

    it('--check: up-to-date dashboard (open work) → exit 0', () => {
        mkRoadmap(
            'road-to-active.md',
            ['# Active', '', '## Phase 1 — Go', '- [x] done', '- [ ] todo', ''].join('\n'),
        );
        // Write a fresh dashboard first so `--check` sees an up-to-date file.
        runTs(['--repo-root', root], tmp);
        const ts = runTs(['--repo-root', root, '--check'], tmp);
        expect(ts.status, 'check exit').toBe(0);
        expect(ts.stdout, 'fresh marker').toContain('is up to date');
    });

    it('--check: no roadmaps directory → exit 0 silent', () => {
        const bare = path.join(tmp, 'bare');
        fs.mkdirSync(bare, { recursive: true });
        const ts = runTs(['--repo-root', bare, '--check'], tmp);
        expect(ts.status, 'check exit').toBe(0);
        expect(ts.stdout, 'silent stdout').toBe('');
    });

    it('regen: no roadmaps directory → "No roadmaps directory" stdout', () => {
        const bare = path.join(tmp, 'bare2');
        fs.mkdirSync(bare, { recursive: true });
        const ts = runTs(['--repo-root', bare], tmp);
        expect(ts.status, 'exit').toBe(0);
        expect(ts.stdout).toContain('No roadmaps directory');
    });

    it('unknown arg → exit 2, usage banner on stderr', () => {
        const ts = runTs(['--bogus'], tmp);
        expect(ts.status, 'exit').toBe(2);
        expect(ts.stderr.split('\n')[0]).toBe(
            'usage: update_roadmap_progress.py [-h] [--check] [--repo-root REPO_ROOT]',
        );
        expect(ts.stderr).toContain('unrecognized arguments: --bogus');
    });

    it('--help → exit 0, usage token present', () => {
        const ts = runTs(['--help'], tmp);
        expect(ts.status, 'exit').toBe(0);
        expect(ts.stdout.includes('usage: update_roadmap_progress.py')).toBe(true);
    });
});
