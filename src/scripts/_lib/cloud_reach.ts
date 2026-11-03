/**
 * Cloud reach — what a fresh clone of a repository carries into a Claude Code
 * cloud session (road-to-an-install-the-cloud-clone-carries, 0.1 / 1.1).
 *
 * A cloud session starts on a clone and reads only committed content plus
 * server-managed settings; the user's `~/.claude/settings.json` is not read and
 * repo-declared plugins are not installed (code.claude.com/docs
 * `cloud-environments`, re-read 2026-11-02). agent-config installs Claude Code
 * into `~/.claude/` only, so the honest measure of a cloud session's reach is
 * the TRACKED tree — `git ls-files`, never the working tree, which holds a
 * gitignored projection the clone does not carry.
 *
 * Read-only: one `git ls-files` and one `git show` per call, no write.
 */
import { execFileSync } from 'node:child_process';

import { MANAGED_SIGNATURE } from './claude_settings_hooks.js';
import type { WiringCheck } from './runtime_wiring_checks.js';

export const CLOUD_DOC = 'docs/setup/cloud-sessions.md';

export interface CloudReach {
    skills: number;
    rules: number;
    agents: number;
    commands: number;
    /** agent-config hook commands in a tracked `.claude/settings.json`. */
    managedHooks: number;
    /** The tracked settings file enables a plugin and carries no managed hook — inert in the cloud. */
    pluginOnly: boolean;
}

function gitOut(root: string, args: string[]): string | null {
    try {
        return execFileSync('git', args, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString();
    } catch {
        return null;
    }
}

function countManagedHooks(value: unknown): number {
    if (typeof value === 'string') return value.includes(MANAGED_SIGNATURE) ? 1 : 0;
    if (Array.isArray(value)) return value.reduce<number>((n, v) => n + countManagedHooks(v), 0);
    if (value !== null && typeof value === 'object') {
        return Object.values(value as Record<string, unknown>).reduce<number>((n, v) => n + countManagedHooks(v), 0);
    }
    return 0;
}

/** `null` outside a git work tree — nothing is cloned from a directory git does not know. */
export function measureCloudReach(root: string): CloudReach | null {
    if (gitOut(root, ['rev-parse', '--is-inside-work-tree'])?.trim() !== 'true') return null;
    const files = (gitOut(root, ['ls-files', '-z', '--', '.claude']) ?? '').split('\0').filter(Boolean);
    const under = (dir: string): string[] => files.filter((f) => f.startsWith(`.claude/${dir}/`));
    const skills = new Set(under('skills').map((f) => f.split('/')[2])).size;

    let managedHooks = 0;
    let pluginOnly = false;
    if (files.includes('.claude/settings.json')) {
        const text = gitOut(root, ['show', 'HEAD:.claude/settings.json']);
        try {
            const data = JSON.parse(text ?? '') as Record<string, unknown>;
            managedHooks = countManagedHooks(data['hooks']);
            const plugins = data['enabledPlugins'];
            pluginOnly = managedHooks === 0 && plugins !== null && typeof plugins === 'object' && Object.keys(plugins).length > 0;
        } catch {
            // Uncommitted or unparsable: the clone carries nothing usable from it.
        }
    }
    return {
        skills,
        rules: under('rules').length,
        agents: under('agents').length,
        commands: under('commands').length,
        managedHooks,
        pluginOnly,
    };
}

function describeReach(m: CloudReach): string {
    return (
        `a clone carries ${m.skills} skill(s), ${m.rules} rule file(s), ${m.agents} agent(s), ` +
        `${m.commands} command file(s), ${m.managedHooks} managed hook(s)` +
        (m.pluginOnly ? ' — the committed settings only enable a plugin, which a cloud session does not install' : '')
    );
}

export function checkCloudReach(root: string, env: NodeJS.ProcessEnv = process.env): WiringCheck {
    const id = 'cloud-reach';
    const m = measureCloudReach(root);
    if (m === null) {
        return { id, status: 'skipped', message: 'not a git work tree — no clone to measure', remedy: '' };
    }
    const remote = env['CLAUDE_CODE_REMOTE'] === 'true';
    if (remote && m.managedHooks === 0) {
        return {
            id,
            status: 'warn',
            message:
                `cloud session (CLAUDE_CODE_REMOTE=true): agent-config hooks, skills and rules from ~/.claude ` +
                `do not reach it — ${describeReach(m)}`,
            remedy: `agent-config doctor --repair cloud-reach, then commit .claude/settings.json (see ${CLOUD_DOC})`,
        };
    }
    return {
        id,
        status: 'ok',
        message: remote ? `cloud session: ${describeReach(m)}` : `local session; in a cloud session ${describeReach(m)}`,
        remedy: '',
    };
}
