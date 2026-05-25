/**
 * Workspace-CLI bridge for the browser-wizard.
 *
 * Phases 4–8 of road-to-employee-product-and-external-proof. The GUI
 * shells out to the existing `workspace_*.py` modules under
 * `packages/core/installer/python/` so JSONL stores, role discovery,
 * documents, explain-mode rendering, analytics and at-rest encryption
 * all stay owned by Python.  This module owns spawn, timeout, and the
 * closed (module, subcommand) allowlist.
 *
 *   • spawn without shell  (no shell-meta interpolation)
 *   • per-call wall-clock cap (TIMEOUT_MS)
 *   • closed allowlist of (module, subcommand) pairs — no arbitrary args
 *   • stdout captured up to STDOUT_CAP; caller parses (JSON or lines)
 *   • injectable via ApiContext.workspaceRunner for test fakes
 */

import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

/** Closed module set. Anything else is rejected with `unknown_module`. */
export type WorkspaceModule =
    | 'sessions'
    | 'roles'
    | 'documents'
    | 'explain'
    | 'analytics';

/** Closed (module, subcommand) allowlist matching the Python argparse trees. */
export const WORKSPACE_ALLOWLIST: Readonly<Record<WorkspaceModule, readonly string[]>> = Object.freeze({
    sessions: ['start', 'append', 'list', 'read'],
    roles: ['list', 'tasks', 'show'],
    documents: ['create', 'save', 'list', 'read', 'export'],
    explain: ['render'],
    analytics: ['emit', 'show', 'prune'],
});

/** Result of one workspace CLI invocation. */
export type WorkspaceCallResult =
    | { readonly kind: 'ok'; readonly stdout: string; readonly stderr: string }
    | { readonly kind: 'not_found'; readonly stderr: string }
    | { readonly kind: 'error'; readonly exitCode: number; readonly stderr: string; readonly stdout: string };

/** Signature accepted by the API handler. Tests inject fakes. */
export type WorkspaceRunner = (
    packageRoot: string,
    module: WorkspaceModule,
    subcommand: string,
    args: readonly string[],
) => Promise<WorkspaceCallResult>;

const TIMEOUT_MS = 20_000;
const STDOUT_CAP = 2 * 1024 * 1024; // 2 MiB

/** True iff (module, subcommand) is on the closed allowlist. */
export function isAllowed(module: string, subcommand: string): module is WorkspaceModule {
    const subs = (WORKSPACE_ALLOWLIST as Record<string, readonly string[] | undefined>)[module];
    return subs !== undefined && subs.includes(subcommand);
}

/**
 * Default runner — spawns `python3 <packageRoot>/python/workspace_<module>.py
 * <subcommand> <args…>`. The Python module prints structured output
 * (JSON per line or plain text) on stdout (exit 0) or an error line on
 * stderr (exit 1 = domain error, e.g. unknown role / missing document).
 */
export const defaultWorkspaceRunner: WorkspaceRunner = async (packageRoot, module, subcommand, args) => {
    if (!isAllowed(module, subcommand)) {
        return { kind: 'error', exitCode: -1, stderr: `disallowed:${module}/${subcommand}`, stdout: '' };
    }
    const script = resolve(packageRoot, 'python', `workspace_${module}.py`);
    const pythonBin = process.env['AGENT_CONFIG_PYTHON'] ?? 'python3';
    return new Promise((resolveResult) => {
        const child = spawn(pythonBin, [script, subcommand, ...args], {
            cwd: packageRoot,
            env: process.env,
            stdio: ['ignore', 'pipe', 'pipe'],
            shell: false,
        });
        let stdout = '';
        let stderr = '';
        let killed = false;
        const timer = setTimeout(() => {
            killed = true;
            try { child.kill('SIGTERM'); } catch { /* ignore */ }
        }, TIMEOUT_MS);
        child.stdout.on('data', (c: Buffer) => {
            if (stdout.length < STDOUT_CAP) stdout += c.toString('utf8');
        });
        child.stderr.on('data', (c: Buffer) => { stderr += c.toString('utf8'); });
        child.on('error', (err) => {
            clearTimeout(timer);
            resolveResult({ kind: 'error', exitCode: -1, stderr: err.message, stdout });
        });
        child.on('close', (code) => {
            clearTimeout(timer);
            const exitCode = code ?? -1;
            if (killed) {
                resolveResult({ kind: 'error', exitCode: -1, stderr: stderr || 'timeout', stdout });
                return;
            }
            if (exitCode === 1) {
                // Python module exits 1 on domain errors (unknown role, missing
                // document). Surface as not_found so callers can 404 cleanly.
                resolveResult({ kind: 'not_found', stderr: stderr || stdout });
                return;
            }
            if (exitCode !== 0) {
                resolveResult({ kind: 'error', exitCode, stderr, stdout });
                return;
            }
            resolveResult({ kind: 'ok', stdout, stderr });
        });
    });
};

/** Helper — parse a JSONL stdout payload (one JSON object per line). */
export function parseJsonLines<T = unknown>(stdout: string): T[] {
    const out: T[] = [];
    for (const line of stdout.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.length === 0) continue;
        try {
            out.push(JSON.parse(trimmed) as T);
        } catch { /* skip non-JSON banner lines */ }
    }
    return out;
}

/** Helper — parse a single JSON object from stdout (or null on failure). */
export function parseJsonObject<T = unknown>(stdout: string): T | null {
    const trimmed = stdout.trim();
    if (trimmed.length === 0) return null;
    try {
        return JSON.parse(trimmed) as T;
    } catch {
        return null;
    }
}
