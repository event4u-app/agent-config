/**
 * Tests for `src/scripts/_lib/agent_settings.ts`.
 *
 * 1:1 vitest port of the pytest suites that exercise THIS module's
 * functions:
 *
 *   - tests/test_agent_settings.py                 (loader + cascade + modules + enumerate)
 *   - tests/test_agent_settings_local_layer.py     (local override layer)
 *   - tests/test_agent_settings_canonical_layer.py (canonical agents/settings/ layer)
 *   - tests/test_agent_settings_relocation_resilience.py
 *   - tests/test_project_root_anchors.py           (find_project_root_with_anchor)
 *   - tests/test_root_override.py                  (resolve_project_root; non-dispatcher tests)
 *   - tests/test_kill_switch.py                    (AGENT_CONFIG_LEGACY_ANCHOR)
 *   - tests/test_subdir_invocation.py              (resolve_project_root from subdirs)
 *   - tests/test_anchor_perf.py                    (anchor-walk budget)
 *
 * Plus direct tests of `find_project_root_with_trace` (a public export
 * the Python suite only exercised through `cmd_doctor`, which is a
 * different out-of-scope script), and a differential block comparing the
 * TS port against the live Python module via a `python3 -c` driver
 * (pattern: tests/spikes/yaml_rt_py_driver.py).
 *
 * Port mechanics:
 *   - pytest `tmp_path`             → `make_tmp()` (temp dir, cleaned afterEach)
 *   - `monkeypatch.setenv/delenv`   → `patch_env()` (restored afterEach)
 *   - `monkeypatch.chdir`           → `chdir()` (restored afterEach)
 *   - `caplog`                      → `logger.records` capture (cleared beforeEach)
 *   - `pytest.raises`               → `expect(...).toThrow(...)`
 *   - parametrize                   → `it.each`
 *
 * The dispatcher end-to-end test (test_dispatcher_exits_2_on_invalid_root)
 * is intentionally NOT ported here — it exercises the bash wrapper, not
 * this module.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as ags from '../../src/scripts/_lib/agent_settings';
import * as user_global_paths from '../../src/scripts/_lib/user_global_paths';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const tmp_dirs: string[] = [];
const saved_env: Array<[string, string | undefined]> = [];
let saved_cwd: string | null = null;

function make_tmp(): string {
    // realpathSync so macOS /var → /private/var symlink resolution matches
    // Python's tmp_path (which is already resolved) and our `_resolve`.
    const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ags-test-')));
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

function chdir(dir: string): void {
    if (saved_cwd === null) {
        saved_cwd = process.cwd();
    }
    process.chdir(dir);
}

/** Write `body` to `p` (creating parents); returns `p`. Mirrors `_write`. */
function write_file(p: string, body: string): string {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, body, 'utf-8');
    return p;
}

function mkdirp(p: string): string {
    fs.mkdirSync(p, { recursive: true });
    return p;
}

/** A user-global path that does not exist (mirrors `tmp_path / "missing.yml"`). */
function no_global(tmp: string): string {
    return path.join(tmp, 'no-such-global.yml');
}

beforeEach(() => {
    ags.logger.records.length = 0;
});

afterEach(() => {
    while (saved_env.length > 0) {
        const [key, value] = saved_env.pop() as [string, string | undefined];
        if (value === undefined) {
            delete process.env[key];
        } else {
            process.env[key] = value;
        }
    }
    if (saved_cwd !== null) {
        process.chdir(saved_cwd);
        saved_cwd = null;
    }
    while (tmp_dirs.length > 0) {
        fs.rmSync(tmp_dirs.pop() as string, { recursive: true, force: true });
    }
    ags.logger.records.length = 0;
});

function log_text(): string {
    return ags.logger.records.map((r) => r.message).join(' ');
}

function init_git_dir(repo_root: string): void {
    mkdirp(path.join(repo_root, '.git'));
}

function init_git_file(repo_root: string): void {
    write_file(path.join(repo_root, '.git'), 'gitdir: ../.git/modules/sub\n');
}

// === tests/test_agent_settings.py ==========================================

// --- tolerance branches ---

describe('load_agent_settings — tolerance branches', () => {
    it('both files missing returns defaults', () => {
        const tmp = make_tmp();
        const result = ags.load_agent_settings({
            project_path: path.join(tmp, 'missing-project.yml'),
            user_global_path: path.join(tmp, 'missing-user.yml'),
        });
        expect(result).toEqual({});
    });

    it('missing project yields user-global whitelisted', () => {
        const tmp = make_tmp();
        const user = write_file(path.join(tmp, 'user.yml'), 'name: Matze\nide: vscode\n');
        const result = ags.load_agent_settings({
            project_path: path.join(tmp, 'missing.yml'),
            user_global_path: user,
        });
        expect(result).toEqual({ name: 'Matze', ide: 'vscode' });
    });

    it('missing user-global yields project', () => {
        const tmp = make_tmp();
        const project = write_file(
            path.join(tmp, 'project.yml'),
            'name: Project\npipelines:\n  ci: true\n',
        );
        const result = ags.load_agent_settings({
            project_path: project,
            user_global_path: path.join(tmp, 'missing.yml'),
        });
        expect(result).toEqual({ name: 'Project', pipelines: { ci: true } });
    });

    it('malformed yaml falls back to other side', () => {
        const tmp = make_tmp();
        const project = write_file(path.join(tmp, 'project.yml'), 'name: ProjectOnly\n');
        const bad = write_file(path.join(tmp, 'user.yml'), ': : : bad\n  - unclosed [\n');
        const result = ags.load_agent_settings({ project_path: project, user_global_path: bad });
        expect(result).toEqual({ name: 'ProjectOnly' });
    });

    it('empty yaml treated as missing', () => {
        const tmp = make_tmp();
        const empty_user = write_file(path.join(tmp, 'user.yml'), '');
        const project = write_file(path.join(tmp, 'project.yml'), 'ide: nvim\n');
        const result = ags.load_agent_settings({ project_path: project, user_global_path: empty_user });
        expect(result).toEqual({ ide: 'nvim' });
    });
});

// --- whitelist filtering ---

describe('load_agent_settings — whitelist filtering', () => {
    it('non-whitelisted user-global keys silently ignored', () => {
        const tmp = make_tmp();
        const user = write_file(
            path.join(tmp, 'user.yml'),
            'name: Matze\npipelines:\n  skill_improvement: true\nroles:\n  active_role: developer\n',
        );
        const result = ags.load_agent_settings({
            project_path: path.join(tmp, 'missing.yml'),
            user_global_path: user,
        });
        expect(result).toEqual({ name: 'Matze' });
        expect('pipelines' in result).toBe(false);
        expect('roles' in result).toBe(false);
    });

    it('verbose logs ignored user-global keys', () => {
        const tmp = make_tmp();
        const user = write_file(
            path.join(tmp, 'user.yml'),
            'name: Matze\npipelines:\n  ci: true\nroles:\n  active: dev\n',
        );
        ags.load_agent_settings({
            project_path: path.join(tmp, 'missing.yml'),
            user_global_path: user,
            verbose: true,
        });
        const joined = log_text();
        expect(joined).toContain('pipelines.ci');
        expect(joined).toContain('roles.active');
        // `name` is whitelisted → must not appear in the ignored list.
        const after_ignored = joined.split('ignored').slice(-1)[0] as string;
        expect(after_ignored.split(':').slice(-1)[0]).not.toContain('name');
    });

    it('namespace partial whitelist only keeps listed paths', () => {
        const tmp = make_tmp();
        const user = write_file(
            path.join(tmp, 'user.yml'),
            "personal:\n  bot_icon: '🤖'\n  autonomy: medium\n  theme: dark\n",
        );
        const result = ags.load_agent_settings({
            project_path: path.join(tmp, 'missing.yml'),
            user_global_path: user,
        });
        expect(result).toEqual({ personal: { bot_icon: '🤖', autonomy: 'medium' } });
        expect('theme' in (result['personal'] as Record<string, unknown>)).toBe(false);
    });
});

// --- merge precedence ---

describe('load_agent_settings — merge precedence', () => {
    it('project wins over user-global on overlap', () => {
        const tmp = make_tmp();
        const project = write_file(path.join(tmp, 'project.yml'), 'name: ProjectMatze\nide: phpstorm\n');
        const user = write_file(path.join(tmp, 'user.yml'), 'name: UserMatze\nide: vscode\n');
        const result = ags.load_agent_settings({ project_path: project, user_global_path: user });
        expect(result['name']).toBe('ProjectMatze');
        expect(result['ide']).toBe('phpstorm');
    });

    it('user-global fills gaps where project silent', () => {
        const tmp = make_tmp();
        const project = write_file(path.join(tmp, 'project.yml'), 'name: ProjectMatze\n');
        const user = write_file(path.join(tmp, 'user.yml'), 'ide: vscode\nrule_loading_tier: lean\n');
        const result = ags.load_agent_settings({ project_path: project, user_global_path: user });
        expect(result).toEqual({ name: 'ProjectMatze', ide: 'vscode', rule_loading_tier: 'lean' });
    });

    it('nested dicts merge per key', () => {
        const tmp = make_tmp();
        const project = write_file(path.join(tmp, 'project.yml'), "personal:\n  bot_icon: '🦊'\n");
        const user = write_file(
            path.join(tmp, 'user.yml'),
            "personal:\n  bot_icon: '🤖'\n  autonomy: high\n",
        );
        const result = ags.load_agent_settings({ project_path: project, user_global_path: user });
        expect(result['personal']).toEqual({ bot_icon: '🦊', autonomy: 'high' });
    });
});

// --- type preservation ---

describe('load_agent_settings — type preservation', () => {
    it('value types preserved through merge', () => {
        const tmp = make_tmp();
        const project = write_file(
            path.join(tmp, 'project.yml'),
            'pipelines:\n  ci: true\n  retries: 3\n  channels:\n    - slack\n    - email\n',
        );
        const user = write_file(path.join(tmp, 'user.yml'), 'rule_loading_tier: lean\n');
        const result = ags.load_agent_settings({ project_path: project, user_global_path: user });
        expect(result['pipelines']['ci']).toBe(true);
        expect(result['pipelines']['retries']).toBe(3);
        expect(result['pipelines']['channels']).toEqual(['slack', 'email']);
        expect(result['rule_loading_tier']).toBe('lean');
    });
});

// --- read-only invariant ---

describe('load_agent_settings — read-only invariant', () => {
    it('loader never creates files', () => {
        const tmp = make_tmp();
        const project = path.join(tmp, 'missing-project.yml');
        const user = path.join(tmp, 'missing-user.yml');
        const before = new Set(fs.readdirSync(tmp));
        ags.load_agent_settings({ project_path: project, user_global_path: user });
        expect(new Set(fs.readdirSync(tmp))).toEqual(before);
        expect(fs.existsSync(project)).toBe(false);
        expect(fs.existsSync(user)).toBe(false);
    });

    it('loader does not mutate input files', () => {
        const tmp = make_tmp();
        const project = write_file(path.join(tmp, 'project.yml'), 'name: KeepMe\n');
        const user = write_file(path.join(tmp, 'user.yml'), 'ide: vscode\n');
        const project_before = fs.readFileSync(project, 'utf-8');
        const user_before = fs.readFileSync(user, 'utf-8');
        ags.load_agent_settings({ project_path: project, user_global_path: user });
        expect(fs.readFileSync(project, 'utf-8')).toBe(project_before);
        expect(fs.readFileSync(user, 'utf-8')).toBe(user_before);
    });
});

// --- default paths ---

describe('load_agent_settings — default paths', () => {
    it('defaults resolve when neither argument given', () => {
        const tmp = make_tmp();
        // monkeypatch.chdir(tmp_path) + DEFAULT_USER_GLOBAL_FILE -> missing file.
        // Port: point EVENT4U_CONFIG_HOME at an empty dir so the resolved
        // user-global file does not exist, and chdir into the empty tmp so
        // the default ./.agent-settings.yml is also absent.
        patch_env(user_global_paths.EVENT4U_HOME_ENV, path.join(tmp, 'empty-home'));
        chdir(tmp);
        expect(ags.load_agent_settings()).toEqual({});
    });
});

// --- whitelist constants ---

describe('MERGEABLE_KEYS', () => {
    it('is the documented exact list', () => {
        expect(ags.MERGEABLE_KEYS).toEqual([
            'name',
            'ide',
            'rule_loading_tier',
            'memory.cadence',
            'personal.bot_icon',
            'personal.autonomy',
            'telegraph.speak_scope',
        ]);
    });
});

// --- in-project cascade ---

describe('find_project_root (cascade primitives)', () => {
    it('finds git directory', () => {
        const tmp = make_tmp();
        init_git_dir(tmp);
        const nested = mkdirp(path.join(tmp, 'sub', 'deep'));
        expect(ags.find_project_root(nested)).toBe(tmp);
    });

    it('finds git file submodule', () => {
        const tmp = make_tmp();
        init_git_file(tmp);
        const nested = mkdirp(path.join(tmp, 'sub'));
        expect(ags.find_project_root(nested)).toBe(tmp);
    });

    it('returns null when no git', () => {
        const tmp = make_tmp();
        const nested = mkdirp(path.join(tmp, 'sub', 'deep'));
        expect(ags.find_project_root(nested)).toBeNull();
    });
});

describe('load_agent_settings — in-project cascade', () => {
    it('cascade disabled by default (back-compat)', () => {
        const tmp = make_tmp();
        init_git_dir(tmp);
        const project = write_file(path.join(tmp, 'project.yml'), 'name: ProjectMatze\n');
        const user = write_file(path.join(tmp, 'user.yml'), 'ide: vscode\n');
        const result = ags.load_agent_settings({ project_path: project, user_global_path: user });
        expect(result).toEqual({ name: 'ProjectMatze', ide: 'vscode' });
    });

    it('cascade no intermediate file', () => {
        const tmp = make_tmp();
        init_git_dir(tmp);
        write_file(path.join(tmp, '.agent-settings.yml'), 'name: RootMatze\nide: phpstorm\n');
        const deep = mkdirp(path.join(tmp, 'sub', 'deep'));
        const result = ags.load_agent_settings({ user_global_path: path.join(tmp, 'no-user.yml'), cwd: deep });
        expect(result).toEqual({ name: 'RootMatze', ide: 'phpstorm' });
    });

    it('cascade one intermediate file — deeper wins', () => {
        const tmp = make_tmp();
        init_git_dir(tmp);
        write_file(path.join(tmp, '.agent-settings.yml'), 'name: Root\nide: vscode\n');
        const sub = mkdirp(path.join(tmp, 'sub'));
        write_file(path.join(sub, '.agent-settings.yml'), 'ide: phpstorm\n');
        const result = ags.load_agent_settings({ user_global_path: path.join(tmp, 'no-user.yml'), cwd: sub });
        expect(result).toEqual({ name: 'Root', ide: 'phpstorm' });
    });

    it('cascade cwd file only — deeper wins', () => {
        const tmp = make_tmp();
        init_git_dir(tmp);
        write_file(path.join(tmp, '.agent-settings.yml'), 'name: Root\nide: vscode\n');
        const deep = mkdirp(path.join(tmp, 'a', 'b', 'c'));
        write_file(path.join(deep, '.agent-settings.yml'), 'ide: nvim\n');
        const result = ags.load_agent_settings({ user_global_path: path.join(tmp, 'no-user.yml'), cwd: deep });
        expect(result).toEqual({ name: 'Root', ide: 'nvim' });
    });

    it('cascade user-global whitelist still applies', () => {
        const tmp = make_tmp();
        init_git_dir(tmp);
        const user = write_file(path.join(tmp, 'user.yml'), 'name: UserMatze\npipelines:\n  ci: true\n');
        write_file(path.join(tmp, '.agent-settings.yml'), 'ide: vscode\n');
        const deep = mkdirp(path.join(tmp, 'sub'));
        const result = ags.load_agent_settings({ user_global_path: user, cwd: deep });
        expect(result).toEqual({ name: 'UserMatze', ide: 'vscode' });
        expect('pipelines' in result).toBe(false);
    });

    it('cascade non-root layer not whitelist filtered', () => {
        const tmp = make_tmp();
        init_git_dir(tmp);
        write_file(path.join(tmp, '.agent-settings.yml'), 'name: Root\n');
        const sub = mkdirp(path.join(tmp, 'sub'));
        write_file(path.join(sub, '.agent-settings.yml'), 'pipelines:\n  ci: false\nroles:\n  active: dev\n');
        const result = ags.load_agent_settings({ user_global_path: path.join(tmp, 'no-user.yml'), cwd: sub });
        expect(result['pipelines']).toEqual({ ci: false });
        expect(result['roles']).toEqual({ active: 'dev' });
    });

    it('cascade full chain — deepest wins', () => {
        const tmp = make_tmp();
        init_git_dir(tmp);
        const user = write_file(path.join(tmp, 'user.yml'), 'name: UserName\nide: vscode\n');
        write_file(path.join(tmp, '.agent-settings.yml'), 'name: RootName\nrule_loading_tier: lean\n');
        const mid = mkdirp(path.join(tmp, 'mid'));
        write_file(path.join(mid, '.agent-settings.yml'), 'rule_loading_tier: balanced\n');
        const deep = mkdirp(path.join(mid, 'deep'));
        write_file(path.join(deep, '.agent-settings.yml'), 'ide: nvim\n');
        const result = ags.load_agent_settings({ user_global_path: user, cwd: deep });
        expect(result).toEqual({ name: 'RootName', rule_loading_tier: 'balanced', ide: 'nvim' });
    });

    it('cascade submodule git file works', () => {
        const tmp = make_tmp();
        init_git_file(tmp);
        write_file(path.join(tmp, '.agent-settings.yml'), 'name: SubmoduleRoot\n');
        const deep = mkdirp(path.join(tmp, 'sub'));
        const result = ags.load_agent_settings({ user_global_path: path.join(tmp, 'no-user.yml'), cwd: deep });
        expect(result).toEqual({ name: 'SubmoduleRoot' });
    });

    it('cascade no git falls back to legacy', () => {
        const tmp = make_tmp();
        const deep = mkdirp(path.join(tmp, 'sub'));
        write_file(path.join(deep, '.agent-settings.yml'), 'name: Local\n');
        const result = ags.load_agent_settings({
            project_path: path.join(deep, '.agent-settings.yml'),
            user_global_path: path.join(tmp, 'no-user.yml'),
            cwd: deep,
        });
        expect(result).toEqual({ name: 'Local' });
    });
});

describe('iter_setting_overrides', () => {
    it('groups by key — last observation wins', () => {
        const tmp = make_tmp();
        init_git_dir(tmp);
        const user = write_file(path.join(tmp, 'user.yml'), 'ide: vscode\n');
        write_file(path.join(tmp, '.agent-settings.yml'), 'ide: phpstorm\nname: Root\n');
        const sub = mkdirp(path.join(tmp, 'sub'));
        write_file(path.join(sub, '.agent-settings.yml'), 'ide: nvim\n');
        const tuples = [...ags.iter_setting_overrides({ user_global_path: user, cwd: sub })];
        const ide_obs = tuples.filter(([k]) => k === 'ide').map(([, v, p]) => [v, p] as const);
        expect(ide_obs.map(([v]) => v)).toEqual(['vscode', 'phpstorm', 'nvim']);
        expect((ide_obs[ide_obs.length - 1] as readonly [unknown, string])[1]).toBe(
            path.join(sub, '.agent-settings.yml'),
        );
    });
});

// --- modules config ---

describe('get_modules_config', () => {
    it('defaults when team file missing; result is a fresh copy', () => {
        const tmp = make_tmp();
        init_git_dir(tmp);
        const result = ags.get_modules_config({ team_path: path.join(tmp, 'missing.yml'), cwd: tmp });
        expect(result).toEqual(ags.MODULES_DEFAULTS);
        (result['root_paths'] as string[]).push('mutated');
        expect(ags.MODULES_DEFAULTS['root_paths']).toEqual([]);
    });

    it('team values win over defaults', () => {
        const tmp = make_tmp();
        init_git_dir(tmp);
        const team = write_file(
            path.join(tmp, '.agent-project-settings.yml'),
            'modules:\n  enabled: true\n  root_paths: [app/Modules, packages]\n  namespace_template: "App\\\\Modules\\\\{ModuleName}"\n',
        );
        const result = ags.get_modules_config({ team_path: team, cwd: tmp });
        expect(result['enabled']).toBe(true);
        expect(result['root_paths']).toEqual(['app/Modules', 'packages']);
        expect(result['namespace_template']).toBe('App\\Modules\\{ModuleName}');
        expect(result['agent_folder']).toBe('agents');
        expect(result['skip_dirs']).toEqual(['.module-template', '.example']);
    });

    it('dev cascade overrides unlocked keys', () => {
        const tmp = make_tmp();
        init_git_dir(tmp);
        const team = write_file(
            path.join(tmp, '.agent-project-settings.yml'),
            'modules:\n  enabled: true\n  root_paths: [app/Modules]\n  agent_folder: agents\n',
        );
        write_file(path.join(tmp, '.agent-settings.yml'), 'modules:\n  agent_folder: docs\n');
        const result = ags.get_modules_config({ team_path: team, cwd: tmp });
        expect(result['agent_folder']).toBe('docs');
        expect(result['root_paths']).toEqual(['app/Modules']);
        expect(result['enabled']).toBe(true);
    });

    it('locked keys block dev override', () => {
        const tmp = make_tmp();
        init_git_dir(tmp);
        const team = write_file(
            path.join(tmp, '.agent-project-settings.yml'),
            'locked_keys:\n  - modules.root_paths\nmodules:\n  enabled: true\n  root_paths: [app/Modules]\n',
        );
        write_file(path.join(tmp, '.agent-settings.yml'), 'modules:\n  root_paths: [src/local]\n  agent_folder: docs\n');
        const result = ags.get_modules_config({ team_path: team, cwd: tmp });
        expect(result['root_paths']).toEqual(['app/Modules']);
        expect(result['agent_folder']).toBe('docs');
        expect(log_text()).toContain('modules.root_paths');
    });

    it('locked key inert without team value', () => {
        const tmp = make_tmp();
        init_git_dir(tmp);
        const team = write_file(
            path.join(tmp, '.agent-project-settings.yml'),
            'locked_keys:\n  - modules.root_paths\nmodules:\n  enabled: true\n',
        );
        write_file(path.join(tmp, '.agent-settings.yml'), 'modules:\n  root_paths: [src/local]\n');
        const result = ags.get_modules_config({ team_path: team, cwd: tmp });
        expect(result['root_paths']).toEqual(['src/local']);
    });
});

// --- enumerate_modules ---

describe('enumerate_modules', () => {
    it('empty root_paths returns empty', () => {
        const tmp = make_tmp();
        init_git_dir(tmp);
        const result = ags.enumerate_modules({
            project_root: tmp,
            modules_config: { enabled: true, root_paths: [], skip_dirs: [], agent_folder: 'agents' },
        });
        expect(result).toEqual([]);
    });

    it('lists subdirs under each root', () => {
        const tmp = make_tmp();
        init_git_dir(tmp);
        mkdirp(path.join(tmp, 'app', 'Modules', 'Alpha'));
        mkdirp(path.join(tmp, 'app', 'Modules', 'Beta'));
        mkdirp(path.join(tmp, 'src', 'modules', 'Gamma'));
        const result = ags.enumerate_modules({
            project_root: tmp,
            modules_config: {
                enabled: true,
                root_paths: ['app/Modules', 'src/modules'],
                skip_dirs: [],
                agent_folder: 'agents',
            },
        });
        expect(result.map((m) => [m.root_path, m.name])).toEqual([
            ['app/Modules', 'Alpha'],
            ['app/Modules', 'Beta'],
            ['src/modules', 'Gamma'],
        ]);
    });

    it('honors skip_dirs', () => {
        const tmp = make_tmp();
        init_git_dir(tmp);
        mkdirp(path.join(tmp, 'app', 'Modules', 'Real'));
        mkdirp(path.join(tmp, 'app', 'Modules', '.module-template'));
        mkdirp(path.join(tmp, 'app', 'Modules', '.example'));
        mkdirp(path.join(tmp, 'app', 'Modules', '.hidden'));
        const result = ags.enumerate_modules({
            project_root: tmp,
            modules_config: {
                enabled: true,
                root_paths: ['app/Modules'],
                skip_dirs: ['.module-template', '.example'],
                agent_folder: 'agents',
            },
        });
        expect(result.map((m) => m.name)).toEqual(['Real']);
    });

    it('has_agent_folder flag', () => {
        const tmp = make_tmp();
        init_git_dir(tmp);
        mkdirp(path.join(tmp, 'app', 'Modules', 'WithDocs', 'agents'));
        mkdirp(path.join(tmp, 'app', 'Modules', 'NoDocs'));
        mkdirp(path.join(tmp, 'app', 'Modules', 'FileNotDir'));
        write_file(path.join(tmp, 'app', 'Modules', 'FileNotDir', 'agents'), 'x');
        const result = ags.enumerate_modules({
            project_root: tmp,
            modules_config: { enabled: true, root_paths: ['app/Modules'], skip_dirs: [], agent_folder: 'agents' },
        });
        const by_name = Object.fromEntries(result.map((m) => [m.name, m]));
        expect((by_name['WithDocs'] as ags.ModuleEntry).has_agent_folder).toBe(true);
        expect((by_name['WithDocs'] as ags.ModuleEntry).agent_folder_path).toBe('app/Modules/WithDocs/agents');
        expect((by_name['NoDocs'] as ags.ModuleEntry).has_agent_folder).toBe(false);
        expect((by_name['NoDocs'] as ags.ModuleEntry).agent_folder_path).toBeNull();
        expect((by_name['FileNotDir'] as ags.ModuleEntry).has_agent_folder).toBe(false);
    });

    it('custom agent_folder name', () => {
        const tmp = make_tmp();
        init_git_dir(tmp);
        mkdirp(path.join(tmp, 'packages', 'core', 'ai-docs'));
        mkdirp(path.join(tmp, 'packages', 'tools'));
        const result = ags.enumerate_modules({
            project_root: tmp,
            modules_config: { enabled: true, root_paths: ['packages'], skip_dirs: [], agent_folder: 'ai-docs' },
        });
        const by_name = Object.fromEntries(result.map((m) => [m.name, m]));
        expect((by_name['core'] as ags.ModuleEntry).has_agent_folder).toBe(true);
        expect((by_name['core'] as ags.ModuleEntry).agent_folder_path).toBe('packages/core/ai-docs');
        expect((by_name['tools'] as ags.ModuleEntry).has_agent_folder).toBe(false);
    });

    it('missing root is silent', () => {
        const tmp = make_tmp();
        init_git_dir(tmp);
        mkdirp(path.join(tmp, 'app', 'Modules', 'Real'));
        const result = ags.enumerate_modules({
            project_root: tmp,
            modules_config: {
                enabled: true,
                root_paths: ['app/Modules', 'does/not/exist'],
                skip_dirs: [],
                agent_folder: 'agents',
            },
        });
        expect(result.map((m) => m.name)).toEqual(['Real']);
    });

    it('skips non-directories', () => {
        const tmp = make_tmp();
        init_git_dir(tmp);
        const root = mkdirp(path.join(tmp, 'app', 'Modules'));
        mkdirp(path.join(root, 'Real'));
        write_file(path.join(root, 'README.md'), 'ignored\n');
        const result = ags.enumerate_modules({
            project_root: tmp,
            modules_config: { enabled: true, root_paths: ['app/Modules'], skip_dirs: [], agent_folder: 'agents' },
        });
        expect(result.map((m) => m.name)).toEqual(['Real']);
    });

    it('resolves modules_config from settings when omitted', () => {
        const tmp = make_tmp();
        init_git_dir(tmp);
        mkdirp(path.join(tmp, 'app', 'Modules', 'Auto'));
        write_file(
            path.join(tmp, '.agent-project-settings.yml'),
            'modules:\n  enabled: true\n  root_paths: [app/Modules]\n',
        );
        const result = ags.enumerate_modules({ project_root: tmp, cwd: tmp });
        expect(result.map((m) => m.name)).toEqual(['Auto']);
    });
});

// === tests/test_agent_settings_local_layer.py ==============================

describe('local layer (agents/settings/.agent-settings.local.yml)', () => {
    function write_local(proj: string, body: string): void {
        write_file(path.join(proj, 'agents', 'settings', '.agent-settings.local.yml'), body);
    }

    it('local overrides committed root', () => {
        const tmp = make_tmp();
        init_git_dir(tmp);
        write_file(path.join(tmp, '.agent-settings.yml'), 'zzz_test_key: committed\n');
        write_local(tmp, 'zzz_test_key: local\n');
        const merged = ags.load_agent_settings({ cwd: tmp, user_global_path: no_global(tmp) });
        expect(merged['zzz_test_key']).toBe('local');
    });

    it('local overrides nested committed', () => {
        const tmp = make_tmp();
        init_git_dir(tmp);
        write_file(path.join(tmp, '.agent-settings.yml'), 'zzz_test_key: root\n');
        const sub = mkdirp(path.join(tmp, 'sub'));
        write_file(path.join(sub, '.agent-settings.yml'), 'zzz_test_key: nested\n');
        write_local(tmp, 'zzz_test_key: local\n');
        const merged = ags.load_agent_settings({ cwd: sub, user_global_path: no_global(tmp) });
        expect(merged['zzz_test_key']).toBe('local');
    });

    it('absence of local leaves committed', () => {
        const tmp = make_tmp();
        init_git_dir(tmp);
        write_file(path.join(tmp, '.agent-settings.yml'), 'zzz_test_key: committed\n');
        const merged = ags.load_agent_settings({ cwd: tmp, user_global_path: no_global(tmp) });
        expect(merged['zzz_test_key']).toBe('committed');
    });

    it('local deep merges nested dict', () => {
        const tmp = make_tmp();
        init_git_dir(tmp);
        write_file(path.join(tmp, '.agent-settings.yml'), 'zzz_block:\n  a: 1\n  b: 2\n');
        write_local(tmp, 'zzz_block:\n  b: 99\n');
        const merged = ags.load_agent_settings({ cwd: tmp, user_global_path: no_global(tmp) });
        expect(merged['zzz_block']).toEqual({ a: 1, b: 99 });
    });
});

// === tests/test_agent_settings_canonical_layer.py ==========================

describe('canonical layer (agents/settings/.agent-settings.yml)', () => {
    function write_canonical(proj: string, body: string): void {
        write_file(path.join(proj, 'agents', 'settings', '.agent-settings.yml'), body);
    }
    function write_local(proj: string, body: string): void {
        write_file(path.join(proj, 'agents', 'settings', '.agent-settings.local.yml'), body);
    }

    it('canonical overrides legacy root', () => {
        const tmp = make_tmp();
        init_git_dir(tmp);
        write_file(path.join(tmp, '.agent-settings.yml'), 'zzz_test_key: legacy_root\n');
        write_canonical(tmp, 'zzz_test_key: canonical\n');
        const merged = ags.load_agent_settings({ cwd: tmp, user_global_path: no_global(tmp) });
        expect(merged['zzz_test_key']).toBe('canonical');
    });

    it('local overrides canonical', () => {
        const tmp = make_tmp();
        init_git_dir(tmp);
        write_canonical(tmp, 'zzz_test_key: canonical\n');
        write_local(tmp, 'zzz_test_key: local\n');
        const merged = ags.load_agent_settings({ cwd: tmp, user_global_path: no_global(tmp) });
        expect(merged['zzz_test_key']).toBe('local');
    });

    it('legacy root alone still works', () => {
        const tmp = make_tmp();
        init_git_dir(tmp);
        write_file(path.join(tmp, '.agent-settings.yml'), 'zzz_test_key: legacy_root\n');
        const merged = ags.load_agent_settings({ cwd: tmp, user_global_path: no_global(tmp) });
        expect(merged['zzz_test_key']).toBe('legacy_root');
    });

    it('canonical alone works', () => {
        const tmp = make_tmp();
        init_git_dir(tmp);
        write_canonical(tmp, 'zzz_test_key: canonical\n');
        const merged = ags.load_agent_settings({ cwd: tmp, user_global_path: no_global(tmp) });
        expect(merged['zzz_test_key']).toBe('canonical');
    });

    it('project_settings_path prefers canonical', () => {
        const tmp = make_tmp();
        init_git_dir(tmp);
        write_file(path.join(tmp, '.agent-settings.yml'), 'a: 1\n');
        write_canonical(tmp, 'a: 1\n');
        expect(ags.project_settings_path(tmp)).toBe(path.join(tmp, 'agents', 'settings', '.agent-settings.yml'));
    });

    it('project_settings_path falls back to legacy root', () => {
        const tmp = make_tmp();
        init_git_dir(tmp);
        write_file(path.join(tmp, '.agent-settings.yml'), 'a: 1\n');
        expect(ags.project_settings_path(tmp)).toBe(path.join(tmp, '.agent-settings.yml'));
    });

    it('project_settings_path defaults to canonical when absent', () => {
        const tmp = make_tmp();
        init_git_dir(tmp);
        expect(ags.project_settings_path(tmp)).toBe(path.join(tmp, 'agents', 'settings', '.agent-settings.yml'));
    });

    it('canonical_settings_write_path is always agents/settings', () => {
        const tmp = make_tmp();
        init_git_dir(tmp);
        write_file(path.join(tmp, '.agent-settings.yml'), 'a: 1\n');
        expect(ags.canonical_settings_write_path(tmp)).toBe(
            path.join(tmp, 'agents', 'settings', '.agent-settings.yml'),
        );
    });
});

// === tests/test_agent_settings_relocation_resilience.py ====================

describe('relocation resilience', () => {
    const SENTINEL = 'zzz_relocation_sentinel';
    function make_relocated_root(tmp: string, body: string): string {
        const root = path.join(tmp, 'relocated-elsewhere');
        mkdirp(path.join(root, '.git'));
        write_file(path.join(root, 'agents', 'settings', '.agent-settings.yml'), body);
        return root;
    }

    afterEach(() => {
        // resolve_project_root tests set these via patch_env (auto-restored).
    });

    it('loader resolves settings at relocated root', () => {
        const tmp = make_tmp();
        const root = make_relocated_root(tmp, `${SENTINEL}: relocated\n`);
        const merged = ags.load_agent_settings({ cwd: root, user_global_path: no_global(tmp) });
        expect(merged[SENTINEL]).toBe('relocated');
    });

    it('loader resolves via env project root', () => {
        const tmp = make_tmp();
        const root = make_relocated_root(tmp, `${SENTINEL}: via_env\n`);
        patch_env(ags.PROJECT_ROOT_ENV, root);
        patch_env(ags.ROOT_OVERRIDE_ENV, undefined);
        const [resolved, origin] = ags.resolve_project_root(null, { cwd: tmp });
        expect(resolved).toBe(root);
        expect(origin).toBe(ags.ORIGIN_ENV);
        const merged = ags.load_agent_settings({ cwd: resolved, user_global_path: no_global(tmp) });
        expect(merged[SENTINEL]).toBe('via_env');
    });

    it('loader resolves via root override flag', () => {
        const tmp = make_tmp();
        const root = make_relocated_root(tmp, `${SENTINEL}: via_flag\n`);
        patch_env(ags.ROOT_OVERRIDE_ENV, '1');
        patch_env(ags.PROJECT_ROOT_ENV, root);
        const [resolved, origin] = ags.resolve_project_root(null, { cwd: tmp });
        expect(resolved).toBe(root);
        expect(origin).toBe(ags.ORIGIN_ROOT_FLAG);
    });

    it('degrades to defaults when settings absent', () => {
        const tmp = make_tmp();
        const bare = mkdirp(path.join(tmp, 'bare-root'));
        mkdirp(path.join(bare, '.git'));
        const merged = ags.load_agent_settings({ cwd: bare, user_global_path: no_global(tmp) });
        expect(typeof merged).toBe('object');
        expect(SENTINEL in merged).toBe(false);
    });

    it('relocation then old absent is clean', () => {
        const tmp = make_tmp();
        const root = make_relocated_root(tmp, `${SENTINEL}: post_move\n`);
        const old_default = path.join(root, '.agent-settings.yml');
        expect(fs.existsSync(old_default)).toBe(false);
        const merged = ags.load_agent_settings({ cwd: root, user_global_path: no_global(tmp) });
        expect(merged[SENTINEL]).toBe('post_move');
    });
});

// === tests/test_project_root_anchors.py ====================================

describe('find_project_root_with_anchor', () => {
    it('.git dir anchors', () => {
        const tmp = make_tmp();
        mkdirp(path.join(tmp, '.git'));
        const deep = mkdirp(path.join(tmp, 'a', 'b', 'c'));
        const result = ags.find_project_root_with_anchor(deep);
        expect(result).not.toBeNull();
        expect(result).toEqual([tmp, ags.ANCHOR_GIT]);
    });

    it('.git file anchors submodule', () => {
        const tmp = make_tmp();
        write_file(path.join(tmp, '.git'), 'gitdir: ../.git/modules/x\n');
        const nested = mkdirp(path.join(tmp, 'src'));
        expect(ags.find_project_root_with_anchor(nested)).toEqual([tmp, ags.ANCHOR_GIT]);
    });

    it.each(['roadmaps', 'settings/.ai-council.yml', 'roadmaps-progress.md'])(
        'agents/ with marker %s anchors',
        (marker) => {
            const tmp = make_tmp();
            const agents = mkdirp(path.join(tmp, 'agents'));
            const target = path.join(agents, marker);
            if (marker === 'roadmaps') {
                mkdirp(target);
            } else {
                write_file(target, '# marker\n');
            }
            const nested = mkdirp(path.join(tmp, 'src', 'deep'));
            expect(ags.find_project_root_with_anchor(nested)).toEqual([tmp, ags.ANCHOR_AGENTS_DIR]);
        },
    );

    it('bare agents/ without marker does not anchor', () => {
        const tmp = make_tmp();
        mkdirp(path.join(tmp, 'agents'));
        const nested = mkdirp(path.join(tmp, 'src'));
        expect(ags.find_project_root_with_anchor(nested)).toBeNull();
    });

    it('.agent-settings.yml alone anchors as fallback', () => {
        const tmp = make_tmp();
        write_file(path.join(tmp, '.agent-settings.yml'), 'name: x\n');
        const nested = mkdirp(path.join(tmp, 'a', 'b'));
        expect(ags.find_project_root_with_anchor(nested)).toEqual([tmp, ags.ANCHOR_AGENT_SETTINGS]);
    });

    it('layer fallback picks outermost .agent-settings.yml', () => {
        const tmp = make_tmp();
        write_file(path.join(tmp, '.agent-settings.yml'), 'name: outer\n');
        const sub = mkdirp(path.join(tmp, 'sub'));
        write_file(path.join(sub, '.agent-settings.yml'), 'name: inner\n');
        expect(ags.find_project_root_with_anchor(sub)).toEqual([tmp, ags.ANCHOR_AGENT_SETTINGS]);
    });

    it('mixed anchors at same level — agents/ wins over .git', () => {
        const tmp = make_tmp();
        mkdirp(path.join(tmp, '.git'));
        mkdirp(path.join(tmp, 'agents', 'roadmaps'));
        const nested = mkdirp(path.join(tmp, 'src'));
        expect(ags.find_project_root_with_anchor(nested)).toEqual([tmp, ags.ANCHOR_AGENTS_DIR]);
    });

    it('git + intermediate .agent-settings.yml → root stays at git', () => {
        const tmp = make_tmp();
        mkdirp(path.join(tmp, '.git'));
        write_file(path.join(tmp, '.agent-settings.yml'), 'name: Root\n');
        const sub = mkdirp(path.join(tmp, 'sub'));
        write_file(path.join(sub, '.agent-settings.yml'), 'name: Sub\n');
        expect(ags.find_project_root_with_anchor(sub)).toEqual([tmp, ags.ANCHOR_GIT]);
    });

    it('no anchors returns null', () => {
        const tmp = make_tmp();
        const nested = mkdirp(path.join(tmp, 'a', 'b'));
        expect(ags.find_project_root_with_anchor(nested)).toBeNull();
    });

    it('find_project_root drops anchor name', () => {
        const tmp = make_tmp();
        mkdirp(path.join(tmp, '.git'));
        expect(ags.find_project_root(tmp)).toBe(tmp);
    });
});

// === tests/test_root_override.py (resolve_project_root; non-dispatcher) ====

describe('resolve_project_root — override channels', () => {
    beforeEach(() => {
        patch_env(ags.PROJECT_ROOT_ENV, undefined);
        patch_env(ags.ROOT_OVERRIDE_ENV, undefined);
    });

    it('--root flag wins over arg', () => {
        const tmp = make_tmp();
        const root_dir = mkdirp(path.join(tmp, 'winner'));
        const arg_dir = mkdirp(path.join(tmp, 'loser'));
        patch_env(ags.PROJECT_ROOT_ENV, root_dir);
        patch_env(ags.ROOT_OVERRIDE_ENV, '1');
        const [root, origin] = ags.resolve_project_root(arg_dir, { cwd: tmp });
        expect(root).toBe(root_dir);
        expect(origin).toBe(ags.ORIGIN_ROOT_FLAG);
    });

    it('explicit arg wins over env pin', () => {
        const tmp = make_tmp();
        const env_dir = mkdirp(path.join(tmp, 'env'));
        const arg_dir = mkdirp(path.join(tmp, 'arg'));
        patch_env(ags.PROJECT_ROOT_ENV, env_dir);
        const [root, origin] = ags.resolve_project_root(arg_dir, { cwd: tmp });
        expect(root).toBe(arg_dir);
        expect(origin).toBe(ags.ORIGIN_EXPLICIT);
    });

    it('env pin used when no arg', () => {
        const tmp = make_tmp();
        const env_dir = mkdirp(path.join(tmp, 'wrapper'));
        patch_env(ags.PROJECT_ROOT_ENV, env_dir);
        const [root, origin] = ags.resolve_project_root(null, { cwd: tmp });
        expect(root).toBe(env_dir);
        expect(origin).toBe(ags.ORIGIN_ENV);
    });

    it('anchor walk when no override', () => {
        const tmp = make_tmp();
        mkdirp(path.join(tmp, '.git'));
        const deep = mkdirp(path.join(tmp, 'a', 'b'));
        const [root, origin] = ags.resolve_project_root(null, { cwd: deep });
        expect(root).toBe(tmp);
        expect(origin).toBe(ags.ANCHOR_GIT);
    });

    it('cwd fallback when no anchor', () => {
        const tmp = make_tmp();
        const [root, origin] = ags.resolve_project_root(null, { cwd: tmp });
        expect(root).toBe(tmp);
        expect(origin).toBe(ags.ORIGIN_CWD_FALLBACK);
    });

    it('--root flag invalid path raises', () => {
        const tmp = make_tmp();
        patch_env(ags.PROJECT_ROOT_ENV, path.join(tmp, 'nope'));
        patch_env(ags.ROOT_OVERRIDE_ENV, '1');
        expect(() => ags.resolve_project_root(null, { cwd: tmp })).toThrow(ags.ProjectRootError);
        expect(() => ags.resolve_project_root(null, { cwd: tmp })).toThrow(/--root/);
    });

    it('--root flag non-directory raises', () => {
        const tmp = make_tmp();
        const f = write_file(path.join(tmp, 'file.txt'), 'not a dir');
        patch_env(ags.PROJECT_ROOT_ENV, f);
        patch_env(ags.ROOT_OVERRIDE_ENV, '1');
        expect(() => ags.resolve_project_root(null, { cwd: tmp })).toThrow(/non-directory/);
    });

    it('explicit arg invalid path raises', () => {
        const tmp = make_tmp();
        expect(() => ags.resolve_project_root(path.join(tmp, 'missing'), { cwd: tmp })).toThrow(/--project/);
    });

    it('env pin invalid path raises', () => {
        const tmp = make_tmp();
        patch_env(ags.PROJECT_ROOT_ENV, path.join(tmp, 'missing'));
        expect(() => ags.resolve_project_root(null, { cwd: tmp })).toThrow(new RegExp(ags.PROJECT_ROOT_ENV));
    });
});

// === tests/test_kill_switch.py =============================================

describe('AGENT_CONFIG_LEGACY_ANCHOR kill-switch', () => {
    it('recognises git anchor', () => {
        const tmp = make_tmp();
        patch_env('AGENT_CONFIG_LEGACY_ANCHOR', '1');
        mkdirp(path.join(tmp, '.git'));
        const nested = mkdirp(path.join(tmp, 'src'));
        expect(ags.find_project_root_with_anchor(nested)).toEqual([tmp, ags.ANCHOR_GIT]);
    });

    it('ignores agents/ dir anchor', () => {
        const tmp = make_tmp();
        patch_env('AGENT_CONFIG_LEGACY_ANCHOR', '1');
        mkdirp(path.join(tmp, 'agents', 'roadmaps'));
        const nested = mkdirp(path.join(tmp, 'src'));
        expect(ags.find_project_root_with_anchor(nested)).toBeNull();
    });

    it('ignores .agent-settings.yml anchor', () => {
        const tmp = make_tmp();
        patch_env('AGENT_CONFIG_LEGACY_ANCHOR', '1');
        write_file(path.join(tmp, '.agent-settings.yml'), 'name: x\n');
        const nested = mkdirp(path.join(tmp, 'src'));
        expect(ags.find_project_root_with_anchor(nested)).toBeNull();
    });

    it('default disabled', () => {
        const tmp = make_tmp();
        patch_env('AGENT_CONFIG_LEGACY_ANCHOR', undefined);
        mkdirp(path.join(tmp, 'agents', 'roadmaps'));
        const nested = mkdirp(path.join(tmp, 'src'));
        const result = ags.find_project_root_with_anchor(nested);
        expect(result).not.toBeNull();
        expect((result as [string, string])[1]).toBe(ags.ANCHOR_AGENTS_DIR);
    });
});

// === tests/test_subdir_invocation.py =======================================

describe('subdir invocation', () => {
    beforeEach(() => {
        patch_env(ags.PROJECT_ROOT_ENV, undefined);
        patch_env('AGENT_CONFIG_LEGACY_ANCHOR', undefined);
    });

    it('resolves to anchor root', () => {
        const tmp = make_tmp();
        const root = path.join(tmp, 'proj');
        const deep = mkdirp(path.join(root, 'a', 'b', 'c', 'd'));
        init_git_dir(root);
        const [resolved, origin] = ags.resolve_project_root(null, { cwd: deep });
        expect(resolved).toBe(root);
        expect(origin).toBe('git');
    });

    it('env var overrides anchor walk', () => {
        const tmp = make_tmp();
        const root = path.join(tmp, 'proj');
        const intermediate = path.join(root, 'nested-proj');
        const deep = mkdirp(path.join(intermediate, 'subdir'));
        init_git_dir(root);
        init_git_dir(intermediate);
        patch_env(ags.PROJECT_ROOT_ENV, root);
        const [resolved, origin] = ags.resolve_project_root(null, { cwd: deep });
        expect(resolved).toBe(root);
        expect(origin).toBe(ags.ORIGIN_ENV);
    });

    it('explicit arg overrides env', () => {
        const tmp = make_tmp();
        const root = mkdirp(path.join(tmp, 'proj'));
        const other = mkdirp(path.join(tmp, 'other'));
        init_git_dir(root);
        init_git_dir(other);
        patch_env(ags.PROJECT_ROOT_ENV, other);
        const [resolved, origin] = ags.resolve_project_root(root, { cwd: other });
        expect(resolved).toBe(root);
        expect(origin).toBe(ags.ORIGIN_EXPLICIT);
    });

    it('no anchor falls back to cwd', () => {
        const tmp = make_tmp();
        const deep = mkdirp(path.join(tmp, 'no_anchor_anywhere', 'a', 'b'));
        const [resolved, origin] = ags.resolve_project_root(null, { cwd: deep });
        expect(resolved).toBe(deep);
        expect(origin).toBe(ags.ORIGIN_CWD_FALLBACK);
    });

    it('wrapper-pinned root survives chdir', () => {
        const tmp = make_tmp();
        const root = path.join(tmp, 'proj');
        const deep = mkdirp(path.join(root, 'services', 'api'));
        init_git_dir(root);
        patch_env(ags.PROJECT_ROOT_ENV, root);
        chdir(deep);
        const [resolved, origin] = ags.resolve_project_root(null);
        expect(resolved).toBe(root);
        expect(origin).toBe(ags.ORIGIN_ENV);
        expect(fs.realpathSync(process.cwd())).toBe(deep);
    });
});

// === tests/test_anchor_perf.py =============================================

describe('anchor-walk performance budget', () => {
    const DEPTH = 20;
    const BUDGET_SECONDS = 0.005;

    function deep_chain(root: string, depth: number): string {
        let cursor = root;
        for (let i = 0; i < depth; i += 1) {
            cursor = path.join(cursor, `lvl${i}`);
        }
        return mkdirp(cursor);
    }

    it('walk under budget — no anchor', () => {
        const tmp = make_tmp();
        const leaf = deep_chain(tmp, DEPTH);
        const start = performance.now();
        ags.find_project_root_with_anchor(leaf);
        const elapsed = (performance.now() - start) / 1000;
        expect(elapsed).toBeLessThan(BUDGET_SECONDS * 10);
    });

    it('walk under budget — git root', () => {
        const tmp = make_tmp();
        mkdirp(path.join(tmp, '.git'));
        const leaf = deep_chain(tmp, DEPTH);
        const start = performance.now();
        const result = ags.find_project_root_with_anchor(leaf);
        const elapsed = (performance.now() - start) / 1000;
        expect(result).not.toBeNull();
        expect(elapsed).toBeLessThan(BUDGET_SECONDS * 10);
    });

    it('walk under budget — agents marker root', () => {
        const tmp = make_tmp();
        mkdirp(path.join(tmp, 'agents', 'roadmaps'));
        const leaf = deep_chain(tmp, DEPTH);
        const start = performance.now();
        const result = ags.find_project_root_with_anchor(leaf);
        const elapsed = (performance.now() - start) / 1000;
        expect(result).not.toBeNull();
        expect(elapsed).toBeLessThan(BUDGET_SECONDS * 10);
    });
});

// === find_project_root_with_trace (direct — public export) =================

describe('find_project_root_with_trace', () => {
    it('returns git anchor with trace records', () => {
        const tmp = make_tmp();
        mkdirp(path.join(tmp, '.git'));
        const deep = mkdirp(path.join(tmp, 'a', 'b'));
        const [root, anchor, trace] = ags.find_project_root_with_trace(deep);
        expect(root).toBe(tmp);
        expect(anchor).toBe(ags.ANCHOR_GIT);
        expect(Array.isArray(trace)).toBe(true);
        expect(trace.length).toBeGreaterThan(0);
        const last = trace[trace.length - 1] as ags.TraceRecord;
        expect(last.hit).toBe(ags.ANCHOR_GIT);
        expect(last.reason).toBe('.git present');
        expect(new Set(Object.keys(last))).toEqual(new Set(['ancestor', 'pass', 'hit', 'reason']));
    });

    it('returns agents-dir anchor with marker reason', () => {
        const tmp = make_tmp();
        mkdirp(path.join(tmp, 'agents', 'roadmaps'));
        const deep = mkdirp(path.join(tmp, 'src'));
        const [root, anchor, trace] = ags.find_project_root_with_trace(deep);
        expect(root).toBe(tmp);
        expect(anchor).toBe(ags.ANCHOR_AGENTS_DIR);
        expect((trace[trace.length - 1] as ags.TraceRecord).reason).toBe('agents/ has roadmaps');
    });

    it('layer fallback to .agent-settings.yml', () => {
        const tmp = make_tmp();
        write_file(path.join(tmp, '.agent-settings.yml'), 'name: x\n');
        const deep = mkdirp(path.join(tmp, 'a'));
        const [root, anchor, trace] = ags.find_project_root_with_trace(deep);
        expect(root).toBe(tmp);
        expect(anchor).toBe(ags.ANCHOR_AGENT_SETTINGS);
        // Boundary pass misses everywhere, layer pass hits at tmp.
        expect(trace.some((r) => r.pass === 'layer' && r.hit === ags.ANCHOR_AGENT_SETTINGS)).toBe(true);
    });

    it('returns [null, null, trace] when no anchor', () => {
        const tmp = make_tmp();
        const deep = mkdirp(path.join(tmp, 'a', 'b'));
        const [root, anchor, trace] = ags.find_project_root_with_trace(deep);
        expect(root).toBeNull();
        expect(anchor).toBeNull();
        expect(trace.length).toBeGreaterThan(0);
        expect(trace.every((r) => r.hit === null)).toBe(true);
    });

    it('legacy kill-switch traces .git only', () => {
        const tmp = make_tmp();
        patch_env('AGENT_CONFIG_LEGACY_ANCHOR', '1');
        mkdirp(path.join(tmp, 'agents', 'roadmaps'));
        const deep = mkdirp(path.join(tmp, 'src'));
        const [root, anchor, trace] = ags.find_project_root_with_trace(deep);
        expect(root).toBeNull();
        expect(anchor).toBeNull();
        expect(trace.every((r) => r.reason.startsWith('legacy:'))).toBe(true);
    });
});

// === Differential block: TS port vs live Python module =====================

/**
 * Build a synthetic project fixture, run BOTH the Python module and the TS
 * port over identical inputs, and assert JSON-equal output. The Python
 * driver imports `scripts._lib.agent_settings` from `<repo>/src`
 * (sys.path.insert(0, <repo>/src)) — the same module the pytest suites use.
 */
const PY_DRIVER = String.raw`
import json, sys
from pathlib import Path
sys.path.insert(0, sys.argv[1])  # <repo>/src
from scripts._lib import agent_settings as ags  # noqa: E402

mode = sys.argv[2]
arg = Path(sys.argv[3]) if len(sys.argv) > 3 else None
arg2 = Path(sys.argv[4]) if len(sys.argv) > 4 else None

if mode == "load":
    out = ags.load_agent_settings(cwd=arg, user_global_path=arg2)
elif mode == "modules":
    out = ags.get_modules_config(project_root=arg, cwd=arg)
elif mode == "enumerate":
    out = ags.enumerate_modules(project_root=arg, cwd=arg)
elif mode == "anchor":
    res = ags.find_project_root_with_anchor(arg)
    out = [str(res[0]), res[1]] if res is not None else None
else:
    raise SystemExit(f"unknown mode {mode}")

sys.stdout.write(json.dumps(out, sort_keys=True))
`;

function py_driver(mode: string, ...args: string[]): unknown {
    const proc = spawnSync('python3', ['-c', PY_DRIVER, path.join(REPO_ROOT, 'src'), mode, ...args], {
        encoding: 'utf-8',
    });
    if (proc.status !== 0) {
        throw new Error(`python driver failed (mode=${mode}): ${proc.stderr}`);
    }
    return JSON.parse(proc.stdout);
}

// Run only when python3 + PyYAML are available (matches the spike pattern).
const PY_OK = (() => {
    const probe = spawnSync('python3', ['-c', 'import yaml'], { encoding: 'utf-8' });
    return probe.status === 0;
})();

describe.skipIf(!PY_OK)('differential — TS port JSON-equals live Python module', () => {
    it('fixture A: defaults-only (bare git root, no settings)', () => {
        const tmp = make_tmp();
        mkdirp(path.join(tmp, '.git'));
        const missing = no_global(tmp);
        const ts = ags.load_agent_settings({ cwd: tmp, user_global_path: missing });
        const py = py_driver('load', tmp, missing);
        expect(ts).toEqual(py);
        expect(ts).toEqual({});
    });

    it('fixture B: project-layer override (root .agent-settings.yml)', () => {
        const tmp = make_tmp();
        mkdirp(path.join(tmp, '.git'));
        write_file(
            path.join(tmp, '.agent-settings.yml'),
            'name: Proj\nide: phpstorm\npipelines:\n  ci: true\n  retries: 3\n  channels:\n    - a\n    - b\n',
        );
        const missing = no_global(tmp);
        const ts = ags.load_agent_settings({ cwd: tmp, user_global_path: missing });
        expect(ts).toEqual(py_driver('load', tmp, missing));
    });

    it('fixture C: local-layer override (deepest wins, deep merge)', () => {
        const tmp = make_tmp();
        mkdirp(path.join(tmp, '.git'));
        write_file(path.join(tmp, '.agent-settings.yml'), 'block:\n  a: 1\n  b: 2\nname: Root\n');
        write_file(
            path.join(tmp, 'agents', 'settings', '.agent-settings.yml'),
            'block:\n  b: 99\nide: nvim\n',
        );
        write_file(
            path.join(tmp, 'agents', 'settings', '.agent-settings.local.yml'),
            'block:\n  c: 3\nname: LocalWins\n',
        );
        const missing = no_global(tmp);
        const ts = ags.load_agent_settings({ cwd: tmp, user_global_path: missing });
        expect(ts).toEqual(py_driver('load', tmp, missing));
    });

    it('fixture D: enumerate_modules over a module tree', () => {
        const tmp = make_tmp();
        mkdirp(path.join(tmp, '.git'));
        mkdirp(path.join(tmp, 'app', 'Modules', 'Alpha', 'agents'));
        mkdirp(path.join(tmp, 'app', 'Modules', 'Beta'));
        mkdirp(path.join(tmp, 'app', 'Modules', '.example'));
        mkdirp(path.join(tmp, 'packages', 'core'));
        write_file(
            path.join(tmp, '.agent-project-settings.yml'),
            'modules:\n  enabled: true\n  root_paths: [app/Modules, packages]\n',
        );
        const ts = ags.enumerate_modules({ project_root: tmp, cwd: tmp });
        expect(ts).toEqual(py_driver('enumerate', tmp));
    });

    it('fixture D2: get_modules_config team + dev cascade', () => {
        const tmp = make_tmp();
        mkdirp(path.join(tmp, '.git'));
        write_file(
            path.join(tmp, '.agent-project-settings.yml'),
            'locked_keys:\n  - modules.root_paths\nmodules:\n  enabled: true\n  root_paths: [app/Modules]\n',
        );
        write_file(
            path.join(tmp, '.agent-settings.yml'),
            'modules:\n  root_paths: [src/local]\n  agent_folder: docs\n',
        );
        const ts = ags.get_modules_config({ project_root: tmp, cwd: tmp });
        expect(ts).toEqual(py_driver('modules', tmp));
    });

    it('fixture E: anchor resolution (agents/ wins over .git)', () => {
        const tmp = make_tmp();
        mkdirp(path.join(tmp, '.git'));
        mkdirp(path.join(tmp, 'agents', 'roadmaps'));
        const deep = mkdirp(path.join(tmp, 'src', 'deep'));
        const ts = ags.find_project_root_with_anchor(deep);
        expect(ts).toEqual(py_driver('anchor', deep));
    });
});
