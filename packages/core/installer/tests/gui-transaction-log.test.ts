/**
 * Tests for the GUI transaction-log primitives (Phase 6 § Transaction log).
 *
 * Uses a tmpdir per test so we never touch the real
 * `agents/runtime/gui/` of this repo.
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    appendEntry,
    closeLog,
    discardLog,
    ensureRuntimeDir,
    findOpenLog,
    guiRuntimeDir,
    isOpenLog,
    newLogPath,
    plannedPaths,
    readLog,
    rollback,
} from '../src/gui/transaction-log.js';
import type { TransactionLogEntry } from '../src/gui/types.js';

let projectRoot: string;

beforeEach(() => {
    projectRoot = mkdtempSync(join(tmpdir(), 'gui-tx-'));
});

afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true });
});

describe('guiRuntimeDir / ensureRuntimeDir', () => {
    it('resolves under agents/runtime/gui/ by default', () => {
        expect(guiRuntimeDir(projectRoot)).toBe(join(projectRoot, 'agents', 'runtime', 'gui'));
    });

    it('creates the directory idempotently', () => {
        const dir = ensureRuntimeDir(projectRoot);
        expect(existsSync(dir)).toBe(true);
        // second call must not throw
        expect(() => ensureRuntimeDir(projectRoot)).not.toThrow();
    });
});

describe('newLogPath', () => {
    it('returns a stable path under the runtime dir with no colons', () => {
        const p = newLogPath(projectRoot, () => '2026-01-02T03:04:05.678Z');
        expect(p).toBe(join(projectRoot, 'agents', 'runtime', 'gui', 'install-2026-01-02T03-04-05-678Z.log'));
    });
});

const start = (ts: string, packs: readonly string[] = ['p1']): TransactionLogEntry => ({
    kind: 'start', ts, workspaces: ['default'], packs,
});
const plan = (ts: string, path: string): TransactionLogEntry => ({
    kind: 'plan', ts, path, pack: 'p1',
});
const commit = (ts: string, n: number): TransactionLogEntry => ({
    kind: 'commit', ts, filesWritten: n, lockfileSha256: 'sha',
});

describe('appendEntry / readLog roundtrip', () => {
    it('preserves order and content', () => {
        const p = newLogPath(projectRoot, () => '2026-01-02T00-00-00-000Z');
        const entries = [start('t1'), plan('t2', 'a.txt'), plan('t3', 'b.txt'), commit('t4', 2)];
        for (const e of entries) appendEntry(p, e);
        expect(readLog(p)).toEqual(entries);
    });

    it('readLog tolerates missing files and trailing newlines', () => {
        expect(readLog(join(projectRoot, 'agents', 'runtime', 'gui', 'missing.log'))).toEqual([]);

        const p = newLogPath(projectRoot, () => '2026-01-02T01-00-00-000Z');
        writeFileSync(p, `${JSON.stringify(start('t'))}\n\n\n`, 'utf8');
        expect(readLog(p)).toHaveLength(1);
    });
});

describe('isOpenLog / plannedPaths', () => {
    it('open = start present, no terminal entry', () => {
        expect(isOpenLog([start('t1'), plan('t2', 'a')])).toBe(true);
        expect(isOpenLog([])).toBe(false);
    });

    it('commit / cancel / error close the log', () => {
        const base: TransactionLogEntry[] = [start('t1')];
        expect(isOpenLog([...base, commit('t2', 0)])).toBe(false);
        expect(isOpenLog([...base, { kind: 'cancel', ts: 't2', reason: 'user' }])).toBe(false);
        expect(isOpenLog([...base, { kind: 'error', ts: 't2', message: 'boom' }])).toBe(false);
    });

    it('plannedPaths returns only the plan entries', () => {
        const entries = [start('t1'), plan('t2', 'a'), plan('t3', 'b'), commit('t4', 2)];
        expect(plannedPaths(entries)).toEqual(['a', 'b']);
    });
});

describe('findOpenLog', () => {
    it('returns undefined when no logs exist', () => {
        expect(findOpenLog(projectRoot)).toBeUndefined();
    });

    it('returns the newest open log; ignores closed ones', () => {
        const closed = newLogPath(projectRoot, () => '2026-01-02T00-00-00-000Z');
        appendEntry(closed, start('t1'));
        appendEntry(closed, commit('t2', 0));

        const open = newLogPath(projectRoot, () => '2026-01-02T01-00-00-000Z');
        appendEntry(open, start('t1'));
        appendEntry(open, plan('t2', 'a'));

        expect(findOpenLog(projectRoot)).toBe(open);
    });
});

describe('closeLog / discardLog', () => {
    it('closeLog appends a terminal cancel entry', () => {
        const p = newLogPath(projectRoot, () => '2026-01-02T02-00-00-000Z');
        appendEntry(p, start('t1'));
        closeLog(p, 'user-quit', () => 't2');
        const entries = readLog(p);
        expect(entries.at(-1)).toEqual({ kind: 'cancel', ts: 't2', reason: 'user-quit' });
        expect(isOpenLog(entries)).toBe(false);
    });

    it('discardLog truncates the file', () => {
        const p = newLogPath(projectRoot, () => '2026-01-02T03-00-00-000Z');
        appendEntry(p, start('t1'));
        discardLog(p);
        expect(readFileSync(p, 'utf8')).toBe('');
    });
});

function writeUnder(root: string, rel: string, body = 'x'): string {
    const abs = join(root, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, body);
    return abs;
}

describe('rollback', () => {
    it('removes existing planned paths and appends a terminal cancel entry', () => {
        const p = newLogPath(projectRoot, () => '2026-02-01T00-00-00-000Z');
        appendEntry(p, start('t1'));
        const a = writeUnder(projectRoot, '.augment/rules/a.md');
        const b = writeUnder(projectRoot, '.augment/rules/b.md');
        appendEntry(p, plan('t1', '.augment/rules/a.md'));
        appendEntry(p, plan('t1', '.augment/rules/b.md'));
        const result = rollback(projectRoot, p, () => 't2');
        expect(result.removed.sort()).toEqual(['.augment/rules/a.md', '.augment/rules/b.md']);
        expect(result.missing).toEqual([]);
        expect(existsSync(a)).toBe(false);
        expect(existsSync(b)).toBe(false);
        const entries = readLog(p);
        expect(entries.at(-1)).toEqual({ kind: 'cancel', ts: 't2', reason: 'rollback' });
        expect(isOpenLog(entries)).toBe(false);
    });

    it('reports missing planned paths without throwing', () => {
        const p = newLogPath(projectRoot, () => '2026-02-02T00-00-00-000Z');
        appendEntry(p, start('t1'));
        appendEntry(p, plan('t1', '.augment/rules/never-written.md'));
        const result = rollback(projectRoot, p, () => 't2');
        expect(result.removed).toEqual([]);
        expect(result.missing).toEqual(['.augment/rules/never-written.md']);
    });

    it('skips absolute paths and traversal attempts (path-guard)', () => {
        const p = newLogPath(projectRoot, () => '2026-02-03T00-00-00-000Z');
        const outside = mkdtempSync(join(tmpdir(), 'gui-tx-outside-'));
        const outsideFile = writeUnder(outside, 'secret.txt', 'keep');
        appendEntry(p, start('t1'));
        appendEntry(p, plan('t1', outsideFile));
        appendEntry(p, plan('t1', '../escape.txt'));
        const result = rollback(projectRoot, p, () => 't2');
        expect(result.removed).toEqual([]);
        expect(result.missing).toEqual([]);
        expect(existsSync(outsideFile)).toBe(true);
        rmSync(outside, { recursive: true, force: true });
    });
});
