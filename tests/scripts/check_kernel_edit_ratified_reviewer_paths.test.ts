import { describe, expect, it } from 'vitest';

import {
    classifyPaths,
    isMechanismPath,
    REVIEWER_PATHS,
    requiresRatification,
} from '../../src/scripts/check_kernel_edit_ratified.js';
import { gatedFilesOf } from '../../src/scripts/_lib/ratification_subject.js';

/**
 * Step 4.1 residue of `road-to-self-modification-that-a-council-must-pass`.
 *
 * The gate watches itself, its reader, its policy, its workflow, the anchor and
 * the modules of its own import closure. It did NOT watch the two modules that
 * decide what the council is asked and what its answers add up to — the
 * question list and the verdict rule — because the gate does not import them
 * and the import-closure criterion of 2026-10-15 therefore never reached them.
 * A change to either is a change to the reviewer.
 *
 * The polarity half is the part that earns its place: the rest of
 * `src/scripts/ai_council/` stays ungated on purpose. Gating prompts and
 * transports would price every routine council edit at the rate of a governance
 * change, which is the pressure that eventually weakens a gate. If the
 * rejecting block below ever goes green, that boundary has been undone.
 */

describe('the review mechanism is inside the gated surface', () => {
    it('watches the question list and the verdict rule', () => {
        expect([...REVIEWER_PATHS].sort()).toEqual([
            'src/scripts/ai_council/modification_review.ts',
            'src/scripts/ai_council/modification_review_questions.ts',
        ]);
    });

    for (const p of [
        'src/scripts/ai_council/modification_review_questions.ts',
        'src/scripts/ai_council/modification_review.ts',
    ]) {
        it(`classifies ${p} as the mechanism itself`, () => {
            expect(isMechanismPath(p)).toBe(true);
            const gated = classifyPaths([p], []);
            expect(gated.self).toBe(true);
            expect(requiresRatification(gated)).toBe(true);
        });

        it(`covers ${p} with the subject digest, not only with the refusal`, () => {
            // A path the gate refuses but the digest does not cover is bound by
            // no record: the refusal names it and the `subject` says nothing
            // about its bytes. Both limbs or neither.
            expect(gatedFilesOf([p], [])).toContain(p);
        });
    }

    // Polarity. Each of these is an ordinary council edit and must stay free.
    for (const p of [
        'src/scripts/ai_council/prompts.ts',
        'src/scripts/ai_council/stance_tally.ts',
        'src/scripts/ai_council/quorum.ts',
        'src/scripts/ai_council/council_cli.ts',
        'src/scripts/ai_council/chairman.ts',
        'tests/scripts/check_kernel_edit_ratified_reviewer_paths.test.ts',
    ]) {
        it(`leaves ${p} ungated`, () => {
            expect(isMechanismPath(p)).toBe(false);
            const gated = classifyPaths([p], []);
            expect(gated.self).toBe(false);
            expect(requiresRatification(gated)).toBe(false);
        });
    }

    it('leaves an ordinary council change with nothing to ratify at all', () => {
        const gated = classifyPaths(
            ['src/scripts/ai_council/prompts.ts', 'src/scripts/ai_council/clients.ts'],
            [],
        );
        expect(requiresRatification(gated)).toBe(false);
    });

    /**
     * The contract and the writer CLIs are deliberately NOT here. Step 4.1 as
     * drafted named `docs/contracts/ratification-artifact.md`; the gate's own
     * header records an owner decision of 2026-10-15 keeping the contract and
     * the writer CLIs outside, and an agent is not the one who reopens that.
     * Pinned so the omission reads as a decision rather than as an oversight.
     */
    it('keeps the contract outside, per the owner decision of 2026-10-15', () => {
        expect(isMechanismPath('docs/contracts/ratification-artifact.md')).toBe(false);
        expect(isMechanismPath('src/scripts/ratification_subject.ts')).toBe(false);
        expect(isMechanismPath('src/scripts/ratification_header.ts')).toBe(false);
    });
});
