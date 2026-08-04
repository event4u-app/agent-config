#!/usr/bin/env tsx
/**
 * Skill-family content-overlap analysis (6.0.0-C Phase 4 Step 8).
 *
 * Ported from the retired Python `src/scripts/audit_skill_overlap.py` (ADR-200 —
 * Python→TS migration, Phase 8 / Wave 8c). The numeric contract — keyword
 * vector, cosine, banker's rounding, pair ordering, `json.dumps(..., indent=2)`
 * byte shape, and the Markdown renderer — is preserved so historical reports
 * stay comparable. The CLI grew a `--root` flag; the exit codes are unchanged
 * (0 ok / 3 dead scan scope).
 *
 * SCAN ROOT (repaired 2026-08-02, road-to-overlap-truth-and-skill-cut Phase 1):
 * the ported `_skill_roots()` resolved the pre-ADR-051 source containers, both
 * of which were deleted when `src/skills` became the source of truth. The tool
 * therefore walked a directory that does not exist and could never report an
 * overlap for the 287-skill corpus. That resolution is GONE, not kept as a
 * fallback branch: the default root is the shared `SRC_SKILLS()` resolver, and
 * an empty scan is a hard failure via {@link assertScanned} rather than an
 * empty result.
 *
 * Walks every `SKILL.md`, builds a keyword vector from the body
 * (frontmatter stripped), and flags pairs whose content cosine-similarity
 * is >= OVERLAP_THRESHOLD. Same-domain (shared `packs:`) >= threshold pairs
 * are the merge candidates. THIS SCRIPT MERGES NOTHING.
 *
 * `--strict` makes a same-pack pair at or above threshold a BUILD FAILURE
 * (exit 1) unless the pair carries a reviewed justification in
 * `audit_skill_overlap_allowlist.json`, capped at 20 entries. The cap is the
 * point: it forces periodic re-litigation instead of an allowlist that grows
 * quietly until the gate means nothing. Cross-pack pairs never block — a
 * cross-pack merge changes install shape and is a different decision.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';

import { SRC_SKILLS } from './_lib/agent_src.js';
import { DeadScopeError, assertScanned } from './_lib/scan_scope.js';

const _HERE = fileURLToPath(import.meta.url);
// src/scripts/audit_skill_overlap.py → parent.parent.parent == repo root.
export const ROOT = path.resolve(path.dirname(_HERE), '..', '..');
export const REPORT_DIR = path.join(ROOT, 'agents', 'reports');
export const OUT_JSON_NAME = 'skill-overlap.json';
export const OUT_MD_NAME = 'skill-overlap.md';
export const OUT_JSON = path.join(REPORT_DIR, OUT_JSON_NAME);
export const OUT_MD = path.join(REPORT_DIR, OUT_MD_NAME);
export const ALLOWLIST = path.join(ROOT, 'src', 'scripts', 'audit_skill_overlap_allowlist.json');
export const ALLOWLIST_CAP = 20;
// re.compile(r"^---\n(.*?)\n---", re.DOTALL) — used with .search (anywhere).
const FM_RE = /^---\n([\s\S]*?)\n---/m;
export const OVERLAP_THRESHOLD = 0.7;

const STOPWORDS: ReadonlySet<string> = new Set([
    'the', 'and', 'for', 'with', 'when', 'use', 'or', 'of', 'to', 'a', 'an',
    'is', 'in', 'on', 'by', 'be', 'at', 'as', 'it', 'if', 'are', 'this',
    'that', 'from', 'but', 'not', 'can', 'any', 'all', 'no', 'after',
    'before', 'during', 'user', 'agent', 'code', 'project', 'via', 'into',
    'onto', 'even', 'without', 'naming', 'run', 'runs', 'running', 'each',
    'every', 'one', 'two', 'now', 'then', 'also', 'based', 'default', 'skill',
    'you', 'your', 'should', 'must', 'see', 'do', 'not',
]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

interface Skill {
    name: string;
    relpath: string;
    packs: Set<string>;
    vector: Map<string, number>;
}

function _isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}
function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}
/**
 * The one scan root: `src/skills`, via the shared ADR-051 resolver.
 *
 * There is deliberately no fallback. A second, silently-tried root is how the
 * previous resolution stayed green while reading nothing — the caller passes an
 * explicit `--root` when it wants a different tree (fixtures, tests), and any
 * root that yields zero skills fails loudly in {@link main}.
 */
export function _default_skill_root(): string {
    return SRC_SKILLS();
}

/**
 * Mirror `_keyword_vector`: re.findall(r"[a-z][a-z0-9_-]{2,}", text.lower())
 * then Counter of tokens not in STOPWORDS.
 */
export function _keyword_vector(text: string): Map<string, number> {
    const counter = new Map<string, number>();
    const re = /[a-z][a-z0-9_-]{2,}/g;
    const lowered = text.toLowerCase();
    let m: RegExpExecArray | null;
    while ((m = re.exec(lowered)) !== null) {
        const t = m[0];
        if (!STOPWORDS.has(t)) {
            counter.set(t, (counter.get(t) ?? 0) + 1);
        }
    }
    return counter;
}

/** Mirror `_cosine`. */
export function _cosine(a: Map<string, number>, b: Map<string, number>): number {
    // shared = set(a) & set(b)
    const shared: string[] = [];
    for (const k of a.keys()) {
        if (b.has(k)) {
            shared.push(k);
        }
    }
    if (shared.length === 0) {
        return 0.0;
    }
    let num = 0;
    for (const t of shared) {
        num += (a.get(t) as number) * (b.get(t) as number);
    }
    let da = 0;
    for (const v of a.values()) {
        da += v * v;
    }
    let db = 0;
    for (const v of b.values()) {
        db += v * v;
    }
    da = Math.sqrt(da);
    db = Math.sqrt(db);
    return da && db ? num / (da * db) : 0.0;
}

/**
 * Which text the similarity vector is built from.
 *
 * `body` is the CANONICAL metric — the one every historical report, the 0.70
 * threshold, and the merge decisions are calibrated against. `description` is
 * an explicitly non-canonical second view: routing happens on descriptions, and
 * body similarity does not measure it, so the two answer different questions
 * and their scores are never mixed or compared against the same threshold.
 */
export type Field = 'body' | 'description';

/** Mirror `_parse`: yaml.safe_load frontmatter, body after the FM match. */
export function _parse(md: string, field: Field = 'body'): Skill {
    const text = fs.readFileSync(md, 'utf-8');
    let fm: Json = {};
    let body = text;
    const m = FM_RE.exec(text);
    if (m && m.index === 0) {
        try {
            fm = parseYaml(m[1] as string, { version: '1.1' }) ?? {};
        } catch {
            fm = {};
        }
        body = text.slice(m.index + m[0].length);
    }
    const isObj = fm !== null && typeof fm === 'object' && !Array.isArray(fm);
    const name = isObj ? (fm as Record<string, Json>)['name'] : null;
    const packsVal = isObj ? (fm as Record<string, Json>)['packs'] : null;
    const descVal = isObj ? (fm as Record<string, Json>)['description'] : null;
    const source = field === 'description' ? (descVal ? String(descVal) : '') : body;
    return {
        name: name ? String(name) : path.basename(path.dirname(md)),
        relpath: _relPosix(md, ROOT),
        packs: Array.isArray(packsVal) ? new Set(packsVal.map((x) => String(x))) : new Set(),
        vector: _keyword_vector(source),
    };
}

function _relPosix(child: string, root: string): string {
    return path.relative(root, child).split(path.sep).join('/');
}

/**
 * Sorted recursive `SKILL.md` paths under a root (mirrors
 * `sorted(root.rglob("SKILL.md"))`).
 *
 * Python sorts `Path` objects COMPONENT-WISE (the `_parts` tuple compare),
 * NOT by the joined string. For nested matches this differs from a raw-string
 * sort exactly at a directory boundary: `readme-writing/SKILL.md` sorts BEFORE
 * `readme-writing-package/SKILL.md` component-wise (because the directory
 * component `'readme-writing' < 'readme-writing-package'`), whereas a raw-
 * string sort would put `readme-writing-package` first since `-` (0x2d) < `/`
 * (0x2f). Use a component comparator to reproduce pathlib's order.
 */
function _rglobSkillMd(root: string): string[] {
    const out: string[] = [];
    const walk = (dir: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const ent of entries) {
            const full = path.join(dir, ent.name);
            if (ent.name === 'SKILL.md') {
                out.push(full);
            }
            if (ent.isDirectory() || (ent.isSymbolicLink() && _isDir(full))) {
                walk(full);
            }
        }
    };
    walk(root);
    out.sort(_pathlibCompare);
    return out;
}

/**
 * pathlib `Path` ordering: compare the path COMPONENTS (split on the platform
 * separator) lexicographically, element by element; shorter is "less" when one
 * is a prefix of the other. This matches CPython `PurePath.__lt__` which
 * compares the case-normalised `_parts` tuples.
 */
function _pathlibCompare(a: string, b: string): number {
    const pa = a.split(path.sep);
    const pb = b.split(path.sep);
    const n = Math.min(pa.length, pb.length);
    for (let i = 0; i < n; i++) {
        const x = pa[i] as string;
        const y = pb[i] as string;
        if (x !== y) {
            return x < y ? -1 : 1;
        }
    }
    return pa.length - pb.length;
}

export function collect(root: string = _default_skill_root(), field: Field = 'body'): Skill[] {
    const skills: Skill[] = [];
    const seen = new Set<string>();
    for (const md of _rglobSkillMd(root)) {
        // if "_archive" in md.parts: continue
        if (md.split(path.sep).includes('_archive')) {
            continue;
        }
        const key = path.basename(path.dirname(md));
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        skills.push(_parse(md, field));
    }
    return skills;
}

interface Pair {
    a: string;
    b: string;
    a_path: string;
    b_path: string;
    similarity: number;
    same_domain: boolean;
    shared_packs: string[];
}

/** Mirror Python `round()` — banker's rounding (round-half-to-even). */
function pyRound(x: number, ndigits: number): number {
    const factor = 10 ** ndigits;
    const scaled = x * factor;
    const floor = Math.floor(scaled);
    const diff = scaled - floor;
    let r: number;
    if (diff > 0.5) {
        r = floor + 1;
    } else if (diff < 0.5) {
        r = floor;
    } else {
        // exactly .5 → round to even
        r = floor % 2 === 0 ? floor : floor + 1;
    }
    return r / factor;
}

export function find_pairs(skills: Skill[], threshold: number): Pair[] {
    const pairs: Pair[] = [];
    // combinations(skills, 2) — index order i<j.
    for (let i = 0; i < skills.length; i++) {
        for (let j = i + 1; j < skills.length; j++) {
            const a = skills[i] as Skill;
            const b = skills[j] as Skill;
            const sim = _cosine(a.vector, b.vector);
            if (sim >= threshold) {
                // shared = sorted(a.packs & b.packs)
                const shared: string[] = [];
                for (const p of a.packs) {
                    if (b.packs.has(p)) {
                        shared.push(p);
                    }
                }
                shared.sort();
                pairs.push({
                    a: a.name,
                    b: b.name,
                    a_path: a.relpath,
                    b_path: b.relpath,
                    similarity: pyRound(sim, 3),
                    same_domain: shared.length > 0,
                    shared_packs: shared,
                });
            }
        }
    }
    // pairs.sort(key=lambda p: (not p["same_domain"], -p["similarity"])) — stable.
    return stableSort(pairs, (p) => [p.same_domain ? 0 : 1, -p.similarity]);
}

/** Stable sort by a tuple-of-numbers key (Python tuple compare). */
function stableSort<T>(arr: T[], key: (x: T) => number[]): T[] {
    return arr
        .map((v, i) => [v, i] as [T, number])
        .sort((x, y) => {
            const kx = key(x[0]);
            const ky = key(y[0]);
            for (let i = 0; i < Math.max(kx.length, ky.length); i++) {
                const d = (kx[i] ?? 0) - (ky[i] ?? 0);
                if (d !== 0) {
                    return d;
                }
            }
            return x[1] - y[1];
        })
        .map(([v]) => v);
}

/** Mirror Python f-string percent formatting `f"{x:.0%}"` — round-half-even ×100. */
function _pct(x: number): string {
    // Python "{:.0%}".format(x) multiplies by 100 and formats with 0 decimals,
    // using round-half-to-even. Reproduce via pyRound on the percentage.
    const pct = pyRound(x * 100, 0);
    return `${pct}%`;
}

export function render_md(
    skills: Skill[],
    pairs: Pair[],
    threshold: number,
    field: Field = 'body',
): string {
    const merge = pairs.filter((p) => p.same_domain);
    const cross = pairs.filter((p) => !p.same_domain);
    const L: string[] = [
        '# Skill-family overlap report (6.0.0-C Phase 4 Step 8)\n',
        field === 'description'
            ? `> **NON-CANONICAL measurement.** Cosine over the \`description:\` ` +
              `frontmatter only, across ${skills.length} skills, at ≥ ${_pct(threshold)}. ` +
              `Routing happens on descriptions, so this answers a question the ` +
              `canonical body metric does not — but its scores are NOT comparable ` +
              `to the canonical 0.70 merge threshold and must never be mixed into ` +
              `a merge decision. The canonical run is the one without ` +
              `\`--descriptions\`.\n`
            : `> Content cosine-similarity over ${skills.length} skills; pairs at ` +
              `≥ ${_pct(threshold)}. **Same-domain pairs (shared \`packs:\`) are the ` +
              `merge candidates** consumed by ` +
              `[\`evidence-based-pruning.md\`](../../docs/contracts/evidence-based-pruning.md). ` +
              `This report merges NOTHING — it is input to a future, human-driven ` +
              `consolidation roadmap.\n`,
        `\n- Skills scanned: **${skills.length}**`,
        `\n- Overlap pairs ≥ ${_pct(threshold)}: **${pairs.length}** ` +
            `(${merge.length} same-domain merge candidates, ${cross.length} cross-domain)\n`,
        '\n## Merge candidates — same-domain, ≥ threshold\n',
    ];
    if (merge.length === 0) {
        L.push('None — no same-domain pair exceeds the overlap threshold.\n');
    } else {
        L.push('| Skill A | Skill B | similarity | shared packs |');
        L.push('|---|---|--:|---|');
        for (const p of merge) {
            L.push(
                `| \`${p.a}\` | \`${p.b}\` | ${_pct(p.similarity)} | ` +
                    `${p.shared_packs.join(', ')} |`,
            );
        }
    }
    L.push('\n## Cross-domain overlaps (informational, not merge candidates)\n');
    if (cross.length === 0) {
        L.push('None.\n');
    } else {
        L.push('| Skill A | Skill B | similarity |');
        L.push('|---|---|--:|');
        for (const p of cross) {
            L.push(`| \`${p.a}\` | \`${p.b}\` | ${_pct(p.similarity)} |`);
        }
    }
    return L.join('\n') + '\n';
}

// --- json.dumps(indent=2) emulation (ensure_ascii=True, NO sort_keys) -------

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

/**
 * Mirror Python `json.dumps` float repr. `similarity` is `round(x, 3)`, so it
 * is a float ≤ 3 decimals; `threshold` is a float (default 0.7 or a CLI float).
 * Python serializes floats via `repr` (shortest round-trip). JS `String(n)`
 * matches for the values here (e.g. 0.7, 0.812). Integers serialize bare.
 */
function _pyNumber(n: number): string {
    if (Number.isInteger(n)) {
        // A round(x,3) result that lands on an integer (e.g. 1.0) must serialize
        // as "1.0" in Python json (it is a float). But `threshold`/`similarity`
        // entering as floats need the ".0". We only emit ".0" for known-float
        // slots via _floatStr; bare ints (rule counts) go here as integers.
        return String(n);
    }
    return String(n);
}

/** Python float repr with mandatory ".0" for whole-valued floats. */
function _floatStr(n: number): string {
    if (Number.isInteger(n)) {
        return `${n}.0`;
    }
    return String(n);
}

function _pairToJson(p: Pair): Record<string, Json> {
    return {
        a: p.a,
        b: p.b,
        a_path: p.a_path,
        b_path: p.b_path,
        // similarity is a float (round(x,3)); force float repr.
        similarity: new FloatTag(p.similarity),
        same_domain: p.same_domain,
        shared_packs: p.shared_packs,
    };
}

/** Marker so the JSON serializer emits a Python-float repr (".0" for wholes). */
class FloatTag {
    constructor(public readonly value: number) {}
}

export function main(argv: string[] | null = null): number {
    const args = parse_args(argv ?? process.argv.slice(2));
    const root = args.root ?? _default_skill_root();
    const skills = collect(root, args.field);
    try {
        assertScanned({
            gate: 'audit_skill_overlap',
            scanned: skills.length,
            units: 'skill(s)',
            roots: [_relPosix(root, ROOT)],
        });
    } catch (exc) {
        if (!(exc instanceof DeadScopeError)) {
            throw exc;
        }
        process.stderr.write(`❌  ${exc.message}\n`);
        return 3;
    }
    // Gate-coverage contract (src/config/gate-coverage.yml rule 1): publish the
    // asserted count machine-readably. Written to stderr, not stdout, because
    // this audit's stdout carries the report body consumers read.
    process.stderr.write(`scanned: ${String(skills.length)}\n`);
    const pairs = find_pairs(skills, args.threshold);
    const outDir = args.outDir ?? REPORT_DIR;
    const outJson = path.join(outDir, OUT_JSON_NAME);
    const outMd = path.join(outDir, OUT_MD_NAME);
    fs.mkdirSync(outDir, { recursive: true });
    const jsonObj = {
        threshold: new FloatTag(args.threshold),
        skills_scanned: skills.length,
        pairs: pairs.map(_pairToJson),
    };
    fs.writeFileSync(outJson, _dumpsWithFloats(jsonObj), 'utf-8');
    fs.writeFileSync(outMd, render_md(skills, pairs, args.threshold, args.field), 'utf-8');
    const merge = pairs.filter((p) => p.same_domain);
    if (!args.quiet) {
        process.stdout.write(
            `✅  Skill overlap: ${skills.length} skills, ${pairs.length} pair(s) ` +
                `≥ ${_pct(args.threshold)} (${merge.length} same-domain merge candidate(s)).\n`,
        );
        process.stdout.write(`   JSON: ${_relPosix(outJson, ROOT)}\n`);
        process.stdout.write(`   MD:   ${_relPosix(outMd, ROOT)}\n`);
    }
    // Deliberately NOT gated on --quiet: an advisory CI step whose only output
    // is suppressed by the pipeline's default --quiet is a report nobody reads,
    // which is one step away from the silent-green defect this tool just came
    // back from. The counts line always ships when the table is requested.
    if (args.printTable) {
        process.stdout.write(
            `ℹ️  skill overlap${args.strict ? '' : ' (advisory)'}: ${skills.length} skills scanned, ` +
                `${merge.length} same-domain pair(s) ≥ ${_pct(args.threshold)}\n`,
        );
        for (const p of merge) {
            process.stdout.write(
                `   ${p.similarity.toFixed(3)}  ${p.a} ↔ ${p.b}  [${p.shared_packs.join(', ')}]\n`,
            );
        }
    }

    if (!args.strict) {
        return 0;
    }
    let allow: Set<string>;
    try {
        allow = _loadAllowlist(args.allowlist ?? ALLOWLIST);
    } catch (exc) {
        process.stderr.write(`❌  ${exc instanceof Error ? exc.message : String(exc)}\n`);
        return 2;
    }
    const blocking = merge.filter((p) => !allow.has(_pairKey(p.a, p.b)));
    if (blocking.length === 0) {
        return 0;
    }
    process.stderr.write(
        `❌  audit_skill_overlap: ${blocking.length} same-pack pair(s) at or above ` +
            `${_pct(args.threshold)} with no reviewed justification:\n`,
    );
    for (const p of blocking) {
        process.stderr.write(
            `   ${p.similarity.toFixed(3)}  ${p.a} ↔ ${p.b}  [${p.shared_packs.join(', ')}]\n`,
        );
    }
    process.stderr.write(
        `   Merge the pair, or add {"pair": "${_pairKey(blocking[0]!.a, blocking[0]!.b)}", "reason": "…"} ` +
            `to ${_relPosix(args.allowlist ?? ALLOWLIST, ROOT)} (cap ${ALLOWLIST_CAP}).\n`,
    );
    return 1;
}

/** Order-independent key for an unordered pair. */
export function _pairKey(a: string, b: string): string {
    return a < b ? `${a}::${b}` : `${b}::${a}`;
}

/**
 * Reviewed same-pack overlaps, capped. Over-cap throws rather than warning:
 * per the autonomous-execution allowlist-growth antipattern, an allowlist that
 * outgrows its cap means the threshold is wrong, not that the corpus needs
 * twenty-one exceptions.
 */
export function _loadAllowlist(file: string): Set<string> {
    if (!_isFile(file)) {
        return new Set();
    }
    const data = JSON.parse(fs.readFileSync(file, 'utf-8')) as {
        entries?: Array<{ pair: string; reason: string }>;
    };
    const entries = Array.isArray(data.entries) ? data.entries : [];
    if (entries.length > ALLOWLIST_CAP) {
        throw new Error(
            `audit_skill_overlap: allowlist has ${entries.length} entries (> ${ALLOWLIST_CAP}). ` +
                'Per the autonomous-execution allowlist-growth antipattern, the threshold is wrong, ' +
                'not the corpus — re-litigate the bar, do not grow the list.',
        );
    }
    const out = new Set<string>();
    for (const e of entries) {
        const [a, b] = String(e.pair).split('::');
        if (a === undefined || b === undefined || (e.reason ?? '').trim() === '') {
            throw new Error(
                `audit_skill_overlap: allowlist entry ${JSON.stringify(e)} needs "pair": "a::b" and a non-empty "reason".`,
            );
        }
        out.add(_pairKey(a, b));
    }
    return out;
}

/** json.dumps(indent=2) with FloatTag → Python-float repr. */
function _dumpsWithFloats(obj: Json, level = 0): string {
    if (obj instanceof FloatTag) {
        return _floatStr(obj.value);
    }
    if (obj === null || obj === undefined) {
        return 'null';
    }
    if (typeof obj === 'number') {
        return _pyNumber(obj);
    }
    if (typeof obj === 'string') {
        return _pyJsonStr(obj);
    }
    if (obj === true) {
        return 'true';
    }
    if (obj === false) {
        return 'false';
    }
    if (Array.isArray(obj)) {
        if (obj.length === 0) {
            return '[]';
        }
        const pad = ' '.repeat(2 * (level + 1));
        const closePad = ' '.repeat(2 * level);
        return `[\n${obj.map((v) => pad + _dumpsWithFloats(v, level + 1)).join(',\n')}\n${closePad}]`;
    }
    const keys = Object.keys(obj as Record<string, Json>);
    if (keys.length === 0) {
        return '{}';
    }
    const pad = ' '.repeat(2 * (level + 1));
    const closePad = ' '.repeat(2 * level);
    const parts = keys.map(
        (k) => `${pad}${_pyJsonStr(k)}: ${_dumpsWithFloats((obj as Record<string, Json>)[k], level + 1)}`,
    );
    return `{\n${parts.join(',\n')}\n${closePad}}`;
}

interface Args {
    threshold: number;
    quiet: boolean;
    /** Absolute scan root; `undefined` = the `src/skills` default. */
    root?: string;
    /** Absolute report directory; `undefined` = `agents/reports`. */
    outDir?: string;
    /** Print the same-domain pair table to stdout even under `--quiet`. */
    printTable: boolean;
    /** Fail the build on an unjustified same-pack pair at or above threshold. */
    strict: boolean;
    /** Allowlist path override (tests); `undefined` = the shipped file. */
    allowlist?: string;
    /** Which text the vector is built from. `description` is NON-canonical. */
    field: Field;
}

export function parse_args(argv: string[]): Args {
    const args: Args = {
        threshold: OVERLAP_THRESHOLD,
        quiet: false,
        printTable: false,
        strict: false,
        field: 'body',
    };
    const takeValue = (flag: string, inline: string | undefined, next: () => string | undefined): string => {
        const v = inline ?? next();
        if (v === undefined) {
            process.stderr.write(`argument ${flag}: expected one argument\n`);
            process.exit(2);
        }
        return v;
    };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i] as string;
        if (a === '--quiet') {
            args.quiet = true;
        } else if (a === '--strict') {
            args.strict = true;
        } else if (a === '--allowlist' || a.startsWith('--allowlist=')) {
            const inline = a.startsWith('--allowlist=') ? a.slice('--allowlist='.length) : undefined;
            args.allowlist = path.resolve(ROOT, takeValue('--allowlist', inline, () => argv[++i]));
        } else if (a === '--descriptions') {
            args.field = 'description';
        } else if (a === '--print-table') {
            args.printTable = true;
        } else if (a === '--threshold' || a.startsWith('--threshold=')) {
            const inline = a.startsWith('--threshold=') ? a.slice('--threshold='.length) : undefined;
            args.threshold = Number(takeValue('--threshold', inline, () => argv[++i]));
        } else if (a === '--root' || a.startsWith('--root=')) {
            const inline = a.startsWith('--root=') ? a.slice('--root='.length) : undefined;
            args.root = path.resolve(ROOT, takeValue('--root', inline, () => argv[++i]));
        } else if (a === '--out-dir' || a.startsWith('--out-dir=')) {
            const inline = a.startsWith('--out-dir=') ? a.slice('--out-dir='.length) : undefined;
            args.outDir = path.resolve(ROOT, takeValue('--out-dir', inline, () => argv[++i]));
        } else {
            process.stderr.write(`unrecognized arguments: ${a}\n`);
            process.exit(2);
        }
    }
    return args;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    // A symlinked invocation (e.g. via an installed `.augment/` projection,
    // or macOS /var → /private/var temp dirs) makes the raw URLs differ:
    // import.meta.url is the resolved real path while argv[1] keeps the
    // symlink path. Compare realpaths so the entry guard still fires
    // (without this the CLI silently no-ops when run through a symlink).
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

const _isMain = _isCliEntry();
if (_isMain) {
    process.exitCode = main();
}
