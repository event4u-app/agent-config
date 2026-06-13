#!/usr/bin/env node
/**
 * Measure rule-bucket char counts (kernel + auto) for the rule-kernel roadmap.
 *
 * TypeScript twin of `src/scripts/measure_rule_budget.py` (ADR-092 —
 * Python→TS migration, Phase 8 / Wave 8a). The CLI contract is mirrored
 * EXACTLY: same flags (`--json`, `--kernel-budget-check`,
 * `--trend-append`), same exit codes, same byte-identical stdout table /
 * JSON, same trend-file append behaviour. No behaviour changes — latent
 * bugs replicated. `token_count.ts` hardwires `TIKTOKEN_AVAILABLE = false`,
 * matching the Python module when tiktoken is absent.
 *
 * Source of truth: `rules/*.md` under every artefact root. Frontmatter
 * (YAML between two `---` lines at file start) is stripped before
 * counting; only the rule body counts toward the bucket.
 *
 * Buckets follow the existing frontmatter `type:` field:
 * - `always` rules → always-bucket (today's kernel proxy).
 * - `auto` rules → auto-bucket.
 *
 * Output:
 * - Default: stdout table (per-rule rows, top-5 oversize, totals).
 * - `--json`: deterministic JSON (sorted keys, sorted lists).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { artefact_roots } from './_lib/agent_src.js';
import * as token_count from './_lib/token_count.js';

const _HERE = fileURLToPath(import.meta.url);
// src/scripts/measure_rule_budget.ts → parents[2] is the repo root (mirrors
// `Path(__file__).resolve().parent.parent.parent` in the .py).
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

const OVERRIDES_FILE = path.join(REPO_ROOT, 'docs', 'contracts', 'iron-law-overrides.txt');
const TREND_FILE = path.join(REPO_ROOT, 'agents', 'runtime', '.rule-budget-history.jsonl');

// Council R2 amendments (2026-05-06) — see docs/contracts/kernel-membership.md § 5.1.
// Per-rule cap raised 1.5k → 2.5k; warning band raised 1.2k → 2.0k.
// ADR-002 (2026-05-06) — KERNEL_HARD raised 25k → 26k.
const KERNEL_HARD = 26_000;
const KERNEL_TARGET = 20_000;
const PER_RULE_HARD = 2_500;
const PER_RULE_TARGET = 2_000;
const PER_RULE_OVERRIDE_CEILING = 4_000; // Iron-Law-override ADR ceiling.

// Locked kernel set — docs/contracts/kernel-membership.md § 4.
const KERNEL_RULES: ReadonlySet<string> = new Set([
    'agent-authority',
    'ask-when-uncertain',
    'commit-policy',
    'direct-answers',
    'language-and-tone',
    'no-cheap-questions',
    'non-destructive-by-default',
    'scope-control',
    'verify-before-complete',
]);

export interface RuleMeasure {
    id: string;
    type: string;
    tier: string;
    chars: number;
    lines: number;
    tokens_gpt: number;
    tokens_claude: number;
}

export interface Aggregate {
    always_count: number;
    auto_count: number;
    kernel_count: number;
    rule_count: number;
    always_chars: number;
    auto_chars: number;
    kernel_chars: number;
    total_chars: number;
    kernel_tokens_gpt: number;
    kernel_tokens_claude: number;
    total_tokens_gpt: number;
    total_tokens_claude: number;
    token_method: string;
    kernel_hard: number;
    kernel_target: number;
    per_rule_hard: number;
    per_rule_target: number;
    per_rule_override_ceiling: number;
    oversize_rules: RuleMeasure[];
    top5_largest: RuleMeasure[];
}

/**
 * Strip leading YAML frontmatter and return `[body, fields]`.
 *
 * Minimal parser — handles `key: "value"` / `key: value` only. No nested
 * structures, no lists. Mirrors `strip_frontmatter`.
 */
export function strip_frontmatter(text: string): [string, Record<string, string>] {
    if (!text.startsWith('---\n')) {
        return [text, {}];
    }
    const end = text.indexOf('\n---\n', 4);
    if (end === -1) {
        return [text, {}];
    }
    const raw = text.slice(4, end);
    const body = text.slice(end + 5);
    const fields: Record<string, string> = {};
    for (const line of _splitlines(raw)) {
        if (!line.includes(':') || line.startsWith('#')) {
            continue;
        }
        // Python `str.partition(":")` — split on the FIRST colon.
        const idx = line.indexOf(':');
        const key = line.slice(0, idx);
        const val = line.slice(idx + 1);
        fields[key.trim()] = _stripQuotes(val.trim());
    }
    return [body, fields];
}

/** Python `.strip('"').strip("'")` — strip outer double then single quotes. */
function _stripQuotes(s: string): string {
    return _pyStripChar(_pyStripChar(s, '"'), "'");
}

export function measure_rule(p: string): RuleMeasure {
    const text = fs.readFileSync(p, 'utf-8');
    const [body, fields] = strip_frontmatter(text);
    return {
        id: _stem(p),
        type: fields.type ?? 'auto',
        tier: fields.tier ?? '',
        chars: _len(body),
        lines: _count(body, '\n'),
        tokens_gpt: token_count.gpt_tokens(body).tokens,
        tokens_claude: token_count.claude_tokens(body).tokens,
    };
}

/**
 * Collect rule measurements from every source root (multi-root aware).
 * Deduplicates on logical rule id (stem) — first root wins. Mirrors
 * `collect`.
 */
export function collect(): RuleMeasure[] {
    const seen = new Set<string>();
    const rules: RuleMeasure[] = [];
    for (const root of artefact_roots()) {
        const rulesDir = path.join(root, 'rules');
        if (!_isDir(rulesDir)) {
            continue;
        }
        for (const p of _globSortedMd(rulesDir)) {
            const stem = _stem(p);
            if (seen.has(stem)) {
                continue;
            }
            seen.add(stem);
            rules.push(measure_rule(p));
        }
    }
    return rules.slice().sort((a, b) => _cmp(a.id, b.id));
}

/** Read iron-law-override allowlist (one rule-id per line, '#' comments). */
export function load_overrides(): Set<string> {
    if (!_exists(OVERRIDES_FILE)) {
        return new Set();
    }
    const out = new Set<string>();
    for (const line of _splitlines(fs.readFileSync(OVERRIDES_FILE, 'utf-8'))) {
        // Python: `line.split("#", 1)[0].strip()`.
        const s = line.split('#')[0]?.trim() ?? '';
        if (s) {
            out.add(s);
        }
    }
    return out;
}

export function aggregate(rules: RuleMeasure[]): Aggregate {
    const always = rules.filter((r) => r.type === 'always');
    const auto = rules.filter((r) => r.type === 'auto');
    const kernel = rules.filter((r) => KERNEL_RULES.has(r.id));
    const totalChars = _sum(rules.map((r) => r.chars));
    return {
        always_count: always.length,
        auto_count: auto.length,
        kernel_count: kernel.length,
        rule_count: rules.length,
        always_chars: _sum(always.map((r) => r.chars)),
        auto_chars: _sum(auto.map((r) => r.chars)),
        kernel_chars: _sum(kernel.map((r) => r.chars)),
        total_chars: totalChars,
        kernel_tokens_gpt: _sum(kernel.map((r) => r.tokens_gpt)),
        kernel_tokens_claude: _sum(kernel.map((r) => r.tokens_claude)),
        total_tokens_gpt: _sum(rules.map((r) => r.tokens_gpt)),
        total_tokens_claude: _sum(rules.map((r) => r.tokens_claude)),
        token_method: token_count.method_note(),
        kernel_hard: KERNEL_HARD,
        kernel_target: KERNEL_TARGET,
        per_rule_hard: PER_RULE_HARD,
        per_rule_target: PER_RULE_TARGET,
        per_rule_override_ceiling: PER_RULE_OVERRIDE_CEILING,
        oversize_rules: rules
            .filter((r) => r.chars > PER_RULE_HARD)
            .sort((a, b) => _cmp([-a.chars, a.id], [-b.chars, b.id])),
        top5_largest: rules
            .slice()
            .sort((a, b) => _cmp([-a.chars, a.id], [-b.chars, b.id]))
            .slice(0, 5),
    };
}

export function render_table(rules: RuleMeasure[], agg: Aggregate): string {
    const lines: string[] = [];
    lines.push('Rule budget — source: rules/ under every artefact root (multi-root aware, ADR-017)');
    lines.push('');
    lines.push(`${'id'.padEnd(40)} ${'type'.padEnd(7)} ${'tier'.padEnd(5)} ${'chars'.padStart(7)}`);
    lines.push('-'.repeat(62));
    for (const r of rules.slice().sort((a, b) => _cmp(a.id, b.id))) {
        const flag = r.chars > PER_RULE_HARD ? '!' : r.chars > PER_RULE_TARGET ? '~' : ' ';
        lines.push(
            `${r.id.padEnd(40)} ${r.type.padEnd(7)} ${String(r.tier).padEnd(5)} ` +
                `${String(r.chars).padStart(6)}${flag}`,
        );
    }
    lines.push('');
    lines.push(
        `kernel-bucket: ${String(agg.kernel_chars).padStart(6)} chars across ${agg.kernel_count} rules ` +
            `(target ≤ ${KERNEL_TARGET}, hard ≤ ${KERNEL_HARD})`,
    );
    lines.push(
        `always-bucket: ${String(agg.always_chars).padStart(6)} chars across ${agg.always_count} rules ` +
            `(legacy frontmatter \`type: always\`)`,
    );
    lines.push(
        `  auto-bucket: ${String(agg.auto_chars).padStart(6)} chars across ${agg.auto_count} rules`,
    );
    lines.push(`        total: ${String(agg.total_chars).padStart(6)} chars across ${agg.rule_count} rules`);
    lines.push('');
    lines.push(
        `kernel-tokens: ${String(agg.kernel_tokens_gpt).padStart(6)} GPT · ${String(agg.kernel_tokens_claude).padStart(6)} Claude  ` +
            `(total ${agg.total_tokens_gpt} GPT · ${agg.total_tokens_claude} Claude)`,
    );
    lines.push(`  token method: ${agg.token_method}`);
    lines.push('');
    lines.push(`top-5 largest:`);
    for (const r of agg.top5_largest) {
        lines.push(`  ${String(r.chars).padStart(5)}  ${r.id}  (${r.type})`);
    }
    const over = agg.oversize_rules;
    if (over.length > 0) {
        lines.push('');
        lines.push(`OVER per-rule hard cap (${PER_RULE_HARD} chars): ${over.length} rule(s)`);
    }
    return lines.join('\n');
}

/**
 * Enforce kernel budget per Council R2 amendments. Returns
 * `[exit_code, report_lines]`. Exit 0 = pass, 1 = breach. Mirrors
 * `kernel_budget_check`.
 */
export function kernel_budget_check(
    rules: RuleMeasure[],
    agg: Aggregate,
    overrides: Set<string>,
): [number, string[]] {
    const out: string[] = [];
    const fails: string[] = [];

    const kernelRules = rules.filter((r) => KERNEL_RULES.has(r.id));
    const foundIds = new Set(kernelRules.map((r) => String(r.id)));
    const missing = [...KERNEL_RULES].filter((rid) => !foundIds.has(rid)).sort(_cmpStr);
    for (const mid of missing) {
        fails.push(`missing kernel rule: ${mid} (declared in KERNEL_RULES, no file found)`);
    }

    const bucket = agg.kernel_chars;
    out.push(`kernel-bucket: ${bucket} / ${KERNEL_HARD} chars (${agg.kernel_count} rules)`);
    if (bucket > KERNEL_HARD) {
        fails.push(`kernel-bucket ${bucket} > hard cap ${KERNEL_HARD}`);
    }

    out.push(
        `per-rule cap: ${PER_RULE_HARD} (override ceiling ${PER_RULE_OVERRIDE_CEILING} ` +
            `with ADR; allowlist ${_relativeToPosix(OVERRIDES_FILE, REPO_ROOT)})`,
    );
    out.push('');
    out.push(`${'id'.padEnd(28)} ${'chars'.padStart(6)} ${'cap'.padStart(6)} ${'status'.padEnd(24)}`);
    out.push('-'.repeat(68));
    for (const r of kernelRules.slice().sort((a, b) => _cmp(a.id, b.id))) {
        const rid = String(r.id);
        const chars = r.chars;
        let cap: number;
        let label: string;
        if (overrides.has(rid)) {
            cap = PER_RULE_OVERRIDE_CEILING;
            label = 'OK (override)';
            if (chars > cap) {
                label = `FAIL (>${cap} ceiling)`;
                fails.push(`${rid} ${chars} > override ceiling ${cap}`);
            }
        } else {
            cap = PER_RULE_HARD;
            if (chars > cap) {
                label = 'FAIL (needs override ADR)';
                fails.push(`${rid} ${chars} > per-rule hard cap ${cap} (no override)`);
            } else if (chars > PER_RULE_TARGET) {
                label = 'warn (> target)';
            } else {
                label = 'OK';
            }
        }
        out.push(`${rid.padEnd(28)} ${String(chars).padStart(6)} ${String(cap).padStart(6)} ${label.padEnd(24)}`);
    }

    out.push('');
    if (fails.length > 0) {
        out.push(`❌  kernel budget check: ${fails.length} breach(es)`);
        for (const f of fails) {
            out.push(`  - ${f}`);
        }
        return [1, out];
    }
    out.push(`✅  kernel budget check: pass`);
    return [0, out];
}

/**
 * Append a daily snapshot to agents/runtime/.rule-budget-history.jsonl.
 * Idempotent per UTC day. Mirrors `trend_append`. Returns `[exit, msg]`.
 */
export function trend_append(agg: Aggregate): [number, string] {
    const today = _utcDateIso();
    const snapshot = {
        date: today,
        kernel_chars: agg.kernel_chars,
        auto_chars: agg.auto_chars,
        rule_count: agg.rule_count,
        total_chars: agg.total_chars,
    };
    fs.mkdirSync(path.dirname(TREND_FILE), { recursive: true });
    if (_exists(TREND_FILE)) {
        for (const rawLine of _splitlines(fs.readFileSync(TREND_FILE, 'utf-8'))) {
            const line = rawLine.trim();
            if (!line) {
                continue;
            }
            let row: Record<string, unknown>;
            try {
                row = JSON.parse(line) as Record<string, unknown>;
            } catch {
                continue;
            }
            if (row.date === today) {
                return [0, `trend: ${today} already recorded — no-op`];
            }
        }
    }
    // json.dumps(snapshot, sort_keys=True) — compact, default separators.
    fs.appendFileSync(TREND_FILE, _jsonDumpsSortedCompact(snapshot) + '\n', 'utf-8');
    return [0, `trend: appended ${today} → ${_relativeToPosix(TREND_FILE, REPO_ROOT)}`];
}

interface Args {
    json: boolean;
    kernelBudgetCheck: boolean;
    trendAppend: boolean;
}

function parse_args(argv: string[]): Args {
    let json = false;
    let kernelBudgetCheck = false;
    let trendAppend = false;
    for (const a of argv) {
        if (a === '--json') json = true;
        else if (a === '--kernel-budget-check') kernelBudgetCheck = true;
        else if (a === '--trend-append') trendAppend = true;
    }
    return { json, kernelBudgetCheck, trendAppend };
}

export function main(argv: string[] = process.argv.slice(2)): number {
    const args = parse_args(argv);

    const rules = collect();
    const agg = aggregate(rules);

    if (args.kernelBudgetCheck) {
        const overrides = load_overrides();
        const [code, report] = kernel_budget_check(rules, agg, overrides);
        process.stdout.write(report.join('\n') + '\n');
        return code;
    }

    if (args.trendAppend) {
        const [code, msg] = trend_append(agg);
        process.stdout.write(msg + '\n');
        return code;
    }

    if (args.json) {
        const payload = {
            rules: rules.slice().sort((a, b) => _cmp(a.id, b.id)),
            summary: agg,
        };
        process.stdout.write(_jsonDumpsSortedIndent2(payload) + '\n');
    } else {
        process.stdout.write(render_table(rules, agg) + '\n');
    }
    return 0;
}

// --- helpers -----------------------------------------------------------------

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

function _isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

/** Mirror `sorted(rules_dir.glob("*.md"))` — sorted absolute paths of top-level *.md. */
function _globSortedMd(dir: string): string[] {
    let names: string[];
    try {
        names = fs.readdirSync(dir);
    } catch {
        return [];
    }
    const out: string[] = [];
    for (const name of names) {
        if (!name.endsWith('.md')) continue;
        out.push(path.join(dir, name));
    }
    out.sort();
    return out;
}

/** Python `Path(p).stem` — basename without final suffix. */
function _stem(p: string): string {
    const base = path.basename(p);
    const dot = base.lastIndexOf('.');
    return dot <= 0 ? base : base.slice(0, dot);
}

/** Count Unicode code points — Python `len(str)`. */
function _len(text: string): number {
    let count = 0;
    for (const _ch of text) count += 1;
    return count;
}

/** Python `str.count(sub)` for single-char `sub`. */
function _count(text: string, ch: string): number {
    let n = 0;
    for (const c of text) if (c === ch) n += 1;
    return n;
}

function _sum(nums: number[]): number {
    let total = 0;
    for (const n of nums) total += n;
    return total;
}

/** Python str.splitlines() — universal newlines, no trailing empty element. */
function _splitlines(text: string): string[] {
    if (text === '') return [];
    const out: string[] = [];
    let cur = '';
    for (let i = 0; i < text.length; i++) {
        const ch = text[i] as string;
        if (ch === '\n' || ch === '\r') {
            out.push(cur);
            cur = '';
            if (ch === '\r' && text[i + 1] === '\n') i += 1;
        } else {
            cur += ch;
        }
    }
    if (cur !== '') out.push(cur);
    return out;
}

/** Python `str.strip(ch)` for a single strip char. */
function _pyStripChar(s: string, ch: string): string {
    let start = 0;
    let end = s.length;
    while (start < end && s[start] === ch) start += 1;
    while (end > start && s[end - 1] === ch) end -= 1;
    return s.slice(start, end);
}

/** POSIX relative path (mirrors `Path.relative_to().as_posix()`). */
function _relativeToPosix(child: string, root: string): string {
    return path.relative(root, child).split(path.sep).join('/');
}

/** UTC date ISO (YYYY-MM-DD) — mirrors datetime.now(timezone.utc).date().isoformat(). */
function _utcDateIso(): string {
    return new Date().toISOString().slice(0, 10);
}

/**
 * Python tuple/lexicographic comparison key. Accepts a string or an array
 * mixing numbers + strings; compares element-wise like Python tuples.
 */
type SortKey = string | Array<number | string>;
function _cmp(a: SortKey, b: SortKey): number {
    if (typeof a === 'string' && typeof b === 'string') return _cmpStr(a, b);
    const aa = a as Array<number | string>;
    const bb = b as Array<number | string>;
    const n = Math.min(aa.length, bb.length);
    for (let i = 0; i < n; i++) {
        const x = aa[i] as number | string;
        const y = bb[i] as number | string;
        if (typeof x === 'number' && typeof y === 'number') {
            if (x < y) return -1;
            if (x > y) return 1;
        } else {
            const r = _cmpStr(String(x), String(y));
            if (r !== 0) return r;
        }
    }
    return aa.length - bb.length;
}

/** Python `str < str` — code-point lexicographic. */
function _cmpStr(a: string, b: string): number {
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
}

// --- JSON serializers mirroring CPython json.dumps --------------------------

/** json.dumps(obj, sort_keys=True) — compact separators (", ", ": "). */
function _jsonDumpsSortedCompact(obj: unknown): string {
    return _dump(obj, true, null, 0);
}

/** json.dumps(obj, indent=2, sort_keys=True). */
function _jsonDumpsSortedIndent2(obj: unknown): string {
    return _dump(obj, true, 2, 0);
}

function _dump(value: unknown, sortKeys: boolean, indent: number | null, depth: number): string {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'number') {
        if (Number.isInteger(value)) return String(value);
        return String(value);
    }
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'string') return _dumpString(value);

    const nl = indent === null ? '' : '\n';
    const pad = indent === null ? '' : ' '.repeat(indent * depth);
    const padInner = indent === null ? '' : ' '.repeat(indent * (depth + 1));
    const itemSep = indent === null ? ', ' : ',' + nl;
    const kvSep = ': ';

    if (Array.isArray(value)) {
        if (value.length === 0) return '[]';
        const items = value.map((v) => padInner + _dump(v, sortKeys, indent, depth + 1));
        return '[' + nl + items.join(itemSep) + nl + pad + ']';
    }
    let entries = Object.entries(value as Record<string, unknown>);
    if (sortKeys) {
        entries = entries.sort((a, b) => _cmpStr(a[0], b[0]));
    }
    if (entries.length === 0) return '{}';
    const items = entries.map(
        ([k, v]) => padInner + _dumpString(k) + kvSep + _dump(v, sortKeys, indent, depth + 1),
    );
    return '{' + nl + items.join(itemSep) + nl + pad + '}';
}

/** Mirror json.dumps string escaping (ensure_ascii=True default). */
function _dumpString(s: string): string {
    let out = '"';
    for (const ch of s) {
        const code = ch.codePointAt(0) as number;
        if (ch === '"') out += '\\"';
        else if (ch === '\\') out += '\\\\';
        else if (ch === '\n') out += '\\n';
        else if (ch === '\r') out += '\\r';
        else if (ch === '\t') out += '\\t';
        else if (ch === '\b') out += '\\b';
        else if (ch === '\f') out += '\\f';
        else if (code < 0x20) out += '\\u' + code.toString(16).padStart(4, '0');
        else if (code < 0x7f) out += ch;
        else if (code <= 0xffff) out += '\\u' + code.toString(16).padStart(4, '0');
        else {
            const v = code - 0x10000;
            const hi = 0xd800 + (v >> 10);
            const lo = 0xdc00 + (v & 0x3ff);
            out += '\\u' + hi.toString(16).padStart(4, '0');
            out += '\\u' + lo.toString(16).padStart(4, '0');
        }
    }
    return out + '"';
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}
