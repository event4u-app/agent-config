/**
 * `cloud_reach` — what a fresh clone of a repository carries into a Claude Code
 * cloud session (road-to-an-install-the-cloud-clone-carries, 0.1 / 1.1).
 *
 * The load-bearing case is the untracked projection: a working tree full of
 * `.claude/skills/` that a clone does not carry must read as zero, because the
 * cloud session starts from the clone, not from the working tree.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { checkCloudReach, measureCloudReach } from '../../src/scripts/_lib/cloud_reach.js';
import { MANAGED_SIGNATURE } from '../../src/scripts/_lib/claude_settings_hooks.js';
import { probeClone } from '../../src/scripts/cloud_clone_probe.js';

const dirs: string[] = [];

function git(cwd: string, ...args: string[]): void {
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', ...args], {
        cwd,
        stdio: 'ignore',
    });
}

function repo(files: Record<string, string>, tracked: readonly string[]): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cloud-reach-'));
    dirs.push(root);
    git(root, 'init', '-q');
    for (const [rel, body] of Object.entries(files)) {
        fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
        fs.writeFileSync(path.join(root, rel), body);
    }
    fs.writeFileSync(path.join(root, 'README.md'), 'x');
    git(root, 'add', 'README.md', ...tracked);
    git(root, 'commit', '-q', '-m', 'init');
    return root;
}

function settingsWithHook(): string {
    const command = `agent-config ${MANAGED_SIGNATURE} --event pre_tool_use`;
    return JSON.stringify({ hooks: { PreToolUse: [{ hooks: [{ type: 'command', command }] }] } });
}

afterEach(() => {
    for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

describe('measureCloudReach', () => {
    it('reads an untracked projection as zero — the clone does not carry it', () => {
        const root = repo(
            {
                '.claude/skills/a/SKILL.md': 'x',
                '.claude/rules/r.md': 'x',
                '.claude/agents/g.md': 'x',
                '.claude/settings.json': JSON.stringify({ enabledPlugins: { 'agent-config@event4u-agent-config': true } }),
            },
            ['.claude/settings.json'],
        );
        const m = measureCloudReach(root);
        expect(m).toMatchObject({ skills: 0, rules: 0, agents: 0, commands: 0, managedHooks: 0, pluginOnly: true });
    });

    it('counts tracked content and a committed managed hook', () => {
        const root = repo(
            {
                '.claude/skills/a/SKILL.md': 'x',
                '.claude/skills/b/SKILL.md': 'x',
                '.claude/rules/r.md': 'x',
                '.claude/settings.json': settingsWithHook(),
            },
            ['.claude/skills', '.claude/rules', '.claude/settings.json'],
        );
        const m = measureCloudReach(root);
        expect(m).toMatchObject({ skills: 2, rules: 1, agents: 0, managedHooks: 1, pluginOnly: false });
    });

    it('returns null outside a git repository', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cloud-reach-nogit-'));
        dirs.push(root);
        expect(measureCloudReach(root)).toBeNull();
    });
});

describe('probeClone', () => {
    it('measures the clone, not the source working tree, and leaves the source untouched', () => {
        const root = repo({ '.claude/skills/a/SKILL.md': 'x', '.claude/rules/r.md': 'x' }, ['.claude/rules']);
        const before = execFileSync('git', ['status', '--porcelain', '--ignored'], { cwd: root }).toString();
        const r = probeClone(root);
        expect(r.measurement).toMatchObject({ skills: 0, rules: 1, managedHooks: 0 });
        expect(r.check.status).toBe('warn');
        expect(execFileSync('git', ['status', '--porcelain', '--ignored'], { cwd: root }).toString()).toBe(before);
    });
});

describe('checkCloudReach', () => {
    it('warns inside a cloud session when no managed hook is carried', () => {
        const root = repo({}, []);
        const c = checkCloudReach(root, { CLAUDE_CODE_REMOTE: 'true' });
        expect(c.status).toBe('warn');
        expect(c.remedy).toContain('docs/setup/cloud-sessions.md');
    });

    it('is ok inside a cloud session when a managed hook is carried', () => {
        const root = repo({ '.claude/settings.json': settingsWithHook() }, ['.claude/settings.json']);
        expect(checkCloudReach(root, { CLAUDE_CODE_REMOTE: 'true' }).status).toBe('ok');
    });

    it('is ok locally and states what a clone would carry', () => {
        const root = repo({}, []);
        const c = checkCloudReach(root, {});
        expect(c.status).toBe('ok');
        expect(c.message).toMatch(/0 agent-config hook/);
    });

    it('treats any value other than "true" as local', () => {
        const root = repo({}, []);
        expect(checkCloudReach(root, { CLAUDE_CODE_REMOTE: '1' }).status).toBe('ok');
    });

    it('is skipped outside a git repository', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cloud-reach-nogit-'));
        dirs.push(root);
        expect(checkCloudReach(root, { CLAUDE_CODE_REMOTE: 'true' }).status).toBe('skipped');
    });

    it('writes nothing into the repository', () => {
        const root = repo({ '.claude/skills/a/SKILL.md': 'x' }, []);
        const before = execFileSync('git', ['status', '--porcelain', '--ignored'], { cwd: root }).toString();
        checkCloudReach(root, { CLAUDE_CODE_REMOTE: 'true' });
        checkCloudReach(root, {});
        const after = execFileSync('git', ['status', '--porcelain', '--ignored'], { cwd: root }).toString();
        expect(after).toBe(before);
    });
});
