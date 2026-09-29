import { describe, expect, it } from 'vitest';

import { DeliveryState } from '../../../src/agent-src/templates/scripts/work_engine/delivery_state.js';
import { run as appSpecRun } from '../../../src/agent-src/templates/scripts/work_engine/directives/ui/app_spec.js';
import {
    GRANULARITY_CONVENTION,
    run as auditRun,
} from '../../../src/agent-src/templates/scripts/work_engine/directives/ui/audit.js';
import { run as scaffoldRun } from '../../../src/agent-src/templates/scripts/work_engine/directives/ui/scaffold.js';
import {
    GREENFIELD_DECISIONS,
    SchemaError,
    from_dict,
} from '../../../src/agent-src/templates/scripts/work_engine/state.js';

/** Smallest v1 envelope that reaches `_validate_ui_audit`. */
function validate(ui_audit: Record<string, unknown>): void {
    from_dict({
        version: 1,
        input: { kind: 'ticket', data: {} },
        ui_audit,
    } as never);
}

function greenfield(decision?: string) {
    const ui_audit: Record<string, unknown> = { components: [], greenfield: true };
    if (decision !== undefined) ui_audit['greenfield_decision'] = decision;
    return new DeliveryState({ ticket: { title: 'new app' }, ui_audit } as never);
}

const HALT = greenfield();
const LINES: string[] = auditRun(HALT).questions ?? [];

describe('Phase 3.1 — the greenfield halt offers the convention as a fourth option', () => {
    it('renders exactly four numbered options', () => {
        const numbered = LINES.filter((l) => /^>\s\d+\.\s/u.test(l));
        expect(numbered).toHaveLength(4);
        expect(numbered[3]).toMatch(/^>\s4\.\s/u);
    });

    it('the fourth option is the granularity convention', () => {
        expect(LINES.filter((l) => /^>\s4\.\s/u.test(l))[0]?.toLowerCase()).toContain(
            'granularity',
        );
    });

    it('carries exactly one recommendation line, naming one number', () => {
        const recs = LINES.filter((l) => l.includes('**Recommendation:'));
        expect(recs).toHaveLength(1);
        // A single number still answers the block — the property the
        // reply-shape rule actually requires. `1a`-style grids fail this.
        expect(recs[0]).toMatch(/\*\*Recommendation:\s\d\s/u);
    });

    it('the recommendation still names option 1, unchanged by the addition', () => {
        expect(LINES.filter((l) => l.includes('**Recommendation:'))[0]).toContain(
            'Recommendation: 1',
        );
    });

    it('`greenfield_decision` accepts the new value', () => {
        expect(GREENFIELD_DECISIONS).toContain(GRANULARITY_CONVENTION);
        expect(() =>
            validate({ greenfield: true, greenfield_decision: GRANULARITY_CONVENTION }),
        ).not.toThrow();
    });

    it('the three pre-existing values keep working', () => {
        for (const value of ['scaffold', 'bare', 'external_reference']) {
            expect(GREENFIELD_DECISIONS).toContain(value);
            expect(() =>
                validate({ greenfield: true, greenfield_decision: value }),
            ).not.toThrow();
        }
    });

    it('an unknown value is still rejected', () => {
        expect(() =>
            validate({ greenfield: true, greenfield_decision: 'whatever' }),
        ).toThrow(SchemaError);
    });

    it('picking it puts the run on the scaffold path rather than a dead end', () => {
        // Option 4 reads "scaffold + adopt a convention". If the scaffold and
        // app-spec gates did not accept it, picking 4 would scaffold nothing.
        const st = greenfield(GRANULARITY_CONVENTION);
        expect(auditRun(st).outcome).toBe('success');
        expect(appSpecRun(st).outcome).toBe('blocked');
        expect(scaffoldRun(greenfield(GRANULARITY_CONVENTION)).outcome).toBe('blocked');
    });
});

describe('Phase 3.2 — declining is cheap and terminal', () => {
    it('a recorded decline ends the question; a second run emits no halt', () => {
        for (const decision of ['bare', 'external_reference', 'scaffold']) {
            const st = greenfield(decision);
            const first = auditRun(st);
            expect(first.outcome).toBe('success');
            expect(first.questions ?? []).toEqual([]);
            // The re-run is the load-bearing half: the offer must not come back.
            const second = auditRun(st);
            expect(second.outcome).toBe('success');
            expect((second.questions ?? []).join('\n')).not.toContain('granularity');
        }
    });

    it('accepting is equally terminal', () => {
        const st = greenfield(GRANULARITY_CONVENTION);
        auditRun(st);
        expect((auditRun(st).questions ?? []).join('\n')).not.toContain('granularity');
    });

    it('a non-greenfield project is never offered the convention at all', () => {
        // AC-2: a project that already has components is untouched by this.
        const st = new DeliveryState({
            ticket: { title: 'tweak', input_kind: 'diff' },
            ui_audit: { components_found: [{ name: 'Button', similarity: 0.9 }] },
        } as never);
        expect((auditRun(st).questions ?? []).join('\n')).not.toContain('granularity');
    });
});
