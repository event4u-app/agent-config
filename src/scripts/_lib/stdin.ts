/**
 * Read piped stdin completely — including payloads larger than the pipe buffer.
 *
 * WHY THIS EXISTS (measured 2026-08-04, PR "take the unhardened-gate count from
 * 189 to 4"): the CI step
 *
 *     gh pr diff "$PR" | ./scripts-run src/scripts/check_no_new_legacy_path --stdin
 *
 * crashed with `EAGAIN: resource temporarily unavailable, read` at
 * `fs.readFileSync(0)`. Not flaky — **reproducible on that PR and green on every
 * PR before it.** A pipe holds ~64 KB; while the diff fit, the single read
 * returned everything. That PR's diff is ~6,400 lines, so the writer is still
 * filling the pipe when the reader arrives, and Node leaves the inherited fd 0
 * in non-blocking mode: the read fails instead of waiting.
 *
 * A size-dependent gate failure is the same family of defect this suite's
 * scan-scope work exists to kill — the gate works on the changes small enough
 * not to matter and breaks on the ones big enough to. And the sibling
 * workaround is worse than the crash: `check_release_pr_shape` wraps the same
 * call in `catch { data = '' }`, so an oversized diff there reads as an empty
 * one and the gate passes over nothing.
 *
 * So: retry on EAGAIN rather than swallow it, and never substitute an empty
 * string for a failed read. A caller that gets `''` here got a genuinely empty
 * stdin.
 */
import * as fs from 'node:fs';

const CHUNK = 64 * 1024;
/** Sleep between EAGAIN retries. Synchronous — these are sync CLI entry points. */
const RETRY_SLEEP_MS = 5;
/**
 * Total patience before giving up, in retries. At 5 ms this is ~10 s, which is
 * far beyond any `gh pr diff` and still terminates rather than spinning forever
 * if fd 0 is a pipe nobody ever writes to.
 */
const MAX_RETRIES = 2000;

/** Sleep without a busy loop, in synchronous code. */
function _sleepSync(ms: number): void {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/** Options for {@link readStdinText}. */
export interface ReadStdinOptions {
    /**
     * Give up and return `''` when the FIRST byte has not arrived within this
     * many milliseconds. Undefined (the default) keeps the historical behaviour:
     * the full {@link MAX_RETRIES} budget applies from the first read, which is
     * what a `gh pr diff` pipe needs — its first byte can legitimately take a
     * while, and reporting that as empty input is the defect this module exists
     * to prevent.
     *
     * A HOOK is the opposite case, and it cost a CI hang to learn the difference.
     * The host writes the payload synchronously on spawn, so a byte that has not
     * arrived promptly is not a slow writer — it is an fd 0 nobody will ever
     * write to, which is what a child inherits when a test spawns it without
     * piping stdin. With no cap the dispatcher then span the full ~10 s budget on
     * EVERY such invocation and returned "" anyway; measured 12.4 s per call
     * against an immediate return before the retry loop existed. Hundreds of
     * those hung three Node-Tests shards for over an hour.
     *
     * Once ANY byte has arrived the cap no longer applies: a writer demonstrably
     * exists, so the full budget is right and the large-payload fix is intact.
     */
    firstByteTimeoutMs?: number;
}

/**
 * Read all of fd 0 as UTF-8.
 *
 * @throws the underlying error for anything that is not EAGAIN, and after
 *         {@link MAX_RETRIES} consecutive EAGAINs — a caller must not be able to
 *         mistake a failed read for empty input.
 */
export function readStdinText(fd = 0, opts: ReadStdinOptions = {}): string {
    const chunks: Buffer[] = [];
    const buf = Buffer.alloc(CHUNK);
    let retries = 0;
    let got_any = false;
    const first_byte_deadline =
        opts.firstByteTimeoutMs === undefined ? null : Date.now() + opts.firstByteTimeoutMs;
    for (;;) {
        let read: number;
        try {
            read = fs.readSync(fd, buf, 0, CHUNK, null);
            retries = 0;
        } catch (exc) {
            const code = (exc as NodeJS.ErrnoException).code;
            if (code === 'EAGAIN') {
                // An idle fd 0 is "no input", not a slow writer — but only
                // before the first byte. See ReadStdinOptions.firstByteTimeoutMs.
                if (!got_any && first_byte_deadline !== null && Date.now() >= first_byte_deadline) {
                    return '';
                }
                retries += 1;
                if (retries > MAX_RETRIES) {
                    throw new Error(
                        `readStdinText: stdin stayed unreadable across ${String(MAX_RETRIES)} retries ` +
                            `(~${String((MAX_RETRIES * RETRY_SLEEP_MS) / 1000)}s). Refusing to report an ` +
                            'empty read as empty input.',
                    );
                }
                _sleepSync(RETRY_SLEEP_MS);
                continue;
            }
            // EOF is how some platforms end a pipe read rather than returning 0.
            if (code === 'EOF') break;
            throw exc;
        }
        if (read === 0) break;
        got_any = true;
        chunks.push(Buffer.from(buf.subarray(0, read)));
    }
    return Buffer.concat(chunks).toString('utf-8');
}
