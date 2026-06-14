/**
 * Golden-parity tests for the work_engine twin
 * `src/agent-src/templates/scripts/work_engine/_lib/agent_settings.ts`.
 *
 * The work_engine twin is a byte-identical copy of the dev-side twin
 * `src/scripts/_lib/agent_settings.ts` (verified by the migration). These
 * tests pin that behavioural parity from the work_engine path specifically:
 *
 *   - a unit block over the public loader / anchor surface, and
 *   - a differential block that runs the work_engine Python module
 *     (`work_engine/_lib/agent_settings.py`) through a `python3 -c` driver
 *     and asserts the TS twin's merged settings / module config / anchor
 *     resolution JSON-equal the Python reference.
 *
 * Adapted from the differential block of `tests/lib/agent_settings.test.ts`,
 * repointed at the work_engine `_lib/` location. The Python import uses the
 * package form (`sys.path = <work_engine dir>; from _lib import
 * agent_settings`) so the relative `from . import user_global_paths` inside
 * the module resolves against the copied sibling twin.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as ags from '../../../src/agent-src/templates/scripts/work_engine/_lib/agent_settings';

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

function make_tmp(): string {
    // realpathSync so macOS /var → /private/var symlink resolution matches
    // Python's tmp_path (already resolved) and the module's `_resolve`.
    const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'we-ags-test-')));
    tmp_dirs.push(dir);
    return dir;
}

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
    while (tmp_dirs.length > 0) {
        fs.rmSync(tmp_dirs.pop() as string, { recursive: true, force: true });
    }
    ags.logger.records.length = 0;
});

// --- unit surface ---------------------------------------------------------

describe('work_engine agent_settings — unit surface', () => {
    it('both files missing returns defaults ({})', () => {
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

    it('project file overrides user-global on shared keys (deep merge)', () => {
        const tmp = make_tmp();
        const user = write_file(path.join(tmp, 'user.yml'), 'name: Global\nide: vscode\n');
        const project = write_file(path.join(tmp, '.agent-settings.yml'), 'name: Project\n');
        const result = ags.load_agent_settings({
            project_path: project,
            user_global_path: user,
        });
        expect(result.name).toBe('Project');
        expect(result.ide).toBe('vscode');
    });

    it('find_project_root_with_anchor finds the agents/ anchor over a deep subdir', () => {
        const tmp = make_tmp();
        mkdirp(path.join(tmp, '.git'));
        mkdirp(path.join(tmp, 'agents', 'roadmaps'));
        const deep = mkdirp(path.join(tmp, 'src', 'deep'));
        const result = ags.find_project_root_with_anchor(deep);
        expect(result).not.toBeNull();
        expect((result as [string, string])[0]).toBe(tmp);
    });
});

// --- differential vs the work_engine Python reference ---------------------

const PY_DRIVER = [
    'import json, sys',
    'from pathlib import Path',
    'sys.path.insert(0, sys.argv[1])  # <work_engine dir> → enables `import _lib.*`',
    'from _lib import agent_settings as ags  # noqa: E402',
    '',
    'mode = sys.argv[2]',
    'arg = Path(sys.argv[3]) if len(sys.argv) > 3 else None',
    'arg2 = Path(sys.argv[4]) if len(sys.argv) > 4 else None',
    '',
    'if mode == "load":',
    '    out = ags.load_agent_settings(cwd=arg, user_global_path=arg2)',
    'elif mode == "modules":',
    '    out = ags.get_modules_config(project_root=arg, cwd=arg)',
    'elif mode == "enumerate":',
    '    out = ags.enumerate_modules(project_root=arg, cwd=arg)',
    'elif mode == "anchor":',
    '    res = ags.find_project_root_with_anchor(arg)',
    '    out = [str(res[0]), res[1]] if res is not None else None',
    'else:',
    '    raise SystemExit(f"unknown mode {mode}")',
    '',
    'sys.stdout.write(json.dumps(out, sort_keys=True))',
].join('\n');

function py_driver(mode: string, ...args: string[]): unknown {
    const proc = spawnSync('python3', ['-c', PY_DRIVER, WORK_ENGINE_DIR, mode, ...args], {
        encoding: 'utf-8',
    });
    if (proc.status !== 0) {
        throw new Error(`python driver failed (mode=${mode}): ${proc.stderr}`);
    }
    return JSON.parse(proc.stdout);
}

// Run only when python3 + PyYAML are available (matches the dev spike pattern).
const PY_OK = (() => {
    const probe = spawnSync('python3', ['-c', 'import yaml'], { encoding: 'utf-8' });
    return probe.status === 0;
})();

describe.skipIf(!PY_OK)('work_engine agent_settings — differential vs Python', () => {
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
