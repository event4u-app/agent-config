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
 *     [--no-record] [--dir <audit-dir>]
 *
 * Exit codes: 0 answer produced · 2 usage error · 3 honest-∅ (no transport).
 */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import type { ExternalAIClient } from './ai_council/clients.js';
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
}

const DEFAULT_SYSTEM =
    'You are a single-completion answer service. Answer the question directly, ' +
    'concisely, and honestly. If the question cannot be answered without tools, ' +
    'files, or more context, reply exactly: INSUFFICIENT_CONTEXT — one line on ' +
    'what is missing. Never invent facts.';

/** Lazily import the council CLI surface so tests with injected members never load it. */
async function defaultMembers(): Promise<ExternalAIClient[]> {
    const mod = await import('./council_cli.js');
    const settings = mod.load_settings();
    return mod.build_members(settings);
}

function recordAskLine(auditDir: string, result: AskResult | null, member: string, ts: string, id: string): void {
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
        members = opts.members ?? (await defaultMembers());
    } catch {
        return _finish(null, 'none', opts); // disabled / unreadable config → ∅
    }
    const memberName = (m: ExternalAIClient): string => {
        const c = m as { name?: string; provider?: string };
        return c.name || c.provider || 'unknown';
    };
    const pick =
        opts.member !== undefined ? members.find((m) => memberName(m) === opts.member) : members[0];
    if (pick === undefined) {
        return _finish(null, opts.member ?? 'none', opts);
    }
    const provider = memberName(pick);

    try {
        const response = pick.ask(opts.systemPrompt ?? DEFAULT_SYSTEM, trimmed);
        const r = response instanceof Promise ? await response : response;
        if (r === null || r === undefined || (r.error !== null && r.error !== undefined && r.error !== '')) {
            return _finish(null, provider, opts);
        }
        const text = (r.text ?? '').trim();
        if (!text) return _finish(null, provider, opts);
        return _finish(
            {
                answer: text,
                member: provider,
                model: r.model ?? UNKNOWN_MODEL,
                model_served: r.model_served ?? '',
                input_tokens: r.input_tokens ?? 0,
                output_tokens: r.output_tokens ?? 0,
                latency_ms: r.latency_ms ?? 0,
            },
            provider,
            opts,
        );
    } catch {
        return _finish(null, provider, opts); // ONE completion — no retry here
    }
}

function _finish(result: AskResult | null, member: string, opts: AskOptions): AskResult | null {
    const auditDir = opts.auditDir === undefined ? path.join(process.cwd(), DEFAULT_DIR) : opts.auditDir;
    if (auditDir !== null) {
        const ts = (opts.now ? opts.now() : new Date()).toISOString();
        const id = opts.id ? opts.id() : crypto.randomUUID();
        recordAskLine(auditDir, result, member, ts, id);
    }
    return result;
}

export async function main(argv: readonly string[]): Promise<number> {
    let prompt = '';
    let system: string | undefined;
    let member: string | undefined;
    let format: 'text' | 'json' = 'text';
    let record = true;
    let dir: string | undefined;
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i] ?? '';
        if (a === '--system') system = argv[++i];
        else if (a === '--member') member = argv[++i];
        else if (a === '--format') format = argv[++i] === 'json' ? 'json' : 'text';
        else if (a === '--no-record') record = false;
        else if (a === '--dir') dir = argv[++i];
        else if (!a.startsWith('--')) prompt = prompt ? `${prompt} ${a}` : a;
    }
    if (!prompt.trim()) {
        process.stderr.write('ask_transport: a question argument is required\n');
        return 2;
    }
    const opts: AskOptions = {
        ...(system !== undefined ? { systemPrompt: system } : {}),
        ...(member !== undefined ? { member } : {}),
        auditDir: record ? (dir ?? path.join(process.cwd(), DEFAULT_DIR)) : null,
    };
    const result = await askOnce(prompt, opts);
    if (result === null) {
        process.stderr.write('ask_transport: ∅ — no transport resolved or the single completion failed (no retry by design)\n');
        return 3;
    }
    process.stdout.write(
        format === 'json' ? JSON.stringify(result, null, 2) + '\n' : result.answer + '\n',
    );
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
