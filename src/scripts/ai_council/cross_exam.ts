/**
 * Targeted cross-examination — step 8.1.
 *
 * `road-to-inbox-harvest-2026-08-e-council-topology-evidence` step 8.1: *"Select
 * a disputed finding, a conflicting pair, or a correct-looking minority claim,
 * and ask focused rebuttal questions"*, verified by *"the cross-exam prompt
 * names the exact disputed claim"*.
 *
 * ## "Names the exact claim" is a byte-level obligation, not a summary
 *
 * The failure this prevents is a composer that paraphrases: *"one reviewer
 * questioned the index approach"* is a description of a dispute and gives the
 * cross-examined model nothing to rebut. The prompt therefore carries the
 * claim's **verbatim text**, unmodified and untruncated, and
 * {@link crossExamNamesClaim} is the predicate that decides it — a substring
 * check on the original string, which is the only form of "exact" that survives
 * a later edit to the prompt's wording.
 *
 * ## The claim is untrusted, and is fenced
 *
 * A disputed claim is model output. It reaches the prompt through
 * `wrapUntrustedBlocks` under a nonce, exactly as `build_peer_review_user_prompt`
 * already does (`prompts.ts:932-942`) — a claim that could close its own fence
 * could inject instructions into the cross-exam. Fencing does not modify the
 * payload, which is what lets it coexist with the verbatim obligation above.
 *
 * ## Selection is deterministic and ordered, and the order is argued
 *
 * `conflicting-pair` outranks `disputed-finding` outranks `minority-claim`. A
 * conflicting pair is the only kind where **at least one side is definitely
 * wrong**, so the rebuttal has the highest information density; a lone disputed
 * finding may resolve to "both are partly right"; a correct-looking minority
 * claim is last because the majority may simply be right and the call buys the
 * least. Ties break on the claim id, so selection is a pure function of input.
 *
 * Pure and offline: composes a prompt, never dispatches one.
 */
import { wrapUntrustedBlocks } from '../_lib/untrusted_content.js';

/** What kind of thing is being cross-examined. Priority order, strongest first. */
export const CROSS_EXAM_KINDS = ['conflicting-pair', 'disputed-finding', 'minority-claim'] as const;
export type CrossExamKind = (typeof CROSS_EXAM_KINDS)[number];

/** One candidate for cross-examination. */
export interface DisputedClaim {
    readonly id: string;
    readonly kind: CrossExamKind;
    /** Neutral label of whoever asserted it (`Response-A`), never a provider name. */
    readonly assertedBy: string;
    /** THE CLAIM, VERBATIM. Never summarised, never truncated. */
    readonly claim: string;
    /** Neutral label of whoever disputes it, when there is one. */
    readonly disputedBy?: string;
    /** The opposing text, verbatim, when there is one. */
    readonly counterClaim?: string;
}

/**
 * The focused questions. Fixed and shared across kinds on purpose: a per-kind
 * question set is a second thing to keep in sync with the neutrality contract,
 * and every question below is answerable about any of the three kinds.
 */
export const CROSS_EXAM_QUESTIONS: readonly string[] = [
    'Is the claim above true as stated? Answer yes, no, or "true only under a condition" and name the condition.',
    'What specific evidence would settle it? Name a file, a measurement, or a test — not a further opinion.',
    'If it is false, what is the smallest correction that makes it true?',
    'What would you have to believe for the opposing position to be correct?',
];

const PREAMBLE = `You are cross-examining ONE specific claim from a council deliberation.
Do not review the artefact again, do not restate the debate, and do not
comment on any claim other than the one quoted below. Your entire reply
answers the numbered questions about that claim.`;

/**
 * Pick the claim to cross-examine, or `null`.
 *
 * Deterministic: kind priority first, then claim id.
 */
export function selectCrossExamTarget(candidates: readonly DisputedClaim[]): DisputedClaim | null {
    if (candidates.length === 0) return null;
    const ranked = [...candidates].sort((a, b) => {
        const ka = CROSS_EXAM_KINDS.indexOf(a.kind);
        const kb = CROSS_EXAM_KINDS.indexOf(b.kind);
        return ka - kb || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    });
    return ranked[0] as DisputedClaim;
}

/** Compose the cross-exam prompt. The claim text is carried verbatim. */
export function buildCrossExamPrompt(target: DisputedClaim, opts: { readonly nonce?: string } = {}): string {
    const blocks = [{ heading: `### The claim under examination (asserted by ${target.assertedBy})`, content: target.claim }];
    if (target.counterClaim !== undefined) {
        blocks.push({
            heading: `### The opposing position (asserted by ${target.disputedBy ?? 'another reviewer'})`,
            content: target.counterClaim,
        });
    }
    const fenced = wrapUntrustedBlocks(blocks, opts.nonce === undefined ? {} : { nonce: opts.nonce });
    const questions = CROSS_EXAM_QUESTIONS.map((q, i) => `${String(i + 1)}. ${q}`).join('\n');
    return [
        PREAMBLE,
        '',
        `Kind: ${target.kind} · claim id: ${target.id}`,
        '',
        fenced,
        '',
        '---',
        '',
        'Answer these, in order:',
        '',
        questions,
        '',
    ].join('\n');
}

/**
 * Does this prompt name the exact claim?
 *
 * A plain substring check on the ORIGINAL string. Deliberately not a similarity
 * score: "exact" that tolerates a threshold is not exact, and the paraphrase is
 * the failure mode. Both sides of a pair must be present when a pair was given.
 */
export function crossExamNamesClaim(prompt: string, target: DisputedClaim): boolean {
    if (!prompt.includes(target.claim)) return false;
    if (target.counterClaim !== undefined && !prompt.includes(target.counterClaim)) return false;
    return true;
}
