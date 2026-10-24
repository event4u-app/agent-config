/**
 * Flask: `@app.route("/x", methods=["POST"])` / `@bp.get("/x")` → route
 * --routes-to--> the decorated function, where the receiver is a `Flask(...)`
 * or `Blueprint(...)` instance assigned in the same file. A same-file
 * `Blueprint(..., url_prefix="/api")` prefixes that blueprint's routes;
 * `@app.route` without `methods=` is a GET route, with it one route per verb.
 *
 * `render_template("x.html")` → the enclosing function --renders--> the one
 * template it names, looked up under `templates/` next to each module that
 * constructs `Flask(...)` and under the literal `template_folder` of a
 * blueprint the same file declares. A name found in two folders, or built at
 * runtime, draws nothing.
 *
 * Not followed: `add_url_rule(...)`, a blueprint registered on another
 * blueprint (nested prefixes), and blueprint folders declared in a different module.
 */
import * as path from 'node:path';

import { pythonRoots } from './shared/detect.js';
import { joinRoute, templateRoots } from './shared/extractors.js';
import { makeKit } from './shared/kit.js';
import { type AssignedCall, assignedCalls, balanced, importedNames, kwargString, routeDecorators, splitArgs } from './shared/python.js';
import type { ConventionProvider } from './types.js';

const METHODS = ['route', 'get', 'post', 'put', 'patch', 'delete'] as const;

function verbsOf(method: string, args: string): string[] {
    if (method !== 'route') return [method.toUpperCase()];
    const list = /\bmethods\s*=\s*[[(]([^\])]*)[\])]/.exec(args)?.[1];
    if (list === undefined) return ['GET'];
    const verbs = [...list.matchAll(/(['"])(\w+)\1/g)].map((m) => (m[2] as string).toUpperCase());
    return verbs.length > 0 ? [...new Set(verbs)] : ['GET'];
}

export const flaskProvider: ConventionProvider = {
    id: 'flask',
    detect: (probe) => pythonRoots(probe, ['flask']),
    build: (input) => {
        const kit = makeKit(input);
        const inventory = new Set(kit.paths);
        const py = kit.filesWithExt('.py');
        const own = new Map(py.map((f) => [f.path, assignedCalls(f.source, ['Flask', 'Blueprint'])]));
        const imports = new Map(py.map((f) => [f.path, importedNames(f.path, f.source, kit.roots, inventory)]));
        /** The instance a name in `file` denotes, keyed by the module that constructs it. */
        const instanceOf = (file: string, local: string): { key: string; call: AssignedCall } | null => {
            const mine = own.get(file)?.get(local);
            if (mine) return { key: `${file}#${local}`, call: mine };
            const imp = imports.get(file)?.get(local);
            const call = imp ? own.get(imp.file)?.get(imp.name) : undefined;
            return imp && call ? { key: `${imp.file}#${imp.name}`, call } : null;
        };
        const registered = new Map<string, Set<string | undefined>>();
        for (const f of py) {
            for (const m of f.source.matchAll(/\.register_blueprint\s*\(/g)) {
                const args = balanced(f.source, (m.index as number) + m[0].length - 1);
                const target = splitArgs(args)[0];
                const inst = target && /^\w+$/.test(target) ? instanceOf(f.path, target) : null;
                if (!inst) continue;
                const seen = registered.get(inst.key) ?? new Set<string | undefined>();
                seen.add(kwargString(args, 'url_prefix'));
                registered.set(inst.key, seen);
            }
        }
        const appDirs = new Set<string>();
        for (const f of py) {
            if (assignedCalls(f.source, ['Flask']).size > 0) appDirs.add(path.posix.dirname(f.path));
            for (const d of routeDecorators(kit, f, METHODS)) {
                const inst = instanceOf(f.path, d.receiver);
                if (!inst || d.path === null) continue;
                const fallback = kwargString(inst.call.args, 'url_prefix');
                const regs = registered.get(inst.key);
                const prefixes = new Set(regs ? [...regs].map((p) => p ?? fallback) : [fallback]);
                for (const prefix of prefixes) {
                    const routePath = joinRoute(prefix, d.path);
                    for (const verb of verbsOf(d.method, d.args)) {
                        const id = kit.route(f.path, verb, routePath, d.line);
                        if (d.handler) kit.emit(id, d.handler.id, 'routes-to', 'route-table');
                    }
                }
            }
        }
        const appTemplates = [...appDirs].map((d) => path.posix.join(d === '.' ? '' : d, 'templates'));
        templateRoots(kit, {
            exts: ['.py'],
            call: /\brender_template\(\s*(['"])(?<name>[^'"]+)\1/g,
            roots: appTemplates.length > 0 ? [] : ['templates'],
            extensions: [],
            rootsFor: (f) => {
                const dir = path.posix.dirname(f.path);
                const own = [...assignedCalls(f.source, ['Blueprint']).values()]
                    .map((b) => kwargString(b.args, 'template_folder'))
                    .filter((t): t is string => typeof t === 'string')
                    .map((t) => path.posix.normalize(path.posix.join(dir === '.' ? '' : dir, t)));
                return [...appTemplates, ...own];
            },
        });
        return kit.result();
    },
};
