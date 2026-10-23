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
import type { SourceFile } from './build.js';
import { resolvePsr4, type ResolutionConfig } from './resolution_tiers.js';
import type { CodeEdge, CodeNode } from './types.js';

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
const MODEL_BASES = new Set(['Model', 'Authenticatable', 'Pivot', 'MorphPivot', 'User']);
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

export function buildLaravelOverlay(
    files: readonly SourceFile[],
    baseNodes: readonly CodeNode[],
    resolution: ResolutionConfig,
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
    const emit = (source: string, target: string, relation: CodeEdge['relation'], via: CodeEdge['resolved_via']): void => {
        const key = `${source}\0${relation}\0${target}`;
        if (seenEdge.has(key)) return;
        seenEdge.add(key);
        edges.push({ source, target, relation, confidence: 'EXTRACTED', resolved_via: via, provider: 'native' });
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
        for (const c of [`resources/views/${rel}.blade.php`, `resources/views/${rel}.php`, `resources/views/${rel}/index.blade.php`]) {
            if (fileIds.has(c)) return c;
        }
        return null;
    };
    const classFile = (fq: string): string | null => resolvePsr4(fq, resolution, fileIds);

    // Routes.
    let routeOrdinal = new Map<string, number>();
    for (const f of php.filter((x) => x.path.startsWith('routes/'))) {
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

    // Tables, from the migrations that create or change them.
    const tableNodes = new Map<string, string>();
    const migrations = php.filter((f) => /(^|\/)migrations\//.test(f.path)).sort((a, b) => (a.path < b.path ? -1 : 1));
    for (const f of migrations) {
        const at = lineIndex(f.source);
        for (const m of f.source.matchAll(/Schema::(create|table)\(\s*(['"])(\w+)\2/g)) {
            const table = m[3] as string;
            let id = tableNodes.get(table);
            if (!id) {
                id = `table:${table}`;
                tableNodes.set(table, id);
                const line = at(m.index as number);
                nodes.push({ id, label: table, kind: 'table', source_file: f.path, source_location: [line, 1, line, 1] });
                stats.tables += 1;
            }
            emit(f.path, id, 'migrates', 'schema-call');
        }
    }

    // Models: classes whose parent chain reaches an Eloquent base, by short name.
    const classDecl = new Map<string, { file: SourceFile; parent: string; abstract: boolean; scope: PhpScope }>();
    for (const f of php) {
        if (blade(f.path)) continue;
        const scope = phpScope(f.source);
        for (const m of f.source.matchAll(/(abstract\s+)?class\s+(\w+)\s+extends\s+([\\\w]+)/g)) {
            classDecl.set(`${f.path}#${m[2] as string}`, {
                file: f,
                parent: shortName(m[3] as string),
                abstract: Boolean(m[1]),
                scope,
            });
        }
    }
    const modelNames = new Set(MODEL_BASES);
    for (let changed = true; changed; ) {
        changed = false;
        for (const [id, d] of classDecl) {
            const name = id.split('#')[1] as string;
            if (!modelNames.has(name) && modelNames.has(d.parent)) {
                modelNames.add(name);
                changed = true;
            }
        }
    }
    // `$table` is inherited: a model whose ancestor names its table persists
    // there, and the naming convention applies only when no ancestor names one.
    const byShortName = new Map<string, { source: string; parent: string }>();
    for (const [id, d] of classDecl) byShortName.set(id.split('#')[1] as string, { source: d.file.source, parent: d.parent });
    const inheritedTable = (name: string): string | undefined => {
        const seen = new Set<string>();
        for (let cur: string | undefined = name; cur && !seen.has(cur); ) {
            seen.add(cur);
            const decl = byShortName.get(cur);
            if (!decl) return undefined;
            const own = /protected\s+\$table\s*=\s*['"](\w+)['"]/.exec(decl.source)?.[1];
            if (own) return own;
            cur = decl.parent;
        }
        return undefined;
    };
    for (const [id, d] of [...classDecl.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
        const name = id.split('#')[1] as string;
        if (!modelNames.has(d.parent) || MODEL_BASES.has(name) || !nodeById.has(id)) continue;
        stats.models += 1;
        const explicit = inheritedTable(name);
        const table = explicit ?? (d.abstract ? null : snakePlural(name));
        const tableId = table ? tableNodes.get(table) : undefined;
        if (tableId) emit(id, tableId, 'persists', 'schema-call');
        const at = lineIndex(d.file.source);
        for (const m of d.file.source.matchAll(new RegExp(`\\$this->(?:${RELATION_METHODS})\\(\\s*([\\\\\\w]+)::class`, 'g'))) {
            const fq = qualify(m[1] as string, d.scope);
            const file = classFile(fq);
            const target = file ? `${file}#${shortName(fq)}` : null;
            if (!target || !nodeById.has(target)) continue;
            emit(enclosing(d.file.path, at(m.index as number)), target, 'relates', 'eloquent-relation');
            stats.relations += 1;
        }
    }

    const routesFiles = new Set(php.filter((x) => x.path.startsWith('routes/')).map((x) => x.path));
    const dropEdge = (e: CodeEdge): boolean => {
        if (e.relation !== 'calls' || e.resolved_via === 'same-file') return false;
        const src = nodeById.get(e.source);
        if (!src || !routesFiles.has(src.source_file)) return false;
        const target = nodeById.get(e.target);
        const name = target ? target.label : e.target.replace(/^symbol:/, '');
        if (!ROUTE_BUILDER_METHODS.has(name)) return false;
        stats.builderCallsDropped += 1;
        return true;
    };

    return { nodes, edges, dropEdge, stats };
}
