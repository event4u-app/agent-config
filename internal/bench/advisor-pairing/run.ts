#!/usr/bin/env tsx
/**
 * Paired run for `road-to-a-tier-the-dispatch-carries` step 3.2
 * (claim `advisor-pairing-held`).
 *
 *   run     — for each bounded implementation slice, two print-mode child sessions on the
 *             operator's subscription login: the head dispatches `ac-worker` with
 *             `model: "haiku"` under `--advisor opus` (lite + high advisor), and with
 *             `model: "sonnet"` and no advisor (medium). The worker writes `solution.mjs`;
 *             this script imports it and runs the slice's cases — the model never grades.
 *   verdict — read the rows with `tierDownshiftVerdict`; the advisor arm is passed as `lite`
 *             and the medium arm as `inherit`, and the advisor's own usage is charged to the
 *             advisor arm.
 *
 * Each spec runs three times (60 slices from 20 specs); the cost per leg is read from the
 * child session's `modelUsage`, which reports the head, the worker and the advisor apart.
 */
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

import { tierDownshiftVerdict, type LegResult, type LegUsage, type Price } from '../../../src/scripts/_lib/tier_downshift_verdict.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..');
const HEAD_MODEL = 'sonnet';

interface Spec {
    id: string;
    fn: string;
    spec: string;
    cases: [unknown, unknown][];
    spread?: boolean;
}

function agentsJson(): string {
    const t = fs.readFileSync(path.join(REPO, 'docs/wedge/ac-worker/ac-worker.md'), 'utf8');
    const body = t.split('---').slice(2).join('---').trim();
    return JSON.stringify({
        'ac-worker': { description: 'Implementation worker', tools: ['Read', 'Grep', 'Glob', 'Edit', 'Write'], prompt: body, omitClaudeMd: true },
    });
}

function runChild(cwd: string, prompt: string, advisor: boolean): Promise<{ stdout: string; code: number }> {
    const args = ['-p', '--setting-sources', 'project,local', '--model', HEAD_MODEL, '--output-format', 'json', '--agents', agentsJson(), '--permission-mode', 'acceptEdits'];
    if (advisor) args.push('--advisor', 'opus');
    return new Promise((resolve) => {
        const env = advisor ? { ...process.env, CLAUDE_CODE_ENABLE_EXPERIMENTAL_ADVISOR_TOOL: '1' } : process.env;
        const p = spawn('claude', args, { cwd, env, stdio: ['pipe', 'pipe', 'pipe'] });
        let out = '';
        p.stdout.on('data', (d) => (out += d));
        p.stdin.end(prompt);
        p.on('close', (code) => resolve({ stdout: out, code: code ?? 1 }));
    });
}

async function verify(cwd: string, spec: Spec): Promise<boolean> {
    const file = path.join(cwd, 'solution.mjs');
    if (!fs.existsSync(file)) return false;
    try {
        const mod = (await import(`${pathToFileURL(file).href}?t=${Date.now()}`)) as Record<string, (...a: unknown[]) => unknown>;
        const f = mod[spec.fn];
        if (typeof f !== 'function') return false;
        return spec.cases.every(([input, expected]) => {
            const args = spec.spread ? (input as unknown[]) : [input];
            return isDeepStrictEqual(f(...structuredClone(args)), expected);
        });
    } catch {
        return false;
    }
}

function usageOf(model: Record<string, number> | undefined): LegUsage {
    return {
        input: model?.['inputTokens'] ?? 0,
        cache_read: model?.['cacheReadInputTokens'] ?? 0,
        cache_write: model?.['cacheCreationInputTokens'] ?? 0,
        output: model?.['outputTokens'] ?? 0,
    };
}

function projectDirFor(cwd: string): string {
    return path.join(os.homedir(), '.claude', 'projects', fs.realpathSync(cwd).replace(/[^A-Za-z0-9]/g, '-'));
}

/** The worker's own usage, from its subagent transcript; the head's calls are not in it. */
function workerUsageFromTranscript(sessionDir: string): { model: string; usage: LegUsage } | null {
    const dir = path.join(sessionDir, 'subagents');
    if (!fs.existsSync(dir)) return null;
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl'));
    if (files.length !== 1) return null;
    const seen = new Set<string>();
    const usage: LegUsage = { input: 0, cache_read: 0, cache_write: 0, output: 0 };
    let model = '';
    for (const line of fs.readFileSync(path.join(dir, files[0]!), 'utf8').split('\n')) {
        if (!line.includes('"assistant"')) continue;
        const rec = JSON.parse(line) as { type?: string; message?: { id?: string; model?: string; usage?: Record<string, number> } };
        if (rec.type !== 'assistant' || !rec.message?.usage) continue;
        const id = rec.message.id ?? line;
        if (seen.has(id)) continue;
        seen.add(id);
        model = rec.message.model ?? model;
        const u = rec.message.usage;
        usage.input += u['input_tokens'] ?? 0;
        usage.cache_read += u['cache_read_input_tokens'] ?? 0;
        usage.cache_write += u['cache_creation_input_tokens'] ?? 0;
        usage.output += u['output_tokens'] ?? 0;
    }
    return { model, usage };
}

type Row = LegResult;

async function runLeg(spec: Spec, rep: number, arm: 'lite' | 'inherit'): Promise<Row | { slice_id: string; arm: string; error: string }> {
    const sliceId = `${spec.id}-${rep}`;
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), `adv-${arm}-`));
    const model = arm === 'lite' ? 'haiku' : 'sonnet';
    const prompt =
        `Use the Agent tool exactly once: subagent_type 'ac-worker', model '${model}', prompt ` +
        `'In the directory ${cwd}, create solution.mjs exporting a function named ${spec.fn}. ${spec.spec} ` +
        `Use plain JavaScript with no dependencies.${arm === 'lite' ? ' Consult your advisor before you write the file.' : ''}'. ` +
        `Do not write any file yourself and do not use any other tool. Then reply DONE.`;
    const { stdout, code } = await runChild(cwd, prompt, arm === 'lite');
    let parsed: { session_id?: string; modelUsage?: Record<string, Record<string, number>> };
    try {
        parsed = JSON.parse(stdout) as typeof parsed;
    } catch {
        return { slice_id: sliceId, arm, error: `child exit ${code}, no JSON` };
    }
    const leg = parsed.session_id ? workerUsageFromTranscript(path.join(projectDirFor(cwd), parsed.session_id)) : null;
    if (leg === null) return { slice_id: sliceId, arm, error: 'no single subagent transcript' };
    const mu = parsed.modelUsage ?? {};
    // The advisor is the only opus usage in a lite session (head sonnet, worker haiku).
    const advisorKey = arm === 'lite' ? Object.keys(mu).find((k) => k.includes('opus')) : undefined;
    const advisorUsage = advisorKey ? usageOf(mu[advisorKey]) : undefined;
    return {
        slice_id: sliceId,
        arm,
        verified: await verify(cwd, spec),
        escalated: false,
        served_model: leg.model,
        usage: leg.usage,
        ...(advisorUsage ? { extra: [{ served_model: advisorKey!, usage: advisorUsage }] } : {}),
    };
}

function readPrices(): Record<string, Price> {
    const text = fs.readFileSync(path.resolve(HERE, '..', 'pricing.yaml'), 'utf8');
    const prices: Record<string, Price> = {};
    for (const block of text.split('  - tier: ').slice(1)) {
        const tier = block.split('\n')[0]!.trim();
        const num = (k: string): number => Number(block.match(new RegExp(`\\n\\s+${k}: ([0-9.]+)`))?.[1] ?? NaN);
        prices[tier] = { input: num('input'), output: num('output'), cache_write: num('cache_write'), cache_read: num('cache_read') };
    }
    return prices;
}

function flag(name: string): string | undefined {
    const i = process.argv.indexOf(`--${name}`);
    return i > 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
    const cmd = process.argv[2];
    const results = flag('results') ?? path.join(HERE, 'results.jsonl');
    const specs = (JSON.parse(fs.readFileSync(path.join(HERE, 'specs.json'), 'utf8')) as Spec[]).slice(0, Number(flag('limit') ?? '1000'));
    if (cmd === 'run') {
        const reps = Number(flag('reps') ?? '3');
        const done = new Set(
            fs.existsSync(results)
                ? fs.readFileSync(results, 'utf8').split('\n').filter(Boolean).map((l) => {
                      const r = JSON.parse(l) as { slice_id: string; arm: string; error?: string };
                      return r.error ? '' : `${r.slice_id}:${r.arm}`;
                  })
                : [],
        );
        const jobs = specs
            .flatMap((s) => Array.from({ length: reps }, (_, rep) => (['lite', 'inherit'] as const).map((arm) => ({ s, rep, arm }))).flat())
            .filter((j) => !done.has(`${j.s.id}-${j.rep}:${j.arm}`));
        const concurrency = Number(flag('concurrency') ?? '2');
        let next = 0;
        await Promise.all(
            Array.from({ length: concurrency }, async () => {
                while (next < jobs.length) {
                    const j = jobs[next++]!;
                    const r = await runLeg(j.s, j.rep, j.arm);
                    fs.appendFileSync(results, `${JSON.stringify(r)}\n`);
                    console.log(`${j.s.id}-${j.rep} ${j.arm} ${'error' in r ? `ERROR ${r.error}` : r.verified ? 'pass' : 'fail'}`);
                }
            }),
        );
        return;
    }
    if (cmd === 'verdict') {
        const rows = fs
            .readFileSync(results, 'utf8')
            .split('\n')
            .filter(Boolean)
            .map((l) => JSON.parse(l) as Row & { error?: string })
            .filter((r) => !r.error);
        console.log(JSON.stringify(tierDownshiftVerdict(rows, readPrices()), null, 2));
        return;
    }
    console.error('usage: run.ts run [--reps N] [--concurrency C] [--results F] | verdict [--results F]');
    process.exitCode = 2;
}

void main();
