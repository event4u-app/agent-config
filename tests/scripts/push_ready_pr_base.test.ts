/**
 * `task push-ready` without BASE must judge the branch against its pull
 * request's base, and both probing steps must judge the same one.
 *
 * Without BASE the integrate step ran `sync_pr_branch` with no `--base` — the
 * default branch — while the re-check step's own resolver reads the open pull
 * request's base: a PR into `release/1.x` was merged with `main` and then
 * checked against `release/1.x`. The base is now derived once, at the task
 * level, and handed to both; the resolvers stay forge-free.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse as parseYaml } from 'yaml';
import { describe, expect, it } from 'vitest';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEV = parseYaml(fs.readFileSync(path.join(REPO, 'taskfiles', 'dev.yml'), 'utf8')) as {
    tasks: Record<string, { vars?: Record<string, unknown>; cmds?: unknown[]; desc?: string }>;
};
const TASK = DEV.tasks['push-ready'];

/** The task-level derivation, run as Task runs it, with BASE substituted and a stand-in `gh` on PATH. */
function derive(base: string, ghOut: string | null): string {
    const spec = TASK?.vars?.['PR_BASE'] as { sh?: string } | undefined;
    if (spec?.sh === undefined) throw new Error('push-ready declares no PR_BASE derivation');
    const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'push-ready-gh-'));
    const gh = ghOut === null ? 'exit 1' : `[ "$1 $2" = "pr view" ] && printf '%s\\n' '${ghOut}'`;
    fs.writeFileSync(path.join(bin, 'gh'), `#!/bin/sh\n${gh}\n`);
    fs.chmodSync(path.join(bin, 'gh'), 0o755);
    const script = spec.sh.split('{{.BASE}}').join(base);
    const r = spawnSync('sh', ['-c', script], { encoding: 'utf-8', env: { ...process.env, PATH: `${bin}:${process.env.PATH ?? ''}` } });
    return r.stdout.trim();
}

describe('push-ready derives the pull request base once', () => {
    it('takes the open pull request base when BASE is not given', () => {
        expect(derive('', 'release/1.x')).toBe('release/1.x');
    });

    it('falls back to the default branch (an empty base) when there is no pull request', () => {
        expect(derive('', null)).toBe('');
    });

    it('accepts BASE=origin/<name> as the same base as BASE=<name>', () => {
        expect(derive('origin/main', null)).toBe('main');
        expect(derive('main', null)).toBe('main');
    });

    it('lets an explicit BASE win without asking the forge', () => {
        expect(derive('hotfix/2', 'release/1.x')).toBe('hotfix/2');
    });

    it('hands the same base to the integrate step and the re-check step', () => {
        const cmds = (TASK?.cmds ?? []).map(String);
        const sync = cmds.filter((c) => c.includes('sync_pr_branch'));
        const fresh = cmds.filter((c) => c.includes('check_branch_freshness'));
        expect(sync.length).toBeGreaterThan(0);
        expect(fresh.length).toBeGreaterThan(0);
        for (const c of [...sync, ...fresh]) {
            expect(c).toContain('--base {{.PR_BASE}}');
            expect(c).not.toContain('origin/{{.PR_BASE}}');
        }
        expect(cmds.join('\n')).not.toContain('{{.BASE}}');
    });

    it('says in its description where the base comes from', () => {
        expect(TASK?.desc).toMatch(/gh pr view --json baseRefName/);
        expect(TASK?.desc).toMatch(/default branch only when there is no/);
    });
});
