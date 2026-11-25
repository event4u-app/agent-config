// The match briefs: every role gets the same task verbatim, no brief names a
// line, the judge never learns an angle, and an unfilled verdict is refused.

import { describe, expect, it } from 'vitest';

import { RUBRIC, validateVerdict } from '../../../src/scripts/bracket/engine.js';
import { matchBriefs, RUBRIC_ANCHORS, verdictSkeleton } from '../../../src/scripts/bracket/roles.js';
import { dealAngles } from '../../../src/scripts/bracket/deck.js';

const task = 'pick the caching strategy for the price API\n';
const [ca, cb] = dealAngles(2, 9);
const seat = { id: 'judge-1', family: 'fam-a', billing: 'subscription' as const };
const briefs = matchBriefs({
    task,
    match: 'R1M1',
    round: 1,
    a: { angle: ca! },
    b: { angle: cb! },
    dir: '/run/matches/R1M1',
    seat,
});

describe('match briefs', () => {
    it('produces both attacks, both defences and one judge brief', () => {
        expect(Object.keys(briefs).sort()).toEqual(['attack-a', 'attack-b', 'defend-a', 'defend-b', 'judge']);
    });

    it('carries the task verbatim into every role', () => {
        for (const b of Object.values(briefs)) expect(b).toContain(task);
    });

    it('never shows the judge any part of either angle', () => {
        for (const c of [ca!, cb!]) {
            for (const axis of ['reasoning', 'workflow', 'strategy'] as const) {
                expect(briefs.judge).not.toContain(c[axis].name);
                expect(briefs.judge).not.toContain(c[axis].how);
            }
        }
        expect(briefs.judge.toLowerCase()).not.toContain('lineage');
    });

    it('points every role at match-local copies, never at a line file', () => {
        for (const b of Object.values(briefs)) expect(b).not.toMatch(/lines\/|L\d{3}/);
        expect(briefs['attack-a']).toContain('/run/matches/R1M1/original-b.md');
        expect(briefs['attack-a']).toContain('/run/matches/R1M1/attacks-on-b.md');
        expect(briefs['defend-b']).toContain('/run/matches/R1M1/original-b.md');
    });

    it('tells attackers and defenders to keep identity out of what the judge reads', () => {
        for (const role of ['attack-a', 'attack-b', 'defend-a', 'defend-b'] as const) expect(briefs[role]).toContain('Write nothing that names a line id');
    });

    it('names every rubric criterion with its anchors in the judge brief', () => {
        for (const k of Object.keys(RUBRIC)) {
            expect(briefs.judge).toContain(`- ${k} (weight`);
            expect(RUBRIC_ANCHORS[k as keyof typeof RUBRIC]).toBeTruthy();
        }
    });

    it('hands the judge a skeleton that collect refuses until it is filled in', () => {
        expect(briefs.judge).toContain(verdictSkeleton(seat));
        const skeleton = JSON.parse(verdictSkeleton(seat)) as Record<string, unknown>;
        expect(() => validateVerdict(skeleton)).toThrow();
        const scores = Object.fromEntries(Object.keys(RUBRIC).map((k) => [k, 6]));
        expect(() => validateVerdict({ ...skeleton, a: scores, b: scores, fatal: { a: 'none', b: 'none' }, pick: 'b' })).not.toThrow();
    });
});
