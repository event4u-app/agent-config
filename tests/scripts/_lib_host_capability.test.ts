// Unit tests for the host-capability manifest normalizer (`_lib/host_capability.ts`).
//
// The contract under test (host-capability-manifest.md): the safe default is
// ALL boolean fields `false`, a missing or invalidly-typed field resolves to
// `false` (never `true`), and `schema_version` is always forced to `1`. These
// cases lock that safe-default-first behavior so an unknown host is never
// assumed to support a subagent primitive it does not have.
import { describe, expect, it } from 'vitest';

import {
    normalizeHostManifest,
    type HostCapabilityManifest,
} from '../../src/scripts/_lib/host_capability.js';

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
