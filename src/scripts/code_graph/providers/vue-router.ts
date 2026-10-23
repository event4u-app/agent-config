/**
 * Vue Router: route objects `{ path: '/x', component: X }` or
 * `component: () => import('./views/X.vue')` → PAGE /x --routes-to--> the
 * component the file names or the single-file component it imports. Child
 * paths are not joined to their parent's; `components: { default: … }` named
 * views and alias specifiers (`@/views/X.vue`) are not followed.
 */
import { npmRoots } from './shared/detect.js';
import { routeObjects } from './shared/js.js';
import { makeKit } from './shared/kit.js';
import type { ConventionProvider } from './types.js';

export const vueRouterProvider: ConventionProvider = {
    id: 'vue-router',
    detect: (probe) => npmRoots(probe, ['vue-router']),
    build: (input) => {
        const kit = makeKit(input);
        routeObjects(kit, { exts: ['.ts', '.js', '.mjs'], componentKeys: ['component'] });
        return kit.result();
    },
};
