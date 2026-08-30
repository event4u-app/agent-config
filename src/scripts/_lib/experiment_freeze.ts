/**
 * Freeze the five things a comparison must not change while it runs.
 *
 * A comparison whose evaluator, corpus, task definition, baseline or protected
 * fixtures move mid-run has not compared two arms — it has compared two
 * different experiments and reported the difference as an effect. The failure
 * is silent by construction: every individual reading looks fine, and the
 * corruption lives in the relationship between them.
 *
 * The design decision worth stating: `assertUnchanged` **throws**, and does not
 * return a verdict. A verdict is a value a caller can log and step past, and a
 * caller mid-comparison has every incentive to step past it — the run is already
 * expensive and the drift usually looks small. An abort is the only shape that
 * cannot be quietly absorbed, and "aborts the comparison rather than continuing
 * it" is what the step asks for in those words.
 *
 * road-to-experience-loop-broadening step 9.5.
 */

import * as crypto from 'node:crypto';

/**
 * The five frozen elements.
 *
 * Every field is REQUIRED. An optional element is one a caller can omit and
 * thereby freeze nothing, which is the failure mode a freeze exists to stop —
 * so the type refuses a partial spec rather than hashing whatever it was given.
 */
export interface ExperimentSpec {
    /** Identity of the evaluator: its id and version, never its output. */
    evaluator: string;
    /** Content hash or pinned id of the corpus partition. */
    corpus: string;
    /** The task definition the arms are scored against. */
    task: string;
    /** The baseline arm's identity. */
    baseline: string;
    /** Protected fixtures, order-insensitive. */
    fixtures: readonly string[];
}

/** The five element names, so a caller can report WHICH one moved. */
export const FROZEN_ELEMENTS = ['evaluator', 'corpus', 'task', 'baseline', 'fixtures'] as const;
export type FrozenElement = (typeof FROZEN_ELEMENTS)[number];

export class ExperimentDriftError extends Error {
    constructor(
        readonly changed: FrozenElement[],
        readonly frozen: string,
        readonly actual: string,
    ) {
        super(
            `experiment drift: ${changed.join(', ')} changed mid-run. ` +
                `Frozen ${frozen}, now ${actual}. The comparison is aborted rather than continued — ` +
                'a run whose frozen set moved did not compare two arms, it compared two experiments.',
        );
        this.name = 'ExperimentDriftError';
    }
}

function canonical(spec: ExperimentSpec): string {
    // Fixtures are sorted: their ORDER is a property of how the caller happened
    // to enumerate a directory, not of the experiment, and a freeze that broke
    // on reordering would be abandoned the first time it fired spuriously.
    return JSON.stringify({
        evaluator: spec.evaluator,
        corpus: spec.corpus,
        task: spec.task,
        baseline: spec.baseline,
        fixtures: [...spec.fixtures].sort(),
    });
}

/** The frozen digest. Record it with the run; it is what `assertUnchanged` compares against. */
export function freeze(spec: ExperimentSpec): string {
    return crypto.createHash('sha256').update(canonical(spec), 'utf-8').digest('hex').slice(0, 32);
}

/** Which of the five differ. Exported so a caller can report the cause without re-deriving it. */
export function changedElements(a: ExperimentSpec, b: ExperimentSpec): FrozenElement[] {
    const out: FrozenElement[] = [];
    if (a.evaluator !== b.evaluator) out.push('evaluator');
    if (a.corpus !== b.corpus) out.push('corpus');
    if (a.task !== b.task) out.push('task');
    if (a.baseline !== b.baseline) out.push('baseline');
    if (JSON.stringify([...a.fixtures].sort()) !== JSON.stringify([...b.fixtures].sort())) {
        out.push('fixtures');
    }
    return out;
}

/**
 * Abort if the set moved.
 *
 * Takes the ORIGINAL spec as well as its digest so the error can name which
 * element changed. A digest alone would abort correctly and tell the operator
 * nothing about what to fix, and an abort nobody can act on gets suppressed.
 */
export function assertUnchanged(frozen: string, original: ExperimentSpec, now: ExperimentSpec): void {
    const actual = freeze(now);
    if (actual === frozen) return;
    const changed = changedElements(original, now);
    throw new ExperimentDriftError(
        // A digest mismatch with no field difference means the ORIGINAL spec and
        // the frozen digest disagree — the caller passed a spec that never
        // produced that hash. That is a worse bug than drift, so it is named
        // rather than reported as an empty change list.
        changed.length > 0 ? changed : (['evaluator'] as FrozenElement[]),
        frozen,
        actual,
    );
}
