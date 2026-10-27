/**
 * `confirm`: re-read only the witnesses of an answer and say, per fact, whether
 * the working tree still holds it — `confirmed | moved | changed | gone`, or
 * `added` for a fact the working-tree overlay holds and the index does not.
 *
 * Node metadata comes from the SQLite index one row at a time; the JSON graph is
 * never opened, because loading it dominates every other cost on a real
 * repository and a confirm has to stay cheap enough that agents run it. When the
 * index cannot serve, confirm refuses rather than falling back to the JSON.
 *
 * The change-risk class of the witnessed files picks a depth — R0 none, R1 the
 * witnesses, R2 plus a text cross-check, R3 plus the callers one hop out and a
 * drift re-run over those facts. In shadow (the default) the witnesses are read
 * whatever the class says and the chosen depth is only recorded, one line per
 * call; `depth: 'auto'` runs the chosen depth.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { classifyPaths, type RiskClass } from '../../classify_change_risk.js';
import { evaluateDrift, type DriftFinding } from '../drift.js';
import { DRIFT_RULES } from '../drift_rules.js';
import type { ConfirmState } from '../map_areas.js';
import { type GraphIndex, openGraphIndex } from '../sqlite_store.js';
import { edgeKey, nodeOwner } from './owner_index.js';
import type { CodeEdge, CodeNode } from '../types.js';
import defaults from './defaults.json';
import { type LowerBound, lowerBound } from './lower_bound.js';
import { readOverlay, type Overlay } from './overlay.js';
import { headSha, verifyPaths } from './paths.js';
import type { WitnessKind } from '../lanes/lane_fact.js';
import { existingCommits } from './verify_all.js';
import { checkWitness, FileCache, nameToken, type WitnessResult, witnessKind } from './witness_check.js';
import { readTombstones, type Tombstone, tombstoneFor, writeTombstones } from './tombstones.js';

export type ConfirmDepth = 'none' | 'witness' | 'text' | 'full';

export const DEPTH_BY_CLASS: Readonly<Record<RiskClass, ConfirmDepth>> = { R0: 'none', R1: 'witness', R2: 'text', R3: 'full' };

export interface ConfirmItem {
    id: string;
    label: string;
    kind: string;
    state: ConfirmState;
    /** `file:line` the fact was read at. */
    at: string | null;
    now_at?: string;
    /** What decided the state. */
    by: 'hash' | 'name' | 'overlay' | 'tombstone' | 'file' | 'skipped';
    tombstone?: { reason: Tombstone['reason']; basis: string };
    /** Present at depth `text` and `full`. */
    usage?: LowerBound;
}

export interface ConfirmResult {
    status: 'ok' | 'unavailable';
    error?: string;
    items: ConfirmItem[];
    not_found: string[];
    counts: Partial<Record<ConfirmState, number>>;
    risk: { class: RiskClass; reason: string; depth_chosen: ConfirmDepth; depth_ran: ConfirmDepth };
    /** Facts reached one hop in at depth `full`, confirmed the same way. */
    fan_out?: ConfirmItem[];
    /** Drift findings on the confirmed facts at depth `full`. */
    drift?: DriftFinding[];
    witnesses: number;
    ms: number;
}

export interface ConfirmOptions {
    /** `witness` (default, shadow) reads the witnesses whatever the class says; `auto` runs the class's depth. */
    depth?: 'witness' | 'auto' | ConfirmDepth;
    /** Also confirm the far ends of the given ids' edges, up to `confirm_neighbours`. */
    neighbours?: 'in' | 'out' | 'both';
    /** Write the shadow line; default true. */
    shadow?: boolean;
    /** Test seam for the index. */
    index?: GraphIndex;
}

function witnessOf(n: CodeNode): { file: string; line: number; hash: string | null; kind?: WitnessKind } | null {
    const w = n.fact?.witness;
    if (w) return { file: w.file, line: w.line, hash: w.hash || null, ...(w.kind ? { kind: w.kind } : {}) };
    if (!n.source_file) return null;
    return { file: n.source_file, line: (n.source_location[0] as number | undefined) ?? 0, hash: null };
}

function checkNode(files: FileCache, n: CodeNode): { result: WitnessResult | null; at: string | null } {
    const w = witnessOf(n);
    if (!w) return { result: null, at: null };
    const kind = witnessKind(w);
    if (n.kind === 'file' || kind === 'file') {
        const exists = files.lines(w.file) !== null;
        return { result: { state: exists ? 'confirmed' : 'gone', at: w.file, by: 'name' }, at: w.file };
    }
    if (kind === 'commit') {
        const at = `${w.file}@${w.hash ?? ''}`;
        return { result: { state: existingCommits(files.root, [w.hash ?? '']).size ? 'confirmed' : 'gone', at, by: 'hash' }, at };
    }
    const result = checkWitness(files, { file: w.file, line: w.line, hash: kind === 'name' ? null : w.hash, name: nameToken(n.label) });
    return { result, at: result.at };
}

/** Confirm `ids` against the working tree of `root`, reading node rows from the index beside `cachePath`. */
export function confirmIds(root: string, cachePath: string, ids: readonly string[], opts: ConfirmOptions = {}): ConfirmResult {
    const t0 = performance.now();
    const ownIndex = opts.index ? null : openGraphIndex(cachePath);
    const index = opts.index ?? ownIndex;
    const blankRisk = { class: 'R3' as RiskClass, reason: 'nothing read', depth_chosen: 'full' as ConfirmDepth, depth_ran: 'none' as ConfirmDepth };
    if (!index) {
        return {
            status: 'unavailable',
            error: 'the graph index is absent or stale — run `agent-config code-graph build` (confirm never reads the JSON graph)',
            items: [],
            not_found: [...ids],
            counts: {},
            risk: blankRisk,
            witnesses: 0,
            ms: performance.now() - t0,
        };
    }
    try {
        const paths = verifyPaths(cachePath);
        const overlay = readOverlay(cachePath, index.sourceChecksum);
        const stones = readTombstones(paths.tombstones);
        const files = new FileCache(root);
        const wanted = withNeighbours(index, overlay, ids, opts.neighbours);
        const resolved = wanted.map((id) => ({ id, node: lookup(index, overlay, id) }));
        const witnessFiles = [...new Set(resolved.map((r) => (r.node ? witnessOf(r.node)?.file : undefined)).filter((f): f is string => !!f))];
        const cls = classifyPaths(witnessFiles);
        const chosen = DEPTH_BY_CLASS[cls.cls];
        const ran: ConfirmDepth = opts.depth === 'auto' ? chosen : opts.depth === undefined || opts.depth === 'witness' ? 'witness' : opts.depth;
        const newStones: Tombstone[] = [];
        // A git call costs more than the whole witness read; only a tombstone needs the basis.
        let basisMemo: string | null = null;
        const basis = (): string => (basisMemo ??= `${headSha(root) ?? 'no-commit'}${overlay?.basis.dirty ? '+dirty' : ''}`);

        const confirmOne = (id: string, n: CodeNode | undefined): ConfirmItem | null => {
            if (!n) {
                const t = tombstoneFor(stones, id);
                if (!t) return null;
                return { id, label: t.label, kind: t.kind, state: 'gone', at: t.witness ? `${t.witness.file}:${t.witness.line}` : null, by: 'tombstone', tombstone: { reason: t.reason, basis: t.basis } };
            }
            const added = overlay?.added.includes(id) === true;
            if (ran === 'none') {
                const w = witnessOf(n);
                return { id, label: n.label, kind: n.kind, state: added ? 'added' : 'unconfirmed', at: w ? `${w.file}:${w.line}` : null, by: 'skipped' };
            }
            const { result, at } = checkNode(files, n);
            if (!result) return { id, label: n.label, kind: n.kind, state: added ? 'added' : 'unconfirmed', at, by: 'skipped' };
            const item: ConfirmItem = { id, label: n.label, kind: n.kind, state: added ? 'added' : result.state, at, by: n.kind === 'file' ? 'file' : result.by };
            if (result.now_at) item.now_at = result.now_at;
            if (result.state === 'gone') {
                const prior = tombstoneFor(stones, id);
                const reason: Tombstone['reason'] = files.lines(witnessOf(n)?.file ?? '') === null ? 'owner-deleted' : 'span-gone';
                if (!prior) newStones.push({ id, kind: n.kind, label: n.label, owner: nodeOwner(n), witness: n.fact?.witness ?? null, reason, basis: basis(), by: 'confirm' });
                item.tombstone = prior ? { reason: prior.reason, basis: prior.basis } : { reason, basis: basis() };
            }
            if (ran === 'text' || ran === 'full') {
                const users = index.edgesTo(id).map((e) => lookup(index, overlay, e.source)).filter((x): x is CodeNode => !!x).map(nodeOwner);
                item.usage = lowerBound(root, nameToken(n.label), users, [nodeOwner(n)], paths.readerGaps);
            }
            return item;
        };

        const items: ConfirmItem[] = [];
        const notFound: string[] = [];
        for (const { id, node } of resolved) {
            const it = confirmOne(id, node);
            if (it) items.push(it);
            else notFound.push(id);
        }
        const result: ConfirmResult = {
            status: 'ok',
            items,
            not_found: notFound,
            counts: countStates(items),
            risk: { class: cls.cls, reason: cls.reason, depth_chosen: chosen, depth_ran: ran },
            witnesses: items.filter((i) => i.by !== 'skipped' && i.by !== 'tombstone').length,
            ms: 0,
        };
        if (ran === 'full') {
            const seen = new Set(items.map((i) => i.id));
            const fan: ConfirmItem[] = [];
            for (const it of items) {
                for (const e of index.edgesTo(it.id)) {
                    if (seen.has(e.source) || fan.length >= defaults.confirm_neighbours) continue;
                    seen.add(e.source);
                    const one = confirmOne(e.source, lookup(index, overlay, e.source));
                    if (one) fan.push(one);
                }
            }
            result.fan_out = fan;
            result.drift = driftFor(index, overlay, items.map((i) => i.id));
        }
        if (newStones.length > 0) writeTombstones(paths.tombstones, newStones);
        result.ms = performance.now() - t0;
        if (opts.shadow !== false) recordShadow(paths.shadow, result, wanted.length);
        return result;
    } finally {
        ownIndex?.close();
    }
}

function lookup(index: GraphIndex, overlay: Overlay | null, id: string): CodeNode | undefined {
    if (overlay) {
        const own = overlay.nodes.find((n) => n.id === id);
        if (own) return own;
        if (overlay.removed_nodes.includes(id)) return undefined;
    }
    return index.getNode(id);
}

function withNeighbours(index: GraphIndex, overlay: Overlay | null, ids: readonly string[], dir: ConfirmOptions['neighbours']): string[] {
    const out = [...new Set(ids)];
    if (!dir) return out;
    const seen = new Set(out);
    let added = 0;
    for (const id of ids) {
        const edges: CodeEdge[] = [];
        if (dir !== 'out') edges.push(...index.edgesTo(id), ...(overlay?.edges.filter((e) => e.target === id) ?? []));
        if (dir !== 'in') edges.push(...index.edgesFrom(id), ...(overlay?.edges.filter((e) => e.source === id) ?? []));
        for (const e of edges) {
            const far = e.source === id ? e.target : e.source;
            if (seen.has(far) || added >= defaults.confirm_neighbours) continue;
            seen.add(far);
            out.push(far);
            added += 1;
        }
    }
    return out;
}

function countStates(items: readonly ConfirmItem[]): Partial<Record<ConfirmState, number>> {
    const c: Partial<Record<ConfirmState, number>> = {};
    for (const i of items) c[i.state] = (c[i.state] ?? 0) + 1;
    return c;
}

/** Drift over the confirmed facts, their edges and the far ends, reporting only findings that touch them. */
export function driftFor(index: GraphIndex, overlay: Overlay | null, ids: readonly string[]): DriftFinding[] {
    const nodes = new Map<string, CodeNode>();
    const edges = new Map<string, CodeEdge>();
    for (const id of ids) {
        const n = lookup(index, overlay, id);
        if (n) nodes.set(id, n);
        const fromOverlay = overlay?.edges.filter((e) => e.source === id || e.target === id) ?? [];
        for (const e of [...index.edgesFrom(id), ...index.edgesTo(id), ...fromOverlay]) {
            edges.set(edgeKey(e), e);
            for (const end of [e.source, e.target]) {
                const m = nodes.has(end) ? undefined : lookup(index, overlay, end);
                if (m) nodes.set(end, m);
            }
        }
    }
    const graph = {
        schema_version: 0,
        source_checksum: index.sourceChecksum,
        languages: [],
        grammar_abi: 0,
        edge_confidence_counts: { EXTRACTED: 0, INFERRED: 0, AMBIGUOUS: 0 },
        suppressed_edge_counts: { dynamic_no_candidate: 0 },
        nodes: [...nodes.values()],
        edges: [...edges.values()],
    };
    const touched = new Set(ids);
    return evaluateDrift(graph, DRIFT_RULES).findings.filter((f) => f.witnesses.some((w) => w?.id != null && touched.has(w.id)) || touched.has(f.subject));
}

function recordShadow(file: string, r: ConfirmResult, asked: number): void {
    try {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.appendFileSync(
            file,
            `${JSON.stringify({ at: new Date().toISOString(), asked, witnesses: r.witnesses, class: r.risk.class, reason: r.risk.reason, depth_chosen: r.risk.depth_chosen, depth_ran: r.risk.depth_ran, enforced: r.risk.depth_ran === r.risk.depth_chosen, counts: r.counts, ms: Math.round(r.ms * 10) / 10 })}\n`,
        );
    } catch {
        /* the shadow is a record, never a reason to fail the confirm */
    }
}

export function renderConfirm(r: ConfirmResult): string[] {
    if (r.status !== 'ok') return [`confirm: ${r.error ?? 'unavailable'}`];
    const lines = r.items.map((i) => {
        const tail = [i.now_at ? `now ${i.now_at}` : '', i.tombstone ? `tombstone ${i.tombstone.reason} at ${i.tombstone.basis}` : '', i.usage ? i.usage.line : ''].filter(Boolean).join('; ');
        return `${i.state.padEnd(11)} ${i.label} [${i.kind}]${i.at ? ` at=${i.at}` : ''}${tail ? ` — ${tail}` : ''}`;
    });
    for (const id of r.not_found) lines.push(`not-found   ${id} — no node and no tombstone with this id`);
    for (const f of r.fan_out ?? []) lines.push(`  caller ${f.state.padEnd(11)} ${f.label} [${f.kind}]${f.at ? ` at=${f.at}` : ''}`);
    for (const d of r.drift ?? []) lines.push(`  drift ${d.rule} ${d.message}`);
    const counts = Object.entries(r.counts).map(([k, v]) => `${v} ${k}`).join(', ') || 'nothing';
    lines.push(`${counts} · ${r.witnesses} witness(es) read in ${r.ms.toFixed(1)} ms · risk ${r.risk.class} → depth ${r.risk.depth_chosen} (ran ${r.risk.depth_ran}${r.risk.depth_ran === r.risk.depth_chosen ? '' : ', shadow'})`);
    return lines;
}
