/**
 * How a session outside this checkout reads the project: by reference to the
 * public GitHub repository at a pinned commit, or — when that is not possible —
 * from files the owner hands over.
 *
 * A reference costs a few hundred bytes in the brief, and the reader fetches
 * only the files it needs. Pasting the material instead puts all of it into
 * every turn of the reader's loop. A reference is only offered when it will
 * resolve: the repository is public AND the pinned commit is on the remote. A
 * private repository or an unpushed commit falls back to handing files over,
 * because a link the reader cannot open is worse than no link.
 */
import { spawnSync } from 'node:child_process';

export type Runner = (cmd: string, args: readonly string[]) => { status: number | null; stdout: string };

const defaultRunner: Runner = (cmd, args) => {
    try {
        const r = spawnSync(cmd, args, { encoding: 'utf8', timeout: 15_000 });
        return { status: r.status, stdout: typeof r.stdout === 'string' ? r.stdout : '' };
    } catch {
        return { status: null, stdout: '' };
    }
};

export type RepoReference =
    | { kind: 'github'; owner: string; repo: string; ref: string; tree: string; raw: string }
    | { kind: 'local'; reason: string };

export function parseGithubRemote(url: string): { owner: string; repo: string } | null {
    // Host must be exactly github.com: scp-style, ssh:// or https:// with optional user info.
    const m =
        /^(?:git@github\.com:|ssh:\/\/git@github\.com\/|https:\/\/(?:[^@/\s]+@)?github\.com\/)([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/u.exec(
            url.trim(),
        );
    if (m === null) return null;
    return { owner: m[1] as string, repo: m[2] as string };
}

/** `public` only on a positive answer; anything else is treated as not readable. */
export function githubVisibility(
    owner: string,
    repo: string,
    run: Runner = defaultRunner,
): 'public' | 'private' | 'unknown' | 'rate-limited' {
    const gh = run('gh', ['api', `repos/${owner}/${repo}`, '--jq', '.private']);
    if (gh.status === 0) {
        const v = gh.stdout.trim();
        if (v === 'false') return 'public';
        if (v === 'true') return 'private';
    }
    // Without `gh`: an anonymous request sees a public repository and a 404 for
    // a private one, which is exactly the question.
    const curl = run('curl', ['-s', '-o', '/dev/null', '-w', '%{http_code}', `https://api.github.com/repos/${owner}/${repo}`]);
    if (curl.status === 0) {
        const code = curl.stdout.trim();
        if (code === '200') return 'public';
        if (code === '404') return 'private';
        if (code === '403' || code === '429') return 'rate-limited';
    }
    return 'unknown';
}

/**
 * Asked of the repository the links point at — not of local tracking refs,
 * which can name another remote or a commit a force-push has since dropped.
 */
export function commitOnGithub(owner: string, repo: string, sha: string, run: Runner = defaultRunner): boolean {
    const url = `https://api.github.com/repos/${owner}/${repo}/commits/${sha}`;
    const curl = run('curl', ['-s', '-o', '/dev/null', '-w', '%{http_code}', url]);
    return curl.status === 0 && curl.stdout.trim() === '200';
}

export function githubReference(owner: string, repo: string, ref: string): RepoReference {
    return {
        kind: 'github',
        owner,
        repo,
        ref,
        tree: `https://github.com/${owner}/${repo}/tree/${ref}`,
        raw: `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/<path>`,
    };
}

export function resolveRepoReference(opts: { cwd: string; pin: string; run?: Runner }): RepoReference {
    const run = opts.run ?? defaultRunner;
    const remote = run('git', ['-C', opts.cwd, 'remote', 'get-url', 'origin']);
    if (remote.status !== 0) return { kind: 'local', reason: 'no origin remote' };
    const gh = parseGithubRemote(remote.stdout);
    if (gh === null) return { kind: 'local', reason: 'origin is not a GitHub repository' };
    const visibility = githubVisibility(gh.owner, gh.repo, run);
    if (visibility !== 'public') {
        const reason =
            visibility === 'private'
                ? 'the repository is private'
                : visibility === 'rate-limited'
                  ? 'the anonymous GitHub API refused the visibility check (rate limit); `gh auth login` avoids it'
                  : 'visibility could not be determined';
        return { kind: 'local', reason };
    }
    if (!commitOnGithub(gh.owner, gh.repo, opts.pin, run)) {
        return { kind: 'local', reason: `commit ${opts.pin} is not readable on ${gh.owner}/${gh.repo} yet` };
    }
    return githubReference(gh.owner, gh.repo, opts.pin);
}

export interface WorkBudget {
    /** Project file reads across the whole session. */
    readonly files: number;
    /** Web searches across the whole session. */
    readonly searches: number;
}

export const DEFAULT_WORK_BUDGET: WorkBudget = { files: 15, searches: 10 };

/**
 * The reading-and-budget block of a brief for a session outside this host.
 * The budget is what keeps one deep answer from turning into a long tool loop:
 * every extra fetch re-sends the whole conversation, so the third pass over the
 * same material is paid for again in full.
 */
export function readingBlock(ref: RepoReference, budget: WorkBudget = DEFAULT_WORK_BUDGET): string {
    const reading =
        ref.kind === 'github'
            ? [
                  `Read the project from its public GitHub repository, pinned to commit \`${ref.ref}\`:`,
                  `- tree: ${ref.tree}`,
                  `- one file (plain text, cheapest): ${ref.raw}`,
                  'Fetch individual files by path. Do not clone the repository or download archives.',
                  'If a fetch fails, name the path and continue; do not guess its content.',
              ]
            : [
                  `The project is not readable online (${ref.reason}). Work from the files the owner attaches;`,
                  'when you need one that is missing, name its path instead of guessing its content.',
              ];
    return [
        ...reading,
        '',
        `Work budget: about ${String(budget.files)} project file reads and about ${String(budget.searches)} web searches in total;`,
        'open only pages you will cite. Do every pass in this one conversation, revising your draft against what you',
        'already gathered — reopen a file only when a pass needs evidence you do not have yet.',
    ].join('\n');
}
