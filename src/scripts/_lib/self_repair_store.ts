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
    ACTIVE_STATUSES,
    creationCapReached,
    type DefectFinding,
    type DefectRecord,
    type DefectSource,
    fingerprint,
    isWellFormedTarget,
    mergeRecord,
    parseTarget,
    validateRecord,
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

/**
 * Write one record. VALIDATES first — a `parked` record with no wake condition
 * or a malformed target never reaches the store, because a store that accepts
 * an unwakeable park has the same defect the park was supposed to fix.
 */
export function writeRecord(root: string, record: DefectRecord): void {
    const problems = validateRecord(record);
    if (problems.length > 0) {
        throw new Error(`refusing to write an invalid record: ${problems.join('; ')}`);
    }
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
        if (!n.endsWith('.json') || n === OVERFLOW_FILE || n === TARGET_INDEX_FILE) {
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

/**
 * The records still in the queue. Since the status enum widened past
 * `open | released`, "still queued" is `open` OR `candidate` — a record someone
 * accepted but has not yet acted on has not left the queue, and a `declined`,
 * `superseded`, `actioned` or `parked` one has.
 */
export function openRecords(root: string): DefectRecord[] {
    return listRecords(root).filter((r) =>
        (ACTIVE_STATUSES as readonly string[]).includes(r.status),
    );
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
    // The tree the targets resolve against. Defaults to the store root, which
    // is the production case (both are the repo). A test sandboxes the STORE in
    // a tmp dir while still resolving `rule:scope-control` against the real
    // tree, and folding the two roots together would make that untestable.
    opts?: { treeRoot?: string },
): DefectRecord | null {
    const fp = fingerprint(finding.defect_class, finding.evidence);
    // Targets are resolved against the tree HERE, at the write boundary: the
    // pure half cannot read the filesystem, and validating anywhere later would
    // mean a dangling id had already been stored.
    const split = partitionTargets(opts?.treeRoot ?? root, [
        ...(finding.target ?? []),
        ...(finding.proposes ?? []),
    ]);
    const resolved: DefectFinding = {
        ...finding,
        ...(split.target.length > 0 ? { target: split.target } : {}),
        ...(split.proposes.length > 0 ? { proposes: split.proposes } : {}),
    };
    if (split.target.length === 0) delete resolved.target;
    if (split.proposes.length === 0) delete resolved.proposes;
    const existing = readRecord(root, fp);
    // The fold path never consults the cap: a fingerprint already in the store
    // adds no file, so capping it would silence a tracked defect for no bound.
    if (existing === null && creationCapReached(listRecords(root), resolved, now)) {
        bumpOverflow(root, resolved.source, now);
        return null;
    }
    const merged = mergeRecord(existing, resolved, now);
    writeRecord(root, merged);
    return merged;
}

/**
 * Mark a record released — a PR or issue now carries it.
 *
 * The stored status is `actioned`, not the retired `released`: releasing IS the
 * action, and the widened enum has no separate slot for it. The function name
 * is kept because the CALLER's event is still "a release happened".
 */
export function markReleased(root: string, fp: string, now: string): DefectRecord | null {
    const rec = readRecord(root, fp);
    if (rec === null) {
        return null;
    }
    // A successful release supersedes any earlier failed attempts.
    const next: DefectRecord = {
        ...rec,
        status: 'actioned',
        resolution: rec.resolution ?? 'released — a pull request or issue now carries this record',
        last_seen: now,
    };
    delete next.release_errors;
    delete next.parked_until;
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

// target resolution
//
// `suggested_surface` is free text, so nothing could join a record to the asset
// it is about. A `target` entry is `<kind>:<id>` from a closed vocabulary AND it
// is resolved against the tree at WRITE time — an unresolvable entry is not
// rejected (a record proposing an asset that should exist is real information)
// and is not silently accepted either (a dangling id looks joined and joins to
// nothing). It is moved to `proposes`, where a reader can see it for what it is.

/** Where each target kind lives in the source tree. */
function _targetExists(root: string, kind: string, id: string): boolean {
    if (kind === 'rule') {
        return fs.existsSync(path.join(root, 'src', 'rules', `${id}.md`));
    }
    if (kind === 'skill') {
        return fs.existsSync(path.join(root, 'src', 'skills', id, 'SKILL.md'));
    }
    if (kind === 'command') {
        return _commandIds(root).has(id);
    }
    if (kind === 'hook') {
        return _concernIds(root).has(id);
    }
    return false;
}

/**
 * Command ids, read from the pack tree: every `command.md` under
 * `src/domains/<pack>/…` contributes the name of its containing directory, plus
 * the `parent-child` form a clustered command is referred to by.
 */
function _commandIds(root: string): ReadonlySet<string> {
    const out = new Set<string>();
    const base = path.join(root, 'src', 'domains');
    const walk = (dir: string, trail: string[]): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const ent of entries) {
            if (ent.isDirectory()) {
                walk(path.join(dir, ent.name), [...trail, ent.name]);
            } else if (ent.name === 'command.md' && trail.length > 0) {
                out.add(trail[trail.length - 1] as string);
                if (trail.length > 1) {
                    out.add(trail.slice(-2).join('-'));
                }
            }
        }
    };
    walk(base, []);
    return out;
}

/**
 * Hook-concern ids, read from the compiled manifest rather than re-parsing the
 * YAML: `hook_manifest.json` is the artifact the dispatcher itself reads, so a
 * concern that resolves here is a concern that actually exists at runtime.
 */
function _concernIds(root: string): ReadonlySet<string> {
    try {
        const raw = fs.readFileSync(
            path.join(root, 'src', 'scripts', 'hook_manifest.json'),
            'utf-8',
        );
        const parsed = JSON.parse(raw) as { manifest?: { concerns?: Record<string, unknown> } };
        return new Set(Object.keys(parsed.manifest?.concerns ?? {}));
    } catch {
        return new Set<string>();
    }
}

/**
 * Split a caller's target list into the entries that resolve in the tree and
 * the entries that do not. Malformed entries go to `proposes` too — a string
 * that is not `<kind>:<id>` cannot be resolved, and dropping it would lose the
 * observation.
 */
export function partitionTargets(
    root: string,
    values: readonly string[],
): { target: string[]; proposes: string[] } {
    const target: string[] = [];
    const proposes: string[] = [];
    for (const raw of values) {
        const value = raw.trim();
        if (value === '') continue;
        const parsed = isWellFormedTarget(value) ? parseTarget(value) : null;
        if (parsed !== null && _targetExists(root, parsed.kind, parsed.id)) {
            if (!target.includes(value)) target.push(value);
        } else if (!proposes.includes(value)) {
            proposes.push(value);
        }
    }
    return { target, proposes };
}

// per-target occurrence index
//
// `occurrences` counts a FINGERPRINT, which is class plus normalised evidence
// shape — so two different manifestations of one rule's weakness are two
// records with one occurrence each, and the third-recurrence escalation stated
// in `skill-improvement-pipeline` had nothing that could ever establish a third
// recurrence. This is a DERIVED read over the record files: regenerable,
// byte-stable, and gitignored with the rest of `agents/runtime/`.

// cache-invalidation: regenerated WHOLESALE from the record files on every run
// (`writeTargetIndex` recomputes from scratch — no incremental or partial
// state), and the output is deterministic by construction, so a stale read is
// impossible and a version namespace would name a format nothing reads across
// runs. The shape change that would matter is a shape change to the records
// themselves, which `validateRecord` already gates.
export const TARGET_INDEX_FILE = '_target-index.json';

export interface TargetCount {
    target: string;
    /** Sum of `occurrences` across every record naming this target. */
    occurrences: number;
    /** Fingerprints naming it — a per-target count of DISTINCT manifestations. */
    records: string[];
}

function targetIndexPath(root: string): string {
    return path.join(storeDir(root), TARGET_INDEX_FILE);
}

/** Aggregate occurrences by target. Pure over the store's record files. */
export function targetCounts(root: string): TargetCount[] {
    const acc = new Map<string, { occurrences: number; records: string[] }>();
    for (const rec of listRecords(root)) {
        for (const value of rec.target ?? []) {
            const prev = acc.get(value) ?? { occurrences: 0, records: [] };
            prev.occurrences += Number.isFinite(rec.occurrences) ? rec.occurrences : 0;
            if (!prev.records.includes(rec.fingerprint)) prev.records.push(rec.fingerprint);
            acc.set(value, prev);
        }
    }
    return [...acc.entries()]
        .map(([target, v]) => ({
            target,
            occurrences: v.occurrences,
            records: [...v.records].sort(),
        }))
        .sort((a, b) => (a.target < b.target ? -1 : a.target > b.target ? 1 : 0));
}

/**
 * Write the derived index. Deterministic by construction — sorted keys, sorted
 * fingerprints, no timestamp — so deleting it and rebuilding produces the same
 * bytes. A timestamp here would make the artifact look fresh while saying
 * nothing, and would destroy the one property that makes a rebuild routine.
 */
export function writeTargetIndex(root: string): TargetCount[] {
    const counts = targetCounts(root);
    fs.mkdirSync(storeDir(root), { recursive: true });
    fs.writeFileSync(targetIndexPath(root), `${JSON.stringify(counts, null, 2)}\n`, 'utf-8');
    return counts;
}

// status transitions

/**
 * Migrate `released` records — the retired status — to `actioned`, carrying a
 * resolution line that says the migration is why. Idempotent: a record already
 * on the new enum is left byte-identical, so running it twice over a store
 * produces no second diff.
 *
 * Returns the fingerprints it changed.
 */
export function migrateReleasedRecords(root: string): string[] {
    const changed: string[] = [];
    for (const rec of listRecords(root)) {
        if ((rec.status as string) !== 'released') continue;
        const next: DefectRecord = {
            ...rec,
            status: 'actioned',
            resolution:
                rec.resolution ??
                'migrated from the retired `released` status; the release itself is the action recorded',
        };
        writeRecord(root, next);
        changed.push(rec.fingerprint);
    }
    return changed.sort();
}

/** Move a record to a terminal or parked status, validating the result. */
export function setStatus(
    root: string,
    fp: string,
    next: DefectRecord['status'],
    now: string,
    extra?: { parked_until?: string; resolution?: string },
): DefectRecord | null {
    const rec = readRecord(root, fp);
    if (rec === null) return null;
    const updated: DefectRecord = {
        ...rec,
        status: next,
        last_seen: now,
        ...(extra?.parked_until !== undefined ? { parked_until: extra.parked_until } : {}),
        ...(extra?.resolution !== undefined ? { resolution: extra.resolution } : {}),
    };
    if (next !== 'parked') delete updated.parked_until;
    const problems = validateRecord(updated);
    if (problems.length > 0) {
        throw new Error(`refusing to write an invalid record: ${problems.join('; ')}`);
    }
    writeRecord(root, updated);
    return updated;
}
