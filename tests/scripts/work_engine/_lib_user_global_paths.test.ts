
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

interface PyPaths {
    event4u_root: string;
    legacy_xdg_root: string;
    write_target: string;
    resolve: string | null;
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
