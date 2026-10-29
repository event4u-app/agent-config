/**
 * K.7 — view, export and delete cover every user kind and the derived FTS
 * index; revoked items stay gone; each kind can be switched off; no message
 * text is stored. Runs under a temp HOME.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { userProjectDir } from '../../src/scripts/_lib/ownership_model.js';
import { loadSqliteSync } from '../../src/scripts/_lib/sqlite_guard.js';
import { appendUserRow, deleteUserData, exportUserData, tombstones, viewUserData } from '../../src/scripts/_lib/user_data_control.js';

let home: string;
let dir: string;
let fts: string;
beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'user-ctl-'));
    vi.stubEnv('HOME', home);
    vi.stubEnv('EVENT4U_CONFIG_HOME', path.join(home, '.event4u', 'agent-config'));
    dir = userProjectDir('repo-a');
    fts = path.join(home, 'derived.sqlite3');
    const { DatabaseSync } = loadSqliteSync('test');
    const db = new DatabaseSync(fts);
    db.exec('CREATE VIRTUAL TABLE entries USING fts5(id UNINDEXED, text)');
    for (const id of ['sig-1', 'sig-2', 'sess-1', 'other']) db.prepare('INSERT INTO entries (id, text) VALUES (?, ?)').run(id, `indexed ${id}`);
    db.close();
    appendUserRow(dir, 'signals', { id: 'sig-1', kind: 'complaint', at: 's1:3' });
    appendUserRow(dir, 'signals', { id: 'sig-2', kind: 'approval', at: 's2:1' });
    appendUserRow(dir, 'sessions', { id: 'sess-1', span: ['2026-10-01', '2026-10-01'] });
});
afterEach(() => {
    vi.unstubAllEnvs();
    fs.rmSync(home, { recursive: true, force: true });
});

const ftsIds = (): string[] => {
    const { DatabaseSync } = loadSqliteSync('test');
    const db = new DatabaseSync(fts);
    try {
        return (db.prepare('SELECT id FROM entries ORDER BY id').all() as Array<{ id: string }>).map((r) => r.id);
    } finally {
        db.close();
    }
};

describe('user data control', () => {
    it('lives under the user home and is viewable and exportable per kind', () => {
        expect(dir.startsWith(home)).toBe(true);
        expect(viewUserData(dir)).toEqual({ profile: 0, observations: 0, signals: 2, 'chat-history': 0, sessions: 1 });
        expect(exportUserData(dir).signals.map((r) => r.id)).toEqual(['sig-1', 'sig-2']);
    });

    it('delete removes signals, session rows and their derived FTS rows, with a tombstone', () => {
        const r = deleteUserData(dir, { kinds: ['signals', 'sessions'], derived: [{ file: fts, table: 'entries', idColumn: 'id' }], now: new Date('2026-10-27T00:00:00Z') });
        expect(r).toEqual({ removed: 3, derived_removed: 3, tombstones: 3 });
        expect(viewUserData(dir)).toMatchObject({ signals: 0, sessions: 0 });
        expect(ftsIds()).toEqual(['other']);
        expect(tombstones(dir).map((t) => t.id).sort()).toEqual(['sess-1', 'sig-1', 'sig-2']);
    });

    it('a delete by id touches only that id, and a revoked id cannot be stored again', () => {
        deleteUserData(dir, { ids: ['sig-1'], derived: [{ file: fts, table: 'entries', idColumn: 'id' }] });
        expect(exportUserData(dir).signals.map((r) => r.id)).toEqual(['sig-2']);
        expect(ftsIds()).toEqual(['other', 'sess-1', 'sig-2']);
        expect(appendUserRow(dir, 'signals', { id: 'sig-1', kind: 'complaint' })).toBe('revoked');
    });

    it('a kind switched off stores nothing; a row carrying message text is refused', () => {
        expect(appendUserRow(dir, 'signals', { id: 'sig-3' }, (k) => k !== 'signals')).toBe('off');
        expect(appendUserRow(dir, 'chat-history', { id: 'c1', message: 'planted message text' })).toBe('refused-text');
        expect(JSON.stringify(exportUserData(dir))).not.toContain('planted message text');
    });
});
