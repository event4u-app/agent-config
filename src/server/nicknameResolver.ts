/**
 * The Node-side half of the nickname prefill — running git, and the last-resort
 * `userInfo()` floor.
 *
 * The order itself is pure and lives in `src/shared/nicknamePrefill.ts`; this
 * file exists only because `src/shared/**` may not import Node built-ins (the
 * `no-restricted-imports` lint enforces it, and the split is the point: the
 * chain stays testable without a machine, the I/O stays where I/O belongs).
 *
 * @see src/shared/nicknamePrefill.ts — the chain
 * @see src/rules/settings-ask-protocol.md § Worked example — the nickname
 */

import { execFileSync } from 'node:child_process';
import { userInfo } from 'node:os';

import { nicknamePrefill, type NicknamePrefill } from '../shared/nicknamePrefill.js';

/**
 * `git config user.name`, or `undefined`.
 *
 * Every failure mode collapses to `undefined` on purpose — no git on PATH, no
 * name configured (exit 1), a slow or hung invocation. A prefill is a
 * convenience; it must never delay or break the surface that wanted it, which
 * is why this carries its own short timeout instead of trusting the caller's.
 *
 * Deliberately NOT `--local`: the merged config includes `~/.gitconfig`, so the
 * wizard still finds a name when it runs outside a repository.
 */
export function readGitUserName(): string | undefined {
    try {
        const out = execFileSync('git', ['config', 'user.name'], {
            encoding: 'utf8',
            timeout: 1000,
            stdio: ['ignore', 'pipe', 'ignore'],
        });
        const name = out.trim();
        return name === '' ? undefined : name;
    } catch {
        return undefined;
    }
}

/** The documented chain, resolved against the real machine. */
export function resolveNicknamePrefill(
    env: NodeJS.ProcessEnv = process.env,
): NicknamePrefill {
    const resolved = nicknamePrefill({ env, gitUserName: readGitUserName() });
    if (resolved.source !== 'none') {
        return resolved;
    }
    // `userInfo()` is what the previous implementation used ALONE. Kept as a
    // floor rather than dropped: on a machine with neither a git identity nor a
    // USER variable it is the only remaining answer, and an empty prefill is
    // strictly worse than a login handle. What changed is its rank — last,
    // not first — and it reports `os-account` so that rank is observable.
    try {
        const name = userInfo().username;
        if (typeof name === 'string' && name.trim() !== '') {
            return { name: name.trim(), source: 'os-account' };
        }
    } catch {
        // No resolvable user — an empty prefill is a legal outcome.
    }
    return resolved;
}

let _cached: NicknamePrefill | undefined;

/**
 * `resolveNicknamePrefill`, computed at most once per process.
 *
 * The uncached function forks git, and `execFileSync` blocks the event loop for
 * up to its timeout. That is fine once and not fine per request: `GET
 * /api/v1/ping` is a liveness probe polled by the UI bundle and by CI smoke
 * tests, so an un-memoised call there stalls every other route behind a
 * subprocess on a cold or network-backed PATH.
 *
 * Caching is safe because the answer is machine-static for the process
 * lifetime — a git identity or a `USER` variable does not change under a
 * running server — and it is deliberately NOT hidden inside
 * `resolveNicknamePrefill` itself: a general-purpose resolver that silently
 * ignores a changed environment is a trap for the next caller. The server opts
 * in by name.
 */
export function cachedNicknamePrefill(): NicknamePrefill {
    _cached ??= resolveNicknamePrefill();
    return _cached;
}

/** Drop the memo. Tests only — a process never needs this. */
export function _resetNicknamePrefillCache(): void {
    _cached = undefined;
}
