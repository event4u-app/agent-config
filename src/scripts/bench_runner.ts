#!/usr/bin/env node
/**
 * Bench runner for the eval corpora — step-4 measurement-and-benchmark Phase 1.
 *
 * TypeScript twin of `src/scripts/bench_runner.py` (ADR-094 Python→TS
 * migration, Phase 8 / Wave 8d). Mirrors the CLI contract EXACTLY: flags
 * (`--corpus`, `--top-k`, `--json`), exit codes (0 PASS / 1 FAIL / 2 corpus
 * not found), byte-identical stdout/stderr, and byte-identical JSON
 * (`json.dumps(indent=2)`). No behaviour changes.
 *
 * Deterministic, no-API skill-selection baseline. For each prompt in a
 * corpus YAML, ranks the skills in the projected catalog `dist/agent-src/skills/`
 * by keyword overlap between the prompt text and each skill's
 * `description` frontmatter field. Reports selection accuracy as
 * `top-K contains >= 1 expected_skill`.
 *
 * This is a baseline retrieval — not the production router. The
 * production router uses semantic embeddings; this runner pins a
 * reproducible floor so accuracy regressions in skill descriptions are
 * catchable in CI.
 *
 * Usage:
 *     python3 scripts/bench_runner.py --corpus non-dev
 *     python3 scripts/bench_runner.py --corpus non-dev --top-k 3 --json
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';

const _HERE = fileURLToPath(import.meta.url);
// src/scripts/bench_runner.ts → parents[2] is the repo root (mirrors
// Path(__file__).resolve().parent.parent.parent on src/scripts/<mod>).
export const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const SKILLS_DIR = path.join(REPO_ROOT, 'dist/agent-src', 'skills');
const CORPUS_DIR = path.join(REPO_ROOT, 'tests', 'eval');

const STOPWORDS: ReadonlySet<string> = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
    'has', 'have', 'in', 'into', 'is', 'it', 'its', 'of', 'on', 'or',
    'that', 'the', 'this', 'to', 'via', 'with', 'your', 'you', 'use',
    'when', 'what', 'which', 'who', 'how', 'why', 'be', 'do', 'i',
    'we', 'they', 'them', 'their', 'our', 'ours', 'but', 'not', 'no',
    'yes', 'all', 'any', 'some', 'more', 'less', 'than', 'then',
]);

export function tokenize(text: string): Set<string> {
    // re.findall(r"[a-z][a-z0-9\-]+", text.lower())
    const re = /[a-z][a-z0-9-]+/g;
    const lowered = text.toLowerCase();
    const out = new Set<string>();
    let m: RegExpExecArray | null;
    while ((m = re.exec(lowered)) !== null) {
        const t = m[0];
        if (!STOPWORDS.has(t) && t.length > 2) {
            out.add(t);
        }
    }
    return out;
}

/** Return {skill_name: description_text} for every skill on disk. */
export function load_skill_descriptions(): Map<string, string> {
    const skills = new Map<string, string>();
    for (const skillDir of _iterdirSorted(SKILLS_DIR)) {
        const skillMd = path.join(skillDir, 'SKILL.md');
        if (!_isFile(skillMd)) {
            continue;
        }
        const text = fs.readFileSync(skillMd, 'utf-8');
        const fm = _frontmatter(text);
        if (fm === null) {
            continue;
        }
        const desc = fm['description'] ?? '';
        const name = (fm['name'] as string) || path.basename(skillDir);
        if (desc) {
            skills.set(name, `${name} ${desc}`);
        }
    }
    return skills;
}

/** Rank skills by keyword overlap with the prompt; return top-K names. */
export function rank_skills(prompt: string, skills: Map<string, string>, topK: number): string[] {
    const promptTokens = tokenize(prompt);
    if (promptTokens.size === 0) {
        return [];
    }
    // (score, name) pairs, then sort reverse — replicating Python's
    // tuple sort which compares score first, then name.
    const scores: Array<[number, string]> = [];
    for (const [name, desc] of skills) {
        const descTokens = tokenize(desc);
        if (descTokens.size === 0) {
            continue;
        }
        const overlap = _intersection(promptTokens, descTokens);
        if (overlap === 0) {
            continue;
        }
        // Jaccard with a small IDF-shaped boost for rare matches.
        const union = _unionSize(promptTokens, descTokens);
        const score = overlap / union;
        scores.push([score, name]);
    }
    // Python: scores.sort(reverse=True) — tuple compare (score desc, name desc).
    scores.sort((a, b) => {
        if (a[0] !== b[0]) {
            return b[0] - a[0];
        }
        return _pyStrCmp(b[1], a[1]);
    });
    return scores.slice(0, topK).map(([, name]) => name);
}

interface PerPrompt {
    id: string;
    category: string;
    expected_skills: string[];
    top_k_ranked: string[];
    hit: boolean;
}

interface Summary {
    corpus_id: string;
    target: number;
    top_k: number;
    prompts_total: number;
    prompts_hit: number;
    selection_accuracy: number;
    passed: boolean;
    per_prompt: PerPrompt[];
}

interface CorpusPrompt {
    id: string;
    prompt: string;
    category?: string;
    expected_skills?: string[];
}

interface Corpus {
    corpus_id: string;
    selection_accuracy_target?: number;
    prompts: CorpusPrompt[];
}

export function run_corpus(corpusPath: string, topK: number): Summary {
    const corpus = _yamlSafeLoad(fs.readFileSync(corpusPath, 'utf-8')) as Corpus;
    const skills = load_skill_descriptions();
    const results: PerPrompt[] = [];
    let hits = 0;
    for (const p of corpus.prompts) {
        const ranked = rank_skills(p.prompt, skills, topK);
        const expected = new Set(p.expected_skills ?? []);
        const hit = _intersectionBool(expected, new Set(ranked));
        if (hit) {
            hits += 1;
        }
        results.push({
            id: p.id,
            category: p.category ?? '',
            expected_skills: _sortedStr([...expected]),
            top_k_ranked: ranked,
            hit,
        });
    }
    const n = results.length;
    const accuracy = n ? hits / n : 0.0;
    const target = corpus.selection_accuracy_target ?? 0.6;
    return {
        corpus_id: corpus.corpus_id,
        target,
        top_k: topK,
        prompts_total: n,
        prompts_hit: hits,
        selection_accuracy: _pyRound(accuracy, 4),
        passed: accuracy >= target,
        per_prompt: results,
    };
}

interface Args {
    corpus: string;
    topK: number;
    json: boolean;
}

function parse_args(argv: string[]): Args {
    const args: Args = { corpus: 'non-dev', topK: 3, json: false };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i]!;
        if (a === '--corpus') {
            args.corpus = argv[++i] ?? '';
        } else if (a.startsWith('--corpus=')) {
            args.corpus = a.slice('--corpus='.length);
        } else if (a === '--top-k') {
            args.topK = _pyInt(argv[++i] ?? '');
        } else if (a.startsWith('--top-k=')) {
            args.topK = _pyInt(a.slice('--top-k='.length));
        } else if (a === '--json') {
            args.json = true;
        } else {
            process.stderr.write(`bench_runner: error: unrecognized arguments: ${a}\n`);
            process.exitCode = 2;
            throw new ArgExit();
        }
    }
    return args;
}

class ArgExit extends Error {}

export function main(argv: string[] | null = null): number {
    const rawArgv = argv ?? process.argv.slice(2);
    const args = parse_args(rawArgv);

    const corpusPath = path.join(CORPUS_DIR, `corpus-${args.corpus}.yaml`);
    if (!_isFile(corpusPath)) {
        process.stderr.write(`error: corpus not found: ${corpusPath}\n`);
        return 2;
    }

    const summary = run_corpus(corpusPath, args.topK);

    if (args.json) {
        process.stdout.write(_jsonDumps(_summaryToJson(summary), 2) + '\n');
    } else {
        process.stdout.write(
            `corpus: ${summary.corpus_id}  target=${_pyNumStr(summary.target)}  top-k=${summary.top_k}\n`,
        );
        process.stdout.write(`prompts: ${summary.prompts_hit} / ${summary.prompts_total} hit\n`);
        process.stdout.write(`selection_accuracy: ${_fmtPct2(summary.selection_accuracy)}\n`);
        process.stdout.write(`verdict: ${summary.passed ? 'PASS' : 'FAIL'}\n`);
        for (const r of summary.per_prompt) {
            const mark = r.hit ? '✓' : '✗';
            // Python: f"  {mark} {r['id']:14s} expected={...} got={...[:3]}"
            process.stdout.write(
                `  ${mark} ${_ljust(r.id, 14)} expected=${_reprList(r.expected_skills)} got=${_reprList(r.top_k_ranked.slice(0, 3))}\n`,
            );
        }
    }

    return summary.passed ? 0 : 1;
}

// --- JSON shaping ------------------------------------------------------------

class PyFloat {
    constructor(readonly value: number) {}
}

type Json = null | boolean | number | string | PyFloat | Json[] | { [k: string]: Json };

function _summaryToJson(s: Summary): Json {
    return {
        corpus_id: s.corpus_id,
        target: new PyFloat(s.target),
        top_k: s.top_k,
        prompts_total: s.prompts_total,
        prompts_hit: s.prompts_hit,
        selection_accuracy: new PyFloat(s.selection_accuracy),
        passed: s.passed,
        per_prompt: s.per_prompt.map((r) => ({
            id: r.id,
            category: r.category,
            expected_skills: r.expected_skills,
            top_k_ranked: r.top_k_ranked,
            hit: r.hit,
        })),
    };
}

// --- Python helpers ----------------------------------------------------------

/** json.dumps(obj, indent=2) — sort_keys False, ensure_ascii True. */
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

function _pyRound(value: number, ndigits: number): number {
    if (!Number.isFinite(value)) return value;
    const factor = Math.pow(10, ndigits);
    const scaled = value * factor;
    const floor = Math.floor(scaled);
    const diff = scaled - floor;
    let rounded: number;
    const eps = 1e-9;
    if (Math.abs(diff - 0.5) < eps) {
        rounded = floor % 2 === 0 ? floor : floor + 1;
    } else {
        rounded = Math.round(scaled);
    }
    return rounded / factor;
}

/** Replicate Python f"{x:.2%}" — value × 100, round-half-to-even, '%' suffix. */
function _fmtPct2(x: number): string {
    return `${_pyFixed(x * 100, 2)}%`;
}

function _pyFixed(x: number, ndigits: number): string {
    if (!Number.isFinite(x)) return String(x);
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
        const dec = intStr.slice(intStr.length - ndigits);
        result = `${whole}.${dec}`;
    }
    return neg ? `-${result}` : result;
}

/** Render a number the way Python `str(x)` / f"{x}" would for the `target` field. */
function _pyNumStr(x: number): string {
    // Python prints e.g. 0.6 → "0.6", 0.55 → "0.55". For an integer-valued
    // float (rare for these corpora) Python keeps the ".0" — but the YAML
    // value is parsed as a Python int when it has no decimal point, so we
    // mirror str(int) vs str(float) by checking the source value shape.
    return String(x);
}

/** Mirror Python repr() of a list of strings: ['a', 'b']. */
function _reprList(items: string[]): string {
    return `[${items.map((i) => _reprStr(i)).join(', ')}]`;
}

function _reprStr(s: string): string {
    const hasSingle = s.includes("'");
    const hasDouble = s.includes('"');
    const quote = hasSingle && !hasDouble ? '"' : "'";
    let body = '';
    for (const ch of s) {
        if (ch === '\\') body += '\\\\';
        else if (ch === quote) body += '\\' + ch;
        else if (ch === '\n') body += '\\n';
        else if (ch === '\r') body += '\\r';
        else if (ch === '\t') body += '\\t';
        else body += ch;
    }
    return `${quote}${body}${quote}`;
}

function _ljust(s: string, width: number): string {
    const len = Array.from(s).length;
    return len >= width ? s : s + ' '.repeat(width - len);
}

function _intersection(a: Set<string>, b: Set<string>): number {
    let count = 0;
    for (const x of a) {
        if (b.has(x)) count += 1;
    }
    return count;
}

function _intersectionBool(a: Set<string>, b: Set<string>): boolean {
    for (const x of a) {
        if (b.has(x)) return true;
    }
    return false;
}

function _unionSize(a: Set<string>, b: Set<string>): number {
    const u = new Set(a);
    for (const x of b) u.add(x);
    return u.size;
}

function _sortedStr(items: string[]): string[] {
    return [...items].sort(_pyStrCmp);
}

function _pyStrCmp(a: string, b: string): number {
    const ca = Array.from(a);
    const cb = Array.from(b);
    const n = Math.min(ca.length, cb.length);
    for (let i = 0; i < n; i++) {
        const x = ca[i]!.codePointAt(0)!;
        const y = cb[i]!.codePointAt(0)!;
        if (x !== y) return x - y;
    }
    return ca.length - cb.length;
}

function _pyInt(s: string): number {
    // argparse type=int — parse decimal integer; on failure mirror argparse
    // exit 2. The CLI fixtures only pass valid ints, so a strict parse is fine.
    const trimmed = s.trim();
    if (!/^[+-]?\d+$/.test(trimmed)) {
        process.stderr.write(`bench_runner: error: argument --top-k: invalid int value: '${s}'\n`);
        process.exitCode = 2;
        throw new ArgExit();
    }
    return parseInt(trimmed, 10);
}

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

function _iterdirSorted(root: string): string[] {
    // sorted(SKILLS_DIR.iterdir()) — full-path lexical sort, component-wise.
    let names: string[];
    try {
        names = fs.readdirSync(root);
    } catch {
        // Python iterdir() on a missing dir raises; but callers guard with
        // is_file checks downstream. Mirror by returning nothing — a missing
        // skills dir is not expected in the real repo.
        return [];
    }
    const full = names.map((n) => path.join(root, n));
    full.sort((a, b) => _pyStrCmp(a, b));
    return full;
}

function _frontmatter(text: string): Record<string, string> | null {
    // re.search(r"^---\s*\n(.*?)\n---\s*\n", text, re.DOTALL) — `^` is
    // start-of-string (no MULTILINE); `\s` includes newlines; `.` matches
    // newlines (DOTALL). JS `\s` matches the same ASCII+Unicode whitespace.
    const m = /^---\s*\n([\s\S]*?)\n---\s*\n/.exec(text);
    if (!m) {
        return null;
    }
    try {
        const fm = (_yamlSafeLoad(m[1]!) as Record<string, string>) ?? {};
        return fm === null ? {} : fm;
    } catch {
        return null;
    }
}

function _yamlSafeLoad(s: string): unknown {
    return parseYaml(s, { version: '1.1' });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
    try {
        process.exitCode = main();
    } catch (e) {
        if (e instanceof ArgExit) {
            process.exitCode = process.exitCode ?? 2;
        } else {
            throw e;
        }
    }
}
