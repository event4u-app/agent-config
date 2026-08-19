// Nudge-interference runner — road-to-standing-context-40k Phase 4.2.
//
// The corpus (`tests/eval/nudge-interference/user-prompt-submit.yaml`) records
// how many of the two `user_prompt_submit` nudges fire per prompt class. This
// file is the assertion half, and it is bidirectional on purpose:
//
//   - a `max_nudges` class going ABOVE its number reds — a nudge widened into
//     its sibling's territory, which is the interference the step exists to
//     catch and the "fails when a second nudge is forced" verify clause;
//   - the `expect_nudges` overlap class going BELOW its number reds too — a
//     suppression landed and the corpus was not updated with it.
//
// Concerns run IN-PROCESS via CONCERN_REGISTRY with the stdin override, the
// same harness `bench_hook_injection` uses, under AGENT_CONFIG_REPLAY=1 so no
// state is written. "Fires" means non-empty stdout: both nudges are
// conditional-silence and emit their JSON payload only on a positive verdict.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import YAML from 'yaml';

import { CONCERN_REGISTRY } from '../../../src/scripts/hooks/concern_registry.js';
import {
    setHookStdinOverride,
    clearHookStdinOverride,
} from '../../../src/scripts/hooks/hook_stdin.js';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const CORPUS = path.join(
    REPO_ROOT,
    'tests',
    'eval',
    'nudge-interference',
    'user-prompt-submit.yaml',
);

/** Concern id → the registry key the manifest binds for it. */
const NUDGE_SCRIPTS: Record<string, string> = {
    'delegation-nudge': 'src/scripts/hooks/delegation_nudge_hook.ts',
    'skill-route': 'src/scripts/hooks/skill_route_hook.ts',
};

interface CorpusClass {
    class: string;
    intent?: string;
    max_nudges?: number;
    expect_nudges?: number;
    recorded?: string;
    prompts: string[];
}
interface Corpus {
    pair: string[];
    slot: string;
    platform: string;
    classes: CorpusClass[];
}

const corpus = YAML.parse(fs.readFileSync(CORPUS, 'utf-8')) as Corpus;

/**
 * Run one nudge against one prompt; true when it injected anything.
 *
 * A crash is RETHROWN, not swallowed. The first version caught it and returned
 * `false`, which a review finding named correctly: a broken nudge then reads as
 * "did not fire", every `max_nudges` class goes green — the `silent` class,
 * cap 0, vacuously so — and only the one `overlap` class carries any liveness at
 * all. A concern that throws is a failure of this fixture, not a silence.
 */
function nudgeFires(script: string, prompt: string): boolean {
    const main = CONCERN_REGISTRY[script];
    if (main === undefined) throw new Error(`not in CONCERN_REGISTRY: ${script}`);
    let out = '';
    let crash: unknown = null;
    const prevOut = process.stdout.write;
    const prevErr = process.stderr.write;
    const prevReplay = process.env['AGENT_CONFIG_REPLAY'];
    setHookStdinOverride(
        JSON.stringify({
            event: corpus.slot,
            platform: corpus.platform,
            workspace_root: REPO_ROOT,
            payload: { prompt },
        }),
    );
    process.env['AGENT_CONFIG_REPLAY'] = '1';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    process.stdout.write = ((chunk: any, enc?: any, cb?: any): boolean => {
        out += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf-8');
        const done = typeof enc === 'function' ? enc : cb;
        if (typeof done === 'function') done();
        return true;
    }) as typeof process.stdout.write;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    process.stderr.write = ((_chunk: any, enc?: any, cb?: any): boolean => {
        const done = typeof enc === 'function' ? enc : cb;
        if (typeof done === 'function') done();
        return true;
    }) as typeof process.stderr.write;
    try {
        main(['--platform', corpus.platform]);
    } catch (exc) {
        crash = exc;
    } finally {
        process.stdout.write = prevOut;
        process.stderr.write = prevErr;
        if (prevReplay === undefined) delete process.env['AGENT_CONFIG_REPLAY'];
        else process.env['AGENT_CONFIG_REPLAY'] = prevReplay;
        clearHookStdinOverride();
    }
    if (crash !== null) {
        throw new Error(
            `nudge '${script}' threw on prompt: ${prompt}\n` +
                `${crash instanceof Error ? crash.stack ?? crash.message : String(crash)}`,
        );
    }
    return out.trim().length > 0;
}

/** Which of the corpus's nudges fired on this prompt. */
export function firedNudges(prompt: string): string[] {
    return corpus.pair.filter((id) => {
        const script = NUDGE_SCRIPTS[id];
        if (script === undefined) throw new Error(`corpus names an unmapped nudge: ${id}`);
        return nudgeFires(script, prompt);
    });
}

/**
 * The ≤N check, extracted so it is testable rather than only inlined into the
 * per-class `it()` bodies. A review finding: the old teeth test restated an
 * assertion it had already made instead of exercising the mechanism, so nothing
 * would have caught the check itself going vacuous.
 *
 * Returns one line per offending prompt; an empty array means the class holds.
 */
export function capViolations(cap: number, prompts: readonly string[]): string[] {
    const out: string[] = [];
    for (const prompt of prompts) {
        const fired = firedNudges(prompt);
        if (fired.length > cap) out.push(`[${fired.join(', ')}] on: ${prompt}`);
    }
    return out;
}

describe('nudge-interference corpus — shape', () => {
    it('names exactly the pair this runner can execute', () => {
        expect(corpus.pair.length).toBeGreaterThanOrEqual(2);
        for (const id of corpus.pair) {
            expect(Object.keys(NUDGE_SCRIPTS)).toContain(id);
            expect(CONCERN_REGISTRY[NUDGE_SCRIPTS[id] as string]).toBeTypeOf('function');
        }
    });

    it('gives every class prompts and exactly one expectation key', () => {
        expect(corpus.classes.length).toBeGreaterThan(0);
        for (const c of corpus.classes) {
            expect(c.prompts.length, `${c.class} has no prompts`).toBeGreaterThan(0);
            const keys = [c.max_nudges, c.expect_nudges].filter((v) => v !== undefined);
            expect(keys, `${c.class} needs exactly one of max_nudges / expect_nudges`).toHaveLength(1);
        }
    });

    it('carries at least one German prompt, per the routing-matrix convention', () => {
        const all = corpus.classes.flatMap((c) => c.prompts).join(' ');
        expect(/[äöüÄÖÜß]|\bDu\b|\bdurch\b/.test(all)).toBe(true);
    });

    it('records a reason for every class that expects more than one nudge', () => {
        for (const c of corpus.classes) {
            if ((c.expect_nudges ?? 0) > 1) {
                expect(c.recorded, `${c.class} expects >1 nudge without a recorded reason`).toBeTruthy();
            }
        }
    });
});

describe('nudge-interference — at most one nudge per prompt class', () => {
    for (const c of corpus.classes.filter((x) => x.max_nudges !== undefined)) {
        const cap = c.max_nudges as number;
        it(`${c.class}: no prompt fires more than ${String(cap)} nudge(s)`, () => {
            expect(
                capViolations(cap, c.prompts),
                `class '${c.class}' allows at most ${String(cap)} nudge(s)`,
            ).toEqual([]);
        });
    }
});

describe('nudge-interference — the recorded overlap stays recorded', () => {
    for (const c of corpus.classes.filter((x) => x.expect_nudges !== undefined)) {
        const want = c.expect_nudges as number;
        it(`${c.class}: every prompt fires exactly ${String(want)} nudge(s)`, () => {
            for (const prompt of c.prompts) {
                const fired = firedNudges(prompt);
                expect(
                    fired.length,
                    `class '${c.class}' records ${String(want)} nudge(s); [${fired.join(', ')}] ` +
                        `fired on: ${prompt}. A suppression that lowers this must update the corpus.`,
                ).toBe(want);
            }
        });
    }
});

describe('nudge-interference — the assertion has teeth', () => {
    // The verify clause is "fails when a second nudge is forced". The classes
    // above cover the real path; these exercise the CHECK, so a refactor that
    // made every class vacuously green would be caught here.
    it('capViolations reports a forced double-fire under a single-nudge cap', () => {
        const overlap = corpus.classes.find((c) => (c.expect_nudges ?? 0) === 2);
        expect(overlap).toBeDefined();
        const forced = capViolations(1, overlap!.prompts);
        // Every overlap prompt violates a cap of 1 — that is what makes the
        // ≤1 classes above meaningful rather than untested.
        expect(forced).toHaveLength(overlap!.prompts.length);
        expect(forced[0]).toContain('delegation-nudge');
        expect(forced[0]).toContain('skill-route');
    });

    it('capViolations stays silent when the cap is satisfied', () => {
        const overlap = corpus.classes.find((c) => (c.expect_nudges ?? 0) === 2);
        expect(capViolations(2, overlap!.prompts)).toEqual([]);
    });

    it('the runner distinguishes fire from silence', () => {
        expect(firedNudges('ok')).toEqual([]);
        expect(firedNudges('Set up Terraform state locking for the staging bucket')).toEqual([
            'skill-route',
        ]);
    });

    it('a crashing nudge is a failure, not a silence', () => {
        // Guards the finding directly: the registry key is looked up by name, so
        // an unmapped one must throw rather than read as "did not fire".
        expect(() => nudgeFires('src/scripts/hooks/does_not_exist_hook.ts', 'x')).toThrow(
            /CONCERN_REGISTRY/,
        );
    });
});
