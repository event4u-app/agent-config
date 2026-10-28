/**
 * `verify --all`: re-read every lane fact's and lane edge's witness by its kind
 * and report the confirm rate per lane. A `commit` witness is confirmed by the
 * object existing in the repository, a `file` witness by the file existing, a
 * `name` witness by the name in the file, a `span` witness by its hash — the
 * per-kind forms `witness_check.ts` reads.
 */
import { gitProbeInput } from '../../_lib/spawn_env.js';
import type { Witness } from '../lanes/lane_fact.js';
import type { CodeGraph } from '../types.js';
import { checkWitness, FileCache, nameToken, type CheckState, witnessKind } from './witness_check.js';

export interface LaneRate {
    lane: string;
    facts: number;
    edges: number;
    confirmed: number;
    /** `confirmed` ÷ (`facts` + `edges`); 1 for a lane with nothing to read. */
    rate: number;
    /** A few witnesses that did not hold, `state at`. */
    misses: string[];
}

/** Which of `shas` name a commit object here, in one `git cat-file --batch-check`. */
export function existingCommits(root: string, shas: readonly string[]): Set<string> {
    const uniq = [...new Set(shas)];
    if (uniq.length === 0) return new Set();
    let out = '';
    try {
        out = gitProbeInput(root, ['cat-file', '--batch-check=%(objecttype)'], uniq.map((s) => `${s}^{commit}`).join('\n') + '\n').toString('utf-8');
    } catch {
        return new Set();
    }
    const lines = out.split('\n');
    return new Set(uniq.filter((_, i) => lines[i] === 'commit'));
}

export function verifyAll(root: string, g: Pick<CodeGraph, 'nodes' | 'edges'>): LaneRate[] {
    const files = new FileCache(root);
    const items: Array<{ lane: string; w: Witness; name: string; edge: boolean }> = [];
    for (const n of g.nodes) if (n.fact?.lane) items.push({ lane: n.fact.lane, w: n.fact.witness, name: nameToken(n.label), edge: false });
    for (const e of g.edges) if (e.fact?.lane) items.push({ lane: e.fact.lane, w: e.fact.witness, name: nameToken(e.target), edge: true });
    const commits = existingCommits(root, items.filter((i) => witnessKind(i.w) === 'commit').map((i) => i.w.hash));
    const by = new Map<string, LaneRate>();
    for (const i of items) {
        const r = by.get(i.lane) ?? { lane: i.lane, facts: 0, edges: 0, confirmed: 0, rate: 1, misses: [] };
        by.set(i.lane, r);
        if (i.edge) r.edges += 1;
        else r.facts += 1;
        const kind = witnessKind(i.w);
        let state: CheckState;
        if (kind === 'commit') state = commits.has(i.w.hash) ? 'confirmed' : 'gone';
        else if (kind === 'file') state = files.lines(i.w.file) === null ? 'gone' : 'confirmed';
        else state = checkWitness(files, { file: i.w.file, line: i.w.line, hash: kind === 'name' ? null : i.w.hash || null, name: i.name }).state;
        if (state === 'confirmed' || state === 'moved') r.confirmed += 1;
        else if (r.misses.length < 5) r.misses.push(`${state} ${i.w.file}:${i.w.line}`);
    }
    const out = [...by.values()].sort((a, b) => (a.lane < b.lane ? -1 : 1));
    for (const r of out) r.rate = r.facts + r.edges === 0 ? 1 : Math.round((r.confirmed / (r.facts + r.edges)) * 10_000) / 10_000;
    return out;
}
