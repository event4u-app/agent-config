/**
 * Every command the map's bug area shows is one the CLI has, and the area does
 * not call an existing command planned.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '../../..');
const view = fs.readFileSync(path.join(ROOT, 'src/scripts/code_graph/map_viewer/area_bugs.js'), 'utf-8');
const cli = fs.readFileSync(path.join(ROOT, 'src/scripts/code_graph/cli_bugs.ts'), 'utf-8');

describe('the bug area names real commands', () => {
    it('each shown code-graph command is in the bugs CLI usage', () => {
        const shown = [...view.matchAll(/'code-graph ([a-z-]+(?: [a-z-]+)*)/g)].map((m) => m[1] as string);
        expect(shown.length).toBeGreaterThan(0);
        for (const c of shown) expect(cli, c).toContain(c);
    });

    it('does not say bugs import is missing from the CLI', () => {
        expect(view).not.toMatch(/not in the CLI yet|noch nicht im CLI/);
    });
});
