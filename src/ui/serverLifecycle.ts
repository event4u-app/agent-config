/**
 * Browser→server lifecycle: keep the local server alive while this page is
 * open, and ask it to shut down the moment the window/tab closes.
 *
 * Two cooperating signals (server side lives in `src/server/app.ts`
 * `idleShutdown`):
 *
 *   1. Heartbeat — a periodic authed `GET /api/v1/ping` marks the client
 *      alive and arms/refreshes the server's idle backstop.
 *   2. Shutdown beacon — on `pagehide` we fire
 *      `navigator.sendBeacon('/api/v1/shutdown?token=…')` so the server
 *      exits immediately when the user closes the window. `sendBeacon`
 *      cannot set an `Authorization` header, so the token rides as a
 *      query param (the server's auth gate accepts `?token=`).
 *
 * No-ops cleanly when run outside a browser (SSR / tests).
 */

import { apiFetch } from './api.js';

const HEARTBEAT_INTERVAL_MS = 10_000;

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let shutdownSent = false;

function sendShutdownBeacon(token: string): void {
    if (shutdownSent) return;
    shutdownSent = true;
    if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') return;
    try {
        navigator.sendBeacon(`/api/v1/shutdown?token=${encodeURIComponent(token)}`);
    } catch {
        // Best-effort: a failed beacon falls back to the server idle backstop.
    }
}

/**
 * Start the heartbeat and register the shutdown beacon. Call once after the
 * auth token is set. Returns a teardown function (used by tests; the
 * production entry never needs it).
 */
export function startServerLifecycle(token: string): () => void {
    if (typeof window === 'undefined') return () => {};

    heartbeatTimer = setInterval(() => {
        // Fire-and-forget; a transient failure must not surface to the user.
        void apiFetch('/api/v1/ping').catch(() => {});
    }, HEARTBEAT_INTERVAL_MS);

    const onHide = (): void => sendShutdownBeacon(token);
    // `pagehide` fires on close, navigation, and bfcache eviction — more
    // reliable than `beforeunload` across browsers.
    window.addEventListener('pagehide', onHide);

    return () => {
        if (heartbeatTimer !== null) clearInterval(heartbeatTimer);
        heartbeatTimer = null;
        window.removeEventListener('pagehide', onHide);
    };
}
