import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

import { buildFromRepo } from '../../src/scripts/code_graph/build.js';
import { djangoProvider } from '../../src/scripts/code_graph/providers/django.js';
import type { CodeGraph } from '../../src/scripts/code_graph/types.js';
import { buildMapModel } from '../../src/scripts/code_graph/map_model.js';
import { validateGraph } from '../../src/scripts/code_graph/validate.js';

const FIXTURE = path.resolve(__dirname, '../fixtures/code-graph/django');
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

describe('django provider', () => {
    it('detects django from requirements.txt', () => {
        expect(graph.providers).toEqual([{ id: 'django', roots: [''] }]);
    });

    it('detects by manifest or by manage.py, and stays inactive with neither', () => {
        const probe = (manifests: Array<[string, string]>, markers: string[] = []) => ({ manifests: new Map(manifests), markers: new Set(markers), paths: [] });
        expect(djangoProvider.detect(probe([]))).toEqual([]);
        expect(djangoProvider.detect(probe([['requirements.txt', 'django-environ==0.11\n']]))).toEqual([]);
        expect(djangoProvider.detect(probe([], ['site/manage.py']))).toEqual(['site']);
        expect(djangoProvider.markers).toEqual(['manage.py']);
    });

    it('routes path() through an imported module to the view function, not the same-named one elsewhere', () => {
        expect(routesTo('ANY /')).toEqual(['blog/views.py#index']);
        expect(routesTo('ANY /archive/(?P<year>[0-9]{4})')).toEqual(['blog/views.py#archive']);
        expect(graph.edges.some((e) => e.relation === 'routes-to' && e.target.startsWith('other/'))).toBe(false);
    });

    it('routes View.as_view() to the view class', () => {
        expect(routesTo('ANY /posts/<int:pk>')).toEqual(['blog/views.py#PostDetail']);
    });

    it('declares a lambda route without a target', () => {
        expect(routesTo('ANY /inline')).toEqual([]);
    });

    it('prefixes an included urls module with every path that includes it, nested includes joined', () => {
        // include("blog.urls") and include(("blog.urls", "blog")) — string and tuple form, two prefixes.
        expect(routesTo('ANY /blog/about')).toEqual(['blog/views.py#about']);
        expect(routesTo('ANY /v2/about')).toEqual(['blog/views.py#about']);
        // include(api_urls), a module the including file imports, nested under each prefix.
        expect(routesTo('ANY /blog/api/gone')).toEqual(['blog/views.py#gone']);
        expect(routesTo('ANY /v2/api/gone')).toEqual(['blog/views.py#gone']);
        // An included module's routes never appear without the prefix that reaches them.
        expect(graph.nodes.filter((n) => n.kind === 'route').map((n) => n.label).sort()).toEqual([
            'ANY /',
            'ANY /archive/(?P<year>[0-9]{4})',
            'ANY /blog/about',
            'ANY /blog/api/gone',
            'ANY /count',
            'ANY /feed',
            'ANY /inline',
            'ANY /posts/<int:pk>',
            'ANY /v2/about',
            'ANY /v2/api/gone',
        ]);
    });

    it('binds a CapWords call to the class and a Model.objects chain to the model', () => {
        const calls = graph.edges.find((e) => e.source === 'blog/feed.py#build' && e.relation === 'calls');
        expect(calls?.target).toBe('blog/services.py#PostService');
        expect(calls?.resolved_via).toBe('import-specifier');
        const uses = graph.edges.find((e) => e.source === 'blog/feed.py#count' && e.relation === 'uses');
        expect(uses?.target).toBe('blog/models.py#Post');
        expect(uses?.resolved_via).toBe('import-specifier');
    });

    it('reaches the model table on the request path, through a service class', () => {
        const m = buildMapModel(graph);
        expect(m.analyses.requestPaths.find((r) => r.route === 'ANY /count')?.tables).toEqual(['blog_posts']);
        expect(m.analyses.requestPaths.find((r) => r.route === 'ANY /feed')?.tables).toEqual(['blog_author']);
    });

    it('renders templates from an app folder and the project folder', () => {
        expect(out('blog/views.py#index', 'renders')).toEqual(['blog/templates/blog/index.html']);
        expect(out('blog/views.py#about', 'renders')).toEqual(['templates/about.html']);
    });

    it('draws no render for a name in two app folders, a missing template, or a runtime name', () => {
        expect(out('blog/views.py#archive', 'renders')).toEqual([]);
        expect(out('blog/views.py#PostDetail::get', 'renders')).toEqual([]);
        expect(out('blog/views.py#gone', 'renders')).toEqual([]);
    });

    it('maps a model to Meta.db_table, else <app_label>_<model>', () => {
        expect(out('blog/models.py#Post', 'persists')).toEqual(['table:blog_posts']);
        expect(out('blog/models.py#Author', 'persists')).toEqual(['table:blog_author']);
        expect(out('blog/models.py#Tag', 'persists')).toEqual(['table:blog_tag']);
    });

    it('gives an abstract model, a plain class and a nested Meta no table', () => {
        expect(out('blog/models.py#Timestamped', 'persists')).toEqual([]);
        expect(out('blog/models.py#Plain', 'persists')).toEqual([]);
        expect(graph.edges.filter((e) => e.relation === 'persists')).toHaveLength(4);
    });

    it('relates ForeignKey, ManyToManyField and OneToOneField targets by class, name and app.Model', () => {
        expect(out('blog/models.py#Post', 'relates')).toEqual(['blog/models.py#Author', 'blog/models.py#Tag']);
        expect(out('blog/models.py#Profile', 'relates')).toEqual(['blog/models.py#Author']);
    });

    it('draws no relation to a missing model or to itself', () => {
        expect(graph.edges.filter((e) => e.relation === 'relates')).toHaveLength(3);
        expect(graph.edges.some((e) => e.relation === 'relates' && e.source === e.target)).toBe(false);
    });

    it('migrates the table a CreateModel creates, honouring an options db_table', () => {
        expect(out('blog/migrations/0001_initial.py', 'migrates')).toEqual(['table:blog_author', 'table:blog_posts']);
        expect(graph.nodes.some((n) => n.id === 'table:blog_post')).toBe(false);
    });

    it('stamps its edges and keeps the graph valid', () => {
        const rels = new Set(['routes-to', 'renders', 'persists', 'relates', 'migrates']);
        const mine = graph.edges.filter((e) => rels.has(e.relation));
        expect(mine.length).toBe(20);
        expect(mine.every((e) => e.provider_id === 'django')).toBe(true);
        expect(validateGraph(JSON.parse(JSON.stringify(graph))).ok).toBe(true);
    });
});
