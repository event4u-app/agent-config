/**
 * road-to-one-continuity-record Phase 2.1 / 2.3 — the continuity record is
 * keyed by SESSION, not by workspace, so two sessions in one checkout cannot
 * overwrite each other.
 *
 * The write-side defect this pins is not hypothetical and not new: the session
 * register in the same tree models several live sessions per checkout, while
 * the continuity artifact was one file per checkout. Two sessions in one
 * worktree overwrote each other and each resumed from whichever wrote last.
 * `roadmap_claim_rel` was repaired for exactly this, after four live records
 * were observed carrying one identical slug. That half is unchanged: the key
 * still makes the write collision-free, and those tests still hold.
 *
 * THE READ SIDE WAS REVERSED on 2026-09-09
 * (`road-to-a-recycle-envelope-that-is-consumed`), and this file is where the
 * old rule was written down as the contract. It asserted that "each session
 * reads its OWN record" — which is a loop, not a resume. A record is written
 * by a session FOR ITS SUCCESSOR, and the successor by definition has a
 * different id, so a resolver keyed on the reader's own id could never find
 * anything. It resolved `null` in production for weeks while every test here
 * passed, because every test read under the id it had just written.
 *
 * What replaces it: `resolveContinuityRecord` admits the unique record that is
 * NOT the reader's own. Peer isolation therefore no longer comes from the
 * filename — it comes from the branch-match gate in `handoff_context_hook`,
 * which is tested against real git trees in
 * `recycle_envelope_consumer.test.ts` and `recycle_resume_e2e.test.ts`. The
 * fixtures here have no git, so that gate is deliberately inert and a
 * same-tree peer IS resolved; that is the shape the council accepted, with the
 * branch gate as the isolation mechanism rather than the key.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    listContinuityRecords,
    recycle_envelope_rel,
    resolveContinuityRecord,
} from '../../src/scripts/_lib/recycle_envelope_paths.js';
import { consume_recycle_envelope } from '../../src/scripts/handoff_context_hook.js';
import { CAPSULE_SCHEMA_VERSION } from '../../src/scripts/_lib/subagent_capsule.js';

let root: string;

beforeEach(() => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'continuity-key-')));
    fs.mkdirSync(path.join(root, 'agents', 'runtime', 'state'), { recursive: true });
});

afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

function record(over: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        capsule_version: CAPSULE_SCHEMA_VERSION,
        variant: 'main_session',
        summary: 'a session that did some work',
        task: 'the active task',
        workspace: root,
        written_at: new Date().toISOString(),
        acceptance_criteria: ['the thing is done'],
        remaining: [],
        not_carried_forward: ['everything not listed'],
        failed_approaches: ['none'],
        successful_approaches: ['none'],
        predecessor: 'none',
        ...over,
    };
}

function write(sessionId: string | null, over: Record<string, unknown> = {}): string {
    const target = path.join(root, recycle_envelope_rel(sessionId));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const identity = sessionId === null ? {} : { session_id: sessionId };
    fs.writeFileSync(target, JSON.stringify(record({ ...identity, ...over })));
    return target;
}

describe('the record is keyed by session', () => {
    it('two sessions in one checkout each write their own record — neither overwrites the other', () => {
        const a = write('session-a', { summary: 'A did A-work' });
        const b = write('session-b', { summary: 'B did B-work' });

        expect(a).not.toBe(b);
        expect(fs.existsSync(a)).toBe(true);
        expect(fs.existsSync(b)).toBe(true);
        expect(listContinuityRecords(root)).toHaveLength(2);
    });

    it('a session is never handed its OWN record back — that is a loop, not a resume', () => {
        write('session-a', { summary: 'A did A-work' });

        const forA = consume_recycle_envelope(root, new Date(), 'session-a');
        expect(forA.action).toBe('absent');
        // And it is left on disk for the session it was actually written for.
        expect(listContinuityRecords(root)).toHaveLength(1);
    });

    it('a successor reads the predecessor record, which is the whole point of writing one', () => {
        write('session-a', { summary: 'A did A-work' });

        const forB = consume_recycle_envelope(root, new Date(), 'session-b');
        expect(forB.action).toBe('inject');
        expect(forB.context).toContain('A did A-work');
        // Consume-once: moved, not copied, so a third session finds nothing.
        expect(listContinuityRecords(root)).toEqual([]);
        expect(consume_recycle_envelope(root, new Date(), 'session-c').action).toBe('absent');
    });

    it('two records and a third reader start clean rather than picking one', () => {
        write('session-a', { summary: 'A did A-work' });
        write('session-b', { summary: 'B did B-work' });

        const forC = consume_recycle_envelope(root, new Date(), 'session-c');
        expect(forC.action).toBe('absent');
        expect(forC.reason).toContain('starting clean');
        // Neither is eaten by the refusal.
        expect(listContinuityRecords(root)).toHaveLength(2);
    });

    it('a reader with no candidate but its own says so, naming its own id', () => {
        write('session-a');
        const forA = consume_recycle_envelope(root, new Date(), 'session-a');
        expect(forA.action).toBe('absent');
        expect(forA.reason).toContain('session-a');
        expect(forA.reason).toContain('no predecessor record');
    });

    it('names no "latest" file — resolution is by identity, never by recency', () => {
        write('session-a');
        write('session-b');
        const names = fs.readdirSync(path.join(root, 'agents', 'runtime', 'state'));
        expect(names.some((n) => /latest|current|newest/i.test(n))).toBe(false);
    });
});

describe('ambiguity ends in a clean start, with the reason said out loud', () => {
    it('refuses to pick when there is no session id and several records', () => {
        write('session-a');
        write('session-b');
        const resolved = resolveContinuityRecord(root, null);
        expect(resolved.file).toBeNull();
        expect(resolved.reason).toContain('starting clean');
        expect(resolved.reason).toContain('2');

        const decision = consume_recycle_envelope(root, new Date(), null);
        expect(decision.action).toBe('absent');
        expect(decision.reason).toContain('starting clean');
        // Nothing was consumed — a "clean start" that ate a record would leave
        // the next session with less than it had.
        expect(listContinuityRecords(root)).toHaveLength(2);
    });

    it('still reads the one record when there is exactly one and no id', () => {
        write(null);
        const decision = consume_recycle_envelope(root, new Date(), null);
        expect(decision.action).toBe('inject');
    });
});

describe('the predecessor edge', () => {
    /**
     * `predecessor` is a field of the RECORD — it names the producer's own
     * predecessor, so the chain can be audited. It is read here from the
     * successor's seat, which is the only seat that reads a record at all.
     */
    it('accepts an explicit none — a first session states its absence', () => {
        write('session-a', { predecessor: 'none' });
        expect(consume_recycle_envelope(root, new Date(), 'session-b').action).toBe('inject');
    });

    it('refuses a NAMED predecessor with no trace, rather than resolving to something else', () => {
        write('session-a', { predecessor: 'session-that-never-existed' });
        const decision = consume_recycle_envelope(root, new Date(), 'session-b');
        expect(decision.action).toBe('discard');
        expect(decision.reason).toContain('session-that-never-existed');
        expect(decision.reason).toContain('no trace');
    });

    it('accepts a named predecessor whose consumed record is still on disk', () => {
        // The grandparent's record, already consumed by the producer at ITS start.
        const consumed = path.join(
            root,
            'agents',
            'runtime',
            'state',
            'recycle-envelope-session-zero.consumed.json',
        );
        fs.writeFileSync(consumed, JSON.stringify(record({ session_id: 'session-zero' })));
        write('session-a', { predecessor: 'session-zero' });
        expect(consume_recycle_envelope(root, new Date(), 'session-b').action).toBe('inject');
    });
});
