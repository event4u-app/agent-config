#!/usr/bin/env node
/**
 * Council CLI — `./agent-config council:{estimate,run,render}`.
 *
 * TypeScript twin of `council_cli.py` (py2ts Phase 1, ADR-200). Wraps
 * `ai_council/orchestrator` for non-interactive callers. Subcommands:
 *
 *   estimate  Bundle + estimate per-member cost (no API call, no spend).
 *   run       Same + estimate, then call the council. Requires --confirm.
 *   render    Re-render a saved responses JSON to the markdown report.
 *
 * `./agent-config` is non-interactive by contract — the cost gate is an
 * explicit `--confirm` flag, never an interactive y/n.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { project_settings_path, resolve_project_root } from './_lib/agent_settings.js';
import { load_agent_settings } from './_lib/agent_settings.js';

import {
    BundleTooLarge,
    bundle_prompt,
    bundle_roadmap,
} from './ai_council/bundler.js';
import {
    DEFAULT_MAX_TOKENS,
    UNLIMITED_TOKENS_FALLBACK,
    AnthropicClient,
    AnthropicCliClient,
    CliClient,
    CliClientError,
    CouncilResponse,
    ExternalAIClient,
    GeminiClient,
    GeminiCliClient,
    ManualClient,
    OpenAIClient,
    OpenAICliClient,
    PerplexityClient,
    PerplexityCliClient,
    XAIClient,
    XAICliClient,
    load_anthropic_key,
    load_cli_call_counts,
    load_openai_key,
    quota_summary_line,
    reset_cli_call_counts,
} from './ai_council/clients.js';
import {
    AdvisorPlan,
    build_persona_labels,
    plan_advisor_swap,
} from './ai_council/advisors.js';
import { format_install_hints } from './ai_council/cli_hints.js';
import {
    type AdvisorConfig,
    type CouncilConfig,
    CouncilConfigError,
    load_council_config,
    resolve_api_key,
    resolve_config_path,
} from './ai_council/config.js';
import { AuthCache, select_solo_member } from './ai_council/solo_dispatch.js';
import { InvalidModeError, resolve_mode } from './ai_council/modes.js';
import { appendEvent } from './ai_council/events_log.js';
import {
    type ClassificationResult,
    type SizeFitVerdict,
    classify_necessity,
    classify_size_fit,
    downgrade_message,
    educate_message,
} from './ai_council/necessity.js';
import {
    ConsensusResult,
    CostBudget,
    CouncilQuestion,
    DebateCapExceeded,
    DebateCheckpoint,
    type DebateCostEstimate,
    PeerReviewResult,
    consult,
    estimate,
    estimate_debate_cost,
    render,
    run_consensus_scoring,
    run_debate,
    run_peer_review,
} from './ai_council/orchestrator.js';
import {
    type PriceTable,
    estimate_cost,
    load_prices,
} from './ai_council/pricing.js';
import { detect_project_context } from './ai_council/project_context.js';
import {
    DecisionReplayInputs,
    render_decision_replay,
} from './ai_council/replay.js';
import {
    Finding as ConsensusFinding,
    FindingScore as ConsensusFindingScore,
    aggregate_scores,
    bucket_by_threshold,
} from './ai_council/consensus.js';
import * as _shadow from './ai_council/shadow_dispatch.js';
import * as _lowimpact from './ai_council/low_impact.js';

// ── argparse-style exit plumbing ────────────────────────────────────
// Mirror CPython argparse: a `prog: error: …` line on stderr + exit 2.
// `_ArgExit` unwinds the call stack after `process.exitCode` is set.
class _ArgExit extends Error {}

/** Mirror Python `argparse.ArgumentTypeError` (caught in `main` → exit 2). */
class ArgumentTypeError extends Error {}

const _PROG = 'agent-config council';

const SCHEMA_VERSION = 1;

/**
 * Provider names accepted under `mode=api`. Mirrors the routing table
 * in `_construct_api_member`; both must stay in sync.
 */
const _API_PROVIDERS: ReadonlySet<string> = new Set([
    'anthropic',
    'openai',
    'gemini',
    'xai',
    'perplexity',
]);

/**
 * Provider names with a wired `mode=cli` subclass. Mirrors the routing
 * table in `_construct_cli_member`; both must stay in sync.
 */
const _CLI_PROVIDERS: ReadonlySet<string> = new Set([
    'anthropic',
    'openai',
    'gemini',
    'xai',
    'perplexity',
]);

// `PACKAGE_ROOT` is where `ai_council/*` lives — fixed relative to this
// file. `REPO_ROOT` is the project the council operates on.
const _HERE = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(_HERE, '..');
const [REPO_ROOT] = resolve_project_root(null);
const SETTINGS_FILE = project_settings_path(REPO_ROOT);
// User-global-first resolution (see `resolve_config_path`).
const AI_COUNCIL_FILE = resolve_config_path(REPO_ROOT);

// Canonical output dirs per ai-council § "Output path convention".
const COUNCIL_CANONICAL_DIRS: Record<string, string> = {
    responses: 'agents/runtime/council/responses',
    sessions: 'agents/runtime/council/sessions',
    questions: 'agents/runtime/council/questions',
};

type Dict = Record<string, unknown>;

// ── Python-parity helpers ───────────────────────────────────────────

/**
 * Format `x` to `ndigits` decimals using round-half-to-even, matching
 * CPython's `format(x, ".<ndigits>f")` (the `:.4f` / `:.2f` f-strings).
 */
function _pyFixed(x: number, ndigits: number): string {
    if (!Number.isFinite(x)) {
        return String(x);
    }
    const neg = x < 0 || Object.is(x, -0);
    const abs = Math.abs(x);
    const factor = Math.pow(10, ndigits);
    const scaled = abs * factor;
    const floor = Math.floor(scaled);
    const frac = scaled - floor;
    const tol = Math.max(Math.abs(scaled), 1) * 2 ** -40;
    let rounded: number;
    if (Math.abs(frac - 0.5) <= tol) {
        rounded = floor % 2 === 0 ? floor : floor + 1;
    } else {
        rounded = Math.round(scaled);
    }
    let intStr = String(rounded);
    let result: string;
    if (ndigits === 0) {
        result = intStr;
    } else {
        if (intStr.length <= ndigits) {
            intStr = '0'.repeat(ndigits - intStr.length + 1) + intStr;
        }
        const whole = intStr.slice(0, intStr.length - ndigits);
        const decimals = intStr.slice(intStr.length - ndigits);
        result = `${whole}.${decimals}`;
    }
    if (neg && Number(result) !== 0) {
        result = `-${result}`;
    }
    return result;
}

/** Python `round(value, ndigits)` — banker's rounding. */
function _pyRound(value: number, ndigits: number): number {
    if (!Number.isFinite(value)) {
        return value;
    }
    const factor = Math.pow(10, ndigits);
    const scaled = value * factor;
    const floor = Math.floor(scaled);
    const frac = scaled - floor;
    const tol = Math.max(Math.abs(scaled), 1) * 2 ** -40;
    let rounded: number;
    if (Math.abs(frac - 0.5) <= tol) {
        rounded = floor % 2 === 0 ? floor : floor + 1;
    } else {
        rounded = Math.round(scaled);
    }
    return rounded / factor;
}

/** Python `repr()` for a string (single-quoted unless it embeds a `'`). */
function _pyReprStr(s: string): string {
    if (s.includes("'") && !s.includes('"')) {
        return `"${s}"`;
    }
    return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

/** Python `repr()` of a list of strings. */
function _pyReprStrList(items: readonly string[]): string {
    return `[${items.map(_pyReprStr).join(', ')}]`;
}

/** Python `sorted(...)` of strings (code-point order). */
function _pySortedStr(items: Iterable<string>): string[] {
    return [...items].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

function _getattr<T>(obj: unknown, name: string, fallback: T): T {
    if (obj !== null && typeof obj === 'object' && name in (obj as Dict)) {
        const v = (obj as Dict)[name];
        return v === undefined ? fallback : (v as T);
    }
    return fallback;
}

function _isDict(v: unknown): v is Dict {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Python `int(x)` truncation toward zero for the loose ints. */
function _pyInt(v: unknown, fallback = 0): number {
    if (v === null || v === undefined) {
        return fallback;
    }
    const n = typeof v === 'number' ? v : Number(v);
    if (!Number.isFinite(n)) {
        return fallback;
    }
    return Math.trunc(n);
}

function _pyFloat(v: unknown, fallback = 0.0): number {
    if (v === null || v === undefined) {
        return fallback;
    }
    const n = typeof v === 'number' ? v : Number(v);
    if (!Number.isFinite(n)) {
        return fallback;
    }
    return n;
}

function _pyBool(v: unknown): boolean {
    if (v === null || v === undefined) {
        return false;
    }
    if (typeof v === 'boolean') {
        return v;
    }
    if (typeof v === 'number') {
        return v !== 0;
    }
    if (typeof v === 'string') {
        return v.length > 0;
    }
    if (Array.isArray(v)) {
        return v.length > 0;
    }
    if (v instanceof Map || v instanceof Set) {
        return v.size > 0;
    }
    if (typeof v === 'object') {
        return Object.keys(v as Dict).length > 0;
    }
    return Boolean(v);
}

/** `json.dumps(obj, indent=2)` byte-parity (ensure_ascii=True default). */
function _jsonDumpsIndent2(obj: unknown, level = 0): string {
    const pad = '  '.repeat(level + 1);
    const closePad = '  '.repeat(level);
    if (obj === null || obj === undefined) {
        return 'null';
    }
    if (typeof obj === 'boolean') {
        return obj ? 'true' : 'false';
    }
    if (typeof obj === 'number') {
        return _jsonNumber(obj);
    }
    if (typeof obj === 'string') {
        return _jsonString(obj);
    }
    if (Array.isArray(obj)) {
        if (obj.length === 0) {
            return '[]';
        }
        const items = obj.map((v) => pad + _jsonDumpsIndent2(v, level + 1));
        return `[\n${items.join(',\n')}\n${closePad}]`;
    }
    if (_isDict(obj)) {
        const keys = Object.keys(obj as Dict);
        if (keys.length === 0) {
            return '{}';
        }
        const items = keys.map(
            (k) => `${pad}${_jsonString(k)}: ${_jsonDumpsIndent2((obj as Dict)[k], level + 1)}`,
        );
        return `{\n${items.join(',\n')}\n${closePad}}`;
    }
    return 'null';
}

function _jsonNumber(n: number): string {
    if (Number.isInteger(n) && Object.is(n, -0) === false) {
        return String(n);
    }
    if (Object.is(n, -0)) {
        return '-0.0';
    }
    return String(n);
}

function _jsonString(s: string): string {
    // Python json.dumps default: ensure_ascii=True — escape non-ASCII as \uXXXX.
    let out = '"';
    for (const ch of s) {
        const code = ch.codePointAt(0) as number;
        if (ch === '"') {
            out += '\\"';
        } else if (ch === '\\') {
            out += '\\\\';
        } else if (ch === '\n') {
            out += '\\n';
        } else if (ch === '\r') {
            out += '\\r';
        } else if (ch === '\t') {
            out += '\\t';
        } else if (ch === '\b') {
            out += '\\b';
        } else if (ch === '\f') {
            out += '\\f';
        } else if (code < 0x20) {
            out += `\\u${code.toString(16).padStart(4, '0')}`;
        } else if (code < 0x7f) {
            out += ch;
        } else if (code <= 0xffff) {
            out += `\\u${code.toString(16).padStart(4, '0')}`;
        } else {
            // surrogate pair
            const c = code - 0x10000;
            const hi = 0xd800 + (c >> 10);
            const lo = 0xdc00 + (c & 0x3ff);
            out += `\\u${hi.toString(16).padStart(4, '0')}\\u${lo.toString(16).padStart(4, '0')}`;
        }
    }
    out += '"';
    return out;
}

// ── output streams ──────────────────────────────────────────────────

function _stdout(s: string): void {
    process.stdout.write(s);
}

function _stderr(s: string): void {
    process.stderr.write(s);
}

class CouncilDisabledError extends Error {}

// ── settings loading ────────────────────────────────────────────────

function load_settings(
    p: string = SETTINGS_FILE,
    opts: { ai_council_path?: string } = {},
): Dict {
    const ai_council_path = opts.ai_council_path ?? AI_COUNCIL_FILE;
    const settings = load_agent_settings({ project_path: p }) as Dict;
    if (fs.existsSync(ai_council_path)) {
        const cfg = load_council_config(ai_council_path);
        settings['ai_council'] = _synthesize_ai_council_block(cfg);
    }
    return settings;
}

function _synthesize_ai_council_block(cfg: CouncilConfig): Dict {
    const members: Dict = {};
    for (const [name, m] of cfg.members) {
        const entry: Dict = { enabled: m.enabled, model: m.model };
        if (m.api_key_ref !== null) {
            entry['api_key_ref'] = m.api_key_ref;
        }
        if (m.mode !== null) {
            entry['mode'] = m.mode;
        }
        if (m.binary !== null) {
            entry['binary'] = m.binary;
        }
        if (m.model_ladder && m.model_ladder.length > 0) {
            entry['model_ladder'] = [...m.model_ladder];
        }
        members[name] = entry;
    }
    const advisors: Dict = {};
    for (const [name, a] of cfg.advisors) {
        const entry: Dict = {
            enabled: a.enabled,
            member: a.member,
            persona: a.persona,
        };
        if (a.model !== null) {
            entry['model'] = a.model;
        }
        advisors[name] = entry;
    }
    const lensCostDisclosure: Dict = {};
    for (const [lens, cd] of cfg.lens_overrides.cost_disclosure) {
        lensCostDisclosure[lens] = {
            mode: cd.mode,
            threshold_usd: cd.threshold_usd,
            show_per_member: cd.show_per_member,
        };
    }
    const lensModelDowngrade: Dict = {};
    for (const [lens, md] of cfg.lens_overrides.model_downgrade) {
        lensModelDowngrade[lens] = { enabled: md.enabled, auto_apply: md.auto_apply };
    }
    return {
        enabled: cfg.enabled,
        mode: cfg.defaults.mode,
        min_rounds: cfg.defaults.min_rounds,
        deep_min_rounds: cfg.defaults.deep_min_rounds,
        max_output_tokens: cfg.defaults.max_output_tokens,
        session_retention_days: cfg.defaults.session_retention_days,
        debate_max_rounds: cfg.defaults.debate_max_rounds,
        cost_budget: {
            max_input_tokens: cfg.cost_budget.max_input_tokens,
            max_output_tokens: cfg.cost_budget.max_output_tokens,
            max_calls: cfg.cost_budget.max_calls,
            max_total_usd: cfg.cost_budget.max_total_usd,
        },
        consensus_scoring: {
            enabled: cfg.consensus_scoring.enabled,
            strong_threshold: cfg.consensus_scoring.strong_threshold,
            minority_threshold: cfg.consensus_scoring.minority_threshold,
            lenses: [...cfg.consensus_scoring.lenses],
        },
        cli_call_budget: {
            max_calls_per_day: _mapToObject(cfg.cli_call_budget.max_calls_per_day),
            warn_at: cfg.cli_call_budget.warn_at,
        },
        necessity_classifier: {
            enabled: cfg.necessity_classifier.enabled,
            mode: cfg.necessity_classifier.mode,
            user_explicit_mode: cfg.necessity_classifier.user_explicit_mode,
        },
        model_downgrade: {
            enabled: cfg.model_downgrade.enabled,
            auto_apply: cfg.model_downgrade.auto_apply,
        },
        debate: {
            max_cost_usd: cfg.debate.max_cost_usd,
            cost_disclosure: {
                mode: cfg.debate.cost_disclosure.mode,
                threshold_usd: cfg.debate.cost_disclosure.threshold_usd,
                show_per_member: cfg.debate.cost_disclosure.show_per_member,
            },
        },
        lens_overrides: {
            necessity_classifier_mode: _mapToObject(
                cfg.lens_overrides.necessity_classifier_mode,
            ),
            necessity_classifier_user_explicit_mode: _mapToObject(
                cfg.lens_overrides.necessity_classifier_user_explicit_mode,
            ),
            model_downgrade: lensModelDowngrade,
            cost_disclosure: lensCostDisclosure,
        },
        members,
        advisors,
    };
}

function _mapToObject<V>(m: ReadonlyMap<string, V>): Record<string, V> {
    const out: Record<string, V> = {};
    for (const [k, v] of m) {
        out[k] = v;
    }
    return out;
}

// ── member construction ─────────────────────────────────────────────

interface BuildMembersOptions {
    invocation_mode?: string | null;
    model_overrides?: Record<string, string> | null;
    siblings_overrides?: Record<string, string[]> | null;
    skipped?: Dict[] | null;
}

function build_members(settings: Dict, opts: BuildMembersOptions = {}): ExternalAIClient[] {
    const invocation_mode = opts.invocation_mode ?? null;
    const model_overrides = opts.model_overrides ?? null;
    const siblings_overrides = opts.siblings_overrides ?? null;
    const skipped = opts.skipped ?? null;

    const ai = _isDict(settings) ? ((settings['ai_council'] as Dict) || {}) : {};
    if (!_pyBool(ai['enabled'])) {
        throw new CouncilDisabledError(
            'ai_council.enabled is false in .agent-settings.yml — ' +
                'flip it on before invoking council:* commands.',
        );
    }
    const members_cfg = (ai['members'] as Dict) || {};
    const global_mode = ai['mode'] as string | null | undefined;
    const cli_budget_cfg = _isDict(ai) ? ((ai['cli_call_budget'] as Dict) || {}) : {};
    const cli_caps = _isDict(cli_budget_cfg)
        ? ((cli_budget_cfg['max_calls_per_day'] as Dict) || {})
        : {};
    const cli_warn_at = _isDict(cli_budget_cfg)
        ? _pyFloat(cli_budget_cfg['warn_at'] ?? 0.8, 0.8)
        : 0.8;
    const overrides = model_overrides || {};
    const siblings = siblings_overrides || {};

    const memberNames = new Set(Object.keys(members_cfg));
    const unknown = _setDifference(Object.keys(overrides), memberNames);
    if (unknown.length > 0) {
        throw new CouncilDisabledError(
            `--model targets unknown member(s) ${_pyReprStrList(_pySortedStr(unknown))}; ` +
                `known members: ${_pyReprStrList(_pySortedStr(memberNames))}.`,
        );
    }
    const unknown_sib = _setDifference(Object.keys(siblings), memberNames);
    if (unknown_sib.length > 0) {
        throw new CouncilDisabledError(
            `--siblings targets unknown member(s) ${_pyReprStrList(_pySortedStr(unknown_sib))}; ` +
                `known members: ${_pyReprStrList(_pySortedStr(memberNames))}.`,
        );
    }
    const conflict = Object.keys(overrides).filter((k) => k in siblings);
    if (conflict.length > 0) {
        throw new CouncilDisabledError(
            `--model and --siblings target the same member(s) ${_pyReprStrList(_pySortedStr(conflict))}; ` +
                `pick one per provider per invocation.`,
        );
    }
    const members: ExternalAIClient[] = [];
    for (const name of Object.keys(members_cfg)) {
        const cfg = ((members_cfg[name] as Dict) || {}) as Dict;
        if (!_pyBool(cfg['enabled'])) {
            if (name in siblings) {
                throw new CouncilDisabledError(
                    `--siblings targets member ${_pyReprStr(name)} but it is not ` +
                        `enabled in .agent-settings.yml (ai_council.members.${name}.enabled).`,
                );
            }
            continue;
        }
        const mode = resolve_mode(name, {
            invocationMode: invocation_mode,
            memberSettings: cfg,
            globalMode: global_mode ?? null,
        });
        if (name in siblings) {
            if (mode !== 'api') {
                throw new CouncilDisabledError(
                    `--siblings requires mode=api for member ${_pyReprStr(name)} (got ${_pyReprStr(mode)}).`,
                );
            }
            const api_key_ref = (cfg['api_key_ref'] as string | null) ?? null;
            for (const sib_model of siblings[name] as string[]) {
                members.push(_construct_api_member(name, sib_model, { api_key_ref }));
            }
            continue;
        }
        const model = (overrides[name] as string | undefined) || (cfg['model'] as string | undefined) || null;
        if (mode === 'api' && _API_PROVIDERS.has(name)) {
            members.push(
                _construct_api_member(name, model, {
                    api_key_ref: (cfg['api_key_ref'] as string | null) ?? null,
                }),
            );
        } else if (mode === 'cli' && _CLI_PROVIDERS.has(name)) {
            try {
                members.push(
                    _construct_cli_member(name, model, {
                        binary: (cfg['binary'] as string | null) ?? null,
                        max_calls_per_day: (cli_caps[name] as number | undefined) ?? null,
                        warn_at: cli_warn_at,
                    }),
                );
            } catch (exc) {
                if (!(exc instanceof CliClientError)) {
                    throw exc;
                }
                const [, , display] = _CLI_FACTORY[name] as [
                    new (opts: { model: string }) => CliClient,
                    string,
                    string,
                ];
                const detail =
                    `${exc.message} Install the ${display} CLI or flip ` +
                    `ai_council.members.${name}.mode back to 'api'.`;
                const entry: Dict = {
                    member: name,
                    reason: 'binary_missing',
                    detail,
                };
                if (skipped !== null) {
                    skipped.push(entry);
                }
                _stderr(`[council] SKIP ${name}: ${detail}\n`);
                continue;
            }
        } else if (mode === 'cli') {
            throw new CouncilDisabledError(
                `member ${_pyReprStr(name)} resolves to mode=cli but no CLI client is ` +
                    `wired (known: ${_pyReprStrList(_pySortedStr(_CLI_PROVIDERS))}).`,
            );
        } else if (mode === 'manual') {
            members.push(new ManualClient({ name, model: model || 'manual' }));
        } else if (mode === 'playwright') {
            throw new CouncilDisabledError(
                `member ${_pyReprStr(name)} resolves to mode=playwright (Phase 2c, not wired).`,
            );
        } else {
            throw new CouncilDisabledError(
                `member ${_pyReprStr(name)} has no transport — mode=${mode}, ` +
                    `name not in ${_pyReprStrList(_pySortedStr(_API_PROVIDERS))}.`,
            );
        }
    }
    if (members.length === 0) {
        if (skipped && skipped.length > 0) {
            const names = skipped.map((s) => String(s['member'])).join(', ');
            throw new CouncilDisabledError(
                `no council member could be constructed — every enabled ` +
                    `member was skipped (${names}). See [council] SKIP entries ` +
                    `on stderr for the per-member reason.`,
            );
        }
        throw new CouncilDisabledError(
            'no council member has `enabled: true` — enable at least one in ' +
                '.agent-settings.yml under ai_council.members.*.',
        );
    }
    return members;
}

function _setDifference(items: string[], known: Set<string>): string[] {
    return items.filter((x) => !known.has(x));
}

function _build_advisor_plans(ai_cfg: Dict, repo_root: string): Map<string, AdvisorPlan> {
    const raw = _isDict(ai_cfg) ? ai_cfg['advisors'] : null;
    if (!_pyBool(raw)) {
        return new Map();
    }
    const advisors = new Map<string, AdvisorConfig>();
    for (const [name, entry] of Object.entries(raw as Dict)) {
        if (!_isDict(entry)) {
            continue;
        }
        advisors.set(name, {
            name,
            enabled: Boolean(_pyBool(entry['enabled'] ?? false)),
            member: String(entry['member'] ?? ''),
            persona: String(entry['persona'] ?? ''),
            model: (entry['model'] as string | null) ?? null,
        });
    }
    return plan_advisor_swap(advisors, repo_root);
}

function _advisor_model_overrides(
    plans: Map<string, AdvisorPlan>,
    explicit: Record<string, string> | null,
): Record<string, string> {
    const merged: Record<string, string> = {};
    for (const [member, plan] of plans) {
        if (plan.model_override) {
            merged[member] = plan.model_override;
        }
    }
    if (explicit) {
        for (const [k, v] of Object.entries(explicit)) {
            merged[k] = v;
        }
    }
    return merged;
}

function _format_advisor_summary(
    plans: Map<string, AdvisorPlan>,
    members: ExternalAIClient[],
): string {
    if (plans.size === 0) {
        return '';
    }
    const member_models = new Map<string, string>();
    for (const m of members) {
        member_models.set(m.name, m.model);
    }
    const rows: string[] = [];
    for (const [member, plan] of plans) {
        const model = member_models.get(member) ?? plan.model_override ?? '?';
        rows.push(`  advisor: ${plan.display_name} on ${member} via ${model}`);
    }
    return rows.join('\n');
}

function _construct_api_member(
    name: string,
    model: string | null,
    opts: { api_key_ref?: string | null } = {},
): ExternalAIClient {
    const api_key_ref = opts.api_key_ref ?? null;
    if (name === 'anthropic') {
        const api_key = api_key_ref
            ? resolve_api_key(api_key_ref, 'ai_council.members.anthropic')
            : load_anthropic_key();
        return new AnthropicClient({ model: model || 'claude-sonnet-4-5', api_key });
    }
    if (name === 'openai') {
        const api_key = api_key_ref
            ? resolve_api_key(api_key_ref, 'ai_council.members.openai')
            : load_openai_key();
        return new OpenAIClient({ model: model || 'gpt-4o', api_key });
    }
    if (name === 'gemini') {
        if (!api_key_ref) {
            throw new CouncilDisabledError(
                "member 'gemini' requires api_key_ref in ~/.event4u/agent-config/settings/.ai-council.yml " +
                    '(e.g. `env:GEMINI_API_KEY`) — no legacy fallback.',
            );
        }
        const api_key = resolve_api_key(api_key_ref, 'ai_council.members.gemini');
        return new GeminiClient({ model: model || 'gemini-2.5-pro', api_key });
    }
    if (name === 'xai') {
        if (!api_key_ref) {
            throw new CouncilDisabledError(
                "member 'xai' requires api_key_ref in ~/.event4u/agent-config/settings/.ai-council.yml " +
                    '(e.g. `env:XAI_API_KEY`) — no legacy fallback.',
            );
        }
        const api_key = resolve_api_key(api_key_ref, 'ai_council.members.xai');
        return new XAIClient({ model: model || 'grok-4', api_key });
    }
    if (name === 'perplexity') {
        if (!api_key_ref) {
            throw new CouncilDisabledError(
                "member 'perplexity' requires api_key_ref in ~/.event4u/agent-config/settings/.ai-council.yml " +
                    '(e.g. `env:PERPLEXITY_API_KEY`) — no legacy fallback.',
            );
        }
        const api_key = resolve_api_key(api_key_ref, 'ai_council.members.perplexity');
        return new PerplexityClient({ model: model || 'sonar-pro', api_key });
    }
    throw new CouncilDisabledError(
        `member ${_pyReprStr(name)} has no api transport ` +
            `(known: ${_pyReprStrList(_pySortedStr(_API_PROVIDERS))}).`,
    );
}

/**
 * Provider → (class-ref, default_model, human_display) for cli-mode
 * routing. The class ref is resolved at call time so tests that override
 * the subclass keep working.
 */
const _CLI_FACTORY: Record<
    string,
    [new (opts: { model: string; binary?: string | null; max_calls_per_day?: number | null; warn_at?: number }) => CliClient, string, string]
> = {
    anthropic: [AnthropicCliClient, 'claude-sonnet-4-5', 'Claude'],
    openai: [OpenAICliClient, 'gpt-5', 'Codex'],
    gemini: [GeminiCliClient, 'gemini-2.5-pro', 'Gemini'],
    xai: [XAICliClient, 'grok-4', 'Grok (community)'],
    perplexity: [PerplexityCliClient, 'sonar-pro', 'Perplexity (community)'],
};

function _construct_cli_member(
    name: string,
    model: string | null,
    opts: { binary?: string | null; max_calls_per_day?: number | null; warn_at?: number } = {},
): ExternalAIClient {
    const binary = opts.binary ?? null;
    const max_calls_per_day = opts.max_calls_per_day ?? null;
    const warn_at = opts.warn_at ?? 0.8;
    if (name in _CLI_FACTORY) {
        const [cls, default_model] = _CLI_FACTORY[name] as [
            new (opts: { model: string; binary?: string | null; max_calls_per_day?: number | null; warn_at?: number }) => CliClient,
            string,
            string,
        ];
        return new cls({
            model: model || default_model,
            binary,
            max_calls_per_day,
            warn_at,
        });
    }
    throw new CouncilDisabledError(
        `member ${_pyReprStr(name)} has no cli transport ` +
            `(known: ${_pyReprStrList(_pySortedStr(_CLI_PROVIDERS))}).`,
    );
}

function build_question(opts: {
    input_path: string;
    input_mode: string;
    max_tokens: number;
    prompt_mode_override?: string | null;
}): [CouncilQuestion, string] {
    const { input_path, input_mode, max_tokens } = opts;
    const prompt_mode_override = opts.prompt_mode_override ?? null;
    let ctx: { mode: string; text: string };
    let artefact: string;
    if (input_mode === 'prompt') {
        const text = fs.readFileSync(input_path, 'utf-8');
        ctx = bundle_prompt(text);
        artefact = String(input_path);
    } else if (input_mode === 'roadmap') {
        ctx = bundle_roadmap(input_path);
        artefact = String(input_path);
    } else {
        throw new ValueError(
            `unsupported input mode: ${_pyReprStr(input_mode)} (use prompt | roadmap)`,
        );
    }
    const mode = prompt_mode_override || ctx.mode;
    return [new CouncilQuestion({ mode, user_prompt: ctx.text, max_tokens }), artefact];
}

class ValueError extends Error {}

function format_estimate_table(
    members: ExternalAIClient[],
    estimates: CostEstimateLike[],
    opts: {
        consensus_delta_usd?: number;
        consensus_extra_calls?: number;
        peer_review_delta_usd?: number;
        peer_review_extra_calls?: number;
    } = {},
): string {
    const consensus_delta_usd = opts.consensus_delta_usd ?? 0.0;
    const consensus_extra_calls = opts.consensus_extra_calls ?? 0;
    const peer_review_delta_usd = opts.peer_review_delta_usd ?? 0.0;
    const peer_review_extra_calls = opts.peer_review_extra_calls ?? 0;

    const rows: string[] = [];
    for (let i = 0; i < members.length; i++) {
        const m = members[i] as ExternalAIClient;
        const e = estimates[i] as CostEstimateLike;
        rows.push(
            `  ${m.name}/${m.model}: ` +
                `~${e.input_tokens} in + ${e.output_tokens} out  =  $${_pyFixed(_total_usd(e), 4)}`,
        );
    }
    let total = estimates.reduce((acc, e) => acc + _total_usd(e), 0.0);
    if (consensus_extra_calls > 0) {
        rows.push(
            `  +consensus scoring: +${consensus_extra_calls} calls ` +
                `(~+$${_pyFixed(consensus_delta_usd, 4)})`,
        );
        total += consensus_delta_usd;
    }
    if (peer_review_extra_calls > 0) {
        rows.push(
            `  +peer-review: +${peer_review_extra_calls} calls ` +
                `(~+$${_pyFixed(peer_review_delta_usd, 4)})`,
        );
        total += peer_review_delta_usd;
    }
    rows.push(`  TOTAL:  $${_pyFixed(total, 4)}`);
    return rows.join('\n');
}

interface CostEstimateLike {
    input_tokens: number;
    output_tokens: number;
    input_usd: number;
    output_usd: number;
}

function _total_usd(e: CostEstimateLike): number {
    return e.input_usd + e.output_usd;
}

function _consensus_cost_delta(
    ai_cfg: Dict,
    prompt_mode: string,
    estimates: CostEstimateLike[],
    _n_billable: number,
): [number, number] {
    const cs = (ai_cfg['consensus_scoring'] as Dict) || {};
    if (!_pyBool(cs['enabled'])) {
        return [0, 0.0];
    }
    const lenses = (cs['lenses'] as string[]) || ['analysis'];
    if (!lenses.includes(prompt_mode)) {
        return [0, 0.0];
    }
    const extra_calls = 2 * _n_billable;
    const extra_usd = 2.0 * estimates.reduce((acc, e) => acc + _total_usd(e), 0.0);
    return [extra_calls, extra_usd];
}

function _maybe_run_consensus(
    ai_cfg: Dict,
    question: CouncilQuestion,
    members: ExternalAIClient[],
    responses: CouncilResponse[],
    budget: CostBudget,
    table: PriceTable,
    project: unknown,
    args: Args,
): ConsensusResult | null {
    const cs = (ai_cfg['consensus_scoring'] as Dict) || {};
    if (!_pyBool(cs['enabled'])) {
        return null;
    }
    const lenses = (cs['lenses'] as string[]) || ['analysis'];
    if (!lenses.includes(question.mode)) {
        return null;
    }
    return run_consensus_scoring(members, responses, {
        budget,
        table,
        project: project as never,
        original_ask: args.original_ask,
        max_tokens: question.max_tokens,
        strong_threshold: _pyFloat(cs['strong_threshold'] ?? 0.7, 0.7),
        minority_threshold: _pyFloat(cs['minority_threshold'] ?? 0.4, 0.4),
    });
}

function _serialise_consensus(consensus: ConsensusResult): Dict {
    const metadata: Dict = {};
    for (const [fid, m] of consensus.metadata) {
        metadata[fid] = {
            mean_score: m.mean_score,
            agreement_rate: (m as unknown as { agreement_rate: number }).agreement_rate,
            consensus_strength: m.consensus_strength,
            dissent_count: m.dissent_count,
            scorers: [...m.scorers],
            concur_count: m.concur_count,
            dissent_reasons: m.dissent_reasons.map((pair) => [...pair]),
            evidence_quality: m.evidence_quality,
        };
    }
    return {
        findings: consensus.findings.map((f) => ({ id: f.id, source: f.source, text: f.text })),
        scores: consensus.scores.map((s) => ({
            finding_id: s.finding_id,
            scorer: s.scorer,
            score: s.score,
            agree: s.agree,
            reason: s.reason,
        })),
        metadata,
        extraction_responses: _serialise_responses(consensus.extraction_responses),
        scoring_responses: _serialise_responses(consensus.scoring_responses),
    };
}

function _decision_replay_settings(ai_cfg: Dict, lens: string): [boolean, boolean] {
    const global_block = (ai_cfg['decision_replay'] as Dict) || {};
    let enabled: unknown = global_block['enabled'] === undefined ? true : global_block['enabled'];
    let include_args: unknown =
        global_block['include_member_arguments'] === undefined
            ? true
            : global_block['include_member_arguments'];
    const lenses = (ai_cfg['lenses'] as Dict) || {};
    const lens_block = ((lenses[lens] as Dict) || {})['decision_replay'];
    if (_isDict(lens_block)) {
        if ('enabled' in lens_block) {
            enabled = lens_block['enabled'];
        }
        if ('include_member_arguments' in lens_block) {
            include_args = lens_block['include_member_arguments'];
        }
    }
    return [Boolean(_pyBool(enabled)), Boolean(_pyBool(include_args))];
}

function _maybe_write_decision_replay(opts: {
    ai_cfg: Dict;
    lens: string;
    out_path: string;
    consensus: ConsensusResult | null;
    deliberation: CouncilResponse[];
    original_ask: string;
}): string | null {
    const [enabled, include_args] = _decision_replay_settings(opts.ai_cfg, opts.lens);
    if (!enabled || opts.consensus === null) {
        return null;
    }
    const replay = render_decision_replay(
        new DecisionReplayInputs({
            findings: [...opts.consensus.findings],
            scores: [...opts.consensus.scores],
            metadata: new Map(opts.consensus.metadata),
            deliberation: [...opts.deliberation],
            original_ask: opts.original_ask,
            include_member_arguments: include_args,
        }),
    );
    const target = path.join(path.dirname(opts.out_path), 'decision-replay.md');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, replay, { encoding: 'utf-8' });
    return target;
}

// ── peer-review ─────────────────────────────────────────────────────

function _peer_review_active(ai_cfg: Dict, args: Args): boolean {
    if (_getattr(args, 'peer_review', false)) {
        return true;
    }
    const pr_cfg = (ai_cfg['peer_review'] as Dict) || {};
    return Boolean(_pyBool(pr_cfg['enabled']));
}

function _peer_review_cost_delta(
    ai_cfg: Dict,
    args: Args,
    estimates: CostEstimateLike[],
    n_billable: number,
): [number, number] {
    if (!_peer_review_active(ai_cfg, args)) {
        return [0, 0.0];
    }
    if (n_billable < 2) {
        return [0, 0.0];
    }
    const extra_calls = n_billable;
    const extra_usd = estimates.reduce((acc, e) => acc + _total_usd(e), 0.0);
    return [extra_calls, extra_usd];
}

function _maybe_run_peer_review(
    ai_cfg: Dict,
    args: Args,
    question: CouncilQuestion,
    members: ExternalAIClient[],
    responses: CouncilResponse[],
    budget: CostBudget,
    table: PriceTable,
    project: unknown,
    opts: { persona_labels?: Map<string, string> | null } = {},
): PeerReviewResult | null {
    if (!_peer_review_active(ai_cfg, args)) {
        return null;
    }
    const result = run_peer_review(members, responses, {
        budget,
        table,
        project: project as never,
        original_ask: args.original_ask,
        max_tokens: question.max_tokens,
        persona_labels: opts.persona_labels ?? null,
    });
    if (result.responses.length === 0) {
        return null;
    }
    return result;
}

function _serialise_peer_review(peer_review: PeerReviewResult): Dict {
    return {
        responses: _serialise_responses(peer_review.responses),
        label_to_source: _mapToObject(peer_review.label_to_source),
        persona_labels: _mapToObject(peer_review.persona_labels),
    };
}

function _deserialise_peer_review(data: Dict | null | undefined): PeerReviewResult | null {
    if (!_pyBool(data)) {
        return null;
    }
    const d = data as Dict;
    return new PeerReviewResult({
        responses: _deserialise_responses((d['responses'] as Dict[]) || []),
        label_to_source: _objToMap((d['label_to_source'] as Dict) || {}),
        persona_labels: _objToMap((d['persona_labels'] as Dict) || {}),
    });
}

function _objToMap(o: Dict): Map<string, string> {
    const m = new Map<string, string>();
    for (const [k, v] of Object.entries(o)) {
        m.set(k, String(v));
    }
    return m;
}

// ── round / depth / token resolution ────────────────────────────────

function _resolve_rounds(args: Args, ai_cfg: Dict): number {
    if (_getattr<number | null>(args, 'rounds', null) !== null) {
        return _pyInt(args.rounds);
    }
    const min_rounds = _pyInt(ai_cfg['min_rounds'] ?? 2, 2);
    if (_getattr<string>(args, 'depth', 'standard') === 'deep') {
        const deep = _pyInt(ai_cfg['deep_min_rounds'] ?? min_rounds, min_rounds);
        return Math.max(deep, min_rounds);
    }
    return min_rounds;
}

function _resolve_max_tokens(args: Args, ai_cfg: Dict): number {
    const cli = _getattr<number | null>(args, 'max_tokens', null);
    let value: number;
    if (cli !== null) {
        value = _pyInt(cli);
    } else if ('max_output_tokens' in ai_cfg) {
        value = _pyInt(ai_cfg['max_output_tokens'] ?? 0, 0);
    } else {
        value = DEFAULT_MAX_TOKENS;
    }
    if (value <= 0) {
        return UNLIMITED_TOKENS_FALLBACK;
    }
    return value;
}

// ── subcommands ─────────────────────────────────────────────────────

function cmd_estimate(
    args: Args,
    opts: { settings?: Dict | null; members?: ExternalAIClient[] | null; table?: PriceTable | null } = {},
): number {
    let settings = opts.settings ?? null;
    let members = opts.members ?? null;
    let table = opts.table ?? null;
    if (settings === null) {
        settings = load_settings();
    }
    const ai_cfg = _isDict(settings) ? ((settings['ai_council'] as Dict) || {}) : {};
    const advisor_plans = _build_advisor_plans(ai_cfg, REPO_ROOT);
    const explicit_overrides = _parse_model_overrides(_getattr<string[] | null>(args, 'model', null));
    const skipped: Dict[] = [];
    if (members === null) {
        members = build_members(settings, {
            invocation_mode: args.mode_override,
            model_overrides: _advisor_model_overrides(advisor_plans, explicit_overrides),
            siblings_overrides: _parse_siblings_overrides(_getattr<string[] | null>(args, 'siblings', null)),
            skipped,
        });
    }
    if (table === null) {
        table = load_prices();
    }
    const [question] = build_question({
        input_path: args.question as string,
        input_mode: args.input_mode,
        max_tokens: _resolve_max_tokens(args, ai_cfg),
        prompt_mode_override: _getattr<string | null>(args, 'prompt_mode', null),
    });
    const project = detect_project_context(REPO_ROOT);
    const billable = members.filter((m) => _getattr(m, 'billable', true));
    const estimates = estimate(question, billable, table, {
        project,
        original_ask: args.original_ask,
        advisor_plans,
    });
    if (_getattr(args, 'debate', false)) {
        return _emit_debate_estimate(args, ai_cfg, members, billable, estimates, advisor_plans, { skipped });
    }
    const [extra_calls, extra_usd] = _consensus_cost_delta(ai_cfg, question.mode, estimates, billable.length);
    const [pr_extra_calls, pr_extra_usd] = _peer_review_cost_delta(ai_cfg, args, estimates, billable.length);
    _stdout(
        `council:estimate · mode=${question.mode} · members=${members.length} ` +
            `(billable=${billable.length})\n`,
    );
    const advisor_summary = _format_advisor_summary(advisor_plans, billable);
    if (advisor_summary) {
        _stdout(advisor_summary + '\n');
    }
    if (skipped.length > 0) {
        _stdout(format_install_hints(skipped) + '\n');
    }
    _stdout(
        format_estimate_table(billable, estimates, {
            consensus_delta_usd: extra_usd,
            consensus_extra_calls: extra_calls,
            peer_review_delta_usd: pr_extra_usd,
            peer_review_extra_calls: pr_extra_calls,
        }) + '\n',
    );
    return 0;
}

function _emit_debate_estimate(
    args: Args,
    ai_cfg: Dict,
    members: ExternalAIClient[],
    billable: ExternalAIClient[],
    estimates: CostEstimateLike[],
    advisor_plans: Map<string, AdvisorPlan>,
    opts: { skipped?: Dict[] | null } = {},
): number {
    const skipped = opts.skipped ?? null;
    const min_rounds = _pyInt(ai_cfg['min_rounds'] ?? 2, 2);
    const max_rounds_cap = _pyInt(ai_cfg['debate_max_rounds'] ?? 4, 4);
    const requested = _getattr(args, 'rounds', null) !== null ? _pyInt(args.rounds) : min_rounds;
    if (requested < 1) {
        throw new ArgumentTypeError(`--rounds must be >= 1 (got ${requested})`);
    }
    if (requested > max_rounds_cap) {
        throw new ArgumentTypeError(
            `--rounds=${requested} exceeds debate_max_rounds=${max_rounds_cap}; ` +
                `raise the cap in ~/.event4u/agent-config/settings/.ai-council.yml or lower --rounds.`,
        );
    }
    const rounds = requested;
    const per_round_usd = estimates.reduce((acc, e) => acc + _total_usd(e), 0.0);
    const projected_total = per_round_usd * rounds;
    _stdout(
        `council:estimate · mode=debate · members=${members.length} ` +
            `(billable=${billable.length}) · rounds=${rounds} ` +
            `(cap=${max_rounds_cap})\n`,
    );
    const advisor_summary = _format_advisor_summary(advisor_plans, billable);
    if (advisor_summary) {
        _stdout(advisor_summary + '\n');
    }
    if (skipped && skipped.length > 0) {
        _stdout(format_install_hints(skipped) + '\n');
    }
    for (let round_idx = 1; round_idx <= rounds; round_idx++) {
        _stdout(`\nRound ${round_idx} of ${rounds}:\n`);
        _stdout(format_estimate_table(billable, estimates) + '\n');
        if (round_idx < rounds) {
            _stdout('  ' + '─'.repeat(40) + '\n');
        }
    }
    _stdout(`\n  PROJECTED TOTAL (${rounds} rounds):  $${_pyFixed(projected_total, 4)}\n`);
    _stdout(
        '  Note: progressive disclosure may stop the debate early; ' + 'this is an upper bound.\n',
    );
    return 0;
}

function _serialise_responses(responses: CouncilResponse[]): Dict[] {
    const out: Dict[] = [];
    for (const r of responses) {
        const metadata: Dict = {};
        for (const [k, v] of Object.entries(r.metadata || {})) {
            metadata[k] = String(v);
        }
        out.push({
            provider: r.provider,
            model: r.model,
            text: r.text,
            input_tokens: r.input_tokens,
            output_tokens: r.output_tokens,
            latency_ms: r.latency_ms,
            error: r.error,
            metadata,
        });
    }
    return out;
}

function _deserialise_responses(items: Dict[]): CouncilResponse[] {
    const out: CouncilResponse[] = [];
    for (const d of items) {
        out.push(
            new CouncilResponse({
                provider: (d['provider'] as string) ?? '',
                model: (d['model'] as string) ?? '',
                text: (d['text'] as string) ?? '',
                input_tokens: _pyInt(d['input_tokens'] ?? 0, 0),
                output_tokens: _pyInt(d['output_tokens'] ?? 0, 0),
                latency_ms: _pyInt(d['latency_ms'] ?? 0, 0),
                error: (d['error'] as string | null) ?? null,
                metadata: (d['metadata'] as Dict) || {},
            }),
        );
    }
    return out;
}

function _deserialise_consensus(data: Dict | null | undefined): ConsensusResult | null {
    if (!_pyBool(data)) {
        return null;
    }
    const d = data as Dict;
    // Lazy import-equivalent — orchestrator/consensus already imported.
    const findings = ((d['findings'] as Dict[]) || []).map(
        (f) => new ConsensusFinding(f['id'] as string, f['source'] as string, f['text'] as string),
    );
    const scores = ((d['scores'] as Dict[]) || []).map(
        (s) =>
            new ConsensusFindingScore(
                s['finding_id'] as string,
                s['scorer'] as string,
                _pyInt(s['score']),
                Boolean(_pyBool(s['agree'])),
                (s['reason'] as string) ?? '',
            ),
    );
    const metadata = aggregate_scores(findings, scores);
    const bucket = bucket_by_threshold(findings, metadata);
    return new ConsensusResult({
        bucket,
        findings,
        scores,
        metadata,
        extraction_responses: _deserialise_responses((d['extraction_responses'] as Dict[]) || []),
        scoring_responses: _deserialise_responses((d['scoring_responses'] as Dict[]) || []),
    });
}

function _resolve_necessity_mode(ai_cfg: Dict, lens: string, invocation = 'agent'): [boolean, string] {
    const nc_block = (ai_cfg['necessity_classifier'] as Dict) || {};
    const enabled = nc_block['enabled'] === undefined ? true : Boolean(_pyBool(nc_block['enabled']));
    const lens_overrides = (ai_cfg['lens_overrides'] as Dict) || {};
    let global_mode: string;
    let overrides: Dict;
    if (invocation === 'user_explicit') {
        global_mode = String(nc_block['user_explicit_mode'] ?? 'warn-only');
        overrides = (lens_overrides['necessity_classifier_user_explicit_mode'] as Dict) || {};
    } else {
        global_mode = String(nc_block['mode'] ?? 'educate');
        overrides = (lens_overrides['necessity_classifier_mode'] as Dict) || {};
    }
    const resolved = lens in overrides ? overrides[lens] : global_mode;
    return [enabled, String(resolved)];
}

function _provider_caps_snapshot(ai_cfg: Dict): Record<string, Record<string, string>> {
    const members = (ai_cfg['members'] as Dict) || {};
    const snapshot: Record<string, Record<string, string>> = {};
    if (!_isDict(members)) {
        return snapshot;
    }
    for (const [name, cfg] of Object.entries(members)) {
        if (!_isDict(cfg) || !(cfg['enabled'] === undefined ? true : _pyBool(cfg['enabled']))) {
            continue;
        }
        snapshot[String(name)] = {
            mode: String(cfg['mode'] ?? ''),
            model: String(cfg['model'] ?? ''),
        };
    }
    return snapshot;
}

function _necessity_gate(opts: {
    prompt: string;
    lens: string;
    invocation: string;
    proceed_anyway: boolean;
    ai_cfg: Dict;
    stdout?: ((s: string) => void) | null;
    original_ask?: string;
}): [boolean, number, ClassificationResult | null] {
    const out = opts.stdout ?? _stdout;
    const [enabled, mode] = _resolve_necessity_mode(opts.ai_cfg, opts.lens, opts.invocation);
    if (!enabled || mode === 'off') {
        return [true, 0, null];
    }
    const result = classify_necessity(opts.prompt, opts.lens, opts.invocation as never);
    const caps = _provider_caps_snapshot(opts.ai_cfg);
    const hashed = (opts.original_ask || '') || opts.prompt;

    const _emit = (action: string): void => {
        appendEvent({
            lens: opts.lens,
            invocation: opts.invocation,
            action,
            verdict: result.verdict,
            category: result.category,
            mode,
            provider_caps: caps,
            original_ask: hashed,
        });
    };

    if (result.verdict !== 'unnecessary') {
        if (result.verdict === 'borderline') {
            out(
                `council:necessity · borderline (${result.category}) · ` +
                    `${result.rationale}\n`,
            );
        }
        _emit('proceed');
        return [true, 0, result];
    }
    // verdict === "unnecessary"
    if (mode === 'warn-only') {
        out(
            `council:necessity · warn-only (${result.category}) · ` +
                `${result.rationale}\n`,
        );
        _emit('proceed');
        return [true, 0, result];
    }
    if (mode === 'block') {
        out(
            `council:necessity · skipped (${result.category}) · ` +
                `${result.rationale}\n` +
                `council:necessity · mode=block — \`--proceed-anyway\` has ` +
                `no effect on the block path.\n`,
        );
        _emit('skip_necessity');
        return [false, 0, result];
    }
    // mode === "educate"
    if (opts.invocation === 'agent') {
        out(
            `council:necessity · skipped (agent, ${result.category}) · ` +
                `${result.rationale}\n`,
        );
        _emit('skip_necessity');
        return [false, 0, result];
    }
    // invocation === "user_explicit"
    if (opts.proceed_anyway) {
        out(
            `council:necessity · override (user_explicit + ` +
                `--proceed-anyway, ${result.category}) · ` +
                `${result.rationale}\n`,
        );
        _emit('proceed');
        return [true, 0, result];
    }
    out(educate_message(result, opts.lens) + '\n');
    _emit('skip_necessity');
    return [false, 2, result];
}

function _resolve_model_downgrade(ai_cfg: Dict, lens: string): [boolean, boolean] {
    const md_block = (ai_cfg['model_downgrade'] as Dict) || {};
    let enabled = md_block['enabled'] === undefined ? true : Boolean(_pyBool(md_block['enabled']));
    let auto_apply = md_block['auto_apply'] === undefined ? false : Boolean(_pyBool(md_block['auto_apply']));
    const overrides = ((ai_cfg['lens_overrides'] as Dict) || {})['model_downgrade'] || {};
    const lens_override = _isDict(overrides) ? (overrides as Dict)[lens] : null;
    if (_isDict(lens_override)) {
        enabled = lens_override['enabled'] === undefined ? enabled : Boolean(_pyBool(lens_override['enabled']));
        auto_apply =
            lens_override['auto_apply'] === undefined ? auto_apply : Boolean(_pyBool(lens_override['auto_apply']));
    }
    return [enabled, auto_apply];
}

function _size_fit_gate(opts: {
    prompt: string;
    lens: string;
    members: ExternalAIClient[];
    ai_cfg: Dict;
    stdout?: ((s: string) => void) | null;
}): Array<[string, SizeFitVerdict, boolean]> {
    const out = opts.stdout ?? _stdout;
    const [enabled, auto_apply] = _resolve_model_downgrade(opts.ai_cfg, opts.lens);
    const decisions: Array<[string, SizeFitVerdict, boolean]> = [];
    if (!enabled) {
        return decisions;
    }
    const members_cfg = (opts.ai_cfg['members'] as Dict) || {};
    for (const member of opts.members) {
        const member_cfg = (members_cfg[member.name] as Dict) || {};
        const ladder = (member_cfg['model_ladder'] as string[]) || [];
        if (ladder.length === 0) {
            continue;
        }
        const verdict = classify_size_fit(opts.prompt, member.model, ladder, opts.lens);
        let applied = false;
        if (!verdict.fit && verdict.suggested_model) {
            if (auto_apply) {
                out(
                    `council:size-fit · ${member.name} · auto-downgrade ` +
                        `\`${member.model}\` → \`${verdict.suggested_model}\` · ` +
                        `${verdict.reason}\n`,
                );
                member.model = verdict.suggested_model;
                applied = true;
            } else {
                out(
                    `council:size-fit · ${member.name} · ` +
                        `${downgrade_message(verdict, member.model)}\n`,
                );
            }
        }
        decisions.push([member.name, verdict, applied]);
    }
    return decisions;
}

function _resolve_cost_disclosure(ai_cfg: Dict, lens: string): [string, number, boolean] {
    const debate_block = (ai_cfg['debate'] as Dict) || {};
    const debate_disc = (debate_block['cost_disclosure'] as Dict) || {};
    let mode: string;
    let threshold: number;
    let show_per_member: boolean;
    if (lens === 'debate') {
        mode = String(debate_disc['mode'] ?? 'always');
        threshold = _pyFloat(debate_disc['threshold_usd'] ?? 1.0, 1.0);
        show_per_member = debate_disc['show_per_member'] === undefined ? true : Boolean(_pyBool(debate_disc['show_per_member']));
    } else {
        mode = 'off';
        threshold = 1.0;
        show_per_member = true;
    }
    const overrides = ((ai_cfg['lens_overrides'] as Dict) || {})['cost_disclosure'] || {};
    const lens_override = _isDict(overrides) ? (overrides as Dict)[lens] : null;
    if (_isDict(lens_override)) {
        mode = String(lens_override['mode'] ?? mode);
        threshold = _pyFloat(lens_override['threshold_usd'] ?? threshold, threshold);
        show_per_member =
            lens_override['show_per_member'] === undefined
                ? show_per_member
                : Boolean(_pyBool(lens_override['show_per_member']));
    }
    return [mode, threshold, show_per_member];
}

function _format_cost_disclosure(
    est: DebateCostEstimate,
    opts: { lens: string; show_per_member: boolean },
): string {
    const { lens, show_per_member } = opts;
    const lines: string[] = [
        `council:${lens} · cost-disclosure · estimated ` +
            `$${_pyFixed(est.low_usd, 4)} – $${_pyFixed(est.high_usd, 4)} ` +
            `(expected $${_pyFixed(est.expected_usd, 4)}) across ` +
            `${est.per_member.length} billable members × ${est.rounds} rounds`,
    ];
    if (show_per_member && est.per_member.length > 0) {
        lines.push('  per member:');
        for (const pm of est.per_member) {
            lines.push(
                `    · ${_ljust(String(pm['name']), 14)} ${_ljust(String(pm['model']), 22)} ` +
                    `$${_pyFixed(pm['low_usd'] as number, 4)} – $${_pyFixed(pm['high_usd'] as number, 4)}`,
            );
        }
    }
    if (est.subscription_members.length > 0) {
        lines.push('  subscription (no USD spend):');
        for (const sm of est.subscription_members) {
            const label = (sm['subscription_label'] as string) || (sm['transport'] as string) || '';
            lines.push(`    · ${_ljust(String(sm['name']), 14)} ${_ljust(String(sm['model']), 22)} (${label})`);
        }
    }
    return lines.join('\n') + '\n';
}

/** Python `str.ljust(width)` — pad with spaces on the right. */
function _ljust(s: string, width: number): string {
    return s.length >= width ? s : s + ' '.repeat(width - s.length);
}

function _debate_refusal_cap(ai_cfg: Dict): number {
    const debate_block = (ai_cfg['debate'] as Dict) || {};
    return _pyFloat(debate_block['max_cost_usd'] ?? 5.0, 5.0) || 0.0;
}

function _emit_shadow_slo_banner(): void {
    try {
        // Lazy import to mirror Python's in-function import (and to avoid a
        // load-time dependency on the shadow log path).
        const sd = _shadow;
        const [rate, n] = sd.compute_disagreement_rate(sd.SHADOW_LOG_PATH);
        if (n === 0) {
            return;
        }
        _stdout(sd.slo_banner(rate, n) + '\n');
    } catch {
        return;
    }
}

function _apply_solo_dispatch(members: ExternalAIClient[]): [ExternalAIClient[], string | null] {
    let cfg: CouncilConfig;
    try {
        cfg = load_council_config(AI_COUNCIL_FILE);
    } catch (exc) {
        if (exc instanceof CouncilConfigError || _isFileNotFound(exc)) {
            return [members, null];
        }
        throw exc;
    }
    if (cfg.routing.solo_member_fallback_chain.length === 0) {
        return [
            members,
            'council:solo · WARN · --single requested but ' +
                'routing.solo_member_fallback_chain is empty — ' +
                'escalating to full council.',
        ];
    }
    const runtime_names = new Set(members.map((m) => _getattr(m, 'name', '')));
    const pick = select_solo_member(cfg.routing, cfg.members, {
        auth_cache: new AuthCache(),
        probe: (name: string) => runtime_names.has(name),
    });
    if (pick === null) {
        return [
            members,
            'council:solo · WARN · solo dispatch unavailable ' +
                '(no chain member runtime-present) — escalating to ' +
                'full council.',
        ];
    }
    const filtered = members.filter((m) => _getattr(m, 'name', '') === pick);
    if (filtered.length === 0) {
        return [
            members,
            'council:solo · WARN · selected member vanished ' +
                'between probe and filter — escalating to full council.',
        ];
    }
    return [
        filtered,
        `council:solo · dispatching to ${pick} only ` + `(routing.solo_member_fallback_chain).`,
    ];
}

function cmd_run(
    args: Args,
    opts: { settings?: Dict | null; members?: ExternalAIClient[] | null; table?: PriceTable | null } = {},
): number {
    let settings = opts.settings ?? null;
    let members = opts.members ?? null;
    let table = opts.table ?? null;
    if (settings === null) {
        settings = load_settings();
    }
    const ai_cfg = _isDict(settings) ? ((settings['ai_council'] as Dict) || {}) : {};
    const advisor_plans = _build_advisor_plans(ai_cfg, REPO_ROOT);
    const explicit_overrides = _parse_model_overrides(_getattr<string[] | null>(args, 'model', null));
    const skipped: Dict[] = [];
    if (members === null) {
        members = build_members(settings, {
            invocation_mode: args.mode_override,
            model_overrides: _advisor_model_overrides(advisor_plans, explicit_overrides),
            siblings_overrides: _parse_siblings_overrides(_getattr<string[] | null>(args, 'siblings', null)),
            skipped,
        });
    }
    if (_getattr(args, 'single', false)) {
        const [filtered, solo_banner] = _apply_solo_dispatch(members);
        members = filtered;
        if (solo_banner) {
            _stdout(solo_banner + '\n');
        }
        _emit_shadow_slo_banner();
    }
    if (table === null) {
        table = load_prices();
    }
    const [question, artefact] = build_question({
        input_path: args.question as string,
        input_mode: args.input_mode,
        max_tokens: _resolve_max_tokens(args, ai_cfg),
        prompt_mode_override: _getattr<string | null>(args, 'prompt_mode', null),
    });
    const [proceed, gate_exit] = _necessity_gate({
        prompt: question.user_prompt,
        lens: question.mode,
        invocation: _getattr(args, 'invocation', 'agent'),
        proceed_anyway: _getattr(args, 'proceed_anyway', false),
        ai_cfg,
        original_ask: _getattr(args, 'original_ask', '') || '',
    });
    if (!proceed) {
        return gate_exit;
    }
    _size_fit_gate({
        prompt: question.user_prompt,
        lens: question.mode,
        members,
        ai_cfg,
    });
    const project = detect_project_context(REPO_ROOT);
    const billable = members.filter((m) => _getattr(m, 'billable', true));
    const estimates = estimate(question, billable, table, {
        project,
        original_ask: args.original_ask,
        advisor_plans,
    });
    const [extra_calls, extra_usd] = _consensus_cost_delta(ai_cfg, question.mode, estimates, billable.length);
    const [pr_extra_calls, pr_extra_usd] = _peer_review_cost_delta(ai_cfg, args, estimates, billable.length);
    _stdout(
        `council:run · mode=${question.mode} · members=${members.length} ` +
            `(billable=${billable.length})\n`,
    );
    const advisor_summary = _format_advisor_summary(advisor_plans, billable);
    if (advisor_summary) {
        _stdout(advisor_summary + '\n');
    }
    if (skipped.length > 0) {
        _stdout(format_install_hints(skipped) + '\n');
    }
    _stdout(
        format_estimate_table(billable, estimates, {
            consensus_delta_usd: extra_usd,
            consensus_extra_calls: extra_calls,
            peer_review_delta_usd: pr_extra_usd,
            peer_review_extra_calls: pr_extra_calls,
        }) + '\n',
    );

    // Step-8 P1 — pre-run quota summary.
    const cli_members = members.filter((m) => m instanceof CliClient);
    const [summary, warn_providers] = quota_summary_line(cli_members as CliClient[]);
    if (summary) {
        _stdout(summary + '\n');
        for (const prov of warn_providers) {
            _stdout(`council:quota · WARN · ${prov} near limit\n`);
        }
    }

    // Phase 8 step 5 — opt-in cost disclosure for non-debate lenses.
    const [disc_mode, disc_threshold, disc_show] = _resolve_cost_disclosure(ai_cfg, question.mode);
    if (disc_mode !== 'off') {
        const run_estimate = estimate_debate_cost(question, members, table, {
            rounds: 1,
            project,
            original_ask: args.original_ask,
            advisor_plans,
        });
        if (disc_mode === 'always' || (disc_mode === 'above_threshold' && run_estimate.expected_usd > disc_threshold)) {
            _stdout(_format_cost_disclosure(run_estimate, { lens: question.mode, show_per_member: disc_show }));
        }
    }

    if (!args.confirm) {
        _stdout(
            '\nNo --confirm flag — estimate only. Re-run with --confirm to ' +
                'invoke the council and write the response.\n',
        );
        return 0;
    }

    const cost_cfg = (ai_cfg['cost_budget'] as Dict) || {};
    const budget = new CostBudget({
        max_input_tokens: _pyInt(cost_cfg['max_input_tokens'] ?? 50_000, 50_000),
        max_output_tokens: _pyInt(cost_cfg['max_output_tokens'] ?? 20_000, 20_000),
        max_calls: _pyInt(cost_cfg['max_calls'] ?? 10, 10),
        max_total_usd: _pyFloat(cost_cfg['max_total_usd'] ?? 0.0, 0.0) || 0.0,
    });
    const rounds = _resolve_rounds(args, ai_cfg);
    const responses = consult(members, question, budget, {
        table,
        project,
        original_ask: args.original_ask,
        rounds,
        advisor_plans,
    });
    const persona_labels = build_persona_labels(advisor_plans, billable);
    const peer_review = _maybe_run_peer_review(
        ai_cfg,
        args,
        question,
        members,
        responses,
        budget,
        table,
        project,
        { persona_labels },
    );
    const consensus = _maybe_run_consensus(ai_cfg, question, members, responses, budget, table, project, args);
    const estimated_total = estimates.reduce((acc, e) => acc + _total_usd(e), 0.0);
    let actual_total = 0.0;
    const all_responses: CouncilResponse[] = [...responses];
    if (peer_review !== null) {
        all_responses.push(...peer_review.responses);
    }
    if (consensus !== null) {
        all_responses.push(...consensus.extraction_responses);
        all_responses.push(...consensus.scoring_responses);
    }
    for (const r of all_responses) {
        if (r.error) {
            continue;
        }
        const ce = estimate_cost(r.provider, r.model, r.input_tokens, r.output_tokens, table);
        actual_total += ce.input_usd + ce.output_usd;
    }
    const payload: Dict = {
        schema_version: SCHEMA_VERSION,
        mode: question.mode,
        prompt_mode: _getattr<string | null>(args, 'prompt_mode', null),
        prose_synthesis: _getattr<boolean | null>(args, 'prose_synthesis', null),
        peer_review_enabled: _peer_review_active(ai_cfg, args),
        artefact,
        original_ask: args.original_ask,
        members: members.map((m) => `${m.name}/${m.model}`),
        rounds,
        cost_usd_estimated: _pyRound(estimated_total, 6),
        cost_usd_actual: _pyRound(actual_total, 6),
        responses: _serialise_responses(responses),
    };
    if (peer_review !== null) {
        payload['peer_review'] = _serialise_peer_review(peer_review);
    }
    if (consensus !== null) {
        payload['consensus'] = _serialise_consensus(consensus);
    }
    const out_path = _validate_council_output_path(args.output as string, {
        kind: 'responses',
        subcommand: 'run',
    });
    fs.mkdirSync(path.dirname(_resolveTarget(out_path)), { recursive: true });
    fs.writeFileSync(_resolveTarget(out_path), _jsonDumpsIndent2(payload) + '\n', { encoding: 'utf-8' });
    _stdout(
        `\ncouncil:run · wrote ${out_path} ` +
            `(estimated $${_pyFixed(estimated_total, 4)} / actual $${_pyFixed(actual_total, 4)})\n`,
    );
    const replay_path = _maybe_write_decision_replay({
        ai_cfg,
        lens: question.mode,
        out_path: _resolveTarget(out_path),
        consensus,
        deliberation: responses,
        original_ask: args.original_ask,
    });
    if (replay_path !== null) {
        _stdout(`council:run · wrote ${replay_path}\n`);
    }
    const errors = responses.filter((r) => r.error);
    return errors.length > 0 && errors.length === responses.length ? 1 : 0;
}

function _debate_round_filename(round_number: number): string {
    return `debate-round-${round_number}.json`;
}

function _write_debate_round(
    out_dir: string,
    round_number: number,
    responses: CouncilResponse[],
    opts: {
        question: CouncilQuestion;
        members: ExternalAIClient[];
        artefact: string;
        original_ask: string;
        total_planned_rounds: number;
        table: PriceTable;
        prompt_mode: string | null;
        prose_synthesis: boolean | null;
    },
): string {
    fs.mkdirSync(_resolveTarget(out_dir), { recursive: true });
    let actual_total = 0.0;
    for (const r of responses) {
        if (r.error) {
            continue;
        }
        const ce = estimate_cost(r.provider, r.model, r.input_tokens, r.output_tokens, opts.table);
        actual_total += ce.input_usd + ce.output_usd;
    }
    const payload: Dict = {
        schema_version: SCHEMA_VERSION,
        mode: opts.question.mode,
        prompt_mode: opts.prompt_mode,
        prose_synthesis: opts.prose_synthesis,
        artefact: opts.artefact,
        original_ask: opts.original_ask,
        members: opts.members.map((m) => `${m.name}/${m.model}`),
        debate_round: round_number,
        debate_total_rounds: opts.total_planned_rounds,
        rounds: 1,
        cost_usd_actual: _pyRound(actual_total, 6),
        responses: _serialise_responses(responses),
    };
    const out_path = path.join(_resolveTarget(out_dir), _debate_round_filename(round_number));
    fs.writeFileSync(out_path, _jsonDumpsIndent2(payload) + '\n', { encoding: 'utf-8' });
    return out_path;
}

function _load_debate_seed(p: string, expected_members: ExternalAIClient[]): CouncilResponse[] {
    if (!fs.existsSync(p)) {
        throw new FileNotFoundError(`--continue-as-debate path not found: ${p}`);
    }
    const payload = JSON.parse(fs.readFileSync(p, 'utf-8')) as Dict;
    const source_members = ((payload['members'] as string[]) || []).slice();
    const expected_labels = expected_members.map((m) => `${m.name}/${m.model}`);
    if (!_listEq(source_members, expected_labels)) {
        throw new CouncilDisabledError(
            `--continue-as-debate member mismatch: source session has ` +
                `${_pyReprStrList(source_members)}, current invocation has ${_pyReprStrList(expected_labels)}. ` +
                `Re-run with matching members or drop --continue-as-debate.`,
        );
    }
    return _deserialise_responses((payload['responses'] as Dict[]) || []);
}

function _listEq(a: string[], b: string[]): boolean {
    if (a.length !== b.length) {
        return false;
    }
    return a.every((v, i) => v === b[i]);
}

function _make_debate_continue_prompt(opts: {
    auto_continue: boolean;
    stream?: ((s: string) => void) | null;
}): DebateContinueCallback | null {
    if (opts.auto_continue) {
        return null;
    }
    const out = opts.stream ?? _stdout;
    const _prompt = (checkpoint: DebateCheckpoint): boolean => {
        out(
            `\ndebate:checkpoint round=${checkpoint.completed_round}/` +
                `${checkpoint.total_planned_rounds} ` +
                `cost_so_far=$${_pyFixed(checkpoint.cost_so_far_usd, 4)} ` +
                `next_round_estimate=$${_pyFixed(checkpoint.next_round_estimate_usd, 4)} ` +
                `— continue? [y/N]: `,
        );
        // Non-interactive: a blank/EOF stdin read is treated as "N".
        const answer = _readStdinLine();
        return answer === 'y' || answer === 'yes';
    };
    return _prompt;
}

type DebateContinueCallback = (checkpoint: DebateCheckpoint) => boolean;

function _readStdinLine(): string {
    try {
        const buf = Buffer.alloc(4096);
        const fd = 0;
        const n = fs.readSync(fd, buf, 0, buf.length, null);
        return buf.toString('utf-8', 0, n).split('\n')[0]?.trim().toLowerCase() ?? '';
    } catch {
        return '';
    }
}

function cmd_debate(
    args: Args,
    opts: { settings?: Dict | null; members?: ExternalAIClient[] | null; table?: PriceTable | null } = {},
): number {
    let settings = opts.settings ?? null;
    let members = opts.members ?? null;
    let table = opts.table ?? null;
    if (settings === null) {
        settings = load_settings();
    }
    const ai_cfg = _isDict(settings) ? ((settings['ai_council'] as Dict) || {}) : {};
    const advisor_plans = _build_advisor_plans(ai_cfg, REPO_ROOT);
    const explicit_overrides = _parse_model_overrides(_getattr<string[] | null>(args, 'model', null));
    const skipped: Dict[] = [];
    if (members === null) {
        members = build_members(settings, {
            invocation_mode: args.mode_override,
            model_overrides: _advisor_model_overrides(advisor_plans, explicit_overrides),
            siblings_overrides: _parse_siblings_overrides(_getattr<string[] | null>(args, 'siblings', null)),
            skipped,
        });
    }
    if (table === null) {
        table = load_prices();
    }
    const [question, artefact] = build_question({
        input_path: args.question as string,
        input_mode: args.input_mode,
        max_tokens: _resolve_max_tokens(args, ai_cfg),
        prompt_mode_override: 'debate',
    });
    const [proceed, gate_exit] = _necessity_gate({
        prompt: question.user_prompt,
        lens: 'debate',
        invocation: _getattr(args, 'invocation', 'agent'),
        proceed_anyway: _getattr(args, 'proceed_anyway', false),
        ai_cfg,
        original_ask: _getattr(args, 'original_ask', '') || '',
    });
    if (!proceed) {
        return gate_exit;
    }
    _size_fit_gate({ prompt: question.user_prompt, lens: 'debate', members, ai_cfg });
    const project = detect_project_context(REPO_ROOT);
    const billable = members.filter((m) => _getattr(m, 'billable', true));

    const max_rounds_cap = _pyInt(ai_cfg['debate_max_rounds'] ?? 4, 4);
    const requested = _getattr(args, 'rounds', null) !== null ? _pyInt(args.rounds) : 2;
    if (requested < 1) {
        throw new ArgumentTypeError(`--rounds must be >= 1 (got ${requested})`);
    }
    if (requested > max_rounds_cap) {
        throw new ArgumentTypeError(
            `--rounds=${requested} exceeds debate_max_rounds=${max_rounds_cap}; ` +
                `raise the cap in ~/.event4u/agent-config/settings/.ai-council.yml or lower --rounds.`,
        );
    }
    const rounds = requested;

    const estimates = estimate(question, billable, table, {
        project,
        original_ask: args.original_ask,
        advisor_plans,
    });
    const per_round_usd = estimates.reduce((acc, e) => acc + _total_usd(e), 0.0);
    const projected_total = per_round_usd * rounds;
    _stdout(
        `council:debate · members=${members.length} (billable=${billable.length}) ` +
            `· rounds=${rounds} (cap=${max_rounds_cap})\n`,
    );
    const advisor_summary = _format_advisor_summary(advisor_plans, billable);
    if (advisor_summary) {
        _stdout(advisor_summary + '\n');
    }
    if (skipped.length > 0) {
        _stdout(format_install_hints(skipped) + '\n');
    }
    _stdout(format_estimate_table(billable, estimates) + '\n');
    _stdout(
        `  × ${rounds} rounds (worst case, before progressive disclosure)\n` +
            `  PROJECTED TOTAL:  $${_pyFixed(projected_total, 4)}\n`,
    );

    const debate_estimate = estimate_debate_cost(question, members, table, {
        rounds,
        project,
        original_ask: args.original_ask,
        advisor_plans,
    });
    const [disc_mode, disc_threshold, disc_show] = _resolve_cost_disclosure(ai_cfg, 'debate');
    const should_disclose =
        disc_mode === 'always' || (disc_mode === 'above_threshold' && debate_estimate.expected_usd > disc_threshold);
    if (should_disclose) {
        _stdout(_format_cost_disclosure(debate_estimate, { lens: 'debate', show_per_member: disc_show }));
    }
    const cap = _debate_refusal_cap(ai_cfg);
    if (cap > 0 && debate_estimate.high_usd > cap) {
        _stderr(
            `❌  council:debate refused · high-end estimate ` +
                `$${_pyFixed(debate_estimate.high_usd, 4)} exceeds ` +
                `debate.max_cost_usd=$${_pyFixed(cap, 2)}. Lower --rounds, drop ` +
                `members, or raise the cap in ~/.event4u/agent-config/settings/.ai-council.yml.\n`,
        );
        return 4;
    }

    if (!args.confirm) {
        _stdout(
            '\nNo --confirm flag — estimate only. Re-run with --confirm to ' + 'start the debate.\n',
        );
        return 0;
    }

    const cost_cfg = (ai_cfg['cost_budget'] as Dict) || {};
    const budget = new CostBudget({
        max_input_tokens: _pyInt(cost_cfg['max_input_tokens'] ?? 50_000, 50_000),
        max_output_tokens: _pyInt(cost_cfg['max_output_tokens'] ?? 20_000, 20_000),
        max_calls: _pyInt(cost_cfg['max_calls'] ?? 10, 10),
        max_total_usd: _pyFloat(cost_cfg['max_total_usd'] ?? 0.0, 0.0) || 0.0,
    });

    const out_dir = _validate_council_output_path(args.output as string, {
        kind: 'responses',
        subcommand: 'debate',
    });
    let seed: CouncilResponse[] | null = null;
    if (_getattr(args, 'continue_as_debate', null)) {
        seed = _load_debate_seed(args.continue_as_debate as string, billable);
        _stdout(
            `council:debate · seeding round 1 from ` +
                `${args.continue_as_debate} (${seed.length} responses)\n`,
        );
    }

    const written: string[] = [];

    const _on_round_complete = (round_number: number, results: CouncilResponse[]): void => {
        const p = _write_debate_round(out_dir, round_number, results, {
            question,
            members: members as ExternalAIClient[],
            artefact,
            original_ask: args.original_ask,
            total_planned_rounds: rounds,
            table: table as PriceTable,
            prompt_mode: 'debate',
            prose_synthesis: _getattr<boolean | null>(args, 'prose_synthesis', null),
        });
        written.push(p);
        const errors = results.filter((r) => r.error);
        _stdout(`council:debate · wrote ${p} ` + `(${results.length - errors.length}/${results.length} ok)\n`);
    };

    const on_continue = _make_debate_continue_prompt({
        auto_continue: Boolean(_getattr(args, 'auto_continue', false)),
    });

    let all_rounds: CouncilResponse[][];
    try {
        all_rounds = run_debate(members, question, {
            budget,
            table,
            project,
            original_ask: args.original_ask,
            max_rounds: rounds,
            on_round_complete: _on_round_complete,
            on_continue,
            advisor_plans,
            seed_round_1: seed,
        });
    } catch (exc) {
        if (exc instanceof DebateCapExceeded) {
            _stderr(
                `❌  council:debate cap reached after round ${exc.completed_round}: ` +
                    `${exc.message}\n` +
                    `Partial debate persisted under ${out_dir} ` +
                    `(${written.length} rounds).\n`,
            );
            return 3;
        }
        throw exc;
    }

    let actual_total = 0.0;
    for (const rnd of all_rounds) {
        for (const r of rnd) {
            if (r.error) {
                continue;
            }
            const ce = estimate_cost(r.provider, r.model, r.input_tokens, r.output_tokens, table);
            actual_total += ce.input_usd + ce.output_usd;
        }
    }
    _stdout(
        `\ncouncil:debate · ${all_rounds.length} round(s) complete · ` +
            `actual $${_pyFixed(actual_total, 4)} (cap projection $${_pyFixed(projected_total, 4)})\n`,
    );
    const last = all_rounds.length > 0 ? (all_rounds[all_rounds.length - 1] as CouncilResponse[]) : [];
    const errors_last = last.filter((r) => r.error);
    return errors_last.length > 0 && errors_last.length === last.length ? 1 : 0;
}

function cmd_render(args: Args): number {
    const payload = JSON.parse(fs.readFileSync(args.responses as string, 'utf-8')) as Dict;
    const items = (payload['responses'] as Dict[]) || [];
    const explicit = _getattr<string | null>(args, 'prompt_mode', null);
    const mode = explicit || (payload['prompt_mode'] as string | null) || (payload['mode'] as string | null);
    let prose = _getattr<boolean | null>(args, 'prose_synthesis', null);
    if (prose === null) {
        prose = (payload['prose_synthesis'] as boolean | null) ?? null;
    }
    const consensus = _deserialise_consensus(payload['consensus'] as Dict);
    const peer_review = _deserialise_peer_review(payload['peer_review'] as Dict);
    const body = render(_deserialise_responses(items), {
        mode: mode ?? null,
        prose_synthesis: prose,
        consensus,
        peer_review,
    });
    if (_getattr<string | null>(args, 'output', null)) {
        const out_path = _validate_council_output_path(args.output as string, {
            kind: 'sessions',
            subcommand: 'render',
        });
        fs.mkdirSync(path.dirname(_resolveTarget(out_path)), { recursive: true });
        fs.writeFileSync(_resolveTarget(out_path), body + '\n', { encoding: 'utf-8' });
        _stdout(`council:render · wrote ${out_path}\n`);
        return 0;
    }
    _stdout(body + '\n');
    return 0;
}

function _cmd_replay_low_impact_stats(args: Args): number {
    const li = _lowimpact;
    const responses_path = args.responses as string;
    const log_path = path.join(path.dirname(responses_path), 'low-impact-resolutions.md');
    if (!fs.existsSync(log_path)) {
        _stdout(
            'council:replay · no low-impact-resolutions.md alongside ' +
                `${responses_path} — session had no fast-path entries.\n`,
        );
        return 0;
    }
    const body = fs.readFileSync(log_path, 'utf-8');
    const stats = li.parse_low_impact_log(body);
    const out = li.render_low_impact_stats(stats);
    if (_getattr<string | null>(args, 'output', null)) {
        const target = _validate_council_output_path(args.output as string, {
            kind: 'sessions',
            subcommand: 'replay',
        });
        fs.mkdirSync(path.dirname(_resolveTarget(target)), { recursive: true });
        fs.writeFileSync(_resolveTarget(target), out, { encoding: 'utf-8' });
        _stdout(`council:replay · wrote ${target}\n`);
        return 0;
    }
    _stdout(out);
    return 0;
}

function cmd_replay(args: Args): number {
    if (_getattr(args, 'low_impact_stats', false)) {
        return _cmd_replay_low_impact_stats(args);
    }
    const payload = JSON.parse(fs.readFileSync(args.responses as string, 'utf-8')) as Dict;
    const consensus = _deserialise_consensus(payload['consensus'] as Dict);
    if (consensus === null) {
        _stderr(
            '❌  council:replay: payload has no `consensus` block — ' +
                'rerun with consensus_scoring enabled for this lens.\n',
        );
        return 2;
    }
    const deliberation = _deserialise_responses((payload['responses'] as Dict[]) || []);
    const include_args =
        args.include_member_arguments !== null && args.include_member_arguments !== undefined
            ? Boolean(args.include_member_arguments)
            : true;
    const body = render_decision_replay(
        new DecisionReplayInputs({
            findings: [...consensus.findings],
            scores: [...consensus.scores],
            metadata: new Map(consensus.metadata),
            deliberation,
            original_ask: String(payload['original_ask'] ?? ''),
            include_member_arguments: include_args,
        }),
    );
    if (_getattr<string | null>(args, 'output', null)) {
        const out_path = _validate_council_output_path(args.output as string, {
            kind: 'sessions',
            subcommand: 'replay',
        });
        fs.mkdirSync(path.dirname(_resolveTarget(out_path)), { recursive: true });
        fs.writeFileSync(_resolveTarget(out_path), body, { encoding: 'utf-8' });
        _stdout(`council:replay · wrote ${out_path}\n`);
    } else {
        _stdout(body);
    }
    return 0;
}

function cmd_shadow_report(args: Args): number {
    const sd = _shadow;
    const log_path = args.log ? args.log : sd.SHADOW_LOG_PATH;
    const [rate, n] = sd.compute_disagreement_rate(log_path, { windowDays: _pyInt(args.window_days, 7) });
    _stdout(sd.slo_banner(rate, n) + '\n');
    return 0;
}

function cmd_quota(args: Args, opts: { settings?: Dict | null } = {}): number {
    const s = opts.settings !== undefined && opts.settings !== null ? opts.settings : load_settings();
    const ai_cfg = _isDict(s) ? ((s['ai_council'] as Dict) || {}) : {};
    const cli_budget_cfg = _isDict(ai_cfg) ? ((ai_cfg['cli_call_budget'] as Dict) || {}) : {};
    const caps = _isDict(cli_budget_cfg) ? ((cli_budget_cfg['max_calls_per_day'] as Dict) || {}) : {};
    const warn_at = _isDict(cli_budget_cfg) ? _pyFloat(cli_budget_cfg['warn_at'] ?? 0.8, 0.8) : 0.8;

    if (_getattr<string | null>(args, 'reset', null)) {
        const provider = args.reset as string;
        if (!_getattr(args, 'confirm', false)) {
            _stderr(`❌  council:quota: --reset ${provider} requires --confirm.\n`);
            return 2;
        }
        reset_cli_call_counts(provider);
        _stdout(`council:quota · reset · ${provider}\n`);
        return 0;
    }

    const counts = load_cli_call_counts();
    if (Object.keys(caps).length === 0) {
        _stdout(
            'council:quota · no providers have a configured ' +
                'cli_call_budget.max_calls_per_day cap.\n',
        );
        return 0;
    }
    for (const provider of _pySortedStr(Object.keys(caps))) {
        const limit = _pyInt(caps[provider]);
        const used = _pyInt(counts[provider] ?? 0, 0);
        const ratio = limit > 0 ? used / limit : 0.0;
        let status = 'ok';
        if (used >= limit) {
            status = 'exhausted';
        } else if (ratio >= warn_at) {
            status = 'warn';
        }
        _stdout(`council:quota · ${provider} · ${used}/${limit} · ${status}\n`);
    }
    return 0;
}

// ── output-path validation ──────────────────────────────────────────

function _validate_council_output_path(
    path_str: string,
    opts: { kind: string; subcommand: string },
): string {
    const expected_rel = COUNCIL_CANONICAL_DIRS[opts.kind] as string;
    const expected_abs = _resolveReal(path.join(REPO_ROOT, expected_rel));
    const target = path.isAbsolute(path_str) ? path_str : path.join(REPO_ROOT, path_str);
    const target_resolved = _resolveReal(target);
    if (!_isRelativeTo(target_resolved, expected_abs)) {
        throw new ArgumentTypeError(
            `council:${opts.subcommand} --output must live under ` +
                `${expected_rel}/ (per ai-council § Output path convention); ` +
                `got ${_pyReprStr(path_str)}.`,
        );
    }
    // Python returns the original `Path(path_str)` (unresolved).
    return path_str;
}

/**
 * Resolve `--output` to the on-disk write target. The validator returns
 * the original (possibly relative) string for echo; writes anchor it to
 * `REPO_ROOT` when relative, mirroring Python `Path(path_str)` semantics
 * under the CLI's cwd-at-REPO_ROOT contract.
 */
function _resolveTarget(path_str: string): string {
    return path.isAbsolute(path_str) ? path_str : path.join(REPO_ROOT, path_str);
}

/** Python `Path.resolve()` — best-effort realpath, falls back to absolute. */
function _resolveReal(p: string): string {
    const abs = path.resolve(p);
    try {
        return fs.realpathSync(abs);
    } catch {
        return abs;
    }
}

/** Python `Path.relative_to` membership test (raises ValueError on failure). */
function _isRelativeTo(target: string, base: string): boolean {
    if (target === base) {
        return true;
    }
    const rel = path.relative(base, target);
    return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

// ── argparse parsing ────────────────────────────────────────────────

class FileNotFoundError extends Error {}

interface Args {
    cmd: string | null;
    question?: string | null;
    input_mode: string;
    prompt_mode: string | null;
    max_tokens: number | null;
    mode_override: string | null;
    model: string[] | null;
    siblings: string[] | null;
    original_ask: string;
    peer_review: boolean;
    // run / debate
    output?: string | null;
    confirm: boolean;
    rounds: number | null;
    depth: string;
    invocation: string;
    proceed_anyway: boolean;
    single: boolean;
    prose_synthesis: boolean | null;
    auto_continue: boolean;
    continue_as_debate: string | null;
    // render / replay
    responses?: string | null;
    include_member_arguments: boolean | null;
    low_impact_stats: boolean;
    // quota
    reset: string | null;
    // shadow-report
    log: string | null;
    window_days: number;
}

const _SUBCOMMANDS = ['estimate', 'run', 'debate', 'render', 'replay', 'quota', 'shadow-report'];

const _TOP_USAGE =
    `usage: ${_PROG} [-h]\n` +
    `                            {estimate,run,debate,render,replay,quota,shadow-report}\n` +
    `                            ...\n`;

function _topError(message: string): never {
    _stderr(_TOP_USAGE);
    _stderr(`${_PROG}: error: ${message}\n`);
    process.exitCode = 2;
    throw new _ArgExit();
}

function _subError(action: string, usage: string, message: string): never {
    _stderr(usage);
    _stderr(`${_PROG} ${action}: error: ${message}\n`);
    process.exitCode = 2;
    throw new _ArgExit();
}

function _defaultArgs(): Args {
    return {
        cmd: null,
        question: null,
        input_mode: 'prompt',
        prompt_mode: null,
        max_tokens: null,
        mode_override: null,
        model: null,
        siblings: null,
        original_ask: '',
        peer_review: false,
        output: null,
        confirm: false,
        rounds: null,
        depth: 'standard',
        invocation: 'agent',
        proceed_anyway: false,
        single: false,
        prose_synthesis: null,
        auto_continue: false,
        continue_as_debate: null,
        responses: null,
        include_member_arguments: null,
        low_impact_stats: false,
        reset: null,
        log: null,
        window_days: 7,
    };
}

/** Per-subcommand usage lines (first line only is asserted in tests). */
function _usageFor(cmd: string): string {
    return `usage: ${_PROG} ${cmd} [-h] ...\n`;
}

interface OptSpec {
    flag: string;
    takesValue: boolean;
    choices?: string[] | null;
    isInt?: boolean;
    apply: (out: Args, value: string | null) => void;
}

function _commonInputSpecs(): OptSpec[] {
    return [
        { flag: '--input-mode', takesValue: true, choices: ['prompt', 'roadmap'], apply: (o, v) => (o.input_mode = v as string) },
        { flag: '--prompt-mode', takesValue: true, choices: ['pr', 'design', 'optimize', 'analysis'], apply: (o, v) => (o.prompt_mode = v) },
        { flag: '--max-tokens', takesValue: true, isInt: true, apply: (o, v) => (o.max_tokens = v === null ? null : parseInt(v, 10)) },
        { flag: '--mode-override', takesValue: true, choices: ['api', 'manual'], apply: (o, v) => (o.mode_override = v) },
        { flag: '--model', takesValue: true, apply: (o, v) => { (o.model ??= []).push(v as string); } },
        { flag: '--siblings', takesValue: true, apply: (o, v) => { (o.siblings ??= []).push(v as string); } },
        { flag: '--original-ask', takesValue: true, apply: (o, v) => (o.original_ask = v as string) },
        { flag: '--peer-review', takesValue: false, apply: (o) => (o.peer_review = true) },
    ];
}

function _specsFor(cmd: string): { positionals: string[]; opts: OptSpec[]; requiredOpts: string[] } {
    const common = _commonInputSpecs();
    switch (cmd) {
        case 'estimate':
            return {
                positionals: ['question'],
                opts: [
                    ...common,
                    { flag: '--debate', takesValue: false, apply: (o) => (o.peer_review = o.peer_review) || ((o as Args & { debate?: boolean }).debate = true) },
                    { flag: '--rounds', takesValue: true, isInt: true, apply: (o, v) => (o.rounds = v === null ? null : parseInt(v, 10)) },
                ],
                requiredOpts: [],
            };
        case 'run':
            return {
                positionals: ['question'],
                opts: [
                    ...common,
                    { flag: '--output', takesValue: true, apply: (o, v) => (o.output = v) },
                    { flag: '--confirm', takesValue: false, apply: (o) => (o.confirm = true) },
                    { flag: '--rounds', takesValue: true, isInt: true, apply: (o, v) => (o.rounds = v === null ? null : parseInt(v, 10)) },
                    { flag: '--depth', takesValue: true, choices: ['standard', 'deep'], apply: (o, v) => (o.depth = v as string) },
                    { flag: '--invocation', takesValue: true, choices: ['agent', 'user_explicit'], apply: (o, v) => (o.invocation = v as string) },
                    { flag: '--proceed-anyway', takesValue: false, apply: (o) => (o.proceed_anyway = true) },
                    { flag: '--single', takesValue: false, apply: (o) => (o.single = true) },
                    { flag: '--prose-synthesis', takesValue: false, apply: (o) => (o.prose_synthesis = true) },
                    { flag: '--no-prose-synthesis', takesValue: false, apply: (o) => (o.prose_synthesis = false) },
                ],
                requiredOpts: ['--output'],
            };
        case 'debate':
            return {
                positionals: ['question'],
                opts: [
                    ...common,
                    { flag: '--output', takesValue: true, apply: (o, v) => (o.output = v) },
                    { flag: '--confirm', takesValue: false, apply: (o) => (o.confirm = true) },
                    { flag: '--rounds', takesValue: true, isInt: true, apply: (o, v) => (o.rounds = v === null ? null : parseInt(v, 10)) },
                    { flag: '--auto-continue', takesValue: false, apply: (o) => (o.auto_continue = true) },
                    { flag: '--continue-as-debate', takesValue: true, apply: (o, v) => (o.continue_as_debate = v) },
                    { flag: '--invocation', takesValue: true, choices: ['agent', 'user_explicit'], apply: (o, v) => (o.invocation = v as string) },
                    { flag: '--proceed-anyway', takesValue: false, apply: (o) => (o.proceed_anyway = true) },
                    { flag: '--prose-synthesis', takesValue: false, apply: (o) => (o.prose_synthesis = true) },
                    { flag: '--no-prose-synthesis', takesValue: false, apply: (o) => (o.prose_synthesis = false) },
                ],
                requiredOpts: ['--output'],
            };
        case 'render':
            return {
                positionals: ['responses'],
                opts: [
                    { flag: '--prompt-mode', takesValue: true, choices: ['default', 'pr', 'design', 'optimize', 'analysis', 'prompt', 'roadmap', 'diff', 'files'], apply: (o, v) => (o.prompt_mode = v) },
                    { flag: '--output', takesValue: true, apply: (o, v) => (o.output = v) },
                    { flag: '--prose-synthesis', takesValue: false, apply: (o) => (o.prose_synthesis = true) },
                    { flag: '--no-prose-synthesis', takesValue: false, apply: (o) => (o.prose_synthesis = false) },
                ],
                requiredOpts: [],
            };
        case 'replay':
            return {
                positionals: ['responses'],
                opts: [
                    { flag: '--output', takesValue: true, apply: (o, v) => (o.output = v) },
                    { flag: '--redact-member-arguments', takesValue: false, apply: (o) => (o.include_member_arguments = false) },
                    { flag: '--include-member-arguments', takesValue: false, apply: (o) => (o.include_member_arguments = true) },
                    { flag: '--low-impact-stats', takesValue: false, apply: (o) => (o.low_impact_stats = true) },
                ],
                requiredOpts: [],
            };
        case 'quota':
            return {
                positionals: [],
                opts: [
                    { flag: '--reset', takesValue: true, apply: (o, v) => (o.reset = v) },
                    { flag: '--confirm', takesValue: false, apply: (o) => (o.confirm = true) },
                ],
                requiredOpts: [],
            };
        case 'shadow-report':
            return {
                positionals: [],
                opts: [
                    { flag: '--log', takesValue: true, apply: (o, v) => (o.log = v) },
                    { flag: '--window-days', takesValue: true, isInt: true, apply: (o, v) => (o.window_days = v === null ? 7 : parseInt(v, 10)) },
                ],
                requiredOpts: [],
            };
        default:
            return { positionals: [], opts: [], requiredOpts: [] };
    }
}

function _parseArgs(argv: string[]): Args {
    const out = _defaultArgs();

    // Top-level: a required subcommand positional.
    if (argv.includes('-h') || argv.includes('--help')) {
        // --help anywhere before a subcommand prints top help (exit 0).
        if (argv.length === 0 || argv[0] === '-h' || argv[0] === '--help') {
            _stdout(_TOP_USAGE);
            process.exitCode = 0;
            throw new _ArgExit();
        }
    }
    if (argv.length === 0) {
        _topError('the following arguments are required: cmd');
    }
    const first = argv[0] as string;
    if (first.startsWith('-')) {
        // No subcommand chosen before a flag.
        _topError('the following arguments are required: cmd');
    }
    if (!_SUBCOMMANDS.includes(first)) {
        const choices = _SUBCOMMANDS.map((c) => `'${c}'`).join(', ');
        _topError(`argument cmd: invalid choice: '${first}' (choose from ${choices})`);
    }
    out.cmd = first;
    const rest = argv.slice(1);
    const usage = _usageFor(first);
    const { positionals, opts, requiredOpts } = _specsFor(first);

    // Sub-help.
    if (rest.includes('-h') || rest.includes('--help')) {
        _stdout(usage);
        process.exitCode = 0;
        throw new _ArgExit();
    }

    const optByFlag = new Map<string, OptSpec>();
    for (const o of opts) {
        optByFlag.set(o.flag, o);
    }
    const seenRequired = new Set<string>();
    const positionalValues: string[] = [];

    const valueOf = (token: string, flag: string, i: number): { value: string; nextI: number } => {
        const eqPrefix = `${flag}=`;
        if (token.startsWith(eqPrefix)) {
            return { value: token.slice(eqPrefix.length), nextI: i };
        }
        const next = rest[i + 1];
        if (next === undefined) {
            _subError(first, usage, `argument ${flag}: expected one argument`);
        }
        return { value: next, nextI: i + 1 };
    };

    for (let i = 0; i < rest.length; i++) {
        const token = rest[i] as string;
        if (token.startsWith('--')) {
            const flagName = token.includes('=') ? token.slice(0, token.indexOf('=')) : token;
            const spec = optByFlag.get(flagName);
            if (spec === undefined) {
                // argparse bubbles unrecognized args to the TOP parser.
                _topError(`unrecognized arguments: ${token}`);
            }
            if (!spec.takesValue) {
                if (token.includes('=')) {
                    _subError(first, usage, `argument ${flagName}: ignored explicit argument '${token.slice(token.indexOf('=') + 1)}'`);
                }
                spec.apply(out, null);
                if (requiredOpts.includes(flagName)) {
                    seenRequired.add(flagName);
                }
                continue;
            }
            const { value, nextI } = valueOf(token, flagName, i);
            i = nextI;
            if (spec.choices && !spec.choices.includes(value)) {
                const choices = spec.choices.map((c) => `'${c}'`).join(', ');
                _subError(first, usage, `argument ${flagName}: invalid choice: '${value}' (choose from ${choices})`);
            }
            if (spec.isInt && !_isIntLiteral(value)) {
                _subError(first, usage, `argument ${flagName}: invalid int value: '${value}'`);
            }
            spec.apply(out, value);
            if (requiredOpts.includes(flagName)) {
                seenRequired.add(flagName);
            }
        } else if (token.startsWith('-') && token !== '-') {
            _topError(`unrecognized arguments: ${token}`);
        } else {
            positionalValues.push(token);
        }
    }

    // Assign positionals.
    if (positionalValues.length < positionals.length) {
        const missing = positionals.slice(positionalValues.length);
        _subError(first, usage, `the following arguments are required: ${missing.join(', ')}`);
    }
    if (positionalValues.length > positionals.length) {
        const extra = positionalValues.slice(positionals.length);
        _topError(`unrecognized arguments: ${extra.join(' ')}`);
    }
    for (let j = 0; j < positionals.length; j++) {
        const name = positionals[j] as string;
        (out as unknown as Dict)[name] = positionalValues[j];
    }

    // Required options.
    const missingReq = requiredOpts.filter((f) => !seenRequired.has(f));
    if (missingReq.length > 0) {
        _subError(first, usage, `the following arguments are required: ${missingReq.join(', ')}`);
    }

    return out;
}

/** Mirror argparse `type=int`: accept an optionally-signed integer literal. */
function _isIntLiteral(s: string): boolean {
    return /^[+-]?\d+$/.test(s.trim());
}

function _parse_model_overrides(items: string[] | null): Record<string, string> {
    const out: Record<string, string> = {};
    for (const raw of items || []) {
        if (!raw.includes('=')) {
            throw new ArgumentTypeError(`--model expects '<member>=<model-id>', got ${_pyReprStr(raw)}.`);
        }
        const idx = raw.indexOf('=');
        const name = raw.slice(0, idx).trim();
        const model = raw.slice(idx + 1).trim();
        if (!name || !model) {
            throw new ArgumentTypeError(`--model member and model-id must both be non-empty: ${_pyReprStr(raw)}.`);
        }
        out[name] = model;
    }
    return out;
}

function _parse_siblings_overrides(items: string[] | null): Record<string, string[]> {
    const out: Record<string, string[]> = {};
    for (const raw of items || []) {
        if (!raw.includes('=')) {
            throw new ArgumentTypeError(`--siblings expects '<member>=<model1>,<model2>[,...]', got ${_pyReprStr(raw)}.`);
        }
        const idx = raw.indexOf('=');
        const name = raw.slice(0, idx).trim();
        const models = raw
            .slice(idx + 1)
            .split(',')
            .map((m) => m.trim())
            .filter((m) => m.length > 0);
        if (!name || models.length === 0) {
            throw new ArgumentTypeError(`--siblings member and model list must both be non-empty: ${_pyReprStr(raw)}.`);
        }
        if (new Set(models).size < 2) {
            throw new ArgumentTypeError(`--siblings requires ≥ 2 distinct models for ${_pyReprStr(name)}, got ${_pyReprStrList(models)}.`);
        }
        if (name in out) {
            throw new ArgumentTypeError(`--siblings repeated for member ${_pyReprStr(name)}; combine into one flag.`);
        }
        out[name] = models;
    }
    return out;
}

function _isFileNotFound(exc: unknown): boolean {
    return (
        exc instanceof FileNotFoundError ||
        (exc instanceof Error && (exc as NodeJS.ErrnoException).code === 'ENOENT')
    );
}

// ── main ────────────────────────────────────────────────────────────

function main(argv: string[] | null = null): number {
    const args = _parseArgs(argv ?? process.argv.slice(2));
    try {
        if (args.cmd === 'estimate') {
            return cmd_estimate(args);
        }
        if (args.cmd === 'run') {
            return cmd_run(args);
        }
        if (args.cmd === 'debate') {
            return cmd_debate(args);
        }
        if (args.cmd === 'render') {
            return cmd_render(args);
        }
        if (args.cmd === 'replay') {
            return cmd_replay(args);
        }
        if (args.cmd === 'quota') {
            return cmd_quota(args);
        }
        if (args.cmd === 'shadow-report') {
            return cmd_shadow_report(args);
        }
    } catch (exc) {
        if (exc instanceof CouncilDisabledError) {
            _stderr(`❌  council:${args.cmd}: ${exc.message}\n`);
            return 2;
        }
        if (
            exc instanceof BundleTooLarge ||
            exc instanceof InvalidModeError ||
            exc instanceof FileNotFoundError ||
            exc instanceof ArgumentTypeError ||
            exc instanceof ValueError ||
            _isFileNotFound(exc)
        ) {
            _stderr(`❌  council:${args.cmd}: ${(exc as Error).message}\n`);
            return 2;
        }
        throw exc;
    }
    return 1;
}

// CLI entry.
const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1] as string)).href;

if (_isCliEntry) {
    try {
        process.exitCode = main(process.argv.slice(2));
    } catch (err) {
        if (!(err instanceof _ArgExit)) {
            throw err;
        }
        // process.exitCode already set by the argparse-style error path.
    }
}

export {
    main,
    build_members,
    build_question,
    cmd_estimate,
    cmd_run,
    cmd_debate,
    cmd_render,
    cmd_replay,
    cmd_quota,
    cmd_shadow_report,
    load_settings,
    format_estimate_table,
    _parse_model_overrides,
    _parse_siblings_overrides,
    _synthesize_ai_council_block,
    CouncilDisabledError,
};
