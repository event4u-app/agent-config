/**
 * Session review baseline — the shape, the path, and the subtraction.
 *
 * WHY IT EXISTS. `end_review_nudge_hook` measures "did this session mutate
 * enough to owe a review" as `git diff --numstat HEAD` plus untracked non-doc
 * files, and its own header records the defect that reading produces: an
 * uncommitted change that PREDATES the session is charged to the session. The
 * header also records why it was not fixed — "no such baseline exists anywhere a
 * `stop` concern can read it (recording one would be new session-wide state, out
 * of this roadmap phase's one-concern scope)".
 *
 * That reason went stale. `session_start` is bound on seven hosts carrying
 * fourteen concerns (`hook_manifest.yaml`), so a per-session baseline has a slot
 * to be written from. The measured cost of leaving it: on an accumulator branch
 * the nudge fired on 1,771 lines of another session's uncommitted work and
 * became noise, which is worse than silence — an advisory that always fires is
 * an advisory nobody reads.
 *
 * ONE MODULE FOR BOTH SIDES, deliberately. The writer is a `session_start`
 * concern and the reader is a `stop` concern; if each owned its own idea of the
 * path or the field names, the reader would silently find nothing and the whole
 * mechanism would degrade to today's behaviour with no signal. That is the same
 * argument `turn_end_refusals.ts` makes for its own shared path, and it is why
 * `BASELINE_STATE_REL` is here rather than in either hook.
 *
 * WHAT IT IS NOT. It is not a change set: no paths, no fingerprints, no patch.
 * It answers exactly the question the nudge asks — how many non-doc lines were
 * already dirty when this session began — and nothing else. A path-level ledger
 * is a bigger object with a bigger privacy surface, and nothing in the nudge
 * consumes one.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * HEAD at this moment, or null.
 *
 * It lives HERE rather than in the writer because both sides need it and the
 * writer already imports from the reader's module: putting it in the hook would
 * make `end_review_nudge_hook → review_baseline_hook → end_review_nudge_hook` a
 * cycle. The shared module is the only place with no edge back.
 *
 * Null is a real answer and not an error path — a workspace that is not a git
 * repository, or one with no commit yet, has no HEAD, and `applyBaseline`
 * compares null to null happily. What it must never do is throw: one caller runs
 * on session start and the other on the stop path.
 */
export function currentHeadSha(cwd: string): string | null {
    try {
        const r = spawnSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' });
        if (r.status !== 0) return null;
        const out = (r.stdout ?? '').trim();
        return out === '' ? null : out;
    } catch {
        return null;
    }
}

/** State directory, relative to a workspace root. */
export const BASELINE_STATE_REL = path.join('agents', 'runtime', 'state', 'review-baseline');

export function baselineStateDir(workspaceRoot: string): string {
    return path.join(workspaceRoot, BASELINE_STATE_REL);
}

export function baselineStateFile(workspaceRoot: string, sessionKey: string): string {
    return path.join(baselineStateDir(workspaceRoot), `${sessionKey}.json`);
}

/** What `session_start` records, and `stop` reads back. */
export interface ReviewBaseline {
    /** HEAD at session start, or null where there is no repo / no commit yet. */
    head_sha: string | null;
    /** Non-doc mutated lines already present when the session began. */
    baseline_lines: number;
    written_at: string;
}

/**
 * Why a `stop` read could not subtract. Each value is written into the
 * `review_skipped` telemetry row, because a fallback nobody can see is
 * indistinguishable from the mechanism never having shipped.
 */
export type BaselineFallback =
    | 'absent' // no file — a host without session_start, or a session older than this
    | 'unreadable' // present and malformed
    | 'head-moved'; // the session committed, so the baseline's denominator is gone

export type BaselineOutcome =
    | { readonly applied: true; readonly baseline: ReviewBaseline; readonly lines: number }
    | { readonly applied: false; readonly fallback: BaselineFallback; readonly lines: number };

export function parseBaseline(raw: string): ReviewBaseline | null {
    let decoded: unknown;
    try {
        decoded = JSON.parse(raw);
    } catch {
        return null;
    }
    if (typeof decoded !== 'object' || decoded === null || Array.isArray(decoded)) return null;
    const o = decoded as Record<string, unknown>;
    const lines = o['baseline_lines'];
    if (typeof lines !== 'number' || !Number.isFinite(lines) || lines < 0) return null;
    const written = o['written_at'];
    if (typeof written !== 'string') return null;
    const head = o['head_sha'];
    return {
        head_sha: typeof head === 'string' && head !== '' ? head : null,
        baseline_lines: lines,
        written_at: written,
    };
}

/**
 * The baseline, or WHICH of the two not-found states applies.
 *
 * `absent` and `unreadable` are kept apart all the way to the telemetry row,
 * and collapsing them would have been the easy shape: both mean "cannot
 * subtract", both fall back identically. They are different findings. `absent`
 * is the expected steady state on a host with no `session_start` slot and on
 * every session that started before this shipped; `unreadable` is a corrupt
 * write, and a rate of it above noise is a defect in this mechanism rather than
 * a property of the host. A single bucket would hide the second inside the
 * first, which is the population it is smallest against.
 */
export function readBaseline(
    workspaceRoot: string,
    sessionKey: string,
): ReviewBaseline | 'absent' | 'unreadable' {
    const file = baselineStateFile(workspaceRoot, sessionKey);
    let raw: string;
    try {
        raw = fs.readFileSync(file, 'utf-8');
    } catch {
        return 'absent';
    }
    return parseBaseline(raw) ?? 'unreadable';
}

/**
 * Apply the baseline to a measured line count.
 *
 * FAIL OPEN, NEVER SILENT — the three not-applied branches all return the
 * UNSUBTRACTED count, so every failure mode of this mechanism degrades to
 * exactly the behaviour that shipped before it. The alternative, returning zero
 * or refusing to fire, would let a missing state file silence a genuine review
 * obligation, and a safety advisory must not be disarmed by its own
 * instrumentation failing.
 *
 * `head-moved` is the branch worth naming. A session that committed mid-run
 * moved HEAD, so `git diff HEAD` now measures against a different base than the
 * baseline did and the subtraction is arithmetic over two different quantities.
 * It is caught rather than absorbed, because absorbing it would UNDER-report on
 * exactly the sessions that did the most work.
 *
 * The clamp at zero is not cosmetic either: a session that reverts part of a
 * pre-existing dirty tree measures below its own baseline, and a negative
 * comparison against the threshold would read as "no mutation" for a session
 * that deleted a thousand lines.
 */
export function applyBaseline(
    measuredLines: number,
    baseline: ReviewBaseline | 'absent' | 'unreadable',
    currentHeadSha: string | null,
): BaselineOutcome {
    if (baseline === 'absent' || baseline === 'unreadable') {
        return { applied: false, fallback: baseline, lines: measuredLines };
    }
    if (baseline.head_sha !== currentHeadSha) {
        return { applied: false, fallback: 'head-moved', lines: measuredLines };
    }
    return {
        applied: true,
        baseline,
        lines: Math.max(0, measuredLines - baseline.baseline_lines),
    };
}
