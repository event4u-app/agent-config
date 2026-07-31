/**
 * Transport resolution for `mode: auto`, plus the two guards that keep it
 * honest (Phase 2 of `road-to-zero-ceremony-detection`).
 *
 * `modes.ts` answers "which mode did the config ask for" — a pure precedence
 * walk over four layers. This module answers the next question: when that
 * answer is `auto`, which concrete transport does THIS machine support right
 * now, how is it billed, and what happens when the chosen rung fails
 * mid-invocation.
 *
 * ## The `auto` chain
 *
 *     cli   — the provider's CLI binary resolves AND a credential is present
 *     api   — else a key resolves
 *     ∅     — else unavailable, with a one-line reason
 *
 * `manual` is deliberately NOT in the chain. It is free and always "available"
 * (the human is the transport), so an availability-ranked chain would always
 * end there and `auto` would silently become "ask the human to copy-paste".
 * Manual stays an explicit opt-in.
 *
 * ## The billing invariant
 *
 * Billing is classified from (provider, detected auth source) by
 * `classifyBilling` in `_lib/environment_detector.ts` — never from the
 * transport this module picked. That is the property that keeps the existing
 * per-provider rules intact under `auto`:
 *
 * - a VENDOR-OFFICIAL CLI under a subscription login is unmetered, so the USD
 *   cost gate stays off and `cli_call_budget` guards the plan quota instead;
 * - a COMMUNITY wrapper (`grok`, `perplexity`) shells out to the same paid API
 *   and stays metered even though the transport is also spelled `cli`;
 * - an unknown source is metered — deliberately over-gated.
 *
 * `makesProviderCall` below IS transport-derived, and is not a billing term:
 * it records that `manual` performs no provider call at all, which is why no
 * amount of billing classification applies to it.
 *
 * @see docs/contracts/ai-council-config.md § Transport modes
 */

import {
    classifyBilling,
    isCommunityCli,
    strongestAuth,
    PROVIDER_CLI_META,
    type AuthSource,
    type BillingClass,
    type EnvironmentReport,
} from '../_lib/environment_detector.js';

/** A concrete transport a member can actually run on. `auto` is not one. */
export type Transport = 'api' | 'manual' | 'cli';

/** The accepted values of the `mode` key, including the resolver-only `auto`. */
export const VALID_TRANSPORT_MODES: ReadonlySet<string> = new Set([
    'api',
    'manual',
    'cli',
    'auto',
]);

export interface ResolvedTransport {
    /** False when `auto` found no usable rung; `reason` then says why. */
    readonly available: boolean;
    /** The concrete transport, or `null` when unavailable. */
    readonly transport: Transport | null;
    /** How a provider call is paid for. From auth source only — never from `transport`. */
    readonly billing: BillingClass;
    /** The auth source the classification used, or `null` when none was detected. */
    readonly authSource: AuthSource | null;
    /** Transport-derived, NOT a billing term: `manual` performs no provider call. */
    readonly makesProviderCall: boolean;
    /** One-line reason. Non-empty exactly when `available` is false. */
    readonly reason: string | null;
}

export interface ResolveTransportOptions {
    readonly provider: string;
    /** The mode `resolve_mode` returned — `api` | `manual` | `cli` | `auto`. */
    readonly mode: string;
    /** The single read-only environment report. */
    readonly report: EnvironmentReport;
    /** Member-level `binary:` override, when set. Counts as a resolved binary. */
    readonly binaryOverride?: string | null;
    /**
     * Whether the member's `api_key_ref` resolves. Defaults to "a key-file or
     * env-key auth record exists for this provider" from the report.
     */
    readonly apiKeyPresent?: boolean;
}

/** Auth sources that mean "the provider CLI can authenticate". */
const CLI_AUTH_SOURCES: ReadonlySet<AuthSource> = new Set(['cli-subscription', 'cli-api-key']);

/** Auth sources that mean "a stored key exists for the api transport". */
const KEY_AUTH_SOURCES: ReadonlySet<AuthSource> = new Set(['key-file', 'env-key']);

function hasSource(
    report: EnvironmentReport,
    provider: string,
    allowed: ReadonlySet<AuthSource>,
): boolean {
    return report.auth.some((a) => a.provider === provider && allowed.has(a.source));
}

/** Resolved CLI binary for `provider` from the report, or `null`. */
function cliBinary(report: EnvironmentReport, provider: string): string | null {
    const meta = PROVIDER_CLI_META[provider];
    if (meta === undefined) return null;
    const binaryName = meta[0];
    const host = report.hosts.find(
        (h) => h.binary !== null && stripExeSuffix(basename(h.binary)) === binaryName,
    );
    return host?.binary ?? null;
}

/** Last path segment, separator-agnostic (no `node:path` import needed). */
function basename(p: string): string {
    const parts = p.split(/[/\\]/);
    return parts[parts.length - 1] ?? p;
}

/** Strip a Windows executable suffix so `claude.cmd` matches `claude`. */
function stripExeSuffix(name: string): string {
    return name.replace(/\.(exe|cmd)$/i, '');
}

/**
 * Resolve one member's transport.
 *
 * Explicit `api` / `manual` / `cli` pass through unchanged — this function
 * never overrides a mode the user or a per-member override asked for. Only
 * `auto` walks the chain.
 */
export function resolveTransport(opts: ResolveTransportOptions): ResolvedTransport {
    const { provider, mode, report } = opts;
    const auth = strongestAuth(report, provider);
    const authSource = auth?.source ?? null;
    const billing = classifyBilling(provider, authSource);

    if (mode === 'manual') {
        return {
            available: true,
            transport: 'manual',
            // Classified from the auth source like every other member; it is
            // simply never consulted because no provider call happens.
            billing,
            authSource,
            makesProviderCall: false,
            reason: null,
        };
    }

    if (mode === 'api' || mode === 'cli') {
        return {
            available: true,
            transport: mode,
            billing,
            authSource,
            makesProviderCall: true,
            reason: null,
        };
    }

    if (mode !== 'auto') {
        return unavailable(
            provider,
            billing,
            `mode=${JSON.stringify(mode)} is not one of ` +
                `${[...VALID_TRANSPORT_MODES].sort().join(', ')}`,
        );
    }

    // ── the auto chain ──────────────────────────────────────────────────
    const override = (opts.binaryOverride ?? null)?.trim() ?? null;
    const binary = override !== null && override !== '' ? override : cliBinary(report, provider);
    const cliAuthed = hasSource(report, provider, CLI_AUTH_SOURCES);

    if (binary !== null && cliAuthed) {
        return {
            available: true,
            transport: 'cli',
            billing,
            authSource,
            makesProviderCall: true,
            reason: null,
        };
    }

    const keyPresent = opts.apiKeyPresent ?? hasSource(report, provider, KEY_AUTH_SOURCES);
    if (keyPresent) {
        return {
            available: true,
            transport: 'api',
            billing,
            authSource,
            makesProviderCall: true,
            reason: null,
        };
    }

    return unavailable(provider, billing, autoUnavailableReason(provider, binary, cliAuthed));
}

function unavailable(
    _provider: string,
    billing: BillingClass,
    reason: string,
): ResolvedTransport {
    return {
        available: false,
        transport: null,
        // Unavailable members never spend, but the class stays over-gated so a
        // caller that ignores `available` cannot read this as "free".
        billing,
        authSource: null,
        makesProviderCall: false,
        reason,
    };
}

/** The one-line reason `auto` prints when no rung resolved. */
function autoUnavailableReason(
    provider: string,
    binary: string | null,
    cliAuthed: boolean,
): string {
    const expected = PROVIDER_CLI_META[provider]?.[0] ?? provider;
    if (binary === null && !cliAuthed) {
        return (
            `no transport available: \`${expected}\` is not on PATH and no key resolves ` +
            `— install the CLI and log in, or add an api_key_ref`
        );
    }
    if (binary === null) {
        return (
            `no transport available: a credential is present but \`${expected}\` is not ` +
            `on PATH and no key resolves — install the CLI, or add an api_key_ref`
        );
    }
    return (
        `no transport available: \`${expected}\` is on PATH but not authenticated and no ` +
        `key resolves — log in to the CLI, or add an api_key_ref`
    );
}

// ── mid-flight fallback ─────────────────────────────────────────────────

/**
 * Why a CLI call failed, normalised from `CliClient._classify_stderr` and the
 * `binary_missing` skip reason.
 */
export type CliFailureClass =
    | 'binary_missing'
    | 'auth_rejected'
    | 'cli_unsupported'
    | 'timeout'
    | 'server_error'
    | 'quota_exhausted'
    | 'other';

/**
 * Failure classes that may fall through to the `api` rung.
 *
 * All three share one property: the CLI provably never reached the provider,
 * so retrying on another transport cannot double-charge. Everything absent
 * from this set — notably `timeout` and `server_error` — may have left a
 * half-completed call behind, and falling through would risk paying twice for
 * one question. `quota_exhausted` is excluded for a different reason: the
 * quota is a cap the user deliberately set, so routing around it would defeat
 * the guard rather than recover from a fault.
 */
const FALLBACK_ELIGIBLE: ReadonlySet<CliFailureClass> = new Set([
    'binary_missing',
    'auth_rejected',
    'cli_unsupported',
]);

/** Normalise a raw client error / skip reason into a `CliFailureClass`. */
export function classifyCliFailure(raw: string): CliFailureClass {
    const s = raw.trim().toLowerCase();
    if (s === 'binary_missing' || s === 'file_not_found') return 'binary_missing';
    if (s === 'auth_expired' || s === 'auth_rejected' || s === 'unauthorized') {
        return 'auth_rejected';
    }
    if (s === 'cli_unsupported' || s === 'unsupported' || s === 'parse_failed') {
        return 'cli_unsupported';
    }
    if (s === 'timeout') return 'timeout';
    if (s === 'cli_quota_exhausted' || s === 'quota_exhausted') return 'quota_exhausted';
    if (/^exit_5\d\d$/.test(s) || s === 'server_error' || s === 'os') return 'server_error';
    return 'other';
}

/** True when `failure` is eligible to fall through to the `api` rung. */
export function isFallbackEligible(failure: CliFailureClass): boolean {
    return FALLBACK_ELIGIBLE.has(failure);
}

/**
 * One-shot, per-provider fallback ledger for a single invocation.
 *
 * Construct one per council run. `attempt` returns `'api'` at most ONCE per
 * provider, and only for a fallback-eligible failure class; every later call
 * for that provider returns `'stop'`. This is the double-spend guard: a
 * timeout never falls through, and an eligible failure never falls through
 * twice.
 */
export class MidFlightFallback {
    private readonly used = new Set<string>();

    /** `'api'` to retry on the api rung, `'stop'` to surface the failure. */
    attempt(provider: string, failure: CliFailureClass): 'api' | 'stop' {
        if (!isFallbackEligible(failure)) return 'stop';
        if (this.used.has(provider)) return 'stop';
        this.used.add(provider);
        return 'api';
    }

    /** Providers that have already spent their one fallback. */
    spent(): readonly string[] {
        return [...this.used].sort();
    }
}

/**
 * True when `provider`'s CLI transport is a community wrapper — re-exported
 * so callers reasoning about `auto` do not have to reach into the detector.
 */
export { isCommunityCli };
