/**
 * Tests for trust-escalation detection (Phase 5.1 / ADR-018 § 4).
 *
 * Pure data-layer module — every case is exercised from in-memory
 * manifest + lockfile fixtures; no I/O.
 */

import { describe, expect, it } from 'vitest';

import {
    TRUST_TIERS,
    detectTrustEscalations,
    emptyTrustSummary,
    formatEscalation,
    packHasEscalation,
} from '../src/trust-escalation.js';
import type { Lockfile, LockfilePack, ManifestPack } from '../src/types.js';
import { makeManifest, makePack } from './_fixtures.js';

function makeLockfile(packs: readonly LockfilePack[]): Lockfile {
    return {
        schema_version: 1,
        agent_config_version: '0.1.0',
        manifest_sha256: 'sha256:lock',
        generated_at: '2026-05-20T00:00:00Z',
        workspaces: ['engineering'],
        packs,
        files: [],
    };
}

function lockedPack(overrides: Partial<LockfilePack> = {}): LockfilePack {
    return {
        id: 'engineering-base',
        version: '0.1.0',
        auto_selected: false,
        required_by: [],
        accepted_trust: emptyTrustSummary(),
        accepted_human_review_required: 0,
        ...overrides,
    };
}

describe('detectTrustEscalations', () => {
    it('returns empty list when counts unchanged', () => {
        const manifest = makeManifest({
            packs: [
                makePack({
                    id: 'engineering-base',
                    trust_summary: { core: 5, professional: 2, experimental: 0, advisory: 0, restricted: 0 },
                    human_review_required: 0,
                }),
            ],
        });
        const lock = makeLockfile([
            lockedPack({
                accepted_trust: { core: 5, professional: 2, experimental: 0, advisory: 0, restricted: 0 },
            }),
        ]);
        expect(detectTrustEscalations(manifest, lock)).toEqual([]);
    });

    it('flags every tier that grew + records before/after counts', () => {
        const manifest = makeManifest({
            packs: [
                makePack({
                    id: 'engineering-base',
                    label: 'Engineering base',
                    trust_summary: { core: 5, professional: 3, experimental: 1, advisory: 2, restricted: 0 },
                    human_review_required: 0,
                }),
            ],
        });
        const lock = makeLockfile([
            lockedPack({
                accepted_trust: { core: 5, professional: 2, experimental: 0, advisory: 0, restricted: 0 },
            }),
        ]);
        const out = detectTrustEscalations(manifest, lock);
        expect(out).toHaveLength(1);
        const e = out[0]!;
        expect(e.packId).toBe('engineering-base');
        expect(e.tierDeltas.map((d) => d.tier)).toEqual(['professional', 'experimental', 'advisory']);
        expect(e.tierDeltas.find((d) => d.tier === 'advisory')).toEqual({
            tier: 'advisory',
            accepted: 0,
            current: 2,
        });
        expect(e.hrrDelta).toBeUndefined();
    });

    it('flags HRR-only escalation even when tiers are unchanged', () => {
        const manifest = makeManifest({
            packs: [
                makePack({
                    id: 'engineering-base',
                    trust_summary: { core: 5, professional: 0, experimental: 0, advisory: 0, restricted: 0 },
                    human_review_required: 3,
                }),
            ],
        });
        const lock = makeLockfile([
            lockedPack({
                accepted_trust: { core: 5, professional: 0, experimental: 0, advisory: 0, restricted: 0 },
                accepted_human_review_required: 1,
            }),
        ]);
        const out = detectTrustEscalations(manifest, lock);
        expect(out).toHaveLength(1);
        expect(out[0]?.tierDeltas).toEqual([]);
        expect(out[0]?.hrrDelta).toEqual({ accepted: 1, current: 3 });
    });

    it('treats a missing accepted_trust as a zero baseline (lockfile predates schema)', () => {
        const manifest = makeManifest({
            packs: [
                makePack({
                    id: 'engineering-base',
                    trust_summary: { core: 0, professional: 0, experimental: 0, advisory: 1, restricted: 0 },
                }),
            ],
        });
        const mp: ManifestPack = manifest.packs[0]!;
        const lock = makeLockfile([{ id: 'engineering-base', version: '0.1.0', auto_selected: false, required_by: [] }]);
        const out = detectTrustEscalations(manifest, lock);
        expect(out).toHaveLength(1);
        expect(packHasEscalation(lock.packs[0]!, mp)).toBe(true);
    });

    it('omits packs absent from the manifest (handled by resolver/missing path)', () => {
        const manifest = makeManifest({ packs: [] });
        const lock = makeLockfile([lockedPack({ id: 'gone' })]);
        expect(detectTrustEscalations(manifest, lock)).toEqual([]);
    });
});

describe('formatEscalation', () => {
    it('renders tier deltas and HRR in a single line', () => {
        const line = formatEscalation({
            packId: 'p',
            packLabel: 'Pack',
            tierDeltas: [
                { tier: 'advisory', accepted: 0, current: 2 },
                { tier: 'restricted', accepted: 0, current: 1 },
            ],
            hrrDelta: { accepted: 0, current: 1 },
        });
        expect(line).toBe('p (Pack): advisory 0→2 · restricted 0→1 · human-review 0→1');
    });
});

describe('TRUST_TIERS', () => {
    it('covers all five levels in canonical order', () => {
        expect([...TRUST_TIERS]).toEqual(['core', 'professional', 'experimental', 'advisory', 'restricted']);
    });
});
