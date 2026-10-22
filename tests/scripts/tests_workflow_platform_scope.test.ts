import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

interface Step { id?: string; run?: string }
const workflow = yaml.load(readFileSync(join(REPO_ROOT, '.github/workflows/tests.yml'), 'utf-8')) as {
    jobs: Record<string, { steps: Step[] }>;
};
const script = workflow.jobs['platform-scope']?.steps.find((s) => s.id === 'scope')?.run ?? '';

// Runs the workflow's own step with a stub `node` that answers what the
// classifier would, and returns the os_list it wrote.
function osList(env: { EVENT: string; LABELED: string; classifier: 'full' | 'tier' }): unknown {
    const dir = mkdtempSync(join(tmpdir(), 'pscope-'));
    try {
        writeFileSync(join(dir, 'node'), `#!/bin/sh\necho macos=${env.classifier}\n`);
        chmodSync(join(dir, 'node'), 0o755);
        const out = join(dir, 'out');
        writeFileSync(out, '');
        const r = spawnSync('bash', ['-e', '-c', script], {
            env: {
                PATH: `${dir}:${process.env['PATH'] ?? ''}`,
                EVENT: env.EVENT,
                LABELED: env.LABELED,
                BASE_REF: 'main',
                GITHUB_OUTPUT: out,
                GITHUB_STEP_SUMMARY: join(dir, 'summary'),
            },
            encoding: 'utf-8',
        });
        expect(r.status, r.stderr).toBe(0);
        const line = readFileSync(out, 'utf-8').split('\n').find((l) => l.startsWith('os_list='));
        return JSON.parse((line ?? '').slice('os_list='.length));
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}

const BOTH = ['ubuntu-26.04', 'macos-26'];

describe('tests.yml platform-scope — which OSes node, golden and svg-witness run on', () => {
    it('finds the step', () => {
        expect(script).toContain('ci_platform_scope');
    });

    it('drops macOS only on an unlabeled PR the classifier calls tier', () => {
        expect(osList({ EVENT: 'pull_request', LABELED: 'false', classifier: 'tier' })).toEqual(['ubuntu-26.04']);
    });

    it('keeps both OSes when the classifier says full', () => {
        expect(osList({ EVENT: 'pull_request', LABELED: 'false', classifier: 'full' })).toEqual(BOTH);
    });

    it('keeps both OSes when the PR carries ci:macos', () => {
        expect(osList({ EVENT: 'pull_request', LABELED: 'true', classifier: 'tier' })).toEqual(BOTH);
    });

    it('keeps both OSes on push, merge_group and workflow_dispatch whatever the diff', () => {
        for (const EVENT of ['push', 'merge_group', 'workflow_dispatch']) {
            expect(osList({ EVENT, LABELED: 'false', classifier: 'tier' }), EVENT).toEqual(BOTH);
        }
    });
});
