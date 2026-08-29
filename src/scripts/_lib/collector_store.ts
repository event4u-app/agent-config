/**
 * The supervised collector's record store — deletion, opt-out, and the five
 * upgrade transitions.
 *
 * `road-to-supervised-telemetry-collector` Phase 2 steps 2.3 and 2.4 (AC-4,
 * AC-5). `_lib/collector_record.ts` fixed the record's SHAPE; nothing yet held
 * a record, so "deletion and opt-out are implemented" had nowhere to be true.
 * This is that somewhere, and it is deliberately the smallest thing that makes
 * both steps' `verify:` lines executable rather than documentable.
 *
 * ## Class A, and provably so — this is NOT the collector
 *
 * Open, write or read, close, return. No resident process, no socket, no timer,
 * no state surviving a call. The supervised process of Phase 4 is a *client* of
 * this module; the module itself has the same shape as
 * `_lib/runtime_journal.ts` and `_lib/test_red_state.ts`, so nothing here
 * consumes the ADR-249 permission for a resident process. Phase 4 does that,
 * with the four governance conditions attached.
 *
 * ## Where it lives — the uniqueness blocker's answer, executed
 *
 * `<user-root>/agent-collector/collector.sqlite`, where `<user-root>` defaults
 * to `~/.event4u/agent-config/`. This is not a fresh choice: the
 * `uniqueness-namespace` blocker resolved **(b) — exactly one collector per OS
 * user** (AI council 2026-08-28, 2/2 convergent), on the ground that the
 * uniqueness scope should match the state's scope and the configuration already
 * lives under the user's home. A per-repository store would have contradicted
 * that resolution while looking like a smaller decision.
 *
 * Two consequences worth naming rather than discovering:
 *
 * - **A repository is never discovered from the filesystem.** The same blocker
 *   forbids it explicitly. Records carry `machine_id` / `episode_id` and no
 *   path, so attribution survives multiplexing without the store ever holding a
 *   location. {@link CollectorRecord} could not hold one if it wanted to.
 * - **The shared-machine case is a documented limitation, not a design.** A
 *   per-user store is the wrong boundary for a machine several people share,
 *   and the blocker records that as a known gap rather than solving it here.
 *
 * ## Opt-out prevents the WRITE, and that distinction is the whole step
 *
 * 2.3's second clause is *"opt-out prevents the write rather than filtering the
 * read"*, which is a real architectural difference and not a phrasing
 * preference. A read filter leaves the data on disk: the record exists, the
 * consent choice is honoured only by whoever remembers to apply the filter, and
 * a future reader that forgets is a leak. {@link writeRecord} refuses before it
 * touches SQLite, and {@link isOptedOut} is checked there rather than by the
 * caller, so a caller cannot forget.
 *
 * The marker is a FILE, not a settings key, and reachable without the
 * collector's cooperation — the same property the kill switch of 3.3 needs. A
 * user who cannot start the package can still `touch` it.
 *
 * ## Deletion is a path, exercised
 *
 * The governance roadmap's first draft required deletion to be *documented*. A
 * documented deletion path nobody executed is a claim, so {@link deleteMachine}
 * is the supported path and the tests drive it and then assert the store no
 * longer serves those records — including through {@link readRecords} with no
 * filter, because "gone" has to mean gone from the store and not merely absent
 * from one query.
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';

import {
    type CollectorRecord,
    COLLECTOR_SCHEMA_VERSION,
    dedupKey,
    validateRecord,
} from './collector_record.js';
import { isSqliteAvailableSync, loadSqliteSync, readUserVersion, stampUserVersion } from './sqlite_guard.js';

/** Directory name under the user root. */
export const COLLECTOR_DIR_NAME = 'agent-collector';
/** The database file. */
export const COLLECTOR_FILE_NAME = 'collector.sqlite';
/** The opt-out marker. Its presence is the whole signal; content is ignored. */
export const OPT_OUT_MARKER_NAME = 'OPT-OUT';
/** Written while a migration is in flight; its presence means "crashed mid-migration". */
export const MIGRATION_MARKER_NAME = 'MIGRATION-IN-FLIGHT';
/** Where an unreadable-by-this-revision store is moved. Never deleted. */
export const QUARANTINE_DIR_NAME = 'quarantine';

/** Identifies this module in `sqlite_guard`'s unavailability message. */
const CALLER = 'collector_store';

/** Raised when the store is asked to do something the contract forbids. */
export class CollectorStoreError extends Error {}

/** Why a write did not land. A blind zero is what this enum prevents. */
export type WriteRefusal =
    | 'opted-out'
    | 'invalid-record'
    | 'schema-quarantined'
    | 'sqlite-unavailable';

export interface WriteOutcome {
    written: boolean;
    /** Set when `written` is false. Never null-and-written. */
    refusal: WriteRefusal | null;
    /** Validation errors, when the refusal is `invalid-record`. */
    errors: readonly string[];
}

export interface StoreLocation {
    /** The user root the store hangs off. Carried so nothing has to re-derive it. */
    readonly userRoot: string;
    readonly root: string;
    readonly path: string;
    readonly optOutMarker: string;
    readonly migrationMarker: string;
    readonly quarantineDir: string;
}

/** The default user root — where configuration already lives. */
export function defaultUserRoot(): string {
    return path.join(os.homedir(), '.event4u', 'agent-config');
}

/** Resolve every path the store uses. Pure: creates nothing. */
export function resolveCollectorStore(userRoot: string = defaultUserRoot()): StoreLocation {
    const dir = path.join(userRoot, COLLECTOR_DIR_NAME);
    return {
        userRoot,
        root: dir,
        path: path.join(dir, COLLECTOR_FILE_NAME),
        optOutMarker: path.join(dir, OPT_OUT_MARKER_NAME),
        migrationMarker: path.join(dir, MIGRATION_MARKER_NAME),
        quarantineDir: path.join(dir, QUARANTINE_DIR_NAME),
    };
}

/** True when this user has opted out. Checked at write time, never at read. */
export function isOptedOut(userRoot: string = defaultUserRoot()): boolean {
    return fs.existsSync(resolveCollectorStore(userRoot).optOutMarker);
}

/** Create the opt-out marker. Idempotent. */
export function optOut(userRoot: string = defaultUserRoot()): void {
    const loc = resolveCollectorStore(userRoot);
    fs.mkdirSync(loc.root, { recursive: true });
    fs.writeFileSync(
        loc.optOutMarker,
        'This user has opted out of collector capture. Delete this file to opt back in.\n',
    );
}

/** Remove the opt-out marker. Idempotent. */
export function optIn(userRoot: string = defaultUserRoot()): void {
    fs.rmSync(resolveCollectorStore(userRoot).optOutMarker, { force: true });
}

export interface StoreHandle {
    readonly db: DatabaseSync;
    readonly location: StoreLocation;
    /**
     * Set when the on-disk schema is NEWER than this revision understands and
     * the store was quarantined rather than read. Every write is refused and
     * every read returns nothing — the store is preserved, untouched.
     */
    readonly quarantined: boolean;
    close(): void;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS collector_events (
    dedup_key         TEXT PRIMARY KEY,
    schema_version    INTEGER NOT NULL,
    machine_id        TEXT NOT NULL,
    episode_id        TEXT NOT NULL,
    event             TEXT NOT NULL,
    sequence          INTEGER NOT NULL,
    outcome           TEXT NOT NULL,
    platform          TEXT NOT NULL,
    occurred_on       TEXT NOT NULL,
    collector_version TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS collector_events_machine
    ON collector_events (machine_id, occurred_on);
`;

/** Is `node:sqlite` usable in this runtime? */
export function isStoreAvailable(): boolean {
    return isSqliteAvailableSync();
}

/**
 * Move an unreadable store aside, preserving it byte-for-byte.
 *
 * 3.1's rollback matrix requires an incompatible schema to be *preserved
 * without reading or rewriting*. Quarantine is that: a rename, never a read and
 * never a migration. The name carries a content digest rather than a timestamp
 * so two quarantines of the same bytes collapse instead of accumulating.
 */
export function quarantine(location: StoreLocation): string {
    fs.mkdirSync(location.quarantineDir, { recursive: true });
    const digest = crypto
        .createHash('sha256')
        .update(fs.readFileSync(location.path))
        .digest('hex')
        .slice(0, 12);
    const target = path.join(location.quarantineDir, `${COLLECTOR_FILE_NAME}.${digest}`);
    if (fs.existsSync(target)) {
        fs.rmSync(location.path, { force: true });
    } else {
        fs.renameSync(location.path, target);
    }
    for (const sidecar of ['-wal', '-shm']) {
        const from = `${location.path}${sidecar}`;
        if (fs.existsSync(from)) fs.rmSync(from, { force: true });
    }
    return target;
}

/**
 * Open the store, migrating or quarantining as the on-disk version requires.
 *
 * The five transitions of 2.4 all resolve here:
 *
 * 1. **Fresh store** — created at {@link COLLECTOR_SCHEMA_VERSION}.
 * 2. **Older records, newer package** — migrated forward, in a marked window.
 * 3. **Newer records, older package** — QUARANTINED. Never read, never
 *    rewritten. Reading a record shape you do not understand is how a field
 *    gets silently dropped, and dropping is what this schema refuses.
 * 4. **Crash mid-migration** — the marker survives the crash, so the next open
 *    finds a half-migrated store and quarantines it rather than resuming a
 *    migration whose progress nothing recorded.
 * 5. **Uninstall** — {@link uninstall}, which removes the store and leaves the
 *    quarantine directory, because a quarantined store is evidence.
 */
export function openCollectorStore(userRoot: string = defaultUserRoot()): StoreHandle {
    if (!isSqliteAvailableSync()) {
        throw new CollectorStoreError('node:sqlite is unavailable in this runtime');
    }
    const location = resolveCollectorStore(userRoot);
    fs.mkdirSync(location.root, { recursive: true });

    // Transition 4 comes FIRST: a store carrying an in-flight marker is
    // half-migrated by definition, and its version stamp cannot be trusted to
    // say which half. Checked before the version is even read.
    if (fs.existsSync(location.migrationMarker) && fs.existsSync(location.path)) {
        quarantine(location);
        fs.rmSync(location.migrationMarker, { force: true });
        const sqlite = loadSqliteSync(CALLER);
        const db = new sqlite.DatabaseSync(location.path);
        db.exec(SCHEMA);
        stampUserVersion(db, COLLECTOR_SCHEMA_VERSION);
        return handleFor(db, location, false);
    }

    const existed = fs.existsSync(location.path);
    const sqlite = loadSqliteSync(CALLER);
    const db = new sqlite.DatabaseSync(location.path);

    if (!existed) {
        db.exec(SCHEMA);
        stampUserVersion(db, COLLECTOR_SCHEMA_VERSION);
        return handleFor(db, location, false);
    }

    const onDisk = readUserVersion(db);

    if (onDisk > COLLECTOR_SCHEMA_VERSION) {
        // Transition 3. Close before renaming: a quarantine that leaves an open
        // handle on the moved file is a rename that looks successful and is not.
        db.close();
        quarantine(location);
        const fresh = new sqlite.DatabaseSync(location.path);
        fresh.exec(SCHEMA);
        stampUserVersion(fresh, COLLECTOR_SCHEMA_VERSION);
        return handleFor(fresh, location, true);
    }

    if (onDisk < COLLECTOR_SCHEMA_VERSION) {
        // Transition 2, inside a marked window so transition 4 can see a crash.
        fs.writeFileSync(location.migrationMarker, `${onDisk} -> ${COLLECTOR_SCHEMA_VERSION}\n`);
        try {
            db.exec(SCHEMA);
            stampUserVersion(db, COLLECTOR_SCHEMA_VERSION);
        } finally {
            fs.rmSync(location.migrationMarker, { force: true });
        }
        return handleFor(db, location, false);
    }

    db.exec(SCHEMA);
    return handleFor(db, location, false);
}

function handleFor(db: DatabaseSync, location: StoreLocation, quarantined: boolean): StoreHandle {
    return {
        db,
        location,
        quarantined,
        close(): void {
            db.close();
        },
    };
}

/**
 * Write one record, or refuse with a named reason.
 *
 * Opt-out is checked HERE and not by the caller, which is the point: a consent
 * check a caller can forget is a consent check that will be forgotten.
 */
export function writeRecord(handle: StoreHandle, candidate: unknown): WriteOutcome {
    if (isOptedOut(handle.location.userRoot)) {
        return { written: false, refusal: 'opted-out', errors: [] };
    }
    if (handle.quarantined) {
        return { written: false, refusal: 'schema-quarantined', errors: [] };
    }
    const verdict = validateRecord(candidate);
    if (!verdict.ok) {
        return { written: false, refusal: 'invalid-record', errors: verdict.errors };
    }
    const record = candidate as CollectorRecord;
    handle.db
        .prepare(
            `INSERT OR REPLACE INTO collector_events
                (dedup_key, schema_version, machine_id, episode_id, event, sequence,
                 outcome, platform, occurred_on, collector_version)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
            dedupKey(record),
            record.schema_version,
            record.machine_id,
            record.episode_id,
            record.event,
            record.sequence,
            record.outcome,
            record.platform,
            record.occurred_on,
            record.collector_version,
        );
    return { written: true, refusal: null, errors: [] };
}

/** Every record, or every record for one machine. Never filtered by consent. */
export function readRecords(handle: StoreHandle, machineId?: string): CollectorRecord[] {
    if (handle.quarantined) return [];
    const rows =
        machineId === undefined
            ? handle.db
                  .prepare(
                      `SELECT schema_version, machine_id, episode_id, event, sequence, outcome,
                              platform, occurred_on, collector_version
                       FROM collector_events ORDER BY machine_id, episode_id, sequence`,
                  )
                  .all()
            : handle.db
                  .prepare(
                      `SELECT schema_version, machine_id, episode_id, event, sequence, outcome,
                              platform, occurred_on, collector_version
                       FROM collector_events WHERE machine_id = ?
                       ORDER BY episode_id, sequence`,
                  )
                  .all(machineId);
    return rows as unknown as CollectorRecord[];
}

/**
 * The supported deletion path. Returns how many records were removed.
 *
 * A GDPR Art. 17 request names a subject, and on this store the subject is a
 * machine — `machine_id` is the only identity a record carries. Deletion is
 * therefore by machine and nothing coarser is offered: a "delete everything"
 * verb would make a targeted request impossible to serve honestly.
 */
export function deleteMachine(handle: StoreHandle, machineId: string): number {
    if (handle.quarantined) return 0;
    const before = readRecords(handle, machineId).length;
    handle.db.prepare('DELETE FROM collector_events WHERE machine_id = ?').run(machineId);
    return before;
}

/**
 * What uninstall removes: the database and its sidecars, and the markers.
 *
 * It does NOT remove the quarantine directory. A quarantined store is the
 * record of an incompatible-schema event, and uninstall is not the moment to
 * destroy evidence about it. Returns the paths actually removed.
 */
export function uninstall(userRoot: string = defaultUserRoot()): string[] {
    const location = resolveCollectorStore(userRoot);
    const removed: string[] = [];
    for (const target of [
        location.path,
        `${location.path}-wal`,
        `${location.path}-shm`,
        location.migrationMarker,
    ]) {
        if (fs.existsSync(target)) {
            fs.rmSync(target, { force: true });
            removed.push(target);
        }
    }
    return removed;
}
