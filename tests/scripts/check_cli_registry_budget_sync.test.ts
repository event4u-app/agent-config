import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    collect_findings,
    count_registry_entries,
} from '../../src/scripts/check_cli_registry_budget_sync.js';

const ROOT = join(__dirname, '..', '..');

describe('check_cli_registry_budget_sync — count_registry_entries', () => {
    it('counts entry openers with the pinned umbrella method', () => {
        const src = [
            "const REGISTRY = [",
            "    { name: 'roadmap:progress', disposition: 'run' },",
            "    { name: 'routing:doctor', disposition: 'run' },",
            "];",
            "// a comment mentioning { name: inside prose still counts — pinned method",
        ].join('\n');
        expect(count_registry_entries(src)).toBe(3);
    });

    it('returns 0 on a source with no entries', () => {
        expect(count_registry_entries('export const REGISTRY = [];')).toBe(0);
    });
});

describe('check_cli_registry_budget_sync — collect_findings', () => {
    const inSync = { count: 81, budget: { max: 81, last_measured: 81 }, recorded: 81 };

    it('in-sync inputs produce no findings', () => {
        expect(collect_findings(inSync)).toEqual([]);
    });

    it('registry moved without budget or record → three findings', () => {
        const findings = collect_findings({ ...inSync, count: 82 });
        expect(findings).toHaveLength(3);
        expect(findings[0]).toContain('last_measured says 81');
        expect(findings[1]).toContain('max is 81');
        expect(findings[2]).toContain('committed record says 81');
    });

    it('stale committed record alone is a finding', () => {
        const findings = collect_findings({ ...inSync, recorded: 80 });
        expect(findings).toEqual([
            'registry has 81 entries but the committed record says 80',
        ]);
    });

    it('missing budget entry fails closed', () => {
        const findings = collect_findings({ count: 81, budget: undefined, recorded: 81 });
        expect(findings).toEqual([
            'budgets.cli_help_command_count is missing from evaluator-budgets.json',
        ]);
    });

    it('missing record key fails closed', () => {
        const findings = collect_findings({ ...inSync, recorded: undefined });
        expect(findings[0]).toContain('missing from the committed record');
    });
});

describe('check_cli_registry_budget_sync — the real tree is in sync', () => {
    it('registry, budget, and committed record agree right now', () => {
        const count = count_registry_entries(
            readFileSync(join(ROOT, 'src/cli/registry.ts'), 'utf-8'),
        );
        const budgets = JSON.parse(
            readFileSync(join(ROOT, 'src/config/evaluator-budgets.json'), 'utf-8'),
        ) as { budgets: Record<string, { max: number; last_measured: number }> };
        const record = JSON.parse(
            readFileSync(
                join(ROOT, 'agents/evidence/metrics/evaluator-measurements.json'),
                'utf-8',
            ),
        ) as { measurements: Record<string, number> };
        expect(
            collect_findings({
                count,
                budget: budgets.budgets['cli_help_command_count'],
                recorded: record.measurements['cli_help_command_count'],
            }),
        ).toEqual([]);
    });
});
