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
}

export interface DashboardStateVerdict {
    /** True when the dashboard half of `--check` fails. */
    stale: boolean;
    /** Diagnostic for stderr, or null. */
    error: string | null;
    /** Success line for stdout, or null when `stale`. */
    ok: string | null;
}

const REGEN =
    'Run `node node_modules/.bin/tsx .augment/scripts/update_roadmap_progress.ts` ' +
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
                    REGEN.replace('to regenerate', 'to generate it') +
                    ' If this repository deliberately does not commit the ' +
                    'dashboard, pass `--untracked-mode`.\n',
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
        return { stale: true, error: `❌  ${rel} is stale. ${REGEN}\n`, ok: null };
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
}): DashboardStateVerdict {
    const present = fs.existsSync(opts.target);
    return evaluateDashboardState({
        mode: opts.mode,
        present,
        trackedInGit: opts.mode === 'untracked' && isTrackedInGit(opts.target, opts.repo_root),
        current: present && fs.readFileSync(opts.target, { encoding: 'utf-8' }) === opts.rendered,
        rel: opts.rel,
    });
}

/** `--tracked-mode` / `--untracked-mode` → the mode, or null for any other token. */
export function parseModeToken(tok: string): DashboardMode | null {
    if (tok === '--tracked-mode') return 'tracked';
    if (tok === '--untracked-mode') return 'untracked';
    return null;
}
