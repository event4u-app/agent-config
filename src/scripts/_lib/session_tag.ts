/**
 * The session tag — a deterministic 16-character prefix of a session id's
 * SHA-256, and the sentinel used when there is no id to derive one from.
 *
 * WHY THIS IS ITS OWN MODULE. The tag lives logically in `chat_history.ts`,
 * which defines the JSONL schema that carries it. But `chat_history.ts` is a
 * 2,300-line module whose transitive closure is about 121 KB of the hook
 * dispatch bundle, and `hooks/interruption_ledger_hook.ts` — a concern on a
 * different event — needs five lines of it. One `import { derive_session_tag }`
 * was enough to pull the whole closure into a bundle every hook event loads.
 *
 * So the five lines moved here and `chat_history.ts` re-exports them: its
 * public API is unchanged, every existing caller keeps working, and the
 * dependency edge that defeated the extraction is gone.
 *
 * Byte-parity note: `fingerprint` normalises exactly as the retired Python
 * `chat_history.py` did — collapse every whitespace run to one space, strip the
 * ends, hash the UTF-8 of that. The normalisation is part of the on-disk
 * contract, not a convenience, so it is reproduced here verbatim rather than
 * tidied.
 */
import { createHash } from 'node:crypto';

const _WS_RE = /\s+/g;

/** Characters of the SHA-256 hex digest a session tag keeps. */
export const SESSION_ID_LEN = 16;

/** The tag for an entry whose session id is absent or unreadable. */
export const SESSION_ID_UNKNOWN = '<unknown>';

/** The tag for a row written before session tagging existed. */
export const SESSION_ID_LEGACY = '<legacy>';

function _strip(s: string): string {
    return s.replace(/^\s+/u, '').replace(/\s+$/u, '');
}

/** The full SHA-256 hex digest of `value` after whitespace normalisation. */
export function fingerprint(value: string): string {
    const normalized = _strip((value || '').replace(_WS_RE, ' '));
    return createHash('sha256').update(normalized, 'utf-8').digest('hex');
}

/** The session tag for `session_id`, or {@link SESSION_ID_UNKNOWN} when it is empty. */
export function derive_session_tag(session_id: string): string {
    if (!session_id) {
        return SESSION_ID_UNKNOWN;
    }
    return fingerprint(session_id).slice(0, SESSION_ID_LEN);
}
