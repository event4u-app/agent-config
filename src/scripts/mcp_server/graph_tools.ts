/**
 * The five code-graph MCP tools (`road-to-a-graph-that-is-shipped` 4.1).
 *
 * `graph_impact`, `graph_tests_for`, `graph_dead`, `graph_query`, `graph_path`.
 * They are the agent-facing half of Phase 3: the verbs exist on the CLI and an
 * agent that has to shell out to reach them will not, so the engine's answers
 * were unreachable from the surface the consumer actually talks to. Risk-Register
 * rank 1 is precisely "the install grows and the graph is still unread"; these
 * are the readers.
 *
 * ## Registered here, not in `tools.ts`
 *
 * `tools.ts` sits ~500 lines past the 1500-line ceiling
 * `check_source_size_budget` enforces as a shrink-only ratchet, so five tool
 * records with their schemas would cost ~150 units of excess there and nothing
 * here. `tools.ts` spreads {@link GRAPH_TOOLS} into `ALLOWLIST`, which is two
 * lines — paid for by moving `_strip` / `_resolvePath` out to `path_util.ts` in
 * the same change.
 *
 * ## Telemetry needs no per-tool work
 *
 * `ToolCache.dispatch` records every `tools/call` centrally, so these five emit
 * the identical line the other 31 do by being in `ALLOWLIST` at all — which is
 * what the step's "same telemetry line as the other 31" asks for, and is
 * stronger than a per-tool emit because it cannot be forgotten.
 *
 * ## Read-only, with one honest exception
 *
 * Four are `side_effect: 'ro'`. `graph_impact` is `'shell'`, because it resolves
 * its `diff` argument by running `git diff --name-only`. That subprocess is
 * read-only in effect, and the enum has no value that says so — between
 * understating the mechanism as `'ro'` and naming it, naming it is the only
 * choice a capability enum exists to support.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { changedFiles } from '../code_graph/cli.js';
import { detectSources, graphState, NATIVE_CACHE_REL, pickSource } from '../code_graph/detect.js';
import { isTestFile } from '../code_graph/build.js';
import { loadGraph, type LoadedGraph, path as graphPathVerb, query as graphQueryVerb } from '../code_graph/query.js';
import {
    dead,
    entryPointsFromFile,
    impact,
    repoEntryPoints,
    testsFor,
    untested,
} from '../code_graph/verbs.js';
import type { BuiltinTool } from './tools.js';

/** The `no graph here` answer, in one place so all five agree on its shape. */
function noGraph(root: string): Record<string, unknown> {
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
    const picked = pickSource(detectSources(root, path.join(root, NATIVE_CACHE_REL)));
    if (!picked || picked.kind === 'scip') return noGraph(root);
    const g = loadGraph(picked.path, `${picked.kind}:${path.relative(root, picked.path)}`);
    try {
        return { status: 'ok', ...fn(g) };
    } finally {
        g.close();
    }
}

function str(args: Record<string, unknown>, key: string): string {
    const v = args[key];
    return typeof v === 'string' ? v.trim() : '';
}

function num(args: Record<string, unknown>, key: string, dflt: number): number {
    const v = args[key];
    return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : dflt;
}

export const GRAPH_TOOLS: Record<string, BuiltinTool> = {
    graph_impact: {
        name: 'graph_impact',
        side_effect: 'shell',
        description:
            'What a diff can break: callers, dependents and test files ' +
            'reachable from the changed symbols over the code graph. Only ' +
            'edges whose resolution mechanism is a stated fact are walked — a ' +
            'same-name guess never produces a dependent, and the guesses it ' +
            'refused are reported so a narrow answer is distinguishable from a ' +
            'decoupled one. Returns the dependents, the test files among them, ' +
            'the edges that produced them, a minimal read set, and how stale ' +
            'the graph is. Runs `git diff --name-only` to resolve the rev.',
        input_schema: {
            type: 'object',
            required: ['diff'],
            properties: {
                diff: {
                    type: 'string',
                    description: 'Git rev to diff HEAD against, e.g. `origin/main` or `HEAD~1`.',
                },
                depth: {
                    type: 'integer',
                    minimum: 1,
                    default: 2,
                    description: 'Reverse-reachability hop limit. Defaults to 2.',
                },
                untested_only: {
                    type: 'boolean',
                    default: false,
                    description:
                        'Return the changed symbols no test file imports, instead of the impact set.',
                },
            },
            additionalProperties: false,
        },
        handler: async (args, root) => {
            const rev = str(args, 'diff');
            if (rev === '') return { status: 'error', error: 'diff must be a non-empty git rev' };
            const files = changedFiles(root, rev);
            if (files === null) return { status: 'error', error: `cannot resolve rev '${rev}' in ${root}` };
            const state = graphState(root);
            return withGraph(root, (g) =>
                args['untested_only'] === true
                    ? { ...untested(g, files, state), changed_files: files.length }
                    : { ...impact(g, files, state, num(args, 'depth', 2), isTestFile), changed_files: files.length },
            );
        },
    },

    graph_tests_for: {
        name: 'graph_tests_for',
        side_effect: 'ro',
        description:
            'Which test files exercise a symbol, from the code graph. A `tests` ' +
            'edge is derived from a test file importing the symbol or its ' +
            'module, so the answer is what the tree states rather than what a ' +
            'naming convention suggests. An empty list means no test file ' +
            'imports it — which is a finding, not an error. Read-only.',
        input_schema: {
            type: 'object',
            required: ['symbol'],
            properties: {
                symbol: {
                    type: 'string',
                    description:
                        'Node id (`<relpath>#<symbol>`), an exact label, or free text to rank.',
                },
            },
            additionalProperties: false,
        },
        handler: async (args, root) => {
            const symbol = str(args, 'symbol');
            if (symbol === '') return { status: 'error', error: 'symbol must be a non-empty string' };
            const state = graphState(root);
            return withGraph(root, (g) => ({ ...testsFor(g, symbol, state) }));
        },
    },

    graph_dead: {
        name: 'graph_dead',
        side_effect: 'ro',
        description:
            'Symbols with no accepted reference that no declared entry point ' +
            'names. It REFUSES rather than answering while an entry-point ' +
            'source cannot be read — this engine records no exportedness, so ' +
            'without a supplied list every exported-but-unimported public ' +
            'symbol would report as dead, and a confident false "dead" invites ' +
            'a deletion the graph cannot justify. Pass an entry-point file, or ' +
            'accept the gap explicitly. Nothing here says a listed symbol ' +
            'should be deleted. Read-only.',
        input_schema: {
            type: 'object',
            properties: {
                entry_points: {
                    type: 'string',
                    description:
                        'Path (under this root) to a newline-separated list of entry-point ids or labels; `#` comments allowed.',
                },
                accept_missing_exports: {
                    type: 'boolean',
                    default: false,
                    description:
                        'Answer anyway, accepting that exported-but-unimported symbols may appear. Never a default.',
                },
            },
            additionalProperties: false,
        },
        handler: async (args, root) => {
            const state = graphState(root);
            const listArg = str(args, 'entry_points');
            let sources = repoEntryPoints(root);
            if (listArg !== '') {
                const abs = path.resolve(root, listArg);
                if (!abs.startsWith(path.resolve(root) + path.sep)) {
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
            return withGraph(root, (g) => ({
                ...dead(g, sources, state, { acceptMissingExports: args['accept_missing_exports'] === true }),
            }));
        },
    },

    graph_query: {
        name: 'graph_query',
        side_effect: 'ro',
        description:
            "A symbol's direct outgoing relations from the code graph — what it " +
            'calls, imports, uses and inherits, each line carrying the ' +
            'confidence and the mechanism that resolved it. Use for "what does ' +
            'this touch" before reading a file. Read-only.',
        input_schema: {
            type: 'object',
            required: ['symbol'],
            properties: {
                symbol: { type: 'string', description: 'Node id, exact label, or free text to rank.' },
                budget: {
                    type: 'integer',
                    minimum: 1,
                    default: 1500,
                    description: 'Approximate token budget for the returned lines. Defaults to 1500.',
                },
            },
            additionalProperties: false,
        },
        handler: async (args, root) => {
            const symbol = str(args, 'symbol');
            if (symbol === '') return { status: 'error', error: 'symbol must be a non-empty string' };
            const staleness = graphState(root);
            return withGraph(root, (g) => ({
                staleness,
                ...graphQueryVerb(g, symbol, num(args, 'budget', 1500)),
            }));
        },
    },

    graph_path: {
        name: 'graph_path',
        side_effect: 'ro',
        description:
            'The shortest relation chain between two symbols in the code ' +
            'graph, with each hop\'s direction preserved. Use to answer "how ' +
            'does A reach B" without reading the files in between. Returns ' +
            '`(no path found)` when they are unconnected, which is an answer. ' +
            'Read-only.',
        input_schema: {
            type: 'object',
            required: ['from', 'to'],
            properties: {
                from: { type: 'string', description: 'Start node id, exact label, or free text.' },
                to: { type: 'string', description: 'Goal node id, exact label, or free text.' },
                budget: {
                    type: 'integer',
                    minimum: 1,
                    default: 1500,
                    description: 'Approximate token budget for the returned lines. Defaults to 1500.',
                },
            },
            additionalProperties: false,
        },
        handler: async (args, root) => {
            const from = str(args, 'from');
            const to = str(args, 'to');
            if (from === '' || to === '') return { status: 'error', error: 'from and to must be non-empty strings' };
            const staleness = graphState(root);
            return withGraph(root, (g) => ({
                staleness,
                ...graphPathVerb(g, from, to, num(args, 'budget', 1500)),
            }));
        },
    },
};
