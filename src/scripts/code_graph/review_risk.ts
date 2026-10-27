/**
 * `review-risk` — what a diff touches, as a transparent sum.
 *
 * Diff hunks select the symbols whose span they overlap (the file itself when
 * none does). From there each term counts facts of the graph, and every counted
 * fact is listed with its witness, so the total can be re-derived by hand:
 *
 *   callers          symbols reaching a changed symbol within two hops
 *   entry points     declared entry points whose flow passes a changed or calling symbol
 *   flows            those flows
 *   missing partners files that usually change with a changed file and are not in the diff
 *   area crossings   knowledge areas the diff reaches beyond the first
 *   columns          columns and tables the diff redefines, reads or writes
 *   operations       external operations the changed symbols call or the diff redefines
 *   pipelines        workflows and jobs the diff redefines
 *
 * Weights are data (`RISK_WEIGHTS`); the score is a sum of count × weight, never
 * a model. Reading the diff runs `git diff`, nothing else touches the network.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { gitProbe } from '../_lib/spawn_env.js';
import { spanHash } from './lanes/lane_fact.js';
import { admitEdge, type WalkOptions } from './query.js';
import type { CodeEdge, CodeGraph, CodeNode } from './types.js';
import { laneOfKind } from './vocabulary.js';

export const RISK_TERMS = ['callers', 'entry points', 'flows', 'missing partners', 'area crossings', 'columns', 'operations', 'pipelines'] as const;
export type RiskTerm = (typeof RISK_TERMS)[number];

export const RISK_WEIGHTS: Readonly<Record<RiskTerm, number>> = {
    callers: 1,
    'entry points': 3,
    flows: 2,
    'missing partners': 2,
    'area crossings': 2,
    columns: 2,
    operations: 3,
    pipelines: 3,
};

/** Relations a caller reaches a symbol over; `member` and `documents` say nothing about behaviour. */
const CALLER_RELATIONS = new Set(['calls', 'uses', 'imports', 'inherits', 'injects', 'renders', 'includes', 'routes-to', 'tests']);
const SYMBOL_KINDS = new Set(['class', 'interface', 'trait', 'function', 'method', 'constant', 'type', 'enum', 'route']);

export interface RiskWitness {
    file: string;
    line: number;
    hash: string;
}

export interface RiskItem {
    id: string;
    label: string;
    /** Why it counts, as a relation from the diff. */
    why: string;
    witness: RiskWitness | null;
}

export interface Hunk {
    file: string;
    /** 1-based inclusive line range on the side the file exists on. */
    from: number;
    to: number;
}

export interface ReviewRisk {
    rev: string;
    changed: string[];
    hunks: Hunk[];
    seeds: RiskItem[];
    terms: Array<{ term: RiskTerm; weight: number; contribution: number; items: RiskItem[] }>;
    total: number;
    /** What the sum was computed from. */
    basis: { graph_checksum: string; weights: Readonly<Record<RiskTerm, number>> };
}

/** `git diff -U0 <rev>` (working tree, staged included) as hunks; null when the rev does not resolve. */
export function diffHunks(root: string, rev: string): Hunk[] | null {
    if (rev.startsWith('-')) return null;
    let out: string;
    try {
        out = gitProbe(root, ['-c', 'core.quotePath=false', 'diff', '-U0', '--relative', '--no-color', '--no-ext-diff', rev, '--'], { maxBuffer: 256 * 1024 * 1024 });
    } catch {
        return null;
    }
    return parseUnifiedZero(out);
}

export function parseUnifiedZero(text: string): Hunk[] {
    const hunks: Hunk[] = [];
    let oldFile: string | null = null;
    let newFile: string | null = null;
    for (const line of text.split('\n')) {
        if (line.startsWith('--- ')) oldFile = line === '--- /dev/null' ? null : line.slice(4).replace(/^a\//, '');
        else if (line.startsWith('+++ ')) newFile = line === '+++ /dev/null' ? null : line.slice(4).replace(/^b\//, '');
        else if (line.startsWith('@@')) {
            const m = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line);
            if (!m) continue;
            const useNew = newFile !== null;
            const start = Number(useNew ? m[3] : m[1]);
            const len = Number((useNew ? m[4] : m[2]) ?? '1');
            const file = (useNew ? newFile : oldFile) as string;
            hunks.push({ file, from: Math.max(1, start), to: Math.max(1, start + Math.max(len, 1) - 1) });
        }
    }
    return hunks;
}

function lineText(root: string, file: string, line: number, cache: Map<string, string[] | null>): string | null {
    if (!cache.has(file)) {
        try {
            cache.set(file, fs.readFileSync(path.join(root, file), 'utf-8').split('\n'));
        } catch {
            cache.set(file, null);
        }
    }
    return cache.get(file)?.[line - 1] ?? null;
}

export function reviewRisk(
    root: string,
    graph: CodeGraph,
    rev: string,
    hunks: readonly Hunk[],
    weights: Readonly<Record<RiskTerm, number>> = RISK_WEIGHTS,
    opts: WalkOptions = {},
): ReviewRisk {
    const files = new Map<string, Hunk[]>();
    for (const h of hunks) files.set(h.file, [...(files.get(h.file) ?? []), h]);
    const changed = [...files.keys()].sort();
    const byId = new Map(graph.nodes.map((n) => [n.id, n] as const));
    const inn = new Map<string, CodeEdge[]>();
    const out = new Map<string, CodeEdge[]>();
    for (const e of graph.edges) {
        inn.set(e.target, [...(inn.get(e.target) ?? []), e]);
        out.set(e.source, [...(out.get(e.source) ?? []), e]);
    }
    const lines = new Map<string, string[] | null>();
    const witnessOf = (n: CodeNode | undefined, e?: CodeEdge): RiskWitness | null => {
        const w = e?.fact?.witness ?? n?.fact?.witness;
        if (w) return { file: w.file, line: w.line, hash: w.hash };
        const line = n?.source_location[0] ?? (n?.kind === 'file' ? 1 : undefined);
        if (!n?.source_file || !line) return null;
        const text = lineText(root, n.source_file, line, lines);
        return text === null ? null : { file: n.source_file, line, hash: spanHash(text.trim()) };
    };
    const item = (id: string, why: string, e?: CodeEdge): RiskItem => {
        const n = byId.get(id);
        return { id, label: n?.label ?? id, why, witness: witnessOf(n, e) };
    };
    const overlaps = (n: CodeNode, hs: readonly Hunk[]): boolean => {
        const [start, , end] = n.source_location;
        if (!start) return false;
        const last = end ?? start;
        return hs.some((h) => h.from <= last && h.to >= start);
    };

    const inFile = new Map<string, CodeNode[]>();
    for (const n of graph.nodes) if (files.has(n.source_file) && SYMBOL_KINDS.has(n.kind)) inFile.set(n.source_file, [...(inFile.get(n.source_file) ?? []), n]);
    const seedIds = new Set<string>();
    for (const [file, hs] of files) {
        const symbols = (inFile.get(file) ?? []).filter((n) => overlaps(n, hs));
        if (symbols.length) for (const s of symbols) seedIds.add(s.id);
        else if (byId.has(file)) seedIds.add(file);
    }
    const seeds = [...seedIds].sort().map((id) => item(id, 'changed by the diff'));

    const callers = new Map<string, RiskItem>();
    let frontier = [...seedIds];
    for (let hop = 1; hop <= 2; hop++) {
        const next: string[] = [];
        for (const id of frontier) {
            for (const e of inn.get(id) ?? []) {
                if (!CALLER_RELATIONS.has(e.relation) || !admitEdge(e, opts) || seedIds.has(e.source) || callers.has(e.source)) continue;
                const guess = admitEdge(e) ? '' : `, guess: ${e.resolved_via}`;
                callers.set(e.source, item(e.source, `${e.relation} ${byId.get(id)?.label ?? id} (hop ${hop}${guess})`, e));
                next.push(e.source);
            }
        }
        frontier = next;
    }

    const reach = new Set([...seedIds, ...callers.keys()]);
    const flows: RiskItem[] = [];
    const entries: RiskItem[] = [];
    for (const n of graph.nodes) {
        if (n.kind !== 'flow') continue;
        const walked = n.fact?.attrs?.['nodes'];
        if (!Array.isArray(walked) || !walked.some((id) => reach.has(id))) continue;
        const hit = walked.find((id) => reach.has(id)) as string;
        flows.push(item(n.id, `passes ${byId.get(hit)?.label ?? hit}`));
        const entry = String(n.fact?.attrs?.['entry'] ?? '');
        if (entry && !entries.some((x) => x.id === entry)) entries.push(item(entry, `${String(n.fact?.attrs?.['entry_kind'] ?? 'entry')} of ${n.label}`));
    }

    const partners: RiskItem[] = [];
    const changedSet = new Set(changed);
    for (const e of graph.edges) {
        if (e.relation !== 'co-changes') continue;
        const [inside, other] = changedSet.has(e.source) ? [e.source, e.target] : changedSet.has(e.target) ? [e.target, e.source] : [null, null];
        if (!inside || !other || changedSet.has(other) || partners.some((p) => p.id === other)) continue;
        const count = e.fact?.attrs?.['count'];
        partners.push(item(other, `changes with ${inside}${typeof count === 'number' ? ` (${count} commits)` : ''}`, e));
    }

    const owned = (n: CodeNode): boolean => {
        const w = n.fact?.witness;
        if (!w || !changedSet.has(w.file)) return false;
        return (files.get(w.file) ?? []).some((h) => h.from <= w.line && h.to >= w.line);
    };
    const columns = new Map<string, RiskItem>();
    const operations = new Map<string, RiskItem>();
    for (const n of graph.nodes) {
        if ((n.kind === 'column' || n.kind === 'table') && owned(n)) columns.set(n.id, item(n.id, 'redefined by the diff'));
        if (n.kind === 'operation' && owned(n)) operations.set(n.id, item(n.id, 'redefined by the diff'));
    }
    for (const id of seedIds) {
        for (const e of out.get(id) ?? []) {
            const t = byId.get(e.target);
            if ((e.relation === 'reads' || e.relation === 'writes') && t && (t.kind === 'column' || t.kind === 'table') && !columns.has(t.id)) columns.set(t.id, item(t.id, `${e.relation} by ${byId.get(id)?.label ?? id}`, e));
            if (e.relation === 'calls-out' && !operations.has(e.target)) operations.set(e.target, item(e.target, `called by ${byId.get(id)?.label ?? id}`, e));
        }
    }
    // A job owns the lines from its header to the next job's; the workflow owns what precedes its first job.
    const pipelines: RiskItem[] = [];
    for (const file of changed) {
        const defs = graph.nodes.filter((n) => (n.kind === 'workflow' || n.kind === 'job') && n.fact?.owner === file);
        const jobs = defs.filter((n) => n.kind === 'job').sort((a, b) => a.fact!.witness.line - b.fact!.witness.line);
        const hs = files.get(file) ?? [];
        const firstJob = jobs[0]?.fact!.witness.line ?? Number.MAX_SAFE_INTEGER;
        for (const wf of defs.filter((n) => n.kind === 'workflow')) if (hs.some((h) => h.from < firstJob)) pipelines.push(item(wf.id, `its triggers or settings changed in ${file}`));
        jobs.forEach((j, i) => {
            const from = j.fact!.witness.line;
            const to = (jobs[i + 1]?.fact!.witness.line ?? Number.MAX_SAFE_INTEGER) - 1;
            if (hs.some((h) => h.from <= to && h.to >= from)) pipelines.push(item(j.id, `its definition changed in ${file}`));
        });
    }

    const areaOf = (id: string): string => {
        const k = byId.get(id)?.kind ?? '';
        return k === 'flow' ? 'code' : laneOfKind(k) ?? 'code';
    };
    const areas = new Map<string, RiskItem>();
    const touch = (area: string, it: RiskItem): void => {
        if (!areas.has(area)) areas.set(area, { ...it, why: `${area}: ${it.why}` });
    };
    for (const s of seeds) touch(areaOf(s.id) === 'code' ? 'code' : areaOf(s.id), s);
    for (const c of columns.values()) touch('data', c);
    for (const o of operations.values()) touch('interfaces', o);
    for (const n of graph.nodes) if (n.fact?.lane === 'runtime' && changedSet.has(n.fact.owner)) touch('runtime', item(n.id, `defined in ${n.fact.owner}`));
    for (const p of pipelines) touch('delivery', p);
    const crossings = [...areas.values()].slice(1);

    const lists: Record<RiskTerm, RiskItem[]> = {
        callers: [...callers.values()].sort((a, b) => (a.id < b.id ? -1 : 1)),
        'entry points': entries,
        flows,
        'missing partners': partners,
        'area crossings': crossings,
        columns: [...columns.values()].sort((a, b) => (a.id < b.id ? -1 : 1)),
        operations: [...operations.values()].sort((a, b) => (a.id < b.id ? -1 : 1)),
        pipelines,
    };
    const terms = RISK_TERMS.map((term) => ({ term, weight: weights[term], items: lists[term], contribution: lists[term].length * weights[term] }));
    return {
        rev,
        changed,
        hunks: [...hunks],
        seeds,
        terms,
        total: terms.reduce((n, t) => n + t.contribution, 0),
        basis: { graph_checksum: graph.source_checksum, weights },
    };
}

/** The sum first, then each term with every fact it counted and where that fact was read. */
export function renderReviewRisk(r: ReviewRisk, listCap = 20): string[] {
    const at = (w: RiskWitness | null): string => (w ? `${w.file}:${w.line}` : 'no witness');
    const lines = [
        `review risk vs ${r.rev}: ${r.total} = ${r.terms.map((t) => `${t.term} ${t.items.length}×${t.weight}`).join(' + ')}`,
        `basis: graph ${r.basis.graph_checksum.slice(0, 12)} · ${r.changed.length} changed file(s) · ${r.seeds.length} changed symbol(s)`,
        `changed symbols (${r.seeds.length}):`,
        ...r.seeds.slice(0, listCap).map((s) => `  ${s.label}  at ${at(s.witness)}`),
    ];
    for (const t of r.terms) {
        lines.push(`${t.term} (${t.items.length} × ${t.weight} = ${t.contribution}):`);
        for (const i of t.items.slice(0, listCap)) lines.push(`  ${i.label} — ${i.why}  at ${at(i.witness)}`);
        if (t.items.length > listCap) lines.push(`  … ${t.items.length - listCap} more`);
    }
    return lines;
}
