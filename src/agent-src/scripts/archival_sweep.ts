/**
 * Archival-sweep spawner for the roadmap dashboard.
 *
 * Split out of `update_roadmap_progress.ts` rather than authored there: that
 * file sits at the 1500-line source ceiling `check_source_size_budget`
 * ratchets, and the sweep plus its contract is the newest and most separable
 * thing in it. The contract below is that text, moved intact.
 *
 * `--archive` (opt-in; wired into `task roadmap-progress` and
 * `agent-config roadmap:progress`) runs the archival sweep before rendering
 * instead of printing "Completed roadmaps not yet archived" and leaving the
 * work to a human who has been ignoring the line for weeks. It is a flag rather
 * than the default because the PostToolUse hook re-runs the WRITE path once per
 * turn on every roadmap edit, and a hook that silently `git mv`s files mid-work
 * is a bigger problem than the warning it would remove. `--check` never
 * archives — see `run_archival_sweep`.
 *
 * WHY the warning existed at all, since this is the one place a reader of the
 * flag will look: the sweep's own default is `--changed-only`, so a PR archives
 * exactly the roadmaps it completed. A roadmap completed by a PR whose sweep did
 * not run is then complete, on the trunk, and OUTSIDE every later branch's
 * history — no `--changed-only` sweep finds it again. Measured 2026-08-20: six
 * such roadmaps, with every regen reprinting the warning at whoever ran it.
 * `/create-pr` § 1c keeps `--changed-only`; repo-wide reconciliation is this
 * flag's job and nothing else's.
 *
 * This layout is deliberate rather than convenient: the prose homes for it are
 * both at their ceilings (`roadmap-progress-mechanics.md` sits 122 chars under
 * the 16,000-char depth ceiling, and `roadmap-management/SKILL.md` tips
 * `skill_too_large` on any prose block), so the contract lives with the code it
 * governs. Moving it out means making room first.
 *
 * AI council 2026-08-20 (anthropic + openai, blind peer review): both seats
 * converged on explicit opt-in + `--all` scope + hook archival-free, and both
 * independently required the `--check` exclusion, the archive-before-render
 * order, and that a failed sweep must not render. RECORDED DISSENT: one seat
 * argued for flipping the sweep's own default to `--all` instead. Rejected —
 * that makes every PR a potential estate-wide cleanup, which is exactly what
 * `--changed-only` exists to prevent.
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

// Same directory as `update_roadmap_progress.ts`, so the `path.dirname` below
// resolves the sweep script exactly as it did before the split.
const _HERE = fileURLToPath(import.meta.url);

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

/**
 * Run the archival sweep for every complete roadmap, in-place.
 *
 * Spawned rather than imported: `archive_completed_roadmaps.ts` imports
 * `collect` from `update_roadmap_progress.ts`, so a static import back would close a cycle, and
 * `main()` is synchronous so a dynamic `await import()` is not available either.
 * The sweep is the same twin `_regen_dashboard` already spawns in the other
 * direction, so the spawn shape is the established one in this pair.
 *
 * No recursion: the sweep re-runs this script with NO flags, so its inner
 * dashboard pass has archival off and terminates at depth 2.
 *
 * `--all`, not the sweep's `--changed-only` default. The default exists so a PR
 * archives exactly the roadmaps it completed; here the caller asked the
 * repo-wide dashboard to reconcile the estate, and the roadmaps that leak are
 * by construction the ones NOT in this branch's history — six had accumulated
 * on the trunk while the warning printed every regen. A roadmap the sweep
 * refuses (open blockers) stays put and is still reported below.
 */
export function run_archival_sweep(root: string): SweepResult {
    const script = path.join(path.dirname(_HERE), 'archive_completed_roadmaps.ts');
    if (!_isFile(script)) {
        // A consumer install without the sweep script: nothing to run, and that
        // is a normal state — the warning below still reports the roadmaps.
        return { ran: false, ok: true, stdout: '', stderr: '' };
    }
    const argv = [script, '--all', '--repo-root', root];
    const binName = process.platform === 'win32' ? 'tsx.cmd' : 'tsx';
    let dir = path.dirname(_HERE);
    for (;;) {
        const candidate = path.join(dir, 'node_modules', '.bin', binName);
        if (fs.existsSync(candidate)) {
            return _sweepResult(spawnSync(candidate, argv, { cwd: root, encoding: 'utf-8' }));
        }
        const parent = path.dirname(dir);
        if (parent === dir) {
            break;
        }
        dir = parent;
    }
    return _sweepResult(spawnSync('npx', ['tsx', ...argv], { cwd: root, encoding: 'utf-8' }));
}

export interface SweepResult {
    ran: boolean;
    ok: boolean;
    stdout: string;
    stderr: string;
}

function _sweepResult(r: ReturnType<typeof spawnSync>): SweepResult {
    return {
        ran: true,
        ok: r.status === 0,
        stdout: String(r.stdout ?? ''),
        stderr: String(r.stderr ?? ''),
    };
}

