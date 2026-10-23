#!/usr/bin/env tsx
/**
 * Paired run for `road-to-a-tier-the-dispatch-carries` step 2.2.
 *
 *   gen      — write corpus.json: read-only fan-out questions, each answer computed
 *              from the pinned tree (`../pinned_tree.ts`), stamped with its commit.
 *   selftest — recompute the corpus from the pinned tree and check every row's
 *              commit; any disagreement fails before a verdict is read.
 *   run      — for each slice, two print-mode child sessions on the operator's
 *              subscription login: the head dispatches `ac-researcher` once with
 *              `model: "haiku"` (lite) and once with no model argument (inherit).
 *              Each leg's usage AND its verified answer are read from its own
 *              subagent transcript; every row carries the tree's commit.
 *   verdict  — self-test, then read the results with `tierDownshiftVerdict`.
 *
 * Flags: --limit N, --concurrency C, --results <file>, --pin <commit> (archive that
 * commit and measure it), --archive <dir> (an archive made earlier). Without either,
 * a dirty working tree is refused.
 * A child session costs subscription quota; nothing here calls a metered API.
 */
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parsePriceRows, type PriceRow } from '../../../src/scripts/_lib/price_freshness.js';
import { tierDownshiftVerdict, type LegResult, type LegUsage } from '../../../src/scripts/_lib/tier_downshift_verdict.js';
import { benchSelfTest, lastAssistantText, resolveBenchTree, type BenchTree } from '../pinned_tree.js';
import { CORPUS_DIRS, generateCorpus, type Slice } from './corpus.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..');
const CORPUS = path.join(HERE, 'corpus.json');
const PRICING = path.resolve(HERE, '..', 'pricing.yaml');
const HEAD_MODEL = 'sonnet';
const AGENT_DEF = 'docs/wedge/ac-researcher/ac-researcher.md';

interface Corpus {
    commit: string;
    slices: Slice[];
}

/** A leg row bound to the commit its tree held. */
type Row = LegResult & { commit: string };

function tree(): BenchTree {
    return resolveBenchTree({ repo: REPO, pin: flag('pin'), archive: flag('archive'), required: [...CORPUS_DIRS.slice(0, 2), AGENT_DEF] });
}

function normalise(s: string): string {
    return s.trim().split('\n')[0]!.replace(/[`*"'.]/g, '').trim().toLowerCase();
}

function agentsJson(root: string): string {
    const t = fs.readFileSync(path.join(root, AGENT_DEF), 'utf8');
    const body = t.split('---').slice(2).join('---').trim();
    return JSON.stringify({ 'ac-researcher': { description: 'Read-only research worker', tools: ['Read', 'Grep', 'Glob'], prompt: body, omitClaudeMd: true } });
}

function runChild(root: string, cwd: string, prompt: string): Promise<{ stdout: string; code: number }> {
    return new Promise((resolve) => {
        const p = spawn('claude', ['-p', '--setting-sources', 'project,local', '--model', HEAD_MODEL, '--output-format', 'json', '--agents', agentsJson(root), '--add-dir', root], {
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

function legUsage(sessionDir: string): { model: string; usage: LegUsage; answer: string | null } | null {
    const dir = path.join(sessionDir, 'subagents');
    if (!fs.existsSync(dir)) return null;
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl'));
    if (files.length !== 1) return null;
    const seen = new Set<string>();
    const usage: LegUsage = { input: 0, cache_read: 0, cache_write: 0, output: 0 };
    let model = '';
    const transcript = fs.readFileSync(path.join(dir, files[0]!), 'utf8');
    for (const line of transcript.split('\n')) {
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
    return { model, usage, answer: lastAssistantText(transcript) };
}

async function runLeg(t: BenchTree, slice: Slice, arm: 'lite' | 'inherit'): Promise<Row | { slice_id: string; arm: string; commit: string; error: string }> {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), `tier-${arm}-`));
    const modelClause = arm === 'lite' ? `, model 'haiku'` : '';
    const prompt =
        `Use the Agent tool exactly once: subagent_type 'ac-researcher'${modelClause}, prompt ` +
        `'Repository root: ${t.root}. ${slice.question}'. Do not answer it yourself and do not use any other tool. ` +
        `Then reply with the subagent's answer only.`;
    const { stdout, code } = await runChild(t.root, cwd, prompt);
    let parsed: { result?: string; session_id?: string };
    try {
        parsed = JSON.parse(stdout) as typeof parsed;
    } catch {
        return { slice_id: slice.id, arm, commit: t.commit, error: `child exit ${code}, no JSON` };
    }
    const leg = parsed.session_id ? legUsage(path.join(projectDirFor(cwd), parsed.session_id)) : null;
    if (leg === null) return { slice_id: slice.id, arm, commit: t.commit, error: 'no single subagent transcript' };
    // The measured leg's own final message decides, never the head's reply.
    return {
        slice_id: slice.id,
        arm,
        commit: t.commit,
        verified: leg.answer !== null && normalise(leg.answer) === normalise(slice.answer),
        escalated: false,
        served_model: leg.model,
        usage: leg.usage,
    };
}

function readPrices(): PriceRow[] {
    return parsePriceRows(fs.readFileSync(PRICING, 'utf8'));
}

function flag(name: string): string | undefined {
    const i = process.argv.indexOf(`--${name}`);
    return i > 0 ? process.argv[i + 1] : undefined;
}

function readRows(file: string): (Row & { error?: string })[] {
    return fs.existsSync(file)
        ? fs
              .readFileSync(file, 'utf8')
              .split('\n')
              .filter(Boolean)
              .map((l) => JSON.parse(l) as Row & { error?: string })
        : [];
}

/** Refuse to spend or to read a verdict unless corpus, rows and tree agree on one commit. */
function selfTest(t: BenchTree, corpus: Corpus, rows: readonly Row[]): void {
    const problems = benchSelfTest(corpus, generateCorpus(t.root), rows, t);
    if (problems.length > 0) throw new Error(`bench self-test failed:\n  ${problems.join('\n  ')}`);
}

async function main(): Promise<void> {
    const cmd = process.argv[2];
    if (cmd === 'gen') {
        const t = tree();
        const slices = generateCorpus(t.root);
        fs.writeFileSync(CORPUS, `${JSON.stringify({ commit: t.commit, slices } satisfies Corpus, null, 2)}\n`);
        console.log(`wrote ${slices.length} slices pinned at ${t.commit} to ${path.relative(REPO, CORPUS)}`);
        return;
    }
    const corpus = JSON.parse(fs.readFileSync(CORPUS, 'utf8')) as Corpus;
    // One results file per pin, so rows of another commit are never read as this run's.
    const results = flag('results') ?? path.join(HERE, `results-${corpus.commit.slice(0, 10)}.jsonl`);
    if (cmd === 'selftest') {
        const t = tree();
        selfTest(t, corpus, readRows(results).filter((r) => !r.error));
        console.log(`self-test passed: corpus, rows and tree agree on ${t.commit}`);
        return;
    }
    if (cmd === 'run') {
        const t = tree();
        selfTest(t, corpus, readRows(results));
        const slices = corpus.slices.slice(0, Number(flag('limit') ?? '60'));
        const done = new Set(readRows(results).map((r) => (r.error ? '' : `${r.slice_id}:${r.arm}`)));
        const jobs = slices.flatMap((s) => (['lite', 'inherit'] as const).map((arm) => ({ s, arm }))).filter((j) => !done.has(`${j.s.id}:${j.arm}`));
        const concurrency = Number(flag('concurrency') ?? '2');
        let next = 0;
        await Promise.all(
            Array.from({ length: concurrency }, async () => {
                while (next < jobs.length) {
                    const j = jobs[next++]!;
                    const r = await runLeg(t, j.s, j.arm);
                    fs.appendFileSync(results, `${JSON.stringify(r)}\n`);
                    console.log(`${j.s.id} ${j.arm} ${'error' in r ? `ERROR ${r.error}` : r.verified ? 'pass' : 'fail'}`);
                }
            }),
        );
        return;
    }
    if (cmd === 'verdict') {
        const t = tree();
        const rows = readRows(results).filter((r) => !r.error);
        selfTest(t, corpus, rows);
        console.log(JSON.stringify({ commit: t.commit, ...tierDownshiftVerdict(rows, readPrices(), new Date()) }, null, 2));
        return;
    }
    console.error(
        'usage: run.ts gen | selftest | run [--limit N] [--concurrency C] | verdict   [--results F] [--pin <commit> | --archive <dir>]',
    );
    process.exitCode = 2;
}

void main().catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exitCode = 1;
});
