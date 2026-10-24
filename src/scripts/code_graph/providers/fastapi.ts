/**
 * FastAPI: `@app.get("/x")` / `@router.post("/x")` → route --routes-to--> the
 * decorated function, where the receiver is a `FastAPI(...)` or `APIRouter(...)`
 * instance assigned in the same file (so `@cache.get("/x")` is no route). An
 * `APIRouter(prefix="/api")` prefix applies to that router's routes.
 *
 * `Depends(fn)` in a parameter default → the function --injects--> fn, resolved
 * the way the file names it (same file, then imports); `Depends(lambda: …)` and
 * a bare `Depends()` get no edge.
 *
 * Not followed: `app.include_router(router, prefix=...)` mounting a router from
 * another file, and routes registered by `app.add_api_route(...)`.
 */
import { pythonRoots } from './shared/detect.js';
import { joinRoute } from './shared/extractors.js';
import { makeKit } from './shared/kit.js';
import { assignedCalls, kwargString, paramsOf, routeDecorators } from './shared/python.js';
import type { ConventionProvider } from './types.js';

const VERBS = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'api_route', 'websocket'] as const;

export const fastapiProvider: ConventionProvider = {
    id: 'fastapi',
    detect: (probe) => pythonRoots(probe, ['fastapi']),
    build: (input) => {
        const kit = makeKit(input);
        for (const f of kit.filesWithExt('.py')) {
            const instances = assignedCalls(f.source, ['FastAPI', 'APIRouter']);
            if (instances.size > 0) {
                for (const d of routeDecorators(kit, f, VERBS)) {
                    const inst = instances.get(d.receiver);
                    if (!inst || d.path === null) continue;
                    const verb = d.method === 'api_route' ? 'ANY' : d.method === 'websocket' ? 'WS' : d.method.toUpperCase();
                    const id = kit.route(f.path, verb, joinRoute(kwargString(inst.args, 'prefix'), d.path), d.line);
                    if (d.handler) kit.emit(id, d.handler.id, 'routes-to', 'route-table');
                }
            }
            if (!f.source.includes('Depends(')) continue;
            for (const n of kit.nodesInFile(f.path)) {
                if (n.kind !== 'function' && n.kind !== 'method') continue;
                for (const m of paramsOf(f.source, n).matchAll(/\bDepends\(\s*([A-Za-z_]\w*)\s*[,)]/g)) {
                    const target = kit.resolveName(f.path, m[1] as string);
                    if (target && target !== n.id) kit.emit(n.id, target, 'injects', 'di-binding');
                }
            }
        }
        return kit.result();
    },
};
