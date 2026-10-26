import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { readRegistry } from '../../../src/scripts/_lib/project_registry.js';
import { main } from '../../../src/scripts/code_graph/cli.js';
import { estateMapDir } from '../../../src/scripts/code_graph/estate_map.js';
import { graphHome } from '../../../src/scripts/code_graph/graph_home.js';
import { type HubRoute, hubFacts, matchCall, normalisePath, withoutPrefixes } from '../../../src/scripts/code_graph/hub_facts.js';
import { areaProblems } from '../../../src/scripts/code_graph/map_areas.js';
import { buildMap } from '../../../src/scripts/code_graph/map.js';

const FIXTURE = path.resolve(__dirname, '..', '..', 'fixtures', 'code-graph', 'hub');

let tmp: string;
let saved: string | undefined;

beforeEach(() => {
    tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-hub-facts-')));
    saved = process.env.EVENT4U_CONFIG_HOME;
    process.env.EVENT4U_CONFIG_HOME = path.join(tmp, 'home');
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
});
afterEach(() => {
    vi.restoreAllMocks();
    process.env.EVENT4U_CONFIG_HOME = saved;
    fs.rmSync(tmp, { recursive: true, force: true });
});

/** The two fixture projects as committed git repositories; `beta` has a project home. */
function projects(): { alpha: string; beta: string } {
    const out = { alpha: path.join(tmp, 'alpha'), beta: path.join(tmp, 'beta') };
    for (const [name, root] of Object.entries(out)) {
        fs.cpSync(path.join(FIXTURE, name), root, { recursive: true });
        if (name === 'beta') fs.mkdirSync(path.join(root, 'agents'));
        execFileSync('git', ['-C', root, 'init', '-q']);
        execFileSync('git', ['-C', root, 'add', '-A']);
        execFileSync('git', ['-C', root, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', 'fixture']);
    }
    return out;
}

const route = (project: string, verbs: string[], p: string): HubRoute => ({ project, verbs, path: p, witness: { file: 'r.ts', line: 1, hash: 'ab12cd34' } });

describe('path forms (4.9)', () => {
    it('gives every parameter spelling one form and cuts query, fragment and trailing slash', () => {
        for (const p of ['/orders/{id}', '/orders/:id', '/orders/<int:id>', '/orders/${id}', 'orders/{order}/', '/Orders/:id?expand=1', '/orders/{id}#x']) {
            expect(normalisePath(p), p).toBe('/orders/{}');
        }
        expect(normalisePath('/orders/{id}/lines')).toBe('/orders/{}/lines');
    });

    it('strips only leading API prefixes for the alias tier', () => {
        expect(withoutPrefixes('/api/v1/orders/{}')).toBe('/orders/{}');
        expect(withoutPrefixes('/v2/api/orders')).toBe('/orders');
        expect(withoutPrefixes('/orders/v1')).toBe('/orders/v1');
        expect(withoutPrefixes('/apiary/orders')).toBe('/apiary/orders');
    });
});

describe('matching a call to another project\'s route (4.9)', () => {
    const routes = [route('b', ['GET'], '/orders/:id'), route('b', ['POST'], '/orders'), route('c', ['ANY'], '/hooks/{name}'), route('a', ['GET'], '/self/{x}')];

    it('matches by normalised path, prefix alias and verb, and only a unique route', () => {
        expect(matchCall({ project: 'a', method: 'GET', path: '/api/v1/orders/{id}' }, routes)).toEqual({ route: routes[0] });
        expect(matchCall({ project: 'a', method: 'POST', path: '/orders' }, routes)).toEqual({ route: routes[1] });
        expect(matchCall({ project: 'a', method: 'PUT', path: '/hooks/{x}' }, routes)).toEqual({ route: routes[2] });
    });

    it('prefers the exact path and verb tier over the alias and any-verb tiers', () => {
        const tiered = [route('b', ['GET'], '/api/orders/:id'), route('c', ['GET'], '/orders/:id'), route('d', ['ANY'], '/api/orders/{id}')];
        expect(matchCall({ project: 'a', method: 'GET', path: '/api/orders/{id}' }, tiered)).toEqual({ route: tiered[0] });
    });

    it('names why a call is unmatched', () => {
        expect(matchCall({ project: 'a', method: 'GET', path: '' }, routes)).toEqual({ unmatched: 'dynamic_baseurl' });
        expect(matchCall({ project: 'a', method: 'GET', path: '/{base}' }, routes)).toEqual({ unmatched: 'dynamic_baseurl' });
        expect(matchCall({ project: 'a', method: 'GET', path: '/nowhere' }, routes)).toEqual({ unmatched: 'no_endpoint_match' });
        expect(matchCall({ project: 'a', method: 'DELETE', path: '/orders' }, routes)).toEqual({ unmatched: 'no_endpoint_match' });
        const twice = [route('b', ['GET'], '/orders/:id'), route('c', ['GET'], '/orders/{order}')];
        expect(matchCall({ project: 'a', method: 'GET', path: '/orders/1' }, twice)).toEqual({ unmatched: 'no_endpoint_match' });
        expect(matchCall({ project: 'a', method: 'GET', path: '/orders/{id}' }, twice)).toEqual({ unmatched: 'ambiguous', candidates: 2 });
    });

    it('never matches a call to a route of its own project', () => {
        expect(matchCall({ project: 'a', method: 'GET', path: '/self/{y}' }, routes)).toEqual({ unmatched: 'no_endpoint_match' });
    });
});

describe('hub facts on two fixture projects (4.9)', () => {
    it('one matched call, one unmatched reason, a port collision, a shared image and a shared service', async () => {
        const { alpha, beta } = projects();
        expect(await main(['build', '--root', beta])).toBe(0);
        const facts = hubFacts([
            { id: 'alpha-id', name: 'alpha', root: alpha },
            { id: 'beta-id', name: 'beta', root: beta },
        ]);
        const orders = facts.calls.find((c) => c.path.includes('orders'));
        expect(orders?.match).toMatchObject({ project: 'beta-id', route: 'GET /orders/:id' });
        expect(orders?.match?.witness.file).toBe('src/app.ts');
        expect(orders?.witness.file).toBe('src/orders.ts');
        expect(facts.calls.find((c) => c.path === '/audit-log')?.unmatched).toBe('no_endpoint_match');
        expect(facts.calls.filter((c) => c.match)).toHaveLength(1);
        expect(facts.ports.map((p) => p.port)).toEqual(['8080/tcp']);
        expect(facts.ports[0]?.uses.map((u) => [u.project, u.name])).toEqual([['alpha-id', 'web'], ['beta-id', 'api']]);
        expect(facts.images.map((i) => [i.image, i.refs.sort()])).toEqual([['postgres', ['postgres:15', 'postgres:16']]]);
        expect(facts.services.map((s) => s.identity)).toEqual(['host:api.partner.example']);
        expect(facts.skipped).toEqual([]);
    }, 120_000);

    it('lists the version each project runs of a package or runtime two of them share (1.8)', () => {
        const mk = (name: string, react: string, php: string): string => {
            const dir = fs.realpathSync(fs.mkdtempSync(path.join(tmp, `hubv-${name}-`)));
            fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ dependencies: { react: `^${react}` } }));
            fs.writeFileSync(path.join(dir, 'package-lock.json'), JSON.stringify({ lockfileVersion: 3, packages: { '': { dependencies: { react: `^${react}` } }, 'node_modules/react': { version: react } } }, null, 2));
            fs.writeFileSync(path.join(dir, 'Dockerfile'), `FROM php:${php}-fpm\n`);
            return dir;
        };
        const facts = hubFacts([
            { id: 'a', name: 'a', root: mk('a', '18.2.0', '8.3') },
            { id: 'b', name: 'b', root: mk('b', '19.0.0', '8.3') },
        ]);
        const react = facts.versions?.find((r) => r.subject === 'npm:react');
        expect(react?.framework).toBe(true);
        expect(react?.differs).toBe(true);
        expect(react?.uses.map((u) => [u.project, u.name])).toEqual([['a', '18.2.0'], ['b', '19.0.0']]);
        expect(facts.versions?.find((r) => r.subject === 'runtime:php')?.differs).toBe(false);
        expect(facts.versions?.[0]?.subject).toBe('npm:react');
    });

    it('reports a project whose root is gone instead of failing the hub', () => {
        const facts = hubFacts([{ id: 'gone', name: 'gone', root: path.join(tmp, 'nowhere') }]);
        expect(facts.skipped).toEqual([{ project: 'gone', reason: 'root is gone' }]);
    });

    it('stores them in the hub only: nothing of another project reaches a project map', async () => {
        const { alpha, beta } = projects();
        for (const r of [alpha, beta]) expect(await main(['build', '--root', r])).toBe(0);
        expect(await main(['map', '--estate', '--no-verify'])).toBe(0);
        const hub = fs.readFileSync(path.join(estateMapDir(), 'projects', 'hub.json'), 'utf-8');
        expect(hub).toContain('/api/v1/orders/{id}');
        expect(hub).toContain('8080/tcp');
        await buildMap(beta);
        const mapDir = graphHome(beta).mapDir;
        const files: string[] = [];
        const walk = (d: string): void => {
            for (const e of fs.readdirSync(d, { withFileTypes: true })) {
                if (e.name === '.build') continue;
                const p = path.join(d, e.name);
                if (e.isDirectory()) walk(p);
                else files.push(p);
            }
        };
        walk(mapDir);
        expect(files.length).toBeGreaterThan(0);
        const text = files.map((f) => fs.readFileSync(f, 'utf-8')).join('\n');
        const alphaId = Object.entries(readRegistry().projects).find(([, e]) => e.root === alpha)?.[0];
        expect(alphaId).toBeTruthy();
        for (const leak of [alphaId as string, alpha, 'fixture-hub-alpha', 'src/orders.ts', '/api/v1/orders', 'audit-log', '8080/tcp', 'projects/hub.json']) {
            expect(text.includes(leak), leak).toBe(false);
        }
    }, 120_000);

    it('a project map refuses a Projects section outright', async () => {
        expect(areaProblems({ projects: {} } as never)).toEqual(["unknown area 'projects'"]);
        const { beta } = projects();
        await expect(buildMap(beta, { areas: { projects: {} } as never })).rejects.toThrow(/unknown area 'projects'/);
    }, 120_000);
});
