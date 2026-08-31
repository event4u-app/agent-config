/**
 * Regression selection from the affected neighbourhood.
 *
 * `road-to-governed-harness-evolution` Phase 4, step 4.6.
 *
 * > *Use the code graph to choose which regressions to run for a given
 * > candidate. The master adopted the attack "local improvement, global
 * > regression" as a risk with no mechanism behind it. This is distinct from
 * > the killed curriculum generator — it selects existing regressions, it does
 * > not author tasks.*
 * > verify: **a candidate touching one surface runs the regressions its
 * > neighbourhood names, and a fixture proves a neighbour regression is
 * > caught.**
 *
 * ## Which graph, and why it is not the one the step names
 *
 * The step says "the code graph". This tree has two graph surfaces and only one
 * of them resolves here, so the substitution is STATED rather than hidden.
 *
 *   · `agent-config code-graph` — the native code-graph engine (ADR-124). It
 *     ships `hooks.code_graph.enabled: false`
 *     (`src/config/agent-settings.template.yml:1373-1374`), and
 *     `agent-config code-graph detect` in this checkout answers
 *     `no code-graph source detected`. There is no index to select against.
 *   · `src/scripts/discovery_graph.ts` — this suite's OWN artefact relation
 *     graph, five typed edges extracted from the discovery manifest's
 *     structured fields, with an `affected` BFS already implemented and
 *     answering. That is the surface this module builds on.
 *
 * The substitution changes what a "neighbourhood" means, and the difference is
 * worth naming: the native engine would neighbour a candidate by SYMBOL
 * relations, while `discovery_graph` neighbours it by ARTEFACT relations
 * (`supersedes`, `routes_to`, `references_adr`, pack and workspace membership).
 * For this roadmap's candidates — rules, skills, guidelines — the artefact
 * graph is the one that carries the coupling a rewrite can break. For a
 * candidate that edits a `.ts` symbol, it is the weaker surface, and this
 * module says so through {@link selectionVerdict}: a touched surface absent
 * from the graph is REFUSED, never silently neighboured with the empty set.
 *
 * ## Why an unresolved surface refuses instead of selecting nothing
 *
 * A selector whose neighbourhood lookup fails and then runs zero regressions
 * reports a clean sheet, which is indistinguishable from a candidate that
 * genuinely touches nothing coupled. That is exactly the "local improvement,
 * global regression" hole the step exists to close, arriving through the
 * selector rather than around it. So an unresolved touched surface is a
 * refusal reason, and there is no option flag that relaxes it.
 *
 * ## Selects, never authors — carried by object identity (K9)
 *
 * K9 killed the curriculum generator. This module has no code path that
 * constructs a {@link RegressionSpec}: every selected entry is an element of
 * the registry the caller supplied, returned by reference, so
 * `registry.includes(selected.spec)` holds by identity for every selection.
 * A test asserts that identity rather than an id match, because an id match
 * would also be satisfied by a synthesized spec carrying a copied id.
 */
import { affected, isSyntheticNode, type Graph } from '../discovery_graph.js';

/**
 * An EXISTING regression, as the registry holds it. `guards` names the artefact
 * ids whose breakage this regression would detect.
 *
 * Nothing in this module builds one of these. It is the caller's registry entry,
 * passed through by reference.
 */
export interface RegressionSpec {
    id: string;
    guards: readonly string[];
}

/** A candidate under evaluation, reduced to the surfaces it touches. */
export interface Candidate {
    id: string;
    /** Artefact ids the candidate's diff touches. */
    touches: readonly string[];
}

/** Why a node is in the neighbourhood: the candidate touched it, or a relation reached it. */
export type NeighbourReason = 'touched' | 'neighbour';

export interface NeighbourhoodNode {
    node: string;
    reason: NeighbourReason;
    /** Hop distance from the nearest touched surface. `0` for a touched surface. */
    depth: number;
    /** The relation that reached it, or `''` for a touched surface. */
    via: string;
    /** True for `pack:` / `workspace:` container nodes the graph invents. */
    synthetic: boolean;
}

export interface Selection {
    spec: RegressionSpec;
    /** The neighbourhood nodes this regression guards, sorted. */
    matched: readonly string[];
    /** `touched` when it guards a surface the candidate edited, else `neighbour`. */
    reason: NeighbourReason;
}

export interface NeighbourhoodReport {
    candidate_id: string;
    neighbourhood: readonly NeighbourhoodNode[];
    /** Touched surfaces that are not nodes in the graph. A refusal reason, not a warning. */
    unresolved: readonly string[];
    selected: readonly Selection[];
    /** Registry entries whose guards intersect nothing in the neighbourhood. */
    skipped: readonly string[];
    /**
     * Literal 0. This module selects from a registry; a non-zero value here
     * would mean it authored a task, which is K9.
     */
    authored: 0;
}

/**
 * Hops walked out from each touched surface.
 *
 * A STATED default, not a measured optimum. Two is the smallest depth that
 * reaches a `routes_to` target AND that target's own container membership, so a
 * rule edit neighbours the skill it routes to and the pack that skill sits in.
 * `revisit-if` a run selects a regression nobody can explain from the diff, or
 * a real breakage lands outside the two-hop set.
 */
export const DEFAULT_NEIGHBOURHOOD_DEPTH = 2;

/**
 * The neighbourhood of a candidate: every touched surface, plus everything the
 * relation graph reaches from it within `depth` hops.
 *
 * Deterministic — nodes are emitted at their shallowest depth and sorted by
 * `(depth, node)`, so two runs over the same graph produce byte-identical
 * reports.
 */
export function neighbourhood(
    graph: Graph,
    candidate: Candidate,
    depth: number = DEFAULT_NEIGHBOURHOOD_DEPTH,
): NeighbourhoodNode[] {
    const best = new Map<string, NeighbourhoodNode>();
    for (const t of candidate.touches) {
        best.set(t, { node: t, reason: 'touched', depth: 0, via: '', synthetic: isSyntheticNode(t) });
    }
    for (const t of candidate.touches) {
        for (const hit of affected(graph, t, depth)) {
            const prior = best.get(hit.node);
            if (prior !== undefined && prior.depth <= hit.depth) continue;
            best.set(hit.node, {
                node: hit.node,
                reason: 'neighbour',
                depth: hit.depth,
                via: hit.via,
                synthetic: isSyntheticNode(hit.node),
            });
        }
    }
    return [...best.values()].sort((a, b) => a.depth - b.depth || a.node.localeCompare(b.node));
}

/** Touched surfaces the graph does not know about. */
export function unresolvedSurfaces(graph: Graph, candidate: Candidate): string[] {
    const known = new Set(graph.nodes);
    return candidate.touches.filter((t) => !known.has(t)).sort((a, b) => a.localeCompare(b));
}

/**
 * Select the registry entries whose guards intersect the candidate's
 * neighbourhood.
 *
 * The returned `spec` values are the caller's registry objects, by reference.
 */
export function selectRegressions(
    graph: Graph,
    candidate: Candidate,
    registry: readonly RegressionSpec[],
    depth: number = DEFAULT_NEIGHBOURHOOD_DEPTH,
): NeighbourhoodReport {
    const hood = neighbourhood(graph, candidate, depth);
    const reasonOf = new Map<string, NeighbourReason>(hood.map((n) => [n.node, n.reason]));
    const selected: Selection[] = [];
    const skipped: string[] = [];
    for (const spec of registry) {
        const matched = spec.guards.filter((g) => reasonOf.has(g)).sort((a, b) => a.localeCompare(b));
        if (matched.length === 0) {
            skipped.push(spec.id);
            continue;
        }
        const reason: NeighbourReason = matched.some((m) => reasonOf.get(m) === 'touched')
            ? 'touched'
            : 'neighbour';
        selected.push({ spec, matched, reason });
    }
    return {
        candidate_id: candidate.id,
        neighbourhood: hood,
        unresolved: unresolvedSurfaces(graph, candidate),
        selected: selected.sort((a, b) => a.spec.id.localeCompare(b.spec.id)),
        skipped: skipped.sort((a, b) => a.localeCompare(b)),
        authored: 0,
    };
}

/**
 * `null` when the selection may be trusted, otherwise every reason it may not.
 *
 * Fail-closed by construction: no option object relaxes a reason, so a caller
 * who wants to proceed on an unresolved surface has to delete this call — which
 * is visible in a diff — rather than pass a flag, which is not.
 */
export function selectionVerdict(report: NeighbourhoodReport): readonly string[] | null {
    const reasons: string[] = [];
    if (report.unresolved.length > 0) {
        reasons.push(
            `touched surfaces absent from the relation graph: ${report.unresolved.join(', ')} — ` +
                'their neighbourhood is unknown, and an unknown neighbourhood is not an empty one',
        );
    }
    if (report.neighbourhood.length === 0) {
        reasons.push('empty neighbourhood — the candidate touches nothing the graph knows');
    }
    return reasons.length === 0 ? null : reasons;
}

/** One regression's observed result on a candidate. */
export interface RegressionOutcome {
    regression_id: string;
    passed: boolean;
}

export interface CatchReport {
    /** Selected regressions that FAILED — the breakages this selection caught. */
    caught: readonly string[];
    /**
     * Regressions that failed but were never selected, so their failure was
     * never observed. Present so a miss is countable rather than invisible.
     */
    missed: readonly string[];
}

/**
 * Split observed regression outcomes by whether the selection actually ran them.
 *
 * `outcomes` is the full registry's result — what WOULD have been observed had
 * everything run. `caught` is the part the neighbourhood selection reached;
 * `missed` is the part it did not. A selector that narrows too far shows up
 * here as a non-empty `missed`, which is what makes the fixture in
 * `tests/scripts/regression_neighbourhood.test.ts` falsifiable.
 */
export function catchReport(
    report: NeighbourhoodReport,
    outcomes: readonly RegressionOutcome[],
): CatchReport {
    const ran = new Set(report.selected.map((s) => s.spec.id));
    const failed = outcomes.filter((o) => !o.passed).map((o) => o.regression_id);
    return {
        caught: failed.filter((id) => ran.has(id)).sort((a, b) => a.localeCompare(b)),
        missed: failed.filter((id) => !ran.has(id)).sort((a, b) => a.localeCompare(b)),
    };
}
