/**
 * Class-A transport — the enqueue half (road-to-org-telemetry Phase 2, step 2.1).
 *
 * WHY THIS IS NOT AN INLINE `fetch` AT SESSION END. Phase 0's second spike
 * pre-registered "added latency at or below one second at p95" for an inline
 * flush and measured it FAILING: a healthy sink costs 0.4 ms p95 and a
 * refused connection 0.3 ms, but a BLACKHOLE — a socket that accepts and
 * never answers, the shape a wedged sink actually takes — costs 1002 ms p95
 * against a 1000 ms bar, because the timeout IS the cost. The step's own text
 * defers to that result ("per the second spike's result"), and the result is:
 * session end ENQUEUES ONLY, a detached sender flushes, and local retention
 * carries what did not go out. The same spike measured that fallback at
 * 20.5 ms p95 against the same blackhole — dominated by process spawn — and
 * that is the number this module must not regress.
 *
 * SO THE SPOOL IS WRITTEN BY THE APPENDER, NOT BY THE FLUSH. A session-end
 * flush that had to work out which records were already sent would need a
 * byte watermark into the log, and the log is rewritten in place by
 * `enforce_retention` — a watermark and a compacting file are a
 * silent-corruption pair (offsets survive the prune; the records they point
 * at do not). Enqueue-at-write has no watermark to invalidate: a record is
 * spooled exactly once, by the only writer, in the same call that logs it.
 *
 * TWO PROPERTIES PHASE 0 SAID PHASE 2 MUST MEASURE, AND WHERE THEY LANDED.
 * (1) Does a detached child survive teardown of the session process group —
 * measured, see `agents/evidence/eval-findings/org-telemetry-p2-transport.md`.
 * (2) The queue's growth bound across a multi-day outage — answered by
 * construction here: the spool carries the SAME `RetentionPolicy` as the log,
 * enforced by the same code, so a sink that is down for days cannot grow it
 * past `max_bytes`. That bound is a decision to drop the oldest unsent
 * records rather than to keep all of them, and it is stated rather than left
 * for an operator to find in a truncated file.
 *
 * NO SINK EXISTS YET. `sink-choice` is transferred (a private repository is
 * the council's preferred architecture, but creating it is an org-admin
 * action outside this repository), so nothing in this tree can name a real
 * endpoint. What ships here is the transport an org's own endpoint value
 * activates; with no endpoint the settings never resolve `active` and not a
 * byte moves.
 */
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
    DEFAULT_RETENTION_POLICY,
    enforce_retention,
    retention_due,
    type RetentionPolicy,
} from './remote.js';

/**
 * The outbound-flush timeout, in ms.
 *
 * The step says "at or below one second"; this is the bar itself rather than
 * a value under it, because the spike measured the timeout as the dominant
 * cost only for an INLINE flush. In the detached child the wait costs the
 * session nothing, so shortening it would only turn recoverable slow sinks
 * into dropped batches.
 */
export const DEFAULT_FLUSH_TIMEOUT_MS = 1000;

/** `never` means no transport at all — no spool is written. */
export const FLUSH_NEVER = 'never';

/** The one flush policy that spools and sends. */
export const FLUSH_SESSION_END = 'session-end';

/**
 * The spool that sits beside a record log.
 *
 * Derived rather than configured: a second path key would let an install
 * point the spool somewhere the appender does not write, and the failure —
 * records logged locally, nothing ever sent — is invisible. `.jsonl` is
 * replaced rather than appended to so the spool is not itself picked up by a
 * reader globbing `*.jsonl` for records.
 */
export function spool_path_for(log_path: string): string {
    const dir = path.dirname(log_path);
    const base = path.basename(log_path).replace(/\.jsonl$/u, '');
    return path.join(dir, `${base}.spool.jsonl`);
}

/**
 * Append one already-serialised record line to the spool and bound it.
 *
 * The line is passed in rather than re-serialised so the spooled bytes are
 * byte-identical to the logged bytes: a sink and a local inspection of the
 * same record must not be able to disagree.
 */
export function enqueue_line(
    spool_path: string,
    line: string,
    policy: RetentionPolicy = DEFAULT_RETENTION_POLICY,
    now: Date = new Date(),
): void {
    fs.mkdirSync(path.dirname(spool_path) || '.', { recursive: true });
    fs.appendFileSync(spool_path, line, { encoding: 'utf-8' });
    if (retention_due(spool_path, policy, now)) {
        enforce_retention(spool_path, policy, now);
    }
}

export interface SpawnSenderInput {
    /** Absolute path to `flush_sender.mjs`. */
    readonly sender_script: string;
    readonly spool_path: string;
    readonly endpoint: string;
    readonly timeout_ms?: number;
    /** Node binary. Defaults to the one running this process. */
    readonly node_path?: string;
}

/**
 * Spawn the detached sender and return immediately.
 *
 * `detached: true` + `stdio: 'ignore'` + `unref()` is the exact shape the
 * spike measured at 20.5 ms p95, and all three are load-bearing: without
 * `detached` the child dies with the session's process group, without
 * `ignore` the parent holds pipe fds open, and without `unref` the parent's
 * event loop waits for the child — which would reintroduce the very latency
 * the spool exists to remove.
 *
 * The sender is a PLAIN-NODE `.mjs` on purpose. Its siblings in this
 * directory are TypeScript resolved by `tsx` at import time; a detached child
 * has no such resolution to inherit, so a `.ts` sender would depend on a
 * `tsx` binary being findable in a consumer install at teardown — the least
 * observable moment there is. `process.execPath` is the node already running
 * this hook, so it exists by construction.
 *
 * Returns `true` when the child was spawned. Never throws: a transport that
 * can fail a session is worse than a transport that loses a batch, and the
 * batch is not lost — it stays in the spool for the next flush.
 */
export function spawn_detached_sender(input: SpawnSenderInput): boolean {
    try {
        const child = spawn(
            input.node_path ?? process.execPath,
            [
                input.sender_script,
                '--spool',
                input.spool_path,
                '--endpoint',
                input.endpoint,
                '--timeout',
                String(input.timeout_ms ?? DEFAULT_FLUSH_TIMEOUT_MS),
            ],
            { detached: true, stdio: 'ignore' },
        );
        child.unref();
        return true;
    } catch {
        return false;
    }
}

/**
 * Is there anything to send?
 *
 * Checked before the spawn so an idle session pays a `stat` rather than a
 * process. Most sessions invoke no skill at all.
 */
export function spool_has_work(spool_path: string): boolean {
    try {
        return fs.statSync(spool_path).size > 0;
    } catch {
        return false;
    }
}
