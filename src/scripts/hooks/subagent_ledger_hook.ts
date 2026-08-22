#!/usr/bin/env tsx
/**
 * Subagent lifecycle ledger — capture only, no behaviour change
 * (road-to-subagent-lifecycle-integrity Phase 1, Steps 2 + 3).
 *
 * Why this exists. Two of the three operator-reported symptoms — subagents
 * that never terminate, and subagents that finish and "signal" but whose
 * result never reaches the orchestrator — share one structural root: **no
 * subagent lifecycle event was registered anywhere in this tree**. The
 * dispatcher's vocabulary carried eight events and none of them bracketed a
 * single dispatch, so nothing could say how long a dispatch ran, how many ran
 * at once, how deep they nested, or whether a return envelope arrived at all.
 * Every claim about those symptoms was therefore model-carried anecdote.
 *
 * This concern is the instrument, and ONLY the instrument. It appends; it
 * never decides. Phase 2 (`subagent-return-gate`) and Phase 3 (`spawn-guard`,
 * stop-loss) are the mechanisms that may act on what it records, and both are
 * pre-registered as gated on a baseline this file has to produce first. That
 * ordering is deliberate: a guard built before the distribution is known is a
 * threshold invented rather than measured, which is the failure this
 * repository has recorded repeatedly.
 *
 * ── What is recorded, and what is refused ──────────────────────────────────
 *
 * PRIVACY BY CONSTRUCTION — never widen this file to read or emit free text.
 *
 *   - `agent_id` is a host-supplied high-entropy opaque token. The sibling
 *     `orchestration_record_hook.ts` records the same class of value as a
 *     deliberate NON-goal ("`check_secret_leak` correctly flags [them] as
 *     candidate credentials"), so this ledger never writes one. It writes
 *     `ref` — the first 12 hex chars of a local SHA-256 of the id. That is
 *     enough to correlate a start with its stop and a child with its parent,
 *     and it is not the host's token.
 *   - `agent_type` IS recorded verbatim: it is an id-shaped enum
 *     (`Explore` / `general-purpose` / `production-validator` / …), the same
 *     single host string `orchestration_record_hook` already records.
 *   - `last_assistant_message` is free model prose and is NEVER recorded, in
 *     any form — not truncated, not hashed, not summarised. Only the four-way
 *     parse VERDICT (`ok` / `fail` / `no_message` / `no_envelope`) and a
 *     validator error COUNT
 *     leave this function. A record type with no field able to hold prose has
 *     no scrubber that can fail.
 *
 * ── Observe mode is a property of this file, not a setting ────────────────
 *
 * `validateResponse` runs here, and its result is written down and dropped.
 * The hook's exit code is ALWAYS 0 on every path — malformed envelope,
 * unparseable payload, unwritable disk, failed validation. A `warn` (exit 2)
 * is read as a hard BLOCK on this host, and this concern has nothing to say
 * to the model, so it never warns either. Phase 1's falsifier can only be
 * evaluated if the measurement window is uncontaminated by a mechanism
 * reacting to it.
 *
 * ── An instrument that goes quiet is worse than one that reports nothing ──
 *
 * R2 finding 1. A payload carrying no `agent_id` used to make both handlers
 * return before writing anything, so a host shape this tree has not yet ruled
 * out (Phase 0 Step 2 is still open, and the string-table check in the
 * evidence page is presence-only) would produce an empty ledger — byte-identical
 * to "no dispatches happened", and the Phase-1 Step-4 baseline would read the
 * two the same way. Both handlers now emit an `unidentified: true` line
 * instead: no ref, no host token, and the absence is visible in the output.
 *
 * ── Open records are reaped, and the reaping is itself recorded ───────────
 *
 * R2 finding 2. An open record is created by a start and removed by its stop.
 * A dispatch that never stops — symptom #1, the thing this instrument exists
 * to catch — therefore leaves a file behind, and `concurrent_open` and `depth`
 * would drift upward forever. Phase 3's pre-registered spawn guard reads this
 * same set at `concurrent-open >= 4`, so four leaked records would eventually
 * deny every spawn.
 *
 * So a record older than `OPEN_RECORD_TTL_MS` is reaped on the next event and
 * a `subagent_reaped` line is written for it. That line is not bookkeeping —
 * it is the closest thing this instrument has to a direct observation of a
 * never-returning dispatch, which is why the leak is reported rather than
 * quietly swept. `session_id` rides on the open record AND on both dispatch
 * lines so a rate can be scoped by session; nothing reads it yet and it is not
 * claimed to.
 *
 * ── Depth and concurrency (Step 3) ────────────────────────────────────────
 *
 * Depth is derived from the open-record set, never asserted, and the basis is
 * recorded alongside it in three values rather than two (R2 finding 5):
 *
 *   `observed`        — the named parent's record was open and its depth read.
 *   `asserted-parent` — the payload named a parent whose record is not open.
 *                       Nesting is a FACT; the number is a floor, since a
 *                       grandchild whose parent already closed is deeper.
 *   `assumed-root`    — the payload named no parent at all.
 *
 * A consumer filtering for measured depths takes `observed` alone. Labelling
 * the middle case `observed` would have fed a guess into exactly that filter.
 *
 * `concurrent_open` has ONE definition on both lines (R2 finding 8): **the
 * number of open dispatches after this event is applied.** Start counts after
 * its own record is written; stop counts after its own is removed.
 *
 * ── Writes go through the contract's atomic path ──────────────────────────
 *
 * R2 finding 3. `hook-architecture-v1.md` § Concurrency requires lock + tmp +
 * rename for writes under `agents/runtime/state/`; `atomic_write_json` is that
 * path and is now used. The read-modify-write is gone rather than merely
 * serialised: the record is written FIRST and the directory counted AFTER, so
 * N concurrent starts each see at least their own record instead of every one
 * reading the pre-write set and recording `concurrent_open: 1` — the
 * undercount landed precisely in parallel fan-out, the mode this instrument
 * exists to measure.
 */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { countContractFields, validateResponse } from '../_lib/subagent_response.js';
import { atomic_write_json, is_replay_mode } from './state_io.js';
import { readHookStdin } from './hook_stdin.js';

const EXIT_ALLOW = 0;

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };
type JsonObject = { [k: string]: JsonValue };

function isObject(v: unknown): v is JsonObject {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Ledger root, relative to the consumer repo root. Gitignored via `/agents/runtime/`. */
export const LEDGER_DIR = path.join('agents', 'runtime', 'state', 'subagent-ledger');
/** Open-dispatch records live one file per ref so a crash cannot tear the set. */
export const OPEN_SUBDIR = 'open';

/**
 * How long an open record may sit before it is treated as a dispatch that
 * never returned. 24 h is a STATED DEFAULT, not a measured optimum — the
 * distribution it should be derived from is what Phase 1 Step 4 publishes.
 * It is deliberately far above any plausible dispatch so a reap is evidence
 * of a real never-returning run rather than of a slow one.
 *
 * Revisit-if: the Phase-1 duration distribution shows a p99 within an order
 * of magnitude of this value, or a reap line appears for a dispatch that did
 * in fact return.
 */
export const OPEN_RECORD_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Stable, local, non-reversible correlation key for a host `agent_id`.
 *
 * Twelve hex chars is 48 bits — collision-free for any realistic count of
 * concurrent dispatches, and short enough to read in a ledger line. The digest
 * is unsalted ON PURPOSE: the value must be stable across the two separate
 * hook invocations that bracket one dispatch (start and stop are different
 * processes), so a per-process salt would break the only thing this key is
 * for. Nothing is being protected against an offline guessing attack here —
 * the goal is that the host's opaque token never lands in a file, not that
 * the mapping is cryptographically hidden from someone who already holds it.
 */
export function refFor(agentId: string): string {
    return crypto.createHash('sha256').update(agentId, 'utf8').digest('hex').slice(0, 12);
}

/**
 * Unwrap the dispatcher envelope (`{schema_version, platform, event,
 * payload}`) down to the platform-native payload, falling back to the
 * top-level object for direct/legacy invocation.
 */
function unwrapPayload(envelope: JsonObject): JsonObject {
    const inner = envelope['payload'];
    return isObject(inner) ? inner : envelope;
}

function str(payload: JsonObject, ...keys: string[]): string | null {
    for (const k of keys) {
        const v = payload[k];
        if (typeof v === 'string' && v) return v;
    }
    return null;
}

/**
 * The PARENT agent's id, when the payload names one.
 *
 * Two shapes are accepted, and neither is invented: an explicit parent field,
 * or a session-level `agent_id` that differs from the starting agent's own id
 * (which is what a nested spawn looks like when the host reports the caller's
 * context rather than a dedicated parent key). `null` means the payload said
 * nothing — recorded as `assumed-root`, never as "this is a root".
 */
function extractParentId(payload: JsonObject, ownId: string | null): string | null {
    const explicit = str(payload, 'parent_agent_id', 'parentAgentId');
    if (explicit) return explicit;
    const session = payload['session'];
    if (isObject(session)) {
        const sessionAgent = str(session, 'agent_id', 'agentId');
        if (sessionAgent && sessionAgent !== ownId) return sessionAgent;
    }
    return null;
}

export type EnvelopeParse = 'ok' | 'fail' | 'foreign_object' | 'no_message' | 'no_envelope';

/**
 * The retired fifth value. Records written before 2026-08-20 carry `absent`,
 * which collapsed `no_message` and `no_envelope` into one bucket.
 *
 * It is deliberately NOT in the union. Nothing reads `envelope_parse` back
 * programmatically — the only writer is this file and the only reader is a
 * human or a `grep` — so there is no consumer to keep compatible, and leaving
 * the value writable would let the collapse reappear. A reader of the
 * historical window must treat `absent` as "one of the two, unknown which":
 * the measurement it supports starts at the split, not before it.
 */
export const RETIRED_ENVELOPE_PARSE = 'absent';

/**
 * READING THE HISTORICAL WINDOW — the caveat, not a version field.
 *
 * A verdict records conformance to the shape that was canonical **when the row
 * was written**, and that shape was reconciled on 2026-08-22
 * (`subagent-response-contract.md` § The canonical shape). Before that date one
 * contract existed in three mutually inconsistent states: the spawn contract's
 * rule (f), a narrower JSON injected by `team_dispatch.ts:297`, and the
 * validator's five required fields. Nothing recorded which one a given row was
 * judged against, because until the reconciliation there was no single answer.
 *
 * So a row from the 2026-08 window must NOT be read as conforming — or as
 * failing to conform — to the reconciled shape. What it says is narrower: the
 * classifier at the time either found a `validateResponse`-passing object or did
 * not. As it happens the two agree for every row in that window, because the
 * count is **0 of 1,845** and a rate of zero is the same number under either
 * reading — but that is a property of this particular window, not of the
 * comparison, and the next window will not have it.
 *
 * Deliberately a comment and not a `contract_version` field. Adding one would
 * be honest going forward and would still say nothing about the rows already on
 * disk, which are the rows this caveat exists for. A council seat asked for the
 * field; it is the right next step and it is not this one, because a field
 * stamped from today cannot retro-tag yesterday.
 */

export interface ParseVerdict {
    verdict: EnvelopeParse;
    /** Count of validator errors. A COUNT — the messages never leave this function. */
    error_count: number;
    /**
     * How many of the five REQUIRED contract fields the judged candidate
     * carried. Recorded beside the error count so the `fail` / `foreign_object`
     * boundary is auditable from the row itself rather than re-derived from a
     * probe — which is how the split's own premise had to be established.
     */
    field_hits: number;
}

/**
 * Classify a subagent's final message against the response-envelope contract.
 *
 * Five outcomes, and every boundary between them separates two defects with
 * two different fixes:
 *
 *   - `no_message` — the host delivered no `last_assistant_message` at all
 *     (null, or whitespace only). This is the return-channel loss #58109
 *     describes, and it is the ONLY verdict a disk-envelope fallback may key
 *     on.
 *   - `no_envelope` — a message arrived and carried no JSON object. This is
 *     the overwhelmingly common case: subagents answer in prose. It is not a
 *     channel failure, and a fallback keyed on it would fire on nearly every
 *     dispatch.
 *   - `fail` — an object arrived, carried at least one required contract
 *     field, and did not satisfy `validateResponse`. A near-miss: someone
 *     aimed at the envelope and got it wrong.
 *   - `foreign_object` — an object arrived and carried NONE of the required
 *     fields. A fenced tool call, or a prose-embedded JSON blob: it never
 *     aimed at the envelope at all.
 *   - `ok` — an object arrived and validated.
 *
 * The last two used to be one value, `fail`, and the collapse had the same
 * shape as the `absent` one below it. Re-derived over the live month ledger
 * (7,282 rows, 6,315 stops) the all-time `fail` histogram was `{5: 27}` —
 * every recorded `fail` carried `error_count: 5`, which is exactly "zero
 * required fields present". So the bucket a threshold would be read off held
 * no contract attempts at all, and could neither rise nor fall for the reason
 * its name suggests.
 *
 * The first two used to be one value, `absent`. Over the first measured window
 * that collapse read 25 of 25 `absent` — including the #58109 control arm that
 * returned a complete report — so a rate computed off it measured the answer
 * format rather than the channel
 * (`agents/evidence/investigations/subagent-lifecycle-phase0-return-channel.md`
 * § F2). Splitting them is what makes the Phase-1 baseline's return-rate
 * column, and Phase 2's fallback condition, expressible at all.
 */
export function classifyEnvelope(message: string | null): ParseVerdict {
    if (message === null || !message.trim()) {
        return { verdict: 'no_message', error_count: 0, field_hits: 0 };
    }

    const candidates = _jsonObjectCandidates(message);
    if (candidates.length === 0) return { verdict: 'no_envelope', error_count: 0, field_hits: 0 };

    // A message may carry several object-shaped spans. The envelope is the one
    // that validates, so a failure verdict is only reported once every
    // candidate has been tried — otherwise a stray leading `{}` would mask a
    // valid envelope.
    //
    // Among failures the MOST contract-shaped candidate wins, not the first
    // one met. First-match was safe while every failure was one bucket; with
    // the near-miss split it is not, because a leading `{"note":1}` would
    // report `foreign_object` for a message that also carried a real attempt —
    // the same masking defect one register down.
    let best: ParseVerdict | null = null;
    for (const candidate of candidates) {
        const result = validateResponse(candidate);
        const fieldHits = countContractFields(candidate);
        if (result.valid) return { verdict: 'ok', error_count: 0, field_hits: fieldHits };
        if (best === null || fieldHits > best.field_hits) {
            best = {
                verdict: fieldHits === 0 ? 'foreign_object' : 'fail',
                error_count: result.errors.length,
                field_hits: fieldHits,
            };
        }
    }
    return best ?? { verdict: 'no_envelope', error_count: 0, field_hits: 0 };
}

/**
 * Every decoded JSON object the message contains, in the order a reader would
 * meet them.
 *
 * R2 finding 4: the previous implementation took the span from the first `{`
 * to the LAST `}`, so a valid envelope followed by any later brace in prose
 * ("… — done. See {done}.") produced unparseable text and was reported
 * `no_envelope` — routing an extraction failure into the "answered in prose"
 * bucket that the verdict split exists to keep separate, and biasing the
 * Phase-1 return-rate falsifier downward.
 *
 * R2 finding 11: fenced blocks are now matched with an anchored, global scan
 * rather than a first-match-anywhere regex, which used to be able to match at
 * a *closing* fence and capture the prose between two blocks.
 *
 * The scanner walks brace depth and respects string literals and escapes, so a
 * `}` inside a JSON string value cannot end a span early.
 */
function _jsonObjectCandidates(message: string): unknown[] {
    const texts: string[] = [];

    for (const match of message.matchAll(/^[ \t]*```[ \t]*(?:json)?[ \t]*\r?\n([\s\S]*?)^[ \t]*```/gm)) {
        if (match[1]) texts.push(match[1]);
    }

    let depth = 0;
    let start = -1;
    let inString = false;
    let escaped = false;
    for (let i = 0; i < message.length; i++) {
        const ch = message[i]!;
        if (inString) {
            if (escaped) escaped = false;
            else if (ch === '\\') escaped = true;
            else if (ch === '"') inString = false;
            continue;
        }
        if (ch === '"') inString = true;
        else if (ch === '{') {
            if (depth === 0) start = i;
            depth++;
        } else if (ch === '}') {
            if (depth > 0) {
                depth--;
                if (depth === 0 && start !== -1) {
                    texts.push(message.slice(start, i + 1));
                    start = -1;
                }
            }
        }
    }

    const out: unknown[] = [];
    for (const text of texts) {
        try {
            const parsed: unknown = JSON.parse(text.trim());
            if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) out.push(parsed);
        } catch {
            // Not an object span after all — the next candidate may be.
        }
    }
    return out;
}

/** How a recorded depth was arrived at. See the header for the three values. */
export type DepthBasis = 'observed' | 'asserted-parent' | 'assumed-root';

/** An open dispatch, as persisted between the start and stop invocations. */
export interface OpenRecord {
    ref: string;
    agent_type: string | null;
    started_at: string;
    parent_ref: string | null;
    depth: number;
    depth_basis: DepthBasis;
    session_id: string | null;
}

function openDir(root: string): string {
    return path.join(root, LEDGER_DIR, OPEN_SUBDIR);
}

function openFile(root: string, ref: string): string {
    return path.join(openDir(root), `${ref}.json`);
}

const DEPTH_BASES: ReadonlySet<string> = new Set<DepthBasis>(['observed', 'asserted-parent', 'assumed-root']);

/**
 * Validate a parsed open record fully before it is trusted.
 *
 * R2 finding 7: the previous version checked only that `ref` was a string and
 * cast the rest, so a record missing `depth` produced `undefined + 1` = `NaN`,
 * which serialises as `"depth": null` on a line still labelled
 * `depth_basis: "observed"`. A record that does not satisfy the shape is
 * treated as unreadable — the same class as a torn write — rather than
 * half-believed.
 */
function _asOpenRecord(value: unknown, expectedRef: string): OpenRecord | null {
    if (!isObject(value)) return null;
    const ref = value['ref'];
    // R2 finding 7, second half: the map used to be keyed by the record's
    // self-declared ref while removal unlinks `<ref>.json`, so a file whose
    // contents disagreed with its filename was counted forever. The filename
    // is the identity; a record that disagrees with it is not trusted.
    if (typeof ref !== 'string' || ref !== expectedRef) return null;
    if (typeof value['started_at'] !== 'string') return null;
    if (typeof value['depth'] !== 'number' || !Number.isFinite(value['depth'])) return null;
    if (typeof value['depth_basis'] !== 'string' || !DEPTH_BASES.has(value['depth_basis'])) return null;
    const agentType = value['agent_type'];
    const parentRef = value['parent_ref'];
    const sessionId = value['session_id'];
    return {
        ref,
        agent_type: typeof agentType === 'string' ? agentType : null,
        started_at: value['started_at'],
        parent_ref: typeof parentRef === 'string' ? parentRef : null,
        depth: value['depth'],
        depth_basis: value['depth_basis'] as DepthBasis,
        session_id: typeof sessionId === 'string' ? sessionId : null,
    };
}

/** Every currently-open record, keyed by ref. Unreadable entries are skipped. */
export function readOpenRecords(root: string): Map<string, OpenRecord> {
    const out = new Map<string, OpenRecord>();
    let names: string[];
    try {
        names = fs.readdirSync(openDir(root));
    } catch {
        return out;
    }
    for (const name of names) {
        if (!name.endsWith('.json')) continue;
        const expectedRef = name.slice(0, -'.json'.length);
        try {
            const raw = fs.readFileSync(path.join(openDir(root), name), 'utf8');
            const rec = _asOpenRecord(JSON.parse(raw), expectedRef);
            if (rec) out.set(rec.ref, rec);
        } catch {
            // A torn or hand-edited record is data we do not have, not a crash.
        }
    }
    return out;
}

/**
 * Resolve depth from the open-record set. See the header for why the middle
 * case is `asserted-parent` and not `observed`.
 */
export function resolveDepth(
    parentRef: string | null,
    open: ReadonlyMap<string, OpenRecord>,
): { depth: number; depth_basis: DepthBasis } {
    if (parentRef === null) return { depth: 1, depth_basis: 'assumed-root' };
    const parent = open.get(parentRef);
    if (!parent) return { depth: 2, depth_basis: 'asserted-parent' };
    return { depth: parent.depth + 1, depth_basis: 'observed' };
}

/** `${ts.slice(0,7)}.jsonl` — the monthly-file convention the audit stream uses. */
function ledgerFileFor(root: string, ts: string): string {
    return path.join(root, LEDGER_DIR, `${ts.slice(0, 7)}.jsonl`);
}

/**
 * Append one line to the monthly ledger. Exported because `spawn-guard-shadow`
 * (Phase 3 Step 1) writes its own observations into the SAME stream: one
 * instrument, one file, so a reader correlates a would-deny against the
 * dispatches around it without joining two corpora.
 */
export function appendLedgerLine(root: string, ts: string, line: Record<string, unknown>): void {
    if (is_replay_mode()) return;
    const file = ledgerFileFor(root, ts);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, `${JSON.stringify(line)}\n`, 'utf8');
}

/**
 * Candidate wall-clock stop-loss arms — Phase 3 Step 3, shadow only.
 *
 * Recorded retrospectively rather than fired: a `subagent_stop` knows the real
 * duration and a reap knows the age, so "which arm would have fired" is a fact
 * at that moment rather than a timer that has to run. The never-returning case
 * — the one the stop-loss actually targets — reaches this through the reap
 * line, which is the only place it is observable at all.
 *
 * These are candidates under evaluation, not thresholds: per the activation
 * policy the shipped value is derived from the observed distribution, and
 * there is no distribution yet.
 *
 * The plan also names a tool-call-count arm. It is NOT implemented and not
 * faked: a hook sees no per-dispatch tool-call count on any payload this tree
 * has observed, and inventing a proxy is the move `capsule_trigger.ts` refuses
 * in the same words ("NOTHING ACTS ON THESE").
 */
export const WALL_CLOCK_ARMS_MS: ReadonlyArray<{ label: string; ms: number }> = [
    { label: '5m', ms: 5 * 60 * 1000 },
    { label: '15m', ms: 15 * 60 * 1000 },
    { label: '30m', ms: 30 * 60 * 1000 },
    { label: '2h', ms: 2 * 60 * 60 * 1000 },
];

/** Which wall-clock arms an elapsed duration would have tripped. */
export function armsExceeded(elapsedMs: number | null): string[] {
    if (elapsedMs === null || !Number.isFinite(elapsedMs)) return [];
    return WALL_CLOCK_ARMS_MS.filter((a) => elapsedMs >= a.ms).map((a) => a.label);
}

export interface OpenStats {
    /** Open records within the TTL. Stale ones are NOT counted. */
    open_count: number;
    /** Deepest depth among the counted records; 0 when none. */
    max_depth: number;
    /** Counted separately so a caller can see the leak rather than inherit it. */
    stale_excluded: number;
    /** `false` when the ledger directory does not exist at all. */
    ledger_present: boolean;
}

/**
 * Open-set summary for the pre-spawn shadow guard and the turn-end allow path.
 *
 * **TTL-aware, and that is load-bearing rather than tidy** (R2 round 2,
 * finding 1). Reaping happens inside the ledger hook, on the next
 * `subagent_start` / `subagent_stop`. A dispatch that never returns — the
 * symptom this whole roadmap targets — leaves a record behind, and if no
 * further subagent event ever occurs that record is never reaped. A consumer
 * that reads the raw count then sees "a dispatch is open" forever. For the
 * spawn guard that inflates a number; for the turn-end gate it silently
 * disables the gate, because the open-dispatch branch is an ALLOW. The ledger
 * already solved this leak for itself and the new consumers inherited it with
 * the opposite polarity, so the filter belongs here, in the shared reader,
 * rather than in each caller.
 *
 * `ledger_present` exists for finding 4: a quiet estate and a ledger this hook
 * cannot see otherwise produce byte-identical readings, which is the
 * instrument-goes-quiet failure the ledger's own round-1 finding 1 fixed one
 * layer down. A caller can now tell "nothing is running" from "I can see
 * nothing".
 */
export function openRecordStats(root: string, nowMs: number = Date.now()): OpenStats {
    const ledgerPresent = fs.existsSync(path.join(root, LEDGER_DIR));
    const open = readOpenRecords(root);
    let maxDepth = 0;
    let counted = 0;
    let stale = 0;
    for (const rec of open.values()) {
        const started = Date.parse(rec.started_at);
        const isStale = Number.isFinite(started) && nowMs - started >= OPEN_RECORD_TTL_MS;
        if (isStale) {
            stale++;
            continue;
        }
        counted++;
        if (rec.depth > maxDepth) maxDepth = rec.depth;
    }
    return {
        open_count: counted,
        max_depth: maxDepth,
        stale_excluded: stale,
        ledger_present: ledgerPresent,
    };
}

/** Contract § Concurrency: lock + tmp + rename, via the shared helper. */
function writeOpenRecord(root: string, rec: OpenRecord): void {
    atomic_write_json(openFile(root, rec.ref), rec);
}

function removeOpenRecord(root: string, ref: string): void {
    if (is_replay_mode()) return;
    try {
        fs.unlinkSync(openFile(root, ref));
    } catch {
        // Already gone — a duplicate stop is not an error worth reporting.
    }
}

/** Count of open records on disk right now. Called AFTER our own write/remove. */
function countOpen(root: string): number {
    try {
        return fs.readdirSync(openDir(root)).filter((n) => n.endsWith('.json')).length;
    } catch {
        return 0;
    }
}

/**
 * Reap open records past the TTL and report each one.
 *
 * The reap line is the point, not the cleanup: a record that aged out is the
 * instrument's only direct sighting of a dispatch that never returned.
 * Returns the number reaped.
 */
export function reapStaleOpenRecords(root: string, nowIso: string): number {
    const now = Date.parse(nowIso);
    if (!Number.isFinite(now)) return 0;
    let reaped = 0;
    for (const rec of readOpenRecords(root).values()) {
        const started = Date.parse(rec.started_at);
        if (!Number.isFinite(started) || now - started < OPEN_RECORD_TTL_MS) continue;
        removeOpenRecord(root, rec.ref);
        reaped++;
        appendLedgerLine(root, nowIso, {
            event: 'subagent_reaped',
            ts: nowIso,
            ref: rec.ref,
            agent_type: rec.agent_type,
            depth: rec.depth,
            depth_basis: rec.depth_basis,
            // R2 round 2, finding 5: the arm list is NOT repeated here. A reap
            // fires only past OPEN_RECORD_TTL_MS (24 h), which exceeds every
            // arm (largest: 2 h), so `stop_loss_arms_exceeded` would be a
            // constant on this line — a field that cannot vary answers no
            // question. `age_ms` carries strictly more information and is what
            // a reader should aggregate over.
            age_ms: now - started,
            reason: 'open record exceeded OPEN_RECORD_TTL_MS without a stop',
        });
    }
    return reaped;
}

/** The one line written when the host gave us nothing to correlate on. */
function appendUnidentified(root: string, event: string, nowIso: string, payload: JsonObject): void {
    appendLedgerLine(root, nowIso, {
        event,
        ts: nowIso,
        ref: null,
        unidentified: true,
        // The agent TYPE is an id-shaped enum and may still be present; it is
        // the only thing salvageable from a payload with no id.
        agent_type: str(payload, 'agent_type', 'agentType', 'subagent_type', 'subagentType'),
        reason: 'payload carried no agent id — nothing to correlate start with stop',
    });
}

function handleStart(root: string, payload: JsonObject, nowIso: string, sessionId: string | null): void {
    const agentId = str(payload, 'agent_id', 'agentId');
    if (agentId === null) {
        appendUnidentified(root, 'subagent_start', nowIso, payload);
        return;
    }

    const ref = refFor(agentId);
    const parentId = extractParentId(payload, agentId);
    const parentRef = parentId ? refFor(parentId) : null;

    const { depth, depth_basis } = resolveDepth(parentRef, readOpenRecords(root));

    const rec: OpenRecord = {
        ref,
        agent_type: str(payload, 'agent_type', 'agentType', 'subagent_type', 'subagentType'),
        started_at: nowIso,
        parent_ref: parentRef,
        depth,
        depth_basis,
        session_id: sessionId,
    };
    // Write FIRST, count AFTER — see the header on R2 finding 3.
    writeOpenRecord(root, rec);

    appendLedgerLine(root, nowIso, {
        event: 'subagent_start',
        ts: nowIso,
        ref,
        // Phase 1 Step 4 correction (b): without this the dispatch denominator
        // is not per-session. Three sessions share one ledger file, so a rate
        // computed over the file aggregates strangers — the measured window
        // held 7 starts against 25 stops, one of them an agent type this
        // session never dispatched. The open record already carried it; the
        // appended line did not, and the line is what a rate is computed from.
        session_id: sessionId,
        agent_type: rec.agent_type,
        parent_ref: parentRef,
        depth,
        depth_basis,
        concurrent_open: countOpen(root),
    });
}

function handleStop(root: string, payload: JsonObject, nowIso: string, sessionId: string | null): void {
    const agentId = str(payload, 'agent_id', 'agentId');
    if (agentId === null) {
        appendUnidentified(root, 'subagent_stop', nowIso, payload);
        return;
    }

    const ref = refFor(agentId);
    const rec = readOpenRecords(root).get(ref) ?? null;

    let durationMs: number | null = null;
    if (rec) {
        const started = Date.parse(rec.started_at);
        if (Number.isFinite(started)) durationMs = Math.max(0, Date.parse(nowIso) - started);
    }

    const parse = classifyEnvelope(str(payload, 'last_assistant_message', 'lastAssistantMessage'));

    // Remove FIRST, count AFTER — same definition on both lines.
    removeOpenRecord(root, ref);

    appendLedgerLine(root, nowIso, {
        event: 'subagent_stop',
        ts: nowIso,
        ref,
        // The session this stop was OBSERVED in, read from the same envelope
        // position as the start's — never back-filled from `rec`, which would
        // relabel a cross-session stop as belonging to the dispatching session
        // and hide exactly the mismatch this field exists to expose.
        session_id: sessionId,
        agent_type: rec?.agent_type ?? str(payload, 'agent_type', 'agentType', 'subagent_type', 'subagentType'),
        depth: rec?.depth ?? null,
        depth_basis: rec?.depth_basis ?? null,
        // `null` = the matching start was never seen. That is a finding about
        // the instrument's own coverage and is recorded as such, not as 0.
        duration_ms: durationMs,
        // Phase 3 Step 3, shadow: which wall-clock arms this dispatch would
        // have tripped. Recorded, never acted on.
        stop_loss_arms_exceeded: armsExceeded(durationMs),
        start_seen: rec !== null,
        envelope_parse: parse.verdict,
        envelope_error_count: parse.error_count,
        // Beside the count, never instead of it: the count says how wrong the
        // candidate was, this says whether it was aimed at the envelope.
        envelope_field_hits: parse.field_hits,
        concurrent_open: countOpen(root),
    });
}

/** Process an ALREADY-PARSED dispatcher envelope. Always returns EXIT_ALLOW. */
export function processEnvelope(envelope: JsonValue, consumerRoot: string): number {
    try {
        if (!isObject(envelope)) return EXIT_ALLOW;
        const event = envelope['event'];
        if (event !== 'subagent_start' && event !== 'subagent_stop') return EXIT_ALLOW;

        const payload = unwrapPayload(envelope);
        const nowIso = new Date().toISOString();
        const sessionId = str(payload, 'session_id', 'sessionId') ?? str(envelope, 'session_id', 'sessionId');

        reapStaleOpenRecords(consumerRoot, nowIso);

        if (event === 'subagent_start') handleStart(consumerRoot, payload, nowIso, sessionId);
        else handleStop(consumerRoot, payload, nowIso, sessionId);
    } catch {
        // Malformed payload, unreadable disk, anything — never disturb the run.
        return EXIT_ALLOW;
    }
    return EXIT_ALLOW;
}

/**
 * Resolve the consumer repo root from the dispatcher envelope.
 *
 * R2 finding 10: the host's `cwd` lives under `payload`, not at the envelope
 * top level, so a top-level `cwd` branch is unreachable on the dispatcher path.
 * Both real positions are read here, envelope-level roots first.
 *
 * R2 round 2, finding 6: EXPORTED, and every consumer of this ledger uses it.
 * The producer and its two readers had each grown their own precedence order,
 * so a root that resolved one way for the writer could resolve another for the
 * reader — and a reader looking in the wrong place finds an empty ledger,
 * which every one of these consumers reads as "nothing is open".
 */
export function resolveConsumerRoot(envelope: JsonValue): string {
    if (isObject(envelope)) {
        const pr = str(envelope, 'workspace_root', 'project_root');
        if (pr) return pr;
        const payload = unwrapPayload(envelope);
        const cwd = str(payload, 'cwd');
        if (cwd) return cwd;
    }
    return process.cwd();
}

export function main(): number {
    const raw = readHookStdin();
    let envelope: JsonValue = {};
    try {
        envelope = raw.trim() ? (JSON.parse(raw) as JsonValue) : {};
    } catch {
        return EXIT_ALLOW;
    }
    return processEnvelope(envelope, resolveConsumerRoot(envelope));
}

// Bundle-safety: never auto-run when inlined into an esbuild bundle, where
// every module shares the bundle's `import.meta.url` (see cmd_migrate.ts).
declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
function _isCliEntry(): boolean {
    if (typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__) {
        return false;
    }
    if (process.argv[1] === undefined) return false;
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) return true;
    try {
        return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}
if (_isCliEntry()) process.exit(main());
