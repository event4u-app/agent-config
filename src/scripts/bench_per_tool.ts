#!/usr/bin/env node
/**
 * Per-tool projection-fidelity bench — step-4 Phase 4.
 *
 * TypeScript twin of `src/scripts/bench_per_tool.py` (ADR-090 Python→TS
 * migration, Phase 8 / Wave 8d). Mirrors the CLI contract EXACTLY: flags
 * (`--corpus`, `--top-k`, `--threshold`, `--json`, `--write-report`), exit
 * codes (0 / 1 below-threshold / 2 corpus not found), byte-identical
 * stdout/stderr, and byte-identical written JSON + Markdown reports. No
 * behaviour changes.
 *
 * Re-runs the keyword-overlap selection scorer against each projected
 * tool surface and computes:
 *
 *     fidelity(tool) = selection_accuracy(tool) / selection_accuracy(reference)
 *
 * Reference = Augment projection (most complete per roadmap). Threshold
 * for "fit for purpose" is >= 0.85.
 *
 * Surfaces:
 * - `.augment/skills/`   skill projection      automated  (reference)
 * - `.claude/skills/`    skill projection      automated
 * - `.cursor/rules/`     rules-only            not_applicable (no skill projection)
 * - `.windsurfrules`     single concatenated   not_applicable
 * - `.clinerules/`       rules-only            not_applicable
 *
 * Usage:
 *     python3 scripts/bench_per_tool.py --corpus dev
 *     python3 scripts/bench_per_tool.py --corpus dev --json
 *     python3 scripts/bench_per_tool.py --corpus dev --threshold 0.85
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';

// Reuse tokenization + ranking from the reference runner so the only axis
// that changes between tools is the skill catalogue on disk.
import { rank_skills } from './bench_runner.js';

const _HERE = fileURLToPath(import.meta.url);
// src/scripts/bench_per_tool.ts → parents[2] is the repo root.
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const CORPUS_DIR = path.join(REPO_ROOT, 'tests', 'eval');
const REPORTS_DIR = path.join(REPO_ROOT, 'internal', 'bench', 'reports');

// tool_id -> [skills_root, kind]. kind = "skills" | "rules_only" | "single_file".
// Insertion order mirrors the Python dict literal (used for iteration order).
const SURFACES: Array<[string, [string, string]]> = [
    ['augment', [path.join(REPO_ROOT, '.augment', 'skills'), 'skills']],
    ['claude', [path.join(REPO_ROOT, '.claude', 'skills'), 'skills']],
    ['cursor', [path.join(REPO_ROOT, '.cursor', 'rules'), 'rules_only']],
    ['cline', [path.join(REPO_ROOT, '.clinerules'), 'rules_only']],
    ['windsurf', [path.join(REPO_ROOT, '.windsurfrules'), 'single_file']],
];

const REFERENCE_TOOL = 'augment';

/** Return {skill_name: 'name + description'} for SKILL.md files under root. */
export function load_descriptions(root: string): Map<string, string> {
    const out = new Map<string, string>();
    if (!_isDir(root)) {
        return out;
    }
    for (const skillDir of _iterdirSorted(root)) {
        const skillMd = path.join(skillDir, 'SKILL.md');
        if (!_isFile(skillMd)) {
            continue;
        }
        const text = fs.readFileSync(skillMd, 'utf-8');
        const fm = _frontmatter(text);
        if (fm === null) {
            continue;
        }
        const desc = fm['description'] || '';
        const name = (fm['name'] as string) || path.basename(skillDir);
        if (desc) {
            out.set(name, `${name} ${desc}`);
        }
    }
    return out;
}

interface PerPrompt {
    id: string;
    expected: string[];
    ranked: string[];
    hit: boolean;
}

interface ScoredOk {
    prompts_total: number;
    prompts_hit: number;
    selection_accuracy: number;
    skill_count: number;
    per_prompt: PerPrompt[];
    status?: string;
    path?: string;
    fidelity?: number;
    passed_threshold?: boolean;
}

interface ToolResultNonOk {
    status: string;
    reason: string;
    path: string;
}

type ToolResult = ScoredOk | ToolResultNonOk;

interface CorpusPrompt {
    id: string;
    prompt: string;
    expected_skills?: string[];
}

interface Corpus {
    corpus_id: string;
    prompts: CorpusPrompt[];
}

interface Summary {
    schema: string;
    generated_at: string;
    corpus_id: string;
    top_k: number;
    threshold: number;
    reference_tool: string;
    reference_accuracy: number;
    tools: Array<[string, ToolResult]>;
    below_threshold: string[];
}

function score_corpus(skills: Map<string, string>, prompts: CorpusPrompt[], topK: number): ScoredOk {
    let hits = 0;
    const perPrompt: PerPrompt[] = [];
    for (const p of prompts) {
        const ranked = rank_skills(p.prompt, skills, topK);
        const expected = new Set(p.expected_skills ?? []);
        const hit = _intersectionBool(expected, new Set(ranked));
        if (hit) {
            hits += 1;
        }
        perPrompt.push({ id: p.id, expected: _sortedStr([...expected]), ranked, hit });
    }
    const n = prompts.length;
    return {
        prompts_total: n,
        prompts_hit: hits,
        selection_accuracy: n ? _pyRound(hits / n, 4) : 0.0,
        skill_count: skills.size,
        per_prompt: perPrompt,
    };
}

export function evaluate(corpusPath: string, topK: number, threshold: number): Summary {
    const corpus = _yamlSafeLoad(fs.readFileSync(corpusPath, 'utf-8')) as Corpus;
    const prompts = corpus.prompts;
    const results: Array<[string, ToolResult]> = [];

    for (const [tool, [root, kind]] of SURFACES) {
        if (kind !== 'skills') {
            results.push([
                tool,
                {
                    status: 'not_applicable',
                    reason: `surface is ${kind}; no SKILL.md projection`,
                    path: _relPosix(root, REPO_ROOT),
                },
            ]);
            continue;
        }
        const skills = load_descriptions(root);
        if (skills.size === 0) {
            results.push([
                tool,
                { status: 'error', reason: 'no skills found', path: _relPosix(root, REPO_ROOT) },
            ]);
            continue;
        }
        const scored = score_corpus(skills, prompts, topK);
        scored.status = 'ok';
        scored.path = _relPosix(root, REPO_ROOT);
        results.push([tool, scored]);
    }

    const ref = _lookupResult(results, REFERENCE_TOOL);
    const refAcc =
        ref !== null && (ref as ScoredOk).status === 'ok' ? (ref as ScoredOk).selection_accuracy : 0.0;
    const below: string[] = [];
    for (const [tool, r] of results) {
        if ((r as ScoredOk).status !== 'ok') {
            continue;
        }
        const ok = r as ScoredOk;
        const fidelity = refAcc ? ok.selection_accuracy / refAcc : 0.0;
        ok.fidelity = _pyRound(fidelity, 4);
        ok.passed_threshold = fidelity >= threshold;
        if (tool !== REFERENCE_TOOL && !ok.passed_threshold) {
            below.push(tool);
        }
    }

    return {
        schema: 'projection-fidelity-v1',
        generated_at: _utcStrftimeIso(),
        corpus_id: corpus.corpus_id,
        top_k: topK,
        threshold,
        reference_tool: REFERENCE_TOOL,
        reference_accuracy: refAcc,
        tools: results,
        below_threshold: below,
    };
}

export function render_markdown(summary: Summary): string {
    const lines: string[] = [
        `# Projection fidelity — ${summary.corpus_id}`,
        '',
        `_Generated ${summary.generated_at} · top-K=${summary.top_k} · ` +
            `threshold=${_pyFixed(summary.threshold, 2)} · reference=\`${summary.reference_tool}\`_`,
        '',
        '| tool | status | skills | accuracy | fidelity | pass |',
        '|---|---|---:|---:|---:|---|',
    ];
    for (const [tool, r] of summary.tools) {
        const status = (r as { status?: string }).status ?? '?';
        if (status !== 'ok') {
            lines.push(`| \`${tool}\` | ${status} | — | — | — | — |`);
            continue;
        }
        const ok = r as ScoredOk;
        lines.push(
            `| \`${tool}\` | ok | ${ok.skill_count} | ` +
                `${_fmtPct2(ok.selection_accuracy)} | ${_pyFixed(ok.fidelity!, 2)} | ` +
                `${ok.passed_threshold ? '✅' : '❌'} |`,
        );
    }
    if (summary.below_threshold.length > 0) {
        lines.push(
            '',
            `**Below threshold:** ${summary.below_threshold.join(', ')} ` +
                '→ inspect `scripts/_lib/generate_tools.py` projection mapping.',
        );
    } else {
        lines.push('', '**All projections fit-for-purpose** (≥ threshold).');
    }
    return lines.join('\n') + '\n';
}

interface Args {
    corpus: string;
    topK: number;
    threshold: number;
    json: boolean;
    writeReport: boolean;
}

function parse_args(argv: string[]): Args {
    const args: Args = { corpus: 'dev', topK: 3, threshold: 0.85, json: false, writeReport: false };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i]!;
        if (a === '--corpus') args.corpus = argv[++i] ?? '';
        else if (a.startsWith('--corpus=')) args.corpus = a.slice('--corpus='.length);
        else if (a === '--top-k') args.topK = _pyInt(argv[++i] ?? '', '--top-k');
        else if (a.startsWith('--top-k=')) args.topK = _pyInt(a.slice('--top-k='.length), '--top-k');
        else if (a === '--threshold') args.threshold = _pyFloat(argv[++i] ?? '', '--threshold');
        else if (a.startsWith('--threshold='))
            args.threshold = _pyFloat(a.slice('--threshold='.length), '--threshold');
        else if (a === '--json') args.json = true;
        else if (a === '--write-report') args.writeReport = true;
        else {
            process.stderr.write(`bench_per_tool: error: unrecognized arguments: ${a}\n`);
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

    const summary = evaluate(corpusPath, args.topK, args.threshold);

    if (args.writeReport) {
        fs.mkdirSync(REPORTS_DIR, { recursive: true });
        const stamp = summary.generated_at.replace(/:/g, '-');
        const base = path.join(REPORTS_DIR, `${stamp}-${args.corpus}-projection`);
        fs.writeFileSync(`${base}.json`, _jsonDumps(_summaryToJson(summary), 2) + '\n');
        fs.writeFileSync(`${base}.md`, render_markdown(summary));
        process.stderr.write(`wrote ${base}.json + ${base}.md\n`);
    }

    if (args.json) {
        process.stdout.write(_jsonDumps(_summaryToJson(summary), 2) + '\n');
    } else {
        process.stdout.write(render_markdown(summary) + '\n');
    }

    return summary.below_threshold.length > 0 ? 1 : 0;
}

// --- JSON shaping ------------------------------------------------------------

class PyFloat {
    constructor(readonly value: number) {}
}

type Json = null | boolean | number | string | PyFloat | Json[] | { [k: string]: Json };

function _summaryToJson(s: Summary): Json {
    const tools: { [k: string]: Json } = {};
    for (const [tool, r] of s.tools) {
        const status = (r as { status?: string }).status;
        if (status !== 'ok') {
            const nonOk = r as ToolResultNonOk;
            tools[tool] = { status: nonOk.status, reason: nonOk.reason, path: nonOk.path };
        } else {
            const ok = r as ScoredOk;
            tools[tool] = {
                prompts_total: ok.prompts_total,
                prompts_hit: ok.prompts_hit,
                selection_accuracy: new PyFloat(ok.selection_accuracy),
                skill_count: ok.skill_count,
                per_prompt: ok.per_prompt.map((p) => ({
                    id: p.id,
                    expected: p.expected,
                    ranked: p.ranked,
                    hit: p.hit,
                })),
                status: 'ok',
                path: ok.path ?? null,
                fidelity: new PyFloat(ok.fidelity ?? 0),
                passed_threshold: ok.passed_threshold ?? false,
            };
        }
    }
    return {
        schema: s.schema,
        generated_at: s.generated_at,
        corpus_id: s.corpus_id,
        top_k: s.top_k,
        threshold: new PyFloat(s.threshold),
        reference_tool: s.reference_tool,
        reference_accuracy: new PyFloat(s.reference_accuracy),
        tools,
        below_threshold: s.below_threshold,
    };
}

// --- Python helpers ----------------------------------------------------------

function _lookupResult(results: Array<[string, ToolResult]>, tool: string): ToolResult | null {
    for (const [t, r] of results) {
        if (t === tool) return r;
    }
    return null;
}

/** datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ") */
function _utcStrftimeIso(): string {
    const d = new Date();
    const Y = String(d.getUTCFullYear()).padStart(4, '0');
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const D = String(d.getUTCDate()).padStart(2, '0');
    const H = String(d.getUTCHours()).padStart(2, '0');
    const M = String(d.getUTCMinutes()).padStart(2, '0');
    const S = String(d.getUTCSeconds()).padStart(2, '0');
    return `${Y}-${m}-${D}T${H}:${M}:${S}Z`;
}

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

function _intersectionBool(a: Set<string>, b: Set<string>): boolean {
    for (const x of a) {
        if (b.has(x)) return true;
    }
    return false;
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

function _pyInt(s: string, flag: string): number {
    const trimmed = s.trim();
    if (!/^[+-]?\d+$/.test(trimmed)) {
        process.stderr.write(`bench_per_tool: error: argument ${flag}: invalid int value: '${s}'\n`);
        process.exitCode = 2;
        throw new ArgExit();
    }
    return parseInt(trimmed, 10);
}

function _pyFloat(s: string, flag: string): number {
    const trimmed = s.trim();
    const v = Number(trimmed);
    if (trimmed === '' || Number.isNaN(v)) {
        process.stderr.write(`bench_per_tool: error: argument ${flag}: invalid float value: '${s}'\n`);
        process.exitCode = 2;
        throw new ArgExit();
    }
    return v;
}

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
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

function _iterdirSorted(root: string): string[] {
    let names: string[];
    try {
        names = fs.readdirSync(root);
    } catch {
        return [];
    }
    const full = names.map((n) => path.join(root, n));
    full.sort((a, b) => _pyStrCmp(a, b));
    return full;
}

function _frontmatter(text: string): Record<string, string> | null {
    // re.search(r"^---\s*\n(.*?)\n---\s*\n", text, re.DOTALL)
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

function _relPosix(p: string, base: string): string {
    return path.relative(base, p).split(path.sep).join('/');
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
