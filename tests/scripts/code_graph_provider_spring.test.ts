import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

import { buildFromRepo } from '../../src/scripts/code_graph/build.js';
import { springProvider } from '../../src/scripts/code_graph/providers/spring.js';
import type { CodeGraph } from '../../src/scripts/code_graph/types.js';
import { validateGraph } from '../../src/scripts/code_graph/validate.js';

const FIXTURE = path.resolve(__dirname, '../fixtures/code-graph/spring');
const P = 'src/main/java/com/acme/shop';
let graph: CodeGraph;

beforeAll(async () => {
    ({ graph } = await buildFromRepo(FIXTURE, null));
});

const routesTo = (label: string): string[] => {
    const route = graph.nodes.find((n) => n.kind === 'route' && n.label === label);
    return graph.edges.filter((e) => e.source === route?.id && e.relation === 'routes-to').map((e) => e.target);
};
const out = (source: string, relation: string): string[] =>
    graph.edges.filter((e) => e.source === source && e.relation === relation).map((e) => e.target).sort();

describe('spring provider', () => {
    it('detects spring-boot from pom.xml and nothing without a manifest', () => {
        expect(graph.providers?.map((p) => p.id)).toEqual(['spring']);
        expect(springProvider.detect({ manifests: new Map(), markers: new Set(), paths: [] })).toEqual([]);
        expect(springProvider.detect({ manifests: new Map([['pom.xml', '<artifactId>junit</artifactId>']]), markers: new Set(), paths: [] })).toEqual([]);
    });

    it('routes a verb mapping under the class prefix to the annotated method', () => {
        expect(routesTo('GET /api/users')).toEqual([`${P}/UserController.java#UserController::list`]);
        expect(routesTo('DELETE /api/users/{id}')).toEqual([`${P}/UserController.java#UserController::remove`]);
    });

    it('routes a mapping below another annotation to its own method, not the next one', () => {
        expect(routesTo('POST /api/users')).toEqual([`${P}/UserController.java#UserController::create`]);
    });

    it('reads @RequestMapping with method = RequestMethod.X', () => {
        expect(routesTo('GET /api/legacy')).toEqual([`${P}/UserController.java#UserController::legacy`]);
    });

    it('never reads the class-level @RequestMapping as a route, nor targets a same-named method of another class', () => {
        expect(graph.nodes.filter((n) => n.kind === 'route').map((n) => n.label).sort()).toEqual([
            'DELETE /api/users/{id}',
            'GET /api/legacy',
            'GET /api/users',
            'POST /api/users',
        ]);
        expect(graph.edges.some((e) => e.relation === 'routes-to' && e.target === `${P}/UserService.java#UserService::list`)).toBe(false);
    });

    it('maps an entity to its @Table name, else the snake_case default', () => {
        expect(out(`${P}/User.java#User`, 'persists')).toEqual(['table:app_users']);
        expect(out(`${P}/OrderLine.java#OrderLine`, 'persists')).toEqual(['table:order_line']);
        expect(out(`${P}/UserDto.java#UserDto`, 'persists')).toEqual([]);
    });

    it('relates a Spring Data repository to its entity, and no other generic interface', () => {
        expect(out(`${P}/UserRepository.java#UserRepository`, 'relates')).toEqual([`${P}/User.java#User`]);
        expect(out(`${P}/OrderLineRepository.java#OrderLineRepository`, 'relates')).toEqual([`${P}/OrderLine.java#OrderLine`]);
        expect(out(`${P}/UserMapper.java#UserMapper`, 'relates')).toEqual([]);
    });

    it('injects @Autowired fields and stereotype constructor parameters of in-repo types only', () => {
        expect(out(`${P}/UserController.java#UserController`, 'injects')).toEqual([
            `${P}/OrderService.java#OrderService`,
            `${P}/UserService.java#UserService`,
        ]);
        expect(out(`${P}/UserService.java#UserService`, 'injects')).toEqual([`${P}/UserRepository.java#UserRepository`]);
        expect(out(`${P}/OrderService.java#OrderService`, 'injects')).toEqual([]);
    });

    it('stamps its edges and keeps the graph valid', () => {
        const mine = graph.edges.filter((e) => ['routes-to', 'persists', 'relates', 'injects'].includes(e.relation));
        expect(mine.length).toBe(11);
        expect(mine.every((e) => e.provider_id === 'spring')).toBe(true);
        expect(validateGraph(JSON.parse(JSON.stringify(graph))).ok).toBe(true);
    });
});
