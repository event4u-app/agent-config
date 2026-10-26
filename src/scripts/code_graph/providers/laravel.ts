/**
 * The Laravel overlay: the links a Laravel project makes by convention, which
 * the PHP extractor cannot see because no import or call states them.
 *
 *   routes/*.php   Route::get('/x', [C::class, 'm'])   → route node --routes-to--> C::m
 *   C::m           view('a.b')                         --renders-->   resources/views/a/b.blade.php
 *   a.blade.php    @include('c') · <x-d>               --includes-->  the included view file
 *   any PHP        __('file.key') · config('app.x')    --reads-->     lang/* /file.php · config/app.php
 *   migration      Schema::create('t')                 --migrates-->  table node `table:t`
 *   Model class    $table / naming convention          --persists-->  table node
 *   Model method   $this->hasMany(Other::class)        --relates-->   Other
 *
 * Every link is read off the source text by rule, and is emitted only when its
 * target exists in the tree: a missing edge is preferred to a wrong one. What a
 * rule cannot settle — a closure handler, a view name built at runtime — is
 * counted in `stats`, never guessed.
 */
import * as path from 'node:path';

import type { SourceFile } from '../build.js';
import type { FileRole } from '../map_model.js';
import { psr4RulesFrom, resolvePsr4, type ResolutionConfig } from '../resolution_tiers.js';
import { readLaravelSchema } from '../../_lib/schema/readers/laravel_migrations.js';
import { isFixturePath } from '../fixture_paths.js';
import { replay, tableMap } from '../../_lib/schema/replay.js';
import { spanHash } from '../lanes/lane_fact.js';
import type { CodeEdge, CodeNode, FactMeta } from '../types.js';
import { columnId, schemaGraph, tableId } from './shared/schema_graph.js';
import type { ConventionProvider, ProjectProbe } from './types.js';

export interface LaravelOverlayStats {
    routes: number;
    routesResolved: number;
    routeClosures: number;
    routeStringHandlers: number;
    routesUnresolved: number;
    views: number;
    viewsResolved: number;
    viewsDynamic: number;
    includes: number;
    includesResolved: number;
    tables: number;
    models: number;
    relations: number;
    reads: number;
    builderCallsDropped: number;
}

export interface LaravelOverlay {
    nodes: CodeNode[];
    edges: CodeEdge[];
    /** Edges of the base graph the overlay proves false (fluent route-builder calls). */
    dropEdge: (e: CodeEdge) => boolean;
    stats: LaravelOverlayStats;
}

const VERBS = ['get', 'post', 'put', 'patch', 'delete', 'options', 'any'] as const;
const RESOURCE_METHODS: Record<string, Array<[string, string, string]>> = {
    resource: [
        ['GET', '', 'index'],
        ['GET', '/create', 'create'],
        ['POST', '', 'store'],
        ['GET', '/{id}', 'show'],
        ['GET', '/{id}/edit', 'edit'],
        ['PUT', '/{id}', 'update'],
        ['DELETE', '/{id}', 'destroy'],
    ],
    apiResource: [
        ['GET', '', 'index'],
        ['POST', '', 'store'],
        ['GET', '/{id}', 'show'],
        ['PUT', '/{id}', 'update'],
        ['DELETE', '/{id}', 'destroy'],
    ],
};
/** Methods of Laravel's route builder; a call to one is never an in-repo method. */
const ROUTE_BUILDER_METHODS = new Set([
    'middleware',
    'withoutMiddleware',
    'prefix',
    'name',
    'as',
    'group',
    'where',
    'whereNumber',
    'whereAlpha',
    'whereUuid',
    'domain',
    'controller',
    'namespace',
    'scopeBindings',
    'withoutScopedBindings',
    'missing',
    'can',
]);
/** The framework's own model base classes, by fully-qualified name; an app class's name never makes a model. */
const MODEL_BASES = new Set([
    'Illuminate\\Database\\Eloquent\\Model',
    'Illuminate\\Foundation\\Auth\\User',
    'Illuminate\\Database\\Eloquent\\Relations\\Pivot',
    'Illuminate\\Database\\Eloquent\\Relations\\MorphPivot',
]);
const FACADES = 'App Artisan Auth Blade Broadcast Bus Cache Config Cookie Crypt Date DB Event File Gate Hash Http Lang Log Mail Notification Password Process Queue RateLimiter Redirect Redis Request Response Route Schema Session Storage URL Validator View';
/** Static receivers that leave the repository: the framework's facades (and their global aliases) and common SDK clients. */
const HELD_RECEIVERS: readonly string[] = [
    ...FACADES.split(' ').flatMap((n) => [`Illuminate\\Support\\Facades\\${n}`, n]),
    'GuzzleHttp\\Client',
    'SoapClient',
    'Stripe\\Stripe',
    'Stripe\\StripeClient',
    'Aws\\S3\\S3Client',
    'Twilio\\Rest\\Client',
];
const RELATION_METHODS =
    'hasOne|hasMany|belongsTo|belongsToMany|hasOneThrough|hasManyThrough|morphOne|morphMany|morphToMany|morphedByMany';

/** Line-start offsets, so many `lineAt` lookups stay linear. */
function lineIndex(src: string): (index: number) => number {
    const starts = [0];
    for (let i = 0; i < src.length; i++) if (src.charCodeAt(i) === 10) starts.push(i + 1);
    return (index: number): number => {
        let lo = 0;
        let hi = starts.length - 1;
        while (lo < hi) {
            const mid = (lo + hi + 1) >> 1;
            if ((starts[mid] as number) <= index) lo = mid;
            else hi = mid - 1;
        }
        return lo + 1;
    };
}

/** Offset of the `}` that closes the `{` at `open`, skipping strings and comments. */
function matchingBrace(src: string, open: number): number {
    let depth = 0;
    for (let i = open; i < src.length; i++) {
        const c = src[i];
        if (c === "'" || c === '"') {
            const q = c;
            for (i += 1; i < src.length && src[i] !== q; i++) if (src[i] === '\\') i += 1;
            continue;
        }
        if (c === '/' && src[i + 1] === '/') {
            while (i < src.length && src[i] !== '\n') i += 1;
            continue;
        }
        if (c === '/' && src[i + 1] === '*') {
            const end = src.indexOf('*/', i + 2);
            i = end < 0 ? src.length : end + 1;
            continue;
        }
        if (c === '{') depth += 1;
        else if (c === '}') {
            depth -= 1;
            if (depth === 0) return i;
        }
    }
    return src.length;
}

interface PhpScope {
    namespace: string;
    uses: Map<string, string>;
}

function phpScope(src: string): PhpScope {
    const ns = /^\s*namespace\s+([\\\w]+)\s*;/m.exec(src)?.[1] ?? '';
    const uses = new Map<string, string>();
    for (const m of src.matchAll(/^\s*use\s+([\\\w]+)(?:\s+as\s+(\w+))?\s*;/gm)) {
        const fq = (m[1] as string).replace(/^\\/, '');
        const alias = m[2] ?? fq.split('\\').pop() ?? fq;
        uses.set(alias, fq);
    }
    return { namespace: ns, uses };
}

/** Fully-qualified name of a class reference as written in a file. */
function qualify(ref: string, scope: PhpScope): string {
    if (ref.startsWith('\\')) return ref.slice(1);
    const [head, ...rest] = ref.split('\\');
    const aliased = scope.uses.get(head as string);
    if (aliased) return [aliased, ...rest].join('\\');
    return scope.namespace ? `${scope.namespace}\\${ref}` : ref;
}

function shortName(fq: string): string {
    return fq.split('\\').pop() ?? fq;
}

function snakePlural(name: string): string {
    const snake = name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
    if (/[^aeiou]y$/.test(snake)) return `${snake.slice(0, -1)}ies`;
    if (/(s|x|z|ch|sh)$/.test(snake)) return `${snake}es`;
    return `${snake}s`;
}

function isMigrationPath(p: string): boolean {
    return /(^|\/)migrations\//.test(p);
}

/** Offset of the `]` closing the `[` at `open`, skipping quoted strings; -1 when unbalanced. */
function matchingBracket(src: string, open: number): number {
    let depth = 0;
    for (let i = open; i < src.length; i++) {
        const c = src[i];
        if (c === "'" || c === '"') {
            for (i += 1; i < src.length && src[i] !== c; i++) if (src[i] === '\\') i += 1;
            continue;
        }
        if (c === '[') depth += 1;
        else if (c === ']') {
            depth -= 1;
            if (depth === 0) return i;
        }
    }
    return -1;
}

function snake(name: string): string {
    return name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}

/** Quoted string arguments in the text after a relation's `X::class`. */
function stringArgs(rest: string): string[] {
    return [...rest.matchAll(/'([^']*)'|"([^"]*)"/g)].map((m) => (m[1] ?? m[2]) as string);
}

interface RelationShape {
    kind: '1:1' | '1:n' | 'n:1' | 'n:m' | 'polymorphic';
    /** The join column, by the framework's naming rule unless the call names it. */
    key: string;
    /** Which table carries `key`: the declaring model's, the related model's, or the pivot. */
    keyOn: 'own' | 'target' | 'pivot' | 'none';
    pivot?: string;
}

/** Cardinality and join key of one relation call, by the framework's own defaults. */
function relationShape(call: string, own: string, target: string, method: string, args: string[]): RelationShape {
    const ownKey = `${snake(own)}_id`;
    switch (call) {
        case 'hasOne':
            return { kind: '1:1', key: args[0] ?? ownKey, keyOn: 'target' };
        case 'hasMany':
            return { kind: '1:n', key: args[0] ?? ownKey, keyOn: 'target' };
        case 'belongsTo':
            return { kind: 'n:1', key: args[0] ?? `${snake(method)}_id`, keyOn: 'own' };
        case 'belongsToMany':
            return { kind: 'n:m', key: args[1] ?? ownKey, keyOn: 'pivot', pivot: args[0] ?? [snake(own), snake(target)].sort().join('_') };
        case 'hasOneThrough':
            return { kind: '1:1', key: args[0] ?? ownKey, keyOn: 'none' };
        case 'hasManyThrough':
            return { kind: '1:n', key: args[0] ?? ownKey, keyOn: 'none' };
        case 'morphOne':
        case 'morphMany':
            return { kind: 'polymorphic', key: `${args[0] ?? snake(method)}_id`, keyOn: 'target' };
        default:
            return { kind: 'polymorphic', key: `${args[0] ?? snake(method)}_id`, keyOn: 'pivot', pivot: args[1] ?? snakePlural(args[0] ?? method) };
    }
}

export function buildLaravelOverlay(
    files: readonly SourceFile[],
    baseNodes: readonly CodeNode[],
    resolution: ResolutionConfig,
    /** The package root with a trailing slash (`''` at the repository root). */
    prefix = '',
): LaravelOverlay {
    const stats: LaravelOverlayStats = {
        routes: 0,
        routesResolved: 0,
        routeClosures: 0,
        routeStringHandlers: 0,
        routesUnresolved: 0,
        views: 0,
        viewsResolved: 0,
        viewsDynamic: 0,
        includes: 0,
        includesResolved: 0,
        tables: 0,
        models: 0,
        relations: 0,
        reads: 0,
        builderCallsDropped: 0,
    };
    const fileIds = new Set(files.map((f) => f.path));
    const nodeById = new Map(baseNodes.map((n) => [n.id, n] as const));
    const nodes: CodeNode[] = [];
    const edges: CodeEdge[] = [];
    const seenEdge = new Set<string>();
    const emit = (source: string, target: string, relation: CodeEdge['relation'], via: CodeEdge['resolved_via'], fact?: FactMeta): void => {
        const key = `${source}\0${relation}\0${target}`;
        if (seenEdge.has(key)) return;
        seenEdge.add(key);
        edges.push({ source, target, relation, confidence: 'EXTRACTED', resolved_via: via, provider: 'native', ...(fact ? { fact } : {}) });
    };

    // Innermost function/method node per file, by line, for attributing a
    // `view()` or `__()` call to the symbol that makes it.
    const symbolsByFile = new Map<string, CodeNode[]>();
    for (const n of baseNodes) {
        if (n.kind !== 'method' && n.kind !== 'function') continue;
        const list = symbolsByFile.get(n.source_file) ?? [];
        list.push(n);
        symbolsByFile.set(n.source_file, list);
    }
    const enclosing = (file: string, line: number): string => {
        let best: CodeNode | null = null;
        for (const n of symbolsByFile.get(file) ?? []) {
            const [s, , e] = n.source_location as [number, number, number, number];
            if (s <= line && line <= e && (!best || s >= (best.source_location[0] as number))) best = n;
        }
        return best ? best.id : file;
    };

    const php = files.filter((f) => f.path.endsWith('.php'));
    const blade = (p: string): boolean => p.endsWith('.blade.php');
    const viewFile = (name: string): string | null => {
        if (name.includes('::')) return null;
        const rel = name.replace(/\./g, '/');
        const views = `${prefix}resources/views/`;
        for (const c of [`${views}${rel}.blade.php`, `${views}${rel}.php`, `${views}${rel}/index.blade.php`]) {
            if (fileIds.has(c)) return c;
        }
        return null;
    };
    const classFile = (fq: string): string | null => resolvePsr4(fq, resolution, fileIds);

    // Routes.
    let routeOrdinal = new Map<string, number>();
    for (const f of php.filter((x) => x.path.startsWith(`${prefix}routes/`))) {
        const src = f.source;
        const at = lineIndex(src);
        const scope = phpScope(src);
        routeOrdinal = new Map();
        const groups: Array<{ start: number; end: number; prefix: string }> = [];
        for (const m of src.matchAll(/Route::((?:\w+\((?:[^()]|\([^()]*\))*\)\s*->\s*)*)group\(\s*(?:static\s+)?function\s*\([^)]*\)\s*(?:use\s*\([^)]*\)\s*)?\{/g)) {
            const open = (m.index as number) + m[0].length - 1;
            const prefix = /prefix\(\s*['"]([^'"]*)['"]\s*\)/.exec(m[1] ?? '')?.[1] ?? '';
            groups.push({ start: open, end: matchingBrace(src, open), prefix });
        }
        const prefixAt = (i: number): string =>
            groups
                .filter((g) => g.start < i && i < g.end)
                .map((g) => g.prefix.replace(/^\/|\/$/g, ''))
                .filter(Boolean)
                .join('/');
        const addRoute = (verb: string, uri: string, index: number, target: { fq: string; method: string } | null): void => {
            stats.routes += 1;
            const pre = prefixAt(index);
            const full = `/${[pre, uri.replace(/^\/|\/$/g, '')].filter(Boolean).join('/')}`;
            const base = `${f.path}#route:${verb} ${full}`;
            const n = (routeOrdinal.get(base) ?? 0) + 1;
            routeOrdinal.set(base, n);
            const id = n === 1 ? base : `${base}@${n}`;
            const line = at(index);
            nodes.push({ id, label: `${verb} ${full}`, kind: 'route', source_file: f.path, source_location: [line, 1, line, 1] });
            emit(f.path, id, 'member', 'same-file');
            if (!target) return;
            const file = classFile(target.fq);
            const cls = file ? `${file}#${shortName(target.fq)}` : null;
            const method = cls ? `${cls}::${target.method}` : null;
            if (method && nodeById.has(method)) {
                emit(id, method, 'routes-to', 'route-table');
                stats.routesResolved += 1;
            } else if (cls && nodeById.has(cls)) {
                emit(id, cls, 'routes-to', 'route-table');
                stats.routesResolved += 1;
            } else stats.routesUnresolved += 1;
        };
        const verbRe = new RegExp(`Route::(${VERBS.join('|')})\\(\\s*(['"])(.*?)\\2\\s*,\\s*`, 'g');
        for (const m of src.matchAll(verbRe)) {
            const verb = (m[1] as string).toUpperCase();
            const uri = m[3] as string;
            const rest = src.slice((m.index as number) + m[0].length, (m.index as number) + m[0].length + 300);
            const arr = /^\[\s*([\\\w]+)::class\s*,\s*['"](\w+)['"]\s*\]/.exec(rest);
            const inv = /^([\\\w]+)::class\b/.exec(rest);
            if (arr) addRoute(verb, uri, m.index as number, { fq: qualify(arr[1] as string, scope), method: arr[2] as string });
            else if (inv) addRoute(verb, uri, m.index as number, { fq: qualify(inv[1] as string, scope), method: '__invoke' });
            else if (/^(?:static\s+)?(?:function|fn)\b/.test(rest)) {
                stats.routeClosures += 1;
                addRoute(verb, uri, m.index as number, null);
            } else if (/^['"]/.test(rest)) {
                stats.routeStringHandlers += 1;
                addRoute(verb, uri, m.index as number, null);
            } else addRoute(verb, uri, m.index as number, null);
        }
        for (const m of src.matchAll(/Route::(resource|apiResource)\(\s*(['"])(.*?)\2\s*,\s*([\\\w]+)::class/g)) {
            for (const [verb, suffix, method] of RESOURCE_METHODS[m[1] as string] ?? []) {
                addRoute(verb, `${m[3] as string}${suffix}`, m.index as number, { fq: qualify(m[4] as string, scope), method });
            }
        }
    }

    const langByGroup = new Map<string, string[]>();
    const configByName = new Map<string, string[]>();
    for (const p of [...fileIds].sort()) {
        const lang = /(?:^|\/)lang\/[^/]+\/([\w-]+)\.php$/.exec(p);
        if (lang) langByGroup.set(lang[1] as string, [...(langByGroup.get(lang[1] as string) ?? []), p]);
        const cfg = /(?:^|\/)[Cc]onfig\/([\w-]+)\.php$/.exec(p);
        if (cfg) configByName.set(cfg[1] as string, [...(configByName.get(cfg[1] as string) ?? []), p]);
    }

    // Views rendered from PHP, and the Blade directives between views.
    for (const f of php) {
        const at = lineIndex(f.source);
        if (blade(f.path)) {
            const directives = [
                ...f.source.matchAll(/@(?:extends|include|includeIf|includeUnless|includeFirst|each|component)\(\s*(['"])([\w.\-/]+)\1/g),
                ...f.source.matchAll(/@includeWhen\([^,]+,\s*(['"])([\w.\-/]+)\1/g),
            ];
            for (const m of directives) {
                stats.includes += 1;
                const target = viewFile(m[2] as string);
                if (target && target !== f.path) {
                    emit(f.path, target, 'includes', 'directive-scan');
                    stats.includesResolved += 1;
                }
            }
            for (const m of f.source.matchAll(/<x-([\w\-.]+)/g)) {
                stats.includes += 1;
                const target = viewFile(`components.${m[1] as string}`);
                if (target && target !== f.path) {
                    emit(f.path, target, 'includes', 'directive-scan');
                    stats.includesResolved += 1;
                }
            }
        } else {
            for (const m of f.source.matchAll(/(?:\bview\(|View::make\(|->view\()\s*(['"])([\w.\-/:]+)\1(\s*\.)?/g)) {
                stats.views += 1;
                if (m[3]) {
                    stats.viewsDynamic += 1;
                    continue;
                }
                const target = viewFile(m[2] as string);
                if (!target) continue;
                emit(enclosing(f.path, at(m.index as number)), target, 'renders', 'directive-scan');
                stats.viewsResolved += 1;
            }
        }
        // Translation groups and config files a file reads.
        for (const m of f.source.matchAll(/(?:\b__|\btrans|\btrans_choice|@lang)\(\s*(['"])([\w-]+)\.[\w.\-]+\1/g)) {
            for (const t of langByGroup.get(m[2] as string) ?? []) {
                emit(blade(f.path) ? f.path : enclosing(f.path, at(m.index as number)), t, 'reads', 'directive-scan');
                stats.reads += 1;
            }
        }
        for (const m of f.source.matchAll(/\bconfig\(\s*(['"])([\w-]+)\.[\w.\-]+\1/g)) {
            const targets = configByName.get(m[2] as string) ?? [];
            if (targets.length !== 1) continue;
            emit(blade(f.path) ? f.path : enclosing(f.path, at(m.index as number)), targets[0] as string, 'reads', 'directive-scan');
            stats.reads += 1;
        }
    }

    // Tables and columns, by replaying the migrations in apply order per
    // connection: a table created and later dropped is no node, an index added
    // and later dropped is no index. Migrations in a test, fixture or benchmark
    // tree describe a schema the project ships to its tests, not its own.
    const config = files.find((f) => f.path === `${prefix}config/database.php`)?.source ?? null;
    const schemaRead = readLaravelSchema(php.filter((f) => !isFixturePath(f.path)), config);
    const schema = replay({ ops: schemaRead.ops, engines: schemaRead.engines });
    const schemaFacts = schemaGraph(schema, new Set([...nodeById.keys()]));
    for (const n of schemaFacts.nodes) nodes.push(n);
    for (const e of schemaFacts.edges) emit(e.source, e.target, e.relation, e.resolved_via, e.fact);
    stats.tables = schemaFacts.nodes.filter((n) => n.kind === 'table').length;
    const liveTables = new Map(schema.connections.map((c) => [c.connection, tableMap(c)] as const));
    const connectionOf = (name: string | undefined): string => (!name || name === schemaRead.defaultName ? '' : name);

    // Models: classes whose parent chain reaches a framework model base, by
    // fully-qualified name — `class User extends Authenticatable` is a model
    // because `Authenticatable` imports the framework's `User`, not because of
    // either short name.
    const classDecl = new Map<string, { file: SourceFile; fq: string; parentFq: string; abstract: boolean; scope: PhpScope }>();
    for (const f of php) {
        if (blade(f.path)) continue;
        const scope = phpScope(f.source);
        for (const m of f.source.matchAll(/(abstract\s+)?class\s+(\w+)\s+extends\s+([\\\w]+)/g)) {
            const name = m[2] as string;
            classDecl.set(`${f.path}#${name}`, {
                file: f,
                fq: scope.namespace ? `${scope.namespace}\\${name}` : name,
                parentFq: qualify(m[3] as string, scope),
                abstract: Boolean(m[1]),
                scope,
            });
        }
    }
    const modelFqs = new Set(MODEL_BASES);
    for (let changed = true; changed; ) {
        changed = false;
        for (const d of classDecl.values()) {
            if (!modelFqs.has(d.fq) && modelFqs.has(d.parentFq)) {
                modelFqs.add(d.fq);
                changed = true;
            }
        }
    }
    const isModel = (id: string, d: { fq: string; parentFq: string }): boolean =>
        modelFqs.has(d.parentFq) && !MODEL_BASES.has(d.fq) && nodeById.has(id);
    // `$table` is inherited: a model whose ancestor names its table persists
    // there, and the naming convention applies only when no ancestor names one.
    const byFq = new Map<string, { source: string; parentFq: string }>();
    for (const d of classDecl.values()) byFq.set(d.fq, { source: d.file.source, parentFq: d.parentFq });
    const inheritedTable = (fq: string): string | undefined => {
        const seen = new Set<string>();
        for (let cur: string | undefined = fq; cur && !seen.has(cur); ) {
            seen.add(cur);
            const decl = byFq.get(cur);
            if (!decl) return undefined;
            const own = /protected\s+\$table\s*=\s*['"](\w+)['"]/.exec(decl.source)?.[1];
            if (own) return own;
            cur = decl.parentFq;
        }
        return undefined;
    };
    const inheritedConnection = (fq: string): string => {
        const seen = new Set<string>();
        for (let cur: string | undefined = fq; cur && !seen.has(cur); ) {
            seen.add(cur);
            const decl = byFq.get(cur);
            if (!decl) return '';
            const own = /protected\s+\$connection\s*=\s*['"](\w+)['"]/.exec(decl.source)?.[1];
            if (own) return connectionOf(own);
            cur = decl.parentFq;
        }
        return '';
    };
    /** A model's table: `[connection, name]`, whether or not a migration created it. */
    const modelTable = new Map<string, { connection: string; table: string | null }>();
    for (const [id, d] of classDecl) {
        if (!isModel(id, d)) continue;
        const explicit = inheritedTable(d.fq);
        modelTable.set(id, { connection: inheritedConnection(d.fq), table: explicit ?? (d.abstract ? null : snakePlural(id.split('#')[1] as string)) });
    }
    const columnOf = (connection: string, table: string | null, column: string): string | null => {
        if (!table || !liveTables.get(connection)?.get(table)?.columns.some((c) => c.name === column)) return null;
        return columnId(connection, table, column);
    };
    for (const [id, d] of [...classDecl.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
        if (!isModel(id, d)) continue;
        const name = id.split('#')[1] as string;
        stats.models += 1;
        const own = modelTable.get(id) as { connection: string; table: string | null };
        if (own.table && liveTables.get(own.connection)?.has(own.table)) emit(id, tableId(own.connection, own.table), 'persists', 'schema-call');
        const at = lineIndex(d.file.source);
        for (const m of d.file.source.matchAll(new RegExp(`\\$this->(${RELATION_METHODS})\\(\\s*([\\\\\\w]+)::class([^)]*)\\)`, 'g'))) {
            const fq = qualify(m[2] as string, d.scope);
            const file = classFile(fq);
            const target = file ? `${file}#${shortName(fq)}` : null;
            if (!target || !nodeById.has(target)) continue;
            const offset = m.index as number;
            const source = enclosing(d.file.path, at(offset));
            const method = source.includes('::') ? (source.split('::').pop() as string) : name;
            const shape = relationShape(m[1] as string, name, shortName(fq), method, stringArgs(m[3] ?? ''));
            const line = at(offset);
            const lineText = d.file.source.split('\n')[line - 1] ?? '';
            const relFact: FactMeta = {
                owner: d.file.path,
                witness: { file: d.file.path, line, hash: spanHash(lineText.trim()) },
                rung: 'T1',
                attrs: { kind: shape.kind, method: m[1] as string, key: shape.key, ...(shape.pivot ? { pivot: shape.pivot } : {}) },
            };
            emit(source, target, 'relates', 'orm-relation', relFact);
            stats.relations += 1;
            // The key column the relation joins on, on whichever table holds it.
            const other = modelTable.get(target);
            const keyTable = shape.keyOn === 'own' ? own : shape.keyOn === 'target' ? other : shape.pivot ? { connection: own.connection, table: shape.pivot } : undefined;
            const keyColumn = keyTable ? columnOf(keyTable.connection, keyTable.table, shape.key) : null;
            if (keyColumn) emit(source, keyColumn, 'uses', 'orm-relation', relFact);
        }
    }

    // Which models a method names. A controller imports its models once per
    // file, so a route's tables are read per handler from these edges rather
    // than from the file's `use` lines (which attribute every model of the file
    // to every route the file serves).
    const modelIds = new Set<string>();
    for (const [id, d] of classDecl) if (isModel(id, d)) modelIds.add(id);
    if (modelIds.size > 0) {
        for (const f of php) {
            if (blade(f.path)) continue;
            const scope = phpScope(f.source);
            const lines = f.source.split('\n');
            for (const n of symbolsByFile.get(f.path) ?? []) {
                if (n.kind !== 'method') continue;
                const [s0, , e0] = n.source_location as [number, number, number, number];
                // Strings and comments name words, not classes: `'User not found'` is no reference.
                const body = lines
                    .slice(s0 - 1, e0)
                    .join('\n')
                    .replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|#[^\n[]*$/gm, ' ')
                    .replace(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"/g, "''");
                const own = n.id.split('::')[0];
                for (const token of new Set([...body.matchAll(/\b([A-Z]\w*)\b/g)].map((m) => m[1] as string))) {
                    const fq = qualify(token, scope);
                    const file = classFile(fq);
                    const target = file ? `${file}#${shortName(fq)}` : null;
                    if (!target || target === own || !modelIds.has(target)) continue;
                    emit(n.id, target, 'uses', scope.uses.has(token) ? 'import-specifier' : 'psr4');
                }
            }
        }
    }

    // Columns a query chain on a model names: `Comment::where('post_id', …)`
    // reads `comments.post_id`; `Comment::create(['body' => …])` writes
    // `comments.body`. Only literal column names on a model this tree maps to a
    // replayed table — a dynamic name or an unmapped class draws nothing.
    if (modelTable.size > 0) {
        for (const f of php) {
            if (blade(f.path) || isMigrationPath(f.path)) continue;
            const scope = phpScope(f.source);
            const at = lineIndex(f.source);
            const lines = f.source.split('\n');
            for (const m of f.source.matchAll(/\b([A-Z]\w*)::(?:query\(\)\s*->\s*)?(?=where|whereIn|whereNotIn|whereNull|whereNotNull|firstWhere|orderBy|orderByDesc|pluck|create|insert|updateOrCreate|firstOrCreate)/g)) {
                const fq = qualify(m[1] as string, scope);
                const file = classFile(fq);
                const model = file ? `${file}#${shortName(fq)}` : null;
                const mapped = model ? modelTable.get(model) : undefined;
                if (!mapped?.table) continue;
                const start = m.index as number;
                const end = f.source.indexOf(';', start);
                const stmt = f.source.slice(start, end < 0 ? f.source.length : end);
                const edgeAt = (local: number, relation: 'reads' | 'writes', column: string): void => {
                    const target = columnOf(mapped.connection, mapped.table, column);
                    if (!target) return;
                    const line = at(start + local);
                    emit(enclosing(f.path, line), target, relation, 'schema-call', {
                        owner: f.path,
                        witness: { file: f.path, line, hash: spanHash((lines[line - 1] ?? '').trim()) },
                        rung: 'T1',
                    });
                };
                for (const q of stmt.matchAll(/(?:::|->)\s*(?:where|orWhere|whereIn|whereNotIn|whereNull|whereNotNull|firstWhere|orderBy|orderByDesc|pluck)\(\s*['"](\w+)['"]/g)) {
                    edgeAt(q.index as number, 'reads', q[1] as string);
                }
                for (const w of stmt.matchAll(/(?:::|->)\s*(?:create|insert|update|updateOrCreate|firstOrCreate|fill)\(\s*\[/g)) {
                    const open = (w.index as number) + w[0].length - 1;
                    const close = matchingBracket(stmt, open);
                    for (const k of stmt.slice(open, close < 0 ? stmt.length : close).matchAll(/['"](\w+)['"]\s*=>/g)) {
                        edgeAt(open + (k.index as number), 'writes', k[1] as string);
                    }
                }
            }
        }
    }

    const routesFiles = new Set(php.filter((x) => x.path.startsWith(`${prefix}routes/`)).map((x) => x.path));
    const dropEdge = (e: CodeEdge): boolean => {
        if (e.relation !== 'calls' || e.resolved_via === 'same-file') return false;
        const src = nodeById.get(e.source);
        if (!src) return false;
        // Inside a migration, `$table->index()` and its kin are schema-builder
        // calls; one that name lookup bound to an in-repo method is false.
        if (isMigrationPath(src.source_file) && e.resolved_via === 'dynamic' && !e.target.startsWith('symbol:')) {
            stats.builderCallsDropped += 1;
            return true;
        }
        if (!routesFiles.has(src.source_file)) return false;
        const target = nodeById.get(e.target);
        const name = target ? target.label : e.target.replace(/^symbol:/, '');
        if (!ROUTE_BUILDER_METHODS.has(name)) return false;
        stats.builderCallsDropped += 1;
        return true;
    };

    return { nodes, edges, dropEdge, stats };
}

/** A composer manifest that pulls in the framework or any of its components. */
function requiresLaravel(manifest: string): boolean {
    try {
        const j = JSON.parse(manifest) as { require?: Record<string, string>; 'require-dev'?: Record<string, string> };
        const names = [...Object.keys(j.require ?? {}), ...Object.keys(j['require-dev'] ?? {})];
        return names.some((n) => n === 'laravel/framework' || n.startsWith('illuminate/'));
    } catch {
        return false;
    }
}

function detectLaravel(probe: ProjectProbe): string[] {
    const roots = new Set<string>();
    const dirOf = (p: string): string => {
        const d = path.posix.dirname(p);
        return d === '.' ? '' : d;
    };
    for (const [p, text] of probe.manifests) {
        if (path.posix.basename(p) === 'composer.json' && requiresLaravel(text)) roots.add(dirOf(p));
    }
    for (const p of probe.markers) if (path.posix.basename(p) === 'artisan') roots.add(dirOf(p));
    return [...roots].sort();
}

function laravelRole(p: string): FileRole | undefined {
    if (path.posix.basename(p).endsWith('.blade.php') || p.startsWith('resources/views/') || p.includes('/resources/views/')) return 'view';
    if (p.startsWith('routes/') || p === 'public/index.php' || p === 'artisan') return 'entry';
    return undefined;
}

export const laravelProvider: ConventionProvider = {
    id: 'laravel',
    markers: ['artisan'],
    detect: detectLaravel,
    build: ({ files, baseNodes, resolution, roots, manifests }) => {
        // One overlay per package root: a Laravel app under `backend/` keeps its
        // routes, views and PSR-4 map there, not at the repository root.
        const nodes = new Map<string, CodeNode>();
        const edges = new Map<string, CodeEdge>();
        const contests: Array<(e: CodeEdge) => boolean> = [];
        for (const root of roots) {
            const prefix = root === '' ? '' : `${root}/`;
            let config = resolution;
            if (root !== '') {
                let composer: unknown = null;
                try {
                    composer = JSON.parse(manifests.get(`${prefix}composer.json`) ?? 'null');
                } catch {
                    composer = null;
                }
                const own = psr4RulesFrom(composer).map((r) => ({ ...r, dirs: r.dirs.map((d) => `${prefix}${d}`) }));
                config = { ...resolution, psr4: [...own, ...resolution.psr4] };
            }
            const scoped = root === '' ? files : files.filter((f) => f.path.startsWith(prefix));
            const o = buildLaravelOverlay(scoped, baseNodes, config, prefix);
            for (const n of o.nodes) if (!nodes.has(n.id)) nodes.set(n.id, n);
            for (const e of o.edges) edges.set(`${e.source}\0${e.relation}\0${e.target}`, e);
            contests.push(o.dropEdge);
        }
        return { nodes: [...nodes.values()], edges: [...edges.values()], contest: (e) => contests.some((c) => c(e)) };
    },
    roleOf: laravelRole,
    heldReceivers: HELD_RECEIVERS,
};
