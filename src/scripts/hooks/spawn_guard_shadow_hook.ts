#!/usr/bin/env tsx
/**
 * Spawn-guard — SHADOW ONLY (road-to-subagent-lifecycle-integrity Phase 3
 * Step 1, activated per `docs/contracts/concern-activation-policy.md`).
 *
 * What it does: on every `Agent` / `Task` tool call, read the open-dispatch
 * set the Phase-1 ledger maintains, and append one `spawn_guard_shadow` line
 * recording what a guard WOULD have done at several candidate thresholds.
 * It emits nothing to the model and it never blocks. Exit is always 0.
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
 * Depth here is the depth the NEW dispatch would have, estimated as the
 * deepest open record + 1. Pre-spawn there is no `agent_id` to resolve a
 * real parent from, so this is an upper bound on a sibling spawn and exact
 * only for a linear chain. The field is named `depth_estimate` and carries
 * its basis, so nobody derives a percentile from it believing it measured.
 *
 * PRIVACY BY CONSTRUCTION: counts and candidate verdicts only. No prompt, no
 * agent id, no tool input — the record type has no field able to hold any.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { appendLedgerLine, openRecordStats } from './subagent_ledger_hook.js';
import { readHookStdin } from './hook_stdin.js';

const EXIT_ALLOW = 0;

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };
type JsonObject = { [k: string]: JsonValue };

function isObject(v: unknown): v is JsonObject {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** The two subagent-dispatch tool names this repo has observed across hosts. */
export const DISPATCH_TOOL_NAMES: ReadonlySet<string> = new Set(['Agent', 'Task']);

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
    /** Which arm tripped: `depth`, `concurrent`, both, or none. */
    readonly on: string[];
}

/** Pure: evaluate every candidate against the observed state. */
export function evaluateCandidates(depthEstimate: number, concurrentOpen: number): ShadowVerdict[] {
    return CANDIDATES.map((c) => {
        const on: string[] = [];
        if (depthEstimate >= c.max_depth) on.push('depth');
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

export function processEnvelope(envelope: JsonValue, consumerRoot: string): number {
    try {
        if (!isObject(envelope)) return EXIT_ALLOW;
        const payload = unwrapPayload(envelope);
        const toolName = extractToolName(payload);
        if (toolName === null || !DISPATCH_TOOL_NAMES.has(toolName)) return EXIT_ALLOW;

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
            candidates: verdicts.map((v) => ({ label: v.label, would_deny: v.would_deny, on: v.on })),
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

function _resolveRoot(envelope: JsonValue): string {
    if (isObject(envelope)) {
        for (const k of ['workspace_root', 'project_root']) {
            const v = envelope[k];
            if (typeof v === 'string' && v) return v;
        }
        const cwd = unwrapPayload(envelope)['cwd'];
        if (typeof cwd === 'string' && cwd) return cwd;
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
