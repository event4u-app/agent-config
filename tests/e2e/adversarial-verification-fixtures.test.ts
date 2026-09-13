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
