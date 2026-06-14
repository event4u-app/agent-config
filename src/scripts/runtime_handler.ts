#!/usr/bin/env tsx
/**
 * Runtime Handler — executes a skill's declared command and captures the result.
 *
 * TypeScript twin of `src/scripts/runtime_handler.py` (ADR-096, Phase 8 /
 * Wave 8h). Library module imported by the still-Python `runtime_dispatcher`
 * (the `.py` stays in place); this `.ts` twin sits beside it. Mirrors the
 * Python public surface EXACTLY — `DEFAULT_ENV_ALLOWLIST`, `ExecutionResult`,
 * `HandlerError`, `_build_env`, `execute_shell` — and the byte-identical
 * `HandlerError` messages and `ExecutionResult` field semantics. No behaviour
 * changes.
 *
 * This is the first real execution path in the runtime layer. It consumes a
 * SkillRuntime (from the registry), runs its `command` argv through the
 * appropriate handler, and returns a typed ExecutionResult.
 *
 * Responsibilities:
 * - Shell-out safely: no shell=True, argv form only
 * - Enforce timeout (SkillRuntime.timeout_seconds)
 * - Capture stdout, stderr, exit code, wall-clock duration
 * - Scrub environment to an allowlist
 * - Resolve working directory relative to repository root
 *
 * Out of scope (remain in scaffold layers for now):
 * - php/node handlers beyond running their binaries
 * - tool registry integration
 * - streaming output
 */
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import process from 'node:process';

import { SkillRuntime } from './runtime_registry.js';

// Environment variables that are always forwarded to the child process.
// Kept deliberately narrow — no credentials, no shell config, no auth tokens.
export const DEFAULT_ENV_ALLOWLIST: readonly string[] = [
    'PATH',
    'HOME',
    'LANG',
    'LC_ALL',
    'LC_CTYPE',
    'TZ',
    'TMPDIR',
    'PYTHONPATH',
    'PYTHONDONTWRITEBYTECODE',
];

/** Typed result of a real command execution. */
export class ExecutionResult {
    readonly skill_name: string;

    readonly handler: string;

    readonly command: string[];

    readonly cwd: string;

    readonly exit_code: number;

    readonly stdout: string;

    readonly stderr: string;

    readonly duration_ms: number;

    readonly status: string; // "success" | "failure" | "timeout" | "error"

    readonly timed_out: boolean;

    readonly error: string | null;

    readonly artifacts: string[];

    constructor(args: {
        skill_name: string;
        handler: string;
        command: string[];
        cwd: string;
        exit_code: number;
        stdout: string;
        stderr: string;
        duration_ms: number;
        status: string;
        timed_out?: boolean;
        error?: string | null;
        artifacts?: string[];
    }) {
        this.skill_name = args.skill_name;
        this.handler = args.handler;
        this.command = args.command;
        this.cwd = args.cwd;
        this.exit_code = args.exit_code;
        this.stdout = args.stdout;
        this.stderr = args.stderr;
        this.duration_ms = args.duration_ms;
        this.status = args.status;
        this.timed_out = args.timed_out ?? false;
        this.error = args.error ?? null;
        this.artifacts = args.artifacts ?? [];
    }

    get is_success(): boolean {
        return this.status === 'success';
    }
}

/** Raised when a handler cannot execute for structural reasons. */
export class HandlerError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'HandlerError';
    }
}

/** Build a scrubbed environment dict from the allowlist. */
export function _build_env(allowlist: readonly string[] = DEFAULT_ENV_ALLOWLIST): Record<string, string> {
    const env: Record<string, string> = {};
    for (const key of allowlist) {
        const value = process.env[key];
        if (value !== undefined) {
            env[key] = value;
        }
    }
    // Guarantee a minimum PATH so subprocess can find binaries.
    if (env.PATH === undefined) {
        env.PATH = '/usr/local/bin:/usr/bin:/bin';
    }
    return env;
}

/** Mirror `time.monotonic()` in milliseconds (high-resolution). */
function _monotonicMs(): number {
    return Number(process.hrtime.bigint() / 1000000n);
}

/** Run a skill's command as a subprocess and capture the result. */
export function execute_shell(
    skill: SkillRuntime,
    cwd: string,
    env_allowlist: readonly string[] = DEFAULT_ENV_ALLOWLIST,
): ExecutionResult {
    if (skill.command.length === 0) {
        throw new HandlerError(`Skill '${skill.name}' has no 'command' declared — cannot execute`);
    }
    if (!(skill.handler === 'shell' || skill.handler === 'php' || skill.handler === 'node')) {
        throw new HandlerError(
            `Skill '${skill.name}' handler '${skill.handler}' is not a real-execution handler`,
        );
    }

    const env = _build_env(env_allowlist);
    const cwdStr = path.resolve(cwd);
    const start = _monotonicMs();

    const [program, ...rest] = skill.command;
    const completed = spawnSync(program as string, rest, {
        cwd: cwdStr,
        env,
        encoding: 'utf-8',
        timeout: skill.timeout_seconds * 1000,
        shell: false,
        maxBuffer: 256 * 1024 * 1024,
    });

    const durationMs = Math.trunc(_monotonicMs() - start);

    // subprocess.TimeoutExpired → status "timeout"
    if (completed.error && (completed.error as NodeJS.ErrnoException).code === 'ETIMEDOUT') {
        return new ExecutionResult({
            skill_name: skill.name,
            handler: skill.handler,
            command: [...skill.command],
            cwd: cwdStr,
            exit_code: -1,
            stdout: typeof completed.stdout === 'string' ? completed.stdout || '' : '',
            stderr: typeof completed.stderr === 'string' ? completed.stderr || '' : '',
            duration_ms: durationMs,
            status: 'timeout',
            timed_out: true,
            error: `Timed out after ${skill.timeout_seconds}s`,
        });
    }

    // FileNotFoundError → status "error"
    if (completed.error && (completed.error as NodeJS.ErrnoException).code === 'ENOENT') {
        const filename = (completed.error as NodeJS.ErrnoException & { path?: string }).path;
        return new ExecutionResult({
            skill_name: skill.name,
            handler: skill.handler,
            command: [...skill.command],
            cwd: cwdStr,
            exit_code: -1,
            stdout: '',
            stderr: '',
            duration_ms: durationMs,
            status: 'error',
            error: `Command not found: ${filename || (skill.command[0] as string)}`,
        });
    }

    if (completed.error) {
        // Other spawn errors surface like FileNotFoundError's structural failure.
        return new ExecutionResult({
            skill_name: skill.name,
            handler: skill.handler,
            command: [...skill.command],
            cwd: cwdStr,
            exit_code: -1,
            stdout: '',
            stderr: '',
            duration_ms: durationMs,
            status: 'error',
            error: `Command not found: ${skill.command[0] as string}`,
        });
    }

    const returncode = completed.status ?? -1;
    const status = returncode === 0 ? 'success' : 'failure';
    return new ExecutionResult({
        skill_name: skill.name,
        handler: skill.handler,
        command: [...skill.command],
        cwd: cwdStr,
        exit_code: returncode,
        stdout: completed.stdout || '',
        stderr: completed.stderr || '',
        duration_ms: durationMs,
        status,
    });
}
