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
    const opts: GuiCommandOptions = {
        ...(typeof raw.port === 'string' ? { port: Number.parseInt(raw.port, 10) } : {}),
        ...(typeof raw.idle === 'string' ? { idle: Number.parseInt(raw.idle, 10) } : {}),
        ...(raw.open === false ? { noOpen: true } : {}),
    };

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
    });

    // Long-lived: wait for SIGINT / SIGTERM (Python supervisor closes
    // the pipe and propagates the signal) or for the idle-timer to fire
    // and self-terminate. handle.close() runs clearPidFile.
    await done;
    return 0;
}
