/**
 * Angular:
 *
 *   { path: 'x', component: XComponent }            PAGE /x --routes-to--> XComponent
 *   { path: 'x', loadComponent: () => import('./x').then((m) => m.X) }   → X, else the module
 *   @Component({ templateUrl: './x.html' }) class    --renders-->  the template file
 *   constructor(private s: S) · s = inject(S)        --injects-->  S (in a decorated class)
 *
 * Child route paths are not joined to their parent's; `loadChildren` modules,
 * inline `template:` strings and `styleUrls` are not followed.
 */
import * as path from 'node:path';

import { npmRoots } from './shared/detect.js';
import { constructorInjection, routeObjects } from './shared/js.js';
import { type Kit, lineIndex, makeKit } from './shared/kit.js';
import type { ConventionProvider } from './types.js';

const EXTS = ['.ts'];

function templateUrls(kit: Kit): number {
    const inventory = new Set(kit.paths);
    let count = 0;
    for (const f of kit.filesWithExt(...EXTS)) {
        const at = lineIndex(f.source);
        for (const m of f.source.matchAll(/@Component\(\s*\{(?<body>[^]*?)\}\s*\)/g)) {
            const url = /\btemplateUrl\s*:\s*(['"`])([^'"`]+)\1/.exec(m.groups?.['body'] ?? '');
            if (!url) continue;
            const cls = kit.nextSymbol(f.path, at(m.index as number), ['class']);
            const target = path.posix.join(path.posix.dirname(f.path), url[2] as string);
            if (!cls || cls.kind !== 'class' || !inventory.has(target)) continue;
            kit.fileNode(target);
            kit.emit(cls.id, target, 'renders', 'directive-scan');
            count += 1;
        }
    }
    return count;
}

export const angularProvider: ConventionProvider = {
    id: 'angular',
    detect: (probe) => npmRoots(probe, ['@angular/core']),
    build: (input) => {
        const kit = makeKit(input);
        routeObjects(kit, { exts: EXTS, componentKeys: ['component', 'loadComponent'] });
        templateUrls(kit);
        constructorInjection(kit, {
            exts: EXTS,
            classDecorator: /@(?:Component|Injectable|Directive|Pipe)\(/,
            reach: 12,
            injectCall: /=\s*inject\(\s*([A-Za-z_$][\w$]*)\s*\)/g,
        });
        return kit.result();
    },
};
