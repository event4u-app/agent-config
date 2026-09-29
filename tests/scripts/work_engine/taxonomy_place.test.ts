import { describe, expect, it } from 'vitest';

import { DeliveryState } from '../../../src/agent-src/templates/scripts/work_engine/delivery_state.js';
import { run as applyRun } from '../../../src/agent-src/templates/scripts/work_engine/directives/ui/apply.js';
import { NO_TAXONOMY } from '../../../src/agent-src/templates/scripts/work_engine/taxonomy/detect.js';
import {
    conformance_lines,
    plan_component_placement,
} from '../../../src/agent-src/templates/scripts/work_engine/taxonomy/place.js';

const TIERED = 'atoms/molecules/organisms';
const ROOT = 'src/components';

/** Drive `apply` to the delegation branch, which is where the lines are emitted. */
function applyQuestions(ui_audit: Record<string, unknown> | null, components: unknown[]): string[] {
    const st = new DeliveryState({
        ticket: { title: 'add a button' },
        stack: { frontend: 'react-shadcn', mtime: 1 },
        ui_audit,
        ui_design: { components, design_confirmed: true },
    } as never);
    return applyRun(st).questions ?? [];
}

describe('Phase 2.1 — the authoring step reads the detected field', () => {
    it('places a component inside the tier the project itself names', () => {
        const [plan] = plan_component_placement(TIERED, ROOT, [
            { name: 'Button', tier: 'atoms' },
        ]);
        expect(plan?.tier).toBe('atoms');
        expect(plan?.directory).toBe('src/components/atoms');
        expect(plan?.gap).toBeNull();
    });

    it('matches a tier hint across singular/plural and case', () => {
        const plans = plan_component_placement(TIERED, ROOT, [
            { name: 'Field', tier: 'Molecule' },
            { name: 'Header', tier: 'ORGANISMS' },
        ]);
        expect(plans.map((p) => p.directory)).toEqual([
            'src/components/molecules',
            'src/components/organisms',
        ]);
    });

    it('conforms to a taxonomy whose tier names are in no lexicon', () => {
        // The `declared` path: a project's own vocabulary must work exactly as
        // well as a recognised one, or the suite has imposed a vocabulary.
        const [plan] = plan_component_placement('primitives/patterns/features', ROOT, [
            { name: 'Checkout', tier: 'features' },
        ]);
        expect(plan?.directory).toBe('src/components/features');
        expect(plan?.gap).toBeNull();
    });

    it('the apply step names the taxonomy and the target directory', () => {
        const lines = applyQuestions(
            { components: [{ name: 'X' }], component_taxonomy: TIERED, component_root: ROOT },
            [{ name: 'Button', tier: 'atoms' }],
        );
        const joined = lines.join('\n');
        expect(joined).toContain(TIERED);
        expect(joined).toContain('src/components/atoms');
    });
});

describe('AC-2 — a project evidencing none behaves exactly as it does today', () => {
    it('`none` yields no tier, no directory and no gap', () => {
        const [plan] = plan_component_placement(NO_TAXONOMY, ROOT, [{ name: 'Button' }]);
        expect(plan?.tier).toBeNull();
        expect(plan?.directory).toBeNull();
        expect(plan?.gap).toBeNull();
    });

    it('`none` emits no conformance lines at all', () => {
        const plans = plan_component_placement(NO_TAXONOMY, ROOT, [{ name: 'Button' }]);
        expect(conformance_lines(NO_TAXONOMY, ROOT, plans)).toEqual([]);
    });

    it('the apply output is byte-identical with `none` and with the field absent', () => {
        const withNone = applyQuestions(
            { components: [{ name: 'X' }], component_taxonomy: NO_TAXONOMY },
            [{ name: 'Button', tier: 'atoms' }],
        );
        const withoutField = applyQuestions({ components: [{ name: 'X' }] }, [
            { name: 'Button', tier: 'atoms' },
        ]);
        expect(withNone).toEqual(withoutField);
        expect(withNone.join('\n')).not.toContain('taxonomy');
    });

    it('an unset audit slot changes nothing either', () => {
        expect(applyQuestions(null, [{ name: 'Button' }]).join('\n')).not.toContain('taxonomy');
    });
});

describe('Phase 2.2 — an unplaceable component is a named gap, not a silent divergence', () => {
    it('a component whose tier is not in the taxonomy is reported with the reason', () => {
        const [plan] = plan_component_placement(TIERED, ROOT, [
            { name: 'CheckoutShell', tier: 'feature' },
        ]);
        expect(plan?.directory).toBeNull();
        expect(plan?.gap).toContain('feature');
        expect(plan?.gap).toContain(TIERED);
    });

    it('a component carrying no tier at all is a gap, never a guess', () => {
        // Guessing would need a per-tier rule, which is exactly what AC-4
        // forbids. The honest answer is to say so and leave it to the author.
        const [plan] = plan_component_placement(TIERED, ROOT, [{ name: 'Mystery' }]);
        expect(plan?.directory).toBeNull();
        expect(plan?.gap).toContain('Mystery');
    });

    it('a gap is never placed somewhere else instead', () => {
        const plans = plan_component_placement(TIERED, ROOT, [
            { name: 'A', tier: 'atoms' },
            { name: 'B', tier: 'nope' },
        ]);
        expect(plans.filter((p) => p.gap !== null).map((p) => p.directory)).toEqual([null]);
    });

    it('the gap surfaces in the apply output as its own line', () => {
        const joined = applyQuestions(
            { components: [{ name: 'X' }], component_taxonomy: TIERED, component_root: ROOT },
            [{ name: 'CheckoutShell', tier: 'feature' }],
        ).join('\n');
        expect(joined).toContain('conformance gap');
        expect(joined).toContain('CheckoutShell');
    });
});
