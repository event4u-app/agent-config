/**
 * The one reader of a codex `auth.json` (`road-to-the-profile-the-session-runs-in`
 * 1.5). Both the environment detector and `doctor` read through here, so the
 * secret-adjacent surface is one file and the answer is one truth.
 *
 * What leaves this module is a verdict, never a field value: presence, the
 * credential class, and a locally-derivable expiry. No token, no claim other
 * than `exp`, no account id. Offline — JWT payloads are base64-decoded for
 * `exp` only, never verified, never sent anywhere.
 */
import * as fs from 'node:fs';

export type CodexAuthClass = 'cli-subscription' | 'cli-api-key';

export interface CodexAuthVerdict {
    readonly present: boolean;
    /** `null` when the file is absent. */
    readonly class: CodexAuthClass | null;
    /** Latest derivable expiry in epoch seconds, or `null` when none is derivable. */
    readonly expiresAt: number | null;
}

type Dict = Record<string, unknown>;

function isDict(v: unknown): v is Dict {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** `exp` of a JWT payload — base64 decode only, no signature verification. */
function jwtExp(token: unknown): number | null {
    if (typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    try {
        const payload: unknown = JSON.parse(Buffer.from(parts[1] as string, 'base64url').toString('utf-8'));
        if (!isDict(payload)) return null;
        const exp = payload['exp'];
        return typeof exp === 'number' && Number.isFinite(exp) && exp > 0 ? exp : null;
    } catch {
        return null;
    }
}

/** An explicit expiry field as epoch seconds (number in s or ms, or ISO string). */
function epochSeconds(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        // Values past ~2286 in seconds are epoch milliseconds.
        return value > 1e12 ? value / 1000 : value;
    }
    if (typeof value === 'string' && value.trim() !== '') {
        const ms = Date.parse(value);
        return Number.isNaN(ms) ? null : ms / 1000;
    }
    return null;
}

/**
 * LATEST derivable expiry wins: the real file holds a refresh token, so an
 * expired id_token next to a live access_token is not an auth failure.
 */
function latestExpiry(d: Dict): number | null {
    const candidates: number[] = [];
    for (const key of ['expires_at', 'expiry', 'exp']) {
        const v = epochSeconds(d[key]);
        if (v !== null) candidates.push(v);
    }
    const tokens = isDict(d['tokens']) ? (d['tokens'] as Dict) : {};
    for (const key of ['access_token', 'id_token']) {
        const v = jwtExp(tokens[key] ?? d[key]);
        if (v !== null) candidates.push(v);
    }
    return candidates.length > 0 ? Math.max(...candidates) : null;
}

/**
 * Read a codex `auth.json`. OAuth tokens ⇒ a ChatGPT plan (`cli-subscription`);
 * anything else ⇒ metered (`cli-api-key`). Present-but-unreadable or malformed
 * also reports `cli-api-key` — the over-gated direction, since assuming a plan
 * would switch the USD gate off on no evidence.
 */
export function readCodexAuth(authPath: string): CodexAuthVerdict {
    let raw: string;
    try {
        if (!fs.statSync(authPath).isFile()) return { present: false, class: null, expiresAt: null };
        raw = fs.readFileSync(authPath, 'utf-8');
    } catch (err) {
        const code = (err as NodeJS.ErrnoException).code;
        if (code === 'ENOENT' || code === 'ENOTDIR') return { present: false, class: null, expiresAt: null };
        return { present: true, class: 'cli-api-key', expiresAt: null };
    }
    let data: unknown;
    try {
        data = JSON.parse(raw);
    } catch {
        return { present: true, class: 'cli-api-key', expiresAt: null };
    }
    if (!isDict(data)) return { present: true, class: 'cli-api-key', expiresAt: null };
    const tokens = data['tokens'];
    const hasOauth = isDict(tokens) && Object.keys(tokens).length > 0;
    return { present: true, class: hasOauth ? 'cli-subscription' : 'cli-api-key', expiresAt: latestExpiry(data) };
}
