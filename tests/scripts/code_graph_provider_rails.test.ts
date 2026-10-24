import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

import { buildFromRepo } from '../../src/scripts/code_graph/build.js';
import { buildMapModel } from '../../src/scripts/code_graph/map_model.js';
import { railsProvider } from '../../src/scripts/code_graph/providers/rails.js';
import type { CodeGraph } from '../../src/scripts/code_graph/types.js';
import { validateGraph } from '../../src/scripts/code_graph/validate.js';

const FIXTURE = path.resolve(__dirname, '../fixtures/code-graph/rails');
let graph: CodeGraph;

beforeAll(async () => {
    ({ graph } = await buildFromRepo(FIXTURE, null));
});

const C = 'app/controllers';
const M = 'app/models';
const routesTo = (label: string): string[] => {
    const route = graph.nodes.find((n) => n.kind === 'route' && n.label === label);
    return graph.edges.filter((e) => e.source === route?.id && e.relation === 'routes-to').map((e) => e.target);
};
const out = (source: string, relation: string): string[] =>
    graph.edges
        .filter((e) => e.source === source && e.relation === relation)
        .map((e) => e.target)
        .sort();

describe('rails provider (carried 1.2)', () => {
    it('detects rails from the Gemfile and nothing without it', () => {
        expect(graph.providers?.map((p) => p.id)).toContain('rails');
        const probe = (manifests: Array<[string, string]>) => ({ manifests: new Map(manifests), markers: new Set<string>(), paths: [] });
        expect(railsProvider.detect(probe([]))).toEqual([]);
        expect(railsProvider.detect(probe([['Gemfile', "gem 'sinatra'\n"]]))).toEqual([]);
        expect(railsProvider.detect(probe([['api/Gemfile', 'gem "rails", "~> 7.1"\n']]))).toEqual(['api']);
    });

    it('routes root, an explicit to:, the => form and a namespaced resource to the controller action', () => {
        expect(routesTo('GET /')).toEqual([`${C}/pages_controller.rb#PagesController::home`]);
        expect(routesTo('POST /search')).toEqual([`${C}/pages_controller.rb#PagesController::search`]);
        expect(routesTo('GET /admin/reports')).toEqual([`${C}/admin/reports_controller.rb#Admin::ReportsController::index`]);
    });

    it('expands resources into the actions the controller defines, within only:', () => {
        expect(routesTo('GET /users')).toEqual([`${C}/users_controller.rb#UsersController::index`]);
        expect(routesTo('GET /users/:id')).toEqual([`${C}/users_controller.rb#UsersController::show`]);
        expect(routesTo('POST /users')).toEqual([`${C}/users_controller.rb#UsersController::create`]);
        expect(routesTo('GET /users/:id/edit')).toEqual([`${C}/users_controller.rb#UsersController::edit`]);
        const labels = graph.nodes.filter((n) => n.kind === 'route').map((n) => n.label);
        // update is in only: but the controller does not define it; new and destroy are outside only:.
        expect(labels).not.toContain('PATCH /users/:id');
        expect(labels).not.toContain('GET /users/new');
        expect(labels).not.toContain('DELETE /users/:id');
        // An explicit route keeps its node even when the action is missing.
        expect(labels).toContain('GET /about');
        expect(routesTo('GET /about')).toEqual([]);
        expect(graph.edges.some((e) => e.relation === 'routes-to' && e.target.startsWith(`${C}/legacy/`))).toBe(false);
    });

    it('maps a model to its table: the convention, self.table_name, an irregular plural, and STI', () => {
        expect(out(`${M}/user.rb#User`, 'persists')).toEqual(['table:users']);
        expect(out(`${M}/order.rb#Order`, 'persists')).toEqual(['table:purchase_orders']);
        expect(out(`${M}/person.rb#Person`, 'persists')).toEqual(['table:people']);
        expect(out(`${M}/admin_user.rb#AdminUser`, 'persists')).toEqual(['table:users']);
        expect(out(`${M}/application_record.rb#ApplicationRecord`, 'persists')).toEqual([]);
        expect(out('app/services/thing.rb#Thing', 'persists')).toEqual([]);
    });

    it('relates has_many, has_one, belongs_to and class_name, and nothing for a missing model', () => {
        expect(out(`${M}/user.rb#User`, 'relates')).toEqual([`${M}/order.rb#Order`, `${M}/person.rb#Person`, `${M}/profile.rb#Profile`]);
        expect(out(`${M}/order.rb#Order`, 'relates')).toEqual([`${M}/user.rb#User`]);
    });

    it('links a migration to the tables it creates', () => {
        expect(out('db/migrate/20240101000000_create_users.rb', 'migrates')).toEqual(['table:purchase_orders', 'table:users']);
    });

    it('renders the implicit view of an action, and nothing where none exists', () => {
        expect(out(`${C}/users_controller.rb#UsersController::index`, 'renders')).toEqual(['app/views/users/index.html.erb']);
        expect(out(`${C}/users_controller.rb#UsersController::show`, 'renders')).toEqual(['app/views/users/show.html.erb']);
        expect(out(`${C}/admin/reports_controller.rb#Admin::ReportsController::index`, 'renders')).toEqual(['app/views/admin/reports/index.html.erb']);
        expect(out(`${C}/users_controller.rb#UsersController::create`, 'renders')).toEqual([]);
    });

    it('chains route → handler → view → table on the map', () => {
        const m = buildMapModel(graph);
        const r = m.analyses.requestPaths.find((x) => x.route === 'GET /users');
        expect(r?.views.map((v) => m.files[v]?.path)).toEqual(['app/views/users/index.html.erb']);
    });

    it('stamps its edges and keeps the graph valid', () => {
        const mine = graph.edges.filter((e) => ['routes-to', 'persists', 'relates', 'migrates', 'renders'].includes(e.relation));
        expect(mine.length).toBeGreaterThan(0);
        expect(mine.every((e) => e.provider_id === 'rails')).toBe(true);
        expect(validateGraph(JSON.parse(JSON.stringify(graph))).ok).toBe(true);
    });
});
