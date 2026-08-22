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
import { resolve_mode } from './modes.js';

/** A concrete transport a member can actually run on. `auto` is not one. */
export type Transport = 'api' | 'manual' | 'cli';

/**
 * Machine-readable reason a member is `absent` from a pass
 * (road-to-always-on-orchestration Phase 3.2). The static half — `no_binary`
 * / `no_auth` — is decided here, at resolution time, before any provider
 * call is attempted. The runtime half — `timeout` / `quota` — only exists
 * once a call was actually attempted and failed; see
 * `absentReasonFromCliFailure` below for the mapping FROM the mid-flight
 * `CliFailureClass` a caller already classifies its errors into.
 */
export type AbsentReason = 'no_binary' | 'no_auth' | 'timeout' | 'quota';

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
    /**
     * Machine-readable classification of `reason`, for a pass artifact that
     * needs to bucket absent members without parsing prose (Phase 3.2).
     * Non-null for the two STATIC auto-chain failures this function can
     * classify (`no_binary` / `no_auth`); `null` when `available` is true,
     * and also `null` for the "unknown mode" validation-error path below —
     * that is a config bug, not a missing-capability finding, so it does not
     * belong in this enum.
     */
    readonly absentReason: AbsentReason | null;
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
            absentReason: null,
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
            absentReason: null,
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
            absentReason: null,
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
            absentReason: null,
        };
    }

    return unavailable(
        provider,
        billing,
        autoUnavailableReason(provider, binary, cliAuthed),
        classifyStaticAbsentReason(binary),
    );
}

export interface ResolveMemberTransportOptions {
    readonly provider: string;
    /** The single read-only environment report `resolveTransport` needs. */
    readonly report: EnvironmentReport;
    /** e.g. `/council mode:manual`. Highest precedence layer. */
    readonly invocationMode?: string | null;
    /** The member's own config sub-dict (`ai_council.members.<name>`). */
    readonly memberSettings?: ReadonlyMap<string, unknown> | Record<string, unknown> | null;
    /** `ai_council.mode` / `defaults.mode`, already extracted by the caller. */
    readonly globalMode?: string | null;
    readonly binaryOverride?: string | null;
    readonly apiKeyPresent?: boolean;
}

export interface ResolvedMemberTransport extends ResolvedTransport {
    /** The mode `resolve_mode` chose BEFORE any `auto` expansion. */
    readonly configuredMode: string;
}

/**
 * The single reconciled entry point for "given this member's config, what
 * transport does it actually run on" (road-to-always-on-orchestration
 * Phase 3.1). Composes `modes.ts::resolve_mode` (which layer decided the
 * mode) with `resolveTransport` (what `auto` expands to on THIS machine) so
 * a caller never has to replicate either step by hand.
 *
 * This exists because the two functions previously lived at arm's length:
 * `resolve_mode` can legitimately return the literal string `'auto'`, and
 * nothing forced a caller to then route that value through
 * `resolveTransport` — a hand-rolled `mode === 'api' | 'cli' | 'manual'`
 * switch (the shape `council_cli.ts::build_members` still uses today) has
 * no `'auto'` case and treats it as an unrecognised transport instead of
 * expanding it. `resolveMemberTransport` is the fix: there is no longer a
 * gap between "which mode was configured" and "which transport that becomes"
 * for any caller that uses it instead of the two functions separately.
 */
export function resolveMemberTransport(
    opts: ResolveMemberTransportOptions,
): ResolvedMemberTransport {
    const configuredMode = resolve_mode(opts.provider, {
        invocationMode: opts.invocationMode ?? null,
        memberSettings: opts.memberSettings ?? null,
        globalMode: opts.globalMode ?? null,
    });
    const resolved = resolveTransport({
        provider: opts.provider,
        mode: configuredMode,
        report: opts.report,
        binaryOverride: opts.binaryOverride ?? null,
        // `exactOptionalPropertyTypes` rejects an explicit `undefined` for an
        // optional-boolean field, so the key is omitted entirely rather than
        // forwarded as `apiKeyPresent: undefined`.
        ...(opts.apiKeyPresent !== undefined ? { apiKeyPresent: opts.apiKeyPresent } : {}),
    });
    return { ...resolved, configuredMode };
}

function unavailable(
    _provider: string,
    billing: BillingClass,
    reason: string,
    absentReason: AbsentReason | null = null,
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
        absentReason,
    };
}

/**
 * `no_binary` when the CLI binary itself never resolved (whether or not a
 * credential was found — a credential with nothing to run it against is
 * still "the binary is missing" from the caller's point of view); `no_auth`
 * when the binary IS present but neither the cli-auth nor the key rung
 * resolved. Mirrors `autoUnavailableReason`'s three-way branch below.
 */
function classifyStaticAbsentReason(binary: string | null): AbsentReason {
    return binary === null ? 'no_binary' : 'no_auth';
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
    | 'model_unservable'
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
    // `model_unservable` satisfies the same no-double-charge property in both
    // of its shapes: the pre-spend gate refuses before any subprocess exists,
    // and the call-time shape is a provider 400 — rejected at the request
    // boundary, no generation performed.
    'model_unservable',
]);

/**
 * Caller-supplied policy that widens the base eligibility set.
 *
 * `apiOnQuota` covers BOTH quota shapes, and both satisfy the same
 * no-double-charge property the base set is built on:
 *
 * - the LOCAL `cli_call_budget` refusal happens before any subprocess exists
 *   ("nothing sent, nothing booked" — `clients.ts` returns the response
 *   without spawning);
 * - the provider-side plan-quota rejection is refused at the request
 *   boundary, no generation performed.
 *
 * They stay behind an opt-in for a different reason than double-spend: the
 * fallback flips the billing class. A vendor CLI under a subscription login
 * is unmetered; its api twin is metered USD. Silently converting exhausted
 * plan quota into API spend is a decision the operator must state, not one
 * `auto` may infer — the USD spend itself remains guarded by the ordinary
 * `cost_budget` gates the orchestrator runs on the retry.
 */
/**
 * The three postures of `ai_council.fallback.api_on_quota`.
 *
 * `false` and `true` mean what they always meant. `'ask'` is the third: the
 * billing-class decision is deferred out of configuration time and into the
 * round that would actually cross the cliff, where the remaining scope is
 * known. Under `'ask'` the seat is eligible only when a run-scoped billing
 * grant is present — a human said yes for THIS run — and is parked otherwise.
 */
export type ApiOnQuota = boolean | 'ask';

export interface FallbackPolicy {
    readonly apiOnQuota: ApiOnQuota;
    /**
     * True when a run-scoped billing grant is in force. Only consulted under
     * `apiOnQuota: 'ask'`; absent is never read as granted, which is why this
     * is optional rather than defaulted anywhere.
     */
    readonly billingGrant?: boolean;
}

/** The base policy: exactly the three-plus-one no-double-charge classes. */
export const DEFAULT_FALLBACK_POLICY: FallbackPolicy = { apiOnQuota: false };

/**
 * Collapse the tri-state plus the grant into the boolean the eligibility rule
 * needs. `'ask'` without a grant is `false` — never `true` by omission, which
 * is the one direction that would turn a configured question into silent
 * metered spend.
 */
export function effectiveApiOnQuota(policy: FallbackPolicy): boolean {
    if (policy.apiOnQuota === 'ask') return policy.billingGrant === true;
    return policy.apiOnQuota === true;
}

/**
 * Parse a config value into the tri-state, or throw.
 *
 * Rejecting is the point. A parser that mapped an unknown value onto a truthy
 * default would turn a configured `off` into metered spend — the exact failure
 * the `'ask'` posture exists to prevent, introduced by the code that adds it.
 * Accepts the Python-ish spellings the council config has always allowed on
 * the boolean side, plus `ask` on the new one.
 */
export function apiOnQuotaView(raw: unknown): ApiOnQuota {
    // Lenient by design, unlike `parseApiOnQuota`: this feeds a DISPLAY
    // surface, where throwing on a malformed file would blank the wizard
    // instead of showing the operator the setting they need to fix. Reading
    // by value rather than by truthiness is the half that still matters —
    // `=== true` alone renders `'ask'` as `false`, and the next save
    // downgrades a configured question to a configured no.
    return raw === 'ask' ? 'ask' : raw === true;
}

export function parseApiOnQuota(raw: unknown): ApiOnQuota {
    if (typeof raw === 'boolean') return raw;
    if (raw === undefined || raw === null) return false;
    if (typeof raw === 'string') {
        const s = raw.trim().toLowerCase();
        if (s === 'ask') return 'ask';
        if (s === 'true' || s === 'yes' || s === 'on' || s === '1') return true;
        if (s === '' || s === 'false' || s === 'no' || s === 'off' || s === '0') {
            return false;
        }
    }
    throw new Error(
        `ai_council.fallback.api_on_quota: expected false | true | 'ask', got ${JSON.stringify(raw)}`,
    );
}

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
    // Prefix match, not equality: the detail carries the operator-facing reason
    // after the code, and that sentence IS the value of this class — collapsing
    // it back to a bare token would restore the opaque `exit_1` this replaced.
    // Also matched on the provider's own wording, so a model refused at call
    // time (one the deny-list has never seen) classifies the same as one the
    // pre-spend gate caught.
    if (
        s.startsWith('model_unservable') ||
        // The token the PRODUCERS actually write. R2 round 6, finding 4:
        // `clients.ts` emits `model_unsupported_on_transport` at both sites
        // (the pre-spend gate at :1857 and the turn-failed path at :2002) and
        // puts the vendor sentence in `metadata.detail`, never in `error` — so
        // the class matched nothing a caller could produce and the contract's
        // fourth eligible class was dead. The token is matched here rather
        // than renamed at the producers because `code:` values reach the
        // events log and a rename would break every reader of the history.
        s.startsWith('model_unsupported_on_transport') ||
        s.includes('is not supported when using codex')
    ) {
        return 'model_unservable';
    }
    if (s === 'timeout') return 'timeout';
    if (s === 'cli_quota_exhausted' || s === 'quota_exhausted') return 'quota_exhausted';
    if (/^exit_5\d\d$/.test(s) || s === 'server_error' || s === 'os') return 'server_error';
    return 'other';
}

/** True when `failure` is eligible to fall through to the `api` rung. */
export function isFallbackEligible(failure: CliFailureClass): boolean {
    return isFallbackEligibleUnder(failure, DEFAULT_FALLBACK_POLICY);
}

/**
 * Policy-aware variant: the base set, plus `quota_exhausted` when the
 * caller's policy opted in (`ai_council.fallback.api_on_quota`).
 * `timeout` / `server_error` are ineligible under EVERY policy — a
 * half-completed call must never be paid for twice, and no opt-in key
 * exists (or may be added) to override that.
 */
export function isFallbackEligibleUnder(
    failure: CliFailureClass,
    policy: FallbackPolicy,
): boolean {
    if (FALLBACK_ELIGIBLE.has(failure)) return true;
    return effectiveApiOnQuota(policy) && failure === 'quota_exhausted';
}

/**
 * Maps a mid-flight `CliFailureClass` (a call was actually attempted and
 * failed) onto the same `AbsentReason` enum a static resolution failure
 * uses (road-to-always-on-orchestration Phase 3.2/3.4), so a pass artifact
 * can bucket every absent member — whether it never got a transport at all
 * or lost one partway through — under one vocabulary. Returns `null` for a
 * failure class outside the four-value enum (`cli_unsupported`,
 * `server_error`, `model_unservable`, `other`); a caller falls back to the raw
 * failure detail for those rather than mis-classifying them.
 *
 * `model_unservable` is deliberately unmapped rather than folded into
 * `no_auth`: the credential is fine, the model is not, and the `detail` string
 * carries the specific reason. So the bucket a reader sees is still the generic
 * `unavailable`, while the line beside it now names the cause — an incomplete
 * improvement, stated as one.
 */
export function absentReasonFromCliFailure(failure: CliFailureClass): AbsentReason | null {
    switch (failure) {
        case 'binary_missing':
            return 'no_binary';
        case 'auth_rejected':
            return 'no_auth';
        case 'timeout':
            return 'timeout';
        case 'quota_exhausted':
            return 'quota';
        default:
            return null;
    }
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
    attempt(
        provider: string,
        failure: CliFailureClass,
        policy: FallbackPolicy = DEFAULT_FALLBACK_POLICY,
    ): 'api' | 'stop' {
        if (!isFallbackEligibleUnder(failure, policy)) return 'stop';
        if (this.used.has(provider)) return 'stop';
        this.used.add(provider);
        return 'api';
    }

    /**
     * Give a provider its one fallback back, because the twin never ran.
     *
     * R2 round 2, finding 8. `attempt` claims the slot at DECISION time, which
     * is correct — the claim is what stops a dead binary being retried once per
     * round. But a claim that is never CONSUMED must not stay spent: when the
     * projected-spend gate refuses the escalation, no api call happens, and
     * leaving the provider marked means the seat can never re-decide. Every
     * later round then re-spawns the dead cli binary and gets `'stop'`, which
     * is the exact per-round-ledger behaviour the invocation-scoped ledger was
     * chosen to avoid.
     *
     * Called ONLY on a path where the twin was built and then not called.
     * A provider that actually retried keeps its claim spent — that is the cap
     * working.
     */
    release(provider: string): void {
        this.used.delete(provider);
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
