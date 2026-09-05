/**
 * The authorization-negation corpus — a TYPED corpus with STABLE IDS.
 *
 * Not a `.test.ts` file on purpose: vitest collects those, and a corpus is
 * data. Its consumer is `tests/scripts/git_auth_negation_corpus.test.ts`.
 *
 * WHY IDS AND NOT TEST DESCRIPTIONS. The acceptance criterion this corpus
 * serves asks for cases "committed and referenced BY ID from the fixture
 * file". A test description is neither stable across a refactor nor
 * referenceable from outside the test file, so it cannot satisfy that. The ids
 * below are intentional and read `<class>.<lang>.<op>.<shape>-<nn>`; they are
 * the handle a future evidence note, ledger entry or roadmap step cites.
 *
 * WHY A PROPERTY AND NOT A PHRASE LIST. The archived
 * `road-to-merge-op-split-and-negation-guard` closed this defect for the
 * phrases its source named, and four further shapes leaked afterwards — because
 * its corpus asserted a PHRASE LIST where the property was the thing to assert.
 * That roadmap's own § notes had already recorded the generalisation ("the
 * negation defect is not merge-only") and had recorded the `"Do "`-as-question
 * shape as pre-existing. The lesson is carried here rather than re-learned: the
 * property is *a negation binds within its clause, and only within its clause*,
 * and the rows below are chosen to span the ways a clause can end.
 *
 * The authoritative historical note stays in `git_auth_merge_ops.test.ts`,
 * which is where the merge-op split was reasoned; this file references it
 * rather than restating a narrative that would drift.
 */

/** What a row asserts about `classifyAuthorization(prompt).authorized`. */
export interface NegationCase {
    /** Stable, intentional, citable. Never renumber a shipped id. */
    readonly id: string;
    readonly prompt: string;
    /** Ops the prompt MUST authorize. Every other op must be absent. */
    readonly expect: readonly string[];
    /** Why this row exists — the shape it pins, not a restatement of the prompt. */
    readonly why: string;
    /**
     * Does this prompt WITHDRAW standing merge authority?
     *
     * Declared per row rather than derived from `expect`, because the two are
     * not the same question and an `expect: []` row can be either. A negated
     * merge authorizes nothing AND revokes; a genuine question
     * (`control.de.question.no-authorization-01`) authorizes nothing and
     * revokes nothing; the interrogative KNOWN LIMIT authorizes nothing only
     * because of a misread and must not be dragged into revoking.
     *
     * Deriving it would make the field agree with `classifyAuthorization` by
     * construction, which is exactly the disagreement this corpus now exists to
     * catch — the two functions ran different negation grammars until
     * 2026-09-04 and contradicted each other on `contrast.en.pr-merge.please-prefix-01`.
     */
    readonly revokes: boolean;
}

export const NEGATION_CORPUS: readonly NegationCase[] = [
    // The four leaks: a negation the clause scan must now see.
    {
        id: 'negation.de.pr-merge.trailing-01',
        revokes: true,
        prompt: 'Merge PR #12 auf keinen Fall.',
        expect: [],
        why: 'negation AFTER the match; the pre-2026-09-03 guard scanned backwards only',
    },
    {
        id: 'negation.en.pr-merge.trailing-02',
        revokes: true,
        prompt: 'Merge #12 under no circumstances.',
        expect: [],
        why: 'same shape in English; "no" trails the match inside one clause',
    },
    {
        id: 'negation.de.pr-merge.abbreviation-01',
        revokes: true,
        prompt: 'Du sollst nicht z.B. den PR #12 mergen.',
        expect: [],
        why: "the second dot of z.B. was read as a sentence start, cutting 'nicht' out of scope",
    },
    {
        id: 'negation.de.pr-merge.distance-01',
        revokes: true,
        prompt: 'Bitte unter keinen Umstaenden diesen Pull Request jetzt mergen',
        expect: [],
        why: 'negation 38 characters upstream of the match end, past the old 30-character window',
    },
    {
        id: 'negation.de.release.trailing-01',
        revokes: true,
        prompt: 'Nach Release 1.5 bitte nicht mergen.',
        expect: [],
        why:
            'NOT in the source review: a trailing negation leaked on the `release` op while ' +
            'the merge was correctly denied. The decimal point in "1.5" is the second half — ' +
            'a digit dot is not a sentence boundary either',
    },

    // The must-allow leak: a question word suppressing a real instruction.
    {
        id: 'interrogative.en.pr-merge.sentence-scope-01',
        revokes: false,
        prompt: 'Do not push. Merge PR #12.',
        expect: ['pr-merge'],
        why: 'a leading "Do " made the WHOLE block read as a question, dropping the merge the second sentence ordered',
    },
    {
        id: 'interrogative.en.pr-merge.sentence-scope-02',
        revokes: false,
        prompt: 'Do the release now. Merge PR #12.',
        expect: ['pr-merge', 'release'],
        why:
            'same first-word cause. The `release` half surfaced a SECOND defect this row now ' +
            'pins: `jetzt` was in the imperative escape list and `now` was not, so the German ' +
            'sentence authorized and the English one did not',
    },
    {
        id: 'interrogative.parity.release.now-vs-jetzt-01',
        revokes: false,
        prompt: 'Do the release jetzt.',
        expect: ['release'],
        why:
            'the German half of the parity pair above; both must now agree, and this row is the ' +
            'one that was already green — it is what made the English gap visible rather than arguable',
    },
    {
        id: 'interrogative.en.release.question-mark-wins-01',
        revokes: false,
        prompt: 'Can you do the release now?',
        expect: [],
        why:
            'closing the parity gap is only safe because an explicit trailing ? now outranks the ' +
            'imperative escape. Without that ordering, adding `now` to the list would have made ' +
            'this genuine question authorize a release',
    },
    {
        id: 'interrogative.en.pr-merge.known-limit-01',
        revokes: false,
        prompt: 'do not push, but merge PR #7',
        expect: [],
        why:
            'ACCEPTED FALSE NEGATIVE, decided 2026-09-04 by AI council (anthropic + openai, ' +
            'unanimous) — a recorded decline, not a promise. A leading bare "do" is classified ' +
            'conservatively as interrogative, so this sentence authorizes nothing. The cost is ' +
            'one restatement: the same prompt prefixed with "Please" is green, and ' +
            'contrast.en.pr-merge.please-prefix-01 asserts it. Releasing this row means ' +
            'loosening interrogative classification, which risks reading a genuine question as ' +
            'authorization for an IRREVERSIBLE operation — the direction ' +
            'interrogative.en.release.question-mark-wins-01 pins shut. Under-authorizing is the ' +
            'safe direction and is accepted as the standing behaviour. Reconsider only under a ' +
            'dedicated interrogative-classification change that keeps that row green; no such ' +
            'work is scheduled and none is implied here',
    },
    {
        id: 'contrast.en.pr-merge.please-prefix-01',
        revokes: false,
        prompt: 'Please do not push, but merge PR #7.',
        expect: ['pr-merge'],
        why:
            'the unconfounded English backward case: the negation sits in the clause before the ' +
            'cue and must not reach the merge. Green only after the change',
    },
    {
        id: 'interrogative.en.pr-merge.sentence-scope-03',
        revokes: false,
        prompt: 'Is everything green. Merge PR #12.',
        expect: ['pr-merge'],
        why: 'a declarative sentence opening with "Is" is not a question, and must not suppress the next one',
    },

    // Contrast cues: a negation must NOT cross into the next clause.
    {
        id: 'contrast.en.pr-merge.but-01',
        revokes: false,
        prompt: 'Merge PR #123, but do not push to production.',
        expect: ['pr-merge'],
        why: 'green BEFORE the change and after it — a genuine positive control for the widened scan',
    },
    {
        id: 'contrast.de.pr-merge.aber-01',
        revokes: false,
        prompt: 'nicht pushen, aber mergen',
        expect: ['pr-merge'],
        why:
            'NEW behaviour, and labelled as such: it returned [] before 2026-09-03 because the ' +
            'pr-merge pattern carried its own blind 30-character lookbehind. Not a control',
    },
    {
        id: 'contrast.de.pr-merge.aber-02',
        revokes: false,
        prompt: 'PR #123 ist bereit. Nicht pushen ohne Review, aber merge ist OK.',
        expect: ['pr-merge'],
        why: 'new behaviour; the negation sits in the preceding clause of the same sentence',
    },
    {
        id: 'contrast.en.push.negated-clause-01',
        revokes: false,
        prompt: 'Merge PR #123, but do not push to production.',
        expect: ['pr-merge'],
        why:
            'the OTHER half of contrast.en.pr-merge.but-01, asserted explicitly: the same prompt ' +
            'must keep DENYING push. Duplicated prompt, different obligation',
    },

    // Controls: green at HEAD before the change, and must stay green.
    {
        id: 'control.en.pr-merge.plain-01',
        revokes: false,
        prompt: 'merge PR #123',
        expect: ['pr-merge'],
        why: 'the plainest authorization there is; a widened negation scan must not touch it',
    },
    {
        id: 'control.de.pr-merge.prior-sentence-01',
        revokes: false,
        prompt: 'Nicht pushen. Merge PR #12.',
        expect: ['pr-merge'],
        why:
            'the sentence bound is load-bearing: a negation must not reach across a full stop. ' +
            'Green before the change — a real control, not a description of it',
    },
    {
        id: 'control.de.question.no-authorization-01',
        revokes: false,
        prompt: 'was macht npm publish eigentlich genau?',
        expect: [],
        why: 'a genuine question still authorizes nothing, which the per-sentence scope must not weaken',
    },
];
