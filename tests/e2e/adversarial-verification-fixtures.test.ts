/**
 * `T1`-`T10`, `G8`, `G9` — the fixture set of
 * `road-to-adversarial-verification-and-long-runs`, AC-1.
 *
 * **Why these live under `tests/e2e/` as `.test.ts` and not `.spec.ts`.** The
 * acceptance criterion names this directory, and the directory already holds
 * Playwright specs that boot a server. These fixtures boot nothing — they are
 * assertions over pure decisions and over the tree's own artefacts — so they are
 * written as vitest tests, which `playwright.config.ts` ignores (`testMatch:
 * '**​/*.spec.ts'`) and `vitest.config.ts` collects (`include:
 * ['tests/**​/*.test.{ts,tsx}']`). One directory, two harnesses, no overlap, and
 * the fixtures run on every CI test job rather than only where browsers exist.
 *
 * **What a fixture here is allowed to be.** Each one pins a decision a shipped
 * mechanism makes, in the direction the mechanism could plausibly have gone
 * wrong. A fixture that restates an implementation line is not evidence; a
 * fixture that would pass against a deliberately broken implementation is the
 * tautology Phase 2.3 exists to catch, and writing one here would be writing the
 * defect this roadmap is named after.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    DELIVERY_ENDINGS,
    MAX_ITERATIONS,
    WALL_CLOCK_CAP_MS,
    deliveryBlocksCompletion,
    ladder,
    type LadderState,
} from '../../src/scripts/_lib/continuation_ladder.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel: string): string => fs.readFileSync(path.join(REPO, rel), 'utf8');
/**
 * The same text with every run of whitespace collapsed to one space.
 *
 * Prose files wrap, so a phrase the author wrote as one sentence reaches a
 * naive regex split across a newline. Matching against the flattened form asserts
 * the CLAIM is present; matching against the raw form would additionally assert
 * where the author happened to break the line, which is not a contract.
 */
const flat = (rel: string): string => read(rel).replace(/\s+/g, ' ');

describe('Phase 1.1 — the test-first rule', () => {
    const RULE = 'src/rules/test-first.md';

    it('exists and is at most 40 lines, the bound the step set', () => {
        const lines = read(RULE).split('\n');
        // A trailing newline yields one empty final element; the file's own line
        // count is what `wc -l` reports, so drop it before comparing.
        const count = lines[lines.length - 1] === '' ? lines.length - 1 : lines.length;
        expect(count).toBeLessThanOrEqual(40);
    });

    it('routes to the existing skill rather than duplicating it (K7)', () => {
        expect(read(RULE)).toContain('skill:test-driven-development');
    });

    it('carries all four obligations, not just the happy one', () => {
        const body = flat(RULE);
        for (const obligation of [
            'FAILING TEST FIRST',
            'REGRESSION TEST FIRST',
            'CHARACTERISATION TEST FIRST',
            'FAIL FOR THE INTENDED REASON',
        ]) {
            expect(body).toContain(obligation);
        }
    });

    it('carries NO carve-out excusing this package because the artefact is markdown', () => {
        const body = flat(RULE);
        // The step's own acceptance clause. The rule must NAME the escape and
        // refuse it — a rule that is merely silent on it would pass a "does not
        // contain the word markdown" check while leaving the escape open.
        expect(body).toMatch(/markdown/i);
        expect(body).toMatch(/Markdown is not the discriminator/);
        expect(body).toMatch(/projection, routing or lint behaviour is testable/);
    });

    it('says what to do where there is genuinely nothing executable', () => {
        expect(flat(RULE)).toMatch(/independent \*review\*, never a fake test/);
    });
});

describe('T3 — ten failed fixes produce strategy changes, never an owner ask', () => {
    const MECHANICS = 'src/agent-src/contexts/execution/autonomy-mechanics.md';
    const RULE = 'src/rules/autonomous-execution.md';

    it('no rule under src/rules still states the N=3 cap — except the kernel one', () => {
        // The step's literal criterion is `grep -rn 'N=3' src/rules` returning 0.
        // It returns ONE, and the one is `verify-before-complete.md`, which
        // `block_kernel_rule_writes` refuses every agent write to. Asserting zero
        // would make this fixture red on a change no agent can make; asserting
        // "only the kernel file" keeps the obligation and names why it stops there
        // — and it still fails the moment a NON-kernel rule reintroduces the cap.
        const dir = path.join(REPO, 'src', 'rules');
        const offenders = fs
            .readdirSync(dir)
            .filter((f) => f.endsWith('.md'))
            .filter((f) => read(path.join('src', 'rules', f)).includes('N=3'));
        expect(offenders).toEqual(['verify-before-complete.md']);
    });

    it('the bound is a setting with a default of 10, not a literal 3', () => {
        const body = flat(RULE);
        expect(body).toMatch(/execution\.fix_loop_max/);
        expect(body).toMatch(/default 10/);
    });

    it('names all three bands with their required behaviour', () => {
        const body = flat(RULE);
        expect(body).toMatch(/ATTEMPTS 1-3 — ROOT-CAUSE/);
        expect(body).toMatch(/ATTEMPTS 4-6 — A MANDATORY STRATEGY SHIFT/);
        expect(body).toMatch(/ATTEMPTS 7-10 — ESCALATE INDEPENDENTLY/);
    });

    it('maps no rung from a count to an owner ask', () => {
        const body = flat(RULE);
        expect(body).toMatch(/THE BOUND TRIGGERS A STRATEGY CHANGE, NEVER A QUESTION/);
        expect(body).toMatch(/A COUNT IS NOT A REASON TO ASK/);
        // The old remedy, gone. This is the assertion that would fail if the
        // section were reverted while the new prose was merely appended beside it.
        expect(body).not.toMatch(/ASK USER FOR GUIDANCE/);
        expect(body).not.toMatch(/DO NOT ITERATE BEYOND/);
    });

    it('the mechanics file carries all five bound outcomes, owner-ask third', () => {
        const body = flat(MECHANICS);
        expect(body).toMatch(/new epoch/);
        expect(body).toMatch(/An independent phase can proceed/);
        expect(body).toMatch(/The residue is owner-owned/);
        expect(body).toMatch(/An external prerequisite is objectively missing/);
        // The owner rung is reached by the OWNERSHIP test, never by the count.
        expect(body).toMatch(/reached by the OWNERSHIP test, never by the count/);
    });

    it('keeps the allowlist-growth counter a separate mechanism', () => {
        expect(flat(MECHANICS)).toMatch(
            /allowlist-growth counter is a separate mechanism/,
        );
        expect(flat(RULE)).toMatch(/stays a \*\*separate\*\* mechanism/);
    });
});

describe('T7 / T8 — a run cannot end with red CI while its checkboxes read complete', () => {
    const base = (over: Partial<LadderState> = {}): LadderState => ({
        iterations: 1,
        started_at: new Date().toISOString(),
        history: [],
        ...over,
    });

    it('T7 — zero open, delivery not reached: the run does NOT end', () => {
        for (const pos of ['pushed', 'pr-open', 'ci-pending', 'ci-red', 'target-moved'] as const) {
            expect(ladder(base(), 0, Date.now(), 0, undefined, null, false, pos)).toBe('engage');
        }
    });

    it('T8 — no grant, PR open and green: the run ENDS, and open-green is the ending', () => {
        expect(ladder(base(), 0, Date.now(), 0, undefined, null, false, 'open-green')).toBe(
            'complete',
        );
        expect(ladder(base(), 0, Date.now(), 0, undefined, null, false, 'merged')).toBe(
            'complete',
        );
        expect(DELIVERY_ENDINGS).toEqual(['merged', 'open-green']);
    });

    it('an unrecorded delivery position decides exactly as before — fail-open', () => {
        // The ladder runs on the Stop path where a `gh` probe is unaffordable, so
        // an absent position means "this run does not report delivery", never
        // "delivery is incomplete". Inventing the latter would hang every run
        // that never adopted the field.
        expect(deliveryBlocksCompletion(null)).toBe(false);
        expect(deliveryBlocksCompletion(undefined)).toBe(false);
        expect(ladder(base(), 0, Date.now(), 0)).toBe('complete');
        expect(ladder(base(), 0, Date.now(), 0, undefined, null, false, null)).toBe('complete');
    });

    it('delivery never overrides `blocked` — blocked work is not undelivered work', () => {
        expect(ladder(base(), 0, Date.now(), 2, undefined, null, false, 'ci-red')).toBe(
            'blocked',
        );
    });

    it('a delivery hold is still BOUNDED — iterations and the wall clock apply', () => {
        expect(
            ladder(
                base({ iterations: MAX_ITERATIONS }),
                0,
                Date.now(),
                0,
                undefined,
                null,
                false,
                'ci-red',
            ),
        ).toBe('halt-max-iterations');
        const old = new Date(Date.now() - WALL_CLOCK_CAP_MS - 1000).toISOString();
        expect(
            ladder(base({ started_at: old }), 0, Date.now(), 0, undefined, null, false, 'ci-red'),
        ).toBe('halt-wall-clock');
    });

    it('the stall rung is exempt during delivery — zero open cannot move', () => {
        // Three consecutive zero-open readings is what a healthy CI-fix loop looks
        // like. Tripping halt-stall on it is a stall manufactured by the stall
        // detector; the caps above are what bound this loop instead.
        const stalled = base({ iterations: 4, history: [0, 0, 0] });
        expect(ladder(stalled, 0, Date.now(), 0, undefined, null, false, 'ci-red')).toBe('engage');
        // …and the rung is NOT disabled generally: with steps still open, it fires.
        expect(
            ladder(base({ iterations: 4, history: [3, 3, 3] }), 3, Date.now(), 0),
        ).toBe('halt-stall');
    });

    it('a halt already stamped still wins over a delivery hold', () => {
        expect(
            ladder(base({ halted: 'halt-stall' }), 0, Date.now(), 0, undefined, null, false, 'ci-red'),
        ).toBe('halt-stall');
    });
});

describe('8.2 — the PR body is one page for the owner', () => {
    const CMD = 'src/domains/product-basic/roadmap/process-full/command.md';

    it('names all six sections the end-of-run body must carry', () => {
        const body = flat(CMD);
        for (const section of [
            'Delivery target reached',
            'Decisions taken, and by whom',
            'Open owner-owned residue',
            'Scope delta',
            'Spend',
            'Fix-loop epochs',
        ]) {
            expect(body).toContain(section);
        }
    });

    it('states the delivery machine and both of its endings', () => {
        const body = flat(CMD);
        expect(body).toMatch(/delivery-ready → \(grant → merged \| no grant → open-green\)/);
        expect(body).toMatch(/`open-green` is a success, not a shortfall/);
    });

    it('ties `complete` to delivery, not to the checkbox count alone', () => {
        expect(flat(CMD)).toMatch(
            /`count_open == 0`, the PR is open, and delivery reached an ending/,
        );
    });
});

describe('Phase 4.2 — read the red before diagnosing it', () => {
    it('process-full never reaches for `gh pr checks --watch`', () => {
        const cmd = read('src/domains/product-basic/roadmap/process-full/command.md');
        expect(cmd.split('gh pr checks --watch').length - 1).toBe(0);
    });

    it("the ladder's own text names ci_settle and the --log-failed read", () => {
        const body = flat('src/agent-src/contexts/execution/autonomy-mechanics.md');
        expect(body).toMatch(/`ci_settle`/);
        expect(body).toMatch(/--log-failed/);
        // The two traps that make the naive read wrong, not just the tool name.
        expect(body).toMatch(/LAST OUTPUT LINE is the verdict/);
        expect(body).toMatch(/exit code, which is 0 on a failure/);
    });
});
