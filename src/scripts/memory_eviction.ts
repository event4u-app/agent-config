#!/usr/bin/env tsx
/**
 * Eviction ladder for the curated engineering memory store.
 *
 * WHY THIS EXISTS (road-to-context-fidelity Phase 2, spike cf02).
 * 21.5 % of the curated store contradicted the tree while the shipped
 * instrument reported 0.0 % stale, because every entry carried the same
 * `last_validated` and the same 365-day window — a check that could not fire
 * before 2027. Entries do not get removed by anyone, so the store grows a
 * false fraction that is injected at session start and read as fact.
 *
 * WHAT DRIVES A DEMOTION — and, just as load-bearing, what does NOT.
 * Two signals, both human-anchored:
 *
 *   1. `semantic_verdict: stale` — a recorded human reading that the tree
 *      contradicts the entry. Demotes IMMEDIATELY, regardless of age. This is
 *      Phase 2's "contradiction outranks retention": age is a proxy,
 *      contradiction is the actual signal.
 *   2. Age past the per-store window without re-verification. A fallback for
 *      entries nobody has looked at, not a claim that they are wrong.
 *
 * `report_memory_pointers` output NEVER drives a demotion. The council said so
 * as a precaution on 2026-08-19; cf04 then measured pointer liveness at 0.00x
 * lift over the base rate (0.75x with anchor drift, still sub-random), which
 * turns the precaution into a finding. A dead citation is documentation debt.
 * It is not evidence that a claim is false.
 *
 * THE LADDER
 *   active      → the entry is inside its window, or re-verified since.
 *   due         → past `last_validated + review_after_days`. Surfaced, kept.
 *   quarantine  → past due by one more window, or verdict `stale`. Moved to
 *                 `agents/memory/quarantine/<type>.yml`, still inspectable,
 *                 no longer injected.
 *   delete      → past due by two more windows while in quarantine.
 *
 * `unverifiable` entries (external systems, past events, host behaviour,
 * recorded preferences) never quarantine on age. The tree cannot re-confirm
 * them, so an age threshold would evict them on a schedule for a reason that
 * can never be discharged — 11 of 107 entries at cf02.
 *
 * Dry-run by DEFAULT. `--apply` is the only path that writes, and it never
 * deletes an entry that has not been sitting in quarantine.
 *
 * Usage:
 *     memory_eviction                     # plan, writes nothing
 *     memory_eviction --format json
 *     memory_eviction --apply             # execute the plan
 *
 * Exit codes: 0 = plan produced (or applied), 3 = internal error.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const PROG = 'memory_eviction.ts';
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEFAULT_STORE = 'agents/memory';
/**
 * Quarantine lives OUTSIDE the memory root, not in a subdirectory of it.
 * `check_memory` derives an entry's type from its parent directory name, so a
 * `agents/memory/quarantine/` would validate as a memory type called
 * "quarantine" and warn on every run. The semantics agree with the mechanics:
 * a quarantined entry is not curated memory any more.
 */
const QUARANTINE_ROOT = 'agents/memory-quarantine';

export type LadderState = 'active' | 'due' | 'quarantine' | 'delete';
export type SemanticVerdict = 'still-true' | 'stale' | 'unverifiable';

export interface LadderRow {
    id: string;
    type: string;
    state: LadderState;
    reason: string;
    age_days: number | null;
    window_days: number | null;
    semantic_verdict: SemanticVerdict | null;
}

export interface LadderPlan {
    scanned: number;
    rows: LadderRow[];
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function asDate(v: unknown): Date | null {
    if (v instanceof Date) return v;
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) {
        const d = new Date(`${v.slice(0, 10)}T00:00:00Z`);
        return Number.isNaN(d.getTime()) ? null : d;
    }
    return null;
}

function daysBetween(a: Date, b: Date): number {
    return Math.floor((a.getTime() - b.getTime()) / 86_400_000);
}

/**
 * Classify one entry.
 *
 * Exported and pure so the ladder's arithmetic is testable without a store on
 * disk — the thresholds are the part a reader is most likely to disagree with.
 */
export function classify(
    entry: Record<string, unknown>,
    today: Date,
    inQuarantine: boolean,
): { state: LadderState; reason: string; age: number | null; window: number | null } {
    const verdict = entry['semantic_verdict'];
    const lv = asDate(entry['last_validated']);
    const window = typeof entry['review_after_days'] === 'number' ? (entry['review_after_days'] as number) : null;
    const age = lv ? daysBetween(today, lv) : null;

    // Contradiction outranks retention — the whole point of the field.
    if (verdict === 'stale') {
        return inQuarantine
            ? { state: 'quarantine', reason: 'recorded stale verdict, already quarantined', age, window }
            : { state: 'quarantine', reason: 'recorded semantic verdict: stale (contradiction outranks age)', age, window };
    }

    if (age == null || window == null) {
        return { state: 'active', reason: 'no age axis (missing last_validated or review_after_days)', age, window };
    }

    // The tree can never re-confirm these, so an age threshold would evict
    // them on a schedule for a reason nothing can discharge.
    if (verdict === 'unverifiable') {
        return { state: age > window ? 'due' : 'active', reason: 'unverifiable — surfaced on age, never quarantined', age, window };
    }

    if (inQuarantine) {
        return age > window * 3
            ? { state: 'delete', reason: `in quarantine and ${age}d past a ${window}d window (limit ${window * 3}d)`, age, window }
            : { state: 'quarantine', reason: `in quarantine, ${age}d of ${window * 3}d before deletion`, age, window };
    }

    if (age > window * 2) {
        return { state: 'quarantine', reason: `${age}d unverified, past two ${window}d windows`, age, window };
    }
    if (age > window) {
        return { state: 'due', reason: `${age}d unverified, past its ${window}d window`, age, window };
    }
    return { state: 'active', reason: `${age}d of ${window}d`, age, window };
}

interface StoreFile {
    abs: string;
    rel: string;
    type: string;
    doc: Record<string, unknown>;
    entries: Array<Record<string, unknown>>;
}

function readStoreFile(abs: string, type: string): StoreFile | null {
    let parsed: unknown;
    try {
        parsed = YAML.parse(fs.readFileSync(abs, 'utf-8'));
    } catch {
        return null;
    }
    if (!isPlainObject(parsed) || !Array.isArray(parsed['entries'])) return null;
    const entries = (parsed['entries'] as unknown[]).filter(isPlainObject) as Array<Record<string, unknown>>;
    return { abs, rel: path.relative(REPO_ROOT, abs), type, doc: parsed, entries };
}

function listStores(storeDir: string): { curated: StoreFile[]; quarantined: StoreFile[] } {
    const base = path.isAbsolute(storeDir) ? storeDir : path.join(REPO_ROOT, storeDir);
    const curated: StoreFile[] = [];
    const quarantined: StoreFile[] = [];
    let names: string[] = [];
    try {
        names = fs.readdirSync(base).filter((n) => n.endsWith('.yml')).sort();
    } catch {
        return { curated, quarantined };
    }
    for (const n of names) {
        const f = readStoreFile(path.join(base, n), n.replace(/\.yml$/, ''));
        if (f) curated.push(f);
    }
    const qDir = path.join(REPO_ROOT, QUARANTINE_ROOT);
    let qNames: string[] = [];
    try {
        qNames = fs.readdirSync(qDir).filter((n) => n.endsWith('.yml')).sort();
    } catch {
        return { curated, quarantined };
    }
    for (const n of qNames) {
        const f = readStoreFile(path.join(qDir, n), n.replace(/\.yml$/, ''));
        if (f) quarantined.push(f);
    }
    return { curated, quarantined };
}

export function plan(storeDir: string, today: Date): LadderPlan {
    const { curated, quarantined } = listStores(storeDir);
    const rows: LadderRow[] = [];
    for (const [files, inQ] of [
        [curated, false],
        [quarantined, true],
    ] as Array<[StoreFile[], boolean]>) {
        for (const f of files) {
            for (const e of f.entries) {
                const c = classify(e, today, inQ);
                rows.push({
                    id: typeof e['id'] === 'string' ? (e['id'] as string) : '',
                    type: f.type,
                    state: c.state,
                    reason: c.reason,
                    age_days: c.age,
                    window_days: c.window,
                    semantic_verdict: (typeof e['semantic_verdict'] === 'string'
                        ? (e['semantic_verdict'] as SemanticVerdict)
                        : null),
                });
            }
        }
    }
    const order: Record<LadderState, number> = { delete: 0, quarantine: 1, due: 2, active: 3 };
    rows.sort((a, b) => order[a.state] - order[b.state] || a.type.localeCompare(b.type) || a.id.localeCompare(b.id));
    return { scanned: rows.length, rows };
}

/**
 * Split a store file into its header and one text block per entry.
 *
 * The move is TEXTUAL, not a YAML round-trip, and that is a deliberate
 * constraint rather than an implementation shortcut. Every body in this store
 * is a folded multi-line scalar; re-emitting the document would reformat all
 * 107 of them and bury a 22-entry move in a whole-file rewrite. A reviewer has
 * to be able to see which entries moved.
 */
function splitEntries(text: string): { header: string[]; blocks: Array<{ id: string; lines: string[] }> } {
    const lines = text.split('\n');
    const header: string[] = [];
    const blocks: Array<{ id: string; lines: string[] }> = [];
    let current: { id: string; lines: string[] } | null = null;
    for (const line of lines) {
        const m = /^(\s*)-\s+id:\s*(\S+)\s*$/.exec(line);
        if (m) {
            if (current) blocks.push(current);
            current = { id: m[2] ?? '', lines: [line] };
            continue;
        }
        if (current) current.lines.push(line);
        else header.push(line);
    }
    if (current) blocks.push(current);
    return { header, blocks };
}

function readText(abs: string): string | null {
    try {
        return fs.readFileSync(abs, 'utf-8');
    } catch {
        return null;
    }
}

/**
 * Execute the plan.
 *
 * Demotion is a MOVE between two tracked YAML files, never an in-place status
 * flip: an entry has to leave the injected store to stop being read as fact,
 * and it has to stay readable to be appealable.
 */
function apply(storeDir: string, today: Date): string[] {
    const { curated, quarantined } = listStores(storeDir);
    const log: string[] = [];
    const qDir = path.join(REPO_ROOT, QUARANTINE_ROOT);

    for (const f of curated) {
        const demoteIds = new Set(
            f.entries
                .filter((e) => classify(e, today, false).state === 'quarantine')
                .map((e) => String(e['id'])),
        );
        if (demoteIds.size === 0) continue;

        const text = readText(f.abs);
        if (text == null) continue;
        const { header, blocks } = splitEntries(text);
        const keep = blocks.filter((b) => !demoteIds.has(b.id));
        const move = blocks.filter((b) => demoteIds.has(b.id));

        fs.mkdirSync(qDir, { recursive: true });
        const qPath = path.join(qDir, `${f.type}.yml`);
        const qText = readText(qPath);
        const qLines = qText == null
            ? [
                  '# Quarantined curated-memory entries — demoted by memory_eviction.ts.',
                  '# Kept readable on purpose: a demotion is appealable, and an entry',
                  '# re-verified against the tree returns to the curated store.',
                  'version: 1',
                  'entries:',
              ]
            : splitEntries(qText).header.filter((l, i, arr) => !(l === '' && i === arr.length - 1));
        const qExisting = qText == null ? [] : splitEntries(qText).blocks;
        const qOut = [...qLines, ...qExisting.flatMap((b) => b.lines), ...move.flatMap((b) => b.lines)];
        fs.writeFileSync(qPath, `${qOut.join('\n').replace(/\n+$/, '')}\n`, 'utf-8');

        const out = [...header, ...keep.flatMap((b) => b.lines)];
        fs.writeFileSync(f.abs, `${out.join('\n').replace(/\n+$/, '')}\n`, 'utf-8');
        for (const id of [...demoteIds].sort()) log.push(`quarantined ${f.type}/${id}`);
    }

    for (const f of quarantined) {
        const dropIds = new Set(
            f.entries.filter((e) => classify(e, today, true).state === 'delete').map((e) => String(e['id'])),
        );
        if (dropIds.size === 0) continue;
        const text = readText(f.abs);
        if (text == null) continue;
        const { header, blocks } = splitEntries(text);
        const keep = blocks.filter((b) => !dropIds.has(b.id));
        fs.writeFileSync(f.abs, `${[...header, ...keep.flatMap((b) => b.lines)].join('\n').replace(/\n+$/, '')}\n`, 'utf-8');
        for (const id of [...dropIds].sort()) log.push(`deleted ${f.type}/${id}`);
    }
    return log;
}

function render(p: LadderPlan): string {
    const counts: Record<LadderState, number> = { active: 0, due: 0, quarantine: 0, delete: 0 };
    for (const r of p.rows) counts[r.state] += 1;
    const lines = [
        `${PROG} · dry-run plan — nothing written without --apply`,
        `scanned: ${p.scanned} entr(ies)`,
        `active: ${counts.active} · due: ${counts.due} · quarantine: ${counts.quarantine} · delete: ${counts.delete}`,
        '',
    ];
    for (const r of p.rows) {
        if (r.state === 'active') continue;
        lines.push(`  ${r.state.padEnd(10)} ${r.type}/${r.id}`);
        lines.push(`             ${r.reason}`);
    }
    return lines.join('\n');
}

export function main(argv: readonly string[]): number {
    let storeDir = DEFAULT_STORE;
    let format = 'text';
    let doApply = false;
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i];
        if (a === '--path') storeDir = argv[++i] ?? DEFAULT_STORE;
        else if (a === '--format') format = argv[++i] ?? 'text';
        else if (a === '--apply') doApply = true;
        else if (a === '--help' || a === '-h') {
            process.stdout.write(
                `usage: ${PROG} [--path DIR] [--format text|json] [--apply]\n` +
                    `Eviction ladder for the curated memory store: due → quarantine → delete.\n` +
                    `Driven by recorded human verdicts and age. Never by pointer output.\n` +
                    `Dry-run unless --apply.\n`,
            );
            return 0;
        }
    }

    const today = new Date();
    const p = plan(storeDir, today);
    if (doApply) {
        const log = apply(storeDir, today);
        process.stdout.write(log.length ? `${log.join('\n')}\n` : 'nothing to demote or delete\n');
        return 0;
    }
    process.stdout.write(format === 'json' ? `${JSON.stringify(p, null, 2)}\n` : `${render(p)}\n`);
    return 0;
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
    try {
        process.exit(main(process.argv.slice(2)));
    } catch (e) {
        process.stderr.write(`${PROG}: internal error: ${(e as Error).message}\n`);
        process.exit(3);
    }
}
