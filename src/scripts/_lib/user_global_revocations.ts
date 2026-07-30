/**
 * The user-memory revocation ledger — Phase 4 of road-to-global-user-memory
 * ("delete, revoke, audit").
 *
 * Reuses ADR-121's `.revocations.jsonl` tombstone-before-deletion pattern
 * from `knowledge_global_promote.ts` (`append_tombstone` / `load_tombstones`)
 * VERBATIM at the mechanism level: same filename, same single
 * `fs.appendFileSync` per entry (never rewritten), same "the caller MUST
 * call this BEFORE deleting the thing it documents" contract, same tolerant
 * reader (a malformed line is skipped, never crashes the read), same
 * per-domain ledger (this one lives under the `user/` root, exactly as
 * ADR-121's lives under the knowledge store's own root — no line from one
 * ledger is ever readable as a line of the other).
 *
 * The one adaptation ADR-121's shape cannot express unchanged: its
 * `RevocationEntry.card_id` names a knowledge CARD, addressed by a stable,
 * content-derived slug (`card_id_from`). Neither a buffered observation nor
 * a `profile.md` field has an analogous natural id — the Phase 2/3 JSONL
 * schema never added one, and a profile field is a YAML key, not a file
 * with a stem. This module's entries therefore use `entity_id` in place of
 * `card_id` — the generic name reflects that two different callers
 * (`user_global_observations.ts`'s per-observation delete/purge,
 * `agent_user_profile.ts`'s per-field revoke) share this ONE ledger rather
 * than each inventing its own. Field order, the `{revoked_at, <id>, reason}`
 * shape, and every operational guarantee are otherwise unchanged.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import * as user_global_paths from './user_global_paths.js';

/** Relative-to-root path of the ledger — lives beside the profile/buffer it audits. */
export const REVOCATIONS_RELATIVE = path.join('user', '.revocations.jsonl');

/** One append-only tombstone line: what was revoked, when, and why. */
export interface RevocationEntry {
    readonly revoked_at: string;
    readonly entity_id: string;
    readonly reason: string;
}

function _writeTarget(env: user_global_paths.EnvMap | null): string {
    return user_global_paths.write_target(REVOCATIONS_RELATIVE, { env });
}

/**
 * Append one tombstone line to the revocation ledger — the caller MUST call
 * this BEFORE deleting the observation/field it documents. Append-only (a
 * single `fs.appendFileSync`, never rewritten): no delete or purge call
 * ever removes a prior tombstone, so the ledger stays a durable audit trail
 * across every deletion path — mirroring `knowledge_global_promote.ts`'s
 * `append_tombstone` exactly.
 */
export function appendTombstone(
    entity_id: string,
    reason: string,
    options: { today?: string | undefined; env?: user_global_paths.EnvMap | null } = {},
): RevocationEntry {
    const entry: RevocationEntry = {
        revoked_at: options.today ?? new Date().toISOString().slice(0, 10),
        entity_id,
        reason: reason || 'no reason given',
    };
    const target = _writeTarget(options.env ?? null);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.appendFileSync(target, JSON.stringify(entry) + '\n', 'utf-8');
    return entry;
}

/** Read the revocation ledger. Tolerant: missing file → []; malformed lines are skipped. */
export function loadTombstones(env?: user_global_paths.EnvMap | null): RevocationEntry[] {
    const resolved = user_global_paths.resolve_with_fallback(REVOCATIONS_RELATIVE, {
        env: env ?? null,
    });
    if (resolved === null) {
        return [];
    }
    let text: string;
    try {
        text = fs.readFileSync(resolved, 'utf-8');
    } catch {
        return [];
    }
    const out: RevocationEntry[] = [];
    for (const raw of text.split(/\r\n|\r|\n/)) {
        const line = raw.trim();
        if (!line) {
            continue;
        }
        try {
            const obj: unknown = JSON.parse(line);
            if (
                obj !== null &&
                typeof obj === 'object' &&
                !Array.isArray(obj) &&
                typeof (obj as Record<string, unknown>)['entity_id'] === 'string'
            ) {
                const rec = obj as Record<string, unknown>;
                out.push({
                    revoked_at: String(rec['revoked_at'] ?? ''),
                    entity_id: rec['entity_id'] as string,
                    reason: String(rec['reason'] ?? ''),
                });
            }
        } catch {
            // corrupt line — skip; never let one bad line crash the ledger read
        }
    }
    return out;
}
