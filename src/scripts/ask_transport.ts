#!/usr/bin/env node
/**
 * Rung-0.5 ask transport — one prompt, one answer, no harness, no session
 * (road-to-token-economy-dispatch Phase 4.1).
 *
 * The judgment ladder's gap this closes: rung 0 routes mechanical slices to
 * deterministic scripts; rung 1 jumps straight to a full subagent spawn
 * whose measured median cold start is ~251k tokens (dispatch_floor,
 * 2026-08-10). A single bounded QUESTION — a classification, a small
 * verification, a one-file semantic lookup — needs neither a session nor
 * tools: one completion over the reconciled council transport chain
 * (cli → api → ∅) answers it at roughly two orders of magnitude below the
 * spawn floor.
 *
 * Hard caps, per the roadmap's anti-loop discipline (Risk 2 — "rung 0.5
 * becomes a hidden agent loop"):
 *   - ONE completion, plus at most ONE retry on the next route of the
 *     chooser's chain, gated by `MidFlightFallback`: only a failure that
 *     cannot have been generated and charged falls through (an empty free
 *     quota or an unservable model does; a server fault never does).
 *   - NO tool use, NO session, NO follow-up turn.
 *   - Honest ∅: council disabled / no member / transport failure → null
 *     (CLI exit 3), never a fabricated answer and never an escalation this
 *     module performs itself. Escalating to a spawn is the CALLER's
 *     decision and is recorded as such (`escalated` on the caller's line).
 *
 * Telemetry: every completed ask appends ONE orchestration_record line
 * (route_taken: "ask", spawn_count: 0, dispatch_tokens measured from the
 * provider response) — the substitution/adoption metrics registered in
 * `src/config/dispatch-economy-metrics.json` read these lines.
 *
 * Reuses, never re-implements: `council_cli.load_settings` +
 * `build_members` (member construction, auth, transport resolution,
 * cli-first billing classification — all unchanged), `CouncilResponse`
 * accounting, `_lib/orchestration_record` validation.
 *
 * Usage:
 *   ./scripts-run src/scripts/ask_transport "is X true in file Y?" \
 *     [--system "<system prompt>"] [--member <name>] [--format text|json] \
 *     [--content-class public-artifact|project-content] \
 *     [--kind classify|extract|summarise-given-text|draft-candidate|test-candidates|finding-proposal] \
 *     [--callee-file <path>]... [--no-record] [--dir <audit-dir>]
 *
 * `--kind` makes the call a typed hand: the system prompt is the kind's schema
 * and nothing else (so `--system` is refused beside it), and a return that does
 * not match the schema is a failed call (exit 3, logged), never a partial answer.
 * The question becomes the slice's specification; each `--callee-file` adds only
 * the signature of the function in it, and the project's own names, paths and
 * domains are replaced by placeholders before the call.
 * A typed hand reaches a free route only for a kind the shadow bars flipped
 * (`ai_council/kind_flip.ts`); until then the paid route serves it.
 * While it does, a `--content-class public-artifact` typed ask is also shadowed
 * on the first admissible free route (free-hands 6.2): both calls run at once,
 * the paid answer is returned unchanged, and the free one only becomes a row in
 * the shadow ledger (`ai_council/free_hand_shadow.ts`, capped at 2,000 rows).
 * `--no-record` turns the shadow off with the rest of the state writes.
 *
 * Exit codes: 0 answer produced · 2 usage error · 3 honest-∅ (no transport, or a
 * typed return that does not parse).
 */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import type { ExternalAIClient } from './ai_council/clients.js';
import { classifyContentClass, DEFAULT_CONTENT_CLASS, type ContentClass } from './ai_council/content_ceiling.js';
import { councilEgress, type CouncilEgress } from './ai_council/council_egress.js';
import { buildHandPayload, HandPayloadError, projectLinkingIdentifiers, type HandSlice } from './ai_council/hand_payload.js';
import { handSystemPrompt, parseHandReturn } from './ai_council/hand_schemas.js';
import { chooseRouteChain, routeCandidateFromMember } from './ai_council/route_chooser.js';
import {
    classifyRouteOutcome,
    isRouteModelLive,
    recordRouteOutcome,
    routeFailureClass,
} from './ai_council/route_liveness.js';
import { MidFlightFallback } from './ai_council/transport_resolver.js';
import { isKindFlipped } from './ai_council/kind_flip.js';
import { readShadowLedger, shadowAsk, SHADOW_CALL_CAP, type HeadVerify } from './ai_council/free_hand_shadow.js';
import {
    EXPOSURE_LEDGER_RELPATH,
    ExposureLedger,
    exposureShareFn,
    trackedFileCount,
    type Exposure,
} from './ai_council/exposure_ledger.js';
import { isHandKind, isUnpaid, type HandKind, type RouteBilling, type VerifyVerdict } from './_lib/hand_kinds.js';
import { buildOrchestrationLine } from './_lib/orchestration_record.js';
import { DEFAULT_DIR } from './orchestration_record.js';

/**
 * Placeholder written into `AskResult.model` when the member reported no id.
 * Named so the audit path can recognise and refuse it rather than passing a
 * sentinel off as a real model id.
 */
export const UNKNOWN_MODEL = 'unknown';

export interface AskResult {
    answer: string;
    member: string;
    /** The REQUESTED model id — what the member was configured to call. */
    model: string;
    /** The model the provider reported serving; `''` when it reports none. */
    model_served: string;
    input_tokens: number;
    output_tokens: number;
    latency_ms: number;
    /** The schema-valid value of a typed return; untrusted data until the head verifies it. */
    parsed?: unknown;
    /** Set on every typed return: data, never an instruction, and never acted on before the head's verify. */
    untrusted?: true;
    /** The audit work id; the head records its verdict under it with `orchestration_record --work-id`. */
    work_id?: string;
    /** How the route that answered is paid for. */
    route_billing?: RouteBilling;
}

export interface AskOptions {
    /** Injected members (tests). Default: council_cli.load_settings + build_members. */
    members?: ExternalAIClient[];
    /** Pick a specific member by provider/name; default: first configured. */
    member?: string;
    systemPrompt?: string;
    /** Telemetry append target; null disables recording (tests / --no-record). */
    auditDir?: string | null;
    /** Injected clock/id (tests). */
    now?: () => Date;
    id?: () => string;
    /** The class of the prompt; `project-content` unless the caller declares a repo-owned artefact. */
    contentClass?: ContentClass;
    /** A typed hand call: the kind's schema is the whole system prompt and the return must match it. */
    kind?: HandKind;
    /** What this call shows of the project, the ledger it is counted in, and the tracked-file denominator. */
    exposure?: { ledger: ExposureLedger; exposes: Exposure; trackedFiles: number | null };
    /**
     * Root of the gitignored route state (liveness). Default: the working
     * directory, or none when `auditDir` is null; null reads and writes nothing.
     */
    stateRoot?: string | null;
    /**
     * Whether a kind may use a free route. Default: the flip state under
     * `stateRoot`; no state, or no `stateRoot`, is not flipped.
     */
    flips?: (kind: HandKind) => boolean;
    /**
     * The verify recorded for both sides of a shadow call (free-hands 6.2).
     * Default: `skipped` — the head has not checked either return at call time.
     */
    shadowVerify?: HeadVerify;
    /** How long the paid answer waits for its shadow call; default `SHADOW_WAIT_MS`. */
    shadowWaitMs?: number;
}

/**
 * The longest a shadow call may hold the paid answer. Past it the paid answer
 * returns; the free call keeps running and its row lands only if it finishes,
 * so a call that never returns is not ledgered.
 */
export const SHADOW_WAIT_MS = 30_000;

/** The model a `base_url` route member calls; null for a provider member. */
function routeModel(member: ExternalAIClient): string | null {
    const m = member as unknown as Record<string, unknown>;
    if (!isUnpaid(routeCandidateFromMember(member).billing)) return null;
    return typeof m['base_url'] === 'string' && typeof m['model'] === 'string' && m['model'] !== '' ? m['model'] : null;
}

interface LineExtras {
    hand_kind?: HandKind;
    schema_valid?: boolean;
    route_billing?: RouteBilling;
    verified?: VerifyVerdict;
}

const DEFAULT_SYSTEM =
    'You are a single-completion answer service. Answer the question directly, ' +
    'concisely, and honestly. If the question cannot be answered without tools, ' +
    'files, or more context, reply exactly: INSUFFICIENT_CONTEXT — one line on ' +
    'what is missing. Never invent facts.';

/** Lazily import the council CLI surface so tests with injected members never load it. */
async function defaultMembers(contentClass: ContentClass): Promise<ExternalAIClient[]> {
    const mod = await import('./council_cli.js');
    const settings = mod.load_settings();
    return mod.build_members(settings, { content_class: contentClass });
}

function recordAskLine(
    auditDir: string,
    result: AskResult | null,
    member: string,
    ts: string,
    id: string,
    extras: LineExtras,
): void {
    const { line, errors } = buildOrchestrationLine({
        spawn_count: 0,
        token_delta: 0,
        token_delta_provenance: 'estimated',
        route_taken: 'ask',
        verify_mode: 'none',
        dispatch_outcome: result === null ? 'BLOCKED' : 'DONE',
        dispatch_tokens: result === null ? null : result.input_tokens + result.output_tokens,
        wall_clock_ms: result === null ? 0 : Math.max(0, Math.round(result.latency_ms)),
        agent_combo: [member || 'none'],
        // `AskResult.model` substitutes an `'unknown'` SENTINEL when the member
        // reported no id (below). That sentinel must never reach the audit line
        // as a model_requested: `modelDivergent` treats any non-empty string as
        // a real id, so it would fabricate a `true` on a line whose entire
        // purpose is making real substitutions credible. null keeps the
        // three-valued semantics — and the field's own "id only" contract.
        model_requested: result === null || result.model === UNKNOWN_MODEL ? null : result.model,
        model_served: result === null ? null : result.model_served,
        origin: 'dispatch-economy-2026',
        ...(extras.hand_kind !== undefined ? { hand_kind: extras.hand_kind } : {}),
        ...(extras.schema_valid !== undefined ? { schema_valid: extras.schema_valid } : {}),
        ...(extras.route_billing !== undefined ? { route_billing: extras.route_billing } : {}),
        ...(extras.verified !== undefined ? { verified: extras.verified } : {}),
        work_id: askWorkId(id),
        ts,
        id,
    });
    if (errors.length || line === null) return; // telemetry must never fail the ask
    try {
        const file = path.join(auditDir, `${ts.slice(0, 7)}.jsonl`);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.appendFileSync(file, `${JSON.stringify(line)}\n`, 'utf8');
    } catch {
        /* fail-open — accounting never blocks the answer */
    }
}

/**
 * One bounded ask. Returns the answer or `null` (honest ∅ — council
 * disabled, no member resolves, transport failure, or provider error).
 */
export async function askOnce(prompt: string, opts: AskOptions = {}): Promise<AskResult | null> {
    const trimmed = prompt.trim();
    if (!trimmed) return null;

    let members: ExternalAIClient[];
    try {
        members = opts.members ?? (await defaultMembers(opts.contentClass ?? DEFAULT_CONTENT_CLASS));
    } catch {
        return _finish(null, 'none', opts); // disabled / unreadable config → ∅
    }
    const stateRoot = opts.stateRoot !== undefined ? opts.stateRoot : opts.auditDir === null ? null : process.cwd();
    // `--member` narrows the candidates; it never bypasses the chooser's checks.
    const routed = members.map((m) => {
        const route = routeCandidateFromMember(m);
        const model = routeModel(m);
        const retired = stateRoot !== null && model !== null && !isRouteModelLive(stateRoot, route.name, model);
        return { member: m, route: retired ? { ...route, live: false } : route };
    });
    const pool = opts.member !== undefined ? routed.filter((r) => r.route.name === opts.member) : routed;
    const flipped = opts.flips ?? ((k: HandKind): boolean => stateRoot !== null && isKindFlipped(stateRoot, k));
    const { chain } = chooseRouteChain({
        kind: opts.kind ?? null,
        contentClass: opts.contentClass ?? DEFAULT_CONTENT_CLASS,
        ...(opts.kind !== undefined ? { unpaidAllowed: flipped(opts.kind) } : {}),
        candidates: pool.map((r) => r.route),
        ...(opts.exposure !== undefined
            ? { exposureShare: exposureShareFn(opts.exposure.ledger, opts.exposure.exposes, opts.exposure.trackedFiles) }
            : {}),
    });
    const system = opts.kind !== undefined ? handSystemPrompt(opts.kind) : (opts.systemPrompt ?? DEFAULT_SYSTEM);
    const shadowFree = _shadowCandidate(opts, stateRoot, pool, chain);
    // One retry down the chain, gated like the council's cli→api fallback: a
    // failure that may have been generated and charged never falls through.
    const ledger = new MidFlightFallback();
    let last: { provider: string; billing: RouteBilling } | null = null;
    let failures = 0;
    for (const route of chain) {
        const pick = pool.find((r) => r.route === route)?.member;
        if (pick === undefined) continue;
        const shadow = failures === 0 && shadowFree !== null && !isUnpaid(route.billing) ? shadowFree : null;
        const served = shadow === null ? pick : _teeMember(pick);
        const shadowRun = shadow === null ? null : _runShadow(trimmed, served, shadow, opts, stateRoot as string);
        const outcome = await _callRoute(served, route.name, system, trimmed, opts, stateRoot);
        if (shadowRun !== null) await _bounded(shadowRun, opts.shadowWaitMs ?? SHADOW_WAIT_MS);
        if (outcome.done) return _finish(outcome.result, route.name, opts, outcome.schemaValid, route.billing);
        last = { provider: route.name, billing: route.billing };
        if (++failures > 1) break;
        // An empty quota on a free route is that route's limit, not a cap the user set.
        const failure = routeFailureClass(classifyRouteOutcome(outcome.error));
        if (ledger.attempt(route.name, failure, { apiOnQuota: isUnpaid(route.billing) }) !== 'api') break;
    }
    return last === null ? _finish(null, opts.member ?? 'none', opts) : _finish(null, last.provider, opts, undefined, last.billing);
}

/** Fewer than `SHADOW_CALL_CAP` rows; past it nothing but the paid route is called. */
function _belowShadowCap(stateRoot: string): boolean {
    return readShadowLedger(stateRoot).length < SHADOW_CALL_CAP;
}

/**
 * The free route a typed `public-artifact` ask is shadowed on (free-hands 6.2):
 * the first unpaid route the chooser admits once the flip gate is set aside,
 * and only while the ask itself is served by a paid route. Null for anything
 * else — untyped, project content, no state root, a flipped kind, the cap.
 */
function _shadowCandidate(
    opts: AskOptions,
    stateRoot: string | null,
    pool: readonly { member: ExternalAIClient; route: ReturnType<typeof routeCandidateFromMember> }[],
    chain: readonly ReturnType<typeof routeCandidateFromMember>[],
): ExternalAIClient | null {
    if (opts.kind === undefined || stateRoot === null) return null;
    if ((opts.contentClass ?? DEFAULT_CONTENT_CLASS) !== 'public-artifact') return null;
    const first = chain[0];
    if (first === undefined || isUnpaid(first.billing)) return null;
    const { chain: open } = chooseRouteChain({
        kind: opts.kind,
        contentClass: 'public-artifact',
        unpaidAllowed: true,
        candidates: pool.map((r) => r.route),
        ...(opts.exposure !== undefined
            ? { exposureShare: exposureShareFn(opts.exposure.ledger, opts.exposure.exposes, opts.exposure.trackedFiles) }
            : {}),
    });
    const free = open.find((c) => isUnpaid(c.billing));
    if (free === undefined || !_belowShadowCap(stateRoot)) return null;
    return pool.find((r) => r.route === free)?.member ?? null;
}

/** Resolves when `run` settles or after `ms`, whichever comes first. */
async function _bounded(run: Promise<void>, ms: number): Promise<void> {
    let timer: NodeJS.Timeout | undefined;
    const wait = new Promise<void>((resolve) => {
        timer = setTimeout(resolve, ms);
        timer.unref();
    });
    try {
        await Promise.race([run, wait]);
    } finally {
        clearTimeout(timer);
    }
}

/**
 * The member with its first completion memoised, so the paid route is called once
 * for both the caller and the ledger. Sound only because both consumers send the
 * same `(handSystemPrompt(kind), prompt)` and neither retries on one member.
 */
function _teeMember(member: ExternalAIClient): ExternalAIClient {
    let first: ReturnType<ExternalAIClient['ask']> | undefined;
    const tee = Object.create(member) as ExternalAIClient;
    tee.ask = (...args: Parameters<ExternalAIClient['ask']>) => (first ??= member.ask(...args));
    return tee;
}

/** The member that records the exposure only when it is actually asked. */
function _exposingMember(member: ExternalAIClient, opts: AskOptions): ExternalAIClient {
    if (opts.exposure === undefined) return member;
    const { ledger, exposes } = opts.exposure;
    const route = routeCandidateFromMember(member).name;
    const wrapped = Object.create(member) as ExternalAIClient;
    wrapped.ask = (...args: Parameters<ExternalAIClient['ask']>) => {
        ledger.record(route, exposes);
        return member.ask(...args);
    };
    return wrapped;
}

/** The shadow call; its result is the ledger row only, and nothing it raises reaches the caller. */
async function _runShadow(
    prompt: string,
    paid: ExternalAIClient,
    free: ExternalAIClient,
    opts: AskOptions,
    stateRoot: string,
): Promise<void> {
    if (opts.kind === undefined) return;
    try {
        await shadowAsk(prompt, {
            kind: opts.kind,
            contentClass: 'public-artifact',
            paid,
            free: _exposingMember(free, opts),
            verify: opts.shadowVerify ?? ((): { verdict: VerifyVerdict; tokens: number } => ({ verdict: 'skipped', tokens: 0 })),
            stateRoot,
            ...(opts.now !== undefined ? { now: opts.now } : {}),
        });
    } catch {
        /* the shadow never fails the ask */
    }
}

type RouteCallOutcome =
    | { readonly done: true; readonly result: AskResult | null; readonly schemaValid: boolean | undefined }
    | { readonly done: false; readonly error: string };

/**
 * One completion on one route. `done: false` only for a transport failure the
 * route reported; an empty or unparseable answer was generated, so it ends the
 * ask rather than being paid for again elsewhere.
 */
async function _callRoute(
    pick: ExternalAIClient,
    provider: string,
    system: string,
    prompt: string,
    opts: AskOptions,
    stateRoot: string | null,
): Promise<RouteCallOutcome> {
    opts.exposure?.ledger.record(provider, opts.exposure.exposes);
    const model = routeModel(pick);
    try {
        const response = pick.ask(system, prompt);
        const r = response instanceof Promise ? await response : response;
        const error = r === null || r === undefined ? 'no response' : r.error;
        if (stateRoot !== null && model !== null) recordRouteOutcome(stateRoot, provider, model, classifyRouteOutcome(error));
        if (r === null || r === undefined) return { done: true, result: null, schemaValid: undefined };
        if (error !== null && error !== undefined && error !== '') return { done: false, error };
        const text = (r.text ?? '').trim();
        if (!text) return { done: true, result: null, schemaValid: undefined };
        let parsed: unknown;
        if (opts.kind !== undefined) {
            const p = parseHandReturn(opts.kind, text);
            if (!p.ok) return { done: true, result: null, schemaValid: false };
            parsed = p.value;
        }
        return {
            done: true,
            schemaValid: opts.kind !== undefined ? true : undefined,
            result: {
                answer: text,
                member: provider,
                model: r.model ?? UNKNOWN_MODEL,
                model_served: r.model_served ?? '',
                input_tokens: r.input_tokens ?? 0,
                output_tokens: r.output_tokens ?? 0,
                latency_ms: r.latency_ms ?? 0,
                ...(opts.kind !== undefined ? { parsed, untrusted: true as const } : {}),
            },
        };
    } catch {
        return { done: true, result: null, schemaValid: undefined }; // a thrown call is never retried
    }
}

function askWorkId(id: string): string {
    return `ask-${id}`;
}

/**
 * A typed return is recorded `skipped` until the head records its own verdict
 * under the same work id; one that never parsed has already failed the check.
 */
function _finish(
    result: AskResult | null,
    member: string,
    opts: AskOptions,
    schemaValid?: boolean,
    billing?: RouteBilling,
): AskResult | null {
    const id = opts.id ? opts.id() : crypto.randomUUID();
    const auditDir = opts.auditDir === undefined ? path.join(process.cwd(), DEFAULT_DIR) : opts.auditDir;
    if (auditDir !== null) {
        const ts = (opts.now ? opts.now() : new Date()).toISOString();
        const verified: VerifyVerdict | undefined =
            opts.kind === undefined || billing === undefined ? undefined : schemaValid === true ? 'skipped' : 'fail';
        recordAskLine(auditDir, result, member, ts, id, {
            ...(opts.kind !== undefined ? { hand_kind: opts.kind } : {}),
            ...(schemaValid !== undefined ? { schema_valid: schemaValid } : {}),
            ...(billing !== undefined ? { route_billing: billing } : {}),
            ...(verified !== undefined ? { verified } : {}),
        });
    }
    return result === null
        ? null
        : { ...result, work_id: askWorkId(id), ...(billing !== undefined ? { route_billing: billing } : {}) };
}

export interface AskHandOptions extends Omit<AskOptions, 'kind' | 'systemPrompt'> {
    /** The run's placeholder scope; default: the council egress state. */
    egress?: CouncilEgress;
}

/**
 * A typed hand call over a slice: the payload is built from the specification
 * and callee signatures only, with linking identifiers replaced, and the system
 * prompt is the kind's schema.
 */
export async function askHand(slice: HandSlice, opts: AskHandOptions = {}): Promise<AskResult | null> {
    const { egress, ...rest } = opts;
    const payload = buildHandPayload(slice, egress ?? councilEgress());
    return askOnce(payload.user, { ...rest, kind: slice.kind });
}

/** The declared name of a callee, for the ledger's symbol count. */
function calleeName(source: string): string[] {
    const m = /\b(?:function|def|class)\s+([A-Za-z_$][\w$]*)|\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/.exec(source);
    const name = m?.[1] ?? m?.[2];
    return name === undefined ? [] : [name];
}

/** Test seam: inject members instead of reading the council configuration. */
export interface MainDeps {
    members?: ExternalAIClient[];
}

export async function main(argv: readonly string[], deps: MainDeps = {}): Promise<number> {
    let prompt = '';
    let system: string | undefined;
    let member: string | undefined;
    let format: 'text' | 'json' = 'text';
    let record = true;
    let dir: string | undefined;
    let contentClass: ContentClass = DEFAULT_CONTENT_CLASS;
    let kindRaw: string | undefined;
    const calleeFiles: string[] = [];
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i] ?? '';
        if (a === '--system') system = argv[++i];
        else if (a === '--member') member = argv[++i];
        else if (a === '--format') format = argv[++i] === 'json' ? 'json' : 'text';
        else if (a === '--no-record') record = false;
        else if (a === '--dir') dir = argv[++i];
        else if (a === '--content-class') contentClass = classifyContentClass(argv[++i]);
        else if (a === '--kind') kindRaw = argv[++i] ?? '';
        else if (a === '--callee-file') calleeFiles.push(argv[++i] ?? '');
        else if (!a.startsWith('--')) prompt = prompt ? `${prompt} ${a}` : a;
    }
    if (!prompt.trim()) {
        process.stderr.write('ask_transport: a question argument is required\n');
        return 2;
    }
    if (kindRaw !== undefined && !isHandKind(kindRaw)) {
        process.stderr.write(`ask_transport: --kind must be one of the hand kinds; '${kindRaw}' is not one (head-only work never reaches a hand)\n`);
        return 2;
    }
    if (kindRaw !== undefined && system !== undefined) {
        process.stderr.write('ask_transport: --system cannot be combined with --kind; a hand sees only its kind schema\n');
        return 2;
    }
    if (calleeFiles.length > 0 && kindRaw === undefined) {
        process.stderr.write('ask_transport: --callee-file needs --kind; only a typed hand gets a slice\n');
        return 2;
    }
    const opts: AskOptions = {
        ...(system !== undefined ? { systemPrompt: system } : {}),
        ...(member !== undefined ? { member } : {}),
        auditDir: record ? (dir ?? path.join(process.cwd(), DEFAULT_DIR)) : null,
        contentClass,
        ...(kindRaw !== undefined && isHandKind(kindRaw) ? { kind: kindRaw } : {}),
        ...(deps.members !== undefined ? { members: deps.members } : {}),
    };
    let result: AskResult | null;
    if (opts.kind !== undefined) {
        let callees: string[];
        try {
            callees = calleeFiles.map((f) => fs.readFileSync(f, 'utf8'));
        } catch {
            process.stderr.write('ask_transport: a --callee-file could not be read\n');
            return 2;
        }
        const { kind, systemPrompt: _unused, ...rest } = opts;
        const root = process.cwd();
        const exposes: Exposure = {
            files: calleeFiles.map((f) => path.relative(root, path.resolve(f))),
            symbols: callees.flatMap((c) => calleeName(c)),
        };
        try {
            result = await askHand(
                { kind, spec: prompt, callees, linking: projectLinkingIdentifiers(root) },
                {
                    ...rest,
                    exposure: {
                        ledger: ExposureLedger.load(path.join(root, EXPOSURE_LEDGER_RELPATH)),
                        exposes,
                        trackedFiles: trackedFileCount(root),
                    },
                },
            );
        } catch (e) {
            if (!(e instanceof HandPayloadError)) throw e;
            process.stderr.write(`ask_transport: ${e.message}\n`);
            return 2;
        }
    } else {
        result = await askOnce(prompt, opts);
    }
    if (result === null) {
        process.stderr.write(
            'ask_transport: ∅ — no transport resolved, the single completion failed, or a typed return did not match its schema (no retry by design)\n',
        );
        return 3;
    }
    process.stdout.write(
        format === 'json' ? JSON.stringify(result, null, 2) + '\n' : result.answer + '\n',
    );
    if (result.untrusted === true) {
        process.stderr.write(
            'ask_transport: the return above is untrusted data — verify it before acting on it, then record the verdict: ' +
                `./scripts-run src/scripts/orchestration_record --work-id ${result.work_id ?? ''} --route-taken ask ` +
                `--spawn-count 0 --token-delta 0 --phase verify --route-billing ${result.route_billing ?? ''} ` +
                '--verified pass|fail --verify-tokens <n>\n',
        );
    }
    return 0;
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
if (_isCliEntry()) {
    main(process.argv.slice(2)).then((rc) => process.exit(rc));
}
