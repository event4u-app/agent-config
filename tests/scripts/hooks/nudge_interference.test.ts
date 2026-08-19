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

/** Run one nudge against one prompt; true when it injected anything. */
function nudgeFires(script: string, prompt: string): boolean {
    const main = CONCERN_REGISTRY[script];
    if (main === undefined) throw new Error(`not in CONCERN_REGISTRY: ${script}`);
    let out = '';
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
    } catch {
        /* a crashing concern injects nothing — the latency/parity suites own crashes */
    } finally {
        process.stdout.write = prevOut;
        process.stderr.write = prevErr;
        if (prevReplay === undefined) delete process.env['AGENT_CONFIG_REPLAY'];
        else process.env['AGENT_CONFIG_REPLAY'] = prevReplay;
        clearHookStdinOverride();
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
            for (const prompt of c.prompts) {
                const fired = firedNudges(prompt);
                expect(
                    fired.length,
                    `class '${c.class}' allows at most ${String(cap)} nudge(s) but ` +
                        `[${fired.join(', ')}] fired on: ${prompt}`,
                ).toBeLessThanOrEqual(cap);
            }
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
    // above cover the real path; this covers the mechanism directly, so a future
    // refactor of `firedNudges` cannot quietly make every class vacuously green.
    it('a forced double-fire violates a max_nudges class', () => {
        const singles = corpus.classes.filter((c) => c.max_nudges === 1);
        expect(singles.length).toBeGreaterThan(0);
        const overlap = corpus.classes.find((c) => (c.expect_nudges ?? 0) === 2);
        expect(overlap).toBeDefined();
        // A prompt from the overlap class, judged under a single-nudge class's
        // cap: the same assertion the classes above run must reject it.
        const forced = firedNudges(overlap!.prompts[0] as string);
        expect(forced.length).toBe(2);
        expect(forced.length <= (singles[0]!.max_nudges as number)).toBe(false);
    });

    it('the runner distinguishes fire from silence', () => {
        expect(firedNudges('ok')).toEqual([]);
        expect(firedNudges('Set up Terraform state locking for the staging bucket')).toEqual([
            'skill-route',
        ]);
    });
});
