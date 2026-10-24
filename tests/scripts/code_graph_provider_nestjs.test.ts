import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

import { buildFromRepo } from '../../src/scripts/code_graph/build.js';
import type { CodeGraph } from '../../src/scripts/code_graph/types.js';
import { validateGraph } from '../../src/scripts/code_graph/validate.js';

const FIXTURE = path.resolve(__dirname, '../fixtures/code-graph/nestjs');
const CTRL = 'src/users/users.controller.ts#UsersController';
let graph: CodeGraph;

beforeAll(async () => {
    ({ graph } = await buildFromRepo(FIXTURE, null));
});

const routesTo = (label: string): string[] => {
    const ids = graph.nodes.filter((n) => n.kind === 'route' && n.label === label).map((n) => n.id);
    return graph.edges.filter((e) => ids.includes(e.source) && e.relation === 'routes-to').map((e) => e.target);
};
const injects = (from: string): string[] => graph.edges.filter((e) => e.source === from && e.relation === 'injects').map((e) => e.target);

describe('nestjs provider', () => {
    it('detects @nestjs/core from package.json', () => {
        expect(graph.providers?.map((p) => p.id)).toEqual(['nestjs']);
    });

    it('joins the controller prefix and routes each verb decorator to its method', () => {
        expect(routesTo('GET /users')).toEqual([`${CTRL}::findAll`]);
        expect(routesTo('GET /users/:id')).toEqual([`${CTRL}::findOne`]);
        expect(routesTo('POST /users')).toEqual([`${CTRL}::create`]);
    });

    it('routes only decorated methods, never a same-named method elsewhere', () => {
        const targets = graph.edges.filter((e) => e.relation === 'routes-to').map((e) => e.target);
        expect(targets).not.toContain(`${CTRL}::helper`);
        expect(targets).not.toContain('src/util/plain.ts#PlainHelper::findAll');
        expect(graph.nodes.filter((n) => n.kind === 'route')).toHaveLength(3);
    });

    it('draws injects from a decorated class to the service its constructor names', () => {
        expect(injects(CTRL)).toEqual(['src/users/users.service.ts#UsersService']);
        expect(injects('src/users/users.service.ts#UsersService')).toEqual(['src/users/audit.log.ts#AuditLog']);
    });

    it('draws no injects for an undecorated class or a token-injected primitive', () => {
        expect(injects('src/util/plain.ts#PlainHelper')).toEqual([]);
        expect(graph.edges.filter((e) => e.relation === 'injects')).toHaveLength(2);
    });

    it('stamps its edges and keeps the graph valid', () => {
        const mine = graph.edges.filter((e) => e.relation === 'routes-to' || e.relation === 'injects');
        expect(mine.every((e) => e.provider_id === 'nestjs' && (e.relation === 'injects' ? e.resolved_via === 'di-binding' : true))).toBe(true);
        expect(validateGraph(JSON.parse(JSON.stringify(graph))).ok).toBe(true);
    });
});

describe('nestjs provider without a manifest', () => {
    it('stays inactive', async () => {
        const { graph: g } = await buildFromRepo(path.join(FIXTURE, 'src'), null);
        expect(g.providers ?? []).toEqual([]);
        expect(g.edges.some((e) => e.provider_id === 'nestjs')).toBe(false);
    });
});
