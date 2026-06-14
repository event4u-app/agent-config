/**
 * Solo-member dispatch — step-9 P9 (U2).
 *
 * TypeScript twin of `src/scripts/ai_council/solo_dispatch.py` (ADR-094 —
 * Python→TS migration, Phase 1). Picks the first enabled, auth-valid member
 * from `routing.solo_member_fallback_chain` so low-impact decisions can
 * optionally route to a single member instead of the full council. The
 * selection is intentionally side-effect-free: callers own logging,
 * dispatch, and the all-invalid → full-council fallback.
 *
 * Iron Law: a null selection from `select_solo_member` is the caller's
 * signal to fall back to the full council with a WARN log — NEVER to fail
 * the decision. The dispatcher must never break a user's flow because a CLI
 * was offline.
 *
 * Parity notes:
 * - `time.monotonic()` → `performance.now() / 1000` (seconds, monotonic).
 * - `os.environ` → `process.env`.
 * - `should_escalate(solo, floor=…)` keyword call → positional `(solo, floor)`
 *   in the confidence_gate twin.
 * - `except Exception` around the probe mirrors Python's broad catch (any
 *   thrown value → auth-invalid).
 */
import { type EscalationDecision, should_escalate } from './confidence_gate.js';
import type { MemberConfig, RoutingConfig } from './config.js';

//: TTL for cached auth-probe results. Lazy probe per session; bumped
//: forward whenever a probe is re-run.
const _AUTH_CACHE_TTL_SECONDS = 15 * 60;

//: Env var that forces every solo-dispatch path back to full council
//: for the current invocation. Honored by `select_solo_member` and
//: surfaced through `force_full_council`.
export const FORCE_FULL_ENV = 'AGENT_CONFIG_FORCE_FULL_COUNCIL';

/** One auth-probe result with the expiry it was cached against. */
export class AuthCacheEntry {
    valid: boolean;
    expires_at: number;

    constructor(args: { valid: boolean; expires_at: number }) {
        this.valid = args.valid;
        this.expires_at = args.expires_at;
    }
}

/** In-memory cache for auth-probe verdicts (per-process). */
export class AuthCache {
    entries: Map<string, AuthCacheEntry>;

    constructor(entries?: Map<string, AuthCacheEntry>) {
        this.entries = entries ?? new Map<string, AuthCacheEntry>();
    }

    get(name: string, opts: { now: number }): boolean | null {
        const entry = this.entries.get(name);
        if (entry === undefined || entry.expires_at <= opts.now) {
            return null;
        }
        return entry.valid;
    }

    set(name: string, opts: { valid: boolean; now: number }): void {
        this.entries.set(
            name,
            new AuthCacheEntry({
                valid: opts.valid,
                expires_at: opts.now + _AUTH_CACHE_TTL_SECONDS,
            }),
        );
    }
}

/** Read-only mapping accessor mirroring Python `Mapping.get` semantics. */
function _mapGet<V>(m: ReadonlyMap<string, V> | undefined | null, key: string): V | undefined {
    if (m === undefined || m === null) {
        return undefined;
    }
    return m.get(key);
}

/**
 * Return True iff the env-var override is set to `1`.
 *
 * Truthy values other than `1` are intentionally rejected — the override
 * is a hard one-bit switch, not a free-form bool.
 */
export function force_full_council(env?: ReadonlyMap<string, string> | Record<string, string> | null): boolean {
    let value: string;
    if (env === undefined || env === null) {
        // Python: src = os.environ; src.get(FORCE_FULL_ENV, "")
        value = process.env[FORCE_FULL_ENV] ?? '';
    } else if (env instanceof Map) {
        value = env.get(FORCE_FULL_ENV) ?? '';
    } else {
        const v = (env as Record<string, string>)[FORCE_FULL_ENV];
        value = v === undefined ? '' : v;
    }
    return value === '1';
}

export interface SelectSoloMemberOptions {
    auth_cache: AuthCache;
    probe: (name: string, timeout_s: number) => boolean;
    now?: number | null;
    env?: ReadonlyMap<string, string> | Record<string, string> | null;
}

/**
 * Return the first chain entry whose member is enabled + auth-valid.
 *
 * Walks `routing.solo_member_fallback_chain` in order. For each entry:
 * skip when the member is missing or disabled; consult the auth cache;
 * on miss probe lazily with the configured timeout and cache the result.
 * Returns the provider name of the first valid member, or `null` when
 * every chain entry is unavailable.
 *
 * `probe(name, timeout_s) -> boolean` is the caller-supplied auth check.
 * It MUST honor `timeout_s` and return false on timeout so the dispatcher
 * cannot stall on a wedged CLI.
 *
 * Env-var override (`AGENT_CONFIG_FORCE_FULL_COUNCIL=1`) short-circuits to
 * null, treating the whole chain as unavailable.
 */
export function select_solo_member(
    routing: RoutingConfig,
    members: ReadonlyMap<string, MemberConfig>,
    opts: SelectSoloMemberOptions,
): string | null {
    const env = opts.env ?? null;
    if (force_full_council(env)) {
        return null;
    }
    let now = opts.now ?? null;
    if (now === null) {
        now = _monotonic();
    }
    const timeout_s = routing.auth_check_timeout_seconds;
    for (const name of routing.solo_member_fallback_chain) {
        const member = _mapGet(members, name);
        if (member === undefined || !member.enabled) {
            continue;
        }
        const cached = opts.auth_cache.get(name, { now });
        if (cached === false) {
            continue;
        }
        if (cached === true) {
            return name;
        }
        let valid: boolean;
        try {
            valid = Boolean(opts.probe(name, timeout_s));
        } catch {
            // Probe blew up — treat as auth-invalid so the chain walks to
            // the next entry. (Callers should log probe failures.)
            valid = false;
        }
        opts.auth_cache.set(name, { valid, now });
        if (valid) {
            return name;
        }
    }
    return null;
}

/**
 * Outcome of `dispatch_with_escalation`.
 *
 * `verdict` is the final answer text returned to the caller. `escalated`
 * is true when the solo response was rejected by the confidence gate and
 * the full council ran. `solo_member` / `solo_response` are populated even
 * on escalation so the shadow log can record both sides without re-running
 * the solo step.
 */
export class SoloDispatchResult {
    readonly verdict: string;
    readonly escalated: boolean;
    /** 'low_confidence' | 'split' | 'refusal' | 'short_response' | 'ok' | 'no_solo_member' */
    readonly escalation_reason: string;
    readonly solo_member: string | null;
    readonly solo_response: string | null;
    readonly solo_confidence: number | null;

    constructor(args: {
        verdict: string;
        escalated: boolean;
        escalation_reason: string;
        solo_member: string | null;
        solo_response: string | null;
        solo_confidence: number | null;
    }) {
        this.verdict = args.verdict;
        this.escalated = args.escalated;
        this.escalation_reason = args.escalation_reason;
        this.solo_member = args.solo_member;
        this.solo_response = args.solo_response;
        this.solo_confidence = args.solo_confidence;
    }
}

export interface DispatchWithEscalationOptions {
    auth_cache: AuthCache;
    probe: (name: string, timeout_s: number) => boolean;
    run_solo: (name: string) => string;
    run_full: () => string;
    confidence_floor: number;
    now?: number | null;
    env?: ReadonlyMap<string, string> | Record<string, string> | null;
}

/**
 * Solo-dispatch with auto-escalation on low-confidence / split / refusal.
 *
 * Step-9 P13 — defense-in-depth on top of shadow-mode SLO.
 *
 * Flow:
 *
 * 1. `select_solo_member` picks the chain entry.
 * 2. null → escalate immediately (`no_solo_member`).
 * 3. `run_solo` is invoked; response is scored via `should_escalate`.
 * 4. Verdict `escalate=true` → `run_full` is invoked and that verdict is
 *    returned; the solo response stays on the result for shadow logging.
 * 5. `escalate=false` → solo verdict is returned as-is.
 *
 * `run_solo(name) -> string` and `run_full() -> string` are caller-
 * supplied; this module owns no LLM transport. Callers MUST throw on
 * transport errors — escalation is for *content* low-confidence, not
 * infrastructure failures.
 */
export function dispatch_with_escalation(
    routing: RoutingConfig,
    members: ReadonlyMap<string, MemberConfig>,
    opts: DispatchWithEscalationOptions,
): SoloDispatchResult {
    const name = select_solo_member(routing, members, {
        auth_cache: opts.auth_cache,
        probe: opts.probe,
        now: opts.now ?? null,
        env: opts.env ?? null,
    });
    if (name === null) {
        return new SoloDispatchResult({
            verdict: opts.run_full(),
            escalated: true,
            escalation_reason: 'no_solo_member',
            solo_member: null,
            solo_response: null,
            solo_confidence: null,
        });
    }
    const solo = opts.run_solo(name);
    const decision: EscalationDecision = should_escalate(solo, opts.confidence_floor);
    if (decision.escalate) {
        return new SoloDispatchResult({
            verdict: opts.run_full(),
            escalated: true,
            escalation_reason: decision.reason,
            solo_member: name,
            solo_response: solo,
            solo_confidence: decision.confidence,
        });
    }
    return new SoloDispatchResult({
        verdict: solo,
        escalated: false,
        escalation_reason: 'ok',
        solo_member: name,
        solo_response: solo,
        solo_confidence: decision.confidence,
    });
}

/** Mirror Python `time.monotonic()` — monotonic seconds. */
function _monotonic(): number {
    return performance.now() / 1000;
}

// Python: __all__ exposes AUTH_CACHE_TTL_SECONDS (the public alias of the
// private _AUTH_CACHE_TTL_SECONDS, assigned after __all__ in the source).
export const AUTH_CACHE_TTL_SECONDS = _AUTH_CACHE_TTL_SECONDS;
