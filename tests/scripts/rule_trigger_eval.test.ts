// Tests for src/scripts/rule_trigger_eval.ts (road-to-tested-routing Phase 4).
//
// Dry-run (MockRouter) coverage only — no live network calls, no key, no
// spend. Covers: rule-catalog build (kernel excluded, frontmatter
// descriptions), the routing-matrix-derived suite (shape, determinism,
// cap), the scoring math (precision/recall via compute_metrics), the
// end-to-end dry-run plumbing, and the injectable rules prompt header on
// the fetch routers.
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

import {
    DEFAULT_MAX_CASES,
    RULES_PROMPT_HEADER,
    build_rule_catalog,
    derive_rule_cases,
    fnv1a,
    run_rule_eval,
    run_rules_mode,
    type RuleCase,
} from '../../src/scripts/rule_trigger_eval.js';
import { MockRouter } from '../../src/scripts/skill_trigger_eval.js';
import { RULES_MODE_FLOOR } from '../../src/scripts/_lib/trigger_eval_floors.js';
import { AnthropicFetchRouter, type FetchImpl } from '../../src/scripts/_lib/trigger_routers.js';

const REPO_ROOT = join(__dirname, '..', '..');
const ROUTER_JSON = join(REPO_ROOT, 'dist', 'router.json');
const TMP_DIRS: string[] = [];

afterAll(() => {
    for (const d of TMP_DIRS) {
        fs.rmSync(d, { recursive: true, force: true });
    }
});

function tmpDir(label: string): string {
    const d = fs.mkdtempSync(join(tmpdir(), `rule-eval-${label}-`));
    TMP_DIRS.push(d);
    return d;
}

describe('build_rule_catalog — id + frontmatter description, kernel excluded', () => {
    const catalog = build_rule_catalog();
    const router = JSON.parse(fs.readFileSync(ROUTER_JSON, 'utf-8')) as {
        kernel: string[];
        tier_1: Array<{ id: string }>;
        tier_2: Array<{ id: string }>;
    };

    it('contains exactly the tier_1 + tier_2 ids, sorted', () => {
        const expected = [...router.tier_1, ...router.tier_2].map((e) => e.id).sort();
        expect(catalog.map((r) => r.name)).toEqual(expected);
    });

    it('excludes every kernel rule (kernel always loads — nothing to route)', () => {
        const names = new Set(catalog.map((r) => r.name));
        for (const id of router.kernel) {
            expect(names.has(id)).toBe(false);
        }
    });

    it('carries a non-empty description per rule', () => {
        for (const r of catalog) {
            expect(r.description.length).toBeGreaterThan(0);
        }
    });
});

describe('derive_rule_cases — routing-matrix-derived suite', () => {
    const catalog = build_rule_catalog();

    it('caps at the default ~40 cases, deterministically', () => {
        const a = derive_rule_cases(catalog);
        const b = derive_rule_cases(catalog);
        expect(a).toHaveLength(DEFAULT_MAX_CASES);
        expect(a).toEqual(b); // no Math.random anywhere
    });

    it('only scores rules present in the catalogue and includes both kinds', () => {
        const cases = derive_rule_cases(catalog);
        const names = new Set(catalog.map((r) => r.name));
        for (const c of cases) {
            expect(names.has(c.rule)).toBe(true);
            expect(c.q.length).toBeGreaterThan(0);
        }
        // Hash-order sampling spreads across positives AND near-misses.
        expect(cases.some((c) => c.expected)).toBe(true);
        expect(cases.some((c) => !c.expected)).toBe(true);
    });

    it('maps positives → expected consult and near-misses → expected no-consult', () => {
        const matrixDir = tmpDir('matrix');
        fs.writeFileSync(
            join(matrixDir, 'rule-a.yaml'),
            [
                'rule: rule-a',
                'positives:',
                '  - prompt: "please do the a thing"',
                'near_misses:',
                '  - prompt: "something adjacent"',
                '',
            ].join('\n'),
        );
        fs.writeFileSync(
            join(matrixDir, 'unknown-rule.yaml'),
            ['rule: unknown-rule', 'positives:', '  - prompt: "ignored — not in catalogue"', ''].join('\n'),
        );
        const miniCatalog = [{ name: 'rule-a', description: 'the a rule' }];
        const cases = derive_rule_cases(miniCatalog, matrixDir, 40);
        expect(cases).toHaveLength(2);
        const positive = cases.find((c) => c.expected) as RuleCase;
        const nearMiss = cases.find((c) => !c.expected) as RuleCase;
        expect(positive).toMatchObject({ rule: 'rule-a', q: 'please do the a thing' });
        expect(nearMiss).toMatchObject({ rule: 'rule-a', q: 'something adjacent' });
    });

    it('fnv1a is stable and 32-bit', () => {
        expect(fnv1a('abc')).toBe(fnv1a('abc'));
        expect(fnv1a('abc')).not.toBe(fnv1a('abd'));
        expect(fnv1a('abc')).toBeGreaterThanOrEqual(0);
        expect(fnv1a('abc')).toBeLessThanOrEqual(0xffffffff);
    });
});

describe('run_rule_eval — scoring math (MockRouter, no spend)', () => {
    const catalog = [
        { name: 'rule-a', description: 'a' },
        { name: 'rule-b', description: 'b' },
    ];
    const cases: RuleCase[] = [
        { rule: 'rule-a', q: 'p1', expected: true },
        { rule: 'rule-a', q: 'p2', expected: false },
        { rule: 'rule-b', q: 'p3', expected: true },
        { rule: 'rule-b', q: 'p4', expected: false },
    ];

    it('scores a perfect oracle at precision=1 recall=1', async () => {
        const oracle = new MockRouter((q) =>
            cases.filter((c) => c.q === q && c.expected).map((c) => c.rule),
        );
        const result = await run_rule_eval(cases, oracle, catalog, 'mock-model');
        expect(result.metrics).toMatchObject({
            true_positive: 2,
            false_positive: 0,
            true_negative: 2,
            false_negative: 0,
            precision: 1.0,
            recall: 1.0,
        });
        expect(result.cases.every((c) => c.passed)).toBe(true);
    });

    it('scores an always-everything router with FPs on every near-miss', async () => {
        const greedy = new MockRouter((_q, rules) => rules.map((r) => r.name));
        const result = await run_rule_eval(cases, greedy, catalog, 'mock-model');
        expect(result.metrics).toMatchObject({
            true_positive: 2,
            false_positive: 2,
            false_negative: 0,
            recall: 1.0,
            precision: 0.5,
        });
    });

    it('scores an always-silent router with FNs on every positive', async () => {
        const silent = new MockRouter(() => []);
        const result = await run_rule_eval(cases, silent, catalog, 'mock-model');
        expect(result.metrics).toMatchObject({
            true_positive: 0,
            false_negative: 2,
            true_negative: 2,
            recall: 0.0,
        });
    });
});

describe('run_rules_mode — dry-run plumbing end-to-end', () => {
    it('runs the derived suite, writes the result JSON, never fails on floors', async () => {
        const out = join(tmpDir('out'), 'rules-mode.json');
        const summary = await run_rules_mode({ dryRun: true, out, maxCases: 12 });
        expect(summary.dry_run).toBe(true);
        expect(summary.result.mode).toBe('rules');
        expect(summary.result.cases).toHaveLength(12);
        expect(summary.result.catalogue_size).toBeGreaterThan(0);
        const written = JSON.parse(fs.readFileSync(out, 'utf-8')) as { mode: string; cases: unknown[] };
        expect(written.mode).toBe('rules');
        expect(written.cases).toHaveLength(12);
        // floor_passed is REPORTED in dry-run but never gates — the CLI exits 0
        // regardless; here we only assert the field is a boolean.
        expect(typeof summary.floor_passed).toBe('boolean');
    });

    it('advisory floor constants are sane (0 < floor <= 1)', () => {
        expect(RULES_MODE_FLOOR.minPrecision).toBeGreaterThan(0);
        expect(RULES_MODE_FLOOR.minPrecision).toBeLessThanOrEqual(1);
        expect(RULES_MODE_FLOOR.minRecall).toBeGreaterThan(0);
        expect(RULES_MODE_FLOOR.minRecall).toBeLessThanOrEqual(1);
    });
});

describe('rules prompt header — injected into fetch routers, transport reused', () => {
    it('AnthropicFetchRouter sends the rules header when injected', async () => {
        let capturedBody: string | undefined;
        const fetchImpl: FetchImpl = async (_url, init) => {
            capturedBody = init.body;
            return {
                ok: true,
                status: 200,
                json: async () => ({
                    content: [{ text: '{"would_load":["rule-a"]}' }],
                    usage: { input_tokens: 10, output_tokens: 5 },
                }),
            };
        };
        const router = new AnthropicFetchRouter({
            apiKey: 'k',
            fetchImpl,
            promptHeader: RULES_PROMPT_HEADER,
        });
        const [loaded] = await router.routeAsync('some prompt', [
            { name: 'rule-a', description: 'the a rule' },
        ]);
        expect(loaded).toEqual(['rule-a']);
        const body = JSON.parse(capturedBody as string) as { system: string };
        expect(body.system.startsWith(RULES_PROMPT_HEADER)).toBe(true);
        expect(body.system).toContain('- rule-a :: the a rule');
    });

    it('AnthropicFetchRouter keeps the skill header when none is injected', async () => {
        let capturedBody: string | undefined;
        const fetchImpl: FetchImpl = async (_url, init) => {
            capturedBody = init.body;
            return { ok: true, status: 200, json: async () => ({}) };
        };
        const router = new AnthropicFetchRouter({ apiKey: 'k', fetchImpl });
        await router.routeAsync('q', [{ name: 'a', description: 'd' }]);
        const body = JSON.parse(capturedBody as string) as { system: string };
        expect(body.system).toContain('skill-routing oracle');
    });
});
