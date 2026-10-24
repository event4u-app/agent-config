import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

import { buildFromRepo } from '../../src/scripts/code_graph/build.js';
import type { CodeGraph } from '../../src/scripts/code_graph/types.js';
import { validateGraph } from '../../src/scripts/code_graph/validate.js';

const FIXTURE = path.resolve(__dirname, '../fixtures/code-graph/angular');
const USERS = 'src/app/users/users.component.ts#UsersComponent';
let graph: CodeGraph;

beforeAll(async () => {
    ({ graph } = await buildFromRepo(FIXTURE, null));
});

const routesTo = (label: string): string[] => {
    const ids = graph.nodes.filter((n) => n.kind === 'route' && n.label === label).map((n) => n.id);
    return graph.edges.filter((e) => ids.includes(e.source) && e.relation === 'routes-to').map((e) => e.target);
};
const out = (from: string, relation: string): string[] =>
    graph.edges.filter((e) => e.source === from && e.relation === relation).map((e) => e.target).sort();

describe('angular provider', () => {
    it('detects @angular/core from package.json', () => {
        expect(graph.providers?.map((p) => p.id)).toEqual(['angular']);
    });

    it('routes a route object to its component class', () => {
        expect(routesTo('PAGE /')).toEqual([USERS]);
    });

    it('routes loadComponent to the class the then() picks from the module', () => {
        expect(routesTo('PAGE /admin')).toEqual(['src/app/admin/admin.component.ts#AdminComponent']);
    });

    it('draws no route for a redirect or a path object outside a route table', () => {
        expect(graph.nodes.filter((n) => n.kind === 'route').map((n) => n.label).sort()).toEqual(['PAGE /', 'PAGE /admin']);
    });

    it('renders the templateUrl file, and nothing for a missing one', () => {
        expect(out(USERS, 'renders')).toEqual(['src/app/users/users.component.html']);
        expect(out('src/app/admin/admin.component.ts#AdminComponent', 'renders')).toEqual([]);
    });

    it('draws injects for constructor parameters and inject() fields of a decorated class', () => {
        expect(out(USERS, 'injects')).toEqual(['src/app/users/logger.service.ts#Logger', 'src/app/users/users.service.ts#UsersService']);
    });

    it('draws no injects for an undecorated class', () => {
        expect(out('src/app/plain.ts#Report', 'injects')).toEqual([]);
    });

    it('stamps its edges and keeps the graph valid', () => {
        const mine = graph.edges.filter((e) => ['routes-to', 'renders', 'injects'].includes(e.relation));
        expect(mine.length).toBe(5);
        expect(mine.every((e) => e.provider_id === 'angular')).toBe(true);
        expect(validateGraph(JSON.parse(JSON.stringify(graph))).ok).toBe(true);
    });
});

describe('angular provider without a manifest', () => {
    it('stays inactive', async () => {
        const { graph: g } = await buildFromRepo(path.join(FIXTURE, 'src'), null);
        expect(g.providers ?? []).toEqual([]);
        expect(g.edges.some((e) => e.provider_id === 'angular')).toBe(false);
    });
});
