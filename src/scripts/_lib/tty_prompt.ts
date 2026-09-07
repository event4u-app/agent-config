/**
 * Synchronous terminal prompting for the release pipeline.
 *
 * Its own module because `release.ts` sits 371 lines over the 1500-line source
 * ratchet, where every added line is one unit of excess — and because a SECOND
 * caller now needs these: `guard_release_curation` in `release_publication.ts`
 * collects the governance answer it used to only refuse over.
 *
 * Extracted verbatim from `release.ts`, where the `/dev/tty` discipline below
 * was established against a reproduced failure. Do not "simplify" it back to
 * `readSync(0)`; the comment on `promptLine` says what that costs.
 */
import * as fs from 'node:fs';
import process from 'node:process';

/** Can we prompt at all — is fd 0 a TTY, or is a controlling terminal openable? */
export function canPrompt(): boolean {
    if (process.env.CI) return false; // CI is non-interactive by contract → require --yes
    if (process.stdin.isTTY) return true;
    try {
        const fd = fs.openSync('/dev/tty', 'r');
        fs.closeSync(fd);
        return true;
    } catch {
        return false;
    }
}

/**
 * Mirror of Python `input(prompt)` — write the prompt, read one line from the
 * controlling terminal. Returns `null` when no terminal is reachable.
 *
 * The answer is ALWAYS read from a freshly opened, blocking `/dev/tty`
 * (`openSync(..., 'rs')`), NEVER from fd 0. `task release` / `./scripts-run`
 * run this under go-task's `interactive: true`, which leaves fd 0 a TTY
 * (`process.stdin.isTTY === true`) but one Node treats as NON-blocking — so a
 * bare `readSync(0)` throws `EAGAIN`, the catch swallows it, and the `[y/N]`
 * prompt "auto-aborts" without ever waiting (the exact failure this fixes;
 * reproduced with `isTTY === true`). A fresh blocking `/dev/tty` descriptor
 * blocks for real input regardless of how the script was invoked — the proven
 * synchronous-prompt pattern.
 */
export function promptLine(prompt: string): string | null {
    process.stdout.write(prompt);
    let fd: number;
    try {
        // 'rs' → O_RDONLY | O_SYNC: a fresh, blocking descriptor on the
        // controlling terminal, unaffected by Node's non-blocking fd 0.
        fd = fs.openSync('/dev/tty', 'rs');
    } catch {
        return null; // no controlling terminal (true non-interactive)
    }
    try {
        const buf = Buffer.alloc(1);
        const chars: number[] = [];
        for (;;) {
            let bytesRead: number;
            try {
                bytesRead = fs.readSync(fd, buf, 0, 1, null);
            } catch (e) {
                const code = (e as NodeJS.ErrnoException).code;
                // A blocking /dev/tty should not yield these, but inherited
                // descriptor flags can — retry rather than abort the prompt.
                if (code === 'EAGAIN' || code === 'EINTR') continue;
                break; // EOF / EIO → EOFError analogue; return what we have.
            }
            if (bytesRead === 0) break;
            const b = buf[0] as number;
            if (b === 0x0a) break; // newline terminates the line (stripped, like input()).
            chars.push(b);
        }
        return Buffer.from(chars).toString('utf-8');
    } finally {
        fs.closeSync(fd);
    }
}
