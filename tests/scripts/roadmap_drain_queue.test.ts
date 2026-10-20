import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    buildQueue,
    isTimeGated,
    screenEstate,
    screenRoadmap,
    type ClaimView,
    type RoadmapScreen,
} from '../../src/scripts/roadmap_drain_queue.js';

const TODAY = '2026-10-19';
const NO_CLAIMS: ClaimView = { live: [], dead: [] };

function roadmap(opts: { done: number; open: string[]; blockers?: string; status?: string }): string {
    const steps = [
        ...Array.from({ length: opts.done }, (_, i) => `- [x] **${i + 1}.0 Done step.**`),
        ...opts.open,
    ];
    return [
        '---',
        'complexity: lightweight',
        `status: ${opts.status ?? 'ready'}`,
        '---',
        '# Road to a fixture',
        '',
        '## Phase 1 — Work',
        '',
        ...steps,
        '',
        opts.blockers ?? '',
    ].join('\n');
}

const OWNER_BLOCKER = [
    '## Blockers',
    '',
    '### blocker: needs-owner',
    '- **Status:** open',
    '- **Owner:** owner — a product call',
    '- **Blocks:** everything open',
].join('\n');

function screen(slug: string, text: string): RoadmapScreen {
    return screenRoadmap(slug, `agents/roadmaps/${slug}.md`, text, TODAY);
}

describe('screenRoadmap — one class per open step', () => {
    it('reads marker, field, prose and date, and the classes sum to the open count', () => {
        const text = roadmap({
            done: 1,
            open: [
                '- [ ] **2.1 Plain work.**',
                '- [ ] **2.2 Owner-held.** <!-- blocked-by: needs-owner -->',
                '- [ ] **2.3 Council-held.** <!-- blocked-by: needs-council -->',
                '- [ ] **2.4 Settled.** <!-- blocked-by: settled -->',
                '- [ ] **2.5 Reading.** The window opens 2026-11-13 at the earliest.',
                '- [ ] **2.6 Prose-held.** Still held by blocker `needs-owner` option (a).',
            ],
            blockers: [
                OWNER_BLOCKER,
                '',
                '### blocker: needs-council',
                '- **Status:** open',
                '- **Owner:** council',
                '- **Class:** 2 — council-decidable',
                '',
                '### blocker: settled',
                '- **Status:** resolved — answered 2026-10-01',
                '- **Owner:** owner',
            ].join('\n'),
        });
        const s = screen('road-to-mixed', text);
        expect(s.done).toBe(1);
        expect(s.steps.map((x) => x.cls)).toEqual([
            'runnable',
            'owner',
            'council',
            'runnable',
            'time',
            'owner',
        ]);
        const sum = s.counts.runnable + s.counts.council + s.counts.owner + s.counts.time;
        expect(sum).toBe(s.open);
    });

    it('holds a reference it cannot resolve as owner, never as runnable', () => {
        const s = screen('road-to-x', roadmap({ done: 0, open: ['- [ ] a <!-- blocked-by: road-to-y#gone -->'] }));
        expect(s.counts.owner).toBe(1);
    });

    it('resolves a cross-roadmap reference through the lookup', () => {
        const text = roadmap({ done: 0, open: ['- [ ] a <!-- blocked-by: road-to-y#c -->'] });
        const s = screenRoadmap('road-to-x', 'p', text, TODAY, () => ({
            id: 'c',
            open: true,
            owner: 'council',
            cls: '2',
        }));
        expect(s.counts.council).toBe(1);
    });

    it('ignores checkboxes inside a fenced block', () => {
        const text = roadmap({ done: 0, open: ['- [ ] real', '```', '- [ ] example', '```'] });
        expect(screen('road-to-f', text).open).toBe(1);
    });
});

describe('screenRoadmap — acceptance criteria are not steps', () => {
    it('counts AC items apart, under the heading and by label', () => {
        const text = [
            roadmap({ done: 1, open: ['- [ ] **2.1 Work.**', '- [ ] **AC-9** labelled outside the section.'] }),
            '## Acceptance Criteria',
            '',
            '- [ ] **AC-1** first.',
            '- [x] **AC-2** second.',
            '- [ ] AC-3 — third.',
            '',
            '## Notes',
            '',
            '- [ ] **3.1 After the AC section.**',
        ].join('\n');
        const s = screen('road-to-ac', text);
        expect(s.open).toBe(2);
        expect(s.counts.runnable).toBe(2);
        expect(s.acceptance_open).toBe(3);
    });

    it('screens the recorded case — 4 held steps and 10 ACs — as nothing runnable', () => {
        const held = Array.from(
            { length: 4 },
            (_, i) => `- [ ] **4.${i + 1} Step.** Runs the probe.\n      *Held open, 2026-10-16: the council split.*`,
        );
        const acs = Array.from({ length: 10 }, (_, i) => `- [ ] **AC-${i + 1}** criterion.`);
        const text = [roadmap({ done: 3, open: held }), '## Acceptance Criteria', '', ...acs].join('\n');
        const s = screen('road-to-recorded', text);
        expect(s.counts.runnable).toBe(0);
        expect(s.counts.held).toBe(4);
        expect(buildQueue([s], NO_CLAIMS, TODAY).queue[0]?.bucket).toBe('decide');
    });

    it('lists a roadmap with only ACs open as close, ahead of continue', () => {
        const closing = screen(
            'road-to-closing',
            [roadmap({ done: 5, open: [] }), '## Acceptance Criteria', '', '- [ ] **AC-1** ci green.'].join('\n'),
        );
        const going = screen('road-to-going', roadmap({ done: 1, open: ['- [ ] **1.1 Work.**'] }));
        const q = buildQueue([going, closing], NO_CLAIMS, TODAY);
        expect(q.queue.map((e) => [e.slug, e.bucket])).toEqual([
            ['road-to-closing', 'close'],
            ['road-to-going', 'continue'],
        ]);
        expect(q.next?.slug).toBe('road-to-closing');
    });
});

describe('screenRoadmap — holds written in prose', () => {
    it.each([
        '*Held open, 2026-10-16: the council split 1:1.*',
        'Still waits on 2.1\'s verdict.',
        'This step waits on that file producing it.',
        'Put on hold against the tree.',
    ])('holds a step whose continuation says: %s', (note) => {
        const s = screen('road-to-p', roadmap({ done: 1, open: [`- [ ] **2.1 Work.**\n      ${note}`] }));
        expect(s.steps[0]?.cls).toBe('held');
    });

    it.each([
        '- [ ] **2.5 Skipping ships on only when both hold:** the reading and the flip.',
        '- [ ] **4.5 The guard waits on nothing.** It reads the window.',
    ])('never reads a hold from the title line: %s', (step) => {
        expect(screen('road-to-t', roadmap({ done: 1, open: [step] })).steps[0]?.cls).toBe('runnable');
    });

    it('does not read "condition holds" as on hold', () => {
        const s = screen('road-to-h', roadmap({ done: 1, open: ['- [ ] **2.1 Work.**\n      The bound holds on both arms.'] }));
        expect(s.steps[0]?.cls).toBe('runnable');
    });

    it('holds every step of a phase opened by a hold blockquote, and only that phase', () => {
        const text = [
            '---',
            'status: ready',
            '---',
            '## Phase 4 — Free',
            '- [x] **4.1 Done.**',
            '- [ ] **4.2 Free.**',
            '## Phase 5 — Waiting',
            '> **Screened 2026-10-18 — waits on accrued data.**',
            '- [ ] **5.1 A.**',
            '- [ ] **5.2 B.**',
        ].join('\n');
        expect(screen('road-to-ph', text).steps.map((x) => x.cls)).toEqual(['runnable', 'held', 'held']);
    });

    it('drops a prose hold whose named blocker has resolved', () => {
        const text = roadmap({
            done: 1,
            open: ['- [ ] **2.1 Work.**\n      Open (2026-10-17): still held by blocker `settled`.'],
            blockers: '### blocker: settled\n- **Status:** resolved — 2026-10-18\n- **Owner:** owner',
        });
        expect(screen('road-to-r', text).steps[0]?.cls).toBe('runnable');
    });
});

describe('buildQueue — lanes of one session', () => {
    const a = screen('road-to-a', roadmap({ done: 1, open: ['- [ ] **1.1 Work.**'] }));
    const b = screen('road-to-b', roadmap({ done: 1, open: ['- [ ] **1.1 Work.**', '- [ ] **1.2 Work.**'] }));

    it('never dispatches the orchestrator onto a roadmap one of its own lanes holds', () => {
        const claims: ClaimView = {
            live: [{ session_id: 's1', roadmap_slug: 'road-to-a', lane: true, worktree: '/wt/a', branch: 'drain/a' }],
            dead: [],
        };
        const q = buildQueue([a, b], claims, TODAY, 's1');
        expect(q.next?.slug).toBe('road-to-b');
        const held = q.queue.find((e) => e.slug === 'road-to-a');
        expect(held?.bucket).toBe('claimed');
        expect(held?.lane).toEqual({ worktree: '/wt/a', branch: 'drain/a' });
    });

    it('keeps two lanes of one session on two roadmaps at once', () => {
        const claims: ClaimView = {
            live: [
                { session_id: 's1', roadmap_slug: 'road-to-a', lane: true },
                { session_id: 's1', roadmap_slug: 'road-to-b', lane: true },
            ],
            dead: [],
        };
        expect(buildQueue([a, b], claims, TODAY, 's2').next).toBeNull();
    });
});

describe('isTimeGated', () => {
    it('needs both a wait word and a date after today', () => {
        expect(isTimeGated('the window opens 2026-11-13', TODAY)).toBe(true);
        expect(isTimeGated('the window opened 2026-10-01', TODAY)).toBe(false);
        expect(isTimeGated('landed 2026-11-13 in a fixture name', TODAY)).toBe(false);
    });
});

describe('buildQueue — finish before start', () => {
    const gated90 = screen(
        'road-to-gated',
        roadmap({ done: 9, open: ['- [ ] held <!-- blocked-by: needs-owner -->'], blockers: OWNER_BLOCKER }),
    );
    const runnable40 = screen(
        'road-to-runnable',
        roadmap({ done: 4, open: Array.from({ length: 6 }, (_, i) => `- [ ] **${i}.1 Work.**`) }),
    );
    const unstarted = screen('road-to-new', roadmap({ done: 0, open: ['- [ ] **1.1 Work.**'] }));

    it('takes the started runnable roadmap, not the higher-percent gated one or a new one', () => {
        const q = buildQueue([gated90, runnable40, unstarted], NO_CLAIMS, TODAY);
        expect(q.next?.slug).toBe('road-to-runnable');
        expect(q.queue.map((e) => [e.slug, e.bucket, e.dispatchable])).toEqual([
            ['road-to-runnable', 'continue', true],
            ['road-to-new', 'start', false],
            ['road-to-gated', 'decide', false],
        ]);
    });

    it('lets an unstarted roadmap start only when nothing started can move', () => {
        const q = buildQueue([gated90, unstarted], NO_CLAIMS, TODAY);
        expect(q.next?.slug).toBe('road-to-new');
    });

    it('puts the gated roadmap into the owner batch instead of the dispatch order', () => {
        const q = buildQueue([gated90, runnable40], NO_CLAIMS, TODAY);
        expect(q.owner_questions).toEqual([{ roadmap: 'road-to-gated', blocker: 'needs-owner', steps: 1 }]);
        expect(q.queue.find((e) => e.slug === 'road-to-gated')?.dispatchable).toBe(false);
    });

    it('never dispatches a started roadmap with no runnable step, however often it is screened', () => {
        for (let i = 0; i < 3; i++) {
            const q = buildQueue([gated90], NO_CLAIMS, TODAY);
            expect(q.next).toBeNull();
        }
    });

    it('orders started roadmaps by fewest runnable steps first', () => {
        const nearly = screen('road-to-nearly', roadmap({ done: 2, open: ['- [ ] **9.1 Last.**'] }));
        const q = buildQueue([runnable40, nearly], NO_CLAIMS, TODAY);
        expect(q.queue.map((e) => e.slug)).toEqual(['road-to-nearly', 'road-to-runnable']);
    });
});

describe('buildQueue — claims across sessions', () => {
    const a = screen('road-to-a', roadmap({ done: 1, open: ['- [ ] **1.1 Work.**'] }));
    const b = screen('road-to-b', roadmap({ done: 1, open: ['- [ ] **1.1 Work.**', '- [ ] **1.2 Work.**'] }));

    it('two sessions over one estate never select the same roadmap', () => {
        const first = buildQueue([a, b], NO_CLAIMS, TODAY, 's1').next?.slug;
        const claims: ClaimView = { live: [{ session_id: 's1', roadmap_slug: first ?? null }], dead: [] };
        const second = buildQueue([a, b], claims, TODAY, 's2').next?.slug;
        expect(first).toBe('road-to-a');
        expect(second).toBe('road-to-b');
    });

    it('does not hide a session from its own claim', () => {
        const claims: ClaimView = { live: [{ session_id: 's1', roadmap_slug: 'road-to-a' }], dead: [] };
        expect(buildQueue([a, b], claims, TODAY, 's1').next?.slug).toBe('road-to-a');
    });

    it('resumes a dead session’s claimed roadmap in its worktree before anything else', () => {
        const claims: ClaimView = {
            live: [],
            dead: [{ session_id: 'gone', roadmap_slug: 'road-to-b', worktree: '/wt/b', branch: 'feat/b' }],
        };
        const q = buildQueue([a, b], claims, TODAY, 's2');
        expect(q.next?.bucket).toBe('resume');
        expect(q.next?.resume).toEqual({ worktree: '/wt/b', branch: 'feat/b', session_id: 'gone' });
    });
});

describe('screenEstate', () => {
    let root = '';
    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'drain-queue-'));
        fs.mkdirSync(path.join(root, 'agents/roadmaps/later'), { recursive: true });
    });
    afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

    it('screens active non-draft roadmaps only', () => {
        const dir = path.join(root, 'agents/roadmaps');
        fs.writeFileSync(path.join(dir, 'road-to-a.md'), roadmap({ done: 1, open: ['- [ ] x'] }));
        fs.writeFileSync(path.join(dir, 'road-to-d.md'), roadmap({ done: 1, open: ['- [ ] x'], status: 'draft' }));
        fs.writeFileSync(path.join(dir, 'later', 'road-to-l.md'), roadmap({ done: 1, open: ['- [ ] x'] }));
        expect(screenEstate(root, TODAY).map((s) => s.slug)).toEqual(['road-to-a']);
    });
});
