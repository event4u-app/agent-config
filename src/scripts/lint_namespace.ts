#!/usr/bin/env tsx
/**
 * Namespace linter. Enforces `<stem>-<intent>` kebab-case + reserved
 * names list across skills / rules / commands / personas.
 *
 * TypeScript twin of `src/scripts/lint_namespace.py` (ADR-090, Phase 4 /
 * Wave 4b). The CLI contract is mirrored EXACTLY — `--name` / `--quiet`
 * flags, exit codes (0 clean, 1 issues / single-name fail), stdout/stderr
 * split (findings + BASELINE-on-failure to stderr; success BASELINE to
 * stdout), byte-identical finding messages, same `sorted(root.glob(glob))`
 * scan order, same dedup, same reserved-names list.
 *
 * Contract: docs/contracts/namespace.md.
 * Wired into: `task lint-skills` (taskfiles/ci-fast.yml).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);

const ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const SRC = path.join(ROOT, '.agent-src.uncondensed');

// Source-of-truth regex; mirrored in docs/contracts/namespace.md § 1.
const NAME_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

const MIN_LEN = 2;
const MIN_LEN_SKILL = 3;
const MAX_LEN = 64;

const RESERVED = new Set(['pattern', 'claude-memories', 'default', 'index', 'router']);

// Filenames that are documentation, not artefacts.
const NON_ARTEFACTS = new Set(['README.md', 'INDEX.md']);

// (kind, root, glob, depth, sub_verb).
interface Target {
    kind: string;
    root: string;
    glob: string;
    depth: number;
    subVerb: boolean;
}

const TARGETS: Target[] = [
    { kind: 'skill', root: path.join(SRC, 'skills'), glob: '*/SKILL.md', depth: 1, subVerb: false },
    { kind: 'rule', root: path.join(SRC, 'rules'), glob: '*.md', depth: 0, subVerb: false },
    { kind: 'command', root: path.join(SRC, 'commands'), glob: '*.md', depth: 0, subVerb: false },
    { kind: 'command', root: path.join(SRC, 'commands'), glob: '*/*.md', depth: 0, subVerb: true },
    { kind: 'persona', root: path.join(SRC, 'personas'), glob: '*.md', depth: 0, subVerb: false },
];

function _isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

/** Mirror `Path(rel).stem` — basename without final extension. */
function _stem(name: string): string {
    const dot = name.lastIndexOf('.');
    return dot > 0 ? name.slice(0, dot) : name;
}

/**
 * Resolve glob patterns used by TARGETS against `root`, returning POSIX
 * relative paths sorted lexicographically (mirrors `sorted(root.glob(glob))`,
 * which sorts by the full path string; relative-to-root order is identical
 * because the shared prefix is constant).
 */
function _glob(root: string, glob: string): string[] {
    const out: string[] = [];
    if (glob === '*.md') {
        for (const name of _listdir(root)) {
            if (name.endsWith('.md') && _isFile(path.join(root, name))) {
                out.push(name);
            }
        }
    } else if (glob === '*/SKILL.md') {
        for (const dir of _listdir(root)) {
            const full = path.join(root, dir);
            if (_isDir(full)) {
                const skill = path.join(full, 'SKILL.md');
                if (_isFile(skill)) {
                    out.push(`${dir}/SKILL.md`);
                }
            }
        }
    } else if (glob === '*/*.md') {
        for (const dir of _listdir(root)) {
            const full = path.join(root, dir);
            if (_isDir(full)) {
                for (const name of _listdir(full)) {
                    if (name.endsWith('.md') && _isFile(path.join(full, name))) {
                        out.push(`${dir}/${name}`);
                    }
                }
            }
        }
    }
    // sorted() on full absolute paths == sorted() on rel paths (constant prefix).
    return out.sort();
}

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

function _listdir(p: string): string[] {
    try {
        return fs.readdirSync(p);
    } catch {
        return [];
    }
}

function _name_for(rel: string, depth: number): string {
    if (depth === 0) {
        const base = rel.split('/').pop() as string;
        return _stem(base);
    }
    return rel.split('/')[0] as string;
}

function _shape_errors(name: string, subVerb = false, kind = 'command'): string[] {
    const errs: string[] = [];
    const floor = kind === 'skill' ? MIN_LEN_SKILL : MIN_LEN;
    if (!(floor <= name.length && name.length <= MAX_LEN)) {
        errs.push(`length — ${name.length} chars (must be ${floor}–${MAX_LEN})`);
    }
    if (!NAME_RE.test(name)) {
        errs.push('regex — must match ^[a-z][a-z0-9]*(-[a-z0-9]+)*$');
    }
    if (RESERVED.has(name) && !subVerb) {
        errs.push(`reserved — '${name}' in reserved-names list`);
    }
    return errs;
}

/** Read `name:` from skill frontmatter. null on missing / unparseable. */
function _skill_name_field(p: string): string | null {
    let text: string;
    try {
        text = fs.readFileSync(p, 'utf-8');
    } catch {
        return null;
    }
    if (!text.startsWith('---')) {
        return null;
    }
    const end = text.indexOf('\n---', 3);
    if (end < 0) {
        return null;
    }
    const fm = text.slice(3, end);
    for (const line of fm.split('\n')) {
        const m = /^name:\s*['"]?([^'"]+)['"]?\s*$/.exec(line.trim());
        if (m) {
            return (m[1] as string).trim();
        }
    }
    return null;
}

function scan(): [number, number] {
    let issues = 0;
    let checked = 0;
    const seen = new Set<string>();
    for (const { kind, root, glob, depth, subVerb } of TARGETS) {
        if (!_isDir(root)) {
            continue;
        }
        for (const rel of _glob(root, glob)) {
            const fullPath = path.join(root, rel);
            const base = rel.split('/').pop() as string;
            if (NON_ARTEFACTS.has(base)) {
                continue;
            }
            const name = _name_for(rel, depth);
            const key = `${kind}\x00${rel}`;
            if (seen.has(key)) {
                continue;
            }
            seen.add(key);
            checked += 1;
            const errs = _shape_errors(name, subVerb, kind);
            if (kind === 'skill') {
                const fmName = _skill_name_field(fullPath);
                if (fmName && fmName !== name) {
                    errs.push(`skill — frontmatter name='${fmName}' != dir '${name}'`);
                }
            }
            for (const e of errs) {
                const rel2 = path.relative(ROOT, fullPath).split(path.sep).join('/');
                process.stderr.write(`❌ ${rel2}: ${e}\n`);
                issues += 1;
            }
        }
    }
    return [checked, issues];
}

function check_single(name: string): number {
    const errs = _shape_errors(name);
    if (errs.length === 0) {
        process.stdout.write(`✅ '${name}' is a valid artefact name\n`);
        return 0;
    }
    for (const e of errs) {
        process.stderr.write(`❌ '${name}': ${e}\n`);
    }
    return 1;
}

interface ParsedArgs {
    name: string | null;
    quiet: boolean;
}

function _argparse_error(message: string): never {
    process.stderr.write(`lint_namespace: error: ${message}\n`);
    process.exit(2);
}

function parse_args(argv: readonly string[]): ParsedArgs {
    let name: string | null = null;
    let quiet = false;
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i]!;
        if (arg === '--quiet') {
            quiet = true;
        } else if (arg === '--name') {
            const v = argv[++i];
            if (v === undefined) {
                _argparse_error('argument --name: expected one argument');
            }
            name = v;
        } else if (arg.startsWith('--name=')) {
            name = arg.slice('--name='.length);
        } else if (arg === '-h' || arg === '--help') {
            process.stdout.write('usage: lint_namespace [-h] [--name NAME] [--quiet]\n');
            process.exit(0);
        } else {
            _argparse_error(`unrecognized arguments: ${arg}`);
        }
    }
    return { name, quiet };
}

function main(argv?: readonly string[]): number {
    const args = parse_args(argv ?? process.argv.slice(2));
    if (args.name) {
        return check_single(args.name);
    }
    const [checked, issues] = scan();
    if (issues) {
        process.stderr.write(`BASELINE: ${issues} issue(s) across ${checked} name(s)\n`);
        return 1;
    }
    if (!args.quiet) {
        process.stdout.write(`BASELINE: 0 issues · ${checked} name(s) checked\n`);
    }
    return 0;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}

export {
    ROOT,
    SRC,
    NAME_RE,
    RESERVED,
    NON_ARTEFACTS,
    TARGETS,
    _name_for,
    _shape_errors,
    _skill_name_field,
    scan,
    check_single,
    parse_args,
    main,
};
