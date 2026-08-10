// Tests for src/agent-src/scripts/roadmap_gates.ts — the `agent-config gates`
// projection over roadmap blockers.
//
// The parsing itself belongs to `update_roadmap_progress` (imported, never
// re-implemented), so these cover only what this command adds: the owner
// split that decides whether a blocker reaches the user at all, the
// continuation-line regrouping that turns raw parsed lines back into steps,
// and the rendered summary line the user reads first.
import { describe, expect, it } from 'vitest';

import { needsUser, regroupTodo, render, renderJson, type Entry } from '../../src/agent-src/scripts/roadmap_gates.js';

function entry(
    owner: string,
    opts: { id?: string; openSteps?: number; roadmap?: string; todo?: string[] } = {},
): Entry {
    return {
        blocker: {
            id: opts.id ?? 'some-blocker',
            status: 'open',
            owner,
            blocks: 'Phase 1',
            todo: opts.todo ?? ['1. Do the thing.'],
            resolvedWhen: 'the thing is done',
        },
        roadmapRel: opts.roadmap ?? 'road-to-x.md',
        openSteps: opts.openSteps ?? 3,
    };
}

describe('needsUser — the owner split', () => {
    it('claims the plain user owner', () => {
        expect(needsUser('user')).toBe(true);
    });

    it('claims qualified user owners — the shape real roadmaps carry', () => {
        expect(needsUser('user (billable spend)')).toBe(true);
        expect(needsUser('user (billable spend) — executed under the standing')).toBe(true);
    });

    it('claims a shared owner, deliberately erring towards showing it', () => {
        expect(needsUser('user / maintainer')).toBe(true);
    });

    it('rejects maintainer, including qualified forms', () => {
        expect(needsUser('maintainer')).toBe(false);
        expect(needsUser('maintainer (security role)')).toBe(false);
        expect(needsUser('maintainer (host capability) / any roadmap that lands a')).toBe(false);
    });

    it('rejects external', () => {
        expect(needsUser('external')).toBe(false);
    });

    it('does not fire on "user" inside a longer word', () => {
        // Word-boundary matching, not substring: an owner naming a "superuser
        // group" or a "user-agent" maintainer must not be mis-routed.
        expect(needsUser('superuser')).toBe(false);
        expect(needsUser('multiuser')).toBe(false);
    });
});

describe('regroupTodo — continuation lines rejoin their step', () => {
    it('rejoins a step that wrapped over three source lines', () => {
        expect(
            regroupTodo([
                '1. Collect one credible signal that the rule count',
                'itself — not an unclear value proposition — is what',
                'stops adoption.',
                '2. Record it inline.',
            ]),
        ).toEqual([
            '1. Collect one credible signal that the rule count itself — not an unclear value proposition — is what stops adoption.',
            '2. Record it inline.',
        ]);
    });

    it('treats bullets as step starts too', () => {
        expect(regroupTodo(['- first', 'wrapped', '- second'])).toEqual([
            '- first wrapped',
            '- second',
        ]);
    });

    it('keeps unnumbered prose as a single step', () => {
        expect(regroupTodo(['the build work is done;', 'only real usage produces this.'])).toEqual([
            'the build work is done; only real usage produces this.',
        ]);
    });

    it('handles an empty todo', () => {
        expect(regroupTodo([])).toEqual([]);
    });
});

describe('render — what the user reads first', () => {
    it('counts only user-owned blockers in the headline', () => {
        const out = render([entry('user'), entry('maintainer'), entry('maintainer')], false);
        expect(out.split('\n')[0]).toBe('1 decision needs you · 2 more with maintainer/external (--all)');
    });

    it('pluralises the headline', () => {
        const out = render([entry('user'), entry('user')], false);
        expect(out.split('\n')[0]).toBe('2 decisions need you');
    });

    it('says so plainly when nothing is waiting on the user', () => {
        const out = render([entry('maintainer')], false);
        expect(out).toContain('Nothing is waiting on you.');
        expect(out).toContain('1 open blocker');
    });

    it('reports an empty tree without inventing work', () => {
        expect(render([], false)).toContain('No open blockers at all.');
    });

    it('hides maintainer entries by default and shows them under --all', () => {
        const entries = [entry('user', { id: 'mine' }), entry('maintainer', { id: 'theirs' })];
        expect(render(entries, false)).not.toContain('theirs');
        expect(render(entries, true)).toContain('theirs');
    });

    it('renders the action and the done-condition for a user blocker', () => {
        const out = render([entry('user', { todo: ['1. Authorize the spend.'] })], false);
        expect(out).toContain('Do this:');
        expect(out).toContain('1. Authorize the spend.');
        expect(out).toContain('Done when:');
        expect(out).toContain('the thing is done');
    });

    it('relabels the parser-synthesised legacy note instead of faking a step list', () => {
        const out = render([entry('user', { id: 'legacy' })], false);
        expect(out).toContain('blocked-until note');
        expect(out).toContain('Blocked until:');
        expect(out).not.toContain('Do this:');
    });

    it('names the gap when a blocker records no steps at all', () => {
        const out = render([entry('user', { todo: [] })], false);
        expect(out).toContain('no steps recorded');
    });
});

describe('renderJson', () => {
    it('reports both counts even when only user entries are listed', () => {
        const parsed = JSON.parse(renderJson([entry('user'), entry('maintainer')], false)) as {
            needsYou: number;
            other: number;
            blockers: Array<{ needsYou: boolean }>;
        };
        expect(parsed.needsYou).toBe(1);
        expect(parsed.other).toBe(1);
        expect(parsed.blockers).toHaveLength(1);
        expect(parsed.blockers[0]?.needsYou).toBe(true);
    });

    it('lists everything under --all', () => {
        const parsed = JSON.parse(renderJson([entry('user'), entry('maintainer')], true)) as {
            blockers: unknown[];
        };
        expect(parsed.blockers).toHaveLength(2);
    });
});
