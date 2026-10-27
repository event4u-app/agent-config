/**
 * The code-graph MCP tools (`road-to-a-graph-that-is-shipped` 4.1).
 *
 * `graph_impact`, `graph_tests_for`, `graph_dead`, `graph_query`, `graph_path`
 * — and `graph_node`, added by `road-to-a-graph-that-feeds-the-gate` 3.1. The
 * first five all answer about a NEIGHBOURHOOD or a SET; none answered "where
 * does this live, who reaches it, what does it reach, how connected is it",
 * which is the question an agent asks first and had to assemble from two calls
 * and a file read.
 *
 * They are the agent-facing half of Phase 3: the verbs exist on the CLI and an
 * agent that has to shell out to reach them will not, so the engine's answers
 * were unreachable from the surface the consumer actually talks to. Risk-Register
 * rank 1 is precisely "the install grows and the graph is still unread"; these
 * are the readers.
 *
 * REGISTERED HERE, NOT IN `tools.ts`.
 *
 * `tools.ts` sits ~500 lines past the 1500-line ceiling
 * `check_source_size_budget` enforces as a shrink-only ratchet, so five tool
 * records with their schemas would cost ~150 units of excess there and nothing
 * here. `tools.ts` spreads {@link GRAPH_TOOLS} into `ALLOWLIST`, which is two
 * lines — paid for by moving `_strip` / `_resolvePath` out to `path_util.ts` in
 * the same change.
 *
 * TELEMETRY NEEDS NO PER-TOOL WORK.
 *
 * `ToolCache.dispatch` records every `tools/call` centrally, so these five emit
 * the identical line the other 31 do by being in `ALLOWLIST` at all — which is
 * what the step's "same telemetry line as the other 31" asks for, and is
 * stronger than a per-tool emit because it cannot be forgotten.
 *
 * READ-ONLY, WITH ONE HONEST EXCEPTION.
 *
 * Four are `side_effect: 'ro'`. `graph_impact` is `'shell'`, because it resolves
 * its `diff` argument by running `git diff --name-only`. That subprocess is
 * read-only in effect, and the enum has no value that says so — between
 * understating the mechanism as `'ro'` and naming it, naming it is the only
 * choice a capability enum exists to support.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { DEFAULT_ANSWER_BUDGET, budgetImpactReport } from '../code_graph/answer_budget.js';
import { changedFiles } from '../code_graph/cli.js';
import { detectSources, graphState, pickSource } from '../code_graph/detect.js';
import { graphHome } from '../code_graph/graph_home.js';
import { advisoryImpact, whereUsed } from '../code_graph/estate_cli.js';
import { openEstate } from '../code_graph/estate_index.js';
import { touchHome } from '../code_graph/graph_budget.js';
import { resolveProjectRef } from '../code_graph/project_ref.js';
import { repoIdentity } from '../code_graph/repo_identity.js';
import { readRegistry, repoIdOf } from '../_lib/project_registry.js';
import { resolvePath } from './path_util.js';
import { isTestFile } from '../code_graph/build.js';
import { confirmIds } from '../code_graph/verify/confirm.js';
import { overlayState, overlayView, readOverlay } from '../code_graph/verify/overlay.js';
import { contextPack } from '../code_graph/verify/pack.js';
import { workingChanges } from '../code_graph/verify/paths.js';
import { usageLowerBound } from '../code_graph/verify/verify_cli.js';
import { graphChecksum, loadIndexedGraph } from '../code_graph/verify/owner_index.js';
import {
    loadGraph,
    type LoadedGraph,
    node as graphNodeVerb,
    resolveExactNode,
    resolveSeeds,
    type NodeOptions,
    path as graphPathVerb,
    query as graphQueryVerb,
    tree as graphTreeVerb,
    type TreeOptions,
} from '../code_graph/query.js';
import { diffHunks, reviewRisk } from '../code_graph/review_risk.js';
import type { CodeGraph, Relation } from '../code_graph/types.js';
import { RELATIONS as VOCAB_RELATIONS } from '../code_graph/vocabulary.js';
import {
    dead,
    entryPointsFromFile,
    impact,
    repoEntryPoints,
    testsFor,
    untested,
} from '../code_graph/verbs.js';
import { areaReport, graphGeneration, readMap } from '../code_graph/map.js';
import { blastMembers, mapHealthReport } from '../code_graph/map_answers.js';
import type { MapModel } from '../code_graph/map_model.js';
import type { BuiltinTool } from './tools.js';

/**
 * Registered projects whose graph exists, for a root that has none (5.2). Read
 * from the local registry only; the graph files themselves are not opened.
 *
 * Any MCP caller can reach this answer, so it never names another repository's
 * path: only another checkout of the server root's own repository is listed
 * with its root, and other projects appear — by id and name — only while the
 * owner has switched the estate index on (O1).
 */
function projectsWithGraph(root: string): Array<{ id: string; name: string; root?: string }> {
    const reg = readRegistry();
    const self = repoIdentity(root).repoId;
    let real: string;
    try {
        real = fs.realpathSync(root);
    } catch {
        real = path.resolve(root);
    }
    const out: Array<{ id: string; name: string; root?: string }> = [];
    for (const [id, e] of Object.entries(reg.projects)) {
        const same = repoIdOf(id) === self;
        if (!same && !reg.index) continue;
        if (e.root === real || !fs.existsSync(e.root) || !fs.existsSync(graphHome(e.root).cachePath)) continue;
        out.push(same ? { id, name: path.basename(e.root), root: e.root } : { id, name: path.basename(e.root) });
        if (out.length === 20) break;
    }
    return out;
}

/** The `no graph here` answer, in one place so all the tools agree on its shape. */
function noGraph(root: string): Record<string, unknown> {
    const registered = projectsWithGraph(root);
    if (registered.length) {
        return {
            status: 'unavailable',
            staleness: 'absent',
            error:
                'no code-graph source under this root — pass `project` to ask a registered project below, ' +
                'or run `agent-config code-graph build` here',
            root,
            registered_projects: registered,
        };
    }
    return {
        status: 'unavailable',
        staleness: 'absent',
        error:
            'no code-graph source found under this root — run `agent-config code-graph build` ' +
            'to build one, or ship a graph.json',
        root,
    };
}

/**
 * Resolve the graph, run `fn`, release the handle.
 *
 * The handle owns an open SQLite database on the indexed path, so the `finally`
 * is not hygiene — a long-lived MCP server that leaked one per call would hold
 * a descriptor for the life of the process.
 */
function withGraph<T extends Record<string, unknown>>(
    root: string,
    fn: (g: LoadedGraph) => T,
): Record<string, unknown> {
    const picked = pickSource(detectSources(root, graphHome(root).cachePath));
    if (!picked || picked.kind === 'scip') return noGraph(root);
    touchHome(root);
    const base = loadGraph(picked.path, `${picked.kind}:${shown(root, picked.path)}`);
    // Committed facts seen through the working-tree overlay, when one was computed against this graph.
    const g = overlayView(base, readOverlay(picked.path, graphChecksum(base)));
    try {
        const out = fn(g);
        // `status` is DERIVED from the answer, never prefixed onto it. An
        // independent review found `graph_dead`'s refusal returning
        // `{status:'ok', refusal:'…', dead:[]}` — the same status a real answer
        // carries, so a caller branching on `status` (which every fixture here
        // trains it to do) read the refusal as "nothing is dead". That is the
        // false negative the CLI's exit 1 exists to prevent, arriving over the
        // wire instead. A refusal is its own status.
        const refused = typeof out['refusal'] === 'string' && out['refusal'] !== '';
        return { status: refused ? 'refused' : 'ok', ...out };
    } finally {
        base.close();
    }
}

/** The tool-side lower bound of a usage answer: the seed's known places plus a text search. */
function usageOf(g: LoadedGraph, root: string, seed: string, knownIds: Iterable<string>): Record<string, unknown> {
    const id = resolveSeeds(g, seed, 1)[0];
    if (id === undefined) return {};
    const lb = usageLowerBound(g, root, graphHome(root).cachePath, id, knownIds);
    return lb ? { usage: lb } : {};
}

/** Relative inside the root, absolute for a graph home outside it (ADR-299). */
function shown(root: string, p: string): string {
    const rel = path.relative(root, p);
    return rel.startsWith('..') || path.isAbsolute(rel) ? p : rel;
}

function str(args: Record<string, unknown>, key: string): string {
    const v = args[key];
    return typeof v === 'string' ? v.trim() : '';
}

/** The closed relation vocabulary, as a schema enum — read from the vocabulary file, so it cannot drift. */
const RELATIONS = [...VOCAB_RELATIONS.keys()].sort();

function num(args: Record<string, unknown>, key: string, dflt: number): number {
    const v = args[key];
    return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : dflt;
}

/**
 * Every graph tool takes an optional `project` (5.1): a registered repo id,
 * name or path, resolved through the registry and its graph home. Without it
 * the tool answers about the server root, exactly as before.
 */
function withProjectParam(tools: Record<string, BuiltinTool>): Record<string, BuiltinTool> {
    const out: Record<string, BuiltinTool> = {};
    for (const [name, t] of Object.entries(tools)) {
        // The estate tool answers across every project already.
        if (name === 'graph_estate') {
            out[name] = t;
            continue;
        }
        const schema = t.input_schema as { properties?: Record<string, unknown> };
        out[name] = {
            ...t,
            input_schema: {
                ...t.input_schema,
                properties: {
                    ...(schema.properties ?? {}),
                    project: { type: 'string' },
                },
            },
            handler: async (args, root) => {
                const ref = str(args, 'project');
                if (ref === '') return t.handler(args, root);
                const r = resolveProjectRef(ref);
                if ('error' in r) return { status: 'error', error: r.error, candidates: r.candidates };
                return t.handler(args, r.root);
            },
        };
    }
    return out;
}

export const GRAPH_TOOLS: Record<string, BuiltinTool> = withProjectParam({
    graph_impact: {
        name: 'graph_impact',
        side_effect: 'shell',
        description:
            'What a diff breaks: callers, dependents, tests of changed symbols over stated edges; `review_risk` scores it.',
        input_schema: {
            type: 'object',
            required: ['diff'],
            properties: {
                diff: { type: 'string', description: 'Git rev to diff HEAD against, e.g. `HEAD~1`.' },
                depth: { type: 'integer', minimum: 1, default: 2, description: 'Hop limit.' },
                untested_only: {
                    type: 'boolean',
                    default: false,
                    description: 'Instead return changed symbols no test imports.',
                },
                review_risk: { type: 'boolean' },
                budget: { type: 'integer', minimum: 250, default: 2000, description: 'Token ceiling on the answer; over it the answer falls back to locations, per-file counts, then a summary.' },
                page: { type: 'integer', minimum: 1, default: 1, description: 'Page of recommended_reads.' },
            },
            additionalProperties: false,
        },
        handler: async (args, root) => {
            const rev = str(args, 'diff');
            if (rev === '') return { status: 'error', error: 'diff must be a non-empty git rev' };
            if (args['review_risk'] === true) {
                const hunks = diffHunks(root, rev);
                if (hunks === null) return { status: 'error', error: `cannot resolve rev '${rev}' in ${root}` };
                const cache = graphHome(root).cachePath;
                if (!fs.existsSync(cache)) return { status: 'error', error: 'no graph yet — run `code-graph build`' };
                return { status: 'ok', ...reviewRisk(root, JSON.parse(fs.readFileSync(cache, 'utf-8')) as CodeGraph, rev, hunks) };
            }
            const files = changedFiles(root, rev);
            if (files === null) return { status: 'error', error: `cannot resolve rev '${rev}' in ${root}` };
            const state = graphState(root, graphHome(root).cachePath);
            return withGraph(root, (g) =>
                args['untested_only'] === true
                    ? { ...untested(g, files, state), changed_files: files.length }
                    : budgetImpactReport(g, { ...impact(g, files, state, num(args, 'depth', 2), isTestFile), changed_files: files.length }, num(args, 'budget', DEFAULT_ANSWER_BUDGET), num(args, 'page', 1)),
            );
        },
    },

    graph_tests_for: {
        name: 'graph_tests_for',
        side_effect: 'ro',
        description:
            'Test files that exercise a symbol: a test file imports it or its module. ' +
            'Empty is a finding, not an error.',
        input_schema: {
            type: 'object',
            required: ['symbol'],
            properties: {
                symbol: { type: 'string', description: 'Node id, label, or free text.' },
            },
            additionalProperties: false,
        },
        handler: async (args, root) => {
            const symbol = str(args, 'symbol');
            if (symbol === '') return { status: 'error', error: 'symbol must be a non-empty string' };
            const state = graphState(root, graphHome(root).cachePath);
            return withGraph(root, (g) => ({ ...testsFor(g, symbol, state) }));
        },
    },

    graph_dead: {
        name: 'graph_dead',
        side_effect: 'ro',
        description:
            'Symbols no accepted reference and no declared entry point names. REFUSES ' +
            'while a source is unreadable: without recorded exportedness ' +
            'an exported-but-unimported symbol looks dead. Never a deletion recommendation.',
        input_schema: {
            type: 'object',
            properties: {
                entry_points: {
                    type: 'string',
                    description: 'Path under this root: newline-separated ids or labels, `#` comments ok.',
                },
                accept_missing_exports: {
                    type: 'boolean',
                    default: false,
                    description: 'Answer anyway, accepting the gap. Never a default.',
                },
            },
            additionalProperties: false,
        },
        handler: async (args, root) => {
            const state = graphState(root, graphHome(root).cachePath);
            const listArg = str(args, 'entry_points');
            let sources = repoEntryPoints(root);
            if (listArg !== '') {
                // REALPATH containment, matching the sibling pattern in
                // `tools.ts` rather than reimplementing a weaker one — an
                // independent review found this check using `path.resolve` +
                // `startsWith`, which a symlink inside the root walks straight
                // through, in the same change that extracted `resolvePath` for
                // reuse. `fs.readFileSync` would then follow the link, and
                // because the file's lines used to be echoed back in the
                // response (see `entry_count` below) that was an
                // arbitrary-file-read path.
                const abs = resolvePath(path.resolve(root, listArg));
                const rootReal = resolvePath(path.resolve(root));
                if (abs !== rootReal && !abs.startsWith(rootReal + path.sep)) {
                    return { status: 'error', error: `path escapes consumer_root: ${abs}` };
                }
                if (!fs.existsSync(abs)) return { status: 'error', error: `entry-point list not found: ${listArg}` };
                sources = [
                    ...sources.map((s) =>
                        s.name === 'exports'
                            ? { ...s, status: 'read' as const, detail: `supplied by ${listArg}`, entries: [] }
                            : s,
                    ),
                    entryPointsFromFile(abs),
                ];
            }
            return withGraph(root, (g) => {
                const r = dead(g, sources, state, {
                    acceptMissingExports: args['accept_missing_exports'] === true,
                });
                // The `entries` arrays are NOT returned. On this repository they
                // are ~2,595 identifier strings — an unbounded per-call payload
                // beside the standing-cost row this change itself adds — and
                // returning a file the caller named is what made the
                // containment check above a read primitive. A count answers the
                // question a caller actually has ("was this source read, and did
                // it have anything in it") without shipping the contents.
                return {
                    ...r,
                    sources: r.sources.map((srcRow) => ({
                        name: srcRow.name,
                        status: srcRow.status,
                        ...(srcRow.detail === undefined ? {} : { detail: srcRow.detail }),
                        entry_count: srcRow.entries.length,
                    })),
                };
            });
        },
    },

    graph_query: {
        name: 'graph_query',
        side_effect: 'ro',
        description:
            "A symbol's outgoing relations with confidence and mechanism. " +
            'kind/relation/direction/depth: a tree with witnesses. mode=pack: facts for a task.',
        input_schema: {
            type: 'object',
            required: ['symbol'],
            properties: {
                symbol: { type: 'string', description: 'Node id, label, or free text.' },
                mode: { type: 'string', enum: ['relations', 'pack'] },
                budget: { type: 'integer' },
                kind: { type: 'string', description: 'Comma-separated kinds.' },
                relation: { type: 'string' },
                direction: { type: 'string', enum: ['in', 'out', 'both'] },
                depth: { type: 'integer', maximum: 3 },
                limit: { type: 'integer' },
            },
            additionalProperties: false,
        },
        handler: async (args, root) => {
            const symbol = str(args, 'symbol');
            if (symbol === '') return { status: 'error', error: 'symbol must be a non-empty string' };
            const staleness = graphState(root, graphHome(root).cachePath);
            if (str(args, 'mode') === 'pack') {
                const diffFiles = workingChanges(root)?.changed ?? [];
                return withGraph(root, (g) => ({
                    staleness,
                    ...contextPack(g, root, graphHome(root).cachePath, symbol, {
                        diffFiles,
                        ...(args['budget'] !== undefined ? { budget: num(args, 'budget', 1500) } : {}),
                        ...(args['depth'] !== undefined ? { depth: num(args, 'depth', 2) } : {}),
                    }),
                }));
            }
            const kinds = str(args, 'kind').split(',').map((k) => k.trim()).filter(Boolean);
            const relation = str(args, 'relation');
            if (kinds.length > 0 || relation !== '' || args['direction'] !== undefined || args['depth'] !== undefined) {
                const opts: TreeOptions = { depth: num(args, 'depth', 1), limit: num(args, 'limit', 50) };
                if (kinds.length > 0) opts.kinds = kinds;
                if (relation !== '' && !(RELATIONS as readonly string[]).includes(relation)) {
                    return { status: 'error', error: `unknown relation: ${relation}; one of ${RELATIONS.join(', ')}` };
                }
                if (relation !== '') opts.relations = [relation];
                const dir = str(args, 'direction');
                if (dir === 'in' || dir === 'out' || dir === 'both') opts.direction = dir;
                return withGraph(root, (g) => {
                    const ov = readOverlay(g.answeredBy, graphChecksum(g));
                    const t = graphTreeVerb(g, symbol, { ...opts, stateOf: (id) => overlayState(ov, id) });
                    const users = t.items.filter((i) => i.direction === 'in').map((i) => i.id);
                    return { staleness, ...t, ...(users.length > 0 ? usageOf(g, root, symbol, users) : {}) };
                });
            }
            return withGraph(root, (g) => ({
                staleness,
                ...graphQueryVerb(g, symbol, num(args, 'budget', 1500)),
            }));
        },
    },

    graph_node: {
        name: 'graph_node',
        side_effect: 'ro',
        description:
            'One symbol in full: its declaration, what reaches it, what it reaches. Resolves ' +
            'EXACTLY (node id, then label), never free text. mode=confirm re-reads its witness.',
        input_schema: {
            type: 'object',
            required: ['id'],
            properties: {
                id: { type: 'string', description: 'Node id `<relpath>#<sym>` or an exact label.' },
                mode: { type: 'string', enum: ['node', 'confirm'] },
                direction: {
                    type: 'string',
                    enum: ['in', 'out', 'both'],
                    default: 'both',
                    description: 'in = who reaches it, out = what it reaches.',
                },
                depth: { type: 'integer', maximum: 3 },
                relation: { type: 'string', description: 'One relation only.' },
                kind: { type: 'string', description: 'Far ends of this kind only.' },
            },
            additionalProperties: false,
        },
        handler: async (args, root) => {
            const id = str(args, 'id');
            if (id === '') return { status: 'error', error: 'id must be a non-empty string' };
            const staleness = graphState(root, graphHome(root).cachePath);
            const opts: NodeOptions = {};
            const dir = str(args, 'direction');
            if (dir === 'in' || dir === 'out' || dir === 'both') opts.direction = dir;
            // `num` clamps at >0 only; the 1-3 band is the verb's, so an
            // out-of-band value is clamped there rather than rejected here —
            // two places enforcing one band is how they drift apart.
            opts.depth = num(args, 'depth', 1);
            const rel = str(args, 'relation');
            if (rel !== '' && !(RELATIONS as readonly string[]).includes(rel)) {
                return { status: 'error', error: `unknown relation: ${rel}; one of ${RELATIONS.join(', ')}` };
            }
            if (rel !== '') opts.relation = rel as Relation;
            const kind = str(args, 'kind');
            if (kind !== '') opts.kind = kind;
            if (str(args, 'mode') === 'confirm') return confirmNode(root, id, staleness, args['direction'] === undefined ? undefined : opts.direction);
            return withGraph(root, (g) => {
                const r = graphNodeVerb(g, id, opts);
                return { staleness, ...r, ...(r.in.length > 0 ? usageOf(g, root, r.id, r.in.map((e) => e.id)) : {}) };
            });
        },
    },

    graph_path: {
        name: 'graph_path',
        side_effect: 'ro',
        description:
            'The shortest relation chain between two symbols, direction kept: how A reaches ' +
            'B without reading the files between. `(no path found)` is an answer.',
        input_schema: {
            type: 'object',
            required: ['from', 'to'],
            properties: {
                from: { type: 'string', description: 'Start node id, label, or free text.' },
                to: { type: 'string', description: 'Goal node id, label, or free text.' },
                budget: { type: 'integer' },
            },
            additionalProperties: false,
        },
        handler: async (args, root) => {
            const from = str(args, 'from');
            const to = str(args, 'to');
            if (from === '' || to === '') return { status: 'error', error: 'from and to must be non-empty strings' };
            const staleness = graphState(root, graphHome(root).cachePath);
            return withGraph(root, (g) => ({
                staleness,
                ...graphPathVerb(g, from, to, num(args, 'budget', 1500)),
            }));
        },
    },
    graph_map_status: {
        name: 'graph_map_status',
        side_effect: 'ro',
        description: 'Code map: freshness, health, findings; `file` adds blast.',
        input_schema: { type: 'object', properties: { file: { type: 'string' } }, additionalProperties: false },
        handler: async (args, root) => {
            const staleness = graphState(root, graphHome(root).cachePath);
            const map = readMap(root);
            if (!map) {
                return {
                    status: 'unavailable',
                    staleness,
                    map: 'absent',
                    hint: 'run `agent-config code-graph map` to draw it into agents/map/',
                };
            }
            const m = map.model;
            const home = graphHome(root);
            const mapRel = home.kind === 'project' ? 'agents/map' : home.mapDir;
            return {
                status: 'ok',
                staleness,
                map: 'present',
                drawn_at_commit: map.meta.commit,
                graph_state_when_drawn: map.meta.state,
                // Same generation → the map shows exactly the graph the queries read.
                map_matches_graph: map.meta.graph_generation !== undefined && map.meta.graph_generation === graphGeneration(home.cachePath),
                files: m.files.length,
                areas: m.areas.length,
                trusted_links: m.analyses.trustedEdges,
                guess_share: m.analyses.guessShare,
                request_paths: m.analyses.requestPathsTotal,
                providers: (m.providers ?? []).map((p) => `${p.id} (${p.status})`),
                largest_areas: m.areas.slice(0, 5).map((a) => `${a.id} ${a.name} (${a.files.length})`),
                map_md: `${mapRel}/MAP.md`,
                index_html: `${mapRel}/index.html`,
                ...mapHealthReport(m),
                ...blastFor(m, str(args, 'file')),
            };
        },
    },
    graph_area: {
        name: 'graph_area',
        side_effect: 'ro',
        description: 'One code-map area by id, exact name or member file: files, hubs, dependencies. Else refused.',
        input_schema: {
            type: 'object',
            required: ['area'],
            properties: {
                area: { type: 'string' },
            },
            additionalProperties: false,
        },
        handler: async (args, root) => {
            const q = str(args, 'area');
            if (q === '') return { status: 'error', error: 'area must be a non-empty string' };
            const map = readMap(root);
            if (!map) return { status: 'unavailable', error: 'no map — run `agent-config code-graph map`' };
            const home = graphHome(root);
            const r = areaReport(map.model, q, home.kind === 'project' ? undefined : home.mapDir);
            if ('refusal' in r) return { status: 'refused', refusal: r.refusal, candidates: r.candidates };
            return { status: 'ok', drawn_at_commit: map.meta.commit, ...r };
        },
    },
    graph_estate: {
        name: 'graph_estate',
        side_effect: 'ro',
        description:
            'Estate index across registered projects: package users, where a name is used, advisory ' +
            'reach. Other graph tools take `project`.',
        input_schema: {
            type: 'object',
            required: ['query'],
            properties: {
                query: { type: 'string', enum: ['where-used', 'projects-using', 'advisory-impact'] },
                name: { type: 'string' },
            },
            additionalProperties: false,
        },
        handler: async (args) => {
            const q = str(args, 'query');
            const name = str(args, 'name');
            if (q !== 'advisory-impact' && name === '') return { status: 'error', error: `${q || 'query'} needs a name` };
            const db = openEstate();
            if (!db) return { status: 'unavailable', error: 'no estate index — `agent-config code-graph projects index on`, then refresh each project' };
            try {
                if (q === 'projects-using') return { status: 'ok', projects: db.projectsUsing(name) };
                if (q === 'where-used') return { status: 'ok', ...whereUsed(db, name) };
                if (q === 'advisory-impact') return { status: 'ok', impact: advisoryImpact(db, name === '' ? null : name) };
                return { status: 'error', error: `unknown query: ${q}` };
            } finally {
                db.close();
            }
        },
    },
});

/**
 * `graph_node` in confirm mode: resolve the id exactly through the SQLite index
 * and re-read its witness — and, with a direction, those of its listed ends.
 * Never loads the JSON graph; without a current index it says so.
 */
function confirmNode(root: string, id: string, staleness: string, direction: 'in' | 'out' | 'both' | undefined): Record<string, unknown> {
    const cache = graphHome(root).cachePath;
    const g = loadIndexedGraph(cache, cache);
    if (!g) {
        return { status: 'unavailable', staleness, error: 'no current graph index — run `agent-config code-graph build`; confirm never reads the JSON graph' };
    }
    let resolved: string | null;
    let ambiguous: string[];
    try {
        ({ id: resolved, ambiguous } = resolveExactNode(overlayView(g, readOverlay(cache, graphChecksum(g))), id));
    } finally {
        g.close();
    }
    if (resolved === null) {
        return { status: 'refused', staleness, refusal: ambiguous.length ? `'${id}' names ${ambiguous.length} nodes — re-ask with one id` : `'${id}' matches no node id or label`, candidates: ambiguous };
    }
    const r = confirmIds(root, cache, [resolved], direction ? { neighbours: direction } : {});
    return { ...r, staleness, id: resolved };
}

/** One file's blast record and the files it reaches by depth, or a refusal naming why there is none. */
function blastFor(m: MapModel, file: string): Record<string, unknown> {
    if (file === '') return {};
    if (!m.files.some((f) => f.blast)) return { blast: { refusal: 'the map predates blast records — redraw it with `agent-config code-graph map`' } };
    const wanted = file.replace(/^\.\//, '');
    const i = m.files.findIndex((f) => f.path === wanted);
    if (i < 0) return { blast: { refusal: `no file \`${file}\` in the map` } };
    const f = m.files[i] as MapModel['files'][number];
    if (!f.blast) return { blast: { file, refusal: `role \`${f.role}\` is outside the blast scope (code files only)` } };
    const byDepth = blastMembers(m, i);
    return {
        blast: {
            file,
            ...f.blast,
            by_depth: byDepth.slice(1).map((list) => ({ count: list.length, files: list.slice(0, 20).map((k) => (m.files[k] as MapModel['files'][number]).path) })),
        },
    };
}
