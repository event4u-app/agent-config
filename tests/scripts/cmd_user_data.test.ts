/**
 * K.7 — the user CLI: list, delete (dry run unless --yes) with tombstones and
 * derived-index removal, and a dry-run-first migration that carries pointers
 * only. Temp HOME and synthetic data only.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DERIVED_INDEX, main, planMigration } from '../../src/scripts/_cli/cmd_user_data.js';
import { loadSqliteSync } from '../../src/scripts/_lib/sqlite_guard.js';
import { appendUserRow, exportUserData, tombstones } from '../../src/scripts/_lib/user_data_control.js';

let home: string;
let root: string;
let dir: string;
let out: string[];
beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'ud-home-'));
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ud-proj-')));
    vi.stubEnv('EVENT4U_CONFIG_HOME', home);
    dir = path.join(home, 'user', 'projects', 'repo-x');
    appendUserRow(dir, 'signals', { id: 'sig-1', kind: 'complaint' });
    appendUserRow(dir, 'signals', { id: 'sig-2', kind: 'approval' });
    appendUserRow(dir, 'sessions', { id: 'sess-1' });
    out = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((s) => (out.push(String(s)), true));
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
});
afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(root, { recursive: true, force: true });
});

const run = (...argv: string[]) => main(argv, { root, dir });

describe('user-data', () => {
    it('list shows counts and ids, never content', () => {
        expect(run('list', '--kind', 'signals', '--json')).toBe(0);
        expect(JSON.parse(out.join(''))).toMatchObject({ signals: { count: 2, ids: ['sig-1', 'sig-2'] } });
    });

    it('export prints the rows of a kind as JSON', () => {
        expect(run('export', '--kind', 'signals')).toBe(0);
        expect(JSON.parse(out.join(''))).toEqual({ signals: [{ id: 'sig-1', kind: 'complaint' }, { id: 'sig-2', kind: 'approval' }] });
        out.length = 0;
        expect(run('export')).toBe(0);
        expect(Object.keys(JSON.parse(out.join('')))).toEqual(['profile', 'observations', 'signals', 'chat-history', 'sessions']);
    });

    it('delete is a dry run without --yes, then removes, tombstones and clears the derived index', () => {
        const { DatabaseSync } = loadSqliteSync('test');
        const db = new DatabaseSync(path.join(dir, DERIVED_INDEX));
        db.exec('CREATE VIRTUAL TABLE entries USING fts5(id UNINDEXED, text)');
        db.prepare('INSERT INTO entries (id, text) VALUES (?, ?)').run('sig-1', 'x');
        db.close();
        expect(run('delete', '--kind', 'signals', '--id', 'sig-1')).toBe(0);
        expect(out.join('')).toMatch(/would delete 1 row\(s\): signals:sig-1/);
        expect(exportUserData(dir).signals).toHaveLength(2);
        expect(run('delete', '--kind', 'signals', '--id', 'sig-1', '--yes')).toBe(0);
        expect(exportUserData(dir).signals.map((r) => r.id)).toEqual(['sig-2']);
        expect(tombstones(dir).map((t) => t.id)).toEqual(['sig-1']);
        expect(out.join('')).toMatch(/deleted 1 row\(s\), 1 derived index row\(s\); 1 tombstone/);
        expect(run('delete', '--kind', 'sessions', '--id', 'nope', '--yes')).toBe(1);
        expect(run('delete', '--kind', 'bogus')).toBe(2);
    });

    it('migrate is a dry run first, keeps pointers only, and moves only this project’s observations', () => {
        const chat = path.join(root, 'agents', 'runtime', '.agent-chat-history');
        fs.mkdirSync(path.dirname(chat), { recursive: true });
        fs.writeFileSync(chat, [JSON.stringify({ v: 1, started: 'x' }), JSON.stringify({ s: 'abc', t: 'user', ts: '2026-10-01', text: 'planted message' })].join('\n'));
        const obs = path.join(home, 'user', 'observations.jsonl');
        fs.writeFileSync(obs, [JSON.stringify({ ts: 't1', field: 'language', suggest: 'de', context: { project_path: root } }), JSON.stringify({ ts: 't2', field: 'role', suggest: 'dev' })].join('\n'));
        const plan = planMigration(root);
        expect(plan.chat).toMatchObject({ rows: [{ id: 'chat:2', s: 'abc', t: 'user', ts: '2026-10-01' }], dropped_fields: ['text'] });
        expect(plan.observations).toMatchObject({ rows: [{ field: 'language' }], kept_global: 1 });

        expect(run('migrate')).toBe(0);
        expect(out.join('')).toMatch(/dry run — nothing written/);
        expect(fs.existsSync(chat)).toBe(true);
        expect(exportUserData(dir)['chat-history']).toEqual([]);

        expect(run('migrate', '--apply')).toBe(0);
        expect(JSON.stringify(exportUserData(dir)['chat-history'])).not.toContain('planted message');
        expect(exportUserData(dir)['chat-history']).toHaveLength(1);
        expect(exportUserData(dir).observations.map((r) => r['field'])).toEqual(['language']);
        expect(fs.existsSync(chat)).toBe(false);
        expect(fs.readdirSync(path.dirname(chat)).some((f) => f.startsWith('.agent-chat-history.migrated-'))).toBe(true);
        expect(fs.readFileSync(obs, 'utf-8')).not.toContain('language');
        expect(fs.readFileSync(obs, 'utf-8')).toContain('role');
    });
});
