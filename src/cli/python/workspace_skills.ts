#!/usr/bin/env tsx
/**
 * Skill-body resolution for host hand-off pre-rendering — ADR-066
 * (TypeScript twin).
 *
 * TypeScript twin of `src/cli/python/workspace_skills.py` (ADR-200, py2ts
 * migration). Byte-for-byte parity with the Python original — same skill-id
 * validation, same `SKILL_SOURCES` precedence, same frontmatter peel, same
 * 64 KiB UTF-8 body cap + truncation note, same section / JSON output. No
 * behaviour changes — latent quirks are replicated, not fixed.
 *
 * A role prompt carries a single `skill_hint` (e.g. `doc-coauthoring`). Hosts
 * without skill resolution (Codex / Gemini Tier-1, and every Tier-3 host) can't
 * follow that dangling reference, so the workspace **pre-renders** the skill
 * context into the hand-off prompt. This module owns skill → prompt-section
 * rendering; the inbox store calls it.
 *
 * v0 (AI-council 2026-06-08): include the skill **body + a one-line header**
 * (name + description from frontmatter) under a `## Skill context: <name>`
 * section. Trust: `skill_hint` is package-controlled, but harden anyway —
 * charset-validate (no path traversal) + resolve strictly under a skills root;
 * a missing / malformed skill degrades to a one-line note, never a crash; the
 * body is size-capped. No transitive resolution (a skill body is included
 * verbatim; it never pulls other skills) → no cycles.
 *
 * CLI:
 *
 *     workspace_skills.ts resolve <skill-hint> [--format section|json]
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

// This module lives at <repo>/src/cli/python/workspace_skills.ts → the repo
// root is parents[3] (three dirs up: python → cli → src → repo).
const ROOT = path.resolve(path.dirname(_HERE), '..', '..', '..');
// Mirror lint_role_experiences SKILL_SOURCES: source tree first, condensed
// projection second. Only the existing root(s) are consulted.
const SKILL_SOURCES = [
    path.join(ROOT, '.agent-src.uncondensed', 'skills'),
    path.join(ROOT, 'dist', 'agent-src', 'skills'),
];
const SKILL_ID_RE = /^[a-z0-9][a-z0-9-]*$/;
const MAX_BODY_BYTES = 64 * 1024;

// --- JSON byte-parity (compact, ensure_ascii=True, sort_keys=True) ----------

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

function _jsonScalarSorted(value: unknown): string | null {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'number') return String(value);
    if (typeof value === 'string') return _jsonStrAscii(value);
    return null;
}

function _dumpSorted(value: unknown): string {
    const scalar = _jsonScalarSorted(value);
    if (scalar !== null) return scalar;
    if (Array.isArray(value)) {
        return '[' + value.map((v) => _dumpSorted(v)).join(', ') + ']';
    }
    if (typeof value === 'object' && value !== null) {
        const obj = value as Record<string, unknown>;
        const keys = Object.keys(obj).sort();
        return (
            '{' +
            keys.map((k) => `${_jsonStrAscii(k)}: ${_dumpSorted(obj[k])}`).join(', ') +
            '}'
        );
    }
    return _jsonStrAscii(String(value));
}

/** `json.dumps(value, sort_keys=True)` (compact, ensure_ascii=True). */
function jsonDumpsSorted(value: unknown): string {
    return _dumpSorted(value);
}

function print(line = ''): void {
    process.stdout.write(line + '\n');
}

function isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

/** `Path.resolve()` — absolute, symlink-resolved where possible. */
function realResolve(p: string): string {
    try {
        return fs.realpathSync(path.resolve(p));
    } catch {
        return path.resolve(p);
    }
}

// ---------------------------------------------------------------------------
// Module body (workspace_skills.py).
// ---------------------------------------------------------------------------

/**
 * `str.splitlines()` — split on Python's universal-newline set. We only ever
 * feed `\n`/`\r\n`/`\r`-delimited text here; replicate the set so a `\r`-only
 * file behaves identically. No trailing empty element for a final newline.
 */
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
            if (ch === '\r' && text[i + 1] === '\n') i += 1; // \r\n is one boundary
        } else {
            cur += ch;
        }
    }
    if (cur !== '') out.push(cur);
    return out;
}

/** Python `str.strip(chars)` — strip any of `chars` from both ends. */
function pyStripChars(s: string, chars: string): string {
    let start = 0;
    let end = s.length;
    while (start < end && chars.includes(s[start] as string)) start += 1;
    while (end > start && chars.includes(s[end - 1] as string)) end -= 1;
    return s.slice(start, end);
}

/** Python `str.lstrip(chars)` for a single repeated char set. */
function pyLstripChars(s: string, chars: string): string {
    let start = 0;
    while (start < s.length && chars.includes(s[start] as string)) start += 1;
    return s.slice(start);
}

function stripFrontmatter(text: string): [Record<string, string>, string] {
    if (!text.startsWith('---')) {
        return [{}, text];
    }
    const end = text.indexOf('\n---', 3);
    if (end === -1) {
        return [{}, text];
    }
    const fm: Record<string, string> = {};
    for (const line of pySplitlines(text.slice(3, end))) {
        if (line.trim() === '' || !line.includes(':')) {
            continue;
        }
        // Python str.partition(":") → split on the FIRST ":".
        const idx = line.indexOf(':');
        const k = line.slice(0, idx);
        const v = line.slice(idx + 1);
        fm[k.trim()] = pyStripChars(v.trim(), "'\"");
    }
    const body = pyLstripChars(text.slice(end + 4), '\n');
    return [fm, body];
}

function findSkillMd(skillHint: string): string | null {
    for (const src of SKILL_SOURCES) {
        const cand = path.join(src, skillHint, 'SKILL.md');
        // Defense in depth: the resolved path must stay under the root even if
        // the charset check is ever loosened.
        try {
            const candResolved = realResolve(cand);
            const srcResolved = realResolve(src);
            // Path.relative_to raises if not a subpath. Mirror with a prefix
            // check that demands a path-component boundary.
            const rel = path.relative(srcResolved, candResolved);
            if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) {
                continue;
            }
        } catch {
            continue;
        }
        if (isFile(cand)) {
            return cand;
        }
    }
    return null;
}

/**
 * Resolve a skill_hint → `{found, name, description, body, note}`.
 *
 * Never raises on a bad / missing id — returns `found=false` with a
 * human-readable `note` the caller can surface inline.
 */
export function resolve(skillHint: string): Record<string, unknown> {
    if (!SKILL_ID_RE.test(skillHint || '')) {
        return { found: false, note: `skill \`${skillHint}\` is not a valid id` };
    }
    const md = findSkillMd(skillHint);
    if (md === null) {
        return {
            found: false,
            note: `skill \`${skillHint}\` not found — proceed without it`,
        };
    }
    let text: string;
    try {
        text = fs.readFileSync(md, 'utf-8');
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { found: false, note: `skill \`${skillHint}\` unreadable (${msg})` };
    }
    const [fm, bodyRaw] = stripFrontmatter(text);
    let body = bodyRaw;
    const bytes = Buffer.from(body, 'utf-8');
    if (bytes.length > MAX_BODY_BYTES) {
        // `.decode("utf-8", "ignore")` drops any partial trailing code unit.
        body =
            bytes.subarray(0, MAX_BODY_BYTES).toString('utf-8').replace(/�+$/, '') +
            '\n\n… (skill body truncated)';
    }
    return {
        found: true,
        name: fm['name'] ?? skillHint,
        description: fm['description'] ?? '',
        body,
    };
}

/**
 * Render a skill_hint as a hand-off prompt section (body + one-line header).
 *
 * A missing / invalid skill yields a single-line note section so the host
 * sees *why* the skill context is absent rather than a silent gap.
 */
export function resolveSection(skillHint: string): string {
    const r = resolve(skillHint);
    if (!r['found']) {
        return `\n\n## Skill context\n\n> ${r['note']}.\n`;
    }
    const header = `## Skill context: ${r['name']}`;
    const desc = r['description'] ? `\n_${r['description']}_\n` : '\n';
    return `\n\n${header}\n${desc}\n${r['body']}\n`;
}

interface ParsedArgs {
    cmd: string;
    skill_hint?: string;
    format: string;
}

const PROG = 'workspace_skills';

const USAGE = `usage: ${PROG} [-h] {resolve} ...\n`;
const USAGE_RESOLVE = `usage: ${PROG} resolve [-h] [--format {section,json}] skill_hint\n`;

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
    if (cmd !== 'resolve') {
        _argError(
            USAGE,
            PROG,
            `argument cmd: invalid choice: '${cmd}' (choose from 'resolve')`,
        );
    }
    const subProg = `${PROG} resolve`;
    const out: ParsedArgs = { cmd, format: 'section' };
    const positionals: string[] = [];
    const unrecognized: string[] = [];
    while (i < argv.length) {
        const a = argv[i] as string;
        if (a === '-h' || a === '--help') {
            process.stdout.write(USAGE_RESOLVE);
            throw new ArgparseExit(0);
        }
        const eq = a.startsWith('--') ? a.indexOf('=') : -1;
        const flag = eq >= 0 ? a.slice(0, eq) : a;
        const inlineVal = eq >= 0 ? a.slice(eq + 1) : null;
        if (flag === '--format') {
            let value: string;
            if (inlineVal !== null) {
                value = inlineVal;
            } else {
                if (i + 1 >= argv.length) {
                    _argError(USAGE_RESOLVE, subProg, 'argument --format: expected one argument');
                }
                value = argv[i + 1] as string;
                i += 1;
            }
            if (value !== 'section' && value !== 'json') {
                _argError(
                    USAGE_RESOLVE,
                    subProg,
                    `argument --format: invalid choice: '${value}' (choose from 'section', 'json')`,
                );
            }
            out.format = value;
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
    if (positionals.length < 1) {
        _argError(USAGE_RESOLVE, subProg, 'the following arguments are required: skill_hint');
    }
    out.skill_hint = positionals[0] as string;
    const extra = [...positionals.slice(1), ...unrecognized];
    if (extra.length > 0) {
        _argError(USAGE, PROG, `unrecognized arguments: ${extra.join(' ')}`);
    }
    return out;
}

export function main(argv: string[]): number {
    const args = _parse(argv);
    if (args.cmd === 'resolve') {
        if (args.format === 'json') {
            print(jsonDumpsSorted(resolve(args.skill_hint as string)));
        } else {
            process.stdout.write(resolveSection(args.skill_hint as string));
        }
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

export { ArgparseExit, jsonDumpsSorted, resolve as resolveSkill, resolveSection as renderSection };
