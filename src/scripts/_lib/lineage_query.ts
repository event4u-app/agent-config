/**
 * Read-side of the lineage ledgers: what a mechanism is, what is missing, what was turned down,
 * and — on the owner's machine only — which mechanisms one source fed.
 *
 * The tracked ledger is read leniently here: a row whose `realised_in` no longer exists is
 * exactly what `lineage of` has to show, so this does not drop it the way the linter flags it.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { MECHANISMS_REL, parseLedgerText, stripLineSuffix, type MechanismRecord } from '../lint_harvest_provenance.js';
import { PIN_UNKNOWN, type Ledger, type SourceRow } from './lineage_ledger.js';
import { decrypt } from './link_crypto.js';
import { SOURCE_ID_RE, sourceId } from './source_id.js';

/** Every well-shaped row of `<root>/provenance/mechanisms.jsonl`, in decision order. */
export function readDecisions(root: string): MechanismRecord[] {
    const file = path.join(root, MECHANISMS_REL);
    if (!fs.existsSync(file)) return [];
    const rows = parseLedgerText(fs.readFileSync(file, 'utf-8'))
        .parsed.map((p) => p.value)
        .filter((v): v is MechanismRecord => typeof v === 'object' && v !== null && typeof (v as MechanismRecord).mechanism_id === 'string');
    // Stable sort: the file is append-only, so file order breaks a same-day tie.
    return rows.map((r, i) => ({ r, i })).sort((a, b) => a.r.decided_at.localeCompare(b.r.decided_at) || a.i - b.i).map((x) => x.r);
}

export function latestDecisions(rows: readonly MechanismRecord[]): Map<string, MechanismRecord> {
    const out = new Map<string, MechanismRecord>();
    for (const r of rows) out.set(r.mechanism_id, r);
    return out;
}

export interface RealisedEdge {
    readonly path: string;
    /** `broken` when the file is not in the working tree — moved or deleted. */
    readonly status: 'ok' | 'broken';
    /** Whether the code graph has the file as a node; null when no graph was available. */
    readonly in_graph: boolean | null;
}

export interface LineageEntry {
    readonly mechanism_id: string;
    readonly verdict: MechanismRecord['verdict'];
    readonly decided_at: string;
    readonly realised: RealisedEdge[];
    readonly decisions: number;
}

/**
 * The lineage of one mechanism id, or of every mechanism realised in one path. Each
 * `realised_in` is resolved against the working tree — a moved or deleted file is a broken
 * edge rather than a silent stale claim — and, given the code graph's node lookup, against
 * the graph too, so an edge the graph has not indexed yet is visible as such.
 */
export function lineageOf(root: string, query: string, graph: { has(id: string): boolean } | null = null): LineageEntry[] {
    const rows = readDecisions(root);
    const latest = latestDecisions(rows);
    const q = stripLineSuffix(query.replace(/^\.\//, ''));
    const hits = [...latest.values()].filter(
        (r) => r.mechanism_id === query || (r.realised_in ?? []).some((p) => stripLineSuffix(p) === q),
    );
    return hits
        .sort((a, b) => a.mechanism_id.localeCompare(b.mechanism_id))
        .map((r) => ({
            mechanism_id: r.mechanism_id,
            verdict: r.verdict,
            decided_at: r.decided_at,
            realised: (r.realised_in ?? []).map((p) => {
                const bare = stripLineSuffix(p);
                return {
                    path: bare,
                    status: fs.existsSync(path.join(root, bare)) ? ('ok' as const) : ('broken' as const),
                    in_graph: graph === null ? null : graph.has(bare),
                };
            }),
            decisions: rows.filter((x) => x.mechanism_id === r.mechanism_id).length,
        }));
}

export interface GapEntry {
    readonly mechanism_id: string;
    readonly verdict: 'gap' | 'deferred';
    readonly owner: string;
    readonly decided_at: string;
    readonly reopen_if?: string;
}

/**
 * `gap` and `deferred` mechanisms that nothing has closed since. A later adopt, adapt or
 * already closes one; so does a later reject — unless it carries `reopen_if`, in which case
 * the mechanism stays listed with the condition, because the rejection itself says it may
 * come back.
 */
export function gaps(rows: readonly MechanismRecord[]): GapEntry[] {
    const open = new Map<string, GapEntry>();
    for (const r of rows) {
        if (r.verdict === 'gap' || r.verdict === 'deferred') {
            open.set(r.mechanism_id, { mechanism_id: r.mechanism_id, verdict: r.verdict, owner: r.roadmap ?? 'open', decided_at: r.decided_at });
        } else if (r.verdict === 'reject' && r.reopen_if !== undefined) {
            const cur = open.get(r.mechanism_id);
            if (cur) open.set(r.mechanism_id, { ...cur, reopen_if: r.reopen_if });
        } else {
            open.delete(r.mechanism_id);
        }
    }
    return [...open.values()].sort((a, b) => a.mechanism_id.localeCompare(b.mechanism_id));
}

/** Mechanisms whose latest decision is a rejection. */
export function rejected(rows: readonly MechanismRecord[]): MechanismRecord[] {
    return [...latestDecisions(rows).values()].filter((r) => r.verdict === 'reject').sort((a, b) => a.mechanism_id.localeCompare(b.mechanism_id));
}

export interface SourceLineage {
    readonly source: SourceRow;
    readonly identity: string;
    readonly mechanisms: { mechanism_id: string; verdict: MechanismRecord['verdict'] | null; pin: string; locator: string | null }[];
}

/** Source → mechanisms. `query` is a source id or a plaintext identity, hashed with `keys[0]`. */
export function lineageFrom(ledger: Ledger, query: string, keys: readonly string[], rows: readonly MechanismRecord[]): SourceLineage | null {
    const id = SOURCE_ID_RE.test(query) ? query : sourceId(query, keys[0] as string);
    const source = ledger.sources.find((s) => s.source_id === id);
    if (source === undefined) return null;
    const latest = latestDecisions(rows);
    const open = (token: string | null): string | null => (token === null ? null : decrypt(token, [...keys]));
    return {
        source,
        identity: open(source.identity) as string,
        mechanisms: ledger.edges
            .filter((e) => e.source_id === id)
            .map((e) => ({
                mechanism_id: e.mechanism_id,
                verdict: latest.get(e.mechanism_id)?.verdict ?? null,
                pin: e.pin === PIN_UNKNOWN ? PIN_UNKNOWN : (open(e.pin) as string),
                locator: open(e.locator),
            })),
    };
}
