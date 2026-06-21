#!/usr/bin/env node
/**
 * Skill-collision cluster analysis (Phase 2.2 of step-1-v2-feedback-followup).
 *
 * TypeScript twin of `skill_collision_clusters.py` (Phase 8 / Wave 8e).
 *
 * Walks `.agent-src.uncondensed/skills/<id>/SKILL.md`, extracts the
 * `description` frontmatter, computes pairwise keyword overlap, and groups
 * high-overlap skill pairs into clusters. The output drives the
 * selection-accuracy fixture set defined by council file 05 (Round-3
 * protocol — ≥ 3 shared significant terms → collision cluster).
 *
 * Output: `agents/runtime/reports/skill-collision-clusters.json`
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { parse as parseYaml } from 'yaml';

const _HERE = fileURLToPath(import.meta.url);

const REPO_ROOT = path.resolve(_HERE, '..', '..', '..');
const SKILLS_DIR = path.join(REPO_ROOT, '.agent-src.uncondensed', 'skills');
const OUT_JSON = path.join(REPO_ROOT, 'agents', 'reports', 'skill-collision-clusters.json');

const KEYWORD_OVERLAP_THRESHOLD = 0.4;
const MIN_SHARED_KEYWORDS = 3;
const TOP_N_CLUSTERS = 10;

const STOPWORDS: ReadonlySet<string> = new Set([
    'the', 'and', 'for', 'with', 'when', 'use', 'or', 'of', 'to', 'a',
    'an', 'is', 'in', 'on', 'by', 'be', 'at', 'as', 'it', 'if', 'are',
    'this', 'that', 'from', 'but', 'not', 'can', 'any', 'all', 'no',
    'after', 'before', 'during', 'user', 'agent', 'code', 'project',
    'via', 'into', 'onto', 'even', 'without', 'naming', 'uses', 'used',
    'using', 'also', 'etc', 'across', 'between', 'review', 'design',
    'writing', 'create', 'creating', 'edit', 'editing', 'make', 'making',
    'set', 'setting', 'based', 'well', 'right', 'left', 'new',
]);

// Python: re.findall(r"[A-Za-z][A-Za-z0-9_-]{2,}", text.lower())
const _TOKEN_RE = /[A-Za-z][A-Za-z0-9_-]{2,}/g;

export function keyword_set(text: string): Set<string> {
    const out = new Set<string>();
    for (const m of text.toLowerCase().matchAll(_TOKEN_RE)) {
        const t = m[0];
        // `not t.isdigit()` — the leading-letter regex guarantees t is never
        // all-digits, so the check is a no-op; replicate it faithfully anyway.
        if (!STOPWORDS.has(t) && !_isDigit(t)) {
            out.add(t);
        }
    }
    return out;
}

/** Python str.isdigit() for ASCII token shapes (no decimals/signs here). */
function _isDigit(s: string): boolean {
    return s.length > 0 && /^[0-9]+$/.test(s);
}

export function overlap_fraction(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 || b.size === 0) {
        return 0.0;
    }
    let inter = 0;
    for (const x of a) {
        if (b.has(x)) inter += 1;
    }
    return inter / Math.min(a.size, b.size);
}

interface SkillRec {
    name: string;
    description: string;
    _keywords: Set<string>;
}

// Mirror Python sorted(Path.glob("* / SKILL.md")) — pathlib component-wise.
function _sortedSkillMds(): string[] {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(SKILLS_DIR, { withFileTypes: true });
    } catch {
        return [];
    }
    const found: string[] = [];
    for (const e of entries) {
        if (e.isDirectory()) {
            const sk = path.join(SKILLS_DIR, e.name, 'SKILL.md');
            try {
                if (fs.statSync(sk).isFile()) {
                    found.push(sk);
                }
            } catch {
                /* skip */
            }
        }
    }
    // Path.glob results are sorted lexicographically by the full Path; the
    // varying component is the parent dir name, so compare by full path
    // string component-wise to match pathlib ordering.
    found.sort(_pathCompare);
    return found;
}

/** pathlib-style component-wise comparator for sorted(Path…). */
function _pathCompare(a: string, b: string): number {
    const pa = a.split(path.sep);
    const pb = b.split(path.sep);
    const n = Math.min(pa.length, pb.length);
    for (let i = 0; i < n; i += 1) {
        const ca = pa[i] as string;
        const cb = pb[i] as string;
        if (ca < cb) return -1;
        if (ca > cb) return 1;
    }
    return pa.length - pb.length;
}

export function load_skills(): SkillRec[] {
    const skills: SkillRec[] = [];
    for (const skill_md of _sortedSkillMds()) {
        const text = fs.readFileSync(skill_md, 'utf-8');
        if (!text.startsWith('---')) {
            continue;
        }
        // Python: text.split("---", 2) → [before, fm, rest]
        const parts = _splitN(text, '---', 2);
        if (parts.length < 3) {
            continue;
        }
        let fm: unknown;
        try {
            fm = parseYaml(parts[1] as string, { version: '1.1' }) ?? {};
        } catch {
            continue;
        }
        const fmObj = _asObj(fm);
        const name = _str(fmObj['name']) || path.basename(path.dirname(skill_md));
        const description = _pyStrip(_str(fmObj['description']));
        if (!description) {
            continue;
        }
        skills.push({ name, description, _keywords: keyword_set(description) });
    }
    return skills;
}

/** Marker for a value that is a Python float (json.dumps emits 1.0, not 1). */
class PyFloat {
    constructor(public readonly value: number) {}
}

interface Cluster {
    cluster_id: string;
    members: string[];
    shared_keywords: string[];
    max_overlap: PyFloat;
    descriptions: Record<string, string>;
}

export function build_clusters(skills: SkillRec[]): Cluster[] {
    // Pairwise edges where overlap & shared-keyword threshold is met.
    const edges: Array<[string, string, Set<string>, number]> = [];
    const by_name = new Map<string, SkillRec>();
    for (const s of skills) {
        by_name.set(s.name, s);
    }
    for (let i = 0; i < skills.length; i += 1) {
        for (let j = i + 1; j < skills.length; j += 1) {
            const a = skills[i] as SkillRec;
            const b = skills[j] as SkillRec;
            const shared = _intersect(a._keywords, b._keywords);
            const ov = overlap_fraction(a._keywords, b._keywords);
            if (shared.size >= MIN_SHARED_KEYWORDS && ov >= KEYWORD_OVERLAP_THRESHOLD) {
                edges.push([a.name, b.name, shared, ov]);
            }
        }
    }

    // Union-find over edge set → connected-component clusters.
    const parent = new Map<string, string>();
    const find = (x: string): string => {
        if (!parent.has(x)) parent.set(x, x);
        let cur = x;
        while (parent.get(cur) !== cur) {
            const grand = parent.get(parent.get(cur) as string) as string;
            parent.set(cur, grand);
            cur = grand;
        }
        return cur;
    };
    const union = (x: string, y: string): void => {
        const rx = find(x);
        const ry = find(y);
        if (rx !== ry) {
            parent.set(rx, ry);
        }
    };
    for (const [a, b] of edges) {
        union(a, b);
    }

    // Python: for name in {n for edge in edges for n in edge[:2]} — set
    // iteration order. Insertion order into `components` does not affect the
    // final result because clusters are re-sorted below by (-len, ...) and
    // members are sorted; the per-component member list is sorted before use.
    const allNames = new Set<string>();
    for (const [a, b] of edges) {
        allNames.add(a);
        allNames.add(b);
    }
    const components = new Map<string, string[]>();
    for (const name of allNames) {
        const root = find(name);
        const bucket = components.get(root);
        if (bucket) {
            bucket.push(name);
        } else {
            components.set(root, [name]);
        }
    }

    // Python: sorted(components.items(), key=lambda kv: -len(kv[1]))
    // Python's sort is stable; ties keep dict-insertion order. We canonicalise
    // by sorting tie-groups by the sorted-members list so cluster_id assignment
    // is deterministic regardless of set/dict iteration order (see test note).
    const items = [...components.entries()];
    items.sort((x, y) => {
        const dl = y[1].length - x[1].length;
        if (dl !== 0) return dl;
        // Deterministic tie-break: by sorted member list (insertion order in
        // Python is non-deterministic across set iteration, so we canonicalise).
        const mx = [...x[1]].sort();
        const my = [...y[1]].sort();
        const a0 = mx[0] ?? '';
        const b0 = my[0] ?? '';
        return a0 < b0 ? -1 : a0 > b0 ? 1 : 0;
    });

    const clusters: Cluster[] = [];
    let idx = 1;
    for (const [, members] of items) {
        const member_kws = members.map((m) => (by_name.get(m) as SkillRec)._keywords);
        const shared_all = member_kws.length > 0 ? _intersectAll(member_kws) : new Set<string>();
        let max_ov = 0.0;
        const memberSet = new Set(members);
        for (const [a, b, , ov] of edges) {
            if (memberSet.has(a) && memberSet.has(b)) {
                if (ov > max_ov) max_ov = ov;
            }
        }
        const sortedMembers = [...members].sort();
        const descriptions: Record<string, string> = {};
        for (const m of sortedMembers) {
            descriptions[m] = (by_name.get(m) as SkillRec).description;
        }
        clusters.push({
            cluster_id: `C${_zfill(String(idx), 2)}`,
            members: sortedMembers,
            shared_keywords: [...shared_all].sort(),
            max_overlap: new PyFloat(_round3(max_ov)),
            descriptions,
        });
        idx += 1;
    }
    return clusters.slice(0, TOP_N_CLUSTERS);
}

export function main(): number {
    if (!_isDir(SKILLS_DIR)) {
        process.stderr.write(`❌  Skills dir not found: ${SKILLS_DIR}\n`);
        return 2;
    }
    const skills = load_skills();
    const clusters = build_clusters(skills);
    fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
    const payload = {
        skill_count: skills.length,
        cluster_count: clusters.length,
        clusters,
    };
    fs.writeFileSync(OUT_JSON, _pyJsonDumpsIndent2(payload) + '\n', 'utf-8');
    const rel = path.relative(REPO_ROOT, OUT_JSON).split(path.sep).join('/');
    process.stdout.write(
        `✅  Wrote ${rel} — ${clusters.length} clusters from ${skills.length} skills\n`,
    );
    return 0;
}

// ---------- helpers ----------

function _isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

/** Python str.split(sep, maxsplit) — at most maxsplit splits. */
function _splitN(s: string, sep: string, maxsplit: number): string[] {
    const out: string[] = [];
    let rest = s;
    let n = 0;
    while (n < maxsplit) {
        const idx = rest.indexOf(sep);
        if (idx === -1) break;
        out.push(rest.slice(0, idx));
        rest = rest.slice(idx + sep.length);
        n += 1;
    }
    out.push(rest);
    return out;
}

function _asObj(v: unknown): Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v)
        ? (v as Record<string, unknown>)
        : {};
}

/** Mirror `str(fm.get(...) or "")` — None/missing → "", else str(value). */
function _str(v: unknown): string {
    if (v === null || v === undefined) return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'boolean') return v ? 'True' : 'False';
    return String(v);
}

function _pyStrip(s: string): string {
    return s.replace(/^\s+/, '').replace(/\s+$/, '');
}

function _intersect(a: Set<string>, b: Set<string>): Set<string> {
    const out = new Set<string>();
    for (const x of a) {
        if (b.has(x)) out.add(x);
    }
    return out;
}

function _intersectAll(sets: Array<Set<string>>): Set<string> {
    if (sets.length === 0) return new Set();
    let acc = new Set(sets[0]);
    for (let i = 1; i < sets.length; i += 1) {
        acc = _intersect(acc, sets[i] as Set<string>);
    }
    return acc;
}

/** Python str.zfill(width). */
function _zfill(s: string, width: number): string {
    return s.length >= width ? s : '0'.repeat(width - s.length) + s;
}

/** Python round(x, 3) — banker's rounding (round-half-to-even). */
function _round3(x: number): number {
    return _pyRound(x, 3);
}

function _pyRound(value: number, ndigits: number): number {
    if (!Number.isFinite(value)) return value;
    const factor = 10 ** ndigits;
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

/** Mirror json.dumps(obj, indent=2). */
function _pyJsonDumpsIndent2(obj: unknown): string {
    return _dumpValue(obj, 0);
}

function _dumpValue(value: unknown, depth: number): string {
    const pad = '  '.repeat(depth);
    const padInner = '  '.repeat(depth + 1);
    if (value === null || value === undefined) return 'null';
    if (value instanceof PyFloat) return _dumpFloat(value.value);
    if (typeof value === 'number') return String(value);
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'string') return _dumpString(value);
    if (Array.isArray(value)) {
        if (value.length === 0) return '[]';
        const items = value.map((v) => padInner + _dumpValue(v, depth + 1));
        return '[\n' + items.join(',\n') + '\n' + pad + ']';
    }
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return '{}';
    const items = entries.map(
        ([k, v]) => padInner + _dumpString(k) + ': ' + _dumpValue(v, depth + 1),
    );
    return '{\n' + items.join(',\n') + '\n' + pad + '}';
}

/**
 * json.dumps repr of a Python float. Integral floats emit `.0`; everything
 * else uses the shortest round-tripping decimal, which JS String() matches
 * for the round(...,3) values produced here.
 */
function _dumpFloat(n: number): string {
    if (Number.isInteger(n)) {
        return `${n}.0`;
    }
    return String(n);
}

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
    process.exitCode = main();
}
