import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

import { buildFromRepo } from '../../src/scripts/code_graph/build.js';
import type { CodeGraph } from '../../src/scripts/code_graph/types.js';
import { validateGraph } from '../../src/scripts/code_graph/validate.js';

const FIXTURE = path.resolve(__dirname, '../fixtures/code-graph/vue-router');
let graph: CodeGraph;

beforeAll(async () => {
    ({ graph } = await buildFromRepo(FIXTURE, null));
});

const routesTo = (label: string): string[] => {
    const ids = graph.nodes.filter((n) => n.kind === 'route' && n.label === label).map((n) => n.id);
    return graph.edges.filter((e) => ids.includes(e.source) && e.relation === 'routes-to').map((e) => e.target);
};

describe('vue-router provider', () => {
    it('detects vue-router from package.json', () => {
        expect(graph.providers?.map((p) => p.id)).toEqual(['vue-router']);
    });

    it('routes to a default-imported single-file component, not a same-named export elsewhere', () => {
        expect(routesTo('PAGE /')).toEqual(['src/views/Home.vue']);
        expect(graph.edges.some((e) => e.relation === 'routes-to' && e.target === 'src/views/home.ts#Home')).toBe(false);
    });

    it('routes a lazy component to the imported file', () => {
        expect(routesTo('PAGE /about')).toEqual(['src/views/About.vue']);
    });

    it('routes to a named-import component', () => {
        expect(routesTo('PAGE /:pathMatch(.*)*')).toEqual(['src/views/not-found.ts#NotFound']);
    });

    it('draws no route for a redirect or a non-route object with a path key', () => {
        expect(graph.nodes.filter((n) => n.kind === 'route').map((n) => n.label).sort()).toEqual(['PAGE /', 'PAGE /:pathMatch(.*)*', 'PAGE /about']);
    });

    it('stamps its edges and keeps the graph valid', () => {
        expect(graph.edges.filter((e) => e.relation === 'routes-to').every((e) => e.provider_id === 'vue-router')).toBe(true);
        expect(validateGraph(JSON.parse(JSON.stringify(graph))).ok).toBe(true);
    });
});

describe('vue-router provider without a manifest', () => {
    it('stays inactive', async () => {
        const { graph: g } = await buildFromRepo(path.join(FIXTURE, 'src'), null);
        expect(g.providers ?? []).toEqual([]);
        expect(g.edges.some((e) => e.provider_id === 'vue-router')).toBe(false);
    });
});
