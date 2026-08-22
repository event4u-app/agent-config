/**
 * The stdin-read-failure policy, extracted from `dispatch_hook.ts`.
 *
 * These functions are pure with respect to dispatch_hook's own state: they take
 * what they need as parameters and return a verdict. They do call two imported
 * helpers (`readFd0ToEnd`, `isBlockCapable`), which move with them as imports. The module-level flag they feed, `_stdin_read_failed`, stays in
 * dispatch_hook.ts, written at exactly one call site and read at three. That
 * asymmetry is what makes moving the functions safe and the state untouched.
 *
 * Extracted because dispatch_hook.ts sits at the 1500-line source ceiling.
 */
import type { JsonObject } from './dispatch_hook.js';
import { readFd0ToEnd } from './hook_stdin.js';
import { isBlockCapable } from './host_semantics.js';

/**
 * The seam where a FAILED read becomes an empty string — isolated so the three
 * failure classes the policy names can be driven with real errno values.
 *
 * Returns the failure message, or `null` when the read succeeded. The read
 * itself is injectable for exactly one reason: `EAGAIN` exhaustion, `EIO` and
 * `EBADF` cannot be staged against a live fd 0 portably, and a policy whose
 * trigger is untestable is a policy nobody can show works. What the injection
 * does NOT buy is proof that the production path reaches here — that is the
 * wiring, pinned separately by driving `main()`.
 */
export function stdinReadFailure(read: () => string = readFd0ToEnd): {
  text: string;
  failure: string | null;
} {
  try {
    // Reads to EOF and retries on EAGAIN rather than treating it as empty
    // input; shared with the concern-side reader so both paths cannot drift.
    return { text: read(), failure: null };
  } catch (exc) {
    return { text: "", failure: exc instanceof Error ? exc.message : String(exc) };
  }
}

/**
 * Is this concern one whose verdict a failed read silently converted into an
 * allow?
 *
 * Both halves are required and neither is redundant. `fail_closed: true` is the
 * manifest's declaration that this concern's own crash must not become a pass;
 * `severity: blocking` is the declaration that it can refuse at all. An
 * advisory concern that happens to be `fail_closed` has no verdict to lose, and
 * a blocking concern that is not `fail_closed` has already declared the opposite
 * intent.
 */
export function _is_fail_closed_blocking(concern: JsonObject): boolean {
  const severity = String(concern["severity"] ?? "").trim().toLowerCase();
  return concern["fail_closed"] === true && severity === "blocking";
}

/**
 * `b-stdin-read-failure-policy`, option (c) — deny a failed read ONLY where a
 * deny is honoured AND something was actually silenced.
 *
 * Decided by council 2026-08-20, 2/2 quorum, both seats on option (c):
 * "on a read failure, deny only when the slot is block-capable and at least one
 * selected concern is both blocking and `fail_closed: true`".
 *
 * The two rejected options are worth keeping visible, because each is the
 * obvious move. Denying on EVERY slot (option (a)) refuses nothing on
 * `post_tool_use` — the tool already ran — and on `stop` it breaks a turn end
 * to protect a guard that was never there; it buys availability risk for no
 * enforcement. Keeping the allow (option (b), the status quo) leaves a
 * documented allow-on-failure on a security path: F-1 measured a
 * `git commit --no-verify` DENIED at small payload size and ALLOWED at 300 KB,
 * and the loud stderr line that now ships makes that visible without making it
 * stop.
 *
 * The cost is stated rather than hidden: a transient I/O error on
 * `pre_tool_use` now refuses a tool call the user must retry. The retry budget
 * already survived ~10 s of `EAGAIN` before this point, so the class of error
 * that reaches here is not "the writer was slow".
 *
 * Returns `null` when the dispatch proceeds normally.
 */
export function denyOnStdinFailure(
  platform: string,
  event: string,
  concerns: readonly JsonObject[],
  failure: string,
): { reason: string } | null {
  if (!isBlockCapable(platform, event)) return null;
  const silenced = concerns.filter(_is_fail_closed_blocking).map((c) => String(c["name"]));
  if (silenced.length === 0) return null;
  return {
    reason:
      `agent-config: refusing this action — the hook payload could not be read ` +
      `(${failure}), so ${silenced.join(", ")} evaluated nothing. ` +
      `A fail-closed guard on a block-capable slot must not pass by default. Retry.`,
  };
}
