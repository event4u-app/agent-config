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
 *     `readHookStdin()` falls through to `fs.readFileSync(0, 'utf-8')`.
 *   - In-process invocation: the dispatcher calls
 *     `setHookStdinOverride(raw)` before the concern's `main()` and
 *     `clearHookStdinOverride()` after. Nesting is not supported (concerns
 *     never dispatch concerns).
 */
import * as fs from 'node:fs';

let _override: string | null = null;

export function setHookStdinOverride(raw: string): void {
    _override = raw;
}

export function clearHookStdinOverride(): void {
    _override = null;
}

/** TTY-safe stdin read: injected override first, else fd 0, else "". */
export function readHookStdin(): string {
    if (_override !== null) return _override;
    try {
        if (process.stdin.isTTY) return '';
        return fs.readFileSync(0, 'utf-8');
    } catch {
        return '';
    }
}
