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

import { type DefectFinding, type DefectRecord, fingerprint, mergeRecord } from './self_repair.js';

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
        if (!n.endsWith('.json')) {
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
 * Fold a finding into the store: increments the existing record when the
 * fingerprint matches, otherwise opens a new one. Returns the stored record.
 */
export function upsertFinding(root: string, finding: DefectFinding, now: string): DefectRecord {
    const fp = fingerprint(finding.defect_class, finding.evidence);
    const merged = mergeRecord(readRecord(root, fp), finding, now);
    writeRecord(root, merged);
    return merged;
}

/** Mark a record released (a PR or issue now carries it). */
export function markReleased(root: string, fp: string, now: string): DefectRecord | null {
    const rec = readRecord(root, fp);
    if (rec === null) {
        return null;
    }
    const next: DefectRecord = { ...rec, status: 'released', last_seen: now };
    writeRecord(root, next);
    return next;
}
