/**
 * `gui` command — boot the browser-wizard server without re-running the
 * install plan. Distinct from `init --gui`, which runs the installer
 * first and then opens the GUI.
 *
 * This entry exists so `scripts/install.py` can spawn the wizard at the
 * tail of a freshly-completed install: the install already ran in
 * Python; the GUI parent is purely the long-lived HTTP server. The
 * Python supervisor parses the first `WIZARD_READY url=…` line on
 * stdout (server.ts) to learn the URL.
 *
 * Roadmap: `agents/roadmaps/wizard-install-py-wiring.md` Step 1.
 * Council: `agents/runtime/council/responses/wizard-wiring-2026-05-22.synthesis.md`.
 */

import { isAbsolute, resolve as resolvePath } from 'node:path';
import type { SharedFlags } from '../cli.js';

export interface GuiCommandOptions {
    readonly port?: number;
    readonly idle?: number;
    readonly noOpen?: boolean;
    /**
     * Bind address. Default `127.0.0.1` (loopback). Operators set this to
     * `0.0.0.0` (or a specific NIC) for container deployments. When
     * non-loopback, `allowedHosts` MUST be set or the server refuses to
     * boot. ADR-021 § Security.
     */
    readonly host?: string;
    /** Comma-separated host:port allowlist (overrides the loopback default). */
    readonly allowedHosts?: string;
}

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);

function resolveHost(raw: Record<string, unknown>): string {
    if (typeof raw.host === 'string' && raw.host !== '') return raw.host;
    const env = process.env['BIND_HOST'];
    if (typeof env === 'string' && env !== '') return env;
    return '127.0.0.1';
}

function resolveAllowedHosts(raw: Record<string, unknown>): string | undefined {
    if (typeof raw.allowedHosts === 'string' && raw.allowedHosts !== '') return raw.allowedHosts;
    const env = process.env['ALLOWED_HOSTS'];
    if (typeof env === 'string' && env !== '') return env;
    return undefined;
}

/** Reject roots that would let a stray invocation scribble on the OS. */
const FORBIDDEN_ROOTS = new Set(['/', '/etc', '/usr', '/sys', '/proc', '/bin', '/sbin', '/dev', '/var']);

function validateProjectRoot(raw: string): string {
    if (typeof raw !== 'string' || raw === '') {
        throw new Error('gui: --project-root is required (or pass via shared flag)');
    }
    if (!isAbsolute(raw)) {
        throw new Error(`gui: --project-root must be absolute, got ${raw}`);
    }
    const abs = resolvePath(raw);
    if (FORBIDDEN_ROOTS.has(abs)) {
        throw new Error(`gui: --project-root refuses to operate on system directory ${abs}`);
    }
    return abs;
}

export async function runGui(
    shared: SharedFlags,
    raw: Record<string, unknown>,
): Promise<number> {
    const host = resolveHost(raw);
    const allowedHostsRaw = resolveAllowedHosts(raw);
    const opts: GuiCommandOptions = {
        ...(typeof raw.port === 'string' ? { port: Number.parseInt(raw.port, 10) } : {}),
        ...(typeof raw.idle === 'string' ? { idle: Number.parseInt(raw.idle, 10) } : {}),
        ...(raw.open === false ? { noOpen: true } : {}),
        host,
        ...(allowedHostsRaw !== undefined ? { allowedHosts: allowedHostsRaw } : {}),
    };

    // Defense-in-depth: refuse non-loopback bind without an explicit
    // ALLOWED_HOSTS allowlist. The server enforces the same check, but
    // failing early at the CLI surface is easier to read than a deep
    // listen() error. ADR-021 § Security.
    if (!LOOPBACK_HOSTS.has(host) && allowedHostsRaw === undefined) {
        throw new Error(
            `gui: --host=${host} requires --allowed-hosts (or ALLOWED_HOSTS env). ` +
                'Set the comma-separated host:port allowlist the wizard will accept on the Host header. ' +
                'See docs/deploy/env-vars.md and ADR-021.',
        );
    }

    const projectRoot = validateProjectRoot(shared.projectRoot);

    const { startGuiServer } = await import('../gui/server.js');
    type Handle = Awaited<ReturnType<typeof startGuiServer>>;

    // Register signal handlers BEFORE booting the server. startGuiServer
    // prints WIZARD_READY on stdout once it's listening; if the parent
    // supervisor (Python install.py or a test harness) reads that line
    // and sends SIGINT before this process has installed its handler,
    // Node's default action terminates the child without clearing the
    // PID file. Pre-registration closes that race window. The handler
    // captures `handle` by closure once it's assigned below.
    let handle: Handle | undefined;
    let resolveDone!: () => void;
    const done = new Promise<void>((r) => { resolveDone = r; });
    const onSig = (): void => {
        if (handle === undefined) {
            resolveDone();
            return;
        }
        void handle.close().then(resolveDone);
    };
    process.once('SIGINT', onSig);
    process.once('SIGTERM', onSig);

    handle = await startGuiServer({
        projectRoot,
        ...(shared.manifestPath !== undefined ? { manifestPath: shared.manifestPath } : {}),
        ...(opts.port !== undefined && Number.isFinite(opts.port) ? { port: opts.port } : {}),
        ...(opts.idle !== undefined && Number.isFinite(opts.idle) && opts.idle > 0 ? { idleSeconds: opts.idle } : {}),
        ...(opts.noOpen === true ? { noOpen: true } : {}),
        host: opts.host ?? '127.0.0.1',
        ...(opts.allowedHosts !== undefined
            ? { allowedHosts: opts.allowedHosts.split(',').map((s) => s.trim()).filter((s) => s.length > 0) }
            : {}),
    });

    // Long-lived: wait for SIGINT / SIGTERM (Python supervisor closes
    // the pipe and propagates the signal) or for the idle-timer to fire
    // and self-terminate. handle.close() runs clearPidFile.
    await done;
    return 0;
}
