#!/usr/bin/env tsx
/**
 * Rule-inject — the delivery twin of `skill-route`, with the opposite payload
 * policy (`road-to-trigger-delivered-rule-bodies` Phase 1).
 *
 * BODIES, NEVER POINTERS — and the difference from its twin is deliberate
 * rather than incidental. `skill_route_hook.ts:14` ships "POINTERS, NEVER
 * BODIES" on this same slot, and it is right to: a skill is a thing the agent
 * *invokes*, so naming it is enough. A rule is a thing the agent must already
 * be *under*, and the only datum anyone has on pointer-shaped rule delivery is
 * the 36.2 %-against-48 % run at `docs/CLAIMS.md:188-189`. Whatever that
 * instrument's flaws — and ADR-202 closed it — it points one way.
 *
 * DEFAULT OFF, AND OFF MEANS ZERO BYTES. The concern registers on two slots but
 * returns before reading the router unless `lean_projection.mode: delivery` is
 * set. Under every shipped default it emits nothing, costs no injection budget,
 * and leaves the standing corpus exactly as it is today. That is why its
 * `hook-token-budget.json` row is registered against the per-prompt cap rather
 * than a measured emission: there is no measured emission to register yet.
 *
 * ONE MATCHER, SHARED WITH THE OFFLINE MODEL. Everything about selection,
 * ordering, capping and body loading comes from `_lib/rule_injection.ts`, which
 * `model_rule_injection.ts` also imports. Step 0.5 states the reason in as many
 * words: an experiment whose offline pricing and runtime delivery use different
 * matchers measures nothing.
 *
 * ONCE PER SESSION PER RULE, RE-ARMED ON COMPACTION. A rule's body is injected
 * the first time one of its triggers fires and not again, because the model
 * already has it. Compaction is exactly the event that makes that false, so
 * `pre_compact` clears the seen-set — the same pin-lost shape `language-mirror`
 * uses. State lives under `agents/runtime/state/`, the class
 * `context-hygiene.json` already occupies; no new state convention is created.
 *
 * NEVER BLOCKS. Every failure path returns 0: unreadable stdin, malformed JSON,
 * missing router, unreadable body, unwritable state. The one non-zero exit is
 * the host's advisory context channel (exit 2 + `decision: "warn"`), the same
 * channel `ui-route-nudge` and `code-graph-nudge` already use on `pre_tool_use`
 * with `severity: advisory` — a warn there is an injection, not a deny.
 *
 * HOST BOUNDARY, STATED RATHER THAN IMPLIED. `user_prompt_submit` and
 * `pre_tool_use` are bound on a subset of hosts, and only `claude` honours a
 * deny at all. On a host where neither slot is bound this concern cannot run,
 * which is the whole reason the flip step 2.4 gates on is Claude-only. Run
 * `agent-config hooks:status` for the host you are actually on.
 *
 * SUBAGENTS ARE OUT OF REACH, MEASURED. Neither slot fires inside a spawned
 * child session and the `subagent_start` payload carries no prompt field — see
 * `agents/evidence/investigations/subagent-start-payload-probe.md` (2026-08-23,
 * claude 2.1.241, three verdicts). Delivery is therefore orchestrator-only, and
 * no third binding is added.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { hookSectionEnabled, leanProjectionModeRaw } from '../_lib/hook_settings.js';
import { deliversBodies, normalizeLeanProjectionMode } from '../_lib/lean_projection_mode.js';
import {
    loadRuleBody,
    loadRouter,
    matchTierRules,
    selectForInjection,
} from '../_lib/rule_injection.js';
import { readHookStdin } from './hook_stdin.js';

const EXIT_ALLOW = 0;
const EXIT_WARN = 2;

/**
 * Per-prompt injection ceiling, in exact-BPE tokens.
 *
 * DERIVED, NOT PICKED: `model_rule_injection --corpus tests/eval/routing-matrix`
 * measured the matched-body-token distribution over the frozen labelled corpus
 * at p50 1,728 / p90 4,804 / p99 8,248 / max 12,957, and step 1.1 specifies
 * "the p90 from 0.4, rounded to 500". 4,804 rounds up to 5,000. Re-run that
 * command if the corpus or the bodies move; a cap copied from a stale
 * measurement is worse than no cap, because it looks derived.
 */
export const CAP_TOKENS = 5000;

/** Tools whose input names a file this concern can match path triggers against. */
export const FILE_TOOLS = new Set(['Write', 'Edit', 'NotebookEdit', 'Read', 'MultiEdit']);

type JsonObject = Record<string, unknown>;

function isObject(v: unknown): v is JsonObject {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function str(o: JsonObject, ...keys: string[]): string | null {
    for (const k of keys) {
        const v = o[k];
        if (typeof v === 'string' && v !== '') return v;
    }
    return null;
}

/** Workspace root the envelope points at, falling back to the process cwd. */
export function workspaceRoot(env: JsonObject): string {
    return str(env, 'workspace', 'cwd', 'project_dir') ?? process.cwd();
}

// ── seen-set state ───────────────────────────────────────────────────────

export interface SeenState {
    rules: string[];
}

export function statePath(root: string, session: string): string {
    const safe = session.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80) || 'unknown';
    return path.join(root, 'agents', 'runtime', 'state', 'rule-inject', `${safe}.json`);
}

export function readSeen(root: string, session: string): Set<string> {
    try {
        const raw = fs.readFileSync(statePath(root, session), 'utf-8');
        const parsed = JSON.parse(raw) as SeenState;
        return new Set(Array.isArray(parsed.rules) ? parsed.rules.map(String) : []);
    } catch {
        return new Set(); // fresh session, or a file nothing can parse
    }
}

export function writeSeen(root: string, session: string, seen: Set<string>): void {
    const p = statePath(root, session);
    try {
        fs.mkdirSync(path.dirname(p), { recursive: true });
        const payload: SeenState = { rules: [...seen].sort() };
        fs.writeFileSync(`${p}.tmp`, `${JSON.stringify(payload)}\n`, 'utf-8');
        fs.renameSync(`${p}.tmp`, p);
    } catch {
        /* unwritable state must never fail a turn — worst case a re-injection */
    }
}

export function clearSeen(root: string, session: string): void {
    try {
        fs.rmSync(statePath(root, session), { force: true });
    } catch {
        /* ignore */
    }
}

// ── payload extraction ───────────────────────────────────────────────────

/** The user's prompt, across the shapes the hosts use. */
export function extractPrompt(payload: JsonObject): string {
    return str(payload, 'prompt', 'user_prompt', 'userPrompt', 'message', 'text') ?? '';
}

/** The file path a file-touching tool call names, or `null`. */
export function extractFilePath(payload: JsonObject): string | null {
    const ti = payload['tool_input'] ?? payload['toolInput'] ?? payload['input'];
    if (!isObject(ti)) return null;
    return str(ti, 'file_path', 'path', 'filePath', 'notebook_path');
}

// ── decision ─────────────────────────────────────────────────────────────

export interface Injection {
    rules: string[];
    tokens: number;
    body: string;
}

/**
 * Build the injection for one event, or `null` for silence.
 *
 * `prompt` drives keyword / phrase / command triggers; `openFiles` drives
 * `path_prefix` / `file_pattern`. On the tool slot the prompt is deliberately
 * empty, so a file event can only ever fire a path trigger — a tool call is not
 * a restatement of the user's request and must not re-fire keyword rules.
 */
export function buildInjection(
    root: string,
    prompt: string,
    openFiles: string[] | null,
    command: string | null,
    seen: Set<string>,
): Injection | null {
    let router;
    try {
        router = loadRouter(root);
    } catch {
        return null; // no router — nothing to deliver, and never a failure
    }
    const matches = matchTierRules(router, prompt, openFiles, command).filter(
        (m) => !seen.has(m.id),
    );
    if (matches.length === 0) return null;
    const sel = selectForInjection(root, matches, CAP_TOKENS);
    const parts: string[] = [];
    const ids: string[] = [];
    for (const m of sel.selected) {
        const body = loadRuleBody(root, m.id);
        if (body === null) continue;
        ids.push(m.id);
        parts.push(`<rule id="${m.id}" tier="${m.tier}">\n${body.trim()}\n</rule>`);
    }
    if (ids.length === 0) return null;
    return { rules: ids, tokens: sel.tokens, body: parts.join('\n\n') };
}

// ── main ─────────────────────────────────────────────────────────────────

/**
 * Whether the settings gate applies.
 *
 * Through the dispatcher the gate is absolute: no `lean_projection.mode:
 * delivery`, no bytes. A DIRECT CLI invocation is a probe by definition — an
 * operator piping an envelope into this file is asking to see what it would
 * deliver — so there the mode defaults to on. `AGENT_CONFIG_REPLAY` re-imposes
 * the gate, which is what keeps `bench_hook_injection` measuring the shipped
 * default (zero bytes) rather than the probe.
 */
export function gateOpen(root: string, cliEntry: boolean): boolean {
    if (deliversBodies(normalizeLeanProjectionMode(leanProjectionModeRaw(root)))) return true;
    if (hookSectionEnabled(root, 'rule_inject')) return true;
    return cliEntry && process.env['AGENT_CONFIG_REPLAY'] !== '1';
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    let eventOverride: string | null = null;
    for (let i = 0; i < argv.length; i += 1) {
        if (argv[i] === '--event') {
            i += 1;
            eventOverride = argv[i] ?? null;
        }
    }

    let env: JsonObject = {};
    try {
        const raw = readHookStdin();
        const parsed = raw.trim() ? (JSON.parse(raw) as unknown) : {};
        env = isObject(parsed) ? parsed : {};
    } catch {
        return EXIT_ALLOW; // malformed envelope — never block
    }

    const root = workspaceRoot(env);
    const payload = isObject(env['payload']) ? (env['payload'] as JsonObject) : env;
    const slot = eventOverride ?? str(env, 'event') ?? 'user_prompt_submit';
    const session = str(env, 'session_id', 'sessionId') ?? str(payload, 'session_id', 'sessionId') ?? 'unknown';

    if (slot === 'pre_compact') {
        clearSeen(root, session);
        return EXIT_ALLOW; // re-arm is silent; the next turn re-injects
    }
    if (slot !== 'user_prompt_submit' && slot !== 'pre_tool_use') return EXIT_ALLOW;
    if (!gateOpen(root, _isCliEntry())) return EXIT_ALLOW;

    let prompt = '';
    let openFiles: string[] | null = null;
    let command: string | null = null;
    if (slot === 'user_prompt_submit') {
        prompt = extractPrompt(payload);
        if (prompt === '') return EXIT_ALLOW;
        const m = /^\s*(\/[A-Za-z0-9:_-]+)/.exec(prompt);
        command = m ? (m[1] as string) : null;
    } else {
        const tool = str(payload, 'tool_name', 'toolName', 'tool');
        if (tool === null || !FILE_TOOLS.has(tool)) return EXIT_ALLOW;
        const fp = extractFilePath(payload);
        if (fp === null) return EXIT_ALLOW;
        openFiles = [fp];
    }

    const seen = readSeen(root, session);
    const injection = buildInjection(root, prompt, openFiles, command, seen);
    if (injection === null) return EXIT_ALLOW; // silence is the default

    for (const id of injection.rules) seen.add(id);
    writeSeen(root, session, seen);

    process.stdout.write(
        `${JSON.stringify({
            decision: 'warn',
            reason: `rule-inject: ${injection.rules.length} rule body/bodies on ${slot} (${injection.tokens} tok)`,
            additional_context: injection.body,
        })}\n`,
    );
    return EXIT_WARN;
}

// Bundle-safety: never auto-run when inlined into an esbuild bundle, where
// every module shares the bundle's `import.meta.url`.
declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
function _isCliEntry(): boolean {
    if (typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__) return false;
    if (process.argv[1] === undefined) return false;
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) return true;
    try {
        return (
            fs.realpathSync(fileURLToPath(import.meta.url)) ===
            fs.realpathSync(path.resolve(process.argv[1]))
        );
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exit(main());
}
