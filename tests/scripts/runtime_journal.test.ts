// The runtime event journal — record shape, vocabulary coverage, boundary
// derivation, retention, and end-to-end episode reconstruction.
//
// `road-to-runtime-event-journal` Phases 1 and 2 (AC-1, AC-2, AC-4). The
// concurrency half (1.3 / AC-3) and the identity half (2.3 — `repository_id`
// and `worktree_id`) need real processes and real worktrees and live in their
// own files.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { EVENT_VOCABULARY } from '../../src/scripts/hooks/dispatch_hook.js';
import { NON_SUCCESS_STATES } from '../../src/scripts/_lib/outcome_envelope.js';
import type { TerminalState } from '../../src/scripts/_lib/outcome_envelope.js';
import { repeatedFailureRate } from '../../src/scripts/_lib/repeated_failure.js';
import {
    BOUNDARY_RULE_VERSION,
    CONSUMPTION_STATES,
    createHold,
    deriveBoundary,
    effectiveExpiry,
    episodeAnchor,
    FREE_FORM_KEYS,
    isAgentActor,
    isJournalAvailable,
    isRepoRelativeRef,
    JOURNAL_RECORD_KEYS,
    JournalContractError,
    NOT_RECORDED,
    openJournal,
    partitionGaps,
    pruneExpired,
    readRetention,
    RECONSTRUCTION_NULLABLE_FIELDS,
    RECORDED_EVENTS,
    reconstructEpisode,
    recordEvent,
    releaseHold,
    RETENTION_TTL_DAYS,
    resolveJournal,
    TERMINAL_STATES,
    type JournalHandle,
} from '../../src/scripts/_lib/runtime_journal.js';

const MODULE_SRC = path.join(
    path.dirname(new URL(import.meta.url).pathname),
    '..',
    '..',
    'src',
    'scripts',
    '_lib',
    'runtime_journal.ts',
);

const sqliteOk = isJournalAvailable();

const DAY_MS = 24 * 60 * 60 * 1000;
const T0 = '2026-08-01T10:00:00.000Z';
const plusDays = (from: string, d: number): string => new Date(Date.parse(from) + d * DAY_MS).toISOString();

let tmp: string;
let h: JournalHandle;

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rt-journal-'));
    if (sqliteOk) h = openJournal(tmp);
});

afterEach(() => {
    try {
        h?.close();
    } catch {
        /* best-effort */
    }
    fs.rmSync(tmp, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// AC-1 — vocabulary coverage
// ---------------------------------------------------------------------------

describe('event vocabulary coverage (AC-1)', () => {
    it('the vocabulary still has exactly ten members', () => {
        // Pinned because the roadmap corrects a source claim of nine. A journal
        // sized to the wrong number drops an event on day one.
        expect(EVENT_VOCABULARY.size).toBe(10);
    });

    it('every member is either recorded or explicitly not-recorded with a reason', () => {
        const gaps = partitionGaps(EVENT_VOCABULARY);
        expect(gaps.uncovered).toEqual([]);
        expect(gaps.doubleClaimed).toEqual([]);
        expect(gaps.unreasoned).toEqual([]);
    });

    it('an eleventh vocabulary member fails the partition rather than being missed', () => {
        // This is the sensitivity of the test above, exercised directly: adding
        // a member without placing it in one set or the other must be a gap.
        const gaps = partitionGaps([...EVENT_VOCABULARY, 'tool_denied']);
        expect(gaps.uncovered).toEqual(['tool_denied']);
    });

    it('a not-recorded entry with an empty reason is a gap, because silence is not coverage', () => {
        const gaps = partitionGaps(['ghost_event'], new Set<string>(), new Map([['ghost_event', '   ']]));
        expect(gaps.unreasoned).toEqual(['ghost_event']);
    });

    it('a member claimed by both sets is a gap too', () => {
        const gaps = partitionGaps(['stop'], new Set(['stop']), new Map([['stop', 'a reason']]));
        expect(gaps.doubleClaimed).toEqual(['stop']);
    });

    it('the recorded set and the vocabulary agree exactly', () => {
        expect([...RECORDED_EVENTS].sort()).toEqual([...EVENT_VOCABULARY].sort());
        expect(NOT_RECORDED.size).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// AC-2 — the committed key set and the free-form exclusion
// ---------------------------------------------------------------------------

describe.runIf(sqliteOk)('record shape (AC-2)', () => {
    it('a written record carries exactly the committed key set', () => {
        const rec = recordEvent(h, {
            event: 'stop',
            session_id: 'sess-1',
            capability: 'dispatch_hook',
            at: T0,
        });
        expect(Object.keys(rec).sort()).toEqual([...JOURNAL_RECORD_KEYS].sort());
    });

    it('the stored table columns are exactly the committed key set', () => {
        const cols = (h.db.prepare('PRAGMA table_info(journal_event)').all() as { name: string }[]).map(
            (c) => c.name,
        );
        expect(cols.sort()).toEqual([...JOURNAL_RECORD_KEYS].sort());
    });

    it('no committed key is a free-form key', () => {
        const free = new Set<string>(FREE_FORM_KEYS);
        expect([...JOURNAL_RECORD_KEYS].filter((k) => free.has(k))).toEqual([]);
    });

    it('rejects an absolute path in a locator field', () => {
        expect(() =>
            recordEvent(h, {
                event: 'stop',
                session_id: 'sess-1',
                capability: 'dispatch_hook',
                return_ref: '/Users/someone/secret/return.json',
            }),
        ).toThrow(JournalContractError);
    });

    it('rejects a locator escaping the tree, a drive letter, and a control character', () => {
        expect(isRepoRelativeRef('agents/runtime/x.json')).toBe(true);
        expect(isRepoRelativeRef('../outside.json')).toBe(false);
        expect(isRepoRelativeRef('C:\\Users\\x')).toBe(false);
        expect(isRepoRelativeRef('a\u0000b')).toBe(false);
        expect(isRepoRelativeRef('~/x')).toBe(false);
        expect(isRepoRelativeRef('a'.repeat(300))).toBe(false);
    });

    it('rejects a capability that is free text rather than a bounded identifier', () => {
        expect(() =>
            recordEvent(h, {
                event: 'stop',
                session_id: 'sess-1',
                capability: 'the user asked me to summarise their private notes',
            }),
        ).toThrow(JournalContractError);
    });

    it('rejects an event outside the vocabulary', () => {
        expect(() =>
            recordEvent(h, { event: 'not_an_event', session_id: 'sess-1', capability: 'dispatch_hook' }),
        ).toThrow(/silence is not coverage/);
    });

    it('rejects free text smuggled through an id field', () => {
        expect(() =>
            recordEvent(h, {
                event: 'stop',
                session_id: 'sess-1',
                capability: 'dispatch_hook',
                task_id: 'fix the login bug for acme corp',
            }),
        ).toThrow(/content in disguise/);
    });
});

// ---------------------------------------------------------------------------
// 2.1 — the spine, and the imported terminal-state enum
// ---------------------------------------------------------------------------

describe('spine fields (2.1)', () => {
    it('the terminal-state list is the outcome-envelope contract, not a parallel one', () => {
        // The compile-time binding lives in the module (two Exclude<> assertions
        // against the imported type). This is its runtime half: every
        // non-success state the envelope knows about must be in the list.
        for (const s of NON_SUCCESS_STATES) {
            expect(TERMINAL_STATES).toContain(s);
        }
        expect(TERMINAL_STATES).toHaveLength(6);
    });

    it('the module imports the state type and never redeclares it as a literal union', () => {
        const src = fs.readFileSync(MODULE_SRC, 'utf8');
        expect(src).toMatch(/import type \{ TerminalState \} from '\.\/outcome_envelope\.js';/);
        // A redeclaration is the failure this asserts against — `type
        // TerminalState =` anywhere in this file means the enum forked.
        expect(src).not.toMatch(/^\s*(export )?type TerminalState\s*=/m);
    });

    it('consumption states are the three the roadmap names', () => {
        expect([...CONSUMPTION_STATES]).toEqual(['consumed', 'partially-consumed', 'rejected-with-reason']);
    });
});

describe('episode boundary derivation (2.1, blocker: what-counts-as-an-episode-boundary)', () => {
    it('an explicit envelope episode id wins and is marked explicit', () => {
        const d = deriveBoundary({ repository_id: 'ns', session_id: 's1', episode_id: 'ep-given' });
        expect(d).toEqual({
            episode_id: 'ep-given',
            boundary_status: 'explicit',
            boundary_rule_version: BOUNDARY_RULE_VERSION,
        });
    });

    it('a task id opens the episode — the first event carrying it, not the first mutation', () => {
        const a = deriveBoundary({ repository_id: 'ns', session_id: 's1', task_id: 't1' });
        const b = deriveBoundary({ repository_id: 'ns', session_id: 's2', task_id: 't1' });
        expect(a.boundary_status).toBe('derived');
        // Same task, different session: still one episode. This is envelope
        // correlation, which is what both council seats adopted in place of the
        // roadmap's own "first mutating action" rule.
        expect(b.episode_id).toBe(a.episode_id);
    });

    it('an event with no task id is session-scoped and MARKED, never silent', () => {
        const d = deriveBoundary({ repository_id: 'ns', session_id: 's1' });
        expect(d.boundary_status).toBe('session_fallback');
        expect(d.episode_id).toMatch(/^sess-/);
    });

    it('two repositories derive distinct episode ids from the same task id', () => {
        const a = deriveBoundary({ repository_id: 'ns-a', session_id: 's1', task_id: 't1' });
        const b = deriveBoundary({ repository_id: 'ns-b', session_id: 's1', task_id: 't1' });
        expect(a.episode_id).not.toBe(b.episode_id);
    });
});

// ---------------------------------------------------------------------------
// 2.2 / AC-4 — one fixture episode, end to end
// ---------------------------------------------------------------------------

describe.runIf(sqliteOk)('fixture episode reconstruction (2.2, AC-4)', () => {
    /** task -> action -> result -> outcome, across four hook slots. */
    function writeFixture(handle: JournalHandle): string {
        const common = { session_id: 'sess-fixture', task_id: 'task-fixture' } as const;
        recordEvent(handle, {
            ...common,
            event: 'user_prompt_submit',
            capability: 'skill-route',
            prompt_id: 'prompt-1',
            at: T0,
        });
        recordEvent(handle, { ...common, event: 'pre_tool_use', capability: 'authz-review', at: plusDays(T0, 0) });
        recordEvent(handle, {
            ...common,
            event: 'post_tool_use',
            capability: 'authz-review',
            return_ref: 'agents/runtime/returns/task-fixture.json',
            at: plusDays(T0, 0),
        });
        const last = recordEvent(handle, {
            ...common,
            event: 'stop',
            capability: 'dispatch_hook',
            terminal_state: 'blocked',
            return_ref: 'agents/runtime/returns/task-fixture.json',
            verification_ref: 'agents/evidence/analysis/task-fixture.md',
            consumption: 'rejected-with-reason',
            at: plusDays(T0, 1),
        });
        return last.episode_id;
    }

    it('reconstructs the whole episode from the journal alone, with no in-memory state', () => {
        const episodeId = writeFixture(h);
        // Close and reopen: nothing from the writing process survives. Anything
        // the reconstruction knows, it read back off disk.
        h.close();
        const fresh = openJournal(tmp);
        try {
            const ep = reconstructEpisode(fresh, episodeId);
            expect(ep).not.toBeNull();
            const e = ep!;
            expect(e.events).toHaveLength(4);
            expect(e.events.map((x) => x.event)).toEqual([
                'user_prompt_submit',
                'pre_tool_use',
                'post_tool_use',
                'stop',
            ]);
            expect(e.opened_at).toBe(T0);
            expect(e.opened_by.event).toBe('user_prompt_submit');
            expect(e.closed_at).toBe(plusDays(T0, 1));
            expect(e.terminal_state).toBe('blocked');
            expect(e.boundary_status).toBe('derived');
            expect(e.boundary_rule_version).toBe(BOUNDARY_RULE_VERSION);
            expect(e.task_id).toBe('task-fixture');
            expect(e.prompt_id).toBe('prompt-1');
            expect(e.session_ids).toEqual(['sess-fixture']);
            expect(e.return_ref).toBe('agents/runtime/returns/task-fixture.json');
            expect(e.verification_ref).toBe('agents/evidence/analysis/task-fixture.md');
            expect(e.consumption).toBe('rejected-with-reason');
            expect(e.capabilities).toEqual(['skill-route', 'authz-review', 'dispatch_hook']);
        } finally {
            fresh.close();
        }
        h = openJournal(tmp); // restore for afterEach
    });

    it('every nullable field is non-null or explicitly named absent', () => {
        const episodeId = writeFixture(h);
        const full = reconstructEpisode(h, episodeId)!;
        // The complete fixture leaves nothing absent.
        expect(full.absent).toEqual([]);
        for (const k of RECONSTRUCTION_NULLABLE_FIELDS) {
            expect(full[k] === null ? full.absent.includes(k) : true).toBe(true);
        }

        // A minimal episode: the absent fields are NAMED, not silently null, so
        // a reader can tell "not recorded" from "recorded as nothing".
        const bare = recordEvent(h, {
            event: 'session_start',
            session_id: 'sess-bare',
            capability: 'session_register',
            at: T0,
        });
        const min = reconstructEpisode(h, bare.episode_id)!;
        expect(min.boundary_status).toBe('session_fallback');
        expect(min.absent.sort()).toEqual(
            ['closed_at', 'consumption', 'prompt_id', 'return_ref', 'task_id', 'terminal_state', 'verification_ref'],
        );
        for (const k of RECONSTRUCTION_NULLABLE_FIELDS) {
            expect(min[k] === null).toBe(min.absent.includes(k));
        }
    });

    it('an absent episode reports absent, never an empty success', () => {
        expect(reconstructEpisode(h, 'ep-never-written')).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// Retention (blocker: journal-retention-and-size)
// ---------------------------------------------------------------------------

describe.runIf(sqliteOk)('retention holds are human-only and append-only', () => {
    function explicitEpisode(): string {
        recordEvent(h, {
            event: 'stop',
            session_id: 'sess-h',
            episode_id: 'ep-explicit',
            capability: 'dispatch_hook',
            terminal_state: 'success',
            at: T0,
        });
        return 'ep-explicit';
    }

    it('refuses a hold created by the agent, in every spelling it reaches for', () => {
        explicitEpisode();
        for (const actor of ['agent', 'Claude', 'assistant', 'agent:claude-opus', 'bot', 'automation', '']) {
            expect(isAgentActor(actor)).toBe(true);
            expect(() =>
                createHold(h, { scope: 'episode', scope_id: 'ep-explicit', created_by: actor, reason: 'r', at: T0 }),
            ).toThrow(/Only a human may set a retention hold|names an agent/);
        }
    });

    it('accepts a hold from a named human on an explicit boundary, scoped to the episode', () => {
        explicitEpisode();
        const recs = createHold(h, {
            scope: 'episode',
            scope_id: 'ep-explicit',
            created_by: 'm.berg',
            reason: 'incident 2026-08 review',
            at: T0,
        });
        expect(recs).toHaveLength(1);
        expect(recs[0]!.scope).toBe('episode');
        expect(recs[0]!.kind).toBe('retention_hold');
        // Default window: holds expire too.
        expect(Date.parse(recs[0]!.retain_until) - Date.parse(T0)).toBe(180 * DAY_MS);
    });

    it('widens an episode-only hold on a DERIVED boundary to the containing session', () => {
        // Council 2026-08-28: a hold makes a mis-derived boundary durable, so a
        // boundary the rule derived never carries an episode-only hold.
        const ev = recordEvent(h, {
            event: 'stop',
            session_id: 'sess-derived',
            task_id: 'task-derived',
            capability: 'dispatch_hook',
            terminal_state: 'success',
            at: T0,
        });
        expect(ev.boundary_status).toBe('derived');
        const recs = createHold(h, {
            scope: 'episode',
            scope_id: ev.episode_id,
            created_by: 'm.berg',
            reason: 'keep for review',
            at: T0,
        });
        expect(recs).toHaveLength(1);
        expect(recs[0]!.scope).toBe('session');
        expect(recs[0]!.scope_id).toBe('sess-derived');
        expect(recs[0]!.reason).toMatch(/widened from episode .*boundary_status=derived/);
    });

    it('widens a session_fallback episode to every session it touches', () => {
        const ev = recordEvent(h, {
            event: 'stop',
            session_id: 'sess-fb',
            capability: 'dispatch_hook',
            at: T0,
        });
        expect(ev.boundary_status).toBe('session_fallback');
        const recs = createHold(h, {
            scope: 'episode',
            scope_id: ev.episode_id,
            created_by: 'm.berg',
            reason: 'keep',
            at: T0,
        });
        expect(recs.map((r) => r.scope)).toEqual(['session']);
        expect(recs[0]!.scope_id).toBe('sess-fb');
    });

    it('refuses a hold on an episode that has no records', () => {
        expect(() =>
            createHold(h, { scope: 'episode', scope_id: 'ep-ghost', created_by: 'm.berg', reason: 'r' }),
        ).toThrow(/does not exist/);
    });

    it('refuses a hold with no reason and a retain_until that is not in the future', () => {
        explicitEpisode();
        expect(() =>
            createHold(h, { scope: 'episode', scope_id: 'ep-explicit', created_by: 'm.berg', reason: '  ' }),
        ).toThrow(/requires a reason/);
        expect(() =>
            createHold(h, {
                scope: 'episode',
                scope_id: 'ep-explicit',
                created_by: 'm.berg',
                reason: 'r',
                at: T0,
                retain_until: T0,
            }),
        ).toThrow(/holds expire too/);
    });

    it('a release is an append-only counter-record, never a delete', () => {
        explicitEpisode();
        createHold(h, {
            scope: 'episode',
            scope_id: 'ep-explicit',
            created_by: 'm.berg',
            reason: 'r',
            at: T0,
        });
        releaseHold(h, {
            scope: 'episode',
            scope_id: 'ep-explicit',
            created_by: 'm.berg',
            reason: 'done',
            at: plusDays(T0, 1),
        });
        const recs = readRetention(h, 'episode', 'ep-explicit');
        expect(recs.map((r) => r.kind)).toEqual(['retention_hold', 'retention_release']);
    });
});

describe.runIf(sqliteOk)('retention anchor ladder and pruning', () => {
    it('anchors on episode close when a terminal state is recorded', () => {
        recordEvent(h, {
            event: 'user_prompt_submit',
            session_id: 's',
            episode_id: 'ep-closed',
            capability: 'skill-route',
            at: T0,
        });
        recordEvent(h, {
            event: 'stop',
            session_id: 's',
            episode_id: 'ep-closed',
            capability: 'dispatch_hook',
            terminal_state: 'success',
            at: plusDays(T0, 1),
        });
        const a = episodeAnchor(h, 'ep-closed', plusDays(T0, 2));
        expect(a).toEqual({ via: 'episode_closed_at', anchor: plusDays(T0, 1) });
        expect(effectiveExpiry(h, 'ep-closed', plusDays(T0, 2))).toBe(plusDays(T0, 1 + RETENTION_TTL_DAYS));
    });

    it('falls back to session_end, then to inactivity, and reports a live episode as active', () => {
        recordEvent(h, {
            event: 'session_end',
            session_id: 's',
            episode_id: 'ep-ended',
            capability: 'session_register',
            at: T0,
        });
        expect(episodeAnchor(h, 'ep-ended', plusDays(T0, 1)).via).toBe('session_end');

        recordEvent(h, {
            event: 'pre_tool_use',
            session_id: 's',
            episode_id: 'ep-idle',
            capability: 'dispatch_hook',
            at: T0,
        });
        expect(episodeAnchor(h, 'ep-idle', plusDays(T0, 3)).via).toBe('inactivity');
        // Still inside the inactivity window: live, and therefore no expiry. A
        // TTL anchored on WRITE would already have condemned this episode.
        expect(episodeAnchor(h, 'ep-idle', plusDays(T0, 0.5))).toEqual({ via: 'active', anchor: null });
        expect(effectiveExpiry(h, 'ep-idle', plusDays(T0, 0.5))).toBeNull();
    });

    it('prunes an expired episode, keeps a held one, and keeps a live one', () => {
        for (const id of ['ep-old', 'ep-held']) {
            recordEvent(h, {
                event: 'stop',
                session_id: `s-${id}`,
                episode_id: id,
                capability: 'dispatch_hook',
                terminal_state: 'success',
                at: T0,
            });
        }
        recordEvent(h, {
            event: 'pre_tool_use',
            session_id: 's-live',
            episode_id: 'ep-live',
            capability: 'dispatch_hook',
            at: plusDays(T0, 40),
        });
        createHold(h, {
            scope: 'episode',
            scope_id: 'ep-held',
            created_by: 'm.berg',
            reason: 'under investigation',
            at: T0,
        });

        const now = plusDays(T0, 40);
        const report = pruneExpired(h, now);
        expect(report.deleted_episodes).toEqual(['ep-old']);
        expect(report.held_episodes).toEqual(['ep-held']);
        expect(report.live_episodes).toEqual(['ep-live']);
        expect(report.deleted_events).toBe(1);
        expect(reconstructEpisode(h, 'ep-old')).toBeNull();
        expect(reconstructEpisode(h, 'ep-held')).not.toBeNull();
    });

    it('an expired hold stops protecting, because holds expire too', () => {
        recordEvent(h, {
            event: 'stop',
            session_id: 's',
            episode_id: 'ep-x',
            capability: 'dispatch_hook',
            terminal_state: 'success',
            at: T0,
        });
        createHold(h, {
            scope: 'episode',
            scope_id: 'ep-x',
            created_by: 'm.berg',
            reason: 'short hold',
            at: T0,
            retain_until: plusDays(T0, 35),
        });
        expect(pruneExpired(h, plusDays(T0, 34)).held_episodes).toEqual(['ep-x']);
        expect(pruneExpired(h, plusDays(T0, 36)).deleted_episodes).toEqual(['ep-x']);
    });

    it('a released hold stops protecting immediately', () => {
        recordEvent(h, {
            event: 'stop',
            session_id: 's',
            episode_id: 'ep-r',
            capability: 'dispatch_hook',
            terminal_state: 'success',
            at: T0,
        });
        createHold(h, { scope: 'episode', scope_id: 'ep-r', created_by: 'm.berg', reason: 'hold', at: T0 });
        expect(pruneExpired(h, plusDays(T0, 40)).held_episodes).toEqual(['ep-r']);
        releaseHold(h, {
            scope: 'episode',
            scope_id: 'ep-r',
            created_by: 'm.berg',
            reason: 'done',
            at: plusDays(T0, 41),
        });
        expect(pruneExpired(h, plusDays(T0, 42)).deleted_episodes).toEqual(['ep-r']);
    });
});

// ---------------------------------------------------------------------------
// Location — the fallback branch, tested here; the git branches live in the
// identity test, which needs real worktrees.
// ---------------------------------------------------------------------------

describe('journal location', () => {
    it('falls back to the worktree-local path outside a git repository, and says why', () => {
        const loc = resolveJournal(tmp);
        expect(loc.scope).toBe('worktree-local');
        expect(loc.reason).toMatch(/no common git dir/);
        expect(loc.path.endsWith(path.join('agents', 'runtime', 'state', 'journal.sqlite'))).toBe(true);
    });

    it('both identities are bounded digests, never a path — outside a repo too', () => {
        // The fallback derives both from the same directory, so this is exactly
        // the branch where a naive implementation would leak the root path into
        // an id field or collapse the two ids into one value.
        const loc = resolveJournal(tmp);
        expect(loc.repository_id).toMatch(/^[0-9a-f]{12}$/);
        expect(loc.worktree_id).toMatch(/^[0-9a-f]{12}$/);
        expect(loc.repository_id).not.toBe(loc.worktree_id);
        expect(`${loc.repository_id}${loc.worktree_id}`).not.toContain(path.sep);
    });
});

// ---------------------------------------------------------------------------
// road-to-experience-loop-broadening step 3.1 — episode amendment
//
// verify: an amendment arriving after a terminal state produces a new record
// and leaves the original byte-identical; the repeated-failure rate reads the
// amended view.
// ---------------------------------------------------------------------------

describe.runIf(sqliteOk)('amendment (3.1)', () => {
    const open = (session_id: string) =>
        recordEvent(h, { event: 'session_start', session_id, capability: 'dispatch_hook' });

    const close = (session_id: string, terminal_state: TerminalState) =>
        recordEvent(h, { event: 'stop', session_id, capability: 'dispatch_hook', terminal_state });

    it('an amendment is a NEW row and leaves the original byte-identical', () => {
        const started = open('amend-1');
        const closed = close('amend-1', 'success');

        const before = h.db
            .prepare('SELECT * FROM journal_event WHERE seq = ?')
            .get(closed.seq) as Record<string, unknown>;
        const beforeBytes = JSON.stringify(before);

        const amendment = recordEvent(h, {
            event: 'stop',
            session_id: 'amend-1',
            capability: 'dispatch_hook',
            terminal_state: 'stagnated',
            amends_seq: closed.seq,
        });

        // A new row, with its own seq.
        expect(amendment.seq).toBeGreaterThan(closed.seq);
        expect(amendment.amends_seq).toBe(closed.seq);

        // And the original is untouched, compared as stored bytes rather than
        // as a reconstructed object -- the append-only guarantee is about the
        // row, not about a projection of it.
        const after = h.db
            .prepare('SELECT * FROM journal_event WHERE seq = ?')
            .get(closed.seq) as Record<string, unknown>;
        expect(JSON.stringify(after)).toBe(beforeBytes);
        expect(started.seq).toBeLessThan(closed.seq);
    });

    it('the reconstruction reports the AMENDED terminal state, not the first', () => {
        const started = open('amend-2');
        const closed = close('amend-2', 'success');
        recordEvent(h, {
            event: 'stop',
            session_id: 'amend-2',
            capability: 'dispatch_hook',
            terminal_state: 'stagnated',
            amends_seq: closed.seq,
        });

        const ep = reconstructEpisode(h, started.episode_id);
        expect(ep).not.toBeNull();
        // The line the amendment path exists for: `find` would have kept
        // returning `success` forever while the amendment sat unread.
        expect(ep!.terminal_state).toBe('stagnated');
        expect(ep!.amendment_count).toBe(1);
        // Every original row is still returned, unfiltered.
        expect(ep!.events.some((e) => e.seq === closed.seq)).toBe(true);
    });

    it('an unamended episode is unchanged by the folding', () => {
        const started = open('amend-3');
        close('amend-3', 'success');
        const ep = reconstructEpisode(h, started.episode_id);
        expect(ep!.terminal_state).toBe('success');
        expect(ep!.amendment_count).toBe(0);
    });

    it('the repeated-failure rate reads the amended view', () => {
        // Same two episodes: one that stays a success, one amended from success
        // to a failure. A rate over unamended rows would read 0/2; over the
        // amended view it reads 1/2. That gap IS the metric's error term.
        const okStart = open('rate-ok');
        close('rate-ok', 'success');

        const amStart = open('rate-amended');
        const c = close('rate-amended', 'success');
        recordEvent(h, {
            event: 'stop',
            session_id: 'rate-amended',
            capability: 'dispatch_hook',
            terminal_state: 'exhausted',
            amends_seq: c.seq,
        });

        const episodes = [okStart.episode_id, amStart.episode_id].map((id) => reconstructEpisode(h, id)!);
        const r = repeatedFailureRate(episodes);

        expect(r.classified).toBe(2);
        expect(r.failed).toBe(1);
        expect(r.rate).toBe(0.5);
        expect(r.amended_episodes).toBe(1);
    });

    it('the rate is null, never zero, when nothing was classifiable', () => {
        expect(repeatedFailureRate([]).rate).toBeNull();
    });
});
