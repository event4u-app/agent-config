#!/usr/bin/env node
/**
 * cross_model_smoke — the Phase-0 keystone (roadmap `road-to-operator-runtime-harvest`,
 * T-004/T-006). Runs the existing trigger-routing eval across multiple host
 * vendors (Anthropic / OpenAI / Gemini) over plain HTTP and emits, PER HOST:
 *
 *   - routing pass-rate + precision/recall (the parity signal),
 *   - input/output tokens + cost estimate,
 *   - output-shape parse-rate (did the host return parseable `would_load` JSON?
 *     — the format-governance signal, T-004 hardening #2),
 *   - negative-control catch-rate (did the eval correctly reject the
 *     should-NOT-trigger queries? — the discrimination signal, T-003).
 *
 * Honesty couplings (3rd-pass council): the result names the coverage
 * denominator (N skills / M fixtures) and the read of outcome (a)/(b)/(c) is
 * left to a human in T-006 — this script reports, it does not declare parity.
 *
 * Modes:
 *   --dry-run            use MockRouter for every host (no keys, no spend) — CI path.
 *   --skills a,b,c       fixture skills to run (must have evals/triggers.json).
 *   --hosts anthropic,openai,gemini   subset of hosts (default: all three).
 *
 * Live mode reads keys from ~/.event4u/agent-config/{anthropic,openai,gemini}.key
 * and makes real, paid API calls — keep --skills small.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
    type EvalResult,
    type Query,
    type SkillMeta,
    type TriggerRouter,
    MockRouter,
    compute_metrics,
    estimate_cost,
    load_skill_metas,
    load_triggers,
} from './skill_trigger_eval.js';
import {
    AnthropicFetchRouter,
    GeminiRouter,
    OpenAiRouter,
    loadKeyFromFile,
} from './_lib/trigger_routers.js';

type AsyncRouter = TriggerRouter & {
    routeAsync?: (q: string, skills: SkillMeta[]) => Promise<[string[], number, number]>;
};

interface HostSummary {
    host: string;
    model: string;
    queries: number;
    passed: number;
    pass_rate: number;
    input_tokens: number;
    output_tokens: number;
    cost_usd_estimate: number;
    // output-shape signal: fraction of calls that produced a parseable would_load
    // (a host that returned 0 loaded AND 0 tokens is treated as an unparseable / failed call)
    parse_ok: number;
    parse_rate: number;
    // discrimination signal: should-NOT-trigger queries correctly rejected
    neg_controls: number;
    neg_caught: number;
}

/** Mirror run_eval but await routeAsync when present (fetch routers); fall back to sync route (MockRouter). */
async function runEvalAsync(
    skill: string,
    queries: Query[],
    router: AsyncRouter,
    skills: SkillMeta[],
    model: string,
): Promise<{ result: EvalResult; parse_ok: number; neg_controls: number; neg_caught: number }> {
    const result: EvalResult = {
        skill,
        model,
        timestamp: '',
        router: router.name,
        queries: [],
        metrics: { true_positive: 0, false_positive: 0, true_negative: 0, false_negative: 0, precision: 0, recall: 0 },
        input_tokens: 0,
        output_tokens: 0,
        cost_usd_estimate: 0.0,
    };
    let parse_ok = 0;
    let neg_controls = 0;
    let neg_caught = 0;
    for (const q of queries) {
        const [loaded, inTok, outTok] =
            typeof router.routeAsync === 'function'
                ? await router.routeAsync(q.q, skills)
                : router.route(q.q, skills);
        const observed = loaded.includes(skill);
        const passed = observed === q.trigger;
        // a call that returned at least one token OR a non-empty load is treated as parseable
        if (inTok > 0 || outTok > 0 || loaded.length > 0) parse_ok += 1;
        if (!q.trigger) {
            neg_controls += 1;
            if (passed) neg_caught += 1; // correctly rejected a should-not query
        }
        result.queries.push({ q: q.q, expected: q.trigger, observed, loaded_skills: [...loaded], passed });
        result.input_tokens += inTok;
        result.output_tokens += outTok;
    }
    result.metrics = compute_metrics(result.queries);
    result.cost_usd_estimate = estimate_cost(model, result.input_tokens, result.output_tokens);
    return { result, parse_ok, neg_controls, neg_caught };
}

function buildRouter(host: string, dryRun: boolean): AsyncRouter {
    if (dryRun) {
        // Deterministic stub: loads a skill iff the query mentions its name.
        return new MockRouter((q, skills) => skills.filter((s) => q.toLowerCase().includes(s.name)).map((s) => s.name)) as AsyncRouter;
    }
    if (host === 'openai') return new OpenAiRouter({ apiKey: loadKeyFromFile('openai.key') }) as AsyncRouter;
    if (host === 'gemini') return new GeminiRouter({ apiKey: loadKeyFromFile('gemini.key') }) as AsyncRouter;
    if (host === 'anthropic') return new AnthropicFetchRouter({ apiKey: loadKeyFromFile('anthropic.key') }) as AsyncRouter;
    throw new Error(`unknown host: ${host}`);
}

function modelFor(host: string): string {
    if (host === 'openai') return 'gpt-4o-mini';
    if (host === 'gemini') return 'gemini-2.5-flash';
    if (host === 'anthropic') return 'claude-haiku-4-5-20251001';
    return 'mock';
}

export async function runSmoke(opts: {
    skills: string[];
    hosts: string[];
    dryRun: boolean;
}): Promise<{ catalogue_size: number; fixtures: number; hosts: HostSummary[] }> {
    // Read the catalogue from the source-of-truth `src/skills` tree explicitly.
    // load_skill_metas' built-in default points at a legacy tree that is absent
    // in fresh clones / CI, so we pass the path rather than rely on the default.
    // Keeps the catalogue and the fixture paths on the same tree.
    const catalogue = load_skill_metas(path.join('src', 'skills'));
    const summaries: HostSummary[] = [];
    let totalFixtures = 0;

    for (const host of opts.hosts) {
        const router = buildRouter(host, opts.dryRun);
        const model = opts.dryRun ? 'mock' : modelFor(host);
        let q = 0,
            passed = 0,
            inTok = 0,
            outTok = 0,
            cost = 0,
            parseOk = 0,
            negC = 0,
            negCaught = 0,
            fixtures = 0;
        for (const skill of opts.skills) {
            const trigPath = path.join('src', 'skills', skill, 'evals', 'triggers.json');
            if (!fs.existsSync(trigPath)) continue;
            // Some fixtures use a legacy shape (`should_trigger`/`should_not_trigger`)
            // instead of the unified `queries[]`. Skip-and-warn rather than crash the
            // whole run — and never silently: the skip is surfaced on stderr.
            let skillName: string;
            let queries: Query[];
            try {
                [skillName, queries] = load_triggers(trigPath);
            } catch (e) {
                process.stderr.write(`skip ${skill}: unparseable triggers.json — ${(e as Error).message}\n`);
                continue;
            }
            fixtures += 1;
            const r = await runEvalAsync(skillName, queries, router, catalogue, model);
            q += r.result.queries.length;
            passed += r.result.queries.filter((x) => x.passed).length;
            inTok += r.result.input_tokens;
            outTok += r.result.output_tokens;
            cost += r.result.cost_usd_estimate;
            parseOk += r.parse_ok;
            negC += r.neg_controls;
            negCaught += r.neg_caught;
        }
        totalFixtures = fixtures;
        summaries.push({
            host,
            model,
            queries: q,
            passed,
            pass_rate: q ? passed / q : 0,
            input_tokens: inTok,
            output_tokens: outTok,
            cost_usd_estimate: cost,
            parse_ok: parseOk,
            parse_rate: q ? parseOk / q : 0,
            neg_controls: negC,
            neg_caught: negCaught,
        });
    }
    return { catalogue_size: catalogue.length, fixtures: totalFixtures, hosts: summaries };
}

function parseArgs(argv: string[]): { skills: string[]; hosts: string[]; dryRun: boolean } {
    let skills = ['image-analyser'];
    let hosts = ['anthropic', 'openai', 'gemini'];
    let dryRun = false;
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--dry-run') dryRun = true;
        else if (argv[i] === '--skills') skills = (argv[++i] ?? '').split(',').filter(Boolean);
        else if (argv[i] === '--hosts') hosts = (argv[++i] ?? '').split(',').filter(Boolean);
    }
    return { skills, hosts, dryRun };
}

async function main(): Promise<number> {
    const opts = parseArgs(process.argv.slice(2));
    const out = await runSmoke(opts);
    const lines: string[] = [];
    lines.push(`cross_model_smoke · catalogue=${out.catalogue_size} skills · fixtures=${out.fixtures} · ${opts.dryRun ? 'DRY-RUN (mock)' : 'LIVE'}`);
    lines.push('host        model                       queries  pass%   parse%  neg-ctrl  in_tok   out_tok  ~$');
    for (const h of out.hosts) {
        lines.push(
            `${h.host.padEnd(11)} ${h.model.padEnd(27)} ${String(h.queries).padStart(7)}  ${(h.pass_rate * 100).toFixed(0).padStart(5)}  ${(h.parse_rate * 100).toFixed(0).padStart(6)}  ${String(h.neg_caught + '/' + h.neg_controls).padStart(8)}  ${String(h.input_tokens).padStart(7)}  ${String(h.output_tokens).padStart(7)}  ${h.cost_usd_estimate.toFixed(4)}`,
        );
    }
    process.stdout.write(lines.join('\n') + '\n');
    return 0;
}

// Entry guard: only run main when invoked directly (not when imported by tests).
const _invokedDirectly = (() => {
    try {
        const argv1 = process.argv[1];
        if (!argv1) return false;
        return fs.realpathSync(argv1) === fs.realpathSync(new URL(import.meta.url).pathname);
    } catch {
        return false;
    }
})();
if (_invokedDirectly) {
    main().then(
        (code) => process.exit(code),
        (err) => {
            process.stderr.write(String(err?.stack ?? err) + '\n');
            process.exit(1);
        },
    );
}
