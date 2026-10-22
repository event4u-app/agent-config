#!/usr/bin/env tsx
/**
 * Spawn-guard — SHADOW ONLY (road-to-subagent-lifecycle-integrity Phase 3
 * Step 1, activated per `docs/contracts/concern-activation-policy.md`).
 *
 * What it does: on every `Agent` / `Task` call and every resume (`SendMessage`),
 * read the open-dispatch set the Phase-1 ledger maintains, and append one
 * `spawn_guard_shadow` line recording what a guard WOULD have done at several
 * candidate thresholds; a spawn also records whether a warm worker would have
 * been re-tasked instead (`reuse`). It emits nothing to the model and it never
 * blocks. Exit is always 0.
 *
 * ── Why shadow and not warn ───────────────────────────────────────────────
 *
 * The plan's own text said "ships warn-first … then flips to deny on
 * evidence, per the concern activation policy". That policy did not exist
 * when the step was written — three roadmaps cited it and none had written
 * it — so the step could not be executed without inventing the posture it had
 * deliberately deferred. The policy now exists, and it rules the warn rung
 * out for a concern on its way to blocking:
 *
 *   - `session-canary` is a per-turn injection, VERIFIED to fire, whose
 *     compliance miss rate did not move (24 of 29 task starts).
 *   - conformance round 5: both blocking carriers reached zero violations,
 *     neither advisory carrier did.
 *
 * A warn would pay this concern's full per-call cost and, on the evidence,
 * buy nothing. Shadow pays the same cost and buys the distribution the
 * threshold has to be derived from — which is the only thing standing
 * between this guard and a number picked out of the air.
 *
 * ── Why several thresholds at once ────────────────────────────────────────
 *
 * One candidate answers yes/no; a spread answers "at which value does this
 * start catching things, and at which does it start denying legitimate
 * work". The policy requires the shipped default to sit at the legitimate
 * distribution's 99th percentile + 1, and that cannot be read off a single
 * candidate. The plan's own N=2 / M=4 is included as one candidate among
 * three, which is the honest status of a pre-registered starting value.
 *
 * ── What this does NOT measure, stated rather than implied ────────────────
 *
 * Depth. The estimate is the deepest open record + 1, maximised over ALL open
 * records regardless of lineage, because pre-spawn there is no `agent_id` to
 * resolve a real parent from. That makes it >= 2 whenever anything is open —
 * flat fan-out included — so it **decides nothing**: no candidate's verdict
 * reads it, and the line carries `depth_usable_for_derivation: false`. It
 * rides along as context and becomes a real measurement only when Phase 0
 * Step 4 establishes whether `agent_id` reaches a PreToolUse payload.
 *
 * PRIVACY BY CONSTRUCTION: counts, candidate verdicts, and a reuse verdict whose
 * only free string is a worker's durable name from the register. A name read
 * from the tool input reaches disk only as a session-bound digest. No prompt, no
 * message, no recipient, no agent id.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { probeHostCapabilities } from '../_lib/host_capability.js';
import { recentHostMarker } from '../_lib/quota_parked.js';
import { shadowReuseVerdict, type ReuseContext, type WorkerState } from '../_lib/worker_reuse.js';
import {
    appendLedgerLine,
    openRecordStats,
    readIndexEntry,
    readOpenRecords,
    refFor,
    resolveConsumerRoot,
    stopIndexKey,
    writeIndexEntry,
} from './subagent_ledger_hook.js';
import { readHookStdin } from './hook_stdin.js';
import { EXIT_ALLOW } from './exit_codes.js';

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };
type JsonObject = { [k: string]: JsonValue };

function isObject(v: unknown): v is JsonObject {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** The two subagent-dispatch tool names this repo has observed across hosts. */
export const DISPATCH_TOOL_NAMES: ReadonlySet<string> = new Set(['Agent', 'Task']);

/**
 * The tool that re-tasks a finished worker — and also messages a running one,
 * a teammate, or the lead. The host's concurrency cap checks new spawns only
 * and admits a resume past it, so a guard that counted spawns only would
 * undercount exactly the runs the host does not bound. Only a send the ledger
 * can place on a finished leg is called a resume; see {@link classifySend}.
 */
export const RESUME_TOOL_NAMES: ReadonlySet<string> = new Set(['SendMessage']);

/**
 * `resume` — the recipient hashes to a ledger ref that is not open and whose
 * stop this same session recorded: a finished leg of this session is
 * re-entered, which starts a run.
 * `message_running` — the ref is open: the message starts no run.
 * `message_or_resume` — the ledger cannot place the recipient in this session
 * (a name, a teammate, the lead, another session's leg, no session id, a stop
 * older than the scan window). Recorded, never called a resume.
 *
 * The verdict describes the attempted send at `pre_tool_use`; whether the host
 * then accepts it is not visible here.
 */
export type SendKind = 'resume' | 'message_running' | 'message_or_resume';

/** Longer names are neither recorded nor resolved: a name is an address, not a payload. */
export const NAME_MAX = 128;

/** Domain-separated digest of (session, name); the only form a tool-input name takes on disk. */
function nameKey(sessionId: string, name: string): string {
    return refFor(`subagent-name\0${sessionId}\0${name}`);
}

/**
 * Classify one send. `recipient_kind: name` is resolved through the register a
 * named spawn of this session left; any other recipient is taken as an agent id
 * and hashed with the ledger's own `refFor`. Neither the recipient nor its ref
 * is written.
 */
export function classifySend(
    root: string,
    toolInput: unknown,
    sessionId: string | null,
    now: Date = new Date(),
): SendKind {
    const input = isObject(toolInput) ? toolInput : {};
    const recipient = input['to'];
    if (typeof recipient !== 'string' || recipient === '') return 'message_or_resume';
    if (sessionId === null || sessionId === '') return 'message_or_resume';
    const ref =
        input['recipient_kind'] !== 'name'
            ? refFor(recipient)
            : recipient.length > NAME_MAX
              ? null
              : readIndexEntry(root, nameKey(sessionId, recipient), now);
    if (!ref) return 'message_or_resume';
    if (readOpenRecords(root).has(ref)) return 'message_running';
    return readIndexEntry(root, stopIndexKey(sessionId, ref), now) === null ? 'message_or_resume' : 'resume';
}

/**
 * On a completed named spawn, record which ledger ref the name now addresses.
 * Neither the name nor the agent id reaches disk in clear; both are digested first.
 */
export function recordNamedSpawn(root: string, payload: JsonObject, sessionId: string | null, nowIso: string): void {
    const input = isObject(payload['tool_input']) ? payload['tool_input'] : {};
    const result = isObject(payload['tool_response']) ? payload['tool_response'] : {};
    const name = input['name'];
    const agentId = result['agentId'];
    if (typeof name !== 'string' || name === '' || name.length > NAME_MAX || typeof agentId !== 'string' || agentId === '') return;
    if (sessionId === null) return;
    const key = nameKey(sessionId, name);
    appendLedgerLine(root, nowIso, { event: 'subagent_named', ts: nowIso, ref: refFor(agentId), name_key: key, session_id: sessionId });
    writeIndexEntry(root, nowIso, key, refFor(agentId));
}

/**
 * Platforms where `pre_tool_use` was observed firing on the resume tool, with a
 * deny honoured there. Elsewhere the line says the resume half is unobserved.
 */
export const RESUME_ADMISSION_OBSERVED: ReadonlySet<string> = new Set(['claude']);

/**
 * Inputs to the reuse verdict. Production passes none: `host_resume` comes
 * from the host row, and no worker register is recorded yet, which the verdict
 * names as `worker_register_unrecorded` rather than reading as empty.
 */
export interface ShadowDeps {
    host_resume?: boolean;
    workers?: readonly WorkerState[] | null;
    context?: ReuseContext | null;
}

/** One candidate guard configuration under shadow evaluation. */
export interface Candidate {
    readonly label: string;
    /** Refuse when the new dispatch's depth would reach this. */
    readonly max_depth: number;
    /** Refuse when this many dispatches are already open. */
    readonly max_concurrent: number;
}

/**
 * The candidate spread. `n2m4` is the roadmap's pre-registered pair, carried
 * as ONE candidate rather than as the answer; the wider pairs exist so the
 * shadow log yields a curve instead of a single verdict.
 */
export const CANDIDATES: readonly Candidate[] = [
    { label: 'n2m4', max_depth: 2, max_concurrent: 4 },
    { label: 'n3m6', max_depth: 3, max_concurrent: 6 },
    { label: 'n4m8', max_depth: 4, max_concurrent: 8 },
];

export interface ShadowVerdict {
    readonly label: string;
    readonly would_deny: boolean;
    /** Which arm tripped. Only `concurrent` can appear — see below. */
    readonly on: string[];
}

/**
 * Pure: evaluate every candidate against the observed state.
 *
 * **Only the concurrency arm produces a verdict** (R2 round 2, finding 3). The
 * depth arm is confounded by construction and was silently poisoning the very
 * curve this shadow exists to produce:
 *
 * `depth_estimate` is `max(open depths) + 1`, maximised over ALL open records
 * regardless of lineage, and every record carries depth >= 1. So the estimate
 * is >= 2 whenever anything at all is open — including a flat fan-out with no
 * nesting whatsoever. `n2m4`'s depth arm would then read `would_deny` on an
 * ordinary sibling spawn, and the 99th-percentile derivation the activation
 * policy prescribes would be computed over the estimator's artefact rather
 * than over observed nesting.
 *
 * This was not caught by reasoning; it was caught by a reviewer after an
 * end-to-end probe produced exactly that reading and it was briefly mistaken
 * for a signal.
 *
 * Real per-spawn depth needs the parent lineage, which needs `agent_id` on the
 * PreToolUse payload — Phase 0 Step 4, still open. Until it lands, the depth
 * number rides along as context, flagged unusable, and decides nothing.
 */
export function evaluateCandidates(depthEstimate: number, concurrentOpen: number): ShadowVerdict[] {
    void depthEstimate;
    return CANDIDATES.map((c) => {
        const on: string[] = [];
        if (concurrentOpen >= c.max_concurrent) on.push('concurrent');
        return { label: c.label, would_deny: on.length > 0, on };
    });
}

function unwrapPayload(envelope: JsonObject): JsonObject {
    const inner = envelope['payload'];
    return isObject(inner) ? inner : envelope;
}

function extractToolName(payload: JsonObject): string | null {
    const v = payload['tool_name'] ?? payload['toolName'] ?? payload['tool'];
    return typeof v === 'string' && v ? v : null;
}

export function processEnvelope(envelope: JsonValue, consumerRoot: string, deps: ShadowDeps = {}): number {
    try {
        if (!isObject(envelope)) return EXIT_ALLOW;
        const payload = unwrapPayload(envelope);
        const toolName = extractToolName(payload);
        if (toolName === null) return EXIT_ALLOW;
        if (envelope['event'] === 'post_tool_use' || payload['hook_event_name'] === 'PostToolUse') {
            if (DISPATCH_TOOL_NAMES.has(toolName)) {
                const sid = payload['session_id'] ?? envelope['session_id'];
                recordNamedSpawn(consumerRoot, payload, typeof sid === 'string' ? sid : null, new Date().toISOString());
            }
            return EXIT_ALLOW;
        }
        const isResume = RESUME_TOOL_NAMES.has(toolName);
        if (!isResume && !DISPATCH_TOOL_NAMES.has(toolName)) return EXIT_ALLOW;
        const platform = typeof envelope['platform'] === 'string' ? envelope['platform'] : null;
        const toolInput = isObject(payload['tool_input']) ? payload['tool_input'] : {};
        const sessionRaw = payload['session_id'] ?? envelope['session_id'];
        const sessionId = typeof sessionRaw === 'string' ? sessionRaw : null;
        const sendKind: SendKind | null = isResume ? classifySend(consumerRoot, toolInput, sessionId) : null;
        // A spawn's definition and requested name (as its session digest), so a
        // report can join the request to the named worker a reuse would address.
        const reqName = toolInput['name'];
        const spawnFacts = isResume
            ? {}
            : {
                  agent_type: typeof toolInput['subagent_type'] === 'string' ? toolInput['subagent_type'] : null,
                  ...(typeof reqName === 'string' && reqName && reqName.length <= NAME_MAX && sessionId
                      ? { name_key: nameKey(sessionId, reqName) }
                      : {}),
              };
        // Only the verdict's label and reason codes reach disk — never the tool input.
        const reuse = isResume
            ? null
            : shadowReuseVerdict({
                  host_resume: deps.host_resume ?? probeHostCapabilities(platform).worker_resume,
                  workers: deps.workers ?? null,
                  context: deps.context ?? null,
              });

        const stats = openRecordStats(consumerRoot);
        // Pre-spawn there is no agent id to resolve a parent from; the deepest
        // open record + 1 is an upper bound, exact only for a linear chain.
        const depthEstimate = stats.max_depth + 1;
        const verdicts = evaluateCandidates(depthEstimate, stats.open_count);
        const nowIso = new Date().toISOString();

        appendLedgerLine(consumerRoot, nowIso, {
            event: 'spawn_guard_shadow',
            ts: nowIso,
            tool: toolName,
            concurrent_open: stats.open_count,
            depth_estimate: depthEstimate,
            depth_estimate_basis: 'deepest-open-record-plus-one',
            // R2 round 2, finding 3: the estimate is >= 2 whenever anything is
            // open, nesting or not, so it must not reach a derivation. It rides
            // as context with the flag that says so.
            depth_usable_for_derivation: false,
            // R2 round 2, finding 4: without these, a quiet estate, a ledger
            // this hook cannot see, and a root mismatch all emit byte-identical
            // records — the instrument-goes-quiet failure one layer up from the
            // one the ledger already fixed for itself.
            ledger_present: stats.ledger_present,
            stale_open_excluded: stats.stale_excluded,
            // A message to a running worker starts no run, so it is not set
            // against a threshold that counts runs.
            ...(sendKind === 'message_running'
                ? {}
                : { candidates: verdicts.map((v) => ({ label: v.label, would_deny: v.would_deny, on: v.on })) }),
            dispatch_kind: sendKind ?? 'spawn',
            ...spawnFacts,
            resume_admission: platform !== null && RESUME_ADMISSION_OBSERVED.has(platform) ? 'counted' : 'unobserved',
            ...(reuse === null ? {} : { reuse }),
            // A recent host-sourced rate marker: a new spawn would have waited.
            ...(isResume ? {} : { rate_window: recentHostMarker(consumerRoot) ? 'would_wait' : 'clear' }),
            // Shadow posture is a property of this file, not of a setting —
            // there is no code path here that can deny.
            posture: 'shadow',
        });
    } catch {
        // Never disturb a tool call for a measurement.
        return EXIT_ALLOW;
    }
    return EXIT_ALLOW;
}

// R2 round 2, finding 6: this file used to carry its OWN root-resolution
// order, a third one alongside the ledger's and the turn-end gate's. A reader
// that resolves a different root than the writer finds an empty ledger, and
// every consumer here reads an empty ledger as "nothing is open" — a silent
// wrong answer rather than an error. One exported resolver, three callers.

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

declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
function _isCliEntry(): boolean {
    if (typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__) return false;
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
