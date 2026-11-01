/**
 * `agent-config init --yes --tools=…` without a scope flag, outside a TTY (CI).
 *
 * Measured before the fix: the bash stage synced the project payload into the
 * repository (`.augment/`, `.claude/`, `AGENTS.md`, `./agent-config`), then the
 * bridge stage resolved the scope to `project` and refused it — "--scope=project
 * is reserved for maintainers" — leaving a half-written repository and no
 * install. ADR-020 makes a consumer install global-only, so the default scope
 * is global and the repository receives only what ruling 0.5 allows.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const TSX = resolve(ROOT, 'node_modules/.bin/tsx');
const MAIN = resolve(ROOT, 'src/cli/main.ts');

/** Ruling 0.5: overrides folder, .gitignore block, install-mode marker, three pointer files. */
const ALLOWED_IN_PROJECT = [
    /^\.git(\/|$)/,
    /^\.gitignore$/,
    /^agents$/,
    /^agents\/overrides(\/|$)/,
    /^agents\/\.agent-state$/,
    /^agents\/\.agent-state\/install-mode\.txt$/,
    /^\.windsurfrules$/,
    /^\.clinerules(\/|$)/,
    /^GEMINI\.md$/,
];

let home: string;
let project: string;
beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), 'init-scope-home-'));
    project = mkdtempSync(join(tmpdir(), 'init-scope-project-'));
    spawnSync('git', ['init', '-q', project]);
});
afterEach(() => {
    rmSync(home, { recursive: true, force: true });
    rmSync(project, { recursive: true, force: true });
});

function walk(dir: string): string[] {
    const out: string[] = [];
    const go = (d: string): void => {
        for (const name of readdirSync(d)) {
            const p = join(d, name);
            out.push(relative(dir, p));
            if (statSync(p).isDirectory() && name !== '.git') go(p);
        }
    };
    go(dir);
    return out.sort();
}

describe('init --yes outside a TTY, no scope flag', () => {
    it('installs globally and writes no distributed content into the repository', () => {
        const env: NodeJS.ProcessEnv = { ...process.env, HOME: home, CI: '1', AGENT_CONFIG_NO_UPDATE_CHECK: '1' };
        for (const k of ['AGENT_CONFIG_DEV_MODE', 'EVENT4U_CONFIG_HOME', 'PROJECT_ROOT', 'AGENT_CONFIG_PROJECT_ROOT']) delete env[k];
        const res = spawnSync(TSX, [MAIN, 'init', '--yes', '--tools=claude-code', '--offline'], {
            cwd: project,
            encoding: 'utf8',
            env,
            timeout: 180_000,
        });
        const out = `${res.stdout}\n${res.stderr}`;
        expect(res.status, out).toBe(0);
        expect(out).not.toContain('reserved for maintainers');
        expect(existsSync(join(home, '.claude', 'rules')), out).toBe(true);
        const stray = walk(project).filter((p) => !ALLOWED_IN_PROJECT.some((re) => re.test(p)));
        expect(stray).toEqual([]);
    }, 200_000);
});
