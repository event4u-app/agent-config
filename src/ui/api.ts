/**
 * Tiny fetch wrapper that injects the bearer token minted by `ui:serve`.
 *
 * Every UI request goes through `apiFetch` so the token is centralised
 * in one place and the call sites stay declarative. The contract with
 * the Fastify server lives in `docs/contracts/settings-api.md`.
 */

let authToken: string | null = null;

export function setAuthToken(token: string): void {
    authToken = token;
}

export function getAuthToken(): string | null {
    return authToken;
}

export interface ApiError {
    code: string;
    message: string;
    fields?: Array<{ path: string; message: string }>;
}

export class ApiCallError extends Error {
    readonly status: number;
    readonly body: { error?: ApiError; [key: string]: unknown };

    constructor(status: number, body: { error?: ApiError; [key: string]: unknown }, message: string) {
        super(message);
        this.status = status;
        this.body = body;
    }
}

interface ApiFetchInit extends Omit<RequestInit, 'body' | 'headers'> {
    body?: unknown;
    headers?: Record<string, string>;
}

export async function apiFetch<T>(path: string, init: ApiFetchInit = {}): Promise<T> {
    const headers: Record<string, string> = {
        Accept: 'application/json',
        ...(init.headers ?? {}),
    };
    if (authToken !== null) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }

    const { body, ...rest } = init;
    const fetchInit: RequestInit = { ...rest, headers };
    if (body !== undefined) {
        fetchInit.body = JSON.stringify(body);
        headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(path, fetchInit);
    const text = await res.text();
    const json: { error?: ApiError; [key: string]: unknown } = text === ''
        ? {}
        : (JSON.parse(text) as { error?: ApiError });

    if (!res.ok) {
        const msg = json.error?.message ?? `request failed (${res.status})`;
        throw new ApiCallError(res.status, json, msg);
    }
    return json as unknown as T;
}

/**
 * POST a body and consume an `text/event-stream` (SSE) response, invoking
 * `onFrame` once per parsed `data:` frame. Used by the wizard apply bridge
 * (road-to-single-install-source-of-truth § Phase 2) to stream install.py's
 * NDJSON→SSE progress. A non-2xx response is buffered and thrown as an
 * {@link ApiCallError} so the caller's existing error copy applies.
 */
export async function apiStream(
    path: string,
    body: unknown,
    onFrame: (frame: Record<string, unknown>) => void,
    init: ApiFetchInit = {},
): Promise<void> {
    const headers: Record<string, string> = {
        Accept: 'text/event-stream',
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
    };
    if (authToken !== null) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }
    const res = await fetch(path, { ...init, method: 'POST', headers, body: JSON.stringify(body) });
    if (!res.ok || res.body === null) {
        const text = await res.text().catch(() => '');
        let json: { error?: ApiError } = {};
        try {
            json = text === '' ? {} : (JSON.parse(text) as { error?: ApiError });
        } catch {
            // Non-JSON error body — fall through to the generic message.
        }
        throw new ApiCallError(res.status, json, json.error?.message ?? `stream failed (${res.status})`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    const flushFrame = (rawFrame: string): void => {
        for (const line of rawFrame.split('\n')) {
            if (!line.startsWith('data:')) continue;
            const payload = line.slice(5).trim();
            if (payload === '') continue;
            try {
                onFrame(JSON.parse(payload) as Record<string, unknown>);
            } catch {
                // Skip malformed frames rather than aborting the stream.
            }
        }
    };
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let sep = buf.indexOf('\n\n');
        while (sep !== -1) {
            flushFrame(buf.slice(0, sep));
            buf = buf.slice(sep + 2);
            sep = buf.indexOf('\n\n');
        }
    }
    if (buf.trim() !== '') flushFrame(buf);
}
