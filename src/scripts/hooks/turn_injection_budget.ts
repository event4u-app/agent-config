/**
 * Per-turn injection aggregate — road-to-standing-context-40k Phase 4.1.
 *
 * `src/config/hook-token-budget.json` caps a concern's emission per FIRE and
 * the cross-concern sum per SLOT per fire. Both are enforced by
 * `bench_hook_injection` in CI, over committed fixtures. Two consequences the
 * step this module implements exists to fix:
 *
 *   1. There was no ceiling on a TURN. `pre_tool_use` / `post_tool_use` fire
 *      once per tool call, so the per-slot rows bound one fire of an axis that
 *      repeats — a turn with twelve tool calls could inject twelve times the
 *      `pre_tool_use` cap and every per-slot check stayed green.
 *   2. Nothing read the budget at runtime. `dispatch_hook.ts` never imported
 *      the file; a live breach was invisible until someone ran the bench.
 *
 * This module is the runtime half. It accumulates the bytes a dispatch is
 * about to emit, per turn, and — when the aggregate would exceed the cap —
 * drops droppable messages until the remainder fits.
 *
 * SAFETY BY CONSTRUCTION (roadmap Risk 5: "the advisory-drop policy hides a
 * safety-relevant warning"). Droppability is `NOT blocking AND NOT fail_closed`,
 * decided by `isDroppableConcern` below. The negative form is deliberate and was
 * a review finding: an `advisory`-positive test would make a future
 * `severity: warn` concern silently UNDROPPABLE, which inverts the policy the
 * budget file documents. Anything blocking or fail-closed is
 * retained unconditionally, even when that leaves the emission over cap — an
 * over-cap emission is a budget finding, whereas a swallowed blocking warning
 * is a safety failure, and the two are not tradeable. The over-cap case is
 * recorded rather than silently tolerated.
 *
 * WHAT COUNTS AS A TURN, and where this module declines to guess. A
 * `user_prompt_submit` fire starts one. Every non-exempt slot after it
 * accumulates into the same turn until the next `user_prompt_submit`. Slots
 * listed in `exempt_slots` neither open a turn nor accumulate.
 *
 * A host that binds no `user_prompt_submit` therefore has NO turn boundary, and
 * on such a host this module accumulates nothing at all. That is not a
 * simplification — it was a live defect the R2 review caught: `augment` binds
 * `stop`, `pre_tool_use` and `post_tool_use` (all non-exempt) and no prompt
 * slot, so with a slot-only exemption the accumulator never reset and the
 * per-turn cap silently became a per-SESSION cap that dropped every advisory
 * for the rest of the session once passed. `hasTurnBoundary` is the guard, and
 * the caller resolves it from the manifest rather than from a hardcoded host
 * list.
 *
 * PII-EXCLUSION-BY-CONSTRUCTION. The state file's type carries a schema
 * version, a session id, a turn counter and two integers. It has NO field
 * capable of holding a message, a prompt, a path, or any free-form content —
 * the same discipline `domain-safety-pii` § Surface 2 states for logs and
 * `_record_rule_trips` applies to its counters. Never widen it.
 *
 * Fail-open throughout: an unreadable budget, an unwritable state file, a
 * corrupt record, or a session id the dispatcher deliberately made unstable all
 * resolve to "no cap applied". A broken accountant must never swallow a
 * concern's message.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { atomic_write_json, is_replay_mode } from "./state_io.js";
import { log_dispatch_issue } from "./dispatch_issues.js";

// Same bundle-depth dance as the dispatcher: bundled, this module sits two
// levels below the repo root; under tsx, three. Owned here rather than passed
// in, so the module that reads the budget also resolves it.
declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
const _IN_BUNDLE = typeof __AGENT_CONFIG_BUNDLE__ !== "undefined" && __AGENT_CONFIG_BUNDLE__;
const _REPO_ROOT = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    ...(_IN_BUNDLE ? ["..", ".."] : ["..", "..", ".."]),
);
export const TOKEN_BUDGET_PATH = path.join(_REPO_ROOT, "src", "config", "hook-token-budget.json");

/**
 * May the cap drop this concern's message?
 *
 * Stated negatively — `NOT blocking AND NOT fail_closed` — and that is the
 * whole point of the function existing rather than the caller testing
 * `severity === "advisory"`. An advisory-POSITIVE test would make a severity
 * tier added later (a `warn` rung, say) silently UNDROPPABLE, inverting the
 * policy the budget file documents. Lives here, with the policy it serves.
 *
 * Reads the manifest entry BY INDEX rather than declaring a shape with two
 * optional fields: the caller's `ConcernDef` carries an index signature and no
 * declared `severity`, so an all-optional parameter type trips TypeScript's
 * weak-type check ("no properties in common"). Reading the way the dispatcher
 * already reads a concern also keeps the seam honest about what the manifest
 * actually guarantees, which is nothing beyond `name`.
 */
export function isDroppableConcern(concern: Readonly<Record<string, unknown>>): boolean {
    const severity = String(concern["severity"] ?? "").trim().toLowerCase();
    return severity !== "blocking" && !concern["fail_closed"];
}

/** The turn accumulator, on disk. Counts and ids only — never content. */
export interface TurnInjectionState {
    schema_version: number;
    session_id: string;
    /** Monotonic per session; incremented on each `user_prompt_submit`. */
    turn: number;
    /** Payload bytes already emitted in this turn, across slots. */
    spent_bytes: number;
    /** Messages dropped in this turn, across slots. */
    dropped: number;
}

export interface TurnBudget {
    readonly capBytes: number;
    readonly exemptSlots: ReadonlySet<string>;
}

/** One candidate message, with the one fact the drop decision needs. */
export interface CandidateMessage {
    /** Concern id — used for the dispatch-issues record, never emitted. */
    readonly concern: string;
    readonly text: string;
    /** `NOT blocking AND NOT fail_closed` — see `isDroppableConcern`. */
    readonly droppable: boolean;
}

export interface DropRecord {
    readonly concern: string;
    readonly bytes: number;
}

export interface CapVerdict {
    /** Messages that survive, in their original order. */
    readonly kept: CandidateMessage[];
    /**
     * Indices into the input array of the surviving messages, ascending. The
     * caller maps back by index rather than by text: two concerns emitting the
     * same string is rare and a text-keyed filter would drop both.
     */
    readonly keptIndices: number[];
    readonly dropped: DropRecord[];
    /** Bytes the kept set will emit. */
    readonly keptBytes: number;
    /** Bytes already spent earlier in this turn. */
    readonly spentBytes: number;
    readonly capBytes: number;
    /** True when the retained set still exceeds the cap (undroppable overflow). */
    readonly overCapAfterDrops: boolean;
}

export const STATE_DIR_REL = path.join("agents", "runtime", "state", "turn-injection");
const SCHEMA_VERSION = 1;

/**
 * Session ids the dispatcher synthesises per invocation.
 *
 * `_resolve_session_id` falls back to `dispatch-<ts>-<pid>` for an envelope
 * carrying no id, and its own comment says the instability "is the point". A
 * per-turn accumulator keyed on such an id reads zero on every fire, so the cap
 * would be silently unenforced. Detected and declined instead of pretended.
 */
export function isStableSessionId(sessionId: string): boolean {
    return sessionId.trim() !== "" && !sessionId.startsWith("dispatch-");
}

/** Byte length of a message as the emission layer will write it. */
export function messageBytes(text: string): number {
    return Buffer.byteLength(text, "utf-8");
}

/**
 * Cached budget row, keyed by path. The per-tool-call slots fire on the
 * hottest hook path and re-parsing an ~8 KB config on each of them was a
 * review finding; a hook process is short-lived and single-dispatch, so a
 * process-lifetime cache cannot go stale within one run.
 */
const _budgetCache = new Map<string, TurnBudget | null>();

/**
 * Read the per-turn aggregate row. Returns `null` when the row is absent or
 * unusable — the caller then applies no cap, which is the pre-4.1 behaviour.
 */
export function readTurnBudget(budgetPath: string): TurnBudget | null {
    const cached = _budgetCache.get(budgetPath);
    if (cached !== undefined) return cached;
    const resolved = _readTurnBudgetUncached(budgetPath);
    _budgetCache.set(budgetPath, resolved);
    return resolved;
}

/** Test seam: drop the cache so a fixture can swap budget files in one process. */
export function _clearTurnBudgetCache(): void {
    _budgetCache.clear();
}

function _readTurnBudgetUncached(budgetPath: string): TurnBudget | null {
    let doc: Record<string, unknown>;
    try {
        doc = JSON.parse(fs.readFileSync(budgetPath, "utf-8")) as Record<string, unknown>;
    } catch {
        return null;
    }
    const row = doc["per_turn_aggregate_cap_bytes"];
    if (typeof row !== "object" || row === null || Array.isArray(row)) return null;
    const cap = (row as Record<string, unknown>)["cap_bytes"];
    if (typeof cap !== "number" || !Number.isFinite(cap) || cap <= 0) return null;
    const exemptRaw = (row as Record<string, unknown>)["exempt_slots"];
    const exempt = Array.isArray(exemptRaw)
        ? exemptRaw.filter((s): s is string => typeof s === "string")
        : [];
    return { capBytes: cap, exemptSlots: new Set(exempt) };
}

/**
 * Per-SESSION state path.
 *
 * One shared file per workspace let two concurrent sessions — or a subagent
 * carrying its own id — zero each other on every fire, since a record from a
 * foreign session reads as "no bytes spent". The estate's own pattern for
 * per-session state is a directory (`agents/runtime/state/end-review-nudge/`);
 * this follows it.
 */
export function statePath(workspaceRoot: string, sessionId: string): string {
    const safe = sessionId.replace(/[^A-Za-z0-9._-]/g, "_");
    return path.join(workspaceRoot, STATE_DIR_REL, `${safe}.json`);
}

/** Read the accumulator, or a zeroed one for a session with no record yet. */
export function readTurnState(workspaceRoot: string, sessionId: string): TurnInjectionState {
    const zero: TurnInjectionState = {
        schema_version: SCHEMA_VERSION,
        session_id: sessionId,
        turn: 0,
        spent_bytes: 0,
        dropped: 0,
    };
    let parsed: unknown;
    try {
        parsed = JSON.parse(fs.readFileSync(statePath(workspaceRoot, sessionId), "utf-8"));
    } catch {
        return zero;
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return zero;
    const doc = parsed as Record<string, unknown>;
    // The path is already session-scoped; this is a belt-and-braces check for a
    // hand-edited or collided file, not the isolation mechanism.
    if (doc["session_id"] !== sessionId) return zero;
    const turn = typeof doc["turn"] === "number" ? doc["turn"] : 0;
    const spent = typeof doc["spent_bytes"] === "number" ? doc["spent_bytes"] : 0;
    const dropped = typeof doc["dropped"] === "number" ? doc["dropped"] : 0;
    return {
        schema_version: SCHEMA_VERSION,
        session_id: sessionId,
        turn: Math.max(0, Math.trunc(turn)),
        spent_bytes: Math.max(0, Math.trunc(spent)),
        dropped: Math.max(0, Math.trunc(dropped)),
    };
}

/**
 * Persist the accumulator, atomically — the sibling counter in the calling file
 * (`_record_rule_trips`) uses the same primitive for the same class of artefact
 * in the same directory, and a plain write could lose or truncate the record
 * when two dispatches interleave. Fail-open: a write failure applies no cap
 * later.
 */
export function writeTurnState(workspaceRoot: string, state: TurnInjectionState): void {
    try {
        const target = statePath(workspaceRoot, state.session_id);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        atomic_write_json(target, state as unknown as Record<string, unknown>);
    } catch {
        /* observability, never a dispatch failure */
    }
}

/**
 * Decide which messages survive the turn cap.
 *
 * Pure: no I/O, no clock. Droppable messages go largest-first — dropping one
 * 3 KB advisory beats dropping four 200-byte ones to free the same room, and it
 * keeps the verdict deterministic for a fixture. Byte lengths are measured once
 * up front rather than inside the running total and the sort comparator.
 */
export function applyTurnCap(
    messages: readonly CandidateMessage[],
    spentBytes: number,
    capBytes: number,
): CapVerdict {
    const sizes = messages.map((m) => messageBytes(m.text));
    const retained = new Set(messages.map((_, i) => i));
    const dropped: DropRecord[] = [];
    let running = spentBytes + sizes.reduce((n, b) => n + b, 0);

    if (running > capBytes) {
        const droppable = messages
            .map((m, i) => ({ m, i }))
            .filter(({ m }) => m.droppable)
            .sort((a, b) => (sizes[b.i] as number) - (sizes[a.i] as number) || a.i - b.i);
        for (const { m, i } of droppable) {
            if (running <= capBytes) break;
            retained.delete(i);
            running -= sizes[i] as number;
            dropped.push({ concern: m.concern, bytes: sizes[i] as number });
        }
    }

    const keptIndices = [...retained].sort((a, b) => a - b);
    const kept = keptIndices.map((i) => messages[i] as CandidateMessage);
    const keptBytes = keptIndices.reduce((n, i) => n + (sizes[i] as number), 0);
    return {
        kept,
        keptIndices,
        dropped,
        keptBytes,
        spentBytes,
        capBytes,
        overCapAfterDrops: spentBytes + keptBytes > capBytes,
    };
}

/**
 * True when this slot participates in the turn aggregate at all.
 * An exempt slot neither opens a turn nor accumulates.
 */
export function slotCounts(slot: string, budget: TurnBudget): boolean {
    return !budget.exemptSlots.has(slot);
}

/** Only the field this module reads; avoids importing the dispatcher's JsonObject. */
interface EnvelopeLike {
    readonly workspace_root?: unknown;
}

/** The two facts the caller resolves, because their sources live over there. */
export interface TurnCapContext {
    /**
     * Does this platform bind `user_prompt_submit` at all? A manifest fact, and
     * the guard on the defect the R2 review caught — see the module header.
     */
    readonly hasTurnBoundary: boolean;
    /**
     * Will the emission actually put the reasons on a stream?
     * `host_semantics.emissionCarriesReasons` answers it.
     */
    readonly emissionCarriesReasons: boolean;
}

/**
 * Apply the per-turn cap to the messages a dispatch is about to emit.
 *
 * Returns the messages that may actually be emitted, in order.
 *
 * FOUR PRECONDITIONS, all from the R2 review, none of them cosmetic:
 *
 *   - `hasTurnBoundary` — without a `user_prompt_submit` binding there is no
 *     turn to cap. `augment` binds `stop`, `pre_tool_use` and `post_tool_use`
 *     (all non-exempt) and no prompt slot, so a slot-only exemption let the
 *     accumulator run for the whole session and drop every advisory once past
 *     the cap.
 *   - `emissionCarriesReasons` — the messages must actually leave the process.
 *     `emitFor` returns empty stdout/stderr for `severity: allow` and for every
 *     unverified platform, so charging those bytes bills the turn for text
 *     nobody receives. A crashed non-fail-closed concern is the sharp case: its
 *     stderr becomes an rc-0 "deciding" message, typically the largest one.
 *   - a stable session id — see `isStableSessionId`.
 *   - the turn reset happens BEFORE the empty-message return. A prompt turn
 *     that produced no deciding message is the COMMON case (the branch's own
 *     nudge corpus: 463 of 510 prompts fire neither nudge), so returning early
 *     left the reset as the exception and leaked bytes across turns.
 *
 * Fail-open on every path. Skipped in replay mode so fixture replays write no
 * state, exactly like the dispatcher's feedback dir and trip counters.
 */
export function applyTurnInjectionCap<
    T extends { text: string; concern: string; droppable: boolean },
>(
    envelope: EnvelopeLike,
    sessionId: string,
    event: string,
    messages: T[],
    ctx: TurnCapContext,
    budgetPath: string = TOKEN_BUDGET_PATH,
): T[] {
    const budget = readTurnBudget(budgetPath);
    if (budget === null || !slotCounts(event, budget)) return messages;
    if (!ctx.hasTurnBoundary) return messages;
    if (!isStableSessionId(sessionId)) return messages;
    const workspace = String(envelope.workspace_root || process.cwd());
    const replay = is_replay_mode();

    const prior = replay
        ? { schema_version: SCHEMA_VERSION, session_id: sessionId, turn: 0, spent_bytes: 0, dropped: 0 }
        : readTurnState(workspace, sessionId);
    // A prompt submission IS the turn boundary — the accumulator starts at zero
    // and the turn counter advances, so a long turn's tool-call fires all charge
    // against the same budget while the next prompt gets a clean one.
    const opensTurn = event === "user_prompt_submit";
    const spent = opensTurn ? 0 : prior.spent_bytes;
    const priorDropped = opensTurn ? 0 : prior.dropped;

    // Nothing to charge, but the boundary still has to move. Ordered ahead of
    // the empty-message return on purpose — precondition 4 above.
    if (messages.length === 0 || !ctx.emissionCarriesReasons) {
        if (!replay && (opensTurn || spent !== prior.spent_bytes)) {
            writeTurnState(workspace, {
                schema_version: SCHEMA_VERSION,
                session_id: sessionId,
                turn: opensTurn ? prior.turn + 1 : prior.turn,
                spent_bytes: spent,
                dropped: priorDropped,
            });
        }
        return messages;
    }

    const verdict = applyTurnCap(
        messages.map((m) => ({ concern: m.concern, text: m.text, droppable: m.droppable })),
        spent,
        budget.capBytes,
    );

    if (!replay) {
        writeTurnState(workspace, {
            schema_version: SCHEMA_VERSION,
            session_id: sessionId,
            turn: opensTurn ? prior.turn + 1 : prior.turn,
            spent_bytes: spent + verdict.keptBytes,
            dropped: priorDropped + verdict.dropped.length,
        });
        const fix =
            "raise per_turn_aggregate_cap_bytes.cap_bytes in src/config/hook-token-budget.json, by evidence, in a PR";
        // ONE line per fire, naming every concern dropped and its byte count —
        // not one line per drop. `dispatch-issues.jsonl` is a 200-entry ring, and
        // a review finding named the consequence: a per-drop append on the
        // per-tool-call path evicts the resolver-failure records the log exists
        // for. Each drop is still recorded, which is what the step asks; the ring
        // just pays once per dispatch instead of once per message.
        if (verdict.dropped.length > 0) {
            const named = verdict.dropped.map((d) => `${d.concern} (${String(d.bytes)} B)`).join(", ");
            log_dispatch_issue(
                workspace,
                "dispatch",
                "budget_exceeded",
                `${String(verdict.dropped.length)} message(s) dropped on '${event}': ${named} — ` +
                    `would take the turn past the ${String(budget.capBytes)} B per-turn injection cap ` +
                    `(${String(spent)} B already spent)`,
                fix,
            );
        }
        if (verdict.overCapAfterDrops) {
            log_dispatch_issue(
                workspace,
                "dispatch",
                "budget_exceeded",
                `turn injection is ${String(spent + verdict.keptBytes)} B over a ` +
                    `${String(budget.capBytes)} B cap with nothing droppable left — ` +
                    "blocking and fail_closed concerns are never dropped",
                fix,
            );
        }
    }

    if (verdict.dropped.length === 0) return messages;
    return verdict.keptIndices.map((i) => messages[i] as T);
}
