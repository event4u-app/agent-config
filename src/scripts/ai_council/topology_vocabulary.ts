/**
 * The council-rung topology vocabulary, closed at seven names.
 *
 * `road-to-inbox-harvest-2026-08-e-council-topology-evidence` step 7.1 asks
 * for a vocabulary that "admits no eighth member without a schema change" and
 * in which `team` / `user_required` are "not representable". Those are two
 * different claims and they need two different mechanisms, so this module
 * carries both.
 *
 * ## Where this sits — and what it deliberately is NOT
 *
 * It is **not** a resolver. `src/scripts/_lib/judgment_ladder.ts` is the ONE
 * task-side resolver, and `src/scripts/_lib/one_resolver_invariant.ts` fails
 * the build on a second one. This module exports a NAME SET and two
 * predicates; it classifies nothing, reads no request, and takes no routing
 * decision. It also lives under `ai_council/`, which the one-resolver scan
 * treats as council-internal and skips by construction — the topology
 * refinement hangs off the council rung *after* the ladder has already
 * resolved to it, exactly as the roadmap's goal diagram draws it.
 *
 * The selector that will eventually CONSUME this vocabulary is step 7.2 and is
 * not built here. Shipping the vocabulary first is deliberate: it is the half
 * that can be closed without pre-empting the selector's design.
 *
 * ## Claim 1 — no eighth member without a source change that fails a gate
 *
 * {@link COUNCIL_TOPOLOGIES} is a frozen `as const` tuple, so its `length` is
 * the literal `7` and {@link CouncilTopology} is a closed union. Appending an
 * eighth entry turns the length into `8`, and {@link VocabularyIsClosed}'s
 * first assertion then fails `npm run typecheck` — a CI gate. The same edit
 * also fails {@link auditCouncilTopologyVocabulary}, which is the runtime half
 * for the compiled `dist/` path where types no longer exist.
 *
 * ## Claim 2 — `team` and `user_required` are not representable
 *
 * Omitting two strings from a list is the weak form: nothing stops the next
 * author adding them. The strong form binds the exclusion to the vocabularies
 * that actually own those names, via TYPE-ONLY imports that are erased at
 * compile time and couple nothing at runtime:
 *
 * - `team` is a `LadderVerdict` — rung 3, `judgment_ladder.ts:45`. The ladder
 *   owns it.
 * - `user_required` is an `ImpactClass` — `necessity.ts:550`, and it sits in
 *   `LOCKED_IMPACT_CLASSES` (`necessity.ts:557-560`), the set structurally
 *   locked to `user` routing. The Hard Floor owns it.
 *
 * {@link VocabularyIsClosed} asserts that NO `LadderVerdict` and NO
 * `ImpactClass` is a `CouncilTopology` — which is stronger than naming two
 * strings, because it also excludes `script`, `subagent`, `council`, `ask`,
 * `in-session`, `high_impact` and the rest. It further asserts that the two
 * names in {@link RESERVED_BY_OTHER_LAYERS} really ARE members of those
 * foreign vocabularies, so a rename on the ladder or in the necessity gate
 * reds this file rather than silently orphaning the exclusion.
 *
 * ## Why not a JSON schema, and why not the config contract
 *
 * `src/scripts/schemas/` carries no council schema at all — `.ai-council.yml`
 * is validated by the hand-rolled loader in `ai_council/config.ts`, so there
 * is no enum surface there to extend. And this vocabulary is deliberately
 * absent from `docs/contracts/ai-council-config.md`: that document describes
 * what a USER may configure, while step 12.4 requires consumer surfaces to
 * request capabilities and never topology names. Documenting it as config
 * would invite exactly the coupling 12.4 forbids.
 */
import type { LadderVerdict } from '../_lib/judgment_ladder.js';

import type { ImpactClass } from './necessity.js';

/**
 * The closed topology vocabulary, verbatim from the roadmap's goal diagram
 * (`road-to-inbox-harvest-2026-08-e-council-topology-evidence.md:62-68`).
 * Order is the diagram's order and carries no precedence.
 */
export const COUNCIL_TOPOLOGIES = Object.freeze([
    'single_external',
    'dual_independent',
    'advisor_diversity',
    'peer_review',
    'judge_synthesis',
    'targeted_cross_exam',
    'full_debate',
] as const);

/** The closed union. There is no widening escape hatch on purpose. */
export type CouncilTopology = (typeof COUNCIL_TOPOLOGIES)[number];

/** Declared arity. Changing the tuple without changing this reds the type layer. */
export const COUNCIL_TOPOLOGY_ARITY = 7;

/**
 * Names owned by other layers, restated here so the runtime half can reject
 * them without importing a value across the layer boundary. The type layer
 * below pins each one to its real owning vocabulary.
 */
export const RESERVED_BY_OTHER_LAYERS = Object.freeze(['team', 'user_required'] as const);

/** A name this vocabulary must never admit. */
export type ReservedElsewhere = (typeof RESERVED_BY_OTHER_LAYERS)[number];

/** Fails to instantiate unless `T` is exactly `true`. */
type Assert<T extends true> = T;

/**
 * The compile-time half of both claims. Every member must stay `true`; each
 * one is a distinct way the vocabulary could be opened, and `npm run
 * typecheck` is the gate that runs them.
 *
 * 1. arity is exactly {@link COUNCIL_TOPOLOGY_ARITY} — an eighth member reds it
 * 2. no ladder verdict is a topology — `team` included, by construction
 * 3. no impact class is a topology — `user_required` included, by construction
 * 4. both reserved names are real members of those foreign vocabularies, so a
 *    rename upstream cannot orphan the exclusion into a dead string
 * 5. neither reserved name is representable as a topology
 *
 * The `[X] extends [never]` tuple form is deliberate: it suppresses
 * distribution, so an empty `Extract` reads as the single type `never` rather
 * than as an empty union of branches.
 */
export type VocabularyIsClosed = [
    Assert<(typeof COUNCIL_TOPOLOGIES)['length'] extends typeof COUNCIL_TOPOLOGY_ARITY ? true : false>,
    Assert<[Extract<CouncilTopology, LadderVerdict>] extends [never] ? true : false>,
    Assert<[Extract<CouncilTopology, ImpactClass>] extends [never] ? true : false>,
    Assert<ReservedElsewhere extends LadderVerdict | ImpactClass ? true : false>,
    Assert<[Extract<CouncilTopology, ReservedElsewhere>] extends [never] ? true : false>,
];

/** Is this value one of the seven? `team` and `user_required` are not. */
export function isCouncilTopology(value: unknown): value is CouncilTopology {
    return typeof value === 'string' && (COUNCIL_TOPOLOGIES as readonly string[]).includes(value);
}

/**
 * The runtime half, and the reason it takes arguments rather than reading the
 * constants directly: a guard that can only ever be handed the correct input
 * has unknown sensitivity. Callers in `dist/` pass the shipped constants; the
 * test passes mutations and asserts each one is caught.
 *
 * @returns one string per problem found; empty means the vocabulary is closed.
 */
export function auditCouncilTopologyVocabulary(
    topologies: readonly string[] = COUNCIL_TOPOLOGIES,
    reserved: readonly string[] = RESERVED_BY_OTHER_LAYERS,
): string[] {
    const problems: string[] = [];
    if (topologies.length !== COUNCIL_TOPOLOGY_ARITY) {
        problems.push(
            `arity: expected exactly ${COUNCIL_TOPOLOGY_ARITY} topologies, found ${topologies.length}. ` +
                'The vocabulary is closed; an eighth member is a schema change, not an append.',
        );
    }
    if (new Set(topologies).size !== topologies.length) {
        problems.push('duplicate: the vocabulary contains a repeated name.');
    }
    for (const name of reserved) {
        if (topologies.includes(name)) {
            problems.push(
                `reserved: \`${name}\` is owned by another layer (the judgment ladder for ` +
                    '`team`, the locked impact classes for `user_required`) and is not ' +
                    'representable as a council topology.',
            );
        }
    }
    return problems;
}

/**
 * Module-load guard. Types are erased in `dist/`, so without this the runtime
 * artefact carries no version of claim 1 or claim 2 at all. It can only fire
 * on a source edit that also reds `npm run typecheck`, which is the point:
 * two independent layers, not one restated twice.
 */
const _shippedProblems = auditCouncilTopologyVocabulary();
if (_shippedProblems.length > 0) {
    throw new Error(`council topology vocabulary is not closed:\n  ${_shippedProblems.join('\n  ')}`);
}
