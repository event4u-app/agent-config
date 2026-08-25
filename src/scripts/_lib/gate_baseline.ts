/**
 * Violation ratchet for gates whose scan root was repaired.
 *
 * WHY THIS EXISTS (council 2026-08-02, roadmap `road-to-gates-that-can-fail`
 * blocker `dead-gate-finding-triage`): repairing a dead scan root does not
 * create violations, it REVEALS violations that were invisible while the gate
 * scanned nothing. Landing the repair with a hard fail would turn `main` red on
 * debt the repairing change did not cause, blocking every unrelated merge
 * behind unrelated copy-editing. Suppressing the findings would be the same
 * green-on-nothing failure the repair exists to end.
 *
 * The adopted shape is a ratchet:
 *
 *   The repair records the revealed count as a per-gate baseline in
 *   `src/config/gate-violation-baselines.json`. The gate fails only when its
 *   count rises ABOVE the baseline. Lowering a baseline is a normal commit;
 *   raising one is a defect.
 *
 * This is not an allowlist: no individual violation is named or excused, the
 * number is committed, and every change to it shows as a delta in the diff.
 *
 * ## The anti-fossilization clause — why entries expire
 *
 * The council's own strongest objection to the ratchet was that a baseline
 * which never moves hardens from "debt" into "configuration", at which point it
 * IS suppression with extra steps. So an entry is not permanent: it carries the
 * date its repair landed, and after {@link STALE_AFTER_DAYS} days a baseline
 * that has not been lowered fails the gate with an escalation message. Clearing
 * it means one of three visible acts — fix the findings, lower the count, or
 * write a `reaffirmed` block whose non-empty reason lands in the diff.
 *
 * Dates are plain `YYYY-MM-DD`; ages are whole days in UTC, so the verdict does
 * not depend on the machine's timezone.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

/** Days a baseline may sit unchanged before it must be fixed or reaffirmed. */
export const STALE_AFTER_DAYS = 56;

/** Repo-relative location of the committed baseline file. */
export const BASELINE_REL = 'src/config/gate-violation-baselines.json';

/** A single gate's recorded debt. */
export interface BaselineEntry {
    /** Violation count revealed when the scan root was repaired. */
    count: number;
    /** `YYYY-MM-DD` the repair (or the last lowering) landed. */
    landed: string;
    /** What the counted violations are, so a reader need not re-derive them. */
    note: string;
    /** Optional clock reset — requires a reason, and the reason lands in the diff. */
    reaffirmed?: { date: string; reason: string };
}

export interface BaselineFile {
    /** Human-facing pointer back to the rule that governs this file. */
    $comment?: string;
    gates: Record<string, BaselineEntry>;
}

export type BaselineStatus =
    /** Count is at or under the baseline and the entry is still fresh. */
    | 'within'
    /** Count is below the baseline — the ratchet should be tightened. */
    | 'improved'
    /** Count rose above the baseline. This is the defect the ratchet catches. */
    | 'regressed'
    /** Count is within, but the entry has sat unchanged past the expiry. */
    | 'stale'
    /** No baseline recorded — zero violations is the only passing state. */
    | 'unbaselined';

export interface BaselineVerdict {
    status: BaselineStatus;
    /** True when the gate may exit 0. */
    ok: boolean;
    /** The effective baseline (0 when no entry exists). */
    baseline: number;
    actual: number;
    /** Whole days since `landed` (or since `reaffirmed.date` when present). */
    ageDays: number | null;
    /** One line, ready for stdout (ok) or stderr (not ok). */
    message: string;
}

function parseIsoDate(value: string): number | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return null;
    }
    const ms = Date.parse(`${value}T00:00:00Z`);
    return Number.isNaN(ms) ? null : ms;
}

function wholeDaysBetween(fromMs: number, toMs: number): number {
    return Math.floor((toMs - fromMs) / 86_400_000);
}

/** Read the committed baseline file. A missing file is an empty ratchet, not an error. */
export function loadBaselines(repoRoot: string, relPath: string = BASELINE_REL): BaselineFile {
    const abs = path.join(repoRoot, relPath);
    let raw: string;
    try {
        raw = fs.readFileSync(abs, 'utf8');
    } catch {
        return { gates: {} };
    }
    return parseBaselines(raw);
}

function parseBaselines(raw: string): BaselineFile {
    const parsed = JSON.parse(raw) as Partial<BaselineFile>;
    const out: BaselineFile = { gates: parsed.gates ?? {} };
    if (parsed.$comment !== undefined) out.$comment = parsed.$comment;
    return out;
}

/**
 * A baseline-resolution failure, which is a HARD error and never a fallback.
 *
 * `loadBaselines` returns an empty ratchet when the file is missing, and that
 * is correct for a working-tree read: a repository with no baseline file has no
 * ratchet. It is NOT correct for a target-commit read. There, a failure to
 * resolve the ref or the blob means the governing policy could not be
 * determined — and silently falling back to the working tree would let an
 * infrastructure error change which policy applies, invisibly. The AI council
 * was unanimous on this point (2026-08-25) and stated it applies to whichever
 * invariant won.
 */
export class BaselineResolutionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'BaselineResolutionError';
    }
}

/**
 * Read the baseline as it stands at a specific commit.
 *
 * `road-to-merge-surface-zero` Phase 3.1, under the **ABSOLUTE invariant** the
 * AI council picked 2/2 on 2026-08-25 to resolve blocker B5.
 *
 * ## Why the target commit and not the merge base
 *
 * The merge-base read was the roadmap's original proposal and it selects the
 * *contribution* invariant: a PR passes if it did not worsen the state it
 * branched from. The worked example that killed it uses numbers this repository
 * actually carries — `main` tightens `ci-parity:local-only` 165 → 160, a PR that
 * branched earlier measures 163, the merge-base read returns 165, the PR
 * **passes**, and after it merges `main` measures 163 against a baseline of 160.
 * **A tightening is undone by a PR that never touched the baseline file and
 * never saw a red.**
 *
 * The remedy of checking both was refused on a correctness ground rather than a
 * preference: **violation counts are not necessarily compositional.** Conflict
 * resolution, file movement, generated outputs and interactions with changes on
 * `main` can make a prospective merge regress even when the isolated PR delta is
 * non-positive. If trunk health is the invariant, the merge RESULT is what has
 * to be measured.
 *
 * ## Why the TARGET commit specifically, and not the merge tree
 *
 * The count is measured on the prospective merge tree; the **policy** is read
 * from the target. Reading the baseline out of the merge tree would let a PR
 * loosen the very number it is being judged against, in the same diff.
 *
 * @throws BaselineResolutionError when the ref or the blob cannot be resolved.
 */
export function loadBaselinesAt(
    repoRoot: string,
    targetRef: string,
    relPath: string = BASELINE_REL,
    run: (args: string[]) => string = (args) =>
        execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }),
): BaselineFile {
    let sha: string;
    try {
        sha = run(['rev-parse', '--verify', `${targetRef}^{commit}`]).trim();
    } catch {
        throw new BaselineResolutionError(
            `cannot resolve target ref "${targetRef}" — the governing baseline is unknown, ` +
                'and a working-tree fallback would let an infrastructure error decide the policy.',
        );
    }
    let raw: string;
    try {
        raw = run(['show', `${sha}:${relPath}`]);
    } catch {
        throw new BaselineResolutionError(
            `${relPath} does not exist at ${sha.slice(0, 9)} ("${targetRef}") — this is a ` +
                'resolution failure, NOT an empty ratchet. A missing blob at a named commit ' +
                'means the read was wrong, not that the ratchet is empty.',
        );
    }
    try {
        return parseBaselines(raw);
    } catch {
        throw new BaselineResolutionError(
            `${relPath} at ${sha.slice(0, 9)} is not parseable JSON — refusing to continue ` +
                'with an unknown policy.',
        );
    }
}

/**
 * The merge-base reading, kept as a DIAGNOSTIC and never as the verdict.
 *
 * Both council seats asked for this explicitly. It does not decide pass/fail; it
 * distinguishes two failures a reader cannot otherwise tell apart:
 *
 *   - `branch-regression` — the branch itself made the count worse. Fix the code.
 *   - `main-tightened` — the branch is unchanged and `main` improved underneath
 *     it. Rebase, then re-run.
 *
 * The distinction matters because the remediations differ, and one seat was
 * pointed about the wording: "rebase and re-run" is incomplete advice for a PR
 * that genuinely reintroduced violations, so a diagnostic must say which case it
 * is rather than always suggesting a rebase.
 */
export type RegressionCause = 'branch-regression' | 'main-tightened' | 'none';

export function diagnoseRegression(opts: {
    actual: number;
    targetBaseline: number;
    mergeBaseBaseline: number | null;
}): RegressionCause {
    if (opts.actual <= opts.targetBaseline) return 'none';
    if (opts.mergeBaseBaseline === null) return 'branch-regression';
    // The branch is at or under the policy it branched from, and it still
    // exceeds the target's policy: main tightened while this work was open.
    return opts.actual <= opts.mergeBaseBaseline ? 'main-tightened' : 'branch-regression';
}

export interface RatchetOptions {
    /** Gate name — the key in the baseline file. */
    gate: string;
    /** How many violations this run found. */
    actual: number;
    /** Absolute repo root. */
    repoRoot: string;
    /** Override the baseline file location (tests). */
    baselineRel?: string;
    /** Override "now" as `YYYY-MM-DD` (tests); defaults to the current UTC date. */
    today?: string;
}

/**
 * Judge a violation count against its recorded baseline.
 *
 * Callers keep their own reporting and exit codes — this returns a verdict, it
 * does not print or exit. A gate with no entry behaves exactly as it did before
 * the ratchet existed: any violation fails.
 */
export function checkRatchet(opts: RatchetOptions): BaselineVerdict {
    const { gate, actual } = opts;
    const file = loadBaselines(opts.repoRoot, opts.baselineRel ?? BASELINE_REL);
    const entry = file.gates[gate];

    if (entry === undefined) {
        return {
            status: 'unbaselined',
            ok: actual === 0,
            baseline: 0,
            actual,
            ageDays: null,
            message:
                actual === 0
                    ? `${gate}: 0 violation(s), no baseline needed.`
                    : `${gate}: ${actual} violation(s) and no recorded baseline — fix them, or ` +
                      `record the count in ${BASELINE_REL} if this is a scan-root repair ` +
                      'revealing pre-existing debt.',
        };
    }

    const anchor = entry.reaffirmed?.date ?? entry.landed;
    const anchorMs = parseIsoDate(anchor);
    const todayMs = parseIsoDate(opts.today ?? new Date().toISOString().slice(0, 10));
    const ageDays = anchorMs !== null && todayMs !== null ? wholeDaysBetween(anchorMs, todayMs) : null;

    if (actual > entry.count) {
        return {
            status: 'regressed',
            ok: false,
            baseline: entry.count,
            actual,
            ageDays,
            message:
                `${gate}: ${actual} violation(s) against a baseline of ${entry.count} — ` +
                `${actual - entry.count} new. A ratchet only turns one way: fix the new ` +
                `violation(s). Raising the baseline in ${BASELINE_REL} is a defect, not a fix.`,
        };
    }

    if (actual < entry.count) {
        return {
            status: 'improved',
            ok: true,
            baseline: entry.count,
            actual,
            ageDays,
            message:
                `${gate}: ${actual} violation(s), baseline ${entry.count} — ratchet is loose. ` +
                `Lower it to ${actual} in ${BASELINE_REL} (and refresh \`landed\`) so the ` +
                'gain cannot be silently given back.',
        };
    }

    if (ageDays !== null && ageDays > STALE_AFTER_DAYS) {
        return {
            status: 'stale',
            ok: false,
            baseline: entry.count,
            actual,
            ageDays,
            message:
                `${gate}: baseline of ${entry.count} has not moved in ${ageDays} days ` +
                `(limit ${STALE_AFTER_DAYS}). A baseline that never drops is suppression with ` +
                'extra steps. Fix the findings, lower the count, or add a `reaffirmed` block ' +
                `with a reason in ${BASELINE_REL}. Debt: ${entry.note}`,
        };
    }

    return {
        status: 'within',
        ok: true,
        baseline: entry.count,
        actual,
        ageDays,
        message:
            `${gate}: ${actual} violation(s) at baseline${ageDays === null ? '' : `, age ${ageDays}d`} ` +
            `— known debt, not new breakage. ${entry.note}`,
    };
}
