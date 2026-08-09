/**
 * Critic-protocol A/B runner (road-to-judgment-and-forensic-evidence Phase 2).
 *
 * Measures the `load_bearing` critic protocol against the shipped `legacy`
 * adversarial-skeptic posture on the frozen corpus
 * (internal/bench/adversarial-council/corpus.json) — the corpus on which the
 * legacy posture scored a measured 100% false-positive rate on the 3
 * controversial-but-correct clean controls (run 2026-07-21).
 *
 * Protocol (pre-registered in docs/CLAIMS.md `critic-protocol-load-bearing-ab`
 * BEFORE any paid run; thresholds, prompts, and scorer semantics frozen there):
 *
 *   Both arms run as ONE independent single-shot review per vendor
 *   (anthropic + openai, direct client calls — NEVER council_cli transport)
 *   over all 15 corpus items (12 defect fixtures + 3 clean controls).
 *
 *   PER VENDOR, the load_bearing arm promotes iff BOTH:
 *     (1) FP rate on the 3 clean controls < 50%, AND
 *     (2) TP count on the 12 defect fixtures >= 80% of the legacy arm's
 *         TP count in the same run.
 *
 *   Scoring is the existing deterministic scorer applied IDENTICALLY to both
 *   arms on findings only (caughtDefect / isFalsePositive). The protocol's
 *   `verdict` field is a secondary published signal; "flawed" with empty
 *   findings counts as `incoherent` (2026-08-09 council design pass) — never
 *   as a catch, never as an FP.
 *
 * `--mock` validates the pipeline in BOTH directions with zero spend (a
 * passing arm must read PASS, a failing arm must read FAIL) — the roadmap's
 * pre-spend tripwire. `--run` fires the paid cross-vendor calls
 * (maintainer spend-gated). `--out <file>` writes the report JSON.
 *
 * The `legacy` default and the `critic_protocol` config key live in
 * scripts/ai_council/config.ts; this runner takes the arms from the corpus
 * loop directly (an A/B needs both regardless of the configured value).
 */
// ledger-exempt: bench runner, not a CI gate — spend-gated on-demand measurement
// with a fixed 15-item corpus; the report itself carries the full denominator.
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
    AnthropicClient,
    OpenAIClient,
    load_anthropic_key,
    load_openai_key,
    type ExternalAIClient,
} from './ai_council/clients.js';
import {
    caughtDefect,
    isFalsePositive,
    categoryFamily,
    type Finding,
    type GroundTruth,
} from './_lib/adversarial_bench_score.js';

const REPO_ROOT = process.cwd();
const CORPUS_PATH = path.join(REPO_ROOT, 'internal/bench/adversarial-council/corpus.json');

/** Pre-registered thresholds — frozen with the CLAIMS entry, never adjusted. */
const FP_CEILING = 0.5; // strict: FP rate must be < 0.5 on the 3 controls
const TP_RETENTION_FLOOR = 0.8; // load_bearing TP >= 0.8 × legacy TP, per vendor

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

const FINDINGS_SHAPE =
    '{"findings":[{"file":"<file path>","category":"<defect category>","confidence":"high|medium|low","summary":"<one line>"}]}';

/**
 * LEGACY arm — byte-identical to the prompt that produced the measured 100%
 * FP on the clean controls (bench_adversarial_council.ts skepticPrompt).
 */
function legacyPrompt(item: CorpusItem): string {
    return [
        'You are an adversarial security/correctness skeptic. Assume this code may hide a subtle, non-obvious defect that a normal review missed — a masked access-control/SSRF/traversal flaw, a boundary/logic inversion, a concurrency or resource-leak edge, a cross-file contract mismatch. Hunt for it. Report only defects you can concretely justify; if after hard scrutiny it is genuinely correct, report an empty array (do not fabricate).',
        `Respond with STRICT JSON only, exactly: ${FINDINGS_SHAPE}`,
        '',
        codeBlock(item),
    ].join('\n');
}

const PROTOCOL_SHAPE =
    '{"invariant":"<one sentence>","load_bearing_assumption":"<one sentence, names file+function>","failure_scenario_if_broken":"<one sentence>","cost_of_avoidance":"<one sentence>","succeeded_would_do":"<one sentence or \'nothing\'>","verdict":"holds|flawed","findings":[{"file":"<file path>","category":"<defect category>","confidence":"high|medium|low","summary":"<one line>"}]}';

/**
 * LOAD_BEARING arm — the fixed protocol. Design integrated the 2026-08-09
 * council convergence: the assumption must be tied to a named file+function
 * (no platitudes), a concrete failure scenario forces the assumption to be
 * load-bearing, and "holds" is an explicitly permitted, completed review.
 */
function loadBearingPrompt(item: CorpusItem): string {
    return [
        'You are a rigorous correctness critic running a fixed protocol. Do not free-associate defects. Work strictly in this order:',
        '1. State the invariant this code must maintain to be correct, then name the SINGLE load-bearing assumption it rests on — the one whose failure would break that invariant. Tie it to a named file and function; a platitude ("inputs are valid") is not an assumption.',
        '2. State the concrete failure scenario if that assumption broke: which input or state leads to which wrong behaviour. If you cannot state one, the assumption is not load-bearing — pick again.',
        '3. State the cost of what this code is avoiding: what failure mode or complexity does its current shape avert?',
        "4. State what someone who has already built a comparable thing successfully would do differently here, if anything ('nothing' is acceptable).",
        '5. Now inspect the assumption against the code. If it survives inspection and the failure scenario is unreachable, your verdict is "holds" and findings is []. A defensible "holds" with the assumption and scenario stated is a completed review, not a refusal. If the assumption breaks, or the failure scenario is reachable, or you find another concrete defect you can justify against specific lines, your verdict is "flawed" and findings lists each one.',
        `Respond with STRICT JSON only, exactly: ${PROTOCOL_SHAPE}`,
        '',
        codeBlock(item),
    ].join('\n');
}

const SYSTEM_JSON =
    'You are a code reviewer. Output ONLY one JSON object — no prose, no markdown, no code fences. ' +
    'If the code is correct, the "findings" array is empty. Do not include any text before or after the JSON object.';

interface ArmResponse {
    findings: Finding[];
    verdict: 'holds' | 'flawed' | null; // null for the legacy arm (no verdict field)
}

function extractJsonObject(text: string): Record<string, unknown> | null {
    if (!text) return null;
    const start = text.indexOf('{');
    if (start < 0) return null;
    let depth = 0;
    let end = -1;
    for (let i = start; i < text.length; i++) {
        if (text[i] === '{') depth++;
        else if (text[i] === '}' && --depth === 0) {
            end = i;
            break;
        }
    }
    if (end < 0) return null;
    try {
        return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
    } catch {
        return null;
    }
}

function parseArmResponse(text: string): ArmResponse {
    const obj = extractJsonObject(text);
    if (!obj) return { findings: [], verdict: null };
    const arr = Array.isArray(obj.findings) ? obj.findings : [];
    const findings = arr
        .filter((f): f is Record<string, unknown> => typeof f === 'object' && f !== null)
        .map((f) => ({
            file: String(f.file ?? ''),
            category: String(f.category ?? ''),
            confidence: (['high', 'medium', 'low'].includes(String(f.confidence))
                ? String(f.confidence)
                : 'high') as 'high' | 'medium' | 'low',
        }))
        .filter((f) => f.file.length > 0);
    const verdict = obj.verdict === 'holds' || obj.verdict === 'flawed' ? obj.verdict : null;
    return { findings, verdict };
}

type Arm = 'legacy' | 'load_bearing';
type Vendor = 'anthropic' | 'openai';
const ARMS: readonly Arm[] = ['legacy', 'load_bearing'];
const VENDORS: readonly Vendor[] = ['anthropic', 'openai'];

/** fixtureId → arm → vendor → response */
type Reviews = Record<string, Record<Arm, Record<Vendor, ArmResponse>>>;

let _clients: Record<Vendor, ExternalAIClient> | null = null;
function getClients(): Record<Vendor, ExternalAIClient> {
    if (!_clients) {
        _clients = {
            anthropic: new AnthropicClient({ model: 'claude-sonnet-4-5', api_key: load_anthropic_key() }),
            openai: new OpenAIClient({ model: 'gpt-4o', api_key: load_openai_key() }),
        };
    }
    return _clients;
}

async function realReviews(items: CorpusItem[]): Promise<Reviews> {
    const cs = getClients();
    const out: Reviews = {};
    for (const item of items) {
        const perArm = { legacy: {}, load_bearing: {} } as Reviews[string];
        out[item.id] = perArm;
        for (const arm of ARMS) {
            const prompt = arm === 'legacy' ? legacyPrompt(item) : loadBearingPrompt(item);
            for (const vendor of VENDORS) {
                let text = '';
                try {
                    const resp = await cs[vendor].ask(SYSTEM_JSON, prompt, 1600);
                    text = resp.text ?? '';
                } catch (e) {
                    process.stderr.write(`  ${vendor} error on ${item.id}/${arm}: ${(e as Error).message}\n`);
                }
                const r = parseArmResponse(text);
                perArm[arm][vendor] = r;
                process.stderr.write(
                    `  ${arm} ${item.id} ${vendor}: findings=${String(r.findings.length)} verdict=${r.verdict ?? '-'}\n`,
                );
            }
        }
    }
    return out;
}

/**
 * Mock reviews for pipeline validation in a chosen direction.
 * `direction: 'pass'` — load_bearing keeps TP parity with legacy and stays
 * silent on the controls. `direction: 'fail'` — load_bearing rubber-stamps
 * (misses defects below the retention floor) so the verdict must read FAIL.
 */
function mockReviews(items: CorpusItem[], direction: 'pass' | 'fail'): Reviews {
    const hit = (i: CorpusItem): Finding[] => [
        {
            file: i.ground_truth.defect_files[0] ?? i.files[0]?.path ?? '',
            category: i.defect_category,
            confidence: 'high' as const,
        },
    ];
    const fpHit = (i: CorpusItem): Finding[] => [
        { file: i.files[0]?.path ?? '', category: 'correctness', confidence: 'high' as const },
    ];
    const out: Reviews = {};
    const defects = items.filter((i) => !i.is_clean);
    const keepIds = new Set(
        // In 'fail' direction the load_bearing arm catches only half the
        // defects legacy catches — below the 0.8 retention floor.
        defects.filter((_, idx) => idx % 2 === 0).map((d) => d.id),
    );
    for (const item of items) {
        const legacyResp: ArmResponse = item.is_clean
            ? { findings: fpHit(item), verdict: null } // legacy FPs every control (the measured defect)
            : { findings: hit(item), verdict: null };
        const lbCatches = item.is_clean ? false : direction === 'pass' || keepIds.has(item.id);
        const lbResp: ArmResponse = item.is_clean
            ? { findings: [], verdict: 'holds' }
            : lbCatches
              ? { findings: hit(item), verdict: 'flawed' }
              : { findings: [], verdict: 'holds' };
        out[item.id] = {
            legacy: { anthropic: legacyResp, openai: legacyResp },
            load_bearing: { anthropic: lbResp, openai: lbResp },
        };
    }
    return out;
}

interface VendorArmScore {
    tp: number;
    fp: number;
    fp_rate: number;
    incoherent: number;
    holds_on_clean: number;
    caught_ids: string[];
    fp_ids: string[];
}

interface VendorVerdict {
    legacy: VendorArmScore;
    load_bearing: VendorArmScore;
    tp_retention: number | null;
    fp_pass: boolean;
    tp_pass: boolean;
    promotes: boolean;
}

function scoreVendor(items: CorpusItem[], reviews: Reviews, vendor: Vendor): VendorVerdict {
    const defects = items.filter((i) => !i.is_clean);
    const controls = items.filter((i) => i.is_clean);
    const armScore = (arm: Arm): VendorArmScore => {
        const caught: string[] = [];
        let incoherent = 0;
        let holdsOnClean = 0;
        for (const d of defects) {
            const r = reviews[d.id]?.[arm]?.[vendor] ?? { findings: [], verdict: null };
            if (caughtDefect(groundTruth(d), r.findings)) caught.push(d.id);
            if (r.verdict === 'flawed' && r.findings.length === 0) incoherent++;
        }
        const fpIds: string[] = [];
        for (const c of controls) {
            const r = reviews[c.id]?.[arm]?.[vendor] ?? { findings: [], verdict: null };
            if (isFalsePositive(groundTruth(c), r.findings)) fpIds.push(c.id);
            if (r.verdict === 'flawed' && r.findings.length === 0) incoherent++;
            if (r.verdict === 'holds') holdsOnClean++;
        }
        return {
            tp: caught.length,
            fp: fpIds.length,
            fp_rate: controls.length ? fpIds.length / controls.length : 0,
            incoherent,
            holds_on_clean: holdsOnClean,
            caught_ids: caught,
            fp_ids: fpIds,
        };
    };
    const legacy = armScore('legacy');
    const load_bearing = armScore('load_bearing');
    const tp_retention = legacy.tp > 0 ? load_bearing.tp / legacy.tp : null;
    const fp_pass = load_bearing.fp_rate < FP_CEILING;
    // A legacy TP of 0 leaves retention undefined. NOT part of the frozen
    // registration (which is silent on a zero baseline) — a conservative
    // in-code rule, unexercised in the recorded run (legacy TP was 10 and 5):
    // retention unshowable against a zero baseline → tp_pass false.
    const tp_pass = tp_retention !== null && tp_retention >= TP_RETENTION_FLOOR;
    return { legacy, load_bearing, tp_retention, fp_pass, tp_pass, promotes: fp_pass && tp_pass };
}

function buildReport(items: CorpusItem[], reviews: Reviews, mode: string): Record<string, unknown> {
    const perVendor: Record<string, VendorVerdict> = {};
    for (const vendor of VENDORS) perVendor[vendor] = scoreVendor(items, reviews, vendor);
    const promotes = VENDORS.every((v) => perVendor[v]?.promotes === true);
    const detail: Record<string, unknown> = {};
    for (const item of items) {
        const perItem: Record<string, unknown> = { is_clean: item.is_clean };
        for (const arm of ARMS) {
            for (const vendor of VENDORS) {
                const r = reviews[item.id]?.[arm]?.[vendor];
                perItem[`${arm}_${vendor}`] = r
                    ? { findings: r.findings.length, verdict: r.verdict }
                    : null;
            }
        }
        detail[item.id] = perItem;
    }
    return {
        mode,
        corpus: 'internal/bench/adversarial-council/corpus.json',
        claim: 'critic-protocol-load-bearing-ab (docs/CLAIMS.md, pre-registered 2026-08-09)',
        protocol:
            'both arms single-shot per vendor over all 15 items; FP on findings only, identical scorer both arms; verdict secondary; flawed+empty findings = incoherent',
        thresholds: { fp_ceiling: FP_CEILING, tp_retention_floor: TP_RETENTION_FLOOR },
        per_vendor: perVendor,
        verdict: {
            promotes,
            direction: promotes ? 'both thresholds met per vendor' : 'at least one threshold missed',
            default_unchanged: 'legacy stays the default regardless (config critic_protocol)',
        },
        detail,
    };
}

async function main(argv: string[]): Promise<number> {
    const mock = argv.includes('--mock');
    const run = argv.includes('--run');
    const outIdx = argv.indexOf('--out');
    const outFile = outIdx >= 0 ? argv[outIdx + 1] : null;
    if (!mock && !run) {
        process.stderr.write('usage: bench_critic_protocol (--mock | --run) [--out <file>]\n');
        return 2;
    }
    const items = loadCorpus();
    if (mock) {
        // Tripwire (roadmap pre-mortem): the pipeline must discriminate in BOTH
        // directions before any paid call.
        const passReport = buildReport(items, mockReviews(items, 'pass'), 'mock-pass');
        const failReport = buildReport(items, mockReviews(items, 'fail'), 'mock-fail');
        const passOk = (passReport.verdict as { promotes: boolean }).promotes === true;
        const failOk = (failReport.verdict as { promotes: boolean }).promotes === false;
        process.stdout.write(JSON.stringify({ mock_pass: passReport, mock_fail: failReport }, null, 2) + '\n');
        if (!passOk || !failOk) {
            process.stderr.write(
                `mock discrimination FAILED: pass-direction promotes=${String(passOk)}, fail-direction rejects=${String(failOk)} — do NOT run paid calls.\n`,
            );
            return 1;
        }
        process.stderr.write('mock discrimination OK in both directions.\n');
        return 0;
    }
    const reviews = await realReviews(items);
    const report = buildReport(items, reviews, 'run');
    const json = JSON.stringify(report, null, 2) + '\n';
    if (outFile) fs.writeFileSync(outFile, json);
    process.stdout.write(json);
    return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
    void main(process.argv.slice(2)).then((code) => process.exit(code));
}

export { parseArmResponse, scoreVendor, buildReport, mockReviews, legacyPrompt, loadBearingPrompt };
