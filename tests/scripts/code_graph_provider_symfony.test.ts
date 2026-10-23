import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

import { buildFromRepo } from '../../src/scripts/code_graph/build.js';
import { activeProviders } from '../../src/scripts/code_graph/providers/index.js';
import type { CodeGraph } from '../../src/scripts/code_graph/types.js';
import { validateGraph } from '../../src/scripts/code_graph/validate.js';

const FIXTURE = path.resolve(__dirname, '../fixtures/code-graph/symfony');
const CTRL = 'src/Controller/BlogController.php#BlogController';
let graph: CodeGraph;

beforeAll(async () => {
    ({ graph } = await buildFromRepo(FIXTURE, null));
});

const targets = (source: string, relation: string): string[] =>
    graph.edges.filter((e) => e.source === source && e.relation === relation).map((e) => e.target).sort();
const routesTo = (label: string): string[] => {
    const route = graph.nodes.find((n) => n.kind === 'route' && n.label === label);
    return route ? targets(route.id, 'routes-to') : ['<no route>'];
};

describe('symfony provider', () => {
    it('detects symfony from composer.json, and only symfony', () => {
        expect(graph.providers?.map((p) => p.id)).toEqual(['symfony']);
    });

    it('does not activate on a Laravel manifest, nor Laravel on its own', () => {
        const probe = (require: Record<string, string>, markers: string[] = []) => ({
            manifests: new Map([['composer.json', JSON.stringify({ require })]]),
            markers: new Set(markers),
            paths: [],
        });
        expect(activeProviders(probe({ 'laravel/framework': '^11.0' }, ['artisan'])).map((a) => a.provider.id)).toEqual(['laravel']);
        expect(activeProviders(probe({ 'symfony/framework-bundle': '^7.1' })).map((a) => a.provider.id)).toEqual(['symfony']);
    });

    it('routes a method attribute under the class prefix, verb from methods', () => {
        expect(routesTo('GET /blog/list')).toEqual([`${CTRL}::list`]);
        expect(routesTo('POST /blog/{id}')).toEqual([`${CTRL}::show`]);
    });

    it('routes a docblock @Route under its class-level @Route', () => {
        expect(routesTo('GET /legacy/index')).toEqual(['src/Controller/LegacyController.php#LegacyController::index']);
    });

    it('reads neither a cache lookup nor a class-level prefix as a route', () => {
        expect(graph.nodes.filter((n) => n.kind === 'route').map((n) => n.label).sort()).toEqual([
            'GET /blog/list',
            'GET /legacy/index',
            'POST /blog/{id}',
        ]);
    });

    it('renders the template a method names, and nothing for a missing one', () => {
        expect(targets(`${CTRL}::list`, 'renders')).toEqual(['templates/blog/list.html.twig']);
        expect(targets(`${CTRL}::show`, 'renders')).toEqual([]);
        expect(targets('src/Controller/LegacyController.php#LegacyController::index', 'renders')).toEqual([]);
    });

    it('persists an entity to its #[ORM\\Table] name, else the snake_case short name', () => {
        expect(targets('src/Entity/Post.php#Post', 'persists')).toEqual(['table:blog_posts']);
        expect(targets('src/Entity/PostTag.php#PostTag', 'persists')).toEqual(['table:post_tag']);
        expect(targets('src/Entity/Comment.php#Comment', 'persists')).toEqual(['table:comment']);
    });

    it('gives an unmapped class no table, and a JoinTable no entity', () => {
        expect(targets('src/Entity/Draft.php#Draft', 'persists')).toEqual([]);
        expect(graph.nodes.some((n) => n.id === 'table:post_tags')).toBe(false);
    });

    it('migrates the tables a Doctrine migration creates, not one it only selects from', () => {
        expect(targets('migrations/Version20240101000000.php', 'migrates')).toEqual(['table:blog_posts', 'table:comment']);
        expect(graph.nodes.some((n) => n.id === 'table:audit_log')).toBe(false);
    });

    it('relates an entity by targetEntity, by string, and by the property type', () => {
        expect(targets('src/Entity/Post.php#Post', 'relates')).toEqual([
            'src/Entity/Author.php#Author',
            'src/Entity/Comment.php#Comment',
            'src/Entity/PostTag.php#PostTag',
        ]);
        expect(targets('src/Entity/Comment.php#Comment', 'relates')).toEqual(['src/Entity/Post.php#Post']);
    });

    it('injects the in-repo constructor types through use aliases, never a same-named class elsewhere', () => {
        expect(targets(CTRL, 'injects')).toEqual(['src/Service/Clock.php#Clock', 'src/Service/Mailer.php#Mailer']);
        expect(graph.edges.some((e) => e.relation === 'injects' && e.target === 'src/Other/Mailer.php#Mailer')).toBe(false);
    });

    it('stamps its edges and keeps the graph valid', () => {
        const mine = graph.edges.filter((e) => ['routes-to', 'renders', 'persists', 'migrates', 'relates', 'injects'].includes(e.relation));
        expect(mine.length).toBeGreaterThan(0);
        expect(mine.every((e) => e.provider_id === 'symfony')).toBe(true);
        expect(validateGraph(JSON.parse(JSON.stringify(graph))).ok).toBe(true);
    });
});
