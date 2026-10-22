// A loopback address says where the socket is, not where the model runs. Only a
// per-model probe that sees local weights and no outbound connection lets a
// self-hosted route carry project content.

import { describe, expect, it } from 'vitest';

import {
    parseRouteFields,
    resolveRouteTransport,
    type RouteSpec,
    type SelfHostedProbe,
} from '../../../src/scripts/ai_council/free_route.js';
import { FreeRouteClient } from '../../../src/scripts/ai_council/free_route_client.js';
import { routeMemberFor } from '../../../src/scripts/ai_council/route_member.js';

function route(base_url: string): RouteSpec {
    const r = parseRouteFields('local', { base_url, model: 'local-model', content_ceiling: 'project-content' }, false);
    if ('error' in r || r.route === null) throw new Error('fixture route did not parse');
    return r.route;
}

const LOCAL: SelfHostedProbe = () => ({ weights: 'local', outbound: false });
const REMOTE: SelfHostedProbe = () => ({ weights: 'remote', outbound: true });
const LOCAL_BUT_CALLS_OUT: SelfHostedProbe = () => ({ weights: 'local', outbound: true });

function resolve(base: string, probe?: SelfHostedProbe) {
    return resolveRouteTransport({
        name: 'local',
        route: route(base),
        model: 'local-model',
        contentClass: 'project-content',
        ...(probe === undefined ? {} : { probe }),
    });
}

describe('2.5 — a loopback self-hosted route', () => {
    it('a loopback stub whose probe reports local weights admits a project-content payload', () => {
        const t = resolve('http://127.0.0.1:11434/v1', LOCAL);
        expect(t.available).toBe(true);
        expect(t.billing).toBe('self-hosted');
    });

    it('the same stub reporting a remote model refuses it with policy_content_ceiling', () => {
        const t = resolve('http://127.0.0.1:11434/v1', REMOTE);
        expect(t.available).toBe(false);
        expect(t.absentReason).toBe('policy_content_ceiling');
        expect(t.billing).not.toBe('self-hosted');
    });

    it('the same stub on a non-loopback address refuses it with policy_content_ceiling', () => {
        const t = resolve('https://gpu.example.test/v1', LOCAL);
        expect(t.available).toBe(false);
        expect(t.absentReason).toBe('policy_content_ceiling');
    });

    it('local weights with an outbound connection during the probe call are not self-hosted', () => {
        expect(resolve('http://localhost:8080/v1', LOCAL_BUT_CALLS_OUT).absentReason).toBe('policy_content_ceiling');
    });

    it('unprobed, a loopback route stays under the public-artifact ceiling', () => {
        expect(resolve('http://[::1]:8080/v1').absentReason).toBe('policy_content_ceiling');
        expect(resolveRouteTransport({
            name: 'local', route: route('http://[::1]:8080/v1'), model: 'local-model', contentClass: 'public-artifact',
        }).available).toBe(true);
    });

    it('a council pass constructs the probed route as an unbilled self-hosted member', () => {
        const r = routeMemberFor(
            'local',
            { enabled: true, model: 'local-model', base_url: 'http://127.0.0.1:11434/v1', content_ceiling: 'project-content' },
            'project-content',
            undefined,
            LOCAL,
        );
        expect(r !== null && 'client' in r).toBe(true);
        const client = (r as { client: FreeRouteClient }).client;
        expect(client.billing).toBe('self-hosted');
        expect(client.billable).toBe(false);
    });
});
