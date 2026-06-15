#!/usr/bin/env tsx
/**
 * Regenerate INDEX.md for an ADR directory. Parses ADR-*.md frontmatter
 * (adr/status/date/decision/supersedes), writes INDEX.md, splits legacy
 * non-numbered ADRs into an Unnumbered table, hard-fails on duplicate
 * numbers, filename/frontmatter mismatch, or broken supersedes links.
 *
 * TypeScript twin of `src/scripts/adr/regenerate_index.py` (ADR-200, Phase 8).
 * The CLI contract is mirrored EXACTLY — `--dir` (default `docs/adr/`),
 * `--check`, exit codes (0 / 1 / 2), the stdout/stderr split, byte-identical
 * messages, AND byte-identical generated `INDEX.md`. No behaviour changes —
 * latent Python quirks replicated.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

// ^ADR-(\d{3})-([a-z0-9-]+)\.md$
const NAMED = /^ADR-(\d{3})-([a-z0-9-]+)\.md$/;
// ^---\n(.*?)\n---  (DOTALL)
const FM = /^---\n([\s\S]*?)\n---/;
// ^([a-z_]+):\s*(.+?)\s*$  (MULTILINE)
const FIELD = /^([a-z_]+):[ \t]*(.+?)[ \t]*$/gm;
const HEAD = '| # | Title | Status | Date | Supersedes |\n|---|---|---|---|---|';

type Meta = Record<string, string>;
interface Row extends Meta {
    // Numbered rows carry num/slug/path; legacy rows carry path (+ meta).
    [k: string]: string;
}

/** Mirror Python `str.strip(" \"'")` — strip listed chars from both ends. */
function _stripChars(s: string, chars: string): string {
    let start = 0;
    let end = s.length;
    while (start < end && chars.includes(s[start] as string)) {
        start += 1;
    }
    while (end > start && chars.includes(s[end - 1] as string)) {
        end -= 1;
    }
    return s.slice(start, end);
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

/** Mirror `fm(t)` — parse the leading `---` frontmatter block into a dict. */
function fm(t: string): Meta {
    const m = FM.exec(t);
    if (!m) {
        return {};
    }
    const out: Meta = {};
    const body = m[1] as string;
    FIELD.lastIndex = 0;
    let f: RegExpExecArray | null;
    while ((f = FIELD.exec(body)) !== null) {
        const k = f[1] as string;
        const v = f[2] as string;
        out[k] = _stripChars(v, ' "\'');
    }
    return out;
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
        const meta = fm(fs.readFileSync(p, 'utf-8'));
        const m = NAMED.exec(name);
        if (!m) {
            leg.push({ path: name, ...meta });
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
        num.push({ num: n, slug: m[2] as string, path: name, ...meta });
    }
    const nums = new Set(num.map((r) => r.num as string));
    for (const r of num) {
        const s = r.supersedes ?? '—';
        if (s && s !== '—') {
            const t = _zfill3(_lstripZeros(s.replaceAll('ADR-', '')));
            if (!nums.has(t)) {
                errs.push(`${r.path}: supersedes ADR-${t} not found`);
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
        `| ${r.date ?? '—'} | ${r.supersedes ?? '—'} |`
    );
}

/** Mirror `render(num, leg)`. */
export function render(num: Row[], leg: Row[]): string {
    const out = [
        '# ADR Index',
        '',
        '_Auto-generated by `scripts/adr/regenerate_index.py`. Do not edit._',
        '',
    ];
    if (num.length === 0 && leg.length === 0) {
        return [...out, 'No ADRs yet.', ''].join('\n');
    }
    out.push(HEAD, ...num.map(row));
    if (leg.length > 0) {
        out.push('', '## Unnumbered (legacy)', '', HEAD, ...leg.map(row));
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
    const rendered = render(num, leg);
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

const _invokedDirectly =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_invokedDirectly) {
    process.exitCode = main();
}
