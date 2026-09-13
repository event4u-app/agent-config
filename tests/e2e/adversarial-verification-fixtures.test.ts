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
import { classify, findingFor } from '../../src/scripts/check_test_delta.js';
import {
    sameSessionTestFlag,
    touchesTestAndCode,
} from '../../src/scripts/hooks/evidence_independence.js';

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
        expect(count).toBeLessThanOrEqual(41);
    });

    it('routes to the existing skill rather than duplicating it (K7)', () => {
        expect(read(RULE)).toContain('skill:test-driven-development');
    });

    it('carries all four obligations, not just the happy one', () => {
        const body = flat(RULE);
        for (const obligation of [
            'FAILING TEST FIRST',
            'REGRESSION TEST FIRST',
            'CHARACTERIZATION TEST FIRST',
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
        expect(body).toMatch(/projection, routing or lint behavior is testable/);
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
        expect(flat(RULE)).toMatch(/allowlist-growth counter below stays a \*\*separate\*\* mechanism|spends the whole fix-loop bound for that target at once/);
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

describe('T2 / Phase 2 — tests are evaluators', () => {
    const RULE = 'src/rules/evaluator-independence.md';
    const MECH = 'docs/guidelines/agent-infra/evaluator-independence-mechanics.md';

    it('the rule carries a tests-are-evaluators section — D4 is closed', () => {
        expect(flat(RULE)).toMatch(/## Tests are evaluators/);
        expect(flat(RULE)).toMatch(/A TEST IS AN EVALUATOR/);
    });

    it('all five levels exist, L0 is fallback-only and L1 carries its warning', () => {
        const body = flat(RULE);
        for (const level of ['L0', 'L1', 'L2', 'L3', 'L4']) expect(body).toContain(level);
        expect(body).toMatch(/L0 same agent — \*\*fallback only\*\*/);
        // Risk 2 of the roadmap — L1 degrading to self-review while keeping the
        // name. The warning lives in the MECHANICS file: the rule was trimmed to
        // clear the per-spawn payload ratchet, and the obligation surface keeps
        // the level list while the argument for watching L1 moved with the rest
        // of the argument. Asserted where it actually is, not where it was.
        expect(flat(MECH)).toMatch(/the same model reviewing its own work/);
    });

    it('the level is read from the live provider count, not assumed', () => {
        expect(flat(RULE)).toMatch(/`agent-config council:status`'s live provider count/);
        expect(flat(RULE)).toMatch(/L3 or L4 wherever two providers are configured/);
    });

    it('T2 — every silent-weakening move is named, and the ladder does not end at the owner', () => {
        const body = flat(RULE);
        for (const move of [
            'WEAKENS AN ASSERTION',
            'DELETES, SKIPS OR XFAILS A',
            'LOWERS A THRESHOLD',
            'CHANGES FIXTURE SEMANTICS TO FIT THE CODE',
        ]) {
            expect(body).toContain(move);
        }
        expect(body).toMatch(
            /EVIDENCE → INDEPENDENT TEST REVIEW → COUNCIL OR TEAM → CHANGE ONLY AFTER AN INDEPENDENT VERDICT/,
        );
        expect(body).toMatch(/THE OWNER IS NOT THE ARBITER/);
    });

    it('the workflow keeps RED evidence between the author and the implementer', () => {
        expect(flat(MECH)).toMatch(
            /acceptance behaviour → INDEPENDENT AUTHOR → RED evidence → implementer → GREEN → INDEPENDENT VALIDATOR/,
        );
        expect(flat(MECH)).toMatch(/a test never shown red has unknown sensitivity/);
    });

    it('2.3 — the validator asks one question and is attributable', () => {
        const body = flat(MECH);
        expect(body).toMatch(/Would these tests fail under plausible wrong implementations\?/);
        for (const smell of [
            'tautologies',
            'algorithm duplication',
            'snapshot overuse',
            'missing boundary and error cases',
            'over-mocking',
            'expectations changed to fit the code',
            'a test never shown red',
        ]) {
            expect(body).toContain(smell);
        }
        expect(body).toMatch(/identity and provider go into the evidence/);
        // K3 — the cheap form ships; mutation infrastructure is not a prerequisite.
        expect(body).toMatch(/not\*\* mutation-testing infrastructure/);
    });
});

describe('G8 / G9 — the two test gates and the same-session flag', () => {
    it('G8 — a code change with no test delta is RED', () => {
        expect(findingFor(classify(['src/scripts/thing.ts']))).not.toBeNull();
    });

    it('G9 — test-first across two sessions is GREEN', () => {
        // The gate cannot see the session boundary; what it can see is that a
        // test arrived with the code, which is the mechanically decidable half.
        expect(findingFor(classify(['tests/a.test.ts', 'src/a.ts']))).toBeNull();
    });

    it('both gates are registered with CI-identical argv and a floor', () => {
        const ledger = read('src/config/gate-coverage.yml');
        for (const id of ['check_test_delta', 'check_test_weakening']) {
            expect(ledger).toMatch(new RegExp(`- id: ${id}\\n\\s+argv: \\["--quiet"\\]`));
        }
        // The same argv must appear in the workflow, or the row describes a
        // invocation CI does not make.
        const wf = read('.github/workflows/consistency.yml');
        expect(wf).toContain('./scripts-run src/scripts/check_test_delta --quiet');
        expect(wf).toContain('./scripts-run src/scripts/check_test_weakening --quiet');
    });

    it('the same-session flag fires on a commit and on nothing else', () => {
        expect(sameSessionTestFlag('git commit -m "x"')).not.toBeNull();
        expect(sameSessionTestFlag('git -C /x commit -am "y"')).not.toBeNull();
        expect(sameSessionTestFlag('git status')).toBeNull();
        expect(sameSessionTestFlag('npm test')).toBeNull();
        expect(sameSessionTestFlag(null)).toBeNull();
    });

    it('the flag names L0 as a permitted fallback rather than forbidding it', () => {
        const text = sameSessionTestFlag('git commit -m "x"') ?? '';
        expect(text).toMatch(/L0 is a permitted FALLBACK, not the default/);
        expect(text).toMatch(/evaluator-independence/);
    });

    it('it takes BOTH a test and a code path to flag — either alone is not L0', () => {
        expect(touchesTestAndCode(['tests/a.test.ts', 'src/a.ts'])).toBe(true);
        expect(touchesTestAndCode(['tests/a.test.ts'])).toBe(false);
        expect(touchesTestAndCode(['src/a.ts'])).toBe(false);
        expect(touchesTestAndCode([])).toBe(false);
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
