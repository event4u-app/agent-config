/**
 * The map model: a pure projection `CodeGraph → MapModel`.
 *
 * Not a second engine. Every file, edge and count here is read off the graph
 * the engine already built; this module only folds symbols into files, gives
 * each file one role, groups the coupled files into areas and lays them out.
 * Same graph in, same bytes out: the clustering RNG is seeded, every list is
 * sorted by path before it is consumed, and coordinates are rounded.
 *
 * What it deliberately does NOT do (road-to-a-map-that-draws-itself K1-K4):
 * no model call, no network, no physics left for the browser.
 */
import * as path from 'node:path';

import Graph from 'graphology';
import louvain from 'graphology-communities-louvain';
import forceAtlas2 from 'graphology-layout-forceatlas2';

import type { CodeGraph, ResolvedVia } from './types.js';
import { isStatedResolution } from './types.js';

export const MAP_MODEL_VERSION = 1;

export type FileRole =
    | 'code'
    | 'test'
    | 'entry'
    | 'view'
    | 'migration'
    | 'translation'
    | 'config'
    | 'doc'
    | 'infra'
    | 'isolated';

/** Roles whose files take part in clustering. */
const CLUSTER_ROLES: ReadonlySet<FileRole> = new Set(['code', 'test', 'entry', 'view']);

/** Compact symbol: [name, kind, line]. */
export type MapSymbol = [string, string, number];

export interface MapFile {
    path: string;
    role: FileRole;
    /** Index into `areas`, or -1 when the file belongs to no coupling area. */
    area: number;
    /** Distinct files with a trusted edge INTO this file. */
    inFiles: number;
    /** Distinct files this file has a trusted edge TO. */
    outFiles: number;
    /** Guess edges (name-lookup / dynamic / foreign) touching this file. */
    guesses: number;
    symbols: MapSymbol[];
    /** Symbols beyond the per-file cap that `symbols` omits. */
    symbolsOmitted: number;
    /** External module specifiers this file imports. */
    externals: string[];
    /** Test files that cover this file (`tests` relation). */
    tests: number[];
}

export interface MapArea {
    id: string;
    name: string;
    /** Index into `files`. */
    hub: number;
    /** Indexes into `files`, sorted by path. */
    files: number[];
    kind: 'area' | 'small-parts';
    /** Internal trusted weight over internal + boundary weight. */
    cohesion: number;
    testShare: number;
    /** Share of non-test files whose directory differs from the hub's. */
    folderMismatch: number;
    /** Overview position, in [-1, 1]. */
    x: number;
    y: number;
    /** Local layout: one entry per member file, then the outside neighbours. */
    local: Array<[number, number, number]>;
    /** Indexes of the outside neighbours drawn grey in the local view. */
    neighbours: number[];
}

/** One declared route and what its handler reaches (Laravel overlay). */
export interface RequestPath {
    route: string;
    /** Index of the routes file. */
    file: number;
    /** Index of the handler's file, or -1 when the route names no resolvable handler. */
    handler: number;
    handlerSymbol: string;
    views: number[];
    models: number[];
    tables: string[];
}

export interface MapThresholds {
    seed: number;
    /** In-degree above which a code file is held out as infrastructure. */
    infraInDegree: number;
    smallArea: number;
    maxAreaShare: number;
    symbolsPerFile: number;
    listCap: number;
    neighboursPerArea: number;
}

export interface MapModel {
    version: number;
    thresholds: MapThresholds;
    files: MapFile[];
    /** Trusted file→file edges `[source, target, weight]`, sorted. */
    edges: Array<[number, number, number]>;
    /** Guess file→file edges, same shape, drawn dashed. */
    guessEdges: Array<[number, number, number]>;
    areas: MapArea[];
    /** Area→area weights `[a, b, weight]`, a < b. */
    areaEdges: Array<[number, number, number]>;
    diff?: MapDiff;
    artefacts?: MapArtefacts;
    analyses: {
        hubs: number[];
        surprises: Array<[number, number, number]>;
        cycles: number[][];
        cyclesTotal: number;
        roleCounts: Record<FileRole, number>;
        externals: Array<[string, number]>;
        guessShare: number;
        trustedEdges: number;
        guessEdgeCount: number;
        requestPaths: RequestPath[];
        requestPathsTotal: number;
        requestPathsResolved: number;
    };
}

export interface MapInputs {
    /** Repo-relative paths declared as entry points (manifests, route files). */
    entryFiles?: readonly string[];
    seed?: number;
    /** `map --diff <rev>`: the rev and the files it changed. */
    diff?: { rev: string; changed: readonly string[] };
    /** On an agent-config source tree: the artefact relation graph (skills, rules, ADRs). */
    artefacts?: {
        nodes: ReadonlyArray<{ id: string; path: string | null; category: string | null }>;
        edges: ReadonlyArray<{ from: string; to: string; rel: string }>;
    };
}

/** The artefact layer: artefacts as map files, related by their declared fields. */
export interface MapArtefacts {
    /** `[name, file index or -1, category]`. */
    nodes: Array<[string, number, string]>;
    /** `[from node, to node, relation]`, indexes into `nodes`. */
    edges: Array<[number, number, string]>;
    relationCounts: Record<string, number>;
}

/** What a diff touches on the map: the reviewer's view of the same picture. */
export interface MapDiff {
    rev: string;
    changed: number[];
    /** Files with a trusted link into a changed file (one hop), not themselves changed. */
    impacted: number[];
    /** `[area, changed files in it, impacted files in it]`, most changed first. */
    areas: Array<[number, number, number]>;
    /** Changed paths the graph does not hold (deleted, or not a source file). */
    outsideGraph: string[];
}

const DEFAULT_SEED = 42;


/** mulberry32 — a 32-bit seeded PRNG; Louvain's only source of randomness. */
function seededRng(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const round = (n: number): number => Math.round(n * 1000) / 1000;

function byPath(a: string, b: string): number {
    return a < b ? -1 : a > b ? 1 : 0;
}


export function isTestPath(p: string): boolean {
    const segments = p.split('/');
    if (segments.some((s) => s === 'tests' || s === 'test' || s === '__tests__')) return true;
    const base = segments[segments.length - 1] ?? '';
    return /\.(test|spec)\./i.test(base) || /(^|[._-])test\.php$/i.test(base) || /Test\.php$/.test(base);
}

const CONFIG_BASENAME =
    /^(?:[\w.-]+\.config\.(?:[cm]?[jt]s)|\.eslintrc\.(?:[cm]?js)|\.prettierrc\.(?:[cm]?js)|server\.php)$/i;

/**
 * The role a path has before any edge is looked at. `infra` and `isolated`
 * depend on edges and are decided later; everything here is a name fact.
 */
export function staticRole(p: string, entries: ReadonlySet<string>): FileRole {
    if (/\.mdx?$/i.test(p)) return 'doc';
    if (isTestPath(p)) return 'test';
    const base = path.posix.basename(p);
    if (base.endsWith('.blade.php') || p.startsWith('resources/views/') || p.includes('/resources/views/')) return 'view';
    if (/(^|\/)(database\/)?migrations\//.test(p)) return 'migration';
    if (/(^|\/)(resources\/)?lang\//.test(p)) return 'translation';
    if (p.startsWith('config/') || CONFIG_BASENAME.test(base)) return 'config';
    if (entries.has(p) || p.startsWith('routes/') || p === 'public/index.php' || p === 'artisan') return 'entry';
    return 'code';
}


interface PairAcc {
    trusted: Map<string, number>;
    guess: Map<string, number>;
}

function pairKey(a: number, b: number): string {
    return `${a} ${b}`;
}

function quantile(sorted: number[], q: number): number {
    if (sorted.length === 0) return 0;
    const i = Math.min(sorted.length - 1, Math.floor(q * (sorted.length - 1)));
    return sorted[i] as number;
}

export function buildMapModel(graph: CodeGraph, inputs: MapInputs = {}): MapModel {
    const seed = inputs.seed ?? DEFAULT_SEED;
    const entries = new Set(inputs.entryFiles ?? []);

    // 1. Files, sorted by path, and the symbol table.
    const fileOfNode = new Map<string, string>();
    const symbolsOf = new Map<string, MapSymbol[]>();
    const filePaths = new Set<string>();
    for (const n of graph.nodes) {
        fileOfNode.set(n.id, n.source_file);
        filePaths.add(n.source_file);
        if (n.kind === 'file' || n.kind === 'skipped') continue;
        const list = symbolsOf.get(n.source_file) ?? [];
        list.push([n.label, n.kind, (n.source_location[0] as number | undefined) ?? 0]);
        symbolsOf.set(n.source_file, list);
    }
    const paths = [...filePaths].sort(byPath);
    const idx = new Map(paths.map((p, i) => [p, i] as const));

    // 2. Fold symbol edges into file pairs.
    const acc: PairAcc = { trusted: new Map(), guess: new Map() };
    const externals = new Map<number, Set<string>>();
    const testsOf = new Map<number, Set<number>>();
    const bump = (m: Map<string, number>, k: string): void => {
        m.set(k, (m.get(k) ?? 0) + 1);
    };
    for (const e of graph.edges) {
        const sf = fileOfNode.get(e.source);
        if (sf === undefined) continue;
        const s = idx.get(sf) as number;
        if (e.target.startsWith('external:')) {
            const spec = e.target.slice('external:'.length).split('#')[0] as string;
            const set = externals.get(s) ?? new Set<string>();
            set.add(spec);
            externals.set(s, set);
            continue;
        }
        const tf = fileOfNode.get(e.target);
        if (tf === undefined || tf === sf) continue;
        const t = idx.get(tf) as number;
        if (e.relation === 'tests') {
            const set = testsOf.get(t) ?? new Set<number>();
            set.add(s);
            testsOf.set(t, set);
        }
        bump(isStatedResolution(e.resolved_via as ResolvedVia) ? acc.trusted : acc.guess, pairKey(s, t));
    }

    const toEdges = (m: Map<string, number>): Array<[number, number, number]> =>
        [...m.entries()]
            .map(([k, w]) => {
                const [a, b] = k.split(' ').map(Number) as [number, number];
                return [a, b, w] as [number, number, number];
            })
            .sort((x, y) => x[0] - y[0] || x[1] - y[1]);
    const edges = toEdges(acc.trusted);
    const guessEdges = toEdges(acc.guess);

    const inFiles = new Array<number>(paths.length).fill(0);
    const outFiles = new Array<number>(paths.length).fill(0);
    const guesses = new Array<number>(paths.length).fill(0);
    for (const [s, t] of edges) {
        outFiles[s] = (outFiles[s] as number) + 1;
        inFiles[t] = (inFiles[t] as number) + 1;
    }
    for (const [s, t, w] of guessEdges) {
        guesses[s] = (guesses[s] as number) + w;
        guesses[t] = (guesses[t] as number) + w;
    }

    // 3. Roles: names first, then the two edge-dependent ones.
    const roles: FileRole[] = paths.map((p) => staticRole(p, entries));
    // A layout every view extends couples views exactly the way a utility
    // couples code, so views are eligible for the hold-out too.
    const holdable = (r: FileRole | undefined): boolean => r === 'code' || r === 'view';
    const codeInDegrees = paths
        .map((_, i) => (holdable(roles[i]) ? (inFiles[i] as number) : 0))
        .filter((d) => d > 0)
        .sort((a, b) => a - b);
    // p99, floored at 10 so a small project never loses a file to the hold-out.
    const infraInDegree = Math.max(10, quantile(codeInDegrees, 0.99));
    for (let i = 0; i < paths.length; i++) {
        if (!holdable(roles[i])) continue;
        if ((inFiles[i] as number) > infraInDegree) roles[i] = 'infra';
        else if (roles[i] === 'code' && inFiles[i] === 0 && outFiles[i] === 0) roles[i] = 'isolated';
    }

    // 4. Areas: seeded Louvain over the coupled roles.
    const clusterable = (i: number): boolean => CLUSTER_ROLES.has(roles[i] as FileRole);
    const undirected = new Map<string, number>();
    for (const [s, t, w] of edges) {
        if (!clusterable(s) || !clusterable(t)) continue;
        // A test's link to another test file (a base TestCase) says nothing
        // about what it tests; kept, it pulled 245 tests into one area.
        if (roles[s] === 'test' && roles[t] === 'test') continue;
        const k = s < t ? pairKey(s, t) : pairKey(t, s);
        undirected.set(k, (undirected.get(k) ?? 0) + w);
    }
    const members = new Set<number>();
    for (const k of undirected.keys()) for (const n of k.split(' ')) members.add(Number(n));
    for (let i = 0; i < paths.length; i++) if (clusterable(i) && !members.has(i)) members.add(i);

    const communities = clusterOnce([...members].sort((a, b) => a - b), undirected, seed, 1);
    const total = members.size;
    const maxShare = 0.25;
    const groups: number[][] = [];
    for (const g of communities) {
        if (g.length > maxShare * total && g.length > 8) {
            const sub = clusterOnce(g, undirected, seed, 2);
            groups.push(...sub);
        } else groups.push(g);
    }

    // 5. Fold areas under three files into per-directory small-parts buckets.
    const weightedDegree = new Map<number, number>();
    for (const [k, w] of undirected) {
        for (const n of k.split(' ').map(Number)) weightedDegree.set(n, (weightedDegree.get(n) ?? 0) + w);
    }
    const pickHub = (fs: number[]): number => {
        const pool = fs.filter((f) => roles[f] !== 'test');
        const cand = pool.length ? pool : fs;
        return [...cand].sort(
            (a, b) =>
                (weightedDegree.get(b) ?? 0) - (weightedDegree.get(a) ?? 0) || byPath(paths[a] as string, paths[b] as string),
        )[0] as number;
    };

    const smallArea = 3;
    const big = groups.filter((g) => g.length >= smallArea);
    const buckets = new Map<string, number[]>();
    for (const g of groups.filter((g) => g.length < smallArea)) {
        for (const f of g) {
            // A test with no import of anything it could be grouped with (it
            // spawns a CLI by path, say) has no subject on the map; a bucket
            // would pretend it belongs to its neighbours by directory.
            if (roles[f] === 'test' && !weightedDegree.has(f)) continue;
            // Keyed on the group's hub, so a script and its one test stay
            // together instead of splitting into a src/ and a tests/ bucket.
            const dir = topDir(paths[pickHub(g)] as string);
            const b = buckets.get(dir) ?? [];
            b.push(f);
            buckets.set(dir, b);
        }
    }

    type Draft = { files: number[]; kind: MapArea['kind']; hub: number; name: string };
    const drafts: Draft[] = [];
    for (const g of big) {
        const files = [...g].sort((a, b) => byPath(paths[a] as string, paths[b] as string));
        const hub = pickHub(files);
        drafts.push({ files, kind: 'area', hub, name: paths[hub] as string });
    }
    for (const [dir, fs] of [...buckets.entries()].sort((a, b) => byPath(a[0], b[0]))) {
        const files = [...fs].sort((a, b) => byPath(paths[a] as string, paths[b] as string));
        drafts.push({ files, kind: 'small-parts', hub: pickHub(files), name: `small parts · ${dir}` });
    }
    drafts.sort((a, b) => b.files.length - a.files.length || byPath(a.name, b.name));

    const areaOf = new Array<number>(paths.length).fill(-1);
    drafts.forEach((d, ai) => {
        for (const f of d.files) areaOf[f] = ai;
    });

    // 6. Area metrics, area→area weights, layouts.
    const areaWeights = new Map<string, number>();
    const internal = new Array<number>(drafts.length).fill(0);
    const boundary = new Array<number>(drafts.length).fill(0);
    for (const [s, t, w] of edges) {
        const a = areaOf[s] as number;
        const b = areaOf[t] as number;
        if (a < 0 && b < 0) continue;
        if (a === b) internal[a] = (internal[a] as number) + w;
        else {
            if (a >= 0) boundary[a] = (boundary[a] as number) + w;
            if (b >= 0) boundary[b] = (boundary[b] as number) + w;
            if (a >= 0 && b >= 0) {
                const k = a < b ? pairKey(a, b) : pairKey(b, a);
                areaWeights.set(k, (areaWeights.get(k) ?? 0) + w);
            }
        }
    }
    const areaEdges = toEdges(areaWeights);
    const overview = layoutOverview(
        drafts.map((d) => d.files.length),
        areaEdges,
    );

    const neighboursPerArea = 12;
    const areas: MapArea[] = drafts.map((d, ai) => {
        const hubDir = path.posix.dirname(paths[d.hub] as string);
        // Tests live under their own tree by convention, so they say nothing
        // about whether the code's folders match its coupling.
        const nonTest = d.files.filter((f) => roles[f] !== 'test');
        const mismatch = nonTest.filter((f) => path.posix.dirname(paths[f] as string) !== hubDir).length;
        const tests = d.files.length - nonTest.length;
        const inner = internal[ai] as number;
        const outer = boundary[ai] as number;
        const { local, neighbours } = layoutLocal(d.files, edges, areaOf, ai, neighboursPerArea);
        const pos = overview[ai] as [number, number];
        return {
            id: `a${ai + 1}`,
            name: d.name,
            hub: d.hub,
            files: d.files,
            kind: d.kind,
            cohesion: inner + outer === 0 ? 0 : round(inner / (inner + outer)),
            testShare: round(tests / d.files.length),
            folderMismatch: nonTest.length === 0 ? 0 : round(mismatch / nonTest.length),
            x: pos[0],
            y: pos[1],
            local,
            neighbours,
        };
    });

    // 7. Analyses, every list capped.
    const listCap = 15;
    const hubs = paths
        .map((_, i) => i)
        .filter((i) => (inFiles[i] as number) > 0)
        .sort((a, b) => (inFiles[b] as number) - (inFiles[a] as number) || byPath(paths[a] as string, paths[b] as string))
        .slice(0, listCap);

    const surprises = edges
        .filter(([s, t]) => (areaOf[s] as number) >= 0 && (areaOf[t] as number) >= 0 && areaOf[s] !== areaOf[t])
        .map(([s, t, w]) => {
            const a = areaOf[s] as number;
            const b = areaOf[t] as number;
            const between = areaWeights.get(a < b ? pairKey(a, b) : pairKey(b, a)) ?? w;
            return { s, t, w, between };
        })
        .sort(
            (x, y) =>
                x.between - y.between ||
                y.w - x.w ||
                byPath(paths[x.s] as string, paths[y.s] as string) ||
                byPath(paths[x.t] as string, paths[y.t] as string),
        )
        .slice(0, listCap)
        .map((x) => [x.s, x.t, x.w] as [number, number, number]);

    const allCycles = tarjan(paths.length, edges).filter((c) => c.length > 1);
    allCycles.sort((a, b) => b.length - a.length || (a[0] as number) - (b[0] as number));
    const cycles = allCycles.slice(0, 10).map((c) => c.slice(0, 8));

    const roleCounts = {
        code: 0,
        test: 0,
        entry: 0,
        view: 0,
        migration: 0,
        translation: 0,
        config: 0,
        doc: 0,
        infra: 0,
        isolated: 0,
    } as Record<FileRole, number>;
    for (const r of roles) roleCounts[r] += 1;

    const extCount = new Map<string, number>();
    for (const set of externals.values()) for (const s of set) extCount.set(s, (extCount.get(s) ?? 0) + 1);
    const externalsTop = [...extCount.entries()]
        .sort((a, b) => b[1] - a[1] || byPath(a[0], b[0]))
        .slice(0, 25) as Array<[string, number]>;

    const requestPaths = collectRequestPaths(graph, idx);

    const trustedTotal = edges.reduce((n, e) => n + e[2], 0);
    const guessTotal = guessEdges.reduce((n, e) => n + e[2], 0);

    const symbolsPerFile = 40;
    const files: MapFile[] = paths.map((p, i) => {
        const syms = (symbolsOf.get(p) ?? []).sort((a, b) => a[2] - b[2] || byPath(a[0], b[0]));
        return {
            path: p,
            role: roles[i] as FileRole,
            area: areaOf[i] as number,
            inFiles: inFiles[i] as number,
            outFiles: outFiles[i] as number,
            guesses: guesses[i] as number,
            symbols: syms.slice(0, symbolsPerFile),
            symbolsOmitted: Math.max(0, syms.length - symbolsPerFile),
            externals: [...(externals.get(i) ?? [])].sort(byPath),
            tests: [...(testsOf.get(i) ?? [])].sort((a, b) => a - b),
        };
    });

    let diff: MapDiff | undefined;
    if (inputs.diff) {
        const changed = new Set<number>();
        const outsideGraph: string[] = [];
        for (const p of [...inputs.diff.changed].sort(byPath)) {
            const i = idx.get(p);
            if (i === undefined) outsideGraph.push(p);
            else changed.add(i);
        }
        const impacted = new Set<number>();
        for (const [s, t] of edges) if (changed.has(t) && !changed.has(s)) impacted.add(s);
        const perArea = new Map<number, [number, number]>();
        const bumpArea = (f: number, k: 0 | 1): void => {
            const a = areaOf[f] as number;
            if (a < 0) return;
            const v = perArea.get(a) ?? [0, 0];
            v[k] += 1;
            perArea.set(a, v);
        };
        for (const f of changed) bumpArea(f, 0);
        for (const f of impacted) bumpArea(f, 1);
        diff = {
            rev: inputs.diff.rev,
            changed: [...changed].sort((a, b) => a - b),
            impacted: [...impacted].sort((a, b) => a - b),
            areas: [...perArea.entries()]
                .map(([a, [c, i]]) => [a, c, i] as [number, number, number])
                .sort((x, y) => y[1] - x[1] || y[2] - x[2] || x[0] - y[0]),
            outsideGraph,
        };
    }

    let artefacts: MapArtefacts | undefined;
    if (inputs.artefacts) {
        // Membership edges (pack, workspace) say where an artefact ships, not
        // what it relates to, and outnumber the rest ten to one.
        const RELS = new Set(['supersedes', 'superseded_by', 'routes_to', 'references_adr']);
        const byId = new Map<string, number>();
        const nodesOut: Array<[string, number, string]> = [];
        const node = (id: string): number => {
            const known = byId.get(id);
            if (known !== undefined) return known;
            const meta = inputs.artefacts?.nodes.find((n) => n.id === id);
            const p = meta?.path ?? (idx.has(id) ? id : null);
            nodesOut.push([id, p !== null ? (idx.get(p) ?? -1) : -1, meta?.category ?? (p ? 'file' : '')]);
            byId.set(id, nodesOut.length - 1);
            return nodesOut.length - 1;
        };
        const edgesOut: Array<[number, number, string]> = [];
        const relationCounts: Record<string, number> = {};
        for (const e of [...inputs.artefacts.edges].sort((a, b) =>
            a.from < b.from ? -1 : a.from > b.from ? 1 : a.to < b.to ? -1 : a.to > b.to ? 1 : a.rel < b.rel ? -1 : 1,
        )) {
            if (!RELS.has(e.rel)) continue;
            edgesOut.push([node(e.from), node(e.to), e.rel]);
            relationCounts[e.rel] = (relationCounts[e.rel] ?? 0) + 1;
        }
        artefacts = { nodes: nodesOut, edges: edgesOut, relationCounts };
    }

    return {
        version: MAP_MODEL_VERSION,
        thresholds: {
            seed,
            infraInDegree,
            smallArea,
            maxAreaShare: maxShare,
            symbolsPerFile,
            listCap,
            neighboursPerArea,
        },
        files,
        edges,
        guessEdges,
        areas,
        areaEdges,
        ...(diff ? { diff } : {}),
        ...(artefacts ? { artefacts } : {}),
        analyses: {
            hubs,
            surprises,
            cycles,
            cyclesTotal: allCycles.length,
            roleCounts,
            externals: externalsTop,
            guessShare: trustedTotal + guessTotal === 0 ? 0 : round(guessTotal / (trustedTotal + guessTotal)),
            trustedEdges: trustedTotal,
            guessEdgeCount: guessTotal,
            requestPaths: requestPaths.slice(0, 200),
            requestPathsTotal: requestPaths.length,
            requestPathsResolved: requestPaths.filter((r) => r.handler >= 0).length,
        },
    };
}

/**
 * Route → handler → the views it renders, the models it touches and their
 * tables. Read off the overlay's edges only; a route whose handler did not
 * resolve keeps `handler: -1` rather than a guess.
 */
function collectRequestPaths(graph: CodeGraph, idx: ReadonlyMap<string, number>): RequestPath[] {
    const nodeById = new Map(graph.nodes.map((n) => [n.id, n] as const));
    const out = new Map<string, CodeGraph['edges']>();
    for (const e of graph.edges) {
        const list = out.get(e.source) ?? [];
        list.push(e);
        out.set(e.source, list);
    }
    const tableOf = new Map<string, string[]>();
    for (const e of graph.edges) {
        if (e.relation !== 'persists') continue;
        const t = nodeById.get(e.target);
        if (t) tableOf.set(e.source, [...(tableOf.get(e.source) ?? []), t.label]);
    }
    const fileIdx = (id: string): number => {
        const n = nodeById.get(id);
        return n ? (idx.get(n.source_file) ?? -1) : -1;
    };
    const paths: RequestPath[] = [];
    for (const n of graph.nodes) {
        if (n.kind !== 'route') continue;
        const target = (out.get(n.id) ?? []).find((e) => e.relation === 'routes-to')?.target;
        const views = new Set<number>();
        const models = new Set<number>();
        const tables = new Set<string>();
        if (target) {
            // The handler method's own links, plus what its file imports:
            // a controller names its models in `use` lines, not in calls the
            // extractor can bind.
            const handlerFile = nodeById.get(target)?.source_file;
            const reach = [...(out.get(target) ?? []), ...(handlerFile ? (out.get(handlerFile) ?? []) : [])];
            for (const e of reach) {
                if (!isStatedResolution(e.resolved_via as ResolvedVia)) continue;
                if (e.relation === 'renders') views.add(fileIdx(e.target));
                const modelTables = tableOf.get(e.target);
                if (modelTables) {
                    models.add(fileIdx(e.target));
                    for (const t of modelTables) tables.add(t);
                }
            }
        }
        paths.push({
            route: n.label,
            file: idx.get(n.source_file) ?? -1,
            handler: target ? fileIdx(target) : -1,
            handlerSymbol: target ? (nodeById.get(target)?.label ?? '') : '',
            views: [...views].filter((v) => v >= 0).sort((a, b) => a - b),
            models: [...models].filter((v) => v >= 0).sort((a, b) => a - b),
            tables: [...tables].sort(),
        });
    }
    return paths.sort((a, b) => (a.route < b.route ? -1 : a.route > b.route ? 1 : a.file - b.file));
}

function topDir(p: string): string {
    const parts = p.split('/');
    if (parts.length <= 1) return '.';
    return parts.slice(0, Math.min(2, parts.length - 1)).join('/');
}

/** One seeded Louvain pass over `nodes`; communities sorted by first member. */
function clusterOnce(nodes: number[], weights: Map<string, number>, seed: number, resolution: number): number[][] {
    const set = new Set(nodes);
    const g = new Graph({ type: 'undirected' });
    for (const n of nodes) g.addNode(String(n));
    for (const [k, w] of weights) {
        const [a, b] = k.split(' ').map(Number) as [number, number];
        if (set.has(a) && set.has(b)) g.addEdge(String(a), String(b), { weight: w });
    }
    if (g.size === 0) return nodes.map((n) => [n]);
    const assignment = louvain(g, { rng: seededRng(seed), resolution, getEdgeWeight: 'weight' });
    const byCommunity = new Map<number, number[]>();
    for (const n of nodes) {
        const c = assignment[String(n)] as number;
        const list = byCommunity.get(c) ?? [];
        list.push(n);
        byCommunity.set(c, list);
    }
    return [...byCommunity.values()]
        .map((l) => l.sort((a, b) => a - b))
        .sort((a, b) => (a[0] as number) - (b[0] as number));
}

/** Golden-angle spiral start: deterministic, spread, no two points equal. */
function spiral(i: number, scale: number): [number, number] {
    const angle = i * 2.399963229728653;
    const r = scale * Math.sqrt(i + 0.5);
    return [r * Math.cos(angle), r * Math.sin(angle)];
}

function normalise(points: Array<[number, number]>): Array<[number, number]> {
    if (points.length === 0) return [];
    if (points.length === 1) return [[0, 0]];
    let max = 0;
    let cx = 0;
    let cy = 0;
    for (const [x, y] of points) {
        cx += x;
        cy += y;
    }
    cx /= points.length;
    cy /= points.length;
    for (const [x, y] of points) max = Math.max(max, Math.abs(x - cx), Math.abs(y - cy));
    const s = max === 0 ? 1 : max;
    return points.map(([x, y]) => [round((x - cx) / s), round((y - cy) / s)]);
}

function runLayout(count: number, links: Array<[number, number, number]>, sizes?: number[]): Array<[number, number]> {
    const g = new Graph({ type: 'undirected' });
    for (let i = 0; i < count; i++) {
        const [x, y] = spiral(i, 10);
        g.addNode(String(i), { x, y, size: sizes ? Math.sqrt(sizes[i] as number) : 1 });
    }
    for (const [a, b, w] of links) {
        if (a === b || g.hasEdge(String(a), String(b))) continue;
        g.addEdge(String(a), String(b), { weight: w });
    }
    if (g.size > 0) {
        forceAtlas2.assign(g, {
            iterations: count > 400 ? 150 : 300,
            getEdgeWeight: 'weight',
            settings: { ...forceAtlas2.inferSettings(g), adjustSizes: false, barnesHutOptimize: false },
        });
    }
    const pts: Array<[number, number]> = [];
    for (let i = 0; i < count; i++) {
        const a = g.getNodeAttributes(String(i)) as { x: number; y: number };
        pts.push([a.x, a.y]);
    }
    return normalise(pts);
}

function layoutOverview(sizes: number[], areaEdges: Array<[number, number, number]>): Array<[number, number]> {
    return runLayout(sizes.length, areaEdges, sizes);
}

function layoutLocal(
    files: number[],
    edges: Array<[number, number, number]>,
    areaOf: number[],
    area: number,
    cap: number,
): { local: Array<[number, number, number]>; neighbours: number[] } {
    const inArea = new Set(files);
    const outsideWeight = new Map<number, number>();
    for (const [s, t, w] of edges) {
        if (inArea.has(s) && !inArea.has(t)) outsideWeight.set(t, (outsideWeight.get(t) ?? 0) + w);
        else if (inArea.has(t) && !inArea.has(s)) outsideWeight.set(s, (outsideWeight.get(s) ?? 0) + w);
    }
    const neighbours = [...outsideWeight.entries()]
        .filter(([f]) => areaOf[f] !== area)
        .sort((a, b) => b[1] - a[1] || a[0] - b[0])
        .slice(0, cap)
        .map(([f]) => f)
        .sort((a, b) => a - b);
    const nodes = [...files, ...neighbours];
    const pos = new Map(nodes.map((f, i) => [f, i] as const));
    const links: Array<[number, number, number]> = [];
    for (const [s, t, w] of edges) {
        const a = pos.get(s);
        const b = pos.get(t);
        if (a !== undefined && b !== undefined) links.push([a, b, w]);
    }
    const pts = runLayout(nodes.length, links);
    return { local: nodes.map((f, i) => [f, (pts[i] as [number, number])[0], (pts[i] as [number, number])[1]]), neighbours };
}

/** Tarjan's strongly connected components over the directed file layer. */
function tarjan(n: number, edges: Array<[number, number, number]>): number[][] {
    const adj: number[][] = Array.from({ length: n }, () => []);
    for (const [s, t] of edges) (adj[s] as number[]).push(t);
    const index = new Array<number>(n).fill(-1);
    const low = new Array<number>(n).fill(0);
    const onStack = new Array<boolean>(n).fill(false);
    const stack: number[] = [];
    const out: number[][] = [];
    let counter = 0;
    // Iterative, so a deep import chain cannot overflow the call stack.
    for (let root = 0; root < n; root++) {
        if (index[root] !== -1) continue;
        const work: Array<[number, number]> = [[root, 0]];
        while (work.length) {
            const frame = work[work.length - 1] as [number, number];
            const [v, i] = frame;
            if (i === 0) {
                index[v] = counter;
                low[v] = counter;
                counter += 1;
                stack.push(v);
                onStack[v] = true;
            }
            const next = adj[v] as number[];
            if (i < next.length) {
                frame[1] = i + 1;
                const w = next[i] as number;
                if (index[w] === -1) work.push([w, 0]);
                else if (onStack[w]) low[v] = Math.min(low[v] as number, index[w] as number);
                continue;
            }
            work.pop();
            const parent = work[work.length - 1];
            if (parent) low[parent[0]] = Math.min(low[parent[0]] as number, low[v] as number);
            if (low[v] === index[v]) {
                const comp: number[] = [];
                let w: number;
                do {
                    w = stack.pop() as number;
                    onStack[w] = false;
                    comp.push(w);
                } while (w !== v);
                out.push(comp.sort((a, b) => a - b));
            }
        }
    }
    return out;
}
