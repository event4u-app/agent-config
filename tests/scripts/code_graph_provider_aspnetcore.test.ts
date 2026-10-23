import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

import { buildFromRepo } from '../../src/scripts/code_graph/build.js';
import type { CodeGraph } from '../../src/scripts/code_graph/types.js';
import { validateGraph } from '../../src/scripts/code_graph/validate.js';

const FIXTURE = path.resolve(__dirname, '../fixtures/code-graph/aspnetcore');
const C = 'src/Api/Controllers/UsersController.cs';
let graph: CodeGraph;

beforeAll(async () => {
    ({ graph } = await buildFromRepo(FIXTURE, null));
});

const targets = (source: string, relation: string): string[] =>
    graph.edges.filter((e) => e.source === source && e.relation === relation).map((e) => e.target).sort();
const routesTo = (label: string): string[] => {
    const route = graph.nodes.find((n) => n.kind === 'route' && n.label === label);
    return route ? targets(route.id, 'routes-to') : [];
};
const sources = (target: string, relation: string): string[] =>
    graph.edges.filter((e) => e.target === target && e.relation === relation).map((e) => e.source).sort();

describe('aspnetcore provider', () => {
    it('detects the web SDK in the csproj and scopes to its directory', () => {
        expect(graph.providers).toEqual([{ id: 'aspnetcore', roots: ['src/Api'] }]);
    });

    it('routes attribute actions under the class prefix, replacing [controller] and [action]', () => {
        expect(routesTo('GET /api/Users')).toEqual([`${C}#UsersController::Index`]);
        expect(routesTo('GET /api/Users/{id}')).toEqual([`${C}#UsersController::Show`]);
        expect(routesTo('POST /api/Users/create')).toEqual([`${C}#UsersController::Create`]);
        expect(routesTo('ANY /api/Users/Search')).toEqual([`${C}#UsersController::Search`]);
        expect(routesTo('DELETE /admin/users/{id}')).toEqual([`${C}#UsersController::Remove`]);
    });

    it('gives an unattributed action and the class prefix itself no route', () => {
        const labels = graph.nodes.filter((n) => n.kind === 'route').map((n) => n.label).sort();
        expect(labels).toEqual(['ANY /api/Users/Search', 'DELETE /admin/users/{id}', 'GET /api/Users', 'GET /api/Users/{id}', 'GET /health', 'POST /api/Users/create', 'POST /echo']);
        expect(sources(`${C}#UsersController::Helper`, 'routes-to')).toEqual([]);
    });

    it('routes a minimal API to its method group, and a lambda to nothing', () => {
        expect(routesTo('GET /health')).toEqual(['src/Api/Handlers/HealthHandlers.cs#HealthHandlers::Ping']);
        expect(routesTo('POST /echo')).toEqual([]);
    });

    it('maps a DbSet entity to its table, with [Table] winning', () => {
        expect(targets('src/Api/Models/User.cs#User', 'persists')).toEqual(['table:Users']);
        expect(targets('src/Api/Models/Order.cs#Order', 'persists')).toEqual(['table:purchase_orders']);
        expect(targets('src/Api/Models/AuditEntry.cs#AuditEntry', 'persists')).toEqual([]);
        expect(graph.nodes.some((n) => n.id === 'table:Things' || n.id === 'table:Orders')).toBe(false);
    });

    it('renders the view an action names or defaults to, falling back to Shared', () => {
        expect(targets(`${C}#UsersController::Index`, 'renders')).toEqual(['src/Api/Views/Users/Index.cshtml']);
        expect(targets(`${C}#UsersController::Show`, 'renders')).toEqual(['src/Api/Views/Users/Details.cshtml']);
        expect(targets(`${C}#UsersController::Search`, 'renders')).toEqual(['src/Api/Views/Shared/_Row.cshtml']);
        expect(targets(`${C}#UsersController::Create`, 'renders')).toEqual([]);
        expect(targets(`${C}#UsersController::Remove`, 'renders')).toEqual([]);
    });

    it('injects an in-repo constructor parameter type, never a framework or primitive one', () => {
        expect(targets(`${C}#UsersController`, 'injects')).toEqual(['src/Api/Services/UserService.cs#IUserService']);
    });

    it('stamps its edges and keeps the graph valid', () => {
        const convention = graph.edges.filter((e) => ['routes-to', 'renders', 'persists', 'injects'].includes(e.relation));
        expect(convention.length).toBeGreaterThan(0);
        expect(convention.every((e) => e.provider_id === 'aspnetcore')).toBe(true);
        expect(validateGraph(JSON.parse(JSON.stringify(graph))).ok).toBe(true);
    });
});
