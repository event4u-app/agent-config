/**
 * Mechanics the JavaScript providers share and the five extractors do not
 * carry: resolving a module specifier and a default import, reading a route
 * object literal, constructor injection, and the verb functions a route module
 * exports.
 *
 * Same contract as the extractors: an edge only when its target exists; a
 * specifier that is not relative, or a value built at runtime, gets no edge.
 */
import * as path from 'node:path';

import type { CodeNode } from '../../types.js';
import { joinRoute } from './extractors.js';
import { type Kit, lineIndex } from './kit.js';

const MODULE_EXTS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.vue', '.svelte'];

/** A kit that sees only the code files `keep` accepts (one ORM among several sharing a decorator name). */
export function scopeKit(kit: Kit, keep: (source: string) => boolean): Kit {
    const files = kit.files.filter((f) => keep(f.source));
    return { ...kit, files, filesWithExt: (...exts) => files.filter((f) => exts.some((x) => f.path.endsWith(x))) };
}

/** The project file a relative specifier written in `file` names; null for a package or alias specifier. */
export function resolveModule(kit: Kit, file: string, spec: string): string | null {
    if (!spec.startsWith('./') && !spec.startsWith('../')) return null;
    const base = path.posix.join(path.posix.dirname(file), spec);
    if (base.startsWith('..')) return null;
    const known = (p: string): boolean => kit.fileIds.has(p) || kit.nodeById.has(p) || kit.paths.includes(p);
    if (/\.[A-Za-z0-9]+$/.test(path.posix.basename(base)) && known(base)) return base;
    for (const c of [...MODULE_EXTS.map((x) => `${base}${x}`), ...MODULE_EXTS.map((x) => `${base}/index${x}`)]) if (known(c)) return c;
    return null;
}

function symbolIn(kit: Kit, file: string, name: string): string | null {
    for (const n of kit.nodeById.values()) if (n.source_file === file && n.label === name && n.kind !== 'method' && n.kind !== 'file') return n.id;
    return null;
}

/** A module target: the named symbol inside it when it declares one, else the module file. */
export function moduleTarget(kit: Kit, file: string, spec: string, member?: string): string | null {
    const mod = resolveModule(kit, file, spec);
    if (!mod) return null;
    const sym = member ? symbolIn(kit, mod, member) : null;
    if (sym) return sym;
    kit.fileNode(mod);
    return mod;
}

/**
 * A component name as written in `file`: a same-file or named-import symbol
 * (`kit.resolveName`), else a default import — the symbol of that name in the
 * imported module, or the module file itself.
 */
export function resolveComponent(kit: Kit, file: string, name: string): string | null {
    const named = kit.resolveName(file, name);
    if (named) return named;
    const src = kit.files.find((f) => f.path === file)?.source ?? '';
    const esc = name.replace(/\$/g, '\\$');
    const m = new RegExp(`\\bimport\\s+${esc}\\s*(?:,\\s*\\{[^}]*\\})?\\s+from\\s+(['"])([^'"]+)\\1`).exec(src);
    return m ? moduleTarget(kit, file, m[2] as string, name) : null;
}

/**
 * The object literal around `index`: its bounds, and its own top-level text with
 * every nested `{}` and `[]` blanked (parentheses kept, so `() => import('./x')`
 * stays readable). Null when `index` sits inside parentheses or a bracket first.
 */
export function objectAt(src: string, index: number): { start: number; end: number; flat: string } | null {
    let depth = 0;
    let start = -1;
    for (let i = index - 1; i >= 0; i--) {
        const c = src[i];
        if (c === ')' || c === ']' || c === '}') depth += 1;
        else if (c === '(' || c === '[' || c === '{') {
            if (depth === 0) {
                if (c !== '{') return null;
                start = i;
                break;
            }
            depth -= 1;
        }
    }
    if (start < 0) return null;
    const out: string[] = [];
    const stack: string[] = [];
    for (let i = start + 1; i < src.length; i++) {
        const c = src[i] as string;
        const nested = (): boolean => stack.some((s) => s !== '(');
        if (c === '{' || c === '[' || c === '(') {
            const blank = nested() || c !== '(';
            stack.push(c);
            out.push(blank ? ' ' : c);
        } else if (c === '}' || c === ']' || c === ')') {
            if (stack.length === 0) return { start, end: i, flat: out.join('') };
            stack.pop();
            out.push(nested() || c !== ')' ? ' ' : c);
        } else out.push(nested() ? ' ' : c);
    }
    return null;
}

/** The text of `key: <value>` in a flat object, up to the next top-level comma. */
export function valueOf(flat: string, key: string): string | null {
    const m = new RegExp(`(?:^|[\\s,])${key}\\s*:`).exec(flat);
    if (!m) return null;
    let depth = 0;
    const from = m.index + m[0].length;
    for (let i = from; i < flat.length; i++) {
        const c = flat[i];
        if (c === '(') depth += 1;
        else if (c === ')') depth -= 1;
        else if (c === ',' && depth === 0) return flat.slice(from, i).trim();
    }
    return flat.slice(from).trim();
}

/** What a component value names: a dynamic import (with an optional `.then(m => m.X)`), a JSX element, or a name. */
export function componentTarget(kit: Kit, file: string, value: string): string | null {
    const imp = /\bimport\(\s*(['"`])([^'"`]+)\1\s*\)(?:\s*\.then\(\s*\(?\s*(\w+)\s*\)?\s*=>\s*\3\.(\w+)\s*\))?/.exec(value);
    if (imp) return moduleTarget(kit, file, imp[2] as string, imp[4]);
    const jsx = /^<\s*([A-Z][\w$]*)/.exec(value);
    if (jsx) return resolveComponent(kit, file, jsx[1] as string);
    if (/^[A-Za-z_$][\w$]*$/.test(value)) return resolveComponent(kit, file, value);
    return null;
}

export interface RouteObjectSpec {
    exts: readonly string[];
    /** Keys whose value is the component a route renders; a `path` object with none of them is no route. */
    componentKeys: readonly string[];
}

/** `{ path: '/x', component: X }` route objects → a PAGE route --routes-to--> the component or lazily imported module. */
export function routeObjects(kit: Kit, spec: RouteObjectSpec): number {
    let count = 0;
    for (const f of kit.filesWithExt(...spec.exts)) {
        const at = lineIndex(f.source);
        for (const m of f.source.matchAll(/(?:^|[\s,{])path\s*:\s*(['"`])(?<path>[^'"`$]*)\1/g)) {
            const obj = objectAt(f.source, m.index as number);
            if (!obj) continue;
            const values = spec.componentKeys.map((k) => valueOf(obj.flat, k)).filter((v): v is string => v !== null);
            if (values.length === 0) continue;
            const id = kit.route(f.path, 'PAGE', joinRoute(m.groups?.['path']), at(m.index as number));
            for (const v of values) {
                const target = componentTarget(kit, f.path, v);
                if (target) kit.emit(id, target, 'routes-to', 'route-table');
            }
            count += 1;
        }
    }
    return count;
}

function symbolsOf(kit: Kit, file: string, kind: CodeNode['kind']): CodeNode[] {
    return [...kit.nodeById.values()].filter((n) => n.source_file === file && n.kind === kind);
}

/** The parameter list of the first `constructor(` in `text`, balanced. */
function constructorParams(text: string): string[] {
    const m = /\bconstructor\s*\(/.exec(text);
    if (!m) return [];
    let depth = 0;
    const from = m.index + m[0].length;
    const parts: string[] = [];
    let cur = '';
    for (let i = from; i < text.length; i++) {
        const c = text[i] as string;
        if (c === '(' || c === '<' || c === '[' || c === '{') depth += 1;
        else if (c === ')' || c === '>' || c === ']' || c === '}') {
            if (depth === 0) break;
            depth -= 1;
        }
        if (c === ',' && depth === 0) {
            parts.push(cur);
            cur = '';
        } else cur += c;
    }
    if (cur.trim()) parts.push(cur);
    return parts;
}

export interface InjectionSpec {
    exts: readonly string[];
    /** A class decorator marking the class as container-managed, searched just above the class. */
    classDecorator: RegExp;
    /** How far above the class its decorator may sit, in lines. */
    reach?: number;
    /** A field initializer naming the dependency (`inject(X)`); group 1 is the type. */
    injectCall?: RegExp;
}

/** `constructor(private readonly s: UsersService)` in a decorated class → class --injects--> UsersService. */
export function constructorInjection(kit: Kit, spec: InjectionSpec): number {
    let count = 0;
    for (const f of kit.filesWithExt(...spec.exts)) {
        const lines = f.source.split('\n');
        for (const cls of symbolsOf(kit, f.path, 'class')) {
            const start = cls.source_location[0] as number;
            const end = (cls.source_location[2] ?? start) as number;
            const above = lines.slice(Math.max(0, start - 1 - (spec.reach ?? 6)), start).join('\n');
            if (!spec.classDecorator.test(above)) continue;
            const body = lines.slice(start - 1, end).join('\n');
            const types: string[] = [];
            for (const p of constructorParams(body)) {
                const t = /^\s*(?:@\w+\([^)]*\)\s*)*(?:(?:public|private|protected|readonly)\s+)*[A-Za-z_$][\w$]*\??\s*:\s*([A-Za-z_$][\w$]*)/.exec(p);
                if (t) types.push(t[1] as string);
            }
            if (spec.injectCall) for (const m of body.matchAll(spec.injectCall)) types.push(m[1] as string);
            for (const t of types) {
                const target = kit.resolveName(f.path, t);
                if (!target || target === cls.id || kit.nodeById.get(target)?.kind !== 'class') continue;
                kit.emit(cls.id, target, 'injects', 'di-binding');
                count += 1;
            }
        }
    }
    return count;
}

export const HTTP_VERBS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const;

/** `export async function GET()` · `export const POST = …` in a route module → one route per verb → that function. */
export function exportedVerbRoutes(kit: Kit, file: string, routePath: string): number {
    const src = kit.files.find((f) => f.path === file)?.source;
    if (src === undefined) return 0;
    const at = lineIndex(src);
    let count = 0;
    const re = new RegExp(`\\bexport\\s+(?:async\\s+function|function|const|let)\\s+(${HTTP_VERBS.join('|')})\\b`, 'g');
    for (const m of src.matchAll(re)) {
        const verb = m[1] as string;
        const id = kit.route(file, verb, routePath, at(m.index as number));
        const target = kit.resolveName(file, verb);
        if (target) kit.emit(id, target, 'routes-to', 'route-table');
        count += 1;
    }
    return count;
}

/** `p` relative to the first of `roots` it lies under, with that root; null when under none. */
export function underRoot(roots: readonly string[], p: string): { root: string; rel: string } | null {
    for (const root of roots) {
        if (root === '') return { root, rel: p };
        if (p.startsWith(`${root}/`)) return { root, rel: p.slice(root.length + 1) };
    }
    return null;
}

/** Route segments as the default pass writes them: groups, slots and `index` dropped. */
export function cleanRoute(parts: readonly string[]): string {
    return `/${parts.filter((s) => !/^\(.*\)$/.test(s) && !s.startsWith('@') && s !== 'index').join('/')}`.replace(/\/$/, '') || '/';
}
