#!/usr/bin/env node
/**
 * Meta-layer / concept-surface inventory — read-only discovery pass.
 *
 * TypeScript twin of `src/scripts/inventory_meta_layers.py` (ADR-096 —
 * Python→TS migration, Phase 8 / Wave 8c). Mirrors the CLI contract EXACTLY:
 * flag (`--quiet`), exit code 0, byte-identical stdout, and the byte-identical
 * written `meta-layer-inventory.md` (`\n`-joined) + `meta-layer-inventory.csv`
 * (csv.writer `\r\n` terminator, QUOTE_MINIMAL). No behaviour changes.
 *
 * Drives Phase 1 of `agents/roadmaps/road-to-leaner-core-and-discovery.md`.
 * Sibling to `scripts/inventory_abstraction_budget.py`: that tool counts
 * per-artefact references + frontmatter bloat; this one inventories the
 * *concept surface* the post-5.x feedback names as meta-complexity.
 *
 * For each concept it emits one row:
 *     concept · surfaces it lives in · line cost · last-touched · overlap candidates
 *
 * Output: agents/evidence/analysis/meta-layer-inventory.md (+ .csv)
 * Read-only. Touches no abstraction file.
 *
 * Divergence note: the .py builds `tok_freq` by iterating Python `set`
 * objects, whose order is hash-seed dependent; the resulting output is
 * nonetheless stable across PYTHONHASHSEED (verified) because the
 * concept label uses `sorted(shared)[:2]` and the `max(...)` fallback
 * resolves identically. This twin iterates tokens in a deterministic
 * (sorted) order so it produces the same result without relying on hash
 * order.
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
// src/scripts/inventory_meta_layers.ts → parents[2] is the repo root.
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const RULES_DIR = path.join(REPO_ROOT, 'dist/agent-src', 'rules');
const CONTRACTS_DIR = path.join(REPO_ROOT, 'docs', 'contracts');
const GUIDELINES_DIR = path.join(REPO_ROOT, 'docs', 'guidelines');
const CONTEXTS_DIR = path.join(REPO_ROOT, 'dist/agent-src', 'contexts');
const ROUTER = path.join(REPO_ROOT, 'dist', 'router.json');
const EVIDENCE_DIR = path.join(REPO_ROOT, 'agents', 'evidence', 'analysis');

const IRON_LAW_RE = /^#{1,3}\s+(?:The\s+)?Iron\s+Laws?\b/gim;

const STOPWORDS = new Set([
    'rule', 'rules', 'contract', 'contracts', 'mechanics', 'policy', 'schema',
    'config', 'v1', 'v2', 'and', 'the', 'of', 'for', 'to', 'in', 'on', 'a',
    'adr', 'model', 'spec', 'format', 'default', 'defaults', 'system', 'examples',
    'demos', 'writing', 'patterns', 'auto', 'core', 'base',
]);

const SEED_FAMILIES = ['iron', 'value', 'roadmap', 'linked', 'marketplace', 'governance', 'council'];

interface Surface {
    pathAbs: string;
    kind: string; // rule | contract | guideline | context
    lines: number;
    tokens: Set<string>;
}

function _rel(s: Surface): string {
    return path.relative(REPO_ROOT, s.pathAbs).split(path.sep).join('/');
}

function _lastTouched(p: string): string {
    try {
        const out = spawnSync(
            'git',
            ['log', '-1', '--format=%ad', '--date=short', '--', p],
            { cwd: REPO_ROOT, encoding: 'utf-8', timeout: 10000 },
        );
        if (out.error) return 'unknown';
        return (out.stdout ?? '').trim() || 'untracked';
    } catch {
        return 'unknown';
    }
}

function _tokens(stem: string): Set<string> {
    const out = new Set<string>();
    for (const t of stem.toLowerCase().split(/[-_]/)) {
        if (t && !STOPWORDS.has(t) && Array.from(t).length > 2) out.add(t);
    }
    return out;
}

function _collect(directory: string, kind: string): Surface[] {
    const out: Surface[] = [];
    if (!_exists(directory)) return out;
    for (const p of _rglobMd(directory)) {
        if (path.basename(p) === 'README.md') continue;
        const text = _readTextReplace(p);
        out.push({
            pathAbs: p,
            kind,
            lines: _count(text, '\n') + 1,
            tokens: _tokens(_stem(p)),
        });
    }
    return out;
}

interface Tiers {
    kernel: string[];
    tier_1: number;
    tier_2: number;
}

function _kernelAndTiers(): Tiers {
    if (!_exists(ROUTER)) return { kernel: [], tier_1: 0, tier_2: 0 };
    const d = JSON.parse(fs.readFileSync(ROUTER, 'utf-8')) as Record<string, unknown>;
    const kernel = Array.isArray(d['kernel']) ? (d['kernel'] as string[]) : [];
    const t1 = d['tier_1'];
    const t2 = d['tier_2'];
    return {
        kernel,
        tier_1: typeof t1 === 'number' ? t1 : Array.isArray(t1) ? t1.length : 0,
        tier_2: typeof t2 === 'number' ? t2 : Array.isArray(t2) ? t2.length : 0,
    };
}

function _ironLawCounts(): Map<string, number> {
    const counts = new Map<string, number>();
    for (const p of _globMd(RULES_DIR)) {
        const text = _readTextReplace(p);
        const n = _matchCount(IRON_LAW_RE, text);
        if (n) counts.set(_stem(p), n);
    }
    return counts;
}

function _stack(s: Surface): string {
    return _rel(s).replace(/\\/g, '/').includes('/guidelines/php/') ? 'php' : 'agent';
}

function _sameConcept(a: Surface, b: Surface): boolean {
    const sa = _stem(a.pathAbs).toLowerCase();
    const sb = _stem(b.pathAbs).toLowerCase();
    const [shortS, longS] = sa.length <= sb.length ? [sa, sb] : [sb, sa];
    if (shortS !== longS && longS.startsWith(shortS + '-') && _tokens(shortS).size >= 2) {
        return true;
    }
    if (_stack(a) !== _stack(b)) return false;
    return _setIntersectSize(a.tokens, b.tokens) >= 2;
}

interface ConceptRow {
    concept: string;
    surfaces: string;
    surface_count: number;
    kinds: string;
    line_cost: number;
    last_touched: string;
    overlap: string;
    seeded: string;
}

function _conceptRows(surfaces: Surface[]): ConceptRow[] {
    const parent = surfaces.map((_, i) => i);
    const find = (i: number): number => {
        while (parent[i] !== i) {
            parent[i] = parent[parent[i]!]!;
            i = parent[i]!;
        }
        return i;
    };
    const union = (i: number, j: number): void => {
        parent[find(i)] = find(j);
    };
    for (let i = 0; i < surfaces.length; i++) {
        for (let j = i + 1; j < surfaces.length; j++) {
            if (_sameConcept(surfaces[i]!, surfaces[j]!)) union(i, j);
        }
    }
    // defaultdict(list) keyed by root; preserve first-seen root order.
    const comps = new Map<number, Surface[]>();
    for (let idx = 0; idx < surfaces.length; idx++) {
        const root = find(idx);
        if (!comps.has(root)) comps.set(root, []);
        comps.get(root)!.push(surfaces[idx]!);
    }
    const rows: ConceptRow[] = [];
    for (const group of comps.values()) {
        if (group.length < 2) continue;
        const kinds = new Set(group.map((s) => s.kind));
        // tok_freq: defaultdict(int). Iterate group, then tokens (deterministic
        // sorted order — divergence note above).
        const tokFreq = new Map<string, number>();
        for (const s of group) {
            for (const t of [...s.tokens].sort(_pyStrCmp)) {
                tokFreq.set(t, (tokFreq.get(t) ?? 0) + 1);
            }
        }
        let shared: string[] = [];
        for (const [t, n] of tokFreq) if (n === group.length) shared.push(t);
        if (shared.length === 0) {
            // max(tok_freq, key=tok_freq.get) — first key with max value (insertion order).
            let bestKey = '';
            let bestVal = -Infinity;
            for (const [t, n] of tokFreq) {
                if (n > bestVal) {
                    bestVal = n;
                    bestKey = t;
                }
            }
            shared = [bestKey];
        }
        const label = [...shared].sort(_pyStrCmp).slice(0, 2).join('-');
        const seeded = shared.some((t) =>
            SEED_FAMILIES.some((f) => t.startsWith(f) || f.startsWith(t)),
        );
        const crossKind = kinds.size >= 2;
        const contractDup = group.filter((s) => s.kind === 'contract').length >= 2;
        const lineCost = group.reduce((acc, s) => acc + s.lines, 0);
        // max((_last_touched(s.path) for s in group), default="unknown") — max string.
        let touched = 'unknown';
        let first = true;
        for (const s of group) {
            const v = _lastTouched(s.pathAbs);
            if (first || _pyStrCmp(v, touched) > 0) {
                touched = v;
                first = false;
            }
        }
        const sortedGroup = _stableSort(group, (x, y) => _pyStrCmp(_rel(x), _rel(y)));
        rows.push({
            concept: label,
            surfaces: sortedGroup.map((s) => _rel(s)).join('; '),
            surface_count: group.length,
            kinds: [...kinds].sort(_pyStrCmp).join(','),
            line_cost: lineCost,
            last_touched: touched,
            overlap: crossKind || contractDup ? 'Y' : 'family',
            seeded: seeded ? 'Y' : '',
        });
    }
    // sort(key=lambda r: (-surface_count, -line_cost)) — stable.
    return _stableSort(rows, (a, b) => {
        if (a.surface_count !== b.surface_count) return b.surface_count - a.surface_count;
        return b.line_cost - a.line_cost;
    });
}

interface Args {
    quiet: boolean;
}

function parse_args(argv: string[]): Args {
    const args: Args = { quiet: false };
    for (const a of argv) {
        if (a === '--quiet') args.quiet = true;
        else {
            process.stderr.write(`inventory_meta_layers: error: unrecognized arguments: ${a}\n`);
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

    const surfaces = [
        ..._collect(RULES_DIR, 'rule'),
        ..._collect(CONTRACTS_DIR, 'contract'),
        ..._collect(GUIDELINES_DIR, 'guideline'),
        ..._collect(CONTEXTS_DIR, 'context'),
    ];
    const tiers = _kernelAndTiers();
    const iron = _ironLawCounts();
    const rows = _conceptRows(surfaces);

    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
    const md = path.join(EVIDENCE_DIR, 'meta-layer-inventory.md');
    const csvPath = path.join(EVIDENCE_DIR, 'meta-layer-inventory.csv');

    const kernel = tiers.kernel;
    const overlapCount = rows.filter((r) => r.overlap === 'Y').length;
    let ironTotal = 0;
    for (const v of iron.values()) ironTotal += v;

    const lines: string[] = [
        '# Meta-Layer / Concept-Surface Inventory',
        '',
        '> Read-only discovery output for `agents/roadmaps/road-to-leaner-core-and-discovery.md` Phase 1.',
        '> Counts are grep/git-backed via `scripts/inventory_meta_layers.py`. A row is an *overlap candidate*',
        '> when one concept (a shared filename token) is defined across ≥ 2 stable surfaces.',
        '',
        '## Summary',
        '',
        '| Metric | Value |',
        '|---|---:|',
        `| Always-loaded kernel rule families | ${kernel.length} |`,
        `| tier_1 (balanced) rules | ${tiers.tier_1} |`,
        `| tier_2 (full) rules | ${tiers.tier_2} |`,
        `| Rules carrying Iron-Law headings | ${iron.size} |`,
        `| Total Iron-Law headings across rules | ${ironTotal} |`,
        `| Concept surfaces scanned (rule/contract/guideline/context) | ${surfaces.length} |`,
        `| Concept overlap candidates (≥ 2 surfaces, cross-kind/contract-dup) | ${overlapCount} |`,
        '',
        `Kernel: ${kernel.join(', ')}`,
        '',
        '## Iron-Law density per rule (top 15)',
        '',
        '| Rule | Iron Laws |',
        '|---|---:|',
    ];
    // sorted(iron.items(), key=lambda kv: -kv[1])[:15] — stable on insertion order.
    const ironItems = _stableSort([...iron.entries()], (a, b) => b[1] - a[1]).slice(0, 15);
    for (const [stem, n] of ironItems) {
        lines.push(`| \`${stem}\` | ${n} |`);
    }

    lines.push(
        '',
        '## Concept-overlap ledger',
        '',
        '> One row per concept defined in ≥ 2 surfaces. `overlap=Y` = cross-kind or duplicate-contract',
        '> (genuine merge/delete candidate). `seeded` = a feedback-named meta-layer family.',
        '> Classification (merge / delete / keep-with-reason) is filled in Step 2 — left blank here.',
        '',
        '| Concept | Surfaces | # | Kinds | Lines | Last touched | Overlap | Class |',
        '|---|---|---:|---|---:|---|---|---|',
    );
    for (const r of rows) {
        lines.push(
            `| \`${r.concept}\` | ${r.surfaces} | ${r.surface_count} | ${r.kinds} | ` +
                `${r.line_cost} | ${r.last_touched} | ${r.overlap} | _unclassified_ |`,
        );
    }
    lines.push('');
    fs.writeFileSync(md, lines.join('\n'), 'utf-8');

    _writeCsv(
        csvPath,
        ['concept', 'surface_count', 'kinds', 'line_cost', 'last_touched', 'overlap', 'seeded', 'surfaces'],
        rows.map((r) => [
            r.concept,
            String(r.surface_count),
            r.kinds,
            String(r.line_cost),
            r.last_touched,
            r.overlap,
            r.seeded,
            r.surfaces,
        ]),
    );

    if (!args.quiet) {
        process.stdout.write(
            `meta-layer inventory: ${surfaces.length} surfaces, ${rows.length} concept rows, ${overlapCount} overlap candidates\n`,
        );
        process.stdout.write(`  → ${_relPosix(md, REPO_ROOT)}\n`);
        process.stdout.write(`  → ${_relPosix(csvPath, REPO_ROOT)}\n`);
    }
    return 0;
}

// --- CSV writer (mirror csv.writer: \r\n terminator, QUOTE_MINIMAL) ----------

function _csvField(field: string): string {
    if (/[",\r\n]/.test(field)) {
        return '"' + field.replace(/"/g, '""') + '"';
    }
    return field;
}

function _writeCsv(p: string, header: string[], rows: string[][]): void {
    const lines: string[] = [];
    lines.push(header.map(_csvField).join(','));
    for (const row of rows) lines.push(row.map(_csvField).join(','));
    fs.writeFileSync(p, lines.map((l) => l + '\r\n').join(''), 'utf-8');
}

// --- Python helpers ----------------------------------------------------------

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

function _stem(p: string): string {
    const base = path.basename(p);
    const ext = path.extname(base);
    return ext ? base.slice(0, base.length - ext.length) : base;
}

function _readTextReplace(p: string): string {
    // errors="replace" — Node default utf-8 decode replaces invalid bytes with U+FFFD.
    return fs.readFileSync(p, 'utf-8');
}

function _count(haystack: string, needle: string): number {
    if (needle === '') return 0;
    let count = 0;
    let idx = 0;
    while ((idx = haystack.indexOf(needle, idx)) !== -1) {
        count += 1;
        idx += needle.length;
    }
    return count;
}

function _matchCount(re: RegExp, text: string): number {
    const r = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
    let count = 0;
    let m: RegExpExecArray | null;
    while ((m = r.exec(text)) !== null) {
        count += 1;
        if (m.index === r.lastIndex) r.lastIndex++;
    }
    return count;
}

/** sorted(directory.rglob("*.md")) — Path sort, recursive, no symlink-dir follow. */
function _rglobMd(root: string): string[] {
    const out: string[] = [];
    const walk = (dir: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const e of entries) {
            const full = path.join(dir, e.name);
            if (e.isDirectory() && !e.isSymbolicLink()) {
                walk(full);
            } else if ((e.isFile() || e.isSymbolicLink()) && e.name.endsWith('.md')) {
                out.push(full);
            }
        }
    };
    walk(root);
    out.sort(_pyPathCmp);
    return out;
}

function _globMd(dir: string): string[] {
    let entries: string[];
    try {
        entries = fs.readdirSync(dir);
    } catch {
        return [];
    }
    const out = entries.filter((n) => n.endsWith('.md')).map((n) => path.join(dir, n));
    out.sort(_pyPathCmp);
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

function _setIntersectSize(a: Set<string>, b: Set<string>): number {
    let n = 0;
    const [small, large] = a.size <= b.size ? [a, b] : [b, a];
    for (const x of small) if (large.has(x)) n += 1;
    return n;
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

function _stableSort<T>(items: T[], cmp: (a: T, b: T) => number): T[] {
    const indexed = items.map((item, idx) => ({ item, idx }));
    indexed.sort((x, y) => {
        const c = cmp(x.item, y.item);
        if (c !== 0) return c;
        return x.idx - y.idx;
    });
    return indexed.map((e) => e.item);
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
