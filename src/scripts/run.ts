#!/usr/bin/env tsx
/**
 * Migration dispatch wrapper (py2ts Phase 1, Step 4).
 *
 * Usage: run.ts <script-path-without-extension> [args...]
 *
 * Given a script path without extension (relative to the repo root, or
 * absolute), prefers `<path>.ts` (executed via tsx) and falls back to
 * `<path>.py` (executed via python3). Argv, stdin, stdout, stderr, and the
 * exit code pass through unchanged; SIGINT/SIGTERM are forwarded to the
 * child. Exits 127 when neither candidate exists.
 *
 * Zero output of its own on the happy path — callers parse the wrapped
 * script's output.
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';

/** Repo root = two levels above this file (<root>/src/scripts/run.ts). */
const REPO_ROOT = resolve(import.meta.dirname, '..', '..');

interface Invocation {
    readonly command: string;
    readonly args: readonly string[];
}

/**
 * Find the tsx binary by walking up from the directory containing the
 * script, preferring `node_modules/.bin/tsx` of the repo root that owns the
 * script; fall back to `npx tsx` when no local binary is found.
 */
function resolveTsxInvocation(scriptPath: string, scriptArgs: readonly string[]): Invocation {
    const binName = process.platform === 'win32' ? 'tsx.cmd' : 'tsx';
    let dir = dirname(scriptPath);
    for (;;) {
        const candidate = join(dir, 'node_modules', '.bin', binName);
        if (existsSync(candidate)) {
            return { command: candidate, args: [scriptPath, ...scriptArgs] };
        }
        const parent = dirname(dir);
        if (parent === dir) {
            break;
        }
        dir = parent;
    }
    return { command: 'npx', args: ['tsx', scriptPath, ...scriptArgs] };
}

function runChild(invocation: Invocation): void {
    const child = spawn(invocation.command, [...invocation.args], { stdio: 'inherit' });

    const forwardSignal = (signal: NodeJS.Signals): void => {
        child.kill(signal);
    };
    process.on('SIGINT', forwardSignal);
    process.on('SIGTERM', forwardSignal);

    child.on('error', (error: NodeJS.ErrnoException) => {
        process.stderr.write(`run.ts: failed to spawn ${invocation.command}: ${error.message}\n`);
        process.exit(127);
    });

    child.on('exit', (code: number | null, signal: NodeJS.Signals | null) => {
        process.off('SIGINT', forwardSignal);
        process.off('SIGTERM', forwardSignal);
        if (signal !== null) {
            // Re-raise the child's terminating signal so callers observe
            // the conventional 128+n exit status.
            process.kill(process.pid, signal);
            return;
        }
        process.exit(code ?? 1);
    });
}

function main(): void {
    const [scriptArg, ...scriptArgs] = process.argv.slice(2);
    if (scriptArg === undefined || scriptArg === '') {
        process.stderr.write('Usage: run.ts <script-path-without-extension> [args...]\n');
        process.exit(2);
    }

    const basePath = isAbsolute(scriptArg) ? scriptArg : resolve(REPO_ROOT, scriptArg);
    const tsCandidate = `${basePath}.ts`;
    const pyCandidate = `${basePath}.py`;

    if (existsSync(tsCandidate)) {
        runChild(resolveTsxInvocation(tsCandidate, scriptArgs));
        return;
    }
    if (existsSync(pyCandidate)) {
        runChild({ command: 'python3', args: [pyCandidate, ...scriptArgs] });
        return;
    }

    process.stderr.write(
        `run.ts: no script found for '${scriptArg}' — tried:\n  ${tsCandidate}\n  ${pyCandidate}\n`,
    );
    process.exit(127);
}

main();
