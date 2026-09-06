/**
 * The `host-permission-settings` doctor check.
 *
 * Three settings decide how often a normal coding task is interrupted, and all
 * three belong to the consumer. The check reports them and writes none of them
 * — `src/templates/consumer-settings/claude-settings.json` carries zero
 * `permissions` keys and this suite is part of why that stays true.
 *
 * The load-bearing assertion is the ABSENT case: a check that goes silent on a
 * default project reports "nothing found" and "I did not look" identically.
 */
import { describe, expect, it } from 'vitest';

import {
    additionalDirectories,
    checkHostPermissionSettings,
    isLinkedWorktree,
    permissionSnippet,
    readDenyRules,
    readSettingsLayers,
    resolvedDefaultMode,
    type HostPermissionDeps,
} from '../../src/scripts/_lib/host_permission_checks.js';

const PROJECT = '/repo';
const HOME = '/home/dev';

function deps(files: Record<string, string>, dirs: string[] = []): HostPermissionDeps {
    return {
        projectRoot: PROJECT,
        homeDir: HOME,
        readFile: (p) => files[p] ?? null,
        isDirectory: (p) => dirs.includes(p),
    };
}

const USER = `${HOME}/.claude/settings.json`;
const PROJ = `${PROJECT}/.claude/settings.json`;
const LOCAL = `${PROJECT}/.claude/settings.local.json`;

describe('all three settings are named even when all three are absent', () => {
    const r = checkHostPermissionSettings(deps({}));

    it('names the read-deny rules', () => {
        expect(r.message).toContain('read-deny rules: absent');
    });

    it('names the additionalDirectories entry', () => {
        expect(r.message).toContain('working tree in additionalDirectories: absent');
    });

    it('names the default permission mode', () => {
        expect(r.message).toContain('permissions.defaultMode: absent');
    });

    it('a project with none of them set is ok, not a failure', () => {
        expect(r.status).toBe('ok');
    });

    it('carries a copyable snippet in the remedy', () => {
        expect(r.remedy).toContain('additionalDirectories');
        expect(r.remedy).toContain(PROJECT);
    });

    it('says plainly that this package never writes them', () => {
        expect(r.remedy).toContain('never writes permissions');
    });
});

describe('the three layers resolve in the host order', () => {
    it('reads user-global, project and project-local', () => {
        const layers = readSettingsLayers(deps({ [USER]: '{}', [LOCAL]: '{}' }));
        expect(layers.map((l) => l.label)).toEqual(['user-global', 'project', 'project-local']);
        expect(layers.map((l) => l.present)).toEqual([true, false, true]);
    });

    it('the last layer to set defaultMode wins', () => {
        const layers = readSettingsLayers(
            deps({
                [USER]: JSON.stringify({ permissions: { defaultMode: 'plan' } }),
                [LOCAL]: JSON.stringify({ permissions: { defaultMode: 'acceptEdits' } }),
            }),
        );
        expect(resolvedDefaultMode(layers)).toBe('acceptEdits');
    });

    it('no layer setting it resolves to null, not to a guessed default', () => {
        expect(resolvedDefaultMode(readSettingsLayers(deps({ [USER]: '{}' })))).toBeNull();
    });

    it('additionalDirectories unions across layers without duplicating', () => {
        const layers = readSettingsLayers(
            deps({
                [USER]: JSON.stringify({ permissions: { additionalDirectories: ['/a', '/b'] } }),
                [PROJ]: JSON.stringify({ permissions: { additionalDirectories: ['/b', '/c'] } }),
            }),
        );
        expect(additionalDirectories(layers)).toEqual(['/a', '/b', '/c']);
    });
});

describe('read-deny rules are singled out', () => {
    it('finds a deny that covers a read tool, with its layer', () => {
        const layers = readSettingsLayers(
            deps({ [PROJ]: JSON.stringify({ permissions: { deny: ['Read(./secrets/**)'] } }) }),
        );
        expect(readDenyRules(layers)).toEqual([['project', 'Read(./secrets/**)']]);
    });

    it('finds a read-shaped Bash deny', () => {
        const layers = readSettingsLayers(
            deps({ [USER]: JSON.stringify({ permissions: { deny: ['Bash(cat:*)'] } }) }),
        );
        expect(readDenyRules(layers).map(([, r]) => r)).toEqual(['Bash(cat:*)']);
    });

    it('ignores a deny on a write — that is not what produces a category-A prompt', () => {
        const layers = readSettingsLayers(
            deps({ [USER]: JSON.stringify({ permissions: { deny: ['Write(**)', 'Bash(rm:*)'] } }) }),
        );
        expect(readDenyRules(layers)).toEqual([]);
    });

    it('a read-deny makes the check reportable', () => {
        const r = checkHostPermissionSettings(
            deps({ [USER]: JSON.stringify({ permissions: { deny: ['Grep'] } }) }),
        );
        expect(r.status).toBe('warn');
        expect(r.message).toContain('read-deny rules: 1');
    });
});

describe('a linked worktree the host was not granted', () => {
    it('is detected from the gitdir pointer file', () => {
        expect(isLinkedWorktree(deps({ [`${PROJECT}/.git`]: 'gitdir: /main/.git/worktrees/x\n' }))).toBe(true);
    });

    it('a normal checkout, whose .git is a directory, is not one', () => {
        expect(isLinkedWorktree(deps({ [`${PROJECT}/.git`]: 'x' }, [`${PROJECT}/.git`]))).toBe(false);
    });

    it('an unlisted worktree root is reportable — the host was started elsewhere', () => {
        const r = checkHostPermissionSettings(
            deps({ [`${PROJECT}/.git`]: 'gitdir: /main/.git/worktrees/x' }),
        );
        expect(r.status).toBe('warn');
        expect(r.message).toContain('a linked worktree');
    });

    it('a listed worktree root is not', () => {
        const r = checkHostPermissionSettings(
            deps({
                [`${PROJECT}/.git`]: 'gitdir: /main/.git/worktrees/x',
                [LOCAL]: JSON.stringify({ permissions: { additionalDirectories: [PROJECT] } }),
            }),
        );
        expect(r.status).toBe('ok');
        expect(r.message).toContain('additionalDirectories: present');
    });
});

describe('a consumer file this package must not repair', () => {
    it('malformed JSON is reported, never rewritten', () => {
        const r = checkHostPermissionSettings(deps({ [PROJ]: '{ not json' }));
        expect(r.status).toBe('warn');
        expect(r.message).toContain('is not valid JSON');
    });

    it('an unprobed defaultMode is named as unprobed rather than judged', () => {
        const r = checkHostPermissionSettings(
            deps({ [USER]: JSON.stringify({ permissions: { defaultMode: 'somethingNew' } }) }),
        );
        expect(r.message).toContain('not a value this tree has probed');
    });

    it('the snippet is a suggestion the consumer pastes, not a write', () => {
        expect(JSON.parse(permissionSnippet(PROJECT))).toEqual({
            permissions: { additionalDirectories: [PROJECT], defaultMode: 'default' },
        });
    });
});
