// road-to-a-control-that-matches-its-neighbours Phase 4: review before rebuild.
import { describe, expect, it } from 'vitest';

import { DeliveryState } from '../../../src/agent-src/templates/scripts/work_engine/delivery_state.js';
import { review_selection, run as applyRun } from '../../../src/agent-src/templates/scripts/work_engine/directives/ui/apply.js';
import { run as reviewRun, selection_gaps } from '../../../src/agent-src/templates/scripts/work_engine/directives/ui/review.js';
import {
    is_quality_adjective_review,
    is_review_only,
    populate_routing,
} from '../../../src/agent-src/templates/scripts/work_engine/intent/classify.js';
import { Input, WorkState } from '../../../src/agent-src/templates/scripts/work_engine/state.js';

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

// road-to-design-inputs-and-pages-read-as-they-are 3.3: a bare quality
// adjective over a surface is review-first (owner decision E2 default: only
// when the adjective is the whole goal).
describe('a bare quality adjective is review-first', () => {
    it.each([
        ['Mach die Website hochwertiger.', true],
        ['Make the site feel more premium.', true],
        ['Mach den Shop schöner.', true],
        ['Make the landing page nicer.', true],
        ['Add a filter and make it nicer.', false],
        ['Mach die Farbe des Buttons schöner.', false],
        ['Make the billing service more professional with typed errors.', false],
        ['Mach den Code schöner.', false],
    ])('%s → %s', (prompt, expected) => {
        expect(is_quality_adjective_review(prompt)).toBe(expected);
    });

    it('"Mach die Website hochwertiger" routes review-only and apply writes nothing', () => {
        const st = new WorkState({ input: new Input('prompt', { raw: 'Mach die Website hochwertiger.' }) });
        populate_routing(st);
        expect(st.directive_set).toBe('ui');
        const data = st.input.data as Record<string, unknown>;
        expect(data['review_only']).toBe(true);
        const r = applyRun(state({ review_only: data['review_only'] }));
        expect(r.outcome).toBe('blocked');
        expect(r.questions.join('\n')).toContain('review-before-rebuild');
    });
});
