/**
 * Browser→server lifecycle: keep the local server alive while the user is
 * actively using this page, and shut it down when the window closes or the
 * session goes idle.
 *
 * Three cooperating signals (server side lives in `src/server/app.ts`
 * `idleShutdown`):
 *
 *   1. Heartbeat — while the tab is visible and the user has interacted
 *      within `IDLE_LIMIT_MS`, a periodic authed `GET /api/v1/ping` keeps
 *      the server's idle backstop from firing.
 *   2. Inactivity shutdown — once the user has not interacted for
 *      `IDLE_LIMIT_MS` (30 min), the heartbeat fires the shutdown beacon
 *      instead of a ping, so the server stops even with the tab still open.
 *   3. Window-close shutdown — on `pagehide` we fire
 *      `navigator.sendBeacon('/api/v1/shutdown?token=…')` for a prompt exit
 *      (the token rides as a query param since `sendBeacon` cannot set
 *      headers). The server's 30-min idle backstop is the final safety net
 *      for crashes where neither beacon is delivered.
 *
 * No-ops cleanly when run outside a browser (SSR / tests).
 */

import { apiFetch } from './api.js';

const HEARTBEAT_INTERVAL_MS = 30_000;
const IDLE_LIMIT_MS = 30 * 60_000;

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
 * Start the heartbeat and register the shutdown signals. Call once after the
 * auth token is set. Returns a teardown function (used by tests; the
 * production entry never needs it).
 */
export function startServerLifecycle(token: string): () => void {
    if (typeof window === 'undefined') return () => {};

    let lastInteraction = Date.now();
    const markInteraction = (): void => { lastInteraction = Date.now(); };
    const interactionEvents = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
    for (const ev of interactionEvents) {
        window.addEventListener(ev, markInteraction, { passive: true });
    }
    // Returning to the tab counts as activity so we don't shut down on the
    // first heartbeat after a long background stretch.
    const onVisible = (): void => { if (!document.hidden) markInteraction(); };
    document.addEventListener('visibilitychange', onVisible);

    const teardown = (): void => {
        if (heartbeatTimer !== null) clearInterval(heartbeatTimer);
        heartbeatTimer = null;
        for (const ev of interactionEvents) window.removeEventListener(ev, markInteraction);
        document.removeEventListener('visibilitychange', onVisible);
        window.removeEventListener('pagehide', onHide);
    };

    heartbeatTimer = setInterval(() => {
        // Backgrounded tab: neither keep alive nor shut down — let the
        // server's idle backstop decide if it stays hidden too long.
        if (document.hidden) return;
        if (Date.now() - lastInteraction > IDLE_LIMIT_MS) {
            sendShutdownBeacon(token);
            teardown();
            return;
        }
        // Fire-and-forget; a transient failure must not surface to the user.
        void apiFetch('/api/v1/ping').catch(() => {});
    }, HEARTBEAT_INTERVAL_MS);

    function onHide(): void { sendShutdownBeacon(token); }
    // `pagehide` fires on close, navigation, and bfcache eviction — more
    // reliable than `beforeunload` across browsers.
    window.addEventListener('pagehide', onHide);

    return teardown;
}
