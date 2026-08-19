/**
 * Emission shaping — the dispatcher's outbound half of the injection budget.
 *
 * WHY THIS EXISTS (road-to-standing-context-40k, D-4 "Advisory injectors stack
 * on the same slots", Phase 4 steps 4.1 and 4.2).
 *
 * `src/config/hook-token-budget.json` has registered per-concern and per-slot
 * byte caps since road-to-token-economy-cache Phase 3, and
 * `bench_hook_injection` reds the build on a breach. That is an AUTHORING-time
 * control: it stops a new injector from growing the budget unnoticed. Nothing
 * acted at RUNTIME — a live session that actually produced more bytes than the
 * registered ceiling emitted all of them anyway, and two concerns whose triggers
 * happen to overlap on one prompt both injected, because no layer had ever been
 * asked which one the model should get.
 *
 * This module is that layer, and it is deliberately PURE: the dispatcher hands
 * it a list of candidate emissions and gets back what to keep, what to drop, and
 * why. Every branch is decidable from the arguments, so the paired negative
 * fixtures can force each drop path without a hook, a host, or a session.
 *
 * TWO POLICIES, APPLIED IN THIS ORDER, AND THE ORDER MATTERS.
 *
 *   1. NUDGE EXCLUSIVITY (4.2). At most one nudge-class advisory leaves per
 *      slot. Concerns opt in by carrying `nudge_rank: <n>` in the manifest;
 *      the LOWEST rank wins and the rest are dropped. Measured on this tree
 *      before the policy was written: the prompt
 *      "Use when starting parallel work in isolation from the current branch —
 *      spawn a git worktree … for src/a.ts, src/b.ts, src/c.ts and src/d.ts,
 *      each independently" fires `delegation-nudge` AND `skill-route` together,
 *      so the overlap the roadmap predicted is real rather than hypothetical.
 *   2. BYTE BUDGET (4.1). Drop lowest-severity advisories until the per-turn
 *      running total is under the registered ceiling.
 *
 * Exclusivity runs first because it is a RELEVANCE decision and the budget is a
 * VOLUME one: dropping the redundant nudge may put the slot under the ceiling on
 * its own, and a budget that had already evicted the more useful line by size
 * would have made the relevance call by accident.
 *
 * WHAT CAN NEVER BE DROPPED, BY CONSTRUCTION. A concern is exempt when its
 * manifest `severity` is anything other than `advisory`, or when it is
 * `fail_closed`. Neither policy can therefore silence a safety-relevant warning
 * — the failure that would make this module worse than the problem it solves.
 * When the exempt set alone exceeds the ceiling, the ceiling is reported as
 * exceeded and nothing is dropped: an honest overflow beats a quiet one.
 *
 * WHAT IS NOT CLAIMED. Dropping an advisory does not make the turn cheaper by
 * the dropped byte count in any measured sense — nothing in this tree observes
 * what the host does with an injected block. The claim is exactly the bounded
 * one: what the dispatcher WRITES per turn now has a ceiling and a recorded
 * reason for every line that did not survive it.
 */

import * as fs from "node:fs";
import * as path from "node:path";

/** Internal severity ladder, mirroring dispatch_hook's EXIT_* constants. */
export const RC_ALLOW = 0;
export const RC_BLOCK = 1;
export const RC_WARN = 2;

/** Why a candidate did not survive shaping. */
export type DropReason = "nudge_interference" | "injection_budget";

/** One concern's would-be emission, as the dispatcher already knows it. */
export interface EmissionCandidate {
    /** Manifest concern name — the id used in drop records. */
    readonly concern: string;
    /** Manifest `severity`. Anything but `advisory` is exempt. */
    readonly severity: string;
    /** Manifest `fail_closed`. True is exempt. */
    readonly failClosed: boolean;
    /** The concern's reduced exit code on the internal ladder. */
    readonly rc: number;
    /** Bytes this emission would contribute to the slot payload. */
    readonly bytes: number;
    /** Manifest `nudge_rank`; `null` when the concern is not nudge-class. */
    readonly nudgeRank: number | null;
}

export interface EmissionDrop {
    readonly concern: string;
    readonly bytes: number;
    readonly reason: DropReason;
    /** One line, safe for a dispatch-issues `detail` field. Ids and counts only. */
    readonly detail: string;
}

export interface ShapeResult {
    /** Concern names that survive, in the input order. */
    readonly kept: readonly string[];
    readonly dropped: readonly EmissionDrop[];
    /** Bytes the surviving set contributes. */
    readonly keptBytes: number;
    /**
     * True when the ceiling is still exceeded after every droppable candidate
     * was dropped — i.e. the exempt set alone is over. Never silent.
     */
    readonly ceilingExceeded: boolean;
}

export interface ShapeOptions {
    /**
     * Per-turn ceiling in bytes, or `null` to skip the budget policy entirely
     * (the `session_start` case — a one-shot restore slot the roadmap excludes
     * from the per-turn cap by name).
     */
    readonly capBytes: number | null;
    /** Bytes already emitted earlier in the same turn. Defaults to 0. */
    readonly spentBytes?: number;
}

/**
 * Exempt from BOTH policies. Kept as its own predicate so a caller can assert
 * the exemption directly rather than inferring it from a shaping outcome.
 */
export function isExempt(c: EmissionCandidate): boolean {
    if (c.failClosed) return true;
    return c.severity.trim().toLowerCase() !== "advisory";
}

/**
 * Eviction order among droppable candidates, lowest-value first:
 *
 *   1. `rc` ascending — an advisory that returned ALLOW is a quieter signal
 *      than one that returned WARN, so the ALLOW goes first. This is the
 *      "lowest-severity advisories first" the step asks for, read against the
 *      only severity axis a candidate actually varies on (manifest `severity`
 *      is `advisory` for every droppable one by construction).
 *   2. `bytes` DESCENDING — free the ceiling in the fewest drops. The
 *      alternative (smallest first) keeps the biggest single line and loses
 *      more distinct advisories; fewer-drops was chosen because each drop is a
 *      whole advisory the model never sees, and the count is what the reader
 *      of the dispatch-issues log has to reason about.
 *   3. `concern` ascending — a total order, so two runs on one input never
 *      disagree about which line survived.
 */
export function evictionOrder(
    a: EmissionCandidate,
    b: EmissionCandidate,
): number {
    if (a.rc !== b.rc) return a.rc - b.rc;
    if (a.bytes !== b.bytes) return b.bytes - a.bytes;
    return a.concern < b.concern ? -1 : a.concern > b.concern ? 1 : 0;
}

/**
 * Nudge exclusivity: keep the lowest `nudge_rank`, drop every other nudge.
 *
 * Ties break on concern name so the winner is stable; a tie is a manifest
 * defect rather than a runtime one, and `lint_hook_manifest` is where it should
 * eventually be caught — that check does not exist yet and this comment is the
 * honest statement of the gap, not a claim that it is covered.
 */
function _selectNudge(
    candidates: readonly EmissionCandidate[],
): { winner: string | null; losers: EmissionCandidate[] } {
    const nudges = candidates.filter(
        (c) => c.nudgeRank !== null && !isExempt(c),
    );
    if (nudges.length <= 1) return { winner: nudges[0]?.concern ?? null, losers: [] };
    const sorted = [...nudges].sort((a, b) => {
        const ra = a.nudgeRank as number;
        const rb = b.nudgeRank as number;
        if (ra !== rb) return ra - rb;
        return a.concern < b.concern ? -1 : a.concern > b.concern ? 1 : 0;
    });
    const winner = sorted[0] as EmissionCandidate;
    return { winner: winner.concern, losers: sorted.slice(1) };
}

/**
 * Apply both policies and report what leaves.
 *
 * Total by construction: an empty candidate list, a `null` cap, or a cap the
 * input is already under all resolve to "keep everything, drop nothing".
 */
export function shapeEmissions(
    candidates: readonly EmissionCandidate[],
    opts: ShapeOptions,
): ShapeResult {
    const dropped: EmissionDrop[] = [];
    const droppedNames = new Set<string>();

    // ── Policy 1: nudge exclusivity ──────────────────────────────────────────
    const { winner, losers } = _selectNudge(candidates);
    for (const l of losers) {
        droppedNames.add(l.concern);
        dropped.push({
            concern: l.concern,
            bytes: l.bytes,
            reason: "nudge_interference",
            detail:
                `nudge-class advisory suppressed: '${String(winner)}' carries the lower ` +
                `nudge_rank on this slot (${String(l.nudgeRank)} vs the winner's)`,
        });
    }

    let survivors = candidates.filter((c) => !droppedNames.has(c.concern));
    const total = (set: readonly EmissionCandidate[]): number =>
        set.reduce((n, c) => n + c.bytes, 0);

    // ── Policy 2: byte budget ────────────────────────────────────────────────
    const spent = opts.spentBytes ?? 0;
    let ceilingExceeded = false;
    if (opts.capBytes !== null) {
        const cap = opts.capBytes;
        const droppable = survivors.filter((c) => !isExempt(c)).sort(evictionOrder);
        for (const victim of droppable) {
            if (spent + total(survivors) <= cap) break;
            droppedNames.add(victim.concern);
            dropped.push({
                concern: victim.concern,
                bytes: victim.bytes,
                reason: "injection_budget",
                detail:
                    `advisory dropped to hold the per-turn injection ceiling ` +
                    `(${String(cap)} B): ${String(spent + total(survivors))} B would have been emitted this turn`,
            });
            survivors = survivors.filter((c) => c.concern !== victim.concern);
        }
        ceilingExceeded = spent + total(survivors) > cap;
    }

    return {
        kept: survivors.map((c) => c.concern),
        dropped,
        keptBytes: total(survivors),
        ceilingExceeded,
    };
}

// ─── Per-turn accounting ─────────────────────────────────────────────────────
//
// The ceiling is per TURN, and a turn spans several dispatches: one
// `user_prompt_submit`, a `pre_tool_use`/`post_tool_use` pair per tool call,
// and one `stop`. So the running total has to survive between processes, which
// is what this small state file is for.
//
// It holds one session id and one integer. It has NO field capable of holding a
// prompt, a file body, or an emitted line — the same PII-exclusion-by-
// construction the telemetry and dispatch-issues surfaces use, applied here so
// a byte counter can never quietly become a content log.

/** The turn's running injection total. Counts only — never content. */
export interface TurnSpend {
    /** Session the count belongs to; a mismatch resets rather than accumulates. */
    readonly session: string;
    /** Bytes emitted so far in the current turn. */
    readonly bytes: number;
}

export const TURN_SPEND_BASENAME = "injection-turn.json";

export function turnSpendPath(workspaceRoot: string): string {
    return path.join(workspaceRoot, "agents", "runtime", "state", TURN_SPEND_BASENAME);
}

/**
 * Read the turn's spend so far. Returns 0 for a missing, unreadable, malformed,
 * or foreign-session file — every failure resolves to "this turn has spent
 * nothing", which under-counts rather than over-drops. An accounting error must
 * never be the reason an advisory disappears.
 */
export function readTurnSpend(workspaceRoot: string, session: string): number {
    try {
        const raw = fs.readFileSync(turnSpendPath(workspaceRoot), "utf-8");
        const parsed = JSON.parse(raw) as Partial<TurnSpend>;
        if (parsed.session !== session) return 0;
        return typeof parsed.bytes === "number" &&
            Number.isFinite(parsed.bytes) &&
            parsed.bytes >= 0
            ? parsed.bytes
            : 0;
    } catch {
        return 0;
    }
}

/**
 * Write the turn's spend. Best-effort and silent on failure — a counter that
 * cannot be persisted degrades to per-dispatch enforcement, which is strictly
 * weaker and never wrong in the dangerous direction.
 *
 * `reset` is passed on the slot that STARTS a turn (`user_prompt_submit`), so
 * the count is bounded by one turn rather than growing across a session.
 */
export function recordTurnSpend(
    workspaceRoot: string,
    session: string,
    bytes: number,
    opts: { readonly reset?: boolean } = {},
): void {
    if (process.env["AGENT_CONFIG_REPLAY"] === "1") return;
    const previous = opts.reset === true ? 0 : readTurnSpend(workspaceRoot, session);
    const entry: TurnSpend = { session, bytes: previous + Math.max(0, bytes) };
    try {
        const target = turnSpendPath(workspaceRoot);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, JSON.stringify(entry) + "\n", { encoding: "utf-8" });
    } catch {
        /* observability-adjacent bookkeeping never breaks the agent loop */
    }
}
