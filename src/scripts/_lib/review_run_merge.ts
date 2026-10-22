/**
 * Merge several `self_review_gate --findings-out` runs over ONE range into one
 * findings file whose coverage is whole only when the runs, together, read
 * every in-scope file of that range.
 *
 * Why it exists: a release span too large for one completed pass is reviewed as
 * a full pass plus scoped resume runs. Each run's coverage carries a `scope`,
 * which `check_finding_dispositions` refuses as release evidence (findings
 * cc59a3fd0ca7, 9229106e0826), and dropping the field by hand would be the
 * author-chosen narrowing that refusal exists for. The merge is the tool-side
 * route instead, and it trusts no run's own totals:
 *
 * - every run names the same review head and base (recorded in the file, or —
 *   for files written before the field — asserted by the caller and then
 *   REPRODUCED: each run's `filesTotal` must equal the in-scope set this module
 *   recomputes for that run's scope over the range);
 * - a run's reviewed set is the recomputed in-scope set for its scope minus the
 *   paths it reports unreviewed, and must match its `filesReviewed`;
 * - the union of the reviewed sets must equal the recomputed in-scope set for
 *   the union of the runs' prefixes — otherwise it refuses and names the files.
 *
 * What stays a run's own claim: the `unreviewed` list. A run that under-reports
 * it overstates its coverage, and nothing here can see that — the same limit
 * every single-run coverage block already has.
 *
 * Pure: the range listing is injected.
 */

export interface ReviewRange {
    head: string;
    base: string;
}

export interface RunFile {
    /** A label for messages, usually the file's basename. */
    name: string;
    json: Record<string, unknown>;
}

/** The reviewable changed files of `range` under `prefixes` (all when `null`). */
export type ListInScope = (range: ReviewRange, prefixes: readonly string[] | null) => string[];

export interface MergeOptions {
    /** Used only for a run that records no `review` range; the run must then reproduce it. */
    asserted?: ReviewRange;
    listInScope: ListInScope;
    /** Resolves a ref to its full commit, so `9ed4e09` and its full sha compare equal. */
    resolve: (ref: string) => string | null;
}

export type MergeResult =
    | { ok: true; merged: Record<string, unknown>; rangeSource: 'recorded' | 'asserted-reproduced' }
    | { ok: false; problems: string[] };

interface Coverage {
    chunks?: unknown;
    filesReviewed?: unknown;
    filesTotal?: unknown;
    unreviewed?: unknown;
    reviewCopies?: unknown;
    scope?: unknown;
}

const MAX_NAMED = 40;

function recordedRange(json: Record<string, unknown>): ReviewRange | null {
    const r = json['review'];
    if (r === null || typeof r !== 'object') return null;
    const { head, base } = r as Record<string, unknown>;
    return typeof head === 'string' && typeof base === 'string' && head !== '' && base !== '' ? { head, base } : null;
}

function prefixesOf(c: Coverage): string[] | null {
    if (c.scope === undefined || c.scope === null) return null;
    return Array.isArray(c.scope) ? c.scope.map((x) => String(x)) : [String(c.scope)];
}

export function mergeReviewRuns(runs: readonly RunFile[], opts: MergeOptions): MergeResult {
    const problems: string[] = [];
    if (runs.length === 0) {
        return { ok: false, problems: ['no run to merge'] };
    }

    // 1. One range, resolved to full commits.
    let range: ReviewRange | null = null;
    let anyAsserted = false;
    for (const run of runs) {
        const own = recordedRange(run.json);
        if (own === null && opts.asserted === undefined) {
            problems.push(`${run.name}: records no review head/base, and no range was asserted to reproduce`);
            continue;
        }
        anyAsserted ||= own === null;
        const raw = own ?? (opts.asserted as ReviewRange);
        const resolved = { head: opts.resolve(raw.head), base: opts.resolve(raw.base) };
        if (resolved.head === null || resolved.base === null) {
            problems.push(`${run.name}: review range ${raw.base}...${raw.head} does not resolve to commits`);
            continue;
        }
        const r = { head: resolved.head, base: resolved.base };
        if (range === null) {
            range = r;
        } else if (range.head !== r.head || range.base !== r.base) {
            problems.push(
                `${run.name}: reviewed ${r.base.slice(0, 12)}...${r.head.slice(0, 12)}, not ` +
                    `${range.base.slice(0, 12)}...${range.head.slice(0, 12)} — runs over different ranges do not merge`,
            );
        }
    }
    if (range === null || problems.length > 0) {
        return { ok: false, problems };
    }

    // 2. Each run's reviewed set, recomputed rather than read.
    const reviewed = new Set<string>();
    const union: string[] = [];
    let wholeSpan = false;
    let chunks = 0;
    let reviewCopies = 0;
    for (const run of runs) {
        const c = (run.json['coverage'] ?? {}) as Coverage;
        const prefixes = prefixesOf(c);
        if (prefixes === null) wholeSpan = true;
        else union.push(...prefixes);
        const inScope = opts.listInScope(range, prefixes);
        const set = new Set(inScope);
        if (c.filesTotal !== inScope.length) {
            problems.push(
                `${run.name}: records ${String(c.filesTotal)} in-scope file(s), but its scope over the range has ` +
                    `${String(inScope.length)} — it was not a run over this range`,
            );
            continue;
        }
        const unrev = Array.isArray(c.unreviewed)
            ? c.unreviewed.map((u) => (u !== null && typeof u === 'object' ? String((u as Record<string, unknown>)['path']) : String(u)))
            : [];
        const stray = unrev.filter((p) => !set.has(p));
        if (stray.length > 0) {
            problems.push(`${run.name}: reports unreviewed path(s) outside its own scope: ${stray.slice(0, 5).join(', ')}`);
            continue;
        }
        const unrevSet = new Set(unrev);
        const read = inScope.filter((p) => !unrevSet.has(p));
        if (c.filesReviewed !== read.length) {
            problems.push(
                `${run.name}: records ${String(c.filesReviewed)} reviewed file(s), but its scope minus its ` +
                    `unreviewed list is ${String(read.length)}`,
            );
            continue;
        }
        for (const p of read) reviewed.add(p);
        chunks += typeof c.chunks === 'number' ? c.chunks : 0;
        reviewCopies = Math.max(reviewCopies, typeof c.reviewCopies === 'number' ? c.reviewCopies : 0);
    }
    if (problems.length > 0) {
        return { ok: false, problems };
    }

    // 3. The union must equal the recomputed target set.
    const prefixes = wholeSpan ? null : [...new Set(union)];
    const target = opts.listInScope(range, prefixes);
    const missing = target.filter((p) => !reviewed.has(p));
    if (missing.length > 0) {
        return {
            ok: false,
            problems: [
                `the runs together read ${String(target.length - missing.length)} of ${String(target.length)} ` +
                    `in-scope file(s); ${String(missing.length)} never read: ${missing.slice(0, MAX_NAMED).join(', ')}` +
                    (missing.length > MAX_NAMED ? `, … (${String(missing.length - MAX_NAMED)} more)` : ''),
            ],
        };
    }

    // 4. Findings de-duplicated by fingerprint, first occurrence kept.
    const seen = new Set<string>();
    const findings: unknown[] = [];
    for (const run of runs) {
        const fs = Array.isArray(run.json['findings']) ? (run.json['findings'] as unknown[]) : [];
        for (const f of fs) {
            const id = f !== null && typeof f === 'object' ? (f as Record<string, unknown>)['finding_id'] : undefined;
            const key = typeof id === 'string' ? id : JSON.stringify(f);
            if (seen.has(key)) continue;
            seen.add(key);
            findings.push(f);
        }
    }

    const first = runs[0]!.json;
    const rangeSource = anyAsserted ? 'asserted-reproduced' : 'recorded';
    const merged: Record<string, unknown> = {
        ...Object.fromEntries(
            ['schema_version', 'review_independence', 'context_relation', 'acceptance_status', 'assurance', 'reviewers']
                .filter((k) => k in first)
                .map((k) => [k, first[k]]),
        ),
        review: { head: range.head, base: range.base, range_source: rangeSource },
        coverage: {
            chunks,
            filesReviewed: target.length,
            filesTotal: target.length,
            unreviewed: [],
            reviewCopies,
            // Not `scope`: the target set is the declared in-scope class set the
            // runs were bound to, read for the reader, never a narrowing.
            in_scope_prefixes: prefixes,
            merged_from: runs.map((r) => {
                const c = (r.json['coverage'] ?? {}) as Coverage;
                return { run: r.name, filesReviewed: c.filesReviewed, filesTotal: c.filesTotal };
            }),
        },
        findings,
    };
    return { ok: true, merged, rangeSource };
}
