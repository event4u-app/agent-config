// A catalogued route whose attestation covers first-party models only admits a
// member whose model the route's discovered first-party roster lists, and is
// absent otherwise (council 2026-10-22, decision 2, round 2: enforce first-party
// at run time and fail closed when provenance cannot be established).
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { ROUTE_MODELS_RELPATH } from '../../../src/scripts/ai_council/free_route_catalog.js';
import { routeMemberFor } from '../../../src/scripts/ai_council/route_member.js';

const roots: string[] = [];
afterEach(() => {
    while (roots.length) fs.rmSync(roots.pop()!, { recursive: true, force: true });
});

function root(roster?: { models: string[]; observed_at: string }): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'fp-member-'));
    roots.push(d);
    if (roster) {
        fs.mkdirSync(path.dirname(path.join(d, ROUTE_MODELS_RELPATH)), { recursive: true });
        fs.writeFileSync(
            path.join(d, ROUTE_MODELS_RELPATH),
            JSON.stringify({ pollinations: { base_url: 'https://text.pollinations.ai/openai', ...roster } }),
        );
    }
    return d;
}

const CFG = {
    enabled: true,
    model: 'fp-model',
    base_url: 'https://text.pollinations.ai/openai',
    billing_proof: { kind: 'keyless', url: 'https://pollinations.ai/privacy', checked: '2026-10-22' },
};
const NOW = new Date('2026-10-22T20:00:00Z');

describe('first-party roster gate on a catalogued keyless route', () => {
    it('admits the member when the fresh roster lists its model', () => {
        const r = routeMemberFor('hands', CFG, 'public-artifact', undefined, undefined, root({ models: ['fp-model'], observed_at: '2026-10-22T19:00:00Z' }), NOW);
        expect(r && 'client' in r).toBe(true);
    });

    it('is absent when the roster does not list the model, is missing, or is older than a day', () => {
        const cases = [
            root({ models: ['other'], observed_at: '2026-10-22T19:00:00Z' }),
            root(),
            root({ models: ['fp-model'], observed_at: '2026-10-20T19:00:00Z' }),
        ];
        for (const r0 of cases) {
            const r = routeMemberFor('hands', CFG, 'public-artifact', undefined, undefined, r0, NOW);
            expect(r && 'absent' in r ? r.absent.reason : null).toBe('policy_model_mismatch');
        }
    });

    it('an uncatalogued route is not gated by a roster', () => {
        const cfg = { ...CFG, base_url: 'https://route.example.test/v1' };
        const r = routeMemberFor('hands', cfg, 'public-artifact', undefined, undefined, root(), NOW);
        expect(r && 'client' in r).toBe(true);
    });
});
