/**
 * The user stays in control of their data. View, export and delete cover every
 * user-owned kind under the user's home for one repository — profile notes,
 * observations, signals, chat history, the session index — and every index
 * derived from them: a delete removes the rows from any FTS table that holds
 * their ids and leaves a tombstone, so a rebuild from a stale copy cannot bring
 * a revoked item back. Each kind can be switched off; message text is never
 * stored, so there is none to export.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { loadSqliteSync } from './sqlite_guard.js';

export const USER_KINDS = ['profile', 'observations', 'signals', 'chat-history', 'sessions'] as const;
export type UserKind = (typeof USER_KINDS)[number];

export interface UserRow {
    id: string;
    [field: string]: unknown;
}

export interface Tombstone {
    id: string;
    kind: UserKind;
    deleted_at: string;
}

const fileOf = (dir: string, kind: UserKind): string => path.join(dir, `${kind}.jsonl`);
const TOMBSTONES = 'tombstones.jsonl';
/** Field names a row may never carry: message bodies stay in the host's transcript. */
const TEXT_FIELDS = new Set(['text', 'message', 'body', 'content', 'prompt']);

function readRows(file: string): UserRow[] {
    let raw: string;
    try {
        raw = fs.readFileSync(file, 'utf-8');
    } catch {
        return [];
    }
    return raw
        .split('\n')
        .filter((l) => l.trim())
        .flatMap((l) => {
            try {
                const r = JSON.parse(l) as UserRow;
                return typeof r.id === 'string' ? [r] : [];
            } catch {
                return [];
            }
        });
}

function writeRows(file: string, rows: readonly UserRow[]): void {
    fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    fs.writeFileSync(file, rows.map((r) => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : ''), { mode: 0o600 });
}

export function tombstones(dir: string): Tombstone[] {
    return readRows(path.join(dir, TOMBSTONES)) as unknown as Tombstone[];
}

/** Append a row of one kind, unless the kind is switched off, the id was revoked, or the row carries message text. */
export function appendUserRow(dir: string, kind: UserKind, row: UserRow, enabled: (k: UserKind) => boolean = () => true): 'stored' | 'off' | 'revoked' | 'refused-text' {
    if (!enabled(kind)) return 'off';
    if (Object.keys(row).some((k) => TEXT_FIELDS.has(k))) return 'refused-text';
    if (tombstones(dir).some((t) => t.id === row.id)) return 'revoked';
    writeRows(fileOf(dir, kind), [...readRows(fileOf(dir, kind)), row]);
    return 'stored';
}

export function viewUserData(dir: string): Record<UserKind, number> {
    return Object.fromEntries(USER_KINDS.map((k) => [k, readRows(fileOf(dir, k)).length])) as Record<UserKind, number>;
}

export function exportUserData(dir: string): Record<UserKind, UserRow[]> {
    return Object.fromEntries(USER_KINDS.map((k) => [k, readRows(fileOf(dir, k))])) as Record<UserKind, UserRow[]>;
}

export interface DerivedIndex {
    /** sqlite file */
    file: string;
    table: string;
    idColumn: string;
}

/**
 * Delete rows by id (all rows of `kinds` when `ids` is omitted) from the
 * user's stores and from every derived index, and record a tombstone per id.
 */
export function deleteUserData(dir: string, opts: { kinds?: readonly UserKind[]; ids?: readonly string[]; derived?: readonly DerivedIndex[]; now?: Date }): { removed: number; derived_removed: number; tombstones: number } {
    const kinds = opts.kinds ?? USER_KINDS;
    const gone: Tombstone[] = [];
    const at = (opts.now ?? new Date()).toISOString();
    for (const k of kinds) {
        const rows = readRows(fileOf(dir, k));
        const keep = rows.filter((r) => opts.ids !== undefined && !opts.ids.includes(r.id));
        for (const r of rows) if (!keep.includes(r)) gone.push({ id: r.id, kind: k, deleted_at: at });
        if (rows.length !== keep.length) writeRows(fileOf(dir, k), keep);
    }
    let derivedRemoved = 0;
    if (gone.length && opts.derived?.length) {
        const { DatabaseSync } = loadSqliteSync('user_data_control.deleteUserData');
        for (const d of opts.derived) {
            if (!fs.existsSync(d.file) || !/^\w+$/.test(d.table) || !/^\w+$/.test(d.idColumn)) continue;
            const db = new DatabaseSync(d.file);
            try {
                const stmt = db.prepare(`DELETE FROM ${d.table} WHERE ${d.idColumn} = ?`);
                for (const t of gone) derivedRemoved += Number(stmt.run(t.id).changes);
            } finally {
                db.close();
            }
        }
    }
    if (gone.length) writeRows(path.join(dir, TOMBSTONES), [...readRows(path.join(dir, TOMBSTONES)), ...(gone as unknown as UserRow[])]);
    return { removed: gone.length, derived_removed: derivedRemoved, tombstones: gone.length };
}
