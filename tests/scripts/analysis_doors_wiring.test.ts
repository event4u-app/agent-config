/**
 * The four analysis doors (ADR-288) share three obligations that live in their
 * prose: print the scope line before any read (AC-1), pin every loop in a
 * `limits:` block (AC-2), and leave a `run.json` per run (AC-9). The run core
 * and its modules are tested on their own; this pins that every door names them.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DOORS = ['repo', 'and-optimize', 'pr', 'inbox'] as const;
const LIMIT_KEYS = ['mode_default', 'max_iterations', 'hard_ceiling', 'no_gain_stop', 'target_metric'];

function door(name: string): { text: string; fm: Record<string, unknown> } {
    const text = fs.readFileSync(path.join(ROOT, 'src/domains/analysis-workbench/analyze', name, 'command.md'), 'utf-8');
    const fm = parse(/^---\n([\s\S]*?)\n---\n/u.exec(text)![1]!) as Record<string, unknown>;
    return { text, fm };
}

describe.each(DOORS)('analyze door %s', (name) => {
    const { text, fm } = door(name);

    it('prints the scope line before any read, resolved by analysis_target', () => {
        expect(text).toMatch(/[Pp]rint (the|its) scope line|print its\s+line before any read/u);
        expect(text).toMatch(/analysis_target\.ts|scope line of `analysis-loop`/u);
    });

    it('pins its loops in a complete limits block', () => {
        const limits = fm['limits'] as Record<string, unknown> | undefined;
        expect(limits, 'limits block').toBeDefined();
        expect(Object.keys(limits!).sort()).toEqual([...LIMIT_KEYS].sort());
        expect(limits!['hard_ceiling'] as number).toBeGreaterThanOrEqual(limits!['max_iterations'] as number);
    });

    it('leaves a run.json per run', () => {
        expect(text).toContain('`run.json` per `src/scripts/analysis_run_record.ts`');
    });
});

describe('analyze:inbox limits', () => {
    it('pins the extraction caps and restates them in the body', () => {
        const { text, fm } = door('inbox');
        expect(fm['limits']).toEqual({ mode_default: 'execute', max_iterations: 3, hard_ceiling: 3, no_gain_stop: 1, target_metric: 'required' });
        expect(text).toContain('capped at three extraction passes');
        expect(text).toContain('a pass 2 that adds no row ends extraction');
        expect(text).toContain('at most one push plus three CI-fix rounds');
    });
});
