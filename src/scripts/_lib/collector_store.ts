/**
 * The supervised collector's record store — deletion, opt-out, retention, and
 * the five upgrade transitions.
 *
 * `road-to-supervised-telemetry-collector` Phase 2 steps 2.3 and 2.4 (AC-4,
 * AC-5). `_lib/collector_record.ts` fixed the record's SHAPE; nothing yet held a
 * record, so "deletion and opt-out are implemented" had nowhere to be true.
 * This is that somewhere, and it is deliberately the smallest thing that makes
 * both steps' `verify:` lines executable rather than documentable.
 *
 * **Revision 2, after a blind R2 review found 12 findings (2 high).** The two
 * high ones were evidence-strength failures on steps this roadmap had already
 * flipped: the quarantine growth-budget test was tautological, and transition
 * 2's "migration" was a version stamp with a test that could not detect that.
 * Both are addressed below and each fix names the finding it closes.
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
 * **Cost, recorded rather than left for 3.2 to discover (R2 finding 12):** the
 * check is one `existsSync` per write, i.e. one stat syscall on the write path.
 * That is a deliberate trade: honouring a mid-session opt-out immediately is
 * worth a stat, and caching the marker's value for the life of a handle would
 * mean a user who opts out during a session keeps being recorded until it ends.
 * The syscall is a line item owed to step 3.2's CPU budget, not a defect.
 *
 * ## Deduplication is a READ, and the duplicate stays visible
 *
 * Metric item 4 of the roadmap's own definition: *"Deduplication happens at read
 * time over the store, never at write time, so a duplicate is observable as a
 * defect rather than silently collapsed."* The first implementation used a
 * `PRIMARY KEY` on the dedup key plus `INSERT OR REPLACE`, which satisfies the
 * item's first sentence by violating its second — the retry is absorbed and
 * nobody can see it happened. Self-caught before the review. The table is
 * append-only now, {@link readRecords} collapses repeats with the first
 * occurrence winning, and {@link readSummary} reports `rows`, `unique` and
 * `duplicates` so a non-zero duplicate count is a defect somebody can find.
 *
 * ## Retention — declared, because an append-only table without one is a leak
 *
 * R2 finding 8: `collector_events` grows per event and had no TTL, pruning job,
 * partition rotation or archive path, while this module reasoned about R-A7 for
 * the neighbouring quarantine *directory*. {@link RETENTION_DAYS} is the
 * declared policy and {@link pruneOlderThan} is the job. The number is the
 * metric definition's own hard stop (item 8: the observation window extends to
 * a hard stop at 63 days), so a record that can no longer belong to any live
 * window has no reason to be kept. The DISK CEILING remains step 3.2's, and a
 * retention policy is not a ceiling.
 *
 * ## Deletion is a path, exercised
 *
 * The governance roadmap's first draft required deletion to be *documented*. A
 * documented deletion path that nobody executed is a claim, so
 * {@link deleteMachine} is the supported path and the tests drive it and then
 * assert the store no longer serves those records — including through
 * {@link readRecords} with no filter, because "gone" has to mean gone from the
 * store and not merely absent from one query.
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
import {
    isSqliteAvailableSync,
    loadSqliteSync,
    readUserVersion,
    stampUserVersion,
} from './sqlite_guard.js';

/** Directory name under the user root. */
export const COLLECTOR_DIR_NAME = 'agent-collector';
/** The database file. */
export const COLLECTOR_FILE_NAME = 'collector.sqlite';
/** The opt-out marker. Its presence is the whole signal; content is ignored. */
export const OPT_OUT_MARKER_NAME = 'OPT-OUT';
/** Written while a migration is in flight; its presence means "crashed mid-migration". */
export const MIGRATION_MARKER_NAME = 'MIGRATION-IN-FLIGHT';
/** Where a store this revision cannot read is moved. Never deleted. */
export const QUARANTINE_DIR_NAME = 'quarantine';

/**
 * Declared retention for `collector_events`, in days.
 *
 * 63 is the metric definition's hard stop for the observation window (item 8:
 * 21 days, extending in 7-day increments to a hard stop at 63). A record older
 * than that cannot belong to any live window, so keeping it serves nothing.
 */
export const RETENTION_DAYS = 63;

/** Identifies this module in `sqlite_guard`'s unavailability message. */
const CALLER = 'collector_store';

/**
 * Raised when the store cannot be opened at all — today, only because
 * `node:sqlite` is unavailable in the runtime.
 *
 * Named for what it is rather than for what a wider class might one day be:
 * R2 finding 11 caught the previous docstring ("asked to do something the
 * contract forbids") describing a class this error has never had a member of.
 */
export class CollectorStoreError extends Error {}

/**
 * Why a write did not land. A blind zero is what this enum prevents.
 *
 * `sqlite-unavailable` was removed (R2 finding 11): no code path returned it,
 * because unavailability throws from {@link openCollectorStore} before a write
 * is reachable. An unreachable member forces an exhaustive consumer switch to
 * handle a case that cannot occur, while the real failure arrives as an
 * exception it does not handle.
 */
export type WriteRefusal = 'opted-out' | 'invalid-record' | 'schema-quarantined';

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
     * True when **this open** moved a store aside it could not read, and is
     * handing back a fresh one.
     *
     * SESSION-SCOPED BY DESIGN, and named for it (R2 finding 4). The previous
     * name (`quarantined`) implied a durable lockout it never was: the fresh
     * store is stamped at the current version, so the NEXT open over the same
     * on-disk state returns `false` and writes land. That is correct — the
     * incompatible store is preserved and the fallback is usable — but "one-shot
     * signal" and "durable refusal" were indistinguishable from the code, so a
     * test now pins the post-restart behaviour explicitly.
     *
     * Writes through THIS handle are refused so the incompatible-schema event
     * reaches the caller instead of being absorbed by a silent fallback.
     */
    readonly quarantine_performed: boolean;
    close(): void;
}

/**
 * APPEND-ONLY, and `dedup_key` is deliberately NOT unique.
 *
 * Metric item 4 requires read-time dedup so a duplicate is observable. A
 * `PRIMARY KEY` on `dedup_key` plus `INSERT OR REPLACE` satisfies "a repeated
 * key is one record" by violating "observable as a defect", which is the shape
 * of contract this whole roadmap exists to refuse. So the table accepts both
 * rows, {@link readRecords} collapses them, and {@link readSummary} reports how
 * many were collapsed.
 */
const SCHEMA = `
CREATE TABLE IF NOT EXISTS collector_events (
    row_id            INTEGER PRIMARY KEY AUTOINCREMENT,
    dedup_key         TEXT NOT NULL,
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
CREATE INDEX IF NOT EXISTS collector_events_dedup
    ON collector_events (dedup_key);
CREATE INDEX IF NOT EXISTS collector_events_machine
    ON collector_events (machine_id, occurred_on);
`;

/**
 * One migration step: `from` → `from + 1`. Registered explicitly, so a version
 * with no registered step is a REFUSAL rather than a silent stamp.
 *
 * R2 finding 2, and it is the finding that mattered most. The previous
 * implementation ran `db.exec(SCHEMA)` — `CREATE TABLE IF NOT EXISTS`, a no-op
 * on an existing table of ANY shape — and then stamped `user_version` forward.
 * The whole "migration" was the stamp, and its test seeded only the version
 * integer backwards over the CURRENT table shape, so it passed for a stamp-only
 * implementation and could never have caught the missing DDL. The first real
 * column change would have stamped an old-shaped store as current.
 *
 * The ladder makes the mechanism real and falsifiable. The one registered step
 * (0 → 1) is genuinely a no-op **because no schema delta exists yet**, and that
 * is stated here rather than implied by an empty function body: version 0 is the
 * un-stamped state a database gets before this module writes to it, and the
 * table it lands with is already the v1 shape.
 */
export type MigrationStep = (db: DatabaseSync) => void;

export const MIGRATIONS: Readonly<Record<number, MigrationStep>> = Object.freeze({
    // 0 → 1. No DDL: `user_version` 0 is the default SQLite assigns, and a
    // database created by this module is already at the v1 shape. The entry
    // exists so the path RESOLVES rather than being inferred from its absence.
    0: () => {},
});

/**
 * The steps needed to walk `from` → `to`, or `null` when the walk is impossible.
 *
 * Pure, exported, and tested directly — which is what makes the ladder
 * falsifiable without seeding a database per hypothesis. `null` means the caller
 * must quarantine: refusing an unmigratable store is the safe branch, and
 * stamping it is the unsafe one this replaces.
 */
export function migrationPath(from: number, to: number): number[] | null {
    if (from > to) return null; // a NEWER store; quarantine, never downgrade
    const steps: number[] = [];
    for (let v = from; v < to; v++) {
        if (!(v in MIGRATIONS)) return null;
        steps.push(v);
    }
    return steps;
}

/** Is `node:sqlite` usable in this runtime? */
export function isStoreAvailable(): boolean {
    return isSqliteAvailableSync();
}

/**
 * Move a store this revision cannot read aside, preserving it byte-for-byte.
 *
 * 3.1's rollback matrix requires an incompatible schema to be *preserved
 * without reading or rewriting*. Quarantine is that: a rename, and the only
 * read is a whole-file digest to name the destination — **the bytes are never
 * interpreted as records**, which is the claim row 5 means and the earlier
 * wording ("a rename, never a read") overstated (R2 finding 10). The digest read
 * is a line item owed to step 3.2's disk budget.
 *
 * The name carries a CONTENT DIGEST rather than a timestamp so two quarantines
 * of the same bytes collapse instead of accumulating — R-A7 applied to a
 * directory nobody prunes.
 *
 * WAL sidecars are **moved, not deleted** (R2 finding 6). Deleting them would
 * drop any committed data still in the WAL while a byte-equality assertion on
 * the main file stayed green — preserving the file and discarding its tail is
 * not preservation.
 *
 * **Measured while fixing it, and it demotes the finding rather than confirming
 * it:** the loss is NOT reachable through {@link openCollectorStore}. That
 * function opens the database before reading its version, and opening removes an
 * unrecognised `-wal` (a real WAL-mode close checkpoints its contents into the
 * main file first), so by the time this function runs there is no sidecar left
 * to lose. No `PRAGMA journal_mode = WAL` is set anywhere either. Two tests pin
 * both halves — the move, called directly, and the removal-on-open that makes
 * the end-to-end path unreachable — so enabling WAL later reds the second one
 * and re-opens the question deliberately instead of silently.
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
        // Same bytes already preserved. Drop the duplicate rather than growing
        // the directory: the artefact is already there, byte-identical.
        fs.rmSync(location.path, { force: true });
        for (const sidecar of ['-wal', '-shm']) {
            fs.rmSync(`${location.path}${sidecar}`, { force: true });
        }
        return target;
    }
    fs.renameSync(location.path, target);
    for (const sidecar of ['-wal', '-shm']) {
        const from = `${location.path}${sidecar}`;
        if (fs.existsSync(from)) fs.renameSync(from, `${target}${sidecar}`);
    }
    return target;
}

/**
 * Open the store, migrating or quarantining as the on-disk version requires.
 *
 * The five transitions of 2.4 all resolve here:
 *
 * 1. **Fresh store** — created at {@link COLLECTOR_SCHEMA_VERSION}.
 * 2. **Older records, newer package** — walked forward through
 *    {@link MIGRATIONS} inside a marked window. A version with NO registered
 *    path is quarantined, not stamped.
 * 3. **Newer records, older package** — QUARANTINED. Never read as records,
 *    never rewritten. Reading a record shape you do not understand is how a
 *    field gets silently dropped, and dropping is what this schema refuses.
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
    const sqlite = loadSqliteSync(CALLER);

    // Transition 4 comes FIRST: a store carrying an in-flight marker is
    // half-migrated by definition, and its version stamp cannot be trusted to
    // say which half. Checked before the version is even read.
    //
    // The marker is cleared whenever it EXISTS, independent of the database
    // (R2 finding 3). Previously the guard required marker AND db, while
    // `quarantine()` renames the db away before the marker is removed — so a
    // crash between those two steps left marker-present / db-absent, the next
    // open took the fresh-store branch and never cleared it, and the open after
    // that quarantined a healthy store.
    let markerQuarantined = false;
    if (fs.existsSync(location.migrationMarker)) {
        if (fs.existsSync(location.path)) {
            quarantine(location);
            markerQuarantined = true;
        }
        fs.rmSync(location.migrationMarker, { force: true });
    }
    if (markerQuarantined) {
        const db = new sqlite.DatabaseSync(location.path);
        db.exec(SCHEMA);
        stampUserVersion(db, COLLECTOR_SCHEMA_VERSION);
        return handleFor(db, location, false);
    }

    const existed = fs.existsSync(location.path);
    const db = new sqlite.DatabaseSync(location.path);

    if (!existed) {
        db.exec(SCHEMA);
        stampUserVersion(db, COLLECTOR_SCHEMA_VERSION);
        return handleFor(db, location, false);
    }

    const onDisk = readUserVersion(db);
    const steps = migrationPath(onDisk, COLLECTOR_SCHEMA_VERSION);

    if (steps === null) {
        // Transition 3, and the no-registered-path case with it. Close before
        // renaming: a quarantine that leaves an open handle on the moved file is
        // a rename that looks successful and is not.
        db.close();
        quarantine(location);
        const fresh = new sqlite.DatabaseSync(location.path);
        fresh.exec(SCHEMA);
        stampUserVersion(fresh, COLLECTOR_SCHEMA_VERSION);
        return handleFor(fresh, location, true);
    }

    if (steps.length > 0) {
        // Transition 2, inside a marked window so transition 4 can see a crash.
        fs.writeFileSync(
            location.migrationMarker,
            `${onDisk} -> ${COLLECTOR_SCHEMA_VERSION} via ${steps.join(',')}\n`,
        );
        try {
            db.exec(SCHEMA);
            for (const step of steps) {
                (MIGRATIONS[step] as MigrationStep)(db);
            }
            stampUserVersion(db, COLLECTOR_SCHEMA_VERSION);
        } finally {
            fs.rmSync(location.migrationMarker, { force: true });
        }
        return handleFor(db, location, false);
    }

    db.exec(SCHEMA);
    return handleFor(db, location, false);
}

function handleFor(
    db: DatabaseSync,
    location: StoreLocation,
    quarantine_performed: boolean,
): StoreHandle {
    return {
        db,
        location,
        quarantine_performed,
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
    if (handle.quarantine_performed) {
        return { written: false, refusal: 'schema-quarantined', errors: [] };
    }
    const verdict = validateRecord(candidate);
    if (!verdict.ok) {
        return { written: false, refusal: 'invalid-record', errors: verdict.errors };
    }
    const record = candidate as CollectorRecord;
    handle.db
        .prepare(
            `INSERT INTO collector_events
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

/** What a read collapsed, so a duplicate is observable rather than invisible. */
export interface StoreSummary {
    /** Rows physically present. */
    rows: number;
    /** Distinct `(machine_id, episode_id, event, sequence)` keys among them. */
    unique: number;
    /** `rows - unique`. Non-zero is a DEFECT to investigate, not a tidy-up. */
    duplicates: number;
}

/**
 * Row and key counts for the whole store.
 *
 * This is the observability half of metric item 4. Read-time dedup without a
 * duplicate count would hide the defect just as effectively as a write-time
 * `INSERT OR REPLACE` — the records would be collapsed by a different mechanism
 * and nobody would know a retry had double-written.
 */
export function readSummary(handle: StoreHandle): StoreSummary {
    if (handle.quarantine_performed) return { rows: 0, unique: 0, duplicates: 0 };
    const row = handle.db
        .prepare('SELECT COUNT(*) AS n, COUNT(DISTINCT dedup_key) AS uniq FROM collector_events')
        .get() as { n: number; uniq: number };
    return { rows: row.n, unique: row.uniq, duplicates: row.n - row.uniq };
}

/**
 * Every record, or every record for one machine. Never filtered by consent.
 *
 * DEDUPLICATED AT READ TIME, first occurrence by insertion order winning — the
 * metric definition's item 4. The rows themselves stay on disk, so
 * {@link readSummary} can still say a duplicate happened.
 */
export function readRecords(handle: StoreHandle, machineId?: string): CollectorRecord[] {
    if (handle.quarantine_performed) return [];
    const columns = `dedup_key, schema_version, machine_id, episode_id, event, sequence,
                     outcome, platform, occurred_on, collector_version`;
    const rows = (
        machineId === undefined
            ? handle.db.prepare(`SELECT ${columns} FROM collector_events ORDER BY row_id`).all()
            : handle.db
                  .prepare(
                      `SELECT ${columns} FROM collector_events WHERE machine_id = ?
                       ORDER BY row_id`,
                  )
                  .all(machineId)
    ) as unknown as ({ dedup_key: string } & CollectorRecord)[];

    const seen = new Set<string>();
    const out: CollectorRecord[] = [];
    for (const row of rows) {
        if (seen.has(row.dedup_key)) continue;
        seen.add(row.dedup_key);
        const { dedup_key: _ignored, ...record } = row;
        out.push(record);
    }
    return out;
}

/**
 * The supported deletion path. Returns how many ROWS were removed.
 *
 * A GDPR Art. 17 request names a subject, and on this store the subject is a
 * machine — `machine_id` is the only identity a record carries. Deletion is
 * therefore by machine and nothing coarser is offered: a "delete everything"
 * verb would make a targeted request impossible to serve honestly.
 *
 * The count is the DELETE's own `changes` (R2 finding 7). It used to be a
 * pre-delete SELECT count, which over-reports the moment the two disagree — on
 * the one path this module frames as serving a legal request — and materialised
 * every matching row into objects purely to take `.length`.
 */
export function deleteMachine(handle: StoreHandle, machineId: string): number {
    if (handle.quarantine_performed) return 0;
    const result = handle.db
        .prepare('DELETE FROM collector_events WHERE machine_id = ?')
        .run(machineId);
    return Number(result.changes);
}

/**
 * Drop records older than the declared retention. Returns rows removed.
 *
 * The R-A7 obligation this module owed and did not have (R2 finding 8): an
 * append-only table must declare retention as a TTL, a pruning job, a partition
 * rotation or an archive path. This is the job; {@link RETENTION_DAYS} is the
 * policy. `today` is passed in rather than read from the clock so the boundary
 * is testable without freezing time.
 *
 * Compares `occurred_on`, a UTC calendar DATE, as a string — which is why the
 * record's date field is a date and not a timestamp.
 */
export function pruneOlderThan(
    handle: StoreHandle,
    today: string,
    days: number = RETENTION_DAYS,
): number {
    if (handle.quarantine_performed) return 0;
    const cutoff = new Date(Date.parse(`${today}T00:00:00Z`) - days * 86_400_000)
        .toISOString()
        .slice(0, 10);
    const result = handle.db
        .prepare('DELETE FROM collector_events WHERE occurred_on < ?')
        .run(cutoff);
    return Number(result.changes);
}

/**
 * What uninstall removes: the database, its sidecars, and the migration marker.
 *
 * It does NOT remove the quarantine directory. A quarantined store is the
 * record of an incompatible-schema event, and uninstall is not the moment to
 * destroy evidence about it.
 *
 * It does NOT remove the **opt-out marker**, and that is a decision rather than
 * an omission (R2 finding 5): reinstalling must not silently revoke a consent
 * choice the user made, so opt-out outlives uninstall. The previous docstring
 * said "the markers", plural, which would have invited a future edit to
 * reconcile code to prose by deleting it. Named, and tested.
 *
 * Returns the paths actually removed.
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
