import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type JobResult, type MirrorConfig, planJobs, runJob, summarize } from '../../src/scripts/ci_mirror.js';

const WORKFLOW = `
name: Fixture
on: { pull_request: {} }
jobs:
  gates:
    name: Fixture gates
    runs-on: ubuntu-latest
    env:
      JOB_LEVEL: job-value
    steps:
      - uses: actions/checkout@v4
      - name: first gate fails
        if: \${{ !cancelled() }}
        run: echo "first broken thing"; exit 3
      - name: second gate fails
        if: \${{ !cancelled() }}
        run: echo "second broken thing"; exit 4
      - name: writes an output
        id: w
        if: \${{ !cancelled() }}
        run: |
          echo "x=hello" >> "$GITHUB_OUTPUT"
          echo "FROM_ENV_FILE=carried" >> "$GITHUB_ENV"
      - name: reads the output, the env file and the job env
        if: \${{ !cancelled() && steps.w.outputs.x == 'hello' }}
        run: |
          [ "\${{ steps.w.outputs.x }}" = hello ]
          [ "$FROM_ENV_FILE" = carried ]
          [ "$JOB_LEVEL" = job-value ]
          [ "\${{ github.event_name }}" = pull_request ]
      - name: default condition after a failure
        run: echo "must not run"
      - name: refused ratification
        if: \${{ !cancelled() }}
        run: |
          echo "  record agents/evidence/ratifications/x.md — verdict: refused"
          exit 1
      - name: missing ratification
        if: \${{ !cancelled() }}
        run: |
          echo "no valid record for this diff"
          exit 1
      - name: hook git env does not leak
        if: \${{ !cancelled() }}
        run: test -z "\${GIT_DIR:-}"
      - name: unsupported expression
        if: \${{ !cancelled() }}
        run: echo \${{ matrix.os }}
      - name: missing tool
        if: \${{ !cancelled() }}
        run: definitely-not-a-command-ci-mirror
      - name: runs only in CI
        run: echo never
`;

const CONFIG: MirrorConfig = {
    jobs: [{ workflow: 'fixture.yml', job: 'gates' }],
    ci_only_steps: [{ workflow: 'fixture.yml', job: 'gates', step: 'runs only in CI', reason: 'fixture' }],
    owner_decision_steps: ['refused ratification', 'missing ratification'].map((step) => ({
        workflow: 'fixture.yml', job: 'gates', step, marker: '^\\s*record \\S+ — verdict: (?!ratified\\b)\\S+', meaning: 'fixture',
    })),
};

let root: string;
let result: JobResult;
const savedGitDir = process.env.GIT_DIR;

beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-mirror-run-'));
    fs.mkdirSync(path.join(root, '.github/workflows'), { recursive: true });
    fs.writeFileSync(path.join(root, '.github/workflows/fixture.yml'), WORKFLOW);
    const logs = path.join(root, 'logs');
    fs.mkdirSync(logs);
    process.env.GIT_DIR = '/nonexistent/as-set-by-git-inside-a-hook';
    const plan = planJobs(root, CONFIG)[0];
    if (!plan) throw new Error('fixture job did not plan');
    result = await runJob(plan, {
        baseRef: 'main', baseSha: 'a'.repeat(40), headSha: 'b'.repeat(40), headRef: 'topic',
        prNumber: '1', runnerTemp: root, workspace: root,
    }, root, logs);
}, 60_000);

afterAll(() => {
    if (savedGitDir === undefined) delete process.env.GIT_DIR;
    else process.env.GIT_DIR = savedGitDir;
    fs.rmSync(root, { recursive: true, force: true });
});

const verdict = (name: string) => result.steps.find((s) => s.name === name)?.verdict;

describe('ci_mirror runJob — one run reports every failure', () => {
    it('keeps running after a failure where the workflow says so, and reports both', () => {
        expect(verdict('first gate fails')).toBe('failed');
        expect(verdict('second gate fails')).toBe('failed');
    });

    it('carries step outputs, GITHUB_ENV and job env between steps', () => {
        expect(verdict('writes an output')).toBe('passed');
        expect(verdict('reads the output, the env file and the job env')).toBe('passed');
    });

    it('skips a step whose implicit success() is false after a failure', () => {
        expect(verdict('default condition after a failure')).toBe('skipped');
    });

    it('classifies a refused record as an owner decision, but a missing record as a failure', () => {
        expect(verdict('refused ratification')).toBe('owner-decision');
        expect(verdict('missing ratification')).toBe('failed');
    });

    it('strips the git variables a hook exports', () => {
        expect(verdict('hook git env does not leak')).toBe('passed');
    });

    it('reports what it cannot reproduce instead of guessing or failing', () => {
        expect(verdict('unsupported expression')).toBe('not-reproducible');
        expect(verdict('missing tool')).toBe('not-reproducible');
        expect(verdict('runs only in CI')).toBe('ci-only');
        expect(verdict('uses actions/checkout')).toBe('setup');
    });

    it('blocks on exactly the failures and names each one in the summary', () => {
        const { blocking, text } = summarize([result]);
        expect(blocking).toBe(3);
        for (const name of ['first gate fails', 'second gate fails', 'missing ratification']) expect(text).toContain(name);
        expect(text).toContain('first broken thing');
        expect(text).toContain('second broken thing');
        expect(text).toMatch(/Owner decision required[\s\S]*refused ratification/);
    });
});

describe('ci_mirror — the caller\'s checkout is never written through', () => {
    it('treats a pure npm install step as setup, and nothing else', async () => {
        const { isInstallStep } = await import('../../src/scripts/ci_mirror.js');
        expect(isInstallStep('npm ci --no-audit --no-fund --prefer-offline')).toBe(true);
        expect(isInstallStep('# deps\nnpm install\n')).toBe(true);
        expect(isInstallStep('npm ci\nnpm run typecheck')).toBe(false);
        expect(isInstallStep('npm run lint:ts --silent')).toBe(false);
        expect(isInstallStep(undefined)).toBe(false);
    });

    it('gives each worktree its own node_modules: a write into the clone leaves the original alone', async () => {
        const { cloneNodeModules } = await import('../../src/scripts/ci_mirror.js');
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-mirror-clone-'));
        const original = path.join(dir, 'original');
        fs.mkdirSync(path.join(original, 'pkg'), { recursive: true });
        fs.writeFileSync(path.join(original, 'pkg/index.js'), 'original');
        const clone = path.join(dir, 'clone');
        cloneNodeModules(original, clone);
        expect(fs.lstatSync(clone).isSymbolicLink()).toBe(false);
        fs.rmSync(path.join(clone, 'pkg'), { recursive: true });
        expect(fs.readFileSync(path.join(original, 'pkg/index.js'), 'utf8')).toBe('original');
        fs.rmSync(dir, { recursive: true, force: true });
    });
});
