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
    main as catalogMain,
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
        const allowed = new Set(['id', 'base_url', 'keyless', 'attestation', 'first_party_list']);
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

describe('keyless first-party route (council 2026-10-22, decision 2, round 2: option a)', () => {
    async function mockKeyless(
        ids: string[],
        list: unknown,
        listStatus = 200,
        served: Record<string, string> = {},
    ): Promise<{ base: string; list: string }> {
        const server = http.createServer((req, res) => {
            if (req.url === '/openai/chat/completions' && req.method === 'POST') {
                let body = '';
                req.on('data', (c) => (body += c));
                req.on('end', () => {
                    const asked = (JSON.parse(body) as { model: string }).model;
                    if (!(asked in served)) {
                        res.writeHead(404);
                        res.end();
                        return;
                    }
                    res.writeHead(200, { 'content-type': 'application/json' });
                    res.end(JSON.stringify({ model: served[asked], choices: [{ message: { role: 'assistant', content: 'ok' } }] }));
                });
                return;
            }
            if (req.url === '/openai/models') {
                res.writeHead(200, { 'content-type': 'application/json' });
                res.end(JSON.stringify({ object: 'list', data: ids.map((id) => ({ id, object: 'model' })) }));
                return;
            }
            if (req.url === '/models') {
                res.writeHead(listStatus, { 'content-type': 'application/json' });
                res.end(JSON.stringify(list));
                return;
            }
            res.writeHead(404);
            res.end();
        });
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
        cleanups.push(() => server.close());
        const port = (server.address() as AddressInfo).port;
        return { base: `http://127.0.0.1:${port}/openai`, list: `http://127.0.0.1:${port}/models` };
    }

    it('the catalogue carries the keyless route with a dated attestation that keeps it maintainer-only', () => {
        const row = ROUTE_CATALOG.find((r) => r.id === 'pollinations')!;
        expect(row.keyless).toBe(true);
        expect(row.base_url).toBe('https://text.pollinations.ai/openai');
        expect(row.first_party_list).toBe('https://text.pollinations.ai/models');
        expect(row.attestation).toMatchObject({ checked: '2026-10-22', trains_on_prompts: false, client_distribution_eea_ch_uk: 'unknown' });
        expect(row.attestation!.retention).toMatch(/transient/);
        const v = consumerDefaultVerdict(row, NOW);
        expect(v.admissible).toBe(false);
        expect(v.reason).toMatch(/maintainer/);
    });

    it('discovery keeps only ids the route lists as first-party, by name or alias', async () => {
        const root = tmpRoot();
        const { base, list } = await mockKeyless(['fp-a', 'fp-b-alias', 'community-c', 'unlisted-d'], [
            { name: 'fp-a', community: false },
            { name: 'fp-b', aliases: ['fp-b-alias'], community: false },
            { name: 'community-c', community: true },
        ]);
        const roster = await discoverRouteModels('poll', base, { repoRoot: root, now: NOW, firstPartyListUrl: list });
        expect(roster).toEqual({ status: 'known', models: ['fp-a', 'fp-b-alias'], observed_at: NOW.toISOString() });
    });

    it('a listed id the route serves under one of its declared aliases is recorded as the served id', async () => {
        const root = tmpRoot();
        const { base, list } = await mockKeyless(
            ['openai-fast'],
            [{ name: 'openai-fast', aliases: ['gpt-oss', 'gpt-oss-20b'], community: false }],
            200,
            { 'openai-fast': 'gpt-oss-20b', 'gpt-oss-20b': 'gpt-oss-20b' },
        );
        const roster = await discoverRouteModels('poll', base, { repoRoot: root, now: NOW, firstPartyListUrl: list });
        expect(roster).toEqual({ status: 'known', models: ['gpt-oss-20b'], observed_at: NOW.toISOString() });
        expect(readRouteRoster(root, 'poll')).toMatchObject({ status: 'known', models: ['gpt-oss-20b'] });
    });

    it('a listed id the route serves under an undeclared id leaves the roster', async () => {
        const root = tmpRoot();
        const { base, list } = await mockKeyless(
            ['fp-a', 'fp-b'],
            [
                { name: 'fp-a', aliases: ['fp-a-1'], community: false },
                { name: 'fp-b', community: false },
            ],
            200,
            { 'fp-a': 'someone-else', 'fp-b': 'fp-b' },
        );
        const roster = await discoverRouteModels('poll', base, { repoRoot: root, now: NOW, firstPartyListUrl: list });
        expect(roster).toEqual({ status: 'known', models: ['fp-b'], observed_at: NOW.toISOString() });
    });

    it('a first-party list that cannot be read fails closed: the roster is unknown', async () => {
        const root = tmpRoot();
        const { base, list } = await mockKeyless(['fp-a'], { error: 'down' }, 503);
        const roster = await discoverRouteModels('poll', base, { repoRoot: root, now: NOW, firstPartyListUrl: list });
        expect(roster.status).toBe('unknown');
        const malformed = await mockKeyless(['fp-a'], { not: 'a list' });
        expect((await discoverRouteModels('poll', malformed.base, { repoRoot: root, now: NOW, firstPartyListUrl: malformed.list })).status).toBe('unknown');
    });
});

describe('discover entry: the production path that writes the roster the gate reads', () => {
    /** Loopback stand-in for every catalogued first-party route; the injected fetch rewrites the host to it. */
    async function stub(listStatus = 200): Promise<typeof fetch> {
        const server = http.createServer((req, res) => {
            if (req.url === '/openai/models') {
                res.writeHead(200, { 'content-type': 'application/json' });
                res.end(JSON.stringify({ object: 'list', data: [{ id: 'fp-a' }, { id: 'community-c' }] }));
                return;
            }
            if (req.url === '/models') {
                res.writeHead(listStatus, { 'content-type': 'application/json' });
                res.end(JSON.stringify([{ name: 'fp-a', community: false }, { name: 'community-c', community: true }]));
                return;
            }
            res.writeHead(404);
            res.end();
        });
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
        cleanups.push(() => server.close());
        const local = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
        return ((url: string | URL | Request, init?: RequestInit) =>
            fetch(String(url).replace(/^https:\/\/[^/]+/, local), init)) as typeof fetch;
    }

    it('discovers every catalogued first-party row under its catalogue id and prints the roster', async () => {
        const root = tmpRoot();
        const out: string[] = [];
        const code = await catalogMain(['discover', '--root', root], { fetchImpl: await stub(), stdout: (l) => out.push(l), now: NOW });
        expect(code).toBe(0);
        for (const row of ROUTE_CATALOG.filter((r) => r.first_party_list !== undefined)) {
            expect(readRouteRoster(root, row.id)).toEqual({ status: 'known', models: ['fp-a'], observed_at: NOW.toISOString() });
            expect(out.join('\n')).toMatch(new RegExp(`${row.id}: known`));
        }
        expect(readRouteRoster(root, 'groq').status).toBe('unknown');
    });

    it('a first-party list that cannot be read reports unknown and exits non-zero', async () => {
        const root = tmpRoot();
        const out: string[] = [];
        const code = await catalogMain(['discover', '--root', root], { fetchImpl: await stub(503), stdout: (l) => out.push(l), now: NOW });
        expect(code).toBe(1);
        expect(readRouteRoster(root, 'pollinations').status).toBe('unknown');
        expect(out.join('\n')).toMatch(/pollinations: unknown/);
    });

    it('an unknown subcommand is a usage error', async () => {
        expect(await catalogMain(['nope'], { stdout: () => undefined })).toBe(2);
    });
});
