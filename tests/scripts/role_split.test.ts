/**
 * Tests for the analyzer / curator / proposer split and the outcome-blind judge
 * (`src/scripts/_lib/role_split.ts`,
 * road-to-governed-harness-evolution step 5.3).
 *
 * The verify clause is *"the three roles are separate prompts with separate
 * input sets, and the judge cannot see outcome truth"*. The second half is the
 * load-bearing one and the easy one to fake, so it is established three ways
 * that fail independently:
 *
 *   1. a static scan of the DECLARED `JudgeInput` interface for the
 *      outcome-truth field vocabulary — proved to fire on a synthetic interface
 *      before it is trusted to be silent on the real one;
 *   2. a runtime surplus-key refusal, exercised with an object cast through
 *      `as JudgeInput` — the case the type system cannot see;
 *   3. the produced prompt text, asserted not to contain the smuggled value.
 *
 * Layer 3 matters on its own: 1 and 2 could both hold while a builder
 * interpolated an outcome from somewhere else entirely.
 */
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    EvaluatorContractViolation,
    INPUT_KINDS,
    JUDGE_GRADES,
    JUDGE_INPUT_KEYS,
    ROLES,
    ROLE_INPUTS,
    RoleContractViolation,
    assertJudgeContractFrozen,
    assertRubricOnly,
    buildJudgePrompt,
    buildPrompt,
    buildSplitPipeline,
    promoteJudgeContract,
    type InputKind,
    type JudgeInput,
    type Role,
    type RoleInput,
} from '../../src/scripts/_lib/role_split.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ROLE_SPLIT_TS = path.join(REPO, 'src', 'scripts', '_lib', 'role_split.ts');

function input(kind: InputKind, id = `${kind}-1`): RoleInput {
    return { kind, id, text: `body of ${id}` };
}

/** Give each role exactly the kinds its own set declares. */
function ownInputs(role: Role): RoleInput[] {
    return ROLE_INPUTS[role].map((k) => input(k));
}

describe('5.3 — three roles, three prompts', () => {
    it('is exactly analyzer, curator, proposer — the judge is not one of them', () => {
        expect([...ROLES]).toEqual(['analyzer', 'curator', 'proposer']);
    });

    it('produces three prompts whose texts are pairwise distinct', () => {
        const texts = ROLES.map((r) => buildPrompt(r, ownInputs(r)).text);
        expect(new Set(texts).size).toBe(3);
        for (const r of ROLES) expect(texts.some((t) => t.startsWith(`## Role: ${r}`))).toBe(true);
    });

    it('gives each role a task the other two are told not to do', () => {
        const curator = buildPrompt('curator', ownInputs('curator')).text;
        const proposer = buildPrompt('proposer', ownInputs('proposer')).text;
        expect(curator).toContain('Do not write the artifact body');
        expect(proposer).toContain('Do not revisit the operation');
        expect(buildPrompt('analyzer', ownInputs('analyzer')).text).toContain('do not propose text');
    });
});

describe('5.3 — three SEPARATE input sets', () => {
    it('no two roles have the same set', () => {
        const sets = ROLES.map((r) => [...ROLE_INPUTS[r]].sort().join('|'));
        expect(new Set(sets).size).toBe(3);
    });

    it('no role receives the union — the widest set is a strict subset', () => {
        for (const r of ROLES) {
            expect(ROLE_INPUTS[r].length).toBeLessThan(INPUT_KINDS.length);
        }
    });

    it('the separation is the one the step names — corpus to the curator, contract to the proposer', () => {
        expect(ROLE_INPUTS.analyzer).not.toContain('corpus-inventory');
        expect(ROLE_INPUTS.curator).toContain('corpus-inventory');
        expect(ROLE_INPUTS.curator).not.toContain('authoring-contract');
        expect(ROLE_INPUTS.proposer).toContain('authoring-contract');
    });

    it('REFUSES a cross-role input rather than widening the set', () => {
        expect(() => buildPrompt('analyzer', [input('corpus-inventory')])).toThrow(RoleContractViolation);
        expect(() => buildPrompt('curator', [input('authoring-contract')])).toThrow(RoleContractViolation);
        try {
            buildPrompt('analyzer', [input('curator-decision')]);
            throw new Error('expected a refusal');
        } catch (e) {
            expect((e as RoleContractViolation).reasons.join(' ')).toContain(
                "role 'analyzer' may not receive input kind 'curator-decision'",
            );
        }
    });

    it('refuses the one-bag-of-everything supplier the split exists to prevent', () => {
        const everything = INPUT_KINDS.map((k) => input(k));
        expect(() => buildSplitPipeline(() => everything)).toThrow(RoleContractViolation);
    });

    it('accepts a supplier that differentiates by role, with no judge', () => {
        const pipeline = buildSplitPipeline(ownInputs);
        expect(pipeline.prompts.map((p) => p.role)).toEqual(['analyzer', 'curator', 'proposer']);
        expect(pipeline.judge).toBeNull();
    });
});

/* ── the load-bearing half ──────────────────────────────────────────────── */

/** Field names that would let a judge see how a run went. */
const OUTCOME_FIELD_NAMES = [
    'outcome',
    'verdict',
    'paired_verdict',
    'metric',
    'metrics',
    'winner',
    'arm',
    'control',
    'treatment',
    'passed',
    'failed',
    'score',
    'ground_truth',
    'label',
    'result',
    'baseline',
];

/** Extract one `export interface <name> { ... }` block's field names. */
function interfaceFields(source: string, name: string): string[] {
    const start = source.indexOf(`export interface ${name} {`);
    if (start < 0) throw new Error(`interface ${name} not found`);
    const open = source.indexOf('{', start);
    let depth = 0;
    let end = open;
    for (let i = open; i < source.length; i++) {
        if (source[i] === '{') depth++;
        else if (source[i] === '}') {
            depth--;
            if (depth === 0) {
                end = i;
                break;
            }
        }
    }
    const body = source.slice(open + 1, end);
    return [...body.matchAll(/^\s*(?:readonly\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*[?]?\s*:/gm)]
        .map((m) => m[1])
        .filter((f): f is string => f !== undefined);
}

function outcomeFieldsIn(source: string, name: string): string[] {
    return interfaceFields(source, name).filter((f) =>
        OUTCOME_FIELD_NAMES.some((bad) => f.toLowerCase() === bad || f.toLowerCase().includes(bad)),
    );
}

describe('5.3 — the judge cannot see outcome truth', () => {
    const SOURCE = readFileSync(ROLE_SPLIT_TS, 'utf-8');

    it('the scanner FIRES on a synthetic interface — it is not vacuous', () => {
        const planted = [
            'export interface JudgeInputPlanted {',
            '    evaluator_contract_id: string;',
            '    paired_verdict: string;',
            '    winning_arm: string;',
            '    artifact_text: string;',
            '}',
        ].join('\n');
        expect(outcomeFieldsIn(planted, 'JudgeInputPlanted').sort()).toEqual(['paired_verdict', 'winning_arm']);
        // and the extractor is not returning nothing, which would also "pass"
        expect(interfaceFields(planted, 'JudgeInputPlanted')).toHaveLength(4);
    });

    it('layer 1 — the declared JudgeInput has no field able to carry an outcome', () => {
        const fields = interfaceFields(SOURCE, 'JudgeInput');
        expect(fields.sort()).toEqual(['artifact_text', 'evaluator_contract_id', 'rubric_question_ids']);
        expect(outcomeFieldsIn(SOURCE, 'JudgeInput')).toEqual([]);
    });

    it('the frozen key set is exactly the declared fields — no third list to drift', () => {
        expect([...JUDGE_INPUT_KEYS].sort()).toEqual(interfaceFields(SOURCE, 'JudgeInput').sort());
    });

    it('layer 2 — a cast object carrying an outcome is REFUSED at runtime', () => {
        const smuggled = {
            evaluator_contract_id: 'c1',
            rubric_question_ids: ['q1'],
            artifact_text: 'body',
            paired_verdict: 'treatment-won',
        } as unknown as JudgeInput;
        expect(() => buildJudgePrompt(smuggled, [{ id: 'q1', text: 'Does the section name a constraint?' }])).toThrow(
            EvaluatorContractViolation,
        );
        try {
            buildJudgePrompt(smuggled, [{ id: 'q1', text: 'Does the section name a constraint?' }]);
        } catch (e) {
            expect((e as EvaluatorContractViolation).reasons.join(' ')).toContain(
                "judge input carries 'paired_verdict'",
            );
        }
    });

    it('layer 3 — the prompt is a pure function of the three allowlisted values', () => {
        // The strongest form of "nothing else reached the prompt": rebuild the
        // expected text from the three legal fields alone and demand equality.
        // A builder that ever interpolated a fourth source — an outcome read
        // from anywhere, not only from its own argument — breaks this equality,
        // which layers 1 and 2 would both miss.
        const prompt = buildJudgePrompt(
            { evaluator_contract_id: 'c1', rubric_question_ids: ['q1'], artifact_text: 'a body under review' },
            [{ id: 'q1', text: 'Does the section name a constraint the code cannot show?' }],
        );
        const expected =
            '## Role: judge (contract c1)\n\n' +
            `Answer each rubric question with exactly one of ${JUDGE_GRADES.join(' / ')}. ` +
            'You are grading one artifact against the question. You are not told how any run went, ' +
            'and no answer you can give names an arm or a winner.\n\n' +
            '## Rubric\n\n- q1: Does the section name a constraint the code cannot show?\n\n' +
            '## Artifact\n\na body under review';
        expect(prompt.text).toBe(expected);
    });

    it('layer 3b — the DATA sections carry no outcome vocabulary', () => {
        // Scoped to the data sections on purpose. The instruction preamble says
        // "no answer you can give names an arm or a winner", and forbidding the
        // word there would forbid the sentence that states the property.
        const prompt = buildJudgePrompt(
            { evaluator_contract_id: 'c1', rubric_question_ids: ['q1'], artifact_text: 'a body under review' },
            [{ id: 'q1', text: 'Does the section name a constraint the code cannot show?' }],
        );
        const dataSections = prompt.text.slice(prompt.text.indexOf('## Rubric')).toLowerCase();
        expect(dataSections.length).toBeGreaterThan(40);
        for (const bad of ['treatment', 'control arm', 'winner', 'paired_verdict', 'ground truth']) {
            expect(dataSections).not.toContain(bad);
        }
        expect(prompt.text).toContain('You are not told how any run went');
    });

    it('answers from a closed vocabulary that cannot name an arm', () => {
        expect([...JUDGE_GRADES]).toEqual(['yes', 'no', 'not-assessable']);
        for (const g of JUDGE_GRADES) {
            expect(OUTCOME_FIELD_NAMES.some((bad) => g.includes(bad))).toBe(false);
        }
    });
});

describe('5.3 — rubric questions only', () => {
    it('refuses a question that asks which arm won', () => {
        expect(() => assertRubricOnly([{ id: 'q1', text: 'Which candidate performed better than the baseline?' }])).toThrow(
            EvaluatorContractViolation,
        );
    });

    it('names the marker it refused on', () => {
        try {
            assertRubricOnly([{ id: 'q2', text: 'Did the treatment arm pass?' }]);
            throw new Error('expected a refusal');
        } catch (e) {
            expect((e as EvaluatorContractViolation).reasons.join(' ')).toContain("asks about outcome truth");
        }
    });

    it('admits a property question and returns only an ADVISORY shape', () => {
        const audit = assertRubricOnly([{ id: 'q3', text: 'Does the section state a falsifiable constraint?' }]);
        expect(audit.shapes).toHaveLength(1);
        const first = audit.shapes[0];
        expect(first?.id).toBe('q3');
        expect(typeof first?.shape).toBe('string');
    });
});

describe('5.3 — the frozen evaluator contract', () => {
    const prompt = buildJudgePrompt(
        { evaluator_contract_id: 'contract-v1', rubric_question_ids: ['q1'], artifact_text: 'x' },
        [{ id: 'q1', text: 'Does the section state a constraint?' }],
    );

    it('admits the frozen id and refuses any other', () => {
        expect(() => { assertJudgeContractFrozen(prompt, 'contract-v1'); }).not.toThrow();
        expect(() => { assertJudgeContractFrozen(prompt, 'contract-v2'); }).toThrow(EvaluatorContractViolation);
    });

    it('moves the contract only through step 4.7s promotion gate', () => {
        // No cross-grade — `assertEvaluatorPromotable` is the refuser, reused, not reimplemented.
        expect(() =>
            promoteJudgeContract({
                from: 'contract-v1',
                to: 'contract-v2',
                frozen_set: { id: 'fs1', candidate_ids: ['a'] },
                cross_grade: null,
                plants: [],
            }),
        ).toThrow(/evaluator promotion refused/);
    });
});
