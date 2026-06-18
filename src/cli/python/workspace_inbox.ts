#!/usr/bin/env tsx
/**
 * Tier-3 host hand-off inbox — ADR-023 Tier 3 / ADR-065 (TypeScript twin).
 *
 * TypeScript twin of `src/cli/python/workspace_inbox.py` (ADR-200, py2ts
 * migration). Byte-for-byte CLI parity with the Python original — same
 * frontmatter shape, same id / timestamp formats, same atomic write, same
 * secret-scrub + skill pre-render hand-off, same `json.dumps(..., sort_keys=
 * True)` output, same mtime-sorted listing. No behaviour changes — latent
 * quirks are replicated, not fixed.
 *
 * For hosts the workspace cannot drive (Augment, Cursor, Cline, Windsurf, …),
 * the workspace writes the rendered prompt into
 * `~/.event4u/agent-config/workspace/inbox/<id>.md` and surfaces a one-line
 * copy-to-clipboard banner; the user opens the host themselves.
 *
 * v0 is deliberately minimal (AI-council 2026-06-08): **plaintext** (NOT
 * encrypted), **ephemeral** (a `prune` drops files older than the retention
 * window), and **content-minimal** (header + rendered prompt body).
 *
 * CLI:
 *
 *     workspace_inbox.ts write --role <r> --task <t> --body-file <p>
 *                              [--session <id>] [--root <p>]
 *     workspace_inbox.ts read <id> [--root <p>]
 *     workspace_inbox.ts list [--limit 20] [--json] [--root <p>]
 *     workspace_inbox.ts forget <id> [--root <p>]
 *     workspace_inbox.ts prune [--max-age-hours 24] [--root <p>]
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Sibling twins (TS imports the .ts twins, never the .py originals).
import { scrub } from './workspace_secrets.js';
import { renderSection as resolveSection } from './workspace_skills.js';

const _HERE = fileURLToPath(import.meta.url);

/** argparse usage-error / help exit (code 2 / 0). Caught at the CLI entry. */
class ArgparseExit extends Error {
    constructor(public readonly code: number) {
        super(`argparse-exit-${code}`);
    }
}

/** A `raise SystemExit(str)` — prints the message to stderr, exits 1. */
class SystemExitError extends Error {
    constructor(public readonly detail: string) {
        super(detail);
    }
}

const WORKSPACE_HOME = path.join(
    os.homedir(),
    '.event4u',
    'agent-config',
    'workspace',
    'inbox',
);
const RETENTION_HOURS = 24;

// --- JSON byte-parity (ensure_ascii=True, sort_keys=True) -------------------

function _jsonStrAscii(s: string): string {
    let out = '"';
    for (const ch of s) {
        const code = ch.codePointAt(0) as number;
        switch (ch) {
            case '"':
                out += '\\"';
                break;
            case '\\':
                out += '\\\\';
                break;
            case '\n':
                out += '\\n';
                break;
            case '\r':
                out += '\\r';
                break;
            case '\t':
                out += '\\t';
                break;
            case '\b':
                out += '\\b';
                break;
            case '\f':
                out += '\\f';
                break;
            default:
                if (code < 0x20) {
                    out += '\\u' + code.toString(16).padStart(4, '0');
                } else if (code < 0x7f) {
                    out += ch;
                } else if (code <= 0xffff) {
                    out += '\\u' + code.toString(16).padStart(4, '0');
                } else {
                    const v = code - 0x10000;
                    const hi = 0xd800 + (v >> 10);
                    const lo = 0xdc00 + (v & 0x3ff);
                    out +=
                        '\\u' +
                        hi.toString(16).padStart(4, '0') +
                        '\\u' +
                        lo.toString(16).padStart(4, '0');
                }
        }
    }
    return out + '"';
}

function _jsonScalar(value: unknown): string | null {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'number') return String(value);
    if (typeof value === 'string') return _jsonStrAscii(value);
    return null;
}

function _dumpSorted(value: unknown): string {
    const scalar = _jsonScalar(value);
    if (scalar !== null) return scalar;
    if (Array.isArray(value)) {
        return '[' + value.map((v) => _dumpSorted(v)).join(', ') + ']';
    }
    if (typeof value === 'object' && value !== null) {
        const obj = value as Record<string, unknown>;
        const keys = Object.keys(obj).sort();
        return '{' + keys.map((k) => `${_jsonStrAscii(k)}: ${_dumpSorted(obj[k])}`).join(', ') + '}';
    }
    return _jsonStrAscii(String(value));
}

function jsonDumpsSorted(value: unknown): string {
    return _dumpSorted(value);
}

function print(line = ''): void {
    process.stdout.write(line + '\n');
}

function eprint(line = ''): void {
    process.stderr.write(line + '\n');
}

function pathExists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

// --- Python string helpers --------------------------------------------------

/** `str.splitlines()` — universal newline boundaries, no trailing empty. */
function pySplitlines(text: string): string[] {
    if (text === '') return [];
    const out: string[] = [];
    let cur = '';
    for (let i = 0; i < text.length; i += 1) {
        const ch = text[i] as string;
        const code = text.charCodeAt(i);
        const isBoundary =
            ch === '\n' ||
            ch === '\r' ||
            ch === '\v' ||
            ch === '\f' ||
            code === 0x1c ||
            code === 0x1d ||
            code === 0x1e ||
            code === 0x85 ||
            code === 0x2028 ||
            code === 0x2029;
        if (isBoundary) {
            out.push(cur);
            cur = '';
            if (ch === '\r' && text[i + 1] === '\n') i += 1;
        } else {
            cur += ch;
        }
    }
    if (cur !== '') out.push(cur);
    return out;
}

/** `str.rstrip("\n")`. */
function pyRstripNewlines(s: string): string {
    let end = s.length;
    while (end > 0 && s[end - 1] === '\n') end -= 1;
    return s.slice(0, end);
}

// ---------------------------------------------------------------------------
// Module body (workspace_inbox.py).
// ---------------------------------------------------------------------------

/** `datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")`. */
function _nowIso(): string {
    return _strftimeIso(new Date());
}

function _pad(n: number, w: number): string {
    return String(n).padStart(w, '0');
}

function _strftimeIso(d: Date): string {
    return (
        `${_pad(d.getUTCFullYear(), 4)}-${_pad(d.getUTCMonth() + 1, 2)}-${_pad(
            d.getUTCDate(),
            2,
        )}T${_pad(d.getUTCHours(), 2)}:${_pad(d.getUTCMinutes(), 2)}:${_pad(d.getUTCSeconds(), 2)}Z`
    );
}

/** `<YYYYMMDDTHHMMSSZ>-<8-hex>` (secrets.token_hex(4) → 4 bytes → 8 hex). */
function _newId(): string {
    const d = new Date();
    const stamp =
        `${_pad(d.getUTCFullYear(), 4)}${_pad(d.getUTCMonth() + 1, 2)}${_pad(
            d.getUTCDate(),
            2,
        )}T${_pad(d.getUTCHours(), 2)}${_pad(d.getUTCMinutes(), 2)}${_pad(d.getUTCSeconds(), 2)}Z`;
    return `${stamp}-${crypto.randomBytes(4).toString('hex')}`;
}

/** Atomic write: temp file + fsync + rename. */
function _atomicWrite(p: string, text: string): void {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    const tmp = path.join(
        path.dirname(p),
        `.tmp-${process.pid}-${crypto.randomBytes(6).toString('hex')}.tmp`,
    );
    let fd: number | null = null;
    try {
        fd = fs.openSync(tmp, 'w');
        fs.writeFileSync(fd, text, { encoding: 'utf-8' });
        fs.fsyncSync(fd);
        fs.closeSync(fd);
        fd = null;
        fs.renameSync(tmp, p);
    } finally {
        if (fd !== null) {
            try {
                fs.closeSync(fd);
            } catch {
                /* ignore */
            }
        }
        if (pathExists(tmp)) {
            try {
                fs.unlinkSync(tmp);
            } catch {
                /* ignore */
            }
        }
    }
}

function _frontmatter(meta: Record<string, unknown>): string {
    const lines = ['---'];
    for (const k of ['id', 'role', 'task', 'session', 'created_at']) {
        const v = meta[k];
        if (v !== null && v !== undefined && v !== '') {
            lines.push(`${k}: ${v}`);
        }
    }
    lines.push('---');
    return lines.join('\n') + '\n\n';
}

/**
 * Write one Tier-3 hand-off file. Returns `{id, path, banner}`.
 *
 * When `skill_hint` is given, the resolved skill body is pre-rendered into
 * the hand-off (ADR-066). A missing / invalid skill degrades to an inline note.
 */
export function write(
    role: string,
    task: string,
    body: string,
    opts?: { session?: string | null; skill_hint?: string | null; root?: string | null },
): Record<string, unknown> {
    const session = opts?.session ?? null;
    const skill_hint = opts?.skill_hint ?? null;
    const root = opts?.root ?? null;
    const base = root !== null ? root : WORKSPACE_HOME;
    const inboxId = _newId();
    let bodyOut = body;
    if (skill_hint) {
        bodyOut = pyRstripNewlines(bodyOut) + '\n' + resolveSection(skill_hint);
    }
    // Disposable hand-off → scrub a pasted credential silently.
    const [safeBody] = scrub(bodyOut);
    const [safeTask] = scrub(task);
    const meta = {
        id: inboxId,
        role,
        task: safeTask,
        session,
        created_at: _nowIso(),
    };
    const p = path.join(base, `${inboxId}.md`);
    _atomicWrite(p, _frontmatter(meta) + (safeBody as string));
    return {
        id: inboxId,
        path: p,
        banner: `Tier-3 hand-off ready: copy ${p} into your host, then open it.`,
    };
}

export function read(inboxId: string, opts?: { root?: string | null }): string | null {
    const root = opts?.root ?? null;
    const base = root !== null ? root : WORKSPACE_HOME;
    const p = path.join(base, `${inboxId}.md`);
    if (!pathExists(p)) {
        return null;
    }
    return fs.readFileSync(p, 'utf-8');
}

export function forget(inboxId: string, opts?: { root?: string | null }): boolean {
    const root = opts?.root ?? null;
    const base = root !== null ? root : WORKSPACE_HOME;
    const p = path.join(base, `${inboxId}.md`);
    if (!pathExists(p)) {
        return false;
    }
    fs.unlinkSync(p);
    return true;
}

interface InboxRow {
    id: string;
    role: unknown;
    task: unknown;
    session: unknown;
    created_at: unknown;
    path: string;
}

export function listInbox(opts?: { limit?: number; root?: string | null }): InboxRow[] {
    const limit = opts?.limit ?? 20;
    const root = opts?.root ?? null;
    const base = root !== null ? root : WORKSPACE_HOME;
    if (!pathExists(base)) {
        return [];
    }
    let names: string[];
    try {
        names = fs.readdirSync(base);
    } catch {
        return [];
    }
    const files = names
        .filter((n) => n.endsWith('.md'))
        .map((n) => path.join(base, n))
        .filter((p) => {
            try {
                return fs.statSync(p).isFile();
            } catch {
                return false;
            }
        });
    // sorted by st_mtime, reverse=True. Python's sort is stable; for ties the
    // pre-sort order (readdir order) is preserved. We mirror by sorting on the
    // float mtime descending, stable.
    const withMtime = files.map((p, i) => ({ p, mtime: fs.statSync(p).mtimeMs, i }));
    withMtime.sort((a, b) => {
        if (a.mtime !== b.mtime) return b.mtime - a.mtime;
        return a.i - b.i; // stable
    });
    const out: InboxRow[] = [];
    for (const { p } of withMtime.slice(0, limit)) {
        const meta = _readFrontmatter(p);
        out.push({
            id: path.basename(p, '.md'),
            role: meta['role'] ?? null,
            task: meta['task'] ?? null,
            session: meta['session'] ?? null,
            created_at: meta['created_at'] ?? null,
            path: p,
        });
    }
    return out;
}

function _readFrontmatter(p: string): Record<string, string> {
    const raw = fs.readFileSync(p, 'utf-8');
    if (!raw.startsWith('---')) {
        return {};
    }
    const end = raw.indexOf('\n---', 4);
    if (end === -1) {
        return {};
    }
    const out: Record<string, string> = {};
    for (const line of pySplitlines(raw.slice(3, end))) {
        if (line.trim() === '' || !line.includes(':')) {
            continue;
        }
        const idx = line.indexOf(':');
        const k = line.slice(0, idx);
        const v = line.slice(idx + 1);
        out[k.trim()] = v.trim();
    }
    return out;
}

/** Drop hand-off files older than the retention window (ephemerality). */
export function prune(opts?: { maxAgeHours?: number; root?: string | null }): number {
    const maxAgeHours = opts?.maxAgeHours ?? RETENTION_HOURS;
    const root = opts?.root ?? null;
    const base = root !== null ? root : WORKSPACE_HOME;
    if (!pathExists(base)) {
        return 0;
    }
    const cutoff = Date.now() / 1000 - maxAgeHours * 3600;
    let dropped = 0;
    let names: string[];
    try {
        names = fs.readdirSync(base);
    } catch {
        return 0;
    }
    for (const n of names) {
        if (!n.endsWith('.md')) continue;
        const p = path.join(base, n);
        let mtime: number;
        try {
            mtime = fs.statSync(p).mtimeMs / 1000;
        } catch {
            continue;
        }
        if (mtime < cutoff) {
            try {
                fs.unlinkSync(p);
                dropped += 1;
            } catch {
                /* ignore */
            }
        }
    }
    return dropped;
}

/**
 * Reject a --root that is not a `…/workspace/inbox` dir (traversal /
 * refactor footgun guard, mirrors the sessions store).
 */
function _validateCliRoot(raw: string): string {
    const p = path.resolve(raw);
    let resolved = p;
    try {
        resolved = fs.realpathSync(p);
    } catch {
        resolved = p;
    }
    if (path.basename(resolved) !== 'inbox' || path.basename(path.dirname(resolved)) !== 'workspace') {
        throw new SystemExitError(
            `workspace_inbox: --root must be a .../workspace/inbox dir, got ${pyRepr(raw)}`,
        );
    }
    return resolved;
}

/** Python `repr(str)` for the error message (`{raw!r}`). */
function pyRepr(s: string): string {
    // Python prefers single quotes unless the string has a single quote and no
    // double quote, in which case it uses double quotes.
    const hasSingle = s.includes("'");
    const hasDouble = s.includes('"');
    const quote = hasSingle && !hasDouble ? '"' : "'";
    let out = quote;
    for (const ch of s) {
        const code = ch.codePointAt(0) as number;
        if (ch === '\\') out += '\\\\';
        else if (ch === quote) out += '\\' + quote;
        else if (ch === '\n') out += '\\n';
        else if (ch === '\r') out += '\\r';
        else if (ch === '\t') out += '\\t';
        else if (code < 0x20 || code === 0x7f) out += '\\x' + code.toString(16).padStart(2, '0');
        else out += ch;
    }
    return out + quote;
}

interface ParsedArgs {
    cmd: string;
    role?: string;
    task?: string;
    body_file?: string;
    session?: string | null;
    skill_hint?: string | null;
    inbox_id?: string;
    limit: number;
    json: boolean;
    max_age_hours: number;
    root?: string | null;
}

const PROG = 'workspace_inbox';
const USAGE = `usage: ${PROG} [-h] {write,read,list,forget,prune} ...\n`;
const SUB_CHOICES = "'write', 'read', 'list', 'forget', 'prune'";

// argparse wraps each subcommand usage to the terminal width (80 in a pipe).
// Continuation lines are indented to align under the first option (29 spaces
// for `workspace_inbox write `/`prune `). Tests force COLUMNS=80 for the
// Python runs so these byte-match (the TS side reads no COLUMNS).
const _C = ' '.repeat(29); // continuation indent
const SUB_USAGE: Record<string, string> = {
    write:
        `usage: ${PROG} write [-h] --role ROLE --task TASK --body-file\n` +
        `${_C}BODY_FILE [--session SESSION]\n` +
        `${_C}[--skill-hint SKILL_HINT] [--root ROOT]\n`,
    read: `usage: ${PROG} read [-h] [--root ROOT] inbox_id\n`,
    list: `usage: ${PROG} list [-h] [--limit LIMIT] [--json] [--root ROOT]\n`,
    forget: `usage: ${PROG} forget [-h] [--root ROOT] inbox_id\n`,
    prune: `usage: ${PROG} prune [-h] [--max-age-hours MAX_AGE_HOURS]\n` + `${_C}[--root ROOT]\n`,
};

function _argError(usage: string, prog: string, msg: string): never {
    process.stderr.write(usage);
    process.stderr.write(`${prog}: error: ${msg}\n`);
    throw new ArgparseExit(2);
}

function _parse(argv: string[]): ParsedArgs {
    let i = 0;
    if (i < argv.length && (argv[i] === '-h' || argv[i] === '--help')) {
        process.stdout.write(USAGE);
        throw new ArgparseExit(0);
    }
    if (i >= argv.length) {
        _argError(USAGE, PROG, 'the following arguments are required: cmd');
    }
    const cmd = argv[i] as string;
    i += 1;
    if (!['write', 'read', 'list', 'forget', 'prune'].includes(cmd)) {
        _argError(USAGE, PROG, `argument cmd: invalid choice: '${cmd}' (choose from ${SUB_CHOICES})`);
    }
    const subUsage = SUB_USAGE[cmd] as string;
    const subProg = `${PROG} ${cmd}`;
    const out: ParsedArgs = {
        cmd,
        session: null,
        skill_hint: null,
        limit: 20,
        json: false,
        max_age_hours: RETENTION_HOURS,
        root: null,
    };
    const positionals: string[] = [];
    const unrecognized: string[] = [];

    // Per-subcommand value-flag tables (dest + argparse metavar for error text).
    const tables: Record<string, Record<string, { dest: keyof ParsedArgs; meta: string }>> = {
        write: {
            '--role': { dest: 'role', meta: '--role' },
            '--task': { dest: 'task', meta: '--task' },
            '--body-file': { dest: 'body_file', meta: '--body-file' },
            '--session': { dest: 'session', meta: '--session' },
            '--skill-hint': { dest: 'skill_hint', meta: '--skill-hint' },
            '--root': { dest: 'root', meta: '--root' },
        },
        read: { '--root': { dest: 'root', meta: '--root' } },
        list: {
            '--limit': { dest: 'limit', meta: '--limit' },
            '--root': { dest: 'root', meta: '--root' },
        },
        forget: { '--root': { dest: 'root', meta: '--root' } },
        prune: {
            '--max-age-hours': { dest: 'max_age_hours', meta: '--max-age-hours' },
            '--root': { dest: 'root', meta: '--root' },
        },
    };
    const storeTrue: Record<string, Record<string, keyof ParsedArgs>> = {
        list: { '--json': 'json' },
    };
    const intFlags = new Set(['--limit', '--max-age-hours']);
    const vf = tables[cmd] as Record<string, { dest: keyof ParsedArgs; meta: string }>;
    const st = (storeTrue[cmd] ?? {}) as Record<string, keyof ParsedArgs>;

    while (i < argv.length) {
        const a = argv[i] as string;
        if (a === '-h' || a === '--help') {
            process.stdout.write(subUsage);
            throw new ArgparseExit(0);
        }
        const eq = a.startsWith('--') ? a.indexOf('=') : -1;
        const flag = eq >= 0 ? a.slice(0, eq) : a;
        const inlineVal = eq >= 0 ? a.slice(eq + 1) : null;
        if (st[flag] !== undefined) {
            (out as unknown as Record<string, unknown>)[st[flag] as string] = true;
            i += 1;
            continue;
        }
        if (vf[flag] !== undefined) {
            let value: string;
            if (inlineVal !== null) {
                value = inlineVal;
            } else {
                if (i + 1 >= argv.length) {
                    _argError(subUsage, subProg, `argument ${vf[flag].meta}: expected one argument`);
                }
                value = argv[i + 1] as string;
                i += 1;
            }
            if (intFlags.has(flag)) {
                const n = pyInt(value);
                if (n === null) {
                    _argError(
                        subUsage,
                        subProg,
                        `argument ${vf[flag].meta}: invalid int value: '${value}'`,
                    );
                }
                (out as unknown as Record<string, unknown>)[vf[flag].dest as string] = n;
            } else {
                (out as unknown as Record<string, unknown>)[vf[flag].dest as string] = value;
            }
            i += 1;
            continue;
        }
        if (a.startsWith('-') && a !== '-') {
            unrecognized.push(a);
            i += 1;
            continue;
        }
        positionals.push(a);
        i += 1;
    }

    // Required-flag + positional validation, per subcommand (declaration order).
    if (cmd === 'write') {
        const missing: string[] = [];
        if (out.role === undefined) missing.push('--role');
        if (out.task === undefined) missing.push('--task');
        if (out.body_file === undefined) missing.push('--body-file');
        if (missing.length > 0) {
            _argError(subUsage, subProg, `the following arguments are required: ${missing.join(', ')}`);
        }
        const extra = [...positionals, ...unrecognized];
        if (extra.length > 0) {
            _argError(USAGE, PROG, `unrecognized arguments: ${extra.join(' ')}`);
        }
    } else if (cmd === 'read' || cmd === 'forget') {
        if (positionals.length < 1) {
            _argError(subUsage, subProg, 'the following arguments are required: inbox_id');
        }
        out.inbox_id = positionals[0] as string;
        const extra = [...positionals.slice(1), ...unrecognized];
        if (extra.length > 0) {
            _argError(USAGE, PROG, `unrecognized arguments: ${extra.join(' ')}`);
        }
    } else {
        // list / prune — no positionals.
        const extra = [...positionals, ...unrecognized];
        if (extra.length > 0) {
            _argError(USAGE, PROG, `unrecognized arguments: ${extra.join(' ')}`);
        }
    }
    return out;
}

/** Python `int(str)` semantics (base 10, leading/trailing ws + sign). null on fail. */
function pyInt(s: string): number | null {
    const t = s.trim();
    if (!/^[+-]?\d+$/.test(t)) return null;
    const n = Number.parseInt(t, 10);
    return Number.isNaN(n) ? null : n;
}

export function main(argv: string[]): number {
    const args = _parse(argv);
    const root = args.root ? _validateCliRoot(args.root) : null;
    if (args.cmd === 'write') {
        const body = fs.readFileSync(args.body_file as string, 'utf-8');
        print(
            jsonDumpsSorted(
                write(args.role as string, args.task as string, body, {
                    session: args.session ?? null,
                    skill_hint: args.skill_hint ?? null,
                    root,
                }),
            ),
        );
        return 0;
    }
    if (args.cmd === 'read') {
        const text = read(args.inbox_id as string, { root });
        if (text === null) {
            eprint(`workspace_inbox: no such hand-off ${args.inbox_id}`);
            return 1;
        }
        process.stdout.write(text);
        return 0;
    }
    if (args.cmd === 'list') {
        const rows = listInbox({ limit: args.limit, root });
        if (args.json) {
            print(jsonDumpsSorted(rows));
        } else {
            for (const row of rows) {
                print(jsonDumpsSorted(row));
            }
        }
        return 0;
    }
    if (args.cmd === 'forget') {
        return forget(args.inbox_id as string, { root }) ? 0 : 1;
    }
    if (args.cmd === 'prune') {
        print(jsonDumpsSorted({ pruned: prune({ maxAgeHours: args.max_age_hours, root }) }));
        return 0;
    }
    return 2;
}

// --- CLI entry ---

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    try {
        process.exitCode = main(process.argv.slice(2));
    } catch (e) {
        if (e instanceof ArgparseExit) {
            process.exitCode = e.code;
        } else if (e instanceof SystemExitError) {
            process.stderr.write(e.detail + '\n');
            process.exitCode = 1;
        } else {
            throw e;
        }
    }
}

export { ArgparseExit, SystemExitError, jsonDumpsSorted };
