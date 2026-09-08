/**
 * Continuity-record slot — capacity policy and interruption safety
 * (`road-to-continuity-writer-activation` step 1.1).
 *
 * Acceptance fixtures pinned here, one per clause of
 * `docs/contracts/continuity-record-slot.md`:
 *
 *   - an interruption BEFORE the atomic rename leaves no partial authoritative
 *     record, and leaves any previous record intact;
 *   - an interruption AFTER the rename leaves a complete, parseable record;
 *   - a retry over an occupied slot neither overwrites nor destroys a FOREIGN
 *     unconsumed record;
 *   - a retry over this session's OWN record supersedes it, and never rolls the
 *     slot back to an earlier `written_at`;
 *   - an unusable resident is moved aside, never deleted, and never onto the
 *     consumed name.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    inspectSlot,
    publishContinuityRecord,
    SLOT_STATES,
} from '../../src/scripts/_lib/continuity_slot.js';
import {
    listContinuityRecords,
    recycle_consumed_rel,
    recycle_envelope_rel,
    recycle_quarantine_rel,
    resolveContinuityRecord,
} from '../../src/scripts/_lib/recycle_envelope_paths.js';
import { CAPSULE_SCHEMA_VERSION } from '../../src/scripts/_lib/subagent_capsule.js';

const SID = 'sess-alpha';
const OTHER = 'sess-beta';

function scratchRoot(): string {
    return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'continuity-slot-')));
}

/** The minimal valid `continuity_record` — every field computable from disk. */
function record(
    root: string,
    writtenAt: string,
    extra: Record<string, unknown> = {},
): Record<string, unknown> {
    return {
        capsule_version: CAPSULE_SCHEMA_VERSION,
        variant: 'continuity_record',
        summary: 'road-to-example: 3 of 9 steps closed',
        task: 'road-to-example',
        workspace: root,
        written_at: writtenAt,
        acceptance_criteria: ['AC-1 — the gate is wired'],
        remaining: ['4.2 ratchet'],
        predecessor: 'none',
        ...extra,
    };
}

function seed(root: string, sessionId: string, body: unknown): string {
    const target = path.join(root, recycle_envelope_rel(sessionId));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, typeof body === 'string' ? body : JSON.stringify(body, null, 2));
    return target;
}

describe('slot states', () => {
    it('declares the six states the contract names', () => {
        expect([...SLOT_STATES]).toEqual([
            'absent',
            'published',
            'consuming',
            'consumed',
            'quarantined',
            'conflicting',
        ]);
    });

    it('reads an empty workspace as absent', () => {
        const root = scratchRoot();
        expect(inspectSlot(root, SID).state).toBe('absent');
    });

    it('reads a consumed sibling as consumed, not absent', () => {
        const root = scratchRoot();
        const consumed = path.join(root, recycle_consumed_rel(SID));
        fs.mkdirSync(path.dirname(consumed), { recursive: true });
        fs.writeFileSync(consumed, JSON.stringify(record(root, new Date().toISOString())));
        expect(inspectSlot(root, SID).state).toBe('consumed');
    });

    it('reads a fresh own record as published and a foreign one as conflicting', () => {
        const root = scratchRoot();
        const now = new Date();
        seed(root, SID, record(root, now.toISOString(), { session_id: SID }));
        expect(inspectSlot(root, SID, now).state).toBe('published');

        const other = scratchRoot();
        seed(other, SID, record(other, now.toISOString(), { session_id: OTHER }));
        const found = inspectSlot(other, SID, now);
        expect(found.state).toBe('conflicting');
        expect(found.reason).toContain(OTHER);
    });

    it('reads an expired record as quarantined rather than published', () => {
        const root = scratchRoot();
        const now = new Date('2026-09-08T12:00:00.000Z');
        const old = new Date(now.getTime() - 49 * 3600 * 1000).toISOString();
        seed(root, SID, record(root, old, { session_id: SID }));
        expect(inspectSlot(root, SID, now).state).toBe('quarantined');
    });
});

describe('interruption at the atomic rename', () => {
    /**
     * What these three fixtures prove, and what they cannot.
     *
     * A SIGKILL between the adapter's `writeFileSync` and its `renameSync` is
     * not reproducible in-process, so the boundary is exercised with a real
     * injected I/O failure on each side of it rather than with a signal. That
     * is weaker than a kill in one respect only — it does not prove the kernel
     * makes the rename atomic, which is a platform guarantee this package
     * documents in `state_io.ts` rather than re-tests here. It is exactly as
     * strong on the property the step asks about: whether an interrupted
     * publish can leave a partial record under the AUTHORITATIVE name.
     */

    /** The adapter's temp name, from `state_io._publish_text_locked`. */
    function tempName(target: string): string {
        return `${target}.tmp.${process.pid}`;
    }

    it('leaves no authoritative record when the write fails BEFORE the rename', () => {
        const root = scratchRoot();
        const target = path.join(root, recycle_envelope_rel(SID));
        // A directory where the adapter must put its temp file: the write
        // throws EISDIR, so the publish dies before any rename is attempted.
        fs.mkdirSync(tempName(target), { recursive: true });

        const out = publishContinuityRecord(root, SID, record(root, new Date().toISOString()));

        expect(out.wrote).toBe(false);
        expect(fs.existsSync(target)).toBe(false);
        expect(inspectSlot(root, SID).state).toBe('absent');
    });

    it('leaves the PREVIOUS record intact when the write fails before the rename', () => {
        const root = scratchRoot();
        const now = new Date();
        const earlier = new Date(now.getTime() - 60_000).toISOString();
        const target = seed(root, SID, record(root, earlier, { session_id: SID }));
        fs.mkdirSync(tempName(target), { recursive: true });

        const out = publishContinuityRecord(
            root,
            SID,
            record(root, now.toISOString(), { session_id: SID }),
            now,
        );

        expect(out.wrote).toBe(false);
        const resident = JSON.parse(fs.readFileSync(target, 'utf-8')) as Record<string, unknown>;
        expect(resident['written_at']).toBe(earlier);
        expect(inspectSlot(root, SID, now).state).toBe('published');
    });

    it('cannot expose a partial record, because a partial one never carries the authoritative name', () => {
        const root = scratchRoot();
        const target = path.join(root, recycle_envelope_rel(SID));
        fs.mkdirSync(path.dirname(target), { recursive: true });
        // Exactly what a kill mid-`writeFileSync` leaves behind: a prefix of
        // the payload, at the adapter's temp name.
        fs.writeFileSync(tempName(target), '{"capsule_version": 4, "vari');

        expect(inspectSlot(root, SID).state).toBe('absent');
        expect(listContinuityRecords(root)).toEqual([]);
        expect(resolveContinuityRecord(root, SID).file).toBeNull();
    });

    it('leaves a complete parseable record when the rename completes', () => {
        const root = scratchRoot();
        const now = new Date();
        const out = publishContinuityRecord(
            root,
            SID,
            record(root, now.toISOString(), { session_id: SID }),
            now,
        );
        expect(out.wrote).toBe(true);
        expect(out.state).toBe('published');

        const target = path.join(root, recycle_envelope_rel(SID));
        const parsed = JSON.parse(fs.readFileSync(target, 'utf-8')) as Record<string, unknown>;
        expect(parsed['variant']).toBe('continuity_record');
        expect(parsed['written_at']).toBe(now.toISOString());
        expect(inspectSlot(root, SID, now).state).toBe('published');
        expect(resolveContinuityRecord(root, SID).file).toBe(target);

        // No temp litter survives a completed publish.
        expect(fs.readdirSync(path.dirname(target)).filter((n) => n.includes('.tmp.'))).toEqual([]);
    });
});

describe('retry over an occupied slot', () => {
    it('neither overwrites nor destroys a FOREIGN unconsumed record', () => {
        const root = scratchRoot();
        const now = new Date();
        const foreign = record(root, now.toISOString(), { session_id: OTHER });
        const target = seed(root, SID, foreign);
        const before = fs.readFileSync(target, 'utf-8');

        const out = publishContinuityRecord(
            root,
            SID,
            record(root, now.toISOString(), { session_id: SID }),
            now,
        );

        expect(out.wrote).toBe(false);
        expect(out.state).toBe('conflicting');
        expect(fs.readFileSync(target, 'utf-8')).toBe(before);
        expect(fs.existsSync(path.join(root, recycle_quarantine_rel(SID)))).toBe(false);
        expect(fs.existsSync(path.join(root, recycle_consumed_rel(SID)))).toBe(false);
    });

    it('supersedes this session’s own earlier record', () => {
        const root = scratchRoot();
        const now = new Date();
        const earlier = new Date(now.getTime() - 60_000).toISOString();
        const target = seed(root, SID, record(root, earlier, { session_id: SID }));

        const out = publishContinuityRecord(
            root,
            SID,
            record(root, now.toISOString(), { session_id: SID }),
            now,
        );

        expect(out.wrote).toBe(true);
        expect(out.reason).toContain('superseded');
        const parsed = JSON.parse(fs.readFileSync(target, 'utf-8')) as Record<string, unknown>;
        expect(parsed['written_at']).toBe(now.toISOString());
    });

    it('never rolls the slot back to an earlier written_at', () => {
        const root = scratchRoot();
        const now = new Date();
        const earlier = new Date(now.getTime() - 60_000).toISOString();
        const target = seed(root, SID, record(root, now.toISOString(), { session_id: SID }));

        const out = publishContinuityRecord(
            root,
            SID,
            record(root, earlier, { session_id: SID }),
            now,
        );

        expect(out.wrote).toBe(false);
        expect(out.reason).toContain('newer');
        const parsed = JSON.parse(fs.readFileSync(target, 'utf-8')) as Record<string, unknown>;
        expect(parsed['written_at']).toBe(now.toISOString());
    });
});

describe('unusable residents are quarantined, never deleted', () => {
    it('moves an unparseable resident aside and then publishes', () => {
        const root = scratchRoot();
        const now = new Date();
        seed(root, SID, '{ this is not json');

        const out = publishContinuityRecord(
            root,
            SID,
            record(root, now.toISOString(), { session_id: SID }),
            now,
        );

        expect(out.wrote).toBe(true);
        const quarantined = path.join(root, recycle_quarantine_rel(SID));
        expect(out.quarantined).toBe(quarantined);
        expect(fs.readFileSync(quarantined, 'utf-8')).toBe('{ this is not json');

        // Quarantine is NOT the consumed name — that would manufacture a
        // predecessor trace for a record nobody read.
        expect(fs.existsSync(path.join(root, recycle_consumed_rel(SID)))).toBe(false);
    });

    it('moves an expired resident aside and then publishes', () => {
        const root = scratchRoot();
        const now = new Date('2026-09-08T12:00:00.000Z');
        const old = new Date(now.getTime() - 49 * 3600 * 1000).toISOString();
        seed(root, SID, record(root, old, { session_id: SID }));

        const out = publishContinuityRecord(
            root,
            SID,
            record(root, now.toISOString(), { session_id: SID }),
            now,
        );

        expect(out.wrote).toBe(true);
        const parsed = JSON.parse(
            fs.readFileSync(path.join(root, recycle_quarantine_rel(SID)), 'utf-8'),
        ) as Record<string, unknown>;
        expect(parsed['written_at']).toBe(old);
    });
});

describe('the record offered is validated before anything is touched', () => {
    it('refuses a record carrying a key the variant forbids', () => {
        const root = scratchRoot();
        const now = new Date();
        const out = publishContinuityRecord(
            root,
            SID,
            record(root, now.toISOString(), { status_summary: 'clean' }),
            now,
        );
        expect(out.wrote).toBe(false);
        expect(out.reason).toContain('validation');
        expect(fs.existsSync(path.join(root, recycle_envelope_rel(SID)))).toBe(false);
    });
});
