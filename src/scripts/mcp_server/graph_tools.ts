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

import { changedFiles } from '../code_graph/cli.js';
import { detectSources, graphState, NATIVE_CACHE_REL, pickSource } from '../code_graph/detect.js';
import { resolvePath } from './path_util.js';
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
            'What a diff can break: callers, dependents and test files reaching the ' +
            'changed symbols. Walks only stated-fact edges, never a same-name guess, ' +
            'and reports the guesses refused. Runs `git diff` for the rev.',
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
            'Which test files exercise a symbol, derived from a test file importing ' +
            'it or its module. Empty means no test imports it — a finding, not an error.',
        input_schema: {
            type: 'object',
            required: ['symbol'],
            properties: {
                symbol: { type: 'string', description: 'Node id `<relpath>#<sym>`, label, or free text.' },
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
            'Symbols with no accepted reference that no declared entry point names. ' +
            'REFUSES (status `refused`) while a source is unreadable: with no ' +
            'exportedness recorded, an exported-but-unimported symbol is ' +
            'indistinguishable from a dead one. Never a deletion recommendation.',
        input_schema: {
            type: 'object',
            properties: {
                entry_points: {
                    type: 'string',
                    description: 'Path under this root to a newline-separated id/label list; `#` comments ok.',
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
            const state = graphState(root);
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
            "A symbol's direct outgoing relations — calls, imports, uses, inherits — " +
            'each line carrying its confidence and resolution mechanism. For "what ' +
            'does this touch" before reading a file.',
        input_schema: {
            type: 'object',
            required: ['symbol'],
            properties: {
                symbol: { type: 'string', description: 'Node id, label, or free text.' },
                budget: { type: 'integer', minimum: 1, default: 1500, description: 'Token budget for lines.' },
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
            'The shortest relation chain between two symbols, direction preserved. ' +
            'Answers "how does A reach B" without reading the files between. ' +
            '`(no path found)` when unconnected is an answer.',
        input_schema: {
            type: 'object',
            required: ['from', 'to'],
            properties: {
                from: { type: 'string', description: 'Start node id, label, or free text.' },
                to: { type: 'string', description: 'Goal node id, label, or free text.' },
                budget: { type: 'integer', minimum: 1, default: 1500, description: 'Token budget for lines.' },
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
