import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { askOnce } from '../../../src/scripts/ask_transport.js';
import { CouncilResponse, XAI_BASE_URL, type ExternalAIClient } from '../../../src/scripts/ai_council/clients.js';
import { routeCandidateFromMember } from '../../../src/scripts/ai_council/route_chooser.js';
import { RETIRE_STREAK, recordRouteOutcome } from '../../../src/scripts/ai_council/route_liveness.js';
import { routeMemberFor, stampSeatCeilings } from '../../../src/scripts/ai_council/route_member.js';
import type { FreeRouteClient } from '../../../src/scripts/ai_council/free_route_client.js';

let root: string;
beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'route-ceiling-'));
});
afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

function member(fields: Record<string, unknown>, calls: string[]): ExternalAIClient {
    return {
        model: 'm-1',
        ...fields,
        ask: () => {
            calls.push(String(fields['name']));
            return new CouncilResponse({ provider: String(fields['name']), model: 'm-1', text: 'ok', input_tokens: 1, output_tokens: 1 });
        },
    } as unknown as ExternalAIClient;
}

describe('a base_url member carries its ceiling (D5)', () => {
    it('an injected base_url member without a ceiling refuses a project-content payload', async () => {
        const calls: string[] = [];
        const injected = member({ name: 'router', base_url: 'https://router.example/v1' }, calls);
        expect(routeCandidateFromMember(injected).ceiling).toBe('public-artifact');
        const r = await askOnce('summarise this module', {
            members: [injected],
            contentClass: 'project-content',
            auditDir: null,
            stateRoot: null,
        });
        expect(r).toBeNull();
        expect(calls).toEqual([]);
    });

    it('a free route client carries public-artifact; a probed self-hosted one carries its declared ceiling', () => {
        const free = routeMemberFor(
            'free1',
            { base_url: 'https://free.example/v1', model: 'm-1', billing_proof: { kind: 'keyless', url: 'https://free.example/pricing', checked: '2026-10-01' } },
            'public-artifact',
            undefined,
            () => ({ weights: 'unknown', outbound: null }),
            root,
        );
        expect(free !== null && 'client' in free ? (free.client as FreeRouteClient).content_ceiling : null).toBe('public-artifact');
        const local = routeMemberFor(
            'local1',
            { base_url: 'http://127.0.0.1:11434/v1', model: 'm-1', content_ceiling: 'project-content' },
            'project-content',
            undefined,
            () => ({ weights: 'local', outbound: false }),
            root,
        );
        expect(local !== null && 'client' in local).toBe(true);
        const client = (local as { client: FreeRouteClient }).client;
        expect(client.content_ceiling).toBe('project-content');
        expect(routeCandidateFromMember(client).ceiling).toBe('project-content');
    });

    it('a built paid seat carries the ceiling its config declares, defaulting to the seat ceiling', () => {
        const xai = member({ name: 'xai', base_url: XAI_BASE_URL, billable: true }, []);
        const ppx = member({ name: 'perplexity', base_url: 'https://api.perplexity.ai', billable: true }, []);
        stampSeatCeilings([xai, ppx], { xai: {}, perplexity: { content_ceiling: 'public-artifact' } });
        expect(routeCandidateFromMember(xai).ceiling).toBe('project-content');
        expect(routeCandidateFromMember(ppx).ceiling).toBe('public-artifact');
    });

    it('a paid seat with a base_url and no billing proof never enters route liveness', async () => {
        for (let i = 1; i <= RETIRE_STREAK; i++) {
            recordRouteOutcome(root, 'xai', 'm-1', 'model_unservable', new Date(Date.now() - (RETIRE_STREAK - i) * 1000));
        }
        const calls: string[] = [];
        const xai = member({ name: 'xai', base_url: XAI_BASE_URL, billable: true, content_ceiling: 'project-content' }, calls);
        const r = await askOnce('summarise this module', { members: [xai], contentClass: 'project-content', auditDir: null, stateRoot: root });
        expect(r).not.toBeNull();
        expect(calls).toEqual(['xai']);
    });
});
