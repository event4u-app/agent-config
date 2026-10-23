/**
 * The ordered post-extraction passes (ADR-298). The build runs this list and
 * nothing else after resolution; a pass that throws is reported and skipped,
 * and the build goes on.
 *
 * Order is meaning: convention providers contest base edges they prove false
 * before anything is added on top, docs add their links, and SCIP last
 * supersedes the name guesses it duplicates.
 */
import type { SourceFile } from './build.js';
import { conventionsDefault } from './conventions_default.js';
import { docsLayer } from './docs_layer.js';
import { activeProviders, type ProjectProbe } from './providers/index.js';
import type { ResolutionConfig } from './resolution_tiers.js';
import { type ScipDocument, scipEdges, supersededByScip } from './scip_reader.js';
import type { ActiveProviderRecord, CodeEdge, CodeNode } from './types.js';

export interface PassContext {
    files: readonly SourceFile[];
    docs: readonly SourceFile[];
    scip: readonly ScipDocument[];
    resolution: ResolutionConfig;
    probe: ProjectProbe;
    /** The graph so far, read-only: a pass proposes, the orchestrator applies. */
    nodes: readonly CodeNode[];
    edges: readonly CodeEdge[];
}

export interface PassFailure {
    pass: string;
    reason: string;
}

export interface Contest {
    /** Suppressed-edge counter the removed edges are reported under, if any. */
    key?: string;
    test: (e: CodeEdge) => boolean;
}

export interface PassResult {
    nodes: CodeNode[];
    edges: CodeEdge[];
    /** Applied to the existing edges, in order, before this pass's own are added. */
    contests?: Contest[];
    /** Failures inside the pass that did not stop it (one provider of several). */
    failures?: PassFailure[];
    /** Convention providers that applied, for the graph's record. */
    providers?: ActiveProviderRecord[];
}

export interface GraphPass {
    id: string;
    applies(ctx: PassContext): boolean;
    run(ctx: PassContext): PassResult;
}

const conventionProviders: GraphPass = {
    id: 'convention-providers',
    applies: (ctx) => activeProviders(ctx.probe).length > 0,
    run: (ctx) => {
        const out: PassResult = { nodes: [], edges: [], contests: [], failures: [], providers: [] };
        for (const { provider, roots } of activeProviders(ctx.probe)) {
            out.providers?.push({ id: provider.id, roots });
            try {
                const files = roots.includes('') ? ctx.files : ctx.files.filter((f) => roots.some((r) => f.path.startsWith(`${r}/`)));
                const r = provider.build({ files, baseNodes: ctx.nodes, resolution: ctx.resolution, roots });
                if (r.nodes.length === 0 && r.edges.length === 0) continue;
                if (r.contest) out.contests?.push({ key: provider.id, test: r.contest });
                for (const e of r.edges) out.edges.push({ ...e, provider_id: provider.id });
                for (const n of r.nodes) out.nodes.push(n);
            } catch (e) {
                out.failures?.push({ pass: `convention-providers:${provider.id}`, reason: (e as Error).message });
            }
        }
        return out;
    },
};

const defaults: GraphPass = {
    id: 'conventions-default',
    applies: (ctx) => ctx.files.length > 0,
    run: (ctx) => {
        const paths = ctx.probe.paths.length > 0 ? ctx.probe.paths : [...ctx.files, ...ctx.docs].map((f) => f.path).sort();
        return conventionsDefault({ files: ctx.files, paths, nodes: ctx.nodes, edges: ctx.edges });
    },
};

const docs: GraphPass = {
    id: 'docs',
    applies: (ctx) => ctx.docs.length > 0,
    run: (ctx) => {
        const allFiles = new Set([...ctx.files.map((f) => f.path), ...ctx.docs.map((d) => d.path)]);
        const layer = docsLayer(ctx.docs, allFiles);
        // An earlier pass may already have drawn a document as a link target.
        const known = new Set(ctx.nodes.map((n) => n.id));
        return { nodes: layer.nodes.filter((n) => !known.has(n.id)), edges: layer.edges };
    },
};

const scip: GraphPass = {
    id: 'scip',
    applies: (ctx) => ctx.scip.length > 0,
    run: (ctx) => {
        const stated = scipEdges(ctx.scip, ctx.nodes);
        return { nodes: [], edges: stated, contests: [{ test: supersededByScip(stated, ctx.nodes) }] };
    },
};

export const PASSES: readonly GraphPass[] = [conventionProviders, defaults, docs, scip];

export interface PassReport {
    /** Edges removed by a keyed contest, per key (a provider id); only non-zero keys appear. */
    suppressed: Record<string, number>;
    failures: PassFailure[];
    providers: ActiveProviderRecord[];
}

/** Run every applicable pass in order, mutating `nodes` / `edges` in place. */
export function runPasses(
    base: Omit<PassContext, 'nodes' | 'edges'>,
    nodes: CodeNode[],
    edges: CodeEdge[],
    passes: readonly GraphPass[] = PASSES,
): PassReport {
    const report: PassReport = { suppressed: {}, failures: [], providers: [] };
    for (const pass of passes) {
        const ctx: PassContext = { ...base, nodes, edges };
        let result: PassResult;
        try {
            if (!pass.applies(ctx)) continue;
            result = pass.run(ctx);
        } catch (e) {
            report.failures.push({ pass: pass.id, reason: (e as Error).message });
            continue;
        }
        report.failures.push(...(result.failures ?? []));
        report.providers.push(...(result.providers ?? []));
        for (const c of result.contests ?? []) {
            const kept = edges.filter((e) => !c.test(e));
            const removed = edges.length - kept.length;
            if (c.key && removed > 0) report.suppressed[c.key] = (report.suppressed[c.key] ?? 0) + removed;
            // Element-wise: a spread of ~200k edges overflows the call stack.
            edges.length = 0;
            for (const e of kept) edges.push(e);
        }
        for (const e of result.edges) edges.push(e);
        for (const n of result.nodes) nodes.push(n);
    }
    return report;
}
