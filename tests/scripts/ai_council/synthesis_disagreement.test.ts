// Tests for the three-element disagreement audit over a COMPLETED synthesis.
//
// Pure string validation — no CLI, no network.
//
// code-comment-allow-file -- every `###` line below sits inside a synthesis
// fixture string, not a comment: the headings ARE the data under test, so the
// report-shape detector reads the fixtures rather than any prose in this file.
import { describe, expect, it } from 'vitest';

import {
    auditSynthesisElements,
    RESOLVING_EVIDENCE_SECTION,
    renderSynthesisElementAudit,
    SYNTHESIS_ELEMENTS,
} from '../../../src/scripts/ai_council/synthesis_disagreement.js';
import {
    ANALYSIS_SYNTHESIS,
    CREATIVE_SYNTHESIS,
    DEFAULT_SYNTHESIS,
    PR_SYNTHESIS,
} from '../../../src/scripts/ai_council/prompts.js';

const ALL_THREE = `## Convergence / Divergence

### Clashes
Reviewer A holds the migration is reversible; Reviewer B holds it strands audit rows.

### Resolving evidence
migration reversibility — strongest minority evidence: B cited the missing down()
on 2026_08_01_audit · resolved by: running the down migration against a seeded
staging snapshot and counting orphaned audit rows.

### Kill criteria
- the down migration leaves > 0 orphaned rows.

### Concrete next step
Open a PR adding the down() path.`;

const NO_RESOLVING = `## Convergence / Divergence

### Clashes
Reviewer A holds the migration is reversible; Reviewer B holds it strands audit rows.

### Kill criteria
- the down migration leaves > 0 orphaned rows.`;

const UNANIMOUS = `## Convergence / Divergence

### Agreement
Both reviewers converged on shipping option A.

### Recommendation
Ship option A.

### Kill criteria
- p95 latency regresses past 250ms.`;

const DECLARED_NONE = `## Convergence / Divergence

### Clashes
A says the market is ready; B says it is not.

### Resolving evidence
market readiness — strongest minority evidence: B cited three churned pilots ·
no resolving evidence identified — no observation available before the quarter closes.`;

describe('the three elements', () => {
    it('names exactly the three the step enumerates', () => {
        expect(SYNTHESIS_ELEMENTS).toEqual([
            'unresolved-disagreement',
            'minority-evidence',
            'resolving-evidence',
        ]);
    });
});

describe('auditSynthesisElements', () => {
    it('passes a dissenting synthesis that renders all three', () => {
        const a = auditSynthesisElements(ALL_THREE);
        expect(a.dissentPresent).toBe(true);
        expect(a.missing).toEqual([]);
        expect(a.complete).toBe(true);
        expect(a.elements.every((e) => e.present)).toBe(true);
    });

    it('FAILS a dissenting synthesis that drops the resolving-evidence element', () => {
        // The polarity test: without this the audit could return `complete` for
        // everything and every other case here would still pass.
        const a = auditSynthesisElements(NO_RESOLVING);
        expect(a.dissentPresent).toBe(true);
        expect(a.complete).toBe(false);
        expect(a.missing).toContain('resolving-evidence');
        expect(a.missing).toContain('minority-evidence');
    });

    it('accepts an explicit "no resolving evidence identified" as an answer', () => {
        const a = auditSynthesisElements(DECLARED_NONE);
        expect(a.missing).toEqual([]);
        expect(a.elements.find((e) => e.element === 'resolving-evidence')?.satisfiedBy).toBe(
            'no resolving evidence identified',
        );
    });

    it('grades nothing when the pass had no disagreement', () => {
        const a = auditSynthesisElements(UNANIMOUS);
        expect(a.dissentPresent).toBe(false);
        expect(a.dissentSource).toBe('text');
        expect(a.missing).toEqual([]);
        expect(a.complete).toBe(true);
    });

    it('grades a unanimous-looking text anyway when the caller says the pass split', () => {
        const a = auditSynthesisElements(UNANIMOUS, { dissentPresent: true });
        expect(a.dissentSource).toBe('caller');
        expect(a.complete).toBe(false);
        expect(a.missing).toHaveLength(3);
    });

    it('treats a placeholder-only disagreement section as absent', () => {
        const a = auditSynthesisElements(`### Clashes\n\n*none*\n\n### Recommendation\nShip.`);
        expect(a.dissentPresent).toBe(false);
    });

    it('recognises each lens heading for the disagreement element', () => {
        for (const heading of ['Clashes', 'Conflicts', 'Outliers', 'Divergence']) {
            const a = auditSynthesisElements(`### ${heading}\nA says x, B says y.`);
            expect(a.dissentPresent).toBe(true);
            expect(a.elements[0]?.satisfiedBy).toBe(`### ${heading}`);
        }
    });
});

describe('renderSynthesisElementAudit', () => {
    it('says which elements were dropped', () => {
        const out = renderSynthesisElementAudit(auditSynthesisElements(NO_RESOLVING));
        expect(out).toContain('DROPS 2 of 3');
        expect(out).toContain('resolving-evidence: MISSING');
    });

    it('says the audit was skipped when there was no dissent', () => {
        expect(renderSynthesisElementAudit(auditSynthesisElements(UNANIMOUS))).toContain('SKIPPED');
    });
});

describe('the template contract', () => {
    it('every lens template now asks for the resolving-evidence element', () => {
        for (const t of [DEFAULT_SYNTHESIS, PR_SYNTHESIS, ANALYSIS_SYNTHESIS, CREATIVE_SYNTHESIS]) {
            expect(t).toContain('### Resolving evidence');
            expect(t).toContain('strongest minority evidence:');
            expect(t).toContain('resolved by:');
        }
    });

    it('the templates carry the SAME text the audit checks for — one source', () => {
        // A second copy of this prose is the defect: the checker would grade a
        // contract the templates no longer ask for.
        for (const t of [DEFAULT_SYNTHESIS, PR_SYNTHESIS, ANALYSIS_SYNTHESIS, CREATIVE_SYNTHESIS]) {
            expect(t).toContain(RESOLVING_EVIDENCE_SECTION);
        }
    });
});
