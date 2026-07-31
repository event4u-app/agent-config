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
    classifyCliFailure,
    isFallbackEligible,
    resolveTransport,
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
