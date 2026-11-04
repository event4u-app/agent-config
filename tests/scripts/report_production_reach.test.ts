// road-to-a-ledger-that-can-say-no 2.3 — every unreached engine module carries a disposition.
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { labelledModules, unreachedFindings, unreachedModules } from '../../src/scripts/report_production_reach.js';
import { productionReach, worktreeOf, type ReachTree } from '../../src/scripts/_lib/production_reach.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function treeOf(files: Record<string, string>): ReachTree {
    return { list: () => Object.keys(files), read: (rel) => files[rel] ?? null };
}

const FILES = {
    'src/config/production-entries.json': JSON.stringify({ entries: ['src/main.ts'], entry_sources: [] }),
    'src/main.ts': "import { a } from './scripts/analysis_a.js';\na();\n",
    'src/scripts/analysis_a.ts': 'export function a() {}\n',
    'src/scripts/analysis_b.ts': 'export function b() {}\n',
    'src/scripts/analysis_b.test.ts': '',
    'src/scripts/other.ts': 'export const o = 1;\n',
    'src/domains/x/door/command.md':
        '- `src/scripts/analysis_b.ts` (`b`) — reference spec, model-carried: no CLI runs it.\n' +
        'Mentioned only: `src/scripts/analysis_a.ts`.\n',
};

describe('report_production_reach --unreached', () => {
    it('lists only the matching modules the closure does not reach, tests excluded', () => {
        const tree = treeOf(FILES);
        expect(unreachedModules(tree, productionReach(tree), 'src/scripts/analysis_*.ts')).toEqual(['src/scripts/analysis_b.ts']);
    });

    it('reads a label only where the line says "reference spec, model-carried"', () => {
        expect([...labelledModules(treeOf(FILES)).keys()]).toEqual(['src/scripts/analysis_b.ts']);
    });

    it('reports a label naming a module the tree does not have as missing, not as reached', () => {
        const files = {
            ...FILES,
            'src/domains/x/door/command.md':
                FILES['src/domains/x/door/command.md'] + '- `src/scripts/analysis_gone.ts` (`g`) — reference spec, model-carried.\n',
        };
        const tree = treeOf(files);
        const lines = unreachedFindings(tree, productionReach(tree), 'src/scripts/analysis_*.ts');
        expect(lines).toContainEqual({ bad: true, text: '❌  labelled model-carried but missing: src/scripts/analysis_gone.ts (src/domains/x/door/command.md)' });
        expect(lines.some((l) => l.text.includes('but reached'))).toBe(false);
    });

    it('the unreached analysis modules of this tree are exactly the labelled ones', () => {
        const tree = worktreeOf(REPO_ROOT);
        const unreached = unreachedModules(tree, productionReach(tree), 'src/scripts/analysis_*.ts');
        const labelled = [...labelledModules(tree).keys()].filter((m) => /^src\/scripts\/analysis_[^/]*\.ts$/.test(m)).sort();
        expect(unreached).toEqual(labelled);
        expect(unreached.length).toBeGreaterThan(0);
    });
});
