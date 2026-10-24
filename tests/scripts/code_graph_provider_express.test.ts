import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

import { buildFromRepo } from '../../src/scripts/code_graph/build.js';
import type { CodeGraph } from '../../src/scripts/code_graph/types.js';
import { validateGraph } from '../../src/scripts/code_graph/validate.js';

const FIXTURE = path.resolve(__dirname, '../fixtures/code-graph/express');
let graph: CodeGraph;

beforeAll(async () => {
    ({ graph } = await buildFromRepo(FIXTURE, null));
});

const routesTo = (label: string): string[] => {
    const route = graph.nodes.find((n) => n.kind === 'route' && n.label === label);
    return graph.edges.filter((e) => e.source === route?.id && e.relation === 'routes-to').map((e) => e.target);
};

describe('express provider', () => {
    it('detects express from package.json', () => {
        expect(graph.providers?.map((p) => p.id)).toEqual(['express']);
    });

    it('routes a registration to the imported handler', () => {
        expect(routesTo('GET /users')).toEqual(['src/handlers.ts#listUsers']);
    });

    it('takes the last argument after middleware as the handler', () => {
        expect(routesTo('POST /users')).toEqual(['src/handlers.ts#createUser']);
    });

    it('declares an inline-handler route without inventing a target', () => {
        expect(graph.nodes.some((n) => n.kind === 'route' && n.label === 'GET /health')).toBe(true);
        expect(routesTo('GET /health')).toEqual([]);
    });

    it('does not read a Map lookup as a route', () => {
        expect(graph.nodes.filter((n) => n.kind === 'route').map((n) => n.label).sort()).toEqual(['GET /health', 'GET /users', 'POST /users']);
    });

    it('stamps its edges and keeps the graph valid', () => {
        expect(graph.edges.filter((e) => e.relation === 'routes-to').every((e) => e.provider_id === 'express')).toBe(true);
        expect(validateGraph(JSON.parse(JSON.stringify(graph))).ok).toBe(true);
    });
});
