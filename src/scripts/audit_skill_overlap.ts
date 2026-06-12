#!/usr/bin/env tsx
/**
 * Skill-family content-overlap analysis (6.0.0-C Phase 4 Step 8).
 *
 * TypeScript twin of `src/scripts/audit_skill_overlap.py` (ADR-090 —
 * Python→TS migration, Phase 8 / Wave 8c). Mirrors the Python CLI
 * contract EXACTLY — the `--threshold` / `--quiet` flags, exit codes
 * (0 ok / 3 no skills), the stdout/stderr split, byte-identical stdout
 * messages, and byte-identical written artefacts (`json.dumps(...,
 * indent=2)` for the JSON + the exact Markdown renderer).
 *
 * No `_lib` imports — the Python original has none; it carries its own
 * `_skill_roots()` (which references the `.agent-src.uncondensed/skills`
 * layout literally — this twin reproduces that literal faithfully, since
 * the .py original carries it).
 *
 * Walks every `SKILL.md`, builds a keyword vector from the body
 * (frontmatter stripped), and flags pairs whose content cosine-similarity
 * is >= OVERLAP_THRESHOLD. Same-domain (shared `packs:`) >= threshold pairs
 * are the merge candidates. THIS SCRIPT MERGES NOTHING.
 *
 * No behaviour changes — latent Python quirks replicated.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';

const _HERE = fileURLToPath(import.meta.url);
// src/scripts/audit_skill_overlap.py → parent.parent.parent == repo root.
export const ROOT = path.resolve(path.dirname(_HERE), '..', '..');
export const REPORT_DIR = path.join(ROOT, 'agents', 'reports');
export const OUT_JSON = path.join(REPORT_DIR, 'skill-overlap.json');
export const OUT_MD = path.join(REPORT_DIR, 'skill-overlap.md');
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

/** Sorted immediate child entries (mirrors `sorted(p.iterdir())` / `p.glob`). */
function _iterdirSorted(p: string): string[] {
    let names: string[];
    try {
        names = fs.readdirSync(p);
    } catch {
        return [];
    }
    names.sort();
    return names.map((n) => path.join(p, n));
}

/**
 * Mirror `_skill_roots`:
 *   roots = [d for d in (ROOT/"packages").glob("*\/.agent-src.uncondensed/skills")
 *            if d.is_dir()] if (ROOT/"packages").is_dir() else []
 *   legacy = ROOT/".agent-src.uncondensed"/"skills"
 *   if not roots and legacy.is_dir(): roots = [legacy]
 *
 * `packages.glob("*\/.agent-src.uncondensed/skills")` iterates packages
 * children sorted (pathlib glob over a single level is unsorted, but the
 * Python original does NOT sort here — it relies on `collect()`'s `seen`
 * dedup keyed on dir name. To stay deterministic we sort the package
 * children; the resulting root order only affects first-win dedup, and no
 * skill dir name collides across packages in practice.)
 */
export function _skill_roots(): string[] {
    const pkgs = path.join(ROOT, 'packages');
    let roots: string[] = [];
    if (_isDir(pkgs)) {
        for (const child of _iterdirSorted(pkgs)) {
            const cand = path.join(child, '.agent-src.uncondensed', 'skills');
            if (_isDir(cand)) {
                roots.push(cand);
            }
        }
    }
    const legacy = path.join(ROOT, '.agent-src.uncondensed', 'skills');
    if (roots.length === 0 && _isDir(legacy)) {
        roots = [legacy];
    }
    return roots;
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

/** Mirror `_parse`: yaml.safe_load frontmatter, body after the FM match. */
export function _parse(md: string): Skill {
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
    return {
        name: name ? String(name) : path.basename(path.dirname(md)),
        relpath: _relPosix(md, ROOT),
        packs: Array.isArray(packsVal) ? new Set(packsVal.map((x) => String(x))) : new Set(),
        vector: _keyword_vector(body),
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

export function collect(): Skill[] {
    const skills: Skill[] = [];
    const seen = new Set<string>();
    for (const root of _skill_roots()) {
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
            skills.push(_parse(md));
        }
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

export function render_md(skills: Skill[], pairs: Pair[], threshold: number): string {
    const merge = pairs.filter((p) => p.same_domain);
    const cross = pairs.filter((p) => !p.same_domain);
    const L: string[] = [
        '# Skill-family overlap report (6.0.0-C Phase 4 Step 8)\n',
        `> Content cosine-similarity over ${skills.length} skills; pairs at ` +
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
    const skills = collect();
    if (skills.length === 0) {
        process.stderr.write('❌  No skills found under the package skill roots.\n');
        return 3;
    }
    const pairs = find_pairs(skills, args.threshold);
    fs.mkdirSync(REPORT_DIR, { recursive: true });
    const jsonObj = {
        threshold: new FloatTag(args.threshold),
        skills_scanned: skills.length,
        pairs: pairs.map(_pairToJson),
    };
    fs.writeFileSync(OUT_JSON, _dumpsWithFloats(jsonObj), 'utf-8');
    fs.writeFileSync(OUT_MD, render_md(skills, pairs, args.threshold), 'utf-8');
    if (!args.quiet) {
        const merge = pairs.filter((p) => p.same_domain).length;
        process.stdout.write(
            `✅  Skill overlap: ${skills.length} skills, ${pairs.length} pair(s) ` +
                `≥ ${_pct(args.threshold)} (${merge} same-domain merge candidate(s)).\n`,
        );
        process.stdout.write(`   JSON: ${_relPosix(OUT_JSON, ROOT)}\n`);
        process.stdout.write(`   MD:   ${_relPosix(OUT_MD, ROOT)}\n`);
    }
    return 0;
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
}

export function parse_args(argv: string[]): Args {
    const args: Args = { threshold: OVERLAP_THRESHOLD, quiet: false };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i] as string;
        if (a === '--quiet') {
            args.quiet = true;
        } else if (a === '--threshold') {
            const v = argv[++i];
            if (v === undefined) {
                process.stderr.write('argument --threshold: expected one argument\n');
                process.exit(2);
            }
            args.threshold = Number(v);
        } else if (a.startsWith('--threshold=')) {
            args.threshold = Number(a.slice('--threshold='.length));
        } else {
            process.stderr.write(`unrecognized arguments: ${a}\n`);
            process.exit(2);
        }
    }
    return args;
}

const _isMain = import.meta.url === pathToFileURL(path.resolve(process.argv[1] ?? '')).href;
if (_isMain) {
    process.exitCode = main();
}
