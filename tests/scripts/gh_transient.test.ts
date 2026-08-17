// A release must not die of a GitHub outage after it has already pushed.
//
// Measured 2026-08-17 on the 14.0.0 release. Steps 1-4 completed — the bump,
// the era split, the commit and the push all landed — and step 5 died here:
//
//     error checking for existing pull request: HTTP 503: No server is
//     currently available to service your request. …
//     (https://api.github.com/graphql)
//
// That line is `gh`'s pre-flight GraphQL query, not the create mutation, and
// `gh` does not retry it. Reproduced the same day with `gh pr create
// --dry-run` against the same branch and the same 22k body: attempts 1 and 2
// red with that exact message, attempt 3 green. So the failure was transient
// and the run threw it away anyway, leaving a pushed release branch with no PR.
//
// The operator saw none of that. `run()` was called with `capture: false`, so
// the throw carried a `CalledProcessError` whose argv dump printed the entire
// `--body` argument — 22,289 characters — and Node truncated it at 10k with
// "… 12255 more characters". The one line that said what happened was above
// the fold of a stack trace nobody could read. Hence `gh_argv_label`: argv is
// rendered for humans, long values elided, and the death carries gh's own
// stderr instead of the command that produced it.
//
// One consequence of the fix is worth stating where it will be read before
// someone "simplifies" it. Retrying requires reading stderr, and reading
// stderr requires `capture: true`, but three of the five converted call sites
// — `pr create`, `pr edit`, `release create` — previously inherited stdio and
// printed the PR or release URL the operator is waiting for. Forcing capture
// silently swallowed it. So `release.ts`'s wrapper echoes stdout back for
// exactly the mutating calls (`check: true`) and stays quiet for the probes,
// whose stdout is JSON destined for the caller rather than for the log.
//
// The narrative lives here rather than in `_lib/gh_transient.ts` because
// `src/**/*.ts` carries a growth ratchet (`check_source_size_budget`) and
// `tests/` does not — the same reason `release_push_failure_masking.test.ts`
// documents its two measured failures here.
import { describe, expect, it } from 'vitest';

import {
    GH_RETRY_DELAYS_MS,
    gh_argv_label,
    gh_retry,
    is_transient_gh_failure,
    type GhRunResult,
} from '../../src/scripts/_lib/gh_transient.js';

/** The 14.0.0 failure, verbatim from the reproduction. */
const REAL_503 =
    'error checking for existing pull request: HTTP 503: No server is currently available to ' +
    'service your request. Sorry about that. Please try resubmitting your request and contact ' +
    'us if the problem persists. (https://api.github.com/graphql)';

function ok(stdout = ''): GhRunResult {
    return { returncode: 0, stdout, stderr: '' };
}

function fail(stderr: string, stdout = ''): GhRunResult {
    return { returncode: 1, stdout, stderr };
}

describe('is_transient_gh_failure — retry the outage, never the caller error', () => {
    it('recognises the measured 14.0.0 failure', () => {
        expect(is_transient_gh_failure(REAL_503)).toBe(true);
    });

    it.each([
        ['plain 500', 'HTTP 500: Internal Server Error'],
        ['bad gateway', 'HTTP 502: Bad Gateway (https://api.github.com/graphql)'],
        ['gateway timeout', 'HTTP 504: Gateway Timeout'],
        ['secondary rate limit', 'You have exceeded a secondary rate limit. Please wait a few minutes'],
        ['explicit 429', 'HTTP 429: Too Many Requests'],
        ['graphql wobble', 'Something went wrong while executing your query'],
        ['socket timeout', 'dial tcp: i/o timeout ETIMEDOUT'],
        ['reset connection', 'read: ECONNRESET'],
        ['dns wobble', 'lookup api.github.com: EAI_AGAIN'],
        ['tls', 'net/http: TLS handshake timeout'],
    ])('retries %s', (_label, stderr) => {
        expect(is_transient_gh_failure(stderr)).toBe(true);
    });

    // Near-misses probing the direction the classifier opened. A 4xx is the
    // caller's fault: repeating it burns 23 seconds and then reports the same
    // thing, so the operator waits longer to learn less. `already exists` is
    // the one that matters most in practice — it is what a resumed run hits,
    // and retrying it would mask a state question behind a timeout.
    it.each([
        ['unprocessable', 'HTTP 422: No commits between main and release/14.0.0'],
        ['not found', 'HTTP 404: Not Found'],
        ['forbidden', 'HTTP 403: Resource not accessible by integration'],
        ['duplicate PR', 'a pull request for branch "release/14.0.0" into branch "main" already exists'],
        ['auth', 'gh: To use GitHub CLI in a GitHub Actions workflow, set the GH_TOKEN environment variable'],
        ['silence', ''],
    ])('does not retry %s', (_label, stderr) => {
        expect(is_transient_gh_failure(stderr)).toBe(false);
    });

    // The reason the classifier reads stderr alone. `gh pr view --json body`
    // puts the release-PR body on stdout, and this project's own changelog
    // quotes HTTP statuses. Classifying the merged streams would let a
    // changelog line decide whether a permanent failure gets retried.
    it('ignores an outage-shaped string that is only on stdout', () => {
        const r = fail('HTTP 422: validation failed', 'body text mentioning HTTP 503 in a changelog entry');
        expect(is_transient_gh_failure(r.stderr)).toBe(false);
    });
});

describe('gh_argv_label — the 22k body never reaches an error line', () => {
    it('elides a long argument and keeps the command readable', () => {
        const body = 'x'.repeat(22_289);
        const label = gh_argv_label(['pr', 'create', '--base', 'main', '--body', body]);
        expect(label.length).toBeLessThan(200);
        expect(label).toContain('gh pr create --base main --body');
        expect(label).toContain('…');
        expect(label).not.toContain('x'.repeat(100));
    });

    it('leaves short argv untouched', () => {
        expect(gh_argv_label(['pr', 'view', 'release/14.0.0'])).toBe('gh pr view release/14.0.0');
    });
});

describe('gh_retry — the loop that would have saved the 14.0.0 run', () => {
    function harness(results: readonly GhRunResult[]) {
        const calls: string[][] = [];
        const slept: number[] = [];
        const notes: string[] = [];
        const result = gh_retry(
            ['pr', 'create', '--head', 'release/14.0.0'],
            (argv) => {
                calls.push([...argv]);
                return results[Math.min(calls.length - 1, results.length - 1)]!;
            },
            { sleep: (ms) => slept.push(ms), notify: (m) => notes.push(m) },
        );
        return { calls, slept, notes, result };
    }

    it('reproduces the measured red-red-green sequence', () => {
        const { calls, slept, result } = harness([fail(REAL_503), fail(REAL_503), ok('https://pr/1')]);
        expect(calls).toHaveLength(3);
        expect(result.returncode).toBe(0);
        expect(slept).toEqual([GH_RETRY_DELAYS_MS[0], GH_RETRY_DELAYS_MS[1]]);
    });

    it('passes the gh prefix through on every attempt', () => {
        const { calls } = harness([fail(REAL_503), ok()]);
        expect(calls[0]![0]).toBe('gh');
        expect(calls[1]).toEqual(calls[0]);
    });

    it('does not retry a permanent failure', () => {
        const { calls, slept, result } = harness([fail('HTTP 422: No commits between main and release/14.0.0')]);
        expect(calls).toHaveLength(1);
        expect(slept).toEqual([]);
        expect(result.returncode).toBe(1);
    });

    it('gives up after the budget and returns the last failure for the caller to classify', () => {
        const { calls, slept, result } = harness([fail(REAL_503)]);
        expect(calls).toHaveLength(GH_RETRY_DELAYS_MS.length + 1);
        expect(slept).toEqual([...GH_RETRY_DELAYS_MS]);
        expect(result.returncode).toBe(1);
        expect(result.stderr).toBe(REAL_503);
    });

    it('does not call at all beyond the first when it already succeeded', () => {
        const { calls, slept } = harness([ok('https://pr/1')]);
        expect(calls).toHaveLength(1);
        expect(slept).toEqual([]);
    });

    // The retry is visible or it is a hang. A 23-second silent pause inside a
    // release run reads as a wedged process.
    it('announces each retry with the elided argv and gh’s first line', () => {
        const { notes } = harness([fail(REAL_503), ok()]);
        expect(notes).toHaveLength(1);
        expect(notes[0]).toContain('transient GitHub failure');
        expect(notes[0]).toContain('retry in 2s');
        expect(notes[0]).toContain('HTTP 503');
    });
});
