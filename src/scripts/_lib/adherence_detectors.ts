/**
 * Deterministic adherence detection, and a hard refusal to guess.
 *
 * Step 5.1 splits a per-asset outcome into five states. The hardest of its
 * rungs to observe is `followed`: whether the work actually conformed to the
 * rule that was loaded. It is tempting to have a model read the transcript and
 * say. That is precisely what this module refuses to do.
 *
 * The rule, from step 5.2: where a rule has an OBSERVABLE FOOTPRINT, adherence
 * is computed from that footprint. Where it has none, adherence is `unknown` —
 * never inferred, never a model's guess. An inferred adherence figure is worse
 * than a missing one, because a missing one is visible in the `unknown` share
 * and an inferred one is not.
 *
 * A DETECTOR ANSWERS FOR ONE CLAUSE, NOT FOR A RULE. Rules in this tree carry
 * many clauses; `think-before-action` alone spans a read set, a verification
 * matrix, and a test-first preference. A detector that observed one clause and
 * reported "rule followed" would be overclaiming by construction, so every
 * registration below names the clause it decides and the registry key is the
 * pair, not the rule id.
 */

import type { ActivationState } from './activation_states.js';

/** The subset of {@link ActivationState} a detector may return. */
export type Adherence = Extract<
    ActivationState,
    'activated-followed' | 'activated-not-followed' | 'unknown'
>;

/**
 * One observed write, reduced to the two things a detector may see: where it
 * went, and in what order relative to the others.
 *
 * Deliberately carries NO content field — a detector that could read a diff
 * body would be a second place for file contents to travel, and the audit
 * privacy floor exists to stop exactly that.
 */
export interface WriteObservation {
    /** Repository-relative path. */
    path: string;
    /** Monotonic ordering key within one task. Absolute time is not required. */
    seq: number;
}

export interface DetectorInput {
    writes: readonly WriteObservation[];
}

export interface ClauseDetector {
    /** The rule whose clause this decides. */
    rule_id: string;
    /** Which clause — a rule has many, and a detector answers for one. */
    clause: string;
    /** Where that clause is written, so a reader can check the detector against it. */
    source: string;
    detect(input: DetectorInput): Adherence;
}

/** A path is a test path when it sits under a `tests/` segment or is named `*.test.*` / `*.spec.*`. */
export function isTestPath(p: string): boolean {
    const normalized = p.replace(/\\/g, '/');
    if (/(^|\/)tests?(\/|$)/.test(normalized)) return true;
    return /\.(test|spec)\.[cm]?[jt]sx?$/.test(normalized);
}

/**
 * `think-before-action` § "When behavior can be defined → prefer test-first /
 * TDD" (`dist/agent-src/rules/think-before-action.md:43`).
 *
 * The footprint is write ORDER: a test file written before the production file
 * it covers is test-first; the reverse is not.
 *
 * The `unknown` branch is the load-bearing one and is wider than it first
 * looks. If only test writes are observed, no production change happened and
 * the clause did not apply. If only production writes are observed, it is
 * tempting to answer `activated-not-followed` — and that would be a GUESS: the
 * test may have been written in an earlier task, or the change may be one the
 * clause's own "when behavior can be defined" qualifier excludes. Both
 * one-sided cases are therefore `unknown`, which is the honest answer and the
 * conservative one in the direction that matters — it never manufactures a
 * violation.
 */
export const testFirstDetector: ClauseDetector = {
    rule_id: 'think-before-action',
    clause: 'prefer test-first / TDD when behavior can be defined',
    source: 'dist/agent-src/rules/think-before-action.md:43',
    detect({ writes }) {
        let firstTest: number | null = null;
        let firstProd: number | null = null;
        for (const w of writes) {
            if (isTestPath(w.path)) {
                if (firstTest === null || w.seq < firstTest) firstTest = w.seq;
            } else if (firstProd === null || w.seq < firstProd) {
                firstProd = w.seq;
            }
        }
        // Either side missing means the order was never observed, not that it
        // was violated. See the note above on why the production-only case is
        // deliberately NOT a violation.
        if (firstTest === null || firstProd === null) return 'unknown';
        return firstTest < firstProd ? 'activated-followed' : 'activated-not-followed';
    },
};

/**
 * The registry. Keyed `${rule_id}#${clause}` so one rule may gain a second
 * detector later without either silently replacing the other.
 */
const DETECTORS: readonly ClauseDetector[] = [testFirstDetector];

export function detectorsFor(ruleId: string): readonly ClauseDetector[] {
    return DETECTORS.filter((d) => d.rule_id === ruleId);
}

/**
 * Adherence for one rule.
 *
 * A rule with NO registered detector returns `unknown`. That is the whole
 * point: 118 of this tree's 119 rules have no observable footprint today, and
 * the honest report says so rather than filling the column with inference.
 *
 * With several detectors registered for one rule, a single observed violation
 * wins over a `followed` — a rule is not adhered to if any decided clause was
 * broken — and `unknown` only survives when nothing was decided at all.
 */
export function detectAdherence(ruleId: string, input: DetectorInput): Adherence {
    const detectors = detectorsFor(ruleId);
    if (detectors.length === 0) return 'unknown';

    let sawFollowed = false;
    for (const d of detectors) {
        const verdict = d.detect(input);
        if (verdict === 'activated-not-followed') return 'activated-not-followed';
        if (verdict === 'activated-followed') sawFollowed = true;
    }
    return sawFollowed ? 'activated-followed' : 'unknown';
}

/** Rule ids that have at least one detector. Everything else reports `unknown`. */
export function rulesWithDetectors(): readonly string[] {
    return [...new Set(DETECTORS.map((d) => d.rule_id))];
}
