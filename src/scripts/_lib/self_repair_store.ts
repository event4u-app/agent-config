/**
 * Self-repair record store — the I/O half kept out of `self_repair.ts` so the
 * detectors stay pure and testable.
 *
 * Records live under `agents/runtime/self-repair/`, which the repo `.gitignore`
 * already covers via the `/agents/runtime/` catch-all: a defect record is
 * machine-generated local state, never a tracked artefact. One file per
 * fingerprint, so a recurring defect increments a counter instead of adding a
 * queue entry.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
    creationCapReached,
    type DefectFinding,
    type DefectRecord,
    type DefectSource,
    fingerprint,
    mergeRecord,
} from './self_repair.js';

export const STORE_REL = path.join('agents', 'runtime', 'self-repair');

export function storeDir(root: string): string {
    return path.join(root, STORE_REL);
}

function recordPath(root: string, fp: string): string {
    return path.join(storeDir(root), `${fp}.json`);
}

function isRecord(v: unknown): v is DefectRecord {
    if (typeof v !== 'object' || v === null) {
        return false;
    }
    const r = v as Partial<DefectRecord>;
    return typeof r.fingerprint === 'string' && typeof r.defect_class === 'string';
}

/** Read one record, or null when absent / unreadable / malformed. */
export function readRecord(root: string, fp: string): DefectRecord | null {
    try {
        const parsed: unknown = JSON.parse(fs.readFileSync(recordPath(root, fp), 'utf-8'));
        return isRecord(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

export function writeRecord(root: string, record: DefectRecord): void {
    const dir = storeDir(root);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
        recordPath(root, record.fingerprint),
        `${JSON.stringify(record, null, 2)}\n`,
        'utf-8',
    );
}

/** Every record in the store, newest activity first. */
export function listRecords(root: string): DefectRecord[] {
    let names: string[];
    try {
        names = fs.readdirSync(storeDir(root));
    } catch {
        return [];
    }
    const out: DefectRecord[] = [];
    for (const n of names.sort()) {
        // The overflow counter shares the directory and the extension but is not
        // a record. `isRecord` would reject it anyway; naming it here keeps the
        // exclusion intentional rather than incidental.
        if (!n.endsWith('.json') || n === OVERFLOW_FILE) {
            continue;
        }
        const rec = readRecord(root, n.slice(0, -'.json'.length));
        if (rec !== null) {
            out.push(rec);
        }
    }
    out.sort((a, b) => (a.last_seen < b.last_seen ? 1 : a.last_seen > b.last_seen ? -1 : 0));
    return out;
}

export function openRecords(root: string): DefectRecord[] {
    return listRecords(root).filter((r) => r.status === 'open');
}

/**
 * Per-source counters for findings the creation cap refused. ONE file for the
 * whole store, so the overflow record is bounded by construction — it is the
 * counter a runaway writer increments instead of the file it would otherwise
 * mint. Deliberately NOT a `DefectRecord`: an overflow is not a defect and must
 * not need a `DefectClass`, an issue-form dropdown entry, or an egress route.
 */
export const OVERFLOW_FILE = '_overflow.json';

export type OverflowCounts = Partial<Record<DefectSource, { dropped: number; last_seen: string }>>;

function overflowPath(root: string): string {
    return path.join(storeDir(root), OVERFLOW_FILE);
}

export function readOverflow(root: string): OverflowCounts {
    try {
        const parsed: unknown = JSON.parse(fs.readFileSync(overflowPath(root), 'utf-8'));
        return typeof parsed === 'object' && parsed !== null ? (parsed as OverflowCounts) : {};
    } catch {
        return {};
    }
}

function bumpOverflow(root: string, source: DefectSource, now: string): void {
    const counts = readOverflow(root);
    const prev = counts[source]?.dropped ?? 0;
    counts[source] = { dropped: prev + 1, last_seen: now };
    const dir = storeDir(root);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(overflowPath(root), `${JSON.stringify(counts, null, 2)}\n`, 'utf-8');
}

/**
 * Fold a finding into the store: increments the existing record when the
 * fingerprint matches, otherwise opens a new one. Returns the stored record, or
 * `null` when the per-source creation cap refused to open a new one.
 *
 * A refusal is COUNTED, never silent — `readOverflow` carries the per-source
 * drop tally, so "the cap fired" is a readable fact rather than a defect that
 * disappeared. A cap that quietly discarded reports would break this loop's own
 * Iron Law (a defect is queued, never shrugged off) in the name of bounding it.
 */
export function upsertFinding(
    root: string,
    finding: DefectFinding,
    now: string,
): DefectRecord | null {
    const fp = fingerprint(finding.defect_class, finding.evidence);
    const existing = readRecord(root, fp);
    // The fold path never consults the cap: a fingerprint already in the store
    // adds no file, so capping it would silence a tracked defect for no bound.
    if (existing === null && creationCapReached(listRecords(root), finding, now)) {
        bumpOverflow(root, finding.source, now);
        return null;
    }
    const merged = mergeRecord(existing, finding, now);
    writeRecord(root, merged);
    return merged;
}

/** Mark a record released (a PR or issue now carries it). */
export function markReleased(root: string, fp: string, now: string): DefectRecord | null {
    const rec = readRecord(root, fp);
    if (rec === null) {
        return null;
    }
    // A successful release supersedes any earlier failed attempts.
    const next: DefectRecord = { ...rec, status: 'released', last_seen: now };
    delete next.release_errors;
    writeRecord(root, next);
    return next;
}

/**
 * A release attempt exhausted the whole egress ladder: keep the record open
 * and attach every failed step so the next `self-repair:status` shows what
 * went wrong. Errors arrive pre-sanitized (the CLI runs them through
 * `sanitizeEvidence` — command output can carry local paths).
 */
export function attachReleaseErrors(
    root: string,
    fp: string,
    errors: string[],
    now: string,
): DefectRecord | null {
    const rec = readRecord(root, fp);
    if (rec === null) {
        return null;
    }
    const next: DefectRecord = {
        ...rec,
        status: 'open',
        last_seen: now,
        release_errors: errors,
    };
    writeRecord(root, next);
    return next;
}
