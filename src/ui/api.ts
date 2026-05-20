/**
 * Tiny fetch wrapper that injects the bearer token minted by `ui:serve`.
 *
 * Every UI request goes through `apiFetch` so the token is centralised
 * in one place and the call sites stay declarative. The contract with
 * the Fastify server lives in `docs/contracts/settings-api.md` +
 * `docs/contracts/onboard-skill-wizard-bridge.md`.
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
