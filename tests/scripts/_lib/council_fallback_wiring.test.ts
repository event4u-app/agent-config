/**
 * `buildFallbackOptions` — the twin factory's refusal set and its event sink.
 *
 * Nothing tested this module before R2 round 6, which is how its critical
 * finding survived: the refusal set was one name short, and the missing name
 * was the ORDINARY shape of the configuration the fallback exists for.
 */
import { describe, expect, it, vi } from 'vitest';

import { buildFallbackOptions } from '../../../src/scripts/_lib/council_fallback_wiring.js';
import { CliClientError, KeyGateError } from '../../../src/scripts/ai_council/clients.js';
import { CouncilConfigError } from '../../../src/scripts/ai_council/config.js';

type Deps = Parameters<typeof buildFallbackOptions>[0];

const deps = (over: Partial<Deps> = {}): Deps =>
    ({
        apiOnQuota: false,
        hasApiRung: (): boolean => true,
        memberConfig: (): Record<string, unknown> => ({}),
        modelOverride: (): string | null => null,
        constructApi: (): unknown => ({ name: 'anthropic' }),
        emit: (): unknown => undefined,
        ...over,
    }) as Deps;

describe('buildFallbackOptions — construct() refusals cost one seat, never the pass', () => {
    // Each of these is a REFUSAL: the provider cannot be built on the api rung,
    // which loses that seat. Throwing out of `construct` instead kills
    // `consult` — and none of these is in `main`'s catch list.
    const refusals: Array<[string, Error]> = [
        // R2 round 6, finding 1. An api twin for a subscription-auth member
        // raises this whenever the key is absent or violates the 0600
        // contract, which is exactly the shape the fallback targets: a cli
        // member, no `api_key_ref`, no local key.
        ['KeyGateError', new KeyGateError('key file is 0644')],
        ['CliClientError', new CliClientError('binary missing')],
        ['CouncilConfigError', new CouncilConfigError('bad config')],
    ];

    for (const [name, err] of refusals) {
        it(`${name} returns null rather than escaping the factory`, () => {
            const opts = buildFallbackOptions(
                deps({
                    constructApi: (): unknown => {
                        throw err;
                    },
                }),
            );
            expect(opts.construct('anthropic')).toBeNull();
        });
    }

    it('an UNEXPECTED error still propagates — the set is a refusal list, not a swallow', () => {
        const opts = buildFallbackOptions(
            deps({
                constructApi: (): unknown => {
                    throw new TypeError('a real bug');
                },
            }),
        );
        expect(() => opts.construct('anthropic')).toThrow(TypeError);
    });

    it('a provider with no api rung is refused before construction is attempted', () => {
        const constructApi = vi.fn();
        const opts = buildFallbackOptions(deps({ hasApiRung: () => false, constructApi }));
        expect(opts.construct('xai')).toBeNull();
        expect(constructApi).not.toHaveBeenCalled();
    });

    it('a successful construction is returned as the twin', () => {
        const twin = { name: 'anthropic', model: 'x' };
        const opts = buildFallbackOptions(deps({ constructApi: () => twin }));
        expect(opts.construct('anthropic')).toBe(twin);
    });
});

describe('buildFallbackOptions — the event sink never fails the pass', () => {
    it('an events-log write failure is swallowed', () => {
        const opts = buildFallbackOptions(
            deps({
                emit: (): unknown => {
                    throw new Error('EROFS: read-only file system');
                },
            }),
        );
        expect(() =>
            opts.on_event?.({
                provider: 'anthropic',
                failure: 'auth_expired',
                outcome: 'retried',
                api_on_quota: false,
            }),
        ).not.toThrow();
    });

    it('a working sink receives the transport_fallback record', () => {
        const seen: Record<string, unknown>[] = [];
        const opts = buildFallbackOptions(
            deps({
                emit: (r): unknown => {
                    seen.push(r as Record<string, unknown>);
                    return undefined;
                },
            }),
        );
        opts.on_event?.({
            provider: 'openai',
            failure: 'quota_exhausted',
            outcome: 'cost_budget',
            api_on_quota: true,
        });
        expect(seen).toHaveLength(1);
        expect(seen[0]).toMatchObject({
            action: 'transport_fallback',
            provider: 'openai',
            failure_class: 'quota_exhausted',
            outcome: 'cost_budget',
            api_on_quota: true,
        });
    });
});
