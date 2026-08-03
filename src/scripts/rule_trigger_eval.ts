#!/usr/bin/env tsx
/**
 * rule_trigger_eval — RULES mode for the live LLM trigger-eval harness
 * (road-to-tested-routing Phase 4, advisory only, never gating).
 *
 * Sibling of `skill_trigger_eval.ts` rather than a `--mode` flag on it: the
 * skill CLI is a byte-for-byte port of the retired Python implementation
 * whose contract ("mirror EXACTLY. No behaviour changes") is pinned by its
 * own test suite, and its /dev/tty confirmation gate must stay untouched.
 * This script REUSES its abstractions (SkillMeta shape, MockRouter,
 * compute_metrics, _extract_field, the fetch routers) and adds only what is
 * rules-specific:
 *
 *   - catalog: rule id + frontmatter description from
 *     `dist/agent-src/rules/<id>.md`, ids from `dist/router.json`
 *     tier_1 + tier_2 (kernel excluded — kernel rules always load, there is
 *     nothing to route);
 *   - suite: derived from `tests/eval/routing-matrix/*.yaml` — each positive
 *     becomes a case expecting its rule to be consulted, each near-miss a
 *     case expecting it NOT to be; capped deterministically (FNV-1a hash
 *     order, no Math.random) so a live run stays affordable;
 *   - question: "which rules would you consult for this prompt", answered as
 *     the same `{"would_load": [...]}` JSON the routers already parse.
 *
 * Boundaries (mirroring `trigger_eval_rotation.ts`):
 * - The local interactive `skill_trigger_eval` CLI and its /dev/tty
 *   confirmation gate are untouched — this script is the CI-only live path;
 *   live authorization derives exclusively from the key file the canary
 *   workflow materializes from repo secrets. No env-var key fallback.
 * - `--dry-run` (MockRouter, no key, no spend) exercises the plumbing only;
 *   the advisory floor is REPORTED but never fails the run.
 * - A live floor breach fails the SCHEDULED canary job only — PRs are never
 *   blocked by live results.
 *
 * Exit codes: 0 pass (always, in --dry-run) · 1 live floor breach ·
 * 2 usage / IO error.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { parse as parseYaml } from 'yaml';

import {
    MockRouter,
    _extract_field,
    compute_metrics,
    type Metrics,
    type SkillMeta,
    type TriggerRouter,
} from './skill_trigger_eval.js';
import { AnthropicFetchRouter, loadKeyFromFile } from './_lib/trigger_routers.js';
import { RULES_MODE_FLOOR } from './_lib/trigger_eval_floors.js';

const _HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(_HERE, '..', '..');
const ROUTER_JSON = path.join(REPO_ROOT, 'dist', 'router.json');
const RULES_DIR = path.join(REPO_ROOT, 'dist', 'agent-src', 'rules');
const MATRIX_DIR = path.join(REPO_ROOT, 'tests', 'eval', 'routing-matrix');
const DEFAULT_OUT = path.join(
    REPO_ROOT,
    'internal',
    'evals',
    'results',
    'rotation',
    'rules-mode.json',
);
export const DEFAULT_MAX_CASES = 40;
export const DEFAULT_RULES_MODEL = 'claude-haiku-4-5-20251001';

/** A rule catalogue entry is structurally a SkillMeta (name = rule id). */
export type RuleMeta = SkillMeta;

/** Router that may expose an async route (fetch-based live routers). */
type AsyncCapableRouter = TriggerRouter & {
    routeAsync?: (query: string, skills: SkillMeta[]) => Promise<[string[], number, number]>;
};

export const RULES_PROMPT_HEADER = `You are a rule-routing oracle. Given the rule catalogue below
and a single user prompt, return ONLY the JSON object {"would_load": [...]}
listing the rule ids you would consult before acting on the prompt.

Rules:
- Use the rule description verbatim as the only routing signal.
- Return at most 6 rule ids.
- If no rule applies, return {"would_load": []}.
- Output ONLY the JSON. No prose, no code fences.

Rule catalogue (id :: description):
`;

// ── Catalog ──────────────────────────────────────────────────────────────

/**
 * Build the rule catalogue: tier_1 + tier_2 ids from `dist/router.json`
 * (kernel excluded — kernel always loads), description from the rule file's
 * frontmatter. A rule whose file or description is missing is a build error:
 * the projection guarantees both, so a gap means the inputs are stale.
 */
export function build_rule_catalog(
    routerJsonPath: string = ROUTER_JSON,
    rulesDir: string = RULES_DIR,
): RuleMeta[] {
    const router = JSON.parse(fs.readFileSync(routerJsonPath, 'utf-8')) as {
        tier_1?: Array<{ id?: unknown }>;
        tier_2?: Array<{ id?: unknown }>;
    };
    const ids: string[] = [];
    for (const tier of [router.tier_1, router.tier_2]) {
        if (!Array.isArray(tier)) continue;
        for (const entry of tier) {
            if (typeof entry?.id === 'string' && entry.id) ids.push(entry.id);
        }
    }
    ids.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const catalog: RuleMeta[] = [];
    for (const id of ids) {
        const rulePath = path.join(rulesDir, `${id}.md`);
        const text = fs.readFileSync(rulePath, 'utf-8');
        if (!text.startsWith('---')) {
            throw new Error(`${rulePath}: no frontmatter`);
        }
        const end = text.indexOf('\n---', 3);
        if (end < 0) {
            throw new Error(`${rulePath}: unterminated frontmatter`);
        }
        const description = _extract_field(text.slice(3, end), 'description');
        if (description === null || description === '') {
            throw new Error(`${rulePath}: frontmatter has no description`);
        }
        catalog.push({ name: id, description });
    }
    return catalog;
}

// ── Derived suite ────────────────────────────────────────────────────────

export interface RuleCase {
    /** Rule id under test for this case. */
    rule: string;
    /** The user prompt sent to the router. */
    q: string;
    /** true = positive (rule must be consulted) · false = near-miss (must not). */
    expected: boolean;
}

/** FNV-1a 32-bit — deterministic sampling key (no Math.random). */
export function fnv1a(s: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i += 1) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
}

/**
 * Derive the eval suite from the routing-matrix fixtures: positive →
 * expected [rule], near_miss → expected []. Only rules present in the
 * catalogue are scored. Capped at `maxCases` by sorting on the FNV-1a hash
 * of `rule|kind|prompt` (prompt as tiebreak) and taking the head — a
 * deterministic pseudo-shuffle that spreads the sample across rules and
 * both case kinds instead of favouring the alphabet.
 */
export function derive_rule_cases(
    catalog: readonly RuleMeta[],
    matrixDir: string = MATRIX_DIR,
    maxCases: number = DEFAULT_MAX_CASES,
): RuleCase[] {
    const known = new Set(catalog.map((r) => r.name));
    let files: string[];
    try {
        files = fs.readdirSync(matrixDir).filter((n) => n.endsWith('.yaml'));
    } catch {
        return [];
    }
    files.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const cases: RuleCase[] = [];
    for (const file of files) {
        const doc = parseYaml(fs.readFileSync(path.join(matrixDir, file), 'utf-8')) as {
            rule?: unknown;
            positives?: Array<{ prompt?: unknown }>;
            near_misses?: Array<{ prompt?: unknown }>;
        } | null;
        const rule = typeof doc?.rule === 'string' ? doc.rule : '';
        if (!rule || !known.has(rule)) continue;
        for (const [items, expected] of [
            [doc?.positives, true],
            [doc?.near_misses, false],
        ] as const) {
            if (!Array.isArray(items)) continue;
            for (const item of items) {
                if (typeof item?.prompt === 'string' && item.prompt.trim()) {
                    cases.push({ rule, q: item.prompt, expected });
                }
            }
        }
    }
    cases.sort((a, b) => {
        const ha = fnv1a(`${a.rule}|${a.expected ? 'pos' : 'near'}|${a.q}`);
        const hb = fnv1a(`${b.rule}|${b.expected ? 'pos' : 'near'}|${b.q}`);
        if (ha !== hb) return ha - hb;
        return a.q < b.q ? -1 : a.q > b.q ? 1 : 0;
    });
    return cases.slice(0, Math.max(0, maxCases));
}

// ── Eval ─────────────────────────────────────────────────────────────────

export interface RuleCaseResult {
    rule: string;
    q: string;
    expected: boolean;
    observed: boolean;
    consulted: string[];
    passed: boolean;
}

export interface RuleEvalResult {
    mode: 'rules';
    model: string;
    timestamp: string;
    router: string;
    catalogue_size: number;
    cases: RuleCaseResult[];
    metrics: Metrics;
    input_tokens: number;
    output_tokens: number;
}

/** Run the derived suite through a router (awaiting routeAsync when present). */
export async function run_rule_eval(
    cases: readonly RuleCase[],
    router: AsyncCapableRouter,
    catalog: readonly RuleMeta[],
    model: string,
): Promise<RuleEvalResult> {
    const result: RuleEvalResult = {
        mode: 'rules',
        model,
        timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, '+00:00'),
        router: router.name,
        catalogue_size: catalog.length,
        cases: [],
        metrics: compute_metrics([]),
        input_tokens: 0,
        output_tokens: 0,
    };
    for (const c of cases) {
        const [consulted, inTok, outTok] =
            typeof router.routeAsync === 'function'
                ? await router.routeAsync(c.q, [...catalog])
                : router.route(c.q, [...catalog]);
        const observed = consulted.includes(c.rule);
        result.cases.push({
            rule: c.rule,
            q: c.q,
            expected: c.expected,
            observed,
            consulted: [...consulted].sort(),
            passed: observed === c.expected,
        });
        result.input_tokens += inTok;
        result.output_tokens += outTok;
    }
    result.metrics = compute_metrics(
        result.cases.map((c) => ({
            q: c.q,
            expected: c.expected,
            observed: c.observed,
            loaded_skills: c.consulted,
            passed: c.passed,
        })),
    );
    return result;
}

// ── CLI ──────────────────────────────────────────────────────────────────

export interface RuleEvalOptions {
    dryRun?: boolean;
    model?: string;
    out?: string;
    maxCases?: number;
    /** Injectable router (tests). Default: MockRouter (dry) / AnthropicFetchRouter (live). */
    router?: AsyncCapableRouter;
    routerJsonPath?: string;
    rulesDir?: string;
    matrixDir?: string;
}

export interface RuleEvalSummary {
    result: RuleEvalResult;
    dry_run: boolean;
    floor_passed: boolean;
    out: string;
}

export async function run_rules_mode(opts: RuleEvalOptions = {}): Promise<RuleEvalSummary> {
    const dryRun = opts.dryRun ?? false;
    const model = opts.model ?? DEFAULT_RULES_MODEL;
    const out = opts.out ?? DEFAULT_OUT;
    const catalog = build_rule_catalog(opts.routerJsonPath, opts.rulesDir);
    const cases = derive_rule_cases(catalog, opts.matrixDir, opts.maxCases ?? DEFAULT_MAX_CASES);
    if (cases.length === 0) {
        throw new Error('rules mode: derived suite is empty (no routing-matrix cases)');
    }
    const router: AsyncCapableRouter =
        opts.router ??
        (dryRun
            ? new MockRouter((q, rules) =>
                  rules.filter((r) => q.toLowerCase().includes(r.name)).map((r) => r.name),
              )
            : (new AnthropicFetchRouter({
                  apiKey: loadKeyFromFile('anthropic.key'),
                  model,
                  promptHeader: RULES_PROMPT_HEADER,
              }) as AsyncCapableRouter));

    const result = await run_rule_eval(cases, router, catalog, model);
    const floorPassed =
        result.metrics.precision >= RULES_MODE_FLOOR.minPrecision &&
        result.metrics.recall >= RULES_MODE_FLOOR.minRecall;

    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(result, null, 2) + '\n', 'utf-8');

    return { result, dry_run: dryRun, floor_passed: floorPassed, out };
}

function parse_args(argv: string[]): RuleEvalOptions & { help?: boolean } {
    const out: RuleEvalOptions & { help?: boolean } = {};
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i] as string;
        const take = (): string => {
            const v = argv[++i];
            if (v === undefined) {
                process.stderr.write(`rule_trigger_eval: error: argument ${a}: expected one argument\n`);
                process.exit(2);
            }
            return v as string;
        };
        if (a === '--dry-run') out.dryRun = true;
        else if (a === '--model') out.model = take();
        else if (a === '--out') out.out = path.resolve(take());
        else if (a === '--max-cases') out.maxCases = Number(take());
        else if (a === '-h' || a === '--help') out.help = true;
        else {
            process.stderr.write(`rule_trigger_eval: error: unrecognized arguments: ${a}\n`);
            process.exit(2);
        }
    }
    if (out.maxCases !== undefined && (!Number.isInteger(out.maxCases) || out.maxCases <= 0)) {
        process.stderr.write('rule_trigger_eval: error: --max-cases must be a positive integer\n');
        process.exit(2);
    }
    return out;
}

export async function main(argv?: string[]): Promise<number> {
    const opts = parse_args(argv ?? process.argv.slice(2));
    if (opts.help) {
        process.stdout.write(
            'usage: rule_trigger_eval [--dry-run] [--model MODEL] [--out FILE]\n' +
                '                         [--max-cases N]\n',
        );
        return 0;
    }
    let summary: RuleEvalSummary;
    try {
        summary = await run_rules_mode(opts);
    } catch (err) {
        process.stderr.write(`❌  rule_trigger_eval: ${err instanceof Error ? err.message : String(err)}\n`);
        return 2;
    }
    const m = summary.result.metrics;
    process.stdout.write(
        `rules-mode trigger eval · ${summary.result.cases.length} cases over ` +
            `${summary.result.catalogue_size} rules (kernel excluded)` +
            `${summary.dry_run ? ' · DRY-RUN (floor advisory)' : ''}\n` +
            `  precision ${m.precision} (floor ${RULES_MODE_FLOOR.minPrecision}) · ` +
            `recall ${m.recall} (floor ${RULES_MODE_FLOOR.minRecall}) · ${summary.out}\n`,
    );
    for (const c of summary.result.cases) {
        if (c.passed) continue;
        process.stdout.write(
            `  ❌ [${c.expected ? 'FN' : 'FP'}] ${c.rule} :: ${c.q}\n`,
        );
    }
    if (!summary.floor_passed && !summary.dry_run) {
        process.stderr.write(
            '❌  rules-mode metrics below advisory floor — fails the scheduled canary job only, never a PR.\n',
        );
        return 1;
    }
    process.stdout.write('✅  rules-mode eval complete\n');
    return 0;
}

const argvUrl = process.argv[1] === undefined ? '' : pathToFileURL(path.resolve(process.argv[1])).href;
if (import.meta.url === argvUrl) {
    main().then((code) => process.exit(code));
}
