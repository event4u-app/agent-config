#!/usr/bin/env node
/**
 * Skill trigger evaluation runner.
 *
 * TypeScript twin of `src/scripts/skill_trigger_eval.py` (ADR-200,
 * Phase 8 / Wave 8b). The public surface, CLI contract, exit codes,
 * stdout/stderr split, byte-for-byte messages, the on-disk key gate
 * (0600 + `sk-ant-` prefix), the controlling-terminal confirmation gate,
 * and the written JSON (Python `json.dumps(asdict(result), indent=2)` +
 * trailing newline) mirror the Python original EXACTLY. No behaviour
 * changes.
 *
 * Design notes preserved:
 * - The real Anthropic client is a soft dependency; only --dry-run works
 *   without it (mock router).
 * - The router is injectable — tests use a MockRouter / fake client.
 * - The full skill catalogue (name + description) is passed to every
 *   routing call — the production routing condition.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { artefact_roots, resolve_logical } from './_lib/agent_src.js';
import * as user_global_paths from './_lib/user_global_paths.js';

const _HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(_HERE, '..', '..');
const SKILLS_SOURCE = path.join(PROJECT_ROOT, '.agent-src.uncondensed', 'skills');
const RESULTS_DIR = path.join(PROJECT_ROOT, 'internal', 'evals', 'results');
export const DEFAULT_MODEL = 'claude-sonnet-4-5';

export const PRICE_PER_MTOK_IN: Record<string, number> = {
    'claude-sonnet-4-5': 3.0,
    'claude-opus-4': 15.0,
};
export const PRICE_PER_MTOK_OUT: Record<string, number> = {
    'claude-sonnet-4-5': 15.0,
    'claude-opus-4': 75.0,
};

export const ANTHROPIC_KEY_FILENAME = 'anthropic.key';
export const ANTHROPIC_KEY_PATH =
    user_global_paths.resolve_with_fallback(ANTHROPIC_KEY_FILENAME) ??
    user_global_paths.write_target(ANTHROPIC_KEY_FILENAME);

const TOKENS_PER_CHAR = 0.25;
const PROMPT_OVERHEAD_TOKENS = 200;
const OUTPUT_TOKENS_PER_QUERY = 60;

export class KeyGateError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'KeyGateError';
    }
}

export class ConfirmationAborted extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ConfirmationAborted';
    }
}

export interface SkillMeta {
    name: string;
    description: string;
}

export function SkillMeta(name: string, description: string): SkillMeta {
    return { name, description };
}

export interface Query {
    q: string;
    trigger: boolean;
}

export function Query(q: string, trigger: boolean): Query {
    return { q, trigger };
}

export interface QueryResult {
    q: string;
    expected: boolean;
    observed: boolean;
    loaded_skills: string[];
    passed: boolean;
}

export interface Metrics {
    true_positive: number;
    false_positive: number;
    true_negative: number;
    false_negative: number;
    precision: number;
    recall: number;
}

function _newMetrics(): Metrics {
    return {
        true_positive: 0,
        false_positive: 0,
        true_negative: 0,
        false_negative: 0,
        precision: 0.0,
        recall: 0.0,
    };
}

export interface EvalResult {
    skill: string;
    model: string;
    timestamp: string;
    router: string;
    queries: QueryResult[];
    metrics: Metrics;
    input_tokens: number;
    output_tokens: number;
    cost_usd_estimate: number;
}

/** Router contract: (loaded_skill_names, input_tokens, output_tokens). */
export interface TriggerRouter {
    name: string;
    route(query: string, skills: SkillMeta[]): [string[], number, number];
}

export class MockRouter implements TriggerRouter {
    name = 'mock';
    private _decide: (query: string, skills: SkillMeta[]) => string[];

    constructor(decide: (query: string, skills: SkillMeta[]) => string[]) {
        this._decide = decide;
    }

    route(query: string, skills: SkillMeta[]): [string[], number, number] {
        const loaded = this._decide(query, skills);
        return [loaded, Math.floor(query.length / 4) + skills.length * 20, 16];
    }
}

function _isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

/** Python-string ordering (codepoint). */
function pyStrCmp(a: string, b: string): number {
    return a < b ? -1 : a > b ? 1 : 0;
}

export function load_skill_metas(root: string | null = null): SkillMeta[] {
    let roots: string[];
    if (root !== null) {
        roots = [root];
    } else {
        roots = artefact_roots().map((r) => path.join(r, 'skills'));
    }
    const metas: SkillMeta[] = [];
    const seen = new Set<string>();
    for (const skillsDir of roots) {
        if (!_isDir(skillsDir)) {
            continue;
        }
        // sorted(p for p in skills_dir.iterdir() if p.is_dir())
        let entries: string[];
        try {
            entries = fs.readdirSync(skillsDir).map((n) => path.join(skillsDir, n));
        } catch {
            continue;
        }
        const dirs = entries.filter((p) => _isDir(p));
        dirs.sort(pyStrCmp);
        for (const skillDir of dirs) {
            const skillMd = path.join(skillDir, 'SKILL.md');
            if (!_exists(skillMd)) {
                continue;
            }
            const meta = _parse_frontmatter(skillMd);
            if (meta !== null && !seen.has(meta.name)) {
                metas.push(meta);
                seen.add(meta.name);
            }
        }
    }
    return metas;
}

export function _parse_frontmatter(p: string): SkillMeta | null {
    const text = fs.readFileSync(p, 'utf-8');
    if (!text.startsWith('---')) {
        return null;
    }
    const end = text.indexOf('\n---', 3);
    if (end < 0) {
        return null;
    }
    const block = text.slice(3, end);
    const name = _extract_field(block, 'name');
    const desc = _extract_field(block, 'description');
    if (name === null || desc === null) {
        return null;
    }
    return SkillMeta(name, desc);
}

export function _extract_field(block: string, field_name: string): string | null {
    const prefix = `${field_name}:`;
    for (const line of block.split('\n')) {
        const stripped = _lstrip(line);
        if (!stripped.startsWith(prefix)) {
            continue;
        }
        let value = stripped.slice(prefix.length).trim();
        if (value.startsWith('"') && value.endsWith('"')) {
            value = value.slice(1, -1);
        } else if (value.startsWith("'") && value.endsWith("'")) {
            value = value.slice(1, -1);
        }
        return value;
    }
    return null;
}

function _lstrip(s: string): string {
    return s.replace(/^\s+/, '');
}

export function load_triggers(p: string): [string, Query[]] {
    const data = JSON.parse(fs.readFileSync(p, 'utf-8')) as {
        skill: string;
        queries: Array<{ q: string; trigger: unknown }>;
    };
    const skill = data['skill'];
    const queries = data['queries'].map((item) => Query(item['q'], Boolean(item['trigger'])));
    if (!queries.length) {
        throw new ValueError(`${p} has zero queries; roadmap minimum is 10`);
    }
    return [skill, queries];
}

/** Python ValueError equivalent (test matches `pytest.raises(ValueError)`). */
export class ValueError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ValueError';
    }
}

export function run_eval(
    skill_name: string,
    queries: Query[],
    router: TriggerRouter,
    skills: SkillMeta[],
    model: string = DEFAULT_MODEL,
): EvalResult {
    const result: EvalResult = {
        skill: skill_name,
        model,
        timestamp: _isoSeconds(),
        router: router.name,
        queries: [],
        metrics: _newMetrics(),
        input_tokens: 0,
        output_tokens: 0,
        cost_usd_estimate: 0.0,
    };
    for (const q of queries) {
        const [loaded, inTok, outTok] = router.route(q.q, skills);
        const observed = loaded.includes(skill_name);
        const passed = observed === q.trigger;
        result.queries.push({
            q: q.q,
            expected: q.trigger,
            observed,
            loaded_skills: [...loaded].sort(pyStrCmp),
            passed,
        });
        result.input_tokens += inTok;
        result.output_tokens += outTok;
    }
    result.metrics = compute_metrics(result.queries);
    result.cost_usd_estimate = estimate_cost(model, result.input_tokens, result.output_tokens);
    return result;
}

/** Mirror `datetime.now(timezone.utc).isoformat(timespec="seconds")`. */
function _isoSeconds(): string {
    const d = new Date();
    const pad = (n: number): string => String(n).padStart(2, '0');
    return (
        `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
        `T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}+00:00`
    );
}

/** Python `round(x, 3)` banker's rounding for precision/recall. */
function pyRound3(value: number): number {
    return _pyRound(value, 3);
}

function _pyRound(value: number, ndigits: number): number {
    if (!Number.isFinite(value) || value === 0) {
        return value;
    }
    const sign = value < 0 ? -1 : 1;
    const abs = Math.abs(value);
    const str = abs.toPrecision(17);
    if (str.includes('e') || str.includes('E')) {
        const factor = 10 ** ndigits;
        return (Math.round(abs * factor) / factor) * sign;
    }
    const dot = str.indexOf('.');
    const intPart = dot === -1 ? str : str.slice(0, dot);
    let fracPart = dot === -1 ? '' : str.slice(dot + 1);
    while (fracPart.length <= ndigits) {
        fracPart += '0';
    }
    const keepFrac = fracPart.slice(0, ndigits);
    const deciderStr = fracPart.slice(ndigits);
    const scaledIntStr = intPart + keepFrac;
    let scaledInt = BigInt(scaledIntStr === '' ? '0' : scaledIntStr);
    const firstDecider = deciderStr.charAt(0);
    const restNonZero = /[1-9]/.test(deciderStr.slice(1));
    let roundUp = false;
    if (firstDecider > '5' || (firstDecider === '5' && restNonZero)) {
        roundUp = true;
    } else if (firstDecider === '5' && !restNonZero) {
        roundUp = scaledInt % 2n === 1n;
    }
    if (roundUp) {
        scaledInt += 1n;
    }
    const factor = 10 ** ndigits;
    return (Number(scaledInt) / factor) * sign;
}

export function compute_metrics(results: QueryResult[]): Metrics {
    const tp = results.filter((r) => r.expected && r.observed).length;
    const fp = results.filter((r) => !r.expected && r.observed).length;
    const tn = results.filter((r) => !r.expected && !r.observed).length;
    const fn = results.filter((r) => r.expected && !r.observed).length;
    const precision = tp + fp ? tp / (tp + fp) : 0.0;
    const recall = tp + fn ? tp / (tp + fn) : 0.0;
    return {
        true_positive: tp,
        false_positive: fp,
        true_negative: tn,
        false_negative: fn,
        precision: pyRound3(precision),
        recall: pyRound3(recall),
    };
}

export function estimate_cost(model: string, in_tokens: number, out_tokens: number): number {
    const priceIn = PRICE_PER_MTOK_IN[model] ?? 3.0;
    const priceOut = PRICE_PER_MTOK_OUT[model] ?? 15.0;
    const cost = (in_tokens / 1_000_000) * priceIn + (out_tokens / 1_000_000) * priceOut;
    return _pyRound(cost, 6);
}

export function pre_estimate_cost(
    model: string,
    skills: SkillMeta[],
    queries: Query[],
): [number, number, number] {
    let catalogueChars = 0;
    for (const s of skills) {
        catalogueChars += s.name.length + s.description.length + 6;
    }
    const perQueryChars = catalogueChars + PROMPT_OVERHEAD_TOKENS * 4;
    let inTokensPerQ = Math.trunc(perQueryChars * TOKENS_PER_CHAR) + PROMPT_OVERHEAD_TOKENS;
    const avgQueryChars = Math.floor(
        queries.reduce((acc, q) => acc + q.q.length, 0) / Math.max(queries.length, 1),
    );
    inTokensPerQ += Math.trunc(avgQueryChars * TOKENS_PER_CHAR);
    const inTokens = inTokensPerQ * queries.length;
    const outTokens = OUTPUT_TOKENS_PER_QUERY * queries.length;
    return [inTokens, outTokens, estimate_cost(model, inTokens, outTokens)];
}

// ── Key gate ─────────────────────────────────────────────────────────────

export function load_anthropic_key(p: string = ANTHROPIC_KEY_PATH): string {
    if (!_exists(p)) {
        throw new KeyGateError(
            `Anthropic key not found at ${p}.\n` +
                `    Install it with: bash scripts/install_anthropic_key.sh`,
        );
    }
    const st = fs.statSync(p);
    const mode = st.mode & 0o777;
    if (mode !== 0o600) {
        throw new KeyGateError(
            `Unsafe permissions on ${p}: got ${_octRepr(mode)}, expected 0o600.\n` +
                `    Fix:  chmod 600 ${p}`,
        );
    }
    const key = fs.readFileSync(p, 'utf-8').trim();
    if (!key) {
        throw new KeyGateError(`${p} is empty.`);
    }
    if (!key.startsWith('sk-ant-')) {
        throw new KeyGateError(
            `${p} does not contain an Anthropic key (expected 'sk-ant-' prefix).`,
        );
    }
    return key;
}

/** Mirror Python `oct(mode)` (e.g. `0o640`). */
function _octRepr(mode: number): string {
    return `0o${mode.toString(8)}`;
}

// ── Confirmation gate ────────────────────────────────────────────────────

export function build_confirmation_summary(opts: {
    model: string;
    skill: string;
    query_count: number;
    catalogue_size: number;
    input_tokens: number;
    output_tokens: number;
    cost_usd: number;
    key_path: string;
}): string {
    const bar = '═'.repeat(56);
    return (
        `${bar}\n` +
        `  Trigger Eval — Confirmation Required\n` +
        `${bar}\n` +
        `  Model:       ${opts.model}\n` +
        `  Skill:       ${opts.skill}\n` +
        `  Queries:     ${opts.query_count}\n` +
        `  Catalogue:   ${opts.catalogue_size} skills in routing prompt\n` +
        `  Est. tokens: in≈${_pyGroup(opts.input_tokens)}  out≈${_pyGroup(opts.output_tokens)}\n` +
        `  Est. cost:   ~$${opts.cost_usd.toFixed(2)} USD (actual via API headers)\n` +
        `  Key source:  ${opts.key_path}\n` +
        `${bar}`
    );
}

/** Python `f"{n:,}"` thousands grouping. */
function _pyGroup(value: number): string {
    const neg = value < 0;
    const digits = Math.abs(Math.trunc(value)).toString();
    let out = '';
    for (let i = 0; i < digits.length; i++) {
        if (i > 0 && (digits.length - i) % 3 === 0) {
            out += ',';
        }
        out += digits[i];
    }
    return neg ? `-${out}` : out;
}

/**
 * Minimal text-stream shapes for the test-injection path of
 * `require_confirmation`. Production path reads /dev/tty directly.
 */
export interface InStream {
    isatty?: () => boolean;
    readline: () => string;
}
export interface OutStream {
    write: (data: string) => void;
    flush?: () => void;
}

export function require_confirmation(
    summary: string,
    opts: { stdin?: InStream | null; stdout?: OutStream | null } = {},
): void {
    const stdin = opts.stdin ?? null;
    const stdout = opts.stdout ?? null;
    let answer: string;
    if (stdin === null && stdout === null) {
        // Production path: controlling-terminal-only.
        let fdIn: number;
        let fdOut: number;
        try {
            fdIn = fs.openSync('/dev/tty', 'r');
            fdOut = fs.openSync('/dev/tty', 'w');
        } catch (exc) {
            throw new ConfirmationAborted(
                'Confirmation requires a controlling terminal (/dev/tty). ' +
                    'Refusing to run under automation.',
            );
        }
        try {
            fs.writeSync(fdOut, summary + '\n');
            fs.writeSync(fdOut, "Proceed? [type 'yes' exactly to run, anything else aborts]: ");
            answer = _readLineFd(fdIn).replace(/\n$/, '');
        } finally {
            fs.closeSync(fdIn);
            fs.closeSync(fdOut);
        }
    } else {
        // Test path — both streams must be supplied.
        if (stdin === null || stdout === null) {
            throw new Error(
                'require_confirmation: stdin and stdout must both be supplied ' +
                    'when overriding defaults (test-only path).',
            );
        }
        const tty = (stdin.isatty ?? (() => false))();
        if (!tty) {
            throw new ConfirmationAborted(
                'Confirmation requires an interactive tty on stdin. ' +
                    'Refusing non-interactive, piped, or redirected input.',
            );
        }
        stdout.write(summary + '\n');
        stdout.write("Proceed? [type 'yes' exactly to run, anything else aborts]: ");
        stdout.flush?.();
        answer = stdin.readline().replace(/\n$/, '');
    }

    if (answer !== 'yes') {
        throw new ConfirmationAborted(`Aborted at confirmation (got ${_pyRepr(answer)}).`);
    }
}

/** Read a single line from a file descriptor (byte-by-byte until \n / EOF). */
function _readLineFd(fd: number): string {
    const buf = Buffer.alloc(1);
    let line = '';
    for (;;) {
        let n: number;
        try {
            n = fs.readSync(fd, buf, 0, 1, null);
        } catch {
            break;
        }
        if (n === 0) {
            break;
        }
        const ch = buf.toString('utf-8');
        line += ch;
        if (ch === '\n') {
            break;
        }
    }
    return line;
}

/** Python `repr(str)` for the abort message (prefers single quotes). */
function _pyRepr(s: string): string {
    if (s.includes("'") && !s.includes('"')) {
        return `"${s}"`;
    }
    return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

export function write_result(result: EvalResult, output_path: string): void {
    fs.mkdirSync(path.dirname(output_path), { recursive: true });
    const payload = _asdict(result);
    fs.writeFileSync(output_path, _jsonDumpsIndent2(payload) + '\n', 'utf-8');
}

/**
 * Marker for a Python `float` value, so `json.dumps` parity emits a
 * trailing `.0` for integral floats (`1.0`, not `1`). precision / recall /
 * cost_usd_estimate are Python floats; everything else is int / str / bool.
 */
class PyFloat {
    constructor(readonly value: number) {}
}

/** Mirror `dataclasses.asdict(result)` ordering. */
function _asdict(result: EvalResult): Record<string, unknown> {
    return {
        skill: result.skill,
        model: result.model,
        timestamp: result.timestamp,
        router: result.router,
        queries: result.queries.map((q) => ({
            q: q.q,
            expected: q.expected,
            observed: q.observed,
            loaded_skills: q.loaded_skills,
            passed: q.passed,
        })),
        metrics: {
            true_positive: result.metrics.true_positive,
            false_positive: result.metrics.false_positive,
            true_negative: result.metrics.true_negative,
            false_negative: result.metrics.false_negative,
            precision: new PyFloat(result.metrics.precision),
            recall: new PyFloat(result.metrics.recall),
        },
        input_tokens: result.input_tokens,
        output_tokens: result.output_tokens,
        cost_usd_estimate: new PyFloat(result.cost_usd_estimate),
    };
}

/**
 * Mirror `json.dumps(obj, indent=2)` (ensure_ascii=True default, item
 * separator "," / key separator ": "). Floats render as Python `repr`.
 */
function _jsonDumpsIndent2(obj: unknown): string {
    return _jdump(obj, 0);
}

function _jdump(obj: unknown, depth: number): string {
    const pad = '  '.repeat(depth);
    const padIn = '  '.repeat(depth + 1);
    if (obj === null) {
        return 'null';
    }
    if (obj instanceof PyFloat) {
        return _jsonFloat(obj.value);
    }
    if (typeof obj === 'boolean') {
        return obj ? 'true' : 'false';
    }
    if (typeof obj === 'number') {
        return _jsonNumber(obj);
    }
    if (typeof obj === 'string') {
        return _jsonStrAscii(obj);
    }
    if (Array.isArray(obj)) {
        if (obj.length === 0) {
            return '[]';
        }
        const items = obj.map((v) => padIn + _jdump(v, depth + 1));
        return '[\n' + items.join(',\n') + '\n' + pad + ']';
    }
    const entries = Object.entries(obj as Record<string, unknown>);
    if (entries.length === 0) {
        return '{}';
    }
    const lines = entries.map(([k, v]) => `${padIn}${_jsonStrAscii(k)}: ${_jdump(v, depth + 1)}`);
    return '{\n' + lines.join(',\n') + '\n' + pad + '}';
}

function _jsonNumber(n: number): string {
    return String(n);
}

/** json.dumps of a Python float — integral floats keep a `.0` suffix. */
function _jsonFloat(n: number): string {
    if (Number.isInteger(n)) {
        return `${n}.0`;
    }
    return String(n);
}

/** Mirror json.dumps string escaping with ensure_ascii=True. */
function _jsonStrAscii(s: string): string {
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
            out += '\\u' + code.toString(16).padStart(4, '0');
        } else if (code < 0x7f) {
            out += ch;
        } else if (code <= 0xffff) {
            out += '\\u' + code.toString(16).padStart(4, '0');
        } else {
            // Surrogate pair (ensure_ascii encodes as \uXXXX\uXXXX).
            const high = Math.floor((code - 0x10000) / 0x400) + 0xd800;
            const low = ((code - 0x10000) % 0x400) + 0xdc00;
            out += '\\u' + high.toString(16).padStart(4, '0');
            out += '\\u' + low.toString(16).padStart(4, '0');
        }
    }
    return out + '"';
}

export function format_summary(result: EvalResult): string {
    const m = result.metrics;
    const total = result.queries.length;
    const passCount = result.queries.filter((r) => r.passed).length;
    const failCount = total - passCount;
    const lines = [
        `Skill:     ${result.skill}`,
        `Router:    ${result.router}    Model: ${result.model}`,
        `Queries:   ${total}  (${passCount} pass, ${failCount} fail)`,
        `Precision: ${_pyNum(m.precision)}  (TP=${m.true_positive} FP=${m.false_positive})`,
        `Recall:    ${_pyNum(m.recall)}  (TP=${m.true_positive} FN=${m.false_negative})`,
        `Tokens:    in=${result.input_tokens}  out=${result.output_tokens}  ` +
            `cost~$${_pyNum(result.cost_usd_estimate)}`,
    ];
    if (failCount) {
        lines.push('');
        lines.push('Failures:');
        for (const r of result.queries) {
            if (r.passed) {
                continue;
            }
            lines.push(
                `  [${r.expected ? 'FN' : 'FP'}] expected=${_pyBool(r.expected)} ` +
                    `observed=${_pyBool(r.observed)} :: ${r.q}`,
            );
        }
    }
    return lines.join('\n');
}

/** Python `str(float|int)` for f-string interpolation. */
function _pyNum(value: number): string {
    if (Number.isInteger(value)) {
        // A metric like precision=1.0 prints "1.0"; cost like 0 prints "0"
        // only when it is a true int. precision/recall/cost are floats in
        // Python, so whole values render with a trailing ".0".
        return `${value}.0`;
    }
    return String(value);
}

/** Python `str(bool)`. */
function _pyBool(b: boolean): string {
    return b ? 'True' : 'False';
}

export const ROUTING_PROMPT_HEADER = `You are a skill-routing oracle. Given the catalogue below
and a single user query, return ONLY the JSON object {"would_load": [...]}
listing the skill names whose bodies you would load to answer the query.

Rules:
- Use the skill frontmatter description verbatim as the only routing signal.
- Return at most 4 skill names.
- If no skill applies, return {"would_load": []}.
- Output ONLY the JSON. No prose, no code fences.

Skill catalogue (name :: description):
`;

interface AnthropicClientLike {
    messages: {
        create: (kwargs: Record<string, unknown>) => unknown;
    };
}

export class AnthropicRouter implements TriggerRouter {
    name = 'anthropic';
    private _model: string;
    private _max_tokens: number;
    private _client: AnthropicClientLike;

    constructor(opts: {
        model?: string;
        client?: AnthropicClientLike | null;
        max_tokens?: number;
        api_key?: string | null;
    } = {}) {
        this._model = opts.model ?? DEFAULT_MODEL;
        this._max_tokens = opts.max_tokens ?? 256;
        if (opts.client !== undefined && opts.client !== null) {
            this._client = opts.client;
            return;
        }
        if (opts.api_key === undefined || opts.api_key === null) {
            throw new Error(
                'AnthropicRouter requires an explicit api_key or an injected client. ' +
                    'Load the key with load_anthropic_key() — no env-var fallback.',
            );
        }
        // anthropic package not installed in this runtime → mirror the
        // ImportError path. (Real-key live runs are out of CI scope.)
        throw new Error(
            'anthropic package not installed. ' +
                '`pip install anthropic` or run with --dry-run.',
        );
    }

    route(query: string, skills: SkillMeta[]): [string[], number, number] {
        const catalogue = skills.map((s) => `- ${s.name} :: ${s.description}`).join('\n');
        const prompt = ROUTING_PROMPT_HEADER + catalogue + '\n';
        const response = this._client.messages.create({
            model: this._model,
            max_tokens: this._max_tokens,
            system: prompt,
            messages: [{ role: 'user', content: query }],
        });
        const text = _first_text_block(response);
        const loaded = _parse_would_load(text);
        const usage = (response as { usage?: unknown }).usage;
        const inTok = usage ? ((usage as { input_tokens?: number }).input_tokens ?? 0) : 0;
        const outTok = usage ? ((usage as { output_tokens?: number }).output_tokens ?? 0) : 0;
        return [loaded, inTok, outTok];
    }
}

export function _first_text_block(response: unknown): string {
    const content = (response as { content?: unknown }).content;
    if (!content || !Array.isArray(content) || content.length === 0) {
        return '';
    }
    const first = content[0] as { text?: string };
    return first.text ?? '';
}

export function _parse_would_load(text: string): string[] {
    let stripped = text.trim();
    if (stripped.startsWith('```')) {
        // Python: stripped.strip("`").lstrip("json").strip()
        stripped = _strip(stripped, '`');
        stripped = _lstripChars(stripped, 'json');
        stripped = stripped.trim();
    }
    let data: unknown;
    try {
        data = JSON.parse(stripped);
    } catch {
        return [];
    }
    if (typeof data !== 'object' || data === null) {
        return [];
    }
    const loaded = (data as Record<string, unknown>)['would_load'];
    if (!Array.isArray(loaded)) {
        return [];
    }
    return loaded.map((name) => String(name));
}

function _strip(s: string, chars: string): string {
    let start = 0;
    let end = s.length;
    while (start < end && chars.includes(s[start] as string)) start += 1;
    while (end > start && chars.includes(s[end - 1] as string)) end -= 1;
    return s.slice(start, end);
}

/** Python `str.lstrip(chars)` — strip any leading char in `chars`. */
function _lstripChars(s: string, chars: string): string {
    let start = 0;
    while (start < s.length && chars.includes(s[start] as string)) start += 1;
    return s.slice(start);
}

interface ParsedArgs {
    skill: string;
    triggers: string | null;
    output: string | null;
    model: string;
    dry_run: boolean;
    key_path: string;
}

export function parse_args(argv: string[]): ParsedArgs {
    const out: ParsedArgs = {
        skill: '',
        triggers: null,
        output: null,
        model: DEFAULT_MODEL,
        dry_run: false,
        key_path: ANTHROPIC_KEY_PATH,
    };
    let haveSkill = false;
    const fail = (msg: string): never => {
        process.stderr.write(`skill_trigger_eval: error: ${msg}\n`);
        process.exit(2);
    };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i] as string;
        const take = (): string => {
            const v = argv[++i];
            if (v === undefined) fail(`argument ${a}: expected one argument`);
            return v as string;
        };
        if (a === '--skill') {
            out.skill = take();
            haveSkill = true;
        } else if (a.startsWith('--skill=')) {
            out.skill = a.slice('--skill='.length);
            haveSkill = true;
        } else if (a === '--triggers') {
            out.triggers = path.resolve(take());
        } else if (a.startsWith('--triggers=')) {
            out.triggers = path.resolve(a.slice('--triggers='.length));
        } else if (a === '--output') {
            out.output = path.resolve(take());
        } else if (a.startsWith('--output=')) {
            out.output = path.resolve(a.slice('--output='.length));
        } else if (a === '--model') {
            out.model = take();
        } else if (a.startsWith('--model=')) {
            out.model = a.slice('--model='.length);
        } else if (a === '--dry-run') {
            out.dry_run = true;
        } else if (a === '--key-path') {
            out.key_path = path.resolve(take());
        } else if (a.startsWith('--key-path=')) {
            out.key_path = path.resolve(a.slice('--key-path='.length));
        } else if (a === '-h' || a === '--help') {
            process.stdout.write(
                'usage: skill_trigger_eval [-h] --skill SKILL [--triggers TRIGGERS]\n' +
                    '                          [--output OUTPUT] [--model MODEL] [--dry-run]\n' +
                    '                          [--key-path KEY_PATH]\n',
            );
            process.exit(0);
        } else {
            fail(`unrecognized arguments: ${a}`);
        }
    }
    if (!haveSkill) {
        fail('the following arguments are required: --skill');
    }
    return out;
}

function _default_triggers_path(skill: string): string {
    const resolved = resolve_logical(`skills/${skill}/evals/triggers.json`);
    if (resolved !== null) {
        return resolved;
    }
    return path.join(SKILLS_SOURCE, skill, 'evals', 'triggers.json');
}

function _default_live_output(skill: string, model: string): string {
    const d = new Date();
    const pad = (n: number): string => String(n).padStart(2, '0');
    const ts =
        `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
        `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
    return path.join(RESULTS_DIR, `${ts}-${skill}-${model}.json`);
}

export function main(argv?: string[]): number {
    const args = parse_args(argv ?? process.argv.slice(2));
    const triggersPath = args.triggers ?? _default_triggers_path(args.skill);
    if (!_exists(triggersPath)) {
        process.stderr.write(`❌  triggers.json not found: ${triggersPath}\n`);
        return 2;
    }

    const [skillFromFile, queries] = load_triggers(triggersPath);
    if (skillFromFile !== args.skill) {
        process.stderr.write(
            `❌  skill mismatch: --skill=${args.skill} but triggers.json says ${skillFromFile}\n`,
        );
        return 2;
    }

    const skills = load_skill_metas();
    let router: TriggerRouter;
    let defaultOutput: string;
    if (args.dry_run) {
        const expected = new Map<string, boolean>();
        for (const q of queries) {
            expected.set(q.q, q.trigger);
        }
        const decide = (query: string, _skills: SkillMeta[]): string[] =>
            expected.get(query) ? [args.skill] : [];
        router = new MockRouter(decide);
        defaultOutput = path.join(path.dirname(triggersPath), 'last-run.json');
    } else {
        let apiKey: string;
        try {
            apiKey = load_anthropic_key(args.key_path);
        } catch (exc) {
            if (exc instanceof KeyGateError) {
                process.stderr.write(`❌  ${exc.message}\n`);
                return 2;
            }
            throw exc;
        }

        const [inTok, outTok, cost] = pre_estimate_cost(args.model, skills, queries);
        const summary = build_confirmation_summary({
            model: args.model,
            skill: args.skill,
            query_count: queries.length,
            catalogue_size: skills.length,
            input_tokens: inTok,
            output_tokens: outTok,
            cost_usd: cost,
            key_path: args.key_path,
        });
        try {
            require_confirmation(summary);
        } catch (exc) {
            if (exc instanceof ConfirmationAborted) {
                process.stderr.write(`⏹   ${exc.message}\n`);
                return 2;
            }
            throw exc;
        }

        router = new AnthropicRouter({ model: args.model, api_key: apiKey });
        defaultOutput = _default_live_output(args.skill, args.model);
    }

    const result = run_eval(args.skill, queries, router, skills, args.model);
    const outputPath = args.output ?? defaultOutput;
    write_result(result, outputPath);
    process.stdout.write(format_summary(result) + '\n');
    process.stdout.write(`\nWrote: ${outputPath}\n`);
    const failCount = result.queries.filter((r) => !r.passed).length;
    return failCount ? 1 : 0;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    // Symlinked temp dirs (e.g. macOS /var → /private/var) make the raw URLs
    // differ; compare realpaths so the entry guard still fires.
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1] as string));
        return here === argv;
    } catch {
        return false;
    }
}
if (_isCliEntry()) {
    process.exitCode = main();
}
