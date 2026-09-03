/**
 * The binding that joins an `evolution_lab run` to a frozen `ExperimentSpec`.
 *
 * `experiment_freeze.ts` sits between two mechanisms that both stop looking
 * before the interesting window opens. `evolution_lab` fails closed on a
 * holdout leak and on a budget breach, and both guards fire BEFORE the run
 * starts. `corpus_manifest` pins the corpus as a capture taken at a moment and
 * compared by a human running a verb. Neither watches the run while it happens,
 * and `verbRun` has a real mid-run window: it walks the record set once to
 * clone, then RE-READS every record from disk to evaluate it. A record
 * rewritten between those two reads yields a run that cloned one thing and
 * scored another, and every individual reading looks fine.
 *
 * This is the join, not a second pinning scheme: the five frozen elements are
 * built from identities the run already carries — the cascade stage order, a
 * digest of the record set, the promotion-evidence field set, the unmutated
 * tree shape every clone is made from, and the protected surfaces each clone
 * inherits. A freeze over invented identities freezes nothing, because nothing
 * else in the process reads them.
 *
 * The digest is deliberately not persisted. A freeze whose scope is one process
 * needs no store, and a stored digest immediately raises the question of who
 * invalidates it.
 */

import * as crypto from 'node:crypto';

import { WITH_SURFACES, target_shape_hash } from '../bench_ab_clone.js';
import { CASCADE_STAGES } from './evaluation_cascade.js';
import { PROMOTION_EVIDENCE_FIELDS } from './promotion_evidence.js';
import type { ExperimentSpec } from './experiment_freeze.js';

/**
 * Identity of the evaluator: which stages, in which order.
 *
 * Order is part of the identity and is NOT sorted away. The cascade is a
 * cheapest-first sequence whose whole economic claim is that an early stage
 * aborts before an expensive one runs; two runs that scored the same candidates
 * in a different stage order did not use the same evaluator.
 */
export function evaluatorIdentity(): string {
    return `evaluation-cascade:${CASCADE_STAGES.join('>')}`;
}

/**
 * Identity of the task the arms are scored against.
 *
 * Sorted, unlike the evaluator: the evidence fields are a SET a candidate must
 * satisfy, and the order they happen to be declared in is not a property of the
 * task.
 */
export function taskIdentity(): string {
    return `promotion-evidence:${[...PROMOTION_EVIDENCE_FIELDS].sort().join('+')}`;
}

/**
 * A digest over the record set actually being run.
 *
 * Takes `(path, bytes)` pairs rather than reading the files itself, so the
 * caller decides what "the record set" is and this function stays pure. Sorted
 * by path, because the order a directory happened to enumerate in is not a
 * property of the corpus — the same argument `experiment_freeze` makes for
 * fixtures.
 */
export function recordSetDigest(entries: ReadonlyArray<readonly [path: string, bytes: string]>): string {
    const h = crypto.createHash('sha256');
    for (const [p, bytes] of [...entries].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))) {
        h.update(`${p}\n`, 'utf-8');
        h.update(crypto.createHash('sha256').update(bytes, 'utf-8').digest('hex'), 'utf-8');
        h.update('\n', 'utf-8');
    }
    return `records:${h.digest('hex').slice(0, 32)}`;
}

/**
 * Build the spec for one `evolution_lab run`.
 *
 * `readFile` is injected so the same construction is exercised in a test
 * without a repository tree, and `baseline` is injected for the same reason —
 * `target_shape_hash()` walks a fixture directory, which a unit test has no
 * business depending on.
 */
export function buildRunSpec(
    recordFiles: readonly string[],
    readFile: (p: string) => string,
    baseline: string = target_shape_hash(),
): ExperimentSpec {
    return {
        evaluator: evaluatorIdentity(),
        corpus: recordSetDigest(recordFiles.map((f) => [f, readFile(f)] as const)),
        task: taskIdentity(),
        baseline,
        fixtures: [...WITH_SURFACES],
    };
}
