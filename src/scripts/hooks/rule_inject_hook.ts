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
 * SHIPPED ON FOR CLAUDE CODE SINCE ADR-265 — corrected 2026-09-08 (R2 finding
 * 4), because this paragraph read "DEFAULT OFF, AND OFF MEANS ZERO BYTES …
 * under every shipped default it emits nothing … there is no measured emission
 * to register yet" and all four clauses became false in the same change that
 * edited the paragraph below it. The shipped template carries
 * `lean_projection.mode: delivery` with `hosts: [claude-code]`
 * (`src/config/agent-settings.template.yml`), `gateOpen` returns true on that
 * pair, and the emission IS measured: p50 6,674 B, p90 16,188 B, max 20,406 B
 * over 318 gate-open fires on the frozen corpus, which is the distribution the
 * `user_prompt_submit` slot raise in `src/config/hook-token-budget.json` is
 * derived from.
 *
 * OFF STILL MEANS ZERO BYTES, and that half is unchanged: the concern returns
 * before reading the router unless the resolved (mode, hosts) pair actually
 * thins THIS host — see `gateOpen`, which checks both, because the projector
 * does. On any other host, and on a `lean_projection.mode: eager-all` rollback,
 * it emits nothing.
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
 * WHAT IS RE-DELIVERED AFTER A COMPACTION, EXACTLY
 * (road-to-delivery-for-every-host 2.4 — stated because a rule lost at a
 * compaction boundary is lost for the rest of the session, and "re-armed" alone
 * does not say what a reader may rely on):
 *
 *   · `pre_compact` clears the WHOLE seen-set for that session, not the rules
 *     matched on the compacted turn. There is no per-rule bookkeeping to be
 *     partially wrong about.
 *   · Nothing is delivered BY the compaction itself. The slot emits zero bytes
 *     and exits allow; re-arming is silent.
 *   · A rule's body returns on the NEXT turn whose trigger matches it — which
 *     means a rule whose trigger does not fire again is NOT restored. Delivery
 *     is trigger-driven on both sides of the boundary; compaction resets the
 *     de-duplication, it does not replay a transcript.
 *   · The seen-set is per session, so a compaction in one session re-arms only
 *     that session.
 *
 * Held by three fixtures in `tests/scripts/rule_inject_hook.test.ts` under
 * "once per session per rule, re-armed on compaction": the dedup case, the
 * matched-rule → compaction → matching-turn → body-present case, and the
 * per-session case. All three predate this roadmap; 2.4 adds the contract
 * above, not the coverage, and says so rather than claiming new tests.
 *
 * NEVER BLOCKS. Every failure path returns 0: unreadable stdin, malformed JSON,
 * missing router, unreadable body, unwritable state. The one non-zero exit is
 * the host's advisory context channel (exit 2 + `decision: "warn"`), the same
 * channel `ui-route-nudge` and `code-graph-context` already use on `pre_tool_use`
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

import { hookSectionEnabled, leanProjectionHostsRaw, leanProjectionModeRaw } from '../_lib/hook_settings.js';
import {
    deliversBodies,
    normalizeLeanProjectionMode,
    resolveLeanProjectionHosts,
} from '../_lib/lean_projection_mode.js';
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
 * Per-prompt injection ceiling, in UTF-8 BYTES.
 *
 * DERIVED, NOT PICKED: `model_rule_injection --corpus tests/eval/routing-matrix`
 * measured the matched-body-token distribution over the frozen labelled corpus
 * at p50 1,728 / p90 4,804 / p99 8,248 / max 12,957 exact-BPE tokens, and step
 * 1.1 specifies "the p90 from 0.4, rounded to 500" — 4,804 rounds up to 5,000.
 *
 * BYTES rather than tokens, and the unit change is the point rather than a
 * detail. `_lib/token_count.ts` resolves `js-tiktoken` at module load, so a
 * token-capped concern drags a tokenizer into EVERY hook dispatch on every
 * slot, for a concern that is default-OFF and emits nothing. Measured: 202 ms
 * -> 196 ms on the `pre_tool_use` p95 when the concern is unbound entirely, and
 * the CI latency gate went red on the branch that introduced it while passing
 * on main. So the runtime cap is stated in the unit
 * `hook-token-budget.json` already enforces — 5,000 tok at the ~4 bytes/token
 * this corpus measures was 20,480 B, and that WAS this concern's registered
 * row until 2026-09-08. It matched the concern row and not the slot row; see
 * the correction below.
 *
 * LOWERED 20480 -> 16384 on 2026-09-08 (R2 finding 3), and the paragraphs above
 * are kept because they record how the retired number was derived. The defect
 * was that the derivation above and the one behind the
 * `user_prompt_submit` slot row were TWO STATISTICS IN TWO UNITS: this cap was
 * the p90 of the matched-body TOKEN distribution, converted at ~4 B/tok; the
 * slot row is the p90 gate-open FIRE SIZE in bytes, which is the activation
 * charge owner ruling E2 specifies. They disagreed by 25 %, in the direction
 * that licensed ONE concern to emit more than the whole slot — carrying 12
 * other concerns — is registered for. Reconciled downward onto the slot row,
 * because that is the owner-specified charge; the cost is measured and recorded
 * in `hook-token-budget.json`'s own `rule-inject_reason` (33 -> 45 fires
 * truncated, 63 -> 88 bodies withheld over 330 corpus fires).
 *
 * WHAT THIS CAP DOES, precisely: `selectForInjection` drops whole bodies to
 * stay under it, so a fire is TRUNCATED and never over-emitted. It is the only
 * number that acts on a single fire — the per-slot sums are an authoring-time
 * control read by `bench_hook_injection`, and the runtime dispatcher enforces
 * only `per_turn_aggregate_bytes.ceiling_bytes`.
 *
 * Re-run that command if the corpus or the bodies move; a cap copied from a
 * stale measurement is worse than no cap, because it looks derived. The
 * tripwire in `tests/scripts/rule_inject_hook.test.ts` holds this equal to the
 * registered concern row and at or below the slot sum, so the two units cannot
 * drift apart again unnoticed.
 */
export const CAP_BYTES = 16384;

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
    bytes: number;
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
    const sel = selectForInjection(root, matches, CAP_BYTES);
    const parts: string[] = [];
    const ids: string[] = [];
    for (const m of sel.selected) {
        const body = loadRuleBody(root, m.id);
        if (body === null) continue;
        ids.push(m.id);
        parts.push(`<rule id="${m.id}" tier="${m.tier}">\n${body.trim()}\n</rule>`);
    }
    if (ids.length === 0) return null;
    return { rules: ids, bytes: sel.bytes, body: parts.join('\n\n') };
}

// ── main ─────────────────────────────────────────────────────────────────

/**
 * The one host this concern is bound on.
 *
 * The manifest binds `rule-inject` under `claude` alone, so the host axis
 * `gateOpen` has to consult is a constant here rather than something read off
 * the envelope — the envelope carries no host id, and inventing one from the
 * process environment would be a guess where the manifest is a fact.
 */
export const DELIVERY_HOST = 'claude-code';

/**
 * Whether the settings gate applies.
 *
 * BOTH AXES, because the projector reads both. Until 2026-09-08 this keyed on
 * `lean_projection.mode` alone while `condense` gates stub-writing on
 * `thinsHost(mode, hosts, host)` (R2 finding 5). The two disagreed in exactly
 * the states the host axis exists for: `mode: delivery` with a `hosts:` list
 * that does not resolve to `claude-code` — the documented "thin no host"
 * state, which a fully typo'd list also produces — left this host with a
 * FULL-BODIED tree while the hook kept injecting on a match, so every matched
 * rule was delivered twice. `hosts: [cursor]` was the same defect with a
 * second half: cursor received stubs with no bound slot to deliver them back.
 *
 * `deliversBodies` is checked separately from the host list rather than via
 * `thinsHost`, which is true for `thin` as well: `thin` writes the same stubs
 * and binds NO delivery concern, so it must never open this gate.
 *
 * An explicit `hooks.rule_inject` opt-in still opens it — that is an operator
 * asking for the concern by name, independent of the projection mode. A DIRECT
 * CLI invocation is a probe by definition — an operator piping an envelope into
 * this file is asking to see what it would deliver — so there the gate defaults
 * to open. `AGENT_CONFIG_REPLAY` re-imposes it, which is what keeps
 * `bench_hook_injection` measuring the configured tree rather than the probe.
 */
export function gateOpen(root: string, cliEntry: boolean): boolean {
    const mode = normalizeLeanProjectionMode(leanProjectionModeRaw(root));
    const hosts = resolveLeanProjectionHosts(leanProjectionHostsRaw(root)).hosts;
    if (deliversBodies(mode) && hosts.includes(DELIVERY_HOST)) return true;
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
            reason: `rule-inject: ${injection.rules.length} rule body/bodies on ${slot} (${injection.bytes} B)`,
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
