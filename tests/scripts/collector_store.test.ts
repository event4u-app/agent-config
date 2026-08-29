// The collector store — deletion, opt-out, and the five upgrade transitions.
//
// `road-to-supervised-telemetry-collector` Phase 2 steps 2.3 and 2.4 (AC-4,
// AC-5). Every test drives the real store on a temp user root; nothing is
// mocked, because "a documented deletion path nobody executed is a claim" is
// the exact objection step 2.3 exists to answer, and a mocked deletion is a
// documented deletion with extra steps.
//
// Every block carries a `removing_this_constraint_reds_it` note naming the edit
// that would turn it green, on the pattern `collector_record.test.ts` set: a
// sensitivity claim stated per constraint rather than asserted once for the file.

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { COLLECTOR_SCHEMA_VERSION } from '../../src/scripts/_lib/collector_record.js';
import {
    COLLECTOR_FILE_NAME,
    deleteMachine,
    isOptedOut,
    isStoreAvailable,
    openCollectorStore,
    MIGRATIONS,
    migrationPath,
    optIn,
    optOut,
    pruneOlderThan,
    quarantine,
    QUARANTINE_DIR_NAME,
    RETENTION_DAYS,
    readRecords,
    readSummary,
    resolveCollectorStore,
    uninstall,
    writeRecord,
} from '../../src/scripts/_lib/collector_store.js';
import { loadSqliteSync, stampUserVersion } from '../../src/scripts/_lib/sqlite_guard.js';

const MACHINE_A = '3f2504e0-4f89-4d3a-9a0c-0305e82c3301';
const MACHINE_B = 'b7c3d1e2-8a4f-4b6c-9d0e-1f2a3b4c5d6e';

function record(over: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
    return {
        schema_version: COLLECTOR_SCHEMA_VERSION,
        machine_id: MACHINE_A,
        episode_id: 'a1b2c3d4-5e6f-4a8b-9c0d-1e2f3a4b5c6d',
        event: 'pre_tool_use',
        sequence: 0,
        outcome: 'captured',
        platform: 'claude',
        occurred_on: '2026-08-29',
        collector_version: '12.4.0',
        ...over,
    };
}

let root: string;

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'collector-store-'));
});

afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

// `node:sqlite` is the same optional dependency the journal guards on, so the
// whole file skips rather than fails where it is unavailable — and the skip is
// declared here once rather than repeated per test.
const withSqlite = isStoreAvailable() ? describe : describe.skip;

// R2 finding 9 — `describe.skip` silently skipped all 14 tests where
// `node:sqlite` is absent, so the "14 of 14 green" evidence recorded for 2.3 and
// 2.4 degraded to ZERO executed assertions with no distinguishing signal, in a
// roadmap whose own AC-8 holds that a skip counts as a failure.
//
// The sibling suite (`runtime_journal.test.ts:56`) uses the same silent
// `describe.runIf` pattern, and this file deliberately differs rather than
// matching it: its evidence line names a test COUNT, and a count nobody executed
// is not evidence. This block is NOT skipped, so an unavailable runtime is a red
// test rather than a silent zero.
describe('the runtime this suite’s evidence line depends on', () => {
    it('has node:sqlite — a skip here would make every count below unearned', () => {
        expect(
            isStoreAvailable(),
            'node:sqlite is unavailable, so every `withSqlite` block below SKIPPED and the ' +
                'recorded test count is unearned. This is a failure, not an absence — AC-8 of ' +
                'this roadmap holds exactly that for its own lifecycle suite.',
        ).toBe(true);
    });
});

withSqlite('2.3 — deletion is a path, and it is exercised', () => {
    // removing_this_constraint_reds_it: making `deleteMachine` a no-op that
    // returns the count without issuing the DELETE.
    it('removes a machine’s records and the store no longer serves them', () => {
        const handle = openCollectorStore(root);
        try {
            for (let sequence = 0; sequence < 4; sequence++) {
                expect(writeRecord(handle, record({ sequence })).written).toBe(true);
            }
            expect(writeRecord(handle, record({ machine_id: MACHINE_B })).written).toBe(true);
            expect(readRecords(handle)).toHaveLength(5);

            expect(deleteMachine(handle, MACHINE_A)).toBe(4);

            // Both queries, deliberately. "Gone" has to mean gone from the
            // store, not merely absent from the one query that filtered it.
            expect(readRecords(handle, MACHINE_A)).toHaveLength(0);
            expect(readRecords(handle)).toHaveLength(1);
            expect(readRecords(handle)[0]?.machine_id).toBe(MACHINE_B);
        } finally {
            handle.close();
        }
    });

    it('deletes by machine and leaves every other machine untouched', () => {
        const handle = openCollectorStore(root);
        try {
            writeRecord(handle, record());
            writeRecord(handle, record({ machine_id: MACHINE_B, sequence: 1 }));
            deleteMachine(handle, MACHINE_B);
            expect(readRecords(handle).map((r) => r.machine_id)).toEqual([MACHINE_A]);
        } finally {
            handle.close();
        }
    });

    it('reports zero for a machine that was never in the store', () => {
        const handle = openCollectorStore(root);
        try {
            expect(deleteMachine(handle, MACHINE_B)).toBe(0);
        } finally {
            handle.close();
        }
    });
});

withSqlite('2.3 — opt-out prevents the WRITE, not the read', () => {
    // This is the distinction the step names, so it gets the assertion that can
    // tell the two apart: after an opted-out write attempt the ROW COUNT is
    // unchanged, which a read filter could not achieve.
    //
    // removing_this_constraint_reds_it: moving the `isOptedOut` check out of
    // `writeRecord` and into a filter inside `readRecords`.
    it('refuses the write with a named reason and leaves the store empty', () => {
        optOut(root);
        expect(isOptedOut(root)).toBe(true);

        const handle = openCollectorStore(root);
        try {
            const outcome = writeRecord(handle, record());
            expect(outcome.written).toBe(false);
            expect(outcome.refusal).toBe('opted-out');

            // The load-bearing assertion: nothing was persisted, so there is
            // nothing a forgetful future reader could serve.
            expect(readRecords(handle)).toHaveLength(0);
            expect(
                handle.db.prepare('SELECT COUNT(*) AS n FROM collector_events').get(),
            ).toMatchObject({ n: 0 });
        } finally {
            handle.close();
        }
    });

    it('resumes writing after opt-in, and the earlier refusal left no gap to backfill', () => {
        optOut(root);
        const handle = openCollectorStore(root);
        try {
            expect(writeRecord(handle, record({ sequence: 0 })).written).toBe(false);
            optIn(root);
            expect(isOptedOut(root)).toBe(false);
            expect(writeRecord(handle, record({ sequence: 1 })).written).toBe(true);
            expect(readRecords(handle).map((r) => r.sequence)).toEqual([1]);
        } finally {
            handle.close();
        }
    });

    it('checks opt-out inside writeRecord so a caller cannot forget it', () => {
        // Nothing about the call site changes between the two cases — the same
        // one-argument call refuses or writes purely on the marker's presence.
        const handle = openCollectorStore(root);
        try {
            expect(writeRecord(handle, record({ sequence: 0 })).written).toBe(true);
            optOut(root);
            expect(writeRecord(handle, record({ sequence: 1 })).refusal).toBe('opted-out');
        } finally {
            handle.close();
        }
    });

    it('refuses an invalid record with its errors rather than silently dropping it', () => {
        const handle = openCollectorStore(root);
        try {
            const outcome = writeRecord(handle, record({ repo_path: '/Users/someone/x' }));
            expect(outcome.written).toBe(false);
            expect(outcome.refusal).toBe('invalid-record');
            expect(outcome.errors.join(' ')).toMatch(/REJECTED, not dropped/);
        } finally {
            handle.close();
        }
    });
});

withSqlite('2.4 — the five upgrade transitions, driven over a seeded store', () => {
    it('TRANSITION 1 — a fresh store is created at the current schema version', () => {
        const handle = openCollectorStore(root);
        try {
            expect(handle.quarantine_performed).toBe(false);
            expect(writeRecord(handle, record()).written).toBe(true);
        } finally {
            handle.close();
        }
        expect(fs.existsSync(resolveCollectorStore(root).path)).toBe(true);
    });

    it('TRANSITION 2 — an OLDER store is migrated forward and its records survive', () => {
        const first = openCollectorStore(root);
        try {
            writeRecord(first, record());
        } finally {
            first.close();
        }
        // Seed the store back to an older revision.
        const sqlite = loadSqliteSync('collector_store.test');
        const seeded = new sqlite.DatabaseSync(resolveCollectorStore(root).path);
        stampUserVersion(seeded, COLLECTOR_SCHEMA_VERSION - 1);
        seeded.close();

        const second = openCollectorStore(root);
        try {
            expect(second.quarantine_performed).toBe(false);
            // Migration, not quarantine: the record is still served.
            expect(readRecords(second)).toHaveLength(1);
        } finally {
            second.close();
        }
        // The in-flight marker does not survive a successful migration.
        expect(fs.existsSync(resolveCollectorStore(root).migrationMarker)).toBe(false);
    });

    // removing_this_constraint_reds_it: letting `openCollectorStore` read a
    // store whose `user_version` exceeds `COLLECTOR_SCHEMA_VERSION`.
    it('TRANSITION 3 — a NEWER store is quarantined, never read and never rewritten', () => {
        const first = openCollectorStore(root);
        try {
            writeRecord(first, record());
        } finally {
            first.close();
        }
        const location = resolveCollectorStore(root);
        const bytesBefore = fs.readFileSync(location.path);

        const sqlite = loadSqliteSync('collector_store.test');
        const seeded = new sqlite.DatabaseSync(location.path);
        stampUserVersion(seeded, COLLECTOR_SCHEMA_VERSION + 7);
        seeded.close();
        const bytesAfterStamp = fs.readFileSync(location.path);

        const second = openCollectorStore(root);
        try {
            expect(second.quarantine_performed).toBe(true);
            // Not read: the quarantined store's records are not served.
            expect(readRecords(second)).toHaveLength(0);
            // Not written: a write is refused with the schema reason.
            expect(writeRecord(second, record({ sequence: 9 })).refusal).toBe(
                'schema-quarantined',
            );
        } finally {
            second.close();
        }

        // Preserved: the moved file still exists, and its bytes are the ones
        // the newer revision wrote — not a rewrite by this one.
        const quarantined = fs
            .readdirSync(path.join(location.root, QUARANTINE_DIR_NAME))
            .filter((n) => n.startsWith(COLLECTOR_FILE_NAME));
        expect(quarantined).toHaveLength(1);
        const preserved = fs.readFileSync(
            path.join(location.root, QUARANTINE_DIR_NAME, quarantined[0] as string),
        );
        expect(preserved.equals(bytesAfterStamp)).toBe(true);
        expect(preserved.equals(bytesBefore)).toBe(false);
    });

    // removing_this_constraint_reds_it: checking the migration marker AFTER
    // reading `user_version` instead of before it.
    it('TRANSITION 4 — a crash mid-migration quarantines rather than resuming', () => {
        const first = openCollectorStore(root);
        try {
            writeRecord(first, record());
        } finally {
            first.close();
        }
        const location = resolveCollectorStore(root);
        // Simulate the crash: a marker left behind by a migration that never
        // finished. The version stamp is deliberately left at the CURRENT value
        // — that is the trap, because a half-migrated store's stamp cannot be
        // trusted to say which half it is in.
        fs.writeFileSync(location.migrationMarker, '0 -> 1\n');

        const second = openCollectorStore(root);
        try {
            expect(second.quarantine_performed).toBe(false);
            // The half-migrated store was moved aside, so the fresh one is empty.
            expect(readRecords(second)).toHaveLength(0);
            // And usable again: recovery leaves a working store, not a wedge.
            expect(writeRecord(second, record({ sequence: 3 })).written).toBe(true);
        } finally {
            second.close();
        }
        expect(fs.existsSync(location.migrationMarker)).toBe(false);
        expect(
            fs.readdirSync(path.join(location.root, QUARANTINE_DIR_NAME)),
        ).toHaveLength(1);
    });

    it('TRANSITION 5 — uninstall removes the store and the markers, and KEEPS the quarantine', () => {
        // Get a quarantine on disk first, so the assertion has something to
        // preserve rather than trivially passing over an empty directory.
        const first = openCollectorStore(root);
        try {
            writeRecord(first, record());
        } finally {
            first.close();
        }
        const location = resolveCollectorStore(root);
        const sqlite = loadSqliteSync('collector_store.test');
        const seeded = new sqlite.DatabaseSync(location.path);
        stampUserVersion(seeded, COLLECTOR_SCHEMA_VERSION + 1);
        seeded.close();
        openCollectorStore(root).close();
        expect(fs.readdirSync(path.join(location.root, QUARANTINE_DIR_NAME))).toHaveLength(1);

        const removed = uninstall(root);
        expect(removed).toContain(location.path);
        expect(fs.existsSync(location.path)).toBe(false);
        // Evidence about an incompatible-schema event outlives uninstall.
        expect(fs.readdirSync(path.join(location.root, QUARANTINE_DIR_NAME))).toHaveLength(1);
    });

    // R2 finding 1 — this test used to assert `names.length >= 1` plus
    // `new Set(names).size === names.length`. The second is true of every
    // `readdirSync` result BY DEFINITION and the first accepts unbounded
    // growth, so it could not red even under accumulation; and its fixture
    // wrote a fresh record on the second round, so the same-bytes path may
    // never have been exercised at all. Both halves are fixed here: the store
    // is rebuilt to IDENTICAL bytes, and the assertion is an exact count.
    //
    // removing_this_constraint_reds_it: naming the quarantine target with a
    // timestamp instead of a content digest.
    it('R2-1 — quarantining IDENTICAL bytes twice leaves exactly one copy', () => {
        const location = resolveCollectorStore(root);
        const quarantineDir = path.join(location.root, QUARANTINE_DIR_NAME);
        let firstBytes: Buffer | null = null;

        for (let round = 0; round < 2; round++) {
            // Build a store, then overwrite it with the SAME bytes both rounds.
            if (firstBytes === null) {
                const handle = openCollectorStore(root);
                try {
                    writeRecord(handle, record());
                } finally {
                    handle.close();
                }
                const sqlite = loadSqliteSync('collector_store.test');
                const seeded = new sqlite.DatabaseSync(location.path);
                stampUserVersion(seeded, COLLECTOR_SCHEMA_VERSION + 1);
                seeded.close();
                firstBytes = fs.readFileSync(location.path);
            } else {
                fs.writeFileSync(location.path, firstBytes);
            }
            openCollectorStore(root).close();
        }

        // EXACTLY one, not "at least one": the digest name is what makes the
        // second quarantine of identical bytes idempotent.
        expect(fs.readdirSync(quarantineDir)).toHaveLength(1);
        // And it is the bytes, preserved.
        const only = fs.readdirSync(quarantineDir)[0] as string;
        expect(fs.readFileSync(path.join(quarantineDir, only)).equals(firstBytes as Buffer)).toBe(
            true,
        );
    });

    it('R2-1 — quarantining DIFFERENT bytes twice keeps both artefacts', () => {
        // The other direction, which the exact-count assertion above would
        // otherwise let a "delete the old one" implementation satisfy.
        const location = resolveCollectorStore(root);
        for (let round = 0; round < 2; round++) {
            const handle = openCollectorStore(root);
            try {
                writeRecord(handle, record({ sequence: round }));
            } finally {
                handle.close();
            }
            const sqlite = loadSqliteSync('collector_store.test');
            const seeded = new sqlite.DatabaseSync(location.path);
            stampUserVersion(seeded, COLLECTOR_SCHEMA_VERSION + 1);
            seeded.close();
            openCollectorStore(root).close();
        }
        expect(
            fs.readdirSync(path.join(location.root, QUARANTINE_DIR_NAME)),
        ).toHaveLength(2);
    });

    // R2 finding 4 — `quarantine_performed` is session-scoped, and "one-shot
    // signal" was indistinguishable from "durable refusal" because nothing
    // pinned the next open. This pins it.
    it('R2-4 — the quarantine signal is one-shot; the NEXT open writes normally', () => {
        const location = resolveCollectorStore(root);
        const handle = openCollectorStore(root);
        try {
            writeRecord(handle, record());
        } finally {
            handle.close();
        }
        const sqlite = loadSqliteSync('collector_store.test');
        const seeded = new sqlite.DatabaseSync(location.path);
        stampUserVersion(seeded, COLLECTOR_SCHEMA_VERSION + 3);
        seeded.close();

        const quarantining = openCollectorStore(root);
        try {
            expect(quarantining.quarantine_performed).toBe(true);
            expect(writeRecord(quarantining, record()).refusal).toBe('schema-quarantined');
        } finally {
            quarantining.close();
        }

        // Same on-disk state, next process: usable, and NOT reported as
        // quarantining. This is intended behaviour, now asserted rather than
        // left as an ambiguity in the code.
        const after = openCollectorStore(root);
        try {
            expect(after.quarantine_performed).toBe(false);
            expect(writeRecord(after, record()).written).toBe(true);
        } finally {
            after.close();
        }
    });

    // R2 finding 3 — a crash INSIDE crash-recovery left marker-present /
    // db-absent, the next open took the fresh-store branch and never cleared
    // the marker, and the open after that quarantined a healthy store.
    it('R2-3 — a marker with NO database is cleared, and no healthy store is evicted', () => {
        const location = resolveCollectorStore(root);
        fs.mkdirSync(location.root, { recursive: true });
        fs.writeFileSync(location.migrationMarker, '0 -> 1\n');
        expect(fs.existsSync(location.path)).toBe(false);

        // Open 1: fresh store, and the stale marker must not survive it.
        const first = openCollectorStore(root);
        try {
            expect(first.quarantine_performed).toBe(false);
            expect(writeRecord(first, record()).written).toBe(true);
        } finally {
            first.close();
        }
        expect(fs.existsSync(location.migrationMarker)).toBe(false);

        // Open 2: the healthy store from open 1 survives — the defect was that
        // it did not.
        const second = openCollectorStore(root);
        try {
            expect(second.quarantine_performed).toBe(false);
            expect(readRecords(second)).toHaveLength(1);
        } finally {
            second.close();
        }
        expect(fs.existsSync(path.join(location.root, QUARANTINE_DIR_NAME))).toBe(false);
    });

    // R2 finding 5 — `uninstall` left the OPT-OUT marker while its docstring
    // said "the markers". The behaviour is right and was unstated; both halves
    // are now asserted so a future edit cannot reconcile prose to code by
    // revoking a consent choice.
    it('R2-5 — uninstall removes the migration marker and KEEPS the opt-out marker', () => {
        const location = resolveCollectorStore(root);
        openCollectorStore(root).close();
        optOut(root);
        fs.writeFileSync(location.migrationMarker, 'x\n');

        const removed = uninstall(root);
        expect(removed).toContain(location.path);
        expect(removed).toContain(location.migrationMarker);
        expect(removed).not.toContain(location.optOutMarker);

        expect(fs.existsSync(location.migrationMarker)).toBe(false);
        // The load-bearing half: reinstalling must not silently revoke consent.
        expect(fs.existsSync(location.optOutMarker)).toBe(true);
        expect(isOptedOut(root)).toBe(true);
    });

    // R2 finding 6 — sidecars were DELETED, so a WAL-mode store's preserved
    // artefact would be missing committed data while the main file's
    // byte-equality assertion stayed green.
    // R2 finding 6 — sidecars were DELETED, so a WAL-mode store's preserved
    // artefact would be missing committed data while the main file's
    // byte-equality assertion stayed green. Fixed to a MOVE.
    //
    // MEASURED WHILE WRITING THIS TEST, and it changes the finding's status
    // rather than confirming it: the scenario is **not reachable through
    // `openCollectorStore`**. That function opens the database before reading
    // its version, and opening it removes an unrecognised `-wal` (and a real
    // WAL-mode close checkpoints its contents into the main file), so by the
    // time `quarantine()` runs there is no sidecar left to lose. The first
    // version of this test asserted the end-to-end path and went red for that
    // reason, not for the finding's.
    //
    // So the assertion is on `quarantine()` DIRECTLY: the function is the unit
    // that owns the behaviour, the fix is real where it is reachable, and the
    // unreachability is recorded instead of dressed up as coverage.
    it('R2-6 — quarantine() MOVES a present sidecar instead of deleting it', () => {
        const location = resolveCollectorStore(root);
        const handle = openCollectorStore(root);
        try {
            writeRecord(handle, record());
        } finally {
            handle.close();
        }
        fs.writeFileSync(`${location.path}-wal`, 'sidecar-payload');
        expect(fs.existsSync(`${location.path}-wal`)).toBe(true);

        const target = quarantine(location);

        expect(fs.existsSync(`${target}-wal`), 'the -wal sidecar was not preserved').toBe(true);
        expect(fs.readFileSync(`${target}-wal`, 'utf8')).toBe('sidecar-payload');
        // And the original is gone — moved, not copied.
        expect(fs.existsSync(`${location.path}-wal`)).toBe(false);
    });

    it('R2-6 — opening the store removes a stray sidecar, which is WHY the path above is unreachable end to end', () => {
        // The measurement that demoted finding 6 from a live defect to a
        // correctly-fixed unreachable one. Pinned so a future reader does not
        // re-derive it, and so enabling WAL later reds this test and re-opens
        // the question deliberately.
        const location = resolveCollectorStore(root);
        openCollectorStore(root).close();
        fs.writeFileSync(`${location.path}-wal`, 'sidecar-payload');

        openCollectorStore(root).close();

        expect(fs.existsSync(`${location.path}-wal`)).toBe(false);
    });
});

// R2 finding 2 — the migration ladder, tested as a pure function so the
// mechanism is falsifiable without seeding a database per hypothesis. The
// previous implementation had no ladder at all: `db.exec(SCHEMA)` is
// `CREATE TABLE IF NOT EXISTS`, a no-op on an existing table of any shape, and
// the whole migration was a version stamp its test could not detect.
describe('R2-2 — the migration ladder', () => {
    it('resolves the one registered step', () => {
        expect(migrationPath(0, 1)).toEqual([0]);
        expect(Object.keys(MIGRATIONS)).toEqual(['0']);
    });

    it('is a no-op walk when already current', () => {
        expect(migrationPath(1, 1)).toEqual([]);
    });

    it('REFUSES a newer store rather than downgrading it', () => {
        expect(migrationPath(2, 1)).toBeNull();
        expect(migrationPath(99, 1)).toBeNull();
    });

    // The finding's core: a version with no registered path must REFUSE, not
    // stamp. `migrationPath(0, 3)` needs steps 1 and 2, which do not exist.
    it('REFUSES when a step in the middle of the walk is unregistered', () => {
        expect(migrationPath(0, 3)).toBeNull();
        expect(migrationPath(1, 2)).toBeNull();
    });
});

withSqlite('R2-2 — an unmigratable store is quarantined, not stamped forward', () => {
    it('quarantines a store whose version has no registered path', () => {
        const location = resolveCollectorStore(root);
        const handle = openCollectorStore(root);
        try {
            writeRecord(handle, record());
        } finally {
            handle.close();
        }
        // A version ABOVE current has no path, which is transition 3; a version
        // below current with a gap is the case the ladder adds. With one
        // registered step the reachable gap case is a NEWER store, so the
        // pure-function tests above carry the gap direction and this one carries
        // the end-to-end refusal.
        const sqlite = loadSqliteSync('collector_store.test');
        const seeded = new sqlite.DatabaseSync(location.path);
        stampUserVersion(seeded, COLLECTOR_SCHEMA_VERSION + 5);
        seeded.close();

        const after = openCollectorStore(root);
        try {
            expect(after.quarantine_performed).toBe(true);
            // NOT stamped forward over the old shape: the old file is preserved
            // and a fresh store was created beside it.
            expect(readRecords(after)).toHaveLength(0);
        } finally {
            after.close();
        }
        expect(
            fs.readdirSync(path.join(location.root, QUARANTINE_DIR_NAME)),
        ).toHaveLength(1);
    });
});

// R2 finding 8 — an append-only table with no TTL, pruning job, partition
// rotation or archive path is an R-A7 violation, and this module reasoned about
// R-A7 for the neighbouring quarantine DIRECTORY while leaving the table that
// actually grows per event unbudgeted.
withSqlite('R2-8 — retention is declared and the pruning job runs', () => {
    it('declares a retention policy tied to the metric definition’s hard stop', () => {
        expect(RETENTION_DAYS).toBe(63);
    });

    it('drops records past the retention boundary and keeps the rest', () => {
        const handle = openCollectorStore(root);
        try {
            writeRecord(handle, record({ occurred_on: '2026-01-01', sequence: 0 }));
            writeRecord(handle, record({ occurred_on: '2026-08-01', sequence: 1 }));
            writeRecord(handle, record({ occurred_on: '2026-08-29', sequence: 2 }));

            // 63 days before 2026-08-29 is 2026-06-27.
            expect(pruneOlderThan(handle, '2026-08-29')).toBe(1);
            expect(readRecords(handle).map((r) => r.occurred_on)).toEqual([
                '2026-08-01',
                '2026-08-29',
            ]);
        } finally {
            handle.close();
        }
    });

    it('is a no-op when nothing is past the boundary', () => {
        const handle = openCollectorStore(root);
        try {
            writeRecord(handle, record({ occurred_on: '2026-08-29' }));
            expect(pruneOlderThan(handle, '2026-08-29')).toBe(0);
            expect(readRecords(handle)).toHaveLength(1);
        } finally {
            handle.close();
        }
    });
});

withSqlite('dedup happens at READ time, and the duplicate stays observable', () => {
    // Metric item 4 has two halves and they pull in opposite directions: a
    // repeated key must be ONE record, AND the duplicate must be "observable as
    // a defect rather than silently collapsed". A PRIMARY KEY plus
    // `INSERT OR REPLACE` satisfies the first by violating the second, so these
    // tests assert BOTH — the read collapses, the store still knows.
    //
    // removing_this_constraint_reds_it: putting `PRIMARY KEY` back on
    // `dedup_key` and writing with `INSERT OR REPLACE`.
    it('collapses a repeated key on read while both rows stay on disk', () => {
        const handle = openCollectorStore(root);
        try {
            expect(writeRecord(handle, record()).written).toBe(true);
            expect(writeRecord(handle, record()).written).toBe(true);

            // Collapsed for every reader…
            expect(readRecords(handle)).toHaveLength(1);
            expect(readRecords(handle, MACHINE_A)).toHaveLength(1);

            // …and NOT collapsed on disk, which is the observability half.
            expect(readSummary(handle)).toEqual({ rows: 2, unique: 1, duplicates: 1 });
            expect(
                handle.db.prepare('SELECT COUNT(*) AS n FROM collector_events').get(),
            ).toMatchObject({ n: 2 });
        } finally {
            handle.close();
        }
    });

    it('reports zero duplicates when every key is distinct', () => {
        const handle = openCollectorStore(root);
        try {
            for (let sequence = 0; sequence < 3; sequence++) {
                writeRecord(handle, record({ sequence }));
            }
            expect(readSummary(handle)).toEqual({ rows: 3, unique: 3, duplicates: 0 });
        } finally {
            handle.close();
        }
    });

    it('keeps the FIRST occurrence, not the last', () => {
        // Insertion order decides, so a retry cannot silently rewrite the
        // record a reader already saw.
        const handle = openCollectorStore(root);
        try {
            writeRecord(handle, record({ outcome: 'captured' }));
            writeRecord(handle, record({ outcome: 'write_failure' }));
            expect(readRecords(handle)[0]?.outcome).toBe('captured');
            expect(readSummary(handle).duplicates).toBe(1);
        } finally {
            handle.close();
        }
    });

    it('deleteMachine removes ROWS, duplicates included', () => {
        const handle = openCollectorStore(root);
        try {
            writeRecord(handle, record());
            writeRecord(handle, record());
            // Two rows, one deduplicated record — the count must be 2, or a
            // caller cannot tell whether the duplicate went with it.
            expect(deleteMachine(handle, MACHINE_A)).toBe(2);
            expect(readSummary(handle)).toEqual({ rows: 0, unique: 0, duplicates: 0 });
        } finally {
            handle.close();
        }
    });
});
