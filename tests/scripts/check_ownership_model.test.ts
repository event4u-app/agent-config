/**
 * K.1 — one ownership model: precedence matches the settings code on a
 * locked-key fixture; user-owned data under a committed path is a finding;
 * every registry store has an owner and a delete path. Runs under a temp HOME.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { get_modules_config } from '../../src/scripts/_lib/agent_settings.js';
import { resolveLayered, userDataInCommittedPaths, userProjectDir } from '../../src/scripts/_lib/ownership_model.js';
import { readRegistry } from '../../src/scripts/check_source_registry.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

let home: string;
let proj: string;
beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'own-home-'));
    proj = fs.mkdtempSync(path.join(os.tmpdir(), 'own-proj-'));
    vi.stubEnv('HOME', home);
    vi.stubEnv('USERPROFILE', home);
    vi.stubEnv('EVENT4U_CONFIG_HOME', path.join(home, '.event4u', 'agent-config'));
});
afterEach(() => {
    vi.unstubAllEnvs();
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(proj, { recursive: true, force: true });
});

describe('precedence follows the settings code', () => {
    it('a team locked key beats the developer; an unlocked team default yields to the developer', () => {
        const team = path.join(proj, '.agent-project-settings.yml');
        fs.writeFileSync(team, 'locked_keys: [modules.alpha]\nmodules:\n  alpha: team\n  beta: team\n');
        const dev = path.join(proj, '.agent-settings.yml');
        fs.writeFileSync(dev, 'modules:\n  alpha: dev\n  beta: dev\n');
        const real = get_modules_config({ team_path: team, project_path: dev, cwd: proj });
        const model = (key: string) =>
            resolveLayered(key, { 'team-unlocked': { 'modules.alpha': 'team', 'modules.beta': 'team' }, project: { 'modules.alpha': 'dev', 'modules.beta': 'dev' } }, ['modules.alpha']);
        expect(real['alpha']).toBe('team');
        expect(model('modules.alpha')).toEqual({ value: 'team', from: 'team-locked' });
        expect(real['beta']).toBe('dev');
        expect(model('modules.beta')).toEqual({ value: 'dev', from: 'project' });
    });

    it('a project file beats the user-global file, and both beat defaults', () => {
        expect(resolveLayered('k', { 'user-global': { k: 'user' }, project: { k: 'proj' }, defaults: { k: 'd' } }, [])?.from).toBe('project');
        expect(resolveLayered('k', { 'user-global': { k: 'user' }, defaults: { k: 'd' } }, [])?.from).toBe('user-global');
        expect(resolveLayered('k', {}, [])).toBeNull();
    });
});

describe('user-owned data stays under the user home', () => {
    it('the per-repo user directory is under the temp home, never the project', () => {
        const d = userProjectDir('repo-abc');
        expect(d.startsWith(home)).toBe(true);
        expect(d.endsWith(path.join('user', 'projects', 'repo-abc'))).toBe(true);
        expect(() => userProjectDir('../escape')).toThrow(/safe directory name/);
    });

    it('a planted user file under a committed path is a finding; the real tree has none', () => {
        expect(userDataInCommittedPaths(['src/a.ts', 'agents/signals/s1.jsonl', 'agents/runtime/.agent-chat-history', 'docs/working-style.yml'])).toEqual([
            { file: 'agents/signals/s1.jsonl', kind: 'feedback signals' },
            { file: 'agents/runtime/.agent-chat-history', kind: 'chat history' },
            { file: 'docs/working-style.yml', kind: 'working style' },
        ]);
        const tracked = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }).split('\n').filter(Boolean);
        const userStores = readRegistry(ROOT).filter((r) => r.owner === 'user').map((r) => r.path);
        expect(userDataInCommittedPaths(tracked, userStores)).toEqual([]);
    });

    it('every registry store has an owner and a delete path', () => {
        for (const r of readRegistry(ROOT)) {
            expect(['user', 'project', 'team', 'machine'], r.name).toContain(r.owner);
            expect(r.delete_path.length, r.name).toBeGreaterThan(0);
        }
        expect(readRegistry(ROOT).find((r) => r.name === 'team-knowledge-pages')?.owner).toBe('team');
    });
});
