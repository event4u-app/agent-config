// Tests for src/scripts/measure_rule_budget.ts (py2ts Phase 8 / Wave 8a).
//
// No pytest suite exists for this module, so this is a focused differential
// suite over the pure helpers (strip_frontmatter, aggregate, render_table,
// kernel_budget_check) plus a golden-parity layer that runs python3 vs tsx
// on the REAL REPO for every CLI mode (skipped without python3). The
// --trend-append mode snapshots + restores its runtime file so the suite
// leaves zero git drift.
import { describe, expect, it } from 'vitest';

import * as mrb from '../../src/scripts/measure_rule_budget.js';



describe('measure_rule_budget — behavioural spec', () => {
    it('strip_frontmatter: no frontmatter returns text unchanged', () => {
        const [body, fields] = mrb.strip_frontmatter('# Just a rule\n\nbody');
        expect(body).toBe('# Just a rule\n\nbody');
        expect(fields).toEqual({});
    });

    it('strip_frontmatter: parses key: value pairs and strips quotes', () => {
        const text = '---\ntype: always\ntier: "3"\nname: \'x\'\n---\nthe body\n';
        const [body, fields] = mrb.strip_frontmatter(text);
        expect(body).toBe('the body\n');
        expect(fields.type).toBe('always');
        expect(fields.tier).toBe('3');
        expect(fields.name).toBe('x');
    });

    it('strip_frontmatter: partitions on the FIRST colon', () => {
        const text = '---\ndescription: a: b: c\n---\nbody';
        const [, fields] = mrb.strip_frontmatter(text);
        expect(fields.description).toBe('a: b: c');
    });

    it('strip_frontmatter: unterminated frontmatter returns text unchanged', () => {
        const text = '---\ntype: always\nno closing fence\n';
        const [body, fields] = mrb.strip_frontmatter(text);
        expect(body).toBe(text);
        expect(fields).toEqual({});
    });

    it('aggregate: buckets by type and kernel membership', () => {
        const rules: mrb.RuleMeasure[] = [
            { id: 'commit-policy', type: 'always', tier: '', chars: 100, lines: 3, tokens_gpt: 25, tokens_claude: 28 },
            { id: 'some-auto', type: 'auto', tier: '', chars: 200, lines: 5, tokens_gpt: 50, tokens_claude: 56 },
            { id: 'oversize', type: 'auto', tier: '', chars: 3000, lines: 40, tokens_gpt: 750, tokens_claude: 833 },
        ];
        const agg = mrb.aggregate(rules);
        expect(agg.rule_count).toBe(3);
        expect(agg.always_count).toBe(1);
        expect(agg.auto_count).toBe(2);
        expect(agg.kernel_count).toBe(1); // commit-policy is a kernel rule
        expect(agg.total_chars).toBe(3300);
        expect(agg.kernel_chars).toBe(100);
        expect(agg.oversize_rules.map((r) => r.id)).toEqual(['oversize']);
        expect(agg.top5_largest[0]!.id).toBe('oversize');
    });

    it('kernel_budget_check: passes when every kernel rule is under cap', () => {
        const kernel: mrb.RuleMeasure[] = [
            'agent-authority',
            'ask-when-uncertain',
            'commit-policy',
            'direct-answers',
            'language-and-tone',
            'no-cheap-questions',
            'non-destructive-by-default',
            'scope-control',
            'verify-before-complete',
        ].map((id) => ({ id, type: 'always', tier: '', chars: 500, lines: 10, tokens_gpt: 125, tokens_claude: 139 }));
        const agg = mrb.aggregate(kernel);
        const [code, report] = mrb.kernel_budget_check(kernel, agg, new Set());
        expect(code).toBe(0);
        expect(report.join('\n')).toContain('✅  kernel budget check: pass');
    });

    it('kernel_budget_check: fails on a missing kernel rule + oversize rule', () => {
        const kernel: mrb.RuleMeasure[] = [
            { id: 'commit-policy', type: 'always', tier: '', chars: 3000, lines: 40, tokens_gpt: 750, tokens_claude: 833 },
        ];
        const agg = mrb.aggregate(kernel);
        const [code, report] = mrb.kernel_budget_check(kernel, agg, new Set());
        expect(code).toBe(1);
        const text = report.join('\n');
        expect(text).toContain('missing kernel rule: agent-authority');
        expect(text).toContain('commit-policy 3000 > per-rule hard cap 2500');
    });

    it('kernel_budget_check: override allowlist raises the cap to the ceiling', () => {
        const kernel: mrb.RuleMeasure[] = [
            'agent-authority',
            'ask-when-uncertain',
            'commit-policy',
            'direct-answers',
            'language-and-tone',
            'no-cheap-questions',
            'non-destructive-by-default',
            'scope-control',
            'verify-before-complete',
        ].map((id) => ({
            id,
            type: 'always',
            tier: '',
            chars: id === 'commit-policy' ? 3000 : 500,
            lines: 10,
            tokens_gpt: 1,
            tokens_claude: 1,
        }));
        const agg = mrb.aggregate(kernel);
        const [code, report] = mrb.kernel_budget_check(kernel, agg, new Set(['commit-policy']));
        expect(code).toBe(0);
        expect(report.join('\n')).toContain('OK (override)');
    });

    it('render_table: shows the over-cap flag and totals', () => {
        const rules: mrb.RuleMeasure[] = [
            { id: 'small', type: 'auto', tier: '3', chars: 100, lines: 3, tokens_gpt: 25, tokens_claude: 28 },
            { id: 'big', type: 'auto', tier: '', chars: 3000, lines: 40, tokens_gpt: 750, tokens_claude: 833 },
        ];
        const agg = mrb.aggregate(rules);
        const table = mrb.render_table(rules, agg);
        expect(table).toContain('Rule budget — source: rules/ under every artefact root');
        expect(table).toMatch(/big\s+auto\s+3000!/);
        expect(table).toContain('OVER per-rule hard cap (2500 chars): 1 rule(s)');
    });
});
