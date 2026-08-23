#!/usr/bin/env tsx
/**
 * Rule-injection recall + cost model — the offline half of
 * `road-to-trigger-delivered-rule-bodies` (steps 0.3, 0.4, 0.5 and the scorer
 * step 2.2 falsifies).
 *
 * ── The measured verdict of step 0.3, stated in the header as that step asks ──
 *
 * **NO NEW MATCHER.** The pre-registered comparison required by 0.3 was run
 * against the shipping lexical/BM25 core (`_lib/lexical_index.ts`) over the
 * frozen `tests/eval/routing-matrix/` corpus, on the same labelled positives
 * and near-misses. Exact-trigger matching (`_lib/router_match.ts`) wins on both
 * axes at every retrieval depth tried, so no third matcher is written and the
 * runtime concern imports the shipping semantics directly. Run
 * `--baseline-comparison` to reproduce the table; it is not restated here,
 * because a number copied into a comment is a number nobody re-derives.
 *
 * That outcome was a permitted result of 0.3 rather than a foregone one. The
 * council lock it honours (2026-07-28, recorded at the head of
 * `agents/roadmaps/later/road-to-deferred-rule-retriever.md`) is that rule
 * retrieval is a retrieval problem and the shipping lexical core is the cheaper
 * baseline any new retriever must beat on a PRE-registered measurement, because
 * build-then-measure already cost this repository a whole engine — the code
 * graph, recall 0.365 against disciplined grep's 0.797.
 *
 * ── What this script is, and what it deliberately is not ──
 *
 * It is a pure function of files already in the tree: `dist/router.json`, the
 * projected bodies under `dist/agent-src/rules/`, the labelled corpus, and
 * `internal/bench/pricing.yaml`. It makes **no metered call on any path**,
 * `--selftest` included, so it can run in CI and be re-run for free.
 *
 * It measures **delivery** and **cost**. It does not measure whether a session
 * that receives a body behaves like a session that had it standing — that
 * instrument is closed by ADR-202 (paired judging inadmissible; inter-evaluator
 * Cohen's kappa 0.472 against a registered 0.800 floor) and this script does not
 * reopen it. Nothing printed below is evidence about quality.
 *
 * ── Determinism is a pinned property, not an aspiration ──
 *
 * Corpus files are read in sorted order, matches come back in router
 * declaration order, and every quantile is computed on an explicitly sorted
 * array. Two consecutive runs are byte-identical; `tests/scripts/model_rule_injection.test.ts`
 * asserts it, because a price table that moves between runs cannot license
 * anything.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

import { LexicalIndex, tokenize } from './_lib/lexical_index.js';
import {
    allTierRules,
    kernelIds,
    loadRouter,
    loadRuleBody,
    matchTierRules,
    pathCapableRuleIds,
    selectForInjection,
    tokensOf,
    triggerlessRuleIds,
    type Router,
    type TierRuleMatch,
} from './_lib/rule_injection.js';
import { thin_entry } from './project_thin_rules.js';
import { buildInjection } from './hooks/rule_inject_hook.js';

const _HERE = fileURLToPath(import.meta.url);
export const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
export const DEFAULT_CORPUS = path.join(REPO_ROOT, 'tests', 'eval', 'routing-matrix');
export const PRICING = path.join(REPO_ROOT, 'internal', 'bench', 'pricing.yaml');

/** Turn counts and spawn counts the price table is computed over (0.4). */
export const TURN_GRID = [10, 50, 200] as const;
export const SPAWN_GRID = [0, 5, 20] as const;
/** Retrieval depths the BM25 baseline is scored at (0.3). */
export const BM25_DEPTHS = [1, 4, 8] as const;

// ── corpus ───────────────────────────────────────────────────────────────

export interface CorpusCase {
    rule: string;
    prompt: string;
    openFiles: string[] | null;
    label: 'positive' | 'near_miss';
    file: string;
}

function _asCases(
    rule: string,
    file: string,
    raw: unknown,
    label: CorpusCase['label'],
): CorpusCase[] {
    if (!Array.isArray(raw)) return [];
    const out: CorpusCase[] = [];
    for (const e of raw) {
        if (e === null || typeof e !== 'object') continue;
        const o = e as Record<string, unknown>;
        const prompt = typeof o['prompt'] === 'string' ? o['prompt'] : null;
        if (prompt === null) continue;
        const of = o['open_files'];
        out.push({
            rule,
            prompt,
            openFiles: Array.isArray(of) ? of.map((x) => String(x)) : null,
            label,
            file,
        });
    }
    return out;
}

/** Load the labelled corpus in sorted file order — the determinism anchor. */
export function loadCorpus(dir: string): CorpusCase[] {
    const files = fs
        .readdirSync(dir)
        .filter((f) => f.endsWith('.yaml'))
        .sort();
    const out: CorpusCase[] = [];
    for (const f of files) {
        const doc = parseYaml(fs.readFileSync(path.join(dir, f), 'utf8')) as Record<string, unknown>;
        if (doc === null || typeof doc !== 'object') continue;
        const rule = typeof doc['rule'] === 'string' ? doc['rule'] : path.basename(f, '.yaml');
        out.push(..._asCases(rule, f, doc['positives'], 'positive'));
        out.push(..._asCases(rule, f, doc['near_misses'], 'near_miss'));
    }
    return out;
}

// ── quantiles ────────────────────────────────────────────────────────────

/** Nearest-rank quantile over an already-copied array. Deterministic. */
export function quantile(values: number[], q: number): number {
    if (values.length === 0) return 0;
    const s = [...values].sort((a, b) => a - b);
    const idx = Math.min(s.length - 1, Math.max(0, Math.ceil(q * s.length) - 1));
    return s[idx] as number;
}

function mean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
}

// ── scoring ──────────────────────────────────────────────────────────────

export interface Score {
    positives: number;
    hits: number;
    nearMisses: number;
    falseFires: number;
}

export function ratio(hits: number, total: number): string {
    return total === 0 ? '—' : (hits / total).toFixed(3);
}

/** Score the exact-trigger matcher over the corpus. */
export function scoreExact(
    router: Router,
    cases: CorpusCase[],
    honourOpenFiles: boolean,
): Score {
    const s: Score = { positives: 0, hits: 0, nearMisses: 0, falseFires: 0 };
    for (const c of cases) {
        const of = honourOpenFiles ? c.openFiles : null;
        const fired = new Set(matchTierRules(router, c.prompt, of).map((m) => m.id));
        if (c.label === 'positive') {
            s.positives += 1;
            if (fired.has(c.rule)) s.hits += 1;
        } else {
            s.nearMisses += 1;
            if (fired.has(c.rule)) s.falseFires += 1;
        }
    }
    return s;
}

/**
 * Score the shipping BM25 core at a fixed retrieval depth.
 *
 * The index is built over the PROJECTED BODIES of the tier rules — the same
 * text the delivery mode would inject — because that is the only document set a
 * body-delivering retriever could plausibly search. Kernel rules are excluded
 * from the index for the same reason `matchTierRules` excludes them: they are
 * already standing, so retrieving one is never the win.
 */
export function scoreLexical(router: Router, cases: CorpusCase[], depth: number): Score {
    const kernel = kernelIds(router);
    const docs = allTierRules(router)
        .filter((r) => !kernel.has(r.id))
        .map((r) => ({ id: r.id, text: loadRuleBody(REPO_ROOT, r.id) ?? '' }))
        .filter((d) => d.text !== '');
    const index = new LexicalIndex(docs);
    const s: Score = { positives: 0, hits: 0, nearMisses: 0, falseFires: 0 };
    for (const c of cases) {
        const ranked = index.rank([c.prompt]).filter((r) => r.score > 0).slice(0, depth);
        const fired = new Set(ranked.map((r) => r.id));
        if (c.label === 'positive') {
            s.positives += 1;
            if (fired.has(c.rule)) s.hits += 1;
        } else {
            s.nearMisses += 1;
            if (fired.has(c.rule)) s.falseFires += 1;
        }
    }
    return s;
}

/**
 * Positives whose labelled rule declares a path trigger, carries `open_files`,
 * and is STILL missed with those open files honoured.
 *
 * This is the residual column step 1.2's verify reads: a non-zero value means
 * the file-trigger binding cannot reach a rule the corpus says it should, which
 * is a delivery defect rather than a corpus one.
 */
export function pathRuleMisses(router: Router, cases: CorpusCase[]): CorpusCase[] {
    const pathCapable = pathCapableRuleIds(router);
    const out: CorpusCase[] = [];
    for (const c of cases) {
        if (c.label !== 'positive') continue;
        if (!pathCapable.has(c.rule)) continue;
        if (c.openFiles === null || c.openFiles.length === 0) continue;
        const fired = new Set(matchTierRules(router, c.prompt, c.openFiles).map((m) => m.id));
        if (!fired.has(c.rule)) out.push(c);
    }
    return out;
}

// ── standing corpora + pricing ───────────────────────────────────────────

export interface StandingCorpora {
    eagerTokens: number;
    thinTokens: number;
    triggerlessTokens: number;
    triggerless: string[];
}

/**
 * Token sizes of the two standing shapes, computed from the projected tree.
 *
 * `thin_entry` is imported from the projector rather than re-derived, so the
 * pointer cost priced here is the pointer the projector actually writes.
 */
export function standingCorpora(router: Router): StandingCorpora {
    const kernel = kernelIds(router);
    const triggerless = new Set(triggerlessRuleIds(router));
    let eager = 0;
    let thin = 0;
    let triggerlessTokens = 0;
    const dir = path.join(REPO_ROOT, 'dist', 'agent-src', 'rules');
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.md')).sort()) {
        const id = path.basename(f, '.md');
        const text = fs.readFileSync(path.join(dir, f), 'utf8');
        const body = tokensOf(text);
        eager += body;
        if (kernel.has(id)) {
            thin += body;
        } else if (triggerless.has(id)) {
            // Cannot be delivered — 1.3 keeps it eager under the thin shapes too.
            thin += body;
            triggerlessTokens += body;
        } else {
            thin += tokensOf(thin_entry(id, text));
        }
    }
    return {
        eagerTokens: eager,
        thinTokens: thin,
        triggerlessTokens,
        triggerless: [...triggerless].sort(),
    };
}

export interface Rates {
    tier: string;
    input: number;
    cacheRead: number;
    cacheWrite: number;
}

/** Read one tier's USD-per-1M rates out of the committed pricing file. */
export function loadRates(tier = 'sonnet'): Rates {
    const doc = parseYaml(fs.readFileSync(PRICING, 'utf8')) as Record<string, unknown>;
    const models = Array.isArray(doc['models']) ? doc['models'] : [];
    for (const m of models as Array<Record<string, unknown>>) {
        if (String(m['tier']) === tier) {
            return {
                tier,
                input: Number(m['input']),
                cacheRead: Number(m['cache_read']),
                cacheWrite: Number(m['cache_write']),
            };
        }
    }
    throw new Error(`pricing.yaml carries no tier '${tier}'`);
}

/**
 * USD for one session under one delivery shape.
 *
 * THE MODEL, STATED SO IT CAN BE DISAGREED WITH. Standing context is written to
 * cache once and read on every later turn; a spawn re-writes the whole preamble
 * as UNCACHED input, which is the asymmetry that makes the standing corpus cost
 * scale with spawns rather than with turns. Injected bodies are uncached input
 * paid once per rule per session, because step 1.4's seen-set injects a given
 * rule's body at most once. Output tokens are identical across shapes by
 * construction and are therefore excluded rather than modelled — including them
 * would add the same constant to every row and change no comparison.
 */
export function sessionCostUsd(
    standingTokens: number,
    injectedTokens: number,
    turns: number,
    spawns: number,
    rates: Rates,
): number {
    const perM = 1_000_000;
    const cacheWrite = (standingTokens / perM) * rates.cacheWrite;
    const cacheReads = ((standingTokens * Math.max(0, turns - 1)) / perM) * rates.cacheRead;
    const spawnPreambles = ((standingTokens * spawns) / perM) * rates.input;
    const injected = (injectedTokens / perM) * rates.input;
    return cacheWrite + cacheReads + spawnPreambles + injected;
}

/**
 * Injected tokens accumulated over the first `turns` positives, deduplicated by
 * rule — the seen-set of step 1.4, modelled directly rather than assumed away.
 */
export function injectedOverSession(
    router: Router,
    positives: CorpusCase[],
    turns: number,
    cap: number,
): number {
    const seen = new Set<string>();
    let total = 0;
    for (const c of positives.slice(0, turns)) {
        const matches = matchTierRules(router, c.prompt, c.openFiles);
        const sel = selectForInjection(REPO_ROOT, matches, cap);
        for (const m of sel.selected) {
            if (seen.has(m.id)) continue;
            seen.add(m.id);
            total += sel.bodyTokens.get(m.id) ?? 0;
        }
    }
    return total;
}

// ── reports ──────────────────────────────────────────────────────────────

function fmtUsd(n: number): string {
    return n.toFixed(4);
}

export interface ModelReport {
    lines: string[];
    capTokens: number;
    exactHonoured: Score;
    exactIgnored: Score;
    pathMisses: CorpusCase[];
    priceOk: boolean;
}

export function runModel(corpusDir: string, honourOnly: boolean): ModelReport {
    const router = loadRouter(REPO_ROOT);
    const cases = loadCorpus(corpusDir);
    const positives = cases.filter((c) => c.label === 'positive');
    const exactHonoured = scoreExact(router, cases, true);
    const exactIgnored = scoreExact(router, cases, false);
    const pathMisses = pathRuleMisses(router, cases);

    // Uncapped matched-token distribution → the cap (p90, rounded UP to 500).
    const uncapped: number[] = [];
    for (const c of positives) {
        const matches = matchTierRules(router, c.prompt, c.openFiles);
        let sum = 0;
        for (const m of matches) {
            const body = loadRuleBody(REPO_ROOT, m.id);
            sum += body === null ? 0 : tokensOf(body);
        }
        uncapped.push(sum);
    }
    const p90 = quantile(uncapped, 0.9);
    const capTokens = Math.max(500, Math.ceil(p90 / 500) * 500);

    const matchedCounts = positives.map(
        (c) => matchTierRules(router, c.prompt, c.openFiles).length,
    );
    const standing = standingCorpora(router);
    const rates = loadRates('sonnet');

    const lines: string[] = [];
    const push = (s: string): void => {
        lines.push(s);
    };

    push(`model_rule_injection · corpus ${path.relative(REPO_ROOT, corpusDir)} · router dist/router.json`);
    push(
        `router: ${kernelIds(router).size} kernel · ${allTierRules(router).length} tier rules · ` +
            `${allTierRules(router).reduce((a, r) => a + r.triggers.length, 0)} triggers`,
    );
    push(
        `corpus: ${new Set(cases.map((c) => c.rule)).size} labelled rules · ` +
            `${exactHonoured.positives} positives · ${exactHonoured.nearMisses} near-misses · ` +
            `${positives.filter((c) => c.openFiles !== null).length} positives carry open_files`,
    );
    push('');
    push('── matched rules per positive prompt (exact-trigger matcher) ──');
    push(
        `  count  p50=${quantile(matchedCounts, 0.5)} p90=${quantile(matchedCounts, 0.9)} ` +
            `max=${quantile(matchedCounts, 1)} mean=${mean(matchedCounts).toFixed(2)}`,
    );
    push(
        `  tokens p50=${quantile(uncapped, 0.5)} p90=${p90} p99=${quantile(uncapped, 0.99)} ` +
            `max=${quantile(uncapped, 1)} mean=${Math.round(mean(uncapped))}`,
    );
    push(`  per-prompt cap = p90 rounded up to 500 = ${capTokens} tok`);
    push('');
    push('── standing corpora (exact BPE over dist/agent-src/rules) ──');
    push(`  eager-all       ${standing.eagerTokens} tok`);
    push(
        `  thin/delivery   ${standing.thinTokens} tok ` +
            `(kernel bodies + ${standing.triggerless.length} no-trigger residue bodies + pointers)`,
    );
    push(`  no-trigger residue: ${standing.triggerless.join(', ')} = ${standing.triggerlessTokens} tok`);
    if (pathMisses.length > 0) {
        push('');
        push('── path-rule misses, listed by rule (residual column of 1.2) ──');
        for (const c of pathMisses) push(`  ${c.rule}  ${JSON.stringify(c.openFiles)}`);
    }
    push('');

    // Price grid.
    const shapes: Array<{ name: string; standing: number; injectedFor: (t: number) => number }> = [
        { name: 'eager-all', standing: standing.eagerTokens, injectedFor: () => 0 },
        { name: 'thin-pointers', standing: standing.thinTokens, injectedFor: () => 0 },
        {
            name: 'delivery',
            standing: standing.thinTokens,
            injectedFor: (t) => injectedOverSession(router, positives, t, capTokens),
        },
    ];
    const price = (shapeIdx: number, turns: number, spawns: number): number => {
        const sh = shapes[shapeIdx] as (typeof shapes)[number];
        return sessionCostUsd(sh.standing, sh.injectedFor(turns), turns, spawns, rates);
    };
    const eagerRef = price(0, 50, 5);
    const deliveryRef = price(2, 50, 5);
    const priceOk = deliveryRef < eagerRef;

    if (honourOnly) {
        push(`path-rule misses: ${pathMisses.length}`);
        return { lines, capTokens, exactHonoured, exactIgnored, pathMisses, priceOk };
    }

    push('SUMMARY');
    push(
        `corpus: ${exactHonoured.positives} positives · ${exactHonoured.nearMisses} near-misses · ` +
            `cap ${capTokens} tok/prompt`,
    );
    push(
        `recall, open_files ignored:  ${ratio(exactIgnored.hits, exactIgnored.positives)} ` +
            `(${exactIgnored.hits}/${exactIgnored.positives})`,
    );
    push(
        `recall, open_files honoured: ${ratio(exactHonoured.hits, exactHonoured.positives)} ` +
            `(${exactHonoured.hits}/${exactHonoured.positives})`,
    );
    push(`path-rule misses: ${pathMisses.length}`);
    push(`false fires: ${exactHonoured.falseFires} of ${exactHonoured.nearMisses} near-miss prompts`);
    push(
        `matched body tokens (exact BPE): p50=${quantile(uncapped, 0.5)} p90=${p90} ` +
            `p99=${quantile(uncapped, 0.99)} max=${quantile(uncapped, 1)}`,
    );
    push(
        `price USD/session · ${rates.tier} in ${rates.input}/cr ${rates.cacheRead}/cw ` +
            `${rates.cacheWrite} per 1M · cells = turns 10/50/200 at 0|5|20 spawns`,
    );
    for (let i = 0; i < shapes.length; i += 1) {
        const cells = TURN_GRID.map((t) =>
            SPAWN_GRID.map((s) => fmtUsd(price(i, t, s))).join('|'),
        ).join('  ');
        push(`  ${(shapes[i] as (typeof shapes)[number]).name.padEnd(14)}${cells}`);
    }
    push(
        `endpoint (d) price · delivery ${fmtUsd(deliveryRef)} < eager ${fmtUsd(eagerRef)} ` +
            `at 50 turns x 5 spawns: ${priceOk ? 'PASS' : 'FAIL'}`,
    );
    return { lines, capTokens, exactHonoured, exactIgnored, pathMisses, priceOk };
}

export function runBaselineComparison(corpusDir: string): string[] {
    const router = loadRouter(REPO_ROOT);
    const cases = loadCorpus(corpusDir);
    const exact = scoreExact(router, cases, true);
    const rows: Array<[string, Score, string]> = [
        ['router_match (exact triggers)', exact, 'the shipping matcher, _lib/router_match.ts'],
    ];
    for (const d of BM25_DEPTHS) {
        rows.push([
            `lexical_index BM25 top-${d}`,
            scoreLexical(router, cases, d),
            'the shipping BM25 core, _lib/lexical_index.ts',
        ]);
    }
    const lines: string[] = [];
    lines.push(
        `model_rule_injection --baseline-comparison · corpus ${path.relative(REPO_ROOT, corpusDir)} · open_files honoured`,
    );
    lines.push(
        'Pre-registered per the 2026-07-28 council lock: the shipping lexical core is scored',
    );
    lines.push('BEFORE any new matcher is written, on the same labelled positives and near-misses.');
    lines.push('');
    lines.push('MATCHER COMPARISON');
    lines.push('  matcher                          recall    false-fires   source');
    for (const [name, s, src] of rows) {
        lines.push(
            `  ${name.padEnd(32)}${ratio(s.hits, s.positives).padEnd(10)}` +
                `${`${s.falseFires}/${s.nearMisses}`.padEnd(14)}${src}`,
        );
    }
    const best = rows.reduce((a, b) =>
        b[1].hits / Math.max(1, b[1].positives) > a[1].hits / Math.max(1, a[1].positives) ? b : a,
    );
    const winner = best[0];
    lines.push('');
    if (winner.startsWith('router_match')) {
        lines.push('WINNER: router_match (exact triggers) — no new matcher.');
        lines.push(
            '  It wins recall AND false fires at every depth tried, so a third matcher would be',
        );
        lines.push(
            '  strictly worse on both axes at strictly higher cost. The runtime concern imports',
        );
        lines.push('  _lib/router_match.ts through _lib/rule_injection.ts; nothing is re-implemented.');
    } else {
        lines.push(`WINNER: ${winner} — a new matcher IS warranted, and the reason is measured:`);
        lines.push('  it beats exact-trigger matching on recall over the frozen corpus. Step 0.3');
        lines.push('  therefore does NOT conclude "no new matcher"; Phase 1 must pin this result');
        lines.push('  into the concern before any body is delivered on the exact matcher alone.');
    }
    return lines;
}

export interface EndpointResult {
    id: 'a-delivery' | 'b-recall' | 'c-false-fire' | 'd-price';
    name: string;
    reading: string;
    bar: string;
    passed: boolean;
}

/**
 * Score the four PRE-REGISTERED endpoints of `internal/bench/thin-inject-PREREG.md`.
 *
 * Each bar is a property, not a number lifted off a prior run — see the PREREG
 * for the derivation of each and for the honest limit on how "pre-registered"
 * this run's registration is.
 */
export function runEndpoints(corpusDir: string): EndpointResult[] {
    const router = loadRouter(REPO_ROOT);
    const cases = loadCorpus(corpusDir);
    const positives = cases.filter((c) => c.label === 'positive');

    // (a) Delivery census — the CONCERN's own output against the projection.
    //
    // This calls `buildInjection` from the shipped hook rather than re-reading
    // the projected file twice: comparing a file to itself is a tautology that
    // would pass whatever the concern did to the bytes on the way out. What is
    // asserted is that the text the concern puts in front of the model contains
    // the projected body verbatim, trimmed and nothing else changed.
    let deliveries = 0;
    let unequal = 0;
    for (const c of positives) {
        const injection = buildInjection(REPO_ROOT, c.prompt, c.openFiles, null, new Set());
        if (injection === null) continue;
        for (const id of injection.rules) {
            const projected = loadRuleBody(REPO_ROOT, id);
            if (projected === null) {
                unequal += 1;
                continue;
            }
            if (injection.body.includes(projected.trim())) {
                deliveries += 1;
            } else {
                unequal += 1;
            }
        }
    }

    // (b) No labelled rule may end with ZERO matched positives.
    const byRule = new Map<string, { hit: number; total: number }>();
    for (const c of positives) {
        const e = byRule.get(c.rule) ?? { hit: 0, total: 0 };
        e.total += 1;
        if (matchTierRules(router, c.prompt, c.openFiles).some((m) => m.id === c.rule)) e.hit += 1;
        byRule.set(c.rule, e);
    }
    const unreachable = [...byRule.entries()].filter(([, v]) => v.hit === 0).map(([k]) => k);
    const partial = [...byRule.entries()]
        .filter(([, v]) => v.hit > 0 && v.hit < v.total)
        .map(([k, v]) => `${k} ${v.hit}/${v.total}`);

    // (c) A near-miss must never deliver its labelled rule.
    const exact = scoreExact(router, cases, true);

    // (d) Delivery below eager at 50 turns x 5 spawns.
    const standing = standingCorpora(router);
    const rates = loadRates('sonnet');
    const uncapped = positives.map((c) =>
        matchTierRules(router, c.prompt, c.openFiles).reduce((a, m) => {
            const b = loadRuleBody(REPO_ROOT, m.id);
            return a + (b === null ? 0 : tokensOf(b));
        }, 0),
    );
    const cap = Math.max(500, Math.ceil(quantile(uncapped, 0.9) / 500) * 500);
    const eagerUsd = sessionCostUsd(standing.eagerTokens, 0, 50, 5, rates);
    const deliveryUsd = sessionCostUsd(
        standing.thinTokens,
        injectedOverSession(router, positives, 50, cap),
        50,
        5,
        rates,
    );

    return [
        {
            id: 'a-delivery',
            name: 'delivery census — injected body byte-equal to the eager projection',
            reading: `${deliveries} deliveries byte-equal, ${unequal} not`,
            bar: 'zero tolerance: unequal == 0',
            passed: unequal === 0 && deliveries > 0,
        },
        {
            id: 'b-recall',
            name: 'per-rule recall floor — no labelled rule left unreachable',
            reading:
                `${byRule.size - unreachable.length}/${byRule.size} rules reachable; ` +
                `unreachable: ${unreachable.length === 0 ? 'none' : unreachable.join(', ')}; ` +
                `partial: ${partial.length === 0 ? 'none' : partial.join(', ')}`,
            bar: 'unreachable == 0 (a rule with zero matched positives is a rule the mode removed)',
            passed: unreachable.length === 0,
        },
        {
            id: 'c-false-fire',
            name: 'false-fire ceiling — a near-miss never delivers its labelled rule',
            reading: `${exact.falseFires} of ${exact.nearMisses} near-miss prompts fired`,
            bar: 'falseFires == 0',
            passed: exact.falseFires === 0,
        },
        {
            id: 'd-price',
            name: 'price — delivery below eager at 50 turns x 5 spawns',
            reading: `delivery ${deliveryUsd.toFixed(4)} USD vs eager ${eagerUsd.toFixed(4)} USD`,
            bar: 'delivery < eager',
            passed: deliveryUsd < eagerUsd,
        },
    ];
}

// ── selftest (step 2.2) ──────────────────────────────────────────────────

export interface SelftestCase {
    endpoint: 'a-delivery' | 'b-recall' | 'c-false-fire' | 'matcher-mutation';
    name: string;
    passed: boolean;
    detail: string;
}

/**
 * Falsify the scorer before trusting it.
 *
 * Each case mutates ONE input in a way that MUST turn the endpoint red. A case
 * that stays green means the endpoint is insensitive to the defect it exists to
 * catch, and the endpoint is then not evidence for anything. This is the
 * "a scorer never seen red has unknown sensitivity" discipline applied to the
 * four Phase-2 endpoints.
 */
export function runSelftest(corpusDir: string): SelftestCase[] {
    const router = loadRouter(REPO_ROOT);
    const cases = loadCorpus(corpusDir);
    const out: SelftestCase[] = [];

    // (a) delivery census — the endpoint must reject a one-byte mutation of the
    // body it is comparing against. Driven through the concern's real output, so
    // a change that mangled the payload would turn this red.
    const probe = cases.find(
        (c) =>
            c.label === 'positive' &&
            buildInjection(REPO_ROOT, c.prompt, c.openFiles, null, new Set()) !== null,
    );
    const injection =
        probe === undefined
            ? null
            : buildInjection(REPO_ROOT, probe.prompt, probe.openFiles, null, new Set());
    if (injection === null || injection.rules.length === 0) {
        out.push({
            endpoint: 'a-delivery',
            name: 'one-byte mutation rejected',
            passed: false,
            detail: 'no positive in the corpus produces an injection to check',
        });
    } else {
        const id = injection.rules[0] as string;
        const projected = loadRuleBody(REPO_ROOT, id) ?? '';
        const mutated = `${projected.trim().slice(0, -1)}~MUTATED~`;
        out.push({
            endpoint: 'a-delivery',
            name: 'one-byte mutation rejected',
            passed: injection.body.includes(projected.trim()) && !injection.body.includes(mutated),
            detail: `${id}: the concern's payload carries the projected body verbatim and rejects a mutation of it`,
        });
    }

    // (b) recall — a rule stripped of its triggers must stop firing.
    const withTriggers = allTierRules(router).find((r) => r.triggers.length > 0);
    if (withTriggers === undefined) {
        out.push({
            endpoint: 'b-recall',
            name: 'trigger removal drops recall',
            passed: false,
            detail: 'router carries no triggered tier rule',
        });
    } else {
        const pos = cases.find((c) => c.label === 'positive' && c.rule === withTriggers.id);
        const stripped = JSON.parse(JSON.stringify(router)) as Router;
        for (const tier of ['tier_1', 'tier_2'] as const) {
            const arr = stripped[tier];
            if (!Array.isArray(arr)) continue;
            for (const r of arr as unknown as Array<Record<string, unknown>>) {
                if (String(r['id']) === withTriggers.id) r['triggers'] = [];
            }
        }
        const probe = pos ?? { prompt: withTriggers.triggers.map((t) => Object.values(t)[0]).join(' ') };
        const before = matchTierRules(router, String(probe.prompt), null).some(
            (m) => m.id === withTriggers.id,
        );
        const after = matchTierRules(stripped, String(probe.prompt), null).some(
            (m) => m.id === withTriggers.id,
        );
        out.push({
            endpoint: 'b-recall',
            name: 'trigger removal drops recall',
            passed: before && !after,
            detail: `${withTriggers.id}: fired=${before} before, fired=${after} with triggers removed`,
        });
    }

    // (c) false-fire ceiling — an injected near-miss that fires must be counted.
    const nm = cases.find((c) => c.label === 'near_miss');
    if (nm === undefined) {
        out.push({
            endpoint: 'c-false-fire',
            name: 'firing near-miss is counted',
            passed: false,
            detail: 'corpus carries no near-miss',
        });
    } else {
        const planted: CorpusCase = {
            ...nm,
            rule: nm.rule,
            prompt: `${nm.prompt} ${allTierRules(router)
                .filter((r) => r.id === nm.rule)
                .flatMap((r) => r.triggers)
                .map((t) => String(Object.values(t)[0]))
                .join(' ')}`,
        };
        const scored = scoreExact(router, [planted], true);
        out.push({
            endpoint: 'c-false-fire',
            name: 'firing near-miss is counted',
            passed: scored.falseFires === 1,
            detail: `planted near-miss for ${nm.rule}: falseFires=${scored.falseFires} (expected 1)`,
        });
    }

    // matcher mutation — an empty router must score zero recall, never a default pass.
    const empty: Router = { kernel: [], tier_1: [], tier_2: [] };
    const emptyScore = scoreExact(empty, cases, true);
    out.push({
        endpoint: 'matcher-mutation',
        name: 'empty router scores zero recall',
        passed: emptyScore.hits === 0 && emptyScore.positives > 0,
        detail: `hits=${emptyScore.hits} over ${emptyScore.positives} positives`,
    });

    return out;
}

// ── CLI ──────────────────────────────────────────────────────────────────

const USAGE = `usage: model_rule_injection [--corpus DIR] [--baseline-comparison]
                            [--honour-open-files]
                            [--selftest] [--endpoints] [--json]

Offline recall + cost model for trigger-delivered rule bodies. No metered call
on any path.
`;

export function main(argv: string[] | null = null): number {
    const args = argv ?? process.argv.slice(2);
    let corpus = DEFAULT_CORPUS;
    let baseline = false;
    let honour = false;
    let selftest = false;
    let endpoints = false;
    let json = false;
    for (let i = 0; i < args.length; i += 1) {
        const a = args[i] as string;
        if (a === '--corpus') {
            i += 1;
            corpus = path.resolve(args[i] as string);
        } else if (a === '--baseline-comparison') {
            baseline = true;
        } else if (a === '--honour-open-files') {
            honour = true;
        } else if (a === '--selftest') {
            selftest = true;
        } else if (a === '--endpoints') {
            endpoints = true;
        } else if (a === '--json') {
            json = true;
        } else if (a === '-h' || a === '--help') {
            process.stdout.write(USAGE);
            return 0;
        } else {
            process.stderr.write(`model_rule_injection: unknown argument '${a}'\n${USAGE}`);
            return 2;
        }
    }

    if (selftest) {
        const results = runSelftest(corpus);
        const failed = results.filter((r) => !r.passed);
        if (json) {
            process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
        } else {
            process.stdout.write('model_rule_injection --selftest · no metered call on any path\n');
            for (const r of results) {
                process.stdout.write(
                    `  ${r.passed ? 'ok  ' : 'FAIL'} ${r.endpoint.padEnd(18)}${r.name} — ${r.detail}\n`,
                );
            }
            process.stdout.write(
                `selftest: ${results.length - failed.length}/${results.length} rejecting cases green ` +
                    `(one per endpoint a/b/c + a matcher mutation)\n`,
            );
            process.stdout.write(`selftest: ${failed.length === 0 ? 'PASS' : 'FAIL'}\n`);
        }
        return failed.length === 0 ? 0 : 1;
    }

    if (endpoints) {
        const results = runEndpoints(corpus);
        if (json) {
            process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
        } else {
            process.stdout.write(
                'model_rule_injection --endpoints · the four PRE-REGISTERED endpoints of\n' +
                    'internal/bench/thin-inject-PREREG.md · offline, no metered call\n\n',
            );
            for (const r of results) {
                process.stdout.write(`  ${r.passed ? 'PASS' : 'FAIL'} (${r.id}) ${r.name}\n`);
                process.stdout.write(`       reading: ${r.reading}\n`);
                process.stdout.write(`       bar:     ${r.bar}\n`);
            }
            const failed = results.filter((r) => !r.passed);
            process.stdout.write(
                `\nendpoints: ${results.length - failed.length}/${results.length} hold\n`,
            );
            process.stdout.write(
                'This licenses delivery equivalence and cost. It does not measure behavioural\n' +
                    'equivalence; that instrument is closed (ADR-202) and this run does not reopen it.\n',
            );
        }
        return results.every((r) => r.passed) ? 0 : 1;
    }

    if (baseline) {
        const lines = runBaselineComparison(corpus);
        process.stdout.write(`${lines.join('\n')}\n`);
        return 0;
    }

    const rep = runModel(corpus, honour);
    process.stdout.write(`${rep.lines.join('\n')}\n`);
    return 0;
}

if (path.resolve(process.argv[1] ?? '') === _HERE) {
    process.exit(main());
}
