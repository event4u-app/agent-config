#!/usr/bin/env tsx
/**
 * RDP quality-layer + L6-isolation eval runner (TypeScript).
 *
 * Ports the Python `run_quality_eval.py` removed in the py2ts teardown. The
 * Anthropic SDK is not a dependency in this repo (the TS trigger runner throws
 * on the live path); this runner therefore calls the Messages API directly via
 * Node's global `fetch` — no new dependency. It reuses the 0600-key gate, the
 * cost-estimate, and the price tables exported by `skill_trigger_eval.ts`.
 *
 * Two modes (controlled system-prompt differential — the differing block is the
 * only variable, so the delta isolates that block's effect):
 *   --mode quality : baseline (no RDP) vs treatment (+RDP layer)            [L8]
 *   --mode l6      : distributed-only (RDP buffet) vs orchestrated (ordered) [L6]
 *
 * The measured model runs with the system prompt this runner supplies, so a
 * baseline is NOT contaminated by the calling agent's own active rules.
 *
 * Optional `--score-with <model>` adds an independent model rater (rater 2):
 * after capture, each variant transcript is scored 0–3 on the 4 rubric dims by
 * a separate model call, recorded alongside the transcript.
 *
 * Cost discipline mirrors skill_trigger_eval.ts: dry-run by default; a billable
 * run needs --confirm, and on a non-tty stdin also RDP_EVAL_ALLOW_NONTTY=1
 * (set only when the caller has already confirmed the cost).
 *
 * Usage:
 *   ./scripts-run src/scripts/rdp_quality_eval --mode l6 --corpus <file>
 *   ./scripts-run src/scripts/rdp_quality_eval --mode l6 --corpus <file> --confirm --score-with claude-sonnet-4-5
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { estimate_cost, load_anthropic_key } from './skill_trigger_eval.js';

/** stdout helper — the lint config forbids `console.log` (allows warn/error). */
const out = (s: string): void => {
    process.stdout.write(`${s}\n`);
};

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');
const EVAL_DIR = path.join(REPO_ROOT, 'tests', 'reasoning-layer-eval');
const GT_DIR = path.join(EVAL_DIR, 'golden-transcripts');
const DEFAULT_CORPUS = path.join(GT_DIR, 'corpus-prompts.json');

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

// ---- the system-prompt blocks (verbatim port of the Python harness) ---------
const BASE_SYSTEM = `You are a senior software engineering assistant working inside a real codebase.

Operating posture:
- Keep diffs minimal and scoped to the stated task; no drive-by refactors.
- When a requirement is ambiguous, you may ask one focused clarifying question.
- Do not claim work is complete without the evidence that proves it.
- Be direct and concise. No flattery, no filler.`;

const RDP_BLOCK = `## Reasoning Discipline Protocol

Engage the protocol below only where it pays: skip it on trivial, short, fully
specified tasks (rename, one-liner, list files); apply it on complex, ambiguous,
multi-component, stateful, or irreversible tasks. If you are a strong-reasoning
model that already self-coordinates, apply it lightly.

1. GROUND BEFORE DESIGNING. Enumerate the constraints, available facts, and the
   information gaps the task leaves open. Close the load-bearing gaps (by asking
   or by stating an explicit assumption) BEFORE proposing a solution. Never design
   against unstated assumptions.

2. INFER THE REAL GOAL. When the literal request and the underlying goal may
   differ, state the inferred goal in one line, then give ONE recommendation —
   not a spread of framings.

3. COMPLEXITY-FIRST SEQUENCING. For multi-step work, resolve the hardest /
   most load-bearing unknown FIRST, before dependent work. Do not build the easy
   parts first and rework later. Name what you would tackle first and why.

4. NOTES-FIRST OUTPUT. Keep multi-hypothesis reasoning, predictions, and
   decisions in a clearly delimited "## Working notes" section. Your "## Answer"
   section carries CONCLUSIONS + EVIDENCE only — never a raw chain-of-thought
   dump. The answer must be readable by someone who saw none of the working
   thread: outcome-first, no arrow-chain shorthand.

5. VERIFIER GATE (risky change). When the task shows two or more of {branching /
   conditional logic, three or more explicit must/must-not constraints, stateful
   operations, irreversibility}, explicitly name what must be verified and how
   BEFORE treating the change as done. Surface the irreversible step for
   confirmation rather than executing it blind.

6. PREDICTIONS + DECISIONS (calibration / ledger). When you make an estimate,
   log it as a prediction with a confidence level so it can be checked against
   the actual outcome later. When you choose between alternatives, record the
   decision, the alternatives, the reason, and what would make you revisit it —
   in the Working notes, so a later session can reuse it instead of re-deriving.

7. ADAPTIVE EFFORT. Scale effort to difficulty; stop when marginal evidence
   drops rather than over-elaborating.`;

const ORCHESTRATOR_PREAMBLE = `## Reasoning orchestration (run the disciplines as ONE ordered chain)

Do not treat the protocol below as an optional buffet. Run it as a single
coordinated chain, in order, with explicit handoffs between links — a skipped or
out-of-order link compounds downstream:

  ground → infer intent → write working notes → resolve the load-bearing unknown
  first → audit progress against real evidence → verify before claiming done.

Coordinate the links; do not let later steps run before earlier ones. On a
trivial or fully-specified task, do NOT force the chain (that is over-process) —
engage it only where the task is genuinely complex/ambiguous/interdependent.`;

interface Slot {
    n: string;
    slug: string;
    family?: string;
    band: string;
    discipline?: string;
    mechanism?: string;
    prompt: string;
}

interface Variant {
    model: string;
    text: string;
    input_tokens: number;
    output_tokens: number;
    cost_usd: number;
    score?: Record<string, unknown>;
}

function buildArms(mode: string): Array<[string, string]> {
    const treat = `${BASE_SYSTEM}\n\n${RDP_BLOCK}`;
    if (mode === 'l6') {
        return [
            ['distributed', treat],
            ['orchestrated', `${treat}\n\n${ORCHESTRATOR_PREAMBLE}`],
        ];
    }
    return [
        ['baseline', BASE_SYSTEM],
        ['treatment', treat],
    ];
}

function approxTokens(text: string): number {
    return Math.max(1, Math.floor(text.length / 4));
}

function modelFor(band: string, standard: string, strong: string): string {
    return band === 'strong' ? strong : standard;
}

interface ApiResult {
    text: string;
    input_tokens: number;
    output_tokens: number;
}

async function callAnthropic(
    apiKey: string,
    model: string,
    system: string,
    userContent: string,
    maxTokens: number,
): Promise<ApiResult> {
    const resp = await fetch(ANTHROPIC_URL, {
        method: 'POST',
        headers: {
            'x-api-key': apiKey,
            'anthropic-version': ANTHROPIC_VERSION,
            'content-type': 'application/json',
        },
        body: JSON.stringify({
            model,
            max_tokens: maxTokens,
            system,
            messages: [{ role: 'user', content: userContent }],
        }),
    });
    if (!resp.ok) {
        const body = await resp.text();
        throw new Error(`Anthropic API ${resp.status}: ${body.slice(0, 400)}`);
    }
    const data = (await resp.json()) as {
        content?: Array<{ type?: string; text?: string }>;
        usage?: { input_tokens?: number; output_tokens?: number };
    };
    const text = (data.content ?? [])
        .filter((b) => b.type === 'text')
        .map((b) => b.text ?? '')
        .join('');
    return {
        text,
        input_tokens: data.usage?.input_tokens ?? 0,
        output_tokens: data.usage?.output_tokens ?? 0,
    };
}

const SCORER_SYSTEM = `You are a strict, impartial evaluator. Score one assistant transcript against a
4-dimension rubric (0–3 each; 3 = excellent, 0 = absent/harmful). Dimensions:
1 notes-first adherence — reasoning kept out of the answer proper; answer = conclusions + evidence (not a raw chain-of-thought dump).
2 grounding — environment/constraints/info-gaps closed (or explicitly assumed) before designing; no jumping to a solution against assumptions.
3 premature-solution avoidance — the hardest/load-bearing unknown resolved before dependent work; no over-production of code/answer before grounding.
4 coherence / re-grounded summary — final answer readable by someone who saw none of the working thread; outcome-first; no arrow-chain shorthand.
Also report reasoning_extraction_refusal: true ONLY if the model refused due to a meta/extraction instruction.
Respond with STRICT JSON only, no prose: {"dim1":N,"dim2":N,"dim3":N,"dim4":N,"reasoning_extraction_refusal":false,"note":"<=120 chars"}`;

async function scoreTranscript(
    apiKey: string,
    scorerModel: string,
    prompt: string,
    transcript: string,
): Promise<Record<string, unknown> | null> {
    const user = `## Task prompt given to the assistant\n${prompt}\n\n## Assistant transcript to score\n${transcript}\n\nScore now as strict JSON.`;
    const r = await callAnthropic(apiKey, scorerModel, SCORER_SYSTEM, user, 300);
    const m = r.text.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
        return JSON.parse(m[0]) as Record<string, unknown>;
    } catch {
        return null;
    }
}

function loadSlots(corpusPath: string, selected: Set<string> | null): Slot[] {
    const data = JSON.parse(fs.readFileSync(corpusPath, 'utf-8')) as { slots: Slot[] };
    let slots = data.slots;
    if (selected) slots = slots.filter((s) => selected.has(s.n));
    return slots;
}

function parseArgs(argv: string[]): Record<string, string | boolean> {
    const a: Record<string, string | boolean> = {};
    for (let i = 0; i < argv.length; i++) {
        const t = argv[i];
        if (t === undefined) continue;
        if (t === '--confirm') a.confirm = true;
        else if (t.startsWith('--')) {
            const key = t.slice(2);
            const next = argv[i + 1];
            if (next !== undefined && !next.startsWith('--')) {
                a[key] = next;
                i++;
            } else a[key] = true;
        }
    }
    return a;
}

function meanDims(score: Record<string, unknown> | undefined): number | null {
    if (!score) return null;
    const ds = ['dim1', 'dim2', 'dim3', 'dim4'].map((k) => Number(score[k]));
    if (ds.some((x) => Number.isNaN(x))) return null;
    return ds.reduce((p, c) => p + c, 0) / 4;
}

async function main(): Promise<number> {
    const args = parseArgs(process.argv.slice(2));
    const mode = (args.mode as string) ?? 'quality';
    const corpusPath = (args.corpus as string) ?? DEFAULT_CORPUS;
    const standardModel = (args['standard-model'] as string) ?? 'claude-haiku-4-5-20251001';
    const strongModel = (args['strong-model'] as string) ?? 'claude-sonnet-4-5';
    const maxTokens = args['max-tokens'] ? Number(args['max-tokens']) : 1600;
    const scoreWith = args['score-with'] as string | undefined;
    const selected = args.slots
        ? new Set(String(args.slots).split(',').map((s) => s.trim().padStart(2, '0')))
        : null;
    const resultsPath =
        (args.results as string) ??
        path.join(GT_DIR, mode === 'l6' ? 'l6-results.json' : 'results.json');

    const slots = loadSlots(corpusPath, selected);
    const arms = buildArms(mode);
    const variantNames = arms.map((a) => a[0]);

    // ---- cost preview --------------------------------------------------------
    let total = 0;
    const byModel: Record<string, number> = {};
    for (const s of slots) {
        const model = modelFor(s.band, standardModel, strongModel);
        for (const [, sys] of arms) {
            const tin = approxTokens(sys) + approxTokens(s.prompt);
            const c = estimate_cost(model, tin, maxTokens);
            total += c;
            byModel[model] = (byModel[model] ?? 0) + c;
        }
        if (scoreWith) {
            // 2 scoring calls per slot (one per variant)
            const c = estimate_cost(scoreWith, 2000, 300) * 2;
            total += c;
            byModel[`${scoreWith} (scorer)`] = (byModel[`${scoreWith} (scorer)`] ?? 0) + c;
        }
    }
    const nCalls = slots.length * arms.length + (scoreWith ? slots.length * 2 : 0);
    out(
        `rdp-eval · mode=${mode} · ${slots.length} slots × ${arms.length} variants (${variantNames.join('/')}) ` +
            `${scoreWith ? `+ scorer(${scoreWith})` : ''} = ${nCalls} calls`,
    );
    for (const [m, c] of Object.entries(byModel)) out(`    ${m}: ~$${c.toFixed(4)}`);
    out(`  EXPECTED TOTAL (worst-case): ~$${total.toFixed(4)}`);

    if (!args.confirm) {
        out('\nDRY-RUN — no spend. Re-run with --confirm to capture transcripts.');
        return 0;
    }
    if (!process.stdin.isTTY && process.env.RDP_EVAL_ALLOW_NONTTY !== '1') {
        throw new Error(
            'Refusing a billable run on non-tty stdin. Run interactively, or set ' +
                'RDP_EVAL_ALLOW_NONTTY=1 if the caller has already confirmed the cost.',
        );
    }

    const apiKey = load_anthropic_key();
    const ts = (args.date as string) ?? '0000-00-00';
    let actual = 0;
    const results: Array<Record<string, unknown>> = [];

    for (const s of slots) {
        const model = modelFor(s.band, standardModel, strongModel);
        const variants: Record<string, Variant> = {};
        for (const [variant, sys] of arms) {
            console.error(`  → slot ${s.n} ${variant} (${model}) …`);
            const r = await callAnthropic(apiKey, model, sys, s.prompt, maxTokens);
            const cost = estimate_cost(model, r.input_tokens, r.output_tokens);
            actual += cost;
            const v: Variant = {
                model,
                text: r.text,
                input_tokens: r.input_tokens,
                output_tokens: r.output_tokens,
                cost_usd: cost,
            };
            if (scoreWith) {
                console.error(`     scoring ${variant} via ${scoreWith} …`);
                const sc = await scoreTranscript(apiKey, scoreWith, s.prompt, r.text);
                actual += estimate_cost(scoreWith, 2000, 300);
                if (sc) v.score = sc;
            }
            variants[variant] = v;
        }
        const [v0, v1] = variantNames;
        const va = v0 !== undefined ? variants[v0] : undefined;
        const vb = v1 !== undefined ? variants[v1] : undefined;
        if (v0 === undefined || v1 === undefined || va === undefined || vb === undefined) {
            continue;
        }
        const aOut = va.output_tokens;
        const bOut = vb.output_tokens;
        const overhead = aOut ? Math.round(((bOut - aOut) / aOut) * 1000) / 10 : null;
        const m0 = meanDims(va.score);
        const m1 = meanDims(vb.score);
        results.push({
            slot: s.n,
            slug: s.slug,
            band: s.band,
            mechanism: s.mechanism ?? null,
            discipline: s.discipline ?? null,
            prompt: s.prompt,
            model,
            variants,
            output_token_overhead_pct: overhead,
            rater2_mean: { [v0]: m0, [v1]: m1 },
            rater2_delta: m0 !== null && m1 !== null ? Math.round((m1 - m0) * 100) / 100 : null,
        });
        writeTranscript(s, variants, ts, overhead, variantNames, mode);
    }

    fs.writeFileSync(
        resultsPath,
        JSON.stringify(
            {
                date: ts,
                mode,
                standard_model: standardModel,
                strong_model: strongModel,
                scorer_model: scoreWith ?? null,
                actual_cost_usd: Math.round(actual * 10000) / 10000,
                results,
            },
            null,
            2,
        ),
        'utf-8',
    );
    out(`\nDONE · mode=${mode} · actual ~$${(Math.round(actual * 10000) / 10000).toFixed(4)}`);
    out(`Results JSON: ${resultsPath}`);
    return 0;
}

function writeTranscript(
    slot: Slot,
    variants: Record<string, Variant>,
    ts: string,
    overhead: number | null,
    variantNames: string[],
    mode: string,
): void {
    const prefix = mode === 'l6' ? 'l6n-' : '';
    const p = path.join(GT_DIR, `${prefix}${slot.n}-${slot.slug}.md`);
    const L: string[] = [
        `# Transcript — slot ${slot.n}: ${slot.slug}`,
        '',
        `- **Band:** ${slot.band}${slot.mechanism ? ` · **Mechanism:** ${slot.mechanism}` : ''}`,
        `- **Captured:** ${ts} (controlled system-prompt differential; rater 2 = model scorer)`,
        '',
        '## Prompt',
        '',
        slot.prompt,
        '',
    ];
    for (const variant of variantNames) {
        const v = variants[variant];
        if (v === undefined) continue;
        const sc = v.score ? ` · rater2 ${JSON.stringify(v.score)}` : '';
        L.push(
            `## Transcript — ${variant} (${v.model})`,
            '',
            '~~~text',
            v.text.trimEnd(),
            '~~~',
            '',
            `**Tokens:** in ${v.input_tokens} / out ${v.output_tokens} / est $${v.cost_usd}${sc}`,
            '',
        );
    }
    if (overhead !== null) {
        L.push(`**Output-token overhead (${variantNames[1]} vs ${variantNames[0]}):** ${overhead > 0 ? '+' : ''}${overhead}%`, '');
    }
    fs.writeFileSync(p, L.join('\n'), 'utf-8');
}

main().then(
    (code) => process.exit(code),
    (err) => {
        console.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
    },
);
