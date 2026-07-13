/**
 * check_consumer_scope_flip.ts — deterministic held-quality verification for
 * the consumer-scoped rule-projection default flip
 * (road-to-request-scoped-rule-load Phase 1 human gate, approved 2026-07-13).
 *
 * The LLM-paired judge path is CLOSED-BY-DIAGNOSIS (docs/benchmark.md § Length-
 * neutral judge RERUN); the recorded re-open path is deterministic verification.
 * For THIS lever it is exact, not sampled: scoping only REMOVES whole rules —
 * it never edits a shipped body — so output quality on the consumer surface is
 * held by construction iff NO rule the consumer golden set exercises is
 * removed. That is a decidable set inclusion, checked here:
 *
 *   1. The template's flipped `projection.rule_workspaces` default excludes
 *      ONLY exclusively-maintainer rules (workspaces == [agent-config-
 *      maintainer]) plus the recorded compat exclusion (source-of-truth.md).
 *   2. Every rule tagged by any golden-set task (internal/bench/corpora/
 *      token-quality-golden.yaml, 90/90 labelled) still arrives, UNLESS that
 *      rule is exclusively-maintainer (then the task is maintainer-scope by
 *      the schema's own definition: consumer = kernel + every rule not
 *      exclusively maintainer).
 *   3. The before/after evidence (rule count + cl100k tokens via
 *      _lib/token_count.ts) is recomputed over the SHIPPED dist rule tree and
 *      written to internal/bench/reports/.
 *
 * Exit 0 = flip verified; exit 1 = violation (a consumer-relevant rule would
 * drop — the flip must not ship).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { parse as parseYaml } from 'yaml';

import { excludedRuleBasenames, ruleScopeFromSettings } from '../install/rule_scope.js';

export const RULES_DIR = 'dist/agent-src/rules';
export const TEMPLATE = 'src/config/agent-settings.template.yml';
export const GOLDEN = 'internal/bench/corpora/token-quality-golden.yaml';
export const REPORT = 'internal/bench/reports/2026-07-13-consumer-scoped-default-flip.json';

/** workspaces: frontmatter list of a rule file ([] when untagged). */
export function rule_workspaces(rulePath: string): string[] {
    const src = fs.readFileSync(rulePath, 'utf-8');
    const m = src.match(/^---\n([\s\S]*?)\n---/);
    if (!m) return [];
    const meta = parseYaml(m[1] ?? '') as Record<string, unknown>;
    const ws = meta['workspaces'];
    return Array.isArray(ws) ? ws.map((w) => String(w)) : [];
}

export function is_exclusively_maintainer(ws: string[]): boolean {
    return ws.length === 1 && ws[0] === 'agent-config-maintainer';
}

export interface FlipVerdict {
    scope: string[];
    excluded: string[];
    violations: string[]; // excluded rules that are NOT exclusively-maintainer/compat
    golden_rules_total: number;
    golden_rules_dropped: string[]; // golden-tagged rules that would drop (non-maintainer)
    pass: boolean;
}

export function verify_flip(repoRoot = '.'): FlipVerdict {
    const template = parseYaml(fs.readFileSync(path.join(repoRoot, TEMPLATE), 'utf-8')) as Record<string, unknown>;
    const scope = ruleScopeFromSettings(template);
    if (scope.workspaces === null) {
        throw new Error('template rule_workspaces is empty — nothing flipped, nothing to verify');
    }
    const rulesDir = path.join(repoRoot, RULES_DIR);
    const excluded = excludedRuleBasenames(rulesDir, scope);

    const violations: string[] = [];
    for (const name of excluded) {
        if (name === 'source-of-truth.md') continue; // recorded compat exclusion
        const ws = rule_workspaces(path.join(rulesDir, name));
        if (!is_exclusively_maintainer(ws)) {
            violations.push(`${name} [${ws.join(', ')}]`);
        }
    }

    const golden = parseYaml(fs.readFileSync(path.join(repoRoot, GOLDEN), 'utf-8')) as {
        tasks: Array<{ rules?: string[] }>;
    };
    const goldenRules = new Set<string>();
    for (const t of golden.tasks) for (const r of t.rules ?? []) goldenRules.add(r);
    const excludedIds = new Set(excluded.map((n) => n.replace(/\.md$/, '')));
    const goldenDropped: string[] = [];
    for (const r of goldenRules) {
        if (!excludedIds.has(r)) continue;
        const ws = rule_workspaces(path.join(rulesDir, `${r}.md`));
        if (!is_exclusively_maintainer(ws) && r !== 'source-of-truth') {
            goldenDropped.push(r);
        }
    }

    return {
        scope: [...scope.workspaces],
        excluded,
        violations,
        golden_rules_total: goldenRules.size,
        golden_rules_dropped: goldenDropped,
        pass: violations.length === 0 && goldenDropped.length === 0,
    };
}

async function main(): Promise<number> {
    const v = verify_flip();
    const { gpt_tokens } = await import('./_lib/token_count.js');
    const excludedSet = new Set(v.excluded);
    let legacyRules = 0;
    let legacyTok = 0;
    let scopedRules = 0;
    let scopedTok = 0;
    for (const name of fs.readdirSync(RULES_DIR).sort()) {
        if (!name.endsWith('.md')) continue;
        const body = fs.readFileSync(path.join(RULES_DIR, name), 'utf-8');
        const tok = gpt_tokens(body).tokens;
        // legacy-all baseline mirrors the 2026-07-08 report: compat exclusion applies on both arms
        if (name === 'source-of-truth.md') continue;
        legacyRules += 1;
        legacyTok += tok;
        if (!excludedSet.has(name)) {
            scopedRules += 1;
            scopedTok += tok;
        }
    }
    const report = {
        schema_version: 1,
        kind: 'consumer-scoped-default-flip-verification',
        date: '2026-07-13',
        roadmap: 'road-to-request-scoped-rule-load Phase 1 (human gate, approved in-session)',
        tokenizer: 'cl100k_base (js-tiktoken via _lib/token_count.ts)',
        held_quality_arm:
            'deterministic set-inclusion (LLM judging closed-by-diagnosis): scoping removes whole '
            + 'rules only; verified that every removed rule is exclusively-maintainer (+ the recorded '
            + 'source-of-truth compat exclusion) and that zero golden-set-exercised consumer rules drop '
            + '— consumer-surface quality held by construction.',
        scope: { rule_workspaces: v.scope },
        excluded_rules: v.excluded,
        violations: v.violations,
        golden: { rules_tagged: v.golden_rules_total, dropped_non_maintainer: v.golden_rules_dropped },
        legacy_all: { rules: legacyRules, gpt_tokens: legacyTok },
        scoped: { rules: scopedRules, gpt_tokens: scopedTok },
        delta: {
            rules: legacyRules - scopedRules,
            gpt_tokens: legacyTok - scopedTok,
            tokens_pct: Number((((legacyTok - scopedTok) / legacyTok) * 100).toFixed(1)),
        },
        pass: v.pass,
    };
    fs.mkdirSync(path.dirname(REPORT), { recursive: true });
    fs.writeFileSync(REPORT, `${JSON.stringify(report, null, 1)}\n`);
    process.stdout.write(`excluded ${v.excluded.length} rules under scope [${v.scope.join(', ')}]\n`);
    if (v.violations.length > 0) {
        process.stdout.write(`❌  NON-MAINTAINER rules would drop: ${v.violations.join(' · ')}\n`);
    }
    if (v.golden_rules_dropped.length > 0) {
        process.stdout.write(`❌  golden-set rules would drop: ${v.golden_rules_dropped.join(' · ')}\n`);
    }
    process.stdout.write(
        `legacy-all ${legacyRules} rules / ${legacyTok} tok → scoped ${scopedRules} rules / ${scopedTok} tok `
        + `(−${legacyTok - scopedTok} tok, −${report.delta.tokens_pct}%)\n`,
    );
    process.stdout.write(v.pass ? `✅  flip verified — wrote ${REPORT}\n` : '❌  flip NOT verified\n');
    return v.pass ? 0 : 1;
}

const isMain = process.argv[1] !== undefined
    && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) {
    main().then(
        (code) => process.exit(code),
        (err) => {
            process.stderr.write(`${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
            process.exit(1);
        },
    );
}
