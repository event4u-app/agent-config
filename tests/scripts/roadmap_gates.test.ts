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
    renderSheet,
    readSheetAnswer,
    isAgentDrafted,
    sheetQuestion,
    type Entry,
} from '../../src/agent-src/scripts/roadmap_gates.js';
import {
    parse_blockers,
    blocker_class,
} from '../../src/agent-src/scripts/update_roadmap_progress.js';
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
        blockerClass?: string;
        run?: string;
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
            blockerClass: opts.blockerClass ?? '',
            run: opts.run ?? '',
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

    // The gate taxonomy on the machine-readable surface. Before this landed,
    // `--json` emitted no class at all, so `gates --execute` shipped against a
    // projection that could not say which entries it was able to act on — the
    // acting half was reachable on nothing and the JSON could not show it.
    // The annotation names only `class` on purpose: a sibling test below asserts
    // the projection carries no `run`, and a cast that documented one would tell
    // the next reader the opposite while still type-checking.
    const classOf = (e: Entry): string =>
        (
            JSON.parse(renderJson([e], true)) as {
                blockers: Array<{ class: string }>;
            }
        ).blockers[0]?.class ?? '';

    it('an entry declaring no class reads as 3, not as a hole', () => {
        // The renderer half of the absent-field default. The *parser* half —
        // that a synthesised legacy `> Blocked until …` note really does reach
        // this path with an empty class — is a separate claim and is pinned by
        // its own test below; R2 finding 6 caught this comment asserting the
        // coverage that test provides.
        expect(classOf(entry('user'))).toBe('3');
    });

    it('carries an authored class and reads only its leading token', () => {
        expect(classOf(entry('user', { blockerClass: '1 — budget-preauthorized' }))).toBe('1');
        expect(classOf(entry('user', { blockerClass: '0 — auto-run' }))).toBe('0');
    });

    it('falls back to 3 on a class the taxonomy does not know', () => {
        // The safe direction: an authoring typo must never make a gate look
        // executable. `lint_roadmap_blockers` fails the entry separately.
        expect(classOf(entry('user', { blockerClass: '7 — invented' }))).toBe('3');
    });

    it('the parser really does hand the legacy note an empty class', () => {
        // The parser half of the pair above, and the reason the renderer's
        // default is load-bearing rather than decorative: a `> Blocked until …`
        // note is synthesised into a blocker that can never carry an authored
        // field, so class 3 has to come from somewhere. If the synthesis ever
        // starts emitting a class, this fails and the pairing is re-examined.
        const parsed = parse_blockers(
            ['# A roadmap', '', '> Blocked until a human installs the thing.', ''].join('\n'),
        );
        const note = parsed.find((b) => b.id === 'legacy');
        expect(note).toBeDefined();
        expect(note?.blockerClass).toBe('');
        expect(blocker_class(note!)).toBe('3');
    });

    it('does not emit run — no consumer reads it and no record carries one', () => {
        // R2 findings 2 and 7. Pinned as an absence so a future re-add has to
        // answer the question the first one skipped: which representation, the
        // authored backticked value or `commandOf()`'s stripped one.
        const parsed = JSON.parse(
            renderJson(
                [entry('user', { blockerClass: '0 — auto-run', run: '`task probe-thing`' })],
                true,
            ),
        ) as { blockers: Array<Record<string, unknown>> };
        expect(parsed.blockers[0]?.class).toBe('0');
        expect(parsed.blockers[0]).not.toHaveProperty('run');
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

describe('--sheet — the consolidated decision sheet', () => {
    // road-to-estate-drawdown Step 0.1. `verify:` the sheet contains every
    // user-owned item, each with a question, a default and its recommendation
    // source LABELLED — the last of the three is the load-bearing one, because a
    // sheet whose whole point is accept-all-defaults must not present an
    // agent-drafted default and a maintainer decision as the same statement.
    const NOW = new Date('2026-08-18T00:00:00Z');

    it('carries every user-owned item and no maintainer-owned one', () => {
        const out = renderSheet(
            [
                entry('user', { id: 'mine-big', openSteps: 40 }),
                entry('maintainer', { id: 'notmine' }),
                entry('user', { id: 'mine-small', openSteps: 2 }),
                entry('external', { id: 'alsonotmine' }),
            ],
            NOW,
        );
        expect(out).toContain('2 decisions owned by you');
        expect(out).toContain('mine-big');
        expect(out).toContain('mine-small');
        expect(out).not.toContain('notmine');
        expect(out).not.toContain('alsonotmine');
    });

    it('keeps the unblock-descending order collectEntries produced', () => {
        const out = renderSheet(
            [
                entry('user', { id: 'first', openSteps: 40 }),
                entry('user', { id: 'second', openSteps: 9 }),
                entry('user', { id: 'third', openSteps: 1 }),
            ],
            NOW,
        );
        expect(out.indexOf('`first`')).toBeLessThan(out.indexOf('`second`'));
        expect(out.indexOf('`second`')).toBeLessThan(out.indexOf('`third`'));
    });

    it('labels a maintainer-recorded default differently from an agent-drafted one', () => {
        const out = renderSheet(
            [
                entry('user', { id: 'decided', recommendation: 'Take (b). It is reversible.' }),
                entry('user', {
                    id: 'drafted',
                    recommendation: '**(agent-drafted 2026-08-18 — predates the field.)** Do the probe first.',
                }),
            ],
            NOW,
        );
        expect(out).toContain('Provenance of the 2 defaults: 1 maintainer-recorded');
        expect(out).toContain('1 `agent-drafted`');
        expect(out).toContain('maintainer-recorded `Recommendation:` in the roadmap');
        expect(out).toContain('NOT a maintainer decision');
    });

    it('says so when a blocker records no recommendation at all', () => {
        // The honest branch: no invented default. A generator that filled this in
        // would be indistinguishable from a maintainer decision on the row that
        // needs the distinction most.
        const out = renderSheet([entry('user', { id: 'bare' })], NOW);
        expect(out).toContain('none recorded');
        expect(out).toContain('needs an agent-drafted default');
        expect(out).not.toContain('maintainer-recorded `Recommendation:`');
    });

    it('names a legacy blocked-until note as having no field, rather than as undrafted', () => {
        // A legacy `> Blocked until …` note is not a `### blocker:` entry and has
        // no Recommendation: slot, so "to be written in below" would point at a
        // field that does not exist. `isLegacy` keys on the id the parser gives
        // such a note.
        const out = renderSheet([entry('user', { id: 'legacy' })], NOW);
        expect(out).toContain('none — legacy note');
        expect(out).toContain('Converting it into a real blocker');
        // And it is NAMED the way the sibling renderer names it. `legacy` is the
        // parser's placeholder, not an identifier anyone wrote, so printing it
        // made the two views disagree about the same row (R2 finding).
        expect(out).toContain('blocked-until note');
        expect(out).not.toContain('`legacy`');
    });

    it('gives every row a question, labelling which field it came from', () => {
        const out = renderSheet(
            [
                entry('user', { id: 'has-q', question: 'Which sink?', openSteps: 9 }),
                entry('user', { id: 'has-todo', todo: ['1. Run the probe on the host.'], openSteps: 8 }),
                entry('user', { id: 'bare-blocks', todo: [], openSteps: 7 }),
            ],
            NOW,
        );
        expect(out).toContain('recorded `Question:`');
        expect(out).toContain('derived from the first `What to do:` step');
        expect(out).toContain('derived from `Blocks:`');
        // Every rendered row carries one, so the sheet has no blank questions.
        expect(out.split('\n').filter((l) => l.startsWith('- **Question**')).length).toBe(3);
    });

    it('is not silent when nothing is owned by the user', () => {
        // `--reply` returns '' on purpose so it can be appended unconditionally.
        // A sheet must NOT: an empty file reads as "the generator broke", where
        // one sentence reads as "there is nothing to answer".
        const out = renderSheet([entry('maintainer'), entry('external')], NOW);
        expect(out).toContain('nothing owned by you');
        expect(out).toContain('Nothing to answer');
    });

    // road-to-estate-drawdown blocker `b-consolidated-decision-sheet` resolves
    // only when "the sheet records which option was used". The sheet is derived,
    // so the option lives in a non-derived sibling and is READ — these four cases
    // pin that the read is optional, strict, and reaches BOTH render branches.
    describe('the recorded answer', () => {
        const ANSWER_REL = path.join(
            'agents',
            'decisions',
            'consolidated-decision-sheet-answer.md',
        );

        function withAnswerFile(body: string): string {
            const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sheet-answer-'));
            fs.mkdirSync(path.join(root, 'agents', 'decisions'), { recursive: true });
            fs.writeFileSync(path.join(root, ANSWER_REL), body, 'utf8');
            return root;
        }

        it('reads a complete marker and renders it into the populated sheet', () => {
            const root = withAnswerFile(
                '# x\n\n<!-- sheet-answer: option (a) — accept all | answered: 2026-08-20 |' +
                    ' authority: agents/evidence/council/x.md -->\n',
            );
            const answer = readSheetAnswer(root);
            expect(answer).toEqual({
                option: 'option (a) — accept all',
                answered: '2026-08-20',
                authority: 'agents/evidence/council/x.md',
            });
            const out = renderSheet([entry('user')], NOW, answer);
            expect(out).toContain('**ANSWERED 2026-08-20 — option (a) — accept all.**');
            expect(out).toContain(ANSWER_REL);
        });

        it('records the option on the EMPTY branch too', () => {
            // The branch the sheet reaches once every row closes. Losing the
            // option record exactly there would be the worst place to lose it:
            // a reader would see "nothing to answer" with no trace of what was
            // answered, which is indistinguishable from never having answered.
            const answer = readSheetAnswer(
                withAnswerFile(
                    '<!-- sheet-answer: option (c) | answered: 2026-01-02 | authority: a/b.md -->',
                ),
            );
            const out = renderSheet([entry('maintainer')], NOW, answer);
            expect(out).toContain('nothing owned by you');
            expect(out).toContain('**ANSWERED 2026-01-02 — option (c).**');
        });

        it('treats a missing file and a partial marker as absent, not as half an answer', () => {
            expect(readSheetAnswer(fs.mkdtempSync(path.join(os.tmpdir(), 'no-answer-')))).toBeNull();
            // No `authority:` — a header naming an option with no provenance is
            // less honest than one that says nothing, so it is rejected whole.
            expect(
                readSheetAnswer(withAnswerFile('<!-- sheet-answer: option (a) | answered: 2026-08-20 -->')),
            ).toBeNull();
            // No `answered:` date.
            expect(
                readSheetAnswer(withAnswerFile('<!-- sheet-answer: option (a) | authority: a/b.md -->')),
            ).toBeNull();
        });

        it('renders byte-identically to the pre-answer sheet when none is recorded', () => {
            // The read is additive: every existing caller passes two arguments.
            expect(renderSheet([entry('user')], NOW, null)).toBe(renderSheet([entry('user')], NOW));
            expect(renderSheet([entry('user')], NOW)).not.toContain('ANSWERED');
        });
    });

    it('sheetQuestion falls back in a fixed order and never returns a whole paragraph', () => {
        expect(sheetQuestion(entry('user', { question: 'Which one? And why?' }).blocker)).toEqual({
            text: 'Which one?',
            source: 'question',
        });
        expect(sheetQuestion(entry('user', { todo: ['1. Do X. Then Y.'] }).blocker).source).toBe('todo');
        expect(sheetQuestion(entry('user', { todo: [] }).blocker).source).toBe('blocks');
    });

    it('isAgentDrafted reads the marker out of the field text, not out of the sheet', () => {
        expect(isAgentDrafted('**(agent-drafted 2026-08-18 — from the roadmap.)** Do X.')).toBe(true);
        expect(isAgentDrafted('(Agent-Drafted) do X')).toBe(true);
        expect(isAgentDrafted('Take (b) — the agent drafted nothing here')).toBe(false);
        expect(isAgentDrafted('')).toBe(false);
    });
});
