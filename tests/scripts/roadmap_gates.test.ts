// Tests for src/agent-src/scripts/roadmap_gates.ts — the `agent-config gates`
// projection over roadmap blockers.
//
// The parsing itself belongs to `update_roadmap_progress` (imported, never
// re-implemented), so these cover only what this command adds: the owner
// split that decides whether a blocker reaches the user at all, the
// continuation-line regrouping that turns raw parsed lines back into steps,
// and the rendered summary line the user reads first.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    needsUser,
    regroupTodo,
    render,
    renderJson,
    renderPending,
    renderPendingJson,
    renderReply,
    type Entry,
} from '../../src/agent-src/scripts/roadmap_gates.js';
import { stageAction } from '../../src/agent-src/templates/scripts/work_engine/hooks/builtin/staged_confirmation.js';
import { putPending } from '../../src/agent-src/templates/scripts/work_engine/hooks/builtin/staged_confirmation_store.js';

function entry(
    owner: string,
    opts: {
        id?: string;
        openSteps?: number;
        roadmap?: string;
        todo?: string[];
        recommendation?: string;
        ifNothing?: string;
        question?: string;
    } = {},
): Entry {
    return {
        blocker: {
            id: opts.id ?? 'some-blocker',
            status: 'open',
            owner,
            blocks: 'Phase 1',
            todo: opts.todo ?? ['1. Do the thing.'],
            resolvedWhen: 'the thing is done',
            // Default to the pre-field shape on purpose: most entries in the
            // tree still carry neither, and the renderer has to stay correct
            // for them rather than for the happy case only.
            recommendation: opts.recommendation ?? '',
            ifNothing: opts.ifNothing ?? '',
            question: opts.question ?? '',
            // Same reasoning as the two fields above: the gate taxonomy is
            // opt-in, so the shape the renderer meets in the tree is the one
            // that declares none of it.
            blockerClass: '',
            run: '',
            budget: '',
        },
        roadmapRel: opts.roadmap ?? 'road-to-x.md',
        openSteps: opts.openSteps ?? 3,
    };
}

describe('decidability fields — the half that makes a blocker answerable', () => {
    it('leads with the recommendation when one is recorded', () => {
        const out = render([entry('user', { recommendation: 'take (b) — it is reversible' })], false);
        expect(out).toContain('Recommendation:');
        expect(out).toContain('take (b) — it is reversible');
        // The answer comes before the instructions that carry it out.
        expect(out.indexOf('Recommendation:')).toBeLessThan(out.indexOf('Do this:'));
    });

    it('says the recommendation is MISSING rather than rendering a silent gap', () => {
        const out = render([entry('user')], false);
        expect(out).toContain('Recommendation:');
        expect(out).toMatch(/none recorded/i);
    });

    it('renders the cost of the non-decision when recorded, and omits the line otherwise', () => {
        const withCost = render([entry('user', { ifNothing: 'the roadmap never archives' })], false);
        expect(withCost).toContain('If you do nothing:');
        expect(withCost).toContain('the roadmap never archives');
        expect(render([entry('user')], false)).not.toContain('If you do nothing:');
    });

    it('offers the guided path — deciding is not the same as executing', () => {
        const out = render([entry('user')], false);
        expect(out).toContain('guide me through');
    });

    it('offers nothing to guide when nothing is waiting on the user', () => {
        expect(render([entry('maintainer')], false)).not.toContain('guide me through');
    });

    it('renders the question as its own field instead of gluing it onto Blocks', () => {
        // Three entries in the tree already wrote `- **Question:**`, and the
        // parser did not know the label — so the decision's subject arrived
        // appended to the end of the Blocks sentence.
        const out = render([entry('user', { question: 'which reading governs?' })], false);
        expect(out).toContain('The question:');
        expect(out).toContain('which reading governs?');
        expect(out.indexOf('The question:')).toBeLessThan(out.indexOf('Recommendation:'));
    });
});

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

// The reply-close projection (ADR-222). These assert the properties the
// contract rests on, not the wording — the wording may be re-tuned, but a
// change that breaks one of these breaks the handover the form exists for.
describe('renderReply — the reply-close form', () => {
    it('is empty when nothing is owned by the user', () => {
        // The load-bearing property: silence is mechanical, not a judgement
        // call, so the command is safe to invoke unconditionally at
        // reply-close and cannot manufacture a blocker report out of nothing.
        expect(renderReply([entry('maintainer'), entry('external')])).toBe('');
        expect(renderReply([])).toBe('');
    });

    it('writes out exactly one blocker in full and never a flat list', () => {
        const out = renderReply([
            entry('user', { id: 'first', todo: ['1. Authorize the spend.'] }),
            entry('user', { id: 'second' }),
            entry('user', { id: 'third' }),
        ]);
        expect(out).toContain('1. Authorize the spend.');
        // The other two are counted, never named — naming them reproduces the
        // "twelve decisions across 850 lines" failure that produced no
        // decision at all.
        expect(out).not.toContain('second');
        expect(out).not.toContain('third');
        expect(out).toContain('2 other decisions also wait on you');
    });

    it('leads with a user blocker even when a maintainer one sorts ahead of it', () => {
        // `collectEntries` sorts by unblocking weight across ALL owners, so
        // the highest-weight entry may well be someone else's. Picking
        // `[0]` blindly would hand the user a decision that is not theirs.
        const out = renderReply([
            entry('maintainer', { id: 'not-mine', openSteps: 99 }),
            entry('user', { id: 'mine', todo: ['1. Decide the ceiling.'] }),
        ]);
        expect(out).toContain('1. Decide the ceiling.');
        expect(out).not.toContain('not-mine');
    });

    it('carries the action itself, never a pointer to where the action is written', () => {
        // F3/F10: a reference the user has to open first is the failure, not
        // the fix. The step text has to survive into the reply verbatim.
        const step = '1. State the spend ceiling for the Phase-3 sweep.';
        const out = renderReply([entry('user', { todo: [step] })]);
        expect(out).toContain(step);
    });

    it('drops roadmap-file metadata a reader of a reply cannot act on', () => {
        const out = renderReply([entry('user')]);
        expect(out).not.toMatch(/^Status:/m);
        expect(out).not.toMatch(/^Owner:/m);
    });

    it('keeps the done-condition, which is how the user knows they are finished', () => {
        const out = renderReply([entry('user')]);
        expect(out).toContain('Done when: the thing is done');
    });

    it('keeps authored step markers instead of re-numbering them', () => {
        // Real `What to do:` lists arrive already numbered. Adding our own
        // counter would render "1. 1. Read …"; the markers are the entry's,
        // not ours.
        const out = renderReply([
            entry('user', { todo: ['1. Read the cost sheet.', '2. Decide the grant.'] }),
        ]);
        expect(out).toContain('1. Read the cost sheet.');
        expect(out).toContain('2. Decide the grant.');
        expect(out).not.toContain('1. 1.');
    });

    it('singularises the trailing count for a single remaining decision', () => {
        const out = renderReply([entry('user', { id: 'a' }), entry('user', { id: 'b' })]);
        expect(out).toContain('1 other decision also waits on you');
    });

    it('omits the trailing line entirely when the lead blocker is the only one', () => {
        const out = renderReply([entry('user')]);
        expect(out).not.toContain('also wait');
    });

    it('relabels the legacy blocked-until note rather than faking an imperative', () => {
        const out = renderReply([entry('user', { id: 'legacy' })]);
        expect(out).toContain('Blocked until:');
        expect(out).not.toContain('Do:');
    });

    it('names the gap when the blocker entry records no steps', () => {
        const out = renderReply([entry('user', { todo: [] })]);
        expect(out).toContain('no steps recorded');
    });
});

// `--pending` is the second source under the same verb (dispatch-safety 2.3):
// staged `requires_confirmation` actions, which are decisions that need the user
// in the most literal sense the verb's own definition allows.
describe('renderPending — staged actions awaiting confirmation', () => {
    const T0 = Date.parse('2026-08-11T12:00:00Z');
    let root: string;

    beforeEach(() => {
        root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'gatespending-')));
    });

    afterEach(() => {
        fs.rmSync(root, { recursive: true, force: true });
    });

    function put(object: string, nonce: string, ttlMs?: number): void {
        putPending(
            root,
            stageAction({
                action: 'agent-config release:publish',
                object,
                source: 'release-flow',
                nonce,
                now: T0,
                ...(ttlMs === undefined ? {} : { ttlMs }),
            }),
        );
    }

    it('says so plainly when nothing is staged', () => {
        expect(renderPending(root, T0)).toBe('No staged actions awaiting confirmation.\n');
    });

    it('renders the exact object first — the approval must name it', () => {
        put('npm publish @event4u/agent-config@9.9.9', 'n1');
        const out = renderPending(root, T0 + 1000);
        expect(out).toContain('1 staged action awaits your confirmation');
        expect(out).toContain('npm publish @event4u/agent-config@9.9.9');
        expect(out).toContain('Staged by:');
    });

    it('pluralises the summary line', () => {
        put('a', 'n1');
        put('b', 'n2');
        expect(renderPending(root, T0 + 1)).toContain('2 staged actions await your confirmation');
    });

    it('counts an expired stage instead of listing it as actionable', () => {
        put('a', 'n1', 1000);
        const out = renderPending(root, T0 + 5000);
        expect(out).toContain('1 stage expired unconfirmed');
        expect(out).not.toContain('Object:');
    });

    it('reports live and expired separately when both exist', () => {
        put('live', 'n1');
        put('dead', 'n2', 1000);
        const out = renderPending(root, T0 + 5000);
        expect(out).toContain('1 staged action awaits your confirmation');
        expect(out).toContain('1 expired unconfirmed');
        expect(out).toContain('live');
        expect(out).not.toContain('dead');
    });

    it('renders byte-identically on an unchanged store', () => {
        put('a', 'n1');
        put('b', 'n2');
        expect(renderPending(root, T0 + 1)).toBe(renderPending(root, T0 + 1));
    });

    it('--json carries the derived status, not the stored field', () => {
        put('a', 'n1', 1000);
        const parsed = JSON.parse(renderPendingJson(root, T0 + 5000)) as {
            awaitingYou: number;
            expired: number;
            staged: { status: string; object: string }[];
        };
        expect(parsed.awaitingYou).toBe(0);
        expect(parsed.expired).toBe(1);
        expect(parsed.staged[0]?.status).toBe('expired');
    });

    it('--json on an empty store is still valid JSON', () => {
        const parsed = JSON.parse(renderPendingJson(root, T0)) as { staged: unknown[] };
        expect(parsed.staged).toEqual([]);
    });
});
