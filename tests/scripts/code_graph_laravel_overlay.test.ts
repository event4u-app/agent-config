import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildFromRepo } from '../../src/scripts/code_graph/build.js';
import { buildMapModel } from '../../src/scripts/code_graph/map_model.js';
import type { CodeGraph } from '../../src/scripts/code_graph/types.js';
import { validateGraph } from '../../src/scripts/code_graph/validate.js';

let root: string;
let graph: CodeGraph;

function write(rel: string, body: string): void {
    const p = path.join(root, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, body);
}

const has = (source: string, relation: string, target: string): boolean =>
    graph.edges.some((e) => e.source === source && e.relation === relation && e.target === target);

beforeAll(async () => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-laravel-')));
    write(
        'composer.json',
        JSON.stringify({ require: { 'laravel/framework': '^11.0' }, autoload: { 'psr-4': { 'App\\': 'app/' } } }),
    );
    write(
        'routes/web.php',
        [
            '<?php',
            'use App\\Http\\Controllers\\BookController;',
            'use App\\Http\\Controllers as C;',
            "Route::get('/books', [BookController::class, 'index'])->name('books.index');",
            "Route::prefix('admin')->middleware('auth')->group(function () {",
            "    Route::get('/users', [C\\Admin\\UserController::class, 'list'])->middleware('can:admin');",
            '});',
            "Route::get('/ping', function () { return 'pong'; });",
            "Route::get('/legacy', 'LegacyController@show');",
            "Route::resource('photos', C\\PhotoController::class);",
            '',
        ].join('\n'),
    );
    write(
        'app/Http/Controllers/BookController.php',
        "<?php\nnamespace App\\Http\\Controllers;\nuse App\\Models\\Book;\nclass BookController {\n    public function index() {\n        return view('books.index', ['books' => Book::all()]);\n    }\n}\n",
    );
    // Same method name in another namespace: a route must not land here.
    write(
        'app/Http/Other/BookController.php',
        "<?php\nnamespace App\\Http\\Other;\nclass BookController {\n    public function index() { return 1; }\n}\n",
    );
    write(
        'app/Http/Controllers/Admin/UserController.php',
        "<?php\nnamespace App\\Http\\Controllers\\Admin;\nclass UserController {\n    public function list() { return view('users.list'); }\n}\n",
    );
    write(
        'app/Http/Controllers/PhotoController.php',
        "<?php\nnamespace App\\Http\\Controllers;\nclass PhotoController {\n    public function index() { return 1; }\n    public function store() { return 2; }\n}\n",
    );
    // An unrelated in-repo `middleware()`: name lookup used to bind the
    // routes file's fluent `->middleware()` to it.
    write(
        'app/Support/Permission.php',
        '<?php\nnamespace App\\Support;\nclass Permission {\n    public static function middleware() { return []; }\n}\n',
    );
    write(
        'app/Models/Book.php',
        "<?php\nnamespace App\\Models;\nuse Illuminate\\Database\\Eloquent\\Model;\nclass Book extends Model {\n    public function chapters() { return $this->hasMany(Chapter::class); }\n}\n",
    );
    write(
        'app/Models/Chapter.php',
        "<?php\nnamespace App\\Models;\nuse Illuminate\\Database\\Eloquent\\Model;\nclass Chapter extends Model {\n    protected $table = 'book_chapters';\n    public function label() { return config('app.name') . __('books.title'); }\n}\n",
    );
    write(
        'database/migrations/2024_01_01_000000_create_books.php',
        "<?php\nreturn new class {\n    public function up() {\n        Schema::create('books', function ($t) {});\n        Schema::create('book_chapters', function ($t) {});\n        Schema::create('entities', function ($t) {});\n        Schema::create('shelves', function ($t) {});\n    }\n};\n",
    );
    // Single-table inheritance: the abstract parent names the table, the
    // children inherit it — the convention (`shelves`) must not win.
    write(
        'app/Models/Entity.php',
        "<?php\nnamespace App\\Models;\nuse Illuminate\\Database\\Eloquent\\Model;\nabstract class Entity extends Model {\n    protected $table = 'entities';\n}\n",
    );
    write('app/Models/Shelf.php', "<?php\nnamespace App\\Models;\nclass Shelf extends Entity {\n}\n");
    write('config/app.php', "<?php\nreturn ['name' => 'x'];\n");
    write('lang/en/books.php', "<?php\nreturn ['title' => 'Books'];\n");
    write('lang/de/books.php', "<?php\nreturn ['title' => 'Bücher'];\n");
    write('resources/views/layouts/app.blade.php', '<html>@yield("content")</html>\n');
    write('resources/views/books/row.blade.php', '<li>{{ $book }}</li>\n');
    write('resources/views/components/alert.blade.php', '<div class="alert"></div>\n');
    write('resources/views/users/list.blade.php', "@extends('layouts.app')\n");
    write(
        'resources/views/books/index.blade.php',
        "@extends('layouts.app')\n@section('content')\n@include('books.row')\n<x-alert />\n{{ __('books.title') }}\n@include('books.' . $kind)\n@endsection\n",
    );
    ({ graph } = await buildFromRepo(root, null));
});

afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

describe('routes (4.1)', () => {
    it('resolves the array handler through the `use` alias to the method, not to a same-named one elsewhere', () => {
        const route = 'routes/web.php#route:GET /books';
        expect(has(route, 'routes-to', 'app/Http/Controllers/BookController.php#BookController::index')).toBe(true);
        expect(graph.edges.some((e) => e.source === route && e.target.startsWith('app/Http/Other/'))).toBe(false);
    });

    it('applies a group prefix and a namespace alias with a sub-namespace', () => {
        expect(
            has('routes/web.php#route:GET /admin/users', 'routes-to', 'app/Http/Controllers/Admin/UserController.php#UserController::list'),
        ).toBe(true);
    });

    it('expands a resource to the methods its controller declares', () => {
        expect(has('routes/web.php#route:GET /photos', 'routes-to', 'app/Http/Controllers/PhotoController.php#PhotoController::index')).toBe(true);
        expect(has('routes/web.php#route:POST /photos', 'routes-to', 'app/Http/Controllers/PhotoController.php#PhotoController::store')).toBe(true);
    });

    it('records a closure and a string handler as routes without guessing a target', () => {
        for (const r of ['routes/web.php#route:GET /ping', 'routes/web.php#route:GET /legacy']) {
            expect(graph.nodes.some((n) => n.id === r && n.kind === 'route')).toBe(true);
            expect(graph.edges.some((e) => e.source === r && e.relation === 'routes-to')).toBe(false);
        }
    });

    it('never binds a fluent route-builder call to an in-repo method of the same name', () => {
        const bad = graph.edges.filter(
            (e) => e.target === 'app/Support/Permission.php#Permission::middleware' && e.relation === 'calls',
        );
        expect(bad).toEqual([]);
        expect(graph.suppressed_edge_counts.route_builder_call ?? 0).toBeGreaterThan(0);
    });
});

describe('views (4.2)', () => {
    it('links the method that renders a view to its Blade file', () => {
        expect(has('app/Http/Controllers/BookController.php#BookController::index', 'renders', 'resources/views/books/index.blade.php')).toBe(true);
    });

    it('links Blade directives and components to the included files, and skips a name built at runtime', () => {
        const from = 'resources/views/books/index.blade.php';
        expect(has(from, 'includes', 'resources/views/layouts/app.blade.php')).toBe(true);
        expect(has(from, 'includes', 'resources/views/books/row.blade.php')).toBe(true);
        expect(has(from, 'includes', 'resources/views/components/alert.blade.php')).toBe(true);
        expect(graph.edges.filter((e) => e.source === from && e.relation === 'includes')).toHaveLength(3);
    });

    it('links translation and config reads to their files', () => {
        expect(has('resources/views/books/index.blade.php', 'reads', 'lang/en/books.php')).toBe(true);
        expect(has('resources/views/books/index.blade.php', 'reads', 'lang/de/books.php')).toBe(true);
        expect(has('app/Models/Chapter.php#Chapter::label', 'reads', 'config/app.php')).toBe(true);
    });
});

describe('data (4.3)', () => {
    it('creates a table node per migrated table and links models by convention or $table', () => {
        expect(has('database/migrations/2024_01_01_000000_create_books.php', 'migrates', 'table:books')).toBe(true);
        expect(has('app/Models/Book.php#Book', 'persists', 'table:books')).toBe(true);
        expect(has('app/Models/Chapter.php#Chapter', 'persists', 'table:book_chapters')).toBe(true);
    });

    it('follows an inherited $table instead of the naming convention', () => {
        expect(has('app/Models/Shelf.php#Shelf', 'persists', 'table:entities')).toBe(true);
        expect(has('app/Models/Shelf.php#Shelf', 'persists', 'table:shelves')).toBe(false);
    });

    it('links an Eloquent relation method to the related model', () => {
        expect(has('app/Models/Book.php#Book::chapters', 'relates', 'app/Models/Chapter.php#Chapter')).toBe(true);
    });

    it('keeps the graph schema-valid with the new relations and kinds', () => {
        expect(validateGraph(JSON.parse(JSON.stringify(graph))).ok).toBe(true);
    });
});

describe('the request path on the map (4.4)', () => {
    it('chains route → handler → view → table', () => {
        const m = buildMapModel(graph);
        const r = m.analyses.requestPaths.find((x) => x.route === 'GET /books');
        expect(r).toBeDefined();
        expect(m.files[r?.handler ?? -1]?.path).toBe('app/Http/Controllers/BookController.php');
        expect(r?.views.map((v) => m.files[v]?.path)).toEqual(['resources/views/books/index.blade.php']);
        expect(r?.tables).toEqual(['books']);
    });
});
