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

import {
    blocker_class,
    blocker_is_resolved,
    parse_blockers,
} from '../../src/agent-src/scripts/update_roadmap_progress.js';

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
            'road-to-dropped.md',
            'road-to-stub.md',
            'README.md',
            'template.md',
            'open-questions.md',
        ]) {
            expect(dashboard, `excluded: ${excluded}`).not.toContain(excluded);
        }
    });

    it('regen: later/ is excluded from the COUNTS but is listed as parked', () => {
        // `later/` used to be in the list above, and this case is the deliberate
        // split rather than a loosened assertion. The other three excluded
        // directories are TERMINAL — archived work is done, skipped work was
        // dropped, a stub is not a roadmap yet — so there is nothing about them a
        // reader needs to act on. Parked work is the opposite: it resumes, and the
        // one fact that matters is what brings it back. Excluding it from the
        // counted table stays correct; excluding it from the FILE meant a roadmap
        // moved there left the dashboard entirely (AI council 2026-08-19, 2/2, made
        // a visible inventory the condition of parking two near-complete roadmaps).
        mkRoadmap('road-to-live.md', ['# Live', '', '## Phase 1 — Go', '- [x] a', '- [ ] b', ''].join('\n'));
        mkRoadmap(
            'later/road-to-parked.md',
            ['# Parked', '', '> Resume when the window elapses.', '', '## Phase 1 — Y', '- [ ] q', ''].join('\n'),
        );
        const { result, dashboard } = regen();
        expect(result.status, 'exit').toBe(0);
        // Not counted: one open roadmap, and its step is not in the tally.
        expect(dashboard).toContain('1 open roadmap ');
        expect(dashboard).not.toContain('| [road-to-parked.md](roadmaps/road-to-parked.md)');
        // Listed, with its resume condition, under the parked heading.
        expect(dashboard).toContain('## Parked — `later/` (1 roadmap, not active backlog)');
        expect(dashboard).toContain('roadmaps/later/road-to-parked.md');
        expect(dashboard).toContain('Resume when the window elapses.');
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
                '## Phase 1.0 — Dotted zero',
                '- [x] d0',
                '',
                '## Phase 4.1 — Dotted sub',
                '- [ ] d1',
                '',
            ].join('\n'),
        );
        const { result, dashboard } = regen();
        expect(result.status, 'exit').toBe(0);
        // All six phase ids appear in the per-roadmap phase breakdown rows.
        expect(dashboard).toContain('| 0 | Zero |');
        expect(dashboard).toContain('| III | Roman |');
        expect(dashboard).toContain('| 2a | Sub |');
        expect(dashboard).toContain('| B1 | Letter track |');
        expect(dashboard).toContain('| 1.0 | Dotted zero |');
        expect(dashboard).toContain('| 4.1 | Dotted sub |');
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

    it('regen: structured blockers — open renders with anchor + instructions, resolved is collapsed', () => {
        mkRoadmap(
            'road-to-blockers.md',
            [
                '# Roadmap: Blockers',
                '',
                '## Phase 1 — Ship',
                '- [ ] step one',
                '- [x] step two',
                '',
                '## Blockers',
                '',
                '### blocker: kernel-budget',
                '- **Status:** open',
                '- **Owner:** maintainer',
                '- **Blocks:** Phase 1 — Ship',
                '- **What to do:**',
                '  1. Do the thing.',
                '  2. Then the other thing.',
                '- **Resolved when:** CI is green',
                '',
                '### blocker: old-decision',
                '- **Status:** resolved',
                '- **Owner:** user',
                '- **Blocks:** Phase 1 — Ship',
                '- **What to do:**',
                '  1. Already done.',
                '- **Resolved when:** n/a',
                '',
            ].join('\n'),
        );
        const { result, dashboard } = regen();
        expect(result.status, 'exit').toBe(0);
        // Overview column links to the anchor, counting only the open blocker.
        expect(dashboard).toContain('[1](#blockers-road-to-blockers)');
        // Header aggregate.
        expect(dashboard).toContain('**1** open blocker');
        // Breakdown renders the open blocker with full instructions.
        expect(dashboard).toContain('<a id="blockers-road-to-blockers"></a>');
        expect(dashboard).toContain('**kernel-budget** (owner: maintainer) — blocks Phase 1 — Ship');
        expect(dashboard).toContain('Do the thing.');
        expect(dashboard).toContain('Then the other thing.');
        expect(dashboard).toContain('**Resolved when:** CI is green');
        // Resolved blocker is collapsed, never printed by id.
        expect(dashboard).toContain('1 blocker resolved.');
        expect(dashboard).not.toContain('old-decision');
    });

    it('regen: an UNLISTED `- **Label:**` bullet terminates the field above it', () => {
        // Regression pin for the run-on defect. `BLOCKER_FIELD_RE` used to
        // enumerate eight known labels, so a bullet whose label was not on the
        // list did not terminate the previous field — the field above kept
        // absorbing it and the dashboard rendered the two as one sentence,
        // silently changing what the earlier field said. `Options` below stands
        // for any future field name: the terminator must be structural, not a
        // list somebody has to remember to extend.
        mkRoadmap(
            'road-to-unlisted-field.md',
            [
                '# Roadmap: Unlisted field',
                '',
                '## Phase 1 — Ship',
                '- [ ] step one',
                '',
                '## Blockers',
                '',
                '### blocker: needs-a-decision',
                '- **Status:** open',
                '- **Owner:** maintainer',
                '- **Blocks:** Phase 1 — Ship',
                '- **What to do:** pick one.',
                '- **Resolved when:** the owner states which option holds.',
                '- **Options:** (a) do it now (b) defer it.',
                '',
            ].join('\n'),
        );
        const { result, dashboard } = regen();
        expect(result.status, 'exit').toBe(0);
        expect(dashboard).toContain('**Resolved when:** the owner states which option holds.');
        // The load-bearing assertion: the unlisted bullet is NOT glued onto the
        // field above it. Asserting the absence of the run-on rather than the
        // presence of `Options` — the dashboard renders a fixed field set, and
        // whether it grows to render this one is a separate decision. What must
        // never happen is the earlier field silently acquiring text.
        expect(dashboard).not.toContain('the owner states which option holds. - **Options:**');
        expect(dashboard).not.toContain('(a) do it now (b) defer it.');
    });

    it('regen: a wrapped multi-line field value is not truncated at the first line', () => {
        mkRoadmap(
            'road-to-wrapped-field.md',
            [
                '# Roadmap: Wrapped Field',
                '',
                '## Phase 1 — Ship',
                '- [ ] step',
                '',
                '## Blockers',
                '',
                '### blocker: long-sentence',
                '- **Status:** open',
                '- **Owner:** maintainer',
                '- **Blocks:** Acceptance criterion — a sentence that wraps onto a',
                '  second line because it is long enough to need one.',
                '- **What to do:**',
                '  1. Do the thing.',
                '- **Resolved when:** it is done.',
                '',
            ].join('\n'),
        );
        const { result, dashboard } = regen();
        expect(result.status, 'exit').toBe(0);
        expect(dashboard).toContain(
            'blocks Acceptance criterion — a sentence that wraps onto a second line because it is long enough to need one.',
        );
    });

    it('regen: legacy "> Blocked until" note surfaces as an implicit blocker', () => {
        mkRoadmap(
            'road-to-legacy-blocked.md',
            [
                '# Roadmap: Legacy Blocked',
                '',
                '> Blocked until: waiting on external audit.',
                '',
                '## Phase 1 — Wait',
                '- [ ] step',
                '',
            ].join('\n'),
        );
        const { result, dashboard } = regen();
        expect(result.status, 'exit').toBe(0);
        expect(dashboard).toContain('[1](#blockers-road-to-legacy-blocked)');
        expect(dashboard).toContain('<a id="blockers-road-to-legacy-blocked"></a>');
        expect(dashboard).toContain('**legacy** (owner: user) — blocks entire roadmap');
        expect(dashboard).toContain('waiting on external audit.');
        expect(dashboard).toContain('condition described above clears');
    });

    it('regen: roadmap with no Blockers section renders "0" and no anchor', () => {
        mkRoadmap(
            'road-to-clean.md',
            ['# Roadmap: Clean', '', '## Phase 1 — Go', '- [ ] step', ''].join('\n'),
        );
        const { result, dashboard } = regen();
        expect(result.status, 'exit').toBe(0);
        expect(dashboard).toContain('road-to-clean.md');
        expect(dashboard).not.toContain('#blockers-road-to-clean');
        expect(dashboard).not.toContain('open blocker');
    });

    it('regen: a fenced code example of the Blockers shape is not mistaken for a live blocker', () => {
        mkRoadmap(
            'road-to-documents-the-shape.md',
            [
                '# Roadmap: Documents The Shape',
                '',
                '## Phase 1 — Ship',
                '- [ ] step describing the feature:',
                '',
                '  ```markdown',
                '  ## Blockers',
                '',
                '  ### blocker: example-only',
                '  - **Status:** open',
                '  - **Owner:** user',
                '  - **Blocks:** Phase 1',
                '  - **What to do:**',
                '    1. Not a real blocker.',
                '  - **Resolved when:** never',
                '  ```',
                '',
            ].join('\n'),
        );
        const { result, dashboard } = regen();
        expect(result.status, 'exit').toBe(0);
        expect(dashboard).toContain('road-to-documents-the-shape.md');
        expect(dashboard).not.toContain('example-only');
        expect(dashboard).not.toContain('#blockers-road-to-documents-the-shape');
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

    // --- `--archive`: act instead of warning -----------------------------
    //
    // The warning above is the DEFAULT, and the reason it stays the default is
    // the PostToolUse hook: it re-runs this write path once per turn on every
    // roadmap edit, and a hook that silently `git mv`s files mid-work is worse
    // than a line nobody reads. `--archive` is the opt-in the two explicit call
    // sites (`task roadmap-progress`, `agent-config roadmap:progress`) pass.

    it('--archive: a complete roadmap is moved to archive/ and reported, not warned about', () => {
        mkRoadmap('road-to-complete.md', ['# Complete', '', '## Phase 1 — All', '- [x] all done', ''].join('\n'));
        const result = runTs(['--repo-root', root, '--archive'], tmp);
        expect(result.status, 'exit').toBe(0);
        expect(
            fs.existsSync(path.join(roadmaps, 'road-to-complete.md')),
            'left the active tree',
        ).toBe(false);
        expect(
            fs.existsSync(path.join(roadmaps, 'archive', 'road-to-complete.md')),
            'landed in archive/',
        ).toBe(true);
        expect(result.stdout, 'reports the move').toContain('road-to-complete.md');
        expect(result.stderr, 'no warning left to print').not.toContain(
            'Completed roadmaps not yet archived',
        );
    });

    it('--archive: the dashboard describes the tree AFTER the sweep', () => {
        mkRoadmap('road-to-complete.md', ['# Complete', '', '## Phase 1 — All', '- [x] all done', ''].join('\n'));
        mkRoadmap(
            'road-to-active.md',
            ['# Active', '', '## Phase 1 — Go', '- [x] done', '- [ ] todo', ''].join('\n'),
        );
        const result = runTs(['--repo-root', root, '--archive'], tmp);
        expect(result.status, 'exit').toBe(0);
        const dashboard = fs.readFileSync(path.join(root, DASH), 'utf-8');
        expect(dashboard).toContain('road-to-active.md');
        // Archived roadmaps are excluded from the dashboard — if the render ran
        // before the sweep this row would still be here.
        expect(dashboard).not.toContain('road-to-complete.md');
        expect(dashboard).toContain('1 open roadmap');
    });

    it('--archive: an open roadmap is never touched', () => {
        mkRoadmap(
            'road-to-active.md',
            ['# Active', '', '## Phase 1 — Go', '- [x] done', '- [ ] todo', ''].join('\n'),
        );
        const result = runTs(['--repo-root', root, '--archive'], tmp);
        expect(result.status, 'exit').toBe(0);
        expect(fs.existsSync(path.join(roadmaps, 'road-to-active.md'))).toBe(true);
        expect(fs.existsSync(path.join(roadmaps, 'archive', 'road-to-active.md'))).toBe(false);
    });

    it('--archive: a deferred `[~]` item blocks the archive (Iron Law 3)', () => {
        mkRoadmap(
            'road-to-deferred.md',
            ['# Deferred', '', '## Phase 1 — Wait', '- [x] done', '- [~] later', ''].join('\n'),
        );
        const result = runTs(['--repo-root', root, '--archive'], tmp);
        expect(result.status, 'exit').toBe(0);
        expect(fs.existsSync(path.join(roadmaps, 'road-to-deferred.md')), 'stays put').toBe(true);
        expect(result.stderr).toContain('Iron Law 3');
    });

    it('--archive: a complete roadmap with an OPEN blocker stays put and is still reported', () => {
        mkRoadmap(
            'road-to-blocked.md',
            [
                '# Blocked',
                '',
                '## Phase 1 — All',
                '- [x] all done',
                '',
                '## Blockers',
                '',
                '### blocker: needs-a-decision',
                '- **Status:** open',
                '- **Owner:** user',
                '- **Blocks:** Phase 1',
                '- **What to do:**',
                '    1. Decide.',
                '- **Resolved when:** decided',
                '',
            ].join('\n'),
        );
        const result = runTs(['--repo-root', root, '--archive'], tmp);
        expect(result.status, 'exit').toBe(0);
        expect(fs.existsSync(path.join(roadmaps, 'road-to-blocked.md')), 'stays put').toBe(true);
        // The sweep says why, and the dashboard still names it as unarchived.
        expect(result.stderr).toContain('blocker(s) still open');
        expect(result.stderr).toContain('Completed roadmaps not yet archived');
    });

    it('--check --archive → exit 2: a gate must not mutate its own subject', () => {
        const result = runTs(['--repo-root', root, '--check', '--archive'], tmp);
        expect(result.status, 'exit').toBe(2);
        expect(result.stderr).toContain('not allowed with --check');
    });

    it('--no-archive after --archive wins: the roadmap is only warned about', () => {
        mkRoadmap('road-to-complete.md', ['# Complete', '', '## Phase 1 — All', '- [x] all done', ''].join('\n'));
        const result = runTs(['--repo-root', root, '--archive', '--no-archive'], tmp);
        expect(result.status, 'exit').toBe(0);
        expect(fs.existsSync(path.join(roadmaps, 'road-to-complete.md'))).toBe(true);
        expect(result.stderr).toContain('Completed roadmaps not yet archived');
    });

    it('--check: absent dashboard + complete + deferred → exit 1 with the markers', () => {
        mkRoadmap('road-to-complete.md', ['# Complete', '', '## Phase 1 — All', '- [x] all done', ''].join('\n'));
        mkRoadmap(
            'road-to-deferred.md',
            ['# Deferred', '', '## Phase 1 — Wait', '- [x] done', '- [~] later', ''].join('\n'),
        );
        const ts = runTs(['--repo-root', root, '--check'], tmp);
        expect(ts.status, 'check exit').toBe(1);
        // `--check` diagnostics are written to stderr.
        // "no dashboard yet" is ABSENT, not stale — the two were one message
        // until the tracked/untracked modes separated them.
        expect(ts.stderr, 'missing marker').toContain('is missing');
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
        // The banner wraps onto two lines since the tracked/untracked modes
        // joined it, so pin both lines rather than only the first.
        expect(ts.stderr.split('\n').slice(0, 2)).toEqual([
            'usage: update_roadmap_progress.py [-h] [--check] [--tracked-mode | --untracked-mode]',
            '       [--archive | --no-archive] [--repo-root REPO_ROOT]',
        ]);
        expect(ts.stderr).toContain('unrecognized arguments: --bogus');
    });

    it('--help → exit 0, usage token present', () => {
        const ts = runTs(['--help'], tmp);
        expect(ts.status, 'exit').toBe(0);
        expect(ts.stdout.includes('usage: update_roadmap_progress.py')).toBe(true);
    });
});

// Regression cover for two truncation defects in the blocker parser, both the
// same shape: a field whose text may start on the marker line, read as if it
// could only start on the line after. Both cut the user-facing instruction
// mid-sentence — in the dashboard and in `agent-config gates`, which is the one
// field those surfaces exist to deliver.
describe('parked inventory — later/ is listed, never counted', () => {
    let tmp: string;
    let root: string;
    let roadmaps: string;

    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'urp-parked-'));
        root = path.join(tmp, 'proj');
        roadmaps = path.join(root, 'agents', 'roadmaps');
        fs.mkdirSync(path.join(roadmaps, 'later'), { recursive: true });
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    function mk(rel: string, body: string): void {
        const fp = path.join(roadmaps, rel);
        fs.mkdirSync(path.dirname(fp), { recursive: true });
        fs.writeFileSync(fp, body, 'utf-8');
    }

    function regen(): { result: SpawnSyncReturns<string>; dashboard: string } {
        const result = runTs(['--repo-root', root], tmp);
        const dashPath = path.join(root, 'agents', 'roadmaps-progress.md');
        const dashboard = fs.existsSync(dashPath) ? fs.readFileSync(dashPath, 'utf-8') : '';
        return { result, dashboard };
    }

    it('lists a parked roadmap with its stated resume condition, and does not count it', () => {
        mk('road-to-active.md', ['# Active', '', '## Phase 1 — Go', '- [ ] open one', ''].join('\n'));
        mk(
            path.join('later', 'road-to-parked.md'),
            [
                '---',
                'status: later',
                '---',
                '',
                '# Parked',
                '',
                '> **Parked. Resume when** the maintainer takes the reading.',
                '',
                '## Phase 1 — Waits',
                '- [ ] blocked one',
                '',
            ].join('\n'),
        );
        const { result, dashboard } = regen();
        expect(result.status, 'exit').toBe(0);
        // Counted as ONE open roadmap: the parked file is not backlog.
        expect(dashboard).toContain('1 open roadmap ');
        expect(dashboard).toContain('## Parked — `later/` (1 roadmap, not active backlog)');
        expect(dashboard).toContain('Resume when the maintainer takes the reading.');
        // And it is absent from the active table, which is the whole reason the
        // inventory exists as a separate section.
        expect(dashboard).not.toContain('| [road-to-parked.md](roadmaps/road-to-parked.md)');
    });

    it('reads later/ even though the shared candidate predicate excludes that directory', () => {
        // The regression this pins: `is_roadmap_candidate` rejects ANY path with an
        // excluded component, `later` among them, so the first version of the
        // collector filtered out every file it looked at and the section silently
        // never rendered. Only the NAME half of the predicate may apply here.
        mk('road-to-active.md', ['# Active', '', '## Phase 1 — Go', '- [ ] open one', ''].join('\n'));
        mk(
            path.join('later', 'road-to-parked.md'),
            ['# Parked', '', '> Blocked until the window elapses.', ''].join('\n'),
        );
        // The name filter still applies: a README is not a roadmap on either side.
        mk(path.join('later', 'README.md'), '# Later\n\n> Blocked until nothing.\n');
        const { dashboard } = regen();
        expect(dashboard).toContain('(1 roadmap, not active backlog)');
        expect(dashboard).toContain('Blocked until the window elapses.');
        expect(dashboard).not.toContain('later/README.md');
    });

    it('reports an unlabelled condition as such rather than quoting a wrong line', () => {
        // `lint_roadmap_later_disposition` accepts a bare `trigger`, which is too
        // loose to quote from: over the live tree it matched a `Source:` path
        // containing `mixed-trigger-cleanup`. A file carrying only the loose marker
        // still PASSES that gate, so the cell must not read "no resume line" —
        // the dashboard would then contradict a green gate.
        mk('road-to-active.md', ['# Active', '', '## Phase 1 — Go', '- [ ] open one', ''].join('\n'));
        mk(
            path.join('later', 'road-to-loose.md'),
            [
                '# Loose',
                '',
                '> Source: `agents/tmp.old/mixed-trigger-cleanup/road-to-loose.md`',
                '',
            ].join('\n'),
        );
        const { dashboard } = regen();
        expect(dashboard).toContain('_condition present but unlabelled — see file_');
        expect(dashboard).not.toContain('mixed-trigger-cleanup');
    });

    it('says so when a parked file records no resume line at all', () => {
        mk('road-to-active.md', ['# Active', '', '## Phase 1 — Go', '- [ ] open one', ''].join('\n'));
        mk(path.join('later', 'road-to-silent.md'), ['---', 'status: later', '---', '', '# Silent', ''].join('\n'));
        const { dashboard } = regen();
        expect(dashboard).toContain('_no resume line recorded_');
    });

    it('joins the hard-wrapped paragraph instead of stopping at the line break', () => {
        // Roadmap prose wraps at ~80 columns, so quoting the matched LINE ended 39
        // of 52 live cells mid-clause. A cell that stops at "the pair for" is not a
        // shorter version of the sentence, it is a different claim.
        mk('road-to-active.md', ['# Active', '', '## Phase 1 — Go', '- [ ] open one', ''].join('\n'));
        mk(
            path.join('later', 'road-to-wrapped.md'),
            [
                '# Wrapped',
                '',
                '> **Parked. Resume when** the maintainer takes the before/after',
                '> reading on their own machine and records both against one commit.',
                '',
                '## Phase 1 — Waits',
                '- [ ] q',
                '',
            ].join('\n'),
        );
        const { dashboard } = regen();
        expect(dashboard).toContain(
            'Resume when the maintainer takes the before/after reading on their own machine and records both against one commit.',
        );
    });

    it('stops joining at a blank line, a list item or a heading', () => {
        mk('road-to-active.md', ['# Active', '', '## Phase 1 — Go', '- [ ] open one', ''].join('\n'));
        mk(
            path.join('later', 'road-to-bounded.md'),
            [
                '# Bounded',
                '',
                '> Resume when the window elapses.',
                '- this list item must not be swallowed',
                '',
                '## Phase 1 — Waits',
                '- [ ] q',
                '',
            ].join('\n'),
        );
        const { dashboard } = regen();
        expect(dashboard).toContain('Resume when the window elapses.');
        expect(dashboard).not.toContain('must not be swallowed');
    });

    it('strips an HTML comment out of the cell rather than escaping it', () => {
        // A `<!--` reaching a cell comments out the remainder of the generated
        // document. One already did: `<!-- ref-ignore -->`, carried in a roadmap's
        // own prose.
        mk('road-to-active.md', ['# Active', '', '## Phase 1 — Go', '- [ ] open one', ''].join('\n'));
        mk(
            path.join('later', 'road-to-commented.md'),
            ['# Commented', '', '> Resume when `x.md` <!-- ref-ignore --> exists.', ''].join('\n'),
        );
        const { dashboard } = regen();
        expect(dashboard).toContain('## Per-roadmap phase breakdown');
        // The generator appends its OWN `<!-- ref-ignore -->` to every parked row,
        // so the assertion is about the quoted CELL, not the document: the cell text
        // between the pipes must carry no comment of the roadmap's own.
        const row = dashboard
            .split('\n')
            .find((l) => l.includes('roadmaps/later/road-to-commented.md')) as string;
        expect(row).toBeDefined();
        const cells = row.slice(0, row.lastIndexOf('|') + 1);
        expect(cells).not.toContain('ref-ignore');
        expect(cells).not.toContain('<!--');
        expect(cells).toContain('Resume when `x.md` exists.');
    });

    it('counts the blockers a parked roadmap still carries, and says parking resolved nothing', () => {
        // The failure this pins: the header count is active-tree only, so parking
        // three blockered roadmaps dropped it by 3 and the dashboard printed a
        // reduction nobody earned — the free tightening the estate metric spans
        // later/ specifically to prevent, reappearing one surface over.
        // The active roadmap carries a blocker too, so the header count exists and
        // its active-tree qualifier is pinned alongside the parked notice.
        mk(
            'road-to-active.md',
            [
                '# Active',
                '',
                '## Phase 1 — Go',
                '- [ ] open one',
                '',
                '## Blockers',
                '',
                '### blocker: active-side',
                '- **Status:** open',
                '- **Owner:** user',
                '- **Class:** 3',
                '- **Blocks:** Phase 1',
                '- **What to do:** decide',
                '- **Resolved when:** decided',
                '',
            ].join('\n'),
        );
        mk(
            path.join('later', 'road-to-blocked.md'),
            [
                '# Blocked',
                '',
                '> Resume when the machine reading exists.',
                '',
                '## Phase 1 — Waits',
                '- [ ] q',
                '',
                '## Blockers',
                '',
                '### blocker: needs-a-human',
                '- **Status:** open',
                '- **Owner:** user',
                '- **Class:** 3',
                '- **Blocks:** Phase 1',
                '- **What to do:** take the reading',
                '- **Resolved when:** it exists',
                '',
            ].join('\n'),
        );
        const { dashboard } = regen();
        expect(dashboard).toContain('open blocker in the active tree');
        expect(dashboard).toContain('parking resolves nothing');
        expect(dashboard).toContain('| Roadmap | Open blockers | Resume when |');
        expect(dashboard).toContain('| 1 (1 you) |');
    });

    it('truncates before escaping, so a pipe escape is never severed', () => {
        // `slice()` after escaping can cut between the backslash and the pipe and
        // emit a dangling backslash into the table.
        mk('road-to-active.md', ['# Active', '', '## Phase 1 — Go', '- [ ] open one', ''].join('\n'));
        const long = `Resume when ${'a'.repeat(190)} | ${'b'.repeat(40)}`;
        mk(path.join('later', 'road-to-long.md'), ['# Long', '', `> ${long}`, ''].join('\n'));
        const { dashboard } = regen();
        const row = dashboard
            .split('\n')
            .find((l) => l.includes('roadmaps/later/road-to-long.md')) as string;
        expect(row).toBeDefined();
        expect(row.endsWith('...  |') || row.includes('... |')).toBe(true);
        // No lone backslash immediately before a cell boundary.
        expect(row).not.toMatch(/\\ \|/);
    });

    it('marks each parked row ref-ignore, because a resume condition names what does not exist yet', () => {
        // Not a suppression. "Blocked until `x.md` exists" is the commonest resume
        // shape in later/, so checking those quoted paths as live references fires
        // the reference gate on correct content — it did, on the first regen, over a
        // roadmap that carries its own ref-ignore for exactly that reason.
        mk('road-to-active.md', ['# Active', '', '## Phase 1 — Go', '- [ ] open one', ''].join('\n'));
        mk(
            path.join('later', 'road-to-awaits-a-file.md'),
            ['# Awaits', '', '> Blocked until `agents/evidence/not-yet/created.md` exists.', ''].join('\n'),
        );
        const { dashboard } = regen();
        const row = dashboard
            .split('\n')
            .find((l) => l.includes('roadmaps/later/road-to-awaits-a-file.md')) as string;
        expect(row).toBeDefined();
        expect(row.endsWith('<!-- ref-ignore -->')).toBe(true);
    });

    it('omits the section entirely when later/ holds no roadmaps', () => {
        mk('road-to-active.md', ['# Active', '', '## Phase 1 — Go', '- [ ] open one', ''].join('\n'));
        const { dashboard } = regen();
        expect(dashboard).not.toContain('## Parked —');
    });
});

describe('parse_blockers — instruction text is never truncated', () => {
    it('keeps a "What to do:" that starts inline on the marker line', () => {
        const text = [
            '# Roadmap',
            '',
            '## Blockers',
            '',
            '### blocker: inline-prose',
            '- **Status:** open',
            '- **Owner:** user',
            '- **Blocks:** Phase 2',
            '- **What to do:** the build work is done; only real usage produces the',
            '  telemetry. Use the agent on parallel tasks, then check the log.',
            '- **Resolved when:** the log holds 20 lines',
            '',
        ].join('\n');
        const [b] = parse_blockers(text);
        expect(b?.todo.join(' ')).toBe(
            'the build work is done; only real usage produces the telemetry. ' +
                'Use the agent on parallel tasks, then check the log.',
        );
    });

    it('still reads the classic list form written under the marker', () => {
        const text = [
            '## Blockers',
            '',
            '### blocker: list-form',
            '- **Status:** open',
            '- **Owner:** user',
            '- **Blocks:** Phase 1',
            '- **What to do:**',
            '  1. First step.',
            '  2. Second step.',
            '- **Resolved when:** both steps land',
            '',
        ].join('\n');
        const [b] = parse_blockers(text);
        expect(b?.todo).toEqual(['1. First step.', '2. Second step.']);
    });

    it('keeps the continuation lines of a multi-line legacy blocked-until note', () => {
        const text = [
            '# Roadmap',
            '',
            '> Blocked until `yt-dlp` and a JavaScript runtime are installed by a human',
            '> on the machine that runs this. The package never auto-installs — that is',
            '> a contract, not a limitation to work around.',
            '',
            '## Phase 1 — Ship',
            '- [ ] step',
            '',
        ].join('\n');
        const [b] = parse_blockers(text);
        expect(b?.id).toBe('legacy');
        expect(b?.todo[0]).toBe(
            '`yt-dlp` and a JavaScript runtime are installed by a human on the machine ' +
                'that runs this. The package never auto-installs — that is a contract, ' +
                'not a limitation to work around.',
        );
    });

    it('stops the legacy note at the end of its quote block', () => {
        const text = [
            '> Blocked until the thing clears.',
            '',
            '> An unrelated later blockquote that must not be swallowed.',
            '',
        ].join('\n');
        const [b] = parse_blockers(text);
        expect(b?.todo[0]).toBe('the thing clears.');
    });
});

describe('blocker status — a settled gate stops being counted as open', () => {
    const entry = (status: string): string =>
        [
            '## Blockers',
            '',
            '### blocker: settled',
            `- **Status:** ${status}`,
            '- **Owner:** user',
            '- **Blocks:** Phase 2',
            '- **What to do:**',
            '  1. Nothing — it is done.',
            '- **Resolved when:** already',
            '',
        ].join('\n');

    it('reads the status as a PREFIX, so a dated resolution still resolves', () => {
        // Measured 2026-08-17: an author wrote the decision into the status
        // line, an equality check matched neither open nor resolved, and the
        // entry was rendered by `agent-config gates` as a live decision two
        // days after it had been taken.
        const [b] = parse_blockers(
            entry('RESOLVED 2026-08-17 — **option (b)**, narrowed to two rules'),
        );
        expect(blocker_is_resolved(b!)).toBe(true);
    });

    it('still resolves the plain form, and still leaves an open one open', () => {
        expect(blocker_is_resolved(parse_blockers(entry('resolved'))[0]!)).toBe(true);
        expect(blocker_is_resolved(parse_blockers(entry('open'))[0]!)).toBe(false);
        expect(
            blocker_is_resolved(parse_blockers(entry('open — sequenced as the next gate'))[0]!),
        ).toBe(false);
    });

    it('does not resolve a status that merely mentions the word', () => {
        // The pattern anchors at the START of the field, so a status that
        // describes what resolution would require is not itself a resolution.
        expect(
            blocker_is_resolved(
                parse_blockers(entry('open — resolved once the maintainer answers'))[0]!,
            ),
        ).toBe(false);
    });
});

describe('blocker class — the absent-field default is the safe end', () => {
    const withClass = (line: string): string =>
        [
            '## Blockers',
            '',
            '### blocker: classified',
            '- **Status:** open',
            '- **Owner:** user',
            '- **Blocks:** Phase 1',
            line,
            '- **What to do:**',
            '  1. Run `x`.',
            '- **Resolved when:** it exits 0',
            '',
        ].join('\n');

    it('an absent Class reads as 3 — nothing becomes runnable by omission', () => {
        const [b] = parse_blockers(withClass('- **Owner note:** none'));
        expect(b!.blockerClass).toBe('');
        expect(blocker_class(b!)).toBe('3');
    });

    it('reads 0, 1 and 2, and tolerates a trailing taxonomy name', () => {
        expect(blocker_class(parse_blockers(withClass('- **Class:** 0'))[0]!)).toBe('0');
        expect(
            blocker_class(parse_blockers(withClass('- **Class:** 1 — budget-preauthorized'))[0]!),
        ).toBe('1');
        expect(blocker_class(parse_blockers(withClass('- **Class:** 2'))[0]!)).toBe('2');
    });

    it('an unrecognised value falls back to 3, never to a runnable class', () => {
        expect(blocker_class(parse_blockers(withClass('- **Class:** auto'))[0]!)).toBe('3');
    });

    it('Run and Budget survive the parse', () => {
        const [b] = parse_blockers(
            [
                '## Blockers',
                '',
                '### blocker: paid',
                '- **Status:** open',
                '- **Owner:** user',
                '- **Blocks:** Phase 1',
                '- **Class:** 1',
                '- **Run:** `task bench:ab:live -- --budget 50`',
                '- **Budget:** ~50 USD per run',
                '- **What to do:**',
                '  1. Authorize it.',
                '- **Resolved when:** the receipt lands',
                '',
            ].join('\n'),
        );
        expect(b!.run).toBe('`task bench:ab:live -- --budget 50`');
        expect(b!.budget).toBe('~50 USD per run');
    });
});

// The tracked/untracked mode matrix for `--check`.
//
// `--check` used to treat an absent dashboard as stale, because
// `current = exists ? read : ''` and `stale = current !== new_text`. That made
// absence indistinguishable from staleness, so a repository that deliberately
// does not commit the dashboard could not run the gate at all. The fix is an
// explicit mode rather than an inferred one — the AI council (2026-08-21, both
// seats) refused an unconditional "absent means pass" because it cannot tell a
// correctly-untracked repository from a generator that silently stopped
// producing output.
//
// Every cell of the table is pinned here, including the two that would pass
// vacuously if the mode branch were deleted (tracked+absent, untracked+absent):
// each assertion below was observed RED against the pre-change script.
describe('update_roadmap_progress — --check tracked/untracked mode', () => {
    let tmp: string;
    let root: string;
    let roadmaps: string;

    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'urp-mode-'));
        root = path.join(tmp, 'proj');
        roadmaps = path.join(root, 'agents', 'roadmaps');
        fs.mkdirSync(roadmaps, { recursive: true });
        fs.writeFileSync(
            path.join(roadmaps, 'road-to-active.md'),
            ['# Active', '', '## Phase 1 — Go', '- [x] done', '- [ ] todo', ''].join('\n'),
            'utf-8',
        );
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    const DASH_REL = path.join('agents', 'roadmaps-progress.md');
    const dashAbs = (): string => path.join(root, DASH_REL);

    /** Generate a current dashboard into the fixture. */
    function generate(): void {
        const r = runTs(['--repo-root', root], tmp);
        expect(r.status, 'fixture regen').toBe(0);
        expect(fs.existsSync(dashAbs()), 'fixture dashboard written').toBe(true);
    }

    function check(...extra: string[]): SpawnSyncReturns<string> {
        return runTs(['--repo-root', root, '--check', ...extra], tmp);
    }

    /** A real git repo, because the untracked-mode probe asks the git index. */
    function gitInit(): void {
        for (const args of [
            ['init', '--quiet'],
            ['config', 'user.email', 't@example.com'],
            ['config', 'user.name', 'T'],
        ]) {
            const r = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
            expect(r.status, `git ${args[0]}`).toBe(0);
        }
    }

    function gitAdd(rel: string): void {
        const r = spawnSync('git', ['add', '--', rel], { cwd: root, encoding: 'utf8' });
        expect(r.status, 'git add').toBe(0);
    }

    it('tracked mode is the DEFAULT — no flag behaves exactly like --tracked-mode', () => {
        generate();
        expect(check().status, 'default, current').toBe(0);
        expect(check('--tracked-mode').status, 'explicit, current').toBe(0);
        fs.rmSync(dashAbs());
        expect(check().status, 'default, absent').toBe(1);
        expect(check('--tracked-mode').status, 'explicit, absent').toBe(1);
    });

    it('tracked + absent → exit 1, and the message says MISSING, not stale', () => {
        // Pre-change this said "is stale" for a file that was never there, which
        // is the wording defect that hid the whole distinction.
        expect(fs.existsSync(dashAbs())).toBe(false);
        const r = check('--tracked-mode');
        expect(r.status, 'exit').toBe(1);
        expect(r.stderr, 'missing marker').toContain('is missing');
        expect(r.stderr, 'points at the escape hatch').toContain('--untracked-mode');
    });

    it('tracked + present + stale → exit 1', () => {
        generate();
        fs.appendFileSync(dashAbs(), '\nDRIFT\n', 'utf-8');
        const r = check('--tracked-mode');
        expect(r.status, 'exit').toBe(1);
        expect(r.stderr, 'stale marker').toContain('is stale');
    });

    it('untracked + absent + not in the index → exit 0, and it does NOT claim to be up to date', () => {
        gitInit();
        expect(fs.existsSync(dashAbs())).toBe(false);
        const r = check('--untracked-mode');
        expect(r.status, 'exit').toBe(0);
        expect(r.stdout, 'honest wording').toContain('is not committed here');
        expect(r.stdout, 'never claims freshness for a file that is absent').not.toContain(
            'is up to date',
        );
    });

    it('untracked + absent + NO git repo at all → exit 0 (nothing is tracked there)', () => {
        expect(fs.existsSync(path.join(root, '.git')), 'no git in fixture').toBe(false);
        expect(check('--untracked-mode').status, 'exit').toBe(0);
    });

    it('untracked + still in the git index → exit 1 naming `git rm --cached`', () => {
        // The migration-incomplete cell: the repository declares the dashboard
        // untracked while git still carries it, so every branch keeps
        // conflicting on it. The gate prints the fix and never runs it.
        gitInit();
        generate();
        gitAdd(DASH_REL);
        const r = check('--untracked-mode');
        expect(r.status, 'exit').toBe(1);
        expect(r.stderr, 'names the state').toContain('still tracked by git');
        expect(r.stderr, 'names the fix').toContain('git rm --cached');
    });

    it('untracked + present + stale → exit 1 (untracked never means unchecked)', () => {
        gitInit();
        generate();
        fs.appendFileSync(dashAbs(), '\nDRIFT\n', 'utf-8');
        const r = check('--untracked-mode');
        expect(r.status, 'exit').toBe(1);
        expect(r.stderr, 'stale marker').toContain('is stale');
    });

    it('untracked + present + current → exit 0', () => {
        gitInit();
        generate();
        const r = check('--untracked-mode');
        expect(r.status, 'exit').toBe(0);
        expect(r.stdout, 'freshness wording is correct here').toContain('is up to date');
    });

    it('--untracked-mode is refused together with --archive, like every other check flag', () => {
        const r = runTs(['--repo-root', root, '--check', '--untracked-mode', '--archive'], tmp);
        expect(r.status, 'argparse exit').toBe(2);
        expect(r.stderr).toContain('not allowed with --check');
    });

    it('the usage banner names both modes', () => {
        const r = runTs(['--help'], tmp);
        expect(r.status).toBe(0);
        expect(r.stdout).toContain('--tracked-mode');
        expect(r.stdout).toContain('--untracked-mode');
    });
});
