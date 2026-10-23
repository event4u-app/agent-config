import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

import { buildFromRepo } from '../../src/scripts/code_graph/build.js';
import type { CodeGraph } from '../../src/scripts/code_graph/types.js';
import { validateGraph } from '../../src/scripts/code_graph/validate.js';

const FIXTURE = path.resolve(__dirname, '../fixtures/code-graph/sveltekit');
const R = 'src/routes';
let graph: CodeGraph;

beforeAll(async () => {
    ({ graph } = await buildFromRepo(FIXTURE, null));
});

const providerRoutes = (label: string): string[] => {
    const ids = graph.nodes.filter((n) => n.kind === 'route' && n.label === label).map((n) => n.id);
    return graph.edges.filter((e) => ids.includes(e.source) && e.relation === 'routes-to' && e.provider_id === 'sveltekit').map((e) => e.target).sort();
};
const includes = (from: string): string[] =>
    graph.edges.filter((e) => e.source === from && e.relation === 'includes').map((e) => e.target).sort();

describe('sveltekit provider', () => {
    it('detects @sveltejs/kit from package.json', () => {
        expect(graph.providers?.map((p) => p.id)).toEqual(['sveltekit']);
    });

    it('routes +page modules, dropping groups and keeping params', () => {
        expect(providerRoutes('PAGE /')).toEqual([`${R}/+page.svelte`]);
        expect(providerRoutes('PAGE /about')).toEqual([`${R}/(marketing)/about/+page.svelte`]);
        expect(providerRoutes('PAGE /blog/[slug]')).toEqual([`${R}/blog/[slug]/+page.svelte`, `${R}/blog/[slug]/+page.ts`]);
    });

    it('replaces the default page route instead of doubling it', () => {
        expect(graph.nodes.filter((n) => n.kind === 'route' && n.label === 'PAGE /')).toHaveLength(1);
        expect(graph.edges.some((e) => e.resolved_via === 'fs-route' && e.target === `${R}/+page.svelte`)).toBe(false);
    });

    it('draws one route per exported verb of +server.ts, to that function', () => {
        expect(providerRoutes('GET /api/posts')).toEqual([`${R}/api/posts/+server.ts#GET`]);
        expect(providerRoutes('DELETE /api/posts')).toEqual([`${R}/api/posts/+server.ts#DELETE`]);
    });

    it('does not route a non-verb export, a verb outside a route module, or a lib component', () => {
        const targets = graph.edges.filter((e) => e.relation === 'routes-to').map((e) => e.target);
        expect(targets).not.toContain(`${R}/api/posts/+server.ts#describe`);
        expect(targets).not.toContain('src/lib/api.ts#GET');
        expect(targets).not.toContain('src/lib/Button.svelte');
    });

    it('includes every +page.svelte below a layout, and none outside it', () => {
        expect(includes(`${R}/+layout.svelte`)).toEqual([`${R}/(marketing)/about/+page.svelte`, `${R}/+page.svelte`, `${R}/blog/[slug]/+page.svelte`]);
        expect(includes(`${R}/blog/+layout.svelte`)).toEqual([`${R}/blog/[slug]/+page.svelte`]);
    });

    it('stamps its edges and keeps the graph valid', () => {
        const mine = graph.edges.filter((e) => e.relation === 'includes' || e.resolved_via === 'route-table');
        expect(mine.length).toBe(10);
        expect(mine.every((e) => e.provider_id === 'sveltekit')).toBe(true);
        expect(validateGraph(JSON.parse(JSON.stringify(graph))).ok).toBe(true);
    });
});

describe('sveltekit provider without a manifest', () => {
    it('stays inactive', async () => {
        const { graph: g } = await buildFromRepo(path.join(FIXTURE, 'src', 'lib'), null);
        expect(g.providers ?? []).toEqual([]);
        expect(g.edges.some((e) => e.provider_id === 'sveltekit')).toBe(false);
    });
});
