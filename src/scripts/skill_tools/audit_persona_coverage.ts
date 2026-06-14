#!/usr/bin/env node
/**
 * Block D · D3 — audit_persona_coverage.
 *
 * TypeScript twin of `src/scripts/skill_tools/audit_persona_coverage.py`
 * (ADR-096, Phase 8 Wave 8h). Mirrors the Python CLI contract EXACTLY —
 * flags (`--skills-dir`, `--personas-dir`, `--json`), exit code (0 always),
 * stdout split, byte-identical human table AND byte-identical JSON
 * (`json.dump(..., indent=2)`, ensure_ascii default).
 *
 * Build a citation matrix of personas across the SKILL.md corpus and flag
 * under-cited personas using **tier-aware thresholds** (council iter-1
 * D-OQ4 verdict):
 *
 *   - **specialist** persona < 3 citations  → under-cited
 *   - **core**       persona < 5 citations  → under-cited
 *
 * Inputs:
 *   --skills-dir DIR   — directory holding SKILL.md files
 *   --personas-dir DIR — directory holding persona Markdown files
 *   --json             — machine-readable output
 *
 * Output: per-persona citation count + tier + status (ok / under-cited / orphan).
 * Exit code: 0 always (this is an advisory tool, not a CI gate).
 *
 * No behaviour changes — latent Python quirks replicated.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
// src/scripts/skill_tools/audit_persona_coverage.ts → parents[3] of the .py
// (skill_tools → scripts → src → repo root) is the package root.
export const ROOT = path.resolve(path.dirname(_HERE), '..', '..', '..');
export const DEFAULT_SKILLS = path.join(ROOT, '.agent-src.uncondensed', 'skills');
export const DEFAULT_PERSONAS = path.join(ROOT, '.agent-src.uncondensed', 'personas');
export const THRESHOLDS: Readonly<Record<string, number>> = { core: 5, specialist: 3 };

/** Mirror Python len(str) — count Unicode code points. */
function pyLen(s: string): number {
    let n = 0;
    for (const _ of s) {
        n++;
    }
    return n;
}

function _read_block(filePath: string): string {
    const text = fs.readFileSync(filePath, 'utf-8');
    if (!text.startsWith('---')) {
        return '';
    }
    const end = text.indexOf('\n---', 3);
    return end !== -1 ? text.slice(3, end) : '';
}

export function _frontmatter_value(block: string, key: string): string | null {
    // re.search(rf"^{re.escape(key)}\s*:\s*(.+)$", block, re.MULTILINE)
    const re = new RegExp(`^${_reEscape(key)}[\\s]*:[\\s]*(.+)$`, 'mu');
    const m = re.exec(block);
    if (!m) {
        return null;
    }
    let val = (m[1] as string).trim();
    if (val.startsWith('"') && val.endsWith('"')) {
        val = val.slice(1, -1);
    }
    return val;
}

export function _frontmatter_list(block: string, key: string): string[] {
    // re.search(rf"^{re.escape(key)}\s*:\s*$", block, re.MULTILINE)
    const re = new RegExp(`^${_reEscape(key)}[\\s]*:[\\s]*$`, 'mu');
    const m = re.exec(block);
    if (!m) {
        return [];
    }
    const items: string[] = [];
    // for line in block[m.end():].splitlines():
    const tail = block.slice(m.index + m[0].length);
    for (const line of _splitlines(tail)) {
        if (line.startsWith('  - ')) {
            items.push(line.slice(4).trim());
        } else if (line && !line.startsWith(' ')) {
            break;
        }
    }
    return items;
}

/** Mirror Python str.splitlines() for the newline shapes frontmatter uses. */
function _splitlines(s: string): string[] {
    if (s === '') {
        return [];
    }
    return s.split(/\r\n|\r|\n/u);
}

/** Mirror Python re.escape for the small ASCII keys these tools use. */
function _reEscape(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

export function _load_personas(personasDir: string): Map<string, string> {
    // slug → tier (core | specialist | unknown). Insertion order matters for
    // the sorted() in audit(); a Map preserves it, and audit() re-sorts anyway.
    const personas = new Map<string, string>();
    if (!_isDir(personasDir)) {
        return personas;
    }
    for (const md of _globMd(personasDir)) {
        if (path.basename(md).toLowerCase() === 'readme.md') {
            continue;
        }
        const block = _read_block(md);
        const slug = _frontmatter_value(block, 'id') ?? _stem(md);
        const tier = _frontmatter_value(block, 'tier') ?? 'unknown';
        personas.set(slug, tier);
    }
    return personas;
}

export function _count_citations(skillsDir: string): Map<string, number> {
    // counts[slug] += 1 — `skills_dir.glob("*/SKILL.md")` is UNSORTED in
    // Python; counting is order-independent so the resulting totals match.
    const counts = new Map<string, number>();
    if (!_isDir(skillsDir)) {
        return counts;
    }
    for (const skillMd of _globSkillMdUnsorted(skillsDir)) {
        const block = _read_block(skillMd);
        for (const slug of _frontmatter_list(block, 'personas')) {
            counts.set(slug, (counts.get(slug) ?? 0) + 1);
        }
    }
    return counts;
}

export interface PersonaRow {
    persona: string;
    tier: string;
    citations: number;
    threshold: number;
    status: string;
}

export function audit(skillsDir: string, personasDir: string): PersonaRow[] {
    const personas = _load_personas(personasDir);
    const citations = _count_citations(skillsDir);
    const rows: PersonaRow[] = [];
    // for slug, tier in sorted(personas.items()):
    const personaEntries = [...personas.entries()].sort((a, b) => _pyCmp(a[0], b[0]));
    for (const [slug, tier] of personaEntries) {
        const count = citations.get(slug) ?? 0;
        const threshold = THRESHOLDS[tier] ?? 3;
        const status = count < threshold ? 'under-cited' : 'ok';
        rows.push({ persona: slug, tier, citations: count, threshold, status });
    }
    // Surface citations that point at unknown personas (typos, deletions).
    const citationSlugs = [...citations.keys()].sort(_pyCmp);
    for (const slug of citationSlugs) {
        if (!personas.has(slug)) {
            rows.push({
                persona: slug,
                tier: 'unknown',
                citations: citations.get(slug) as number,
                threshold: 0,
                status: 'orphan',
            });
        }
    }
    return rows;
}

/** Python str comparison — code-point ordering. */
function _pyCmp(a: string, b: string): number {
    if (a < b) {
        return -1;
    }
    if (a > b) {
        return 1;
    }
    return 0;
}

/** Mirror Python `f"{s:<{w}}"` (left-justify) over code-point width. */
function _ljust(s: string, w: number): string {
    const len = pyLen(s);
    return len >= w ? s : s + ' '.repeat(w - len);
}

/** Mirror Python `f"{n:>5}"` (right-justify width 5). */
function _rjust5(s: string): string {
    return s.length >= 5 ? s : ' '.repeat(5 - s.length) + s;
}

function _print_human(rows: PersonaRow[]): string[] {
    if (rows.length === 0) {
        return ['(no personas found)'];
    }
    const lines: string[] = [];
    const width = Math.max(...rows.map((r) => pyLen(r.persona)));
    lines.push(`  ${_ljust('persona', width)}  tier        cites  status`);
    lines.push(`  ${'-'.repeat(width)}  ----------  -----  -----------`);
    for (const r of rows) {
        lines.push(
            `  ${_ljust(r.persona, width)}  ${_ljust(r.tier, 10)}  ${_rjust5(String(r.citations))}  ${r.status}`,
        );
    }
    const flagged = rows.filter((r) => r.status !== 'ok');
    if (flagged.length > 0) {
        lines.push(`\n  ${flagged.length} persona(s) flagged (under-cited or orphan).`);
    }
    return lines;
}

function _isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

function _stem(p: string): string {
    // pathlib Path.stem — basename without the final suffix.
    const base = path.basename(p);
    const ext = path.extname(base);
    return ext ? base.slice(0, base.length - ext.length) : base;
}

/** Sorted *.md directly under a dir (mirrors `sorted(dir.glob("*.md"))`). */
function _globMd(dir: string): string[] {
    let names: string[];
    try {
        names = fs.readdirSync(dir);
    } catch {
        return [];
    }
    const out: string[] = [];
    for (const name of names) {
        if (!name.endsWith('.md')) {
            continue;
        }
        const full = path.join(dir, name);
        try {
            if (fs.statSync(full).isFile()) {
                out.push(name);
            }
        } catch {
            // skip
        }
    }
    out.sort();
    return out.map((name) => path.join(dir, name));
}

/**
 * Unsorted *<slash>SKILL.md (mirrors `skills_dir.glob("*<slash>SKILL.md")`).
 *
 * Python `glob` (no `sorted`) yields OS-order; this counter is
 * order-independent so iteration order does not affect the totals. Sorted
 * here for determinism without changing any observable output.
 */
function _globSkillMdUnsorted(root: string): string[] {
    let names: string[];
    try {
        names = fs.readdirSync(root);
    } catch {
        return [];
    }
    const out: string[] = [];
    for (const name of names) {
        const dir = path.join(root, name);
        const skillMd = path.join(dir, 'SKILL.md');
        try {
            if (fs.statSync(dir).isDirectory() && fs.statSync(skillMd).isFile()) {
                out.push(skillMd);
            }
        } catch {
            // skip
        }
    }
    return out;
}

// --- json.dumps(indent=2) emulation (ensure_ascii=True default) -------------

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

function pyJsonDumpsIndent2(obj: Json, level = 0): string {
    if (obj === null) {
        return 'null';
    }
    if (typeof obj === 'number') {
        return String(obj);
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
        return `[\n${obj.map((v) => pad + pyJsonDumpsIndent2(v, level + 1)).join(',\n')}\n${closePad}]`;
    }
    const keys = Object.keys(obj as Record<string, Json>);
    if (keys.length === 0) {
        return '{}';
    }
    const pad = ' '.repeat(2 * (level + 1));
    const closePad = ' '.repeat(2 * level);
    const parts = keys.map(
        (k) => `${pad}${_pyJsonStr(k)}: ${pyJsonDumpsIndent2((obj as Record<string, Json>)[k], level + 1)}`,
    );
    return `{\n${parts.join(',\n')}\n${closePad}}`;
}

// --- argparse surface --------------------------------------------------------

const PROG = 'audit_persona_coverage.py';

interface Args {
    skills_dir: string;
    personas_dir: string;
    json: boolean;
}

function _argError(message: string): never {
    process.stderr.write(`${PROG}: error: ${message}\n`);
    process.exit(2);
}

export function parse_args(argv: string[]): Args {
    const args: Args = {
        skills_dir: DEFAULT_SKILLS,
        personas_dir: DEFAULT_PERSONAS,
        json: false,
    };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i] as string;
        if (a === '--json') {
            args.json = true;
        } else if (a === '--skills-dir') {
            const v = argv[++i];
            if (v === undefined) {
                _argError('argument --skills-dir: expected one argument');
            }
            args.skills_dir = v;
        } else if (a.startsWith('--skills-dir=')) {
            args.skills_dir = a.slice('--skills-dir='.length);
        } else if (a === '--personas-dir') {
            const v = argv[++i];
            if (v === undefined) {
                _argError('argument --personas-dir: expected one argument');
            }
            args.personas_dir = v;
        } else if (a.startsWith('--personas-dir=')) {
            args.personas_dir = a.slice('--personas-dir='.length);
        } else {
            _argError(`unrecognized arguments: ${a}`);
        }
    }
    return args;
}

export function main(argv: string[] | null = null): number {
    const args = parse_args(argv ?? process.argv.slice(2));
    const rows = audit(args.skills_dir, args.personas_dir);
    if (args.json) {
        process.stdout.write(pyJsonDumpsIndent2({ rows }));
        process.stdout.write('\n');
    } else {
        const lines = _print_human(rows);
        process.stdout.write(lines.join('\n') + '\n');
    }
    return 0;
}

const _isMain = import.meta.url === pathToFileURL(path.resolve(process.argv[1] ?? '')).href;
if (_isMain) {
    process.exitCode = main();
}
