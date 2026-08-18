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
export function readFd0ToEnd(): string {
    return readStdinText(0);
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
