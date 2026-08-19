/**
 * Phase 2 of `road-to-zero-ceremony-detection` — the `auto` chain, the billing
 * invariant, and the mid-flight fallback guard.
 *
 * The five synthetic machines mirror the detector's fixture set, built here as
 * plain `EnvironmentReport` literals so this suite stays pure (no filesystem).
 */

import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
    MidFlightFallback,
    VALID_TRANSPORT_MODES,
    absentReasonFromCliFailure,
    classifyCliFailure,
    isFallbackEligible,
    isFallbackEligibleUnder,
    resolveMemberTransport,
    resolveTransport,
    type AbsentReason,
    type CliFailureClass,
} from '../../../src/scripts/ai_council/transport_resolver.js';
import {
    classifyBilling,
    knownProviders,
    type AuthSource,
    type DetectedAuth,
    type DetectedHost,
    type EnvironmentReport,
} from '../../../src/scripts/_lib/environment_detector.js';

const RESOLVER_SRC = path.join(
    process.cwd(),
    'src',
    'scripts',
    'ai_council',
    'transport_resolver.ts',
);

function host(id: string, binary: string | null): DetectedHost {
    return { id, installed: binary !== null, binary, version: binary === null ? null : '1.0.0' };
}

function auth(provider: string, source: AuthSource, evidence = '/fixture'): DetectedAuth {
    return { provider, source, evidence };
}

function report(
    opts: { hosts?: DetectedHost[]; auth?: DetectedAuth[] } = {},
): EnvironmentReport {
    return { hosts: opts.hosts ?? [], auth: opts.auth ?? [], keys: [] };
}

// ── the five synthetic machines ───────────────────────────────────────

const BARE = report();

const CLI_ONLY = report({
    hosts: [host('claude-code', '/usr/local/bin/claude')],
    auth: [auth('anthropic', 'cli-subscription', '/home/u/.claude/.credentials.json')],
});

const KEYS_ONLY = report({
    auth: [auth('anthropic', 'key-file', '/home/u/.event4u/agent-config/anthropic.key')],
});

const MIXED = report({
    hosts: [host('claude-code', '/usr/local/bin/claude')],
    auth: [
        auth('anthropic', 'cli-subscription', '/home/u/.claude/.credentials.json'),
        auth('anthropic', 'key-file', '/home/u/.event4u/agent-config/anthropic.key'),
    ],
});

/** Codex auth.json present but unreadable — over-gated to `cli-api-key`. */
const UNREADABLE_CREDENTIAL = report({
    hosts: [host('codex', '/usr/local/bin/codex')],
    auth: [auth('openai', 'cli-api-key', '/home/u/.codex/auth.json')],
});

const MACHINES: ReadonlyArray<readonly [string, EnvironmentReport]> = [
    ['bare', BARE],
    ['cli-only', CLI_ONLY],
    ['keys-only', KEYS_ONLY],
    ['mixed', MIXED],
    ['unreadable-credential-file', UNREADABLE_CREDENTIAL],
];

describe('VALID_TRANSPORT_MODES', () => {
    it('adds auto without removing manual or any other transport', () => {
        expect([...VALID_TRANSPORT_MODES].sort()).toEqual(['api', 'auto', 'cli', 'manual']);
    });
});

describe('explicit modes pass through unchanged', () => {
    it('never overrides an explicitly requested transport', () => {
        for (const [, machine] of MACHINES) {
            for (const mode of ['api', 'manual', 'cli'] as const) {
                const r = resolveTransport({ provider: 'anthropic', mode, report: machine });
                expect(r.available).toBe(true);
                expect(r.transport).toBe(mode);
                expect(r.reason).toBeNull();
            }
        }
    });

    it('marks manual as making no provider call', () => {
        const r = resolveTransport({ provider: 'anthropic', mode: 'manual', report: MIXED });
        expect(r.makesProviderCall).toBe(false);
    });

    it('marks api and cli as making a provider call', () => {
        for (const mode of ['api', 'cli'] as const) {
            expect(
                resolveTransport({ provider: 'anthropic', mode, report: MIXED }).makesProviderCall,
            ).toBe(true);
        }
    });

    it('rejects an unknown mode with a reason naming the accepted values', () => {
        const r = resolveTransport({ provider: 'anthropic', mode: 'bogus', report: MIXED });
        expect(r.available).toBe(false);
        expect(r.transport).toBeNull();
        expect(r.reason).toContain('api, auto, cli, manual');
    });
});

describe('auto resolves correctly on all five fixture machines', () => {
    it('bare — unavailable, with a non-empty one-line reason', () => {
        const r = resolveTransport({ provider: 'anthropic', mode: 'auto', report: BARE });
        expect(r.available).toBe(false);
        expect(r.transport).toBeNull();
        expect(r.reason).toBeTruthy();
        expect(r.reason).toContain('claude');
        expect(r.reason).toContain('not on PATH');
    });

    it('cli-only — picks cli and classifies it as subscription', () => {
        const r = resolveTransport({ provider: 'anthropic', mode: 'auto', report: CLI_ONLY });
        expect(r.available).toBe(true);
        expect(r.transport).toBe('cli');
        expect(r.authSource).toBe('cli-subscription');
        expect(r.billing).toBe('subscription');
    });

    it('keys-only — falls to the api rung and stays metered', () => {
        const r = resolveTransport({ provider: 'anthropic', mode: 'auto', report: KEYS_ONLY });
        expect(r.transport).toBe('api');
        expect(r.billing).toBe('per-token');
    });

    it('mixed — prefers the cli rung over the key', () => {
        const r = resolveTransport({ provider: 'anthropic', mode: 'auto', report: MIXED });
        expect(r.transport).toBe('cli');
        expect(r.billing).toBe('subscription');
    });

    it('unreadable-credential-file — cli is usable but stays metered', () => {
        const r = resolveTransport({
            provider: 'openai',
            mode: 'auto',
            report: UNREADABLE_CREDENTIAL,
        });
        expect(r.transport).toBe('cli');
        expect(r.authSource).toBe('cli-api-key');
        // Presence without a classifiable plan must not switch the USD gate off.
        expect(r.billing).toBe('per-token');
    });

    it('every machine yields either a transport or a non-empty reason — never neither', () => {
        for (const [label, machine] of MACHINES) {
            for (const provider of knownProviders()) {
                const r = resolveTransport({ provider, mode: 'auto', report: machine });
                if (r.available) {
                    expect(r.transport, `${label}/${provider}`).not.toBeNull();
                    expect(r.reason, `${label}/${provider}`).toBeNull();
                } else {
                    expect(r.transport, `${label}/${provider}`).toBeNull();
                    expect((r.reason ?? '').length, `${label}/${provider}`).toBeGreaterThan(0);
                }
            }
        }
    });
});

describe('auto chain details', () => {
    it('needs BOTH a binary and a credential for the cli rung', () => {
        const binaryNoAuth = report({ hosts: [host('claude-code', '/usr/local/bin/claude')] });
        const r = resolveTransport({ provider: 'anthropic', mode: 'auto', report: binaryNoAuth });
        expect(r.available).toBe(false);
        expect(r.reason).toContain('not authenticated');

        const authNoBinary = report({ auth: [auth('anthropic', 'cli-subscription')] });
        const r2 = resolveTransport({ provider: 'anthropic', mode: 'auto', report: authNoBinary });
        expect(r2.available).toBe(false);
        expect(r2.reason).toContain('not on PATH');
        expect(r2.reason).toContain('credential is present');
    });

    it('honours a member binary override when the CLI is not on PATH', () => {
        const authOnly = report({ auth: [auth('anthropic', 'cli-subscription')] });
        const r = resolveTransport({
            provider: 'anthropic',
            mode: 'auto',
            report: authOnly,
            binaryOverride: '/opt/custom/claude',
        });
        expect(r.transport).toBe('cli');
    });

    it('ignores a blank binary override', () => {
        const authOnly = report({ auth: [auth('anthropic', 'cli-subscription')] });
        const r = resolveTransport({
            provider: 'anthropic',
            mode: 'auto',
            report: authOnly,
            binaryOverride: '   ',
        });
        expect(r.available).toBe(false);
    });

    it('matches a Windows-suffixed binary against the provider default name', () => {
        const win = report({
            hosts: [host('claude-code', 'C:\\bin\\claude.cmd')],
            auth: [auth('anthropic', 'cli-subscription')],
        });
        expect(
            resolveTransport({ provider: 'anthropic', mode: 'auto', report: win }).transport,
        ).toBe('cli');
    });

    it('lets an explicit apiKeyPresent stand in for a detected key', () => {
        const r = resolveTransport({
            provider: 'gemini',
            mode: 'auto',
            report: BARE,
            apiKeyPresent: true,
        });
        expect(r.transport).toBe('api');
    });

    it('never selects manual — auto is not allowed to end at copy-paste', () => {
        for (const [, machine] of MACHINES) {
            for (const provider of knownProviders()) {
                const r = resolveTransport({ provider, mode: 'auto', report: machine });
                expect(r.transport).not.toBe('manual');
            }
        }
    });

    it('does not credit a community CLI with a subscription under auto', () => {
        const communityCli = report({
            hosts: [host('grok-host', '/usr/local/bin/grok')],
            auth: [auth('xai', 'env-key', 'env:XAI_API_KEY')],
        });
        const r = resolveTransport({ provider: 'xai', mode: 'auto', report: communityCli });
        // An env key is not a CLI login, so auto lands on the api rung; either
        // way the billing class stays metered.
        expect(r.billing).toBe('per-token');
    });
});

describe('billing is never derived from transport', () => {
    it('gives the same billing class for every transport on one machine', () => {
        for (const [label, machine] of MACHINES) {
            for (const provider of knownProviders()) {
                const classes = new Set(
                    (['api', 'manual', 'cli'] as const).map(
                        (mode) => resolveTransport({ provider, mode, report: machine }).billing,
                    ),
                );
                // One machine, one auth source, one billing answer — the chosen
                // transport cannot move it.
                expect(classes.size, `${label}/${provider}`).toBe(1);
            }
        }
    });

    it('agrees with classifyBilling over the detected source', () => {
        for (const [, machine] of MACHINES) {
            for (const provider of knownProviders()) {
                const r = resolveTransport({ provider, mode: 'auto', report: machine });
                expect(r.billing).toBe(classifyBilling(provider, r.authSource));
            }
        }
    });

    it('reports an unavailable member as metered, never as free', () => {
        const r = resolveTransport({ provider: 'anthropic', mode: 'auto', report: BARE });
        expect(r.available).toBe(false);
        expect(r.billing).toBe('per-token');
    });

    it('never writes a billing literal — every value comes from classifyBilling', () => {
        const src = fs.readFileSync(RESOLVER_SRC, 'utf-8');
        // The mechanism, not a paraphrase of it: the resolver computes the
        // class exactly once, from (provider, authSource), and passes that
        // value around. A hand-written 'subscription' / 'per-token' anywhere in
        // this file would be a billing decision made outside classifyBilling —
        // which is how a transport-derived class would sneak back in.
        const codeLines = src
            .split('\n')
            .filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l))
            .join('\n');
        expect(codeLines).not.toMatch(/'subscription'/);
        expect(codeLines).not.toMatch(/'per-token'/);
        expect(src).toContain('classifyBilling(provider, authSource)');
        expect(src.match(/classifyBilling\(/g)).toHaveLength(1);
    });
});

describe('mid-flight fallback — failure classification', () => {
    const CASES: ReadonlyArray<readonly [string, CliFailureClass]> = [
        ['binary_missing', 'binary_missing'],
        ['file_not_found', 'binary_missing'],
        ['auth_expired', 'auth_rejected'],
        ['unauthorized', 'auth_rejected'],
        ['cli_unsupported', 'cli_unsupported'],
        ['parse_failed', 'cli_unsupported'],
        ['timeout', 'timeout'],
        ['cli_quota_exhausted', 'quota_exhausted'],
        ['exit_503', 'server_error'],
        ['exit_500', 'server_error'],
        ['os', 'server_error'],
        ['exit_1', 'other'],
        ['something-else', 'other'],
    ];

    for (const [raw, expected] of CASES) {
        it(`maps ${raw} → ${expected}`, () => {
            expect(classifyCliFailure(raw)).toBe(expected);
            expect(classifyCliFailure(` ${raw.toUpperCase()} `)).toBe(expected);
        });
    }
});

describe('mid-flight fallback — both directions pinned', () => {
    it('falls through for binary-missing, auth-rejected and cli-unsupported', () => {
        for (const f of ['binary_missing', 'auth_rejected', 'cli_unsupported'] as const) {
            expect(isFallbackEligible(f)).toBe(true);
        }
    });

    it('does NOT fall through for a timeout — the call may have half-completed', () => {
        expect(isFallbackEligible('timeout')).toBe(false);
    });

    it('does NOT fall through for a 5xx — same double-spend risk', () => {
        expect(isFallbackEligible('server_error')).toBe(false);
        expect(isFallbackEligible(classifyCliFailure('exit_502'))).toBe(false);
    });

    it('does NOT fall through for an exhausted quota — that cap is deliberate', () => {
        expect(isFallbackEligible('quota_exhausted')).toBe(false);
    });

    it('does NOT fall through for an unclassified failure', () => {
        expect(isFallbackEligible('other')).toBe(false);
    });

    it('falls back exactly once per provider within one invocation', () => {
        const ledger = new MidFlightFallback();
        expect(ledger.attempt('anthropic', 'auth_rejected')).toBe('api');
        // Second eligible failure for the same provider: no second retry, so a
        // question can never be paid for twice.
        expect(ledger.attempt('anthropic', 'auth_rejected')).toBe('stop');
        expect(ledger.attempt('anthropic', 'binary_missing')).toBe('stop');
        expect(ledger.spent()).toEqual(['anthropic']);
    });

    it('tracks providers independently', () => {
        const ledger = new MidFlightFallback();
        expect(ledger.attempt('anthropic', 'binary_missing')).toBe('api');
        expect(ledger.attempt('openai', 'binary_missing')).toBe('api');
        expect(ledger.spent()).toEqual(['anthropic', 'openai']);
    });

    it('a planted timeout never consumes the fallback budget', () => {
        const ledger = new MidFlightFallback();
        expect(ledger.attempt('anthropic', 'timeout')).toBe('stop');
        expect(ledger.spent()).toEqual([]);
        // The budget is still intact for a genuinely eligible failure.
        expect(ledger.attempt('anthropic', 'auth_rejected')).toBe('api');
    });

    it('a fresh invocation starts with a fresh budget', () => {
        const first = new MidFlightFallback();
        expect(first.attempt('anthropic', 'auth_rejected')).toBe('api');
        const second = new MidFlightFallback();
        expect(second.attempt('anthropic', 'auth_rejected')).toBe('api');
    });
});

describe('fallback policy — api_on_quota opt-in', () => {
    it('quota is eligible ONLY under the opt-in policy', () => {
        expect(isFallbackEligibleUnder('quota_exhausted', { apiOnQuota: false })).toBe(false);
        expect(isFallbackEligibleUnder('quota_exhausted', { apiOnQuota: true })).toBe(true);
        // Both raw shapes classify into the one class the policy gates —
        // the local `cli_call_budget` refusal and the provider-side reject.
        expect(
            isFallbackEligibleUnder(classifyCliFailure('cli_quota_exhausted'), { apiOnQuota: true }),
        ).toBe(true);
    });

    it('the opt-in widens quota only — timeout and 5xx stay ineligible under every policy', () => {
        expect(isFallbackEligibleUnder('timeout', { apiOnQuota: true })).toBe(false);
        expect(isFallbackEligibleUnder('server_error', { apiOnQuota: true })).toBe(false);
        expect(isFallbackEligibleUnder('other', { apiOnQuota: true })).toBe(false);
    });

    it('the base classes stay eligible regardless of the quota flag', () => {
        for (const f of ['binary_missing', 'auth_rejected', 'cli_unsupported'] as const) {
            expect(isFallbackEligibleUnder(f, { apiOnQuota: false })).toBe(true);
        }
    });

    it('the ledger honours the policy: quota consumes the one retry only when opted in', () => {
        const ledger = new MidFlightFallback();
        expect(ledger.attempt('anthropic', 'quota_exhausted')).toBe('stop');
        expect(ledger.attempt('anthropic', 'quota_exhausted', { apiOnQuota: false })).toBe('stop');
        expect(ledger.spent()).toEqual([]);
        expect(ledger.attempt('anthropic', 'quota_exhausted', { apiOnQuota: true })).toBe('api');
        // Once spent, spent — the flag does not grant a second retry.
        expect(ledger.attempt('anthropic', 'quota_exhausted', { apiOnQuota: true })).toBe('stop');
        expect(ledger.spent()).toEqual(['anthropic']);
    });

    it('the default-policy wrapper stays byte-identical to the base set', () => {
        expect(isFallbackEligible('quota_exhausted')).toBe(false);
        expect(isFallbackEligible('model_unservable')).toBe(true);
    });
});

// ── road-to-always-on-orchestration Phase 3.2 — graded degradation ──────

describe('absentReason — static auto-chain classification', () => {
    it('is null for every available result', () => {
        for (const [, machine] of MACHINES) {
            for (const mode of ['api', 'manual', 'cli', 'auto'] as const) {
                const r = resolveTransport({ provider: 'anthropic', mode, report: machine });
                if (r.available) {
                    expect(r.absentReason).toBeNull();
                }
            }
        }
    });

    it('classifies bare (no binary, no key) as no_binary', () => {
        const r = resolveTransport({ provider: 'anthropic', mode: 'auto', report: BARE });
        expect(r.available).toBe(false);
        expect(r.absentReason).toBe('no_binary');
    });

    it('classifies a credential with no resolvable binary as no_binary', () => {
        const authNoBinary = report({ auth: [auth('anthropic', 'cli-subscription')] });
        const r = resolveTransport({ provider: 'anthropic', mode: 'auto', report: authNoBinary });
        expect(r.available).toBe(false);
        expect(r.absentReason).toBe('no_binary');
    });

    it('classifies a resolvable-but-unauthenticated binary with no key as no_auth', () => {
        const binaryNoAuth = report({ hosts: [host('claude-code', '/usr/local/bin/claude')] });
        const r = resolveTransport({ provider: 'anthropic', mode: 'auto', report: binaryNoAuth });
        expect(r.available).toBe(false);
        expect(r.absentReason).toBe('no_auth');
    });

    it('is null for the "unknown mode" validation-error path — a config bug, not a missing-capability finding', () => {
        const r = resolveTransport({ provider: 'anthropic', mode: 'bogus', report: MIXED });
        expect(r.available).toBe(false);
        expect(r.absentReason).toBeNull();
    });
});

describe('absentReasonFromCliFailure — mid-flight mapping onto the same enum', () => {
    const CASES: ReadonlyArray<readonly [CliFailureClass, AbsentReason | null]> = [
        ['binary_missing', 'no_binary'],
        ['auth_rejected', 'no_auth'],
        ['timeout', 'timeout'],
        ['quota_exhausted', 'quota'],
        ['cli_unsupported', null],
        ['server_error', null],
        ['other', null],
    ];

    for (const [failure, expected] of CASES) {
        it(`maps ${failure} → ${String(expected)}`, () => {
            expect(absentReasonFromCliFailure(failure)).toBe(expected);
        });
    }
});

// ── road-to-always-on-orchestration Phase 3.1 — the reconciliation ──────

describe('resolveMemberTransport — the reconciled entry point', () => {
    it('resolves the same concrete transport as calling resolve_mode then resolveTransport by hand', () => {
        for (const [, machine] of MACHINES) {
            for (const provider of knownProviders()) {
                const combined = resolveMemberTransport({
                    provider,
                    report: machine,
                    globalMode: 'auto',
                });
                const direct = resolveTransport({ provider, mode: 'auto', report: machine });
                expect(combined.configuredMode).toBe('auto');
                expect(combined.transport).toBe(direct.transport);
                expect(combined.available).toBe(direct.available);
                expect(combined.absentReason).toBe(direct.absentReason);
                expect(combined.billing).toBe(direct.billing);
            }
        }
    });

    it('expands the literal `auto` a bare mode-switch would choke on — the gap this function closes', () => {
        // council_cli.ts::build_members has no `mode === 'auto'` branch today;
        // this is the reconciled path that DOES expand it, on the cli-only
        // fixture where auto should pick the cli rung.
        const r = resolveMemberTransport({ provider: 'anthropic', report: CLI_ONLY, globalMode: 'auto' });
        expect(r.configuredMode).toBe('auto');
        expect(r.transport).toBe('cli');
        expect(r.available).toBe(true);
    });

    it('honours the full four-layer precedence (invocation > member > global > built-in)', () => {
        const r = resolveMemberTransport({
            provider: 'anthropic',
            report: BARE,
            invocationMode: 'manual',
            memberSettings: { mode: 'api' },
            globalMode: 'cli',
        });
        expect(r.configuredMode).toBe('manual');
        expect(r.transport).toBe('manual');
        expect(r.available).toBe(true);
    });

    it('falls to the built-in `manual` fallback when no layer supplies anything', () => {
        const r = resolveMemberTransport({ provider: 'anthropic', report: BARE });
        expect(r.configuredMode).toBe('manual');
        expect(r.transport).toBe('manual');
    });

    it('passes an explicit apiKeyPresent through to the underlying auto chain', () => {
        const r = resolveMemberTransport({
            provider: 'gemini',
            report: BARE,
            globalMode: 'auto',
            apiKeyPresent: true,
        });
        expect(r.transport).toBe('api');
    });

    it('rejects an invalid configured mode the same way resolve_mode does', () => {
        expect(() =>
            resolveMemberTransport({ provider: 'anthropic', report: BARE, globalMode: 'bogus' }),
        ).toThrow(/expected one of/);
    });
});

describe('classifyCliFailure — the token the producers actually write', () => {
    // R2 round 6, finding 4. `model_unservable` is one of the four
    // fallback-eligible classes, and the classifier matched a token no
    // producer emits: `clients.ts` writes `model_unsupported_on_transport` at
    // both sites and puts the vendor sentence in `metadata.detail`, never in
    // `error`. The contract's fourth eligible class was dead.
    it('model_unsupported_on_transport classifies as model_unservable', () => {
        expect(classifyCliFailure('model_unsupported_on_transport')).toBe('model_unservable');
    });

    it('and is therefore fallback-eligible end to end', () => {
        expect(isFallbackEligible(classifyCliFailure('model_unsupported_on_transport'))).toBe(true);
    });

    it('the original token and the vendor sentence still classify', () => {
        expect(classifyCliFailure('model_unservable')).toBe('model_unservable');
        expect(classifyCliFailure('o3 is not supported when using codex')).toBe('model_unservable');
    });

    it('an unrelated token is unaffected', () => {
        expect(classifyCliFailure('timeout')).toBe('timeout');
        expect(classifyCliFailure('something_else')).toBe('other');
    });
});
