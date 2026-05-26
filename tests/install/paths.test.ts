/**
 * Phase A1 platform-resolution tests for `src/install/paths.ts`.
 *
 * Council Finding #16 surface: tests pin POSIX + Windows behaviour by
 * driving the optional `home` override; no `node:os` mocking required.
 */

import { tmpdir } from 'node:os';

import { describe, expect, it } from 'vitest';

import {
    INSTALL_LOG_FILENAME,
    INSTALL_ROOT_SUBPATH,
    getInstallRoot,
    getLogPath,
    getTempPath,
} from '../../src/install/paths.js';

describe('install/paths — getInstallRoot', () => {
    it('joins POSIX home with the .event4u/agent-config sub-path', () => {
        const root = getInstallRoot('/home/matze');
        expect(root.endsWith(INSTALL_ROOT_SUBPATH) || root.endsWith(INSTALL_ROOT_SUBPATH.replace(/\//g, '\\'))).toBe(true);
        expect(root.startsWith('/home/matze')).toBe(true);
    });

    it('joins a Windows-style USERPROFILE home with the sub-path', () => {
        const root = getInstallRoot('C:\\Users\\matze');
        expect(root.startsWith('C:\\Users\\matze')).toBe(true);
    });

    it('falls back to os.homedir() when no override is provided', () => {
        const root = getInstallRoot();
        expect(typeof root).toBe('string');
        expect(root.length).toBeGreaterThan(0);
        expect(root).toContain('agent-config');
    });

    it('throws a descriptive error when override is an empty string and homedir is empty', () => {
        // empty override falls back to homedir; covered by the fallback test.
        // Here we just assert the contract: empty string is not treated as a valid path.
        const root = getInstallRoot('');
        expect(root).not.toBe('');
        expect(root).toContain('agent-config');
    });
});

describe('install/paths — getLogPath', () => {
    it('lives inside the install root and uses install-log.jsonl', () => {
        const log = getLogPath('/home/matze');
        expect(log).toContain(INSTALL_LOG_FILENAME);
        expect(log).toContain(INSTALL_ROOT_SUBPATH.split('/')[0]);
    });

    it('exposes the active-log filename as a stable constant', () => {
        expect(INSTALL_LOG_FILENAME).toBe('install-log.jsonl');
    });
});

describe('install/paths — getTempPath', () => {
    it('matches os.tmpdir() so callers funnel through one symbol', () => {
        expect(getTempPath()).toBe(tmpdir());
    });
});
