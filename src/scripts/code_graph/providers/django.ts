/**
 * Django: the links a Django project makes by convention.
 *
 *   urls.py      path("x/", views.fn) · re_path(r"^x/$", V.as_view())  route --routes-to-->  the view function or class
 *   any view     render(request, "app/x.html")                        --renders-->   templates/ or <app>/templates/
 *   models.py    class X(models.Model)                                --persists-->   Meta.db_table, else <app>_<x>
 *   models.py    ForeignKey · ManyToManyField · OneToOneField          --relates-->    the model named
 *   migrations   migrations.CreateModel(name="X")                     --migrates-->  the same table
 *
 * A view is resolved the way the urls file names it: a same-file or imported
 * symbol, or `module.member` through a module the file imports. `include(...)`
 * of a dotted string, a `(module, namespace)` tuple or an imported module is
 * followed: an included module's routes carry every prefix chain that reaches
 * it from a URLconf nothing includes, and appear under no other path. An
 * inline lambda gets a route with no target. A template found in two template
 * folders, or built at runtime, draws nothing. The app label is the model file's
 * directory (its parent for a `models/` package) unless `Meta.app_label` says
 * otherwise; abstract models get no table; a `"self"` relation draws no edge.
 */
import * as path from 'node:path';

import type { CodeNode } from '../types.js';
import { markerRoots, pythonRoots, union } from './shared/detect.js';
import { joinRoute, templateRoots } from './shared/extractors.js';
import { lineIndex, makeKit } from './shared/kit.js';
import { balanced, classBases, importedModules, kwargString, resolveModule, spanText, splitArgs, stringLiteral } from './shared/python.js';
import type { ConventionProvider } from './types.js';

const RELATION = /\b(?:models\.)?(?:ForeignKey|ManyToManyField|OneToOneField)\s*\(/g;

function appLabelOf(file: string): string {
    const dir = path.posix.dirname(file);
    const base = path.posix.basename(dir);
    return base === 'models' ? path.posix.basename(path.posix.dirname(dir)) : base;
}

interface Model {
    node: CodeNode;
    app: string;
    table: string | null;
}

export const djangoProvider: ConventionProvider = {
    id: 'django',
    markers: ['manage.py'],
    detect: (probe) => union(pythonRoots(probe, ['django']), markerRoots(probe, 'manage.py')),
    build: (input) => {
        const kit = makeKit(input);
        const inventory = new Set(kit.paths);
        const py = kit.filesWithExt('.py');

        // Routes. Every URLconf is read once; `include()` links a parent to the
        // module it names, and each route is emitted once per prefix chain that
        // reaches its file from a URLconf nothing includes.
        interface UrlRoute { path: string; view: string; line: number }
        interface UrlConf { file: string; routes: UrlRoute[]; includes: Array<{ path: string; child: string }> }
        const confs = new Map<string, UrlConf & { resolve: (expr: string) => string | null }>();
        const pattern = (literal: string, re: boolean): string => (re ? literal.replace(/^\^/, '').replace(/\$$/, '') : literal);
        for (const f of py.filter((x) => path.posix.basename(x.path) === 'urls.py' || /^urlpatterns\s*[:=]/m.test(x.source))) {
            const at = lineIndex(f.source);
            const modules = importedModules(f.path, f.source, kit.roots, inventory);
            const resolve = (expr: string): string | null => {
                const parts = expr.replace(/\.as_view\s*\([\s\S]*\)$/, '').split('.');
                if (!parts.every((p) => /^[A-Za-z_]\w*$/.test(p))) return null;
                if (parts.length === 1) return kit.resolveName(f.path, parts[0] as string);
                if (parts.length !== 2) return null;
                const [head, member] = parts as [string, string];
                const mod = modules.get(head);
                if (mod && kit.nodeById.has(`${mod}#${member}`)) return `${mod}#${member}`;
                const cls = kit.resolveName(f.path, head);
                return cls ? kit.methodOf(cls, member) : null;
            };
            /** The module an `include(...)` argument names: `"a.urls"`, `("a.urls", "ns")`, or an imported module. */
            const includeTarget = (view: string): string | null => {
                const open = view.indexOf('(');
                let first = splitArgs(balanced(view, open))[0] ?? '';
                if (first.startsWith('(') || first.startsWith('[')) first = splitArgs(balanced(first, 0))[0] ?? '';
                const dotted = stringLiteral(first);
                if (dotted !== null) return resolveModule(f.path, dotted, kit.roots, inventory);
                return /^\w+$/.test(first) ? (modules.get(first) ?? null) : null;
            };
            const conf: UrlConf & { resolve: typeof resolve } = { file: f.path, routes: [], includes: [], resolve };
            for (const m of f.source.matchAll(/\b(path|re_path)\s*\(/g)) {
                const args = splitArgs(balanced(f.source, (m.index as number) + m[0].length - 1));
                const literal = stringLiteral(args[0] ?? '');
                const view = args[1];
                if (literal === null || view === undefined) continue;
                const routePath = pattern(literal, m[1] === 're_path');
                if (/^include\s*\(/.test(view)) {
                    const child = includeTarget(view);
                    if (child) conf.includes.push({ path: routePath, child });
                    continue;
                }
                conf.routes.push({ path: routePath, view, line: at(m.index as number) });
            }
            confs.set(f.path, conf);
        }
        const included = new Set([...confs.values()].flatMap((c) => c.includes.map((i) => i.child)));
        const prefixes = new Map<string, Set<string>>();
        const walk = (file: string, prefix: string, stack: readonly string[]): void => {
            const conf = confs.get(file);
            if (!conf || stack.includes(file)) return;
            const seen = prefixes.get(file) ?? new Set<string>();
            if (seen.has(prefix)) return;
            seen.add(prefix);
            prefixes.set(file, seen);
            for (const inc of conf.includes) walk(inc.child, joinRoute(prefix, inc.path), [...stack, file]);
        };
        for (const file of confs.keys()) if (!included.has(file)) walk(file, '', []);
        for (const conf of confs.values()) {
            for (const prefix of prefixes.get(conf.file) ?? []) {
                for (const r of conf.routes) {
                    const id = kit.route(conf.file, 'ANY', joinRoute(prefix, r.path), r.line);
                    const target = conf.resolve(r.view);
                    if (target) kit.emit(id, target, 'routes-to', 'route-table');
                }
            }
        }

        // Templates: the project-level folder and every app's own.
        const tplDirs = new Set<string>(['templates']);
        for (const p of kit.paths) {
            for (const r of kit.roots) {
                const rel = r === '' ? p : p.startsWith(`${r}/`) ? p.slice(r.length + 1) : null;
                const hit = rel === null ? null : /^([^/]+)\/templates\//.exec(rel);
                if (hit) tplDirs.add(`${hit[1]}/templates`);
            }
        }
        templateRoots(kit, {
            exts: ['.py'],
            call: /\b(?:render\(\s*\w+\s*,|render_to_string\(|get_template\()\s*(['"])(?<name>[^'"]+)\1/g,
            roots: [...tplDirs].sort(),
            extensions: [],
        });

        // Models.
        const models = new Map<string, Model>();
        const isDjangoFile = (src: string): boolean => /\bfrom\s+django\b|\bimport\s+django\b/.test(src);
        for (let changed = true; changed; ) {
            changed = false;
            for (const f of py) {
                if (!isDjangoFile(f.source)) continue;
                for (const n of kit.nodesInFile(f.path)) {
                    if (n.kind !== 'class' || models.has(n.id)) continue;
                    const bases = classBases(f.source, n);
                    const isModel = bases.some((b) => {
                        if (/^(?:models\.)?Model$/.test(b)) return true;
                        const r = /^\w+$/.test(b) ? kit.resolveName(f.path, b) : null;
                        return r !== null && models.has(r);
                    });
                    if (!isModel) continue;
                    const region = spanText(f.source, n);
                    const app = /\bapp_label\s*=\s*(['"])(\w+)\1/.exec(region)?.[2] ?? appLabelOf(f.path);
                    const abstract = /\babstract\s*=\s*True\b/.test(region);
                    const table = abstract ? null : (/\bdb_table\s*=\s*[rbu]?(['"])([^'"]+)\1/.exec(region)?.[2] ?? `${app}_${n.label.toLowerCase()}`);
                    models.set(n.id, { node: n, app, table });
                    changed = true;
                }
            }
        }
        const sources = new Map(py.map((f) => [f.path, f.source] as const));
        for (const m of models.values()) {
            if (m.table) kit.emit(m.node.id, kit.table(m.table, m.node.source_file, m.node.source_location[0] as number), 'persists', 'schema-call');
        }
        const modelNamed = (app: string | null, label: string, file: string): string | null => {
            const same = [...models.values()].filter((x) => x.node.label === label && x.node.source_file === file);
            if (same.length === 1) return (same[0] as Model).node.id;
            const inApp = [...models.values()].filter((x) => x.node.label === label && (app === null || x.app === app));
            return inApp.length === 1 ? (inApp[0] as Model).node.id : null;
        };
        for (const m of models.values()) {
            const src = sources.get(m.node.source_file) as string;
            const region = spanText(src, m.node);
            for (const r of region.matchAll(RELATION)) {
                const first = splitArgs(balanced(region, (r.index as number) + r[0].length - 1))[0] ?? '';
                const lit = stringLiteral(first);
                let target: string | null = null;
                if (lit !== null) {
                    if (lit === 'self') continue;
                    const dot = lit.lastIndexOf('.');
                    target = dot >= 0 ? modelNamed(lit.slice(0, dot), lit.slice(dot + 1), m.node.source_file) : modelNamed(m.app, lit, m.node.source_file);
                } else if (/^\w+$/.test(first)) {
                    const resolved = kit.resolveName(m.node.source_file, first);
                    target = resolved && models.has(resolved) ? resolved : null;
                }
                if (target && target !== m.node.id) kit.emit(m.node.id, target, 'relates', 'orm-relation');
            }
        }

        // Migrations.
        for (const f of py.filter((x) => /(^|\/)migrations\/[^/]+\.py$/.test(x.path))) {
            const at = lineIndex(f.source);
            const app = path.posix.basename(path.posix.dirname(path.posix.dirname(f.path)));
            for (const c of f.source.matchAll(/\bmigrations\.CreateModel\s*\(/g)) {
                const args = balanced(f.source, (c.index as number) + c[0].length - 1);
                const name = kwargString(args, 'name') ?? stringLiteral(splitArgs(args)[0] ?? '');
                if (!name) continue;
                const explicit = /(['"])db_table\1\s*:\s*(['"])([^'"]+)\2/.exec(args)?.[3];
                const model = [...models.values()].find((x) => x.app === app && x.node.label === name);
                const table = explicit ?? model?.table ?? `${app}_${name.toLowerCase()}`;
                kit.emit(f.path, kit.table(table, f.path, at(c.index as number)), 'migrates', 'schema-call');
            }
        }
        return kit.result();
    },
};
