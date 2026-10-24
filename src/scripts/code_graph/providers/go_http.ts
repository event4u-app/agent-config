/**
 * Go HTTP routers: a registration on a router value → the handler function.
 *
 *   http.HandleFunc("/x", h) · mux.HandleFunc("GET /x", h) · mux.Handle("/x", h)   net/http (1.22 verb patterns)
 *   r.GET("/x", h) · g := r.Group("/api"); g.POST("/y", h)                          Gin (group prefix)
 *   e.GET("/x", h)                                                                    Echo
 *   r.Get("/x", h)                                                                    chi
 *
 * A receiver must be a router the same function states: assigned from a router
 * constructor or a `.Group("/p")` of one, or a parameter of a router type; the
 * `http` package itself when the file imports `net/http`. So `cache.Get("/x")`
 * is no route. A handler resolves as the file names it: a function of the same
 * file, then of the same directory (the Go package); `pkg.F` through the
 * file's import of an in-repo package directory; `v.m` to the one method named
 * `m` in the package. Anything else — a closure, `http.HandlerFunc(f)` — gets
 * a route with no target. chi's `r.Route("/p", func…)` nesting is not followed.
 *
 * Detection is every `go.mod`: `net/http` is the standard library and declares
 * no requirement, and a Gin, Echo or chi project carries a `go.mod` already, so
 * the third-party modules need no marker of their own.
 */
import * as path from 'node:path';

import { goRoots } from './shared/detect.js';
import { joinRoute, lastArgName } from './shared/extractors.js';
import { type Kit, lineIndex, makeKit, packageSymbol } from './shared/kit.js';
import type { ConventionProvider } from './types.js';

const CONSTRUCTOR =
    /\b(?<v>\w+)\s*:?=\s*&?(?:chi\.NewRouter|chi\.NewMux|gin\.Default|gin\.New|echo\.New|http\.NewServeMux|mux\.NewRouter)\(\)/g;
const GROUP = /\b(?<v>\w+)\s*:?=\s*(?<parent>\w+)\.Group\(\s*"(?<p>[^"]*)"/g;
const PARAM = /\b(?<v>\w+)\s+\*?(?:gin\.(?:Engine|RouterGroup|IRouter|IRoutes)|chi\.(?:Router|Mux)|http\.ServeMux|echo\.(?:Echo|Group)|mux\.Router)\b/g;
const REGISTER =
    /\b(?<recv>\w+)\.(?<m>HandleFunc|Handle|GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD|Any|Get|Post|Put|Delete|Patch|Options|Head)\(\s*"(?:(?<pverb>[A-Z]+)\s+)?(?<path>\/[^"]*)"\s*,(?=(?<rest>[\s\S]{0,300}))/g;
const IMPORT = /^\s*(?:import\s+)?(?<alias>[\w.]+\s+)?"(?<spec>[^"]+)"\s*$/gm;

/** Local package name → import path, for the imports a file states. */
function imports(src: string): Map<string, string> {
    const out = new Map<string, string>();
    const blocks = [...src.matchAll(/^import\s*\(([\s\S]*?)^\)/gm)].map((m) => m[1] as string);
    const singles = [...src.matchAll(/^import\s+([\w.]+\s+)?("[^"]+")\s*$/gm)].map((m) => `${m[1] ?? ''}${m[2]}`);
    for (const text of [...blocks, ...singles]) {
        for (const m of text.matchAll(IMPORT)) {
            const spec = m.groups?.['spec'] as string;
            const segs = spec.split('/');
            const last = segs[segs.length - 1] as string;
            const name = m.groups?.['alias']?.trim() ?? (/^v\d+$/.test(last) && segs.length > 1 ? (segs[segs.length - 2] as string) : last);
            out.set(name, spec);
        }
    }
    return out;
}

/** The one in-repo package directory an import path names, under a provider root. */
function packageDir(kit: Kit, spec: string): string | null {
    const dirs = new Set(kit.filesWithExt('.go').map((f) => path.posix.dirname(f.path)));
    const hits = [...dirs].filter((d) =>
        kit.roots.some((root) => {
            const rel = root === '' ? d : d.startsWith(`${root}/`) ? d.slice(root.length + 1) : null;
            return rel !== null && rel !== '.' && (spec === rel || spec.endsWith(`/${rel}`));
        }),
    );
    return hits.length === 1 ? (hits[0] as string) : null;
}

function resolveHandler(kit: Kit, file: string, rest: string, imported: Map<string, string>): string | null {
    const name = lastArgName(rest);
    if (!name) return null;
    const [head, member] = name.split('.') as [string, string | undefined];
    if (!member) {
        const local = kit.nodesInFile(file).find((n) => n.kind === 'function' && n.label === head);
        return local ? local.id : packageSymbol(kit, file, head, ['function']);
    }
    const spec = imported.get(head);
    if (spec) {
        const dir = packageDir(kit, spec);
        return dir ? packageSymbol(kit, `${dir}/_.go`, member, ['function']) : null;
    }
    return packageSymbol(kit, file, member, ['method']);
}

export const goHttpProvider: ConventionProvider = {
    id: 'go-http',
    detect: (probe) => goRoots(probe, ['module']),
    build: (input) => {
        const kit = makeKit(input);
        for (const f of kit.filesWithExt('.go')) {
            const at = lineIndex(f.source);
            const imported = imports(f.source);
            const scope = (index: number): string => kit.enclosing(f.path, at(index));
            const routers = new Map<string, string>();
            const key = (index: number, v: string): string => `${scope(index)}\0${v}`;
            const found = [
                ...[...f.source.matchAll(CONSTRUCTOR)].map((m) => ({ m, parent: undefined as string | undefined })),
                ...[...f.source.matchAll(PARAM)].map((m) => ({ m, parent: undefined as string | undefined })),
                ...[...f.source.matchAll(GROUP)].map((m) => ({ m, parent: m.groups?.['parent'] })),
            ].sort((a, b) => (a.m.index as number) - (b.m.index as number));
            for (const { m, parent } of found) {
                const v = m.groups?.['v'] as string;
                if (parent === undefined) {
                    routers.set(key(m.index as number, v), '');
                    continue;
                }
                const base = routers.get(key(m.index as number, parent));
                if (base !== undefined) routers.set(key(m.index as number, v), joinRoute(base, m.groups?.['p']));
            }
            const httpPackage = [...imported].find(([, spec]) => spec === 'net/http')?.[0];
            for (const m of f.source.matchAll(REGISTER)) {
                const recv = m.groups?.['recv'] as string;
                const method = m.groups?.['m'] as string;
                const prefix = recv === httpPackage && /^Handle(Func)?$/.test(method) ? '' : routers.get(key(m.index as number, recv));
                if (prefix === undefined) continue;
                const verb = m.groups?.['pverb'] ?? (/^(HandleFunc|Handle|Any)$/.test(method) ? 'ANY' : method.toUpperCase());
                const id = kit.route(f.path, verb, joinRoute(prefix, m.groups?.['path']), at(m.index as number));
                const target = resolveHandler(kit, f.path, m.groups?.['rest'] ?? '', imported);
                if (target) kit.emit(id, target, 'routes-to', 'route-table');
            }
        }
        return kit.result();
    },
};
