import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const REPO_ROOT = resolve(__dirname, '..', '..');
const WORKFLOW = join(REPO_ROOT, '.github', 'workflows', 'tests.yml');

interface Step {
    id?: string;
    name?: string;
    run?: string;
}

interface Job {
    steps: Step[];
    outputs?: Record<string, string>;
}

function resultJob(): Job {
    const doc = parse(readFileSync(WORKFLOW, 'utf8')) as { jobs: Record<string, Job> };
    const job = doc.jobs['tests-result'];
    if (job === undefined) throw new Error('tests.yml has no tests-result job');
    return job;
}

function aggregateStep(): Step {
    const step = resultJob().steps.find((s) => s.id === 'aggregate');
    if (step?.run === undefined) throw new Error('tests-result has no `aggregate` step with a run block');
    return step;
}

const dirs: string[] = [];
afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function runStep(results: string): { status: number | null; summary: string; output: string } {
    const dir = mkdtempSync(join(tmpdir(), 'tests-result-'));
    dirs.push(dir);
    const summary = join(dir, 'summary.md');
    const output = join(dir, 'output');
    writeFileSync(summary, '');
    writeFileSync(output, '');
    const r = spawnSync('bash', ['-e', '-o', 'pipefail', '-c', aggregateStep().run ?? ''], {
        encoding: 'utf8',
        env: { PATH: process.env.PATH ?? '', RESULTS: results, GITHUB_STEP_SUMMARY: summary, GITHUB_OUTPUT: output },
    });
    return { status: r.status, summary: readFileSync(summary, 'utf8'), output: readFileSync(output, 'utf8') };
}

describe('tests.yml — Tests result aggregate', () => {
    it('states "nothing ran" when every needed job skipped, and stays green', () => {
        const r = runStep('skipped skipped');
        expect(r.status).toBe(0);
        expect(r.summary).toMatch(/nothing ran/);
        expect(r.output).toMatch(/^all_skipped=true$/m);
    });

    it('writes no such line when at least one job succeeded', () => {
        const r = runStep('success skipped');
        expect(r.status).toBe(0);
        expect(r.summary).not.toMatch(/nothing ran/);
        expect(r.output).toMatch(/^all_skipped=false$/m);
    });

    it('fails on a needed job that did not pass', () => {
        expect(runStep('failure').status).toBe(1);
        expect(runStep('success cancelled').status).toBe(1);
    });

    it('publishes all_skipped as a job output', () => {
        expect(resultJob().outputs?.['all_skipped']).toBe('${{ steps.aggregate.outputs.all_skipped }}');
    });
});
