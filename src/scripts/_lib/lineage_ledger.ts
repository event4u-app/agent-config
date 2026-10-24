/**
 * The local lineage ledger — the half of source provenance that never leaves the machine.
 *
 * Council O5 split provenance in two. The tracked tree carries a source-free decision
 * ledger (`provenance/mechanisms.jsonl`); everything that links a source to a mechanism —
 * which source, at which pin, read where — lives here, under the user-global runtime:
 *
 *   <event4u_root>/runtime/lineage/sources.jsonl  one row per source, identity sealed
 *   <event4u_root>/runtime/lineage/edges.jsonl    source → mechanism, pin and locator sealed
 *
 * Every write is refused when the target sits inside a git work tree: a ledger committed by
 * accident would put keyed ids, relations and timestamps into public history for good,
 * which is exactly what O5 decided against. An `EVENT4U_CONFIG_HOME` pointed into a
 * checkout is the realistic way that happens.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { enclosingWorkTree } from './git_common_dir.js';
import { decrypt, is_token } from './link_crypto.js';
import { SOURCE_ID_RE } from './source_id.js';
import { event4u_root, type EnvMap } from './user_global_paths.js';

export const SOURCE_KINDS = ['repo', 'url', 'video', 'paper', 'unknown'] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];
/** A pin nobody recorded. Written instead of a guess, never replaced by one. */
export const PIN_UNKNOWN = 'unknown';

export interface SourceRow {
    readonly source_id: string;
    readonly kind: SourceKind;
    /** ENC1 token of the source identity (URL or opaque reference). */
    readonly identity: string;
    /** SPDX id, or 'unknown'. Plaintext: a license names no source. */
    readonly license: string;
    readonly watch: boolean;
}

export interface EdgeRow {
    readonly source_id: string;
    readonly mechanism_id: string;
    /** ENC1 token of the revision the mechanism was read at, or `unknown`. */
    readonly pin: string;
    /** ENC1 token of where inside the source, or null when nobody recorded one. */
    readonly locator: string | null;
}

export interface LineageFinding {
    readonly file: 'sources.jsonl' | 'edges.jsonl';
    readonly line: number;
    readonly message: string;
}

export class LineageError extends Error {}

export function lineageDir(env?: EnvMap | null): string {
    return path.join(event4u_root(env), 'runtime', 'lineage');
}

/** Throws when `target` would land inside a git work tree. */
export function assertOutsideWorkTree(target: string): void {
    const tree = enclosingWorkTree(target);
    if (tree !== null) {
        throw new LineageError(
            `refusing to write ${target}: it is inside the git work tree ${tree}, and lineage data never enters a repository`,
        );
    }
}

/** Atomic write (temp + rename), refused inside a work tree. */
export function writePrivateFile(target: string, body: string): void {
    assertOutsideWorkTree(target);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const tmp = `${target}.tmp-${String(process.pid)}`;
    fs.writeFileSync(tmp, body, { mode: 0o600 });
    fs.renameSync(tmp, target);
}

function readJsonl(file: string): unknown[] {
    if (!fs.existsSync(file)) return [];
    return fs
        .readFileSync(file, 'utf-8')
        .split('\n')
        .filter((l) => l.trim() !== '')
        .map((l) => {
            try {
                return JSON.parse(l) as unknown;
            } catch {
                return null;
            }
        });
}

const jsonl = (rows: readonly unknown[]): string => rows.map((r) => JSON.stringify(r)).join('\n') + (rows.length > 0 ? '\n' : '');

export interface Ledger {
    readonly sources: SourceRow[];
    readonly edges: EdgeRow[];
}

export function hasLedger(dir: string): boolean {
    return fs.existsSync(path.join(dir, 'sources.jsonl'));
}

export function readLedger(dir: string): Ledger {
    return {
        sources: readJsonl(path.join(dir, 'sources.jsonl')) as SourceRow[],
        edges: readJsonl(path.join(dir, 'edges.jsonl')) as EdgeRow[],
    };
}

export function writeLedger(dir: string, ledger: Ledger): void {
    writePrivateFile(path.join(dir, 'sources.jsonl'), jsonl(ledger.sources));
    writePrivateFile(path.join(dir, 'edges.jsonl'), jsonl(ledger.edges));
}

/**
 * Add sources and edges, keeping what is there: a known source keeps its watch flag and
 * license, an identical edge is not duplicated. Returns the counts actually added.
 */
export function mergeIntoLedger(dir: string, add: Ledger): { sources: number; edges: number } {
    const cur = readLedger(dir);
    const known = new Set(cur.sources.map((s) => s.source_id));
    const sources = [...cur.sources];
    let addedSources = 0;
    for (const s of add.sources) {
        if (known.has(s.source_id)) continue;
        known.add(s.source_id);
        sources.push(s);
        addedSources += 1;
    }
    const edgeKey = (e: EdgeRow): string => `${e.source_id}\0${e.mechanism_id}`;
    const seen = new Set(cur.edges.map(edgeKey));
    const edges = [...cur.edges];
    let addedEdges = 0;
    for (const e of add.edges) {
        if (seen.has(edgeKey(e))) continue;
        seen.add(edgeKey(e));
        edges.push(e);
        addedEdges += 1;
    }
    writeLedger(dir, { sources, edges });
    return { sources: addedSources, edges: addedEdges };
}

const MECHANISM_ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function sealedOk(value: unknown, keys: readonly string[]): boolean {
    if (!is_token(value)) return false;
    if (keys.length === 0) return true;
    try {
        decrypt(value as string, [...keys]);
        return true;
    } catch {
        return false;
    }
}

/**
 * Validate both files. With `keys`, every sealed field must also authenticate, so a ledger
 * sealed under a lost key is reported rather than discovered on first use.
 */
export function checkLedger(dir: string, keys: readonly string[] = []): LineageFinding[] {
    const out: LineageFinding[] = [];
    const sourceIds = new Set<string>();
    const sealNote = keys.length > 0 ? 'an ENC1 token that decrypts with the configured key' : 'an ENC1 token';
    readJsonl(path.join(dir, 'sources.jsonl')).forEach((raw, i) => {
        const at = (message: string): void => void out.push({ file: 'sources.jsonl', line: i + 1, message });
        if (typeof raw !== 'object' || raw === null) return at('not a JSON object');
        const r = raw as Record<string, unknown>;
        const extra = Object.keys(r).filter((k) => !['source_id', 'kind', 'identity', 'license', 'watch'].includes(k));
        if (extra.length > 0) at(`unexpected field(s) ${extra.join(', ')}`);
        if (typeof r.source_id !== 'string' || !SOURCE_ID_RE.test(r.source_id)) at('source_id must be src_ plus 10 hex');
        else if (sourceIds.has(r.source_id)) at(`duplicate source_id ${r.source_id}`);
        else sourceIds.add(r.source_id);
        if (!(SOURCE_KINDS as readonly unknown[]).includes(r.kind)) at(`kind must be one of ${SOURCE_KINDS.join(' | ')}`);
        if (!sealedOk(r.identity, keys)) at(`identity must be ${sealNote}`);
        if (typeof r.license !== 'string' || r.license === '') at("license must be an SPDX id or 'unknown'");
        if (typeof r.watch !== 'boolean') at('watch must be true or false');
    });
    readJsonl(path.join(dir, 'edges.jsonl')).forEach((raw, i) => {
        const at = (message: string): void => void out.push({ file: 'edges.jsonl', line: i + 1, message });
        if (typeof raw !== 'object' || raw === null) return at('not a JSON object');
        const r = raw as Record<string, unknown>;
        const extra = Object.keys(r).filter((k) => !['source_id', 'mechanism_id', 'pin', 'locator'].includes(k));
        if (extra.length > 0) at(`unexpected field(s) ${extra.join(', ')}`);
        if (typeof r.source_id !== 'string' || !sourceIds.has(r.source_id)) at(`source_id ${String(r.source_id)} names no row in sources.jsonl`);
        if (typeof r.mechanism_id !== 'string' || !MECHANISM_ID_RE.test(r.mechanism_id)) at('mechanism_id must be a kebab-case slug');
        if (r.pin !== PIN_UNKNOWN && !sealedOk(r.pin, keys)) at(`pin must be '${PIN_UNKNOWN}' or ${sealNote}`);
        if (r.locator !== null && !sealedOk(r.locator, keys)) at(`locator must be null or ${sealNote}`);
    });
    return out;
}
