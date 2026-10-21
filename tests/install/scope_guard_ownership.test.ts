// scope_guard.sh decides whether the OTHER scope already holds an agent-config
// install. It used to answer "yes" for any non-empty directory, and since a host
// directory like `~/.claude/skills` has no `package.json` beside it the version
// read `unknown`, and `unknown` is DRIFT. So a machine whose only Claude skill
// was Superset's integration was told it had a conflicting agent-config install
// and the installer stopped. These run the real script against a fake HOME.

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const GUARD = path.join(REPO_ROOT, 'src', 'scripts', '_lib', 'scope_guard.sh');
/** A skill this package really ships, read from the tree so a rename cannot stale the test. */
const SHIPPED_SKILL = readdirSync(path.join(REPO_ROOT, 'dist', 'agent-src', 'skills')).sort()[0] as string;

let tmp: string;
let home: string;
let project: string;
let machine: string;

function write(p: string, body = 'x\n'): void {
    mkdirSync(path.dirname(p), { recursive: true });
    writeFileSync(p, body);
}

/** Superset's managed integration, as it sits under ~/.claude/skills/. */
function supersetSkills(): void {
    const root = path.join(home, '.claude', 'skills', 'superset');
    write(path.join(root, '.superset-managed'));
    write(path.join(root, 'plugin.json'), '{"name":"superset"}');
    write(path.join(root, 'skills', 'browser', 'SKILL.md'));
}

function guard(): { lines: string[]; summary: string } {
    const res = spawnSync('bash', [GUARD, 'project', REPO_ROOT, project], {
        cwd: project,
        encoding: 'utf-8',
        env: { PATH: process.env.PATH ?? '/usr/bin:/bin', HOME: home, EVENT4U_CONFIG_HOME: machine },
        timeout: 30000,
    });
    expect(res.status).toBe(0);
    const lines = res.stdout.trim().split('\n');
    return { lines, summary: lines.find((l) => l.startsWith('SUMMARY')) ?? '' };
}

function verdictFor(lines: string[], tool: string): string {
    return (lines.find((l) => l.split('\t')[1] === tool) ?? '').split('\t')[0] as string;
}

beforeEach(() => {
    tmp = mkdtempSync(path.join(tmpdir(), 'scope-guard-'));
    home = path.join(tmp, 'home');
    project = path.join(tmp, 'project');
    machine = path.join(tmp, 'machine');
    mkdirSync(project, { recursive: true });
    mkdirSync(home, { recursive: true });
});
afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
});

describe('foreign content is not an agent-config install', () => {
    it('a Claude skills dir holding only Superset reports OK, not DRIFT', () => {
        supersetSkills();
        const { lines, summary } = guard();
        expect(verdictFor(lines, 'claude-code')).toBe('OK');
        expect(summary.split('\t')[1]).toBe('OK');
    });

    it("a user's own Cursor rules report OK — the same flaw lived in every directory probe", () => {
        write(path.join(home, '.cursor', 'rules', 'my-team-conventions.mdc'));
        expect(verdictFor(guard().lines, 'cursor')).toBe('OK');
    });
});

describe('a real agent-config install is still caught', () => {
    it('a shipped skill name at the other scope is DRIFT (version unreadable there)', () => {
        write(path.join(home, '.claude', 'skills', SHIPPED_SKILL, 'SKILL.md'));
        expect(verdictFor(guard().lines, 'claude-code')).toBe('DRIFT');
    });

    it('Superset beside a real install does not hide the install', () => {
        supersetSkills();
        write(path.join(home, '.claude', 'skills', SHIPPED_SKILL, 'SKILL.md'));
        expect(verdictFor(guard().lines, 'claude-code')).toBe('DRIFT');
    });

    it('the deploy ledger proves ownership even when no shipped name survives', () => {
        // An old install whose skills were all renamed since shares no name with
        // this package. The ledger is the authoritative record of what a global
        // deploy wrote, so it still identifies the directory as ours.
        write(path.join(home, '.claude', 'skills', 'a-skill-renamed-long-ago', 'SKILL.md'));
        write(
            path.join(machine, 'deployed-files.json'),
            JSON.stringify({
                schema_version: 2,
                tools: { 'claude-code': { anchor: '~/.claude/', files: ['skills/a-skill-renamed-long-ago/SKILL.md'] } },
            }),
        );
        expect(verdictFor(guard().lines, 'claude-code')).toBe('DRIFT');
    });
});
