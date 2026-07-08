/**
 * Step-plan contract tests (road-to-setup-experience § Phase 3.1).
 *
 * The consolidated plan: non-extended = 6 steps, extended = 10 steps.
 * Ids `identity` and `cost` stay stable — the install-mode
 * ContinueScreen, the rtk row, and the review ownership map anchor on
 * them. The server's DEFAULT/EXTENDED_TOTAL_STEPS constants mirror
 * these counts (tests/server/wizard.initialStep.test.ts).
 */
import { describe, expect, it } from 'vitest';
import { getWizardSteps, WIZARD_TOTAL_STEPS } from '../../src/ui/wizard/steps.js';

describe('wizard step plan (consolidated)', () => {
    it('non-extended flow has 6 steps', () => {
        const ids = getWizardSteps().map((s) => s.id);
        expect(ids).toEqual(['welcome', 'profile', 'identity', 'cost', 'user-md', 'review']);
        expect(WIZARD_TOTAL_STEPS).toBe(6);
    });

    it('extended flow has 10 steps with the install lead first', () => {
        const ids = getWizardSteps({ extended: true }).map((s) => s.id);
        expect(ids).toEqual([
            'welcome', 'profile', 'ai-tools', 'roles', 'packs',
            'legal-consent', 'identity', 'cost', 'user-md', 'review',
        ]);
    });

    it('setup landing index (6) is the identity step in extended mode', () => {
        // main.ts `setup` uses initialStep: extended ? 6 : 1 — keep in lockstep.
        const steps = getWizardSteps({ extended: true });
        expect(steps[6]?.id).toBe('identity');
        expect(getWizardSteps()[1]?.id).toBe('profile');
    });

    it('merged steps carry the union of the former per-step paths', () => {
        const byId = new Map(getWizardSteps().map((s) => [s.id, s]));
        expect(byId.get('identity')?.paths).toEqual(expect.arrayContaining([
            'personal.ide', 'personal.autonomy', 'personal.minimal_output',
        ]));
        expect(byId.get('cost')?.paths).toEqual(expect.arrayContaining([
            'rule_loading_tier', 'roadmap.quality_cadence', 'memory.review_threshold',
        ]));
    });
});
