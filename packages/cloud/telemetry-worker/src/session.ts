/**
 * Session bookkeeping. Generates 128-bit session ids (hex), creates the
 * KV record with a 2-hour TTL, and tracks events-per-session for rate
 * limiting.
 *
 * `events_seen` is incremented before persisting each event so the cap
 * is checked atomically from the worker's perspective (single fetch
 * request, no concurrent writes within the request).
 */

import { MAX_EVENTS_PER_SESSION, SESSION_TTL_SECONDS } from './types.js';
import type { KVNamespace } from './types.js';
import { sessionKey } from './kv-keys.js';

export interface SessionRecord {
    readonly events_seen: number;
}

/** 128-bit hex token, generated via the Web Crypto RNG. */
export function newSessionId(): string {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function readSession(
    kv: KVNamespace,
    sessionId: string,
): Promise<SessionRecord | null> {
    const raw = await kv.get(sessionKey(sessionId));
    if (raw === null) return null;
    try {
        const parsed = JSON.parse(raw) as Partial<SessionRecord>;
        if (typeof parsed.events_seen !== 'number') return null;
        return { events_seen: parsed.events_seen };
    } catch {
        return null;
    }
}

export async function bumpSession(
    kv: KVNamespace,
    sessionId: string,
    previous: SessionRecord | null,
): Promise<{ readonly accepted: boolean; readonly events_seen: number }> {
    const nextCount = (previous?.events_seen ?? 0) + 1;
    if (nextCount > MAX_EVENTS_PER_SESSION) {
        return { accepted: false, events_seen: nextCount - 1 };
    }
    await kv.put(
        sessionKey(sessionId),
        JSON.stringify({ events_seen: nextCount }),
        { expirationTtl: SESSION_TTL_SECONDS },
    );
    return { accepted: true, events_seen: nextCount };
}
