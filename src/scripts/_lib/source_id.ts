/**
 * Stable, keyed source ids — `src_` plus 10 hex of an HMAC over the canonical identity.
 *
 * `ENC1` tokens are salted per call, so two tokens for one source never compare
 * equal; a round-scoped `S1…` code is renumbered every round. Neither can key a
 * ledger. This id can: it is stable across rounds and URL spellings, and keyed
 * with `secrets.link_encryption_key`, so nobody without the key can confirm a
 * guessed source by hashing its URL. Without a key there is no id — callers
 * refuse rather than mint an unkeyed one.
 */

import * as crypto from 'node:crypto';

import { canonicalize } from '../harvest_reference_tokens.js';

export const SOURCE_ID_PREFIX = 'src_';
export const SOURCE_ID_RE = /^src_[0-9a-f]{10}$/;
// Domain-separates this HMAC from any other use of the same key.
const ID_CONTEXT = 'agent-config/source-id/v1\0';

/**
 * Repository URLs collapse through `canonicalize`; anything else (an article,
 * a video, a paper) keeps host, path and query with scheme, credentials,
 * fragment and a trailing slash dropped. A string that is not a URL is used
 * trimmed, as written — an opaque reference names itself.
 */
export function canonicalSourceIdentity(raw: string): string {
    const repo = canonicalize(raw);
    if (repo !== null) return repo;
    const s = raw.trim();
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) return s;
    let u: URL;
    try {
        u = new URL(s);
    } catch {
        return s;
    }
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    const port = u.port === '' ? '' : `:${u.port}`;
    const pathname = u.pathname.replace(/\/+$/, '');
    return `${host}${port}${pathname}${u.search}`;
}

export function sourceId(identity: string, key: string): string {
    if (!key) throw new Error('no link_encryption_key — a source id is never minted without the key');
    const mac = crypto.createHmac('sha256', key).update(ID_CONTEXT + canonicalSourceIdentity(identity)).digest('hex');
    return SOURCE_ID_PREFIX + mac.slice(0, 10);
}
