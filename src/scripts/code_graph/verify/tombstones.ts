/**
 * A tombstone records that a fact's source span disappeared: what the fact was,
 * where it was read, and the tree state it was found missing at. The committed
 * index keeps the fact until the next rebuild; the tombstone is what tells a
 * reader in the meantime that the index is pointing at something no longer
 * there, so `confirm` answers `gone` with a reason instead of a guess.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { write_atomic } from '../../_lib/fs_atomic.js';
import type { Witness } from '../lanes/lane_fact.js';
import defaults from './defaults.json';

export type TombstoneReason = 'span-gone' | 'owner-deleted' | 'dropped-by-refresh';

export interface Tombstone {
    id: string;
    kind: string;
    label: string;
    owner: string;
    witness: Witness | null;
    reason: TombstoneReason;
    /** `<sha>` or `<sha>+dirty` — the tree the fact was found missing in. */
    basis: string;
    /** Which pass wrote it: a working-tree overlay, a confirm, or a refresh that dropped it. */
    by: 'overlay' | 'confirm' | 'refresh';
}

interface TombstoneFile {
    version: 1;
    tombstones: Tombstone[];
}

export function readTombstones(file: string): Tombstone[] {
    try {
        const raw = JSON.parse(fs.readFileSync(file, 'utf-8')) as TombstoneFile;
        return raw.version === 1 && Array.isArray(raw.tombstones) ? raw.tombstones : [];
    } catch {
        return [];
    }
}

/**
 * Write `add` into the tombstone file. `replaceBy` drops every earlier entry a
 * pass of that kind wrote first — an overlay recomputes its whole set, so its
 * old entries are not history but a previous answer. Newest last; capped.
 */
export function writeTombstones(file: string, add: readonly Tombstone[], replaceBy?: Tombstone['by']): Tombstone[] {
    const kept = readTombstones(file).filter((t) => t.by !== replaceBy);
    const ids = new Set(add.map((t) => `${t.by}\0${t.id}`));
    const merged = [...kept.filter((t) => !ids.has(`${t.by}\0${t.id}`)), ...add].slice(-defaults.tombstones_kept);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    write_atomic(file, `${JSON.stringify({ version: 1, tombstones: merged } satisfies TombstoneFile, null, 1)}\n`);
    return merged;
}

export function tombstoneFor(tombstones: readonly Tombstone[], id: string): Tombstone | undefined {
    for (let i = tombstones.length - 1; i >= 0; i--) if (tombstones[i]?.id === id) return tombstones[i];
    return undefined;
}
