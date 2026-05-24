/**
 * Cloudflare Worker entry — install-funnel telemetry receiver.
 *
 * Routes:
 *   POST /install-event   — accept one stage event
 *   GET  /healthz         — liveness probe (no auth, no KV)
 *
 * Anything else → `404`. The worker never logs request bodies and
 * never reads `cf-connecting-ip`. See `README.md § What it explicitly
 * does NOT do`.
 */

import { bumpAggregate } from './aggregate.js';
import { verifySignature } from './hmac.js';
import { eventKey } from './kv-keys.js';
import { bumpSession, newSessionId, readSession } from './session.js';
import {
    EVENT_TTL_SECONDS,
    MAX_BODY_BYTES,
    type InstallStageEvent,
    type WorkerEnv,
} from './types.js';
import { validateEvent } from './validate.js';

export default {
    async fetch(req: Request, env: WorkerEnv): Promise<Response> {
        const url = new URL(req.url);
        if (req.method === 'GET' && url.pathname === '/healthz') {
            return json({ ok: true }, 200);
        }
        if (req.method !== 'POST' || url.pathname !== '/install-event') {
            return json({ error: 'not found' }, 404);
        }
        return handleInstallEvent(req, env);
    },
};

async function handleInstallEvent(req: Request, env: WorkerEnv): Promise<Response> {
    const signature = req.headers.get('x-install-sig') ?? '';
    if (signature.length === 0) return json({ error: 'missing signature' }, 401);

    const body = await readBoundedBody(req);
    if (body === 'too_large') return json({ error: 'body too large' }, 413);
    if (body === null) return json({ error: 'invalid body' }, 400);

    let parsed: unknown;
    try {
        parsed = JSON.parse(body);
    } catch {
        return json({ error: 'invalid JSON' }, 400);
    }

    const result = validateEvent(parsed);
    if (!result.ok) return json({ error: result.reason }, 400);

    const event = result.event;

    const sigOk = await verifySignature(env, event.entry_path, body, signature);
    if (!sigOk) return json({ error: 'invalid signature' }, 401);

    const sessionId = event.session_id ?? newSessionId();
    const previous = event.session_id !== undefined
        ? await readSession(env.TELEMETRY_KV, sessionId)
        : null;

    const bump = await bumpSession(env.TELEMETRY_KV, sessionId, previous);
    if (!bump.accepted) {
        return json({ error: 'session rate limit' }, 429);
    }

    await persistEvent(env, sessionId, event);
    await bumpAggregate(env.TELEMETRY_KV, event, new Date());

    if (event.session_id === undefined) {
        return json({ session_id: sessionId }, 200);
    }
    return new Response(null, { status: 204 });
}

async function persistEvent(
    env: WorkerEnv,
    sessionId: string,
    event: InstallStageEvent,
): Promise<void> {
    const stored = { ...event, session_id: sessionId };
    await env.TELEMETRY_KV.put(
        eventKey(sessionId, event.stage),
        JSON.stringify(stored),
        { expirationTtl: EVENT_TTL_SECONDS },
    );
}

async function readBoundedBody(req: Request): Promise<string | null | 'too_large'> {
    const declared = req.headers.get('content-length');
    if (declared !== null) {
        const declaredBytes = Number.parseInt(declared, 10);
        if (Number.isFinite(declaredBytes) && declaredBytes > MAX_BODY_BYTES) {
            return 'too_large';
        }
    }
    const text = await req.text();
    if (text.length > MAX_BODY_BYTES) return 'too_large';
    if (text.length === 0) return null;
    return text;
}

function json(body: unknown, status: number): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json; charset=utf-8' },
    });
}
