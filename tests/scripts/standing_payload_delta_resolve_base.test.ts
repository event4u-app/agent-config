import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const REPO_ROOT = resolve(__dirname, '..', '..');
const WORKFLOW = join(REPO_ROOT, '.github', 'workflows', 'standing-payload-delta.yml');

interface Step {
    id?: string;
    run?: string;
    env?: Record<string, string>;
}

function resolveStep(): Step {
    const doc = parse(readFileSync(WORKFLOW, 'utf8')) as { jobs: Record<string, { steps: Step[] }> };
    for (const job of Object.values(doc.jobs)) {
        const step = job.steps.find((s) => s.id === 'base');
        if (step !== undefined) return step;
    }
    throw new Error('no step with id `base` in standing-payload-delta.yml');
}

function git(cwd: string, ...args: string[]): string {
    return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

/** Runs the step's script the way the runner would, with the given event context as env. */
function runResolve(cwd: string, ctx: { event: string; baseRef: string; queueBase: string }): string {
    const step = resolveStep();
    expect(step.run).toBeDefined();
    expect(step.run).not.toMatch(/\$\{\{/);
    const outFile = join(cwd, 'gh-output');
    writeFileSync(outFile, '');
    const values: Record<string, string> = {
        'github.event_name': ctx.event,
        'github.base_ref': ctx.baseRef,
        'github.event.merge_group.base_sha': ctx.queueBase,
    };
    const env: Record<string, string> = { ...process.env, GITHUB_OUTPUT: outFile } as Record<string, string>;
    for (const [name, expr] of Object.entries(step.env ?? {})) {
        const m = /^\$\{\{\s*([\w.]+)\s*\}\}$/.exec(expr);
        const context = m?.[1] ?? '';
        expect(context, `env ${name} must be a single context expression`).not.toBe('');
        expect(Object.keys(values), `env ${name} reads an unmodelled context`).toContain(context);
        env[name] = values[context] ?? '';
    }
    execFileSync('bash', ['-c', step.run!], { cwd, env, encoding: 'utf8' });
    return /^merge_base=(.*)$/m.exec(readFileSync(outFile, 'utf8'))?.[1] ?? '';
}

describe('standing-payload-delta — Resolve merge-base', () => {
    let repo: string;
    let mainSha: string;

    beforeEach(() => {
        repo = mkdtempSync(join(tmpdir(), 'spd-base-'));
        git(repo, 'init', '-q', '-b', 'main');
        git(repo, '-c', 'user.name=t', '-c', 'user.email=t@e', 'commit', '-q', '--allow-empty', '-m', 'base');
        mainSha = git(repo, 'rev-parse', 'HEAD');
        git(repo, 'update-ref', 'refs/remotes/origin/main', mainSha);
        git(repo, '-c', 'user.name=t', '-c', 'user.email=t@e', 'commit', '-q', '--allow-empty', '-m', 'change');
    });

    afterEach(() => rmSync(repo, { recursive: true, force: true }));

    it('resolves the merge-base on a pull request', () => {
        expect(runResolve(repo, { event: 'pull_request', baseRef: 'main', queueBase: '' })).toBe(mainSha);
    });

    it('resolves the queue base on a merge_group entry, where base_ref is empty', () => {
        expect(runResolve(repo, { event: 'merge_group', baseRef: '', queueBase: mainSha })).toBe(mainSha);
    });

    it('stays empty on a manual dispatch', () => {
        expect(runResolve(repo, { event: 'workflow_dispatch', baseRef: '', queueBase: '' })).toBe('');
    });
});
