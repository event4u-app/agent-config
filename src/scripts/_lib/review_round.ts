/**
 * Contract §2.1 `round:` and the review round cap (ADR-294) for
 * `check_completion_review`. Pure: the caller reads the path's history and
 * hands over the markers it recorded.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import type { FindingRow, Marker, Violation } from '../check_completion_review.js';

/**
 * The completion review closes after this many review passes (ADR-294). Rounds
 * 1-5 yielded 0.71-1.54 high+critical rows per artefact, rounds 6-10 0.38.
 */
export const REVIEW_ROUND_CAP = 5;

export interface RecordedPasses {
    passes: Set<string>;
    anyRound: boolean;
}

/**
 * One review pass: the reviewer prompt it ran on. Versions written before
 * `prompt_hash` existed cannot be told apart — every in-place re-bind moved
 * their `scope:` — so together they count as one pass.
 */
function passKey(marker: Marker): string {
    return marker.promptHash ?? 'legacy';
}

/**
 * Every review pass among the markers a path recorded across its WHOLE history.
 *
 * A pass is a reviewer dispatch, so a fix pass that re-binds in place with the
 * same `prompt_hash` is the same pass touched again — CI fixes and base merges
 * move the scope, not the round. The caller does not stop at the § 2.7 archive
 * rename: the archived rounds were committed at this path, so a fresh skeleton
 * after an archive continues the count instead of restarting it at 1.
 */
export function countReviewPasses(markers: Iterable<Marker | null>): RecordedPasses {
    const passes = new Set<string>();
    let anyRound = false;
    for (const prior of markers) {
        if (prior === null) {
            continue;
        }
        passes.add(passKey(prior));
        anyRound ||= prior.round !== undefined;
    }
    return { passes, anyRound };
}

/**
 * The header round must equal the number of review passes the path records,
 * this one included (`round-miscounted`); past {@link REVIEW_ROUND_CAP} the
 * review is closed (`round-cap-exceeded`). At the cap, a high or critical row
 * is deferred only to an owner report that exists (`cap-deferral-without-owner-report`):
 * the cap ends the review, it never closes a finding.
 */
export function checkReviewRound(
    repo: string,
    artifactAbs: string,
    current: Marker,
    rows: readonly FindingRow[],
    recorded: RecordedPasses,
): Violation[] {
    const rel = path.relative(repo, artifactAbs).split(path.sep).join('/');
    const { passes, anyRound } = recorded;
    if (current.round === undefined) {
        return anyRound
            ? [
                  {
                      kind: 'round-miscounted',
                      file: artifactAbs,
                      detail: 'the header dropped `round:` although an earlier version of this path carried it (contract §2.1 `round:`)',
                  },
              ]
            : [];
    }
    passes.add(passKey(current));
    const derived = passes.size;
    const violations: Violation[] = [];
    if (current.round !== derived) {
        violations.push({
            kind: 'round-miscounted',
            file: artifactAbs,
            detail:
                `the header reads round ${String(current.round)} but this path records ${String(derived)} review ` +
                `pass(es) — a re-bind with the same prompt_hash keeps the round, a new reviewer pass adds one, ` +
                'and an archive does not restart it (contract §2.1 `round:`)',
        });
    }
    if (derived > REVIEW_ROUND_CAP) {
        violations.push({
            kind: 'round-cap-exceeded',
            file: artifactAbs,
            detail:
                `review pass ${String(derived)} exceeds the cap of ${String(REVIEW_ROUND_CAP)} — the review closed at ` +
                `round ${String(REVIEW_ROUND_CAP)}: re-bind that round in place, defer open high/critical rows to ` +
                `${ownerReportPath(rel)} and medium/low rows to a ledger ref (contract §2.8)`,
        });
    }
    if (derived >= REVIEW_ROUND_CAP) {
        for (const row of rows) {
            const severe = row.severity === 'high' || row.severity === 'critical';
            if (!severe || row.status !== 'deferred') {
                continue;
            }
            const cited = /\S+\.owner-report\.md/.exec(row.reasonRef)?.[0];
            // Confined to the artefact's own directory inside the repository:
            // an absolute or `..` path, or another review's report, proves
            // nothing about THIS round.
            const sameDir =
                cited !== undefined &&
                !path.isAbsolute(cited) &&
                path.posix.dirname(path.posix.normalize(cited)) === path.posix.dirname(rel);
            if (cited === undefined || !sameDir || !fs.existsSync(path.join(repo, cited))) {
                violations.push({
                    kind: 'cap-deferral-without-owner-report',
                    file: artifactAbs,
                    detail:
                        `row ${row.index} (line ${String(row.line)}): a ${row.severity} row deferred at the round cap must ` +
                        `cite an existing owner report, e.g. ${ownerReportPath(rel)} (contract §2.8)`,
                });
            }
        }
    }
    return violations;
}

/** `<dir>/<slug>.findings.md` → `<dir>/<slug>.owner-report.md`. */
function ownerReportPath(rel: string): string {
    return rel.replace(/\.findings\.md$/, '.owner-report.md');
}
