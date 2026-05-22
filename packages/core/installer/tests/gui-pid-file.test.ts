/**
 * Tests for the GUI PID-file primitives (Phase 6 § Lifecycle).
 *
 * Uses a tmpdir per test. `isProcessAlive` is exercised by passing
 * `process.pid` (alive) and a non-existent PID (dead).
 */

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    PID_FILE_NAME,
    clearPidFile,
    inspectPidFile,
    isProcessAlive,
    pidFilePath,
    writePidFile,
} from '../src/gui/pid-file.js';

let projectRoot: string;

beforeEach(() => {
    projectRoot = mkdtempSync(join(tmpdir(), 'gui-pid-'));
});

afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true });
});

describe('pidFilePath', () => {
    it('resolves under agents/runtime/gui/<name>', () => {
        expect(pidFilePath(projectRoot)).toBe(
            join(projectRoot, 'agents', 'runtime', 'gui', PID_FILE_NAME),
        );
    });
});

describe('isProcessAlive', () => {
    it('returns true for the current pid', () => {
        expect(isProcessAlive(process.pid)).toBe(true);
    });

    it('returns false for clearly invalid pids', () => {
        expect(isProcessAlive(0)).toBe(false);
        expect(isProcessAlive(-1)).toBe(false);
        expect(isProcessAlive(Number.NaN)).toBe(false);
    });

    it('returns false for a pid that is almost certainly dead', () => {
        // A very large pid is unlikely to be allocated.
        expect(isProcessAlive(2_147_483_640)).toBe(false);
    });
});

describe('inspectPidFile', () => {
    it('returns no conflict when the file is absent', () => {
        const r = inspectPidFile(projectRoot);
        expect(r.conflict).toBe(false);
        expect(r.conflictingPid).toBeUndefined();
    });

    it('detects a conflict for the current pid', () => {
        writePidFile(projectRoot);
        const r = inspectPidFile(projectRoot);
        expect(r.conflict).toBe(true);
        expect(r.conflictingPid).toBe(process.pid);
    });

    it('ignores a stale pid (process gone)', () => {
        writePidFile(projectRoot, 2_147_483_640);
        const r = inspectPidFile(projectRoot);
        expect(r.conflict).toBe(false);
    });

    it('ignores a non-numeric pid file', () => {
        writePidFile(projectRoot);
        writeFileSync(pidFilePath(projectRoot), 'not-a-number\n', 'utf8');
        const r = inspectPidFile(projectRoot);
        expect(r.conflict).toBe(false);
    });
});

describe('writePidFile / clearPidFile', () => {
    it('writePidFile creates the file and writes the pid', () => {
        const p = writePidFile(projectRoot, 12345);
        expect(existsSync(p)).toBe(true);
        expect(readFileSync(p, 'utf8').trim()).toBe('12345');
    });

    it('clearPidFile removes the file and is idempotent', () => {
        writePidFile(projectRoot);
        const p = pidFilePath(projectRoot);
        expect(existsSync(p)).toBe(true);
        clearPidFile(projectRoot);
        expect(existsSync(p)).toBe(false);
        // second call must not throw
        expect(() => clearPidFile(projectRoot)).not.toThrow();
    });
});
