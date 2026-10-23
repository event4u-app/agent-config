import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

import { buildFromRepo } from '../../src/scripts/code_graph/build.js';
import type { CodeGraph } from '../../src/scripts/code_graph/types.js';
import { validateGraph } from '../../src/scripts/code_graph/validate.js';

const FIXTURE = path.resolve(__dirname, '../fixtures/code-graph/nextjs');
let graph: CodeGraph;

beforeAll(async () => {
    ({ graph } = await buildFromRepo(FIXTURE, null));
});

const providerRoutes = (label: string): string[] => {
    const ids = graph.nodes.filter((n) => n.kind === 'route' && n.label === label).map((n) => n.id);
    return graph.edges.filter((e) => ids.includes(e.source) && e.relation === 'routes-to' && e.provider_id === 'nextjs').map((e) => e.target);
};
const includes = (from: string): string[] =>
    graph.edges.filter((e) => e.source === from && e.relation === 'includes').map((e) => e.target).sort();

describe('nextjs provider', () => {
    it('detects next from package.json', () => {
        expect(graph.providers?.map((p) => p.id)).toEqual(['nextjs']);
    });

    it('routes an app-router page, dropping route groups and keeping dynamic segments', () => {
        expect(providerRoutes('PAGE /')).toEqual(['app/page.tsx']);
        expect(providerRoutes('PAGE /items/[id]')).toEqual(['app/(shop)/items/[id]/page.tsx']);
    });

    it('replaces the default page route instead of doubling it', () => {
        expect(graph.nodes.filter((n) => n.kind === 'route' && n.label === 'PAGE /')).toHaveLength(1);
        expect(graph.edges.some((e) => e.relation === 'routes-to' && e.resolved_via === 'fs-route' && e.target === 'app/page.tsx')).toBe(false);
    });

    it('draws one route per exported verb of a route module, to that function', () => {
        expect(providerRoutes('GET /api/users')).toEqual(['app/api/users/route.ts#GET']);
        expect(providerRoutes('POST /api/users')).toEqual(['app/api/users/route.ts#POST']);
    });

    it('does not route a non-verb export, nor a GET function outside a route module', () => {
        const targets = graph.edges.filter((e) => e.relation === 'routes-to').map((e) => e.target);
        expect(targets).not.toContain('app/api/users/route.ts#format');
        expect(targets).not.toContain('src/other.ts#GET');
    });

    it('includes every page below a layout, and none outside it', () => {
        expect(includes('app/layout.tsx')).toEqual(['app/(shop)/items/[id]/page.tsx', 'app/dashboard/settings/page.tsx', 'app/page.tsx']);
        expect(includes('app/dashboard/layout.tsx')).toEqual(['app/dashboard/settings/page.tsx']);
    });

    it('routes the pages router, with pages/api as ROUTE and _app as no route', () => {
        expect(providerRoutes('PAGE /about')).toEqual(['pages/about.tsx']);
        expect(providerRoutes('ROUTE /api/health')).toEqual(['pages/api/health.ts']);
        expect(graph.edges.some((e) => e.provider_id === 'nextjs' && e.target === 'pages/_app.tsx')).toBe(false);
    });

    it('draws no route for a page in a private folder', () => {
        expect(graph.edges.some((e) => e.provider_id === 'nextjs' && e.target === 'app/_lib/page.tsx')).toBe(false);
    });

    it('stamps its edges and keeps the graph valid', () => {
        const mine = graph.edges.filter((e) => e.relation === 'includes' || e.resolved_via === 'route-table');
        expect(mine.length).toBeGreaterThan(0);
        expect(mine.every((e) => e.provider_id === 'nextjs')).toBe(true);
        expect(validateGraph(JSON.parse(JSON.stringify(graph))).ok).toBe(true);
    });
});

describe('nextjs provider without a manifest', () => {
    it('stays inactive', async () => {
        const { graph: g } = await buildFromRepo(path.join(FIXTURE, 'app'), null);
        expect(g.providers ?? []).toEqual([]);
        expect(g.edges.some((e) => e.provider_id === 'nextjs')).toBe(false);
    });
});
