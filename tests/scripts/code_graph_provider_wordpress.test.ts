import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

import { buildFromRepo } from '../../src/scripts/code_graph/build.js';
import { activeProviders } from '../../src/scripts/code_graph/providers/index.js';
import type { CodeGraph } from '../../src/scripts/code_graph/types.js';
import { validateGraph } from '../../src/scripts/code_graph/validate.js';

const FIXTURES = path.resolve(__dirname, '../fixtures/code-graph/wordpress');
const THEME = 'wp-content/themes/acme';
const PLUGIN = 'wp-content/plugins/acme-plugin';
let graph: CodeGraph;
let plugin: CodeGraph;
let plain: CodeGraph;

beforeAll(async () => {
    ({ graph } = await buildFromRepo(path.join(FIXTURES, 'site'), null));
    ({ graph: plugin } = await buildFromRepo(path.join(FIXTURES, 'plugin'), null));
    ({ graph: plain } = await buildFromRepo(path.join(FIXTURES, 'plain'), null));
});

const routesTo = (g: CodeGraph, label: string): string[] => {
    const route = g.nodes.find((n) => n.kind === 'route' && n.label === label);
    return route ? g.edges.filter((e) => e.source === route.id && e.relation === 'routes-to').map((e) => e.target) : ['<no route>'];
};
const renders = (source: string): string[] =>
    graph.edges.filter((e) => e.source === source && e.relation === 'renders').map((e) => e.target).sort();

describe('wordpress provider', () => {
    it('detects wordpress from the wp-config.php marker, and only wordpress', () => {
        expect(graph.providers?.map((p) => p.id)).toEqual(['wordpress']);
    });

    it('detects a plugin repo by its composer type', () => {
        expect(plugin.providers?.map((p) => p.id)).toEqual(['wordpress']);
        expect(routesTo(plugin, 'HOOK init')).toEqual(['widget.php#widget_boot']);
    });

    it('stays inactive with no marker and no WordPress manifest', () => {
        expect(plain.providers ?? []).toEqual([]);
        expect(plain.nodes.some((n) => n.kind === 'route')).toBe(false);
    });

    it('does not activate on a Laravel manifest, nor Laravel on a WordPress one', () => {
        const laravel = { manifests: new Map([['composer.json', '{"require":{"laravel/framework":"^11"}}']]), markers: new Set(['artisan']), paths: [] };
        const wp = { manifests: new Map([['composer.json', '{"require":{"johnpbloch/wordpress":"^6"}}']]), markers: new Set<string>(), paths: [] };
        expect(activeProviders(laravel).map((a) => a.provider.id)).toEqual(['laravel']);
        expect(activeProviders(wp).map((a) => a.provider.id)).toEqual(['wordpress']);
    });

    it('routes actions, filters and shortcodes to same-file function callbacks', () => {
        expect(routesTo(graph, 'HOOK init')).toEqual([`${THEME}/functions.php#acme_register_types`]);
        expect(routesTo(graph, 'HOOK the_content')).toEqual([`${THEME}/functions.php#acme_filter_content`]);
        expect(routesTo(graph, 'SHORTCODE card')).toEqual([`${THEME}/functions.php#acme_card_shortcode`]);
    });

    it('routes [$this, m] and array($this, m) to the enclosing class, never a same-named method elsewhere', () => {
        expect(routesTo(graph, 'HOOK admin_menu')).toEqual([`${PLUGIN}/acme-plugin.php#Plugin::boot`]);
        expect(routesTo(graph, 'HOOK save_post')).toEqual([`${PLUGIN}/acme-plugin.php#Plugin::save`]);
    });

    it('routes [X::class, m] to the class the namespace names, not its namesake', () => {
        expect(routesTo(graph, 'HOOK rest_api_init')).toEqual([`${PLUGIN}/src/Routes.php#Routes::register`]);
    });

    it('resolves a unique function in another file, and none when the name is ambiguous', () => {
        expect(routesTo(graph, 'HOOK plugins_loaded')).toEqual([`${PLUGIN}/helpers.php#acme_shared_helper`]);
        expect(routesTo(graph, 'HOOK shutdown')).toEqual([]);
    });

    it('declares a closure hook with no target, and reads neither do_action nor a cache lookup as one', () => {
        expect(routesTo(graph, 'HOOK wp_footer')).toEqual([]);
        expect(graph.nodes.some((n) => n.kind === 'route' && /acme_loaded|\/init/.test(n.label))).toBe(false);
    });

    it('renders template parts from the calling theme, with the name variant, and nothing for a missing part', () => {
        expect(renders(`${THEME}/functions.php#acme_card_shortcode`)).toEqual([`${THEME}/parts/card-wide.php`, `${THEME}/parts/card.php`]);
        expect(graph.edges.some((e) => e.relation === 'renders' && e.target.startsWith('wp-content/themes/other/'))).toBe(false);
    });

    it('stamps its edges and keeps the graph valid', () => {
        const mine = graph.edges.filter((e) => e.relation === 'routes-to' || e.relation === 'renders');
        expect(mine.length).toBeGreaterThan(0);
        expect(mine.every((e) => e.provider_id === 'wordpress')).toBe(true);
        expect(validateGraph(JSON.parse(JSON.stringify(graph))).ok).toBe(true);
    });
});
