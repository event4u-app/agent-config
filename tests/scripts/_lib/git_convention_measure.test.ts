import { describe, expect, it } from 'vitest';

import { invalidReason } from '../../../src/scripts/_lib/git_convention.js';
import {
    AUTHOR_CAP_PER_HALF,
    MIN_BRANCHES,
    MIN_N,
    SHARE_BAR,
    SMALL_TEAM_SHARE_BAR,
    classifyBranch,
    measureBranches,
    measureSubjects,
    measureUpdateStyle,
    teamFile,
    type HistoryCommit,
} from '../../../src/scripts/_lib/git_convention_measure.js';

const c = (subject: string, author = 'a', files: number | null = 1): HistoryCommit => ({ author, email: `${author}@example.com`, subject, files });
const many = (n: number, subject: (i: number) => string, author: (i: number) => string = () => 'a'): HistoryCommit[] =>
    Array.from({ length: n }, (_, i) => c(subject(i), author(i)));

describe('measureSubjects', () => {
    it('establishes the dominant family over three authors at the capped bar', () => {
        const commits = many(60, (i) => (i % 10 === 0 ? 'Fix thing' : `feat: add ${i}`), (i) => `author${i % 4}`);
        const m = measureSubjects(commits);
        expect(m.capped).toBe(true);
        expect(m.bar).toBe(SHARE_BAR);
        expect(m.established).toBe('conventional');
        expect(m.halvesAgree).toBe(true);
        expect(m.reasons).toEqual([]);
    });

    it('stays below the bar on a mixed history and names the two strongest families', () => {
        const commits = many(60, (i) => (i % 2 === 0 ? `feat: add ${i}` : `[DEV-${i}] Add ${i}`), (i) => `author${i % 3}`);
        const m = measureSubjects(commits);
        expect(m.established).toBeNull();
        expect(m.strongest.sort()).toEqual(['conventional', 'ticket-prefix']);
        expect(m.reasons.join(' ')).toMatch(/< 80 %/);
    });

    it('never establishes a family on fewer than MIN_N eligible commits', () => {
        const m = measureSubjects(many(MIN_N - 1, (i) => `feat: add ${i}`));
        expect(m.established).toBeNull();
        expect(m.reasons.join(' ')).toContain(`< ${MIN_N}`);
        expect(m.strongest).toEqual(['conventional']);
    });

    it('caps each author per half so one prolific author cannot define the family', () => {
        // One author writes 50 ticket-prefix subjects in each half; three others write conventional ones.
        const newer = [...many(50, (i) => `[DEV-${i}] Change ${i}`, () => 'prolific'), ...many(15, (i) => `fix: n${i}`, (i) => `other${i % 3}`)];
        const older = [...many(50, (i) => `[DEV-${i}] Old ${i}`, () => 'prolific'), ...many(15, (i) => `fix: o${i}`, (i) => `other${i % 3}`)];
        const m = measureSubjects([...newer, ...older]);
        expect(m.capped).toBe(true);
        expect(m.cappedTotal).toBe(2 * (AUTHOR_CAP_PER_HALF + 15));
        expect(m.families.find((f) => f.family === 'ticket-prefix')?.count).toBe(2 * AUTHOR_CAP_PER_HALF);
        expect(m.established).toBeNull();
    });

    it('applies the stricter uncapped bar with one or two authors', () => {
        const commits = many(40, (i) => (i < 35 ? `feat: ${i}` : 'Fix thing'), (i) => (i % 2 === 0 ? 'x' : 'y'));
        const m = measureSubjects(commits);
        expect(m.capped).toBe(false);
        expect(m.bar).toBe(SMALL_TEAM_SHARE_BAR);
        expect(m.established).toBeNull();
    });

    it('drops bots, automation subjects and bulk imports before counting', () => {
        const m = measureSubjects([c('feat: a'), c('chore(deps): x', 'dependabot[bot]'), c('Bump x from 1 to 2'), c('feat: import', 'a', 900)]);
        expect(m.eligible).toBe(1);
        expect(m.excluded).toEqual({ bots: 1, automation: 1, bulk: 1 });
    });

    it('reads a migrating history from the newer half alone when it clears the bar', () => {
        const commits = [...many(40, (i) => `DEV-${i + 1} feat: n${i}`, (i) => `n${i % 3}`), ...many(40, (i) => `[DEV-${i + 1}] o${i}`, (i) => `o${i % 3}`)];
        const m = measureSubjects(commits);
        expect(m.halvesAgree).toBe(false);
        expect(m.migrating).toBe(true);
        expect(m.established).toBe('ticket-conventional');
    });
});

describe('measureBranches', () => {
    it('proposes the dominant shape as a branch_pattern the reader accepts', () => {
        const names = [...Array.from({ length: 12 }, (_, i) => `feat/DEV-${i + 1}-thing`), 'release/1.2', 'dependabot/npm/x'];
        const b = measureBranches(names);
        expect(b.sampled).toBe(13);
        expect(b.pattern).toBe('{type}/{ticket}-{slug}');
        expect(invalidReason('branch_pattern', b.pattern as string)).toBeNull();
    });

    it('reports no clear pattern below MIN_BRANCHES or on a mixed set', () => {
        expect(measureBranches(Array.from({ length: MIN_BRANCHES - 1 }, (_, i) => `feat/x${i}`)).pattern).toBeNull();
        const mixed = [...Array.from({ length: 6 }, (_, i) => `feat/x${i}`), ...Array.from({ length: 6 }, (_, i) => `DEV-${i + 1}-y`)];
        expect(measureBranches(mixed).pattern).toBeNull();
    });

    it('classifies every shape the reader accepts', () => {
        expect(classifyBranch('fix/DEV-1/thing')).toBe('{type}/{ticket}/{slug}');
        expect(classifyBranch('DEV-1/thing')).toBe('{ticket}/{slug}');
        expect(classifyBranch('DEV-1-thing')).toBe('{ticket}-{slug}');
        expect(classifyBranch('feature/thing')).toBe('{type}/{slug}');
        expect(classifyBranch('wip')).toBe('other');
    });
});

describe('measureUpdateStyle and teamFile', () => {
    it('counts merges of the default branch into a topic branch', () => {
        const s = measureUpdateStyle(["Merge branch 'main' into feat/x", "Merge remote-tracking branch 'origin/main' into y", 'Merge pull request #1 from a/b'], 'main');
        expect(s).toEqual({ merges: 3, baseMerges: 2, observed: 'merge' });
        expect(measureUpdateStyle(['Merge pull request #1 from a/b'], 'main').observed).toBe('linear');
    });

    it('writes only the keys a choice maps to, never update_strategy', () => {
        expect(teamFile('ticket-conventional', '{ticket}-{slug}')).toBe('git:\n  commit_format: ticket-conventional\n  branch_pattern: "{ticket}-{slug}"\n');
        expect(teamFile('conventional', null)).toBe('git:\n  commit_format: ticket-scope\n');
        expect(teamFile('ticket-prefix', null)).toBeNull();
        expect(teamFile('gitmoji', '{type}/{slug}')).not.toContain('commit_format');
        expect(teamFile('conventional', '{type}/{slug}')).not.toContain('update_strategy');
    });
});
