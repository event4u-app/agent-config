/**
 * Express: `app.get('/x', handler)` and `router.post('/x', mw, handler)` →
 * route --routes-to--> the handler the file names (same file or imported).
 * A receiver must read as an app or a router, so `cache.get('/x')` is no route;
 * an inline handler gets a route with no target. Mounting a router under a
 * prefix in another file (`app.use('/api', router)`) is not followed.
 */
import { npmRoots } from './shared/detect.js';
import { callRoutes } from './shared/extractors.js';
import { makeKit } from './shared/kit.js';
import type { ConventionProvider } from './types.js';

export const expressProvider: ConventionProvider = {
    id: 'express',
    detect: (probe) => npmRoots(probe, ['express']),
    build: (input) => {
        const kit = makeKit(input);
        callRoutes(kit, {
            exts: ['.ts', '.js', '.mjs', '.cjs'],
            call: /\b(?:app|router|server|api|\w+Router)\s*\.\s*(?<verb>get|post|put|patch|delete|options|head|all)\(\s*(['"`])(?<path>\/[^'"`]*)\2\s*,(?=(?<rest>[\s\S]{0,300}))/g,
            verb: (m) => (m.groups?.['verb'] === 'all' ? 'ANY' : (m.groups?.['verb'] as string)),
        });
        return kit.result();
    },
};
