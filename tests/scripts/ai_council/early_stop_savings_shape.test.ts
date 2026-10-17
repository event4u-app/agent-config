/**
 * Early-stop savings — the reporting-shape baseline for step 10.6.
 *
 * Step 10.6 says *"track early-stop savings separately from quality"* and
 * verifies *"cost and quality are never reported as one number"*. Two facts
 * about the tree shape this file:
 *
 *   1. **Early stops now happen, and nothing counts them.** `evaluateStop`
 *      (`src/scripts/ai_council/argument_exhaustion.ts:82`) has one production
 *      caller, the analysis gain gate (`src/scripts/analysis_gate.ts`), which
 *      WITHHOLDS a further round when the verdict says the arguments are
 *      exhausted. Whether a withheld round counts as a saved call — and where
 *      it would be reported — is an OPEN OWNER DECISION, recorded under step
 *      2.6 of the roadmap `road-to-an-analysis-family-that-deepens-itself`
 *      (council test review of PR #2432, 2026-10-17). Until it is decided, this
 *      file does not claim savings are zero; it pins only what the gate does.
 *   2. **The reporting surface that WOULD carry it already exists**:
 *      `StopRender` / `renderStop` (`:113`, `:121`). The gate does not use it,
 *      so its shape is pinned here on its own.
 *
 * So this file is a BASELINE, not a discharge. It asserts the separation holds
 * in the surface that exists, pins what the gate does on an exhausted verdict,
 * and goes RED the day a further production caller arrives — the recheck this
 * step needs, stronger than a prose reminder to look again.
 *
 * Every assertion is over source text or a pure function. No provider call, no
 * network, no corpus.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { renderStop } from '../../../src/scripts/ai_council/argument_exhaustion.js';
import type { StopInputs, StopRender } from '../../../src/scripts/ai_council/argument_exhaustion.js';
import { evaluateGate, type GateInput, type OpenItem } from '../../../src/scripts/analysis_gate.js';

const REPO_ROOT = path.resolve(__dirname, '../../..');
const MODULE_REL = 'src/scripts/ai_council/argument_exhaustion.ts';
const MODULE_SRC = fs.readFileSync(path.join(REPO_ROOT, MODULE_REL), 'utf8');

/**
 * Words that name a QUALITY judgement. A cost surface carrying one of these is
 * the failure 10.6 forbids: cost and quality collapsed into one reported thing.
 *
 * `savedCostUsd` / `savedCalls` are cost and are deliberately absent from the
 * list; `score`, `grade`, `quality`, `accuracy`, `correctness`, `efficiency`
 * and `per_dollar`-style ratios are the quality half, and a RATIO of the two is
 * the single worst case because it is literally one number.
 */
const QUALITY_TERMS = [
    'quality',
    'score',
    'grade',
    'accuracy',
    'correctness',
    'nonInferior',
    'non_inferior',
];

/** A blended metric — one number carrying both halves. */
const BLEND_TERMS = ['perDollar', 'per_dollar', 'perCall', 'per_call', 'costAdjusted', 'cost_adjusted', 'qualityPerCost'];

/** Every `.ts` under `src/` that imports the exhaustion module, excluding the module itself. */
function importersUnderSrc(): string[] {
    const hits: string[] = [];
    const walk = (dir: string): void => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const abs = path.join(dir, e.name);
            if (e.isDirectory()) {
                if (e.name === 'node_modules') continue;
                walk(abs);
                continue;
            }
            if (!e.name.endsWith('.ts')) continue;
            const rel = path.relative(REPO_ROOT, abs);
            if (rel === MODULE_REL) continue;
            const text = fs.readFileSync(abs, 'utf8');
            if (/from\s+['"][^'"]*argument_exhaustion(?:\.js)?['"]/.test(text)) hits.push(rel);
        }
    };
    walk(path.join(REPO_ROOT, 'src'));
    return hits.sort();
}

const SAMPLE: StopRender = {
    roundsCompleted: 3,
    roundsConfigured: 5,
    savedCalls: 4,
    savedCostUsd: 0.1234,
    exhaustedMembers: ['anthropic/a', 'openai/b'],
};

describe('the production caller, and the tripwire on it', () => {
    it('evaluateStop has exactly the known production importers', () => {
        // A dependency check, not a savings claim. RED the day another caller wires
        // the predicate in — re-read this file's premise then, because every new
        // caller is a new place an early stop can happen without being counted.
        expect(importersUnderSrc()).toEqual(['src/scripts/analysis_gate.ts']);
    });

    it('the analysis gate withholds a round on an exhausted verdict and offers one otherwise', () => {
        const stillArguing: StopInputs = { roundsCompleted: 1, dissentRepairAttempted: true, selfNearDuplicate: [false, false], unresolvedAdversarialTriggers: 0 };
        const exhausted: StopInputs = { roundsCompleted: 2, dissentRepairAttempted: true, selfNearDuplicate: [true, true], unresolvedAdversarialTriggers: 0 };
        const item: OpenItem = { id: 'c1', kind: 'conflict', plan: { executable: true, estimated_tokens: 100, step: 'run the fixture' } };
        const base: GateInput = { roundsCompleted: 1, items: [item], remainingTokens: 10_000, stop: stillArguing };

        const offered = evaluateGate(base);
        expect(offered).toMatchObject({ offer: true, reason: 'offer', settleable: ['c1'] });

        // This is the early stop: the same open item, a round withheld because of
        // `evaluateStop`. Whether it is a saved call is the open owner decision.
        const withheld = evaluateGate({ ...base, stop: exhausted });
        expect(withheld).toMatchObject({ offer: false, reason: 'exhausted', settleable: [] });
        expect(withheld.stop?.stop).toBe(true);

        // What the gate reports today: no saved-call or saved-cost figure, in
        // either case — absence of attribution, pinned so a change to it is seen.
        const SAVINGS_FIELDS = ['savedCalls', 'savedCostUsd', 'saved_calls', 'saved_cost_usd'];
        for (const r of [offered, withheld]) {
            for (const f of SAVINGS_FIELDS) expect(Object.keys(r)).not.toContain(f);
        }
    });

    it('the module is pure — it opens no file and issues no call', () => {
        expect(MODULE_SRC).not.toMatch(/require\(|from ['"]node:fs['"]|from ['"]node:https?['"]|fetch\(/);
    });
});

describe('cost and quality are never reported as one number', () => {
    it('StopRender carries only cost figures — no quality field exists to blend', () => {
        expect(Object.keys(SAMPLE).sort()).toEqual(
            ['exhaustedMembers', 'roundsCompleted', 'roundsConfigured', 'savedCalls', 'savedCostUsd'].sort(),
        );
        for (const term of QUALITY_TERMS) {
            expect(Object.keys(SAMPLE).join(' ').toLowerCase()).not.toContain(term.toLowerCase());
        }
    });

    it('the rendered report names calls and cost as two separate figures', () => {
        const out = renderStop(SAMPLE);
        expect(out).toContain('saved: 4 call(s), $0.1234');
        // Two units on one line is not one number: a reader can take either
        // half away on its own, which is what "reported separately" means.
        expect(out).toMatch(/\d+ call\(s\)/);
        expect(out).toMatch(/\$\d+\.\d{4}/);
    });

    it('the rendered report carries no quality term and no blended metric', () => {
        const out = renderStop(SAMPLE).toLowerCase();
        for (const term of [...QUALITY_TERMS, ...BLEND_TERMS]) {
            expect(out).not.toContain(term.toLowerCase());
        }
    });

    it('the module source declares no quality field and no blended metric', () => {
        const src = MODULE_SRC.toLowerCase();
        for (const term of BLEND_TERMS) expect(src).not.toContain(term.toLowerCase());
        // `quality` etc. may legitimately appear in PROSE; the assertion is over
        // declared identifiers, so comments are stripped first.
        const code = MODULE_SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '').toLowerCase();
        for (const term of QUALITY_TERMS) expect(code).not.toContain(term.toLowerCase());
    });

    it('the stopped run is textually distinguishable from a full one (6.4 carried forward)', () => {
        const out = renderStop(SAMPLE);
        expect(out).toContain('STOPPED EARLY');
        expect(out).toContain('NOT a full run');
    });
});

describe('DENIAL — the detectors fire on a real violation', () => {
    it('a blended metric in a rendered line IS caught', () => {
        const violating = 'council: STOPPED EARLY — saved 4 calls at qualityPerCost 0.82';
        const hit = [...QUALITY_TERMS, ...BLEND_TERMS].some((t) =>
            violating.toLowerCase().includes(t.toLowerCase()),
        );
        expect(hit).toBe(true);
    });

    it('a quality field added to the render shape IS caught', () => {
        const violating = { ...SAMPLE, qualityScore: 0.9 } as Record<string, unknown>;
        const hit = QUALITY_TERMS.some((t) => Object.keys(violating).join(' ').toLowerCase().includes(t.toLowerCase()));
        expect(hit).toBe(true);
    });

    it('an ordinary cost-only line is NOT caught, so a clean pass means "nothing there"', () => {
        const ok = 'saved: 4 call(s), $0.1234';
        const hit = [...QUALITY_TERMS, ...BLEND_TERMS].some((t) => ok.toLowerCase().includes(t.toLowerCase()));
        expect(hit).toBe(false);
    });

    it('the importer scan finds a real importer, so an empty result means "no caller"', () => {
        // Proves the scanner is not vacuously empty: it does find the module's
        // own test-side import shape when pointed at a directory containing one.
        const testSrc = fs.readFileSync(path.join(REPO_ROOT, 'tests/scripts/argument_exhaustion.test.ts'), 'utf8');
        expect(/from\s+['"][^'"]*argument_exhaustion(?:\.js)?['"]/.test(testSrc)).toBe(true);
    });
});
