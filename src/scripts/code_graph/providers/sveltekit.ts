/**
 * SvelteKit file routing under `src/routes/` of a package root:
 *
 *   +page.svelte · +page.ts     PAGE /a/[slug]           --routes-to--> that module
 *   +server.ts                  GET /api/x · POST …      --routes-to--> the exported verb function
 *   +layout.svelte              --includes-->             every +page.svelte below its directory
 *
 * Route groups drop out of the path; route ids match the default pass's, so a
 * page drawn here replaces the generic one. `+page.server.ts` load functions,
 * `+layout@group` resets and a custom `kit.files.routes` directory are not
 * followed; the default pass still adds its generic `ROUTE` node for a
 * `+server.ts`.
 */
import * as path from 'node:path';

import { npmRoots } from './shared/detect.js';
import { cleanRoute, exportedVerbRoutes, underRoot } from './shared/js.js';
import { makeKit } from './shared/kit.js';
import type { ConventionProvider } from './types.js';

const PAGE = /^\+page\.(svelte|ts|js)$/;
const SERVER = /^\+server\.(ts|js)$/;
const LAYOUT = /^\+layout\.svelte$/;

export const sveltekitProvider: ConventionProvider = {
    id: 'sveltekit',
    detect: (probe) => npmRoots(probe, ['@sveltejs/kit']),
    build: (input) => {
        const kit = makeKit(input);
        const pages: string[] = [];
        const layouts: string[] = [];
        for (const p of kit.paths) {
            const at = underRoot(kit.roots, p);
            if (!at) continue;
            const segs = at.rel.split('/');
            if (segs[0] !== 'src' || segs[1] !== 'routes') continue;
            const base = segs[segs.length - 1] as string;
            const route = cleanRoute(segs.slice(2, -1));
            if (PAGE.test(base)) {
                kit.fileNode(p);
                kit.emit(kit.route(p, 'PAGE', route, 1), p, 'routes-to', 'route-table');
                if (base.endsWith('.svelte')) pages.push(p);
            } else if (SERVER.test(base)) {
                if (kit.fileIds.has(p)) exportedVerbRoutes(kit, p, route);
            } else if (LAYOUT.test(base)) {
                layouts.push(p);
            }
        }
        for (const layout of layouts) {
            const dir = `${path.posix.dirname(layout)}/`;
            for (const page of pages) {
                if (!page.startsWith(dir)) continue;
                kit.fileNode(layout);
                kit.emit(layout, page, 'includes', 'directive-scan');
            }
        }
        return kit.result();
    },
};
