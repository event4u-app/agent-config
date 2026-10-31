// road-to-a-loss-that-can-be-appealed Phases 2 and 4 — size by importance,
// free seats by content class.

import { describe, expect, it } from 'vitest';

import { freeSeatAllowance } from '../../../src/scripts/bracket/seats.js';
import { callsFor, DEFAULT_TIER, resolveTier, saturationStop, tier, tierForAgents } from '../../../src/scripts/bracket/tiers.js';

describe('tiers', () => {
    it('defaults to 10 lines and 55 calls', () => {
        expect(DEFAULT_TIER).toBe('S1');
        expect(tier('S1').n).toBe(10);
        expect(callsFor(10)).toBe(55);
        expect(callsFor(100)).toBe(595);
    });
    it('reaches 100 only from an owner-reserved signal or the user', () => {
        expect(resolveTier({ ownerReservedRow: 'irreversible' }).n).toBe(100);
        expect(resolveTier({ userRequested: 'S4' }).n).toBe(100);
        const self = resolveTier({ agentProposed: 'S4' });
        expect(self.n).toBe(10);
        expect(self.refused).toMatch(/without a deterministic signal/);
    });
    it('lets the agent raise to S2 on its own reading, never above', () => {
        expect(resolveTier({ agentProposed: 'S2' }).tier).toBe('S2');
        expect(resolveTier({ agentProposed: 'S3', securitySurfaceHit: 'Login/Session' }).tier).toBe('S2');
    });
    it('lets the agent always lower', () => {
        expect(resolveTier({ agentProposed: 'S0', securitySurfaceHit: 'auth' }).tier).toBe('S0');
    });
    it('asks once at S3 and S4', () => {
        expect(tier('S3').askAlways && tier('S4').askAlways).toBe(true);
        expect(tier('S1').askAlways).toBe(false);
    });
    it('maps --agents N to the smallest tier holding it', () => {
        expect(tierForAgents(10)).toBe('S1');
        expect(tierForAgents(11)).toBe('S2');
        expect(tierForAgents(100)).toBe('S4');
    });
});

describe('saturation stop', () => {
    it('stops after two consecutive waves below 20 % new lines', () => {
        expect(saturationStop([{ spawned: 10, novel: 9 }, { spawned: 10, novel: 1 }])).toBe(false);
        expect(saturationStop([{ spawned: 10, novel: 1 }, { spawned: 10, novel: 1 }])).toBe(true);
        expect(saturationStop([{ spawned: 10, novel: 1 }])).toBe(false);
    });
});

describe('free seats by content class', () => {
    it('allows free routes for a public artifact, keeping one paid jury seat', () => {
        const a = freeSeatAllowance(10, 'public-artifact', false);
        expect(a.freeCompetitors).toBe(5);
        expect(a.freeJurySeats).toBe(4);
    });
    it('allows only local seats for project content with proven local weights', () => {
        expect(freeSeatAllowance(10, 'project-content', true).kind).toBe('local');
    });
    it('says 0 free seats for project content without local proof', () => {
        const a = freeSeatAllowance(10, 'project-content', false);
        expect(a.freeCompetitors + a.freeJurySeats).toBe(0);
        expect(a.planLine).toMatch(/free seats: 0/);
    });
});
