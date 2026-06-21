#!/usr/bin/env tsx
/**
 * Runtime Dispatcher — resolves execution type and drives real handler execution.
 *
 * TypeScript twin of `src/scripts/runtime_dispatcher.py` (ADR-200). Mirrors the
 * Python public surface and CLI contract EXACTLY — `ExecutionRequest`,
 * `DispatchResult`, `dispatch`, `run`, the `resolve` / `run` subcommands, the
 * legacy flat `--skill` flag, `--format text|json`, `--root`, `--cwd`,
 * `--output`, exit codes, and byte-identical stdout/stderr (including
 * `json.dumps(..., indent=2)` output). No behaviour changes.
 *
 * Two modes:
 *
 * - resolve (default): produce a structured execution request, enforce safety,
 *   return dispatch metadata. No side effects.
 * - run: dispatch the skill, then hand it to the matching runtime handler to
 *   actually execute. Returns a typed ExecutionResult.
 *
 * Usage:
 *     tsx scripts/runtime_dispatcher.ts --skill NAME [--format text|json]
 *     tsx scripts/runtime_dispatcher.ts resolve --skill NAME
 *     tsx scripts/runtime_dispatcher.ts run --skill NAME [--cwd PATH] [--output FILE]
 *
 * `run --output FILE` persists the ExecutionResult as JSON to FILE. CI uses
 * this to feed `scripts/ci_summary`.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import type { SkillRuntime} from './runtime_registry.js';
import { build_registry } from './runtime_registry.js';
import type { ExecutionResult} from './runtime_handler.js';
import { HandlerError, execute_shell } from './runtime_handler.js';
import { resolve_level } from './_lib/script_output.js';

const _HERE = fileURLToPath(import.meta.url);

/** Structured execution request produced by the dispatcher. */
export class ExecutionRequest {
    readonly skill_name: string;

    readonly execution_type: string;

    readonly handler: string;

    readonly timeout_seconds: number;

    readonly safety_mode: string | null;

    readonly allowed_tools: string[];

    readonly status: string; // "ready", "blocked", "not_found"

    readonly reason: string | null;

    constructor(args: {
        skill_name: string;
        execution_type: string;
        handler: string;
        timeout_seconds: number;
        safety_mode: string | null;
        allowed_tools: string[];
        status: string;
        reason: string | null;
    }) {
        this.skill_name = args.skill_name;
        this.execution_type = args.execution_type;
        this.handler = args.handler;
        this.timeout_seconds = args.timeout_seconds;
        this.safety_mode = args.safety_mode;
        this.allowed_tools = args.allowed_tools;
        this.status = args.status;
        this.reason = args.reason;
    }

    get is_ready(): boolean {
        return this.status === 'ready';
    }

    /** Mirror `dataclasses.asdict(self)` — field order, properties excluded. */
    asdict(): Record<string, unknown> {
        return {
            skill_name: this.skill_name,
            execution_type: this.execution_type,
            handler: this.handler,
            timeout_seconds: this.timeout_seconds,
            safety_mode: this.safety_mode,
            allowed_tools: this.allowed_tools,
            status: this.status,
            reason: this.reason,
        };
    }
}

/** Result of dispatching a skill for execution. */
export class DispatchResult {
    readonly request: ExecutionRequest;

    readonly warnings: string[];

    constructor(args: { request: ExecutionRequest; warnings: string[] }) {
        this.request = args.request;
        this.warnings = args.warnings;
    }

    /** Mirror `dataclasses.asdict(self)` — recursive on the nested request. */
    asdict(): Record<string, unknown> {
        return {
            request: this.request.asdict(),
            warnings: this.warnings,
        };
    }
}

/** Resolve and validate a skill for execution. */
export function dispatch(skillName: string, registry: SkillRuntime[]): DispatchResult {
    const warnings: string[] = [];

    // Find skill in registry
    const matches = registry.filter((s) => s.name === skillName);
    if (matches.length === 0) {
        return new DispatchResult({
            request: new ExecutionRequest({
                skill_name: skillName,
                execution_type: 'unknown',
                handler: 'none',
                timeout_seconds: 0,
                safety_mode: null,
                allowed_tools: [],
                status: 'not_found',
                reason: `Skill '${skillName}' not found in runtime registry`,
            }),
            warnings: [],
        });
    }

    const skill = matches[0] as SkillRuntime;

    // Manual skills cannot be dispatched
    if (skill.execution_type === 'manual') {
        return new DispatchResult({
            request: new ExecutionRequest({
                skill_name: skill.name,
                execution_type: skill.execution_type,
                handler: skill.handler,
                timeout_seconds: skill.timeout_seconds,
                safety_mode: skill.safety_mode,
                allowed_tools: skill.allowed_tools,
                status: 'blocked',
                reason: 'Manual skills cannot be dispatched for execution',
            }),
            warnings: [],
        });
    }

    // Automated skills must pass safety checks
    if (skill.is_automated) {
        if (skill.handler === 'none') {
            return new DispatchResult({
                request: new ExecutionRequest({
                    skill_name: skill.name,
                    execution_type: skill.execution_type,
                    handler: skill.handler,
                    timeout_seconds: skill.timeout_seconds,
                    safety_mode: skill.safety_mode,
                    allowed_tools: skill.allowed_tools,
                    status: 'blocked',
                    reason: 'Automated skill has no handler',
                }),
                warnings: [],
            });
        }
        if (skill.safety_mode !== 'strict') {
            return new DispatchResult({
                request: new ExecutionRequest({
                    skill_name: skill.name,
                    execution_type: skill.execution_type,
                    handler: skill.handler,
                    timeout_seconds: skill.timeout_seconds,
                    safety_mode: skill.safety_mode,
                    allowed_tools: skill.allowed_tools,
                    status: 'blocked',
                    reason: 'Automated skill requires safety_mode: strict',
                }),
                warnings: [],
            });
        }
    }

    // Assisted/automated skill is ready
    if (skill.execution_type === 'assisted') {
        warnings.push('Assisted execution requires human confirmation before action');
    }

    return new DispatchResult({
        request: new ExecutionRequest({
            skill_name: skill.name,
            execution_type: skill.execution_type,
            handler: skill.handler,
            timeout_seconds: skill.timeout_seconds,
            safety_mode: skill.safety_mode,
            allowed_tools: skill.allowed_tools,
            status: 'ready',
            reason: null,
        }),
        warnings,
    });
}

/** Dispatch and execute a skill. Raises HandlerError on structural issues. */
export function run(skillName: string, registry: SkillRuntime[], cwd: string): ExecutionResult {
    const dispatchResult = dispatch(skillName, registry);
    const req = dispatchResult.request;
    if (!req.is_ready) {
        throw new HandlerError(
            `Skill '${skillName}' is not ready to run: ` +
                `${req.status} — ${req.reason || 'no reason given'}`,
        );
    }

    const skill = registry.find((s) => s.name === skillName) as SkillRuntime;
    if (skill.handler === 'shell' || skill.handler === 'php' || skill.handler === 'node') {
        return execute_shell(skill, cwd);
    }
    throw new HandlerError(
        `Handler '${skill.handler}' has no executor yet — ` +
            `only 'shell' is implemented in this phase`,
    );
}

/** Mirror `dataclasses.asdict(ExecutionResult)` — field order, properties excluded. */
function _executionResultAsdict(result: ExecutionResult): Record<string, unknown> {
    return {
        skill_name: result.skill_name,
        handler: result.handler,
        command: result.command,
        cwd: result.cwd,
        exit_code: result.exit_code,
        stdout: result.stdout,
        stderr: result.stderr,
        duration_ms: result.duration_ms,
        status: result.status,
        timed_out: result.timed_out,
        error: result.error,
        artifacts: result.artifacts,
    };
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

function _printDispatch(result: DispatchResult, fmt: string): void {
    if (fmt === 'json') {
        process.stdout.write(`${pyJsonDumpsIndent2(result.asdict() as Json)}\n`);
        return;
    }
    const req = result.request;
    process.stdout.write(`Skill: ${req.skill_name}\n`);
    process.stdout.write(`Status: ${req.status}\n`);
    if (req.reason) {
        process.stdout.write(`Reason: ${req.reason}\n`);
    }
    if (req.is_ready) {
        process.stdout.write(`Type: ${req.execution_type}\n`);
        process.stdout.write(`Handler: ${req.handler}\n`);
        process.stdout.write(`Timeout: ${req.timeout_seconds}s\n`);
        const tools = req.allowed_tools.length > 0 ? req.allowed_tools.join(', ') : 'none';
        process.stdout.write(`Tools: ${tools}\n`);
    }
    for (const w of result.warnings) {
        process.stdout.write(`WARNING: ${w}\n`);
    }
}

// Python str.strip() whitespace set: ASCII \t\n\v\f\r space, the C1/info
// separators \x1c-\x1f, NEL \x85, NBSP \xa0, plus the Unicode
// space-separator (Zs), line-separator, and paragraph-separator classes.
const _PY_RSTRIP_RE =
    /[\t\n\v\f\r \x1c\x1d\x1e\x1f\x85\xa0\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+$/u;

/** Mirror Python `str.rstrip()` — strip trailing Python-whitespace. */
function _pyRstrip(s: string): string {
    return s.replace(_PY_RSTRIP_RE, '');
}

function _printExecution(result: ExecutionResult, fmt: string): void {
    if (fmt === 'json') {
        process.stdout.write(`${pyJsonDumpsIndent2(_executionResultAsdict(result) as Json)}\n`);
        return;
    }
    const level = resolve_level();
    if (level === 'silent' && result.is_success) {
        return;
    }
    if (level === 'minimal' && result.is_success) {
        const marker = result.is_success ? '✅' : '❌';
        process.stdout.write(
            `${marker}  ${result.skill_name} · ${result.handler} · ` +
                `exit=${result.exit_code} (${result.duration_ms}ms)\n`,
        );
        return;
    }
    process.stdout.write(`Skill: ${result.skill_name}\n`);
    process.stdout.write(`Handler: ${result.handler}\n`);
    process.stdout.write(`Command: ${result.command.join(' ')}\n`);
    process.stdout.write(`Cwd: ${result.cwd}\n`);
    process.stdout.write(`Status: ${result.status}\n`);
    process.stdout.write(`Exit code: ${result.exit_code}\n`);
    process.stdout.write(`Duration: ${result.duration_ms}ms\n`);
    if (result.error) {
        process.stdout.write(`Error: ${result.error}\n`);
    }
    if (result.stdout) {
        process.stdout.write('--- stdout ---\n');
        process.stdout.write(`${_pyRstrip(result.stdout)}\n`);
    }
    if (result.stderr) {
        process.stdout.write('--- stderr ---\n');
        process.stdout.write(`${_pyRstrip(result.stderr)}\n`);
    }
}

// --- argparse emulation ------------------------------------------------------

const PROG = 'runtime_dispatcher';

const _TOP_USAGE =
    `usage: ${PROG} [-h] [--skill SKILL] [--root ROOT]\n` +
    `                             [--format {text,json}]\n` +
    `                             {resolve,run} ...\n`;

interface Args {
    action: string | null;
    skill: string | null;
    root: string;
    cwd: string | null;
    format: 'text' | 'json';
    output: string | null;
}

/** Emit a top-level argparse error to stderr and exit 2. */
function _topError(message: string): never {
    process.stderr.write(_TOP_USAGE);
    process.stderr.write(`${PROG}: error: ${message}\n`);
    process.exitCode = 2;
    throw new _ArgExit();
}

/** Emit a subparser argparse error to stderr and exit 2. */
function _subError(action: string, usage: string, message: string): never {
    process.stderr.write(usage);
    process.stderr.write(`${PROG} ${action}: error: ${message}\n`);
    process.exitCode = 2;
    throw new _ArgExit();
}

/** Sentinel thrown to unwind the call stack after an argparse-style exit. */
class _ArgExit extends Error {}

const _RESOLVE_USAGE =
    `usage: ${PROG} resolve [-h] --skill SKILL [--root ROOT]\n` +
    `                                     [--format {text,json}]\n`;

const _RUN_USAGE =
    `usage: ${PROG} run [-h] --skill SKILL [--root ROOT] [--cwd CWD]\n` +
    `                                 [--format {text,json}] [--output OUTPUT]\n`;

function _parseFormat(action: string | null, usage: string, value: string | undefined): 'text' | 'json' {
    if (value !== 'text' && value !== 'json') {
        const choice = value === undefined ? 'None' : `'${value}'`;
        const msg = `argument --format: invalid choice: ${choice} (choose from 'text', 'json')`;
        if (action === null) {
            _topError(msg);
        }
        _subError(action, usage, msg);
    }
    return value;
}

/** Mirror argparse parsing — flat flags + `resolve` / `run` subcommands. */
function parseArgs(argv: string[]): Args {
    const out: Args = { action: null, skill: null, root: '.', cwd: null, format: 'text', output: null };

    // Determine whether the first positional token selects a subcommand.
    let i = 0;
    let action: string | null = null;
    let usage = _TOP_USAGE;
    if (argv.length > 0 && !(argv[0] as string).startsWith('-')) {
        const first = argv[0] as string;
        if (first !== 'resolve' && first !== 'run') {
            _topError(
                `argument {resolve,run}: invalid choice: '${first}' (choose from 'resolve', 'run')`,
            );
        }
        action = first;
        out.action = first;
        usage = first === 'resolve' ? _RESOLVE_USAGE : _RUN_USAGE;
        i = 1;
    }

    const valueOf = (a: string, eqPrefix: string): string | undefined => {
        if (a.startsWith(eqPrefix)) {
            return a.slice(eqPrefix.length);
        }
        const next = argv[(i += 1)];
        return next;
    };
    const errFn = (msg: string): never => (action === null ? _topError(msg) : _subError(action, usage, msg));

    for (; i < argv.length; i += 1) {
        const a = argv[i] as string;
        if (a === '--skill' || a.startsWith('--skill=')) {
            const v = valueOf(a, '--skill=');
            if (v === undefined) {
                errFn('argument --skill: expected one argument');
            }
            out.skill = v as string;
        } else if (a === '--root' || a.startsWith('--root=')) {
            const v = valueOf(a, '--root=');
            if (v === undefined) {
                errFn('argument --root: expected one argument');
            }
            out.root = v as string;
        } else if (a === '--cwd' || a.startsWith('--cwd=')) {
            if (action !== 'run') {
                errFn(`unrecognized arguments: ${a}`);
            }
            const v = valueOf(a, '--cwd=');
            if (v === undefined) {
                errFn('argument --cwd: expected one argument');
            }
            out.cwd = v as string;
        } else if (a === '--output' || a.startsWith('--output=')) {
            if (action !== 'run') {
                errFn(`unrecognized arguments: ${a}`);
            }
            const v = valueOf(a, '--output=');
            if (v === undefined) {
                errFn('argument --output: expected one argument');
            }
            out.output = v as string;
        } else if (a === '--format' || a.startsWith('--format=')) {
            const v = a.startsWith('--format=') ? a.slice('--format='.length) : argv[(i += 1)];
            out.format = _parseFormat(action, usage, v);
        } else {
            errFn(`unrecognized arguments: ${a}`);
        }
    }

    // resolve / run subparsers mark --skill required.
    if (action === 'resolve' && out.skill === null) {
        _subError('resolve', _RESOLVE_USAGE, 'the following arguments are required: --skill');
    }
    if (action === 'run' && out.skill === null) {
        _subError('run', _RUN_USAGE, 'the following arguments are required: --skill');
    }

    return out;
}

export function main(argv: string[]): number {
    const args = parseArgs(argv);

    const action = args.action ?? 'resolve';
    if (action === 'resolve' && !args.skill) {
        _topError('--skill is required for resolve');
    }

    const registry = build_registry(args.root);

    if (action === 'run') {
        const cwd = args.cwd !== null ? args.cwd : args.root;
        let result: ExecutionResult;
        try {
            result = run(args.skill as string, registry, cwd);
        } catch (exc) {
            if (exc instanceof HandlerError) {
                process.stderr.write(`HandlerError: ${exc.message}\n`);
                return 2;
            }
            throw exc;
        }
        _printExecution(result, args.format);
        const output = args.output;
        if (output !== null) {
            fs.mkdirSync(path.dirname(output), { recursive: true });
            fs.writeFileSync(
                output,
                `${pyJsonDumpsIndent2(_executionResultAsdict(result) as Json)}\n`,
                { encoding: 'utf-8' },
            );
        }
        return result.is_success ? 0 : 1;
    }

    const result = dispatch(args.skill as string, registry);
    _printDispatch(result, args.format);
    return result.request.is_ready || result.request.status === 'blocked' ? 0 : 1;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    try {
        process.exitCode = main(process.argv.slice(2));
    } catch (err) {
        if (!(err instanceof _ArgExit)) {
            throw err;
        }
        // process.exitCode already set to 2 by the argparse-style error path.
    }
}
