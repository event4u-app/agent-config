/**
 * What the completion-review gate reads from a branch's history about its own
 * review passes: how many were recorded (the round count) and whether a re-bind
 * covers the code committed since the pass was first recorded.
 *
 * The gate's own parsers are passed in as {@link ReviewHistoryDeps}, so this
 * module imports nothing from the gate at run time.
 */
import * as path from 'node:path';

import type { FindingRow, Marker, Violation } from '../check_completion_review.js';
import { countReviewPasses, type RecordedPasses } from './review_round.js';

export interface ReviewHistoryDeps {
    git(repo: string, args: readonly string[]): { ok: boolean; stdout: string };
    markerOf(text: string): Marker | null;
    fixRefOf(reasonRef: string): string | null;
    isCodePath(p: string): boolean;
}

/**
 * Every review-artefact version committed at `rel` — followed across renames —
 * and at every other `*.findings.md` this branch touched, read for
 * {@link countReviewPasses}.
 *
 * Keyed on the BRANCH, not on one path (finding 4e47471d7760): counting only
 * `git log -- <rel>` let a rename, or a fresh artefact under a new name, restart
 * the count at 1 and sidestep `REVIEW_ROUND_CAP`. `siblings` is every
 * findings artefact the branch range wrote, deleted ones included.
 */
export function recordedReviewPassesWith(
    deps: ReviewHistoryDeps,
    repo: string,
    rel: string,
    siblings: readonly string[] = [],
): RecordedPasses {
    const markers: Array<Marker | null> = [];
    const seen = new Set<string>();
    const read = (logArgs: string[]): void => {
        const log = deps.git(repo, ['log', '--format=%H', '--name-only', ...logArgs]);
        let sha: string | null = null;
        for (const line of log.stdout.split('\n').map((l) => l.trim())) {
            if (/^[0-9a-f]{40}$/.test(line)) {
                sha = line;
                continue;
            }
            if (line === '' || sha === null || !line.endsWith('.md')) continue;
            const key = `${sha}:${line}`;
            if (seen.has(key)) continue;
            seen.add(key);
            const shown = deps.git(repo, ['show', key]);
            markers.push(shown.ok ? deps.markerOf(shown.stdout) : null);
        }
    };
    read(['--', rel]);
    read(['--follow', '--', rel]);
    for (const other of siblings) {
        if (other !== rel) read(['--', other]);
    }
    return countReviewPasses(markers);
}

/**
 * Every `*.findings.md` under the artefact directory that a commit of this
 * branch (reachable from `HEAD`, not from `base`) added, changed, renamed or
 * deleted. An unresolvable base is an empty list — the path's own history
 * still counts.
 */
export function branchReviewArtifactsWith(deps: ReviewHistoryDeps, repo: string, base: string, artifactDir: string): string[] {
    const dir = artifactDir.split(path.sep).join('/').replace(/\/+$/, '');
    const log = deps.git(repo, ['log', '--format=', '--name-only', '--no-renames', `${base}..HEAD`, '--', dir]);
    return [...new Set(log.stdout.split('\n').map((l) => l.trim()).filter((l) => l.endsWith('.findings.md')))];
}

/**
 * A re-bind may carry a review pass forward only over code the pass accounts
 * for (finding b84f74c7bd2f).
 *
 * A pass is keyed by its `prompt_hash` (or `legacy`), so re-binding the header
 * with the same key keeps the round — but it used to keep the VERDICT too, so an
 * honest-null of one scope re-bound to changed code certified code no reviewer
 * saw. Now every branch commit after the commit that first recorded this pass,
 * that touches a code path, must be cited by a `fixed` row of this artefact —
 * the fixes the review asked for. Any other code commit needs a new reviewer
 * pass (a new `prompt_hash`, the next round). Merge commits and commits the base
 * already has are not this branch's code.
 */
export function checkRebindCoverageWith(
    deps: ReviewHistoryDeps,
    repo: string,
    base: string,
    artifactAbs: string,
    current: Marker,
    rows: readonly FindingRow[],
): Violation[] {
    const rel = path.relative(repo, artifactAbs).split(path.sep).join('/');
    const key = current.promptHash ?? 'legacy';
    const log = deps.git(repo, ['log', '--format=%H', '--follow', '--', rel]);
    let first: string | null = null;
    for (const sha of log.stdout.split('\n').map((l) => l.trim()).filter(Boolean)) {
        const shown = deps.git(repo, ['show', `${sha}:${rel}`]);
        const m = shown.ok ? deps.markerOf(shown.stdout) : null;
        if (m !== null && (m.promptHash ?? 'legacy') === key) {
            first = sha; // log is newest-first, so the last match is the oldest
        }
    }
    if (first === null) {
        return [];
    }
    const cited = rows
        .filter((r) => r.status === 'fixed')
        .map((r) => deps.fixRefOf(r.reasonRef))
        .filter((t): t is string => t !== null);
    const after = deps.git(repo, ['rev-list', '--no-merges', `${first}..HEAD`, `^${base}`]);
    const uncovered: string[] = [];
    for (const sha of after.stdout.split('\n').map((l) => l.trim()).filter(Boolean)) {
        const files = deps.git(repo, ['diff-tree', '--no-commit-id', '--name-only', '-r', sha]);
        const touchesCode = files.stdout.split('\n').map((l) => l.trim()).filter(Boolean).some(deps.isCodePath);
        if (touchesCode && !cited.some((c) => sha.startsWith(c))) {
            uncovered.push(sha.slice(0, 12));
        }
    }
    if (uncovered.length === 0) {
        return [];
    }
    return [
        {
            kind: 'rebind-over-unreviewed-code',
            file: artifactAbs,
            detail:
                `this pass (${key === 'legacy' ? 'no prompt_hash' : `prompt_hash ${key.slice(0, 12)}…`}) was first ` +
                `recorded at ${first.slice(0, 12)}, and ${String(uncovered.length)} later code commit(s) are not ` +
                `fixes this artefact cites: ${uncovered.join(', ')}. A re-bind keeps the round, never the verdict — ` +
                'dispatch a new reviewer pass (new prompt_hash, next round) over the changed code (contract §2.1).',
        },
    ];
}
