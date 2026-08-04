// Chain right-sizing (ui-fix): the audit and design gates pass through for
// fix-intent runs so they enter at apply — UNLESS the ticket references a
// design artifact, where the design-fidelity floor keeps the mandatory halt.
import { describe, expect, it } from 'vitest';

import { DeliveryState, Outcome } from '../../../src/agent-src/templates/scripts/work_engine/delivery_state.js';
import {
    is_fix_intent,
    references_design_artifact,
} from '../../../src/agent-src/templates/scripts/work_engine/directives/ui/_fix_lane.js';
import { run as audit_run } from '../../../src/agent-src/templates/scripts/work_engine/directives/ui/audit.js';
import { run as design_run } from '../../../src/agent-src/templates/scripts/work_engine/directives/ui/design.js';
import { classify_intent } from '../../../src/agent-src/templates/scripts/work_engine/intent/classify.js';

function state(ticket: Record<string, unknown>): DeliveryState {
    return new DeliveryState({ ticket } as never);
}

describe('classify — ui-fix rung', () => {
    it('a defect repair on an existing surface classifies as ui-fix', () => {
        expect(classify_intent('fix the broken dropdown on the settings page')).toBe('ui-fix');
        expect(classify_intent('the modal close button is broken on mobile')).toBe('ui-fix');
    });

    it('redesign/improve intent keeps the full-chain label', () => {
        expect(classify_intent('redesign the settings page layout')).toBe('ui-improve');
        expect(classify_intent('polish the profile page card grid')).toBe('ui-improve');
    });

    it('trivial stays trivial even with a fix verb (trivial rung wins)', () => {
        expect(classify_intent('fix the typo in the dashboard header greeting')).toBe('ui-trivial');
    });
});

describe('_fix_lane predicates', () => {
    it('is_fix_intent reads the ticket intent', () => {
        expect(is_fix_intent(state({ intent: 'ui-fix' }))).toBe(true);
        expect(is_fix_intent(state({ intent: 'ui-improve' }))).toBe(false);
        expect(is_fix_intent(state({}))).toBe(false);
    });

    it('design-artifact references are detected in any string ticket field', () => {
        expect(references_design_artifact(state({ description: 'match the attached mockup' }))).toBe(true);
        expect(references_design_artifact(state({ title: 'port checkout-design.html 1:1' }))).toBe(true);
        expect(
            references_design_artifact(state({ acceptance_criteria: ['align with the Figma prototype'] })),
        ).toBe(true);
        expect(references_design_artifact(state({ description: 'button misaligned on mobile' }))).toBe(false);
    });
});

describe('audit gate — fix-lane passthrough', () => {
    it('ui-fix without an audit and without a design artifact passes through', () => {
        const st = state({ intent: 'ui-fix', description: 'fix the broken dropdown' });
        const r = audit_run(st);
        expect(r.outcome).toBe(Outcome.SUCCESS);
        const audit = st.ui_audit as Record<string, unknown>;
        expect(audit['audit_path']).toBe('fix-intent-on-demand');
    });

    it('ui-fix WITH a design-artifact reference keeps the mandatory audit halt', () => {
        const st = state({ intent: 'ui-fix', description: 'fix the header to match the mockup' });
        const r = audit_run(st);
        expect(r.outcome).not.toBe(Outcome.SUCCESS);
    });

    it('ui-improve without an audit still halts to delegate (chain unchanged)', () => {
        const st = state({ intent: 'ui-improve', description: 'polish the dashboard' });
        const r = audit_run(st);
        expect(r.outcome).not.toBe(Outcome.SUCCESS);
    });
});

describe('design gate — fix-lane passthrough', () => {
    it('ui-fix without a brief and without a design artifact passes through', () => {
        const st = state({ intent: 'ui-fix', description: 'fix the broken dropdown' });
        expect(design_run(st).outcome).toBe(Outcome.SUCCESS);
    });

    it('ui-improve without a brief still halts to delegate (chain unchanged)', () => {
        const st = state({ intent: 'ui-improve', description: 'polish the dashboard' });
        expect(design_run(st).outcome).not.toBe(Outcome.SUCCESS);
    });
});
