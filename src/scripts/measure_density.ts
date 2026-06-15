#!/usr/bin/env node
/**
 * Measure structural density across the artifact corpus.
 *
 * TypeScript twin of `src/scripts/measure_density.py` (ADR-200 —
 * Python→TS migration, Phase 8 / Wave 8c). Mirrors the CLI contract
 * EXACTLY: flags (`--json`, `--snapshot`), exit code 0, byte-identical
 * stdout (report or `json.dumps(sort_keys=True, indent=2)`), and the same
 * snapshot JSONL (`json.dumps(sort_keys=True)` per line). No behaviour
 * changes — latent quirks replicated.
 *
 * Phase 1.1 of `agents/roadmaps/road-to-structural-linter-reform.md`.
 *
 * Density score = structured_lines / total_lines, where structured_lines
 * sum lines inside fenced blocks + markdown-table rows + bullet lines +
 * numbered/ordered-list lines + section-heading lines.
 *
 * Companion signals collected per artifact:
 *
 * - multi_workflow   ≥ 2 `## Procedure` blocks in a skill.
 * - delegation       command frontmatter has `cluster:` / `routes_to:`, or
 *                    the body links to ≥ 3 other commands/skills.
 * - iron_law_block   ≥ 1 fenced block whose body is ≥ 60 % ALL-CAPS.
 *
 * Output:
 * - Default stdout: per-type distribution buckets + tail (lowest density).
 * - --json deterministic JSON of every artifact.
 * - --snapshot writes JSONL to agents/runtime/density/snapshot.jsonl.
 *
 * Imports the SAME three primitives the .py imports from skill_linter:
 * `detect_artifact_type`, `extract_frontmatter`, `gather_all_candidate_files`.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
    detect_artifact_type,
    extract_frontmatter,
    gather_all_candidate_files,
} from './skill_linter.js';

const _HERE = fileURLToPath(import.meta.url);
// src/scripts/measure_density.ts → parents[2] is the repo root.
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

const SNAPSHOT_FILE = path.join(REPO_ROOT, 'agents', 'runtime', 'density', 'snapshot.jsonl');

const _TABLE_ROW = /^\s*\|.*\|\s*$/;
const _BULLET = /^\s*[-*]\s+\S/;
const _NUMBERED = /^\s*\d+\.\s+\S/;
const _HEADING = /^\s{0,3}#{1,6}\s+\S/;
const _PROCEDURE = /^##\s+Procedure(\s*:.*)?\s*$/gm;
const _LINK_MD = /\]\([^)]+\.md[^)]*\)/g;
const _FRONTMATTER_KEY = /^(cluster|routes_to)\s*:/m;

interface LineCounts {
    total: number;
    fenced: number;
    table: number;
    bullet: number;
    numbered: number;
    heading: number;
    prose: number;
}

interface Delegation {
    frontmatter_routes: boolean;
    md_links: number;
    has_signal: boolean;
}

interface MeasureRow {
    file: string;
    type: string;
    lines: number;
    words: number;
    density: number;
    fenced: number;
    table: number;
    bullet: number;
    numbered: number;
    heading: number;
    prose: number;
    iron_law_blocks: number;
    procedures: number;
    delegation: Delegation;
}

/** Bucket every non-blank line into one structural category. */
function _classify_lines(text: string): LineCounts {
    let inside_fence = false;
    const counts: LineCounts = {
        total: 0,
        fenced: 0,
        table: 0,
        bullet: 0,
        numbered: 0,
        heading: 0,
        prose: 0,
    };
    for (const raw of _splitLines(text)) {
        const stripped = _pyStrip(raw);
        if (stripped.startsWith('```')) {
            inside_fence = !inside_fence;
            counts.total += 1;
            counts.fenced += 1;
            continue;
        }
        if (!stripped) {
            continue;
        }
        counts.total += 1;
        if (inside_fence) {
            counts.fenced += 1;
        } else if (_TABLE_ROW.test(raw)) {
            counts.table += 1;
        } else if (_HEADING.test(raw)) {
            counts.heading += 1;
        } else if (_BULLET.test(raw)) {
            counts.bullet += 1;
        } else if (_NUMBERED.test(raw)) {
            counts.numbered += 1;
        } else {
            counts.prose += 1;
        }
    }
    return counts;
}

/**
 * Count fenced blocks that look like verbatim Iron-Law imperatives.
 *
 * Heuristic: fenced block with ≥ 1 non-empty line whose alphabetical body
 * is ≥ 60 % uppercase AND has ≥ 30 letters total. Also matches
 * blockquote-style Iron Laws.
 */
function _detect_iron_law_blocks(text: string): number {
    let blocks = 0;
    let inside = false;
    let body: string[] = [];
    for (const raw of _splitLines(text)) {
        if (_pyStrip(raw).startsWith('```')) {
            if (inside && body.length > 0) {
                const non_empty = body.filter((b) => _pyStrip(b) !== '');
                const letters = non_empty.join('');
                let upper = 0;
                let total = 0;
                for (const c of letters) {
                    if (_isAlpha(c)) {
                        total += 1;
                        if (_isUpper(c)) {
                            upper += 1;
                        }
                    }
                }
                if (total >= 30 && upper / total >= 0.6 && non_empty.length > 0) {
                    blocks += 1;
                }
            }
            inside = !inside;
            body = [];
            continue;
        }
        if (inside) {
            body.push(raw);
        }
    }
    return blocks;
}

function _count_procedures(text: string): number {
    const matches = text.match(_PROCEDURE);
    return matches ? matches.length : 0;
}

function _delegation_signal(text: string, frontmatter: string | null): Delegation {
    const fm_keys = Boolean(frontmatter && _FRONTMATTER_KEY.test(frontmatter));
    const linkMatches = text.match(_LINK_MD);
    const md_links = linkMatches ? linkMatches.length : 0;
    return { frontmatter_routes: fm_keys, md_links, has_signal: fm_keys || md_links >= 3 };
}

function measure(p: string): MeasureRow {
    const text = fs.readFileSync(p, 'utf-8');
    // Python: rel = path.relative_to(REPO_ROOT) if path.is_absolute() else path.
    const rel = path.isAbsolute(p) ? _relPosix(p, REPO_ROOT) : _toPosix(p);
    const artifact_type = detect_artifact_type(rel, text);
    const frontmatter = extract_frontmatter(text);
    const counts = _classify_lines(text);
    const structured = counts.fenced + counts.table + counts.bullet + counts.numbered + counts.heading;
    const density = counts.total ? structured / counts.total : 0.0;
    return {
        file: rel,
        type: artifact_type,
        lines: counts.total,
        words: _pySplit(text).length,
        density: _round3(density),
        fenced: counts.fenced,
        table: counts.table,
        bullet: counts.bullet,
        numbered: counts.numbered,
        heading: counts.heading,
        prose: counts.prose,
        iron_law_blocks: _detect_iron_law_blocks(text),
        procedures: _count_procedures(text),
        delegation: _delegation_signal(text, frontmatter),
    };
}

function collect(): MeasureRow[] {
    const paths = gather_all_candidate_files(REPO_ROOT);
    return paths.map((p) => measure(p));
}

function _bucketize(values: number[]): Map<string, number> {
    // Insertion-ordered, matching the .py dict literal order.
    const buckets = new Map<string, number>([
        ['0.0-0.2', 0],
        ['0.2-0.4', 0],
        ['0.4-0.6', 0],
        ['0.6-0.8', 0],
        ['0.8-1.0', 0],
    ]);
    const bump = (k: string): void => {
        buckets.set(k, (buckets.get(k) ?? 0) + 1);
    };
    for (const v of values) {
        if (v < 0.2) bump('0.0-0.2');
        else if (v < 0.4) bump('0.2-0.4');
        else if (v < 0.6) bump('0.4-0.6');
        else if (v < 0.8) bump('0.6-0.8');
        else bump('0.8-1.0');
    }
    return buckets;
}

function report(results: MeasureRow[]): string {
    const by_type = new Map<string, MeasureRow[]>();
    for (const r of results) {
        const arr = by_type.get(r.type) ?? [];
        arr.push(r);
        by_type.set(r.type, arr);
    }
    const lines: string[] = ['# Structural Density Snapshot', '', `Total artifacts: ${results.length}`, ''];
    // sorted(by_type) — type names ascending.
    const sortedTypes = [...by_type.keys()].sort(_pyStrCmp);
    for (const t of sortedTypes) {
        const rows = by_type.get(t)!;
        const densities = rows.map((r) => r.density);
        const avg = densities.length ? densities.reduce((a, b) => a + b, 0) / densities.length : 0.0;
        // med = sorted(densities)[len//2].
        const sortedD = [...densities].sort((a, b) => a - b);
        const med = densities.length ? sortedD[Math.floor(densities.length / 2)]! : 0.0;
        const buckets = _bucketize(densities);
        lines.push(`## ${t} (${rows.length} artifacts)`);
        lines.push(`avg density=${_fmt2(avg)} median=${_fmt2(med)}`);
        lines.push(
            'buckets ' +
                [...buckets.entries()]
                    .map(([k, v]) => `[${k}]=${v}`)
                    .join(' '),
        );
        // tail = sorted(rows, key=lambda r: r["density"])[:5] — stable.
        const tail = _stableSortBy(rows, (r) => r.density).slice(0, 5);
        lines.push('lowest density:');
        for (const r of tail) {
            lines.push(
                `  ${_fmt2(r.density)} ${_rjust(String(r.lines), 4)}L ` +
                    `proc=${r.procedures} ` +
                    `iron=${r.iron_law_blocks} ` +
                    `deleg=${r.delegation.has_signal ? 1 : 0} ` +
                    `${r.file}`,
            );
        }
        lines.push('');
    }
    return lines.join('\n');
}

interface Args {
    json: boolean;
    snapshot: boolean;
}

class ArgError extends Error {}

function parse_args(argv: string[]): Args {
    const args: Args = { json: false, snapshot: false };
    for (const a of argv) {
        if (a === '--json') {
            args.json = true;
        } else if (a === '--snapshot') {
            args.snapshot = true;
        } else {
            throw new ArgError(`unrecognized arguments: ${a}`);
        }
    }
    return args;
}

export function main(argv: string[] | null = null): number {
    const rawArgv = argv ?? process.argv.slice(2);
    let args: Args;
    try {
        args = parse_args(rawArgv);
    } catch (e) {
        if (e instanceof ArgError) {
            process.stderr.write(`measure_density: error: ${e.message}\n`);
            return 2;
        }
        throw e;
    }
    const results = collect();
    if (args.snapshot) {
        fs.mkdirSync(path.dirname(SNAPSHOT_FILE), { recursive: true });
        const sorted = _stableSortBy(results, (r) => 0, (a, b) => _pyStrCmp(a.file, b.file));
        const chunks: string[] = [];
        for (const r of sorted) {
            chunks.push(_jsonDumpsSortKeys(_rowToJson(r)) + '\n');
        }
        fs.writeFileSync(SNAPSHOT_FILE, chunks.join(''), 'utf-8');
    }
    if (args.json) {
        process.stdout.write(_jsonDumpsSortKeysIndent2(results.map(_rowToJson)) + '\n');
    } else {
        process.stdout.write(report(results) + '\n');
    }
    return 0;
}

// --- JSON shaping ------------------------------------------------------------

/**
 * Wrapper marking a value as a Python float so `round(x, 3)` results that
 * are integer-valued (0.0, 1.0) render with a trailing `.0` like json.dumps.
 */
class PyFloat {
    constructor(readonly value: number) {}
}

type Json = null | boolean | number | string | PyFloat | Json[] | { [k: string]: Json };

function _rowToJson(r: MeasureRow): Json {
    return {
        file: r.file,
        type: r.type,
        lines: r.lines,
        words: r.words,
        density: new PyFloat(r.density),
        fenced: r.fenced,
        table: r.table,
        bullet: r.bullet,
        numbered: r.numbered,
        heading: r.heading,
        prose: r.prose,
        iron_law_blocks: r.iron_law_blocks,
        procedures: r.procedures,
        delegation: {
            frontmatter_routes: r.delegation.frontmatter_routes,
            md_links: r.delegation.md_links,
            has_signal: r.delegation.has_signal,
        },
    };
}

function _jsonDumpsSortKeysIndent2(obj: Json): string {
    return _jsonDumps(obj, { sortKeys: true, indent: 2 });
}

function _jsonDumpsSortKeys(obj: Json): string {
    return _jsonDumps(obj, { sortKeys: true, indent: null });
}

/**
 * json.dumps replica supporting sort_keys + indent. With indent=null,
 * Python uses ", " and ": " separators (compact-ish, the default).
 */
function _jsonDumps(obj: Json, opts: { sortKeys: boolean; indent: number | null }): string {
    const { sortKeys, indent } = opts;
    const pad = indent !== null ? ' '.repeat(indent) : '';
    const itemSep = indent !== null ? ',' : ', ';
    const kvSep = ': ';

    function enc(value: Json, depth: number): string {
        if (value === null) return 'null';
        if (value instanceof PyFloat) {
            return Number.isInteger(value.value) ? `${value.value}.0` : String(value.value);
        }
        if (typeof value === 'boolean') return value ? 'true' : 'false';
        if (typeof value === 'number') return _numRepr(value);
        if (typeof value === 'string') return encStr(value);
        if (Array.isArray(value)) {
            if (value.length === 0) return '[]';
            if (indent !== null) {
                const inner = value.map((v) => pad.repeat(depth + 1) + enc(v, depth + 1));
                return '[\n' + inner.join(itemSep + '\n') + '\n' + pad.repeat(depth) + ']';
            }
            return '[' + value.map((v) => enc(v, depth + 1)).join(itemSep) + ']';
        }
        const o = value as { [k: string]: Json };
        let keys = Object.keys(o);
        if (keys.length === 0) return '{}';
        if (sortKeys) {
            keys = [...keys].sort(_pyStrCmp);
        }
        if (indent !== null) {
            const inner = keys.map((k) => pad.repeat(depth + 1) + encStr(k) + kvSep + enc(o[k]!, depth + 1));
            return '{\n' + inner.join(itemSep + '\n') + '\n' + pad.repeat(depth) + '}';
        }
        return '{' + keys.map((k) => encStr(k) + kvSep + enc(o[k]!, depth + 1)).join(itemSep) + '}';
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

/**
 * Mirror json.dumps number formatting. Density values are rounded to 3 dp
 * (Python `round`); render integers without a decimal point and floats via
 * Python repr (shortest round-trip). Values here are simple ratios so the
 * default JS String() matches Python's float repr for the rounded results.
 */
function _numRepr(n: number): string {
    if (Number.isInteger(n)) {
        return String(n);
    }
    return String(n);
}

// --- Python helpers ----------------------------------------------------------

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
        rounded = floor % 2 === 0 ? floor : floor + 1;
    } else {
        rounded = Math.round(scaled);
    }
    return rounded / factor;
}

function _fmt2(x: number): string {
    return _pyRound(x, 2).toFixed(2);
}

function _splitLines(text: string): string[] {
    // Python str.splitlines() splits on \n, \r, \r\n and other line bounds,
    // and does NOT yield a trailing empty element. For our text corpus the
    // relevant separators are \n and \r\n.
    if (text === '') {
        return [];
    }
    const out = text.split(/\r\n|\r|\n/);
    if (out.length > 0 && out[out.length - 1] === '') {
        out.pop();
    }
    return out;
}

function _pySplit(text: string): string[] {
    // Python str.split() with no args — split on runs of whitespace, drop empties.
    const trimmed = text.replace(/^\s+/u, '').replace(/\s+$/u, '');
    if (trimmed === '') {
        return [];
    }
    return trimmed.split(/\s+/u);
}

function _pyStrip(s: string): string {
    return s.replace(/^\s+/u, '').replace(/\s+$/u, '');
}

function _isAlpha(c: string): boolean {
    // Mirror Python str.isalpha() reasonably for the ALL-CAPS heuristic —
    // Unicode letters. JS \p{L} covers the same letter category.
    return /\p{L}/u.test(c);
}

function _isUpper(c: string): boolean {
    // Mirror Python str.isupper() for a single char: cased + uppercase.
    return c !== c.toLowerCase() && c === c.toUpperCase();
}

function _rjust(s: string, width: number): string {
    const len = Array.from(s).length;
    return len >= width ? s : ' '.repeat(width - len) + s;
}

function _toPosix(p: string): string {
    return p.split(path.sep).join('/');
}

function _relPosix(p: string, base: string): string {
    return path.relative(base, p).split(path.sep).join('/');
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

function _stableSortBy<T>(
    items: T[],
    key: (item: T) => number,
    cmp?: (a: T, b: T) => number,
): T[] {
    const indexed = items.map((item, idx) => ({ item, idx }));
    indexed.sort((x, y) => {
        const c = cmp ? cmp(x.item, y.item) : key(x.item) - key(y.item);
        if (c !== 0) return c;
        return x.idx - y.idx;
    });
    return indexed.map((e) => e.item);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
    process.exitCode = main();
}
