// The production callers outside the hook bundle use the real probe, not the
// UNPROVEN default `free_route.ts` keeps for the bundle's sake. The real probe
// is replaced by one that reports a proven local model: under UNPROVEN_PROBE
// both callers would refuse a project-content payload.

import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/scripts/ai_council/self_hosted_probe.js', () => ({
    SELF_HOSTED_PROBE: () => ({ weights: 'local', outbound: false }),
}));

import { parseRouteFields } from '../../../src/scripts/ai_council/free_route.js';
import type { FreeRouteClient } from '../../../src/scripts/ai_council/free_route_client.js';
import { routeMemberFor } from '../../../src/scripts/ai_council/route_member.js';
import { resolvedTransportFor } from '../../../src/scripts/ai_council/status_surface.js';

const CFG = { enabled: true, model: 'local-model', base_url: 'http://127.0.0.1:11434/v1', content_ceiling: 'project-content' };

describe('self-hosted probe wiring', () => {
    it('a council pass (and so ask_transport, via build_members) probes with the real probe by default', () => {
        const r = routeMemberFor('local', CFG, 'project-content');
        expect(r !== null && 'client' in r).toBe(true);
        expect((r as { client: FreeRouteClient }).client.billing).toBe('self-hosted');
    });

    it('council:status resolves a route member with the real probe', () => {
        const parsed = parseRouteFields('local', CFG, false);
        if ('error' in parsed || parsed.route === null) throw new Error('fixture route did not parse');
        const t = resolvedTransportFor('local', { binary: null, api_key_ref: null, route: parsed.route, model: 'local-model' }, undefined, 'project-content');
        expect(t.available).toBe(true);
        expect(t.billing).toBe('self-hosted');
    });
});
