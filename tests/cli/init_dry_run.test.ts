/**
 * road-to-docs-that-sell 4.3 — `init --dry-run` says what it would do.
 *
 * Measured before the fix: `--offline` was dropped on the way to the plan
 * (`offline: False` with the flag passed), booleans printed Python-style, the
 * plan named no file per tool, a default-scope plan said `scope: auto` while a
 * real run refuses the project scope, and the output told the user to run
 * `src/scripts/install` — a path inside this repository.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const TSX = resolve(ROOT, 'node_modules/.bin/tsx');
const MAIN = resolve(ROOT, 'src/cli/main.ts');

let home: string;
let project: string;
beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), 'init-dry-home-'));
    project = mkdtempSync(join(tmpdir(), 'init-dry-project-'));
});
afterEach(() => {
    rmSync(home, { recursive: true, force: true });
    rmSync(project, { recursive: true, force: true });
});

/** Every path under `dir` with its mtime — enough to see a write. */
function snapshot(dir: string): string[] {
    const out: string[] = [];
    const walk = (d: string): void => {
        for (const name of readdirSync(d)) {
            const p = join(d, name);
            const st = statSync(p);
            out.push(`${p}@${st.mtimeMs}`);
            if (st.isDirectory()) walk(p);
        }
    };
    walk(dir);
    return out.sort();
}

function dryRun(args: string[]): { status: number | null; out: string } {
    const res = spawnSync(TSX, [MAIN, 'init', '--dry-run', ...args], {
        cwd: project,
        encoding: 'utf8',
        env: { ...process.env, HOME: home, CI: '1', AGENT_CONFIG_DEV_MODE: '', AGENT_CONFIG_NO_UPDATE_CHECK: '1' },
        timeout: 60_000,
    });
    return { status: res.status, out: `${res.stdout}\n${res.stderr}` };
}

describe('init --dry-run', () => {
    it('global: honours --offline, lists where each tool would write, writes nothing', () => {
        const before = [snapshot(home), snapshot(project)];
        const r = dryRun(['--offline', '--global', '--tools=claude-code,cursor']);
        expect(r.status, r.out).toBe(0);
        expect(r.out).toMatch(/^ {2}offline: +true$/m);
        expect(r.out).toMatch(/^ {2}force: +false$/m);
        expect(r.out).not.toMatch(/\b(True|False)\b/);
        for (const dir of ['.claude/rules', '.claude/skills', '.claude/commands', '.cursor/rules', '.cursor/commands']) {
            expect(r.out, dir).toContain(join(home, dir));
        }
        expect(r.out).not.toMatch(/src\/scripts\/install|scripts-run/);
        expect([snapshot(home), snapshot(project)]).toEqual(before);
    });

    it('default scope: says a real run would refuse it, names --global, writes nothing', () => {
        const before = [snapshot(home), snapshot(project)];
        const r = dryRun(['--offline', '--tools=claude-code']);
        expect(r.status, r.out).toBe(0);
        expect(r.out).toMatch(/^ {2}scope: +project\b.*--global/m);
        expect(r.out).not.toMatch(/^ {2}scope: +auto/m);
        expect(r.out).not.toMatch(/src\/scripts\/install|scripts-run/);
        expect([snapshot(home), snapshot(project)]).toEqual(before);
    });
});
