/**
 * The resume's rerun of the release-PR surface-equality check.
 *
 * Its own module so the release god-files do not grow (check_source_size_budget).
 */
import { _refresh_pr_body_from_head, gh } from '../release_publication.js';

const SURFACE_EQUALITY_CHECK = 'PR body equals CHANGELOG entry';

/**
 * Job ids of a failed surface-equality check, from
 * `gh pr checks --json name,bucket,link`. The check runs on `pull_request`
 * pushes only, so a body refresh never re-triggers it and its red verdict can
 * outlive the fix. The resume reruns it once against the current body; a
 * genuine failure goes red again and step 6 reports it. Every other red check
 * is left alone.
 */
export function _stale_surface_check_jobs(jsonText: string): string[] {
    let parsed: unknown;
    try {
        parsed = JSON.parse(jsonText);
    } catch {
        return [];
    }
    if (!Array.isArray(parsed)) {
        return [];
    }
    const ids: string[] = [];
    for (const entry of parsed) {
        if (typeof entry !== 'object' || entry === null) {
            continue;
        }
        const e = entry as Record<string, unknown>;
        if (e['name'] !== SURFACE_EQUALITY_CHECK || e['bucket'] !== 'fail' || typeof e['link'] !== 'string') {
            continue;
        }
        const job = /\/job\/(\d+)/u.exec(e['link']);
        if (job) {
            ids.push(job[1] as string);
        }
    }
    return ids;
}

function _rerun_stale_surface_check(branch: string): void {
    const checks = gh(['pr', 'checks', branch, '--json', 'name,bucket,link'], { check: false });
    for (const job of _stale_surface_check_jobs(checks.stdout ?? '')) {
        process.stdout.write(`        · rerunning red "${SURFACE_EQUALITY_CHECK}" (job ${job}) against the current body\n`);
        // GitHub refuses while the workflow run is still going, and a token
        // without actions:write cannot rerun at all — neither may kill a resume.
        const rerun = gh(['run', 'rerun', '--job', job], { check: false });
        if (rerun.returncode !== 0) {
            process.stdout.write(
                `⚠️  rerun refused: ${(rerun.stderr || rerun.stdout).trim()}\n` +
                    `    rerun it by hand once the run finished: gh run rerun --job ${job}\n`,
            );
        }
    }
}

/** A resume's step 5: re-derive the PR body, then rerun the check that body edit cannot re-trigger. */
export function refresh_pr_body_and_surface_check(branch: string, target: string): void {
    _refresh_pr_body_from_head(branch, target);
    _rerun_stale_surface_check(branch);
}
