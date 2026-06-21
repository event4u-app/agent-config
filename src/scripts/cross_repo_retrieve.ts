#!/usr/bin/env tsx
/**
 * Cross-repo retrieval — read-only, targeted, opt-in (ADR-032 Option A).
 *
 * TypeScript twin of `src/scripts/cross_repo_retrieve.py` (ADR-200,
 * Phase 8 / Wave 8g). Mirrors the Python contract EXACTLY — positional
 * `query` + `--path-scope` / `--max-chunks` / `--format` / `--root` flags,
 * the retrieval envelope shape, the text-table render, opt-in / large-sibling
 * guards, redaction + chunking floor, exit code 0, stdout/stderr split. No
 * behaviour changes.
 *
 * Phase 4 of `road-to-leaner-core-and-discovery`. Given a query and the
 * opted-in `linked_projects` siblings, runs a bounded *targeted* search
 * (path-glob + content grep — never a full walk) and returns the retrieval
 * envelope defined in `docs/contracts/cross-repo-retrieval.md`.
 *
 * The Python imports `redact` + `chunk_text` from `knowledge_ingest` (which
 * pulls in `workspace_secrets`). Those modules are not yet ported to
 * TypeScript and a `.ts` cannot import a `.py`, so the redaction + chunking
 * primitives are ported faithfully inline here and verified byte-identical
 * against the Python originals (differential-tested, no behavior divergence).
 * They carry no legacy-source-path literal, matching the `.py`.
 *
 * Scope guards (Option A):
 *   - read-only, no writes, no network;
 *   - only siblings with `include: true` in
 *     agents/settings/.agent-settings.local.yml;
 *   - `large`-flagged siblings REQUIRE a `--path-scope`;
 *   - ≤ --max-chunks results, one concept per query.
 *
 * Usage:
 *   cross_repo_retrieve.ts "<query>" [--path-scope GLOB]
 *           [--max-chunks N] [--format text|json] [--root PATH]
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { collect } from './linked_projects_list.js';

const _HERE = fileURLToPath(import.meta.url);

const DEFAULT_MAX_CHUNKS = 8;
const MAX_FILES_SCANNED = 2000; // hard ceiling on the targeted walk, defence-in-depth
const TEXT_SUFFIXES: ReadonlySet<string> = new Set([
    '.md', '.txt', '.py', '.ts', '.tsx', '.js', '.jsx', '.php', '.go',
    '.rs', '.rb', '.java', '.json', '.yml', '.yaml', '.toml', '.sql', '.sh',
]);
const SKIP_DIRS: ReadonlySet<string> = new Set([
    '.git', 'node_modules', 'dist', 'vendor', '.venv', '__pycache__',
    '.idea', '.vscode', 'build', 'target', '.next', 'coverage',
]);

// --- Redaction / chunking floor (faithful port; see header note) ----------

const CHUNK_BYTES = 2 * 1024;

// workspace_secrets patterns (HIGH-confidence first, then FUZZY).
const _RE_PRIVATE_KEY =
    /-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+PRIVATE KEY-----/g;
const _RE_AWS = /AKIA[0-9A-Z]{16}/g;
const _RE_GH = /gh[pousr]_[A-Za-z0-9]{36,}/g;
const _RE_OPENAI = /sk-[A-Za-z0-9]{20,}/g;
const _RE_KV_SECRET =
    /(?:api[_-]?key|secret|token|password|passwd|bearer)\s*[:=]\s*['"]?[A-Za-z0-9_\-+/=]{12,}['"]?/gi;
const _SECRET_PATTERNS: ReadonlyArray<RegExp> = [
    _RE_PRIVATE_KEY,
    _RE_AWS,
    _RE_GH,
    _RE_OPENAI,
    _RE_KV_SECRET,
];
const _SECRET_PLACEHOLDER = '[SECRET]';

// knowledge_ingest PII patterns.
const _RE_EMAIL = /[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g;
const _RE_PHONE = new RegExp(
    '(?:(?<=\\s)|(?<=^))' +
        '(?:\\+?\\d{1,3}[\\s.\\-]?)?' +
        '(?:\\(\\d{2,4}\\)[\\s.\\-]?|\\d{2,4}[\\s.\\-])' +
        '\\d{2,4}[\\s.\\-]?\\d{2,4}(?:[\\s.\\-]?\\d{2,4})?',
    'g',
);
const _RE_IBAN = /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g;
const _RE_CC = /\b(?:\d[ \-]?){13,19}\b/g;
const _RE_SSN = /\b\d{3}-\d{2}-\d{4}\b/g;

/** Count and replace all matches like Python `re.subn`. */
function _subn(text: string, pat: RegExp, repl: string): [string, number] {
    let n = 0;
    const out = text.replace(pat, () => {
        n += 1;
        return repl;
    });
    return [out, n];
}

/** Faithful port of `workspace_secrets.scrub(text, include_fuzzy=True)`. */
function _scrub_secrets(text: string): [string, number] {
    if (typeof text !== 'string' || text === '') {
        return [text, 0];
    }
    let count = 0;
    let out = text;
    for (const pat of _SECRET_PATTERNS) {
        const [t, n] = _subn(out, pat, _SECRET_PLACEHOLDER);
        out = t;
        count += n;
    }
    return [out, count];
}

/** Faithful port of `knowledge_ingest.redact(text, counters)`. */
function redact(text: string, counters: Record<string, number>): [string, number] {
    const _bump = (name: string, n = 1): void => {
        counters[name] = (counters[name] ?? 0) + n;
    };
    let [out, secrets_count] = _scrub_secrets(text);
    const piiPats: ReadonlyArray<[RegExp, string]> = [
        [_RE_IBAN, 'IBAN'],
        [_RE_CC, 'CC'],
        [_RE_SSN, 'SSN'],
        [_RE_EMAIL, 'EMAIL'],
        [_RE_PHONE, 'PHONE'],
    ];
    for (const [pat, tag] of piiPats) {
        const [t, n] = _subn(out, pat, `[${tag}]`);
        out = t;
        if (n) {
            _bump(tag, n);
        }
    }
    return [out, secrets_count];
}

/** UTF-8 byte length, mirror of Python `len(s.encode("utf-8"))`. */
function _utf8Len(s: string): number {
    return Buffer.byteLength(s, 'utf-8');
}

/** Faithful port of `knowledge_ingest.chunk_text(text, target_bytes)`. */
function chunk_text(text: string, target_bytes: number = CHUNK_BYTES): string[] {
    const paras = text.split(/\n\s*\n/);
    const out: string[] = [];
    let buf = '';
    for (let p of paras) {
        p = p.trim();
        if (!p) {
            continue;
        }
        const candidate = buf ? `${buf}\n\n${p}` : p;
        if (_utf8Len(candidate) > target_bytes && buf) {
            out.push(buf);
            buf = p;
        } else {
            buf = candidate;
        }
    }
    if (buf) {
        out.push(buf);
    }
    // Hard-split oversized chunks.
    const final: string[] = [];
    for (const c of out) {
        const b = Buffer.from(c, 'utf-8');
        if (b.length <= target_bytes * 2) {
            final.push(c);
            continue;
        }
        for (let i = 0; i < b.length; i += target_bytes) {
            final.push(b.subarray(i, i + target_bytes).toString('utf-8'));
        }
    }
    return final.filter((c) => c.trim());
}

// --- Sibling collector (injectable, mirrors monkeypatch.setattr) -----------

interface Sibling {
    path: string;
    large?: boolean;
    [key: string]: unknown;
}

/**
 * Mutable binding so tests can swap the collector exactly like
 * `monkeypatch.setattr(crr, "collect_siblings", ...)`. Defaults to the
 * `linked_projects_list.collect` opted-in cascade.
 */
let collect_siblings: (root: string, show_all?: boolean) => Sibling[] = (
    root: string,
    show_all = false,
) => collect(root, show_all) as unknown as Sibling[];

/** Test hook — replace the sibling collector (mirror monkeypatch). */
function _setCollectSiblings(
    fn: (root: string, show_all?: boolean) => Sibling[],
): void {
    collect_siblings = fn;
}

interface Match {
    source_repo: string;
    path: string;
    chunk: string;
    freshness: string;
    match_reason: string;
}

interface Result {
    query: string;
    matches: Match[];
    note?: string;
}

/** Mirror of `_freshness(repo, rel)`. */
function _freshness(repo: string, rel: string): string {
    try {
        const out = spawnSync(
            'git',
            ['log', '-1', '--format=%ad', '--date=short', '--', rel],
            { cwd: repo, encoding: 'utf8', timeout: 8000 },
        );
        if (out.status === 0 && (out.stdout ?? '').trim()) {
            return out.stdout.trim();
        }
    } catch {
        // fall through
    }
    try {
        const ts = fs.statSync(path.join(repo, rel)).mtimeMs;
        return new Date(ts).toISOString().slice(0, 10);
    } catch {
        return 'unknown';
    }
}

/** Mirror of `_iter_files(repo, path_scope)` — sorted rglob, capped, filtered. */
function* _iter_files(
    repo: string,
    path_scope: string | null,
): Generator<[string, string]> {
    let count = 0;
    for (const abs of _rglobSorted(repo)) {
        if (count >= MAX_FILES_SCANNED) {
            break;
        }
        let st: fs.Stats;
        try {
            st = fs.statSync(abs);
        } catch {
            continue;
        }
        if (!st.isFile() || !TEXT_SUFFIXES.has(_suffixLower(abs))) {
            continue;
        }
        const rel = _relPosix(repo, abs);
        if (rel.split('/').some((part) => SKIP_DIRS.has(part))) {
            continue;
        }
        if (path_scope && !_fnmatch(rel, path_scope)) {
            continue;
        }
        count += 1;
        yield [abs, rel];
    }
}

/** `repo.rglob("*")` sorted by string repr — recursive, all entries. */
function _rglobSorted(repo: string): string[] {
    const out: string[] = [];
    const walk = (dir: string): void => {
        let names: string[];
        try {
            names = fs.readdirSync(dir);
        } catch {
            return;
        }
        for (const name of names) {
            const abs = path.join(dir, name);
            out.push(abs);
            let st: fs.Stats;
            try {
                st = fs.lstatSync(abs);
            } catch {
                continue;
            }
            if (st.isDirectory()) {
                walk(abs);
            }
        }
    };
    walk(repo);
    out.sort();
    return out;
}

function _suffixLower(p: string): string {
    const ext = path.extname(p);
    return ext.toLowerCase();
}

function _relPosix(repo: string, abs: string): string {
    return path.relative(repo, abs).split(path.sep).join('/');
}

/** Python `fnmatch.fnmatch(name, pattern)` — case-normalized on POSIX. */
function _fnmatch(name: string, pattern: string): boolean {
    return _fnmatchToRegExp(pattern).test(name);
}

/** Mirror of `fnmatch.translate` (the subset fnmatch.fnmatch needs). */
function _fnmatchToRegExp(pattern: string): RegExp {
    let res = '';
    let i = 0;
    const n = pattern.length;
    while (i < n) {
        const c = pattern[i]!;
        i += 1;
        if (c === '*') {
            res += '.*';
        } else if (c === '?') {
            res += '.';
        } else if (c === '[') {
            let j = i;
            if (j < n && pattern[j] === '!') {
                j += 1;
            }
            if (j < n && pattern[j] === ']') {
                j += 1;
            }
            while (j < n && pattern[j] !== ']') {
                j += 1;
            }
            if (j >= n) {
                res += '\\[';
            } else {
                let stuff = pattern.slice(i, j).replace(/\\/g, '\\\\');
                i = j + 1;
                if (stuff.startsWith('!')) {
                    stuff = '^' + stuff.slice(1);
                } else if (stuff.startsWith('^')) {
                    stuff = '\\' + stuff;
                }
                res += `[${stuff}]`;
            }
        } else {
            res += c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }
    }
    return new RegExp(`^(?:${res})$`, 's');
}

/** Mirror of `_terms(query)`. */
function _terms(query: string): string[] {
    return query
        .toLowerCase()
        .replaceAll(',', ' ')
        .split(/\s+/)
        .filter((t) => t.length > 2);
}

/** Mirror of `search_sibling(repo, query, terms, path_scope, budget)`. */
function search_sibling(
    repo: string,
    _query: string,
    terms: string[],
    path_scope: string | null,
    budget: number,
): Match[] {
    const hits: Match[] = [];
    const repo_name = path.basename(repo);
    for (const [abs, rel] of _iter_files(repo, path_scope)) {
        if (hits.length >= budget) {
            break;
        }
        const rel_lower = rel.toLowerCase();
        const path_match = terms.some((t) => rel_lower.includes(t));
        let text: string;
        try {
            text = fs.readFileSync(abs, 'utf-8');
        } catch {
            continue;
        }
        const text_lower = text.toLowerCase();
        const content_terms = terms.filter((t) => text_lower.includes(t));
        if (!path_match && content_terms.length === 0) {
            continue;
        }
        const chunks = chunk_text(text);
        const chosen =
            chunks.find((c) => terms.some((t) => c.toLowerCase().includes(t))) ??
            (chunks.length > 0 ? chunks[0]! : '');
        const [redacted] = redact(chosen, {});
        const reason = path_match
            ? `path matches: ${rel}`
            : `content term(s): ${content_terms.slice(0, 3).join(', ')}`;
        hits.push({
            source_repo: repo_name,
            path: rel,
            chunk: redacted.slice(0, 2048),
            freshness: _freshness(repo, rel),
            match_reason: reason,
        });
    }
    return hits;
}

/** Mirror of `retrieve(root, query, path_scope, max_chunks)`. */
function retrieve(
    root: string,
    query: string,
    path_scope: string | null,
    max_chunks: number,
): Result {
    const siblings = collect_siblings(root, false); // opted-in only
    if (siblings.length === 0) {
        return {
            query,
            matches: [],
            note: 'no opted-in linked-project siblings — nothing to search',
        };
    }
    const terms = _terms(query);
    if (terms.length === 0) {
        return {
            query,
            matches: [],
            note: 'query too short — give at least one term > 2 chars',
        };
    }
    const matches: Match[] = [];
    const skipped: string[] = [];
    for (const sib of siblings) {
        if (matches.length >= max_chunks) {
            break;
        }
        const repo = sib.path;
        if (sib.large && !path_scope) {
            skipped.push(sib.path);
            continue;
        }
        matches.push(
            ...search_sibling(repo, query, terms, path_scope, max_chunks - matches.length),
        );
    }
    const out: Result = { query, matches: matches.slice(0, max_chunks) };
    if (skipped.length > 0) {
        out.note =
            'large sibling(s) skipped — supply --path-scope to search them: ' +
            skipped.join('; ');
    }
    return out;
}

/** Mirror of `render_text(result)`. */
function render_text(result: Result): string {
    const matches = result.matches;
    if (matches.length === 0) {
        return result.note ?? 'no matches';
    }
    const lines = ['| source_repo | path | freshness | why |', '|---|---|---|---|'];
    for (const m of matches) {
        lines.push(`| ${m.source_repo} | ${m.path} | ${m.freshness} | ${m.match_reason} |`);
    }
    if (result.note) {
        lines.push('', `> ${result.note}`);
    }
    return lines.join('\n');
}

interface ParsedArgs {
    query: string;
    path_scope: string | null;
    max_chunks: number;
    format: 'text' | 'json';
    root: string;
}

function _argparse_error(message: string): never {
    process.stderr.write(
        `usage: cross_repo_retrieve.py [-h] [--path-scope PATH_SCOPE]\n` +
            `                              [--max-chunks MAX_CHUNKS] [--format {text,json}]\n` +
            `                              [--root ROOT]\n` +
            `                              query\n`,
    );
    process.stderr.write(`cross_repo_retrieve.py: error: ${message}\n`);
    process.exit(2);
}

function parse_args(argv: readonly string[]): ParsedArgs {
    let query: string | null = null;
    let path_scope: string | null = null;
    let max_chunks = DEFAULT_MAX_CHUNKS;
    let format: 'text' | 'json' = 'text';
    let root = '.';
    // Unrecognized args (unknown flags + extra positionals) collected in
    // argv order, mirroring argparse's `parse_known_args` leftovers.
    const unrecognized: string[] = [];
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i]!;
        if (arg === '--path-scope') {
            const v = argv[++i];
            if (v === undefined) {
                _argparse_error('argument --path-scope: expected one argument');
            }
            path_scope = v;
        } else if (arg.startsWith('--path-scope=')) {
            path_scope = arg.slice('--path-scope='.length);
        } else if (arg === '--max-chunks') {
            const v = argv[++i];
            if (v === undefined) {
                _argparse_error('argument --max-chunks: expected one argument');
            }
            max_chunks = _pyInt(v, '--max-chunks');
        } else if (arg.startsWith('--max-chunks=')) {
            max_chunks = _pyInt(arg.slice('--max-chunks='.length), '--max-chunks');
        } else if (arg === '--format') {
            const v = argv[++i];
            if (v === undefined) {
                _argparse_error('argument --format: expected one argument');
            }
            format = _choiceFormat(v);
        } else if (arg.startsWith('--format=')) {
            format = _choiceFormat(arg.slice('--format='.length));
        } else if (arg === '--root') {
            const v = argv[++i];
            if (v === undefined) {
                _argparse_error('argument --root: expected one argument');
            }
            root = v;
        } else if (arg.startsWith('--root=')) {
            root = arg.slice('--root='.length);
        } else if (arg === '-h' || arg === '--help') {
            process.stdout.write(
                `usage: cross_repo_retrieve.py [-h] [--path-scope PATH_SCOPE]\n` +
                    `                              [--max-chunks MAX_CHUNKS] [--format {text,json}]\n` +
                    `                              [--root ROOT]\n` +
                    `                              query\n`,
            );
            process.exit(0);
        } else if (arg.startsWith('-') && arg !== '-') {
            unrecognized.push(arg);
        } else if (query === null) {
            query = arg;
        } else {
            unrecognized.push(arg);
        }
    }
    // argparse precedence: a missing required positional is reported even
    // when unrecognized args are also present.
    if (query === null) {
        _argparse_error('the following arguments are required: query');
    }
    if (unrecognized.length > 0) {
        _argparse_error(`unrecognized arguments: ${unrecognized.join(' ')}`);
    }
    return { query, path_scope, max_chunks, format, root };
}

function _pyInt(value: string, flag: string): number {
    if (!/^[+-]?\d+$/.test(value.trim())) {
        _argparse_error(`argument ${flag}: invalid int value: '${value}'`);
    }
    return parseInt(value.trim(), 10);
}

function _choiceFormat(value: string): 'text' | 'json' {
    if (value !== 'text' && value !== 'json') {
        _argparse_error(
            `argument --format: invalid choice: '${value}' (choose from 'text', 'json')`,
        );
    }
    return value;
}

/**
 * Mirror Python pathlib `.resolve()` — absolute, symlink-following, with a
 * prefix-resolution fallback for non-existent leaves.
 */
function _resolvePath(p: string): string {
    const abs = path.resolve(p);
    try {
        return fs.realpathSync(abs);
    } catch {
        // fall through to prefix resolution
    }
    let cur = abs;
    const tail: string[] = [];
    for (;;) {
        const parent = path.dirname(cur);
        if (parent === cur) {
            return abs;
        }
        tail.push(path.basename(cur));
        cur = parent;
        try {
            const base = fs.realpathSync(cur);
            tail.reverse();
            return path.join(base, ...tail);
        } catch {
            // keep walking up
        }
    }
}

function main(argv?: readonly string[]): number {
    const args = parse_args(argv ?? process.argv.slice(2));
    const result = retrieve(
        _resolvePath(args.root),
        args.query,
        args.path_scope,
        args.max_chunks,
    );
    process.stdout.write(
        (args.format === 'json' ? _pyJsonDumpsIndent2(result) : render_text(result)) + '\n',
    );
    return 0;
}

/** Mirror `json.dumps(obj, indent=2)` — `ensure_ascii=True`, 2-space indent. */
function _pyJsonDumpsIndent2(obj: unknown): string {
    return _dumpValue(obj, 0);
}

function _dumpValue(value: unknown, depth: number): string {
    const pad = '  '.repeat(depth);
    const padInner = '  '.repeat(depth + 1);
    if (value === null || value === undefined) return 'null';
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

export {
    DEFAULT_MAX_CHUNKS,
    redact,
    chunk_text,
    _terms,
    _freshness,
    search_sibling,
    retrieve,
    render_text,
    main,
    _setCollectSiblings,
    type Sibling,
    type Match,
    type Result,
};
