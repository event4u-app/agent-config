/**
 * The five shared mechanisms most providers are a parameter table for
 * (road-to-graph-providers-for-every-stack 4.1):
 *
 *   annotationRoutes   @Get('/x') · @app.get("/x") · #[Route('/x')] · [HttpGet("x")]  route → the method below it
 *   callRoutes         app.get('/x', h) · path('x/', views.h) · r.GET("/x", h)          route → the handler named
 *   fsRoutes           a page module whose path is its route                         route → the module
 *   tableMapping       @Table(name = "t") · __tablename__ · $table · conventions      model → table, migration → table
 *   templateRoots      render('a/b.html') · render_template('x.html') · View("Name")  code → the template file
 *
 * Every edge is emitted only when its target exists; what a rule cannot settle
 * (a closure, a name built at runtime) gets no edge rather than a guess.
 */
import * as path from 'node:path';

import type { SourceFile } from '../../build.js';
import type { CodeNode } from '../../types.js';
import { type Kit, lineIndex } from './kit.js';

export function joinRoute(...parts: Array<string | undefined>): string {
    const joined = parts
        .filter((p): p is string => typeof p === 'string' && p.length > 0)
        .map((p) => p.replace(/^\/+|\/+$/g, ''))
        .filter(Boolean)
        .join('/');
    return `/${joined}`;
}

export interface AnnotationRouteSpec {
    exts: readonly string[];
    /** A route decorator; named groups `verb` (optional) and `path` (optional). */
    route: RegExp;
    /** HTTP verb when the decorator carries it in its name; `ANY` otherwise. */
    verb?: (m: RegExpMatchArray) => string;
    /** A class-level prefix decorator just above the class; named group `path`. */
    prefix?: RegExp;
    /** How far above a class its prefix decorator may sit, in lines. */
    prefixReach?: number;
}

export function annotationRoutes(kit: Kit, spec: AnnotationRouteSpec): number {
    let count = 0;
    for (const f of kit.filesWithExt(...spec.exts)) {
        const at = lineIndex(f.source);
        const prefixes = spec.prefix
            ? [...f.source.matchAll(spec.prefix)].map((m) => ({ line: at(m.index as number), path: m.groups?.['path'] ?? '' }))
            : [];
        for (const m of f.source.matchAll(spec.route)) {
            const line = at(m.index as number);
            const handler = kit.nextSymbol(f.path, line, ['method', 'function']);
            if (handler && handler.kind === 'class') continue;
            const cls = handler ? kit.classAt(f.path, handler.source_location[0] as number) : null;
            const reach = spec.prefixReach ?? 6;
            const clsLine = cls ? (cls.source_location[0] as number) : -1;
            const prefix = cls ? prefixes.filter((p) => p.line <= clsLine && p.line >= clsLine - reach).pop()?.path : undefined;
            const verb = (spec.verb ? spec.verb(m) : (m.groups?.['verb'] ?? 'ANY')).toUpperCase();
            const id = kit.route(f.path, verb, joinRoute(prefix, m.groups?.['path']), line);
            if (handler) kit.emit(id, handler.id, 'routes-to', 'route-table');
            count += 1;
        }
    }
    return count;
}

export interface CallRouteSpec {
    exts: readonly string[];
    /**
     * A route registration; named groups `verb` (optional), `path`, `rest` (the
     * text after the path). Capture `rest` inside a lookahead —
     * `(?=(?<rest>[\s\S]{0,300}))` — or it swallows the next registration.
     */
    call: RegExp;
    verb?: (m: RegExpMatchArray) => string;
    /** Resolve the handler from `rest`; the default reads the last argument as a name or `obj.member`. */
    handler?: (kit: Kit, file: string, rest: string) => string | null;
}

/** The last argument of a call's remaining text, if it is a plain name or `obj.member`. */
export function lastArgName(rest: string): string | null {
    let depth = 0;
    let end = rest.length;
    for (let i = 0; i < rest.length; i++) {
        const c = rest[i];
        if (c === '(' || c === '[' || c === '{') depth += 1;
        else if (c === ')' || c === ']' || c === '}') {
            if (depth === 0) {
                end = i;
                break;
            }
            depth -= 1;
        }
    }
    const args = rest.slice(0, end).split(',').map((a) => a.trim()).filter(Boolean);
    const last = args[args.length - 1];
    return last && /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)?$/.test(last) ? last : null;
}

export function defaultHandler(kit: Kit, file: string, rest: string): string | null {
    const name = lastArgName(rest);
    if (!name) return null;
    const [head, member] = name.split('.') as [string, string | undefined];
    const resolved = kit.resolveName(file, head);
    if (!member) return resolved;
    if (resolved) return kit.methodOf(resolved, member) ?? kit.resolveName(path.posix.join(path.posix.dirname(file), head), member);
    return null;
}

export function callRoutes(kit: Kit, spec: CallRouteSpec): number {
    let count = 0;
    for (const f of kit.filesWithExt(...spec.exts)) {
        const at = lineIndex(f.source);
        for (const m of f.source.matchAll(spec.call)) {
            const line = at(m.index as number);
            const verb = (spec.verb ? spec.verb(m) : (m.groups?.['verb'] ?? 'ANY')).toUpperCase();
            const id = kit.route(f.path, verb, joinRoute(m.groups?.['path']), line);
            const target = (spec.handler ?? defaultHandler)(kit, f.path, m.groups?.['rest'] ?? '');
            if (target) kit.emit(id, target, 'routes-to', 'route-table');
            count += 1;
        }
    }
    return count;
}

export interface FsRouteSpec {
    /** The route of a path, or null when it is no page module. */
    route: (p: string) => { verb: string; path: string } | null;
}

export function fsRoutes(kit: Kit, spec: FsRouteSpec): number {
    let count = 0;
    for (const p of kit.paths) {
        const r = spec.route(p);
        if (!r) continue;
        kit.fileNode(p);
        const id = kit.route(p, r.verb, r.path, 1);
        kit.emit(id, p, 'routes-to', 'route-table');
        count += 1;
    }
    return count;
}

export interface TableMappingSpec {
    exts: readonly string[];
    /** Marks the class it precedes or opens as mapped to a table. */
    entity: RegExp;
    /** The explicit table name, searched in the entity's declaration region; named group `name`. */
    tableName?: RegExp;
    /** The table a mapped class gets when nothing names one. */
    convention?: (className: string) => string;
    /** A migration or schema statement creating a table; named group `name`. */
    migration?: { files: (p: string) => boolean; create: RegExp };
}

export function snakePlural(name: string): string {
    const snake = name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
    if (/[^aeiou]y$/.test(snake)) return `${snake.slice(0, -1)}ies`;
    if (/(s|x|z|ch|sh)$/.test(snake)) return `${snake}es`;
    return `${snake}s`;
}

export function tableMapping(kit: Kit, spec: TableMappingSpec): number {
    let count = 0;
    if (spec.migration) {
        for (const f of kit.files.filter((x) => spec.migration?.files(x.path))) {
            const at = lineIndex(f.source);
            for (const m of f.source.matchAll(spec.migration.create)) {
                const name = m.groups?.['name'];
                if (!name) continue;
                kit.emit(f.path, kit.table(name, f.path, at(m.index as number)), 'migrates', 'schema-call');
            }
        }
    }
    for (const f of kit.filesWithExt(...spec.exts)) {
        const at = lineIndex(f.source);
        const lines = f.source.split('\n');
        for (const m of f.source.matchAll(spec.entity)) {
            const line = at(m.index as number);
            const cls = kit.classAt(f.path, line) ?? kit.nextSymbol(f.path, line, ['class']);
            if (!cls || cls.kind !== 'class') continue;
            const start = cls.source_location[0] as number;
            const end = (cls.source_location[2] ?? start) as number;
            // Up to four lines of decorators above the class — but never past the
            // end of the class before it, whose own table name would be read.
            let floor = 0;
            for (const n of kit.nodeById.values()) {
                if (n.kind !== 'class' || n.source_file !== f.path || n.id === cls.id) continue;
                const nEnd = (n.source_location[2] ?? n.source_location[0]) as number;
                if (nEnd < start && nEnd > floor) floor = nEnd;
            }
            const region = lines.slice(Math.max(floor, Math.min(line, start) - 1 - 4), end).join('\n');
            const explicit = spec.tableName ? spec.tableName.exec(region)?.groups?.['name'] : undefined;
            const name = explicit ?? spec.convention?.(cls.label);
            if (!name) continue;
            kit.emit(cls.id, kit.table(name, f.path, start), 'persists', 'schema-call');
            count += 1;
        }
    }
    return count;
}

export interface TemplateRootSpec {
    exts: readonly string[];
    /** A render call; named group `name` is the template as written. */
    call: RegExp;
    /** Directories templates live under, repo- or package-root-relative. */
    roots: readonly string[];
    /** Extensions tried when the name carries none. */
    extensions: readonly string[];
    /** Rewrite a name before lookup (`a.b` → `a/b`). */
    normalize?: (name: string) => string;
    /** Further template directories for one file, repo-relative (a folder its own source declares). */
    rootsFor?: (file: SourceFile) => readonly string[];
}

export function templateRoots(kit: Kit, spec: TemplateRootSpec): number {
    const inventory = new Set(kit.paths);
    let count = 0;
    for (const f of kit.filesWithExt(...spec.exts)) {
        const at = lineIndex(f.source);
        for (const m of f.source.matchAll(spec.call)) {
            const raw = m.groups?.['name'];
            if (!raw) continue;
            const name = spec.normalize ? spec.normalize(raw) : raw;
            const hasExt = /\.[A-Za-z0-9]+$/.test(path.posix.basename(name));
            const hits = new Set<string>();
            const dirs = [...kit.roots.flatMap((r) => spec.roots.map((t) => path.posix.join(r, t))), ...(spec.rootsFor?.(f) ?? [])];
            for (const root of new Set(dirs)) {
                for (const c of hasExt ? [path.posix.join(root, name)] : spec.extensions.map((x) => path.posix.join(root, `${name}${x}`))) {
                    if (inventory.has(c)) hits.add(c);
                }
            }
            if (hits.size !== 1) continue;
            const target = [...hits][0] as string;
            kit.fileNode(target);
            kit.emit(kit.enclosing(f.path, at(m.index as number)), target, 'renders', 'directive-scan');
            count += 1;
        }
    }
    return count;
}

/** The class a node belongs to, for a method id `<file>#<Class>::<m>`. */
export function classOf(n: CodeNode): string {
    return n.id.split('::')[0] as string;
}
