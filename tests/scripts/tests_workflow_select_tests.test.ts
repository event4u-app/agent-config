import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

interface Step { id?: string; run?: string; env?: Record<string, string> }
interface Job { needs?: string | string[]; if?: string; steps: Step[]; strategy?: { matrix?: Record<string, unknown> } }
const workflow = yaml.load(readFileSync(join(REPO_ROOT, '.github/workflows/tests.yml'), 'utf-8')) as { jobs: Record<string, Job> };
const script = workflow.jobs['select-tests']?.steps.find((s) => s.id === 'select')?.run ?? '';
const needs = (job: string): string[] => [workflow.jobs[job]?.needs ?? []].flat();

// Runs the workflow's own step with a stub `node` and returns the selector args.
function selectorArgs(env: { EVENT: string; FULL_LABEL?: string; QUEUE_BASE?: string }): string[] {
    const dir = mkdtempSync(join(tmpdir(), 'select-'));
    try {
        const argsOut = join(dir, 'args');
        writeFileSync(join(dir, 'node'), `#!/bin/sh\nshift 2\nprintf '%s\\n' "$@" > "${argsOut}"\n`);
        chmodSync(join(dir, 'node'), 0o755);
        const r = spawnSync('bash', ['-e', '-c', script], {
            env: {
                PATH: `${dir}:${process.env['PATH'] ?? ''}`,
                EVENT: env.EVENT,
                BASE_REF: 'main',
                QUEUE_BASE: env.QUEUE_BASE ?? '',
                FULL_LABEL: env.FULL_LABEL ?? 'false',
            },
            encoding: 'utf-8',
        });
        expect(r.status, r.stderr).toBe(0);
        return readFileSync(argsOut, 'utf-8').split('\n').filter((l) => l !== '');
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}

describe('tests.yml select-tests — what each event measures against', () => {
    it('runs the selector', () => {
        expect(script).toContain('src/scripts/ci_select_tests.ts');
    });

    it('measures a pull request against its base branch', () => {
        expect(selectorArgs({ EVENT: 'pull_request' })).toEqual(['--base', 'origin/main']);
    });

    it('measures a merge-queue entry against the queue base SHA', () => {
        expect(selectorArgs({ EVENT: 'merge_group', QUEUE_BASE: 'abc123' })).toEqual(['--base', 'abc123']);
    });

    it('runs everything on push, dispatch, the full-tests label, or a queue entry without a base', () => {
        expect(selectorArgs({ EVENT: 'push' })).toEqual(['--full']);
        expect(selectorArgs({ EVENT: 'workflow_dispatch' })).toEqual(['--full']);
        expect(selectorArgs({ EVENT: 'pull_request', FULL_LABEL: 'true' })).toEqual(['--full']);
        expect(selectorArgs({ EVENT: 'merge_group' })).toEqual(['--full']);
    });
});

describe('tests.yml — the Vitest jobs consume the selection', () => {
    it('shards node-tests by the selected shard list and passes the selected files', () => {
        const job = workflow.jobs['node-tests'] as Job;
        expect(needs('node-tests')).toContain('select-tests');
        expect(String(job.strategy?.matrix?.['shard'])).toContain('select-tests.outputs.node_shards');
        expect(job.if).toContain("node_shards != '[]'");
        const vitest = job.steps.find((s) => s.run?.includes('test:ts') === true);
        expect(vitest?.env?.['NODE_FILES']).toContain('node_files');
        expect(vitest?.run).toContain('$NODE_FILES');
    });

    it.each([
        ['golden-tests', 'golden'],
        ['svg-witness-tests', 'browser'],
        ['workspace-tests', 'workspace'],
    ])('gates %s on the %s route', (job, output) => {
        expect(needs(job)).toContain('select-tests');
        expect(workflow.jobs[job]?.if).toContain(`needs.select-tests.outputs.${output} == 'true'`);
    });

    it.each(['install-tests', 'install-aux-tests', 'static-checks', 'collector-lifecycle'])('gates %s on the code-path output', (job) => {
        expect(needs(job)).toContain('select-tests');
        expect(workflow.jobs[job]?.if).toContain("needs.select-tests.outputs.code == 'true'");
    });

    it('has no path filter on the pull_request trigger, so the aggregate always reports', () => {
        const raw = yaml.load(readFileSync(join(REPO_ROOT, '.github/workflows/tests.yml'), 'utf-8')) as { on: Record<string, { paths?: unknown } | null> };
        expect(raw.on['pull_request']?.paths).toBeUndefined();
    });

    it('keeps the selection job under the stable Tests result check', () => {
        expect(needs('tests-result')).toContain('select-tests');
    });
});
