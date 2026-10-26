/**
 * The shrink guard: a refresh that would lose more than a set share of the
 * graph's facts, without the tree having lost the files or spans those facts
 * were read from, is refused and the old cache kept.
 *
 * A fact lost by a refresh is EXPLAINED when its owner file is gone from the
 * tree or was rewritten after the old cache was written — the source changed, so
 * a different graph is expected. A fact lost while its owner sat untouched is a
 * reader that stopped seeing something, which is exactly the failure a silent
 * mass loss would hide. Explained losses become tombstones; unexplained ones,
 * above the share, refuse the refresh. Both graphs are read through their
 * SQLite indexes; without them (an old twin version) the guard cannot judge and
 * says so instead of refusing.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { openGraphIndex } from '../sqlite_store.js';
import { openOwnerIndex } from './owner_index.js';
import defaults from './defaults.json';
import type { Tombstone } from './tombstones.js';

export interface ShrinkVerdict {
    ok: boolean;
    /** Set when the guard could not compare and let the refresh through. */
    skipped?: string;
    old_total: number;
    new_total: number;
    lost: number;
    unexplained: number;
    /** Unexplained losses over the old total. */
    share: number;
    limit: number;
    /** Up to ten unexplained losses, for the refusal message. */
    sample: string[];
    /** Explained node losses, as tombstones to record when the refresh lands. */
    tombstones: Tombstone[];
}

export interface ShrinkOptions {
    share?: number;
    /** `<sha>[+dirty]` the tombstones are recorded at. */
    basis?: string;
}

const isEdgeKey = (k: string): boolean => k.includes('\0');

export function shrinkCheck(root: string, oldJson: string, newJson: string, opts: ShrinkOptions = {}): ShrinkVerdict {
    const limit = opts.share ?? defaults.shrink_share;
    const blank = { old_total: 0, new_total: 0, lost: 0, unexplained: 0, share: 0, limit, sample: [], tombstones: [] };
    if (!fs.existsSync(oldJson)) return { ok: true, skipped: 'no previous graph', ...blank };
    const oldIdx = openGraphIndex(oldJson);
    const oldOwners = oldIdx ? openOwnerIndex(oldJson) : null;
    const newOwners = oldOwners ? openOwnerIndex(newJson) : null;
    if (!oldIdx || !oldOwners || !newOwners) {
        oldIdx?.close();
        oldOwners?.close();
        return { ok: true, skipped: 'a graph index is missing or of another version — losses not compared', ...blank };
    }
    try {
        const before = oldOwners.factOwners();
        const after = newOwners.factOwners();
        const builtAt = fs.statSync(oldJson).mtimeMs;
        const fileState = new Map<string, 'deleted' | 'changed' | 'same'>();
        const stateOf = (owner: string): 'deleted' | 'changed' | 'same' => {
            let s = fileState.get(owner);
            if (s) return s;
            try {
                s = fs.statSync(path.join(root, owner)).mtimeMs > builtAt ? 'changed' : 'same';
            } catch {
                s = 'deleted';
            }
            fileState.set(owner, s);
            return s;
        };
        let lost = 0;
        const unexplained: string[] = [];
        const tombstones: Tombstone[] = [];
        for (const [key, owner] of before) {
            if (after.has(key)) continue;
            lost += 1;
            const s = stateOf(owner);
            if (s === 'same') {
                unexplained.push(key);
                continue;
            }
            if (isEdgeKey(key) || tombstones.length >= defaults.tombstones_kept) continue;
            const n = oldIdx.getNode(key);
            if (!n) continue;
            tombstones.push({
                id: key,
                kind: n.kind,
                label: n.label,
                owner,
                witness: n.fact?.witness ?? null,
                reason: s === 'deleted' ? 'owner-deleted' : 'dropped-by-refresh',
                basis: opts.basis ?? 'refresh',
                by: 'refresh',
            });
        }
        const share = before.size === 0 ? 0 : unexplained.length / before.size;
        return {
            ok: share <= limit,
            old_total: before.size,
            new_total: after.size,
            lost,
            unexplained: unexplained.length,
            share,
            limit,
            sample: unexplained.slice(0, 10).map((k) => k.split('\0').join(' ')),
            tombstones,
        };
    } finally {
        oldIdx.close();
        oldOwners.close();
        newOwners.close();
    }
}

export function renderShrink(v: ShrinkVerdict): string {
    if (v.skipped) return `shrink guard: ${v.skipped}`;
    const pct = (x: number): string => `${(x * 100).toFixed(1)} %`;
    return (
        `shrink guard: ${v.lost} of ${v.old_total} facts lost, ${v.unexplained} without a matching change in the tree ` +
        `(${pct(v.share)}, limit ${pct(v.limit)})` +
        (v.ok ? '' : ` — refused, old cache kept. First: ${v.sample.join('; ')}. Re-run with --allow-shrink if the loss is intended.`)
    );
}
