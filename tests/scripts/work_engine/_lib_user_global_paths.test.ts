/**
 * Golden-parity tests for the work_engine twin
 * `src/agent-src/templates/scripts/work_engine/_lib/user_global_paths.ts`.
 *
 * The work_engine twin is a byte-identical copy of the dev-side twin
 * `src/scripts/_lib/user_global_paths.ts` (verified by the migration). These
 * tests pin that behavioural parity from the work_engine path specifically:
 *
 *   - a unit block mirroring the public surface, and
 *   - a differential block that runs the work_engine Python module
 *     (`work_engine/_lib/user_global_paths.py`) through a `python3 -c`
 *     driver and asserts the TS twin's resolved paths JSON-equal the
 *     Python reference, byte-for-byte.
 *
 * Adapted from `tests/lib/user_global_paths.test.ts`, repointed at the
 * work_engine `_lib/` location. Python import uses the package form
 * (`sys.path = <work_engine dir>; from _lib import user_global_paths`) so
 * the relative `from .` imports inside the module resolve.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import * as user_global_paths from '../../../src/agent-src/templates/scripts/work_engine/_lib/user_global_paths';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const WORK_ENGINE_DIR = path.join(
    REPO_ROOT,
    'src',
    'agent-src',
    'templates',
    'scripts',
    'work_engine',
);

const tmp_dirs: string[] = [];
const saved_env: Array<[string, string | undefined]> = [];

function make_tmp(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'we-ugp-test-'));
    tmp_dirs.push(dir);
    return dir;
}

function patch_env(key: string, value: string | undefined): void {
    saved_env.push([key, process.env[key]]);
    if (value === undefined) {
        delete process.env[key];
    } else {
        process.env[key] = value;
    }
}

afterEach(() => {
    while (saved_env.length > 0) {
        const [key, value] = saved_env.pop() as [string, string | undefined];
        if (value === undefined) {
            delete process.env[key];
        } else {
            process.env[key] = value;
        }
    }
    while (tmp_dirs.length > 0) {
        fs.rmSync(tmp_dirs.pop() as string, { recursive: true, force: true });
    }
});

// --- unit surface ---------------------------------------------------------

describe('work_engine user_global_paths — unit surface', () => {
    it('event4u_root defaults to ~/.event4u/agent-config', () => {
        patch_env(user_global_paths.EVENT4U_HOME_ENV, undefined);
        patch_env('HOME', '/home/test');
        expect(user_global_paths.event4u_root()).toBe('/home/test/.event4u/agent-config');
    });

    it('event4u_root honours the env override', () => {
        const tmp = make_tmp();
        const custom = path.join(tmp, 'custom-root');
        const env = { [user_global_paths.EVENT4U_HOME_ENV]: custom };
        expect(user_global_paths.event4u_root(env)).toBe(custom);
    });

    it('legacy_xdg_root is ~/.config/agent-config', () => {
        patch_env('HOME', '/home/test');
        expect(user_global_paths.legacy_xdg_root()).toBe('/home/test/.config/agent-config');
    });

    it('resolve_with_fallback prefers the new path when present', () => {
        const tmp = make_tmp();
        const new_root = path.join(tmp, '.event4u', 'agent-config');
        fs.mkdirSync(new_root, { recursive: true });
        fs.writeFileSync(path.join(new_root, 'settings.yml'), 'new=1', 'utf-8');
        const env = { [user_global_paths.EVENT4U_HOME_ENV]: new_root };
        expect(user_global_paths.resolve_with_fallback('settings.yml', { env })).toBe(
            path.join(new_root, 'settings.yml'),
        );
    });

    it('resolve_with_fallback rejects absolute paths', () => {
        expect(() => user_global_paths.resolve_with_fallback('/etc/passwd')).toThrow(
            /expects a relative path/,
        );
    });

    it('write_target always lands in the new root', () => {
        const tmp = make_tmp();
        const custom = path.join(tmp, 'root');
        const env = { [user_global_paths.EVENT4U_HOME_ENV]: custom };
        expect(user_global_paths.write_target('installed.lock', { env })).toBe(
            path.join(custom, 'installed.lock'),
        );
    });

    it('migrate_legacy_namespace copies the legacy tree into the new root', () => {
        const tmp = make_tmp();
        const new_root = path.join(tmp, '.event4u', 'agent-config');
        const env = { [user_global_paths.EVENT4U_HOME_ENV]: new_root };
        const legacy = path.join(tmp, '.config', 'agent-config');
        fs.mkdirSync(legacy, { recursive: true });
        fs.writeFileSync(path.join(legacy, 'agent-settings.yml'), 'hello: world\n', 'utf-8');

        const migrated = user_global_paths.migrate_legacy_namespace({
            env,
            legacy_root_override: legacy,
        });

        expect(migrated).toBe(true);
        expect(fs.readFileSync(path.join(new_root, 'agent-settings.yml'), 'utf-8')).toBe(
            'hello: world\n',
        );
        expect(
            fs.existsSync(path.join(legacy, user_global_paths.MIGRATION_BREADCRUMB_NAME)),
        ).toBe(true);
    });
});

// --- differential vs the work_engine Python reference ---------------------

const PY_DRIVER = [
    'import json, os, sys',
    'sys.path.insert(0, sys.argv[1])',
    'from _lib import user_global_paths as u',
    'out = {',
    '    "event4u_root": str(u.event4u_root()),',
    '    "legacy_xdg_root": str(u.legacy_xdg_root()),',
    '    "write_target": str(u.write_target("installed.lock")),',
    '}',
    'r = u.resolve_with_fallback("settings.yml")',
    'out["resolve"] = str(r) if r is not None else None',
    'print(json.dumps(out, sort_keys=True))',
].join('\n');

interface PyPaths {
    event4u_root: string;
    legacy_xdg_root: string;
    write_target: string;
    resolve: string | null;
}

function run_py_driver(env_overrides: Record<string, string | undefined>): PyPaths {
    const env: Record<string, string> = { PATH: process.env.PATH ?? '' };
    for (const [key, value] of Object.entries(env_overrides)) {
        if (value !== undefined) {
            env[key] = value;
        }
    }
    const result = spawnSync('python3', ['-c', PY_DRIVER, WORK_ENGINE_DIR], {
        env,
        encoding: 'utf-8',
    });
    expect(result.status, result.stderr).toBe(0);
    return JSON.parse(result.stdout) as PyPaths;
}

function ts_paths(): PyPaths {
    const resolved = user_global_paths.resolve_with_fallback('settings.yml');
    return {
        event4u_root: user_global_paths.event4u_root(),
        legacy_xdg_root: user_global_paths.legacy_xdg_root(),
        write_target: user_global_paths.write_target('installed.lock'),
        resolve: resolved,
    };
}

const PY_OK = spawnSync('python3', ['-c', 'import sys'], { encoding: 'utf-8' }).status === 0;

describe.skipIf(!PY_OK)('work_engine user_global_paths — differential vs Python', () => {
    it('scenario 1 — default HOME, no override', () => {
        const home = make_tmp();
        patch_env('HOME', home);
        patch_env(user_global_paths.EVENT4U_HOME_ENV, undefined);
        const py = run_py_driver({ HOME: home });
        expect(ts_paths()).toEqual(py);
        expect(py.resolve).toBeNull();
    });

    it('scenario 2 — EVENT4U_CONFIG_HOME override with existing file', () => {
        const home = make_tmp();
        const custom = path.join(make_tmp(), 'custom-root');
        fs.mkdirSync(custom, { recursive: true });
        fs.writeFileSync(path.join(custom, 'settings.yml'), 'x: 1\n', 'utf-8');
        patch_env('HOME', home);
        patch_env(user_global_paths.EVENT4U_HOME_ENV, custom);
        const py = run_py_driver({
            HOME: home,
            [user_global_paths.EVENT4U_HOME_ENV]: custom,
        });
        expect(ts_paths()).toEqual(py);
        expect(py.resolve).toBe(path.join(custom, 'settings.yml'));
    });

    it('scenario 3 — legacy fallback when only the XDG tree exists', () => {
        const home = make_tmp();
        const legacy = path.join(home, '.config', 'agent-config');
        fs.mkdirSync(legacy, { recursive: true });
        fs.writeFileSync(path.join(legacy, 'settings.yml'), 'legacy: 1\n', 'utf-8');
        patch_env('HOME', home);
        patch_env(user_global_paths.EVENT4U_HOME_ENV, undefined);
        const py = run_py_driver({ HOME: home });
        expect(ts_paths()).toEqual(py);
        expect(py.resolve).toBe(path.join(legacy, 'settings.yml'));
    });
});
