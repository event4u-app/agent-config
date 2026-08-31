// The promotion evidence package — road-to-harness-promotion-bridge 7.1, 7.2,
// 7.3 and 7.5.
//
// Every assertion here is over the GENERAL rule rather than a crafted instance:
// the absent-field test iterates PROMOTION_EVIDENCE_FIELDS instead of naming
// three of them, and the vocabulary test compares against the imported enums
// instead of re-listing their members. A test that hardcodes what the code will
// emit proves the code emits it, which is a tautology.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { REPO_ROOT } from './_bench_ab.js';
import { VERBS } from '../../src/scripts/evolution_lab.js';

import {
    AUTHORITY_BASES,
    EVIDENCE_STRENGTHS,
    PROTECTED_DIMENSIONS,
    REOPEN_POLICIES,
} from '../../src/scripts/_lib/adr_frontmatter.js';
import {
    PROMOTION_EVIDENCE_FIELDS,
    PromotionEvidenceError,
    ROLLOUT_STAGES,
    SCOPE_LADDER,
    assertRollout,
    assertTransferEvidence,
    parsePromotionEvidence,
    scopeIndex,
} from '../../src/scripts/_lib/promotion_evidence.js';

/** A package that passes. Every test mutates a copy of this, never a literal. */
function validPackage(over: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        candidate_id: 'cand-alpha',
        pathology_cell: 'routing-miss × laravel-migration',
        lineage: ['cand-root'],
        dimension: 'routing',
        selection: { trials: 12, wins: 9, summary: 'won 9 of 12 paired trials' },
        sealed_result: { held: true, summary: 'held on the sealed split' },
        cost: { trials: 12, spend_cents: 430 },
        scope: { level: 'repo', transfer_evidence: [] },
        governance: {
            authority_basis: 'evidence',
            evidence_strength: 'E3',
            reopen_policy: 'directional',
            protected_dimensions: ['none'],
        },
        rollout: { stage: 'opt-in', bundle: 'bundle-7', opt_in_completed: false, changes_shipped_default: false },
        material_improvement: {
            baseline_text: 'the original rule text that the candidate replaces entirely',
            candidate_text: 'a completely different formulation with no shared phrasing at all',
            delta_percent: 6,
        },
        ...over,
    };
}

// --- § 7.1 — every field is required ----------------------------------------

describe('7.1 — a promotion attempt with any field absent is refused', () => {
    it('accepts the complete package', () => {
        const p = parsePromotionEvidence(validPackage());
        expect(p.candidateId).toBe('cand-alpha');
        expect(p.dimension).toBe('routing');
    });

    it('refuses each field in turn, naming it — over the WHOLE field list', () => {
        for (const field of PROMOTION_EVIDENCE_FIELDS) {
            const doc = validPackage();
            delete doc[field];
            let thrown: unknown;
            try {
                parsePromotionEvidence(doc);
            } catch (e) {
                thrown = e;
            }
            expect(thrown, `dropping '${field}' was not refused`).toBeInstanceOf(PromotionEvidenceError);
            expect((thrown as PromotionEvidenceError).field, `refusal did not name '${field}'`).toBe(field);
            expect((thrown as Error).message).toContain('never defaulted');
        }
    });

    it('carries the seven fields the step names, plus the sibling steps that ride in the package', () => {
        // The step's own arithmetic says "five extra" and lists SEVEN. All seven
        // are required — the conservative reading — and this pins that choice so
        // a later narrowing is a test failure rather than a quiet edit.
        for (const named of [
            'pathology_cell',
            'lineage',
            'dimension',
            'selection',
            'sealed_result',
            'cost',
            'scope',
        ]) {
            expect(PROMOTION_EVIDENCE_FIELDS).toContain(named);
        }
        expect(PROMOTION_EVIDENCE_FIELDS.length).toBe(11);
    });

    it('refuses an absent field differently from an empty one', () => {
        // An empty lineage is legal (a root candidate has no ancestors); an
        // ABSENT lineage is not. Without this pole the required() check could be
        // satisfied by defaulting, which is the failure it exists to prevent.
        expect(() => parsePromotionEvidence(validPackage({ lineage: [] }))).not.toThrow();
        expect(() => parsePromotionEvidence(validPackage({ selection: { trials: 1, wins: 2, summary: 'x' } })))
            .toThrow(/more wins than trials/);
    });
});

// --- § 7.2 — the existing vocabulary, not a second one ----------------------

describe('7.2 — the governance block reuses the ADR vocabulary', () => {
    it('accepts exactly the members the ADR gate accepts, and nothing else', () => {
        for (const basis of AUTHORITY_BASES) {
            expect(() => parsePromotionEvidence(validPackage({
                governance: { authority_basis: basis, evidence_strength: 'E3', reopen_policy: 'owner', protected_dimensions: ['governance'] },
            }))).not.toThrow();
        }
        for (const strength of EVIDENCE_STRENGTHS) {
            expect(() => parsePromotionEvidence(validPackage({
                governance: { authority_basis: 'evidence', evidence_strength: strength, reopen_policy: 'owner', protected_dimensions: ['none'] },
            }))).not.toThrow();
        }
        for (const policy of REOPEN_POLICIES) {
            expect(() => parsePromotionEvidence(validPackage({
                governance: { authority_basis: 'evidence', evidence_strength: 'E3', reopen_policy: policy, protected_dimensions: ['none'] },
            }))).not.toThrow();
        }
        for (const dim of PROTECTED_DIMENSIONS) {
            expect(() => parsePromotionEvidence(validPackage({
                governance: { authority_basis: 'evidence', evidence_strength: 'E3', reopen_policy: 'owner', protected_dimensions: [dim] },
            }))).not.toThrow();
        }
    });

    it('refuses a term that is not in the ADR vocabulary', () => {
        expect(() => parsePromotionEvidence(validPackage({
            governance: { authority_basis: 'vibes', evidence_strength: 'E3', reopen_policy: 'owner', protected_dimensions: ['none'] },
        }))).toThrow(/authority_basis/);
        expect(() => parsePromotionEvidence(validPackage({
            governance: { authority_basis: 'evidence', evidence_strength: 'E9', reopen_policy: 'owner', protected_dimensions: ['none'] },
        }))).toThrow(/evidence_strength/);
        expect(() => parsePromotionEvidence(validPackage({
            governance: { authority_basis: 'evidence', evidence_strength: 'E3', reopen_policy: 'whenever', protected_dimensions: ['none'] },
        }))).toThrow(/reopen_policy/);
        expect(() => parsePromotionEvidence(validPackage({
            governance: { authority_basis: 'evidence', evidence_strength: 'E3', reopen_policy: 'owner', protected_dimensions: ['budget'] },
        }))).toThrow(/protected_dimensions/);
    });

    it('names no dimension at all → refused; `none` is how you say "none"', () => {
        expect(() => parsePromotionEvidence(validPackage({
            governance: { authority_basis: 'evidence', evidence_strength: 'E3', reopen_policy: 'owner', protected_dimensions: [] },
        }))).toThrow(/at least one dimension/);
    });
});

describe('7.2 — no new governance verb, no new approval path', () => {
    const EVIDENCE_TS = join(REPO_ROOT, 'src', 'scripts', '_lib', 'promotion_evidence.ts');

    it('the verb set is still exactly the seven step 3.6 named', () => {
        // "No new governance verb" as a checkable property: the promotion bridge
        // added an evidence package and a scope ladder and did NOT add a verb.
        expect([...VERBS]).toEqual(['inspect', 'propose', 'run', 'compare', 'explain', 'promote', 'clean']);
    });

    it('the four vocabularies are IMPORTED, never redeclared', () => {
        // A copy would satisfy the letter and break the point: two lists that can
        // drift ARE two governance systems, which is what this step forbids.
        const source = readFileSync(EVIDENCE_TS, 'utf-8');
        expect(source).toMatch(/import \{[\s\S]*?\}\s*from\s*'\.\/adr_frontmatter\.js'/);
        for (const name of ['AUTHORITY_BASES', 'EVIDENCE_STRENGTHS', 'REOPEN_POLICIES', 'PROTECTED_DIMENSIONS']) {
            expect(source, `${name} is redeclared rather than imported`)
                .not.toMatch(new RegExp(`(const|let)\\s+${name}\\s*[:=]`));
            expect(source).toContain(name);
        }
    });

    it('the vocabularies live in ONE place — the ADR gate reads the same constants', () => {
        const gate = readFileSync(join(REPO_ROOT, 'src', 'scripts', 'check_adr_frontmatter.ts'), 'utf-8');
        expect(gate).toContain('REOPEN_POLICIES');
        expect(gate).toContain('PROTECTED_DIMENSIONS');
        expect(gate).not.toMatch(/new Set\(\['directional'/);
    });

    it('the evidence module opens no second approval path', () => {
        // The tree-wide version of this is `lint_promotion_paths` R1; this is the
        // local pole, so a reader of THIS step sees the property asserted here.
        const source = readFileSync(EVIDENCE_TS, 'utf-8');
        expect(source).not.toContain('HumanApproval');
        expect(source).not.toMatch(/\bapprover\s*:/);
        expect(source).not.toContain('acquirePromotionCapability');
    });
});

// --- § 7.3 — the scope ladder and its transfer gate -------------------------

describe('7.3 — promote by scope, with a transfer gate', () => {
    it('the ladder is ordered, and the order is what makes a raise decidable', () => {
        expect([...SCOPE_LADDER]).toEqual(['episode', 'repo', 'stack', 'profile-pack', 'global']);
        for (let i = 1; i < SCOPE_LADDER.length; i += 1) {
            expect(scopeIndex(SCOPE_LADDER[i]!)).toBeGreaterThan(scopeIndex(SCOPE_LADDER[i - 1]!));
        }
    });

    it('a promotion with no scope field is refused', () => {
        const doc = validPackage();
        delete doc['scope'];
        expect(() => parsePromotionEvidence(doc)).toThrow(/'scope'/);
    });

    it('a scope raise with ONE configuration\'s evidence is refused', () => {
        const oneConfig = [
            { configuration: 'host-a', solver: 'solver-a', result: 'reproduced' },
            { configuration: 'host-a', solver: 'solver-a', result: 'reproduced again' },
        ];
        expect(() => parsePromotionEvidence(validPackage({
            scope: { level: 'stack', raised_from: 'repo', transfer_evidence: oneConfig },
        }))).toThrow(/SECOND solver or a SECOND host configuration/);
    });

    it('a raise on a second solver, or a second configuration, is accepted', () => {
        expect(() => assertTransferEvidence({
            level: 'stack',
            raisedFrom: 'repo',
            transferEvidence: [
                { configuration: 'host-a', solver: 'solver-a', result: 'x' },
                { configuration: 'host-a', solver: 'solver-b', result: 'y' },
            ],
        })).not.toThrow();
        expect(() => assertTransferEvidence({
            level: 'stack',
            raisedFrom: 'repo',
            transferEvidence: [
                { configuration: 'host-a', solver: 'solver-a', result: 'x' },
                { configuration: 'host-b', solver: 'solver-a', result: 'y' },
            ],
        })).not.toThrow();
    });

    it('a non-raise needs no transfer evidence, and a LOWERING is not a raise', () => {
        expect(() => assertTransferEvidence({ level: 'repo', transferEvidence: [] })).not.toThrow();
        expect(() => assertTransferEvidence({ level: 'episode', raisedFrom: 'global', transferEvidence: [] })).not.toThrow();
    });
});

// --- § 7.5 — canary rollout -------------------------------------------------

describe('7.5 — no promotion changes a shipped default without an opt-in stage', () => {
    it('the stages are ordered and `default` is the last one', () => {
        expect([...ROLLOUT_STAGES]).toEqual(['opt-in', 'canary', 'default']);
    });

    it('a shipped-default change with no completed opt-in is refused', () => {
        expect(() => parsePromotionEvidence(validPackage({
            rollout: { stage: 'canary', bundle: 'b', opt_in_completed: false, changes_shipped_default: true },
        }))).toThrow(/COMPLETED opt-in stage/);
    });

    it('claiming the `default` stage without a completed opt-in is refused', () => {
        expect(() => assertRollout({ stage: 'default', bundle: 'b', optInCompleted: false, changesShippedDefault: false }))
            .toThrow(/not skippable/);
    });

    it('a completed opt-in that names no bundle is refused', () => {
        expect(() => assertRollout({ stage: 'default', bundle: '  ', optInCompleted: true, changesShippedDefault: true }))
            .toThrow(/names no bundle/);
    });

    it('the positive pole: a completed opt-in with a named bundle passes', () => {
        // Without this, every assertion above would pass on a function that
        // refuses unconditionally and could never be satisfied.
        expect(() => parsePromotionEvidence(validPackage({
            rollout: { stage: 'default', bundle: 'bundle-7', opt_in_completed: true, changes_shipped_default: true },
        }))).not.toThrow();
    });
});
