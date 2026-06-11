/**
 * Tests for `src/scripts/_lib/user_global_paths.ts`.
 *
 * 1:1 vitest port of `tests/test_user_global_paths.py` (12 tests) and
 * `tests/test_namespace_migration.py` (9 tests), plus a differential
 * block comparing the TS port against the Python reference via a
 * `python3 -c` driver (pattern: tests/spikes/yaml_rt_py_driver.py).
 *
 * `monkeypatch.setattr(Path, "home", ...)` becomes a temporary
 * `process.env.HOME` override — `os.homedir()` (like `Path.home()`)
 * resolves `$HOME` first on POSIX.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import * as user_global_paths from '../../src/scripts/_lib/user_global_paths';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const tmp_dirs: string[] = [];
const saved_env: Array<[string, string | undefined]> = [];

function make_tmp(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ugp-test-'));
    tmp_dirs.push(dir);
    return dir;
}

/** Set (or delete, when value is undefined) env vars; restored in afterEach. */
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

// --- event4u_root ---

describe('event4u_root', () => {
    it('defaults to ~/.event4u/agent-config', () => {
        patch_env(user_global_paths.EVENT4U_HOME_ENV, undefined);
        patch_env('HOME', '/home/test');
        expect(user_global_paths.event4u_root()).toBe('/home/test/.event4u/agent-config');
    });

    it('honours the env override', () => {
        const tmp = make_tmp();
        const custom = path.join(tmp, 'custom-root');
        const env = { [user_global_paths.EVENT4U_HOME_ENV]: custom };
        expect(user_global_paths.event4u_root(env)).toBe(custom);
    });

    it('expands a tilde in the env override', () => {
        const env = { [user_global_paths.EVENT4U_HOME_ENV]: '~/elsewhere' };
        const result = user_global_paths.event4u_root(env);
        expect(result).toBe(path.join(os.homedir(), 'elsewhere'));
    });
});

// --- legacy_xdg_root ---

describe('legacy_xdg_root', () => {
    it('is ~/.config/agent-config', () => {
        patch_env('HOME', '/home/test');
        expect(user_global_paths.legacy_xdg_root()).toBe('/home/test/.config/agent-config');
    });
});

// --- resolve_with_fallback ---

describe('resolve_with_fallback', () => {
    it('prefers the new path when present', () => {
        const tmp = make_tmp();
        const new_root = path.join(tmp, '.event4u', 'agent-config');
        fs.mkdirSync(new_root, { recursive: true });
        fs.writeFileSync(path.join(new_root, 'settings.yml'), 'new=1', 'utf-8');
        const env = { [user_global_paths.EVENT4U_HOME_ENV]: new_root };
        const resolved = user_global_paths.resolve_with_fallback('settings.yml', { env });
        expect(resolved).toBe(path.join(new_root, 'settings.yml'));
    });

    it('falls back to the legacy path when the new one is missing', () => {
        const tmp = make_tmp();
        patch_env('HOME', tmp);
        const legacy_root = path.join(tmp, '.config', 'agent-config');
        fs.mkdirSync(legacy_root, { recursive: true });
        fs.writeFileSync(path.join(legacy_root, 'settings.yml'), 'legacy=1', 'utf-8');
        // New root explicit but empty.
        const new_root = path.join(tmp, '.event4u', 'agent-config');
        const env = { [user_global_paths.EVENT4U_HOME_ENV]: new_root };
        const resolved = user_global_paths.resolve_with_fallback('settings.yml', { env });
        expect(resolved).toBe(path.join(legacy_root, 'settings.yml'));
    });

    it('returns null when both are missing', () => {
        const tmp = make_tmp();
        patch_env('HOME', tmp);
        const new_root = path.join(tmp, '.event4u', 'agent-config');
        const env = { [user_global_paths.EVENT4U_HOME_ENV]: new_root };
        expect(user_global_paths.resolve_with_fallback('absent.yml', { env })).toBeNull();
    });

    it('rejects absolute paths', () => {
        expect(() => user_global_paths.resolve_with_fallback('/etc/passwd')).toThrow(
            /expects a relative path/,
        );
    });

    it('handles nested relative fragments', () => {
        const tmp = make_tmp();
        const new_root = path.join(tmp, 'root');
        const nested = path.join(new_root, 'agents', 'global');
        fs.mkdirSync(nested, { recursive: true });
        const env = { [user_global_paths.EVENT4U_HOME_ENV]: new_root };
        const resolved = user_global_paths.resolve_with_fallback('agents/global', { env });
        expect(resolved).toBe(nested);
    });
});

// --- write_target ---

describe('write_target', () => {
    it('always lands in the new root', () => {
        const tmp = make_tmp();
        const custom = path.join(tmp, 'root');
        const env = { [user_global_paths.EVENT4U_HOME_ENV]: custom };
        expect(user_global_paths.write_target('installed.lock', { env })).toBe(
            path.join(custom, 'installed.lock'),
        );
    });

    it('does not create the parent (helper is pure)', () => {
        const tmp = make_tmp();
        const custom = path.join(tmp, 'absent-root');
        const env = { [user_global_paths.EVENT4U_HOME_ENV]: custom };
        const target = user_global_paths.write_target('foo.yml', { env });
        expect(fs.existsSync(path.dirname(target))).toBe(false);
        expect(target).toBe(path.join(custom, 'foo.yml'));
    });

    it('rejects absolute paths', () => {
        expect(() => user_global_paths.write_target('/etc/anything')).toThrow(
            /expects a relative path/,
        );
    });
});

// --- migrate_legacy_namespace (port of tests/test_namespace_migration.py) ---

function make_legacy(tmp: string): string {
    const legacy = path.join(tmp, '.config', 'agent-config');
    fs.mkdirSync(legacy, { recursive: true });
    return legacy;
}

function new_root_env(tmp: string): { new_root: string; env: Record<string, string> } {
    const new_root = path.join(tmp, '.event4u', 'agent-config');
    return { new_root, env: { [user_global_paths.EVENT4U_HOME_ENV]: new_root } };
}

describe('migrate_legacy_namespace', () => {
    it('is a no-op when the legacy root is missing', () => {
        const tmp = make_tmp();
        const { new_root, env } = new_root_env(tmp);
        const legacy = path.join(tmp, 'absent', 'agent-config'); // never created
        const migrated = user_global_paths.migrate_legacy_namespace({
            env,
            legacy_root_override: legacy,
        });
        expect(migrated).toBe(false);
        expect(fs.existsSync(new_root)).toBe(false);
    });

    it('is a no-op when the legacy root is empty', () => {
        const tmp = make_tmp();
        const { new_root, env } = new_root_env(tmp);
        const legacy = make_legacy(tmp);
        const migrated = user_global_paths.migrate_legacy_namespace({
            env,
            legacy_root_override: legacy,
        });
        expect(migrated).toBe(false);
        expect(fs.existsSync(new_root)).toBe(false);
        expect(
            fs.existsSync(path.join(legacy, user_global_paths.MIGRATION_BREADCRUMB_NAME)),
        ).toBe(false);
    });

    it('copies files when only the legacy tree exists', () => {
        const tmp = make_tmp();
        const { new_root, env } = new_root_env(tmp);
        const legacy = make_legacy(tmp);
        fs.writeFileSync(path.join(legacy, 'agent-settings.yml'), 'hello: world\n', 'utf-8');
        fs.writeFileSync(path.join(legacy, 'installed.lock'), 'schema_version: 1\n', 'utf-8');
        const nested = path.join(legacy, 'agents', 'global');
        fs.mkdirSync(nested, { recursive: true });
        fs.writeFileSync(path.join(nested, 'note.md'), '# note\n', 'utf-8');

        const migrated = user_global_paths.migrate_legacy_namespace({
            env,
            legacy_root_override: legacy,
        });

        expect(migrated).toBe(true);
        expect(fs.readFileSync(path.join(new_root, 'agent-settings.yml'), 'utf-8')).toBe(
            'hello: world\n',
        );
        expect(fs.readFileSync(path.join(new_root, 'installed.lock'), 'utf-8')).toBe(
            'schema_version: 1\n',
        );
        expect(
            fs.readFileSync(path.join(new_root, 'agents', 'global', 'note.md'), 'utf-8'),
        ).toBe('# note\n');
    });

    it('preserves the 0600 mode on key files', () => {
        const tmp = make_tmp();
        const { new_root, env } = new_root_env(tmp);
        const legacy = make_legacy(tmp);
        const key_path = path.join(legacy, 'anthropic.key');
        fs.writeFileSync(key_path, 'sk-ant-secret\n', 'utf-8');
        fs.chmodSync(key_path, 0o600);

        const migrated = user_global_paths.migrate_legacy_namespace({
            env,
            legacy_root_override: legacy,
        });

        expect(migrated).toBe(true);
        const copied = path.join(new_root, 'anthropic.key');
        expect(fs.existsSync(copied)).toBe(true);
        const mode = fs.statSync(copied).mode & 0o777;
        expect(mode).toBe(0o600);
    });

    it('writes the breadcrumb into the legacy root', () => {
        const tmp = make_tmp();
        const { env } = new_root_env(tmp);
        const legacy = make_legacy(tmp);
        fs.writeFileSync(path.join(legacy, 'agent-settings.yml'), 'x: 1\n', 'utf-8');

        user_global_paths.migrate_legacy_namespace({ env, legacy_root_override: legacy });

        const breadcrumb = path.join(legacy, user_global_paths.MIGRATION_BREADCRUMB_NAME);
        expect(fs.existsSync(breadcrumb)).toBe(true);
        const body = fs.readFileSync(breadcrumb, 'utf-8');
        expect(body).toContain('~/.event4u/agent-config');
        expect(body).toContain('rm -rf ~/.config/agent-config');
    });

    it('is a no-op when the new root already has content', () => {
        const tmp = make_tmp();
        const { new_root, env } = new_root_env(tmp);
        fs.mkdirSync(new_root, { recursive: true });
        fs.writeFileSync(path.join(new_root, 'agent-settings.yml'), 'new: 1\n', 'utf-8');
        const legacy = make_legacy(tmp);
        fs.writeFileSync(path.join(legacy, 'agent-settings.yml'), 'legacy: 1\n', 'utf-8');

        const migrated = user_global_paths.migrate_legacy_namespace({
            env,
            legacy_root_override: legacy,
        });

        expect(migrated).toBe(false);
        // New root not overwritten.
        expect(fs.readFileSync(path.join(new_root, 'agent-settings.yml'), 'utf-8')).toBe(
            'new: 1\n',
        );
        // Breadcrumb still dropped so the user can clean up the legacy tree.
        expect(
            fs.existsSync(path.join(legacy, user_global_paths.MIGRATION_BREADCRUMB_NAME)),
        ).toBe(true);
    });

    it('second invocation is a no-op', () => {
        const tmp = make_tmp();
        const { new_root, env } = new_root_env(tmp);
        const legacy = make_legacy(tmp);
        fs.writeFileSync(path.join(legacy, 'agent-settings.yml'), 'once: 1\n', 'utf-8');

        const first = user_global_paths.migrate_legacy_namespace({
            env,
            legacy_root_override: legacy,
        });
        const second = user_global_paths.migrate_legacy_namespace({
            env,
            legacy_root_override: legacy,
        });

        expect(first).toBe(true);
        expect(second).toBe(false);
        expect(
            fs.existsSync(path.join(legacy, user_global_paths.MIGRATION_BREADCRUMB_NAME)),
        ).toBe(true);
        expect(fs.readFileSync(path.join(new_root, 'agent-settings.yml'), 'utf-8')).toBe(
            'once: 1\n',
        );
    });

    it('skips pre-existing target entries (content gate)', () => {
        // If new root has a partial subset, existing entries must not be overwritten.
        const tmp = make_tmp();
        const { new_root, env } = new_root_env(tmp);
        fs.mkdirSync(new_root, { recursive: true });
        fs.writeFileSync(path.join(new_root, 'agent-settings.yml'), 'new: 1\n', 'utf-8');
        const legacy = make_legacy(tmp);
        fs.writeFileSync(path.join(legacy, 'agent-settings.yml'), 'legacy: 1\n', 'utf-8');
        fs.writeFileSync(path.join(legacy, 'extra.yml'), 'extra: legacy\n', 'utf-8');

        // New root has content → treated as already-migrated; no copy at all.
        const migrated = user_global_paths.migrate_legacy_namespace({
            env,
            legacy_root_override: legacy,
        });
        expect(migrated).toBe(false);
        expect(fs.readFileSync(path.join(new_root, 'agent-settings.yml'), 'utf-8')).toBe(
            'new: 1\n',
        );
        expect(fs.existsSync(path.join(new_root, 'extra.yml'))).toBe(false);
    });

    it('recovers from partial-copy leftovers of an interrupted run', () => {
        // Crash mid-copy → next run cleans the .event4u-partial-* debris and retries.
        const tmp = make_tmp();
        const { new_root, env } = new_root_env(tmp);
        fs.mkdirSync(new_root, { recursive: true });
        // Simulate a prior interrupted run: only partial-suffixed debris exists,
        // no real entries. The next migration must treat this as "no content"
        // and complete the copy.
        const debris = path.join(new_root, `agents${user_global_paths._PARTIAL_SUFFIX}12345`);
        fs.mkdirSync(debris);
        fs.writeFileSync(path.join(debris, 'halfwritten.md'), 'partial\n', 'utf-8');

        const legacy = make_legacy(tmp);
        fs.writeFileSync(path.join(legacy, 'agent-settings.yml'), 'once: 1\n', 'utf-8');
        const nested = path.join(legacy, 'agents', 'global');
        fs.mkdirSync(nested, { recursive: true });
        fs.writeFileSync(path.join(nested, 'note.md'), '# note\n', 'utf-8');

        const migrated = user_global_paths.migrate_legacy_namespace({
            env,
            legacy_root_override: legacy,
        });

        expect(migrated).toBe(true);
        // Debris from the prior run is purged.
        expect(fs.existsSync(debris)).toBe(false);
        // Real migration completed.
        expect(fs.readFileSync(path.join(new_root, 'agent-settings.yml'), 'utf-8')).toBe(
            'once: 1\n',
        );
        expect(
            fs.readFileSync(path.join(new_root, 'agents', 'global', 'note.md'), 'utf-8'),
        ).toBe('# note\n');
        // No partial siblings remain after success.
        const remaining = fs
            .readdirSync(new_root)
            .filter((name) => name.includes(user_global_paths._PARTIAL_SUFFIX));
        expect(remaining).toEqual([]);
    });
});

// --- differential: TS port vs Python reference ---------------------------
//
// Runs the original `scripts._lib.user_global_paths` through `python3 -c`
// with a controlled env and compares the resolved paths byte-for-byte
// against the TS twin. Note: the module has no XDG_CONFIG_HOME support —
// only the literal `~/.config/agent-config` legacy path — so the env-axis
// scenarios are default-HOME, EVENT4U_CONFIG_HOME override, tilde
// expansion, and legacy fallback. (The win32 `is_absolute` branch is not
// exercisable on this platform.)

const PY_DRIVER = [
    'import json, os, sys',
    'sys.path.insert(0, os.environ["AGENT_CONFIG_REPO_SRC"])',
    'from scripts._lib import user_global_paths as u',
    'out = {',
    '    "event4u_root": str(u.event4u_root()),',
    '    "legacy_xdg_root": str(u.legacy_xdg_root()),',
    '    "write_target": str(u.write_target("installed.lock")),',
    '}',
    'r = u.resolve_with_fallback("settings.yml")',
    'out["resolve"] = str(r) if r is not None else None',
    'print(json.dumps(out))',
].join('\n');

interface PyPaths {
    event4u_root: string;
    legacy_xdg_root: string;
    write_target: string;
    resolve: string | null;
}

function run_py_driver(env_overrides: Record<string, string | undefined>): PyPaths {
    const env: Record<string, string> = {
        PATH: process.env.PATH ?? '',
        AGENT_CONFIG_REPO_SRC: path.join(REPO_ROOT, 'src'),
    };
    for (const [key, value] of Object.entries(env_overrides)) {
        if (value !== undefined) {
            env[key] = value;
        }
    }
    const result = spawnSync('python3', ['-c', PY_DRIVER], { env, encoding: 'utf-8' });
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

describe('differential vs Python reference', () => {
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

    it('scenario 3 — tilde expansion in the override', () => {
        const home = make_tmp();
        fs.mkdirSync(path.join(home, 'cfg-root'), { recursive: true });
        fs.writeFileSync(path.join(home, 'cfg-root', 'settings.yml'), 'x: 1\n', 'utf-8');
        patch_env('HOME', home);
        patch_env(user_global_paths.EVENT4U_HOME_ENV, '~/cfg-root');
        const py = run_py_driver({
            HOME: home,
            [user_global_paths.EVENT4U_HOME_ENV]: '~/cfg-root',
        });
        expect(ts_paths()).toEqual(py);
        expect(py.event4u_root).toBe(path.join(home, 'cfg-root'));
    });

    it('scenario 4 — legacy fallback when only the XDG tree exists', () => {
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
