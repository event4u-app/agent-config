/**
 * Roadmap `road-to-a-graph-that-wins` 6.1: a Laravel package registers routes
 * from its own files, loaded by its service provider. The route lane must read
 * them, and a catch inside an action reached only through such a route must
 * sit on an entry path.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { entryPathReading } from '../../src/scripts/_lib/graph_detector_edges.js';
import { buildFromRepo } from '../../src/scripts/code_graph/build.js';
import { loadGraph } from '../../src/scripts/code_graph/query.js';
import type { CodeGraph } from '../../src/scripts/code_graph/types.js';

let root: string;
let graph: CodeGraph;
let graphFile: string;

function write(rel: string, body: string): void {
    const p = path.join(root, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, body);
}

const routesTo = (route: string, target: string): boolean =>
    graph.edges.some((e) => e.source === route && e.relation === 'routes-to' && e.target === target);

const PASSPORT = 'packages/Acme/Passport/src';
const SHOP = 'packages/Acme/Shop/src';

beforeAll(async () => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-laravel-pkg-')));
    write(
        'composer.json',
        JSON.stringify({
            require: { 'laravel/framework': '^11.0' },
            autoload: { 'psr-4': { 'App\\': 'app/', 'Acme\\Passport\\': `${PASSPORT}/`, 'Acme\\Shop\\': `${SHOP}/` } },
        }),
    );
    write('routes/web.php', "<?php\nRoute::get('/', function () { return 'home'; });\n");

    // Form 1: loadRoutesFrom, with a controller group and string handlers.
    write(
        `${PASSPORT}/Providers/PassportServiceProvider.php`,
        "<?php\nnamespace Acme\\Passport\\Providers;\nclass PassportServiceProvider extends ServiceProvider {\n    public function boot(): void {\n        $this->loadRoutesFrom(__DIR__.'/../Routes/admin.php');\n    }\n}\n",
    );
    write(
        `${PASSPORT}/Routes/admin.php`,
        [
            '<?php',
            'use Illuminate\\Support\\Facades\\Route;',
            'use Acme\\Passport\\Http\\Controllers\\PublicationController;',
            "Route::group(['middleware' => ['admin']], function (): void {",
            "    Route::controller(PublicationController::class)->prefix('catalog/passports')->group(function (): void {",
            "        Route::post('reinstate/{publication}', 'reinstate')->name('admin.catalog.passports.reinstate');",
            "        Route::get('', 'index');",
            '    });',
            '});',
            '',
        ].join('\n'),
    );
    write(
        `${PASSPORT}/Http/Controllers/PublicationController.php`,
        [
            '<?php',
            'namespace Acme\\Passport\\Http\\Controllers;',
            'class PublicationController {',
            "    public function index() { return view('passport::catalog.index'); }",
            '    public function reinstate($publication) {',
            '        try {',
            '            return $publication->reinstate();',
            '        } catch (\\Throwable $e) {',
            '        }',
            '    }',
            '}',
            '',
        ].join('\n'),
    );

    // Form 2: Route::...->group(__DIR__ path), whose file `require`s another.
    write(
        `${SHOP}/Providers/ShopServiceProvider.php`,
        "<?php\nnamespace Acme\\Shop\\Providers;\nclass ShopServiceProvider extends ServiceProvider {\n    public function boot(): void {\n        Route::middleware('web')\n            ->group(__DIR__.'/../Routes/web.php');\n    }\n}\n",
    );
    write(`${SHOP}/Routes/web.php`, "<?php\nrequire 'cart-routes.php';\n");
    write(
        `${SHOP}/Routes/cart-routes.php`,
        "<?php\nuse Acme\\Shop\\Http\\CartController;\nRoute::get('cart', [CartController::class, 'show']);\n",
    );
    write(`${SHOP}/Http/CartController.php`, "<?php\nnamespace Acme\\Shop\\Http;\nclass CartController {\n    public function show() { return 1; }\n}\n");

    // 6.2: package views by namespace, an anonymous component path, inline script in a component.
    write(
        `${PASSPORT}/Providers/PassportViewServiceProvider.php`,
        "<?php\nnamespace Acme\\Passport\\Providers;\nclass PassportViewServiceProvider extends ServiceProvider {\n    public function boot(): void {\n        $this->loadViewsFrom(__DIR__.'/../Resources/views', 'passport');\n        Blade::anonymousComponentPath(__DIR__.'/../Resources/views/components', 'passport');\n    }\n}\n",
    );
    write(`${PASSPORT}/Resources/views/catalog/index.blade.php`, "<div>\n    <x-passport::datagrid.table />\n    @include('passport::catalog.partials.footer')\n</div>\n");
    write(`${PASSPORT}/Resources/views/catalog/partials/footer.blade.php`, '<footer></footer>\n');
    write(
        `${PASSPORT}/Resources/views/components/datagrid/table.blade.php`,
        ['<table></table>', '<script>', '    function load() {', '        try {', '            fetch("/x");', '        } catch (e) {', '        }', '    }', '</script>', ''].join('\n'),
    );
    write(`${PASSPORT}/Resources/views/components/orphan.blade.php`, ['<script>', 'try { x(); } catch (e) {}', '</script>', ''].join('\n'));
    write('public/build/assets/app-abc123.js', 'function a(){try{b()}catch(e){}}\n');

    // Never loaded by anything: must stay out of the route table.
    write(`${SHOP}/Routes/orphan.php`, "<?php\nuse Acme\\Shop\\Http\\CartController;\nRoute::get('orphan', [CartController::class, 'show']);\n");

    ({ graph } = await buildFromRepo(root, null));
    graphFile = path.join(root, 'graph.json');
    fs.writeFileSync(graphFile, JSON.stringify(graph));
});

afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

describe('package route files (6.1)', () => {
    it('reads a route file a provider loads with loadRoutesFrom, resolving a controller-group string handler', () => {
        const route = `${PASSPORT}/Routes/admin.php#route:POST /catalog/passports/reinstate/{publication}`;
        expect(graph.nodes.some((n) => n.id === route && n.kind === 'route')).toBe(true);
        expect(routesTo(route, `${PASSPORT}/Http/Controllers/PublicationController.php#PublicationController::reinstate`)).toBe(true);
    });

    it('reads a route file passed to a group by path, and the file it requires', () => {
        const route = `${SHOP}/Routes/cart-routes.php#route:GET /cart`;
        expect(routesTo(route, `${SHOP}/Http/CartController.php#CartController::show`)).toBe(true);
    });

    it('leaves a route file nothing loads out of the route table', () => {
        expect(graph.nodes.some((n) => n.source_file === `${SHOP}/Routes/orphan.php` && n.kind === 'route')).toBe(false);
    });

    it('puts a catch inside a package-routed action on an entry path', () => {
        const g = loadGraph(graphFile);
        const r = entryPathReading(g, `${PASSPORT}/Http/Controllers/PublicationController.php`, 8);
        expect(r.graph).toBe('fire');
        expect(r.edges.some((e) => e.relation === 'routes-to')).toBe(true);
    });
});

describe('catches with no enclosing declaration (6.2)', () => {
    const VIEWS = `${PASSPORT}/Resources/views`;
    const INDEX = `${PASSPORT}/Http/Controllers/PublicationController.php#PublicationController::index`;

    it('resolves namespaced views, namespaced includes and anonymous components', () => {
        const has = (s: string, rel: string, t: string): boolean => graph.edges.some((e) => e.source === s && e.relation === rel && e.target === t);
        expect(has(INDEX, 'renders', `${VIEWS}/catalog/index.blade.php`)).toBe(true);
        expect(has(`${VIEWS}/catalog/index.blade.php`, 'includes', `${VIEWS}/components/datagrid/table.blade.php`)).toBe(true);
        expect(has(`${VIEWS}/catalog/index.blade.php`, 'includes', `${VIEWS}/catalog/partials/footer.blade.php`)).toBe(true);
    });

    it('reads a catch in a rendered template from the template, up to the route', () => {
        const g = loadGraph(graphFile);
        const r = entryPathReading(g, `${VIEWS}/components/datagrid/table.blade.php`, 6);
        expect(r.graph).toBe('fire');
        expect(r.edges.map((e) => e.relation)).toEqual(expect.arrayContaining(['includes', 'renders', 'routes-to']));
    });

    it('answers nothing for a template nothing renders or includes, nor for a compiled bundle', () => {
        const g = loadGraph(graphFile);
        expect(entryPathReading(g, `${VIEWS}/components/orphan.blade.php`, 2).graph).toBe(null);
        expect(entryPathReading(g, 'public/build/assets/app-abc123.js', 1).graph).toBe(null);
    });
});
