#!/usr/bin/env node
/**
 * Trigger-overlap analysis for the Rule-Governance pass (Phase 5.2 of
 * road-to-augment-limit-fit).
 *
 * TypeScript twin of `src/scripts/audit_overlap.py` (ADR-096 —
 * Python→TS migration, Phase 8 / Wave 8c). Mirrors the CLI contract
 * EXACTLY: no flags, exit codes (0 normal, 1 when the input audit JSON
 * is missing), byte-identical stdout/stderr split, and byte-identical
 * written output (`auto-rules-overlap.json` via json.dumps(indent=2)
 * and the appended `auto-rules-audit.md` section). No behaviour changes
 * — latent bugs replicated.
 *
 * Reads `agents/reports/auto-rules-audit.json` (produced by
 * `audit_auto_rules.py`) and computes:
 *
 * - path-prefix Jaccard similarity (per pair of rules);
 * - description-keyword overlap fraction (per pair of rules).
 *
 * Pairs scoring `path_jaccard >= 0.5` OR `keyword_overlap >= 0.4` are
 * flagged as merge candidates. Output is appended to
 * `agents/reports/auto-rules-audit.md` and a structured JSON list is
 * written to `agents/reports/auto-rules-overlap.json` for downstream
 * consumers (Phase 5.3 likelihood, 5.4 council walk).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
// src/scripts/audit_overlap.ts → parents[2] is the repo root (mirrors
// `Path(__file__).resolve().parent.parent.parent` in the .py).
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const REPORT_DIR = path.join(REPO_ROOT, 'agents', 'reports');
const AUDIT_JSON = path.join(REPORT_DIR, 'auto-rules-audit.json');
const AUDIT_MD = path.join(REPORT_DIR, 'auto-rules-audit.md');
const OVERLAP_JSON = path.join(REPORT_DIR, 'auto-rules-overlap.json');

const PATH_THRESHOLD = 0.5;
const KEYWORD_THRESHOLD = 0.4;

const STOPWORDS = new Set<string>([
    'the', 'and', 'for', 'with', 'when', 'use', 'or', 'of', 'to', 'a',
    'an', 'is', 'in', 'on', 'by', 'be', 'at', 'as', 'it', 'if', 'are',
    'this', 'that', 'from', 'but', 'not', 'can', 'any', 'all', 'no',
    'after', 'before', 'during', 'user', 'agent', 'code', 'project',
    'via', 'into', 'onto', 'even', 'without', 'naming',
]);

const _KEYWORD_RE = /[A-Za-z][A-Za-z0-9_-]{2,}/g;
const _ALL_DIGITS = /^[0-9]+$/;

interface RuleTriggers {
    path_prefixes: string[];
    keywords: string[];
    intents: string[];
}

interface RuleEntry {
    name: string;
    description: string;
    triggers: RuleTriggers;
}

interface Pair {
    rule_a: string;
    rule_b: string;
    path_jaccard: number;
    keyword_overlap: number;
    shared_paths: string[];
    shared_keywords: string[];
    rule_a_desc: string;
    rule_b_desc: string;
}

/**
 * Mirror of Python's `str.isdigit()` for the token filter: true only when
 * the string is non-empty and every char is a decimal digit. (The regex
 * tokens here cannot start with a digit, so this is effectively never
 * true, but the check is replicated faithfully.)
 */
function _isDigit(token: string): boolean {
    return token.length > 0 && _ALL_DIGITS.test(token);
}

function keyword_set(text: string): Set<string> {
    const tokens = text.toLowerCase().match(_KEYWORD_RE) ?? [];
    const out = new Set<string>();
    for (const t of tokens) {
        if (!STOPWORDS.has(t) && !_isDigit(t)) {
            out.add(t);
        }
    }
    return out;
}

function _intersection(a: Set<string>, b: Set<string>): Set<string> {
    const out = new Set<string>();
    for (const x of a) {
        if (b.has(x)) {
            out.add(x);
        }
    }
    return out;
}

function _unionSize(a: Set<string>, b: Set<string>): number {
    const u = new Set<string>(a);
    for (const x of b) {
        u.add(x);
    }
    return u.size;
}

function jaccard(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 && b.size === 0) {
        return 0.0;
    }
    return _intersection(a, b).size / _unionSize(a, b);
}

/** Symmetric overlap as fraction of smaller set. */
function overlap_fraction(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 || b.size === 0) {
        return 0.0;
    }
    return _intersection(a, b).size / Math.min(a.size, b.size);
}

/**
 * Replicate Python's `round(x, 3)` — banker's rounding (round-half-to-even)
 * at 3 decimal places. JS `toFixed`/`Math.round` use round-half-up, which
 * diverges on ties (e.g. 0.0005). The keyword/path scores are ratios of
 * small integers, so ties are possible; mirror CPython exactly.
 */
function _round3(x: number): number {
    return _pyRound(x, 3);
}

function _pyRound(value: number, ndigits: number): number {
    if (!Number.isFinite(value)) {
        return value;
    }
    const factor = Math.pow(10, ndigits);
    const scaled = value * factor;
    const floor = Math.floor(scaled);
    const diff = scaled - floor;
    let rounded: number;
    const eps = 1e-9;
    if (Math.abs(diff - 0.5) < eps) {
        // Half — round to even.
        rounded = floor % 2 === 0 ? floor : floor + 1;
    } else {
        rounded = Math.round(scaled);
    }
    return rounded / factor;
}

/**
 * pathlib/Python `sorted()` over a list of strings — code-point order,
 * which matches Python's default string ordering. JS default sort is also
 * code-unit (UTF-16) order; for the ASCII path/keyword tokens here the two
 * coincide, but we pin an explicit comparator for clarity + safety on any
 * astral chars.
 */
function _pySortStrings(items: string[]): string[] {
    return [...items].sort(_pyStrCmp);
}

function _pyStrCmp(a: string, b: string): number {
    // Compare by Unicode code point, matching Python's `<` on str.
    const ca = Array.from(a);
    const cb = Array.from(b);
    const n = Math.min(ca.length, cb.length);
    for (let i = 0; i < n; i++) {
        const x = ca[i]!.codePointAt(0)!;
        const y = cb[i]!.codePointAt(0)!;
        if (x !== y) {
            return x - y;
        }
    }
    return ca.length - cb.length;
}

function analyse(rules: RuleEntry[]): Pair[] {
    // Precompute per-rule path + keyword sets (mirrors the in-place
    // `r["_paths"]` / `r["_keywords"]` assignment in the .py).
    const paths: Set<string>[] = [];
    const keywords: Set<string>[] = [];
    for (const r of rules) {
        paths.push(new Set<string>(r.triggers.path_prefixes));
        const kw = keyword_set(r.description);
        for (const x of keyword_set(r.triggers.keywords.join(' '))) {
            kw.add(x);
        }
        for (const x of keyword_set(r.triggers.intents.join(' '))) {
            kw.add(x);
        }
        keywords.push(kw);
    }

    const pairs: Pair[] = [];
    // itertools.combinations(rules, 2) — index order i < j.
    for (let i = 0; i < rules.length; i++) {
        for (let j = i + 1; j < rules.length; j++) {
            const a = rules[i]!;
            const b = rules[j]!;
            const pj = jaccard(paths[i]!, paths[j]!);
            const ko = overlap_fraction(keywords[i]!, keywords[j]!);
            const flagged = pj >= PATH_THRESHOLD || ko >= KEYWORD_THRESHOLD;
            if (!flagged) {
                continue;
            }
            pairs.push({
                rule_a: a.name,
                rule_b: b.name,
                path_jaccard: _round3(pj),
                keyword_overlap: _round3(ko),
                shared_paths: _pySortStrings([..._intersection(paths[i]!, paths[j]!)]),
                shared_keywords: _pySortStrings([..._intersection(keywords[i]!, keywords[j]!)]).slice(0, 12),
                rule_a_desc: a.description,
                rule_b_desc: b.description,
            });
        }
    }

    // sorted(pairs, key=lambda p: -(path_jaccard + keyword_overlap)).
    // Python's sort is stable; mirror it with a stable comparator over the
    // negated sum.
    return _stableSort(pairs, (p) => -(p.path_jaccard + p.keyword_overlap));
}

function _stableSort<T>(items: T[], key: (item: T) => number): T[] {
    const indexed = items.map((item, idx) => ({ item, idx }));
    indexed.sort((x, y) => {
        const kx = key(x.item);
        const ky = key(y.item);
        if (kx < ky) {
            return -1;
        }
        if (kx > ky) {
            return 1;
        }
        return x.idx - y.idx;
    });
    return indexed.map((e) => e.item);
}

/**
 * Replicate Python's `f"{x:.2f}"` — fixed 2 decimals, round-half-to-even.
 * `_round3` already rounded the stored values to 3 dp, but render here at
 * 2 dp exactly as the .py does.
 */
function _fmt2(x: number): string {
    const r = _pyRound(x, 2);
    return r.toFixed(2);
}

function render_md(pairs: Pair[]): string {
    const lines: string[] = [
        '',
        '## Phase 5.2 — Trigger overlap (Jaccard + keyword)',
        '',
        `Pairs flagged: **${pairs.length}** ` +
            `(thresholds: path-Jaccard ≥ ${PATH_THRESHOLD}, ` +
            `keyword-overlap ≥ ${KEYWORD_THRESHOLD}).`,
        '',
    ];
    if (pairs.length === 0) {
        lines.push('_No pairs over threshold._');
        lines.push('');
        return lines.join('\n');
    }
    lines.push('| # | Rule A | Rule B | Path-J | Keyword-O | Shared keywords |');
    lines.push('|---|--------|--------|--------|-----------|-----------------|');
    let i = 1;
    for (const p of pairs) {
        const kw =
            p.shared_keywords
                .slice(0, 6)
                .map((k) => `\`${k}\``)
                .join(', ') || '—';
        lines.push(
            `| ${i} | \`${p.rule_a}\` | \`${p.rule_b}\` | ` +
                `${_fmt2(p.path_jaccard)} | ${_fmt2(p.keyword_overlap)} | ${kw} |`,
        );
        i += 1;
    }
    lines.push('');
    return lines.join('\n');
}

// --- json.dumps(indent=2) replica (insertion-order keys, ensure_ascii) -------

/**
 * Wrapper marking a value as a Python float, so `round(x, 3)` results that
 * happen to be integer-valued (0.0, 0.5, 1.0) still render with a trailing
 * `.0` exactly as `json.dumps` does. Mirrors the PyFloat convention used
 * across the script ports.
 */
class PyFloat {
    constructor(readonly value: number) {}
}

type Json = null | boolean | number | string | PyFloat | Json[] | { [k: string]: Json };

function _jsonDumpsIndent2(obj: Json): string {
    const pad = '  ';

    function enc(value: Json, depth: number): string {
        if (value === null) {
            return 'null';
        }
        if (value instanceof PyFloat) {
            return Number.isInteger(value.value) ? `${value.value}.0` : String(value.value);
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
        const o = value as { [k: string]: Json };
        const keys = Object.keys(o);
        if (keys.length === 0) {
            return '{}';
        }
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

function _relToRepoRoot(p: string): string {
    // Mirror Path.relative_to(REPO_ROOT) — POSIX-separated relative path.
    const rel = path.relative(REPO_ROOT, p);
    return rel.split(path.sep).join('/');
}

export function main(): number {
    if (!fs.existsSync(AUDIT_JSON)) {
        process.stderr.write(`❌  Run audit_auto_rules.py first: missing ${AUDIT_JSON}\n`);
        return 1;
    }
    const data = JSON.parse(fs.readFileSync(AUDIT_JSON, 'utf-8')) as { rules: RuleEntry[] };
    const pairs = analyse(data.rules);
    // Build the JSON payload with the two `round(x, 3)` fields wrapped as
    // PyFloat so 0.0 / 0.5 / 1.0 render with a trailing `.0` like json.dumps.
    const pairsJson: Json = pairs.map(
        (p): Json => ({
            rule_a: p.rule_a,
            rule_b: p.rule_b,
            path_jaccard: new PyFloat(p.path_jaccard),
            keyword_overlap: new PyFloat(p.keyword_overlap),
            shared_paths: p.shared_paths,
            shared_keywords: p.shared_keywords,
            rule_a_desc: p.rule_a_desc,
            rule_b_desc: p.rule_b_desc,
        }),
    );
    const overlapPayload: Json = { pair_count: pairs.length, pairs: pairsJson };
    fs.writeFileSync(OVERLAP_JSON, _jsonDumpsIndent2(overlapPayload), 'utf-8');

    let mdExisting = fs.existsSync(AUDIT_MD) ? fs.readFileSync(AUDIT_MD, 'utf-8') : '';
    if (mdExisting.includes('## Phase 5.2 — Trigger overlap')) {
        mdExisting = _pyRStrip(mdExisting.split('## Phase 5.2 — Trigger overlap')[0]!) + '\n';
    }
    fs.writeFileSync(AUDIT_MD, mdExisting + render_md(pairs), 'utf-8');

    process.stdout.write(`✅  Overlap analysis: ${pairs.length} pairs flagged.\n`);
    process.stdout.write(`   JSON: ${_relToRepoRoot(OVERLAP_JSON)}\n`);
    process.stdout.write(`   MD appended: ${_relToRepoRoot(AUDIT_MD)}\n`);
    return 0;
}

/** Mirror Python str.rstrip() default — strip trailing ASCII + Unicode whitespace. */
function _pyRStrip(s: string): string {
    return s.replace(/\s+$/u, '');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
    process.exitCode = main();
}
