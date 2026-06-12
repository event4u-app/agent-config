#!/usr/bin/env node
/**
 * Skill discovery recommender — local-only, explained, no network.
 *
 * TypeScript twin of `skill_discovery.py` (Phase 8 / Wave 8e).
 *
 * Phase 3 of `road-to-leaner-core-and-discovery`. Turns existing local signals
 * (skill catalog frontmatter, role shortlists, optional local-analytics JSONL)
 * into a short, *explained* skill shortlist. Every recommendation carries a
 * non-empty `why` (contract: docs/contracts/skill-discovery.md). Adds no
 * always-loaded layer; reads local files only.
 *
 * Four classes:
 *   most-useful-for-role   — role skills.yml priority order
 *   related-to-current-task— skills sharing the role's core domains
 *   recently-adopted       — analytics events (last 14d) with a skill id
 *   popular-in-role        — analytics skill-events filtered by role, by frequency
 *
 * Analytics is optional; missing / empty / opted-out degrades gracefully to
 * the role shortlist with an honest `why`. Honours the same opt-out as
 * local-analytics.md (AGENT_CONFIG_NO_LOCAL_ANALYTICS env + analytics.local config).
 *
 * Usage:
 *   node skill_discovery.js [--role ROLE] [--format text|json] [--limit N]
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { parse as parseYaml } from 'yaml';

import { load_agent_settings } from './_lib/agent_settings.js';
import { event4u_root as _event4u_root_impl } from './_lib/user_global_paths.js';

const _HERE = fileURLToPath(import.meta.url);

const REPO_ROOT = path.resolve(_HERE, '..', '..', '..');
const SKILLS_DIR = path.join(REPO_ROOT, 'dist/agent-src', 'skills');
const ROLES_DIR = path.join(REPO_ROOT, 'agents', 'roles');
const COMMANDS_DIR = path.join(REPO_ROOT, 'dist/agent-src', 'commands');
const RECENT_DAYS = 14;

/**
 * Indirection so tests can override `event4u_root` (mirrors the Python
 * `monkeypatch.setattr(sd, "event4u_root", ...)`). Returns a filesystem path.
 */
export const _event4u = {
    event4u_root(env?: Record<string, string | undefined> | null): string {
        try {
            return _event4u_root_impl(env ?? null);
        } catch {
            // Fallback when run outside repo (mirrors Python's except branch).
            return path.join(os.homedir(), '.event4u', 'agent-config');
        }
    },
};

const CLASSES = [
    'most-useful-for-role',
    'related-to-current-task',
    'recently-adopted',
    'popular-in-role',
] as const;
void CLASSES; // declared in the original module for documentation parity

export class Skill {
    constructor(
        public name: string,
        public description: string,
        public domain: string,
    ) {}
}

export class Rec {
    public first_command: string;
    constructor(
        public skill: string,
        public cls: string,
        public why: string,
        first_command = '',
    ) {
        this.first_command = first_command;
    }
}

function _frontmatter(text: string): Record<string, unknown> {
    if (!text.startsWith('---')) {
        return {};
    }
    const end = text.indexOf('\n---', 3);
    if (end === -1) {
        return {};
    }
    try {
        // yaml.safe_load(...) or {} — a scalar/null/empty collapses to {}.
        return _asObjOrEmpty(parseYaml(text.slice(3, end), { version: '1.1' }));
    } catch {
        return {};
    }
}

export function load_catalog(): Map<string, Skill> {
    const out = new Map<string, Skill>();
    if (!_isDir(SKILLS_DIR)) {
        return out;
    }
    for (const d of _sortedDirEntries(SKILLS_DIR)) {
        const sk = path.join(d, 'SKILL.md');
        if (!_isFile(sk)) {
            continue;
        }
        const fm = _frontmatter(_readTextReplace(sk));
        const name = _stripQuotes(_pyStrip(_str(fm['name'] ?? '') || path.basename(d)));
        out.set(
            name,
            new Skill(
                name,
                _pyStrip(_str(fm['description'] ?? '')),
                _pyStrip(_str(fm['domain'] ?? '')),
            ),
        );
    }
    return out;
}

export function load_role_shortlist(role: string): Array<Record<string, unknown>> {
    const f = path.join(ROLES_DIR, role, 'skills.yml');
    if (!_isFile(f)) {
        return [];
    }
    const data = _asObjOrEmpty(parseYaml(_readTextReplace(f), { version: '1.1' }));
    const skills = data['skills'];
    const list = Array.isArray(skills) ? skills : [];
    return list.filter(
        (s) => _isObj(s) && _pyTruthy((s as Record<string, unknown>)['id']),
    ) as Array<Record<string, unknown>>;
}

export function available_roles(): string[] {
    if (!_isDir(ROLES_DIR)) {
        return [];
    }
    const out: string[] = [];
    for (const d of _sortedDirEntries(ROLES_DIR)) {
        if (_isFile(path.join(d, 'skills.yml'))) {
            out.push(path.basename(d));
        }
    }
    // sorted(d.name ...) — by basename, matching Python's sorted() of names.
    out.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    return out;
}

export function analytics_enabled(settings: Record<string, unknown>): boolean {
    if (_pyStrip(process.env['AGENT_CONFIG_NO_LOCAL_ANALYTICS'] ?? '')) {
        return false;
    }
    const analytics = _asObjOrEmpty(settings['analytics']);
    const val = analytics['local'];
    const norm = _pyStrip(_str(val)).toLowerCase();
    return !['off', 'false', '0', 'no'].includes(norm);
}

export function load_settings(): Record<string, unknown> {
    try {
        return load_agent_settings({ cwd: process.cwd() }) ?? {};
    } catch {
        return {};
    }
}

export function load_analytics_events(): Array<Record<string, unknown>> {
    const root = _event4u.event4u_root();
    const p = path.join(String(root), 'workspace', 'analytics', 'events.jsonl');
    if (!_isFile(p)) {
        return [];
    }
    const events: Array<Record<string, unknown>> = [];
    for (let line of _splitlines(_readTextReplace(p))) {
        line = _pyStrip(line);
        if (!line) {
            continue;
        }
        try {
            events.push(JSON.parse(line) as Record<string, unknown>);
        } catch {
            continue;
        }
    }
    return events;
}

function _days_ago(ts: string, now: Date): number | null {
    const ms = _fromIso(ts);
    if (ms === null) {
        return null;
    }
    // (now - dt).days — Python timedelta.days floors toward negative infinity.
    const deltaMs = now.getTime() - ms;
    return Math.floor(deltaMs / 86400000);
}

export function first_command(name: string): string {
    const direct = path.join(COMMANDS_DIR, `${name}.md`);
    if (_isFile(direct)) {
        return `/${name}`;
    }
    for (const cand of _glob_star_slash(COMMANDS_DIR, `${name}.md`)) {
        if (_isFile(cand)) {
            return `/${name}`;
        }
    }
    return `Skill › ${name}`;
}

export function recommend(
    role: string,
    catalog: Map<string, Skill>,
    shortlist: Array<Record<string, unknown>>,
    events: Array<Record<string, unknown>>,
    use_analytics: boolean,
    now: Date,
    limit: number,
): Rec[] {
    const recs: Rec[] = [];
    const claimed = new Set<string>();

    const add = (name: string, cls: string, why: string): void => {
        if (claimed.has(name) || !catalog.has(name) || !why) {
            return;
        }
        claimed.add(name);
        recs.push(new Rec(name, cls, why, first_command(name)));
    };

    // 1. most-useful-for-role — role shortlist priority order.
    const short_ids = shortlist.map((s) => _str(s['id']));
    for (const s of _slice(shortlist, 0, limit)) {
        const why = _pyStrip(_str(s['why'] ?? '')) || `on the ${role} role's priority shortlist`;
        add(_str(s['id']), 'most-useful-for-role', why);
    }

    // 2. related-to-current-task — same domain as the role's core skills.
    const role_domains = new Set<string>();
    for (const i of short_ids) {
        const sk = catalog.get(i);
        if (sk && sk.domain) {
            role_domains.add(sk.domain);
        }
    }
    const short_id_set = new Set(short_ids);
    // sorted(catalog.items()) — by key (skill name).
    const sortedItems = [...catalog.entries()].sort((a, b) =>
        a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0,
    );
    const related: Skill[] = [];
    for (const [n, sk] of sortedItems) {
        if (role_domains.has(sk.domain) && !short_id_set.has(n) && sk.domain) {
            related.push(sk);
        }
    }
    for (const sk of _slice(related, 0, limit)) {
        add(sk.name, 'related-to-current-task', `same domain (${sk.domain}) as your ${role} core skills`);
    }

    // 3 + 4. analytics-backed, or graceful role-shortlist fallback.
    const skill_events = events.filter((e) => {
        const data = e['data'];
        return _isObj(data) && _pyTruthy((data as Record<string, unknown>)['skill']);
    });
    if (use_analytics && skill_events.length > 0) {
        // recent = sorted(((skill, days_ago) ...), key=(days is None, days or 1e9))
        const recentPairs: Array<[string, number | null]> = skill_events.map((e) => {
            const data = e['data'] as Record<string, unknown>;
            return [_str(data['skill']), _days_ago(_str(e['ts'] ?? ''), now)];
        });
        const recent = _stableSort(recentPairs, (kv) => [
            kv[1] === null ? 1 : 0,
            kv[1] === null ? 1e9 : kv[1],
        ]);
        for (const [name, days] of recent) {
            if (days !== null && days <= RECENT_DAYS) {
                add(name, 'recently-adopted', `used ${days}d ago in this workspace`);
            }
        }
        // role_counts = Counter(skill for e if e.data.role == role)
        const role_counts = _counter(
            skill_events
                .filter((e) => (e['data'] as Record<string, unknown>)['role'] === role)
                .map((e) => _str((e['data'] as Record<string, unknown>)['skill'])),
        );
        for (const [name, n] of _mostCommon(role_counts, limit)) {
            add(name, 'popular-in-role', `launched ${n}× by the ${role} role locally`);
        }
    } else {
        const reason = 'from your role shortlist — no local usage signal yet';
        for (const s of _slice(shortlist, limit, limit * 2)) {
            add(_str(s['id']), 'recently-adopted', reason);
        }
        for (const s of shortlist) {
            add(_str(s['id']), 'popular-in-role', reason);
        }
    }
    return recs;
}

export function render_text(role: string, recs: Rec[], analytics_on: boolean): string {
    const lines: string[] = [`# Suggested skills for the \`${role}\` role`, ''];
    const note = analytics_on ? 'local analytics: on' : 'local analytics: off (role shortlist only)';
    lines.push(`_${note}_\n`);
    lines.push('| skill | class | why | first command |', '|---|---|---|---|');
    for (const r of recs) {
        lines.push(`| \`${r.skill}\` | ${r.cls} | ${r.why} | \`${r.first_command}\` |`);
    }
    lines.push('');
    return lines.join('\n');
}

export function main(argv: string[] | null = null): number {
    const args = parse_args(argv ?? process.argv.slice(2));

    const settings = load_settings();
    const rolesCfg = _asObjOrEmpty(settings['roles']);
    const role = args.role ?? _pyStrip(_str(rolesCfg['active_role'] ?? ''));
    const roles = available_roles();
    if (!role) {
        process.stderr.write(
            `No role given and no active role set. Available roles: ${roles.join(', ') || '(none)'}\n`,
        );
        process.stderr.write('Re-run with --role <role>.\n');
        return 2;
    }
    if (!roles.includes(role)) {
        process.stderr.write(
            `Unknown role ${_pyRepr(role)}. Available: ${roles.join(', ') || '(none)'}\n`,
        );
        return 2;
    }

    const catalog = load_catalog();
    const shortlist = load_role_shortlist(role);
    const use_analytics = analytics_enabled(settings);
    const events = use_analytics ? load_analytics_events() : [];
    const now = args.now ? _parseNow(args.now) : _utcNow();

    const recs = recommend(role, catalog, shortlist, events, use_analytics, now, args.limit);

    if (args.format === 'json') {
        process.stdout.write(
            _pyJsonDumpsIndent2({
                role,
                analytics: use_analytics,
                recommendations: recs.map((r) => ({
                    skill: r.skill,
                    cls: r.cls,
                    why: r.why,
                    first_command: r.first_command,
                })),
            }) + '\n',
        );
    } else {
        process.stdout.write(render_text(role, recs, use_analytics) + '\n');
    }
    return 0;
}

interface ParsedArgs {
    role: string | null;
    format: 'text' | 'json';
    limit: number;
    now: string | null;
}

function _argError(msg: string): never {
    process.stderr.write(
        'usage: skill_discovery.py [-h] [--role ROLE] [--format {text,json}]\n' +
            '                          [--limit LIMIT] [--now NOW]\n',
    );
    process.stderr.write(`skill_discovery.py: error: ${msg}\n`);
    process.exit(2);
}

function parse_args(argv: string[]): ParsedArgs {
    const out: ParsedArgs = { role: null, format: 'text', limit: 5, now: null };
    let i = 0;
    while (i < argv.length) {
        const a = argv[i] as string;
        if (a === '-h' || a === '--help') {
            process.stdout.write('Local skill-discovery recommender (read-only, explained).\n');
            process.exit(0);
        } else if (a === '--role') {
            const v = argv[i + 1];
            if (v === undefined) _argError('argument --role: expected one argument');
            out.role = v as string;
            i += 1;
        } else if (a.startsWith('--role=')) {
            out.role = a.slice('--role='.length);
        } else if (a === '--format') {
            const v = argv[i + 1];
            if (v === undefined) _argError('argument --format: expected one argument');
            _checkFormat(v as string);
            out.format = v as 'text' | 'json';
            i += 1;
        } else if (a.startsWith('--format=')) {
            const v = a.slice('--format='.length);
            _checkFormat(v);
            out.format = v as 'text' | 'json';
        } else if (a === '--limit') {
            const v = argv[i + 1];
            if (v === undefined) _argError('argument --limit: expected one argument');
            out.limit = _parseIntArg(v as string);
            i += 1;
        } else if (a.startsWith('--limit=')) {
            out.limit = _parseIntArg(a.slice('--limit='.length));
        } else if (a === '--now') {
            const v = argv[i + 1];
            if (v === undefined) _argError('argument --now: expected one argument');
            out.now = v as string;
            i += 1;
        } else if (a.startsWith('--now=')) {
            out.now = a.slice('--now='.length);
        } else {
            _argError(`unrecognized arguments: ${a}`);
        }
        i += 1;
    }
    return out;
}

function _checkFormat(v: string): void {
    if (v !== 'text' && v !== 'json') {
        _argError(`argument --format: invalid choice: '${v}' (choose from 'text', 'json')`);
    }
}

function _parseIntArg(v: string): number {
    if (!/^[+-]?\d+$/.test(v.trim())) {
        _argError(`argument --limit: invalid int value: '${v}'`);
    }
    return parseInt(v, 10);
}

// ---------- helpers ----------

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

/** Mirror sorted(Path.iterdir()) — full-path component-wise ordering. */
function _sortedDirEntries(dir: string): string[] {
    let names: string[];
    try {
        names = fs.readdirSync(dir);
    } catch {
        return [];
    }
    const full = names.map((n) => path.join(dir, n));
    full.sort(_pathCompare);
    return full;
}

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

// Mirror sorted(COMMANDS_DIR.glob("* / {name}.md")) — one level deep.
function _glob_star_slash(dir: string, leaf: string): string[] {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return [];
    }
    const out: string[] = [];
    for (const e of entries) {
        if (e.isDirectory()) {
            out.push(path.join(dir, e.name, leaf));
        }
    }
    out.sort(_pathCompare);
    return out;
}

function _readTextReplace(p: string): string {
    // errors="replace" — Node decodes invalid UTF-8 to U+FFFD by default.
    return fs.readFileSync(p, 'utf-8');
}

function _asObj(v: unknown): Record<string, unknown> | null {
    return typeof v === 'object' && v !== null && !Array.isArray(v)
        ? (v as Record<string, unknown>)
        : null;
}

function _asObjOrEmpty(v: unknown): Record<string, unknown> {
    return _asObj(v) ?? {};
}

function _isObj(v: unknown): boolean {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function _str(v: unknown): string {
    if (v === null || v === undefined) return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'boolean') return v ? 'True' : 'False';
    return String(v);
}

function _pyStrip(s: string): string {
    return s.replace(/^\s+/, '').replace(/\s+$/, '');
}

/** Python str.strip('"'). */
function _stripQuotes(s: string): string {
    let start = 0;
    let end = s.length;
    while (start < end && s[start] === '"') start += 1;
    while (end > start && s[end - 1] === '"') end -= 1;
    return s.slice(start, end);
}

function _pyTruthy(value: unknown): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') return value.length > 0;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value).length > 0;
    return true;
}

function _splitlines(s: string): string[] {
    if (s === '') return [];
    return s.split(/\r\n|\r|\n/);
}

/** Python list slicing list[start:stop] (clamped, never throws). */
function _slice<T>(arr: T[], start: number, stop: number): T[] {
    return arr.slice(start, stop);
}

/** datetime.fromisoformat(s.replace("Z","+00:00")) → epoch ms or null. */
function _fromIso(ts: string): number | null {
    if (typeof ts !== 'string' || ts === '') return null;
    const ms = Date.parse(ts.replace('Z', '+00:00'));
    return Number.isNaN(ms) ? null : ms;
}

function _parseNow(s: string): Date {
    const ms = Date.parse(s.replace('Z', '+00:00'));
    return new Date(ms);
}

function _utcNow(): Date {
    return new Date();
}

/** Python repr() of a string for the error message — single-quoted. */
function _pyRepr(s: string): string {
    // Mirror repr() for typical role strings (no quotes/backslashes expected).
    if (!s.includes("'")) {
        return `'${s.replace(/\\/g, '\\\\')}'`;
    }
    if (!s.includes('"')) {
        return `"${s.replace(/\\/g, '\\\\')}"`;
    }
    return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

/**
 * Stable sort by a tuple key, replicating Python's sorted() with a tuple key.
 * Python tuple comparison is lexicographic; sort is stable.
 */
function _stableSort<T>(arr: T[], keyFn: (item: T) => Array<number>): T[] {
    return arr
        .map((item, idx) => ({ item, idx, key: keyFn(item) }))
        .sort((a, b) => {
            const n = Math.min(a.key.length, b.key.length);
            for (let i = 0; i < n; i += 1) {
                const ka = a.key[i] as number;
                const kb = b.key[i] as number;
                if (ka < kb) return -1;
                if (ka > kb) return 1;
            }
            return a.idx - b.idx; // stable
        })
        .map((x) => x.item);
}

/** Counter — insertion-ordered count map (first-seen order preserved). */
function _counter(items: string[]): Map<string, number> {
    const m = new Map<string, number>();
    for (const it of items) {
        m.set(it, (m.get(it) ?? 0) + 1);
    }
    return m;
}

/**
 * Counter.most_common(n) — descending by count; ties keep first-insertion
 * order (CPython implementation detail, deterministic for fixed input order).
 */
function _mostCommon(counter: Map<string, number>, n: number): Array<[string, number]> {
    const entries = [...counter.entries()].map(([k, v], idx) => ({ k, v, idx }));
    entries.sort((a, b) => {
        if (b.v !== a.v) return b.v - a.v;
        return a.idx - b.idx; // stable: insertion order on ties
    });
    return entries.slice(0, n).map((e) => [e.k, e.v] as [string, number]);
}

/** Mirror json.dumps(obj, indent=2). */
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
