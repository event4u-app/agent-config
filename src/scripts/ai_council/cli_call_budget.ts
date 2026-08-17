// Shared CLI-call budget: the daily counter's durability layer, its attribution
// sidecar, and the one authority that resolves a per-provider cap.
//
// Extracted from `clients.ts` and `config.ts` (road-to-council-quota-accounting-truth)
// because both are far past the 1500-line source-size ceiling, and a 3200-line
// client module has no business owning the persistence layer. The archived
// roadmap carries the full findings; this file states only what the code cannot.
//
// Dependency direction is deliberate and load-bearing: nothing here imports from
// `clients.ts` or `config.ts`. The Python-parity JSON dumper lives in
// `clients.ts` and a frozen byte-parity golden depends on it, so it is INJECTED
// as `serialize` rather than imported — importing it would make this module and
// `clients.ts` mutually dependent, and re-implementing it would fork the golden.
// Same reason `resolveCliCallCaps` takes the valid-provider set as an argument
// instead of reading it from `config.ts`.

import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Attribution sidecar suffix, appended to the counter's own state path.
 *
 * A sidecar rather than a new key in `cli-calls.json`, for three reasons in
 * order of weight: the gate reads the counter file, so a diagnostic write must
 * not be able to corrupt gating; a failed attribution write is swallowed where a
 * failed counter write is not; and the counter keeps its on-disk shape, so the
 * frozen byte-parity golden stays meaningful.
 */
export const CLI_CALLS_ATTRIBUTION_SUFFIX = '.attribution.json';

/**
 * Who booked a call. Enumerated because the consumer set is closed: exactly two
 * files in the tree construct a `CliClient`.
 *
 * `unknown` is a FINDING when it appears — it means a third booking path exists
 * that this enumeration does not know about. That is how the test suite was
 * caught spending the operator's live budget.
 */
export const CLI_CONSUMER_COUNCIL = 'council';
export const CLI_CONSUMER_TEAM = 'team';
export const CLI_CONSUMER_UNKNOWN = 'unknown';

/**
 * `metadata.quota_source` on a `cli_quota_exhausted` response. One error string,
 * two events with OPPOSITE remedies:
 *
 * - `local_budget` — our counter refused before spawning. Nothing was sent or
 *   billed; the fix is ours (raise the cap, reset, or wait for UTC midnight).
 * - `provider` — the vendor CLI refused us. A process ran and the call is booked;
 *   their window governs and we do not know it.
 */
export const QUOTA_SOURCE_LOCAL_BUDGET = 'local_budget';
export const QUOTA_SOURCE_PROVIDER = 'provider';

/**
 * Generous per-provider daily guard for `mode: cli` / `mode: auto` members.
 * Sized as a guard against silent quota exhaustion on an always-on pass, not as
 * a brake on normal use.
 */
export const DEFAULT_CLI_CALLS_PER_DAY = 50;

/** Attribution sidecar path beside a counter-state path. */
export function attributionPath(target: string): string {
    return `${target}${CLI_CALLS_ATTRIBUTION_SUFFIX}`;
}

/**
 * Resolve the per-provider daily cap map — the SINGLE authority for that
 * question, used by both the gate and the report.
 *
 * Seeds every known provider with the default, then applies the caller's
 * overrides. An absent, empty, or malformed mapping therefore yields the
 * DEFAULTS, never "uncapped": omission is not a way to switch the guard off.
 * That was the live defect — a raw `.ai-council.yml` dict with a commented-out
 * `cli_call_budget:` block left the map empty, the per-member lookup fell back to
 * `null`, and `ask()` reads `null` as uncapped while still booking.
 *
 * Deliberately LENIENT where the strict config builder throws: it skips an
 * unknown provider or a bad value instead of raising, because two consumers are
 * reporting paths that must still print something useful for the providers that
 * ARE valid. Validation runs first on every real config load, so a bad entry
 * still fails loudly — it just does not take the quota report down with it.
 */
export function resolveCliCallCaps(
    raw: unknown,
    validProviders: Iterable<string>,
): Record<string, number> {
    const out: Record<string, number> = {};
    for (const provider of validProviders) {
        out[provider] = DEFAULT_CLI_CALLS_PER_DAY;
    }
    if (!_isObject(raw)) {
        return out;
    }
    const known = new Set(Object.keys(out));
    for (const [provider, value] of Object.entries(raw)) {
        if (!known.has(provider)) {
            continue;
        }
        if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
            continue;
        }
        out[provider] = value;
    }
    return out;
}

/**
 * Write counter state so a concurrent reader can never observe a partial file.
 *
 * The direct `writeFileSync` this replaces had a failure mode worse than the
 * lost update it is usually described as: the counter's reader swallows a
 * `JSON.parse` error and returns an empty map, so a reader landing mid-write sees
 * ZERO calls used and the gate admits everything until the next successful write.
 * One interleaved write could blank the whole budget.
 *
 * The temp file is created in the TARGET's own directory, not a system temp dir:
 * rename is atomic within one filesystem, and staying beside the target is what
 * keeps it there.
 */
export function writeStateAtomically(target: string, payload: string): void {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const tmp = `${target}.${process.pid}.${_monotonicish()}.tmp`;
    try {
        fs.writeFileSync(tmp, payload, { encoding: 'utf-8' });
        fs.renameSync(tmp, target);
    } catch (exc) {
        try {
            fs.unlinkSync(tmp);
        } catch {
            // Best-effort cleanup; the write error is the real signal.
        }
        throw exc;
    }
}

/**
 * Hold a bounded, best-effort cross-process lock around a read-modify-write.
 *
 * `O_EXCL` creation is atomic and is the only mutual-exclusion primitive
 * available without a dependency. Three deliberate bounds:
 *
 * - **Bounded wait.** A council seat must never block on a lock; after the budget
 *   expires the update proceeds unlocked. Losing one increment is the
 *   pre-existing behaviour and beats stalling a dispatch.
 * - **Stale-lock breaking.** A crashed holder must not wedge the counter forever.
 * - **In-process calls need none of this** — the callers are synchronous and Node
 *   is single-threaded, so same-process bookings are already serialised. The
 *   window this closes is strictly cross-process: a council invocation and an
 *   `ai_team` invocation booking into one shared file.
 */
export function withStateLock<T>(target: string, fn: () => T): T {
    const lockPath = `${target}.lock`;
    const waitMs = 1000;
    let held = false;
    const started = _monotonicish();
    while (_monotonicish() - started < waitMs) {
        try {
            fs.mkdirSync(path.dirname(lockPath), { recursive: true });
            fs.closeSync(fs.openSync(lockPath, 'wx'));
            held = true;
            break;
        } catch {
            try {
                if (_monotonicish() - fs.statSync(lockPath).mtimeMs > waitMs) {
                    fs.unlinkSync(lockPath);
                    continue;
                }
            } catch {
                // Vanished between the failed create and the stat — retry.
            }
            _spin(20);
        }
    }
    try {
        return fn();
    } finally {
        if (held) {
            try {
                fs.unlinkSync(lockPath);
            } catch {
                // A removed lock is the desired end state either way.
            }
        }
    }
}

/**
 * Read today's `provider → consumer → count` attribution.
 *
 * Fail-soft by contract: an absent, unreadable, stale, or malformed sidecar reads
 * as `{}`. Attribution that cannot be read is a lost diagnostic, never a gating
 * decision — no caller may branch on it to admit or refuse a call.
 */
export function readAttribution(
    target: string,
    todayIso: string,
): Record<string, Record<string, number>> {
    const p = attributionPath(target);
    if (!fs.existsSync(p)) {
        return {};
    }
    let data: unknown;
    try {
        data = JSON.parse(fs.readFileSync(p, { encoding: 'utf-8' }));
    } catch {
        return {};
    }
    if (!_isObject(data) || data['date'] !== todayIso) {
        return {};
    }
    const raw = data['by_consumer'];
    if (!_isObject(raw)) {
        return {};
    }
    const out: Record<string, Record<string, number>> = {};
    for (const [provider, perConsumer] of Object.entries(raw)) {
        if (!_isObject(perConsumer)) {
            continue;
        }
        const bucket: Record<string, number> = {};
        for (const [consumer, v] of Object.entries(perConsumer)) {
            if (typeof v === 'number' && Number.isInteger(v)) {
                bucket[consumer] = v;
            }
        }
        out[provider] = bucket;
    }
    return out;
}

/**
 * Record one booking in the attribution sidecar. Best-effort: a booking that
 * cannot be attributed still counts. Call INSIDE the counter lock so the two
 * files cannot interleave against each other.
 *
 * `serialize` is injected rather than imported — see the module header.
 */
export function recordAttribution(
    target: string,
    provider: string,
    consumer: string,
    todayIso: string,
    serialize: (value: unknown) => string,
): void {
    try {
        const by_consumer = readAttribution(target, todayIso);
        const bucket = by_consumer[provider] ?? {};
        bucket[consumer] = (bucket[consumer] ?? 0) + 1;
        by_consumer[provider] = bucket;
        writeStateAtomically(attributionPath(target), serialize({ date: todayIso, by_consumer }));
    } catch {
        // Diagnostic only.
    }
}

/**
 * Clear attribution for one provider, or all of it. Follows the counter's own
 * reset: stale attribution would credit spend to a bucket that no longer records
 * it. Best-effort for the same reason as `recordAttribution`.
 */
export function resetAttribution(
    target: string,
    provider: string | null,
    todayIso: string,
    serialize: (value: unknown) => string,
): void {
    try {
        let by_consumer = readAttribution(target, todayIso);
        if (provider === null) {
            by_consumer = {};
        } else {
            delete by_consumer[provider];
        }
        writeStateAtomically(attributionPath(target), serialize({ date: todayIso, by_consumer }));
    } catch {
        // Diagnostic only.
    }
}

/** The subset of a CLI client this module reads — structural, so no import. */
interface QuotaClientView {
    readonly name?: unknown;
    readonly max_calls_per_day?: unknown;
    readonly warn_at?: unknown;
}

/**
 * Format the pre-run quota summary from already-read counts.
 *
 * Returns `[summary, warnProviders]`, where `warnProviders` is the subset whose
 * `used / cap` ratio crossed `warn_at`.
 *
 * Two silences that read to an operator as "within budget" are gone: a cap of `0`
 * (the strictest setting available) used to be dropped by a Python-truthy filter,
 * and no caps at all returned the empty string — in exactly the configuration
 * where the shared counter runs unguarded. An omission is indistinguishable from
 * a pass, and the counter reached 72/63/99 while nothing was printed.
 */
export function quotaSummaryLine(
    clients: readonly QuotaClientView[],
    counts: Record<string, number>,
): [string, string[]] {
    // Any number is a cap, zero included; only an absent one is uncapped.
    const capOf = (c: QuotaClientView): number | null =>
        typeof c.max_calls_per_day === 'number' && Number.isFinite(c.max_calls_per_day)
            ? c.max_calls_per_day
            : null;
    const nameOf = (c: QuotaClientView): string =>
        typeof c.name === 'string' && c.name !== '' ? c.name : '?';
    const usedOf = (c: QuotaClientView): number => Math.trunc(counts[nameOf(c)] ?? 0);

    if (clients.length === 0) {
        return ['', []];
    }
    const parts: string[] = [];
    const warn: string[] = [];
    for (const c of clients) {
        const limit = capOf(c);
        const used = usedOf(c);
        if (limit === null) {
            // Named rather than omitted: real consumption, no protection.
            parts.push(`${nameOf(c)} ${used}/uncapped`);
            continue;
        }
        parts.push(`${nameOf(c)} ${used}/${Math.trunc(limit)}`);
        const warnAt = typeof c.warn_at === 'number' ? c.warn_at : 0.8;
        // Limit 0 admits nothing, so any booked call is already past it — the
        // ratio is undefined there and 0.0 would read as "0 % used".
        if (limit === 0 ? used > 0 : used / limit >= warnAt) {
            warn.push(nameOf(c));
        }
    }
    const prefix = warn.length > 0 ? '⚠️  ' : '';
    return [`${prefix}council:quota · ${parts.join(' · ')}`, warn];
}

function _isObject(x: unknown): x is Record<string, unknown> {
    return typeof x === 'object' && x !== null && !Array.isArray(x);
}

/** Monotonic-ish millisecond clock for lock ages and temp-file names. */
function _monotonicish(): number {
    return performance.now();
}

/**
 * Synchronous back-off. Necessary rather than chosen: the whole booking path is
 * synchronous, so making it async to await a sub-second contention window would
 * change every caller.
 */
function _spin(ms: number): void {
    const until = _monotonicish() + ms;
    while (_monotonicish() < until) {
        // deliberate busy-wait
    }
}
