/**
 * The billing-cliff gate — `api_on_quota: 'ask'`, the parked seat, and the
 * run-scoped grant.
 *
 * The property under test in every block below is the same one: a switch from
 * unmetered subscription billing to metered API billing never happens without
 * a human having said so for THIS run. Each block attacks it from the side
 * that could plausibly break it, which is why the negative assertions here
 * outnumber the positive ones.
 */

import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import {
    DEFAULT_FALLBACK_POLICY,
    effectiveApiOnQuota,
    isFallbackEligibleUnder,
    parseApiOnQuota,
} from '../../../src/scripts/ai_council/transport_resolver.js';
import {
    establishTwin,
    isEstablishedTwin,
    isParkedSeat,
    type FallbackEvent,
} from '../../../src/scripts/ai_council/mid_flight_fallback.js';
import { MidFlightFallback } from '../../../src/scripts/ai_council/transport_resolver.js';
import { buildFallback } from '../../../src/scripts/ai_council/fallback_config.js';
import { renderBillingGateLines } from '../../../src/scripts/_lib/council_fallback_posture.js';
import {
    BILLING_GRANT_ENV,
    BILLING_GRANT_MAX_AGE_MS,
    currentRunId,
    hasBillingGrant,
    isBillingGrantActive,
    issueBillingGrant,
    revokeBillingGrant,
} from '../../../src/scripts/_lib/billing_grant.js';
import { hardenedSpawnEnv } from '../../../src/scripts/_lib/spawn_env.js';
import { clearRunState } from '../../../src/scripts/hooks/run_continuation_hook.js';

describe('parseApiOnQuota — three values, and a refusal for everything else', () => {
    it('round-trips each of the three', () => {
        expect(parseApiOnQuota(false)).toBe(false);
        expect(parseApiOnQuota(true)).toBe(true);
        expect(parseApiOnQuota('ask')).toBe('ask');
    });

    it('treats absent as off, never as on', () => {
        expect(parseApiOnQuota(undefined)).toBe(false);
        expect(parseApiOnQuota(null)).toBe(false);
    });

    it('REJECTS an unknown value rather than coercing it', () => {
        // The whole reason this parser is not a truthiness test. A coercing
        // parser turns a typo into authorised metered spend, which is the
        // failure the `'ask'` posture exists to prevent.
        for (const bad of ['maybe', 'ASK ME', 42, {}, []]) {
            expect(() => parseApiOnQuota(bad)).toThrow(/api_on_quota/);
        }
    });
});

describe('buildFallback — the config surface accepts ask and nothing looser', () => {
    const d = {
        isDict: (v: unknown): v is Record<string, unknown> =>
            v !== null && typeof v === 'object' && !Array.isArray(v),
        isBool: (v: unknown): v is boolean => typeof v === 'boolean',
        isStr: (v: unknown): v is string => typeof v === 'string',
        repr: (v: unknown) => JSON.stringify(v),
        typeName: (v: unknown) => typeof v,
        sortedListRepr: (s: ReadonlySet<string>) => [...s].sort().join(', '),
        error: (m: string) => new Error(m),
    };

    it('accepts the three values', () => {
        expect(buildFallback({ api_on_quota: false }, d).api_on_quota).toBe(false);
        expect(buildFallback({ api_on_quota: true }, d).api_on_quota).toBe(true);
        expect(buildFallback({ api_on_quota: 'ask' }, d).api_on_quota).toBe('ask');
    });

    it('still refuses "yes" — widening for ask must not readmit a lenient parse', () => {
        expect(() => buildFallback({ api_on_quota: 'yes' }, d)).toThrow();
        expect(() => buildFallback({ api_on_quota: 'true' }, d)).toThrow();
    });

    it('keeps a malformed BLOCK degrading to off', () => {
        expect(buildFallback('nonsense', d).api_on_quota).toBe(false);
        expect(buildFallback({}, d).api_on_quota).toBe(false);
    });
});

describe('effectiveApiOnQuota — ask is never true by omission', () => {
    it('collapses ask+grant to true and ask-without-grant to false', () => {
        expect(effectiveApiOnQuota({ apiOnQuota: 'ask', billingGrant: true })).toBe(true);
        expect(effectiveApiOnQuota({ apiOnQuota: 'ask', billingGrant: false })).toBe(false);
        expect(effectiveApiOnQuota({ apiOnQuota: 'ask' })).toBe(false);
    });

    it('leaves the two booleans untouched, grant or no grant', () => {
        expect(effectiveApiOnQuota({ apiOnQuota: false, billingGrant: true })).toBe(false);
        expect(effectiveApiOnQuota({ apiOnQuota: true, billingGrant: false })).toBe(true);
        expect(effectiveApiOnQuota(DEFAULT_FALLBACK_POLICY)).toBe(false);
    });

    it('keeps quota eligibility gated on the effective value', () => {
        expect(isFallbackEligibleUnder('quota_exhausted', { apiOnQuota: 'ask' })).toBe(false);
        expect(
            isFallbackEligibleUnder('quota_exhausted', { apiOnQuota: 'ask', billingGrant: true }),
        ).toBe(true);
        // Unchanged for the never-eligible classes under every posture.
        expect(
            isFallbackEligibleUnder('timeout', { apiOnQuota: 'ask', billingGrant: true }),
        ).toBe(false);
    });
});

describe('establishTwin — the third outcome', () => {
    const member = { name: 'anthropic' } as never;
    const opts = (apiOnQuota: boolean | 'ask', grant: boolean, events: FallbackEvent[]) => ({
        api_on_quota: apiOnQuota,
        billing_grant: grant,
        construct: () => ({ name: 'anthropic-api' }) as never,
        on_event: (e: FallbackEvent) => events.push(e),
    });

    it('PARKS the seat under ask with no grant — neither twin nor loss', () => {
        const events: FallbackEvent[] = [];
        let constructed = 0;
        const out = establishTwin({
            member,
            error: 'cli_quota_exhausted',
            fallback: {
                ...opts('ask', false, events),
                construct: () => {
                    constructed += 1;
                    return { name: 'anthropic-api' } as never;
                },
            },
            ledger: new MidFlightFallback(),
        });
        // No api client is built. Construction is where the key gate and the
        // metered rung come into existence, so a parked seat that constructed
        // one would have paid the setup cost of the decision it is deferring.
        expect(constructed).toBe(0);
        expect(isParkedSeat(out)).toBe(true);
        expect(isEstablishedTwin(out)).toBe(false);
        expect(events).toEqual([
            {
                provider: 'anthropic',
                failure: 'quota_exhausted',
                outcome: 'awaiting_grant',
                api_on_quota: 'ask',
            },
        ]);
    });

    it('does NOT spend the ledger attempt while parked', () => {
        // Parking must leave the seat escalatable on the grant. A ledger claim
        // taken here would make the yes arrive too late to be usable.
        const ledger = new MidFlightFallback();
        establishTwin({
            member,
            error: 'cli_quota_exhausted',
            fallback: opts('ask', false, []),
            ledger,
        });
        expect(ledger.attempt('anthropic', 'quota_exhausted', { apiOnQuota: true })).toBe('api');
    });

    it('establishes the twin under ask WITH a grant', () => {
        const out = establishTwin({
            member,
            error: 'cli_quota_exhausted',
            fallback: opts('ask', true, []),
            ledger: new MidFlightFallback(),
        });
        expect(isEstablishedTwin(out)).toBe(true);
    });

    it('leaves the two booleans behaving exactly as before', () => {
        const off = establishTwin({
            member,
            error: 'cli_quota_exhausted',
            fallback: opts(false, false, []),
            ledger: new MidFlightFallback(),
        });
        expect(off).toBeNull();
        const on = establishTwin({
            member,
            error: 'cli_quota_exhausted',
            fallback: opts(true, false, []),
            ledger: new MidFlightFallback(),
        });
        expect(isEstablishedTwin(on)).toBe(true);
    });

    it('never parks a failure class that is not a quota exhaustion', () => {
        const out = establishTwin({
            member,
            error: 'timeout',
            fallback: opts('ask', false, []),
            ledger: new MidFlightFallback(),
        });
        expect(out).toBeNull();
    });
});

describe('renderBillingGateLines', () => {
    it('is empty when nothing parked, so a caller needs no branch', () => {
        expect(renderBillingGateLines([], { runId: 'r1', estimatedUsd: 1 })).toEqual([]);
    });

    it('names the seats, the cost and the exact grant command', () => {
        const lines = renderBillingGateLines(['openai', 'anthropic', 'openai'], {
            runId: 'run-42',
            estimatedUsd: 0.5,
        }).join('\n');
        expect(lines).toContain('anthropic, openai'); // deduped and sorted
        expect(lines).toContain('~$0.50');
        expect(lines).toContain('council:grant-billing run-42');
    });

    it('says the cost is unknown rather than printing a fabricated zero', () => {
        const lines = renderBillingGateLines(['openai'], {
            runId: 'r',
            estimatedUsd: null,
        }).join('\n');
        expect(lines).toContain('unknown');
        expect(lines).not.toContain('$0.00');
    });
});

describe('the run-scoped grant', () => {
    let root: string;
    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'ac-billing-grant-'));
    });
    afterEach(() => {
        fs.rmSync(root, { recursive: true, force: true });
    });

    const env = (runId?: string): NodeJS.ProcessEnv =>
        runId === undefined ? {} : { [BILLING_GRANT_ENV]: runId };

    it('is in force only when the env var NAMES the run whose file exists', () => {
        issueBillingGrant(root, 'run-a');
        expect(isBillingGrantActive(root, 'run-a', env('run-a'))).toBe(true);
        // File without the env var: not a grant.
        expect(isBillingGrantActive(root, 'run-a', env())).toBe(false);
        // Env var without the file: not a grant either.
        expect(isBillingGrantActive(root, 'run-b', env('run-b'))).toBe(false);
    });

    it("is NOT satisfiable by a different run's id", () => {
        issueBillingGrant(root, 'run-a');
        expect(isBillingGrantActive(root, 'run-b', env('run-a'))).toBe(false);
        expect(hasBillingGrant(root, env('run-a'))).toBe(true);
        // The second run's own check, with the first run's env still set.
        expect(isBillingGrantActive(root, 'run-b', env('run-a'))).toBe(false);
    });

    it('is absent after revoke — the run-end path', () => {
        issueBillingGrant(root, 'run-a');
        revokeBillingGrant(root, 'run-a');
        expect(isBillingGrantActive(root, 'run-a', env('run-a'))).toBe(false);
        // Revoking an absent grant is the success case, not an error.
        expect(() => revokeBillingGrant(root, 'run-a')).not.toThrow();
    });

    it('does not extend its backstop window on a re-issue', () => {
        const first = issueBillingGrant(root, 'run-a', () => new Date('2026-08-22T00:00:00Z'));
        const second = issueBillingGrant(root, 'run-a', () => new Date('2026-08-22T06:00:00Z'));
        expect(second.issued_at).toBe(first.issued_at);
    });

    it('expires at the backstop for a run that died without cleaning up', () => {
        issueBillingGrant(root, 'run-a', () => new Date('2026-08-20T00:00:00Z'));
        const wayLater = () => new Date(Date.parse('2026-08-20T00:00:00Z') + BILLING_GRANT_MAX_AGE_MS + 1);
        expect(isBillingGrantActive(root, 'run-a', env('run-a'), wayLater)).toBe(false);
    });

    it('is revoked by the run-end state-cleared path', () => {
        issueBillingGrant(root, 'run-a');
        expect(isBillingGrantActive(root, 'run-a', env('run-a'))).toBe(true);
        clearRunState(root, 'run-a', path.join(root, 'nonexistent-state.json'), false);
        expect(isBillingGrantActive(root, 'run-a', env('run-a'))).toBe(false);
    });

    it('resolves no run id rather than inventing one', () => {
        expect(currentRunId({})).toBeNull();
        expect(currentRunId({ AC_RUN_ID: 'from-orchestrator' })).toBe('from-orchestrator');
        expect(currentRunId({ [BILLING_GRANT_ENV]: 'from-grant', AC_RUN_ID: 'x' })).toBe(
            'from-grant',
        );
    });
});

describe('hardenedSpawnEnv passes the AC_ family to subagents', () => {
    it('preserves an AC_ variable while scrubbing LD_PRELOAD', () => {
        // The control is the point. Asserting only the pass-through would stay
        // green if `hardenedSpawnEnv` degraded into a no-op that scrubs
        // nothing, which is a strictly worse failure than the one this pins.
        const before = { AC: process.env.AC_BILLING_GRANT, LD: process.env.LD_PRELOAD };
        process.env.AC_BILLING_GRANT = 'run-xyz';
        process.env.LD_PRELOAD = '/evil.so';
        try {
            const out = hardenedSpawnEnv();
            expect(out.AC_BILLING_GRANT).toBe('run-xyz');
            expect(out.LD_PRELOAD).toBeUndefined();
        } finally {
            if (before.AC === undefined) delete process.env.AC_BILLING_GRANT;
            else process.env.AC_BILLING_GRANT = before.AC;
            if (before.LD === undefined) delete process.env.LD_PRELOAD;
            else process.env.LD_PRELOAD = before.LD;
        }
    });
});
