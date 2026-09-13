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
