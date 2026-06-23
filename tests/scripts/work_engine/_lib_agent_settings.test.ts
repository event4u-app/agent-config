
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
