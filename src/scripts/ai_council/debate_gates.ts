// Debate enforcement-gate detectors (road-to-opt-council-deliberation Phase 3).
//
// Pure, deterministic checks on the debate path — no LLM call. They decide
// WHETHER a bounded repair re-prompt is warranted; the re-prompt DISPATCH (one
// billable call per member per round, under a hard cap) and its auto-fire-vs-
// confirm POLICY live in the run path and are gated behind
// `ai_council.debate_gates.enabled` + the /council:design policy decision.
//
// The anti-conformity directive (the prompt-level half of the gates) is in
// `prompts.ts` (`ANTI_CONFORMITY_DIRECTIVE`) and wired into the debate augmenter.

import { jaccardSimilarity } from '../_lib/text_similarity.js';

/** Near-duplicate bar: reuse the existing shared MERGE-level Jaccard threshold. */
export const NOVELTY_DUP_THRESHOLD = 0.8;

/** Minimum distinct dissenting members for the dissent quota to be satisfied. */
export const DISSENT_QUOTA = 2;

// Objection markers — the engine has no dissent parser (existing "dissent" is
// LLM-score-derived, not text-marker-derived), so the marker is defined here.
const _OBJECTION_RE =
    /\b(disagree|disagrees|object|objection|reject|however|but\b|flaw|flawed|wrong|counter|counter-position|dissent|contradict|refute)\b/i;

/**
 * Novelty gate: a member's round-N reply is a **near-duplicate** of its own
 * round-(N-1) reply when their normalised token similarity meets the threshold.
 * Token-set Jaccard is order-independent and lowercased, so this is the
 * "normalised near-duplicate" the gate targets. A duplicate → the member added
 * nothing this round and warrants one targeted re-prompt.
 */
export function is_near_duplicate(
    prevText: string,
    currText: string,
    threshold = NOVELTY_DUP_THRESHOLD,
): boolean {
    if (prevText.trim().length === 0 || currText.trim().length === 0) {
        return false;
    }
    return jaccardSimilarity(prevText, currText) >= threshold;
}

/**
 * Dissent quota: at least `quota` members voice an explicit objection (carry an
 * objection marker). Below quota, the round has collapsed toward agreement and
 * warrants one targeted dissent re-prompt to the most-recently-converged member.
 * Empty / error replies do not count.
 */
export function count_dissenters(texts: readonly string[]): number {
    let n = 0;
    for (const t of texts) {
        if (t.trim().length > 0 && _OBJECTION_RE.test(t)) {
            n += 1;
        }
    }
    return n;
}

/** True when the dissent quota is satisfied (≥ `quota` members objected). */
export function dissent_quota_met(texts: readonly string[], quota = DISSENT_QUOTA): boolean {
    return count_dissenters(texts) >= quota;
}
