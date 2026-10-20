import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';

import { commitAll, writeEmptyConsequenceClass } from './ratification_git_fixture.js';

/**
 * Step 2.9 — the two CI steps that list changed files see both sides of a
 * rename, tested against the workflow text rather than a paraphrase of it.
 *
 * The ratification step judges with the BASE revision's gate. A base copy that
 * predates `--no-renames` runs a plain `git diff --name-only base...head`, and
 * only the step's `GIT_CONFIG_*` environment turns rename detection off for
 * it. So the first test takes those variables from the step itself and runs
 * that legacy diff call under them, from a Node process that inherits them. A misspelled key is ignored by
 * git, which leaves the old path missing; a misspelled value is a fatal git
 * error. Both fail here.
 *
 * The kernel-rule bundle step runs the head's own script, so its invocation is
 * read from the step and executed against a fixture repository.
 */

const REPO = process.cwd();
const WORKFLOW = path.join(REPO, '.github/workflows/consistency.yml');
const RATIFICATION_STEP = 'Kernel / governance-hook edits carry a ratification artifact';
const BUNDLE_STEP = 'Check kernel-rule bundle (one rule per PR; label override)';
const KERNEL_A = 'src/rules/commit-policy.md';
const KERNEL_B = 'src/rules/scope-control.md';
const TSX = path.join(REPO, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');

interface WorkflowStep {
    name?: string;
    run?: string;
    env?: Record<string, unknown>;
}

function step(name: string): WorkflowStep {
    const doc = parseYaml(fs.readFileSync(WORKFLOW, 'utf8')) as {
        jobs: Record<string, { steps?: WorkflowStep[] }>;
    };
    const found = Object.values(doc.jobs)
        .flatMap((j) => j.steps ?? [])
        .filter((s) => s.name === name);
    expect(found).toHaveLength(1);
    return found[0] as WorkflowStep;
}

/** The step's `GIT_CONFIG_*` variables, stringified the way Actions exports them. */
function gitConfigEnv(s: WorkflowStep): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(s.env ?? {})) {
        if (k.startsWith('GIT_CONFIG_')) out[k] = String(v);
    }
    return out;
}

/**
 * An environment that cannot see the developer's git configuration or a
 * locating variable inherited from a hook, so rename detection is git's own
 * default (on) unless the step's variables switch it off.
 */
function isolatedEnv(extra: Readonly<Record<string, string>> = {}): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = { ...process.env };
    for (const k of Object.keys(env)) {
        if (k.startsWith('GIT_')) delete env[k];
    }
    env['GIT_CONFIG_GLOBAL'] = '/dev/null';
    env['GIT_CONFIG_NOSYSTEM'] = '1';
    return { ...env, ...extra };
}

let root: string;

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-rename-'));
    writeEmptyConsequenceClass(root); // the gate refuses a commit without the class list
});

afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

function write(rel: string, body: string): void {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, body);
}

function move(from: string, to: string): void {
    fs.mkdirSync(path.dirname(path.join(root, to)), { recursive: true });
    fs.renameSync(path.join(root, from), path.join(root, to));
}

const BODY = 'a kernel rule long enough to be detected as renamed\n'.repeat(4);

/**
 * The diff call of a base gate that predates `--no-renames`, made the way that
 * gate makes it: a Node process spawning git with no `env` option, so git sees
 * only what the step's environment handed down to the Node process.
 */
const LEGACY_GATE_DIFF = [
    "const r = require('node:child_process').spawnSync('git',",
    "  ['diff', '--name-only', `${process.argv[1]}...HEAD`], { cwd: process.cwd(), encoding: 'utf8' });",
    'process.stdout.write(r.stdout ?? "");',
    'process.stderr.write(r.stderr ?? "");',
    'process.exit(r.status ?? 9);',
].join('\n');

function legacyDiff(base: string, env: NodeJS.ProcessEnv): { status: number | null; files: string[]; err: string } {
    const res = spawnSync(process.execPath, ['-e', LEGACY_GATE_DIFF, base], { cwd: root, encoding: 'utf8', env });
    return {
        status: res.status,
        files: res.stdout.split('\n').filter((l) => l !== ''),
        err: res.stderr,
    };
}

describe('the ratification step turns rename detection off for a legacy base gate', () => {
    it('the step env makes a plain git diff list both sides of a kernel rule renamed away', () => {
        write(KERNEL_A, BODY);
        const base = commitAll(root);
        move(KERNEL_A, 'docs/moved.md');
        commitAll(root);

        const without = legacyDiff(base, isolatedEnv());
        expect(without.status).toBe(0);
        // Rename detection is on in the legacy call: the old side is absent.
        expect(without.files).toEqual(['docs/moved.md']);

        const vars = gitConfigEnv(step(RATIFICATION_STEP));
        expect(Object.keys(vars).length).toBeGreaterThan(0);
        const withEnv = legacyDiff(base, isolatedEnv(vars));
        expect(withEnv.err).toBe('');
        expect(withEnv.status).toBe(0);
        expect([...withEnv.files].sort()).toEqual(['docs/moved.md', KERNEL_A]);
    });
});

/** Every line of the step that runs the bundle script, as shell words. */
function bundleInvocation(script: string): string[] {
    const lines = script
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => !l.startsWith('#') && l.includes('check_kernel_rule_bundle'));
    expect(lines).toHaveLength(1);
    return (lines[0] as string).split(/\s+/u);
}

/** The PR file list as GitHub reports it: a rename appears under its destination only. */
function githubFileList(base: string): string[] {
    return legacyDiff(base, isolatedEnv()).files;
}

function runBundleStep(base: string): { code: number | null; out: string } {
    const s = step(BUNDLE_STEP);
    const words = bundleInvocation(s.run ?? '');
    const at = words.findIndex((w) => w.includes('check_kernel_rule_bundle'));
    const vars: Record<string, string[]> = { BASE_SHA: [base], CHANGED: githubFileList(base) };
    const args: string[] = [];
    for (const raw of words.slice(at + 1)) {
        const w = raw.replace(/^"(.*)"$/u, '$1');
        const m = /^\$\{?([A-Z_]+)(\[@\])?\}?$/u.exec(w);
        if (m === null) {
            args.push(w);
            continue;
        }
        const value = vars[m[1] as string];
        if (value === undefined) throw new Error(`the test does not know the workflow variable ${w}`);
        args.push(...value);
    }
    const script = path.join(REPO, 'src/scripts/check_kernel_rule_bundle.ts');
    const res = spawnSync(TSX, [script, ...args, '--event-path', path.join(root, 'no-event.json')], {
        cwd: root,
        encoding: 'utf8',
        env: isolatedEnv(gitConfigEnv(s)),
    });
    return { code: res.status, out: `${res.stdout}${res.stderr}` };
}

describe('the kernel-rule bundle step sees a kernel rule renamed away', () => {
    it('counts the old side of a rename as a touched kernel rule', () => {
        write(KERNEL_A, BODY);
        write(KERNEL_B, `${BODY}second\n`);
        const base = commitAll(root);
        fs.appendFileSync(path.join(root, KERNEL_A), 'edited\n');
        move(KERNEL_B, 'docs/moved.md');
        commitAll(root);

        const r = runBundleStep(base);
        expect(r.out).toContain(KERNEL_A);
        expect(r.out).toContain(KERNEL_B);
        expect(r.code).toBe(1);
    });

    it('refuses rather than passes when the changed-file list cannot be read', () => {
        write(KERNEL_A, BODY);
        commitAll(root);
        const r = runBundleStep('0000000000000000000000000000000000000000');
        expect(r.code).toBe(3);
    });
});
