/**
 * Unit tests for the host-facing capability advertisement.
 *
 * The `configRoot` and `embed` capabilities must appear in the
 * `--version --json` readout (and, via the same module, `GET /api/v1/ping`)
 * so a spawner can feature-detect support before relying on either.
 */
import { describe, expect, it } from 'vitest';
import { CAPABILITIES, buildVersionReadout } from './capabilities.js';

describe('capabilities', () => {
    it('advertises configRoot support', () => {
        expect(CAPABILITIES.configRoot).toBe(true);
    });

    it('advertises the embed contract (reciprocal-ecosystem Phase 3)', () => {
        expect(CAPABILITIES.embed).toEqual({
            supported: true,
            version: 1,
            features: ['theme', 'deepLink'],
        });
    });

    it('does NOT advertise the accent feature (v2, not v1)', () => {
        expect(CAPABILITIES.embed.features).not.toContain('accent');
    });

    it('buildVersionReadout carries the version and the full capability block', () => {
        const readout = buildVersionReadout('9.7.0');
        expect(readout).toEqual({
            version: '9.7.0',
            capabilities: {
                configRoot: true,
                embed: { supported: true, version: 1, features: ['theme', 'deepLink'] },
            },
        });
    });

    it('buildVersionReadout copies capabilities (no shared mutable reference)', () => {
        const readout = buildVersionReadout('1.2.3');
        expect(readout.capabilities).not.toBe(CAPABILITIES);
    });
});
