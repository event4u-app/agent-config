#!/usr/bin/env tsx
/**
 * Regenerate INDEX.md for an ADR directory. Parses ADR-*.md frontmatter
 * (adr/status/date/decision/supersedes), writes INDEX.md, splits legacy
 * non-numbered ADRs into an Unnumbered table, hard-fails on duplicate
 * numbers, filename/frontmatter mismatch, or broken supersedes links.
 *
 * Ported from the retired Python `src/scripts/adr/regenerate_index.py` (ADR-200).
 * The CLI contract is pinned — `--dir` (default `docs/adr/`),
 * `--check`, exit codes (0 / 1 / 2), the stdout/stderr split, byte-identical
 * messages. One deliberate deviation from the Python output: the INDEX.md
 * header names this TypeScript generator, not the retired `.py` (the ported
 * self-misdescription was itself a defect — ADR-hygiene roadmap, Phase 1).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readAdrAxisCells, readAdrFrontmatterScalars } from '../_lib/adr_frontmatter.js';
import { generatedByItalic } from '../_lib/generated_by.js';

// ^ADR-(\d{3})-([a-z0-9-]+)\.md$
const NAMED = /^ADR-(\d{3})-([a-z0-9-]+)\.md$/;
/**
 * The index used to render `| # | Title | Status | Date | Supersedes |`, which
 * is forward-only: a dead ADR showed `superseded | —` and the reader learned it
 * was dead but not by what. `superseded_by` was read nowhere despite being a
 * documented field, and `amended_by` had no representation at all — 18 ADRs
 * carry an amendment block and the index could not distinguish one with five
 * amendments from one never touched.
 */
const HEAD =
    '| # | Title | Status | Date | Provenance | Evidence | Supersedes | Superseded by | Amended by |\n' +
    '|---|---|---|---|---|---|---|---|---|';

type Meta = Record<string, string>;
interface Row extends Meta {
    // Numbered rows carry num/slug/path; legacy rows carry path (+ meta).
    [k: string]: string;
}

/** Mirror Python `str.title()`: cap first letter of each alphabetic run, lower the rest. */
function _title(s: string): string {
    let out = '';
    let prevIsCased = false;
    for (const ch of s) {
        const isCased = /[A-Za-z]/.test(ch);
        if (isCased) {
            out += prevIsCased ? ch.toLowerCase() : ch.toUpperCase();
        } else {
            out += ch;
        }
        prevIsCased = isCased;
    }
    return out;
}

/** Mirror Python `str.lstrip("0")` — drop leading "0" chars. */
function _lstripZeros(s: string): string {
    let i = 0;
    while (i < s.length && s[i] === '0') {
        i += 1;
    }
    return s.slice(i);
}

/** Mirror Python `str.zfill(3)` — left-pad with "0" to width 3. */
function _zfill3(s: string): string {
    return s.length >= 3 ? s : '0'.repeat(3 - s.length) + s;
}

/**
 * Mirror Python `str(PurePosixPath(x))`: collapse `//`, drop `.` segments,
 * strip the trailing slash, keep a single leading slash for absolute paths,
 * and render the empty path as `.`. Used so the `adr-dir not found:` /
 * `stale:` / `wrote` messages embed the path exactly as pathlib does.
 */
function _pyPathStr(x: string): string {
    const absolute = x.startsWith('/');
    const parts = x.split('/').filter((p) => p !== '' && p !== '.');
    const body = parts.join('/');
    if (absolute) {
        return `/${body}`;
    }
    return body === '' ? '.' : body;
}

/** Mirror Python `Path(d) / "INDEX.md"` rendered via str(). */
function _pyPathJoin(d: string, child: string): string {
    const base = _pyPathStr(d);
    return base === '.' ? child : `${base}/${child}`;
}

/**
 * Parse the leading `---` frontmatter block into a dict.
 *
 * Delegates to the shared reader (`_lib/adr_frontmatter.ts`). This was the
 * weakest of the three parsers it replaces — a scalar-only regex that matched
 * neither a key with an empty value nor an indented line, so `provenance:` and
 * `evidence:` would have read as ABSENT here while the other two readers folded
 * them into a string. Silently absent on the surface that renders the public
 * index is the failure mode the extraction exists to prevent.
 */
function fm(t: string): Meta {
    return (readAdrFrontmatterScalars(t) ?? {}) as Meta;
}

/** `sorted(d.glob("ADR-*.md"))` — flat children matching ADR-*.md, lexically sorted. */
function _globAdrSorted(d: string): string[] {
    let names: string[];
    try {
        names = fs.readdirSync(d);
    } catch {
        return [];
    }
    const out = names
        .filter((n) => n.startsWith('ADR-') && n.endsWith('.md'))
        .map((n) => path.join(d, n));
    out.sort();
    return out;
}

/** Mirror `scan(d)` — returns [numbered, legacy, errors]. */
export function scan(d: string): [Row[], Row[], string[]] {
    const num: Row[] = [];
    const leg: Row[] = [];
    const errs: string[] = [];
    const seen: Record<string, string> = {};
    for (const p of _globAdrSorted(d)) {
        const name = path.basename(p);
        if (name === 'INDEX.md') {
            continue;
        }
        const text = fs.readFileSync(p, 'utf-8');
        const meta = fm(text);
        // Read apart from `meta` on purpose. `provenance` and `evidence` are
        // nested, so the scalar reader keeps them out of its map entirely —
        // spreading `meta` could never produce these two cells, and the axis
        // reader is where the `discovery`-rides-in-the-grade rule lives.
        const axes = readAdrAxisCells(text);
        const m = NAMED.exec(name);
        if (!m) {
            leg.push({ path: name, ...meta, ...axes });
            continue;
        }
        const n = m[1] as string;
        if (meta.adr !== undefined && meta.adr !== '' && _lstripZeros(meta.adr) !== _lstripZeros(n)) {
            errs.push(`${name}: adr=${meta.adr} != filename ${n}`);
        }
        if (n in seen) {
            errs.push(`ADR-${n} duplicate: ${name} and ${seen[n]}`);
        }
        seen[n] = name;
        num.push({ num: n, slug: m[2] as string, path: name, ...meta, ...axes });
    }
    const nums = new Set(num.map((r) => r.num as string));
    for (const r of num) {
        const s = r.supersedes ?? '—';
        if (s && s !== '—') {
            // Comma-separated refs; a parenthesized annotation per ref marks
            // partial supersession (house precedent: ADR-098's superseded_by).
            for (const ref of s.split(',')) {
                const bare = ref.replace(/\(.*?\)/g, '').trim();
                if (!bare) continue;
                const t = _zfill3(_lstripZeros(bare.replaceAll('ADR-', '')));
                if (!nums.has(t)) {
                    errs.push(`${r.path}: supersedes ADR-${t} not found`);
                }
            }
        }
    }
    return [num, leg, errs];
}

/** Mirror `row(r)`. */
export function row(r: Row): string {
    const decision = r.decision ?? r.slug ?? '—';
    const title = _title(decision.replaceAll('-', ' '));
    const label = 'num' in r ? `ADR-${r.num}` : (r.path as string).slice(0, -3);
    return (
        `| [${label}](${r.path}) | ${title} | ${r.status ?? '—'} ` +
        `| ${r.date ?? '—'} | ${r.provenance_kind ?? '—'} | ${r.evidence_grade ?? '—'} ` +
        `| ${r.supersedes ?? '—'} | ${r.superseded_by ?? '—'} ` +
        `| ${r.amended_by ?? '—'} |`
    );
}

/**
 * Decision records that live outside the ADR directory.
 *
 * Six files under `agents/settings/contexts/` are titled `# ADR — …`, carry a
 * decision status, and had **zero** presence in this index — ADRs by every
 * property except location. A decision nobody can find is a trap: later work
 * contradicts it without knowing it existed, which is the failure ADR-124 paid
 * for with a hand-built 44-entry archaeology sweep.
 *
 * Listing beats relocating, deliberately. Moving them would mean renumbering six
 * records and rewriting ~15 inbound references, ten of them inside frozen
 * archived roadmaps whose paths were correct when written — rewriting history to
 * fix an index. The harm is findability, not location, so the index reaches out
 * instead. A scan also keeps working for the next file filed in the wrong place,
 * which a one-time move would not.
 */
const OUTSIDE_ROOTS = ['agents/settings/contexts'];
const DECISION_TITLE = /^#\s*ADR\s*[—–-]\s*(.+)$/m;

export interface OutsideRow {
    path: string;
    title: string;
    status: string;
}

export function scanOutside(repoRoot: string, roots: readonly string[] = OUTSIDE_ROOTS): OutsideRow[] {
    const out: OutsideRow[] = [];
    for (const rel of roots) {
        const dir = _pyPathJoin(repoRoot, rel);
        let names: string[];
        try {
            names = fs.readdirSync(dir);
        } catch {
            continue;
        }
        for (const name of names.slice().sort()) {
            if (!name.endsWith('.md')) continue;
            const text = fs.readFileSync(_pyPathJoin(dir, name), 'utf-8');
            const m = DECISION_TITLE.exec(text);
            if (!m) continue;
            const status =
                /^\s*>?\s*\*\*Status:\*\*\s*(.+)$/m.exec(text)?.[1] ??
                /^status:\s*(.+)$/m.exec(text)?.[1] ??
                '—';
            out.push({
                path: `${rel}/${name}`,
                title: (m[1] ?? name).trim(),
                status: status.trim().replace(/\s*·.*$/, ''),
            });
        }
    }
    return out;
}

/** Mirror `render(num, leg)`. */
export function render(num: Row[], leg: Row[], outside: OutsideRow[] = []): string {
    const out = [
        '# ADR Index',
        '',
        generatedByItalic('regenerate_index'),
        '',
    ];
    if (num.length === 0 && leg.length === 0 && outside.length === 0) {
        return [...out, 'No ADRs yet.', ''].join('\n');
    }
    out.push(HEAD, ...num.map(row));
    if (leg.length > 0) {
        out.push('', '## Unnumbered (legacy)', '', HEAD, ...leg.map(row));
    }
    if (outside.length > 0) {
        out.push(
            '',
            '## Decision records outside this directory',
            '',
            'Scanned, not hand-listed. These files are titled `# ADR — …` and record a',
            'decision, but live elsewhere in the tree. They are indexed here so a decision',
            'cannot be unfindable merely because of where it was filed; their paths are',
            'unchanged and their inbound references still resolve.',
            '',
            '| File | Title | Status |',
            '|---|---|---|',
            ...outside.map((o) => `| \`${o.path}\` | ${o.title} | ${o.status} |`),
        );
    }
    return [...out, ''].join('\n');
}

export function main(argv: string[] = process.argv.slice(2)): number {
    let dirArg = 'docs/adr/';
    let check = false;
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i] as string;
        if (a === '--check') {
            check = true;
        } else if (a === '--dir') {
            dirArg = (argv[i + 1] as string) ?? dirArg;
            i += 1;
        } else if (a.startsWith('--dir=')) {
            dirArg = a.slice('--dir='.length);
        }
    }
    const d = dirArg;
    let isDir = false;
    try {
        isDir = fs.statSync(d).isDirectory();
    } catch {
        isDir = false;
    }
    if (!isDir) {
        process.stderr.write(`adr-dir not found: ${_pyPathStr(d)}\n`);
        return 2;
    }
    const [num, leg, errs] = scan(d);
    for (const e of errs) {
        process.stderr.write(`error: ${e}\n`);
    }
    if (errs.length > 0) {
        return 2;
    }
    const rendered = render(num, leg, scanOutside(process.cwd()));
    const idx = _pyPathJoin(d, 'INDEX.md');
    if (check) {
        let cur = '';
        try {
            cur = fs.readFileSync(idx, 'utf-8');
        } catch {
            cur = '';
        }
        if (cur !== rendered) {
            process.stderr.write(`stale: ${idx}\n`);
            return 1;
        }
        return 0;
    }
    fs.writeFileSync(idx, rendered, 'utf-8');
    process.stdout.write(`wrote ${idx} (${num.length} numbered, ${leg.length} legacy)\n`);
    return 0;
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

const _invokedDirectly =
    _isCliEntry();
if (_invokedDirectly) {
    process.exitCode = main();
}
