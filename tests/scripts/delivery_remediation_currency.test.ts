/**
 * The remediation a delivery gate PRINTS must name a mechanism that still exists.
 *
 * ## The defect this pins
 *
 * `check_standing_rule_delivery` and `routing_doctor` both told the reader to run
 * `agent-config install --layer=<global|project>` when two layers overlap. That is
 * layer suppression — the remedy ADR-226 declined for this repository and ADR-236
 * superseded with the partition. It is not merely out of date: a maintainer
 * following it could not fix the condition the gate was reporting, because the
 * partition is armed by `agent-config install` writing a host-layer fingerprint
 * into `installed.lock`, and nothing about `--layer` does that.
 *
 * ## Why the assertion is scoped to these two surfaces and NOT to `--layer` globally
 *
 * The obvious form of this test — "no CLI help anywhere may contain `--layer`" —
 * is wrong and would have to be reverted on first run: `install.ts` still OFFERS
 * that flag, and printing its own flag help is correct. The flag is not dead; the
 * ADVICE was. So the test names the two remediation strings and leaves the
 * installer's flag documentation alone. A test that fails for a true reason is
 * worth less than no test if the fix is to delete the test.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO = join(import.meta.dirname, '..', '..');

const SURFACES = [
    {
        file: 'src/scripts/check_standing_rule_delivery.ts',
        anchor: 'exceeds the ${budget.total_cap_tokens} cap',
    },
    {
        file: 'src/scripts/routing_doctor.ts',
        anchor: 'both rule layers active',
    },
] as const;

describe('delivery remediation currency', () => {
    for (const s of SURFACES) {
        const body = readFileSync(join(REPO, s.file), 'utf-8');

        it(`${s.file} still carries the overlap remediation it is being asserted about`, () => {
            // Vacuity guard: if the message moves or is renamed, the assertions
            // below would pass over a surface that no longer exists.
            expect(body).toContain(s.anchor);
        });

        it(`${s.file} does not offer layer suppression as the overlap remedy`, () => {
            // The string may still APPEAR as the superseded advice being named — what
            // must not appear is an imperative pointing at it.
            // `\\?` because these strings live inside template literals, where the
            // backtick is escaped in the SOURCE (`\\`agent-config …`). The first
            // version of this assertion omitted it, and a sabotage probe that
            // restored the old advice verbatim left all six tests green — a test
            // that cannot fail on the defect it names is worse than none.
            expect(body).not.toMatch(/run \\?`agent-config install --layer=/);
            expect(body).not.toMatch(/\\?`agent-config install --layer=<global\|project>\\?` suppresses/);
        });

        it(`${s.file} points at the partition instead`, () => {
            expect(body).toMatch(/ADR-236/);
            expect(body).toMatch(/installed\.lock|fingerprint/);
        });
    }
});
