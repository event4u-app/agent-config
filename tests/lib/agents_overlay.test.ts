
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import * as ao from '../../src/scripts/_lib/agents_overlay';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const tmp_dirs: string[] = [];
let saved_user_global: string | null = null;

function make_tmp(): string {
    const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ao-test-')));
    tmp_dirs.push(dir);
    return dir;
}

function init_git_dir(repo_root: string): void {
    fs.mkdirSync(path.join(repo_root, '.git'));
}

function init_git_file(repo_root: string): void {
    fs.writeFileSync(path.join(repo_root, '.git'), 'gitdir: ../.git/modules/sub\n', 'utf-8');
}

/** Write `agents/<kind>/<name>.md` under `layer_dir`; returns the path. */
function write_overlay(layer_dir: string, kind: string, name: string, body = 'x'): string {
    const target = path.join(layer_dir, 'agents', kind, `${name}.md`);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, body, 'utf-8');
    return target;
}

/**
 * Redirect `USER_GLOBAL_AGENTS_DIR` to a tmp path for the test, mirroring
 * the pytest `_isolated_user_global` fixture. Returns the fake agents dir
 * (`<fake_home>/.config/agent-config/agents`).
 */
function isolate_user_global(tmp: string): string {
    if (saved_user_global === null) {
        saved_user_global = ao.USER_GLOBAL_AGENTS_DIR;
    }
    const fake_global = path.join(tmp, '_fake_home', '.config', 'agent-config', 'agents');
    ao._setUserGlobalAgentsDir(fake_global);
    return fake_global;
}

afterEach(() => {
    if (saved_user_global !== null) {
        ao._setUserGlobalAgentsDir(saved_user_global);
        saved_user_global = null;
    }
    while (tmp_dirs.length > 0) {
        fs.rmSync(tmp_dirs.pop() as string, { recursive: true, force: true });
    }
});

function mkdirp(p: string): string {
    fs.mkdirSync(p, { recursive: true });
    return p;
}

function read(p: string): string {
    return fs.readFileSync(p, 'utf-8');
}

// --- contract / kind guard --------------------------------------------------

describe('contract / kind guard', () => {
    it('invalid kind raises', () => {
        const tmp = make_tmp();
        expect(() => ao.resolve_overlay('foo', 'roadmaps', tmp)).toThrow(/not cascade-eligible/);
    });

    it('invalid kind state raises', () => {
        const tmp = make_tmp();
        expect(() => ao.resolve_overlay('anything', 'state', tmp)).toThrow();
    });
});

// --- in-project cascade -----------------------------------------------------

describe('in-project cascade', () => {
    it('no intermediate file returns null', () => {
        const tmp = make_tmp();
        isolate_user_global(tmp);
        init_git_dir(tmp);
        const deep = mkdirp(path.join(tmp, 'a', 'b'));
        expect(ao.resolve_overlay('missing', 'contexts', deep)).toBeNull();
    });

    it('repo root only resolves', () => {
        const tmp = make_tmp();
        isolate_user_global(tmp);
        init_git_dir(tmp);
        const target = write_overlay(tmp, 'contexts', 'shared');
        const deep = mkdirp(path.join(tmp, 'a', 'b'));
        expect(ao.resolve_overlay('shared', 'contexts', deep)).toBe(target);
    });

    it('one intermediate layer wins', () => {
        const tmp = make_tmp();
        isolate_user_global(tmp);
        init_git_dir(tmp);
        write_overlay(tmp, 'contexts', 'shared', 'root');
        const mid = mkdirp(path.join(tmp, 'mid'));
        const mid_target = write_overlay(mid, 'contexts', 'shared', 'mid');
        const deep = mkdirp(path.join(mid, 'deep'));
        const resolved = ao.resolve_overlay('shared', 'contexts', deep);
        expect(resolved).toBe(mid_target);
        expect(read(resolved as string)).toBe('mid');
    });

    it('cwd file wins over root', () => {
        const tmp = make_tmp();
        isolate_user_global(tmp);
        init_git_dir(tmp);
        write_overlay(tmp, 'decisions', 'adr-1', 'root');
        const cwd = mkdirp(path.join(tmp, 'deep'));
        const cwd_target = write_overlay(cwd, 'decisions', 'adr-1', 'cwd');
        const resolved = ao.resolve_overlay('adr-1', 'decisions', cwd);
        expect(resolved).toBe(cwd_target);
        expect(read(resolved as string)).toBe('cwd');
    });
});

// --- user-global asymmetry --------------------------------------------------

describe('user-global asymmetry', () => {
    it('user-global overrides resolves', () => {
        const tmp = make_tmp();
        const fake_global = isolate_user_global(tmp);
        init_git_dir(tmp);
        const target = write_overlay(path.dirname(fake_global), 'overrides', 'personal');
        const deep = mkdirp(path.join(tmp, 'sub'));
        expect(ao.resolve_overlay('personal', 'overrides', deep)).toBe(target);
    });

    it('user-global contexts silently skipped', () => {
        const tmp = make_tmp();
        const fake_global = isolate_user_global(tmp);
        init_git_dir(tmp);
        // File exists at user-global level, but `contexts` is not whitelisted.
        write_overlay(path.dirname(fake_global), 'contexts', 'leaked');
        const deep = mkdirp(path.join(tmp, 'sub'));
        expect(ao.resolve_overlay('leaked', 'contexts', deep)).toBeNull();
    });

    it('user-global decisions silently skipped', () => {
        const tmp = make_tmp();
        const fake_global = isolate_user_global(tmp);
        init_git_dir(tmp);
        write_overlay(path.dirname(fake_global), 'decisions', 'adr-leak');
        const deep = mkdirp(path.join(tmp, 'sub'));
        expect(ao.resolve_overlay('adr-leak', 'decisions', deep)).toBeNull();
    });

    it('in-project overrides beats user-global', () => {
        const tmp = make_tmp();
        const fake_global = isolate_user_global(tmp);
        init_git_dir(tmp);
        write_overlay(path.dirname(fake_global), 'overrides', 'p', 'user');
        const project_target = write_overlay(tmp, 'overrides', 'p', 'project');
        const deep = mkdirp(path.join(tmp, 'sub'));
        const resolved = ao.resolve_overlay('p', 'overrides', deep);
        expect(resolved).toBe(project_target);
        expect(read(resolved as string)).toBe('project');
    });
});

// --- submodule + no-.git edge cases ----------------------------------------

describe('submodule + no-.git edge cases', () => {
    it('submodule git file works', () => {
        const tmp = make_tmp();
        isolate_user_global(tmp);
        init_git_file(tmp);
        const target = write_overlay(tmp, 'contexts', 'sub');
        const deep = mkdirp(path.join(tmp, 'x'));
        expect(ao.resolve_overlay('sub', 'contexts', deep)).toBe(target);
    });

    it('no git returns null for contexts', () => {
        const tmp = make_tmp();
        isolate_user_global(tmp);
        const deep = mkdirp(path.join(tmp, 'no-git', 'deep'));
        // No .git anywhere → in-project chain skipped; contexts not user-global.
        expect(ao.resolve_overlay('anything', 'contexts', deep)).toBeNull();
    });
});

// === Differential block: TS port vs live Python module =====================

const DRIVER = path.join(REPO_ROOT, 'tests', 'lib', 'agents_overlay_py_driver.py');

/** Encode a TS `resolve_overlay` result the same way the driver does. */
function ts_encode(
    resolved: string | null,
    cwd: string,
    user_global_agents_dir: string,
): { path: string | null } {
    if (resolved === null) {
        return { path: null };
    }
    const real = (p: string): string => {
        try {
            return fs.realpathSync(p);
        } catch {
            return path.resolve(p);
        }
    };
    const resolved_abs = real(resolved);
    const cwd_abs = real(cwd);
    const ug_abs = real(user_global_agents_dir);
    const rel_cwd = path.relative(cwd_abs, resolved_abs);
    if (rel_cwd !== '' && !rel_cwd.startsWith('..') && !path.isAbsolute(rel_cwd)) {
        return { path: rel_cwd.split(path.sep).join('/') };
    }
    const rel_ug = path.relative(ug_abs, resolved_abs);
    if (rel_ug !== '' && !rel_ug.startsWith('..') && !path.isAbsolute(rel_ug)) {
        return { path: `user-global:${rel_ug.split(path.sep).join('/')}` };
    }
    return { path: resolved_abs.split(path.sep).join('/') };
}

function ts_run(
    user_global_agents_dir: string,
    name: string,
    kind: string,
    cwd: string,
): { path: string | null } {
    ao._setUserGlobalAgentsDir(user_global_agents_dir);
    const resolved = ao.resolve_overlay(name, kind, cwd);
    return ts_encode(resolved, cwd, user_global_agents_dir);
}
