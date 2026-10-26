/**
 * A verified context pack: the facts a task most likely touches, small enough to
 * read, each checked against the working tree.
 *
 * Seeds come from the task text — a word that is exactly a node id or a node
 * label — and from the files the working diff changed. A word that names several
 * nodes is refused and listed with its candidates rather than guessed. From the
 * seeds the walk goes seed-first, one hop at a time, callers before callees,
 * along the graph's typed relations, and stops adding items when the token
 * budget is spent; the rest is counted, never silently dropped. The returned
 * items are then confirmed, so each carries `at=file:line` and its state.
 */
import type { ConfirmState } from '../map_areas.js';
import { type LoadedGraph, resolveExactNode } from '../query.js';
import type { CodeEdge } from '../types.js';
import { confirmIds, type ConfirmResult } from './confirm.js';
import defaults from './defaults.json';

export interface PackItem {
    id: string;
    label: string;
    kind: string;
    /** `seed`, or the relation that reached it. */
    relation: string;
    direction: 'in' | 'out' | 'seed';
    via: string | null;
    depth: number;
    at: string | null;
    confirm: ConfirmState;
}

export interface PackResult {
    seeds: { from_task: string[]; from_diff: string[] };
    refused_seeds: Array<{ word: string; candidates: string[]; more: boolean }>;
    population: string;
    items: PackItem[];
    returned: number;
    total: number;
    hasMore: boolean;
    budget: { tokens: number; used: number };
    confirm: Pick<ConfirmResult, 'status' | 'counts' | 'risk' | 'ms' | 'error'>;
    lines: string[];
}

export interface PackOptions {
    diffFiles?: readonly string[];
    budget?: number;
    depth?: number;
}

const STOPWORDS = new Set(
    'the and for with this that from into when what where which while have has had not but are was were will would should could must does make add fix change update new all any use using used each every only also then than there their them they its our your about after before over under between'.split(' '),
);

const CHARS_PER_TOKEN = 4;

/** Words of the task text worth trying as a seed, in order of first appearance. */
export function seedWords(task: string): string[] {
    const out: string[] = [];
    for (const m of task.matchAll(/[A-Za-z_$@][\w$@-]*(?:(?:\.|::|#|\/|\\)[\w$@.-]+)*/g)) {
        const w = m[0].replace(/[.:#/\\-]+$/, '');
        if (w.length < 3 || STOPWORDS.has(w.toLowerCase()) || out.includes(w)) continue;
        out.push(w);
        if (out.length >= defaults.pack_seed_tokens) break;
    }
    return out;
}

function itemLine(it: PackItem): string {
    const arrow = it.direction === 'seed' ? '*' : it.direction === 'out' ? `-${it.relation}->` : `<-${it.relation}-`;
    return `${'  '.repeat(Math.max(0, it.depth - 1))}${arrow} ${it.label} [${it.kind}]${it.at ? ` at=${it.at}` : ''} (${it.confirm})`;
}

function atOf(g: LoadedGraph, id: string, e?: CodeEdge): string | null {
    const n = g.byId.get(id);
    const w = n?.fact?.witness ?? e?.fact?.witness;
    if (w) return `${w.file}:${w.line}`;
    if (!n?.source_file) return null;
    // A file node has no line of its own; its first line is where reading it starts.
    return `${n.source_file}:${n.source_location[0] ?? 1}`;
}

export function contextPack(g: LoadedGraph, root: string, cachePath: string, task: string, opts: PackOptions = {}): PackResult {
    const budget = Math.max(50, Math.floor(opts.budget ?? defaults.pack_budget_tokens));
    const depth = Math.min(3, Math.max(1, Math.floor(opts.depth ?? defaults.pack_depth)));
    const refused: PackResult['refused_seeds'] = [];
    const fromTask: string[] = [];
    let unmatched = 0;
    const words = seedWords(task);
    for (const w of words) {
        const r = resolveExactNode(g, w);
        if (r.id !== null) {
            if (!fromTask.includes(r.id)) fromTask.push(r.id);
        } else if (r.ambiguous.length > 0) refused.push({ word: w, candidates: r.ambiguous, more: r.more });
        else unmatched += 1;
    }
    const diffFiles = [...(opts.diffFiles ?? [])];
    const fromDiff = [...new Set([...diffFiles.filter((f) => g.byId.has(f)), ...g.idsInFiles(diffFiles)])].filter((id) => !fromTask.includes(id));
    const seeds = [...fromTask, ...fromDiff];

    const found: PackItem[] = [];
    const seen = new Set<string>();
    for (const s of seeds) {
        seen.add(s);
        const n = g.byId.get(s);
        found.push({ id: s, label: n?.label ?? s, kind: n?.kind ?? 'external', relation: 'seed', direction: 'seed', via: null, depth: 0, at: atOf(g, s), confirm: 'unconfirmed' });
    }
    let frontier = [...seeds];
    for (let d = 1; d <= depth && frontier.length > 0; d++) {
        const next: string[] = [];
        for (const cur of frontier) {
            const steps: Array<[CodeEdge, 'in' | 'out']> = [
                ...(g.in.get(cur) ?? []).map((e) => [e, 'in'] as [CodeEdge, 'in']),
                ...(g.out.get(cur) ?? []).map((e) => [e, 'out'] as [CodeEdge, 'out']),
            ];
            for (const [e, way] of steps) {
                const far = way === 'in' ? e.source : e.target;
                if (seen.has(far)) continue;
                const n = g.byId.get(far);
                if (!n) continue;
                seen.add(far);
                next.push(far);
                found.push({ id: far, label: n.label, kind: n.kind, relation: e.relation, direction: way, via: cur, depth: d, at: atOf(g, far, e), confirm: 'unconfirmed' });
            }
        }
        frontier = next;
    }

    const items: PackItem[] = [];
    let used = 0;
    for (const it of found) {
        const cost = Math.ceil((itemLine(it).length + 12) / CHARS_PER_TOKEN);
        if (used + cost > budget) break;
        items.push(it);
        used += cost;
    }

    const confirmed = items.length > 0 ? confirmIds(root, cachePath, items.map((i) => i.id)) : null;
    const states = new Map((confirmed?.items ?? []).map((c) => [c.id, c] as const));
    for (const it of items) {
        const c = states.get(it.id);
        if (!c) continue;
        it.confirm = c.state;
        if (c.now_at) it.at = c.now_at;
    }

    let population: string;
    if (seeds.length === 0) {
        population =
            `no seed: ${unmatched} task word(s) matched no node id or label` +
            (refused.length ? `, ${refused.length} named several nodes and were refused` : '') +
            (diffFiles.length ? `, the diff's ${diffFiles.length} file(s) declare no indexed symbol` : ', no working diff given') +
            `; the graph holds ${g.allNodeIds().length} nodes`;
    } else if (found.length === seeds.length) {
        population = `nothing reachable within ${depth} hop(s) of ${seeds.length} seed(s) along typed relations`;
    } else {
        population = `${found.length - seeds.length} fact(s) reachable within ${depth} hop(s) of ${seeds.length} seed(s), plus the seeds`;
    }
    return {
        seeds: { from_task: fromTask, from_diff: fromDiff },
        refused_seeds: refused,
        population,
        items,
        returned: items.length,
        total: found.length,
        hasMore: found.length > items.length,
        budget: { tokens: budget, used },
        confirm: confirmed
            ? { status: confirmed.status, counts: confirmed.counts, risk: confirmed.risk, ms: confirmed.ms, ...(confirmed.error ? { error: confirmed.error } : {}) }
            : { status: 'ok', counts: {}, risk: { class: 'R0', reason: 'nothing to confirm', depth_chosen: 'none', depth_ran: 'none' }, ms: 0 },
        lines: items.map(itemLine),
    };
}
