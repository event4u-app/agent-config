#!/usr/bin/env tsx
/**
 * Thin-projection of the rule layer (lean-initial-context build-out, Phase 3.1).
 *
 * TypeScript twin of `src/scripts/project_thin_rules.py` (ADR-096 —
 * Python→TS migration, Phase 8 / Wave 8b). The CLI contract is mirrored
 * EXACTLY — the `--measure` / `--out` / `--json` flags, exit codes, the
 * stdout/stderr split, byte-identical messages, and byte-identical JSON
 * output (`json.dumps(indent=2, sort_keys=True)`).
 *
 * The dominant always-on cost is rule BODIES. A **thin** rule entry keeps
 * the matching signal (frontmatter `description` + `triggers`) so the
 * router still selects it, and replaces the body with a one-line pointer
 * to the full text. The agent loads the body on match. The kernel stays
 * full-bodied.
 *
 * This module is the mechanism + a measurement harness. It writes to a
 * target dir of your choosing — it never overwrites the live `.claude/` /
 * `.augment/` projections.
 *
 * NOTE (faithful literal): the thin-entry pointer keeps the verbatim
 * `Body: [`{rule_id}`](../../.agent-src.uncondensed/rules/{rule_id}.md)`
 * Markdown link from the Python original. The same-basename `.py` twin
 * carries that literal, so the ADR-051 legacy-path guard exempts this `.ts`
 * file by twin-parity.
 *
 * No behaviour changes — latent Python quirks replicated.
 *
 * Usage:
 *     project_thin_rules --measure          # measure delta, no write
 *     project_thin_rules --out <dir>        # write thin rules to <dir>
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import * as token_count from './_lib/token_count.js';

const _HERE = fileURLToPath(import.meta.url);
// REPO_ROOT = Path(__file__).resolve().parent.parent.parent — three dirs up
// from src/scripts/<file>.
export const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

export const RULES_SOURCE = path.join(REPO_ROOT, 'dist/agent-src', 'rules');
export const ROUTER = path.join(REPO_ROOT, 'dist', 'router.json');

/** `sorted(dir.glob("*.md"))` — non-recursive, lexically sorted abs paths. */
function _globSortedMd(dir: string): string[] {
    let names: string[];
    try {
        names = fs.readdirSync(dir);
    } catch {
        return [];
    }
    const out = names.filter((n) => n.endsWith('.md')).map((n) => path.join(dir, n));
    out.sort();
    return out;
}

/** The always-full-bodied set — authoritative kernel list from the router. */
export function kernel_ids(): Set<string> {
    const data = JSON.parse(fs.readFileSync(ROUTER, 'utf-8')) as Record<string, unknown>;
    const kernel = data.kernel;
    if (Array.isArray(kernel)) {
        return new Set(kernel.map((x) => String(x)));
    }
    return new Set();
}

/** Return [frontmatter_including_fences, body]. Empty fm if none. */
export function split_frontmatter(text: string): [string, string] {
    if (text.startsWith('---\n')) {
        const end = text.indexOf('\n---\n', 4);
        if (end !== -1) {
            return [text.slice(0, end + 5), text.slice(end + 5)];
        }
    }
    return ['', text];
}

function _description(fm: string): string {
    // re.search(r'^description:\s*"?(.+?)"?\s*$', fm, re.MULTILINE)
    const m = /^description:\s*"?(.+?)"?\s*$/m.exec(fm);
    return m ? (m[1] as string).trim() : '';
}

// How many trigger keywords/phrases to surface as the always-on match hint.
const _TRIGGER_HINT_LIMIT = 6;

/** A short, comma-joined sample of the rule's trigger keywords/phrases. */
function _trigger_hint(fm: string): string {
    const hits: string[] = [];
    // re.finditer(r'^\s*-\s*(?:keyword|phrase|intent):\s*"?(.+?)"?\s*$', fm, re.MULTILINE)
    const re = /^\s*-\s*(?:keyword|phrase|intent):\s*"?(.+?)"?\s*$/gm;
    let m: RegExpExecArray | null;
    while ((m = re.exec(fm)) !== null) {
        hits.push((m[1] as string).trim());
        if (hits.length >= _TRIGGER_HINT_LIMIT) {
            break;
        }
    }
    return hits.join(', ');
}

/** Python `str.title()` — uppercase first alpha of each run, rest lowercase. */
function _title(s: string): string {
    return s.replace(/[A-Za-z]+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

/** Build the minimal progressive-disclosure pointer for a non-kernel rule. */
export function thin_entry(rule_id: string, text: string): string {
    const [fm] = split_frontmatter(text);
    const desc = _description(fm);
    const hint = _trigger_hint(fm);
    const title = _title(rule_id.replace(/-/g, ' '));
    const fires = hint ? ` Fires on: ${hint}.` : '';
    return (
        `## ${title}\n` +
        `> Routed rule — load the body on trigger-match.${fires} ${desc} ` +
        `Body: [\`${rule_id}\`](../../.agent-src.uncondensed/rules/${rule_id}.md)\n`
    );
}

/** Map {filename: thin_or_full_text} for every rule. Kernel stays full. */
export function build_thin(rules_dir: string = RULES_SOURCE): Map<string, string> {
    const kernel = kernel_ids();
    const out = new Map<string, string>();
    for (const p of _globSortedMd(rules_dir)) {
        const text = fs.readFileSync(p, 'utf-8');
        const stem = path.basename(p).replace(/\.md$/, '');
        out.set(path.basename(p), kernel.has(stem) ? text : thin_entry(stem, text));
    }
    return out;
}

export interface ThinMeasure {
    rules_total: number;
    kernel_full: number;
    non_kernel_thinned: number;
    eager_gpt: number;
    thin_gpt: number;
    saved_gpt: number;
    saved_pct: number;
    eager_chars: number;
    thin_chars: number;
    token_method: string;
}

/** Python `round(x, 1)` — round-half-to-even at one decimal. */
function _python_round1(x: number): number {
    const scaled = x * 10;
    const floor = Math.floor(scaled);
    const diff = scaled - floor;
    let r: number;
    if (diff > 0.5) {
        r = floor + 1;
    } else if (diff < 0.5) {
        r = floor;
    } else {
        r = floor % 2 === 0 ? floor : floor + 1;
    }
    return r / 10;
}

/** Eager vs thin token footprint for the rule layer. */
export function measure(rules_dir: string = RULES_SOURCE): ThinMeasure {
    const kernel = kernel_ids();
    const mdPaths = _globSortedMd(rules_dir);
    const eager_blob = mdPaths.map((p) => fs.readFileSync(p, 'utf-8')).join('');
    const thin_blob = [...build_thin(rules_dir).values()].join('');
    const eager = token_count.measure(eager_blob);
    const thin = token_count.measure(thin_blob);
    const n = mdPaths.length;
    // len(kernel & {p.stem for p in rules_dir.glob("*.md")})
    const stemSet = new Set(mdPaths.map((p) => path.basename(p).replace(/\.md$/, '')));
    let kernelInDir = 0;
    for (const k of kernel) {
        if (stemSet.has(k)) {
            kernelInDir += 1;
        }
    }
    const saved_pct = eager.tokens_gpt
        ? _python_round1((100 * (eager.tokens_gpt - thin.tokens_gpt)) / eager.tokens_gpt)
        : 0.0;
    return {
        rules_total: n,
        kernel_full: kernelInDir,
        non_kernel_thinned: n - kernelInDir,
        eager_gpt: eager.tokens_gpt,
        thin_gpt: thin.tokens_gpt,
        saved_gpt: eager.tokens_gpt - thin.tokens_gpt,
        saved_pct,
        eager_chars: eager.chars,
        thin_chars: thin.chars,
        token_method: token_count.method_note(),
    };
}

/** Write thin rule files to `out_dir`; return the count written. */
export function write_thin(out_dir: string, rules_dir: string = RULES_SOURCE): number {
    fs.mkdirSync(out_dir, { recursive: true });
    const files = build_thin(rules_dir);
    for (const [name, text] of files) {
        fs.writeFileSync(path.join(out_dir, name), text, 'utf-8');
    }
    return files.size;
}

// --- json.dumps(indent=2, sort_keys=True) replica ----------------------------

/**
 * Sentinel for a Python `float` value, so the dumper renders an
 * integer-valued float as `N.0` (json.dumps parity). Python `round(x, 1)`
 * always yields a float; `saved_pct` is the only such field here.
 */
class PyFloat {
    readonly value: number;
    constructor(value: number) {
        this.value = value;
    }
}

/** Render a float like Python `repr()` inside json.dumps (e.g. 90 → "90.0"). */
function _pyFloatRepr(n: number): string {
    return Number.isInteger(n) ? `${n}.0` : String(n);
}

function _jsonDumpsSorted(obj: unknown): string {
    const pad = '  ';
    function encStr(s: string): string {
        let out = '"';
        for (const ch of s) {
            const cp = ch.codePointAt(0) as number;
            if (ch === '"') out += '\\"';
            else if (ch === '\\') out += '\\\\';
            else if (ch === '\n') out += '\\n';
            else if (ch === '\r') out += '\\r';
            else if (ch === '\t') out += '\\t';
            else if (ch === '\b') out += '\\b';
            else if (ch === '\f') out += '\\f';
            else if (cp < 0x20) out += '\\u' + cp.toString(16).padStart(4, '0');
            else if (cp < 0x7f) out += ch;
            else if (cp > 0xffff) {
                const v = cp - 0x10000;
                const hi = 0xd800 + (v >> 10);
                const lo = 0xdc00 + (v & 0x3ff);
                out += '\\u' + hi.toString(16).padStart(4, '0');
                out += '\\u' + lo.toString(16).padStart(4, '0');
            } else {
                out += '\\u' + cp.toString(16).padStart(4, '0');
            }
        }
        return out + '"';
    }
    function enc(value: unknown, depth: number): string {
        if (value === null || value === undefined) {
            return 'null';
        }
        if (value instanceof PyFloat) {
            return _pyFloatRepr(value.value);
        }
        if (typeof value === 'boolean') {
            return value ? 'true' : 'false';
        }
        if (typeof value === 'number') {
            return String(value);
        }
        if (typeof value === 'string') {
            return encStr(value);
        }
        if (Array.isArray(value)) {
            if (value.length === 0) {
                return '[]';
            }
            const inner = value.map((v) => pad.repeat(depth + 1) + enc(v, depth + 1));
            return '[\n' + inner.join(',\n') + '\n' + pad.repeat(depth) + ']';
        }
        const o = value as Record<string, unknown>;
        const keys = Object.keys(o).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
        if (keys.length === 0) {
            return '{}';
        }
        const inner = keys.map((k) => pad.repeat(depth + 1) + encStr(k) + ': ' + enc(o[k], depth + 1));
        return '{\n' + inner.join(',\n') + '\n' + pad.repeat(depth) + '}';
    }
    return enc(obj, 0);
}

// --- argparse replica ---------------------------------------------------------

interface ParsedArgs {
    measure: boolean;
    out: string | null;
    json: boolean;
}

// argparse `prog` defaults to basename(sys.argv[0]) → `project_thin_rules.py`.
const _USAGE = 'usage: project_thin_rules.py [-h] [--measure] [--out OUT] [--json]\n';

// Full `-h` help block, byte-identical to argparse's rendering.
const _HELP =
    _USAGE +
    '\n' +
    'Thin-projection of the rule layer (lean-initial-context build-out, Phase 3.1).\n' +
    '\n' +
    'optional arguments:\n' +
    '  -h, --help  show this help message and exit\n' +
    '  --measure   print the eager-vs-thin token delta\n' +
    '  --out OUT   write thin rule files to this dir\n' +
    '  --json\n';

function _argError(msg: string): never {
    process.stderr.write(_USAGE);
    process.stderr.write(`project_thin_rules.py: error: ${msg}\n`);
    process.exit(2);
}

function parse_args(argv: string[]): ParsedArgs {
    const out: ParsedArgs = { measure: false, out: null, json: false };
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i] as string;
        if (a === '-h' || a === '--help') {
            process.stdout.write(_HELP);
            process.exit(0);
        } else if (a === '--measure') {
            out.measure = true;
        } else if (a === '--json') {
            out.json = true;
        } else if (a === '--out') {
            const next = argv[i + 1];
            if (next === undefined) {
                _argError('argument --out: expected one argument');
            }
            out.out = next;
            i += 1;
        } else if (a.startsWith('--out=')) {
            out.out = a.slice('--out='.length);
        } else {
            _argError(`unrecognized arguments: ${a}`);
        }
    }
    return out;
}

/** Python f-string `{x:,}` — thousands separators with comma. */
function _comma(n: number): string {
    return n.toLocaleString('en-US');
}

/** Python f-string `{x:>6}` — right-justify in a field of width 6. */
function _rjust6(n: number): string {
    return String(n).padStart(6, ' ');
}

export function main(argv: string[] | null = null): number {
    const args = parse_args(argv ?? process.argv.slice(2));

    if (args.out !== null) {
        const n = write_thin(args.out);
        process.stdout.write(`wrote ${n} thin rule files → ${args.out}\n`);
        return 0;
    }

    const m = measure();
    if (args.json) {
        // `saved_pct` is a Python float (round(..., 1)); wrap it so an
        // integer-valued result still renders as `N.0` (json.dumps parity).
        const jsonShape: Record<string, unknown> = { ...m, saved_pct: new PyFloat(m.saved_pct) };
        process.stdout.write(_jsonDumpsSorted(jsonShape) + '\n');
    } else {
        process.stdout.write(
            `Rule-layer thin projection (kernel full-bodied + ${m.non_kernel_thinned} non-kernel pointers):\n`,
        );
        process.stdout.write(`  eager: ${_rjust6(m.eager_gpt)} GPT tok (${_comma(m.eager_chars)} chars)\n`);
        process.stdout.write(`  thin:  ${_rjust6(m.thin_gpt)} GPT tok (${_comma(m.thin_chars)} chars)\n`);
        process.stdout.write(`  saved: ${_rjust6(m.saved_gpt)} GPT tok  (${m.saved_pct}% of the rule layer)\n`);
        process.stdout.write(`  method: ${m.token_method}\n`);
    }
    return 0;
}

const _isCliEntry =
    process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}
