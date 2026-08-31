/**
 * Three roles, three prompts, three input sets — and a judge that cannot see
 * outcome truth.
 *
 * `road-to-governed-harness-evolution` Phase 5, step 5.3.
 *
 * > *Split the roles: analyzer, curator, proposer. Do not collapse them into
 * > one unconstrained rewrite prompt. An optional judge model grades rubric
 * > questions only, under a frozen evaluator contract.*
 * > verify: **the three roles are separate prompts with separate input sets,
 * > and the judge cannot see outcome truth.**
 *
 * ## Separate input sets, enforced at the boundary rather than by convention
 *
 * {@link ROLE_INPUTS} declares which input kinds each role may receive, and
 * {@link buildPrompt} REFUSES an input whose kind is not in that role's set.
 * Separation therefore survives a caller who assembles one bag of everything
 * and hands it to all three, which is precisely how three roles collapse back
 * into one unconstrained rewrite prompt in practice: nobody decides to collapse
 * them, the input set just widens one field at a time until the roles differ
 * only in their preamble.
 *
 * The sets are deliberately not disjoint — every role sees `defect-observation`,
 * because a curator deciding `RETIRE` without the evidence that motivated it is
 * guessing. What no role sees is the UNION, and a test pins that: the widest
 * role's set is a strict subset of the vocabulary.
 *
 * ## The judge, and why "absent" was not good enough
 *
 * The load-bearing half of the verify clause is that the judge cannot see
 * outcome truth. A judge that merely is not GIVEN the outcome is one careless
 * spread away from seeing it, and the spread reads as harmless in review. So
 * the property is structural in two independent layers:
 *
 *   1. {@link JudgeInput} has no field capable of carrying an outcome. It is
 *      three fields — a contract id, rubric question ids, and the artifact text
 *      — and none of them can hold a verdict, an arm label, a metric, or a
 *      winner. `tests/scripts/role_split.test.ts` scans the declared interface
 *      for the outcome-truth field vocabulary, and proves the scanner fires on
 *      a synthetic interface before trusting it to be silent on this one.
 *   2. {@link buildJudgePrompt} rejects any key outside {@link JUDGE_INPUT_KEYS}.
 *      Types vanish at runtime, so a caller casting a wider object through
 *      `as JudgeInput` would defeat layer 1 alone; layer 2 throws on that
 *      object rather than quietly serialising the surplus field into the prompt.
 *
 * The judge's own output vocabulary is closed and outcome-free
 * ({@link JUDGE_GRADES}): it answers a rubric question, and there is no value it
 * can return that names an arm or declares a winner.
 *
 * ## The frozen evaluator contract is the one that already exists
 *
 * The contract id travels on the prompt, and {@link promoteJudgeContract} is the
 * only way to change it — it delegates to
 * `evaluator_promotion.assertEvaluatorPromotable`, so a judge-contract change
 * inherits the cross-grade and discrimination-plant requirements step 4.7
 * already built rather than getting a second, weaker gate of its own.
 */
import { CURATOR_OPS } from './curator_ops.js';
import { assertEvaluatorPromotable, type EvaluatorChange } from './evaluator_promotion.js';
import { classifyOverfit } from './judge_hygiene.js';

/** The three roles. The judge is deliberately NOT one of them — it is optional. */
export const ROLES = ['analyzer', 'curator', 'proposer'] as const;
export type Role = (typeof ROLES)[number];

/** The closed vocabulary of input kinds a role may be given. */
export const INPUT_KINDS = [
    'defect-observation',
    'trigger-census',
    'corpus-inventory',
    'lifecycle-history',
    'analyzer-finding',
    'curator-decision',
    'authoring-contract',
] as const;
export type InputKind = (typeof INPUT_KINDS)[number];

export interface RoleInput {
    kind: InputKind;
    id: string;
    text: string;
}

/**
 * Which input kinds each role may receive.
 *
 * The analyzer reads evidence and nothing about the corpus, so it cannot
 * propose a lifecycle op. The curator reads the corpus and the analyzer's
 * findings, so it decides WHICH artifact changes without ever seeing the
 * authoring contract that would let it write one. The proposer reads the
 * curator's decision and the authoring contract, so it writes text for a
 * decision that was already made elsewhere.
 */
export const ROLE_INPUTS: Readonly<Record<Role, readonly InputKind[]>> = {
    analyzer: ['defect-observation', 'trigger-census'],
    curator: ['defect-observation', 'corpus-inventory', 'lifecycle-history', 'analyzer-finding'],
    proposer: ['defect-observation', 'curator-decision', 'authoring-contract'],
};

/** What each role is asked to produce. One sentence, and they do not overlap. */
const ROLE_TASK: Readonly<Record<Role, string>> = {
    analyzer:
        'Name the defect classes the evidence supports, each with the observation ids that carry it. ' +
        'Do not name an artifact to change and do not propose text.',
    curator:
        `Choose exactly one lifecycle operation from ${CURATOR_OPS.join(' / ')} per finding, with its targets. ` +
        'Do not write the artifact body — that decision is not yours to author.',
    proposer:
        'Write the candidate body for the curator decision you were given, against the authoring contract. ' +
        'Do not revisit the operation, the targets, or whether the change is warranted.',
};

export class RoleContractViolation extends Error {
    readonly reasons: readonly string[];
    constructor(reasons: readonly string[]) {
        super(`role contract violated: ${reasons.join('; ')}`);
        this.name = 'RoleContractViolation';
        this.reasons = reasons;
    }
}

export interface RolePrompt {
    role: Role;
    text: string;
    /** The kinds actually supplied, sorted — the prompt's declared input set. */
    input_kinds: readonly InputKind[];
}

/**
 * Build one role's prompt, refusing any input kind outside that role's set.
 *
 * Fail-closed by construction: there is no option object that widens a role's
 * set, so a caller who wants to feed the curator an authoring contract has to
 * edit {@link ROLE_INPUTS}, which is visible in a diff.
 */
export function buildPrompt(role: Role, inputs: readonly RoleInput[]): RolePrompt {
    const allowed = new Set<InputKind>(ROLE_INPUTS[role]);
    const rejected = inputs.filter((i) => !allowed.has(i.kind));
    if (rejected.length > 0) {
        throw new RoleContractViolation(
            rejected.map(
                (i) =>
                    `role '${role}' may not receive input kind '${i.kind}' (input '${i.id}') — ` +
                    `its set is ${[...allowed].join(', ')}`,
            ),
        );
    }
    const kinds = [...new Set(inputs.map((i) => i.kind))].sort((a, b) => a.localeCompare(b));
    const body = inputs
        .map((i) => `[${i.kind}:${i.id}]\n${i.text}`)
        .sort((a, b) => a.localeCompare(b))
        .join('\n\n');
    return {
        role,
        text: `## Role: ${role}\n\n${ROLE_TASK[role]}\n\n## Inputs\n\n${body}`,
        input_kinds: kinds,
    };
}

/* ─────────────────────────── the optional judge ─────────────────────────── */

/**
 * Every key a judge prompt may be built from. Frozen, and checked at runtime,
 * because a cast defeats the type but not this list.
 */
export const JUDGE_INPUT_KEYS = ['evaluator_contract_id', 'rubric_question_ids', 'artifact_text'] as const;

/**
 * The judge's entire view.
 *
 * No field here can carry an outcome: not a verdict, not an arm label, not a
 * metric, not a winner, not a ground-truth label. That is the point, and it is
 * asserted mechanically rather than left to review.
 */
export interface JudgeInput {
    evaluator_contract_id: string;
    rubric_question_ids: readonly string[];
    artifact_text: string;
}

/** The judge's closed answer vocabulary. Nothing here names an arm or a winner. */
export const JUDGE_GRADES = ['yes', 'no', 'not-assessable'] as const;
export type JudgeGrade = (typeof JUDGE_GRADES)[number];

export class EvaluatorContractViolation extends Error {
    readonly reasons: readonly string[];
    constructor(reasons: readonly string[]) {
        super(`evaluator contract violated: ${reasons.join('; ')}`);
        this.name = 'EvaluatorContractViolation';
        this.reasons = reasons;
    }
}

/**
 * Words that would make a rubric question an outcome question.
 *
 * A rubric question asks a property of ONE artifact. The moment it asks which
 * of two did better, the judge is grading the experiment rather than the text,
 * and its answer becomes a second verdict beside `paired_verdict` — Risk 1 on
 * this roadmap.
 */
const OUTCOME_QUESTION_MARKERS = [
    'which arm',
    'which candidate',
    'which version',
    'treatment',
    'control arm',
    'baseline arm',
    'winner',
    'won',
    'better than',
    'outperform',
    'ground truth',
    'correct answer',
    'passed the eval',
    'regression',
];

export interface RubricQuestion {
    id: string;
    text: string;
}

export interface RubricAudit {
    /** Advisory shape per `judge_hygiene.classifyOverfit`. Gates nothing. */
    shapes: readonly { id: string; shape: string; reason: string }[];
}

/**
 * Throw {@link EvaluatorContractViolation} on any question that asks about
 * outcome truth, and return the advisory shape audit for the rest.
 */
export function assertRubricOnly(questions: readonly RubricQuestion[]): RubricAudit {
    const reasons: string[] = [];
    for (const q of questions) {
        const lower = q.text.toLowerCase();
        const hit = OUTCOME_QUESTION_MARKERS.find((m) => lower.includes(m));
        if (hit !== undefined) {
            reasons.push(`question '${q.id}' asks about outcome truth ("${hit}") — the judge grades text, not runs`);
        }
    }
    if (reasons.length > 0) throw new EvaluatorContractViolation(reasons);
    return {
        shapes: questions.map((q) => {
            const c = classifyOverfit(q.text);
            return { id: q.id, shape: c.shape, reason: c.reason };
        }),
    };
}

export interface JudgePrompt {
    /** Deliberately not a {@link Role}: the judge is optional and outside the split. */
    role: 'judge';
    evaluator_contract_id: string;
    text: string;
}

/**
 * Build the judge prompt from the allowlist and nothing else.
 *
 * The surplus-key check is the layer that survives a cast. `JudgeInput` cannot
 * DECLARE an outcome field, but `x as JudgeInput` can still carry one at
 * runtime, and a builder that spread its input would serialise it into the
 * prompt. This one enumerates {@link JUDGE_INPUT_KEYS} and refuses anything else.
 */
export function buildJudgePrompt(input: JudgeInput, questions: readonly RubricQuestion[]): JudgePrompt {
    const allowed = new Set<string>(JUDGE_INPUT_KEYS);
    const surplus = Object.keys(input as unknown as Record<string, unknown>).filter((k) => !allowed.has(k));
    if (surplus.length > 0) {
        throw new EvaluatorContractViolation(
            surplus.map((k) => `judge input carries '${k}', which is outside the frozen key set`),
        );
    }
    assertRubricOnly(questions);
    const asked = questions
        .filter((q) => input.rubric_question_ids.includes(q.id))
        .map((q) => `- ${q.id}: ${q.text}`)
        .join('\n');
    return {
        role: 'judge',
        evaluator_contract_id: input.evaluator_contract_id,
        text:
            `## Role: judge (contract ${input.evaluator_contract_id})\n\n` +
            `Answer each rubric question with exactly one of ${JUDGE_GRADES.join(' / ')}. ` +
            'You are grading one artifact against the question. You are not told how any run went, ' +
            'and no answer you can give names an arm or a winner.\n\n' +
            `## Rubric\n\n${asked}\n\n## Artifact\n\n${input.artifact_text}`,
    };
}

/** Refuse a judge prompt built against a contract id other than the frozen one. */
export function assertJudgeContractFrozen(prompt: JudgePrompt, frozenId: string): void {
    if (prompt.evaluator_contract_id !== frozenId) {
        throw new EvaluatorContractViolation([
            `judge prompt cites contract '${prompt.evaluator_contract_id}' but the frozen contract is ` +
                `'${frozenId}' — change it through promoteJudgeContract, not by editing the prompt`,
        ]);
    }
}

/**
 * The only way to move the frozen judge contract forward.
 *
 * Delegates to step 4.7's `assertEvaluatorPromotable`, so a judge-contract
 * change requires the same cross-grade over a frozen candidate set and the same
 * discrimination plants as any other evaluator change. Returns the new id only
 * once that gate has passed.
 */
export function promoteJudgeContract(change: EvaluatorChange): string {
    assertEvaluatorPromotable(change);
    return change.to;
}

/* ───────────────────────────── the pipeline ─────────────────────────────── */

export interface SplitPipeline {
    prompts: readonly RolePrompt[];
    /** `null` when no judge is configured — the judge is optional, per the step. */
    judge: JudgePrompt | null;
}

/**
 * Assemble the three role prompts, each from its own input set, plus the
 * optional judge.
 *
 * `inputsFor` is called once per role and its result passes through
 * {@link buildPrompt}, so a supplier that returns one undifferentiated bag is
 * refused rather than silently accepted.
 */
export function buildSplitPipeline(
    inputsFor: (role: Role) => readonly RoleInput[],
    judge: { input: JudgeInput; questions: readonly RubricQuestion[] } | null = null,
): SplitPipeline {
    return {
        prompts: ROLES.map((r) => buildPrompt(r, inputsFor(r))),
        judge: judge === null ? null : buildJudgePrompt(judge.input, judge.questions),
    };
}
