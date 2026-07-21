/**
 * Two-stage residual-detection benchmark runner for the adversarial-council
 * finding-coverage claim (ADR-122, road-to-adversarial-council-benchmark,
 * design: docs/design/adversarial-council-eval.md).
 *
 * Protocol (documented here so the verdict is reproducible; 2 working providers
 * — anthropic + openai — so the design is adapted to isolate panel VALUE without
 * a structural-zero artifact):
 *
 *   Stage 1 — define the residual. BOTH providers review the 12 defect fixtures
 *   under a NEUTRAL review prompt. Residual R = defects that NEITHER neutral pass
 *   caught (the judge-survivable pool: it survived a strong 2-vendor first read).
 *
 *   Stage 2 — single skeptic vs cross-vendor panel, on R + the clean controls,
 *   under an ADVERSARIAL SKEPTIC prompt (the shipped Mode-9 posture):
 *     - single_judge  = anthropic-skeptic alone.
 *     - panel         = reconciled union of {anthropic, openai} skeptics.
 *   Because panel ⊇ single, lift ≥ 0 and measures the MARGINAL value the
 *   second vendor adds at a fixed skeptic posture — exactly "does a cross-vendor
 *   panel out-find a single skeptic on the residual, at no-worse FP".
 *
 *   evaluateCouncilBench applies the LOCKED dual threshold → backed | honest-null.
 *
 * Limitation (recorded honestly): with 2 vendors this isolates the 2nd-vendor
 * marginal contribution, not an N-vendor scaling curve. gemini/xai are stubbed
 * or disabled in this CLI build.
 *
 * `--mock` runs the whole pipeline on canned responses (no spend) to pre-validate
 * parsing + residual + scoring + gate in BOTH directions. `--run` fires the real
 * paid cross-vendor calls (maintainer spend-gated).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
    AnthropicClient,
    OpenAIClient,
    load_anthropic_key,
    load_openai_key,
    type ExternalAIClient,
} from './ai_council/clients.js';
import { evaluateCouncilBench, type CouncilBenchInputs } from './_lib/adversarial_council_gate.js';
import {
    caughtDefect,
    isFalsePositive,
    recall,
    fpRate,
    categoryFamily,
    type Finding,
    type GroundTruth,
} from './_lib/adversarial_bench_score.js';
import { hardenedSpawnEnv } from './_lib/spawn_env.js';

const REPO_ROOT = process.cwd();
const CORPUS_PATH = path.join(REPO_ROOT, 'internal/bench/adversarial-council/corpus.json');
const SINGLE_SKEPTIC = 'anthropic'; // the single-judge baseline in stage 2

interface CorpusItem {
    id: string;
    class: string;
    defect_category: string;
    is_clean: boolean;
    files: { path: string; content: string }[];
    ground_truth: { defect_files: string[]; defect_summary: string };
}

function loadCorpus(): CorpusItem[] {
    return JSON.parse(fs.readFileSync(CORPUS_PATH, 'utf8')).items as CorpusItem[];
}
function groundTruth(item: CorpusItem): GroundTruth {
    return {
        id: item.id,
        is_clean: item.is_clean,
        defect_files: item.ground_truth.defect_files,
        defect_category: item.is_clean ? 'none' : categoryFamily(item.defect_category),
    };
}
function codeBlock(item: CorpusItem): string {
    return item.files.map((f) => `FILE: ${f.path}\n\`\`\`ts\n${f.content}\`\`\``).join('\n\n');
}
const JSON_SHAPE =
    '{"findings":[{"file":"<file path>","category":"<defect category>","confidence":"high|medium|low","summary":"<one line>"}]}';
function neutralPrompt(item: CorpusItem): string {
    return [
        'You are a senior code reviewer. Review the TypeScript below for REAL defects and report only genuine bugs you are confident about. If it is correct, report an empty findings array — do not invent problems.',
        `Respond with STRICT JSON only, exactly: ${JSON_SHAPE}`,
        '',
        codeBlock(item),
    ].join('\n');
}
function skepticPrompt(item: CorpusItem): string {
    return [
        'You are an adversarial security/correctness skeptic. Assume this code may hide a subtle, non-obvious defect that a normal review missed — a masked access-control/SSRF/traversal flaw, a boundary/logic inversion, a concurrency or resource-leak edge, a cross-file contract mismatch. Hunt for it. Report only defects you can concretely justify; if after hard scrutiny it is genuinely correct, report an empty array (do not fabricate).',
        `Respond with STRICT JSON only, exactly: ${JSON_SHAPE}`,
        '',
        codeBlock(item),
    ].join('\n');
}

function parseFindings(text: string): Finding[] {
    if (!text) return [];
    const start = text.indexOf('{');
    if (start < 0) return [];
    let depth = 0;
    let end = -1;
    for (let i = start; i < text.length; i++) {
        if (text[i] === '{') depth++;
        else if (text[i] === '}' && --depth === 0) {
            end = i;
            break;
        }
    }
    if (end < 0) return [];
    try {
        const obj = JSON.parse(text.slice(start, end + 1)) as { findings?: unknown };
        const arr = Array.isArray(obj.findings) ? obj.findings : [];
        return arr
            .filter((f): f is Record<string, unknown> => typeof f === 'object' && f !== null)
            .map((f) => ({
                file: String(f.file ?? ''),
                category: String(f.category ?? ''),
                confidence: (['high', 'medium', 'low'].includes(String(f.confidence)) ? String(f.confidence) : 'high') as
                    | 'high'
                    | 'medium'
                    | 'low',
            }))
            .filter((f) => f.file.length > 0);
    } catch {
        return [];
    }
}

type Reviews = Record<string, Record<string, Finding[]>>; // fixtureId → member → findings

// Direct, INDEPENDENT client calls — NOT council_cli. The council `run`/`debate`
// transport imposes multi-round peer-review with cross-member visibility and
// returns prose ("## Round 2 … Reviewer A"), which (a) violates the claim's
// independent-skeptic requirement and (b) defeats JSON parsing. We call each
// provider's client once, in isolation, with a strict-JSON system prompt.
const SYSTEM_JSON =
    'You are a code reviewer. Output ONLY one JSON object — no prose, no markdown, no code fences. ' +
    'Shape exactly: {"findings":[{"file":"<path>","category":"<category>","confidence":"high|medium|low","summary":"<one line>"}]}. ' +
    'If the code is correct, output {"findings":[]}. Do not include any text before or after the JSON object.';

let _clients: Record<string, ExternalAIClient> | null = null;
function getClients(): Record<string, ExternalAIClient> {
    if (!_clients) {
        _clients = {
            anthropic: new AnthropicClient({ model: 'claude-sonnet-4-5', api_key: load_anthropic_key() }),
            openai: new OpenAIClient({ model: 'gpt-4o', api_key: load_openai_key() }),
        };
    }
    return _clients;
}

async function directReview(item: CorpusItem, userPrompt: string): Promise<Record<string, Finding[]>> {
    const cs = getClients();
    const out: Record<string, Finding[]> = {};
    for (const [name, client] of Object.entries(cs)) {
        let text = '';
        try {
            const resp = await client.ask(SYSTEM_JSON, userPrompt, 1200);
            text = resp.text ?? '';
        } catch (e) {
            process.stderr.write(`  ${name} error on ${item.id}: ${(e as Error).message}\n`);
        }
        out[name] = parseFindings(text);
    }
    return out;
}

interface Passes {
    neutral: Reviews; // defect fixtures only
    skeptic: Reviews; // residual + controls
    residualIds: string[];
}

async function realPasses(items: CorpusItem[]): Promise<Passes> {
    const defects = items.filter((i) => !i.is_clean);
    const controls = items.filter((i) => i.is_clean);
    const neutral: Reviews = {};
    process.stderr.write('stage 1 (neutral, independent per vendor) over 12 defects…\n');
    for (const d of defects) {
        neutral[d.id] = await directReview(d, neutralPrompt(d));
        process.stderr.write(`  neutral ${d.id}: ${Object.entries(neutral[d.id]).map(([m, f]) => `${m}=${f.length}`).join(' ')}\n`);
    }
    const residual = defects.filter((d) => !Object.values(neutral[d.id]).flat().some((f) => caughtDefect(groundTruth(d), [f])));
    process.stderr.write(`residual (missed by BOTH neutral passes): ${residual.map((r) => r.id).join(', ') || '(none)'}\n`);
    const skeptic: Reviews = {};
    process.stderr.write('stage 2 (adversarial skeptic, independent per vendor) over residual + controls…\n');
    for (const item of [...residual, ...controls]) {
        skeptic[item.id] = await directReview(item, skepticPrompt(item));
        process.stderr.write(`  skeptic ${item.id}: ${Object.entries(skeptic[item.id]).map(([m, f]) => `${m}=${f.length}`).join(' ')}\n`);
    }
    return { neutral, skeptic, residualIds: residual.map((r) => r.id) };
}

function mockPasses(items: CorpusItem[]): Passes {
    // Deterministic proof that the pipeline discriminates: neutral 2-vendor pass
    // catches the "easier" defects; a hard residual survives; the skeptic panel
    // then recovers more of the residual than a single skeptic, at controlled FP.
    const defects = items.filter((i) => !i.is_clean);
    const controls = items.filter((i) => i.is_clean);
    const neutralCatch = new Set(['sec-01', 'sec-02', 'inv-01', 'inv-02', 'state-03', 'mfi-01']); // 6 caught neutrally
    // residual = the other 6: sec-03, inv-03, state-01, state-02, mfi-02, mfi-03
    const anthropicSkepticCatch = new Set(['sec-03', 'state-01']); // single skeptic recovers 2/6
    const openaiSkepticExtra = new Set(['inv-03', 'mfi-02', 'mfi-03']); // openai adds 3 more → panel 5/6
    const hit = (i: CorpusItem, m: string): Finding[] => [
        { file: i.ground_truth.defect_files[0] ?? i.files[0].path, category: i.defect_category, confidence: 'high' as const },
    ].filter(() => true).map((f) => ({ ...f, _m: m })).map(({ _m, ...f }) => f);
    const neutral: Reviews = {};
    for (const d of defects) neutral[d.id] = { anthropic: neutralCatch.has(d.id) ? hit(d, 'a') : [], openai: [] };
    const skeptic: Reviews = {};
    const residual = defects.filter((d) => !neutralCatch.has(d.id));
    for (const d of residual) {
        skeptic[d.id] = {
            anthropic: anthropicSkepticCatch.has(d.id) ? hit(d, 'a') : [],
            openai: openaiSkepticExtra.has(d.id) ? hit(d, 'o') : [],
        };
    }
    for (const c of controls) skeptic[c.id] = { anthropic: [], openai: c.id === 'clean-02' ? [{ file: c.files[0].path, category: 'correctness', confidence: 'high' }] : [] };
    return { neutral, skeptic, residualIds: residual.map((r) => r.id) };
}

function scorePasses(items: CorpusItem[], p: Passes): { inputs: CouncilBenchInputs; detail: Record<string, unknown> } {
    const byId = new Map(items.map((i) => [i.id, i]));
    const residual = p.residualIds.map((id) => byId.get(id)!);
    const controls = items.filter((i) => i.is_clean);

    const singleCaught: Record<string, boolean> = {};
    const panelCaught: Record<string, boolean> = {};
    for (const d of residual) {
        const gt = groundTruth(d);
        singleCaught[d.id] = caughtDefect(gt, p.skeptic[d.id]?.[SINGLE_SKEPTIC] ?? []);
        panelCaught[d.id] = caughtDefect(gt, Object.values(p.skeptic[d.id] ?? {}).flat());
    }
    const singleFp: Record<string, boolean> = {};
    const panelFp: Record<string, boolean> = {};
    for (const c of controls) {
        const gt = groundTruth(c);
        singleFp[c.id] = isFalsePositive(gt, p.skeptic[c.id]?.[SINGLE_SKEPTIC] ?? []);
        panelFp[c.id] = isFalsePositive(gt, Object.values(p.skeptic[c.id] ?? {}).flat());
    }
    const inputs: CouncilBenchInputs = {
        single_judge_residual_recall: recall(singleCaught),
        panel_residual_recall: recall(panelCaught),
        single_judge_fp_rate: fpRate(singleFp),
        panel_fp_rate: fpRate(panelFp),
        fp_noise_margin: 1 / 3,
    };
    const detail = {
        total_defects: items.filter((i) => !i.is_clean).length,
        residual_ids: p.residualIds,
        residual_size: residual.length,
        single_skeptic: SINGLE_SKEPTIC,
        single_residual_caught: Object.entries(singleCaught).filter(([, v]) => v).map(([k]) => k),
        panel_residual_caught: Object.entries(panelCaught).filter(([, v]) => v).map(([k]) => k),
        single_fp: Object.entries(singleFp).filter(([, v]) => v).map(([k]) => k),
        panel_fp: Object.entries(panelFp).filter(([, v]) => v).map(([k]) => k),
    };
    return { inputs, detail };
}

async function main(argv: string[]): Promise<number> {
    const mock = argv.includes('--mock');
    const run = argv.includes('--run');
    if (!mock && !run) {
        process.stderr.write('usage: bench_adversarial_council (--mock | --run)\n');
        return 2;
    }
    const items = loadCorpus();
    const passes = mock ? mockPasses(items) : await realPasses(items);
    const { inputs, detail } = scorePasses(items, passes);
    const verdict = evaluateCouncilBench(inputs);
    const report = {
        mode: mock ? 'mock' : 'run',
        corpus: 'internal/bench/adversarial-council/corpus.json',
        protocol:
            'stage1 2-vendor neutral → residual (missed by both); stage2 single skeptic (anthropic) vs cross-vendor panel union on residual; FP on clean controls',
        inputs,
        detail,
        verdict,
    };
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
    void main(process.argv.slice(2)).then((code) => process.exit(code));
}

export { parseFindings, scorePasses, main };
