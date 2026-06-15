#!/usr/bin/env tsx
/**
 * Generate the role-experience catalog (road-to-competitive-borrow P1.0).
 *
 * TypeScript twin of `src/scripts/generate_role_experiences_catalog.py`
 * (ADR-096). Mirrors the Python CLI contract EXACTLY — the `--check` /
 * `--quiet` flags, exit codes (0 / 1 / 2), stdout/stderr split, and the
 * byte-identical generated `docs/role-experiences.md` (heading prose, the
 * `| Role | Tagline | Status |` table, the `sorted(glob)` ordering over the
 * and the trailing newline). No behaviour changes — latent Python quirks
 * (regex frontmatter parse, sequential `.strip('"').strip("'")`, the
 * pathlib-component-wise glob sort) are replicated.
 *
 * Renders `docs/role-experiences.md` — a one-screen catalog of the role
 * experiences with their **existing** taglines, sourced from
 * `agents/roles/<role>/index.md` frontmatter (the same taglines
 * `lint_role_experiences.py` validates and the GUI WorkspacePage renders).
 *
 * This surfaces the role taglines in a docs/catalog page without adding a
 * per-skill `tagline` field (the road-to-competitive-borrow Phase 3 drop:
 * 227 hand-written strings + a locked schema change). It links to each role
 * experience, never duplicates its body — per docs/contracts/role-experience.md.
 *
 * Output (deterministic — no timestamp, so `--check` is stable):
 *   - `docs/role-experiences.md`
 *
 * Usage:
 *     python3 scripts/generate_role_experiences_catalog.py
 *     python3 scripts/generate_role_experiences_catalog.py --check
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);

// src/scripts/generate_role_experiences_catalog.ts → parents[2] is repo root.
const ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const ROLES_DIR = path.join(ROOT, 'agents', 'roles');
const OUT = path.join(ROOT, 'docs', 'role-experiences.md');

interface RoleRow {
    slug: string;
    role: string;
    display_name: string;
    tagline: string;
    status: string;
    rel: string;
}

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

function _isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

/** Mirror Python `str.strip(ch)` — strip a single literal char from both ends. */
function _stripChar(s: string, ch: string): string {
    let start = 0;
    let end = s.length;
    while (start < end && s[start] === ch) {
        start += 1;
    }
    while (end > start && s[end - 1] === ch) {
        end -= 1;
    }
    return s.slice(start, end);
}

/** Compare two absolute paths the way pathlib compares `Path`: component-wise. */
function _pathPartsCompare(a: string, b: string): number {
    const pa = a.split(path.sep);
    const pb = b.split(path.sep);
    const n = Math.min(pa.length, pb.length);
    for (let i = 0; i < n; i += 1) {
        const x = pa[i] as string;
        const y = pb[i] as string;
        if (x < y) return -1;
        if (x > y) return 1;
    }
    return pa.length - pb.length;
}

// Python: _FM_RE = re.compile(r"^---\s*\n(.*?)\n---", re.DOTALL); used with .match()
// (anchored at start of string). JS `s` flag = DOTALL; `^` is start (no `m`).
const _FM_RE = /^---[ \t\n\r\f\v]*\n([\s\S]*?)\n---/;

/**
 * Mirror `_fm_scalar`: re.search(rf"^{re.escape(key)}:\s*(.+)$", fm, re.MULTILINE),
 * then `.group(1).strip().strip('"').strip("'")`. Empty string when absent.
 */
function _fm_scalar(fm: string, key: string): string {
    // Python `\s` = [ \t\n\r\f\v]; mirror it exactly (newline-eating greedy).
    const re = new RegExp(`^${_reEscape(key)}:[ \\t\\n\\r\\f\\v]*(.+)$`, 'm');
    const m = re.exec(fm);
    if (!m) {
        return '';
    }
    return _stripChar(_stripChar((m[1] as string).trim(), '"'), "'");
}

/** Mirror Python `re.escape` for the characters that appear in frontmatter keys. */
function _reEscape(s: string): string {
    return s.replace(/[\\^$.*+?()[\]{}|/\-#&~]/g, '\\$&');
}

function _glob_role_indexes(): string[] {
    // sorted(ROLES_DIR.glob("*/index.md")) — direct child dirs, each `<dir>/index.md`.
    if (!_isDir(ROLES_DIR)) {
        return [];
    }
    const out: string[] = [];
    for (const name of fs.readdirSync(ROLES_DIR)) {
        const cand = path.join(ROLES_DIR, name, 'index.md');
        if (_isFile(cand)) {
            out.push(cand);
        }
    }
    out.sort(_pathPartsCompare);
    return out;
}

export function load_roles(): RoleRow[] {
    const roles: RoleRow[] = [];
    for (const index of _glob_role_indexes()) {
        // Python: read_text(encoding="utf-8", errors="replace").
        const text = fs.readFileSync(index, 'utf-8');
        const m = _FM_RE.exec(text);
        if (!m) {
            continue;
        }
        const fm = m[1] as string;
        const parentName = path.basename(path.dirname(index));
        roles.push({
            slug: parentName,
            role: _fm_scalar(fm, 'role') || parentName,
            display_name: _fm_scalar(fm, 'display_name'),
            tagline: _fm_scalar(fm, 'tagline'),
            status: _fm_scalar(fm, 'status'),
            rel: `../agents/roles/${parentName}/index.md`,
        });
    }
    return roles;
}

export function render(): string {
    const roles = load_roles();
    const lines: string[] = [
        '# Role experiences — taglines at a glance',
        '',
        '> **Generated** by `scripts/generate_role_experiences_catalog.py` from',
        '> `agents/roles/<role>/index.md` — do NOT hand-edit. Taglines are the',
        '> existing role-level strings (validated by `lint_role_experiences.py`,',
        '> rendered in the GUI workspace); this page surfaces them in a catalog.',
        '',
        'Each row links to the full role experience (persona · three first tasks ·',
        'packs). The catalog never duplicates the body — see',
        '[`docs/contracts/role-experience.md`](contracts/role-experience.md).',
        '',
        '| Role | Tagline | Status |',
        '|---|---|---|',
    ];
    for (const r of roles) {
        const name = r.display_name || r.role;
        lines.push(`| [${name}](${r.rel}) | ${r.tagline} | \`${r.status}\` |`);
    }
    lines.push('');
    return lines.join('\n').replace(/\s+$/, '') + '\n';
}

interface ParsedArgs {
    check: boolean;
    quiet: boolean;
}

/** argparse error → usage to stderr, `<prog>: error: <msg>`, exit code 2. */
function _argError(msg: string): never {
    process.stderr.write(
        'usage: generate_role_experiences_catalog.py [-h] [--check] [--quiet]\n',
    );
    process.stderr.write(`generate_role_experiences_catalog.py: error: ${msg}\n`);
    process.exitCode = 2;
    throw new _ArgExit();
}

class _ArgExit extends Error {}

function parse_args(argv: string[]): ParsedArgs {
    const out: ParsedArgs = { check: false, quiet: false };
    for (const a of argv) {
        if (a === '-h' || a === '--help') {
            process.stdout.write(
                'usage: generate_role_experiences_catalog.py [-h] [--check] [--quiet]\n',
            );
            process.exitCode = 0;
            throw new _ArgExit();
        } else if (a === '--check') {
            out.check = true;
        } else if (a === '--quiet') {
            out.quiet = true;
        } else {
            _argError(`unrecognized arguments: ${a}`);
        }
    }
    return out;
}

export function main(argv: string[] | null = null): number {
    let args: ParsedArgs;
    try {
        args = parse_args(argv ?? process.argv.slice(2));
    } catch (e) {
        if (e instanceof _ArgExit) {
            return process.exitCode === undefined ? 0 : (process.exitCode as number);
        }
        throw e;
    }

    const content = render();
    if (args.check) {
        const current = _isFile(OUT) ? fs.readFileSync(OUT, 'utf-8') : '';
        if (current !== content) {
            process.stderr.write(
                'generate_role_experiences_catalog: docs/role-experiences.md is ' +
                    'stale — run `python3 scripts/generate_role_experiences_catalog.py`\n',
            );
            return 1;
        }
        if (!args.quiet) {
            process.stdout.write(
                'generate_role_experiences_catalog: OK — up to date\n',
            );
        }
        return 0;
    }

    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, content, 'utf-8');
    if (!args.quiet) {
        const rel = path.relative(ROOT, OUT).split(path.sep).join('/');
        process.stdout.write(
            `generate_role_experiences_catalog: wrote ${rel} ` +
                `(${load_roles().length} roles)\n`,
        );
    }
    return 0;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exitCode = main();
}
