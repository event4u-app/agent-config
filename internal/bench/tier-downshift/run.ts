#!/usr/bin/env tsx
/**
 * Paired run for `road-to-a-tier-the-dispatch-carries` step 2.2.
 *
 *   gen     — write corpus.json: read-only fan-out questions over this tree, each
 *             with its answer computed here, so verification is deterministic.
 *   run     — for each slice, two print-mode child sessions on the operator's
 *             subscription login: the head dispatches `ac-researcher` once with
 *             `model: "haiku"` (lite) and once with no model argument (inherit).
 *             Each leg's usage is read from its own subagent transcript.
 *   verdict — read the results with `tierDownshiftVerdict`.
 *
 * Flags: --limit N (slices to run), --concurrency C, --results <file>.
 * A child session costs subscription quota; nothing here calls a metered API.
 */
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { tierDownshiftVerdict, type LegResult, type LegUsage, type Price } from '../../../src/scripts/_lib/tier_downshift_verdict.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = process.env['TIER_BENCH_REPO'] ?? path.resolve(HERE, '..', '..', '..');
const CORPUS = path.join(HERE, 'corpus.json');
const PRICING = path.resolve(HERE, '..', 'pricing.yaml');
const HEAD_MODEL = 'sonnet';

interface Slice {
    id: string;
    question: string;
    answer: string;
}

function listTs(dir: string): string[] {
    return fs.readdirSync(path.join(REPO, dir)).filter((f) => f.endsWith('.ts')).sort();
}

function gen(): Slice[] {
    const slices: Slice[] = [];
    const dirs = ['src/scripts/hooks', 'src/scripts/_lib', 'src/scripts/ai_council', 'src/shared', 'src/server/schemas'];
    for (const d of dirs) {
        if (!fs.existsSync(path.join(REPO, d))) continue;
        slices.push({
            id: `count-ts-${d}`,
            question: `How many files ending in .ts are directly inside ${d} (not in subdirectories)? Answer with the number only.`,
            answer: String(listTs(d).length),
        });
    }
    const lib = listTs('src/scripts/_lib');
    for (const f of lib) {
        if (slices.length >= 40) break;
        const text = fs.readFileSync(path.join(REPO, 'src/scripts/_lib', f), 'utf8');
        const m = text.match(/^export function ([A-Za-z_][A-Za-z0-9_]{5,})\(/m);
        if (!m) continue;
        const name = m[1]!;
        const owners = lib.filter((g) => new RegExp(`^export function ${name}\\(`, 'm').test(fs.readFileSync(path.join(REPO, 'src/scripts/_lib', g), 'utf8')));
        if (owners.length !== 1) continue;
        slices.push({
            id: `owner-${name}`,
            question: `Which file in src/scripts/_lib declares \`export function ${name}(\`? Answer with the file name only (for example foo.ts).`,
            answer: f,
        });
    }
    const hooks = listTs('src/scripts/hooks');
    for (const f of hooks) {
        if (slices.length >= 60) break;
        const lines = fs.readFileSync(path.join(REPO, 'src/scripts/hooks', f), 'utf8').split('\n');
        const n = lines.filter((l) => l.startsWith('import ')).length;
        if (n < 2) continue;
        slices.push({
            id: `imports-${f}`,
            question: `How many lines of src/scripts/hooks/${f} start with the word "import " at column 0? Answer with the number only.`,
            answer: String(n),
        });
    }
    return slices.slice(0, 60);
}

function normalise(s: string): string {
    return s.trim().split('\n')[0]!.replace(/[`*"'.]/g, '').trim().toLowerCase();
}

function agentsJson(): string {
    const t = fs.readFileSync(path.join(REPO, 'docs/wedge/ac-researcher/ac-researcher.md'), 'utf8');
    const body = t.split('---').slice(2).join('---').trim();
    return JSON.stringify({ 'ac-researcher': { description: 'Read-only research worker', tools: ['Read', 'Grep', 'Glob'], prompt: body, omitClaudeMd: true } });
}

function runChild(cwd: string, prompt: string): Promise<{ stdout: string; code: number }> {
    return new Promise((resolve) => {
        const p = spawn('claude', ['-p', '--setting-sources', 'project,local', '--model', HEAD_MODEL, '--output-format', 'json', '--agents', agentsJson(), '--add-dir', REPO], {
            cwd,
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        let out = '';
        p.stdout.on('data', (d) => (out += d));
        p.stdin.end(prompt);
        p.on('close', (code) => resolve({ stdout: out, code: code ?? 1 }));
    });
}

function projectDirFor(cwd: string): string {
    return path.join(os.homedir(), '.claude', 'projects', fs.realpathSync(cwd).replace(/[^A-Za-z0-9]/g, '-'));
}

function legUsage(sessionDir: string): { model: string; usage: LegUsage } | null {
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

async function runLeg(slice: Slice, arm: 'lite' | 'inherit'): Promise<LegResult | { slice_id: string; arm: string; error: string }> {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), `tier-${arm}-`));
    const modelClause = arm === 'lite' ? `, model 'haiku'` : '';
    const prompt =
        `Use the Agent tool exactly once: subagent_type 'ac-researcher'${modelClause}, prompt ` +
        `'Repository root: ${REPO}. ${slice.question}'. Do not answer it yourself and do not use any other tool. ` +
        `Then reply with the subagent's answer only.`;
    const { stdout, code } = await runChild(cwd, prompt);
    let parsed: { result?: string; session_id?: string };
    try {
        parsed = JSON.parse(stdout) as typeof parsed;
    } catch {
        return { slice_id: slice.id, arm, error: `child exit ${code}, no JSON` };
    }
    const leg = parsed.session_id ? legUsage(path.join(projectDirFor(cwd), parsed.session_id)) : null;
    if (leg === null) return { slice_id: slice.id, arm, error: 'no single subagent transcript' };
    return {
        slice_id: slice.id,
        arm,
        verified: normalise(parsed.result ?? '') === normalise(slice.answer),
        escalated: false,
        served_model: leg.model,
        usage: leg.usage,
    };
}

function readPrices(): Record<string, Price> {
    const text = fs.readFileSync(PRICING, 'utf8');
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
    if (cmd === 'gen') {
        const slices = gen();
        fs.writeFileSync(CORPUS, `${JSON.stringify(slices, null, 2)}\n`);
        console.log(`wrote ${slices.length} slices to ${path.relative(REPO, CORPUS)}`);
        return;
    }
    if (cmd === 'run') {
        const slices = (JSON.parse(fs.readFileSync(CORPUS, 'utf8')) as Slice[]).slice(0, Number(flag('limit') ?? '60'));
        const done = new Set(
            fs.existsSync(results)
                ? fs.readFileSync(results, 'utf8').split('\n').filter(Boolean).map((l) => {
                      const r = JSON.parse(l) as { slice_id: string; arm: string; error?: string };
                      return r.error ? '' : `${r.slice_id}:${r.arm}`;
                  })
                : [],
        );
        const jobs = slices.flatMap((s) => (['lite', 'inherit'] as const).map((arm) => ({ s, arm }))).filter((j) => !done.has(`${j.s.id}:${j.arm}`));
        const concurrency = Number(flag('concurrency') ?? '2');
        let next = 0;
        await Promise.all(
            Array.from({ length: concurrency }, async () => {
                while (next < jobs.length) {
                    const j = jobs[next++]!;
                    const r = await runLeg(j.s, j.arm);
                    fs.appendFileSync(results, `${JSON.stringify(r)}\n`);
                    console.log(`${j.s.id} ${j.arm} ${'error' in r ? `ERROR ${r.error}` : r.verified ? 'pass' : 'fail'}`);
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
            .map((l) => JSON.parse(l) as LegResult & { error?: string })
            .filter((r) => !r.error);
        console.log(JSON.stringify(tierDownshiftVerdict(rows, readPrices()), null, 2));
        return;
    }
    console.error('usage: run.ts gen | run [--limit N] [--concurrency C] [--results F] | verdict [--results F]');
    process.exitCode = 2;
}

void main();
