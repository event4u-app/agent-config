/**
 * H.3 — fix commits as facts: declared, ticket, conventional; tracker keys
 * extend the one ticket grammar; fix state is tri-state.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { bugReferences, parseTrackerKeys } from '../../src/scripts/_lib/git_convention_grammar.js';
import { classifyFix, fixState } from '../../src/scripts/code_graph/fix_kinds.js';
import { readProvenance } from '../../src/scripts/code_graph/provenance.js';
import { Repo } from './_bugs/repo.js';

const keys = { ticketKeys: ['ABC'], trackerKeys: ['SENTRY'] };

describe('tracker keys extend the ticket grammar', () => {
    it('reads tracker_keys off a card', () => {
        expect(parseTrackerKeys('ticket_keys: [ABC]\ntracker_keys: [SENTRY, BUG]\n')).toEqual(['SENTRY', 'BUG']);
        expect(parseTrackerKeys('ticket_keys: ABC\n')).toEqual([]);
    });

    it('SENTRY-317 is a bug reference; ABC-12 is a ticket, not a bug', () => {
        expect(bugReferences('touches ABC-12 and SENTRY-317', ['ABC'], ['SENTRY'])).toEqual(['SENTRY-317']);
        expect(bugReferences('SENTRY-317', ['ABC'], [])).toEqual([]);
    });
});

describe('classifyFix', () => {
    it('declared: Fixes <bug id>', () => {
        expect(classifyFix('Handle empty cart', 'Fixes SENTRY-317', keys)).toMatchObject({ kind: 'declared', bugs: ['SENTRY-317'] });
    });

    it('declared: Fixes: <sha>', () => {
        expect(classifyFix('Correct rounding', 'Fixes: abcdef12', keys)).toMatchObject({ kind: 'declared', fixes_shas: ['abcdef12'] });
    });

    it('declared: a revert', () => {
        expect(classifyFix('Revert "feat: x"', 'This reverts commit 0123456789abcdef.', keys)).toMatchObject({ kind: 'declared', reverts: ['0123456789abcdef'] });
    });

    it('ticket: a tracker-key mention without a Fixes verb', () => {
        expect(classifyFix('chore: tidy SENTRY-317 area', '', keys)).toMatchObject({ kind: 'ticket', bugs: ['SENTRY-317'] });
    });

    it('ticket: a ticket the user tracker reports as a bug at query time', () => {
        expect(classifyFix('ABC-9 tidy', '', { ...keys, isBugTicket: (t) => t === 'ABC-9' }).kind).toBe('ticket');
        expect(classifyFix('ABC-9 tidy', '', keys).kind).toBeNull();
    });

    it('conventional: fix: subject, the weakest', () => {
        expect(classifyFix('fix(cart): off by one', '', keys).kind).toBe('conventional');
        expect(classifyFix('feat: new', 'mentions a fix somewhere', keys).kind).toBeNull();
    });
});

describe('fixState', () => {
    it('no events after deploy is not-observed, never fixed', () => {
        expect(fixState({ inCode: true, deployedRelease: 'app@2', eventsAfterDeploy: 0 })).toEqual({ changed_in_code: true, deployed: 'yes', observed: 'not-observed' });
        expect(fixState({ inCode: true, deployedRelease: 'app@2', eventsAfterDeploy: 3 }).observed).toBe('recurred');
        expect(fixState({ inCode: true, deployedRelease: undefined, eventsAfterDeploy: 0 })).toEqual({ changed_in_code: true, deployed: 'unknown', observed: 'unknown' });
    });
});

describe('provenance carries the commit kind', () => {
    let repo: Repo;
    beforeEach(() => {
        repo = new Repo();
        repo.write('.git-convention.yml', 'ticket_keys: [ABC]\ntracker_keys: [SENTRY]\n');
        repo.write('a.ts', 'x\n');
        repo.commit('feat: start');
        repo.write('a.ts', 'y\n');
        repo.commit('ABC-4 handle empty\n\nFixes SENTRY-317');
        repo.write('a.ts', 'z\n');
        repo.commit('fix: typo');
    });
    afterEach(() => repo.cleanup());

    it('declared and conventional fixes are kinds; a feature has none', () => {
        const idx = readProvenance(repo.dir, { git: repo.git });
        const bySubject = Object.fromEntries((idx?.commits ?? []).map((c) => [c.subject, c.kind ?? null]));
        expect(bySubject).toEqual({ 'feat: start': null, 'ABC-4 handle empty': 'declared', 'fix: typo': 'conventional' });
    });
});
