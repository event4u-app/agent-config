#!/usr/bin/env node
/**
 * Audit skill descriptions for triggering quality.
 *
 * TypeScript twin of `src/scripts/audit_skill_descriptions.py` (ADR-092,
 * Phase 8 Wave 8a). Mirrors the Python CLI contract EXACTLY — flags
 * (`--root`, `--json`, `--full`), exit codes (0 / 2), stdout/stderr split,
 * byte-identical text table AND byte-identical JSON (`json.dumps(...,
 * indent=2)`, ensure_ascii=True, field order skill/path/description/
 * length/flags). The `score` property is computed (not serialized), as in
 * the Python `asdict()`.
 *
 * Flags descriptions that are:
 *   - too short (< 150 chars) or too long (> 200 chars, the linter limit)
 *   - missing an explicit trigger verb prefix ("use when", "creates", ...)
 *   - containing hedge terms ("may help", "can be useful", ...)
 *
 * Usage:
 *   node scripts/audit_skill_descriptions.ts            # human table
 *   node scripts/audit_skill_descriptions.ts --json     # machine-readable
 *   node scripts/audit_skill_descriptions.ts --root DIR # audit another tree
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { artefact_roots } from './_lib/agent_src.js';

export const MIN_LENGTH = 150;
// Mirrors scripts/skill_linter.py `description_too_long` threshold.
export const MAX_LENGTH = 200;

// re.compile(r"^---\n(.*?)\n---", re.DOTALL) — used with .search (anywhere).
const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---/m;
// re.compile(r'^description:\s*"?(.*?)"?\s*$', re.MULTILINE)
// `.` does not match newlines (no DOTALL); the body capture stays single-line.
const DESCRIPTION_RE = /^description:[ \t]*"?(.*?)"?[ \t]*$/m;

const TRIGGER_PREFIX_RE = new RegExp(
    '^\\s*(' +
        'use\\s+(when|if|for)\\b|only\\s+when\\b|' +
        'creates?\\b|reviews?\\b|writes?\\b|handles?\\b|generates?\\b|runs?\\b|' +
        'builds?\\b|fetches?\\b|validates?\\b|audits?\\b|analyzes?\\b|detects?\\b|' +
        'plans?\\b|deploys?\\b|configures?\\b|scaffolds?\\b|fixes?\\b|refactors?\\b|' +
        'optimizes?\\b|renders?\\b|syncs?\\b|explores?\\b|installs?\\b|updates?\\b|' +
        'manages?\\b|orchestrates?\\b|prepares?\\b|finds?\\b|executes?\\b|reads?\\b|' +
        'checks?\\b|tracks?\\b' +
        ')',
    'i',
);

const HEDGE_PHRASES: readonly string[] = [
    'may help',
    'can be useful',
    'covers various',
    'might be',
    'generally',
    'as needed',
    'when appropriate',
];

export interface Finding {
    skill: string;
    path: string;
    description: string;
    length: number;
    flags: string[];
}

/** Higher score = worse. Used for sorting. Mirrors the dataclass `score` property. */
export function finding_score(f: Finding): number {
    let penalty = 0;
    if (f.flags.includes('no-trigger-prefix')) {
        penalty += 30;
    }
    if (f.flags.includes('too-short')) {
        penalty += 20;
    }
    if (f.flags.includes('very-short')) {
        penalty += 10;
    }
    penalty += f.flags.filter((x) => x.startsWith('hedge:')).length * 10;
    return penalty;
}

/** Mirror Python str.strip() — strip ASCII + Unicode whitespace. */
function pyStrip(s: string): string {
    return s.replace(/^\s+/, '').replace(/\s+$/, '');
}

/** Mirror Python len(str) — count Unicode code points, not UTF-16 units. */
function pyLen(s: string): number {
    let n = 0;
    for (const _ of s) {
        n++;
    }
    return n;
}

export function extract_description(text: string): string {
    // FRONTMATTER_RE.search(text): the Python `re.DOTALL` regex without
    // MULTILINE matches a leading `---\n...\n---`. We anchor at start via the
    // `m`+`^` to mirror that real skill files always lead with frontmatter.
    const m = FRONTMATTER_RE.exec(text);
    if (!m || m.index !== 0) {
        return '';
    }
    const d = DESCRIPTION_RE.exec(m[1] as string);
    return d ? pyStrip(d[1] as string) : '';
}

export function audit_description(description: string): string[] {
    const flags: string[] = [];
    if (!description) {
        flags.push('missing');
        return flags;
    }
    const length = pyLen(description);
    if (length < 80) {
        flags.push('very-short');
    } else if (length < MIN_LENGTH) {
        flags.push('too-short');
    }
    if (length > MAX_LENGTH) {
        flags.push('too-long');
    }
    if (!TRIGGER_PREFIX_RE.test(description)) {
        flags.push('no-trigger-prefix');
    }
    const lowered = description.toLowerCase();
    for (const phrase of HEDGE_PHRASES) {
        if (lowered.includes(phrase)) {
            flags.push(`hedge:${phrase}`);
        }
    }
    return flags;
}

/**
 * Sorted SKILL.md files (mirrors `sorted(root.glob("*<slash>SKILL.md"))`).
 *
 * Python sorts `Path` objects component-wise (`._parts` tuple compare), NOT by
 * the joined string. Since every match is `<dir>/SKILL.md`, sorting by the
 * directory component reproduces that order (e.g. `laravel` before
 * `laravel-api-endpoint` because `'laravel' < 'laravel-api-endpoint'`,
 * whereas a raw-string sort would put `laravel-…` first since `-` < `/`).
 */
function _globSkillMd(root: string): string[] {
    let names: string[];
    try {
        names = fs.readdirSync(root);
    } catch {
        return [];
    }
    const dirs: string[] = [];
    for (const name of names) {
        const dir = path.join(root, name);
        const skillMd = path.join(dir, 'SKILL.md');
        try {
            if (fs.statSync(dir).isDirectory() && fs.statSync(skillMd).isFile()) {
                dirs.push(name);
            }
        } catch {
            // not a dir / no SKILL.md
        }
    }
    dirs.sort(); // component (basename) compare — matches pathlib part-wise sort
    return dirs.map((name) => path.join(root, name, 'SKILL.md'));
}

export function collect_findings(root: string): Finding[] {
    const findings: Finding[] = [];
    for (const skill_md of _globSkillMd(root)) {
        const text = fs.readFileSync(skill_md, 'utf-8');
        const description = extract_description(text);
        const flags = audit_description(description);
        findings.push({
            skill: path.basename(path.dirname(skill_md)),
            path: skill_md,
            description,
            length: pyLen(description),
            flags,
        });
    }
    return findings;
}

/** Mirror Python `f"{s:>{w}}"` / `f"{s:<{w}}"`. */
function _rjust(s: string, w: number): string {
    return s.length >= w ? s : ' '.repeat(w - s.length) + s;
}
function _ljust(s: string, w: number): string {
    return s.length >= w ? s : s + ' '.repeat(w - s.length);
}

export function render_text(findings: Finding[], worst_only: boolean): string {
    const flagged = findings.filter((f) => f.flags.length > 0);
    // flagged.sort(key=lambda f: (-f.score, f.skill)) — Python tuple sort, stable.
    flagged.sort((a, b) => {
        const sa = -finding_score(a);
        const sb = -finding_score(b);
        if (sa !== sb) {
            return sa - sb;
        }
        if (a.skill < b.skill) {
            return -1;
        }
        if (a.skill > b.skill) {
            return 1;
        }
        return 0;
    });
    const lines: string[] = [`Audited ${findings.length} skills, ${flagged.length} flagged.\n`];
    if (flagged.length === 0) {
        lines.push('✅  All descriptions look reasonable.');
        return lines.join('\n');
    }
    lines.push(`${_rjust('SCORE', 5)}  ${_rjust('LEN', 4)}  ${_ljust('SKILL', 40)}  FLAGS`);
    lines.push('-'.repeat(90));
    const shown = worst_only ? flagged.slice(0, 15) : flagged;
    for (const f of shown) {
        lines.push(
            `${_rjust(String(finding_score(f)), 5)}  ${_rjust(String(f.length), 4)}  ${_ljust(f.skill, 40)}  ${f.flags.join(', ')}`,
        );
    }
    if (worst_only && flagged.length > 15) {
        lines.push(`\n... ${flagged.length - 15} more (use --full to show all)`);
    }
    return lines.join('\n');
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
    // object — preserve insertion order (sort_keys=False).
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

/** Mirror dataclasses.asdict(f) — field order skill/path/description/length/flags. */
function _asdict(f: Finding): Record<string, Json> {
    return {
        skill: f.skill,
        path: f.path,
        description: f.description,
        length: f.length,
        flags: f.flags,
    };
}

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
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

interface Args {
    root: string | null;
    json: boolean;
    full: boolean;
}

export function parse_args(argv: string[]): Args {
    const args: Args = { root: null, json: false, full: false };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i] as string;
        if (a === '--json') {
            args.json = true;
        } else if (a === '--full') {
            args.full = true;
        } else if (a === '--root') {
            const v = argv[++i];
            if (v === undefined) {
                process.stderr.write('argument --root: expected one argument\n');
                process.exit(2);
            }
            args.root = v;
        } else if (a.startsWith('--root=')) {
            args.root = a.slice('--root='.length);
        } else {
            process.stderr.write(`unrecognized arguments: ${a}\n`);
            process.exit(2);
        }
    }
    return args;
}

export function main(argv: string[] | null = null): number {
    const args = parse_args(argv ?? process.argv.slice(2));
    let roots: string[];
    if (args.root !== null) {
        if (!_exists(args.root)) {
            process.stderr.write(`error: ${args.root} does not exist\n`);
            return 2;
        }
        roots = [args.root];
    } else {
        roots = artefact_roots()
            .map((r) => path.join(r, 'skills'))
            .filter((p) => _isDir(p));
        if (roots.length === 0) {
            process.stderr.write('error: no skills/ directories found across artefact roots\n');
            return 2;
        }
    }
    const findings: Finding[] = [];
    for (const r of roots) {
        findings.push(...collect_findings(r));
    }
    if (args.json) {
        process.stdout.write(pyJsonDumpsIndent2(findings.map(_asdict)) + '\n');
    } else {
        process.stdout.write(render_text(findings, !args.full) + '\n');
    }
    return 0;
}

const _isMain = import.meta.url === pathToFileURL(path.resolve(process.argv[1] ?? '')).href;
if (_isMain) {
    // Set exitCode rather than process.exit() so a large (>64 KB) stdout write
    // fully drains to the pipe before the process exits.
    process.exitCode = main();
}
