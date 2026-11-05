/**
 * Finding invalidation — a closure is only as true as the files it was about.
 *
 * A release-finding row closed as `fixed` / `false_positive` / `accepted_risk`
 * may pin `affected_files` (repo-relative) and an `evidence_checksum` over their
 * contents at closure time. When the tree no longer matches that checksum the
 * disposition describes code that is gone, so the row is reported `stale` and
 * needs a fresh disposition.
 *
 * File-level only: the finding schema carries no `symbols[]` yet, so an edit
 * anywhere in an affected file invalidates the closure. Rows without
 * `affected_files` are untouched.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

/** Returns the file's contents, or null when it does not exist or cannot be read. */
export type FileReader = (relPath: string) => string | null;

// Duplicated from check_finding_dispositions.DISPOSITION_STATUSES rather than
// imported: that module imports this one, and `still_open` is deliberately not
// a closure — it records an unfixed issue, so there is nothing to invalidate.
const CLOSED_STATUSES: readonly string[] = ['fixed', 'false_positive', 'accepted_risk'];

export const STALE_STATUS = 'stale';

export interface InvalidatableFinding {
    finding_id: string;
    status?: string;
    affected_files?: string[];
    evidence_checksum?: string;
}

export interface StaleClosure {
    finding_id: string;
    previous_status: string;
    /** The pinned files whose combined checksum no longer matches. */
    changed_files: string[];
    /** The subset that no longer exists. */
    deleted_files: string[];
    reason: 'checksum_mismatch' | 'missing_checksum';
}

/**
 * Reads repo-relative paths under `root`. A path that escapes the root reads as
 * absent, so a malformed ledger entry fails toward `stale` rather than hashing
 * a file outside the repository.
 */
export function fsFileReader(root: string): FileReader {
    const base = path.resolve(root);
    return (rel) => {
        if (path.isAbsolute(rel)) {
            return null;
        }
        const abs = path.resolve(base, rel);
        if (abs !== base && !abs.startsWith(base + path.sep)) {
            return null;
        }
        try {
            return fs.readFileSync(abs, 'utf-8');
        } catch {
            return null;
        }
    };
}

function normalisedPaths(files: readonly string[]): string[] {
    return [...new Set(files.map((f) => f.trim()).filter((f) => f !== ''))].sort();
}

/**
 * sha256 over the affected files, sorted by path. Each entry is length-prefixed
 * so moving bytes between two files can never reproduce the same digest, and an
 * absent file hashes as a distinct marker rather than as empty content.
 */
export function evidenceChecksum(files: readonly string[], read: FileReader): string {
    const h = createHash('sha256');
    for (const rel of normalisedPaths(files)) {
        const body = read(rel);
        h.update(`${rel}\0`);
        if (body === null) {
            h.update('absent\0');
        } else {
            h.update(`${String(Buffer.byteLength(body, 'utf-8'))}\0`);
            h.update(body);
            h.update('\0');
        }
    }
    return h.digest('hex');
}

/** The stale verdict for one row, or null when it is open, unpinned, or current. */
export function staleClosure(f: InvalidatableFinding, read: FileReader): StaleClosure | null {
    const status = (f.status ?? '').trim();
    if (!CLOSED_STATUSES.includes(status)) {
        return null;
    }
    const files = normalisedPaths(f.affected_files ?? []);
    if (files.length === 0) {
        return null;
    }
    const deleted = files.filter((rel) => read(rel) === null);
    const pinned = (f.evidence_checksum ?? '').trim();
    // A row that names files without a checksum claims a pin it cannot prove;
    // treating it as current would make the field decorative.
    if (pinned === '') {
        return {
            finding_id: f.finding_id,
            previous_status: status,
            changed_files: files,
            deleted_files: deleted,
            reason: 'missing_checksum',
        };
    }
    if (evidenceChecksum(files, read) === pinned) {
        return null;
    }
    return {
        finding_id: f.finding_id,
        previous_status: status,
        changed_files: files,
        deleted_files: deleted,
        reason: 'checksum_mismatch',
    };
}

/** Closures whose pinned evidence no longer matches the tree. Pure over `read`. */
export function staleClosures(
    findings: readonly InvalidatableFinding[],
    read: FileReader,
): StaleClosure[] {
    return findings
        .map((f) => staleClosure(f, read))
        .filter((s): s is StaleClosure => s !== null);
}

/**
 * The findings as the gate should judge them: stale closures carry
 * `status: 'stale'` and the rest are returned by identity. Never mutates the
 * input — the committed ledger stays the record of what was decided.
 */
export function invalidateClosures<T extends InvalidatableFinding>(
    findings: readonly T[],
    read: FileReader,
): T[] {
    return findings.map((f) => (staleClosure(f, read) === null ? f : { ...f, status: STALE_STATUS }));
}

/** One line per stale closure, naming what changed and what is being asked for. */
export function describeStale(s: StaleClosure): string {
    const what =
        s.reason === 'missing_checksum'
            ? `affected_files ${s.changed_files.join(', ')} carry no evidence_checksum`
            : s.deleted_files.length > 0
              ? `affected file(s) deleted: ${s.deleted_files.join(', ')}`
              : `affected file(s) changed since disposition: ${s.changed_files.join(', ')}`;
    return `${s.finding_id}: closure "${s.previous_status}" is stale — ${what}; re-disposition required`;
}
