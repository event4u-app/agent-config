#!/usr/bin/env tsx
/**
 * Role + task discovery for the workspace launcher — Phase 4 (TypeScript twin).
 *
 * TypeScript twin of `src/cli/python/workspace_roles.py` (ADR-200, py2ts
 * migration). Byte-for-byte CLI parity with the Python original — same
 * frontmatter / first-task / skills-yml hand-rolled parsers, same
 * `dataclasses.asdict` field order + defaults, same `json.dumps(..., sort_keys=
 * True[, indent=2])` output, same `.title()` slug fallback. No behaviour
 * changes — latent quirks are replicated, not fixed.
 *
 * Reads `agents/roles/<role>/index.md` (frontmatter + first-task list) and
 * `agents/roles/<role>/skills.yml` to populate the launcher pane.
 *
 * CLI:
 *
 *     workspace_roles.ts list                          # list role slugs
 *     workspace_roles.ts tasks <role>                  # list role's tasks
 *     workspace_roles.ts show <role>                   # full role payload
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);

/** argparse usage-error / help exit (code 2 / 0). Caught at the CLI entry. */
class ArgparseExit extends Error {
    constructor(public readonly code: number) {
        super(`argparse-exit-${code}`);
    }
}

const DEFAULT_ROOT = path.join('agents', 'roles');

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

/** Compact `json.dumps(value, sort_keys=True)`. */
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

/** `json.dumps(value, sort_keys=True, indent=2)` (ensure_ascii=True). */
function _dumpSortedIndent(value: unknown, depth: number): string {
    const scalar = _jsonScalar(value);
    if (scalar !== null) return scalar;
    const pad = ' '.repeat(2 * (depth + 1));
    const closePad = ' '.repeat(2 * depth);
    if (Array.isArray(value)) {
        if (value.length === 0) return '[]';
        const items = value.map((v) => pad + _dumpSortedIndent(v, depth + 1));
        return `[\n${items.join(',\n')}\n${closePad}]`;
    }
    if (typeof value === 'object' && value !== null) {
        const obj = value as Record<string, unknown>;
        const keys = Object.keys(obj).sort();
        if (keys.length === 0) return '{}';
        const items = keys.map(
            (k) => `${pad}${_jsonStrAscii(k)}: ${_dumpSortedIndent(obj[k], depth + 1)}`,
        );
        return `{\n${items.join(',\n')}\n${closePad}}`;
    }
    return _jsonStrAscii(String(value));
}

function jsonDumpsSortedIndent2(value: unknown): string {
    return _dumpSortedIndent(value, 0);
}

function print(line = ''): void {
    process.stdout.write(line + '\n');
}

function eprint(line = ''): void {
    process.stderr.write(line + '\n');
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

/** `str.strip(chars)` — strip any of `chars` from both ends. */
function pyStripChars(s: string, chars: string): string {
    let start = 0;
    let end = s.length;
    while (start < end && chars.includes(s[start] as string)) start += 1;
    while (end > start && chars.includes(s[end - 1] as string)) end -= 1;
    return s.slice(start, end);
}

/** `str.rstrip()` — strip trailing ASCII+unicode whitespace. */
function pyRstrip(s: string): string {
    return s.replace(/[\s]+$/u, '');
}

/** `str.title()` — capitalize first letter of each run of alphabetic chars. */
function pyTitle(s: string): string {
    return s.replace(/[A-Za-z]+/g, (w) => (w[0] as string).toUpperCase() + w.slice(1).toLowerCase());
}

/** Python `s[:n]` — code-point slice (not UTF-16 code-unit). */
function pyHead(s: string, n: number): string {
    return Array.from(s).slice(0, n).join('');
}

// ---------------------------------------------------------------------------
// Module body (workspace_roles.py).
// ---------------------------------------------------------------------------

interface RoleTask {
    slug: string;
    title: string;
    prompt_path: string | null;
    output_shape: string;
    document_type: string | null;
}

function makeRoleTask(slug: string, title: string): RoleTask {
    return { slug, title, prompt_path: null, output_shape: 'chat', document_type: null };
}

interface Role {
    slug: string;
    title: string;
    identity: string;
    tasks: RoleTask[];
    skills: string[];
    explain_default: string;
}

/** Tiny stdlib YAML-frontmatter parser for the keys this module needs. */
function _parseFrontmatter(text: string): [Record<string, string>, string] {
    if (!text.startsWith('---')) {
        return [{}, text];
    }
    const end = text.indexOf('\n---', 4);
    if (end === -1) {
        return [{}, text];
    }
    const block = text.slice(3, end).trim();
    const body = pyLstripNewlines(text.slice(end + 4));
    const meta: Record<string, string> = {};
    for (const raw of pySplitlines(block)) {
        const line = pyRstrip(raw);
        if (!line || pyLstripWs(line).startsWith('#') || !line.includes(':')) {
            continue;
        }
        if (line.startsWith(' ')) {
            continue;
        }
        const idx = line.indexOf(':');
        const k = line.slice(0, idx);
        const v = line.slice(idx + 1);
        meta[k.trim()] = pyStripChars(v.trim(), "'\"");
    }
    return [meta, body];
}

/** `str.lstrip("\n")`. */
function pyLstripNewlines(s: string): string {
    let i = 0;
    while (i < s.length && s[i] === '\n') i += 1;
    return s.slice(i);
}

/** `str.lstrip()` — strip leading whitespace. */
function pyLstripWs(s: string): string {
    return s.replace(/^[\s]+/u, '');
}

/** Find a `## First tasks` (or `## Tasks`) bullet list. */
function _firstTasksFromBody(body: string): RoleTask[] {
    const lines = pySplitlines(body);
    let inTasks = false;
    const out: RoleTask[] = [];
    for (const raw of lines) {
        const line = pyRstrip(raw);
        const s = line.toLowerCase();
        if (s.startsWith('## ')) {
            inTasks = s.includes('first task') || s === '## tasks';
            continue;
        }
        if (!inTasks) {
            continue;
        }
        if (line.startsWith('- ') || line.startsWith('* ')) {
            const entry = line.slice(2).trim();
            // entry.split(" — ")[0].split(":")[0].strip().lower().replace(" ","-")
            const slug = (entry.split(' — ')[0] as string)
                .split(':')[0]!
                .trim()
                .toLowerCase()
                .split(' ')
                .join('-');
            const title = entry.includes(' — ') ? entry.split(' — ').slice(1).join(' — ') : entry;
            out.push(makeRoleTask(slug, title));
        }
    }
    return out;
}

/** Read top-level `skills:` list (stdlib-only YAML peek). */
function _parseSkillsYml(text: string): string[] {
    const skills: string[] = [];
    let inBlock = false;
    for (const raw of pySplitlines(text)) {
        const line = pyRstrip(raw);
        if (!line || pyLstripWs(line).startsWith('#')) {
            continue;
        }
        if (line.startsWith('skills:')) {
            inBlock = true;
            continue;
        }
        if (inBlock) {
            if (line.startsWith('  - ') || line.startsWith('- ')) {
                // line.split("-",1)[1].strip().strip("'\"")
                const idx = line.indexOf('-');
                const item = pyStripChars(line.slice(idx + 1).trim(), "'\"");
                skills.push(item);
            } else if (!line.startsWith(' ')) {
                break;
            }
        }
    }
    return skills;
}

function pathExists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

export function loadRole(slug: string, opts?: { root?: string | null }): Role | null {
    const root = opts?.root ?? null;
    const base = path.join(root !== null ? root : DEFAULT_ROOT, slug);
    const idx = path.join(base, 'index.md');
    if (!pathExists(idx)) {
        return null;
    }
    const [meta, body] = _parseFrontmatter(fs.readFileSync(idx, 'utf-8'));
    const skillsPath = path.join(base, 'skills.yml');
    const skills = pathExists(skillsPath)
        ? _parseSkillsYml(fs.readFileSync(skillsPath, 'utf-8'))
        : [];
    return {
        slug,
        title: meta['title'] || pyTitle(slug.split('-').join(' ')),
        identity: pyHead((body.split('\n\n')[0] as string).trim(), 400),
        tasks: _firstTasksFromBody(body),
        skills,
        explain_default: meta['explain_default'] ?? 'plain',
    };
}

export function listRoles(opts?: { root?: string | null }): string[] {
    const root = opts?.root ?? null;
    const base = root !== null ? root : DEFAULT_ROOT;
    if (!pathExists(base)) {
        return [];
    }
    let names: string[];
    try {
        names = fs.readdirSync(base);
    } catch {
        return [];
    }
    const out: string[] = [];
    for (const name of names) {
        const p = path.join(base, name);
        let isDir = false;
        try {
            isDir = fs.statSync(p).isDirectory();
        } catch {
            isDir = false;
        }
        if (isDir && pathExists(path.join(p, 'index.md'))) {
            out.push(name);
        }
    }
    return out.sort();
}

export function listTasks(role: string, opts?: { root?: string | null }): RoleTask[] {
    const r = loadRole(role, opts);
    return r ? r.tasks : [];
}

function _roleToJson(r: Role): Record<string, unknown> {
    return {
        slug: r.slug,
        title: r.title,
        identity: r.identity,
        explain_default: r.explain_default,
        tasks: r.tasks.map((t) => _taskToDict(t)),
        skills: r.skills,
    };
}

/** `dataclasses.asdict(RoleTask)` — field declaration order. */
function _taskToDict(t: RoleTask): Record<string, unknown> {
    return {
        slug: t.slug,
        title: t.title,
        prompt_path: t.prompt_path,
        output_shape: t.output_shape,
        document_type: t.document_type,
    };
}

interface ParsedArgs {
    cmd: string;
    role?: string;
}

const PROG = 'workspace_roles';
const USAGE = `usage: ${PROG} [-h] {list,tasks,show} ...\n`;
const USAGE_LIST = `usage: ${PROG} list [-h]\n`;
const USAGE_TASKS = `usage: ${PROG} tasks [-h] role\n`;
const USAGE_SHOW = `usage: ${PROG} show [-h] role\n`;

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
    if (cmd !== 'list' && cmd !== 'tasks' && cmd !== 'show') {
        _argError(
            USAGE,
            PROG,
            `argument cmd: invalid choice: '${cmd}' (choose from 'list', 'tasks', 'show')`,
        );
    }
    const subUsage = cmd === 'list' ? USAGE_LIST : cmd === 'tasks' ? USAGE_TASKS : USAGE_SHOW;
    const subProg = `${PROG} ${cmd}`;
    const out: ParsedArgs = { cmd };
    const positionals: string[] = [];
    const unrecognized: string[] = [];
    while (i < argv.length) {
        const a = argv[i] as string;
        if (a === '-h' || a === '--help') {
            process.stdout.write(subUsage);
            throw new ArgparseExit(0);
        }
        if (a.startsWith('-') && a !== '-') {
            unrecognized.push(a);
            i += 1;
            continue;
        }
        positionals.push(a);
        i += 1;
    }
    if (cmd === 'list') {
        const extra = [...positionals, ...unrecognized];
        if (extra.length > 0) {
            _argError(USAGE, PROG, `unrecognized arguments: ${extra.join(' ')}`);
        }
    } else {
        if (positionals.length < 1) {
            _argError(subUsage, subProg, 'the following arguments are required: role');
        }
        out.role = positionals[0] as string;
        const extra = [...positionals.slice(1), ...unrecognized];
        if (extra.length > 0) {
            _argError(USAGE, PROG, `unrecognized arguments: ${extra.join(' ')}`);
        }
    }
    return out;
}

export function main(argv: string[]): number {
    const args = _parse(argv);
    if (args.cmd === 'list') {
        for (const slug of listRoles()) {
            print(slug);
        }
        return 0;
    }
    if (args.cmd === 'tasks') {
        for (const t of listTasks(args.role as string)) {
            print(jsonDumpsSorted(_taskToDict(t)));
        }
        return 0;
    }
    if (args.cmd === 'show') {
        const r = loadRole(args.role as string);
        if (!r) {
            eprint(`unknown role: ${args.role}`);
            return 1;
        }
        print(jsonDumpsSortedIndent2(_roleToJson(r)));
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
        } else {
            throw e;
        }
    }
}

export { ArgparseExit, jsonDumpsSorted, jsonDumpsSortedIndent2 };
