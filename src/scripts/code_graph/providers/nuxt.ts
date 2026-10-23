/**
 * Nuxt file routing under a package root (or its `app/` directory):
 *
 *   pages/a/[id].vue            PAGE /a/[id]         --routes-to--> the page component
 *   server/api/users.get.ts     GET /api/users       --routes-to--> the handler module
 *   server/routes/feed.ts       ROUTE /feed          --routes-to--> the handler module
 *
 * Unlike the default pass, no `index` page is required. Route ids match the
 * default's, so a page drawn here replaces the generic one. Route middleware,
 * `definePageMeta` path overrides and catch-all rewrites are not followed.
 */
import * as path from 'node:path';

import { npmRoots } from './shared/detect.js';
import { cleanRoute, HTTP_VERBS, underRoot } from './shared/js.js';
import { makeKit } from './shared/kit.js';
import type { ConventionProvider } from './types.js';

const SERVER_EXTS = new Set(['.ts', '.js', '.mjs']);

function classify(roots: readonly string[], p: string): { verb: string; route: string } | null {
    const at = underRoot(roots, p);
    if (!at) return null;
    const segs = at.rel.split('/');
    const lead = segs[0] === 'app' && segs[1] === 'pages' ? 1 : 0;
    const ext = path.posix.extname(p);
    const stem = (segs[segs.length - 1] as string).slice(0, -ext.length);
    if (segs[lead] === 'pages' && segs.length > lead + 1 && ext === '.vue') {
        return { verb: 'PAGE', route: cleanRoute([...segs.slice(lead + 1, -1), stem]) };
    }
    if (segs[0] === 'server' && (segs[1] === 'api' || segs[1] === 'routes') && segs.length > 2 && SERVER_EXTS.has(ext)) {
        const dot = /^(?<name>.+)\.(?<verb>get|post|put|patch|delete|head|options)$/.exec(stem);
        const verb = dot ? (dot.groups?.['verb'] as string).toUpperCase() : 'ROUTE';
        const name = dot ? (dot.groups?.['name'] as string) : stem;
        if (!(verb === 'ROUTE' || (HTTP_VERBS as readonly string[]).includes(verb))) return null;
        const prefix = segs[1] === 'api' ? ['api'] : [];
        return { verb, route: cleanRoute([...prefix, ...segs.slice(2, -1), name]) };
    }
    return null;
}

export const nuxtProvider: ConventionProvider = {
    id: 'nuxt',
    detect: (probe) => npmRoots(probe, ['nuxt']),
    build: (input) => {
        const kit = makeKit(input);
        for (const p of kit.paths) {
            const r = classify(kit.roots, p);
            if (!r) continue;
            kit.fileNode(p);
            kit.emit(kit.route(p, r.verb, r.route, 1), p, 'routes-to', 'route-table');
        }
        return kit.result();
    },
};
