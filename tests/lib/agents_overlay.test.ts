/**
 * Tests for `src/scripts/_lib/agents_overlay.ts`.
 *
 * 1:1 vitest port of `tests/test_agents_overlay.py` — the cascade
 * resolver contract suite. Covers every branch of `resolve_overlay`:
 * no-intermediate, one-intermediate-layer, CWD-wins, user-global
 * `overrides/` asymmetry, user-global `contexts/`/`decisions/` skip,
 * full chain, submodule `.git`-file, no-`.git`, and invalid-kind throw.
 *
 * Plus a differential block comparing the TS port's resolved path
 * against the live Python module via a `python3` driver (pattern:
 * tests/lib/agent_settings.test.ts).
 *
 * Port mechanics:
 *   - pytest `tmp_path`                 → `make_tmp()` (cleaned afterEach)
 *   - `_isolated_user_global` fixture   → `isolate_user_global()` (restored afterEach)
 *   - `pytest.raises(ValueError)`       → `expect(...).toThrow(...)`
 *   - `.read_text()`                    → `fs.readFileSync(..., 'utf-8')`
 */
import { spawnSync } from 'node:child_process';
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

/**
 * Drive the Python module with the same user-global redirect + inputs and
 * return its JSON. The driver emits the resolved path relative to `cwd`
 * (or `user-global:`-prefixed when it lives under the user-global dir).
 */
function py_driver(
    user_global_agents_dir: string,
    name: string,
    kind: string,
    cwd: string,
): unknown {
    const proc = spawnSync('python3', [DRIVER, user_global_agents_dir, name, kind, cwd], {
        encoding: 'utf-8',
    });
    if (proc.status !== 0) {
        throw new Error(`python driver failed: ${proc.stderr}`);
    }
    return JSON.parse(proc.stdout);
}

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

const PY_OK = (() => {
    const probe = spawnSync('python3', ['-c', 'import yaml'], { encoding: 'utf-8' });
    return probe.status === 0;
})();

describe.skipIf(!PY_OK)('differential — TS port JSON-equals live Python module', () => {
    it('fixture A: full chain — deepest in-project wins', () => {
        const tmp = make_tmp();
        const fake_global = isolate_user_global(tmp);
        init_git_dir(tmp);
        write_overlay(path.dirname(fake_global), 'overrides', 'p', 'user');
        write_overlay(tmp, 'overrides', 'p', 'root');
        const mid = mkdirp(path.join(tmp, 'mid'));
        write_overlay(mid, 'overrides', 'p', 'mid');
        const deep = mkdirp(path.join(mid, 'deep'));
        write_overlay(deep, 'overrides', 'p', 'deep');
        const ts = ts_run(fake_global, 'p', 'overrides', deep);
        expect(ts).toEqual(py_driver(fake_global, 'p', 'overrides', deep));
    });

    it('fixture B: user-global overrides hit (no in-project layer)', () => {
        const tmp = make_tmp();
        const fake_global = isolate_user_global(tmp);
        init_git_dir(tmp);
        write_overlay(path.dirname(fake_global), 'overrides', 'personal', 'user');
        const deep = mkdirp(path.join(tmp, 'sub'));
        const ts = ts_run(fake_global, 'personal', 'overrides', deep);
        expect(ts).toEqual(py_driver(fake_global, 'personal', 'overrides', deep));
    });

    it('fixture C: contexts skips user-global → null', () => {
        const tmp = make_tmp();
        const fake_global = isolate_user_global(tmp);
        init_git_dir(tmp);
        write_overlay(path.dirname(fake_global), 'contexts', 'leaked', 'user');
        const deep = mkdirp(path.join(tmp, 'sub'));
        const ts = ts_run(fake_global, 'leaked', 'contexts', deep);
        expect(ts).toEqual(py_driver(fake_global, 'leaked', 'contexts', deep));
        expect(ts).toEqual({ path: null });
    });

    it('fixture D: invalid kind → error shape', () => {
        const tmp = make_tmp();
        const fake_global = isolate_user_global(tmp);
        const py = py_driver(fake_global, 'foo', 'roadmaps', tmp) as { error?: string };
        expect(py.error).toBeDefined();
        expect(() => ao.resolve_overlay('foo', 'roadmaps', tmp)).toThrow(/not cascade-eligible/);
    });
});
