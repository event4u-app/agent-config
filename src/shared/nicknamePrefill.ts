/**
 * What to put in the nickname field before the user types anything.
 *
 * Phase 4 step 2 of `road-to-zero-ceremony-settings`: *"Ask the nickname once,
 * prefilled from git user name then `$USER`, so accepting is one keypress."*
 * `src/rules/settings-ask-protocol.md` states the chain and closes it with a
 * negation — **"Never `$USER` alone."**
 *
 * WHY THIS MODULE EXISTS. The rule shipped that chain; the one surface that
 * actually prefills shipped a different one. `src/server/routes/ping.ts` read
 * `userInfo().username` and nothing else — precisely the `$USER`-alone shape the
 * rule forbids. A rule and the code it describes disagreeing is drift, not a
 * preference, so the chain now has exactly one implementation and both the
 * server route and the tests read it from here.
 *
 * WHY GIT COMES FIRST. `$USER` is a login handle (`mathiasberg`); `git config
 * user.name` is the name the human chose to be called by (`Mathias Berg`). The
 * whole point of the prefill is that accepting costs one keypress, and that only
 * holds when the prefilled value is the one they would have typed. Note the
 * lookup is deliberately NOT `--local`: the merged config includes
 * `~/.gitconfig`, so the wizard still finds a name when it runs outside a repo.
 *
 * Pure: the git lookup is injected, so the resolver is a function of its probe
 * alone and a test never depends on the machine it runs on — the same shape as
 * `interactiveContext.ts` and `settingsConsent.ts`. The Node-side half (running
 * git, falling back to `userInfo()`) lives in `src/server/nicknameResolver.ts`,
 * because `src/shared/**` may not import Node built-ins and the lint enforces it.
 *
 * @see src/server/nicknameResolver.ts — the impure half
 * @see src/rules/settings-ask-protocol.md § Worked example — the nickname
 * @see docs/contracts/settings-classes.md
 */

/**
 * Where a candidate name came from, so a caller can say so.
 *
 * `os-account` is the `userInfo()` floor, and it is a distinct member rather
 * than a reuse of `env-user` on purpose: the whole claim of the floor is that
 * its RANK changed (last, not first), and a rank nothing can observe is not a
 * rank. A caller reporting provenance would otherwise name the wrong rung on
 * exactly the path the floor exists to serve.
 *
 * `none` is a real outcome, not an error: a machine with no git identity, no
 * `USER` and no resolvable account is unusual but legal, and the ask still
 * works — it just starts empty.
 */
export type NicknameSource =
    | 'git-user-name'
    | 'env-user'
    | 'env-username'
    | 'os-account'
    | 'none';

export interface NicknamePrefill {
    /** The prefill value, or `''` when nothing resolved. */
    name: string;
    source: NicknameSource;
}

export interface NicknameProbe {
    /** `process.env`, or a fixture. */
    env: NodeJS.ProcessEnv;
    /**
     * `git config user.name`, or `undefined` when git is absent, unconfigured,
     * or too slow. Injected so the resolver stays pure.
     */
    gitUserName?: string | undefined;
}

/** Trim, and treat a whitespace-only value as absent. */
function _clean(value: string | undefined): string {
    return (value ?? '').trim();
}

/**
 * The prefill for the nickname ask, following the documented chain.
 *
 * Order is the rule's, and the negation at the end of it is the load-bearing
 * part: `$USER` is a fallback, never the first answer.
 */
export function nicknamePrefill(probe: NicknameProbe): NicknamePrefill {
    const git = _clean(probe.gitUserName);
    if (git !== '') {
        return { name: git, source: 'git-user-name' };
    }
    const user = _clean(probe.env['USER']);
    if (user !== '') {
        return { name: user, source: 'env-user' };
    }
    // Windows spells it differently; the rule names it explicitly.
    const username = _clean(probe.env['USERNAME']);
    if (username !== '') {
        return { name: username, source: 'env-username' };
    }
    return { name: '', source: 'none' };
}
