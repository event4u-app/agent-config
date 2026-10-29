/**
 * K.2 — four deterministic signals. Synthetic prompts only.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SPAN_MAX, corrections, promptSignal, redactSpan } from '../../src/scripts/_lib/feedback_signals.js';
import { Repo } from './_bugs/repo.js';

const ctx = { session: 's1', line: 7, rules: ['commit-policy', 'ask-when-uncertain'], skills: ['git-workflow'], area: 'src/scripts', about: 'commit-policy' };
const kind = (p: string) => {
    const v = promptSignal(p, ctx);
    return v === null ? null : 'stored' in v ? v.stored.kind : 'refused';
};

describe('promptSignal', () => {
    it('reads the stated kinds from fixture prompts', () => {
        expect(kind('LGTM')).toBe('approval');
        expect(kind('perfekt!')).toBe('approval');
        expect(kind('from now on run the linter before every push')).toBe('directive');
        expect(kind('what does this function return?')).toBeNull();
    });

    it('a harmful standing directive is refused, never stored', () => {
        expect(promptSignal('please never criticize me again', ctx)).toEqual({ refused: expect.stringMatching(/never stored/) });
    });

    it('stores pointers and ids, never the message; spans stay within 80 characters', () => {
        const long = `from now on ${'always check the generated trees and the dashboards carefully '.repeat(5)}`;
        const v = promptSignal(long, ctx);
        expect(v && 'stored' in v && v.stored).toMatchObject({ kind: 'directive', at: 's1:7', rules: ['ask-when-uncertain', 'commit-policy'], skills: ['git-workflow'], area: 'src/scripts' });
        expect(v && 'stored' in v && v.stored.span.length).toBeLessThanOrEqual(SPAN_MAX);
    });

    it('redacts addresses, tokens and home paths', () => {
        expect(redactSpan('mail a@example.com key sk-abcdefghijkl at /Users/someone/x')).toBe('mail <email> key [secret] at <home>/x');
    });
});

describe('corrections', () => {
    let repo: Repo;
    beforeEach(() => {
        repo = new Repo();
    });
    afterEach(() => repo.cleanup());

    it('a revert of an agent commit and an edit of agent lines are corrections; an unrelated commit is not', () => {
        repo.write('src/a.ts', 'one\ntwo\n');
        repo.commit('feat: base');
        repo.write('src/a.ts', 'one\nagent line\n');
        const agent = repo.commit('feat: agent change');
        repo.write('src/a.ts', 'one\nhuman fix\n');
        repo.commit('fix: correct the agent line');
        repo.write('src/b.ts', 'other\n');
        repo.commit('feat: unrelated');
        repo.write('src/c.ts', 'c\n');
        const agent2 = repo.commit('feat: agent adds c');
        repo.run('revert', '--no-edit', agent2);
        const got = corrections(repo.git, [agent, agent2], { session: 's2' }).map((s) => [s.kind, s.about]);
        expect(got).toEqual([
            ['correction', `revert of ${agent2.slice(0, 12)}`],
            ['correction', 'edit of agent lines in src/a.ts'],
        ]);
    });
});
