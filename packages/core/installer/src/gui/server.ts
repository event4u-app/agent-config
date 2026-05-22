/**
 * Browser-wizard HTTP server.
 *
 * Phase 6 of the monorepo migration. The server is a thin localhost
 * shell around the existing agent-mode protocol (ADR-016 § 4): every
 * GUI click is translated into the same JSON envelope the CLI emits.
 * The server itself owns only three pieces of mutable state:
 *
 *   1. The CSRF token (one per server lifetime).
 *   2. The transaction log path (one per `apply` flow).
 *   3. The idle timer (reset on every HTTP request).
 *
 * Everything else is computed on demand from the manifest + answers.
 */

import { spawn } from 'node:child_process';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { platform } from 'node:os';
import { loadManifest } from '../manifest-loader.js';
import type { LoadedManifest } from '../manifest-loader.js';
import { handleApi, type ApiContext } from './handlers.js';
import { clearPidFile, inspectPidFile, writePidFile } from './pid-file.js';
import { CSP_HEADER, buildAllowedHosts, buildAllowedOrigins, generateCsrfToken, isHostAllowed, isOriginAllowed } from './security.js';
import { serveStatic } from './static-assets.js';
import type { GuiServerHandle, GuiServerOptions } from './types.js';

const DEFAULT_IDLE_SECONDS = 600;

/** Boot a localhost HTTP server. Resolves once `listen()` succeeds. */
export async function startGuiServer(opts: GuiServerOptions): Promise<GuiServerHandle> {
    const stdout = opts.stdout ?? process.stdout;

    const pid = inspectPidFile(opts.projectRoot);
    if (pid.conflict) {
        throw new Error(
            `GUI server already running (pid ${pid.conflictingPid ?? '?'}); ` +
            `stop it or delete ${pid.path} before retrying.`,
        );
    }

    const loaded = loadManifest({
        searchFrom: opts.projectRoot,
        ...(opts.manifestPath !== undefined ? { path: opts.manifestPath } : {}),
    });

    const csrfToken = generateCsrfToken();
    const idleMs = (opts.idleSeconds ?? DEFAULT_IDLE_SECONDS) * 1000;
    let idleTimer: NodeJS.Timeout | undefined;
    let closed = false;

    const server: Server = createServer((req, res) => {
        resetIdle();
        handleRequest(req, res, csrfToken, loaded, opts);
    });

    await listen(server, opts.port ?? 0);
    const port = (server.address() as AddressInfo).port;
    const url = `http://127.0.0.1:${port}/`;
    const pidFile = writePidFile(opts.projectRoot);

    stdout.write(`GUI server listening on ${url} (csrf token issued, pid ${process.pid})\n`);

    function resetIdle(): void {
        if (idleTimer !== undefined) clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
            stdout.write(`GUI server idle for ${opts.idleSeconds ?? DEFAULT_IDLE_SECONDS}s; shutting down.\n`);
            void close();
        }, idleMs);
        idleTimer.unref();
    }
    resetIdle();

    async function close(): Promise<void> {
        if (closed) return;
        closed = true;
        if (idleTimer !== undefined) clearTimeout(idleTimer);
        await new Promise<void>((resolve) => server.close(() => resolve()));
        clearPidFile(opts.projectRoot);
    }

    if (opts.noOpen !== true) {
        try {
            (opts.openBrowser ?? defaultOpenBrowser)(url);
        } catch (err) {
            stdout.write(`(could not open browser: ${(err as Error).message}; visit ${url} manually)\n`);
        }
    }

    return { url, port, csrfToken, pidFile, close };
}

function listen(server: Server, port: number): Promise<void> {
    return new Promise((resolve, reject) => {
        const onError = (err: Error): void => {
            server.off('listening', onListening);
            reject(err);
        };
        const onListening = (): void => {
            server.off('error', onError);
            resolve();
        };
        server.once('error', onError);
        server.once('listening', onListening);
        server.listen({ host: '127.0.0.1', port });
    });
}

function handleRequest(
    req: IncomingMessage,
    res: ServerResponse,
    csrfToken: string,
    loaded: LoadedManifest,
    opts: GuiServerOptions,
): void {
    const port = (req.socket.localPort as number | null) ?? 0;
    const allowedHosts = buildAllowedHosts(port);
    const allowedOrigins = buildAllowedOrigins(port);
    res.setHeader('Content-Security-Policy', CSP_HEADER);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');

    if (!isHostAllowed(req.headers.host, allowedHosts)) {
        res.statusCode = 403;
        res.end('forbidden: host header not allowed');
        return;
    }
    const url = req.url ?? '/';
    if (url.startsWith('/api/')) {
        if (req.method !== 'GET' && !isOriginAllowed(req.headers.origin, allowedOrigins)) {
            res.statusCode = 403;
            res.end('forbidden: origin header not allowed');
            return;
        }
        const ctx: ApiContext = { csrfToken, loaded, projectRoot: opts.projectRoot };
        void handleApi(req, res, ctx);
        return;
    }
    if (!serveStatic(req, res, csrfToken)) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end('not found');
    }
}

function defaultOpenBrowser(url: string): void {
    // Stdlib-only: pick the OS opener and detach. Failure is non-fatal —
    // the caller already printed the URL so the user can copy it.
    const p = platform();
    const cmd = p === 'darwin' ? 'open' : p === 'win32' ? 'cmd' : 'xdg-open';
    const args = p === 'win32' ? ['/c', 'start', '""', url] : [url];
    const child = spawn(cmd, args, { stdio: 'ignore', detached: true });
    child.on('error', () => undefined);
    child.unref();
}
