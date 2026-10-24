#!/usr/bin/env tsx
/**
 * Holds every invocation of the 16 live-tree checks to its classification in
 * `src/config/live-tree-check-classes.json` (road-to-authority-routing-mechanism
 * step 7.2). An invariant that runs in a workflow or task must make that caller
 * fail on a non-zero exit; an invocation whose active aspects are all
 * observations must not; an invariant that does not block needs a recorded
 * demotion with its reason. An invocation that appears, disappears or changes
 * its blocking without the classification changing with it fails this gate, so
 * no check can be weakened silently.
 *
 * Exit codes:
 *   0 — every invocation matches its classification
 *   1 — drift: an unclassified, missing or re-weighted invocation, or an
 *       unrecorded demotion
 *   2 — bad args
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { type Invocation, taskfileInvocations, workflowInvocations } from './_lib/gate_invocations.js';
import { runSelfTest, type SelfTestCase } from './_lib/gate_self_test.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
export const CONFIG_REL = 'src/config/live-tree-check-classes.json';
export const WORKFLOWS = ['.github/workflows/standing-payload-delta.yml', '.github/workflows/rule-backstops.yml', '.github/workflows/tests.yml'];
export const TASKFILES = ['taskfiles/ci-fast.yml', 'taskfiles/content.yml', 'taskfiles/engine.yml'];
const SELF_TEST_MIN_CASES = 4;
const SELF_TEST_MIN_REJECT = 3;

export interface ClassifiedInvocation extends Invocation {
    check: string;
    aspects: Record<string, string>;
    demoted?: string[];
    demotion_reason?: string;
}

export interface ClassConfig {
    provisional: boolean;
    /** The checks under classification; fixed, so a check whose every invocation vanishes is still looked for. */
    checks: string[];
    revisable: string;
    invocations: ClassifiedInvocation[];
}

const key = (check: string, i: { file: string; where: string; flags: readonly string[] }): string => `${check} @ ${i.file} :: ${i.where} :: ${i.flags.join(' ')}`;

/** Every invocation of the classified checks found in the workflows and taskfiles under `root`. */
export function actualInvocations(root: string, checks: readonly string[]): Map<string, Invocation> {
    const out = new Map<string, Invocation>();
    for (const check of checks) {
        for (const i of [...WORKFLOWS.flatMap((f) => workflowInvocations(root, f, check)), ...TASKFILES.flatMap((f) => taskfileInvocations(root, f, check))]) {
            out.set(key(check, i), i);
        }
    }
    return out;
}

/** The drift between the classification and the tree under `root`; empty means they agree. */
export function findDrift(root: string, config: ClassConfig): string[] {
    const drift: string[] = [];
    const found = actualInvocations(root, config.checks);
    for (const e of config.invocations) if (!config.checks.includes(e.check)) drift.push(`invocation of an unlisted check: ${key(e.check, e)}`);
    const declared = new Map(config.invocations.map((e) => [key(e.check, e), e]));
    for (const k of found.keys()) if (!declared.has(k)) drift.push(`unclassified invocation: ${k}`);
    for (const [k, e] of declared) {
        const actual = found.get(k);
        if (actual === undefined) {
            drift.push(`classified invocation not found: ${k}`);
            continue;
        }
        if (actual.blocking !== e.blocking) drift.push(`blocking drift: ${k} is classified ${e.blocking ? 'blocking' : 'non-blocking'} but is ${actual.blocking ? 'blocking' : 'non-blocking'}`);
        const invariants = Object.entries(e.aspects).filter(([, c]) => c === 'invariant').map(([id]) => id);
        if (!e.blocking && invariants.length > 0) {
            const demoted = [...(e.demoted ?? [])].sort().join(',');
            if (demoted !== [...invariants].sort().join(',') || (e.demotion_reason ?? '').length < 60) drift.push(`unrecorded demotion: ${k} does not block invariant(s) ${invariants.join(', ')} without a recorded demotion and reason`);
        }
        const classes = Object.values(e.aspects);
        if (e.blocking && classes.length > 0 && classes.every((c) => c === 'observation')) drift.push(`observation blocks: ${k} runs only observation aspects but is classified blocking`);
    }
    return drift;
}

/** A scratch copy of the wiring files, so a fixture can be mutated without touching the tree. */
function withScratch<T>(fn: (dir: string) => T): T {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'live-tree-classes-'));
    try {
        for (const f of [...WORKFLOWS, ...TASKFILES]) {
            fs.mkdirSync(path.dirname(path.join(tmp, f)), { recursive: true });
            fs.copyFileSync(path.join(REPO_ROOT, f), path.join(tmp, f));
        }
        return fn(tmp);
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
}

function selfTest(): number {
    const config = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, CONFIG_REL), 'utf8')) as ClassConfig;
    const exit = (drift: string[]): number => (drift.length > 0 ? 1 : 0);
    const blockingStep = config.invocations.find((e) => e.blocking && e.file.startsWith('.github/'));
    const cases: SelfTestCase[] = [
        { name: 'the unmodified wiring agrees with the classification', expect: 'accept', run: () => withScratch((dir) => exit(findDrift(dir, config))) },
        {
            name: 'a blocking workflow step made continue-on-error is refused',
            expect: 'reject',
            run: () =>
                withScratch((dir) => {
                    if (blockingStep === undefined) return 0;
                    const wf = path.join(dir, blockingStep.file);
                    const anchor = `- name: ${blockingStep.where}`;
                    fs.writeFileSync(wf, fs.readFileSync(wf, 'utf8').replace(anchor, `${anchor}\n        continue-on-error: true`));
                    return exit(findDrift(dir, config));
                }),
        },
        { name: 'an invocation the classification does not know is refused', expect: 'reject', run: () => withScratch((dir) => exit(findDrift(dir, { ...config, invocations: config.invocations.slice(1) }))) },
        {
            name: 'a non-blocking invariant without a recorded demotion is refused',
            expect: 'reject',
            run: () => withScratch((dir) => exit(findDrift(dir, { ...config, invocations: config.invocations.map((e) => (e.blocking ? e : { ...e, demoted: [], demotion_reason: '' })) }))),
        },
    ];
    return runSelfTest({ gate: 'check_live_tree_check_classes', cases, minCases: SELF_TEST_MIN_CASES, minRejectCases: SELF_TEST_MIN_REJECT });
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    for (const a of argv) {
        if (a !== '--quiet' && a !== '--self-test') {
            process.stderr.write(`check_live_tree_check_classes: unknown argument ${a}\nusage: check_live_tree_check_classes [--quiet] [--self-test]\n`);
            return 2;
        }
    }
    if (argv.includes('--self-test')) return selfTest();
    const config = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, CONFIG_REL), 'utf8')) as ClassConfig;
    const drift = findDrift(REPO_ROOT, config);
    process.stdout.write(`scanned: ${config.invocations.length}\n`);
    if (drift.length > 0) {
        process.stdout.write(`❌  check_live_tree_check_classes: ${drift.length} invocation(s) drifted from ${CONFIG_REL}:\n`);
        for (const d of drift) process.stdout.write(`  - ${d}\n`);
        return 1;
    }
    if (!argv.includes('--quiet')) process.stdout.write(`✅  check_live_tree_check_classes: ${config.invocations.length} invocations match their classification\n`);
    return 0;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) return true;
    try {
        return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (_isCliEntry() || process.argv[1] === _HERE) process.exit(main());
