import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parse as parseYaml } from 'yaml';

import { main as gateMain } from '../../src/scripts/check_kernel_edit_ratified.js';
import { commitAll, writeEmptyConsequenceClass } from './ratification_git_fixture.js';

/**
 * Step 2.8 — the authoritative CI path lists a gated file renamed away.
 *
 * Round 7's finding: the workflow fed the gate `gh pr view --json files`
 * through `--files`. That list carries only the destination of a rename
 * (`path` plus `changeType: RENAMED`, no previous path), so `--no-renames` in
 * the gate's own git diff never applied on the path CI actually runs, and a
 * kernel rule moved to an ungated name passed unratified.
 *
 * The test reads the gate invocations out of the workflow step itself and runs
 * them against a fixture, so it fails on the workflow, not on a paraphrase of
 * it. A `"${CHANGED[@]}"` argument is expanded the way the GitHub file list
 * expands it: destinations only, which is what `git diff -M` reports.
 */

const WORKFLOW = path.join(process.cwd(), '.github/workflows/consistency.yml');
const STEP = 'Kernel / governance-hook edits carry a ratification artifact';
const KERNEL = 'src/rules/commit-policy.md';

let root: string;

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-path-'));
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

interface WorkflowStep {
    name?: string;
    run?: string;
}

function stepScript(): string {
    const doc = parseYaml(fs.readFileSync(WORKFLOW, 'utf8')) as {
        jobs: Record<string, { steps?: WorkflowStep[] }>;
    };
    const steps = Object.values(doc.jobs).flatMap((j) => j.steps ?? []);
    const found = steps.filter((s) => s.name === STEP);
    expect(found).toHaveLength(1);
    const run = found[0]?.run;
    expect(typeof run).toBe('string');
    return run as string;
}

/** Each line of the step that invokes the gate, as shell words. */
function gateInvocations(script: string): string[][] {
    const lines = script
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => !l.startsWith('#') && /check_kernel_edit_ratified|\$GATE/u.test(l))
        .filter((l) => !l.startsWith('GATE=') && !l.startsWith('if '));
    return lines.map((l) => l.split(/\s+/u));
}

/** A shell word with the double quotes this workflow uses removed. */
function unquote(word: string): string {
    return word.replace(/^"(.*)"$/u, '$1');
}

/** The gate's own arguments: everything after the word naming the gate. */
function gateArgs(words: readonly string[], vars: Readonly<Record<string, string[]>>): string[] {
    const at = words.findIndex((w) => /check_kernel_edit_ratified|\$GATE/u.test(w));
    expect(at).toBeGreaterThanOrEqual(0);
    const out: string[] = [];
    for (const raw of words.slice(at + 1)) {
        const w = unquote(raw);
        const m = /^\$\{?([A-Z_]+)(\[@\])?\}?$/u.exec(w);
        if (m === null) {
            out.push(w);
            continue;
        }
        const value = vars[m[1] as string];
        if (value === undefined) {
            throw new Error(`the test does not know the workflow variable ${w}`);
        }
        out.push(...value);
    }
    return out;
}

function runGate(argv: readonly string[]): { code: number; out: string } {
    let out = '';
    const o = vi.spyOn(process.stdout, 'write').mockImplementation((c) => {
        out += String(c);
        return true;
    });
    const e = vi.spyOn(process.stderr, 'write').mockImplementation((c) => {
        out += String(c);
        return true;
    });
    try {
        return { code: gateMain(argv), out };
    } finally {
        o.mockRestore();
        e.mockRestore();
    }
}

/** The PR file list as GitHub reports it: a rename appears under its destination only. */
function githubFileList(base: string): string[] {
    const res = spawnSync('git', ['-C', root, 'diff', '-M', '--name-only', `${base}...HEAD`], {
        encoding: 'utf8',
    });
    expect(res.status).toBe(0);
    return res.stdout.split('\n').filter((l) => l !== '');
}

describe('the CI step lists a gated file renamed away (step 2.8)', () => {
    it('every gate invocation in the step catches a kernel rule renamed to an ungated path', () => {
        write('README.md', 'base\n');
        write(KERNEL, 'a kernel rule long enough to be detected as renamed\n'.repeat(4));
        const base = commitAll(root);
        fs.renameSync(path.join(root, KERNEL), path.join(root, 'src/moved.md'));
        commitAll(root);

        const invocations = gateInvocations(stepScript());
        // The base-revision run and the bootstrap run.
        expect(invocations).toHaveLength(2);
        for (const words of invocations) {
            const argv = gateArgs(words, {
                PWD: [root],
                BASE_SHA: [base],
                CHANGED: githubFileList(base),
            });
            const r = runGate([...argv, '--root', root, '--policy-root', process.cwd()]);
            expect(r.out).toContain(KERNEL);
            expect(r.code).toBe(1);
        }
    });
});
