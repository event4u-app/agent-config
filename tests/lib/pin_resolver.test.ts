/**
 * Tests for `src/scripts/_lib/pin_resolver.ts`.
 *
 * 1:1 vitest port of `tests/test_pin_resolver.py` (19 tests). The
 * pytest `monkeypatch.setattr(pr, "read_pin", ...)` and
 * `monkeypatch.setattr(pr.shutil, "which", ...)` become the injectable
 * `pin_reader` / `which` seams on `maybe_reexec`.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
    build_reexec_argv,
    maybe_reexec,
    NO_REEXEC_ENV,
    read_pin,
    REEXEC_DEPTH_ENV,
    should_reexec,
} from '../../src/scripts/_lib/pin_resolver';

const UNSET = Symbol('unset');

/** Return a stub settings loader yielding `{agent_config_version: pin_value}`. */
function loader(pin_value: unknown) {
    return (_options: { cwd: string }): Record<string, unknown> => {
        if (pin_value === UNSET) {
            return {};
        }
        return { agent_config_version: pin_value };
    };
}

const tmp_dirs: string[] = [];

function make_tmp(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pin-test-'));
    tmp_dirs.push(dir);
    return dir;
}

afterEach(() => {
    while (tmp_dirs.length > 0) {
        fs.rmSync(tmp_dirs.pop() as string, { recursive: true, force: true });
    }
});

describe('read_pin', () => {
    it('returns the pinned value', async () => {
        const pin = await read_pin(make_tmp(), { settings_loader: loader('1.42.0') });
        expect(pin).toBe('1.42.0');
    });

    it('empty string yields null', async () => {
        expect(await read_pin(make_tmp(), { settings_loader: loader('') })).toBeNull();
    });

    it('missing key yields null', async () => {
        expect(await read_pin(make_tmp(), { settings_loader: loader(UNSET) })).toBeNull();
    });

    it('non-string yields null', async () => {
        expect(await read_pin(make_tmp(), { settings_loader: loader(123) })).toBeNull();
    });

    it('strips whitespace', async () => {
        expect(await read_pin(make_tmp(), { settings_loader: loader('  1.42.0  ') })).toBe(
            '1.42.0',
        );
    });
});

describe('should_reexec', () => {
    it('no pin → false', () => {
        expect(should_reexec(null, '1.41.0', { env: {} })).toBe(false);
    });

    it('no installed version → false', () => {
        expect(should_reexec('1.42.0', '', { env: {} })).toBe(false);
    });

    it('match → false', () => {
        expect(should_reexec('1.42.0', '1.42.0', { env: {} })).toBe(false);
    });

    it('match with v-prefix → false', () => {
        expect(should_reexec('v1.42.0', '1.42.0', { env: {} })).toBe(false);
        expect(should_reexec('1.42.0', 'v1.42.0', { env: {} })).toBe(false);
    });

    it('mismatch triggers', () => {
        expect(should_reexec('1.42.0', '1.41.0', { env: {} })).toBe(true);
    });

    it('blocked by the no-reexec env var', () => {
        const env = { [NO_REEXEC_ENV]: '1' };
        expect(should_reexec('1.42.0', '1.41.0', { env })).toBe(false);
    });

    it('blocked by the depth guard', () => {
        const env = { [REEXEC_DEPTH_ENV]: '1' };
        expect(should_reexec('1.42.0', '1.41.0', { env })).toBe(false);
    });
});

describe('build_reexec_argv', () => {
    it('builds the npx argv', () => {
        const argv = build_reexec_argv('1.42.0', ['update', '--check']);
        expect(argv).toEqual([
            'npx',
            '--yes',
            '@event4u/agent-config@1.42.0',
            'update',
            '--check',
        ]);
    });

    it('normalises the v-prefix', () => {
        const argv = build_reexec_argv('v2.0.0', []);
        expect(argv).toEqual(['npx', '--yes', '@event4u/agent-config@2.0.0']);
    });
});

describe('maybe_reexec', () => {
    it('returns null when the pin matches', async () => {
        const result = await maybe_reexec('1.41.0', {
            cwd: make_tmp(),
            argv: ['agent-config'],
            env: {},
            pin_reader: () => '1.41.0',
        });
        expect(result).toBeNull();
    });

    it('returns null when there is no pin', async () => {
        const result = await maybe_reexec('1.41.0', {
            cwd: make_tmp(),
            argv: ['agent-config'],
            env: {},
            pin_reader: () => null,
        });
        expect(result).toBeNull();
    });

    it('invokes the runner with the child env', async () => {
        const captured: { npx?: string; argv?: string[]; env?: Record<string, string | undefined> } =
            {};

        const rc = await maybe_reexec('1.41.0', {
            cwd: make_tmp(),
            argv: ['agent-config', 'update', '--check'],
            env: { PATH: '/usr/bin' },
            pin_reader: () => '1.42.0',
            which: () => '/usr/bin/npx',
            runner: (npx, argv, env) => {
                captured.npx = npx;
                captured.argv = argv;
                captured.env = env;
                return 0;
            },
        });

        expect(rc).toBe(0);
        expect(captured.npx).toBe('/usr/bin/npx');
        expect(captured.argv).toEqual([
            'npx',
            '--yes',
            '@event4u/agent-config@1.42.0',
            'update',
            '--check',
        ]);
        expect(captured.env?.[REEXEC_DEPTH_ENV]).toBe('1');
    });

    it('returns null when npx is missing', async () => {
        const result = await maybe_reexec('1.41.0', {
            cwd: make_tmp(),
            argv: ['agent-config'],
            env: {},
            pin_reader: () => '1.42.0',
            which: () => null,
        });
        expect(result).toBeNull();
    });

    it('respects the no-reexec env var', async () => {
        const result = await maybe_reexec('1.41.0', {
            cwd: make_tmp(),
            argv: ['agent-config'],
            env: { [NO_REEXEC_ENV]: '1' },
            pin_reader: () => '1.42.0',
        });
        expect(result).toBeNull();
    });
});
