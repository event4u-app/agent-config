/**
 * Next.js, both routers, under `app/` or `src/app/` and `pages/` or `src/pages/`
 * of a package root:
 *
 *   app/a/[id]/page.tsx     PAGE /a/[id]           --routes-to--> the page module
 *   app/api/x/route.ts      GET /api/x · POST …    --routes-to--> the exported verb function
 *   app/a/layout.tsx        --includes-->           every page below its directory
 *   pages/a.tsx             PAGE /a                --routes-to--> the page module
 *   pages/api/x.ts          ROUTE /api/x           --routes-to--> the API module
 *
 * Route ids match the default pass's, so a page drawn here replaces the generic
 * one. Route groups and parallel slots drop out of the path; a private `_dir`
 * is no route. A route module re-exporting a verb (`export { h as GET }`) is
 * not followed, and the default pass still adds its generic `ROUTE` node for a
 * `route.ts`.
 */
import * as path from 'node:path';

import { npmRoots } from './shared/detect.js';
import { cleanRoute, exportedVerbRoutes, underRoot } from './shared/js.js';
import { makeKit } from './shared/kit.js';
import type { ConventionProvider } from './types.js';

const PAGE_EXTS = new Set(['.tsx', '.jsx', '.ts', '.js', '.mdx']);

interface Classified {
    kind: 'page' | 'route' | 'layout' | 'pages-page' | 'pages-api';
    /** The directory the router starts at, repo-relative. */
    base: string;
    segments: string[];
}

function classify(roots: readonly string[], p: string): Classified | null {
    const at = underRoot(roots, p);
    if (!at) return null;
    const ext = path.posix.extname(p);
    if (!PAGE_EXTS.has(ext)) return null;
    const segs = at.rel.split('/');
    const lead = segs[0] === 'src' ? 1 : 0;
    const dir = segs[lead];
    const prefix = [at.root, ...segs.slice(0, lead + 1)].filter(Boolean).join('/');
    const stem = (segs[segs.length - 1] as string).slice(0, -ext.length);
    const inner = segs.slice(lead + 1, -1);
    if (dir === 'app') {
        if (inner.some((s) => s.startsWith('_'))) return null;
        if (stem === 'page') return { kind: 'page', base: prefix, segments: inner };
        if (stem === 'route' && ext !== '.mdx') return { kind: 'route', base: prefix, segments: inner };
        if (stem === 'layout') return { kind: 'layout', base: prefix, segments: inner };
        return null;
    }
    if (dir === 'pages' && segs.length > lead + 1) {
        if (stem.startsWith('_')) return null;
        const rest = [...inner, stem];
        return { kind: rest[0] === 'api' ? 'pages-api' : 'pages-page', base: prefix, segments: rest };
    }
    return null;
}

export const nextjsProvider: ConventionProvider = {
    id: 'nextjs',
    detect: (probe) => npmRoots(probe, ['next']),
    build: (input) => {
        const kit = makeKit(input);
        const pages: string[] = [];
        const layouts: string[] = [];
        for (const p of kit.paths) {
            const c = classify(kit.roots, p);
            if (!c) continue;
            const route = cleanRoute(c.segments);
            if (c.kind === 'layout') {
                layouts.push(p);
            } else if (c.kind === 'route') {
                if (kit.fileIds.has(p)) exportedVerbRoutes(kit, p, route);
            } else {
                kit.fileNode(p);
                const id = kit.route(p, c.kind === 'pages-api' ? 'ROUTE' : 'PAGE', route, 1);
                kit.emit(id, p, 'routes-to', 'route-table');
                if (c.kind === 'page') pages.push(p);
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
