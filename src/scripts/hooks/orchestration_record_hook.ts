#!/usr/bin/env tsx
/**
 * Deterministic PostToolUse orchestration-telemetry capture
 * (road-to-orchestrator-discipline-carriers Phase 3 / F6).
 *
 * Why this exists. `orchestration_record` (the CLI) is a model-carried emit
 * step: the orchestrating agent runs it by hand after a dispatch. Measured
 * 2026-08-07: the agent was used on real delegable work 370 times in this
 * repo over one month and the CLI captured exactly 1 of them (0.27%). The
 * capture rate is a hook-reachability defect, not a usage defect — the same
 * data `orchestration_backfill.ts` already reads out of the host transcript
 * (`toolUseResult.{resolvedModel,totalTokens,totalDurationMs,isAsync,status}`)
 * is available live, on the `post_tool_use` slot, the moment the dispatch
 * completes. This concern makes the capture structural instead of hoped-for.
 *
 * Fires only on an `Agent` / `Task` tool-use completion (the two names this
 * repo has observed for the subagent-dispatch tool across hosts/versions).
 * Every other tool call is a silent no-op — same tool-filter discipline as
 * `code-graph-nudge` (`tools: [Agent, Task]` in the manifest entry keeps the
 * dispatcher from paying this concern's cost on unrelated calls).
 *
 * Sync vs async (road-to-orchestrator-first-execution measured: 326 of 370
 * dispatches are async launches that never write cost back to the parent
 * transcript):
 *   - sync completion  → the tool_response carries real usage fields
 *     (`resolvedModel`, `totalTokens`, `totalDurationMs`) — recorded as
 *     measured numbers (`dispatch_tokens`, `wall_clock_ms`, `tiers`).
 *   - async launch ack → `isAsync: true` / `status: "async_launched"` and NO
 *     usage fields — the dispatch FACT is still recorded (`spawn_count: 1`)
 *     but every metric field is left absent (null/omitted). Never fabricated.
 *
 * `token_delta` has no honest value at this layer: it is the net cost of the
 * dispatch versus an in-session baseline, and this hook has no baseline to
 * compare against (same limitation `orchestration_backfill.ts` documents for
 * its own read-only pass — "No in-session counterfactual exists on disk").
 * It is therefore always written as `0` with `token_delta_provenance:
 * "estimated"` — an explicit "no delta claimed" rather than a silent zero
 * that could be misread as "measured no-op". The real absolute cost (when
 * known) rides `dispatch_tokens`, which exists precisely for this case.
 *
 * PRIVACY BY CONSTRUCTION — never widen this file to read/emit free text.
 * The host's own tool_use_id / session_id are high-entropy opaque tokens
 * that `check_secret_leak` correctly flags as candidate credentials (hit
 * during `orchestration_backfill.ts` authoring); this hook never reads them
 * into the record. `id` is generated locally via `crypto.randomUUID()` —
 * our own randomness, not a host-supplied value. `subagent_type` is the one
 * host string recorded, and it is an id-shaped enum
 * (`Explore` / `general-purpose` / `production-validator` / …), never a
 * prompt or description.
 *
 * Uses the existing `_lib/orchestration_record.js` validation
 * (`buildOrchestrationLine`) and the existing CLI's write convention
 * (`orchestration_record.ts`'s `DEFAULT_DIR` + `${ts.slice(0,7)}.jsonl` +
 * plain `fs.appendFileSync`, no per-line schema of its own). `chat_history.ts`
 * — the other post_tool_use concern that appends a JSONL line per call —
 * establishes the precedent that a hook-owned append checks
 * `is_replay_mode()` and skips the dispatcher's shared state lock (the lock
 * exists for atomic *overwrite*; an append is not a torn-write risk the way
 * a rewritten JSON state file is).
 *
 * Exit code is ALWAYS 0 — on every path, including a malformed envelope, an
 * unparseable tool_response, or a write failure. A hook `warn` (exit 2) is
 * read as a hard BLOCK on this host (recorded trap); this concern has
 * nothing to say to the model, so it never warns either.
 */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { buildOrchestrationLine, type RecordInput } from '../_lib/orchestration_record.js';
import { DEFAULT_DIR } from '../orchestration_record.js';
import { is_replay_mode } from './state_io.js';
import { readHookStdin } from './hook_stdin.js';

const EXIT_ALLOW = 0;

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };
type JsonObject = { [k: string]: JsonValue };

function isObject(v: unknown): v is JsonObject {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** The two subagent-dispatch tool names observed across hosts/versions. */
export const DISPATCH_TOOL_NAMES: ReadonlySet<string> = new Set(['Agent', 'Task']);

/**
 * Unwrap the dispatcher envelope (`{schema_version, platform, event,
 * payload}`) down to the platform-native payload. Falls back to the
 * top-level object for direct/legacy invocation (same shape both
 * `pr_url_reminder_hook.ts` and `code_graph_nudge_hook.ts` handle).
 */
export function unwrapPayload(envelope: JsonObject): JsonObject {
    const inner = envelope['payload'];
    return isObject(inner) ? inner : envelope;
}

/** Best-effort read of the tool name off a payload, across host key variants. */
export function extractToolName(payload: JsonObject): string | null {
    const v = payload['tool_name'] ?? payload['toolName'] ?? payload['tool'];
    return typeof v === 'string' && v ? v : null;
}

/** Best-effort read of the tool_input object (the ORIGINAL dispatch request). */
function extractToolInput(payload: JsonObject): JsonObject | null {
    const v = payload['tool_input'] ?? payload['toolInput'];
    return isObject(v) ? v : null;
}

/**
 * Best-effort read of the tool's result object off a payload. Tries the
 * established hook-envelope keys first, then the raw transcript key
 * (`toolUseResult`) `orchestration_backfill.ts` reads from the JSONL corpus —
 * some hosts may preserve that shape verbatim in the dispatcher payload.
 * A string value (e.g. shell stdout on unrelated tools) is never parsed as
 * dispatch metrics — only an already-decoded object counts.
 */
export function extractToolResult(payload: JsonObject): JsonObject | null {
    for (const key of ['tool_response', 'toolResponse', 'tool_result', 'toolUseResult']) {
        const v = payload[key];
        if (isObject(v)) return v;
    }
    return null;
}

/** One dispatch-completion event, reduced to what this hook will record. */
export interface DispatchFacts {
    subagentType: string | null;
    resolvedModel: string | null;
    /** Absolute measured tokens the dispatched slice consumed. `null` = not observed (async). */
    totalTokens: number | null;
    totalDurationMs: number | null;
    isAsync: boolean;
    isError: boolean;
}

function numOrNull(v: JsonValue | undefined): number | null {
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/**
 * Model FAMILY names the `audit-log-v1` `orchestration.tiers` contract
 * expects (`orchestration-telemetry.md`: `["sonnet","opus"]`, "Tier names
 * only, no prompts") — never a full model id like
 * `claude-sonnet-4-5-20250929` or `us.anthropic.claude-opus-4-…` (F9,
 * review). Ordered so a longer/more-specific family never loses to a
 * substring of another (none currently overlap, but `haiku`/`sonnet`/`opus`/
 * `fable` are checked as whole tokens via case-insensitive substring, not
 * prefix, so any future id shape that embeds the family name anywhere still
 * resolves).
 */
const MODEL_FAMILIES: readonly string[] = ['haiku', 'sonnet', 'opus', 'fable'];

/**
 * Reduce a host-reported `resolvedModel` (a full model id) to the tier-name
 * vocabulary the contract expects. No match → `null`, never the raw id —
 * `buildRecordInput` below treats `null` as "omit `tiers` entirely" rather
 * than writing a value the schema does not define.
 */
export function extractModelFamily(resolvedModel: string): string | null {
    const lower = resolvedModel.toLowerCase();
    for (const family of MODEL_FAMILIES) {
        if (lower.includes(family)) return family;
    }
    return null;
}

/**
 * Read dispatch facts from an already-identified Agent/Task tool-use payload.
 * Returns `null` when the payload carries no result object at all — this
 * still counts as a completion (e.g. a bare async ack with an empty body
 * would be unusual, but a missing result should never fabricate metrics).
 */
export function extractDispatchFacts(payload: JsonObject): DispatchFacts {
    const input = extractToolInput(payload);
    const subagentType =
        input && typeof input['subagent_type'] === 'string' ? (input['subagent_type'] as string) : null;

    const result = extractToolResult(payload);
    const resolvedModel =
        result && typeof result['resolvedModel'] === 'string' ? (result['resolvedModel'] as string) : null;

    // `usage.input_tokens` + `usage.output_tokens` is the fallback source the
    // orchestration-telemetry contract names when `totalTokens` itself is
    // absent (§ "token_delta sourcing priority" — the same host usage object,
    // read here for the absolute count rather than a delta).
    let totalTokens = result ? numOrNull(result['totalTokens']) : null;
    if (totalTokens === null && result && isObject(result['usage'])) {
        const usage = result['usage'] as JsonObject;
        const inTok = numOrNull(usage['input_tokens']);
        const outTok = numOrNull(usage['output_tokens']);
        if (inTok !== null || outTok !== null) {
            totalTokens = (inTok ?? 0) + (outTok ?? 0);
        }
    }

    const totalDurationMs = result ? numOrNull(result['totalDurationMs']) : null;
    const isAsync = result !== null && (result['isAsync'] === true || result['status'] === 'async_launched');
    const isError = payload['is_error'] === true || payload['isError'] === true || (result !== null && result['is_error'] === true);

    return { subagentType, resolvedModel, totalTokens, totalDurationMs, isAsync, isError };
}

/**
 * Build the `RecordInput` for one dispatch-completion event. Pure — no I/O,
 * no `Date.now()` / random call inside (both are supplied by the caller so
 * the mapping itself stays independently testable).
 */
export function buildRecordInput(facts: DispatchFacts, ts: string, id: string): RecordInput {
    const input: RecordInput = {
        spawn_count: 1,
        // No in-session baseline exists at this layer to compute a delta
        // against (see file header) — 0/"estimated" is an explicit
        // "no delta claimed", never a measured zero.
        token_delta: 0,
        token_delta_provenance: 'estimated',
        // This concern performs no verification of the subagent's output —
        // "none" is the honest value, not the schema's "deterministic" default.
        verify_mode: 'none',
        ts,
        id,
    };
    if (facts.subagentType) input.agent_combo = [facts.subagentType];
    if (facts.isError) input.dispatch_outcome = 'killed';

    if (!facts.isAsync) {
        if (facts.resolvedModel) {
            const family = extractModelFamily(facts.resolvedModel);
            if (family) input.tiers = [family];
        }
        if (facts.totalTokens !== null) input.dispatch_tokens = facts.totalTokens;
        if (facts.totalDurationMs !== null) input.wall_clock_ms = facts.totalDurationMs;
    }
    // Async launch ack: every metric field stays absent (undefined → the
    // schema's own null/0 default) rather than fabricated from nothing.

    return input;
}

/** `${ts.slice(0,7)}.jsonl` — identical file-naming convention to the CLI. */
function auditFileFor(consumerRoot: string, ts: string): string {
    return path.join(consumerRoot, DEFAULT_DIR, `${ts.slice(0, 7)}.jsonl`);
}

/**
 * Append one built line to the monthly audit file. Mirrors the CLI's own
 * write path (`mkdirSync` + `appendFileSync`, no dispatcher lock — appends
 * are not the torn-write risk `atomic_write_json`/`atomic_write_text` guard
 * against) and honours `AGENT_CONFIG_REPLAY=1` the same way `chat_history.ts`
 * does for its own per-call JSONL append.
 */
function appendLine(consumerRoot: string, ts: string, line: Record<string, unknown>): void {
    if (is_replay_mode()) return;
    const file = auditFileFor(consumerRoot, ts);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, `${JSON.stringify(line)}\n`, 'utf8');
}

/**
 * Process an ALREADY-PARSED envelope. Both `run` (the test-facing,
 * string-in entry point) and `main` (the real stdin path) fun this — F13
 * (review): `main` used to parse stdin once to resolve `consumer_root`
 * and then hand the same raw string to `run`, which parsed it a SECOND
 * time. Parsing here, once, and passing the decoded value through removes
 * the duplicate `JSON.parse` on the hot path without touching `run`'s
 * public string-in signature (tests call it directly with a raw string).
 */
function processEnvelope(envelope: JsonValue, consumer_root: string): number {
    try {
        if (!isObject(envelope)) return EXIT_ALLOW;

        const payload = unwrapPayload(envelope);
        const toolName = extractToolName(payload);
        if (toolName === null || !DISPATCH_TOOL_NAMES.has(toolName)) return EXIT_ALLOW;

        const facts = extractDispatchFacts(payload);
        const ts = new Date().toISOString();
        const id = crypto.randomUUID();
        const input = buildRecordInput(facts, ts, id);

        const { line, errors } = buildOrchestrationLine(input);
        if (errors.length || line === null) return EXIT_ALLOW; // never block on our own validation

        appendLine(consumer_root, ts, line);
    } catch {
        // Malformed payload, unreadable disk, anything — never block the tool call.
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
