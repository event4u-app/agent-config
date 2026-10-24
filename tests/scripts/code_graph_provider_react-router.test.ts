import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

import { buildFromRepo } from '../../src/scripts/code_graph/build.js';
import type { CodeGraph } from '../../src/scripts/code_graph/types.js';
import { validateGraph } from '../../src/scripts/code_graph/validate.js';

const FIXTURE = path.resolve(__dirname, '../fixtures/code-graph/react-router');
let graph: CodeGraph;

beforeAll(async () => {
    ({ graph } = await buildFromRepo(FIXTURE, null));
});

const routesTo = (label: string): string[] => {
    const ids = graph.nodes.filter((n) => n.kind === 'route' && n.label === label).map((n) => n.id);
    return graph.edges.filter((e) => ids.includes(e.source) && e.relation === 'routes-to').map((e) => e.target);
};
const routeLabels = (): string[] => graph.nodes.filter((n) => n.kind === 'route').map((n) => n.label).sort();

describe('react-router provider', () => {
    it('detects react-router-dom from package.json', () => {
        expect(graph.providers?.map((p) => p.id)).toEqual(['react-router']);
    });

    it('routes a JSX element to a default-imported component', () => {
        expect(routesTo('PAGE /')).toEqual(['src/pages/Home.tsx#Home']);
    });

    it('routes to the imported component, not a same-named one elsewhere', () => {
        expect(routesTo('PAGE /about')).toEqual(['src/pages/About.tsx#About']);
        expect(graph.edges.some((e) => e.relation === 'routes-to' && e.target === 'src/widgets.tsx#About')).toBe(false);
    });

    it('reads component={X} and a route object Component: X', () => {
        expect(routesTo('PAGE /settings')).toEqual(['src/pages/Settings.tsx#Settings']);
        expect(routesTo('PAGE /account')).toEqual(['src/pages/Settings.tsx#Settings']);
    });

    it('routes a lazy route to the imported module file', () => {
        expect(routesTo('PAGE /reports')).toEqual(['src/pages/Reports.tsx']);
    });

    it('declares an inline-element route without a target', () => {
        expect(routeLabels()).toContain('PAGE /inline');
        expect(routesTo('PAGE /inline')).toEqual([]);
    });

    it('draws no route for a pathless <Route> or a path object without a component', () => {
        expect(routeLabels()).toEqual(['PAGE /', 'PAGE /about', 'PAGE /account', 'PAGE /inline', 'PAGE /reports', 'PAGE /settings']);
    });

    it('stamps its edges and keeps the graph valid', () => {
        expect(graph.edges.filter((e) => e.relation === 'routes-to').every((e) => e.provider_id === 'react-router')).toBe(true);
        expect(validateGraph(JSON.parse(JSON.stringify(graph))).ok).toBe(true);
    });
});

describe('react-router provider without a manifest', () => {
    it('stays inactive', async () => {
        const { graph: g } = await buildFromRepo(path.join(FIXTURE, 'src'), null);
        expect(g.providers ?? []).toEqual([]);
        expect(g.edges.some((e) => e.provider_id === 'react-router')).toBe(false);
    });
});
