// road-to-a-control-that-matches-its-neighbours Phase 4: review before rebuild.
import { describe, expect, it } from 'vitest';

import { DeliveryState } from '../../../src/agent-src/templates/scripts/work_engine/delivery_state.js';
import { review_selection, run as applyRun } from '../../../src/agent-src/templates/scripts/work_engine/directives/ui/apply.js';
import { run as reviewRun, selection_gaps } from '../../../src/agent-src/templates/scripts/work_engine/directives/ui/review.js';
import { is_review_only } from '../../../src/agent-src/templates/scripts/work_engine/intent/classify.js';

describe('is_review_only — a request to check, not to change', () => {
    it.each([
        ['Prüf meine Website auf Designfehler.', true],
        ['Review the checkout page for design issues.', true],
        ['Check my landing page against the brand.', true],
        ['Prüf die Seite und korrigiere die Abstände.', false],
        ['Review the settings page and fix the spacing.', false],
        ['Add a select to the orders page.', false],
    ])('%s → %s', (prompt, expected) => {
        expect(is_review_only(prompt)).toBe(expected);
    });
});

function state(ticket: Record<string, unknown>, ui_review: Record<string, unknown> | null = null) {
    return new DeliveryState({ ticket, ui_review } as never);
}

describe('ui/apply — nothing is written before the selection', () => {
    it('a review-only request halts at apply until a selection exists', () => {
        const r = applyRun(state({ review_only: true }));
        expect(r.outcome).toBe('blocked');
        expect(r.questions.join('\n')).toContain('review-before-rebuild');
        expect(r.questions.join('\n')).toContain('Never a silent full rebuild');
    });

    it('a selection releases apply; a normal request is unaffected', () => {
        expect(review_selection(state({ review_only: true }, { selection: ['F2'] }))).toEqual(['F2']);
        expect(review_selection(state({}))).toBeNull();
    });
});

describe('ui/review — every selected finding is resolved, nothing unrequested', () => {
    it('names selected findings without a resolution and unrequested fixes', () => {
        expect(
            selection_gaps({
                selection: ['F1', 'F2'],
                resolved: { F1: { status: 'fixed', commit: 'abc123' }, F3: { status: 'fixed', commit: 'def' } },
            }),
        ).toEqual({ missing: ['F2'], unrequested: ['F3'] });
    });

    it('a not-fixed resolution needs its reason', () => {
        expect(selection_gaps({ selection: ['F1'], resolved: { F1: { status: 'not-fixed' } } }).missing).toEqual(['F1']);
    });

    it('the review step blocks on an unresolved selection', () => {
        const r = reviewRun(
            state({ review_only: true }, { findings: [], review_clean: true, selection: ['F1'], resolved: {}, preview: { skipped: true } }),
        );
        expect(r.outcome).toBe('blocked');
        expect(r.questions.join('\n')).toContain('F1');
    });
});
