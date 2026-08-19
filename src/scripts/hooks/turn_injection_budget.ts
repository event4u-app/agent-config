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
 * drops advisory messages until the remainder fits.
 *
 * SAFETY BY CONSTRUCTION (roadmap Risk 5: "the advisory-drop policy hides a
 * safety-relevant warning"). A droppable message is one whose concern declares
 * `severity: advisory` AND `fail_closed: false`. Everything else is retained
 * unconditionally, even when that leaves the emission over cap — an over-cap
 * emission is a budget finding, whereas a swallowed blocking warning is a
 * safety failure, and the two are not tradeable. The over-cap case is recorded
 * rather than silently tolerated.
 *
 * WHAT COUNTS AS A TURN. A `user_prompt_submit` fire starts one. Every
 * non-exempt slot after it accumulates into the same turn until the next
 * `user_prompt_submit`. Slots listed in `exempt_slots` neither open a turn nor
 * accumulate — they are the session-lifecycle and compaction paths that carry
 * the one-shot restore payloads.
 *
 * PII-EXCLUSION-BY-CONSTRUCTION. The state file's type carries a schema
 * version, a session id, a turn counter and two integers. It has NO field
 * capable of holding a message, a prompt, a path, or any free-form content —
 * the same discipline `domain-safety-pii` § Surface 2 states for logs and
 * `_record_rule_trips` applies to its counters. Never widen it.
 *
 * Fail-open throughout: an unreadable budget, an unwritable state file, or a
 * corrupt record all resolve to "no cap applied". A broken accountant must
 * never swallow a concern's message.
 */

import * as fs from "node:fs";
import * as path from "node:path";

/** The turn accumulator, on disk. Counts and ids only — never content. */
export interface TurnInjectionState {
    schema_version: number;
    session_id: string;
    /** Monotonic per session; incremented on each `user_prompt_submit`. */
    turn: number;
    /** Payload bytes already emitted in this turn, across slots. */
    spent_bytes: number;
    /** Advisory messages dropped in this turn, across slots. */
    dropped: number;
}

export interface TurnBudget {
    readonly capBytes: number;
    readonly exemptSlots: ReadonlySet<string>;
}

/** One candidate message, with the two facts the drop decision needs. */
export interface CandidateMessage {
    /** Concern id — used for the dispatch-issues record, never emitted. */
    readonly concern: string;
    readonly text: string;
    /** `severity: advisory` in the manifest. */
    readonly advisory: boolean;
    /** `fail_closed: true` in the manifest. */
    readonly failClosed: boolean;
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

export const STATE_REL = path.join("agents", "runtime", "state", "turn-injection.json");
const SCHEMA_VERSION = 1;

/** Byte length of a message as the emission layer will write it. */
export function messageBytes(text: string): number {
    return Buffer.byteLength(text, "utf-8");
}

/**
 * Read the per-turn aggregate row. Returns `null` when the row is absent or
 * unusable — the caller then applies no cap, which is the pre-4.1 behaviour.
 */
export function readTurnBudget(budgetPath: string): TurnBudget | null {
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

function statePath(workspaceRoot: string): string {
    return path.join(workspaceRoot, STATE_REL);
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
        parsed = JSON.parse(fs.readFileSync(statePath(workspaceRoot), "utf-8"));
    } catch {
        return zero;
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return zero;
    const doc = parsed as Record<string, unknown>;
    // A record from a different session says nothing about this one's turn.
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

/** Persist the accumulator. Fail-open: a write failure applies no cap later. */
export function writeTurnState(workspaceRoot: string, state: TurnInjectionState): void {
    try {
        const target = statePath(workspaceRoot);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, JSON.stringify(state, null, 2) + "\n", "utf-8");
    } catch {
        /* observability, never a dispatch failure */
    }
}

/**
 * Decide which messages survive the turn cap.
 *
 * Pure: no I/O, no clock. The drop order is lowest-severity-first, and within
 * the droppable set LARGEST-first — dropping one 3 KB advisory beats dropping
 * four 200-byte ones to free the same room, and it keeps the verdict
 * deterministic for a fixture.
 */
export function applyTurnCap(
    messages: readonly CandidateMessage[],
    spentBytes: number,
    capBytes: number,
): CapVerdict {
    const retained = new Set(messages.map((_, i) => i));
    const dropped: DropRecord[] = [];
    const bytesOf = (i: number): number => messageBytes(messages[i]?.text ?? "");
    const total = (): number => {
        let n = spentBytes;
        for (const i of retained) n += bytesOf(i);
        return n;
    };

    if (total() > capBytes) {
        // Droppable = advisory AND not fail_closed. Largest first.
        const droppable = messages
            .map((m, i) => ({ m, i }))
            .filter(({ m }) => m.advisory && !m.failClosed)
            .sort((a, b) => bytesOf(b.i) - bytesOf(a.i) || a.i - b.i);
        for (const { m, i } of droppable) {
            if (total() <= capBytes) break;
            retained.delete(i);
            dropped.push({ concern: m.concern, bytes: bytesOf(i) });
        }
    }

    const keptIndices = [...retained].sort((a, b) => a - b);
    const kept = keptIndices.map((i) => messages[i] as CandidateMessage);
    let keptBytes = 0;
    for (const i of retained) keptBytes += bytesOf(i);
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
