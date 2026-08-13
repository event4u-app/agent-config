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
 *     any form — not truncated, not hashed, not summarised. Only the three-way
 *     parse VERDICT (`ok` / `fail` / `absent`) and a validator error COUNT
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
 * ── Depth and concurrency (Step 3) ────────────────────────────────────────
 *
 * Depth is derived from the open-record set, not asserted. A start payload
 * that names a parent (`parent_agent_id` / `parentAgentId`, or a
 * session-level `agent_id` distinct from the starting agent's own) is a
 * nested spawn: its depth is the parent's depth + 1, resolved by walking the
 * open records. When no parent field arrives at all, depth is recorded as 1
 * with `depth_basis: "assumed-root"` — absence is written down as absence,
 * never as a measured root. Phase 0 Steps 2 and 4 are what will replace the
 * assumption with an observed payload shape; until they run, the honest
 * record says which of the two it is.
 *
 * `concurrent_open` is the count of open records at the moment the event is
 * processed, INCLUDING the record being opened, so a lone dispatch reads 1.
 */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { validateResponse } from '../_lib/subagent_response.js';
import { is_replay_mode } from './state_io.js';
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
 * Unwrap the dispatcher envelope (`{schema_version, platform, event, payload}`)
 * down to the platform-native payload, falling back to the top-level object
 * for direct/legacy invocation — the same shape `orchestration_record_hook`
 * and `code_graph_nudge_hook` handle.
 */
export function unwrapPayload(envelope: JsonObject): JsonObject {
    const inner = envelope['payload'];
    return isObject(inner) ? inner : envelope;
}

/** Read the internal event name off the dispatcher envelope. */
export function extractEvent(envelope: JsonObject): string | null {
    const v = envelope['event'];
    return typeof v === 'string' && v ? v : null;
}

function str(payload: JsonObject, ...keys: string[]): string | null {
    for (const k of keys) {
        const v = payload[k];
        if (typeof v === 'string' && v) return v;
    }
    return null;
}

/** The starting/stopping agent's own id, across observed host key variants. */
export function extractAgentId(payload: JsonObject): string | null {
    return str(payload, 'agent_id', 'agentId');
}

/** The agent TYPE, an id-shaped enum — the one host string recorded verbatim. */
export function extractAgentType(payload: JsonObject): string | null {
    return str(payload, 'agent_type', 'agentType', 'subagent_type', 'subagentType');
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
export function extractParentId(payload: JsonObject, ownId: string | null): string | null {
    const explicit = str(payload, 'parent_agent_id', 'parentAgentId');
    if (explicit) return explicit;
    const session = payload['session'];
    if (isObject(session)) {
        const sessionAgent = str(session, 'agent_id', 'agentId');
        if (sessionAgent && sessionAgent !== ownId) return sessionAgent;
    }
    return null;
}

/** The subagent's final assistant message — read, classified, never stored. */
export function extractLastMessage(payload: JsonObject): string | null {
    return str(payload, 'last_assistant_message', 'lastAssistantMessage');
}

export type EnvelopeParse = 'ok' | 'fail' | 'absent';

export interface ParseVerdict {
    verdict: EnvelopeParse;
    /** Count of validator errors. A COUNT — the messages never leave this function. */
    error_count: number;
}

/**
 * Classify a subagent's final message against the response-envelope contract.
 *
 * Three outcomes, and the distinction between the last two is the whole point
 * of the measurement: `absent` means no envelope was found to judge (no
 * message, or a message carrying no JSON object at all), `fail` means one was
 * found and did not satisfy `validateResponse`. Collapsing them would make the
 * Phase-1 baseline unable to separate "the worker never returned a structured
 * result" from "it returned a malformed one" — two different defects with two
 * different fixes.
 *
 * A fenced ```json block is unwrapped first, because that is how a model
 * emits an envelope in prose; a bare object is tried second.
 */
export function classifyEnvelope(message: string | null): ParseVerdict {
    if (message === null || !message.trim()) return { verdict: 'absent', error_count: 0 };

    const candidate = _extractJsonObject(message);
    if (candidate === null) return { verdict: 'absent', error_count: 0 };

    const result = validateResponse(candidate);
    if (result.valid) return { verdict: 'ok', error_count: 0 };
    return { verdict: 'fail', error_count: result.errors.length };
}

/**
 * Pull the first plausible JSON object out of a message. Returns the DECODED
 * value, never the text. Deliberately conservative: a fenced block, then the
 * outermost brace span. A message with no object shape yields `null`, which
 * the caller reports as `absent` rather than `fail`.
 */
function _extractJsonObject(message: string): unknown | null {
    const fenced = /```(?:json)?\s*\n([\s\S]*?)```/.exec(message);
    const bodies: string[] = [];
    if (fenced && fenced[1]) bodies.push(fenced[1]);
    const first = message.indexOf('{');
    const last = message.lastIndexOf('}');
    if (first !== -1 && last > first) bodies.push(message.slice(first, last + 1));

    for (const body of bodies) {
        try {
            const parsed: unknown = JSON.parse(body.trim());
            if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
        } catch {
            // try the next candidate shape
        }
    }
    return null;
}

/** An open dispatch, as persisted between the start and stop invocations. */
export interface OpenRecord {
    ref: string;
    agent_type: string | null;
    started_at: string;
    parent_ref: string | null;
    depth: number;
    depth_basis: 'observed' | 'assumed-root';
}

function openDir(root: string): string {
    return path.join(root, LEDGER_DIR, OPEN_SUBDIR);
}

function openFile(root: string, ref: string): string {
    return path.join(openDir(root), `${ref}.json`);
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
        try {
            const raw = fs.readFileSync(path.join(openDir(root), name), 'utf8');
            const parsed: unknown = JSON.parse(raw);
            if (isObject(parsed) && typeof parsed['ref'] === 'string') {
                out.set(parsed['ref'] as string, parsed as unknown as OpenRecord);
            }
        } catch {
            // A torn or hand-edited record is data we do not have, not a crash.
        }
    }
    return out;
}

/**
 * Resolve depth from the open-record set.
 *
 * A parent we can see gives `observed` depth. A parent the payload named but
 * whose record is not open (it closed first, or its start was never seen)
 * still counts as nesting — depth 2 — because the payload asserted a parent;
 * what we lack is the ancestor chain, not the fact of nesting. No parent field
 * at all is `assumed-root`. The walk is bounded by the open-set size so a
 * malformed cycle cannot spin.
 */
export function resolveDepth(
    parentRef: string | null,
    open: ReadonlyMap<string, OpenRecord>,
): { depth: number; depth_basis: 'observed' | 'assumed-root' } {
    if (parentRef === null) return { depth: 1, depth_basis: 'assumed-root' };
    const parent = open.get(parentRef);
    if (!parent) return { depth: 2, depth_basis: 'observed' };
    return { depth: parent.depth + 1, depth_basis: 'observed' };
}

/** `${ts.slice(0,7)}.jsonl` — the monthly-file convention the audit stream uses. */
export function ledgerFileFor(root: string, ts: string): string {
    return path.join(root, LEDGER_DIR, `${ts.slice(0, 7)}.jsonl`);
}

function appendLedgerLine(root: string, ts: string, line: Record<string, unknown>): void {
    if (is_replay_mode()) return;
    const file = ledgerFileFor(root, ts);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, `${JSON.stringify(line)}\n`, 'utf8');
}

function writeOpenRecord(root: string, rec: OpenRecord): void {
    if (is_replay_mode()) return;
    fs.mkdirSync(openDir(root), { recursive: true });
    fs.writeFileSync(openFile(root, rec.ref), `${JSON.stringify(rec)}\n`, 'utf8');
}

function removeOpenRecord(root: string, ref: string): void {
    if (is_replay_mode()) return;
    try {
        fs.unlinkSync(openFile(root, ref));
    } catch {
        // Already gone — a duplicate stop is not an error worth reporting.
    }
}

function handleStart(root: string, payload: JsonObject, nowIso: string): void {
    const agentId = extractAgentId(payload);
    if (agentId === null) return; // nothing to correlate on; record nothing rather than a fiction

    const ref = refFor(agentId);
    const parentId = extractParentId(payload, agentId);
    const parentRef = parentId ? refFor(parentId) : null;

    const open = readOpenRecords(root);
    const { depth, depth_basis } = resolveDepth(parentRef, open);

    const rec: OpenRecord = {
        ref,
        agent_type: extractAgentType(payload),
        started_at: nowIso,
        parent_ref: parentRef,
        depth,
        depth_basis,
    };
    writeOpenRecord(root, rec);

    appendLedgerLine(root, nowIso, {
        event: 'subagent_start',
        ts: nowIso,
        ref,
        agent_type: rec.agent_type,
        parent_ref: parentRef,
        depth,
        depth_basis,
        // The record just written is included, so a lone dispatch reads 1.
        concurrent_open: open.size + (open.has(ref) ? 0 : 1),
    });
}

function handleStop(root: string, payload: JsonObject, nowIso: string): void {
    const agentId = extractAgentId(payload);
    if (agentId === null) return;

    const ref = refFor(agentId);
    const open = readOpenRecords(root);
    const rec = open.get(ref) ?? null;

    let durationMs: number | null = null;
    if (rec) {
        const started = Date.parse(rec.started_at);
        if (Number.isFinite(started)) durationMs = Math.max(0, Date.parse(nowIso) - started);
    }

    const parse = classifyEnvelope(extractLastMessage(payload));

    appendLedgerLine(root, nowIso, {
        event: 'subagent_stop',
        ts: nowIso,
        ref,
        agent_type: rec?.agent_type ?? extractAgentType(payload),
        depth: rec?.depth ?? null,
        depth_basis: rec?.depth_basis ?? null,
        // `null` = the matching start was never seen. That is a finding about
        // the instrument's own coverage and is recorded as such, not as 0.
        duration_ms: durationMs,
        start_seen: rec !== null,
        envelope_parse: parse.verdict,
        envelope_error_count: parse.error_count,
        // Excludes the record being closed.
        concurrent_open: Math.max(0, open.size - (rec ? 1 : 0)),
    });

    removeOpenRecord(root, ref);
}

/** Process an ALREADY-PARSED dispatcher envelope. Always returns EXIT_ALLOW. */
export function processEnvelope(envelope: JsonValue, consumerRoot: string): number {
    try {
        if (!isObject(envelope)) return EXIT_ALLOW;
        const event = extractEvent(envelope);
        if (event !== 'subagent_start' && event !== 'subagent_stop') return EXIT_ALLOW;

        const payload = unwrapPayload(envelope);
        const nowIso = new Date().toISOString();
        if (event === 'subagent_start') handleStart(consumerRoot, payload, nowIso);
        else handleStop(consumerRoot, payload, nowIso);
    } catch {
        // Malformed payload, unreadable disk, anything — never disturb the run.
        return EXIT_ALLOW;
    }
    return EXIT_ALLOW;
}

export function run(stdin_text: string, options: { consumer_root: string }): number {
    let envelope: JsonValue;
    try {
        const raw = stdin_text.trim();
        if (!raw) return EXIT_ALLOW;
        envelope = JSON.parse(raw) as JsonValue;
    } catch {
        return EXIT_ALLOW;
    }
    return processEnvelope(envelope, options.consumer_root);
}

function _resolveRoot(envelope: JsonValue): string {
    if (isObject(envelope)) {
        const cwd = envelope['cwd'];
        if (typeof cwd === 'string' && cwd) return cwd;
        const pr = envelope['workspace_root'] ?? envelope['project_root'];
        if (typeof pr === 'string' && pr) return pr;
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
    return processEnvelope(envelope, _resolveRoot(envelope));
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
