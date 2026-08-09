// Unit tests for the host-capability manifest normalizer + registry resolver
// (`_lib/host_capability.ts`).
//
// The contract under test (host-capability-manifest.md): the safe default is
// ALL boolean fields `false`, a missing or invalidly-typed field resolves to
// `false` (never `true`), and `schema_version` is always forced to `1`. These
// cases lock that safe-default-first behavior so an unknown host is never
// assumed to support a subagent primitive it does not have.
//
// `resolveHostCapabilities` (F5, road-to-orchestrator-discipline-carriers)
// layers a committed registry in front of the safe default: explicit
// settings override (wins, whole-object) → registry row for the detected
// host → SAFE_DEFAULT. The registry-hit / registry-miss / override-beats-
// registry cases below lock that order; the end-to-end block feeds a
// resolved manifest straight into `classifyTask` (auto_dispatch.ts) so the
// activation gate itself — not just the manifest shape — is exercised.
import { describe, expect, it } from 'vitest';

import {
    normalizeHostManifest,
    resolveHostCapabilities,
    type HostCapabilityManifest,
} from '../../src/scripts/_lib/host_capability.js';
import { classifyTask, type ActivationInputs } from '../../src/scripts/_lib/auto_dispatch.js';

const ALL_FALSE: HostCapabilityManifest = {
    schema_version: 1,
    subagent_spawn: false,
    parallel_spawn: false,
    status_polling: false,
    separate_quota_pool: false,
};

describe('normalizeHostManifest — safe default', () => {
    it('empty object → all false + schema_version 1', () => {
        expect(normalizeHostManifest({})).toEqual(ALL_FALSE);
    });

    it('null / undefined / non-object → all false + schema_version 1', () => {
        expect(normalizeHostManifest(null)).toEqual(ALL_FALSE);
        expect(normalizeHostManifest(undefined)).toEqual(ALL_FALSE);
        expect(normalizeHostManifest('subagent_spawn')).toEqual(ALL_FALSE);
        expect(normalizeHostManifest(42)).toEqual(ALL_FALSE);
        expect(normalizeHostManifest(true)).toEqual(ALL_FALSE);
    });
});

describe('normalizeHostManifest — partial input', () => {
    it('missing fields default to false', () => {
        expect(normalizeHostManifest({ subagent_spawn: true })).toEqual({
            ...ALL_FALSE,
            subagent_spawn: true,
        });
    });
});

describe('normalizeHostManifest — invalid types', () => {
    it('non-boolean field values resolve to the safe default false', () => {
        expect(
            normalizeHostManifest({
                subagent_spawn: 'true',
                parallel_spawn: 1,
                status_polling: {},
                separate_quota_pool: null,
            }),
        ).toEqual(ALL_FALSE);
    });

    it('only strict boolean true survives — truthy non-booleans are false', () => {
        expect(normalizeHostManifest({ subagent_spawn: 'yes' })).toEqual(ALL_FALSE);
    });
});

describe('normalizeHostManifest — valid full input', () => {
    it('preserves every true field and forces schema_version to 1', () => {
        expect(
            normalizeHostManifest({
                schema_version: 99,
                subagent_spawn: true,
                parallel_spawn: true,
                status_polling: true,
                separate_quota_pool: true,
            }),
        ).toEqual({
            schema_version: 1,
            subagent_spawn: true,
            parallel_spawn: true,
            status_polling: true,
            separate_quota_pool: true,
        });
    });

    it('false fields stay false (no accidental flip)', () => {
        expect(
            normalizeHostManifest({
                subagent_spawn: true,
                parallel_spawn: false,
            }),
        ).toEqual({
            ...ALL_FALSE,
            subagent_spawn: true,
        });
    });
});

describe('resolveHostCapabilities — registry hit', () => {
    it("'claude' with no override resolves the committed registry row", () => {
        expect(resolveHostCapabilities('claude')).toEqual({
            ...ALL_FALSE,
            subagent_spawn: true,
            parallel_spawn: true,
        });
    });

    it('registry row fields not observed (polling, quota) stay false', () => {
        const manifest = resolveHostCapabilities('claude');
        expect(manifest.status_polling).toBe(false);
        expect(manifest.separate_quota_pool).toBe(false);
    });
});

describe('resolveHostCapabilities — registry miss', () => {
    it('unknown host id → all-false safe default, unchanged', () => {
        expect(resolveHostCapabilities('some-unrecognized-host')).toEqual(ALL_FALSE);
    });

    it('null / undefined host id → all-false safe default', () => {
        expect(resolveHostCapabilities(null)).toEqual(ALL_FALSE);
        expect(resolveHostCapabilities(undefined)).toEqual(ALL_FALSE);
    });
});

describe('resolveHostCapabilities — override beats registry', () => {
    it('an explicit override on a known host wins outright (whole-object, not merged)', () => {
        // Registry says `claude` → parallel_spawn: true. An override that
        // does not mention parallel_spawn still wins wholesale — a present
        // override is not merged field-by-field with the registry row.
        expect(resolveHostCapabilities('claude', { subagent_spawn: false })).toEqual(ALL_FALSE);
    });

    it('an override can also grant capabilities the registry never observed', () => {
        expect(
            resolveHostCapabilities('some-unrecognized-host', { subagent_spawn: true }),
        ).toEqual({
            ...ALL_FALSE,
            subagent_spawn: true,
        });
    });

    it('an empty-object override still wins over the registry (whole-object semantics)', () => {
        expect(resolveHostCapabilities('claude', {})).toEqual(ALL_FALSE);
    });

    it('a null override does NOT count as present — falls through to the registry', () => {
        expect(resolveHostCapabilities('claude', null)).toEqual({
            ...ALL_FALSE,
            subagent_spawn: true,
            parallel_spawn: true,
        });
    });
});

describe('resolveHostCapabilities — strict-true coercion unchanged', () => {
    it('a truthy non-boolean override field is still coerced to false', () => {
        expect(resolveHostCapabilities('claude', { subagent_spawn: 'yes' })).toEqual(ALL_FALSE);
    });

    it('a non-object override (string/number) is ignored — falls through to the registry', () => {
        expect(resolveHostCapabilities('claude', 'subagent_spawn')).toEqual({
            ...ALL_FALSE,
            subagent_spawn: true,
            parallel_spawn: true,
        });
        expect(resolveHostCapabilities('claude', 42)).toEqual({
            ...ALL_FALSE,
            subagent_spawn: true,
            parallel_spawn: true,
        });
    });
});

describe('resolveHostCapabilities — array override treated as absent (F8)', () => {
    it('an array override on a known host falls through to the registry row, not an all-false coercion', () => {
        expect(resolveHostCapabilities('claude', ['unexpected', 'array'])).toEqual({
            ...ALL_FALSE,
            subagent_spawn: true,
            parallel_spawn: true,
        });
    });

    it('an empty-array override on an unknown host falls through to SAFE_DEFAULT', () => {
        expect(resolveHostCapabilities('some-unrecognized-host', [])).toEqual(ALL_FALSE);
    });
});

describe('resolveHostCapabilities — end-to-end via classifyTask', () => {
    it('a delegable probe dispatches on the detected host with no settings override', () => {
        const manifest = resolveHostCapabilities('claude');
        const activation: ActivationInputs = {
            enabled: true,
            auto: 'on',
            subagent_spawn: manifest.subagent_spawn,
        };
        const verdict = classifyTask(
            { size_estimate: 5, independent_slices: 3 },
            activation,
        );
        expect(verdict.action).toBe('dispatch');
    });

    it('the same probe stays in-session on an unrecognized host (all-false default)', () => {
        const manifest = resolveHostCapabilities('some-unrecognized-host');
        const activation: ActivationInputs = {
            enabled: true,
            auto: 'on',
            subagent_spawn: manifest.subagent_spawn,
        };
        const verdict = classifyTask(
            { size_estimate: 5, independent_slices: 3 },
            activation,
        );
        expect(verdict.action).toBe('in-session');
        expect(verdict.reason).toBe('host has no subagent_spawn primitive');
    });
});
