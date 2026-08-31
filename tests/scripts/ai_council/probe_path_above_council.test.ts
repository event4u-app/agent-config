/**
 * The deterministic/probe path stays ABOVE council — step 7.3.
 *
 * The step's `verify:` is *"a probe-resolvable fixture never enters the
 * selector"*. **No selector exists**: 7.2 is open and there is no
 * `topology_selector.ts` anywhere in the tree. So the constraint cannot be
 * exercised under real topology selection, and the step is carried as
 * `guarded-baseline` rather than closed.
 *
 * What IS assertable today is the stronger half of the same property, one layer
 * up: `classifyLadder` (`src/scripts/_lib/judgment_ladder.ts:342`) checks rung 0
 * BEFORE the rung-4 council signal, so a probe-resolvable question never
 * resolves to `council` at all — and a question that never reaches the council
 * rung cannot reach a council-INTERNAL selector, whatever that selector turns
 * out to be.
 *
 * Non-vacuity is tested three ways, because "never reaches council" is trivially
 * true if nothing reaches council: an adversarial set that carries a real
 * contested-judgment phrase AND a probe signal, a contrast set that genuinely
 * resolves to rung 4, and a tripwire that reds when a selector lands.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { classifyLadder, detectContestedJudgment } from '../../../src/scripts/_lib/judgment_ladder.js';
import type { LadderInputs } from '../../../src/scripts/_lib/judgment_ladder.js';

const REPO_ROOT = path.resolve(__dirname, '../../..');
const FIXTURE_REL = 'internal/bench/council-topology/probe-resolvable-fixtures.json';

interface Fixtures {
    readonly permanent: boolean;
    readonly probe_resolvable: readonly { kind: string; text: string }[];
    readonly probe_resolvable_carrying_a_council_signal: readonly { text: string }[];
    readonly genuinely_contested: readonly { text: string }[];
}

const FIXTURES = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, FIXTURE_REL), 'utf8')) as Fixtures;

/** Maximally permissive inputs: nothing else may explain a non-council verdict. */
function ladder(taskText: string): ReturnType<typeof classifyLadder> {
    return classifyLadder({
        taskText,
        activation: { halted: false, subagent_spawn: true },
        signals: {},
        agentTeams: true,
    } as unknown as LadderInputs);
}

describe('7.3 — a probe-resolvable question never reaches the council rung', () => {
    it('resolves every probe-resolvable fixture to rung 0 / script', () => {
        expect(FIXTURES.probe_resolvable.length).toBeGreaterThanOrEqual(8);
        for (const f of FIXTURES.probe_resolvable) {
            const r = ladder(f.text);
            expect({ text: f.text, rung: r.rung, verdict: r.verdict }).toEqual({
                text: f.text,
                rung: 0,
                verdict: 'script',
            });
        }
    });

    it('covers all four kinds the step names — tree fact, schema, script, executable test', () => {
        expect(new Set(FIXTURES.probe_resolvable.map((f) => f.kind))).toEqual(
            new Set(['tree-fact', 'schema', 'script', 'executable-test']),
        );
    });

    it('rung 0 OUTRANKS the council signal — a probe question carrying one still resolves to script', () => {
        // This is the assertion that makes the property non-trivial: each of
        // these texts genuinely fires detectContestedJudgment, and the ladder
        // still returns script because rung 0 is checked first
        // (judgment_ladder.ts:353-361 precede :380-383).
        for (const f of FIXTURES.probe_resolvable_carrying_a_council_signal) {
            expect(detectContestedJudgment(f.text).matched).toBe(true);
            const r = ladder(f.text);
            expect({ text: f.text, verdict: r.verdict }).toEqual({ text: f.text, verdict: 'script' });
        }
    });

    it('NON-VACUITY — the contrast set DOES resolve to rung 4 / council', () => {
        for (const f of FIXTURES.genuinely_contested) {
            const r = ladder(f.text);
            expect({ text: f.text, rung: r.rung, verdict: r.verdict }).toEqual({
                text: f.text,
                rung: 4,
                verdict: 'council',
            });
        }
    });
});

describe('the fixture set is permanent and citable', () => {
    it('declares permanent: true and lives at a stable path', () => {
        expect(FIXTURES.permanent).toBe(true);
        expect(fs.existsSync(path.join(REPO_ROOT, FIXTURE_REL))).toBe(true);
    });
});

describe('the tripwire — this baseline expires when a selector lands', () => {
    it('no topology selector exists anywhere under src/', () => {
        // RED the day 7.2 lands a selector. At that point "never reaches the
        // council rung" stops being sufficient and the fixtures must be run
        // against the real selector entry point.
        const hits: string[] = [];
        const walk = (dir: string): void => {
            for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
                const abs = path.join(dir, e.name);
                if (e.isDirectory()) {
                    if (e.name !== 'node_modules') walk(abs);
                    continue;
                }
                if (/topology[_-]?selector/i.test(e.name)) hits.push(path.relative(REPO_ROOT, abs));
                else if (e.name.endsWith('.ts') && /\bselectTopology\b/.test(fs.readFileSync(abs, 'utf8'))) {
                    hits.push(path.relative(REPO_ROOT, abs));
                }
            }
        };
        walk(path.join(REPO_ROOT, 'src'));
        expect(hits).toEqual([]);
    });

    it('DENIAL — the tripwire scanner finds a real match, so an empty result means "absent"', () => {
        // Proves the scanner is not vacuously empty: the same filename predicate
        // and the same symbol predicate both fire on constructed inputs.
        expect(/topology[_-]?selector/i.test('topology_selector.ts')).toBe(true);
        expect(/topology[_-]?selector/i.test('topologySelector.ts')).toBe(true);
        expect(/\bselectTopology\b/.test('export function selectTopology(x: T) {')).toBe(true);
        expect(/\bselectTopology\b/.test('export function selectChairman(x: T) {')).toBe(false);
    });
});
