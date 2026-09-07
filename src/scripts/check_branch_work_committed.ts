/**
 * Refuse a push that leaves this branch's OWN work uncommitted.
 *
 * The defect, measured on 2026-09-07 in `fix/release-obligation-answerable`:
 * a merge-reconciliation baseline was computed, written into
 * `gate-violation-baselines.json` AFTER `git add`, and then committed with
 * `git commit --no-edit` — which captured the STAGED side. The reconciled
 * number stayed in the working tree, the push went out without it, and the
 * pushed branch asserted a baseline the tree contradicted. The operator found
 * it, not the pipeline.
 *
 * Nothing in CI can catch this class: CI checks out the pushed commit, where
 * the working tree that holds the lost edit does not exist. The only place the
 * evidence is available is the machine doing the push, which is why this gate
 * is pre-push and local-only — the same reach `check_branch_freshness` has.
 *
 * The discriminator, whose work is it:
 *
 * A dirty tree at push time is not automatically a defect. Gate scripts write
 * reports, a parallel session may touch a shared file, a test run leaves
 * artifacts. Blocking on all of it would train the operator to set the skip
 * variable, which is worse than no gate.
 *
 * So the split is by AUTHORSHIP, and it is decidable from git alone:
 *
 *   1. INDEX/WORKTREE DIVERGENCE (`MM`, `AM`, `RM`, …) — the file is staged
 *      AND changed again since. That is "edited after `git add`" as a fact, not
 *      an inference, and it is exactly the shape that produced the defect.
 *   2. STAGED AT ALL — `git add` is a recorded intent to ship the file, and a
 *      push carries commits rather than the index, so a staged-but-uncommitted
 *      path is this branch's work being left behind by definition. No
 *      authorship inference is needed for this class.
 *   3. A DIRTY FILE THIS BRANCH'S OWN COMMITS TOUCHED — the branch has been
 *      editing it deliberately, so an open change to it is this branch's
 *      unfinished work rather than someone else's noise.
 *   4. EVERYTHING ELSE — a dirty file the branch never committed, or an
 *      untracked file. Reported by name, never blocking: this is where a
 *      parallel session's edit and a gate script's own report output land, and
 *      the branch has no claim on either.
 *
 * Class 4 is advisory, and the residual limit is stated rather than hidden: a
 * file this branch created and has neither staged nor committed is
 * indistinguishable from a foreign untracked file. Class 2 closes it at the
 * first `git add` — which was itself a finding of testing this gate against the
 * live tree, where its own source file sat in class 4 until the rule was
 * widened.
 */
import * as path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

export interface WorkVerdict {
    /** False when the push must be refused. */
    ok: boolean;
    /** Files that are this branch's own unfinished work, with the reason. */
    blocking: { path: string; why: string }[];
    /** Files that are dirty but not this branch's to answer for. */
    advisory: string[];
}

/** One `git status --porcelain` row. */
interface StatusRow {
    index: string;
    worktree: string;
    path: string;
}

export function parsePorcelain(porcelain: string): StatusRow[] {
    const out: StatusRow[] = [];
    for (const line of porcelain.split('\n')) {
        if (line.length < 4) continue;
        const index = line[0] as string;
        const worktree = line[1] as string;
        let p = line.slice(3);
        // Renames read `R  old -> new`; the new path is the one that matters.
        const arrow = p.indexOf(' -> ');
        if (arrow !== -1) p = p.slice(arrow + 4);
        out.push({ index, worktree, path: p.replace(/^"|"$/gu, '') });
    }
    return out;
}

/**
 * The verdict, as a pure function of the two git readings — so the rules are
 * unit-testable without a repository, the shape `confirmGate` and
 * `preflightPosition` already use in this pipeline.
 */
export function classifyBranchWork(opts: {
    porcelain: string;
    /** Files this branch's own commits touched (`git diff --name-only base..HEAD`). */
    branchFiles: readonly string[];
}): WorkVerdict {
    const touched = new Set(opts.branchFiles);
    const blocking: { path: string; why: string }[] = [];
    const advisory: string[] = [];

    for (const row of parsePorcelain(opts.porcelain)) {
        const untracked = row.index === '?' && row.worktree === '?';
        const staged = row.index !== ' ' && !untracked;
        const dirty = row.worktree !== ' ' && !untracked;

        if (staged && dirty) {
            blocking.push({
                path: row.path,
                why: 'staged AND changed again since — edited after `git add`, so the commit would capture the stale side',
            });
            continue;
        }
        if (staged) {
            blocking.push({
                path: row.path,
                why: 'staged but never committed — `git add` records the intent to ship it, and a push carries commits, not the index',
            });
            continue;
        }
        if (dirty && touched.has(row.path)) {
            blocking.push({
                path: row.path,
                why: "this branch's own commits touch this file, so an open change to it is unfinished work from this branch",
            });
            continue;
        }
        advisory.push(row.path);
    }
    return { ok: blocking.length === 0, blocking, advisory };
}

function git(args: readonly string[]): string {
    const r = spawnSync('git', args, { cwd: REPO_ROOT, encoding: 'utf-8' });
    return r.status === 0 ? (r.stdout ?? '') : '';
}

/** Files this branch's commits touched, relative to where it left the base. */
export function branchOwnFiles(baseRef: string): string[] {
    const base = git(['merge-base', baseRef, 'HEAD']).trim();
    if (base === '') return [];
    return git(['diff', '--name-only', `${base}..HEAD`])
        .split('\n')
        .filter((l) => l.trim() !== '');
}

export function main(argv: readonly string[]): number {
    const quiet = argv.includes('--quiet');
    let baseRef = 'origin/main';
    const bi = argv.indexOf('--base');
    if (bi !== -1 && argv[bi + 1]) baseRef = argv[bi + 1] as string;

    const porcelain = git(['status', '--porcelain']);
    const verdict = classifyBranchWork({ porcelain, branchFiles: branchOwnFiles(baseRef) });

    // `scanned:` is this gate's own emptiness discriminator — a clean tree and
    // an unreadable one both produce no findings, and only this line separates
    // them.
    const rows = parsePorcelain(porcelain).length;
    process.stdout.write(`scanned: ${String(rows)}\n`);

    if (verdict.ok) {
        if (!quiet) {
            process.stdout.write(
                `✅  check_branch_work_committed: nothing of this branch's own work is uncommitted` +
                    (verdict.advisory.length > 0
                        ? ` (${String(verdict.advisory.length)} unrelated dirty path(s) left alone)\n`
                        : '\n'),
            );
        }
        if (verdict.advisory.length > 0 && !quiet) {
            for (const p of verdict.advisory) {
                process.stdout.write(`    ·  ${p} — not touched by this branch's commits\n`);
            }
        }
        return 0;
    }

    process.stderr.write(
        `❌  check_branch_work_committed: ${String(verdict.blocking.length)} file(s) carry this ` +
            "branch's own uncommitted work:\n",
    );
    for (const b of verdict.blocking) {
        process.stderr.write(`    - ${b.path}\n        ${b.why}\n`);
    }
    process.stderr.write(
        '    A push that leaves them behind ships a branch whose tree contradicts its own\n' +
            '    commits, and NO CI gate can see it — CI checks out the commit, never the tree\n' +
            '    the edit is sitting in.\n' +
            '    Commit them (or `git restore` what was not meant to land), then push again.\n' +
            '    Genuinely foreign changes are reported without blocking; if one of these is\n' +
            "    truly a parallel session's, commit around it with an explicit pathspec.\n" +
            '    WIP push: AGENT_CONFIG_SKIP_PREPUSH_WORKTREE=1.\n',
    );
    if (verdict.advisory.length > 0) {
        process.stderr.write(
            `    Left alone (${String(verdict.advisory.length)}): ${verdict.advisory.join(', ')}\n`,
        );
    }
    return 1;
}

const _isMain = (() => {
    const entry = process.argv[1];
    if (!entry) return false;
    try {
        return path.resolve(entry) === path.resolve(_HERE);
    } catch {
        return false;
    }
})();

if (_isMain) {
    process.exit(main(process.argv.slice(2)));
}
