/**
 * The knowledge sections of the map that read beyond the graph: branches, the
 * domains on files and areas, and the provenance of the map's own files and routes.
 */
import * as path from 'node:path';

import { chainStatus } from '../_lib/branch_chain_status.js';
import { chainOf, currentBranch, parentOf } from '../_lib/branch_parents.js';
import { type BranchManifest, defaultBranchSet, diffBranches, indexBranch } from './branches.js';
import { analyseDomains, assignDomains, ownerFromCodeowners, proposalSnippet, proposeDomains, readCodeowners, readDomainRules, structuralDomains } from './domains.js';
import { cachedProvenance, type CommitRef, spanHistory, ticketKeysOf } from './provenance.js';
import type { MapBranches, MapModel, MapProvenance } from './map_model.js';
import type { MapAreas } from './map_areas.js';
import type { CodeGraph } from './types.js';

/** The default branch set indexed, each compared with the checked-out branch. */
export async function mapBranches(root: string, buildDir: string): Promise<MapBranches | null> {
    const cur = currentBranch(root);
    if (!cur) return null;
    const refs = defaultBranchSet(root);
    const manifests: BranchManifest[] = [];
    for (const ref of refs) {
        try {
            manifests.push((await indexBranch(root, buildDir, ref)).manifest);
        } catch {
            /* a ref that does not resolve is left out */
        }
    }
    const here = manifests.find((m) => m.ref === cur);
    if (!here) return null;
    const chain = chainOf(root, cur);
    return {
        current: cur,
        chain: chainStatus(root, cur).map((l) => ({ branch: l.branch, parent: l.parent, behind: l.behind, owned: l.owned, overlap: l.overlap.slice(0, 20) })),
        list: manifests
            .filter((m) => m.ref !== cur)
            .map((m) => {
                const d = diffBranches(buildDir, here, m);
                const link = chain.find((l) => l.branch === m.ref) ?? parentOf(root, m.ref);
                return {
                    ref: m.ref,
                    commit: m.commit.slice(0, 12),
                    seen: m.seen,
                    parent: link.parent,
                    files: d.files.added.length + d.files.removed.length + d.files.changed.length,
                    packages: [...d.packages.added.map((x) => `+ ${x}`), ...d.packages.removed.map((x) => `− ${x}`), ...d.packages.changed.map(([k, x, y]) => `${k} ${x} → ${y}`)].slice(0, 12),
                    columns: [...d.columns.added.map((x) => `+ ${x}`), ...d.columns.removed.map((x) => `− ${x}`)].slice(0, 12),
                    symbols: d.symbols.added.length + d.symbols.removed.length,
                };
            }),
    };
}

/** The table a write lands on: a table id whole (`public.users` stays itself), a column id without its column. */
function tableOfTarget(target: string): string | null {
    if (target.startsWith('table:')) return target.slice('table:'.length);
    if (target.startsWith('column:')) return target.slice('column:'.length).replace(/\.[^.]*$/, '');
    return null;
}

/** Domains on files, the breaches against their declaration, and proposals when nothing is declared. */
export function attachDomains(root: string, outDir: string, graph: CodeGraph, model: MapModel): void {
    const paths = model.files.map((f) => f.path);
    const rules = readDomainRules(path.join(outDir, 'layers.yaml')) ?? structuralDomains(paths);
    if (!rules) {
        const list = proposeDomains(model.areas, paths);
        if (list.length) model.domainProposals = { source: 'inferred', list, snippet: proposalSnippet(list) };
        return;
    }
    const asg = assignDomains(paths, rules);
    asg.of.forEach((d, i) => {
        if (d) (model.files[i] as MapModel['files'][number]).domain = d;
    });
    const an = analyseDomains(model.edges, (i) => model.files[i]?.role === 'test', paths, asg, rules);
    // A table written from two domains: the code that writes it names its owners.
    const fileIdx = new Map(paths.map((p, i) => [p, i] as const));
    const nodeFile = new Map(graph.nodes.map((n) => [n.id, n.source_file] as const));
    const writers = new Map<string, Map<string, number>>();
    for (const e of graph.edges) {
        if (e.relation !== 'writes' && e.relation !== 'persists') continue;
        const fi = fileIdx.get(nodeFile.get(e.source) ?? '');
        const d = fi !== undefined ? asg.of[fi] : undefined;
        if (fi === undefined || !d) continue;
        const table = tableOfTarget(e.target);
        if (!table) continue;
        const m = writers.get(table) ?? new Map<string, number>();
        if (!m.has(d)) m.set(d, fi);
        writers.set(table, m);
    }
    const tableViolations = rules.source !== 'declared' ? [] : [...writers.entries()]
        .filter(([, m]) => m.size > 1)
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([table, m]) => ({ kind: 'domain-table' as const, files: [...m.values()], domains: [...m.keys()].sort(), table }));
    const owners = readCodeowners(root);
    model.domains = {
        source: rules.source,
        list: rules.domains.map((d) => {
            const own = paths.filter((_, i) => asg.of[i] === d.name);
            return { name: d.name, files: own.length, owner: d.owner ?? (owners ? ownerFromCodeowners(owners, own) : null), parent: d.parent, globs: d.globs, public: d.publicMatch !== null };
        }),
        edges: an.edges,
        crossings: an.crossings,
        breaches: rules.allow || an.violations.some((v) => v.kind !== 'domain') || tableViolations.length ? an.breaches + tableViolations.length : null,
        violations: [...an.violations, ...tableViolations],
    };
}

/** Each table gets the domains of the code that writes it, each package those of the files that use it. */
export function domainsOnAreas(areas: MapAreas, model: MapModel, graph: CodeGraph): void {
    const domainOf = new Map(model.files.filter((f) => f.domain).map((f) => [f.path, f.domain as string] as const));
    const nodeFile = new Map(graph.nodes.map((n) => [n.id, n.source_file] as const));
    const into = new Map<string, Set<string>>();
    for (const e of graph.edges) {
        if (e.relation !== 'writes' && e.relation !== 'persists' && e.relation !== 'uses') continue;
        const d = domainOf.get(nodeFile.get(e.source) ?? '');
        if (!d) continue;
        const key = e.relation === 'uses' ? e.target : tableOfTarget(e.target);
        if (!key) continue;
        into.set(key, (into.get(key) ?? new Set()).add(d));
    }
    for (const t of areas.data?.tables ?? []) {
        const ds = into.get(t.name);
        if (ds?.size) t.domains = [...ds].sort();
    }
    for (const k of areas.systems?.packages ?? []) {
        const ds = into.get(k.id);
        if (ds?.size) k.domains = [...ds].sort();
    }
    if (!model.domains) return;
    // A route belongs to the domain of the code that handles it, else of the file that declares it.
    const byId = new Map(graph.nodes.map((n) => [n.id, n] as const));
    const routes: Record<string, string> = {};
    for (const n of graph.nodes) {
        if (n.kind !== 'route') continue;
        const handler = graph.edges.find((e) => e.source === n.id && e.relation === 'routes-to');
        const d = domainOf.get(byId.get(handler?.target ?? '')?.source_file ?? '') ?? domainOf.get(n.source_file);
        if (d) routes[n.label] = d;
    }
    // A ticket touched the domains of the files its commits introduced or last changed.
    const tickets: Record<string, string[]> = {};
    const pv = model.provenance;
    if (pv) {
        for (const [key, commits] of Object.entries(pv.tickets)) {
            const ids = new Set(commits);
            const ds = new Set<string>();
            for (const [file, [intro, last]] of Object.entries(pv.files)) if (ids.has(intro) || ids.has(last)) ds.add(domainOf.get(file) ?? '');
            ds.delete('');
            if (ds.size) tickets[key] = [...ds].sort();
        }
    }
    if (Object.keys(routes).length) model.domains.routes = Object.fromEntries(Object.entries(routes).sort(([a], [b]) => (a < b ? -1 : 1)));
    if (Object.keys(tickets).length) model.domains.tickets = Object.fromEntries(Object.entries(tickets).sort(([a], [b]) => (a < b ? -1 : 1)));
}

/** Routes whose introduction is read per build: a count, not a clock, so a redraw of one tree writes the same bytes. */
export const ROUTE_HISTORY_BUDGET = 100;

/**
 * The provenance section of the map: for the map's own files and routes, the
 * commit that introduced and the one that last changed each, and the tickets
 * and PRs of those commits only. The whole index, with every commit a ticket or
 * a PR touched, stays in the gitignored cache for `code-graph provenance`.
 */
export function mapProvenance(root: string, buildDir: string, graph: CodeGraph, paths: readonly string[]): MapProvenance | null {
    const index = cachedProvenance(root, buildDir);
    if (!index) return null;
    const keys = ticketKeysOf(root);
    const commits: MapProvenance['commits'] = [];
    const at = new Map<string, number>();
    const add = (c: CommitRef): number => {
        const known = at.get(c.sha);
        if (known !== undefined) return known;
        at.set(c.sha, commits.length);
        commits.push([c.sha, c.date, c.author, c.pr ?? '', c.tickets]);
        return commits.length - 1;
    };
    const fromIndex = (i: number | null): number => (i === null || i < 0 ? -1 : add(index.commits[i] as CommitRef));
    const files: MapProvenance['files'] = {};
    for (const f of [...paths].sort()) {
        const p = index.files[f];
        if (p) files[f] = [fromIndex(p.introduced), fromIndex(p.last), p.changes];
    }
    const routes: MapProvenance['routes'] = {};
    const routeNodes = graph.nodes
        .filter((n) => n.kind === 'route' && n.source_file && (n.source_location[0] ?? 0) > 0)
        .sort((a, b) => (a.label < b.label ? -1 : a.label > b.label ? 1 : 0))
        .slice(0, ROUTE_HISTORY_BUDGET);
    for (const n of routeNodes) {
        const line = n.source_location[0] as number;
        const h = spanHistory(root, n.source_file, line, line, { cacheDir: buildDir, index, keys });
        if (!h || h.commits.length === 0) continue;
        routes[n.label] = [h.bounded ? -1 : add(h.commits[h.commits.length - 1] as CommitRef), add(h.commits[0] as CommitRef), n.source_file];
    }
    // Reverse lookups over the commits the map carries: a ticket or PR names what it introduced or last changed here.
    const tickets: MapProvenance['tickets'] = {};
    const prs: MapProvenance['prs'] = {};
    commits.forEach((c, i) => {
        for (const t of c[4]) (tickets[t] ??= []).push(i);
        if (c[3]) (prs[c[3]] ??= []).push(i);
    });
    const totalRoutes = graph.nodes.filter((n) => n.kind === 'route').length;
    const gaps = [index.reason, totalRoutes > ROUTE_HISTORY_BUDGET ? `${totalRoutes - ROUTE_HISTORY_BUDGET} route(s) beyond the per-build budget: \`code-graph provenance <route>\` reads them on demand` : null].filter(Boolean);
    return { head: index.head, commits, files, routes, tickets, prs, ...(gaps.length ? { gap: gaps.join('; ') } : {}) };
}
