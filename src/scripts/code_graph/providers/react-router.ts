/**
 * React Router: `<Route path="/x" element={<X />} />` (or `component={X}`) and
 * route objects `{ path: '/x', element: <X />, Component: X, lazy: () => import('./x') }`
 * → a PAGE route --routes-to--> the component the file names or the module it
 * imports lazily. A `<Route>` without `path` (an index or layout route) and an
 * object without a component key are no routes. Nested `children` paths are
 * not joined to their parent's.
 */
import { npmRoots } from './shared/detect.js';
import { joinRoute } from './shared/extractors.js';
import { componentTarget, routeObjects } from './shared/js.js';
import { type Kit, lineIndex, makeKit } from './shared/kit.js';
import type { ConventionProvider } from './types.js';

const EXTS = ['.tsx', '.jsx', '.ts', '.js'];

/** The attribute text of a JSX tag opened at `from`, up to its `>` outside braces. */
function attributes(src: string, from: number): string {
    let depth = 0;
    for (let i = from; i < src.length && i < from + 2000; i++) {
        const c = src[i];
        if (c === '{') depth += 1;
        else if (c === '}') depth -= 1;
        else if (c === '>' && depth === 0) return src.slice(from, i);
    }
    return '';
}

function jsxRoutes(kit: Kit): number {
    let count = 0;
    for (const f of kit.filesWithExt('.tsx', '.jsx', '.js')) {
        const at = lineIndex(f.source);
        for (const m of f.source.matchAll(/<Route\b/g)) {
            const attrs = attributes(f.source, (m.index as number) + m[0].length);
            const p = /\bpath\s*=\s*\{?\s*(['"`])([^'"`$]*)\1/.exec(attrs);
            if (!p) continue;
            const id = kit.route(f.path, 'PAGE', joinRoute(p[2]), at(m.index as number));
            const el = /\belement\s*=\s*\{\s*(<\s*[A-Z][\w$]*)/.exec(attrs);
            const comp = /\b(?:component|Component)\s*=\s*\{\s*([A-Za-z_$][\w$]*)\s*\}/.exec(attrs);
            const value = el?.[1] ?? comp?.[1];
            const target = value ? componentTarget(kit, f.path, value) : null;
            if (target) kit.emit(id, target, 'routes-to', 'route-table');
            count += 1;
        }
    }
    return count;
}

export const reactRouterProvider: ConventionProvider = {
    id: 'react-router',
    detect: (probe) => npmRoots(probe, ['react-router', 'react-router-dom']),
    build: (input) => {
        const kit = makeKit(input);
        jsxRoutes(kit);
        routeObjects(kit, { exts: EXTS, componentKeys: ['element', 'Component', 'lazy'] });
        return kit.result();
    },
};
