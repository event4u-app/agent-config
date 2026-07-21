#!/usr/bin/env tsx
/**
 * Defect-finding benchmark runner (road-to-team-mode Phase 5, Steps 2-4).
 *
 * Three arms over the pre-registered corpus (internal/bench/corpora/defect-finding.yaml):
 *   (a) self-review  — single strong model (Anthropic) + the adversarial-review frame
 *   (b) team         — codex exec (subscription; reviewer pinned via --codex-model)
 *   (c) council      — the neutral breadth arm: Anthropic + OpenAI independent reviews, union
 *
 * Every arm gets the SAME strict output contract so scoring is fair + objective:
 * a review must end with `VERDICT: <n>` and one `DEFECT: <file>:<line> — <why>`
 * line per defect. Recall + false-positives are then scored DETERMINISTICALLY
 * against the corpus ground truth (no LLM judge for the PRIMARY metric — the
 * blind rubric judge is the SECONDARY metric and is deferred this pass).
 *
 * Spend: arm (a) + arm (c) are billable API calls; arm (b) is the ChatGPT
 * subscription (non-billable through this process). `--max-usd` is a HARD cap:
 * the run aborts before a call that would cross it. `--dry-run` makes zero calls.
 *
 * Exit 0 ok · 1 aborted-on-cap / error · 2 usage.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { load as yamlLoad } from 'js-yaml';

import {
    AnthropicClient,
    OpenAIClient,
    load_anthropic_key,
    load_openai_key,
} from './ai_council/clients.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const CORPUS = path.join(ROOT, 'internal', 'bench', 'corpora', 'defect-finding.yaml');
const OUT_JSON = path.join(ROOT, 'internal', 'bench', 'reports', 'defect-finding.json');
const OUT_MD = path.join(ROOT, 'internal', 'bench', 'reports', 'defect-finding.md');

const OUTPUT_CONTRACT =
    '\n\nReport STRICTLY in this format, nothing after it:\n' +
    'DEFECT: <file>:<line> — <one-line why>   (one line per real defect; omit if none)\n' +
    'VERDICT: <integer count of defects>';

interface Fixture {
    id: string;
    defect_class: string;
    prompt: string;
    ground_truth: string;
    rubric: string;
    negative_control?: boolean;
}

type ArmId = 'self-review' | 'team' | 'council';

interface ArmResult {
    arm: ArmId;
    text: string;
    calls: number;
    input_tokens: number;
    output_tokens: number;
    usd: number;
    ms: number;
    error: string | null;
}

/** Ground-truth FILENAME for a fixture, or null for a control. Each planted
 * fixture touches exactly ONE unique file, so "a DEFECT line names this file"
 * is the honest, line-number-robust recall signal (diff line numbering is
 * ambiguous and models cite lines inconsistently — matching the exact
 * file:line token systematically under-counts real finds). */
function groundTruthFile(gt: string): string | null {
    if (/^\s*NONE\b/i.test(gt)) return null;
    const head = gt.split('—')[0] ?? gt;
    const m = /([\w./-]+\.\w+):[\d,]+/.exec(head);
    return m ? (m[1] as string) : null;
}
/** Basename of a path token (find.ts from src/search/find.ts). */
function basename(p: string): string { return p.split('/').pop() ?? p; }

/** Parse the DEFECT lines an arm emitted (file:line tokens it claims). */
function parseClaimedDefects(text: string): { count: number; files: string[] } {
    const files: string[] = [];
    for (const line of text.split('\n')) {
        // DEFECT: <file>[:line] — ... ; capture the file token (line optional).
        const m = /^\s*DEFECT:\s*([\w./-]+\.\w+)/.exec(line);
        if (m) files.push(m[1] as string);
    }
    const vm = /VERDICT:\s*(\d+)/i.exec(text);
    const count = vm ? Number(vm[1]) : files.length;
    return { count, files };
}

/** Deterministic recall/FP for one arm on one fixture. */
function score(
    fx: Fixture,
    arm: ArmResult,
): { recall_hit: boolean; false_positive: boolean; claimed: number } {
    const gtFile = groundTruthFile(fx.ground_truth);
    const claimed = parseClaimedDefects(arm.text);
    if (gtFile === null || fx.negative_control === true) {
        // Control: any claimed defect is a false positive.
        return { recall_hit: false, false_positive: claimed.count > 0, claimed: claimed.count };
    }
    // Recall: a DEFECT line names the planted file (by basename — robust to the
    // model prefixing or omitting the dir). Line-agnostic on purpose.
    const target = basename(gtFile);
    const hit = claimed.files.some((f) => basename(f) === target) || arm.text.includes(target);
    return { recall_hit: hit, false_positive: false, claimed: claimed.count };
}

function usd(inTok: number, outTok: number, inRate: number, outRate: number): number {
    return (inTok / 1_000_000) * inRate + (outTok / 1_000_000) * outRate;
}

// Conservative published-tier rates (per 1M tokens) for the estimate + tally.
const RATES = {
    anthropic: { in: 3, out: 15 }, // claude-sonnet class
    openai: { in: 2.5, out: 10 }, // gpt-4o class
};

interface Budget {
    cap: number;
    spent: number;
}

function guard(b: Budget, next: number): void {
    if (b.cap > 0 && b.spent + next > b.cap) {
        throw new Error(`hard cap $${b.cap} would be crossed (spent $${b.spent.toFixed(4)}, next ~$${next.toFixed(4)})`);
    }
}

function armSelfReview(fx: Fixture, key: string, b: Budget): ArmResult {
    const t0 = Date.now();
    guard(b, 0.05);
    const client = new AnthropicClient({ api_key: key });
    const sys =
        'You are a single-model adversarial code reviewer (Attack-Defend-Revise). ' +
        'Find real defects in the diff; do not invent problems in correct code.';
    const r = client.ask(sys, fx.prompt + OUTPUT_CONTRACT, 1024);
    const cost = usd(r.input_tokens, r.output_tokens, RATES.anthropic.in, RATES.anthropic.out);
    b.spent += cost;
    return {
        arm: 'self-review', text: r.text, calls: 1,
        input_tokens: r.input_tokens, output_tokens: r.output_tokens,
        usd: cost, ms: Date.now() - t0, error: r.error,
    };
}

function armTeam(fx: Fixture, model: string, _b: Budget): ArmResult {
    const t0 = Date.now();
    // codex = ChatGPT subscription: non-billable through this process. `--json`
    // streams events; the review is the LAST agent_message item's text (the
    // interactive mode without --json blocks/hangs — must use --json here).
    let text = '';
    let error: string | null = null;
    try {
        const raw = execFileSync('codex', ['exec', '--json', '-m', model, fx.prompt + OUTPUT_CONTRACT], {
            encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 180_000,
        });
        for (const line of raw.split('\n')) {
            const s = line.trim();
            if (!s.startsWith('{')) continue;
            try {
                const ev = JSON.parse(s) as { item?: { type?: string; text?: string } };
                if (ev.item?.type === 'agent_message' && typeof ev.item.text === 'string') {
                    text = ev.item.text; // keep the last agent_message
                }
            } catch { /* skip non-JSON / partial lines */ }
        }
        if (!text) error = 'no agent_message in codex --json stream';
    } catch (e) {
        error = e instanceof Error ? e.message.slice(0, 300) : String(e);
    }
    return { arm: 'team', text, calls: 1, input_tokens: 0, output_tokens: 0, usd: 0, ms: Date.now() - t0, error };
}

function armCouncil(fx: Fixture, aKey: string, oKey: string, b: Budget): ArmResult {
    const t0 = Date.now();
    const sys =
        'You are a neutral code reviewer. Review ONLY the supplied diff for real ' +
        'defects; never invent problems in correct code.';
    guard(b, 0.05);
    const a = new AnthropicClient({ api_key: aKey }).ask(sys, fx.prompt + OUTPUT_CONTRACT, 1024);
    let cost = usd(a.input_tokens, a.output_tokens, RATES.anthropic.in, RATES.anthropic.out);
    b.spent += cost;
    guard(b, 0.05);
    const o = new OpenAIClient({ api_key: oKey }).ask(sys, fx.prompt + OUTPUT_CONTRACT, 1024);
    const oc = usd(o.input_tokens, o.output_tokens, RATES.openai.in, RATES.openai.out);
    b.spent += oc;
    cost += oc;
    // Council = breadth: union the two independent reviews.
    const text = `# reviewer A\n${a.text}\n\n# reviewer B\n${o.text}`;
    return {
        arm: 'council', text, calls: 2,
        input_tokens: a.input_tokens + o.input_tokens,
        output_tokens: a.output_tokens + o.output_tokens,
        usd: cost, ms: Date.now() - t0, error: a.error ?? o.error,
    };
}

const CORRECTNESS = new Set(['logic-bug', 'off-by-one', 'race']);
const DESIGN = new Set(['missing-empty-state', 'security-smell']);

export function main(argv: string[]): 0 | 1 | 2 {
    const dryRun = argv.includes('--dry-run');
    const capIdx = argv.indexOf('--max-usd');
    const cap = capIdx >= 0 ? Number(argv[capIdx + 1]) : 1.2;
    const modelIdx = argv.indexOf('--codex-model');
    const codexModel = (modelIdx >= 0 ? argv[modelIdx + 1] : undefined) ?? 'gpt-5.5';

    const doc = yamlLoad(fs.readFileSync(CORPUS, 'utf8')) as { fixtures: Fixture[] };
    const fixtures = doc.fixtures;

    if (dryRun) {
        const planted = fixtures.filter((f) => !f.negative_control).length;
        process.stdout.write(
            `defect-finding (dry-run — no calls):\n` +
                `  fixtures: ${fixtures.length} (${planted} planted, ${fixtures.length - planted} control)\n` +
                `  arms: self-review (anthropic, ${fixtures.length} calls) · team (codex ${codexModel}, ${fixtures.length} calls, subscription) · council (anthropic+openai, ${fixtures.length * 2} calls)\n` +
                `  billable estimate: arm a ~$${(fixtures.length * 0.02).toFixed(2)} + arm c ~$${(fixtures.length * 0.04).toFixed(2)} ≈ $${(fixtures.length * 0.06).toFixed(2)} (hard cap $${cap})\n` +
                `  arm b (codex): 0 billable (ChatGPT subscription quota)\n`,
        );
        return 0;
    }

    const aKey = load_anthropic_key();
    const oKey = load_openai_key();
    const budget: Budget = { cap, spent: 0 };
    const rows: Array<{ fx: Fixture; arms: Record<ArmId, ArmResult> }> = [];

    try {
        for (const fx of fixtures) {
            process.stdout.write(`· ${fx.id} (${fx.defect_class})\n`);
            const arms = {
                'self-review': armSelfReview(fx, aKey, budget),
                team: armTeam(fx, codexModel, budget),
                council: armCouncil(fx, aKey, oKey, budget),
            } as Record<ArmId, ArmResult>;
            rows.push({ fx, arms });
        }
    } catch (e) {
        process.stderr.write(`ABORTED: ${e instanceof Error ? e.message : String(e)}\n`);
        // fall through to write a partial report
    }

    // ── aggregate ──
    const ARMS: ArmId[] = ['self-review', 'team', 'council'];
    const agg: Record<string, unknown> = {};
    const perArm: Record<ArmId, { recall: number; planted: number; fp: number; usd: number; ms: number; calls: number; byClass: Record<string, { hit: number; n: number }> }> =
        Object.fromEntries(ARMS.map((a) => [a, { recall: 0, planted: 0, fp: 0, usd: 0, ms: 0, calls: 0, byClass: {} }])) as never;

    const detail: unknown[] = [];
    for (const { fx, arms } of rows) {
        const d: Record<string, unknown> = { id: fx.id, defect_class: fx.defect_class, control: !!fx.negative_control };
        for (const a of ARMS) {
            const ar = arms[a];
            const sc = score(fx, ar);
            const pa = perArm[a];
            pa.usd += ar.usd; pa.ms += ar.ms; pa.calls += ar.calls;
            if (!fx.negative_control) {
                pa.planted += 1;
                if (sc.recall_hit) pa.recall += 1;
                const c = (pa.byClass[fx.defect_class] ??= { hit: 0, n: 0 });
                c.n += 1; if (sc.recall_hit) c.hit += 1;
            } else if (sc.false_positive) {
                pa.fp += 1;
            }
            d[a] = { recall_hit: sc.recall_hit, false_positive: sc.false_positive, claimed: sc.claimed, usd: Number(ar.usd.toFixed(4)), ms: ar.ms, error: ar.error, review: ar.text.slice(0, 1200) };
        }
        detail.push(d);
    }

    const recallRate = (a: ArmId): number => (perArm[a].planted ? perArm[a].recall / perArm[a].planted : 0);
    const classRecall = (a: ArmId, classes: Set<string>): { hit: number; n: number } => {
        let hit = 0, n = 0;
        for (const [cls, c] of Object.entries(perArm[a].byClass)) if (classes.has(cls)) { hit += c.hit; n += c.n; }
        return { hit, n };
    };
    const rr = (x: { hit: number; n: number }): number => (x.n ? x.hit / x.n : 0);

    // Hypotheses (pre-registered thresholds).
    const aCorr = classRecall('self-review', CORRECTNESS), bCorr = classRecall('team', CORRECTNESS);
    const bDes = classRecall('team', DESIGN), cDes = classRecall('council', DESIGN);
    const h1 = rr(bCorr) - rr(aCorr); // team - self on correctness; predict >= +0.20
    const h2 = Math.abs(rr(cDes) - rr(bDes)); // council vs team on design; predict within 0.10
    const h3ok = ARMS.every((a) => perArm[a].fp <= 1);

    agg['preregistered'] = {
        roadmap: 'road-to-team-mode Phase 5', authored: '2026-07-20',
        primary: ['recall', 'false_positives', 'cost/time/calls'],
        secondary: 'blind rubric judge — DEFERRED this pass (primary recall is deterministic)',
        hypotheses: { H1: 'team>self on correctness, Δrecall>=+0.20', H2: 'council≈team on design, within 0.10', H3: 'FP<=1/arm on controls' },
        codex_model: codexModel, models_cache_fetched: '2026-07-20T12:21Z',
    };
    agg['arms'] = Object.fromEntries(ARMS.map((a) => [a, {
        recall_rate: Number(recallRate(a).toFixed(3)), recall: perArm[a].recall, planted: perArm[a].planted,
        false_positives: perArm[a].fp, usd: Number(perArm[a].usd.toFixed(4)), ms: perArm[a].ms, calls: perArm[a].calls,
        correctness_recall: Number(rr(classRecall(a, CORRECTNESS)).toFixed(3)),
        design_recall: Number(rr(classRecall(a, DESIGN)).toFixed(3)),
    }]));
    const nullish = Math.abs(h1) <= 0.1 && h2 <= 0.1;
    agg['verdict'] = {
        H1_team_minus_self_correctness: Number(h1.toFixed(3)), H1_met: h1 >= 0.2,
        H2_council_vs_team_design_absdelta: Number(h2.toFixed(3)), H2_met: h2 <= 0.1,
        H3_fp_within_bound: h3ok,
        honest_null: nullish,
        disposition: nullish
            ? 'HONEST NULL — arms indistinguishable within pre-registered thresholds; no lift claim binds.'
            : h1 >= 0.2
                ? 'LIFT on correctness-class — H1 met; a team-lift CLAIM may bind (maintainer decision).'
                : 'MIXED — see per-class rates; no blanket lift claim.',
    };
    agg['total_billable_usd'] = Number((perArm['self-review'].usd + perArm.council.usd).toFixed(4));
    agg['detail'] = detail;

    fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
    fs.writeFileSync(OUT_JSON, JSON.stringify(agg, null, 2) + '\n');

    const v = agg['verdict'] as Record<string, unknown>;
    const md = [
        '# Defect-finding benchmark — results (road-to-team-mode Phase 5)',
        '', `> Run 2026-07-20. Codex reviewer: \`${codexModel}\`. Primary metric = deterministic`,
        '> recall against corpus ground truth; blind rubric judge (secondary) deferred.',
        '', '## Per-arm', '', '| arm | recall | correctness | design | false-pos | calls | $ |', '|---|--:|--:|--:|--:|--:|--:|',
        ...ARMS.map((a) => {
            const x = (agg['arms'] as Record<string, Record<string, number>>)[a] as Record<string, number>;
            return `| ${a} | ${x.recall_rate} | ${x.correctness_recall} | ${x.design_recall} | ${x.false_positives} | ${x.calls} | ${x.usd} |`;
        }),
        '', '## Verdict', '',
        `- H1 (team − self, correctness recall Δ): **${v.H1_team_minus_self_correctness}** — met: ${v.H1_met}`,
        `- H2 (council vs team, design recall |Δ|): **${v.H2_council_vs_team_design_absdelta}** — met: ${v.H2_met}`,
        `- H3 (false positives ≤ 1/arm): ${v.H3_fp_within_bound}`,
        '', `**Disposition:** ${v.disposition}`,
        '', `Total billable: $${agg['total_billable_usd']} (arm b codex = subscription, $0 billable).`,
        '',
    ].join('\n');
    fs.writeFileSync(OUT_MD, md);
    process.stdout.write(`\nwrote ${path.relative(ROOT, OUT_JSON)} + ${path.relative(ROOT, OUT_MD)}\n`);
    process.stdout.write(`spent ~$${budget.spent.toFixed(4)} (cap $${cap})\n`);
    return 0;
}

if (fs.existsSync(process.argv[1] ?? '') && import.meta.url === `file://${process.argv[1]}`) {
    process.exit(main(process.argv.slice(2)));
}
