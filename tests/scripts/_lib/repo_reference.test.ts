import { describe, expect, it } from 'vitest';

import {
    DEFAULT_WORK_BUDGET,
    githubReference,
    githubVisibility,
    parseGithubRemote,
    readingBlock,
    resolveRepoReference,
    type Runner,
} from '../../../src/scripts/_lib/repo_reference.js';

/**
 * Answers keyed by `<cmd> <first positional word>`, except curl, which is keyed
 * `curl repo` or `curl commit` by the URL it asks; anything unlisted fails.
 */
function fake(answers: Record<string, { status: number | null; stdout: string }>): Runner {
    return (cmd, args) => {
        const word =
            cmd === 'curl'
                ? (args[args.length - 1] ?? '').includes('/commits/')
                    ? 'commit'
                    : 'repo'
                : (args.find((a) => !a.startsWith('-') && a !== '/r') ?? '');
        return answers[`${cmd} ${word}`] ?? { status: 1, stdout: '' };
    };
}

const PUBLIC = {
    'git remote': { status: 0, stdout: 'git@github.com:acme/widget.git\n' },
    'gh api': { status: 0, stdout: 'false\n' },
    'curl commit': { status: 0, stdout: '200' },
};

describe('parseGithubRemote', () => {
    it('reads scp, ssh and https remotes, with and without .git', () => {
        expect(parseGithubRemote('git@github.com:acme/widget.git')).toEqual({ owner: 'acme', repo: 'widget' });
        expect(parseGithubRemote('https://github.com/acme/widget')).toEqual({ owner: 'acme', repo: 'widget' });
        expect(parseGithubRemote('https://github.com/acme/widget.git\n')).toEqual({ owner: 'acme', repo: 'widget' });
        expect(parseGithubRemote('ssh://git@github.com/acme/widget.git')).toEqual({ owner: 'acme', repo: 'widget' });
        expect(parseGithubRemote('https://token@github.com/acme/widget')).toEqual({ owner: 'acme', repo: 'widget' });
    });

    it('refuses anything whose host is not exactly github.com', () => {
        expect(parseGithubRemote('git@gitlab.com:acme/widget.git')).toBeNull();
        expect(parseGithubRemote('https://notgithub.com/acme/widget.git')).toBeNull();
        expect(parseGithubRemote('https://evil.example/github.com/acme/widget')).toBeNull();
        expect(parseGithubRemote('https://github.com.evil.example/acme/widget')).toBeNull();
        expect(parseGithubRemote('')).toBeNull();
    });
});

describe('githubVisibility', () => {
    it('trusts gh first, then an anonymous API status, else unknown', () => {
        expect(githubVisibility('a', 'b', fake({ 'gh api': { status: 0, stdout: 'false' } }))).toBe('public');
        expect(githubVisibility('a', 'b', fake({ 'gh api': { status: 0, stdout: 'true' } }))).toBe('private');
        expect(githubVisibility('a', 'b', fake({ 'curl repo': { status: 0, stdout: '200' } }))).toBe('public');
        expect(githubVisibility('a', 'b', fake({ 'curl repo': { status: 0, stdout: '404' } }))).toBe('private');
        expect(githubVisibility('a', 'b', fake({ 'curl repo': { status: 0, stdout: '403' } }))).toBe('rate-limited');
        expect(githubVisibility('a', 'b', fake({}))).toBe('unknown');
    });

    it('a rate-limited check says so in the fallback reason', () => {
        const run = fake({ 'git remote': PUBLIC['git remote'], 'curl repo': { status: 0, stdout: '403' } });
        const ref = resolveRepoReference({ cwd: '/r', pin: 'abc', run });
        expect(ref.kind).toBe('local');
        expect(ref.kind === 'local' && ref.reason).toMatch(/rate limit/);
    });
});

describe('resolveRepoReference', () => {
    it('references GitHub only when the repo is public and the commit is readable there', () => {
        const ref = resolveRepoReference({ cwd: '/r', pin: 'abc', run: fake(PUBLIC) });
        expect(ref).toEqual(githubReference('acme', 'widget', 'abc'));
    });

    it('falls back to local for a private repo, an unreadable commit, or no remote', () => {
        const priv = resolveRepoReference({ cwd: '/r', pin: 'abc', run: fake({ ...PUBLIC, 'gh api': { status: 0, stdout: 'true' } }) });
        expect(priv).toEqual({ kind: 'local', reason: 'the repository is private' });
        // Asked of the GitHub repository itself: a commit known only to a local
        // tracking ref or another remote does not count.
        const unpushed = resolveRepoReference({ cwd: '/r', pin: 'abc', run: fake({ ...PUBLIC, 'curl commit': { status: 0, stdout: '404' } }) });
        expect(unpushed).toEqual({ kind: 'local', reason: 'commit abc is not readable on acme/widget yet' });
        expect(resolveRepoReference({ cwd: '/r', pin: 'abc', run: fake({}) })).toEqual({ kind: 'local', reason: 'no origin remote' });
    });

    it('a lookalike host never becomes a reference', () => {
        const run = fake({ ...PUBLIC, 'git remote': { status: 0, stdout: 'https://notgithub.com/acme/widget.git\n' } });
        expect(resolveRepoReference({ cwd: '/r', pin: 'abc', run })).toEqual({ kind: 'local', reason: 'origin is not a GitHub repository' });
    });
});

describe('readingBlock', () => {
    it('a GitHub reference names the pinned tree and the raw-file pattern, plus the budget', () => {
        const text = readingBlock(githubReference('acme', 'widget', 'abc'));
        expect(text).toContain('https://github.com/acme/widget/tree/abc');
        expect(text).toContain('https://raw.githubusercontent.com/acme/widget/abc/<path>');
        expect(text).toContain(`about ${String(DEFAULT_WORK_BUDGET.files)} project file reads`);
        expect(text).not.toContain('attaches');
    });

    it('a local fallback asks for attachments and states why', () => {
        const text = readingBlock({ kind: 'local', reason: 'the repository is private' }, { files: 5, searches: 2 });
        expect(text).toContain('the repository is private');
        expect(text).toContain('attaches');
        expect(text).toContain('about 5 project file reads and about 2 web searches');
        expect(text).not.toContain('raw.githubusercontent.com');
    });
});
