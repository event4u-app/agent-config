/**
 * Fire-and-forget POST emitter.
 *
 * - Never throws into caller code; all errors swallowed.
 * - Hard request timeout; no retry, no backoff, no log spam.
 * - Reads the server-issued `session_id` off the first response and
 *   threads it back into the session module.
 */

import { signBody } from './hmac.js';
import { setSessionId } from './session.js';
import type { InstallStageEvent } from './types.js';

export interface EmitterOptions {
    readonly workerBaseUrl: string;
    readonly hmacSecret: string;
    readonly requestTimeoutMs: number;
    readonly fetchImpl?: typeof fetch;
}

const BODY_BYTE_CAP = 4 * 1024;

export async function postEvent(event: InstallStageEvent, opts: EmitterOptions): Promise<void> {
    if (opts.workerBaseUrl.length === 0) return;
    if (opts.hmacSecret.length === 0) return;

    const body = JSON.stringify(event);
    if (Buffer.byteLength(body, 'utf8') > BODY_BYTE_CAP) return;

    let signature: string;
    try {
        signature = signBody(opts.hmacSecret, body);
    } catch {
        return;
    }

    const fetchImpl = opts.fetchImpl ?? fetch;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.requestTimeoutMs);

    try {
        const response = await fetchImpl(`${opts.workerBaseUrl}/install-event`, {
            method: 'POST',
            signal: controller.signal,
            headers: {
                'content-type': 'application/json',
                'x-install-sig': signature,
            },
            body,
        });

        if (response.status === 200) {
            try {
                const parsed = (await response.json()) as unknown;
                if (
                    typeof parsed === 'object' &&
                    parsed !== null &&
                    typeof (parsed as Record<string, unknown>)['session_id'] === 'string'
                ) {
                    setSessionId((parsed as { session_id: string }).session_id);
                }
            } catch {
                // Ignore body-parse failures; the SDK fails open.
            }
        }
        // 204, 4xx, 5xx — all silent. SDK never logs telemetry errors.
    } catch {
        // Network, abort, parse — all silent.
    } finally {
        clearTimeout(timer);
    }
}
