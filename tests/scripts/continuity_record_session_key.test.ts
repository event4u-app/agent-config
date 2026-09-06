/**
 * road-to-one-continuity-record Phase 2.1 / 2.3 — the continuity record is
 * keyed by SESSION, not by workspace, and the reader never guesses which one
 * is its own.
 *
 * The defect this pins is not hypothetical and not new: the session register in
 * the same tree models several live sessions per checkout, while the continuity
 * artifact was one file per checkout. Two sessions in one worktree overwrote
 * each other and each resumed from whichever wrote last. `roadmap_claim_rel`
 * was repaired for exactly this, after four live records were observed carrying
 * one identical slug.
 *
 * Every test here would pass against a single-session implementation EXCEPT the
 * ones that run two sessions and the ambiguity arm — which is why those exist
 * and why the file is named for the key rather than for the record.
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

    it('each session reads its OWN record and never observes the other', () => {
        write('session-a', { summary: 'A did A-work' });
        write('session-b', { summary: 'B did B-work' });

        const forA = consume_recycle_envelope(root, new Date(), 'session-a');
        expect(forA.action).toBe('inject');
        expect(forA.context).toContain('A did A-work');
        expect(forA.context).not.toContain('B did B-work');

        // B's record is untouched by A's consume — a consume-once that consumed
        // the wrong file would show up here as B finding nothing.
        const forB = consume_recycle_envelope(root, new Date(), 'session-b');
        expect(forB.action).toBe('inject');
        expect(forB.context).toContain('B did B-work');
        expect(forB.context).not.toContain('A did A-work');
    });

    it('a session with no record of its own starts clean rather than reading a peer', () => {
        write('session-a');
        const forC = consume_recycle_envelope(root, new Date(), 'session-c');
        expect(forC.action).toBe('absent');
        expect(forC.reason).toContain('session-c');
        // and A's record is still there — nothing was consumed on C's behalf
        expect(listContinuityRecords(root)).toHaveLength(1);
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
    it('accepts an explicit none — a first session states its absence', () => {
        write('session-a', { predecessor: 'none' });
        expect(consume_recycle_envelope(root, new Date(), 'session-a').action).toBe('inject');
    });

    it('refuses a NAMED predecessor with no trace, rather than resolving to something else', () => {
        write('session-b', { predecessor: 'session-that-never-existed' });
        const decision = consume_recycle_envelope(root, new Date(), 'session-b');
        expect(decision.action).toBe('discard');
        expect(decision.reason).toContain('session-that-never-existed');
        expect(decision.reason).toContain('no trace');
    });

    it('accepts a named predecessor whose consumed record is still on disk', () => {
        // The predecessor's record, already consumed by this session at start.
        const consumed = path.join(
            root,
            'agents',
            'runtime',
            'state',
            'recycle-envelope-session-b.consumed.json',
        );
        fs.writeFileSync(consumed, JSON.stringify(record({ session_id: 'session-a' })));
        write('session-b', { predecessor: 'session-a' });
        expect(consume_recycle_envelope(root, new Date(), 'session-b').action).toBe('inject');
    });
});
