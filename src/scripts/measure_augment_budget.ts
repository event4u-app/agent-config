#!/usr/bin/env node
/**
 * Measure the Augment workspace-guidelines budget (Phase 1.1 of
 * road-to-augment-limit-fit).
 *
 * TypeScript twin of `src/scripts/measure_augment_budget.py` (ADR-090,
 * Phase 8 Wave 8a). Mirrors the Python CLI contract EXACTLY — flags
 * (`--json`, `--trend-append`, `--check`), exit codes (0 / 1 / 3),
 * byte-identical stdout (text summary + `json.dumps(indent=2,
 * sort_keys=True)`), and the byte-identical JSONL trend record
 * (`json.dumps(rec, sort_keys=True)`).
 *
 * Mirrors Augment's accounting model for the workspace prompt:
 *
 * 1. `AGENTS.md` body (full file, including frontmatter) injected verbatim.
 * 2. `always`-type rules under `.augment/rules/` — full body injected.
 * 3. `auto`-type rules — only a registry stub is injected per rule.
 *
 * The 49,512-char ceiling is the empirical limit observed against the
 * Augment Code workspace prompt (2026-05-08 baseline).
 *
 * Exit codes: 0 = under fail threshold, 1 = at/above fail threshold,
 * 3 = internal error.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { pyRound } from './_lib/value_ladder.js';

const _HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(_HERE, '..', '..');
export const AGENTS_MD = path.join(REPO_ROOT, 'AGENTS.md');
export const RULES_DIR = path.join(REPO_ROOT, '.augment', 'rules');
export const TREND_FILE = path.join(
    REPO_ROOT,
    'agents',
    'runtime',
    '.augment-budget-history.jsonl',
);

// Augment workspace-guidelines ceiling — empirical 2026-05-08.
export const TOTAL_CAP = 49_512;
export const WARN_THRESHOLD = 0.85;
export const FAIL_THRESHOLD = 0.95;

// Stub template Augment injects for `type: auto` rules.
function STUB(desc: string, p: string): string {
    return `If the user prompt matches the description "${desc}", read the file located in ${p}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;
type Dict = Record<string, Json>;

/** Mirror Python len(str) — count Unicode code points, not UTF-16 units. */
function pyLen(s: string): number {
    let n = 0;
    for (const _ of s) {
        n++;
    }
    return n;
}

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

/** Sorted *.md children of a directory (mirrors `sorted(RULES_DIR.glob("*.md"))`). */
function _globMdSorted(dir: string): string[] {
    let names: string[];
    try {
        names = fs.readdirSync(dir);
    } catch {
        return [];
    }
    const mds = names.filter((n) => n.endsWith('.md'));
    mds.sort();
    return mds.map((n) => path.join(dir, n));
}

function _relToRepo(p: string): string {
    return path.relative(REPO_ROOT, p).split(path.sep).join('/');
}

/**
 * Mirror the Python `parse_frontmatter` — minimal `key: value` scan, NOT YAML.
 * Returns `[fm, body]`; quotes (single/double) stripped from values.
 */
export function parse_frontmatter(text: string): [Record<string, string>, string] {
    if (!text.startsWith('---\n')) {
        return [{}, text];
    }
    const end = text.indexOf('\n---', 4);
    if (end < 0) {
        return [{}, text];
    }
    const fm_block = text.slice(4, end);
    // body = text[end + 4:].lstrip("\n")
    const body = text.slice(end + 4).replace(/^\n+/, '');
    const fm: Record<string, string> = {};
    for (const line of fm_block.split('\n')) {
        const m = /^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/.exec(line);
        if (m) {
            // .strip().strip('"').strip("'")
            let v = (m[2] as string).trim();
            v = _stripChars(v, '"');
            v = _stripChars(v, "'");
            fm[m[1] as string] = v;
        }
    }
    return [fm, body];
}

/** Mirror Python str.strip(chars) — strip leading/trailing occurrences of any char in `chars`. */
function _stripChars(s: string, chars: string): string {
    let start = 0;
    let end = s.length;
    while (start < end && chars.includes(s[start] as string)) {
        start++;
    }
    while (end > start && chars.includes(s[end - 1] as string)) {
        end--;
    }
    return s.slice(start, end);
}

export function measure(): Dict {
    const components: Dict = {};

    // 1. AGENTS.md
    const agents_text = _exists(AGENTS_MD) ? fs.readFileSync(AGENTS_MD, 'utf-8') : '';
    components['agents_md'] = {
        path: _relToRepo(AGENTS_MD),
        chars: pyLen(agents_text),
    };

    // 2 + 3. Rules under .augment/rules/.
    let always_total = 0;
    const always_rules: Dict[] = [];
    let auto_total = 0;
    const auto_rules: Dict[] = [];

    for (const rule_path of _globMdSorted(RULES_DIR)) {
        const text = fs.readFileSync(rule_path, 'utf-8');
        const [fm] = parse_frontmatter(text);
        const rtype = fm['type'] ?? '';
        const rel = _relToRepo(rule_path);
        if (rtype === 'always') {
            const chars = pyLen(text);
            always_total += chars;
            always_rules.push({ path: rel, chars });
        } else if (rtype === 'auto') {
            const desc = fm['description'] ?? '';
            const stub = STUB(desc, rel);
            const chars = pyLen(stub);
            auto_total += chars;
            auto_rules.push({ path: rel, desc_chars: pyLen(desc), stub_chars: chars });
        }
    }

    // sorted(always_rules, key=lambda r: -r["chars"]) — Python sort is stable.
    components['always_rules'] = {
        count: always_rules.length,
        chars: always_total,
        rules: _stableSortBy(always_rules, (r) => -(r['chars'] as number)),
    };
    components['auto_rules'] = {
        count: auto_rules.length,
        chars: auto_total,
        rules: _stableSortBy(auto_rules, (r) => -(r['stub_chars'] as number)),
    };

    const agentsChars = (components['agents_md'] as Dict)['chars'] as number;
    const total = agentsChars + always_total + auto_total;
    return {
        ts: _utc_now_iso(),
        total,
        cap: TOTAL_CAP,
        utilisation: pyRound(total / TOTAL_CAP, 4),
        components,
    };
}

/** Stable sort mirroring Python's stable `sorted(key=...)`. */
function _stableSortBy<T>(arr: T[], key: (x: T) => number): T[] {
    return arr
        .map((v, i) => [v, i] as [T, number])
        .sort((a, b) => {
            const ka = key(a[0]);
            const kb = key(b[0]);
            if (ka < kb) {
                return -1;
            }
            if (ka > kb) {
                return 1;
            }
            return a[1] - b[1];
        })
        .map((p) => p[0]);
}

function _utc_now_iso(): string {
    const d = new Date();
    const pad = (n: number): string => String(n).padStart(2, '0');
    return (
        `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
        `T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}Z`
    );
}

// --- Python format-spec helpers ---------------------------------------------

/** Mirror Python `f"{n:,}"` — comma thousands grouping for an integer. */
function _comma(n: number): string {
    const neg = n < 0;
    let s = String(Math.abs(Math.trunc(n)));
    s = s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return neg ? `-${s}` : s;
}

/** Mirror Python `f"{n:>{w},}"` — comma-group then right-align to width w. */
function _commaRJust(n: number, w: number): string {
    const s = _comma(n);
    return s.length >= w ? s : ' '.repeat(w - s.length) + s;
}

/** Mirror Python `f"{x:5.1f}"` — fixed 1 decimal, right-aligned to width 5. */
function _f51(x: number): string {
    const s = x.toFixed(1);
    return s.length >= 5 ? s : ' '.repeat(5 - s.length) + s;
}

/** Mirror Python `f"{x:.1f}"`. */
function _f1(x: number): string {
    return x.toFixed(1);
}

/** Mirror Python `f"{x:.0f}"`. */
function _f0(x: number): string {
    return x.toFixed(0);
}

export function render_text(data: Dict): string {
    const total = data['total'] as number;
    const cap = data['cap'] as number;
    const util = data['utilisation'] as number;
    const comps = data['components'] as Dict;
    const a = (comps['agents_md'] as Dict)['chars'] as number;
    const ar = comps['always_rules'] as Dict;
    const aur = comps['auto_rules'] as Dict;
    const arCount = ar['count'] as number;
    const arChars = ar['chars'] as number;
    const aurCount = aur['count'] as number;
    const aurChars = aur['chars'] as number;

    const lines = [
        `Augment workspace-guidelines budget — cap ${_comma(cap)} chars`,
        '',
        `  AGENTS.md          ${_commaRJust(a, 6)} chars  (${_f51((a / cap) * 100)}%)`,
        `  always-rules (${_rjust(String(arCount), 2)})  ${_commaRJust(arChars, 6)} chars  (${_f51((arChars / cap) * 100)}%)`,
        `  auto-rule stubs (${_rjust(String(aurCount), 2)}) ${_commaRJust(aurChars, 6)} chars  (${_f51((aurChars / cap) * 100)}%)`,
        '  ' + '-'.repeat(50),
        `  TOTAL              ${_commaRJust(total, 6)} chars  (${_f51(util * 100)}%)`,
        '',
    ];
    if (util >= 1.0) {
        lines.push(`❌  OVER CAP by ${_comma(total - cap)} chars`);
    } else if (util >= FAIL_THRESHOLD) {
        lines.push(`❌  FAIL — utilisation ${_f1(util * 100)}% ≥ ${_f0(FAIL_THRESHOLD * 100)}%`);
    } else if (util >= WARN_THRESHOLD) {
        lines.push(`⚠️   WARN — utilisation ${_f1(util * 100)}% ≥ ${_f0(WARN_THRESHOLD * 100)}%`);
    } else {
        lines.push(`✅  OK — utilisation ${_f1(util * 100)}%`);
    }
    return lines.join('\n');
}

/** Mirror Python `f"{s:>{w}}"` — right-align string to width w. */
function _rjust(s: string, w: number): string {
    return s.length >= w ? s : ' '.repeat(w - s.length) + s;
}

// --- Python json.dumps (sort_keys=True) emulation ---------------------------

function _pyJsonStr(s: string): string {
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
            const c = code - 0x10000;
            const hi = 0xd800 + (c >> 10);
            const lo = 0xdc00 + (c & 0x3ff);
            out += `\\u${hi.toString(16).padStart(4, '0')}\\u${lo.toString(16).padStart(4, '0')}`;
        }
    }
    return out + '"';
}

function _pyNum(n: number): string {
    if (Number.isInteger(n)) {
        return String(n);
    }
    // Python repr of a float; the only floats here are utilisation (round 4).
    return String(n);
}

/**
 * Mirror `json.dumps(obj, sort_keys=True)` with optional 2-space indent.
 * `indent=null` → compact with default separators (", ", ": ").
 */
function pyJsonDumpsSorted(obj: Json, indent: number | null, level = 0): string {
    if (obj === null) {
        return 'null';
    }
    if (obj === true) {
        return 'true';
    }
    if (obj === false) {
        return 'false';
    }
    if (typeof obj === 'number') {
        return _pyNum(obj);
    }
    if (typeof obj === 'string') {
        return _pyJsonStr(obj);
    }
    if (Array.isArray(obj)) {
        if (obj.length === 0) {
            return '[]';
        }
        if (indent === null) {
            return `[${obj.map((v) => pyJsonDumpsSorted(v, null)).join(', ')}]`;
        }
        const pad = ' '.repeat(indent * (level + 1));
        const closePad = ' '.repeat(indent * level);
        const items = obj.map((v) => pad + pyJsonDumpsSorted(v, indent, level + 1));
        return `[\n${items.join(',\n')}\n${closePad}]`;
    }
    if (typeof obj === 'object') {
        const keys = Object.keys(obj as Dict).sort();
        if (keys.length === 0) {
            return '{}';
        }
        if (indent === null) {
            const parts = keys.map(
                (k) => `${_pyJsonStr(k)}: ${pyJsonDumpsSorted((obj as Dict)[k], null)}`,
            );
            return `{${parts.join(', ')}}`;
        }
        const pad = ' '.repeat(indent * (level + 1));
        const closePad = ' '.repeat(indent * level);
        const parts = keys.map(
            (k) => `${pad}${_pyJsonStr(k)}: ${pyJsonDumpsSorted((obj as Dict)[k], indent, level + 1)}`,
        );
        return `{\n${parts.join(',\n')}\n${closePad}}`;
    }
    return 'null';
}

interface Args {
    json: boolean;
    trend_append: boolean;
    check: boolean;
}

export function parse_args(argv: string[]): Args {
    const args: Args = { json: false, trend_append: false, check: false };
    for (const a of argv) {
        if (a === '--json') {
            args.json = true;
        } else if (a === '--trend-append') {
            args.trend_append = true;
        } else if (a === '--check') {
            args.check = true;
        } else {
            process.stderr.write(`unrecognized arguments: ${a}\n`);
            process.exit(2);
        }
    }
    return args;
}

export function main(argv: string[] | null = null): number {
    const args = parse_args(argv ?? process.argv.slice(2));
    const data = measure();

    if (args.trend_append) {
        fs.mkdirSync(path.dirname(TREND_FILE), { recursive: true });
        const comps = data['components'] as Dict;
        const rec: Dict = {
            ts: data['ts'],
            total: data['total'],
            cap: data['cap'],
            utilisation: data['utilisation'],
            agents_md: (comps['agents_md'] as Dict)['chars'],
            always_rules: (comps['always_rules'] as Dict)['chars'],
            auto_rules: (comps['auto_rules'] as Dict)['chars'],
        };
        fs.appendFileSync(TREND_FILE, pyJsonDumpsSorted(rec, null) + '\n', 'utf-8');
    }

    if (args.json) {
        process.stdout.write(pyJsonDumpsSorted(data, 2) + '\n');
    } else {
        process.stdout.write(render_text(data) + '\n');
    }

    if (args.check) {
        const util = data['utilisation'] as number;
        if (util >= 1.0 || util >= FAIL_THRESHOLD) {
            return 1;
        }
    }
    return 0;
}

const _isMain = import.meta.url === pathToFileURL(path.resolve(process.argv[1] ?? '')).href;
if (_isMain) {
    try {
        // Set exitCode (not process.exit) so the large --json stdout drains.
        process.exitCode = main();
    } catch (exc) {
        const msg = exc instanceof Error ? exc.message : String(exc);
        process.stderr.write(`❌  measure_augment_budget: internal error: ${msg}\n`);
        process.exitCode = 3;
    }
}
