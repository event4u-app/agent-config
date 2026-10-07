// A deterministic budget metric must be checked on the PR that moves its input.
// The umbrella's `paths` filter is the selection mechanism, so every input a
// deterministic metric names has to appear in it. Once `mcp_public_tool_count`
// had no listed input, and the PR that added a tool did not run the budget.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const ROOT = join(__dirname, '..', '..');

interface Entry {
    deterministic?: boolean;
    inputs?: unknown;
}

function budgets(): Record<string, Entry> {
    const doc = JSON.parse(readFileSync(join(ROOT, 'src/config/evaluator-budgets.json'), 'utf8')) as {
        budgets: Record<string, Entry>;
    };
    return doc.budgets;
}

function umbrellaPaths(): string[] {
    const wf = parse(readFileSync(join(ROOT, '.github/workflows/evaluator-umbrella.yml'), 'utf8')) as {
        on: { pull_request: { paths: string[] } };
    };
    return wf.on.pull_request.paths;
}

/** Deterministic metrics whose inputs are missing, or not all in the filter. */
function uncoveredMetrics(b: Record<string, Entry>, paths: readonly string[]): string[] {
    const filter = new Set(paths);
    const out: string[] = [];
    for (const [name, entry] of Object.entries(b)) {
        if (entry.deterministic === false) continue;
        const inputs = entry.inputs;
        if (!Array.isArray(inputs) || inputs.length === 0) {
            out.push(`${name}: names no input path`);
            continue;
        }
        for (const i of inputs) {
            if (typeof i !== 'string' || !filter.has(i)) out.push(`${name}: input ${String(i)} is not in the filter`);
        }
    }
    return out;
}

describe('evaluator umbrella paths cover every deterministic metric input', () => {
    it('the committed budgets and workflow agree', () => {
        expect(uncoveredMetrics(budgets(), umbrellaPaths())).toEqual([]);
    });

    it('the mcp tool count is triggered by the MCP server sources', () => {
        expect(budgets()['mcp_public_tool_count']?.inputs).toContain('src/scripts/mcp_server/**');
        expect(umbrellaPaths()).toContain('src/scripts/mcp_server/**');
    });

    it('fails when a deterministic metric names no input', () => {
        expect(uncoveredMetrics({ m: {} }, ['a'])).toEqual(['m: names no input path']);
    });

    it('fails when an input is absent from the filter', () => {
        expect(uncoveredMetrics({ m: { inputs: ['src/x/**'] } }, ['src/cli/registry.ts'])).toEqual([
            'm: input src/x/** is not in the filter',
        ]);
    });

    it('skips non-deterministic metrics', () => {
        expect(uncoveredMetrics({ t: { deterministic: false } }, [])).toEqual([]);
    });
});
