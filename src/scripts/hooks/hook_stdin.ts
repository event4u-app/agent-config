/**
 * hook_stdin — the single stdin seam for hook concern scripts.
 *
 * road-to-credible-install Phase 1 (single-process dispatch): concern
 * scripts historically read their JSON envelope with `fs.readFileSync(0)`.
 * That only works when each concern is its own child process. Under the
 * in-process dispatcher (dist/hooks bundle) all concerns run inside ONE
 * node process whose fd 0 carries the PLATFORM payload, already consumed
 * by the dispatcher — so the dispatcher injects the per-concern envelope
 * here instead.
 *
 * Contract:
 *   - Standalone invocation (a concern run directly as its own process —
 *     the historical path, still supported): no override is set, and
 *     `readHookStdin()` falls through to a retrying fd-0 read (see
 *     `readFd0ToEnd` — a plain `fs.readFileSync(0)` here was a measured guard
 *     bypass on large payloads).
 *   - In-process invocation: the dispatcher calls
 *     `setHookStdinOverride(raw)` before the concern's `main()` and
 *     `clearHookStdinOverride()` after. Nesting is not supported (concerns
 *     never dispatch concerns).
 */
import * as tty from 'node:tty';

import { readStdinText } from '../_lib/stdin.js';

let _override: string | null = null;

export function setHookStdinOverride(raw: string): void {
    _override = raw;
}

export function clearHookStdinOverride(): void {
    _override = null;
}

/**
 * Read fd 0 to EOF, correctly, for a payload of any size.
 *
 * Delegates to `_lib/stdin.readStdinText`, which already carries this exact
 * defect's history (EAGAIN on a pipe larger than its buffer, measured 2026-08-04
 * on a CI diff), a bounded retry budget, and the contract that matters here:
 * **it never substitutes an empty string for a failed read.** A second
 * implementation in this file would have been a worse copy of an audited one.
 *
 * ## The hook-side half of the defect (measured 2026-08-18)
 *
 * Knowing the read is fragile was not enough, because the *trigger* lived
 * somewhere else. `dispatch_hook` guarded the read with `process.stdin.isTTY`,
 * and merely READING that property lazily constructs the stdin stream, which
 * puts fd 0 into non-blocking mode. So the guard is what made its own read fail:
 *
 * 1. `process.stdin.isTTY` → fd 0 becomes non-blocking.
 * 2. `fs.readFileSync(0)` → `EAGAIN` once the payload exceeds the pipe buffer.
 * 3. `catch { return '' }` → "no input", and the dispatcher proceeds against an
 *    EMPTY envelope and exits 0.
 *
 * Reproduced on the shipped bundle: a `PreToolUse` payload carrying
 * `git commit --no-verify` was DENIED small and ALLOWED once padded to 300 KB,
 * because `block-no-verify` never saw a command. Padding is not exotic — a
 * `PostToolUse` `tool_response` holding a large file read reaches these sizes
 * routinely.
 *
 * Hence both halves, since either alone is a single point of failure:
 * **`tty.isatty(0)`** answers the TTY question without constructing the stream,
 * and **the retrying reader** holds even if something else in the process touched
 * `process.stdin` first. Pinned by
 * `tests/scripts/hooks/dispatch_large_payload_guard.test.ts`, which fails on the
 * pre-fix bundle.
 */
/**
 * Wait for the FIRST byte, in ms, before concluding fd 0 is idle. See
 * {@link readFd0ToEnd} for why an idle fd 0 must be cheap and a busy one must
 * not be truncated.
 */
export const HOOK_FIRST_BYTE_TIMEOUT_MS = 25;

/**
 * Read fd 0 to EOF for a payload of any size, without stalling when there is no
 * payload at all.
 *
 * ## Two coupled properties, and it took three attempts to see that they were coupled
 *
 * 1. **A large payload must not truncate.** `fs.readFileSync(0)` returned `''`
 *    once the payload exceeded the pipe buffer, and the caller's
 *    `catch { return '' }` made that indistinguishable from empty input. That is
 *    the guard bypass F-1 records: a `PreToolUse` payload carrying
 *    `git commit --no-verify` was DENIED small and ALLOWED once padded to 300 KB.
 * 2. **An idle fd 0 must be cheap.** A concern also runs with fd 0 simply open
 *    and never written — a child that inherits stdin, or a test that calls
 *    `main()` in-process under vitest. A read that blocks there hangs the caller
 *    outright.
 *
 * The old code satisfied (2) **by accident, through the very bug that broke (1)**:
 * reading `process.stdin.isTTY` constructs the stdin stream, which puts fd 0 into
 * non-blocking mode, so the following `readFileSync` failed fast with EAGAIN on an
 * idle fd — and equally on a large one. Removing the probe fixed (1) and broke (2)
 * in the worst way: `fs.readSync` on a blocking, open, unwritten fd does not
 * return EAGAIN, it BLOCKS, so no retry budget can bound it. Measured: a whole
 * test file that calls a concern in-process never finished, and three CI shards
 * hung for over an hour.
 *
 * So the non-blocking mode is now **deliberate** rather than a side effect, and
 * the retry loop is what makes it safe:
 *
 * - Touch `process.stdin` on purpose to put fd 0 in non-blocking mode, so a read
 *   can never block. This is the one place in the tree that wants that effect;
 *   everywhere else it is the hazard `dispatch_hook` documents.
 * - Read through `_lib/stdin.readStdinText`, which retries on EAGAIN instead of
 *   reporting it as empty input — that is what fixes (1).
 * - Cap the wait for the FIRST byte, and cap it SHORT. The host writes the
 *   payload before the child can run, so the first read either returns data or
 *   means nothing is coming; the 25 ms exists only to absorb a scheduling race
 *   between the parent's first write and the child's first read, not to wait for
 *   a slow writer. It was 500 ms for one iteration and that was already too
 *   expensive — 7 in-process concern calls in one test file paid 3.5 s of pure
 *   waiting. Once any byte HAS arrived the full ~10 s budget applies, so a
 *   multi-megabyte payload is unaffected.
 *
 * Both directions are pinned by
 * `tests/scripts/hooks/dispatch_large_payload_guard.test.ts`, which fails on the
 * pre-fix bundle for (1) and times out for (2) — fixing either alone reintroduces
 * the other.
 */
export function readFd0ToEnd(): string {
    // Deliberate: constructing the stream sets O_NONBLOCK on fd 0, which is the
    // only portable way to guarantee the reads below cannot block. Node exposes
    // no direct O_NONBLOCK call for an existing descriptor.
    void process.stdin;
    return readStdinText(0, { firstByteTimeoutMs: HOOK_FIRST_BYTE_TIMEOUT_MS });
}

/**
 * TTY-safe stdin read: injected override first, else fd 0, else "".
 *
 * `tty.isatty(0)` rather than `process.stdin.isTTY`, and `readFd0ToEnd` rather
 * than `fs.readFileSync(0)` — see `readFd0ToEnd`'s header for the silent
 * large-payload truncation both halves prevent.
 */
export function readHookStdin(): string {
    if (_override !== null) return _override;
    try {
        if (tty.isatty(0)) return '';
        return readFd0ToEnd();
    } catch {
        return '';
    }
}
