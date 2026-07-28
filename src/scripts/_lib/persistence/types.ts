/**
 * Shared types for the persistence-lint substrate (lint_persistence).
 *
 * Failure classes F1–F11 and rule ids R-A1…R-A11 / R-B1…R-B5 are defined in
 * agents/roadmaps/archive/road-to-scale-and-history-discipline.md (roadmap) and,
 * post-merge, in the scale-discipline / history-discipline pack rules.
 *
 * "Deterministic" throughout means: deterministic PATTERN detection with an
 * auditable waiver process — the linter identifies the pattern class
 * mechanically; instance-level correctness is contextual and handled by a
 * reasoned waiver, never by the linter claiming judgment it does not have.
 */

export type FailureClass =
    | 'F1' // N+1 queries
    | 'F2' // missing indexes
    | 'F3' // unbounded selects
    | 'F6' // unsafe migrations
    | 'F7' // unbounded table growth
    | 'F8' // missing audit history
    | 'F9' // sync work in request path
    | 'F11'; // non-durable async

export type FindingTier = 'gate' | 'advice';

export interface Finding {
    failure_class: FailureClass;
    rule: string; // e.g. "R-A6"
    file: string; // repo-relative path
    line: number; // 1-indexed
    message: string;
    tier: FindingTier;
    /** Set when the offending line carries a recognized waiver. */
    waived?: boolean;
    /** The waiver reason text, when present. */
    waiver_reason?: string;
}

export interface ScanResult {
    findings: Finding[];
    /** Files the adapter looked at (for coverage reporting). */
    scanned_files: string[];
    /** Waivers encountered, incl. empty-reason violations. */
    waivers: WaiverRecord[];
}

export interface WaiverRecord {
    file: string;
    line: number;
    kind: string; // 'no-index' | 'sync-required' | 'accepted-loss' | 'no-retention' | 'migration-unsafe'
    reason: string; // empty string = hygiene violation
}

/**
 * Waiver comment grammar (shared across adapters):
 *   PHP/TS:  // <kind>: <reason>     e.g. // no-index: read-heavy analytics column
 *   SQL:     -- <kind>: <reason>
 * Recognized kinds: no-index, sync-required, accepted-loss, no-retention,
 * migration-unsafe.
 */
export const WAIVER_KINDS = [
    'no-index',
    'sync-required',
    'accepted-loss',
    'no-retention',
    'migration-unsafe',
] as const;

const WAIVER_RE = new RegExp(
    String.raw`(?://|--|#)\s*(${WAIVER_KINDS.join('|')})\s*:\s*(.*)$`,
);

/** Parse a waiver on the given line (or the line directly above). */
export function parse_waiver(lines: string[], idx0: number): WaiverRecord | null {
    for (const i of [idx0, idx0 - 1]) {
        if (i < 0 || i >= lines.length) continue;
        const m = lines[i]!.match(WAIVER_RE);
        if (m) {
            return { file: '', line: i + 1, kind: m[1]!, reason: (m[2] ?? '').trim() };
        }
    }
    return null;
}

/** Directory names every persistence walker skips (dependency/build trees). */
export const IGNORED_DIRS: ReadonlySet<string> = new Set([
    'vendor',
    'node_modules',
    'storage',
    '.git',
    'bootstrap',
    'dist',
    'build',
    '.next',
    'coverage',
    // Test trees are not production read paths — R-A1/A2/A3/A8 target
    // production code; test-suite queries run against small fixtures. The
    // scan ROOT itself is never name-checked, so pointing the linter AT a
    // fixture tree still works.
    'tests',
    'Tests',
    'test',
    '__tests__',
    'spec',
]);

export function is_ignored_dir(name: string): boolean {
    return IGNORED_DIRS.has(name) || name.startsWith('.');
}
