/**
 * Fastify app factory for the local server.
 *
 * Security stance — council security-engineer mandate:
 *
 *   1. Bind to 127.0.0.1 only (enforced by the caller in
 *      `src/cli/commands/uiServe.ts`).
 *   2. `Host` header must be `127.0.0.1:<port>` or
 *      `localhost:<port>`. Rejected with HTTP 421 otherwise.
 *   3. `Origin` header (when present) must be the same origin as
 *      the server. Rejected with HTTP 403 otherwise.
 *   4. `/api/*` routes require `Authorization: Bearer <token>` or
 *      a `token=<token>` query parameter. Rejected with HTTP 401
 *      otherwise. The token is minted per process by
 *      `src/server/token.ts`.
 *
 * Static files under `/` (the Vite UI bundle) are served without
 * auth so the browser can bootstrap. The UI then includes the token
 * on every API call.
 */

import Fastify, { type FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import { tokensMatch } from './token.js';
import { pingRoute } from './routes/ping.js';

export interface CreateAppOptions {
    projectRoot: string;
    uiDistDir: string;
    /** Per-process token required on /api/* routes. */
    token: string;
    /** Port the server will listen on — used to validate Host header. */
    expectedPort: number;
    /** Override the Fastify logger level (defaults to `warn`). */
    logLevel?: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
}

const ALLOWED_HOSTS = (port: number): ReadonlySet<string> =>
    new Set([`127.0.0.1:${port}`, `localhost:${port}`]);

const ALLOWED_ORIGINS = (port: number): ReadonlySet<string> =>
    new Set([`http://127.0.0.1:${port}`, `http://localhost:${port}`]);

function extractToken(authHeader: string | undefined, queryToken: string | undefined): string | null {
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
        return authHeader.slice('Bearer '.length).trim();
    }
    if (typeof queryToken === 'string' && queryToken.length > 0) return queryToken;
    return null;
}

export async function createApp(opts: CreateAppOptions): Promise<FastifyInstance> {
    const app = Fastify({
        logger: { level: opts.logLevel ?? (process.env.AGENT_CONFIG_LOG ?? 'warn') },
    });

    const allowedHosts = ALLOWED_HOSTS(opts.expectedPort);
    const allowedOrigins = ALLOWED_ORIGINS(opts.expectedPort);

    // Host-header guard (CSRF defence-in-depth — runs on every request).
    app.addHook('onRequest', async (request, reply) => {
        const host = request.headers.host;
        if (typeof host !== 'string' || !allowedHosts.has(host)) {
            await reply.code(421).send({ error: 'Misdirected Request: invalid Host header' });
            return reply;
        }
        return undefined;
    });

    // Origin allow-list (browser-issued requests only — server-to-server
    // skips this header).
    app.addHook('onRequest', async (request, reply) => {
        const origin = request.headers.origin;
        if (typeof origin === 'string' && !allowedOrigins.has(origin)) {
            await reply.code(403).send({ error: 'Forbidden: origin not allowed' });
            return reply;
        }
        return undefined;
    });

    // Bearer-token gate for /api/*. Static UI files are NOT gated so
    // the browser can bootstrap and read the token from the page URL.
    app.addHook('onRequest', async (request, reply) => {
        if (!request.url.startsWith('/api/')) return undefined;
        const query = request.query as Record<string, unknown> | undefined;
        const queryToken = typeof query?.['token'] === 'string' ? (query['token'] as string) : undefined;
        const provided = extractToken(request.headers.authorization, queryToken);
        if (provided === null || !tokensMatch(provided, opts.token)) {
            await reply.code(401).send({ error: 'Unauthorized: missing or invalid token' });
            return reply;
        }
        return undefined;
    });

    await app.register(fastifyStatic, {
        root: opts.uiDistDir,
        prefix: '/',
        decorateReply: false,
    });

    await app.register(pingRoute({ projectRoot: opts.projectRoot }));

    return app;
}
