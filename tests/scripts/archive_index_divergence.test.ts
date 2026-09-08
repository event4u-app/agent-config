// The index/working-tree blocker divergence check (1b) and the staging of the
// moved path (1a) — `road-to-a-blocker-that-cannot-hide-in-the-archive` Phase 1.
//
// The defect these reconstruct shipped on 2026-09-08. An edit removing a
// roadmap's blocker was made in the working tree and never staged; `git mv`
// renamed the file AND moved the stale index entry; the archival sweep had
// validated the working tree (no blocker) while the commit carried the index
// (blocker present, `Status: open`). The archived roadmap therefore declared a
// blocker open that had already been relocated to an active roadmap, and a
// human reading `git status` caught it rather than any gate.
//
// Reproduced in six commands before the test was written, so the premise is
// measured rather than assumed:
//
//   git init; printf 'line1\nBLOCKER\n' > a.md; git add a.md; git commit
//   printf 'line1\n' > a.md          # unstaged removal
//   git mv a.md b.md                 # exit 0
//   cat b.md      → line1            # working tree
//   git show :b.md → line1 BLOCKER   # index — this is what a commit ships
//
// TS-only (the Python twin was deleted in ADR-200), so there is no byte-parity
// obligation and these drive the `.ts` engine alone.
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'agent-src', 'scripts', 'archive_completed_roadmaps.ts');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasGit(): boolean {
    return spawnSync('git', ['--version'], { encoding: 'utf8' }).status === 0;
}

function git(cwd: string, ...args: string[]): SpawnSyncReturns<string> {
    return spawnSync('git', args, { cwd, encoding: 'utf8' });
}

function runTs(args: string[], cwd: string): SpawnSyncReturns<string> {
    return spawnSync(TSX_BIN, [TS_SCRIPT, ...args], {
        cwd,
        env: { ...process.env, COLUMNS: '80' },
        encoding: 'utf8',
    });
}

const ROADMAP_REL = 'agents/roadmaps/road-to-complete.md';
const ARCHIVED_REL = 'agents/roadmaps/archive/road-to-complete.md';

/** A complete roadmap (every box `[x]`) carrying one OPEN blocker. */
const WITH_OPEN_BLOCKER = [
    '# Complete but undecided',
    '',
    '## Phase 1 — All',
    '- [x] all done',
    '',
    '## Blockers',
    '',
    '### blocker: b-relocated',
    '- **Status:** open',
    '- **Owner:** maintainer',
    '- **Blocks:** nothing in this roadmap',
    '- **What to do:** decide the mechanism',
    '- **Resolved when:** an ADR records the choice',
    '',
].join('\n');

/** The same roadmap after the blocker section is removed. */
const BLOCKER_REMOVED = ['# Complete but undecided', '', '## Phase 1 — All', '- [x] all done', ''].join(
    '\n',
);

/** The same roadmap with an unrelated prose edit and the blocker untouched. */
const PROSE_EDITED = WITH_OPEN_BLOCKER.replace('# Complete but undecided', '# Complete, retitled');

function initCommitted(dir: string, files: Record<string, string>): void {
    fs.mkdirSync(dir, { recursive: true });
    git(dir, 'init', '-q');
    git(dir, 'config', 'user.email', 'divergence@test.local');
    git(dir, 'config', 'user.name', 'divergence');
    write(dir, files);
    git(dir, 'add', '-A');
    git(dir, 'commit', '-qm', 'init');
}

function write(dir: string, files: Record<string, string>): void {
    for (const [rel, body] of Object.entries(files)) {
        const fp = path.join(dir, rel);
        fs.mkdirSync(path.dirname(fp), { recursive: true });
        fs.writeFileSync(fp, body, 'utf-8');
    }
}

describe.runIf(hasGit())('archive_completed_roadmaps — index vs working tree', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'acr-divergence-'));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    // The reconstruction. Without (1b) this archives: the working tree carries
    // no blocker, so the open-blocker refusal passes, and the commit then ships
    // the index — a blocker declared open inside an archived roadmap.
    it('REFUSES to archive when the staged blocker section disagrees with the working tree', () => {
        const repo = path.join(tmp, 'unstaged-removal');
        initCommitted(repo, { [ROADMAP_REL]: WITH_OPEN_BLOCKER });
        // The defect: remove the blocker, do NOT stage it.
        write(repo, { [ROADMAP_REL]: BLOCKER_REMOVED });

        const ts = runTs(['--all'], repo);

        expect(ts.status, 'exit').toBe(0);
        expect(ts.stderr).toMatch(/staged and working-tree blockers disagree/);
        expect(ts.stderr).toMatch(/blocker 'b-relocated': staged=open vs working tree=absent/);
        // Still in the active tree — the refusal is the whole point.
        expect(fs.existsSync(path.join(repo, ROADMAP_REL))).toBe(true);
        expect(fs.existsSync(path.join(repo, ARCHIVED_REL))).toBe(false);
    });

    // Polarity. The same edit, staged, is a resolved blocker and archives — so
    // the refusal above is about the DISAGREEMENT and not about the blocker.
    it('archives the same removal once it is staged', () => {
        const repo = path.join(tmp, 'staged-removal');
        initCommitted(repo, { [ROADMAP_REL]: WITH_OPEN_BLOCKER });
        write(repo, { [ROADMAP_REL]: BLOCKER_REMOVED });
        git(repo, 'add', '--', ROADMAP_REL);

        const ts = runTs(['--all'], repo);

        expect(ts.status, 'exit').toBe(0);
        expect(ts.stderr).not.toMatch(/staged and working-tree blockers disagree/);
        expect(fs.existsSync(path.join(repo, ARCHIVED_REL))).toBe(true);
        expect(fs.existsSync(path.join(repo, ROADMAP_REL))).toBe(false);
    });

    // Scoping, asserted rather than assumed. A whole-file comparison would
    // refuse here, and refusing archival over an unstaged typo trains
    // `git add -A`, which destroys the staging discipline (1b) depends on.
    it('does NOT refuse on an unstaged edit that leaves the blockers alone', () => {
        const repo = path.join(tmp, 'prose-only');
        initCommitted(repo, { [ROADMAP_REL]: PROSE_EDITED.replace('## Blockers', '## Notes') });
        // Retitle in the working tree only; no `## Blockers` section anywhere.
        write(repo, {
            [ROADMAP_REL]: PROSE_EDITED.replace('## Blockers', '## Notes').replace(
                '# Complete, retitled',
                '# Complete, retitled twice',
            ),
        });

        const ts = runTs(['--all'], repo);

        expect(ts.status, 'exit').toBe(0);
        expect(ts.stderr).not.toMatch(/staged and working-tree blockers disagree/);
        expect(fs.existsSync(path.join(repo, ARCHIVED_REL))).toBe(true);
    });

    // (1a). The move relocates the index ENTRY, so without the `git add` the
    // destination is committed with the stale staged content even when (1b)
    // legitimately allowed the difference through.
    it('stages the moved path so the commit carries the working-tree content', () => {
        const repo = path.join(tmp, 'staging-hygiene');
        const noBlockers = WITH_OPEN_BLOCKER.replace('## Blockers', '## Notes');
        initCommitted(repo, { [ROADMAP_REL]: noBlockers });
        // An unstaged, blocker-irrelevant edit — allowed past (1b) by design.
        write(repo, { [ROADMAP_REL]: noBlockers.replace('all done', 'all done, really') });

        const ts = runTs(['--all'], repo);
        expect(ts.status, 'exit').toBe(0);
        expect(fs.existsSync(path.join(repo, ARCHIVED_REL))).toBe(true);

        // Nothing left unstaged for the moved path: index === working tree.
        const unstaged = git(repo, 'diff', '--name-only', '--', ARCHIVED_REL);
        expect(unstaged.stdout.trim(), 'unstaged residue on the archived path').toBe('');
        // And what is staged is the edited content, not the committed one.
        const staged = git(repo, 'show', `:${ARCHIVED_REL}`);
        expect(staged.stdout).toContain('all done, really');
    });
});
