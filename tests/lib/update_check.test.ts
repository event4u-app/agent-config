/**
 * Tests for `src/scripts/_lib/update_check.ts`.
 *
 * 1:1 vitest port of `tests/test_update_check.py` (19 tests incl. the
 * 6-case `_is_newer` parametrization → `test.each`). Covers:
 *
 * - 24 h cadence gate (pinned `now`).
 * - All six suppression branches: CI, GITHUB_ACTIONS, non-TTY,
 *   `AGENT_CONFIG_NO_UPDATE_CHECK=1`, `settings_enabled=false`,
 *   registry-error tolerance.
 * - State-file shape (`last_check_utc`, `last_seen_version`,
 *   `installed_version`) and `0600` mode.
 * - Atomic write + JSON shape round-trip.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    _is_newer,
    check_for_update,
    type Fetcher,
} from '../../src/scripts/_lib/update_check';

const NOW = new Date(Date.UTC(2026, 4, 12, 9, 31, 14));

let tmp_dir: string;
let state_path: string;

beforeEach(() => {
    tmp_dir = fs.mkdtempSync(path.join(os.tmpdir(), 'update-check-test-'));
    state_path = path.join(tmp_dir, 'config', 'update-check.json');
});

afterEach(() => {
    fs.rmSync(tmp_dir, { recursive: true, force: true });
});

function fetcher(version: string | null): Fetcher {
    return () => version;
}

/** `%Y-%m-%dT%H:%M:%SZ` like the Python tests' strftime calls. */
function format_utc(d: Date): string {
    return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function hours(n: number): number {
    return n * 60 * 60 * 1000;
}

// --- suppression branches ---------------------------------------------------

describe('suppression branches', () => {
    it('suppresses when AGENT_CONFIG_NO_UPDATE_CHECK=1', async () => {
        const result = await check_for_update('1.0.0', {
            now: NOW,
            state_path,
            env: { AGENT_CONFIG_NO_UPDATE_CHECK: '1' },
            is_tty: true,
            fetcher: fetcher('2.0.0'),
        });
        expect(result).toBeNull();
        expect(fs.existsSync(state_path)).toBe(false);
    });

    it('suppresses in CI', async () => {
        const result = await check_for_update('1.0.0', {
            now: NOW,
            state_path,
            env: { CI: 'true' },
            is_tty: true,
            fetcher: fetcher('2.0.0'),
        });
        expect(result).toBeNull();
    });

    it('suppresses in GitHub Actions', async () => {
        const result = await check_for_update('1.0.0', {
            now: NOW,
            state_path,
            env: { GITHUB_ACTIONS: 'true' },
            is_tty: true,
            fetcher: fetcher('2.0.0'),
        });
        expect(result).toBeNull();
    });

    it('suppresses when stdout is not a TTY', async () => {
        const result = await check_for_update('1.0.0', {
            now: NOW,
            state_path,
            env: {},
            is_tty: false,
            fetcher: fetcher('2.0.0'),
        });
        expect(result).toBeNull();
    });

    it('suppresses when disabled via settings', async () => {
        const result = await check_for_update('1.0.0', {
            now: NOW,
            state_path,
            env: {},
            is_tty: true,
            settings_enabled: false,
            fetcher: fetcher('2.0.0'),
        });
        expect(result).toBeNull();
    });

    it('suppresses when the registry returns null', async () => {
        const result = await check_for_update('1.0.0', {
            now: NOW,
            state_path,
            env: {},
            is_tty: true,
            fetcher: fetcher(null),
        });
        expect(result).toBeNull();
        // State file is still written so we don't hammer the registry.
        expect(fs.existsSync(state_path)).toBe(true);
    });
});

// --- 24 h cadence gate ------------------------------------------------------

describe('24 h cadence gate', () => {
    it('first run fetches and returns a banner', async () => {
        const banner = await check_for_update('1.0.0', {
            now: NOW,
            state_path,
            env: {},
            is_tty: true,
            fetcher: fetcher('2.0.0'),
        });
        expect(banner).not.toBeNull();
        expect(banner).toContain('1.0.0');
        expect(banner).toContain('2.0.0');
        const data = JSON.parse(fs.readFileSync(state_path, 'utf-8')) as Record<string, string>;
        expect(data.installed_version).toBe('1.0.0');
        expect(data.last_seen_version).toBe('2.0.0');
        expect(data.last_check_utc?.endsWith('Z')).toBe(true);
    });

    it('within 24 h does not fetch', async () => {
        fs.mkdirSync(path.dirname(state_path), { recursive: true });
        fs.writeFileSync(
            state_path,
            JSON.stringify({
                last_check_utc: format_utc(new Date(NOW.getTime() - hours(12))),
                last_seen_version: '2.0.0',
                installed_version: '1.0.0',
            }),
            'utf-8',
        );

        let calls = 0;
        const spy: Fetcher = () => {
            calls += 1;
            return '9.9.9';
        };

        const banner = await check_for_update('1.0.0', {
            now: NOW,
            state_path,
            env: {},
            is_tty: true,
            fetcher: spy,
        });
        expect(calls).toBe(0);
        expect(banner).not.toBeNull(); // cached "2.0.0" is newer than installed
        expect(banner).toContain('2.0.0');
    });

    it('after 24 h refetches', async () => {
        fs.mkdirSync(path.dirname(state_path), { recursive: true });
        fs.writeFileSync(
            state_path,
            JSON.stringify({
                last_check_utc: format_utc(new Date(NOW.getTime() - hours(25))),
                last_seen_version: '1.0.0',
                installed_version: '1.0.0',
            }),
            'utf-8',
        );

        const banner = await check_for_update('1.0.0', {
            now: NOW,
            state_path,
            env: {},
            is_tty: true,
            fetcher: fetcher('2.1.0'),
        });
        expect(banner).not.toBeNull();
        expect(banner).toContain('2.1.0');
        const data = JSON.parse(fs.readFileSync(state_path, 'utf-8')) as Record<string, string>;
        expect(data.last_seen_version).toBe('2.1.0');
    });

    it('no banner when the same version is latest', async () => {
        const banner = await check_for_update('2.0.0', {
            now: NOW,
            state_path,
            env: {},
            is_tty: true,
            fetcher: fetcher('2.0.0'),
        });
        expect(banner).toBeNull();
    });

    it('no banner when the installed version is newer', async () => {
        const banner = await check_for_update('3.0.0', {
            now: NOW,
            state_path,
            env: {},
            is_tty: true,
            fetcher: fetcher('2.0.0'),
        });
        expect(banner).toBeNull();
    });
});

// --- state-file mode + atomic write ----------------------------------------

describe('state-file mode + atomic write', () => {
    it('state file mode is 0600', async () => {
        await check_for_update('1.0.0', {
            now: NOW,
            state_path,
            env: {},
            is_tty: true,
            fetcher: fetcher('2.0.0'),
        });
        const mode = fs.statSync(state_path).mode & 0o777;
        expect(mode, `expected 0o600, got 0o${mode.toString(8)}`).toBe(0o600);
    });

    it('corrupt state falls back to a fetch', async () => {
        fs.mkdirSync(path.dirname(state_path), { recursive: true });
        fs.writeFileSync(state_path, '{not json', 'utf-8');

        const banner = await check_for_update('1.0.0', {
            now: NOW,
            state_path,
            env: {},
            is_tty: true,
            fetcher: fetcher('2.0.0'),
        });
        expect(banner).not.toBeNull();
        const data = JSON.parse(fs.readFileSync(state_path, 'utf-8')) as Record<string, string>;
        expect(data.last_seen_version).toBe('2.0.0');
    });
});

// --- semver comparator ------------------------------------------------------

describe('_is_newer', () => {
    it.each<[string, string, boolean]>([
        ['2.0.0', '1.9.9', true],
        ['1.10.0', '1.9.0', true],
        ['1.0.0', '1.0.0', false],
        ['1.0.0', '1.0.1', false],
        ['v2.0.0', '1.0.0', true],
        ['2.0.0-beta.1', '1.9.9', true],
    ])('latest=%s installed=%s → %s', (latest, installed, expected) => {
        expect(_is_newer(latest, installed)).toBe(expected);
    });
});
