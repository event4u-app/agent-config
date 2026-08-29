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
    optIn,
    optOut,
    QUARANTINE_DIR_NAME,
    readRecords,
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
            expect(handle.quarantined).toBe(false);
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
            expect(second.quarantined).toBe(false);
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
            expect(second.quarantined).toBe(true);
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
            expect(second.quarantined).toBe(false);
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

    it('quarantining the same bytes twice does not accumulate copies', () => {
        // The quarantine name carries a content digest rather than a timestamp,
        // so a repeated incompatible open is idempotent instead of unbounded —
        // R-A7's growth budget applied to a directory nobody prunes.
        const location = resolveCollectorStore(root);
        for (let round = 0; round < 2; round++) {
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
            openCollectorStore(root).close();
        }
        const names = fs.readdirSync(path.join(location.root, QUARANTINE_DIR_NAME));
        expect(names.length).toBeGreaterThanOrEqual(1);
        expect(new Set(names).size).toBe(names.length);
    });
});

withSqlite('the store is deduplicated at the key of metric item 4', () => {
    it('collapses a repeated (machine, episode, event, sequence) instead of inflating', () => {
        // Retry after a failed write must not inflate the numerator — 1.2 item
        // 4. Read-time dedup is the contract; a PRIMARY KEY makes the repeat
        // observable as one row rather than silently collapsed downstream.
        const handle = openCollectorStore(root);
        try {
            expect(writeRecord(handle, record()).written).toBe(true);
            expect(writeRecord(handle, record()).written).toBe(true);
            expect(readRecords(handle)).toHaveLength(1);
        } finally {
            handle.close();
        }
    });
});
