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
 * Not followed: `app.register_blueprint(bp, url_prefix=...)` from another file,
 * `add_url_rule(...)`, and blueprint folders declared in a different module.
 */
import * as path from 'node:path';

import { pythonRoots } from './shared/detect.js';
import { joinRoute, templateRoots } from './shared/extractors.js';
import { makeKit } from './shared/kit.js';
import { assignedCalls, kwargString, routeDecorators } from './shared/python.js';
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
        const appDirs = new Set<string>();
        for (const f of kit.filesWithExt('.py')) {
            const instances = assignedCalls(f.source, ['Flask', 'Blueprint']);
            if (assignedCalls(f.source, ['Flask']).size > 0) appDirs.add(path.posix.dirname(f.path));
            if (instances.size === 0) continue;
            for (const d of routeDecorators(kit, f, METHODS)) {
                const inst = instances.get(d.receiver);
                if (!inst || d.path === null) continue;
                const routePath = joinRoute(kwargString(inst.args, 'url_prefix'), d.path);
                for (const verb of verbsOf(d.method, d.args)) {
                    const id = kit.route(f.path, verb, routePath, d.line);
                    if (d.handler) kit.emit(id, d.handler.id, 'routes-to', 'route-table');
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
