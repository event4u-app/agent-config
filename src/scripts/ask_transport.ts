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
 *   - ONE completion. No retry beyond the transport chain's own cli→api
 *     fallback semantics inside the client.
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
 *     [--no-record] [--dir <audit-dir>]
 *
 * `--kind` makes the call a typed hand: the system prompt is the kind's schema
 * and nothing else (so `--system` is refused beside it), and a return that does
 * not match the schema is a failed call (exit 3, logged), never a partial answer.
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
import { handSystemPrompt, parseHandReturn } from './ai_council/hand_schemas.js';
import { chooseRoute, routeCandidateFromMember } from './ai_council/route_chooser.js';
import { isHandKind, type HandKind, type RouteBilling, type VerifyVerdict } from './_lib/hand_kinds.js';
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
    // `--member` narrows the candidates; it never bypasses the chooser's checks.
    const routed = members.map((m) => ({ member: m, route: routeCandidateFromMember(m) }));
    const pool = opts.member !== undefined ? routed.filter((r) => r.route.name === opts.member) : routed;
    const choice = chooseRoute({
        kind: opts.kind ?? null,
        contentClass: opts.contentClass ?? DEFAULT_CONTENT_CLASS,
        candidates: pool.map((r) => r.route),
    });
    const pick = choice.route === null ? undefined : pool.find((r) => r.route === choice.route)?.member;
    if (pick === undefined) {
        return _finish(null, opts.member ?? 'none', opts);
    }
    const provider = choice.route!.name;
    const billing = choice.route!.billing;

    const system = opts.kind !== undefined ? handSystemPrompt(opts.kind) : (opts.systemPrompt ?? DEFAULT_SYSTEM);
    try {
        const response = pick.ask(system, trimmed);
        const r = response instanceof Promise ? await response : response;
        if (r === null || r === undefined || (r.error !== null && r.error !== undefined && r.error !== '')) {
            return _finish(null, provider, opts, undefined, billing);
        }
        const text = (r.text ?? '').trim();
        if (!text) return _finish(null, provider, opts, undefined, billing);
        let parsed: unknown;
        if (opts.kind !== undefined) {
            const p = parseHandReturn(opts.kind, text);
            if (!p.ok) return _finish(null, provider, opts, false, billing);
            parsed = p.value;
        }
        return _finish(
            {
                answer: text,
                member: provider,
                model: r.model ?? UNKNOWN_MODEL,
                model_served: r.model_served ?? '',
                input_tokens: r.input_tokens ?? 0,
                output_tokens: r.output_tokens ?? 0,
                latency_ms: r.latency_ms ?? 0,
                ...(opts.kind !== undefined ? { parsed, untrusted: true as const } : {}),
            },
            provider,
            opts,
            opts.kind !== undefined ? true : undefined,
            billing,
        );
    } catch {
        return _finish(null, provider, opts, undefined, billing); // ONE completion — no retry here
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
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i] ?? '';
        if (a === '--system') system = argv[++i];
        else if (a === '--member') member = argv[++i];
        else if (a === '--format') format = argv[++i] === 'json' ? 'json' : 'text';
        else if (a === '--no-record') record = false;
        else if (a === '--dir') dir = argv[++i];
        else if (a === '--content-class') contentClass = classifyContentClass(argv[++i]);
        else if (a === '--kind') kindRaw = argv[++i] ?? '';
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
    const opts: AskOptions = {
        ...(system !== undefined ? { systemPrompt: system } : {}),
        ...(member !== undefined ? { member } : {}),
        auditDir: record ? (dir ?? path.join(process.cwd(), DEFAULT_DIR)) : null,
        contentClass,
        ...(kindRaw !== undefined && isHandKind(kindRaw) ? { kind: kindRaw } : {}),
        ...(deps.members !== undefined ? { members: deps.members } : {}),
    };
    const result = await askOnce(prompt, opts);
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
