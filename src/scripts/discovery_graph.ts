#!/usr/bin/env tsx
/**
 * Artefact relation-graph + `affected` / `explain`
 * (road-to-retrieval-substrate-hardening B4).
 *
 * Builds a deterministic relation graph over the discovery manifest's
 * artefacts — edges extracted from EXISTING structured fields, no LLM, no
 * content-guessing:
 *
 *   - `replaces`      → A —supersedes→ B          (EXTRACTED; + reverse superseded_by)
 *   - `routes_to`     → A —routes_to→ B           (EXTRACTED; rule→skill / router edges)
 *   - ADR path target → A —references_adr→ ADR    (EXTRACTED; a field points at docs/decisions/ADR-*)
 *   - `packs`         → A —member_of→ pack:<id>   (INFERRED)
 *   - `workspaces`    → A —member_of→ workspace:<id> (INFERRED)
 *
 * Edges carry their OWN confidence scale (`EXTRACTED/INFERRED/AMBIGUOUS`),
 * separate from the evidence tiers — a doc-only mapping, never used to override
 * an evidence tier (council Q1). The graph is content-addressed to the
 * manifest checksum and cached in a version-namespaced file, rebuilt lazily
 * (council Q3): an unchanged manifest reuses the cache; the write is atomic.
 *
 * Subcommands:
 *   build   [--manifest P] [--out P] [--force]     (re)build the graph cache
 *   affected <artefact> [--depth N] [--manifest P]  relation-filtered BFS
 *   explain  <concept>   [--budget N] [--manifest P] seed + 2-hop + budget-cut
 *   orphans [--manifest P]                          zero-inbound artefact REPORT
 *
 * `orphans` is a **report, never a gate** (road-to-inbox-harvest-2026-08-b
 * estate-lifecycle 3.2): the relation set above is five typed edges and sees a
 * strictly narrower graph than `check_references.ts`, so a prose-only
 * cross-reference produces no edge and a reachable artefact reads as
 * zero-inbound. The false-positive class is provably non-empty, which is why
 * the command exits 0 on hits and points at review rather than removal.
 *
 * Per-pass `stats` accompany the graph: each edge-extraction pass is wrapped in
 * its own `try`, so one malformed field records `"error"` for that pass instead
 * of failing the whole build silently or loudly.
 *
 * Exit codes: 0 ok, 1 not-found, 2 usage error, 3 internal error.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { reportScanned } from './_lib/scan_scope.js';
import { scanCached } from './_lib/stat_index.js';

const PROG = 'discovery_graph.ts';
const _HERE = fileURLToPath(import.meta.url);
export const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
// discovery-graph-v<N>.json → version namespace in the path (versioned-cache B5b).
// The FILE name stays v1 on purpose: `complexity_report.ts:234` reads this exact
// path. `schema_version` inside the payload carries the shape version instead,
// and `getGraph` forces a rebuild when a cached payload predates it.
export const GRAPH_CACHE = path.join(REPO_ROOT, 'agents', 'runtime', 'state', 'discovery-graph-v1.json');

/** Payload shape version. Bumped when `Graph` gains or changes a field. */
export const GRAPH_SCHEMA_VERSION = 2;

/**
 * Prefixes that mark a node as SYNTHETIC — a pack or workspace container the
 * graph invents, not an artefact on disk. Artefact ids are bare repo-relative
 * paths (`idOf`), so the two live in one id space; anything reasoning over
 * "artefacts" must exclude these explicitly rather than assume no path ever
 * starts with `pack:`.
 */
export const SYNTHETIC_NODE_PREFIXES = ['pack:', 'workspace:'] as const;

/** True when `id` names a pack/workspace container rather than an artefact. */
export function isSyntheticNode(id: string): boolean {
    return SYNTHETIC_NODE_PREFIXES.some((p) => id.startsWith(p));
}

export type EdgeConfidence = 'EXTRACTED' | 'INFERRED' | 'AMBIGUOUS';
export interface Edge {
    from: string;
    to: string;
    rel: string;
    confidence: EdgeConfidence;
}
/** Per-pass edge counts; `"error"` marks a pass that threw and produced nothing. */
export type GraphStats = Record<string, number | 'error'>;
export interface Graph {
    schema_version: number;
    source_checksum: string;
    nodes: string[];
    edges: Edge[];
    stats: GraphStats;
}

interface Artefact {
    path: string;
    category?: string;
    name?: string;
    slug?: string;
    replaces?: unknown;
    routes_to?: unknown;
    packs?: unknown;
    workspaces?: unknown;
}
interface Manifest {
    checksum?: string;
    artefacts: Artefact[];
}

function _asStrings(v: unknown): string[] {
    if (typeof v === 'string') return [v];
    if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string');
    return [];
}

/** Load the manifest from a path, or build it fresh via the release scanner. */
export function loadManifest(manifestPath: string | null): Manifest {
    let text: string;
    if (manifestPath !== null) {
        text = fs.readFileSync(manifestPath, 'utf-8');
    } else {
        text = execFileSync('npx', ['tsx', path.join(REPO_ROOT, 'src', 'scripts', 'build_discovery_manifest.ts')], {
            cwd: REPO_ROOT,
            encoding: 'utf-8',
            maxBuffer: 64 * 1024 * 1024,
        });
    }
    const start = text.indexOf('{');
    const parsed = JSON.parse(start > 0 ? text.slice(start) : text) as Manifest;
    if (!Array.isArray(parsed.artefacts)) throw new Error('manifest has no artefacts[]');
    return parsed;
}

/** The five independent edge-extraction passes, in stats-key order. */
const _PASSES = ['supersedes', 'routes_to', 'references_adr', 'member_of_pack', 'member_of_workspace'] as const;
type PassName = (typeof _PASSES)[number];

/** Deterministic edge extraction from the manifest's structured fields. */
export function buildGraph(manifest: Manifest): Graph {
    const nodeSet = new Set<string>();
    const edges: Edge[] = [];
    const idOf = (a: Artefact): string => a.path;

    // Per-pass counters + error containment. One malformed field must not cost
    // the other four passes: a pass that throws is recorded as `"error"` and
    // contributes no edges, instead of aborting the build or — worse — being
    // swallowed into a silently smaller graph nobody can distinguish from a
    // correct one.
    const counts = new Map<PassName, number>(_PASSES.map((p) => [p, 0]));
    const failed = new Set<PassName>();
    const run = (pass: PassName, fn: () => number): void => {
        if (failed.has(pass)) return;
        try {
            counts.set(pass, (counts.get(pass) ?? 0) + fn());
        } catch {
            failed.add(pass);
        }
    };

    for (const a of manifest.artefacts) {
        const id = idOf(a);
        nodeSet.add(id);
        run('supersedes', () => {
            let n = 0;
            for (const r of _asStrings(a.replaces)) {
                edges.push({ from: id, to: r, rel: 'supersedes', confidence: 'EXTRACTED' });
                edges.push({ from: r, to: id, rel: 'superseded_by', confidence: 'EXTRACTED' });
                nodeSet.add(r);
                n += 2;
            }
            return n;
        });
        run('routes_to', () => {
            let n = 0;
            for (const t of _asStrings(a.routes_to)) {
                edges.push({ from: id, to: t, rel: 'routes_to', confidence: 'EXTRACTED' });
                nodeSet.add(t);
                n += 1;
            }
            return n;
        });
        // ADR references surfaced through any structured target field.
        run('references_adr', () => {
            let n = 0;
            for (const t of [..._asStrings(a.replaces), ..._asStrings(a.routes_to)]) {
                if (/(^|\/)docs\/(decisions|adr)\/ADR-/i.test(t) || /\bADR-\d+/.test(t)) {
                    edges.push({ from: id, to: t, rel: 'references_adr', confidence: 'EXTRACTED' });
                    nodeSet.add(t);
                    n += 1;
                }
            }
            return n;
        });
        run('member_of_pack', () => {
            let n = 0;
            for (const p of _asStrings(a.packs)) {
                const node = `pack:${p}`;
                edges.push({ from: id, to: node, rel: 'member_of', confidence: 'INFERRED' });
                nodeSet.add(node);
                n += 1;
            }
            return n;
        });
        run('member_of_workspace', () => {
            let n = 0;
            for (const w of _asStrings(a.workspaces)) {
                const node = `workspace:${w}`;
                edges.push({ from: id, to: node, rel: 'member_of', confidence: 'INFERRED' });
                nodeSet.add(node);
                n += 1;
            }
            return n;
        });
    }

    const stats: GraphStats = {};
    for (const p of _PASSES) stats[p] = failed.has(p) ? 'error' : (counts.get(p) ?? 0);
    const artefactIds = new Set(manifest.artefacts.map(idOf));

    // Stable, de-duplicated ordering → byte-stable output.
    const seen = new Set<string>();
    const uniq = edges.filter((e) => {
        const k = `${e.from}\0${e.to}\0${e.rel}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
    });
    uniq.sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to) || a.rel.localeCompare(b.rel));
    // Distinct EXTRACTED targets that name no artefact in the manifest. The
    // structured fields carry LOGICAL names (`commit:in-chunks`) while node ids
    // are repo-relative paths, so a non-zero count here means inbound degree is
    // systematically under-counted — the fact any inverse traversal has to know
    // before it presents a list. Measured, not assumed: see
    // `agents/evidence/analysis/discovery-graph-inbound-degree.md`.
    const danglingTargets = new Set(
        uniq.filter((e) => e.confidence === 'EXTRACTED' && !artefactIds.has(e.to)).map((e) => e.to),
    );
    stats['dangling_targets'] = danglingTargets.size;
    const checksum =
        typeof manifest.checksum === 'string' && manifest.checksum
            ? manifest.checksum
            : 'sha256:' + createHash('sha256').update(JSON.stringify(manifest.artefacts)).digest('hex');
    return {
        schema_version: GRAPH_SCHEMA_VERSION,
        source_checksum: checksum,
        nodes: [...nodeSet].sort(),
        edges: uniq,
        // Counts are edges EXTRACTED per pass, before the de-duplication above —
        // so they sum to ≥ `edges.length` and stay attributable to one pass.
        stats,
    };
}

/** Recursively list files under a dir (for the stat-index signature). */
function _walk(dir: string, acc: string[]): void {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return;
    }
    for (const e of entries) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) _walk(p, acc);
        else if (e.isFile()) acc.push(p);
    }
}

/** The discovery source tree whose stat signature gates a graph rebuild. */
function _sourceFiles(): string[] {
    const acc: string[] = [];
    for (const rel of ['src', path.join('docs', 'decisions'), path.join('docs', 'adr')]) {
        _walk(path.join(REPO_ROOT, rel), acc);
    }
    return acc;
}

/**
 * Lazily return the graph (council Q3): a stat-index over the discovery source
 * tree skips the (expensive) manifest subprocess + rebuild when nothing
 * changed. `scanCached` handles the version-namespaced cache + atomic write;
 * the compute closure runs only on a signature miss.
 */
export function getGraph(manifestPath: string | null, force: boolean): Graph {
    // A caller-supplied manifest is authoritative — build from it directly and
    // do NOT touch the shared tree-cache (whose format is scanCached's wrapper).
    if (manifestPath !== null) {
        return buildGraph(loadManifest(manifestPath));
    }
    const files = _sourceFiles();
    const graph = scanCached<Graph>(GRAPH_CACHE, files, () => buildGraph(loadManifest(null)), force);
    // A cache written before the current payload shape is a stale shape, not a
    // stale signature — `scanCached` compares signatures only, so the guard is
    // here. One forced rebuild costs a manifest pass; serving a payload missing
    // fields the caller's type promises costs a wrong answer.
    if (graph.schema_version !== GRAPH_SCHEMA_VERSION) {
        return scanCached<Graph>(GRAPH_CACHE, files, () => buildGraph(loadManifest(null)), true);
    }
    return graph;
}

/**
 * Artefact nodes with zero inbound EXTRACTED edges — the estate's "nothing
 * points at this" question, as an inverse traversal of the existing edge set.
 *
 * Two exclusions, both load-bearing:
 *
 * - `member_of` is INFERRED (`packs`/`workspaces`), and every packed artefact
 *   has one. Counting it would make almost everything look reachable via its
 *   own pack node and reduce the report to noise.
 * - Synthetic pack/workspace nodes are not artefacts and are never the subject
 *   of the question.
 *
 * The result is a REVIEW list, never a removal list — see the module header.
 */
export function inboundZero(graph: Graph): string[] {
    const withInbound = new Set<string>();
    for (const e of graph.edges) {
        if (e.confidence !== 'EXTRACTED') continue;
        withInbound.add(e.to);
    }
    return graph.nodes.filter((n) => !isSyntheticNode(n) && !withInbound.has(n)).sort();
}

/** Relation-filtered BFS from a start node. Returns reachable nodes + hop depth. */
export function affected(graph: Graph, start: string, maxDepth: number): Array<{ node: string; depth: number; via: string }> {
    const adj = new Map<string, Edge[]>();
    for (const e of graph.edges) {
        const list = adj.get(e.from) ?? [];
        list.push(e);
        adj.set(e.from, list);
    }
    const out: Array<{ node: string; depth: number; via: string }> = [];
    const seen = new Set<string>([start]);
    let frontier: Array<{ node: string; via: string }> = [{ node: start, via: '' }];
    for (let depth = 1; depth <= maxDepth && frontier.length > 0; depth++) {
        const next: Array<{ node: string; via: string }> = [];
        for (const f of frontier) {
            for (const e of (adj.get(f.node) ?? []).sort((a, b) => a.to.localeCompare(b.to))) {
                if (seen.has(e.to)) continue;
                seen.add(e.to);
                out.push({ node: e.to, depth, via: e.rel });
                next.push({ node: e.to, via: e.rel });
            }
        }
        frontier = next;
    }
    return out;
}

/** Seed-match artefacts by substring, expand 2 hops, cut at the node budget. */
export function explain(graph: Graph, concept: string, budget: number): { seeds: string[]; nodes: Array<{ node: string; depth: number; via: string }> } {
    const c = concept.toLowerCase();
    const seeds = graph.nodes.filter((n) => n.toLowerCase().includes(c)).sort();
    const collected = new Map<string, { node: string; depth: number; via: string }>();
    for (const s of seeds) {
        for (const hit of affected(graph, s, 2)) {
            if (!collected.has(hit.node)) collected.set(hit.node, hit);
        }
    }
    const nodes = [...collected.values()]
        .sort((a, b) => a.depth - b.depth || a.node.localeCompare(b.node))
        .slice(0, budget);
    return { seeds, nodes };
}

export function main(argv: string[]): number {
    const sub = argv[0];
    const rest = argv.slice(1);
    const opt = (flag: string): string | null => {
        const i = rest.indexOf(flag);
        return i >= 0 && i + 1 < rest.length ? (rest[i + 1] as string) : null;
    };
    const manifestPath = opt('--manifest');
    const positional = rest.filter((a, i) => !a.startsWith('--') && !(i > 0 && (rest[i - 1] as string).startsWith('--')));

    try {
        if (sub === 'build') {
            const graph = getGraph(manifestPath, rest.includes('--force'));
            process.stdout.write(`${PROG}: graph — ${graph.nodes.length} nodes, ${graph.edges.length} edges\n`);
            for (const [pass, n] of Object.entries(graph.stats)) {
                process.stdout.write(`  ${pass}: ${String(n)}\n`);
            }
            reportScanned({
                gate: PROG,
                scanned: graph.nodes.length,
                units: 'node(s)',
                roots: ['src', 'docs/decisions', 'docs/adr'],
            });
            return 0;
        }
        if (sub === 'orphans') {
            const graph = getGraph(manifestPath, false);
            const hits = inboundZero(graph);
            const dangling = graph.stats['dangling_targets'];
            // Degraded path, NAMED rather than papered over: while EXTRACTED
            // targets do not resolve to artefact paths, inbound degree is
            // under-counted for every artefact and the list below is the whole
            // estate, not a finding. Printing it anyway would be a report that
            // looks like evidence and is not.
            if (typeof dangling === 'number' && dangling > 0) {
                process.stdout.write(
                    `${PROG}: inbound degree is DEGRADED — ${String(dangling)} EXTRACTED edge target(s)\n` +
                        'name no artefact path in the manifest (the structured fields carry logical\n' +
                        'names, node ids are repo-relative paths). Every artefact therefore reads as\n' +
                        `zero-inbound (${String(hits.length)} of ${String(graph.nodes.length)} nodes), which is a\n` +
                        'property of the edge set, not of the estate. No list is printed.\n' +
                        'See `agents/evidence/analysis/discovery-graph-inbound-degree.md`.\n',
                );
                return 0;
            }
            process.stdout.write(`zero-inbound artefacts (${hits.length} of ${graph.nodes.length} nodes):\n`);
            for (const h of hits) process.stdout.write(`  ${h}\n`);
            // 3.3 — the disposition line travels WITH the list, so a reader who
            // sees only the output still sees what it licenses.
            process.stdout.write(
                '\nThis is a review prompt, not a removal list. The graph sees five typed\n' +
                    'edge kinds and no prose cross-references, so a referenced artefact can\n' +
                    'appear here; `check_references.ts` is the cross-reference gate, not this.\n' +
                    'Sunset stays explicit and recorded in the removing commit, with no\n' +
                    'tombstone files (`docs/governance.md` § Skill lifecycle policy), and the\n' +
                    'shipped precedent for stale artefacts is archive-not-delete\n' +
                    '(`src/scripts/janitor.ts:10` — never auto-sweeps).\n',
            );
            return 0;
        }
        if (sub === 'affected') {
            const start = positional[0];
            if (start === undefined) {
                process.stderr.write(`${PROG}: affected <artefact> required\n`);
                return 2;
            }
            const graph = getGraph(manifestPath, false);
            if (!graph.nodes.includes(start)) {
                process.stderr.write(`${PROG}: not in graph: ${start}\n`);
                return 1;
            }
            const depth = Number(opt('--depth') ?? '3');
            const hits = affected(graph, start, Number.isFinite(depth) ? depth : 3);
            process.stdout.write(`affected by ${start} (${hits.length}):\n`);
            for (const h of hits) process.stdout.write(`  [${h.depth}] ${h.node}  (via ${h.via})\n`);
            return 0;
        }
        if (sub === 'explain') {
            const concept = positional[0];
            if (concept === undefined) {
                process.stderr.write(`${PROG}: explain <concept> required\n`);
                return 2;
            }
            const graph = getGraph(manifestPath, false);
            const budget = Number(opt('--budget') ?? '20');
            const { seeds, nodes } = explain(graph, concept, Number.isFinite(budget) ? budget : 20);
            process.stdout.write(`explain "${concept}" — ${seeds.length} seed(s), ${nodes.length} related:\n`);
            for (const n of nodes) process.stdout.write(`  [${n.depth}] ${n.node}  (via ${n.via})\n`);
            return 0;
        }
        process.stderr.write(`usage: ${PROG} <build|affected|explain|orphans> [args]\n`);
        return 2;
    } catch (exc) {
        process.stderr.write(`${PROG}: error: ${String(exc)}\n`);
        return 3;
    }
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? '')) {
    process.exit(main(process.argv.slice(2)));
}
