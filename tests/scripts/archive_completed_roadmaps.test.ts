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
function runTs(args: string[], cwd: string): SpawnSyncReturns<string> {
    return spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd, env: childEnv(), encoding: 'utf8' });
}

function git(cwd: string, ...args: string[]): SpawnSyncReturns<string> {
    return spawnSync('git', args, { cwd, encoding: 'utf8' });
}


const COMPLETE = ['# Complete', '', '## Phase 1 — All', '- [x] all done', ''].join('\n');
const OPEN = ['# Open', '', '## Phase 1 — Go', '- [ ] not done', ''].join('\n');

/** A complete roadmap (every box `[x]`) carrying one blocker at `status`. */
function completeWithBlocker(status: 'open' | 'resolved'): string {
    return [
        '# Complete but undecided',
        '',
        '## Phase 1 — All',
        '- [x] all done',
        '',
        '## Blockers',
        '',
        '### blocker: b-undecided',
        `- **Status:** ${status}`,
        '- **Owner:** maintainer',
        '- **Blocks:** nothing in this roadmap',
        '- **What to do:** decide the mechanism',
        '- **Resolved when:** an ADR records the choice',
        '',
    ].join('\n');
}

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

    // Frozen records must survive the ref rewrite byte-for-byte. Measured
    // 2026-08-11: archiving one roadmap rewrote four artefacts under
    // `agents/evidence/reviews/`, including the `diff --git a/… b/…` and
    // `+++ b/…` headers inside a recorded review `diff.patch` — which detaches
    // the patch from the commit it records and makes `git apply` target a path
    // that diff never created. The sweep reported it as "4 ref(s) migrated",
    // i.e. as success, so nothing surfaced it.
    //
    // Both halves are asserted on purpose: an exclusion that also stopped
    // rewriting ordinary docs would pass a one-sided test while silently
    // breaking the sweep's actual job.
    it('--all leaves frozen records (agents/evidence/**, *.patch) untouched while still rewriting ordinary docs', () => {
        const repo = path.join(tmp, 'frozen');
        const patchBody = [
            'diff --git a/agents/roadmaps/road-to-complete.md b/agents/roadmaps/road-to-complete.md',
            'new file mode 100644',
            '--- /dev/null',
            '+++ b/agents/roadmaps/road-to-complete.md',
            '@@ -0,0 +1 @@',
            '+# Complete',
            '',
        ].join('\n');
        const findings = 'Reviewed agents/roadmaps/road-to-complete.md at that commit.\n';
        const evidencePatchRel = 'agents/evidence/reviews/x.review-input/diff.patch';
        const findingsRel = 'agents/evidence/reviews/x.findings.md';
        // A .patch OUTSIDE agents/evidence/ — excluded by the extension rule
        // alone, which is the half a prefix-only exclusion would miss.
        const loosePatchRel = 'internal/snapshots/old.patch';

        initUncommitted(repo, {
            'agents/roadmaps/road-to-complete.md': COMPLETE,
            [evidencePatchRel]: patchBody,
            [findingsRel]: findings,
            [loosePatchRel]: patchBody,
            'docs/some-adr.md': 'See agents/roadmaps/road-to-complete.md for detail.\n',
        });

        const ts = runTs(['--all'], repo);
        expect(ts.status, 'exit').toBe(0);

        // Frozen records: byte-identical to what was written.
        expect(fs.readFileSync(path.join(repo, evidencePatchRel), 'utf-8')).toBe(patchBody);
        expect(fs.readFileSync(path.join(repo, findingsRel), 'utf-8')).toBe(findings);
        expect(fs.readFileSync(path.join(repo, loosePatchRel), 'utf-8')).toBe(patchBody);

        // The sweep still does its job everywhere else.
        const adr = fs.readFileSync(path.join(repo, 'docs/some-adr.md'), 'utf-8');
        expect(adr.includes('agents/roadmaps/archive/road-to-complete.md')).toBe(true);
    });

    // Closing every box does not answer a question the roadmap raised for a
    // human. Measured: `b-highlights-mechanism` was surfaced in the 9.29
    // feedback roadmap, archived unanswered on step-count alone, and the
    // failure it predicted shipped into the 9.36.0 changelog head four
    // releases later. Both halves asserted — a guard that also held roadmaps
    // whose blockers are resolved would pass a one-sided test while stalling
    // the sweep's actual job.
    it('--all does not archive a complete roadmap whose blocker is still open, and names it', () => {
        const repo = path.join(tmp, 'open-blocker');
        initUncommitted(repo, {
            'agents/roadmaps/road-to-undecided.md': completeWithBlocker('open'),
        });

        const ts = runTs(['--all'], repo);

        expect(ts.status, 'exit').toBe(0);
        expect(ts.stderr, 'names the roadmap and the blocker id').toMatch(
            /road-to-undecided\.md.*b-undecided/s,
        );
        expect(ts.stdout, 'not reported as archived').not.toMatch(/✅\s+Archived/);
        // Stayed in the active tree — that is the whole point.
        expect(fs.existsSync(path.join(repo, 'agents/roadmaps/road-to-undecided.md'))).toBe(true);
        expect(
            fs.existsSync(path.join(repo, 'agents/roadmaps/archive/road-to-undecided.md')),
        ).toBe(false);
    });

    // `guarded-baseline` (council 2026-08-31, 2/2 convergent). Two shapes reach
    // the sweep and both must refuse: a well-formed record, whose box is `[]` so
    // the open-step test would already skip it — silently, which is the half this
    // adds — and a MALFORMED one on `[x]`, which without the check archives while
    // its own annotation says the step is not done.
    function guarded(glyph: string, redProof: string | null): string {
        const lines = [
            '# Guarded',
            '',
            '## Phase 12 — UX simplification',
            `- [${glyph}] <!-- roadmap-status: guarded-baseline -->`,
            '      **12.1** the command surface gains no topology argument',
            '      ```yaml',
            '      guarded_baseline:',
            '        category: future-mechanism',
            '        scope: src/scripts/council_cli.ts',
            '        command: npx vitest run tests/x.test.ts',
        ];
        if (redProof !== null) lines.push(`        red_proof: ${redProof}`);
        lines.push('        recheck_when: src/nope/selector.ts', '      ```', '');
        return lines.join('\n');
    }

    it('--all refuses a roadmap carrying a guarded baseline, and names it', () => {
        const repo = path.join(tmp, 'guarded-open');
        initUncommitted(repo, { 'agents/roadmaps/road-to-guarded.md': guarded(' ', 'RED 2026-08-31') });

        const ts = runTs(['--all'], repo);

        expect(ts.status, 'exit').toBe(0);
        expect(ts.stderr, 'names the roadmap and the state').toMatch(
            /road-to-guarded\.md.*1 guarded-baseline step\(s\)/s,
        );
        expect(fs.existsSync(path.join(repo, 'agents/roadmaps/road-to-guarded.md'))).toBe(true);
        expect(fs.existsSync(path.join(repo, 'agents/roadmaps/archive/road-to-guarded.md'))).toBe(
            false,
        );
    });

    it('--all refuses an annotation sitting on `[x]` — it would otherwise archive as complete', () => {
        const repo = path.join(tmp, 'guarded-checked');
        initUncommitted(repo, { 'agents/roadmaps/road-to-guarded.md': guarded('x', 'RED 2026-08-31') });

        const ts = runTs(['--all'], repo);

        expect(ts.status, 'exit').toBe(0);
        expect(ts.stderr).toContain('the canonical checkbox stays UNCHECKED');
        expect(fs.existsSync(path.join(repo, 'agents/roadmaps/archive/road-to-guarded.md'))).toBe(
            false,
        );
    });

    it('--all reports the missing `red_proof` as the reason, not just the refusal', () => {
        const repo = path.join(tmp, 'guarded-unproven');
        initUncommitted(repo, { 'agents/roadmaps/road-to-guarded.md': guarded('x', null) });

        const ts = runTs(['--all'], repo);

        expect(ts.stderr).toContain('red_proof');
        expect(fs.existsSync(path.join(repo, 'agents/roadmaps/archive/road-to-guarded.md'))).toBe(
            false,
        );
    });

    it('--all still archives a complete roadmap that carries no annotation', () => {
        const repo = path.join(tmp, 'guarded-absent');
        initUncommitted(repo, { 'agents/roadmaps/road-to-complete.md': COMPLETE });

        const ts = runTs(['--all'], repo);

        expect(ts.stderr).not.toContain('guarded-baseline');
        expect(fs.existsSync(path.join(repo, 'agents/roadmaps/archive/road-to-complete.md'))).toBe(
            true,
        );
    });

    // `--repo-root` exists so a caller that already resolved the project root
    // cannot have it re-derived from `git rev-parse` and land on an ANCESTOR —
    // in a monorepo sub-project that would archive the parent's roadmaps. The
    // dashboard generator passes it for exactly this reason.
    it('--repo-root wins over the git-toplevel resolution', () => {
        const outer = path.join(tmp, 'outer');
        // The enclosing repo carries its own complete roadmap; the sub-project
        // is a plain directory inside it. Sweeping the sub-project must leave
        // the outer roadmap alone.
        initUncommitted(outer, {
            'agents/roadmaps/road-to-outer.md': COMPLETE,
            'sub/agents/roadmaps/road-to-inner.md': COMPLETE,
        });
        const sub = path.join(outer, 'sub');

        // cwd is the OUTER repo — only --repo-root points at the sub-project.
        const ts = runTs(['--all', '--repo-root', sub], outer);

        expect(ts.status, 'exit').toBe(0);
        expect(
            fs.existsSync(path.join(sub, 'agents/roadmaps/archive/road-to-inner.md')),
            'sub-project roadmap archived',
        ).toBe(true);
        expect(
            fs.existsSync(path.join(outer, 'agents/roadmaps/road-to-outer.md')),
            'parent roadmap untouched',
        ).toBe(true);
    });

    it('--all still archives a complete roadmap whose blocker is resolved', () => {
        const repo = path.join(tmp, 'resolved-blocker');
        initUncommitted(repo, {
            'agents/roadmaps/road-to-decided.md': completeWithBlocker('resolved'),
        });

        const ts = runTs(['--all'], repo);

        expect(ts.status, 'exit').toBe(0);
        expect(ts.stderr).not.toMatch(/still open/);
        expect(fs.existsSync(path.join(repo, 'agents/roadmaps/archive/road-to-decided.md'))).toBe(
            true,
        );
    });
});
