// The package ships route endpoints and dated attestations, never model ids:
// those are discovered live from the route and kept in gitignored runtime state.

import * as fs from 'node:fs';
import * as http from 'node:http';
import type { AddressInfo } from 'node:net';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
    consumerDefaultRoutes,
    consumerDefaultVerdict,
    discoverRouteModels,
    readRouteRoster,
    ROUTE_CATALOG,
    ROUTE_MODELS_RELPATH,
    type CatalogRoute,
} from '../../../src/scripts/ai_council/free_route_catalog.js';

const cleanups: (() => void)[] = [];
afterEach(() => {
    while (cleanups.length > 0) (cleanups.pop() as () => void)();
});

function tmpRoot(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'route-roster-'));
    cleanups.push(() => fs.rmSync(d, { recursive: true, force: true }));
    return d;
}

/** A loopback OpenAI-compatible mock that records the headers of each request. */
async function mockRoute(models: string[]): Promise<{ base: string; seen: http.IncomingHttpHeaders[] }> {
    const seen: http.IncomingHttpHeaders[] = [];
    const server = http.createServer((req, res) => {
        seen.push(req.headers);
        if (req.url === '/v1/models') {
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ object: 'list', data: models.map((id) => ({ id, object: 'model' })) }));
            return;
        }
        res.writeHead(404);
        res.end();
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    cleanups.push(() => server.close());
    return { base: `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`, seen };
}

/** A loopback port nothing listens on. */
async function closedPort(): Promise<string> {
    const s = http.createServer();
    await new Promise<void>((resolve) => s.listen(0, '127.0.0.1', resolve));
    const port = (s.address() as AddressInfo).port;
    await new Promise<void>((resolve) => s.close(() => resolve()));
    return `http://127.0.0.1:${port}/v1`;
}

const NOW = new Date('2026-10-22T12:00:00Z');

describe('2.3 — ship endpoints and attestations, never model ids', () => {
    it('no shipped catalogue row carries a model id', () => {
        const allowed = new Set(['id', 'base_url', 'keyless', 'attestation']);
        for (const row of ROUTE_CATALOG) {
            expect(Object.keys(row).filter((k) => !allowed.has(k))).toEqual([]);
            expect(JSON.stringify(row)).not.toMatch(/"model/);
            expect(row.base_url).toMatch(/^https:\/\//);
        }
    });

    it('a route whose attestation lacks the distribution field is refused as a consumer default', () => {
        const route: CatalogRoute = {
            id: 'r',
            base_url: 'https://route.example.test/v1',
            keyless: true,
            attestation: { checked: '2026-10-20', source_url: 'https://route.example.test/terms', trains_on_prompts: false },
        };
        const v = consumerDefaultVerdict(route, NOW);
        expect(v.admissible).toBe(false);
        expect(v.reason).toMatch(/maintainer/);
    });

    it('a dated attestation that permits distribution is admissible; a stale or forbidding one is not', () => {
        const base: CatalogRoute = {
            id: 'r',
            base_url: 'https://route.example.test/v1',
            keyless: true,
            attestation: {
                checked: '2026-10-20',
                source_url: 'https://route.example.test/terms',
                trains_on_prompts: false,
                client_distribution_eea_ch_uk: 'permitted',
            },
        };
        expect(consumerDefaultVerdict(base, NOW).admissible).toBe(true);
        const stale = { ...base, attestation: { ...base.attestation!, checked: '2026-01-02' } };
        expect(consumerDefaultVerdict(stale, NOW).admissible).toBe(false);
        const forbidden = { ...base, attestation: { ...base.attestation!, client_distribution_eea_ch_uk: 'forbidden' as const } };
        expect(consumerDefaultVerdict(forbidden, NOW).admissible).toBe(false);
        expect(consumerDefaultVerdict({ ...base, attestation: null }, NOW).admissible).toBe(false);
    });

    it('every shipped row that is a consumer default carries the distribution field', () => {
        for (const row of consumerDefaultRoutes(NOW)) {
            expect(row.attestation?.client_distribution_eea_ch_uk).toBe('permitted');
        }
    });
});

describe('2.3 — model ids are discovered live and kept in runtime state', () => {
    it('discovers the route\'s /models once and writes them next to council-probes.json', async () => {
        const root = tmpRoot();
        const { base, seen } = await mockRoute(['open-model-a', 'open-model-b']);
        const roster = await discoverRouteModels('hands', base, { repoRoot: root, now: NOW });
        expect(roster).toEqual({ status: 'known', models: ['open-model-a', 'open-model-b'], observed_at: NOW.toISOString() });
        expect(seen).toHaveLength(1);
        expect(seen[0]?.['authorization']).toBeUndefined();
        expect(path.dirname(ROUTE_MODELS_RELPATH)).toBe(path.join('agents', 'runtime', 'state'));
        expect(fs.existsSync(path.join(root, ROUTE_MODELS_RELPATH))).toBe(true);
        expect(readRouteRoster(root, 'hands')).toEqual(roster);
    });

    it('offline, the roster reports unknown, never a cached list', async () => {
        const root = tmpRoot();
        const { base } = await mockRoute(['open-model-a']);
        await discoverRouteModels('hands', base, { repoRoot: root, now: NOW });
        const offline = await closedPort();
        const roster = await discoverRouteModels('hands', offline, { repoRoot: root, now: NOW });
        expect(roster.status).toBe('unknown');
        expect(readRouteRoster(root, 'hands').status).toBe('unknown');
        expect(readRouteRoster(tmpRoot(), 'never-probed').status).toBe('unknown');
    });
});
