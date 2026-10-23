// road-to-a-tick-the-shipped-path-earns 3.1–3.2.
import { describe, expect, it } from 'vitest';

import { checkStep, namedPaths, newTicks, stepBlock } from '../../src/scripts/check_step_production_reach.js';
import { importedNames, productionReach, usedExports, type ReachTree } from '../../src/scripts/_lib/production_reach.js';

function treeOf(files: Record<string, string>): ReachTree {
    return { list: () => Object.keys(files), read: (rel) => files[rel] ?? null };
}

const BASE = {
    'src/config/production-entries.json': JSON.stringify({ entries: ['src/main.ts'], entry_sources: ['docs/*.md'] }),
    'src/main.ts': "import { run } from './lib.js';\nrun();\n",
    'src/lib.ts': 'export function helper() {}\nexport function run() { helper(); }\nexport function orphan() {}\n',
    'src/scripts/tool.ts': "import { orphan } from '../lib.js';\norphan();\n",
    'tests/lib.test.ts': "import { helper, orphan, _seam } from '../src/lib.js';\n",
    'tests/run.test.ts': "import { run } from '../src/lib.js';\n",
};

describe('production reach', () => {
    it('reads named, aliased, namespace and default imports', () => {
        expect(importedNames('{ a, b as c, type D }')).toEqual(['a', 'b', 'D']);
        expect(importedNames('* as ns')).toEqual(['*']);
        expect(importedNames('def, { a }')).toEqual(['a', '*']);
    });

    it('counts an export the module uses itself, not one only declared', () => {
        expect(usedExports(BASE['src/lib.ts'])).toEqual(['helper']);
    });

    it('reaches a helper through its module, but not an export nobody imports', () => {
        const reach = productionReach(treeOf(BASE));
        expect(reach.symbols.has('src/lib.ts#helper')).toBe(true);
        expect(reach.symbols.has('src/lib.ts#run')).toBe(true);
        expect(reach.symbols.has('src/lib.ts#orphan')).toBe(false);
    });

    it('takes scripts an entry source names as entries', () => {
        const files = { ...BASE, 'docs/use.md': 'Run `./scripts-run src/scripts/tool` to see it.\n' };
        const reach = productionReach(treeOf(files));
        expect(reach.entries.has('src/scripts/tool.ts')).toBe(true);
        expect(reach.symbols.has('src/lib.ts#orphan')).toBe(true);
    });
});

describe('check_step_production_reach', () => {
    const tree = treeOf(BASE);
    const reach = productionReach(tree);

    it('reds a tick whose test takes an unreached symbol from its subject', () => {
        const f = checkStep(tree, reach, 'r.md', '1.1', '- [x] **1.1 x** `src/lib.ts`\n  verify: `tests/lib.test.ts`');
        expect(f?.reason).toContain('src/lib.ts#orphan');
        expect(f?.reason).not.toContain('_seam');
    });

    it('passes a tick whose tested symbols are reached', () => {
        expect(checkStep(tree, reach, 'r.md', '1.2', '- [x] **1.2 x** `src/lib.ts`\n  verify: `tests/run.test.ts`')).toBeNull();
    });

    it('honours a declared production entry', () => {
        const block = '- [x] **1.3 x** `src/lib.ts`, production entry: `src/scripts/tool.ts`\n  verify: `tests/lib.test.ts`';
        expect(checkStep(tree, reach, 'r.md', '1.3', block)).toBeNull();
    });

    it('refuses a ticked step that says built, not wired', () => {
        expect(checkStep(tree, reach, 'r.md', '1.4', '- [x] **1.4 x** built, not wired')).not.toBeNull();
    });

    it('maps a named test to its own subject module', () => {
        const files = { ...BASE, 'src/scripts/_lib/x.ts': 'export const a = 1;\n', 'tests/scripts/_lib_x.test.ts': '' };
        expect(namedPaths(treeOf(files), 'verify: `tests/scripts/_lib_x.test.ts`').subjects).toEqual(['src/scripts/_lib/x.ts']);
    });

    it('reads only new ticks and the step block', () => {
        expect(newTicks('+++ b/r.md\n-- [ ] **2.1 a**\n+- [x] **2.1 a**\n+- [x] **2.2 b**\n-- [x] **2.2 b**\n')).toEqual([
            { file: 'r.md', step: '2.1' },
        ]);
        expect(stepBlock('- [x] **2.1 a**\n  more\n- [ ] **2.2 b**\n', '2.1')).toBe('- [x] **2.1 a**\n  more');
    });
});
