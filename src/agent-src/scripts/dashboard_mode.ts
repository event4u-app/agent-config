// The `--check` tracked/untracked mode table for the roadmap dashboard.
//
// Extracted from `update_roadmap_progress.ts` so the verdict is a pure function
// over observable state — the generator does the I/O, this decides. It also
// keeps that script under its per-file size cap.

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';

/**
 * Is the dashboard expected to be a committed artefact? Explicit, never
 * inferred from git state — an unconditional "absent means pass" cannot tell a
 * correctly-untracked repo from a generator that silently stopped producing
 * output. `tracked` is the default and the historical behaviour.
 */
export type DashboardMode = 'tracked' | 'untracked';

/**
 * Is `abs` in the git index? Used only by `--check --untracked-mode`, to tell
 * "correctly absent" from "still committed". No git at all answers `false`,
 * which is correct: nothing is tracked there.
 */
export function isTrackedInGit(abs: string, repo_root: string): boolean {
    const r = spawnSync('git', ['ls-files', '--error-unmatch', '--', abs], {
        cwd: repo_root,
        encoding: 'utf-8',
        timeout: 10_000,
    });
    return r.status === 0;
}

export interface DashboardStateInput {
    mode: DashboardMode;
    /** Is the file on disk? */
    present: boolean;
    /** Is the file in the git index? Only consulted in `untracked` mode. */
    trackedInGit: boolean;
    /** Does the on-disk content equal a fresh render? Only meaningful if present. */
    current: boolean;
    /** Repo-relative path, for the messages. */
    rel: string;
    /**
     * How to regenerate, for the stale/missing messages. Defaults to the
     * dashboard's own command. A second caller — `build_archive_index --check`
     * — reuses this table for a different generated artefact, and a message
     * telling that reader to run the dashboard generator would be wrong.
     */
    regen?: string;
    /**
     * What the artefact is called in the "deliberately does not commit the X"
     * hint. Defaults to `dashboard` so every existing message is byte-identical.
     */
    noun?: string;
}

export interface DashboardStateVerdict {
    /** True when the dashboard half of `--check` fails. */
    stale: boolean;
    /** Diagnostic for stderr, or null. */
    error: string | null;
    /** Success line for stdout, or null when `stale`. */
    ok: string | null;
}

// The SOURCE path, not `.augment/scripts/…`: that tree is a gitignored
// projection built by `task sync`, so the advice failed outright in a fresh
// worktree and in any CI step ordered before the sync.
const REGEN =
    'Run `./scripts-run src/agent-src/scripts/update_roadmap_progress` ' +
    'to regenerate (or `task roadmap-progress` in Taskfile projects).';

/**
 * The mode table:
 *
 *   tracked:   absent -> fail | present+stale -> fail | present+current -> pass
 *   untracked: in-index -> fail | absent -> pass | present+stale -> fail
 *              | present+current -> pass
 *
 * Absence is distinguished ONLY in untracked mode; a present file is
 * freshness-checked in both, so untracked never means unchecked.
 */
export function evaluateDashboardState(inp: DashboardStateInput): DashboardStateVerdict {
    const { mode, present, trackedInGit, current, rel } = inp;
    const regen = inp.regen ?? REGEN;
    const noun = inp.noun ?? 'dashboard';

    if (mode === 'untracked' && trackedInGit) {
        // Migration incomplete: declared untracked, still carried by git.
        // Print the fix; never run it — git-index ops are the user's.
        return {
            stale: true,
            error:
                `❌  ${rel} is still tracked by git, but this repository runs ` +
                '`--untracked-mode`. Untrack it, keeping the working-tree file:\n' +
                `      git rm --cached ${rel}\n`,
            ok: null,
        };
    }

    if (!present) {
        if (mode === 'tracked') {
            return {
                stale: true,
                error:
                    `❌  ${rel} is missing. ` +
                    regen.replace('to regenerate', 'to generate it') +
                    ' If this repository deliberately does not commit the ' +
                    `${noun}, pass \`--untracked-mode\`.\n`,
                ok: null,
            };
        }
        // untracked + absent: the declared state. "up to date" would mislead.
        return {
            stale: false,
            error: null,
            ok: `✅  ${rel} is not committed here (--untracked-mode) and no stale copy is on disk.\n`,
        };
    }

    if (!current) {
        return { stale: true, error: `❌  ${rel} is stale. ${regen}\n`, ok: null };
    }
    return { stale: false, error: null, ok: `✅  ${rel} is up to date.\n` };
}

/**
 * `evaluateDashboardState` against the real filesystem and git index. The
 * generator hands over the paths; every read the verdict needs happens here, so
 * the caller's check branch stays three lines.
 */
export function evaluateDashboardOnDisk(opts: {
    mode: DashboardMode;
    target: string;
    repo_root: string;
    rendered: string;
    rel: string;
    regen?: string;
    noun?: string;
}): DashboardStateVerdict {
    const present = fs.existsSync(opts.target);
    return evaluateDashboardState({
        mode: opts.mode,
        present,
        trackedInGit: opts.mode === 'untracked' && isTrackedInGit(opts.target, opts.repo_root),
        current: present && fs.readFileSync(opts.target, { encoding: 'utf-8' }) === opts.rendered,
        rel: opts.rel,
        ...(opts.regen === undefined ? {} : { regen: opts.regen }),
        ...(opts.noun === undefined ? {} : { noun: opts.noun }),
    });
}

/** One roadmap row, as far as the estate report below needs it. */
export interface EstateRow {
    rel: string;
    done: number;
    total_active: number;
    deferred: number;
}

/**
 * The `--check` report: the artefact's own verdict, then the estate-wide
 * conditions — completed-but-unarchived, and Iron Law 3 deferred items.
 *
 * `dashboardOnly` drops the estate half. Two obligations with two blast radii:
 * the artefact verdict is about ONE file and is safe behind a required status
 * check, while the estate conditions are about roadmaps an unrelated change
 * never touched, so requiring them turns any pre-existing estate defect into a
 * merge block on every PR. It did, on 2026-08-22.
 *
 * Extracted from the generator so the report is a pure function of the verdict
 * and two lists — and because the generator sits exactly on its 1500-line
 * source ceiling, where the honest way to add a feature is to take lines out.
 */
export function reportCheckVerdict(inp: {
    verdict: DashboardStateVerdict;
    complete: readonly EstateRow[];
    pending: readonly EstateRow[];
    dashboardOnly: boolean;
    warnMergeGated: () => void;
    gatedCount: number;
}): { rc: number; stdout: string; stderr: string } {
    const { verdict, dashboardOnly } = inp;
    const complete = dashboardOnly ? [] : inp.complete;
    const pending = dashboardOnly ? [] : inp.pending;
    let err = verdict.error ?? '';
    if (complete.length) {
        err +=
            '❌  Completed roadmaps are still in `agents/roadmaps/` — ' +
            'move them to `agents/roadmaps/archive/` (per the ' +
            '`roadmap-progress-sync` rule):\n';
        for (const r of complete) err += `      - ${r.rel}  (${r.done}/${r.total_active} done)\n`;
    }
    if (pending.length) {
        err +=
            '❌  Iron Law 3 — roadmaps with unresolved `[~]` deferred ' +
            'items must NOT auto-archive. Resolve via `roadmap-management § 4b` ' +
            '(spawn follow-up, restore, or cancel):\n';
        for (const r of pending) {
            err += `      - ${r.rel}  (${r.done}/${r.total_active} done · ${r.deferred} deferred)\n`;
        }
    }
    if (!dashboardOnly && inp.gatedCount > 0) inp.warnMergeGated();
    const rc = verdict.stale || complete.length > 0 || pending.length > 0 ? 1 : 0;
    return { rc, stdout: rc === 0 ? (verdict.ok ?? '') : '', stderr: err };
}

/** `--tracked-mode` / `--untracked-mode` → the mode, or null for any other token. */
export function parseModeToken(tok: string): DashboardMode | null {
    if (tok === '--tracked-mode') return 'tracked';
    if (tok === '--untracked-mode') return 'untracked';
    return null;
}
