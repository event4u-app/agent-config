/**
 * Transient-failure handling for `gh` calls in the release pipeline.
 *
 * `gh` does not retry GitHub's 5xx responses — including the pre-flight
 * "does a PR already exist" GraphQL query it runs before every `pr create`.
 * The release run therefore dies at whichever step happens to catch the
 * outage, after the commit and the push already landed.
 *
 * Pure over strings and an injected executor so the classifier and the retry
 * loop are exercised by the fixture tests without a network or a real sleep.
 */

export interface GhRunResult {
    returncode: number;
    stdout: string;
    stderr: string;
}

/** Backoff between attempts. Length is the retry budget: three retries, ~23s. */
export const GH_RETRY_DELAYS_MS = [2_000, 6_000, 15_000] as const;

/**
 * Retry-worthy failures only. A 4xx is the caller's fault and repeating it
 * just delays the real message — the one exception is 429, which is the same
 * wait-and-repeat shape as a 5xx.
 */
const _TRANSIENT_RE =
    /HTTP 5\d\d|HTTP 429|No server is currently available|Something went wrong while executing your query|exceeded a secondary rate limit|\b(?:ETIMEDOUT|ECONNRESET|EAI_AGAIN)\b|TLS handshake timeout/;

/**
 * Whether `stderr` describes a transient GitHub failure.
 *
 * Deliberately reads stderr ALONE. `gh` writes errors there, while stdout on a
 * failing call can still carry payload the caller asked for (`pr view --json
 * body`) — and a changelog body that happens to quote `HTTP 500` must not turn
 * a permanent failure into three pointless retries.
 */
export function is_transient_gh_failure(stderr: string): boolean {
    return _TRANSIENT_RE.test(stderr);
}

/**
 * `gh` argv rendered for an error line, long values elided.
 *
 * The release-PR body is passed as a single `--body` argument and runs to tens
 * of thousands of characters. Rendering argv verbatim is what buried the real
 * one-line `gh` error under a 22k dump on 14.0.0.
 */
export function gh_argv_label(args: readonly string[], max = 60): string {
    return ['gh', ...args].map((a) => (a.length > max ? `${a.slice(0, max - 1)}…` : a)).join(' ');
}

/**
 * Run `gh <args>` through `exec`, repeating while the failure is transient and
 * the budget lasts. Returns the last result — classifying it is the caller's
 * job, so a `check: false` probe keeps its own fallback behaviour.
 *
 * `sleep` and `notify` are injected rather than called directly so the loop is
 * testable without a real 23-second wait, and so a caller running under a test
 * exec-override can pass a no-op sleep while the delay sequence itself still
 * runs and can be asserted.
 */
export function gh_retry(
    args: readonly string[],
    exec: (argv: readonly string[]) => GhRunResult,
    opts: { sleep?: (ms: number) => void; notify?: (message: string) => void } = {},
): GhRunResult {
    let result = exec(['gh', ...args]);
    for (let i = 0; result.returncode !== 0 && i < GH_RETRY_DELAYS_MS.length; i++) {
        if (!is_transient_gh_failure(result.stderr)) {
            break;
        }
        const ms = GH_RETRY_DELAYS_MS[i]!;
        const first = result.stderr.trim().split('\n')[0] ?? '';
        opts.notify?.(`↻  ${gh_argv_label(args, 24)} — transient GitHub failure, retry in ${ms / 1_000}s: ${first}`);
        opts.sleep?.(ms);
        result = exec(['gh', ...args]);
    }
    return result;
}
