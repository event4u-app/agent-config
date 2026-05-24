/**
 * Explain-trace execution layer for the browser-wizard.
 *
 * Phase 2 of road-to-ai-os-product-ui. The GUI shells out to the
 * existing `agent-config explain last --json` CLI so the wire format
 * (ExplainTrace v1 — see docs/contracts/explain-trace.schema.json) is
 * the single source of truth. PII / absolute-path scrubbing already
 * happens in `scripts/_cli/explain_last/build_trace.py`; the GUI never
 * touches `.work-state.json` directly.
 *
 *   • spawn without shell  (no shell-meta interpolation)
 *   • wall-clock cap (TIMEOUT_MS)
 *   • exit-code → HTTP status mapping owned by the caller
 *   • injectable via ApiContext.explainRunner for test fakes
 */

import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

/** Wire payload returned by a successful `explain last --json`. */
export type ExplainTrace = Readonly<Record<string, unknown>>;

/** Result of one CLI invocation. */
export type ExplainResult =
    | { readonly kind: 'ok'; readonly trace: ExplainTrace }
    | { readonly kind: 'not_found'; readonly stderr: string }
    | { readonly kind: 'error'; readonly exitCode: number; readonly stderr: string; readonly stdout: string };

/** Signature accepted by the API handler. Tests inject fakes. */
export type ExplainRunner = (projectRoot: string, packageRoot: string) => Promise<ExplainResult>;

const TIMEOUT_MS = 15_000;
const STDOUT_CAP = 1 * 1024 * 1024; // 1 MiB

/**
 * Default runner — spawns `node <packageRoot>/dist/cli/agent-config.js
 * explain last --json` from the consumer's project root. The CLI prints
 * the trace JSON on stdout (exit 0) or a `❌ explain last: …` line on
 * stdout (exit 1 = state file missing).
 */
export const defaultExplainRunner: ExplainRunner = async (projectRoot, packageRoot) => {
    const cli = resolve(packageRoot, 'dist', 'cli', 'agent-config.js');
    return new Promise((resolveResult) => {
        const child = spawn('node', [cli, 'explain', 'last', '--json'], {
            cwd: projectRoot,
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
                resolveResult({ kind: 'not_found', stderr: stdout || stderr });
                return;
            }
            if (exitCode !== 0) {
                resolveResult({ kind: 'error', exitCode, stderr, stdout });
                return;
            }
            const trimmed = stdout.trim();
            if (trimmed.length === 0) {
                resolveResult({ kind: 'error', exitCode: 0, stderr: 'empty_stdout', stdout });
                return;
            }
            try {
                const parsed = JSON.parse(trimmed) as unknown;
                if (parsed === null || typeof parsed !== 'object') {
                    resolveResult({ kind: 'error', exitCode: 0, stderr: 'non_object_payload', stdout: trimmed.slice(0, 256) });
                    return;
                }
                resolveResult({ kind: 'ok', trace: parsed as ExplainTrace });
            } catch (err) {
                resolveResult({
                    kind: 'error',
                    exitCode: 0,
                    stderr: `json_parse_failed: ${(err as Error).message}`,
                    stdout: trimmed.slice(0, 256),
                });
            }
        });
    });
};
