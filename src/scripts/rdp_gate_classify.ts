#!/usr/bin/env tsx
/**
 * RDP gate-time classification validation (road-to-rdp-frontier-polish Phase 1).
 *
 * The council's blocker on "keep-scoped" (2026-06-22): scoping the orchestrator
 * to interdependent-multi-step work via agent self-assessment is only honest if
 * the agent can classify a task AT GATE TIME — from the prompt alone, before
 * doing the work. This script measures exactly that: the standard host classifies
 * each labelled corpus prompt as multi-step vs single-turn, scored against the
 * ground-truth `mechanism` label. High accuracy → the self-assessment gate is a
 * real control, not vibes. Low accuracy → keep-scoped is not implementable.
 *
 * Direct Messages API via fetch (no SDK dep), reuses the key gate + cost
 * estimate from skill_trigger_eval.ts. Dry-run by default; --confirm to spend
 * (+ RDP_EVAL_ALLOW_NONTTY=1 on a non-tty caller that has confirmed cost).
 *
 * Usage: ./scripts-run src/scripts/rdp_gate_classify --corpus <file> --confirm
 */
import * as fs from 'node:fs';
import { estimate_cost, load_anthropic_key } from './skill_trigger_eval.js';

/** stdout helper — the lint config forbids `console.log` (allows warn/error). */
const emit = (s: string): void => {
    process.stdout.write(`${s}\n`);
};

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

const GATE_SYSTEM = `You are an agent deciding, at the START of a task (before doing any work), whether
to engage a heavyweight multi-step reasoning orchestrator. You see ONLY the task
prompt. Classify the task into exactly one bucket using the rdp-gate criterion:

- "multi-step": interdependent multi-step work where the ordering and handoffs
  between steps matter (e.g. schema → API → job → UI; a migration with stages; a
  cross-cutting refactor). The orchestrator helps here.
- "single-turn": a single analytical or lookup question, a naming/explain/yes-no
  ask, or a one-shot edit — work that does NOT decompose into ordered
  interdependent steps. The orchestrator over-processes here.

Respond with STRICT JSON only: {"bucket":"multi-step"|"single-turn","confidence":"high"|"medium"|"low"}`;

interface Slot {
    n: string;
    slug: string;
    mechanism?: string;
    band: string;
    prompt: string;
}

async function classify(apiKey: string, model: string, prompt: string): Promise<{ bucket: string; confidence: string } | null> {
    const resp = await fetch(ANTHROPIC_URL, {
        method: 'POST',
        headers: {
            'x-api-key': apiKey,
            'anthropic-version': ANTHROPIC_VERSION,
            'content-type': 'application/json',
        },
        body: JSON.stringify({
            model,
            max_tokens: 60,
            system: GATE_SYSTEM,
            messages: [{ role: 'user', content: `Task prompt:\n${prompt}` }],
        }),
    });
    if (!resp.ok) throw new Error(`API ${resp.status}: ${(await resp.text()).slice(0, 300)}`);
    const data = (await resp.json()) as {
        content?: Array<{ type?: string; text?: string }>;
        usage?: { input_tokens?: number; output_tokens?: number };
    };
    const text = (data.content ?? []).filter((b) => b.type === 'text').map((b) => b.text ?? '').join('');
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
        return JSON.parse(m[0]) as { bucket: string; confidence: string };
    } catch {
        return null;
    }
}

function expectedBucket(mechanism: string | undefined): string {
    return mechanism === 'multi-stage' ? 'multi-step' : 'single-turn';
}

async function main(): Promise<number> {
    const argv = process.argv.slice(2);
    const args: Record<string, string | boolean> = {};
    for (let i = 0; i < argv.length; i++) {
        const t = argv[i];
        if (t === '--confirm') args.confirm = true;
        else if (t.startsWith('--')) {
            const next = argv[i + 1];
            if (next && !next.startsWith('--')) { args[t.slice(2)] = next; i++; } else args[t.slice(2)] = true;
        }
    }
    const corpusPath = (args.corpus as string) ?? '';
    const model = (args.model as string) ?? 'claude-haiku-4-5-20251001';
    if (!corpusPath) throw new Error('--corpus <file> required');
    const slots = (JSON.parse(fs.readFileSync(corpusPath, 'utf-8')) as { slots: Slot[] }).slots;

    const est = slots.reduce((p) => p + estimate_cost(model, 250, 60), 0);
    emit(`rdp-gate-classify · ${slots.length} prompts · ${model} · ~$${est.toFixed(4)}`);
    if (!args.confirm) {
        emit('DRY-RUN — no spend. Re-run with --confirm.');
        return 0;
    }
    if (!process.stdin.isTTY && process.env.RDP_EVAL_ALLOW_NONTTY !== '1') {
        throw new Error('Non-tty: set RDP_EVAL_ALLOW_NONTTY=1 only after confirming cost.');
    }
    const apiKey = load_anthropic_key();
    let correct = 0;
    const rows: Array<Record<string, unknown>> = [];
    for (const s of slots) {
        const r = await classify(apiKey, model, s.prompt);
        const exp = expectedBucket(s.mechanism);
        const got = r?.bucket ?? 'parse-error';
        const ok = got === exp;
        if (ok) correct++;
        console.error(`  ${s.n} ${s.slug}: expected ${exp} · got ${got} (${r?.confidence ?? '-'}) ${ok ? 'OK' : 'MISS'}`);
        rows.push({ slot: s.n, slug: s.slug, expected: exp, got, confidence: r?.confidence ?? null, ok });
    }
    const acc = Math.round((correct / slots.length) * 1000) / 10;
    const out = (args.results as string) ?? '/tmp/rdp-gate-classify.json';
    fs.writeFileSync(out, JSON.stringify({ model, n: slots.length, correct, accuracy_pct: acc, rows }, null, 2), 'utf-8');
    emit(`\nGATE-TIME CLASSIFICATION ACCURACY: ${correct}/${slots.length} = ${acc}%  (model ${model})`);
    emit(`Results: ${out}`);
    return 0;
}

main().then((c) => process.exit(c), (e) => { console.error(e instanceof Error ? e.message : String(e)); process.exit(1); });
