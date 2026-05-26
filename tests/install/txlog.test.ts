import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    RECOVERY_DEPTH_CAP,
    ROTATION_MAX_AGE_MS,
    ROTATION_MAX_BYTES,
    appendTxLog,
    readRecentEntries,
    rotateLogSync,
    shouldRotate,
} from '../../src/install/txlog.js';

function entry(path: string, ts = new Date().toISOString()): string {
    return JSON.stringify({ ts, kind: 'write', path, sha256: 'abc' });
}

describe('txlog — appendTxLog + readRecentEntries', () => {
    let root: string;
    let logPath: string;

    beforeEach(() => {
        root = mkdtempSync(join(tmpdir(), 'txlog-'));
        logPath = join(root, 'install-log.jsonl');
    });

    afterEach(() => {
        rmSync(root, { recursive: true, force: true });
    });

    it('appends one entry per call as JSONL', () => {
        const now = new Date().toISOString();
        appendTxLog(logPath, { ts: now, kind: 'write', path: '/x/a', sha256: 'a' });
        appendTxLog(logPath, { ts: now, kind: 'write', path: '/x/b', sha256: 'b' });
        const lines = readFileSync(logPath, 'utf8').trim().split('\n');
        expect(lines.length).toBe(2);
        expect(JSON.parse(lines[0]!).path).toBe('/x/a');
        expect(JSON.parse(lines[1]!).path).toBe('/x/b');
    });

    it('readRecentEntries returns chronological tail', () => {
        const now = new Date().toISOString();
        for (let i = 0; i < 5; i += 1) {
            appendTxLog(logPath, {
                ts: now,
                kind: 'write',
                path: `/x/${i}`,
                sha256: String(i),
            });
        }
        const entries = readRecentEntries(logPath);
        expect(entries.length).toBe(5);
        expect(entries[0]!.path).toBe('/x/0');
        expect(entries[4]!.path).toBe('/x/4');
    });

    it('readRecentEntries caps at RECOVERY_DEPTH_CAP', () => {
        const lines: string[] = [];
        for (let i = 0; i < RECOVERY_DEPTH_CAP + 50; i += 1) {
            lines.push(entry(`/x/${i}`));
        }
        writeFileSync(logPath, `${lines.join('\n')}\n`);
        const entries = readRecentEntries(logPath);
        expect(entries.length).toBe(RECOVERY_DEPTH_CAP);
        expect(entries[0]!.path).toBe('/x/50');
    });

    it('readRecentEntries drops malformed lines silently', () => {
        writeFileSync(logPath, `${entry('/x/a')}\nnot-json\n${entry('/x/b')}\n`);
        const entries = readRecentEntries(logPath);
        expect(entries.length).toBe(2);
        expect(entries.map((e) => e.path)).toEqual(['/x/a', '/x/b']);
    });

    it('readRecentEntries returns [] when log is missing', () => {
        expect(readRecentEntries(logPath)).toEqual([]);
    });
});

describe('txlog — rotation', () => {
    let root: string;
    let logPath: string;

    beforeEach(() => {
        root = mkdtempSync(join(tmpdir(), 'txlog-'));
        logPath = join(root, 'install-log.jsonl');
    });

    afterEach(() => {
        rmSync(root, { recursive: true, force: true });
    });

    it('shouldRotate returns false when log is missing', () => {
        expect(shouldRotate(logPath)).toBe(false);
    });

    it('shouldRotate returns true when size exceeds ROTATION_MAX_BYTES', () => {
        writeFileSync(logPath, 'x'.repeat(ROTATION_MAX_BYTES + 1));
        expect(shouldRotate(logPath)).toBe(true);
    });

    it('shouldRotate returns true when first entry is older than ROTATION_MAX_AGE_MS', () => {
        writeFileSync(logPath, `${entry('/x/a', '2020-01-01T00:00:00.000Z')}\n`);
        const future = new Date(Date.parse('2020-01-01T00:00:00.000Z') + ROTATION_MAX_AGE_MS + 1);
        expect(shouldRotate(logPath, future)).toBe(true);
    });

    it('shouldRotate returns false for fresh small logs', () => {
        writeFileSync(logPath, `${entry('/x/a', new Date().toISOString())}\n`);
        expect(shouldRotate(logPath)).toBe(false);
    });

    it('rotateLogSync renames the active log and removes it', () => {
        writeFileSync(logPath, `${entry('/x/a')}\n`);
        rotateLogSync(logPath);
        const siblings = readdirSync(root);
        expect(siblings.some((n) => n === 'install-log.jsonl')).toBe(false);
        expect(siblings.some((n) => /install-log\..*\.jsonl/.test(n))).toBe(true);
    });

    it('rotateLogSync is a no-op when log is missing', () => {
        expect(() => rotateLogSync(logPath)).not.toThrow();
    });
});
