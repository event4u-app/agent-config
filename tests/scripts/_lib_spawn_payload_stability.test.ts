/**
 * Prefix-stability pass (road-to-lean-agent-init Phase 4): spawn payload
 * ordering is deterministic — static prefix (contract/role config) first,
 * variable task part last; no timestamps or random IDs anywhere. The
 * `payload_hash` / `cache_hit` audit fields measure; no savings claim
 * without provider-response evidence.
 */
import { describe, expect, it } from 'vitest';

import {
    composeSpawnBrief,
    serializeSpawnPayload,
    spawnPayloadHash,
} from '../../src/scripts/_lib/subagent_spawn.js';

const CONFIG = {
    role_mode: 'reviewer' as const,
    profile: 'developer',
    personas: ['judge-code-quality'],
    max_tokens_per_worker: 15_000,
};

describe('serializeSpawnPayload — deterministic, prefix-stable', () => {
    it('identical briefs serialize byte-identically (no timestamps, no random IDs)', () => {
        const a = serializeSpawnPayload(composeSpawnBrief({ task: 'review the diff', ...CONFIG }));
        const b = serializeSpawnPayload(composeSpawnBrief({ task: 'review the diff', ...CONFIG }));
        expect(a).toBe(b);
        expect(spawnPayloadHash(a)).toBe(spawnPayloadHash(b));
    });

    it('same config, different task → identical static prefix, differing tail', () => {
        const a = serializeSpawnPayload(composeSpawnBrief({ task: 'review diff A', ...CONFIG }));
        const b = serializeSpawnPayload(composeSpawnBrief({ task: 'review diff B', ...CONFIG }));
        const [prefixA] = a.split('\n');
        const [prefixB] = b.split('\n');
        expect(prefixA).toBe(prefixB);
        expect(a).not.toBe(b);
    });

    it('static prefix comes FIRST, the variable task part LAST', () => {
        const payload = serializeSpawnPayload(composeSpawnBrief({ task: 'the-variable-part', ...CONFIG }));
        const prefixEnd = payload.indexOf('\n');
        expect(payload.indexOf('reviewer')).toBeLessThan(prefixEnd);
        expect(payload.indexOf('the-variable-part')).toBeGreaterThan(prefixEnd);
    });

    it('payload contains no ISO timestamp shape (determinism guard)', () => {
        const payload = serializeSpawnPayload(composeSpawnBrief({ task: 'anything', ...CONFIG }));
        expect(payload).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
    });

    it('spawnPayloadHash emits an audit-schema-valid hex digest (8–64 chars)', () => {
        const h = spawnPayloadHash('payload');
        expect(h).toMatch(/^[a-f0-9]{16}$/);
    });
});
