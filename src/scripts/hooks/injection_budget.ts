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
 * exceeded and nothing is dropped: an honest overflow beats a quiet one, and
 * deleting advisories that cannot bring the total under the cap costs the model
 * every one of them for no benefit. That futility check is asserted, not merely
 * documented — the first version of this module omitted it and one of its own
 * tests pinned the omission, so the doc and the code disagreed until the R2
 * completion review caught it (2026-08-19).
 *
 * WHAT IS NOT CLAIMED. Dropping an advisory does not make the turn cheaper by
 * the dropped byte count in any measured sense — nothing in this tree observes
 * what the host does with an injected block. The claim is exactly the bounded
 * one: what the dispatcher WRITES per turn now has a ceiling and a recorded
 * reason for every line that did not survive it.
 *
 * WHAT THE CALLER MUST GUARANTEE, because this module cannot check it. The
 * candidate list must be the set that would ACTUALLY be emitted, not every
 * message collected during the dispatch. `keptBytes` becomes the persisted turn
 * spend, so feeding in messages the dispatcher never writes makes the ceiling
 * govern a quantity that was never injected — and can log a drop for a line that
 * was never going out. `dispatch_hook` filters by the deciding severity BEFORE
 * calling in; that filter is part of this contract, not a caller detail.
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { log_dispatch_issue } from "./dispatch_issues.js";
import { VERIFIED_PLATFORMS, emissionCarriesReasons, type Severity } from "./host_semantics.js";

/**
 * The event that STARTS a turn, and therefore the one that resets the per-turn
 * counter. A platform that does not bind it has no observable turn boundary,
 * which is a precondition of the volume policy.
 */
export const TURN_START_EVENT = "user_prompt_submit";

/** Internal severity ladder, mirroring dispatch_hook's EXIT_* constants. */
export const RC_ALLOW = 0;
export const RC_BLOCK = 1;
export const RC_WARN = 2;

/**
 * The host-facing severity for a reduced exit code, mirroring
 * `dispatch_hook._severity_for`. Local rather than imported: this module is
 * imported BY the dispatcher, so reaching back would close an import cycle.
 * Anything outside the ladder reads as `block`, the conservative direction —
 * an unknown verdict must never be treated as "emits nothing" and silently
 * skip the ceiling.
 */
function _severityForRc(rc: number): Severity {
    if (rc === RC_ALLOW) return "allow";
    if (rc === RC_WARN) return "warn";
    return "block";
}

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

/**
 * Why the ceiling is over, when it is. Kept as a discriminated value rather
 * than a boolean because the two causes want different operator messages and
 * point at different fixes: `exempt-floor` is a budget-row question, and
 * `carried-spend` is a question about what earlier dispatches in this turn
 * already emitted. A single boolean made the dispatcher blame the exempt set
 * for an overflow that was pure accumulation.
 */
export type CeilingCause = "exempt-floor" | "carried-spend";

export interface ShapeResult {
    /** Concern names that survive, in the input order. */
    readonly kept: readonly string[];
    readonly dropped: readonly EmissionDrop[];
    /** Bytes the surviving set contributes. */
    readonly keptBytes: number;
    /**
     * True when the ceiling is over after shaping. See `ceilingCause` for which
     * of the two reasons applies. Never silent.
     */
    readonly ceilingExceeded: boolean;
    /** Set exactly when `ceilingExceeded` is true. */
    readonly ceilingCause: CeilingCause | null;
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
 * defect rather than a runtime one, and `lint_hook_manifest` is where it is
 * caught — `_check_concerns` rejects a repeated non-null `nudge_rank`, naming
 * the rank and every concern declaring it, and rejects a non-positive-integer
 * value rather than coercing it (road-to-wiring-truth-corrections Phase 3;
 * cases in `tests/scripts/lint_hook_manifest.test.ts`). The tie-break below
 * therefore stays as the runtime's stable fallback for a manifest that got
 * past the lint, not as the only thing standing between a collision and a
 * silently non-emitting concern.
 *
 * The lint enforces uniqueness GLOBALLY while this selector compares within
 * one dispatch, so the lint is deliberately the stricter of the two — see its
 * own note for why, and narrow it rather than delete it if a design ever needs
 * one rank on two disjoint events.
 */
function _selectNudge(
    candidates: readonly EmissionCandidate[],
): { winner: string | null; winnerRank: number | null; losers: EmissionCandidate[] } {
    const nudges = candidates.filter(
        (c) => c.nudgeRank !== null && !isExempt(c),
    );
    if (nudges.length <= 1) {
        return {
            winner: nudges[0]?.concern ?? null,
            winnerRank: nudges[0]?.nudgeRank ?? null,
            losers: [],
        };
    }
    const sorted = [...nudges].sort((a, b) => {
        const ra = a.nudgeRank as number;
        const rb = b.nudgeRank as number;
        if (ra !== rb) return ra - rb;
        return a.concern < b.concern ? -1 : a.concern > b.concern ? 1 : 0;
    });
    const winner = sorted[0] as EmissionCandidate;
    return { winner: winner.concern, winnerRank: winner.nudgeRank, losers: sorted.slice(1) };
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
    const { winner, winnerRank, losers } = _selectNudge(candidates);
    for (const l of losers) {
        droppedNames.add(l.concern);
        dropped.push({
            concern: l.concern,
            bytes: l.bytes,
            reason: "nudge_interference",
            detail:
                `nudge-class advisory suppressed: '${String(winner)}' carries the lower ` +
                `nudge_rank on this slot (${String(winnerRank)} beats ${String(l.nudgeRank)})`,
        });
    }

    let survivors = candidates.filter((c) => !droppedNames.has(c.concern));
    const total = (set: readonly EmissionCandidate[]): number =>
        set.reduce((n, c) => n + c.bytes, 0);

    // ── Policy 2: byte budget ────────────────────────────────────────────────
    const spent = opts.spentBytes ?? 0;
    let ceilingExceeded = false;
    let ceilingCause: CeilingCause | null = null;
    if (opts.capBytes !== null) {
        const cap = opts.capBytes;
        const droppable = survivors.filter((c) => !isExempt(c)).sort(evictionOrder);
        // THE IRREDUCIBLE FLOOR — what the turn costs even after every droppable
        // advisory is gone: the spend already carried in, plus this dispatch's
        // exempt concerns.
        const floor = spent + total(survivors.filter(isExempt));

        // FUTILITY CHECK, and it is the whole point of this block. Dropping is
        // only justified when it can actually bring the total under the cap. If
        // the floor is already over, no sequence of drops helps, and deleting
        // advisories anyway costs the model every one of them and buys nothing —
        // while the header promises "nothing dropped". The first version of this
        // function had no such check and one of its own tests pinned the wrong
        // behaviour, so the doc and the code disagreed; found by the R2
        // completion review, 2026-08-19.
        if (floor > cap) {
            ceilingExceeded = true;
            // Attribute to whichever component is on its own responsible. The
            // two point at different fixes — a budget-row question vs a question
            // about what this turn already emitted — so a single label would
            // misdirect exactly one of them.
            ceilingCause = spent > cap ? "carried-spend" : "exempt-floor";
        } else {
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
            if (spent + total(survivors) > cap) {
                // Defensive: the floor check above proves a full sweep of the
                // droppable set gets under the cap, so this is unreachable. Kept
                // because "unreachable" is an argument, and a silent overflow is
                // the one outcome this module must never produce.
                ceilingExceeded = true;
                ceilingCause = spent > cap ? "carried-spend" : "exempt-floor";
            }
        }
    }

    return {
        kept: survivors.map((c) => c.concern),
        dropped,
        keptBytes: total(survivors),
        ceilingExceeded,
        ceilingCause,
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

/** The per-session directory the counters live in. */
export const TURN_SPEND_DIR_REL = path.join("agents", "runtime", "state", "injection-turn");

/** Keep the directory bounded; oldest files are pruned past this many. */
export const TURN_SPEND_MAX_FILES = 64;

/**
 * A session id reduced to ONE safe path segment.
 *
 * Two jobs, and the second is why a plain `replace` is not enough: the id is
 * host-supplied, so it must not escape the directory (`../`), and it must not
 * blow the filesystem's name limit. Anything outside a conservative charset is
 * replaced, and the basename carries a short digest of the ORIGINAL id so two
 * ids that sanitise to the same characters still land on different counters.
 *
 * The digest is a 32-bit FNV-1a-style mix over the id's UTF-16 code units — not
 * over its encoded bytes, and not a cryptographic hash. So the collision claim
 * is a PROBABILITY, not an absolute: ~2^-32 per pair, and the consequence of one
 * is exactly the shared-file defect this layout removes (the foreign read returns
 * 0, then the write clobbers). That is the honest bound; "can never collide" was
 * the first version of this sentence and an R2 review was right to reject it.
 */
export function turnSpendKey(session: string): string {
    const safe = session.replace(/[^A-Za-z0-9._-]/g, "_");
    let h = 0x811c9dc5;
    for (let i = 0; i < session.length; i += 1) {
        h ^= session.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    const digest = h.toString(16).padStart(8, "0");
    // The digest is unconditional rather than only-when-needed: a conditional
    // suffix means two code paths can produce the same basename for different
    // ids, which is the collision it exists to prevent.
    return `${safe.slice(0, 96)}.${digest}`;
}

/**
 * Path of ONE session's counter.
 *
 * Per session, not per workspace, and that was a defect rather than a
 * refinement: with a single shared file, two concurrent sessions in one
 * workspace read each other's record, saw a foreign id, resolved to "nothing
 * spent", and then overwrote it — so the ceiling was effectively unenforced for
 * both, every fire. The estate's existing pattern for per-session state is a
 * directory (`agents/runtime/state/end-review-nudge/`); this follows it.
 */
export function turnSpendPath(workspaceRoot: string, session: string): string {
    return path.join(workspaceRoot, TURN_SPEND_DIR_REL, `${turnSpendKey(session)}.json`);
}

/**
 * Drop the oldest counters once the directory passes its cap.
 *
 * A per-session file trades one unbounded counter for unbounded FILES, so the
 * cap is part of the same change rather than a follow-up. Best-effort and
 * silent: failing to prune must never affect a dispatch.
 */
function _pruneTurnSpend(dir: string): void {
    try {
        // `.tmp` is included deliberately: the temp file is `<name>.json.<pid>.tmp`,
        // which does NOT end in `.json`, so a `.json`-only filter left every temp
        // leaked by a crash between the write and the rename to accumulate forever
        // — unbounded growth in the directory this cap exists to bound.
        const entries = fs
            .readdirSync(dir)
            .filter((n) => n.endsWith(".json") || n.endsWith(".tmp"))
            .map((n) => {
                const p = path.join(dir, n);
                try {
                    return { p, mtime: fs.statSync(p).mtimeMs };
                } catch {
                    return { p, mtime: 0 };
                }
            })
            .sort((a, b) => b.mtime - a.mtime);
        for (const stale of entries.slice(TURN_SPEND_MAX_FILES)) {
            try {
                fs.unlinkSync(stale.p);
            } catch {
                /* a file another process already removed is the desired state */
            }
        }
    } catch {
        /* unreadable directory — nothing to prune, nothing to report */
    }
}

/**
 * Read the turn's spend so far. Returns 0 for a missing, unreadable, malformed,
 * or foreign-session file — every failure resolves to "this turn has spent
 * nothing", which under-counts rather than over-drops. An accounting error must
 * never be the reason an advisory disappears.
 */
export function readTurnSpend(workspaceRoot: string, session: string): number {
    try {
        const raw = fs.readFileSync(turnSpendPath(workspaceRoot, session), "utf-8");
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
 *
 * The write is a temp file plus a rename, which buys exactly one thing: no reader
 * ever sees a TORN file. It does NOT serialise the read-modify-write — the read
 * at the top of this function and the write below it are still two steps, so two
 * interleaved dispatches of the same session can still lose an update. Claiming
 * otherwise was an R2 finding on the first version of this docblock, and the
 * narrower claim is the true one. The residual failure is under-counting, which
 * is the safe direction: an accounting error must never be the reason an advisory
 * disappears. The sibling counter in this estate (`rule-trips.json`) uses the
 * same primitive for the same class of artefact in the same directory.
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
        const target = turnSpendPath(workspaceRoot, session);
        const dir = path.dirname(target);
        fs.mkdirSync(dir, { recursive: true });
        const tmp = `${target}.${String(process.pid)}.tmp`;
        fs.writeFileSync(tmp, JSON.stringify(entry) + "\n", { encoding: "utf-8" });
        fs.renameSync(tmp, target);
        _pruneTurnSpend(dir);
    } catch {
        /* observability-adjacent bookkeeping never breaks the agent loop */
    }
}

// ─── The dispatcher-facing entry point ───────────────────────────────────────
//
// Everything below used to live inline in `dispatch_hook.ts`. It moved here
// because it belongs here — resolving the ceiling, recording drops and writing
// the overflow line are emission-shaping concerns, not dispatch concerns — and
// because `check_source_size_budget` refused the inline version: dispatch_hook
// sat exactly on the 1,500-line ratchet ceiling, so 180 inline lines were 180
// new violations, and the gate says raising the baseline is a defect rather than
// a fix. A gate that forces the logic into the module that owns it is a gate
// doing its job.
//
// The context is passed IN rather than derived here, deliberately: the two facts
// only the dispatcher can cheaply answer (does this platform bind the turn-start
// event, did a real session id arrive) would otherwise need the manifest loader,
// and importing that from here would close an import cycle.

/**
 * One collected concern message, as the dispatcher already holds it.
 *
 * `def` is the manifest concern definition passed through verbatim rather than
 * unpacked at the call site: severity, `fail_closed` and `nudge_rank` are this
 * module's vocabulary, so reading them here keeps the dispatcher from carrying a
 * field list it has no other use for.
 */
export interface ConcernMessage {
    readonly rc: number;
    readonly text: string;
    readonly def: Record<string, unknown>;
}

/**
 * Everything `shapeAndRecord` needs that it cannot determine on its own.
 *
 * Deliberately five fields: the workspace root, the session key, whether a real
 * session id arrived, and whether the platform emits at all are all DERIVED here
 * from `envelope` and `platform` rather than passed. A caller that has to assemble
 * seven correlated booleans is a caller that will eventually assemble one wrongly.
 */
export interface ShapingContext {
    /** Package root — where the shipped budget row lives. */
    readonly packageRoot: string;
    /** The dispatch envelope; `workspace_root` and `session_id` are read from it. */
    readonly envelope: Record<string, unknown>;
    readonly platform: string;
    /** agent-config event name for this dispatch. */
    readonly event: string;
}

/**
 * Does this platform bind the turn-start event?
 *
 * Without it the counter never resets, grows monotonically, and suppresses every
 * droppable advisory for the rest of the session — so it is a precondition of the
 * volume policy, not a detail.
 *
 * Read straight off the compiled manifest rather than through
 * `dispatch_hook._resolve_concerns`, which would close an import cycle. The
 * question here is narrower than that resolver's — "is this slot bound at all",
 * with no role filtering — so a plain lookup is the honest tool and not a
 * shortcut. Unreadable manifest → `false`, which switches the volume policy off:
 * the fail-open direction for a policy whose job is to delete output.
 */
function _turnStartBound(packageRoot: string, platform: string): boolean {
    for (const rel of [
        ["src", "scripts", "hook_manifest.json"],
        ["src", "scripts", "hook_manifest.yaml"],
    ]) {
        try {
            const raw = fs.readFileSync(path.join(packageRoot, ...rel), "utf-8");
            if (rel[2] === "hook_manifest.json") {
                const parsed = JSON.parse(raw) as { manifest?: Record<string, unknown> };
                const platforms = parsed.manifest?.["platforms"] as
                    | Record<string, Record<string, unknown>>
                    | undefined;
                const bound = platforms?.[platform]?.[TURN_START_EVENT];
                return Array.isArray(bound) && bound.length > 0;
            }
            // YAML fallback: the binding is one `    user_prompt_submit: [...]`
            // line under the platform key. A structural read needs the YAML
            // parser, which this module deliberately does not pull in; absence of
            // the compiled sibling is a build defect surfaced elsewhere, so the
            // conservative answer is enough.
            return false;
        } catch {
            continue;
        }
    }
    return false;
}

/** Consumer workspace — where the turn counter and the drop log are written. */
function _workspaceRoot(ctx: ShapingContext): string {
    const v = ctx.envelope["workspace_root"];
    return typeof v === "string" && v ? v : process.cwd();
}

/**
 * The session key, or `null` when no real `session_id` arrived. The dispatcher's
 * fallback is unique per invocation by design, so a synthetic id makes the counter
 * unreadable and would silently turn a per-TURN ceiling into a per-dispatch one.
 */
function _sessionKey(ctx: ShapingContext): string | null {
    const v = ctx.envelope["session_id"];
    return typeof v === "string" && v ? v : null;
}

/**
 * The per-turn ceiling for this dispatch, or `null` when the VOLUME policy must
 * not run. `null` is the fail-open direction: a budget that cannot be read, or
 * whose turn boundary cannot be observed, must never become a budget of zero.
 */
export function resolveVolumeCap(ctx: ShapingContext): number | null {
    if (!VERIFIED_PLATFORMS.has(ctx.platform)) return null;
    if (_sessionKey(ctx) === null) return null;
    if (!_turnStartBound(ctx.packageRoot, ctx.platform)) return null;
    try {
        const raw = fs.readFileSync(
            path.join(ctx.packageRoot, "src", "config", "hook-token-budget.json"),
            "utf-8",
        );
        const cfg = (JSON.parse(raw) as Record<string, unknown>)["per_turn_aggregate_bytes"];
        if (cfg === undefined || cfg === null || typeof cfg !== "object") return null;
        const row = cfg as Record<string, unknown>;
        const excluded = row["excluded_slots"];
        if (Array.isArray(excluded) && excluded.map(String).includes(ctx.event)) return null;
        const ceiling = row["ceiling_bytes"];
        return typeof ceiling === "number" && ceiling > 0 ? ceiling : null;
    } catch {
        return null;
    }
}

/**
 * Shape this dispatch's would-be emissions, record every suppression, update the
 * turn counter, and return THE MESSAGE TEXTS THAT MAY LEAVE, in manifest order.
 *
 * It returns the texts rather than a name set so the caller cannot re-derive the
 * candidate set differently: the deciding-severity filter is part of this module's
 * contract (see the header's caller obligation), and a caller that applied it
 * twice — or once, differently — would make the ceiling govern bytes nothing ever
 * wrote.
 */
export function shapeAndRecord(
    ctx: ShapingContext,
    messages: readonly ConcernMessage[],
    finalRc: number,
): string[] {
    const deciding = messages.filter((m) => m.rc === finalRc);
    const textOf = (kept: ReadonlySet<string>): string[] =>
        deciding.filter((m) => kept.has(String(m.def["name"] ?? ""))).map((m) => m.text);
    const candidates: EmissionCandidate[] = deciding
        .map((m) => {
            const rank = m.def["nudge_rank"];
            return {
                concern: String(m.def["name"] ?? ""),
                severity: String(m.def["severity"] ?? ""),
                failClosed: Boolean(m.def["fail_closed"]),
                rc: m.rc,
                bytes: Buffer.byteLength(m.text, "utf-8"),
                nudgeRank: typeof rank === "number" ? rank : null,
            };
        });
    const workspaceRoot = _workspaceRoot(ctx);
    const sessionKey = _sessionKey(ctx) ?? "";
    const cap = resolveVolumeCap(ctx);
    // Where the emission carries nothing, skip the CHARGE — never the reset.
    // Two such cases, and one reason for both: this is an INJECTION ceiling, so
    // it may only charge bytes the host actually receives. Shaping output that
    // never left would write advisory-suppression records for nothing and —
    // worse — spend the turn's budget, so a LATER dispatch whose advisory WOULD
    // have been delivered gets dropped instead.
    //
    //   1. an unverified platform — `emitFor` returns the legacy pass-through,
    //      empty stdout AND stderr;
    //   2. a reduced verdict of ALLOW — `emitFor` returns
    //      `{exit: 0, stdout: "", stderr: ""}` for `severity: allow`, on every
    //      platform including the verified one.
    //
    // Case 2 was missed when this module landed, and it is not theoretical. A
    // non-`fail_closed` concern that CRASHES is fail-opened to `EXIT_ALLOW` by
    // the dispatcher and its stderr then becomes the deciding message — usually
    // the largest candidate in the set. Measured against this module before the
    // fix: a 9,000-byte rc-0 message emitted 0 bytes and charged 9,000, so about
    // five such dispatches exhausted a 47,104-byte turn ceiling on output nobody
    // received. `emissionCarriesReasons` is the shared predicate, kept beside
    // `emitFor` so it cannot drift from the function whose behaviour it reports.
    //
    // THE RESET STILL HAS TO RUN, and getting that wrong was an R2 finding on the
    // first version of this fix. `_reduce([])` is `EXIT_ALLOW`, so a
    // `user_prompt_submit` where no concern fires — the common case for
    // conditional-silence concerns — takes this branch. Returning here without
    // resetting left the PREVIOUS turn's total on disk, and later dispatches in
    // the new turn then dropped advisories to pay for bytes belonging to an
    // earlier one. Skipping a charge and skipping a boundary are different acts.
    if (!emissionCarriesReasons(ctx.platform, _severityForRc(finalRc))) {
        if (cap !== null && ctx.event === TURN_START_EVENT) {
            recordTurnSpend(workspaceRoot, sessionKey, 0, { reset: true });
        }
        return textOf(new Set(candidates.map((c) => c.concern)));
    }
    // On the turn-START slot the carried total is zero by definition: this is the
    // dispatch that begins the turn. Reading the stored value here budgeted the
    // new turn against the one that just ended.
    const turnStartsHere = ctx.event === TURN_START_EVENT;
    const spentBefore =
        cap === null || turnStartsHere ? 0 : readTurnSpend(workspaceRoot, sessionKey);

    const shaped = shapeEmissions(candidates, { capBytes: cap, spentBytes: spentBefore });

    for (const drop of shaped.dropped) {
        log_dispatch_issue(
            workspaceRoot,
            drop.concern,
            drop.reason === "nudge_interference"
                ? "nudge_interference_drop"
                : "injection_budget_drop",
            drop.detail,
            "src/config/hook-token-budget.json § per_turn_aggregate_bytes",
        );
    }

    if (shaped.ceilingExceeded) {
        // Stated, never swallowed — and the CAUSE is named, because the two point
        // at different fixes. `exempt-floor`: the safety-relevant set alone is
        // over, so the policy held its contract and the budget row is the decision
        // surface. `carried-spend`: earlier dispatches in this turn already filled
        // it, which is a question about the turn, not about the row.
        const cause =
            shaped.ceilingCause === "exempt-floor"
                ? "by exempt (blocking / fail_closed) concerns alone — nothing dropped, because dropping advisories could not bring it under"
                : "by spend already carried from earlier dispatches in this turn — dropping advisories could not bring it under";
        process.stderr.write(
            `dispatch_hook: per-turn injection ceiling exceeded ${cause} ` +
                `(${String(spentBefore + shaped.keptBytes)} B over ${String(cap)} B). ` +
                `The row is the decision surface ` +
                `(src/config/hook-token-budget.json § per_turn_aggregate_bytes).\n`,
        );
    }

    if (cap !== null) {
        recordTurnSpend(workspaceRoot, sessionKey, shaped.keptBytes, {
            reset: turnStartsHere,
        });
    }
    return textOf(new Set(shaped.kept));
}
