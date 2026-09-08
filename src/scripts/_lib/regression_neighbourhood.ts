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
 * TWO GRAPHS, BOTH DELIBERATE — the substitution is retired.
 *
 * The step says "the code graph". Until 2026-09-08 this module could not read
 * it: `agent-config code-graph detect` answered `no code-graph source detected`
 * in a fresh checkout, so it selected over the artefact graph instead and said
 * so. `road-to-a-graph-that-is-shipped` removed that premise — Phase 0.1 ships
 * the parsers, Phase 1 builds the graph on install, and 3.1 added
 * `impact --diff`, which is the reverse-reachability query this selector needs.
 *
 * So both surfaces are now first-class, and which one a candidate uses is a
 * property OF THE CANDIDATE rather than of what happened to resolve:
 *
 *   · **Code candidates** — a diff that edits `.ts` / `.php` symbols. Use
 *     {@link selectRegressionsFromCode}, which neighbours by SYMBOL relations
 *     over the native graph, filtered to accepted mechanisms
 *     (`resolved_via` not in `{name-lookup, dynamic}`) so a same-name guess
 *     never selects a regression.
 *   · **Artefact candidates** — a diff that edits rules, skills, guidelines.
 *     Use {@link selectRegressions}, which neighbours by ARTEFACT relations
 *     over `src/scripts/discovery_graph.ts` (`supersedes`, `routes_to`,
 *     `references_adr`, pack and workspace membership). For a rule rewrite that
 *     is the graph carrying the coupling a change can break; the code graph
 *     does not model it at all.
 *
 * Neither is a fallback for the other, and neither is silent: both paths REFUSE
 * through {@link selectionVerdict} when a touched surface is absent from the
 * graph they read, because an unknown neighbourhood is not an empty one.
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
import type { GraphState } from '../code_graph/detect.js';
import type { LoadedGraph } from '../code_graph/query.js';
import { impact } from '../code_graph/verbs.js';
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
     * Which graph answered. Present so a verdict record can never be read as a
     * claim about the other surface — the failure the retired substitution
     * section describes, arriving through the report instead of through the
     * docstring.
     */
    graph: 'artefact' | 'code';
    /**
     * The graph's freshness at selection time: `fresh` / `behind:N` / `absent`
     * on the code path, `null` on the artefact path (which is derived from the
     * committed manifest and has no staleness axis).
     *
     * Added after an independent review found the code path hardcoding
     * `'absent'` and dropping the value: the verbs are required to report
     * staleness, `verbs.ts` argues the whole point is telling "dead" from "dead
     * as of a graph 40 commits behind" — and the one in-repo CONSUMER of those
     * verbs discarded it, so no selection could refuse on a stale graph.
     */
    graph_state: GraphState | null;
    /**
     * Touched files in a language the code graph does not index. NOT a refusal
     * reason: an unindexed `.md` is a file with no symbols, which is a fact
     * about the language set rather than an unknown neighbourhood.
     */
    not_indexed: readonly string[];
    /**
     * The edges that produced the neighbourhood, rendered, sorted.
     *
     * Required by step 3.4: *"the selected regressions and the producing edges
     * enter the verdict record"*. Empty on the artefact path, whose `affected`
     * BFS returns a relation name per hop rather than an edge — stated rather
     * than faked, because an empty list a reader can attribute is better than a
     * synthesised one they cannot.
     */
    producing_edges: readonly string[];
    /**
     * The `resolved_via` histogram of the edges the walk REFUSED, on the code
     * path. A selection that looks narrow because half the graph was a guess
     * reads very differently from one that looks narrow because the code is
     * decoupled, and this is the only field that distinguishes them.
     */
    rejected_via: string;
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
        graph: 'artefact',
        graph_state: null,
        not_indexed: [],
        producing_edges: [],
        rejected_via: '(not applicable — the artefact graph has no mechanism axis)',
        authored: 0,
    };
}

/**
 * The code-graph path (step 3.4).
 *
 * Neighbours a candidate by the symbols its diff touched, over the native code
 * graph, using the same `impact --diff` reverse walk the CLI verb exposes. The
 * neighbourhood's nodes are the seeds at depth 0 (`touched`) plus every
 * accepted reverse-reachable node at its shallowest depth (`neighbour`), which
 * is the identical shape {@link neighbourhood} produces for the artefact graph
 * — so `selectRegressions`' matching logic is reused rather than forked.
 *
 * `touches` is read as FILE paths here, not artefact ids: a code candidate is a
 * diff, and a diff names files. A touched file with no node in the graph lands
 * in `unresolved` and therefore refuses through {@link selectionVerdict}, on
 * exactly the terms the artefact path already uses.
 */
export function selectRegressionsFromCode(
    g: LoadedGraph,
    candidate: Candidate,
    registry: readonly RegressionSpec[],
    depth: number = DEFAULT_NEIGHBOURHOOD_DEPTH,
    isTest: (relPath: string) => boolean = () => false,
    graphState: GraphState = 'absent',
): NeighbourhoodReport {
    const res = impact(g, candidate.touches, graphState, depth, isTest);
    const best = new Map<string, NeighbourhoodNode>();
    for (const seed of res.seeds) {
        best.set(seed, { node: seed, reason: 'touched', depth: 0, via: '', synthetic: false });
    }
    for (const r of res.reached) {
        if (best.has(r.node)) continue;
        best.set(r.node, {
            node: r.node,
            reason: 'neighbour',
            depth: r.depth,
            via: `${r.via}/${r.resolved_via}`,
            synthetic: false,
        });
    }
    const hood = [...best.values()].sort((a, b) => a.depth - b.depth || a.node.localeCompare(b.node));
    const reasonOf = new Map<string, NeighbourReason>(hood.map((n) => [n.node, n.reason]));
    const selected: Selection[] = [];
    const skipped: string[] = [];
    for (const spec of registry) {
        const matched = spec.guards.filter((x) => reasonOf.has(x)).sort((a, b) => a.localeCompare(b));
        if (matched.length === 0) {
            skipped.push(spec.id);
            continue;
        }
        selected.push({
            spec,
            matched,
            reason: matched.some((m) => reasonOf.get(m) === 'touched') ? 'touched' : 'neighbour',
        });
    }
    return {
        candidate_id: candidate.id,
        neighbourhood: hood,
        unresolved: [...res.unresolved_files].sort((a, b) => a.localeCompare(b)),
        selected: selected.sort((a, b) => a.spec.id.localeCompare(b.spec.id)),
        skipped: skipped.sort((a, b) => a.localeCompare(b)),
        graph: 'code',
        graph_state: graphState,
        not_indexed: [...res.not_indexed_files].sort((a, b) => a.localeCompare(b)),
        producing_edges: [...res.producing_edges].sort(),
        rejected_via: res.rejected_via,
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
    // An ABSENT graph is the case the artefact path's own docstring warns
    // about in the other direction: a lookup that cannot resolve and then
    // selects nothing reports a clean sheet. `behind:N` is deliberately NOT a
    // refusal — a stale graph still answers, and blocking on staleness would
    // be the blocking-gate-on-a-stale-graph that K7 forbids. It is surfaced
    // through `graph_state` so a caller that wants to refuse can.
    if (report.graph === 'code' && report.graph_state === 'absent') {
        reasons.push(
            'the code graph is absent — a neighbourhood computed over no graph is empty for a ' +
                'reason that has nothing to do with the candidate. Run `agent-config code-graph build`.',
        );
    }
    if (report.unresolved.length > 0) {
        // Named per graph: a code-path refusal that said "relation graph" would
        // point a reader at the wrong surface to go fix.
        const which = report.graph === 'code' ? 'code graph' : 'artefact relation graph';
        reasons.push(
            `touched surfaces absent from the ${which}: ${report.unresolved.join(', ')} — ` +
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
