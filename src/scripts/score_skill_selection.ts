#!/usr/bin/env node
/**
 * Selection-accuracy scorer (council file 05, Phase 2.2).
 *
 * TypeScript twin of `src/scripts/score_skill_selection.py` (ADR-092 —
 * Python→TS migration, Phase 8 / Wave 8c). Mirrors the CLI contract EXACTLY:
 * flags (`--predictions`, `--baseline`, `--source`, `--out`), exit codes
 * (0 / 2 when neither --predictions nor --baseline given), byte-identical
 * stdout/stderr, and the byte-identical written report
 * (`json.dumps(indent=2) + "\n"`). No behaviour changes.
 *
 * Reads `tests/fixtures/skill_selection/fixtures.yml` and a predictions
 * JSON (`{fixture_id: selected_skill_name}`), then computes:
 *
 * - (a) intended-skill hit rate — exact `intended` match
 * - (b) correct-cluster hit rate — any member of the same cluster
 *
 * Per-cluster pass/fail uses the Round-3 protocol:
 *     pass = (a) >= 0.90  OR  (b) >= 0.95
 *     fail = (a) <  0.80  AND  (b) <  0.80   →  cluster needs `routes_to`
 *
 * NOTE: the .py reads the legacy `.agent-src.uncondensed/skills` literal;
 * this faithful twin replicates it byte-for-byte. When inputs are missing
 * the .py raises an uncaught FileNotFoundError → exit 1; this twin mirrors
 * that by throwing.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';

const _HERE = fileURLToPath(import.meta.url);
// src/scripts/score_skill_selection.ts → parents[2] is the repo root.
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const FIXTURES = path.join(REPO_ROOT, 'tests', 'fixtures', 'skill_selection', 'fixtures.yml');
const CLUSTERS = path.join(REPO_ROOT, 'agents', 'reports', 'skill-collision-clusters.json');
const SKILLS_DIR = path.join(REPO_ROOT, '.agent-src.uncondensed', 'skills');
const DEFAULT_OUT = path.join(REPO_ROOT, 'agents', 'reports', 'skill-selection-accuracy.json');

const PASS_A = 0.9;
const PASS_B = 0.95;
const FAIL_THRESHOLD = 0.8;

const STOPWORDS = new Set([
    'the', 'and', 'for', 'with', 'when', 'use', 'or', 'of', 'to', 'a', 'an',
    'is', 'in', 'on', 'by', 'be', 'at', 'as', 'it', 'if', 'are', 'this',
    'that', 'from', 'but', 'not', 'can', 'any', 'all', 'no', 'after',
    'before', 'during', 'user', 'agent', 'code', 'project', 'via', 'into',
    'onto', 'even', 'without', 'naming', 'uses', 'used', 'using', 'also',
    'etc', 'across', 'between',
]);

function tokenize(text: string): string[] {
    // re.findall(r"[A-Za-z][A-Za-z0-9_-]{2,}", text.lower())
    const re = /[A-Za-z][A-Za-z0-9_-]{2,}/g;
    const lowered = text.toLowerCase();
    const tokens: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(lowered)) !== null) {
        tokens.push(m[0]);
    }
    return tokens.filter((t) => !STOPWORDS.has(t) && !_isDigit(t));
}

function loadSkills(): Map<string, string> {
    const out = new Map<string, string>();
    for (const skillMd of _globSkillMd(SKILLS_DIR)) {
        const text = fs.readFileSync(skillMd, 'utf-8');
        if (!text.startsWith('---')) continue;
        const parts = _splitParts(text, '---', 2);
        if (parts.length < 3) continue;
        let fm: Record<string, unknown>;
        try {
            fm = (_yamlSafeLoad(parts[1]!) as Record<string, unknown>) || {};
        } catch {
            continue;
        }
        if (fm === null || fm === undefined) fm = {};
        const name = (fm['name'] as string) || path.basename(path.dirname(skillMd));
        const desc = String(fm['description'] ?? '').trim();
        if (desc) out.set(name, desc);
    }
    return out;
}

function tfidfVectors(docs: Map<string, string>): [Map<string, Map<string, number>>, Map<string, number>] {
    const nDocs = docs.size;
    const df = new Map<string, number>();
    const tokenized = new Map<string, string[]>();
    for (const [k, v] of docs) tokenized.set(k, tokenize(v));
    for (const toks of tokenized.values()) {
        for (const term of new Set(toks)) df.set(term, (df.get(term) ?? 0) + 1);
    }
    const idf = new Map<string, number>();
    for (const [term, count] of df) idf.set(term, Math.log((nDocs + 1) / (count + 1)) + 1);
    const vectors = new Map<string, Map<string, number>>();
    for (const [name, toks] of tokenized) {
        const tf = _counter(toks);
        const vec = new Map<string, number>();
        for (const term of tf.keys()) vec.set(term, tf.get(term)! * (idf.get(term) ?? 0.0));
        vectors.set(name, vec);
    }
    return [vectors, idf];
}

function cosine(a: Map<string, number>, b: Map<string, number>): number {
    if (a.size === 0 || b.size === 0) return 0.0;
    let dot = 0.0;
    for (const [t, av] of a) {
        const bv = b.get(t);
        if (bv !== undefined) dot += av * bv;
    }
    let na = 0.0;
    for (const v of a.values()) na += v * v;
    na = Math.sqrt(na);
    let nb = 0.0;
    for (const v of b.values()) nb += v * v;
    nb = Math.sqrt(nb);
    if (na === 0 || nb === 0) return 0.0;
    return dot / (na * nb);
}

function baselinePredict(fixtures: Fixture[], skills: Map<string, string>): Record<string, string> {
    const [vectors, idf] = tfidfVectors(skills);
    const preds: Record<string, string> = {};
    for (const fx of fixtures) {
        const promptTokens = tokenize(fx.prompt);
        const tf = _counter(promptTokens);
        const pv = new Map<string, number>();
        for (const term of tf.keys()) pv.set(term, tf.get(term)! * (idf.get(term) ?? 0.0));
        let bestName = '';
        let bestScore = -1.0;
        for (const [name, vec] of vectors) {
            const score = cosine(pv, vec);
            if (score > bestScore) {
                bestName = name;
                bestScore = score;
            }
        }
        preds[fx.id] = bestName;
    }
    return preds;
}

interface Fixture {
    id: string;
    prompt: string;
    intended: string;
    cluster?: string;
}

interface Cluster {
    members: string[];
}

interface ClusterResult {
    cluster: string;
    n: number;
    hit_a: number;
    hit_b: number;
    verdict: string;
    misses: Array<{ id: string; intended: string; predicted: string }>;
}

interface ScoreReport {
    clusters: ClusterResult[];
    overall: { n: number; hit_a: number; hit_b: number };
    source?: string;
}

function score(fixtures: Fixture[], clusters: Cluster[], preds: Record<string, string>): ScoreReport {
    const byMember = new Map<string, Set<string>>();
    for (const c of clusters) {
        const members = new Set(c.members);
        for (const m of members) byMember.set(m, members);
    }
    interface Rec {
        total: number;
        hits_a: number;
        hits_b: number;
        misses: Array<{ id: string; intended: string; predicted: string }>;
        label: string;
    }
    // defaultdict — preserve insertion order of cluster ids.
    const perCluster = new Map<string, Rec>();
    const getRec = (cid: string): Rec => {
        let r = perCluster.get(cid);
        if (!r) {
            r = { total: 0, hits_a: 0, hits_b: 0, misses: [], label: '' };
            perCluster.set(cid, r);
        }
        return r;
    };
    for (const fx of fixtures) {
        const intended = fx.intended;
        const members = byMember.get(intended) ?? new Set([intended]);
        // fx.get("cluster") or "+".join(sorted(members)[:2])
        const cid = _pyTruthy(fx.cluster) ? fx.cluster! : [...members].sort(_pyStrCmp).slice(0, 2).join('+');
        const pred = preds[fx.id] ?? '';
        const rec = getRec(cid);
        rec.total += 1;
        rec.label = [...members].sort(_pyStrCmp).join(',');
        if (pred === intended) rec.hits_a += 1;
        if (members.has(pred)) rec.hits_b += 1;
        else rec.misses.push({ id: fx.id, intended, predicted: pred });
    }
    const results: ClusterResult[] = [];
    // sorted(per_cluster.items()) — by cluster id.
    const sortedCids = [...perCluster.keys()].sort(_pyStrCmp);
    for (const cid of sortedCids) {
        const rec = perCluster.get(cid)!;
        const a = rec.hits_a / rec.total;
        const b = rec.hits_b / rec.total;
        let verdict: string;
        if (a >= PASS_A || b >= PASS_B) verdict = 'pass';
        else if (a < FAIL_THRESHOLD && b < FAIL_THRESHOLD) verdict = 'fail-needs-routes_to';
        else verdict = 'mixed';
        results.push({
            cluster: cid,
            n: rec.total,
            hit_a: _pyRound(a, 3),
            hit_b: _pyRound(b, 3),
            verdict,
            misses: rec.misses,
        });
    }
    const total = results.reduce((acc, r) => acc + r.n, 0);
    const overallA = total ? results.reduce((acc, r) => acc + r.hit_a * r.n, 0) / total : 0.0;
    const overallB = total ? results.reduce((acc, r) => acc + r.hit_b * r.n, 0) / total : 0.0;
    return {
        clusters: results,
        overall: { n: total, hit_a: _pyRound(overallA, 3), hit_b: _pyRound(overallB, 3) },
    };
}

interface Args {
    predictions: string | null;
    baseline: boolean;
    source: string;
    out: string;
}

function parse_args(argv: string[]): Args {
    const args: Args = { predictions: null, baseline: false, source: 'external', out: DEFAULT_OUT };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i]!;
        if (a === '--predictions') args.predictions = argv[++i] ?? '';
        else if (a.startsWith('--predictions=')) args.predictions = a.slice('--predictions='.length);
        else if (a === '--baseline') args.baseline = true;
        else if (a === '--source') args.source = argv[++i] ?? '';
        else if (a.startsWith('--source=')) args.source = a.slice('--source='.length);
        else if (a === '--out') args.out = argv[++i] ?? '';
        else if (a.startsWith('--out=')) args.out = a.slice('--out='.length);
        else {
            process.stderr.write(`score_skill_selection: error: unrecognized arguments: ${a}\n`);
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

    if (!args.predictions && !args.baseline) {
        process.stderr.write('❌  Specify --predictions <file> or --baseline\n');
        return 2;
    }
    const fixturesDoc = _yamlSafeLoad(_readText(FIXTURES)) as { fixtures: Fixture[] };
    const fixtures = fixturesDoc.fixtures;
    const clustersDoc = JSON.parse(_readText(CLUSTERS)) as { clusters: Cluster[] };
    const clusters = clustersDoc.clusters;
    const skills = loadSkills();
    let preds: Record<string, string>;
    let source: string;
    if (args.baseline) {
        preds = baselinePredict(fixtures, skills);
        source = 'tfidf-baseline';
    } else {
        preds = JSON.parse(_readText(args.predictions!)) as Record<string, string>;
        source = args.source;
    }
    const report = score(fixtures, clusters, preds);
    report.source = source;
    fs.mkdirSync(path.dirname(args.out), { recursive: true });
    fs.writeFileSync(args.out, _jsonDumpsIndent2(_reportToJson(report)) + '\n');
    process.stdout.write(`✅  Wrote ${_relPosix(args.out, REPO_ROOT)}  (source=${source})\n`);
    process.stdout.write(
        `   overall: hit_a=${_pyFixed(report.overall.hit_a, 3)}  hit_b=${_pyFixed(report.overall.hit_b, 3)}  n=${report.overall.n}\n`,
    );
    for (const c of report.clusters) {
        process.stdout.write(
            `   ${_ljust(c.cluster, 6)}  n=${_rjust(String(c.n), 2)}  hit_a=${_pyFixed(c.hit_a, 2)}  ` +
                `hit_b=${_pyFixed(c.hit_b, 2)}  ${c.verdict}\n`,
        );
    }
    return 0;
}

// --- JSON shaping ------------------------------------------------------------

class PyFloat {
    constructor(readonly value: number) {}
}

type Json = null | boolean | number | string | PyFloat | Json[] | { [k: string]: Json };

function _reportToJson(r: ScoreReport): Json {
    return {
        clusters: r.clusters.map((c) => ({
            cluster: c.cluster,
            n: c.n,
            hit_a: new PyFloat(c.hit_a),
            hit_b: new PyFloat(c.hit_b),
            verdict: c.verdict,
            misses: c.misses.map((m) => ({ id: m.id, intended: m.intended, predicted: m.predicted })),
        })),
        overall: { n: r.overall.n, hit_a: new PyFloat(r.overall.hit_a), hit_b: new PyFloat(r.overall.hit_b) },
        source: r.source ?? null,
    };
}

function _jsonDumpsIndent2(obj: Json): string {
    return _jsonDumps(obj, 2);
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

// --- Python helpers ----------------------------------------------------------

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

function _counter(items: string[]): Map<string, number> {
    const m = new Map<string, number>();
    for (const it of items) m.set(it, (m.get(it) ?? 0) + 1);
    return m;
}

function _isDigit(s: string): boolean {
    // Python str.isdigit() — non-empty and all digits.
    return s.length > 0 && /^[0-9]+$/.test(s);
}

function _readText(p: string): string {
    try {
        return fs.readFileSync(p, 'utf-8');
    } catch (e) {
        const err = e as NodeJS.ErrnoException;
        if (err.code === 'ENOENT') {
            throw new Error(`FileNotFoundError: [Errno 2] No such file or directory: '${p}'`);
        }
        throw e;
    }
}

function _splitParts(text: string, sep: string, maxsplit: number): string[] {
    const out: string[] = [];
    let rest = text;
    let count = 0;
    while (count < maxsplit) {
        const idx = rest.indexOf(sep);
        if (idx < 0) break;
        out.push(rest.slice(0, idx));
        rest = rest.slice(idx + sep.length);
        count += 1;
    }
    out.push(rest);
    return out;
}

function _yamlSafeLoad(s: string): unknown {
    const v = parseYaml(s, { version: '1.1' });
    return restorePyScalars(v);
}

function restorePyScalars(v: unknown): unknown {
    if (Array.isArray(v)) return v.map(restorePyScalars);
    if (v && typeof v === 'object' && !(v instanceof Date)) {
        const o = v as Record<string, unknown>;
        const out: Record<string, unknown> = {};
        for (const k of Object.keys(o)) out[k] = restorePyScalars(o[k]);
        return out;
    }
    return v;
}

function _globSkillMd(root: string): string[] {
    let dirs: string[];
    try {
        dirs = fs.readdirSync(root, { withFileTypes: true })
            .filter((e) => e.isDirectory() || e.isSymbolicLink())
            .map((e) => e.name);
    } catch (e) {
        const err = e as NodeJS.ErrnoException;
        if (err.code === 'ENOENT') {
            // sorted(SKILLS_DIR.glob(...)) on a missing dir yields nothing in
            // CPython (glob does not raise). Return empty.
            return [];
        }
        throw e;
    }
    const out: string[] = [];
    for (const d of dirs) {
        const cand = path.join(root, d, 'SKILL.md');
        try {
            if (fs.statSync(cand).isFile()) out.push(cand);
        } catch {
            // not a file
        }
    }
    out.sort((a, b) => _pyPathCmp(a, b));
    return out;
}

function _pyPathCmp(a: string, b: string): number {
    const pa = a.split(path.sep);
    const pb = b.split(path.sep);
    const n = Math.min(pa.length, pb.length);
    for (let i = 0; i < n; i++) {
        const c = _pyStrCmp(pa[i]!, pb[i]!);
        if (c !== 0) return c;
    }
    return pa.length - pb.length;
}

function _pyTruthy(v: unknown): boolean {
    if (v === null || v === undefined || v === false) return false;
    if (v === '' || v === 0) return false;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'object') return Object.keys(v as object).length > 0;
    return Boolean(v);
}

function _relPosix(p: string, base: string): string {
    return path.relative(base, p).split(path.sep).join('/');
}

function _ljust(s: string, width: number): string {
    const len = Array.from(s).length;
    return len >= width ? s : s + ' '.repeat(width - len);
}

function _rjust(s: string, width: number): string {
    const len = Array.from(s).length;
    return len >= width ? s : ' '.repeat(width - len) + s;
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
