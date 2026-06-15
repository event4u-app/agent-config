#!/usr/bin/env tsx
/**
 * Runtime Registry — discovers skills with execution metadata.
 *
 * TypeScript twin of `src/scripts/runtime_registry.py` (ADR-200, Phase 8 /
 * Wave 8h). Mirrors the Python CLI contract EXACTLY — `--root`, `--format`
 * (text|json), `--validate` flags, exit codes (0 ok / valid, 1 invalid),
 * byte-identical stdout/stderr, and byte-identical `json.dumps(indent=2)`
 * output. No behaviour changes.
 *
 * Responsibilities:
 * - Discover skills with execution blocks in frontmatter
 * - Validate handler support
 * - Expose list of runtime-capable skills
 * - Provide skill metadata lookup
 *
 * Usage:
 *     tsx scripts/runtime_registry.ts [--root ROOT] [--format text|json]
 *
 * Library role: `runtime_dispatcher.py` imports `SkillRuntime` and
 * `build_registry` from the Python original — the `.py` stays in place so the
 * still-Python dispatcher keeps importing it. This `.ts` twin sits beside it.
 *
 * Imports the SAME primitives the `.py` imports from `skill_linter`:
 * `FRONTMATTER_PATTERN`, `DESCRIPTION_PATTERN`, `NAME_PATTERN`,
 * `VALID_EXECUTION_TYPES`, `VALID_EXECUTION_HANDLERS`, `parse_execution_block`
 * (`parseExecutionBlock`), `extract_frontmatter`.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
    DESCRIPTION_PATTERN,
    NAME_PATTERN,
    VALID_EXECUTION_TYPES,
    VALID_EXECUTION_HANDLERS,
    parseExecutionBlock,
    extract_frontmatter,
    type ExecutionBlock,
} from './skill_linter.js';

const _HERE = fileURLToPath(import.meta.url);

/** Runtime metadata for a single skill. */
export class SkillRuntime {
    readonly name: string;

    readonly path: string;

    readonly description: string;

    readonly execution_type: string;

    readonly handler: string;

    readonly timeout_seconds: number;

    readonly safety_mode: string | null;

    readonly allowed_tools: string[];

    readonly command: string[];

    constructor(args: {
        name: string;
        path: string;
        description: string;
        execution_type: string;
        handler: string;
        timeout_seconds: number;
        safety_mode: string | null;
        allowed_tools: string[];
        command?: string[];
    }) {
        this.name = args.name;
        this.path = args.path;
        this.description = args.description;
        this.execution_type = args.execution_type;
        this.handler = args.handler;
        this.timeout_seconds = args.timeout_seconds;
        this.safety_mode = args.safety_mode;
        this.allowed_tools = args.allowed_tools;
        this.command = args.command ?? [];
    }

    get is_executable(): boolean {
        return this.execution_type === 'assisted' || this.execution_type === 'automated';
    }

    get is_automated(): boolean {
        return this.execution_type === 'automated';
    }

    /** True when the skill declares an executable command for a real handler. */
    get is_runnable(): boolean {
        return (
            this.command.length > 0 &&
            (this.handler === 'shell' || this.handler === 'php' || this.handler === 'node')
        );
    }

    /** Mirror `dataclasses.asdict(self)` — field order, properties excluded. */
    asdict(): Record<string, unknown> {
        return {
            name: this.name,
            path: this.path,
            description: this.description,
            execution_type: this.execution_type,
            handler: this.handler,
            timeout_seconds: this.timeout_seconds,
            safety_mode: this.safety_mode,
            allowed_tools: this.allowed_tools,
            command: this.command,
        };
    }
}

function isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

function isSymlink(p: string): boolean {
    try {
        return fs.lstatSync(p).isSymbolicLink();
    } catch {
        return false;
    }
}

/** Recursive equivalent of `Path.rglob("SKILL.md")`. */
function rglobSkillMd(root: string): string[] {
    const out: string[] = [];
    function walk(dir: string): void {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const ent of entries) {
            const full = path.join(dir, ent.name);
            // Mirror Path.rglob: descend symlinked dirs are not followed for
            // recursion by default in CPython's pathlib, but the original
            // filters symlinks at the file level, so traverse real dirs only.
            if (ent.isDirectory()) {
                walk(full);
            } else if (ent.name === 'SKILL.md') {
                out.push(full);
            }
        }
    }
    walk(root);
    return out;
}

/** Mirror `sorted(...)` over pathlib paths — component-wise comparison. */
function comparePathComponents(a: string, b: string): number {
    const pa = a.split(path.sep);
    const pb = b.split(path.sep);
    const n = Math.min(pa.length, pb.length);
    for (let i = 0; i < n; i += 1) {
        const x = pa[i] as string;
        const y = pb[i] as string;
        if (x !== y) {
            return x < y ? -1 : 1;
        }
    }
    return pa.length - pb.length;
}

/** Find all SKILL.md files, preferring .agent-src.uncondensed/. */
export function discover_skills(root: string): string[] {
    const uncondensed = path.join(root, '.agent-src.uncondensed', 'skills');
    const condensed = path.join(root, 'dist/agent-src', 'skills');
    const base = fs.existsSync(uncondensed) ? uncondensed : condensed;
    if (!fs.existsSync(base)) {
        return [];
    }
    const files = rglobSkillMd(base).filter((f) => !isSymlink(f));
    files.sort(comparePathComponents);
    return files;
}

function _execGet<T>(execution: ExecutionBlock, key: string, fallback: T): T {
    const v = execution[key];
    return v === undefined ? fallback : (v as unknown as T);
}

/** Parse a skill file and return its runtime metadata, or null if no execution block. */
export function parse_skill_runtime(p: string): SkillRuntime | null {
    const text = fs.readFileSync(p, 'utf-8');
    const frontmatter = extract_frontmatter(text);
    if (frontmatter === null) {
        return null;
    }

    const execution = parseExecutionBlock(frontmatter);
    if (execution === null) {
        return null;
    }

    // Extract name and description
    const nameMatch = NAME_PATTERN.exec(frontmatter);
    const name = nameMatch ? (nameMatch[1] as string).trim() : path.basename(path.dirname(p));
    const descMatch = DESCRIPTION_PATTERN.exec(frontmatter);
    const description = descMatch ? (descMatch[1] as string).trim() : '';

    return new SkillRuntime({
        name,
        path: p,
        description,
        execution_type: _execGet(execution, 'type', 'manual'),
        handler: _execGet(execution, 'handler', 'none'),
        timeout_seconds: _execGet(execution, 'timeout_seconds', 30),
        safety_mode: _execGet<string | null>(execution, 'safety_mode', null),
        allowed_tools: _execGet<string[]>(execution, 'allowed_tools', []),
        command: _execGet<string[]>(execution, 'command', []),
    });
}

/** Build the full runtime registry from all skills. */
export function build_registry(root: string): SkillRuntime[] {
    const skills = discover_skills(root);
    const registry: SkillRuntime[] = [];
    for (const skillPath of skills) {
        const runtime = parse_skill_runtime(skillPath);
        if (runtime !== null) {
            registry.push(runtime);
        }
    }
    return registry;
}

/** Validate the registry for consistency issues. */
export function validate_registry(registry: SkillRuntime[]): string[] {
    const errors: string[] = [];
    for (const skill of registry) {
        if (!VALID_EXECUTION_TYPES.has(skill.execution_type)) {
            errors.push(`${skill.name}: invalid execution type '${skill.execution_type}'`);
        }
        if (!VALID_EXECUTION_HANDLERS.has(skill.handler)) {
            errors.push(`${skill.name}: invalid handler '${skill.handler}'`);
        }
        if (skill.is_automated) {
            if (skill.handler === 'none') {
                errors.push(`${skill.name}: automated skill has handler 'none'`);
            }
            if (skill.safety_mode !== 'strict') {
                errors.push(`${skill.name}: automated skill missing safety_mode 'strict'`);
            }
        }
    }
    return errors;
}

// --- json.dumps(indent=2) emulation (ensure_ascii=True, NO sort_keys) -------

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

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

function pyJsonDumpsIndent2(obj: Json, level = 0): string {
    if (obj === null || obj === undefined) {
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
        (k) => `${pad}${_pyJsonStr(k)}: ${pyJsonDumpsIndent2((obj as Record<string, Json>)[k] as Json, level + 1)}`,
    );
    return `{\n${parts.join(',\n')}\n${closePad}}`;
}

interface Args {
    root: string;
    format: 'text' | 'json';
    validate: boolean;
}

/** Mirror argparse parsing — `--root`, `--format`, `--validate`. */
function parseArgs(argv: string[]): Args {
    const out: Args = { root: '.', format: 'text', validate: false };
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i] as string;
        if (a === '--root') {
            out.root = argv[(i += 1)] as string;
        } else if (a.startsWith('--root=')) {
            out.root = a.slice('--root='.length);
        } else if (a === '--format') {
            out.format = argv[(i += 1)] as 'text' | 'json';
        } else if (a.startsWith('--format=')) {
            out.format = a.slice('--format='.length) as 'text' | 'json';
        } else if (a === '--validate') {
            out.validate = true;
        }
    }
    return out;
}

export function main(argv: string[]): number {
    const args = parseArgs(argv);

    const registry = build_registry(args.root);

    if (args.validate) {
        const errors = validate_registry(registry);
        if (errors.length > 0) {
            for (const e of errors) {
                process.stderr.write(`ERROR: ${e}\n`);
            }
            return 1;
        }
        process.stdout.write(`Registry valid: ${registry.length} runtime-capable skills\n`);
        return 0;
    }

    if (args.format === 'json') {
        process.stdout.write(`${pyJsonDumpsIndent2(registry.map((s) => s.asdict() as Json))}\n`);
    } else if (registry.length === 0) {
        process.stdout.write('No runtime-capable skills found.\n');
    } else {
        process.stdout.write(`Runtime-capable skills: ${registry.length}\n\n`);
        for (const s of registry) {
            const tools = s.allowed_tools.length > 0 ? s.allowed_tools.join(', ') : 'none';
            process.stdout.write(`  ${s.name}\n`);
            process.stdout.write(
                `    type: ${s.execution_type} | handler: ${s.handler} | ` +
                    `timeout: ${s.timeout_seconds}s | tools: ${tools}\n`,
            );
        }
    }
    return 0;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exitCode = main(process.argv.slice(2));
}
