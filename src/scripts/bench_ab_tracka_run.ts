#!/usr/bin/env tsx
/**
 * Track A — behavioural eval runner for the package-impact A/B bench.
 *
 * TypeScript twin of `src/scripts/bench_ab_tracka_run.py` (ADR-090, Phase 8 /
 * Wave 8d). The CLI contract mirrors the Python original EXACTLY — same
 * `--variant {with,without,both}` flag, same exit codes, stdout/stderr split,
 * byte-identical messages, and byte-identical written report JSON
 * (`json.dumps(indent=2) + "\n"`) + Markdown. No behaviour changes — latent
 * Python quirks are replicated and flagged as divergence candidates.
 *
 * NON-DETERMINISM: each written report carries `utc_stamp()` (current UTC)
 * and a monotonic `duration_seconds`; those fields are timing-bound and are
 * NOT byte-stable across runs — golden parity excludes them. The scoring
 * payload (`trigger_accuracy`, `matched`, `total`, `per_target_present`,
 * `per_prompt`) IS deterministic against a fixed clone tree.
 *
 * For each prompt in `internal/bench/corpora/ab-tracka.yaml`, check whether
 * the expected rule/skill surface is present in the target clone. Present +
 * keyword-grep passing → trigger fires. Absent → trigger does not fire.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';

import { CacheKey, claude_cli_version, hash_file, target_shape_hash } from './_lib/bench_ab_cache.js';

const _HERE = fileURLToPath(import.meta.url);

// Python: REPO_ROOT = Path(__file__).resolve().parent.parent.parent
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const CORPUS_PATH = path.join(REPO_ROOT, 'internal', 'bench', 'corpora', 'ab-tracka.yaml');
const CLONES_DIR = path.join(REPO_ROOT, 'internal', 'bench', 'ab', 'clones');
const REPORTS_DIR = path.join(REPO_ROOT, 'internal', 'bench', 'reports', 'ab');

export function utc_stamp(): string {
    const d = new Date();
    const Y = String(d.getUTCFullYear()).padStart(4, '0');
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const D = String(d.getUTCDate()).padStart(2, '0');
    const H = String(d.getUTCHours()).padStart(2, '0');
    const M = String(d.getUTCMinutes()).padStart(2, '0');
    const S = String(d.getUTCSeconds()).padStart(2, '0');
    return `${Y}-${m}-${D}T${H}-${M}-${S}Z`;
}

interface Prompt {
    id?: unknown;
    expected_target?: unknown;
    expected_keywords?: unknown;
}

export function load_corpus(): Record<string, unknown> {
    return (_yamlSafeLoad(fs.readFileSync(CORPUS_PATH, 'utf-8')) ?? {}) as Record<string, unknown>;
}

/** Return [score, reason]. score=1 when the surface is present AND every keyword hits. */
export function score_prompt(prompt: Prompt, cloneRoot: string): [number, string] {
    const targetRel = prompt.expected_target;
    if (!targetRel) {
        return [0, 'no expected_target'];
    }
    const target = path.join(cloneRoot, String(targetRel));
    if (!fs.existsSync(target)) {
        return [0, `missing: ${String(targetRel)}`];
    }
    const keywords = prompt.expected_keywords;
    if (!Array.isArray(keywords) || keywords.length === 0) {
        // Surface presence alone counts when no keywords specified.
        return [1, 'present (no keywords)'];
    }
    const body = _readTextReplace(target);
    const missing = keywords.filter((kw) => !_searchIgnoreCase(String(kw), body));
    if (missing.length > 0) {
        return [0, `keywords missing: ${missing.map((k) => String(k)).join(',')}`];
    }
    return [1, 'present (keywords matched)'];
}

interface VariantResults {
    trigger_accuracy: number;
    matched: number;
    total: number;
    per_target_present: Record<string, number>;
    per_prompt: Array<Record<string, unknown>>;
}

export function run_variant(variant: string, prompts: Prompt[]): VariantResults {
    const cloneRoot = path.join(CLONES_DIR, variant);
    if (!fs.existsSync(cloneRoot)) {
        throw new Error(`clone missing at ${cloneRoot} — run scripts/bench_ab_clone.py first`);
    }
    const perPrompt: Array<Record<string, unknown>> = [];
    const perTarget: Record<string, number> = {};
    let matched = 0;
    for (const prompt of prompts) {
        const [score, reason] = score_prompt(prompt, cloneRoot);
        perPrompt.push({
            id: prompt.id ?? null,
            expected_target: prompt.expected_target ?? null,
            score,
            reason,
        });
        const key = prompt.expected_target === undefined ? '' : String(prompt.expected_target ?? '');
        perTarget[key] = Math.max(perTarget[key] ?? 0, score);
        matched += score;
    }
    const total = prompts.length || 1;
    return {
        trigger_accuracy: _pyRound(matched / total, 4),
        matched,
        total,
        per_target_present: perTarget,
        per_prompt: perPrompt,
    };
}

/**
 * Track A safety: `without` MUST score 0 — there is no agent-config surface
 * to match. A non-zero score means the integrity boundary leaked and the run
 * is invalid.
 */
export function integrity_check(withoutResults: VariantResults): [boolean, string] {
    const matched = withoutResults.matched ?? 0;
    if (matched !== 0) {
        const leaked = withoutResults.per_prompt
            .filter((p) => p['score'])
            .map((p) => String(p['id']));
        return [false, `\`without\` scored ${matched} (expected 0); leaked: ${leaked.join(',')}`];
    }
    return [true, 'without=0 (clean)'];
}

function write_report(
    variant: string,
    results: VariantResults,
    duration: number,
    opts: { integrityOk: boolean },
): string {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
    const cacheKey = new CacheKey(
        hash_file(CORPUS_PATH),
        claude_cli_version(),
        target_shape_hash(),
    );
    const stamp = utc_stamp();
    // float fields (`duration_seconds`, `results.trigger_accuracy`) carry a
    // PyFloat marker so json.dumps' trailing ".0" is reproduced; everything
    // else (`matched`, `total`, per-prompt `score`, `per_target_present`) is
    // an int and stays bare.
    const payload: Json = {
        schema: 'ab-bench/0.1',
        stamp,
        variant,
        corpus: 'ab-tracka',
        cache_key: cacheKey.to_dict() as unknown as Json,
        duration_seconds: new PyFloat(_pyRound(duration, 3)),
        integrity_ok: opts.integrityOk,
        results: {
            trigger_accuracy: new PyFloat(results.trigger_accuracy),
            matched: results.matched,
            total: results.total,
            per_target_present: results.per_target_present as unknown as Json,
            per_prompt: results.per_prompt.map((r) => ({
                id: (r['id'] ?? null) as Json,
                expected_target: (r['expected_target'] ?? null) as Json,
                score: r['score'] as Json,
                reason: r['reason'] as Json,
            })),
        },
    };
    const p = path.join(REPORTS_DIR, `${stamp}-ab-tracka-${variant}.json`);
    fs.writeFileSync(p, `${_jsonDumps(payload, 2)}\n`, 'utf-8');
    const md = p.replace(/\.json$/, '.md');
    fs.writeFileSync(
        md,
        `# Track A · ${variant}\n\n` +
            `- Stamp: \`${stamp}\`\n` +
            `- Trigger accuracy: **${_fmtPct1(_num(results.trigger_accuracy) * 100)}%**` +
            ` (${_num(results.matched)}/${_num(results.total)})\n` +
            `- Integrity OK: \`${opts.integrityOk ? 'True' : 'False'}\`\n`,
        'utf-8',
    );
    return p;
}

interface Args {
    variant: 'with' | 'without' | 'both';
}

class ArgExit extends Error {
    readonly code: number;
    constructor(code: number) {
        super(`ArgExit(${code})`);
        this.code = code;
    }
}

function parse_args(argv: string[]): Args {
    let variant: 'with' | 'without' | 'both' = 'both';
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i]!;
        if (a === '--variant' || a.startsWith('--variant=')) {
            const val = a.startsWith('--variant=') ? a.slice('--variant='.length) : (argv[++i] ?? '');
            if (val !== 'with' && val !== 'without' && val !== 'both') {
                process.stderr.write(
                    'bench_ab_tracka_run: error: argument --variant: invalid choice: ' +
                        `'${val}' (choose from 'with', 'without', 'both')\n`,
                );
                process.exitCode = 2;
                throw new ArgExit(2);
            }
            variant = val;
        } else if (a === '-h' || a === '--help') {
            process.stdout.write(
                'usage: bench_ab_tracka_run [-h] [--variant {with,without,both}]\n',
            );
            process.exitCode = 0;
            throw new ArgExit(0);
        } else {
            process.stderr.write(`bench_ab_tracka_run: error: unrecognized arguments: ${a}\n`);
            process.exitCode = 2;
            throw new ArgExit(2);
        }
    }
    return { variant };
}

export function main(argv: string[] | null = null): number {
    const rawArgv = argv ?? process.argv.slice(2);
    let args: Args;
    try {
        args = parse_args(rawArgv);
    } catch (err) {
        if (err instanceof ArgExit) {
            return err.code;
        }
        throw err;
    }
    if (!fs.existsSync(CORPUS_PATH)) {
        process.stderr.write(`bench_ab_tracka_run: corpus missing at ${CORPUS_PATH}\n`);
        return 1;
    }
    const data = load_corpus();
    const prompts = (data['prompts'] as Prompt[] | undefined) ?? [];
    if (!prompts || prompts.length === 0) {
        process.stderr.write('bench_ab_tracka_run: corpus has no prompts\n');
        return 1;
    }

    const variants: string[] = args.variant === 'both' ? ['with', 'without'] : [args.variant];
    let integrityOk = true;
    for (const variant of variants) {
        const started = _monotonic();
        const results = run_variant(variant, prompts);
        const duration = _monotonic() - started;
        if (variant === 'without') {
            const [ok, reason] = integrity_check(results);
            integrityOk = ok;
            if (!ok) {
                process.stderr.write(`bench_ab_tracka_run: integrity failure — ${reason}\n`);
            }
        }
        const p = write_report(variant, results, duration, { integrityOk });
        process.stdout.write(
            `bench_ab_tracka_run: ${variant} → ` +
                `${_fmtPct1(_num(results.trigger_accuracy) * 100)}% ` +
                `(${_num(results.matched)}/${_num(results.total)}) — ${_relPath(p)}\n`,
        );
    }
    return integrityOk ? 0 : 1;
}

// ── parity helpers ───────────────────────────────────────────────────────

function _yamlSafeLoad(s: string): unknown {
    return parseYaml(s, { version: '1.1' });
}

/** Python `Path.read_text(errors="replace")` — decode latin-isn't; use replace. */
function _readTextReplace(p: string): string {
    const buf = fs.readFileSync(p);
    return new TextDecoder('utf-8', { fatal: false }).decode(buf);
}

/** Python `re.search(re.escape(kw), body, re.IGNORECASE)` as a boolean. */
function _searchIgnoreCase(needle: string, haystack: string): boolean {
    const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(escaped, 'i').test(haystack);
}

function _monotonic(): number {
    return process.hrtime.bigint !== undefined
        ? Number(process.hrtime.bigint()) / 1e9
        : Date.now() / 1000;
}

function _relPath(target: string): string {
    if (target.startsWith(REPO_ROOT + path.sep)) {
        return path.relative(REPO_ROOT, target);
    }
    return target;
}

function _num(v: unknown): number {
    return typeof v === 'number' ? v : Number(v ?? 0);
}

/** Python `f"{x:.1f}"` — round-half-to-even to 1 decimal. */
function _fmtPct1(x: number): string {
    return _pyFixed(x, 1);
}

/** Python `round(x, ndigits)` — round-half-to-even, returns a float. */
function _pyRound(x: number, ndigits: number): number {
    if (!Number.isFinite(x)) {
        return x;
    }
    const factor = 10 ** ndigits;
    const scaled = x * factor;
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

/** Format `x` to `ndigits` decimals using round-half-to-even (CPython repr). */
function _pyFixed(x: number, ndigits: number): string {
    if (!Number.isFinite(x)) {
        return String(x);
    }
    const neg = x < 0 || Object.is(x, -0);
    const abs = Math.abs(x);
    const factor = 10 ** ndigits;
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
        const dec = intStr.slice(intStr.length - ndigits);
        result = `${whole}.${dec}`;
    }
    return neg ? `-${result}` : result;
}

// ── JSON shaping (json.dumps parity, PyFloat-aware) ──────────────────────

/** Marks a value as a Python float — integral floats serialise with ".0". */
class PyFloat {
    constructor(readonly value: number) {}
}

type Json = null | boolean | number | string | PyFloat | Json[] | { [k: string]: Json };

/** json.dumps(obj, indent=indent) — sort_keys False, ensure_ascii True. */
function _jsonDumps(obj: Json, indent: number): string {
    const pad = ' '.repeat(indent);

    function enc(value: Json, depth: number): string {
        if (value === null) return 'null';
        if (value instanceof PyFloat) {
            return Number.isInteger(value.value) ? `${value.value}.0` : String(value.value);
        }
        if (typeof value === 'boolean') return value ? 'true' : 'false';
        if (typeof value === 'number') return String(value);
        if (typeof value === 'string') return encStr(value);
        if (Array.isArray(value)) {
            if (value.length === 0) return '[]';
            const inner = value.map((v) => pad.repeat(depth + 1) + enc(v, depth + 1));
            return '[\n' + inner.join(',\n') + '\n' + pad.repeat(depth) + ']';
        }
        const o = value as { [k: string]: Json };
        const keys = Object.keys(o);
        if (keys.length === 0) return '{}';
        const inner = keys.map((k) => pad.repeat(depth + 1) + encStr(k) + ': ' + enc(o[k]!, depth + 1));
        return '{\n' + inner.join(',\n') + '\n' + pad.repeat(depth) + '}';
    }

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

    return enc(obj, 0);
}

const _IS_MAIN =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (_IS_MAIN) {
    process.exit(main());
}
