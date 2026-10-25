import { describe, expect, it } from 'vitest';

import {
    classifyPaths,
    isMechanismPath,
    REVIEWER_PATHS,
    requiresRatification,
} from '../../src/scripts/check_kernel_edit_ratified.js';
import { gatedFilesOf } from '../../src/scripts/_lib/ratification_subject.js';

/**
 * Step 4.1 of `road-to-self-modification-that-a-council-must-pass`: the modules
 * that decide what the review asks, what its answers add up to and what record
 * it leaves are a change to the reviewer. The polarity half pins the boundary —
 * the rest of the council stays ungated, so a routine council edit has nothing
 * to ratify.
 */

const REVIEWER = [
    'src/scripts/_lib/ratification_record_writer.ts',
    'src/scripts/ai_council/modification_review.ts',
    'src/scripts/ai_council/modification_review_questions.ts',
    'src/scripts/ai_council/stance_tally.ts',
];

describe('the review mechanism is inside the gated surface', () => {
    it('watches exactly the deciding modules and the writer', () => {
        expect([...REVIEWER_PATHS].sort()).toEqual(REVIEWER);
    });

    for (const p of REVIEWER) {
        it(`classifies ${p} as the mechanism itself`, () => {
            expect(isMechanismPath(p)).toBe(true);
            const gated = classifyPaths([p], []);
            expect(gated.self).toBe(true);
            expect(requiresRatification(gated)).toBe(true);
        });

        it(`covers ${p} with the subject digest, not only with the refusal`, () => {
            expect(gatedFilesOf([p], [])).toContain(p);
        });
    }

    for (const p of [
        'src/scripts/ai_council/prompts.ts',
        'src/scripts/ai_council/quorum.ts',
        'src/scripts/ai_council/council_cli.ts',
        'src/scripts/ai_council/chairman.ts',
        'src/scripts/ratification_record.ts',
        'tests/scripts/check_kernel_edit_ratified_reviewer_paths.test.ts',
    ]) {
        it(`leaves ${p} ungated`, () => {
            expect(isMechanismPath(p)).toBe(false);
            expect(requiresRatification(classifyPaths([p], []))).toBe(false);
        });
    }

    it('leaves an ordinary council change with nothing to ratify at all', () => {
        const gated = classifyPaths(
            ['src/scripts/ai_council/prompts.ts', 'src/scripts/ai_council/clients.ts'],
            [],
        );
        expect(requiresRatification(gated)).toBe(false);
    });

    it('keeps the contract and the writer CLIs outside, per the owner decision of 2026-10-15', () => {
        expect(isMechanismPath('docs/contracts/ratification-artifact.md')).toBe(false);
        expect(isMechanismPath('src/scripts/ratification_subject.ts')).toBe(false);
        expect(isMechanismPath('src/scripts/ratification_header.ts')).toBe(false);
    });
});
