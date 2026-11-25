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

// Evaluates a matrix `os:` expression of the shape the workflow uses —
// `${{ fromJSON(<cond> && '<json>' || '<json>') }}` over `needs.<job>.outputs.<key>` —
// with the given outputs, so the tests below assert which OSes actually run
// rather than which substrings the YAML happens to contain.
function osFor(job: string, outputs: Record<string, string>): string[] {
    const raw = String(workflow.jobs[job]?.strategy?.matrix?.['os'] ?? '');
    const inner = /^\$\{\{\s*(.*?)\s*\}\}$/s.exec(raw)?.[1];
    if (inner === undefined) return yaml.load(raw) as string[];
    const js = inner
        .replace(/\bfromJSON\(/g, 'JSON.parse(')
        .replace(/needs\.([\w-]+)\.outputs\.(\w+)/g, (_, j: string, k: string) => JSON.stringify(outputs[`${j}.${k}`] ?? ''));
    return new Function(`return (${js});`)() as string[];
}

const LINUX = ['ubuntu-latest'];
const BOTH = ['ubuntu-latest', 'macos-26'];
const RELEASE_ONLY = "${{ !startsWith(github.head_ref, 'release/') }}";

describe('tests.yml — Linux runs the whole suite on every PR, macOS runs the selection', () => {
    // Replayed on 2026-11-25: in 15 of 19 red push:main runs the failing suite was
    // never selected on its PR. Linux is therefore not selected at all.
    it('node-tests is the Linux leg: four fixed shards, no file list, gated on nothing but the release carve-out', () => {
        const job = workflow.jobs['node-tests'] as Job & { 'runs-on'?: string };
        expect(job['runs-on']).toBe('ubuntu-latest');
        expect(job.strategy?.matrix?.['shard']).toEqual([1, 2, 3, 4]);
        expect(job.if).toBe(RELEASE_ONLY);
        const vitest = job.steps.find((s) => s.run?.includes('test:ts') === true);
        expect(vitest?.env?.['NODE_FILES']).toBeUndefined();
        expect(vitest?.run).not.toContain('$NODE_FILES');
        expect(vitest?.env?.['SHARD']).toBe('${{ matrix.shard }}/4');
    });

    it('node-tests-macos is the macOS leg: selected shards and files, only when platform scope keeps macOS', () => {
        const job = workflow.jobs['node-tests-macos'] as Job & { 'runs-on'?: string };
        expect(job['runs-on']).toBe('macos-26');
        expect(needs('node-tests-macos')).toEqual(expect.arrayContaining(['platform-scope', 'select-tests']));
        expect(String(job.strategy?.matrix?.['shard'])).toContain('select-tests.outputs.node_shards');
        expect(job.if).toContain("node_shards != '[]'");
        expect(job.if).toContain("contains(needs.platform-scope.outputs.os_list, 'macos-26')");
        const vitest = job.steps.find((s) => s.run?.includes('test:ts') === true);
        expect(vitest?.env?.['NODE_FILES']).toContain('node_files');
        expect(vitest?.run).toContain('$NODE_FILES');
    });

    it('both node legs run the same Vitest command with the same exclusions', () => {
        const cmd = (job: string): string | undefined => workflow.jobs[job]?.steps.find((s) => s.run?.includes('test:ts') === true)?.run;
        const strip = (s: string | undefined): string => (s ?? '').replace(/\s*\\\s*\$NODE_FILES\s*$/, '').replace(/^\s*# shellcheck.*\n/m, '').trim();
        expect(strip(cmd('node-tests-macos'))).toBe(strip(cmd('node-tests')));
    });

    it.each([
        ['golden-tests', 'golden', true],
        ['svg-witness-tests', 'browser', true],
        ['workspace-tests', 'workspace', false],
    ] as const)('%s runs on Linux always and adds macOS only when %s is selected', (job, route, scoped) => {
        expect(workflow.jobs[job]?.if).toBe(RELEASE_ONLY);
        const out = (selected: boolean, macos: boolean): Record<string, string> => ({
            [`select-tests.${route}`]: String(selected),
            'platform-scope.os_list': JSON.stringify(macos ? BOTH : LINUX),
        });
        expect(osFor(job, out(false, true))).toEqual(LINUX);
        expect(osFor(job, out(true, true))).toEqual(BOTH);
        // golden and svg follow platform scope; workspace kept its macOS leg regardless.
        expect(osFor(job, out(true, false))).toEqual(scoped ? LINUX : BOTH);
    });

    it('the aggregate waits for both node legs', () => {
        expect(needs('tests-result')).toEqual(expect.arrayContaining(['node-tests', 'node-tests-macos']));
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
