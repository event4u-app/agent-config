#!/usr/bin/env tsx
/**
 * Slim vs full end-reviewer verdict comparison.
 *
 * Two arms of `production-validator`, same model, same user prompt per fixture:
 *   full — the agent body, with the instruction hierarchy the host loads by default.
 *   slim — the agent body + a review digest, with `omitClaudeMd: true` on the
 *          agent definition (the native field `omit_project_instructions` maps to).
 * The digest is the generated subagent floor, two review contexts, and the review
 * sections of the R2 reviewer packet. The acceptance block of a real R2 packet is
 * the roadmap's extracted criteria; a fixture has no roadmap, so its requirement
 * travels in the user prompt, identical for both arms.
 *
 * Fixtures: the `wedge-hollow-detection` pair (pv-01, pv-02), the 12-fixture
 * defect corpus, and the three correct-but-contested controls of the
 * adversarial-council corpus. Each runs in a throwaway directory.
 *
 * Modes:
 *   --dry-run (default)  render prompts + digest into --out, zero calls.
 *   --probe              one call per arm on a trivial prompt: context size, cost.
 *   --run                the paid comparison.
 * Spend: every paid call appends to <out>/ledger.jsonl. Before a call the runner
 * refuses if ledger total + --per-call-usd would exceed --cap-usd; the CLI gets
 * --max-budget-usd = --per-call-usd. --cap-usd is clamped to 20.
 *
 * Exit 0 ok · 1 cap reached / call error · 2 usage.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { load as yamlLoad } from 'js-yaml';

import { cost_usd } from './_lib/bench_ab_activation.js';
import { load_pricing } from './_lib/bench_cost.js';
import {
    evaluateBar,
    scoreFixture,
    summarize,
    type ScoredFixture,
    type SlimFixtureMeta,
} from './_lib/slim_reviewer_score.js';
import { claude_executable } from './bench_ab_task_runner.js';
import { reviewerPrompt } from './dispatch_r2_reviewer.js';
import { render_floor } from './generate_subagent_floor.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const HARD_CAP_USD = 20;
const AGREEMENT_BAR = 0.9;
const AGENT_NAME = 'production-validator';
// Under the home directory, outside any repository: the host loads the user-level
// instruction hierarchy (ancestor `.claude/rules`) as it would for a real review,
// and no ground-truth file is reachable from the fixture's parent directories.
const RUN_BASE = path.join(os.homedir(), '.cache', 'slim-reviewer-runs');

export type ArmId = 'slim' | 'full';

export interface FixtureFile {
    path: string;
    content: string;
}

export interface SlimFixture extends SlimFixtureMeta {
    source: 'wedge' | 'defect-finding' | 'adversarial-council';
    files: FixtureFile[];
    scope: string[];
    diff: string | null;
    requirement: string;
}

const GENERIC_REQUIREMENT = 'the code under review behaves correctly for every input its signature admits.';

function readTree(dir: string, base = dir): FixtureFile[] {
    const out: FixtureFile[] = [];
    for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) out.push(...readTree(p, base));
        else out.push({ path: path.relative(base, p), content: fs.readFileSync(p, 'utf8') });
    }
    return out;
}

export function loadFixtures(root = ROOT): SlimFixture[] {
    const out: SlimFixture[] = [];
    const pvFiles = readTree(path.join(root, 'internal/bench/orchestration/fixtures/pv-hollow'));
    out.push({
        id: 'pv-01-hollow',
        source: 'wedge',
        kind: 'planted',
        contested: false,
        planted_file: 'src/charge.ts',
        files: pvFiles,
        scope: ['src/charge.ts', 'tests/charge.test.ts'],
        diff: null,
        requirement: 'the `charge` feature in src/charge.ts is implemented and its test suite is green.',
    });
    out.push({
        id: 'pv-02-control',
        source: 'wedge',
        kind: 'control',
        contested: false,
        planted_file: null,
        files: pvFiles,
        scope: ['src/slugify.ts'],
        diff: null,
        requirement: 'the `slugify` function in src/slugify.ts is implemented.',
    });

    const df = yamlLoad(fs.readFileSync(path.join(root, 'internal/bench/corpora/defect-finding.yaml'), 'utf8')) as {
        fixtures: { id: string; prompt: string; ground_truth: string; negative_control?: boolean }[];
    };
    for (const fx of df.fixtures) {
        const diffMatch = /```diff\n([\s\S]*?)```/.exec(fx.prompt);
        const diff = diffMatch ? (diffMatch[1] as string) : fx.prompt;
        const fileMatch = /^\+\+\+ b\/(\S+)/m.exec(diff);
        const file = fileMatch ? (fileMatch[1] as string) : 'unknown';
        const control = fx.negative_control === true || /^\s*NONE\b/i.test(fx.ground_truth);
        out.push({
            id: fx.id,
            source: 'defect-finding',
            kind: control ? 'control' : 'planted',
            contested: false,
            planted_file: control ? null : file,
            files: [{ path: 'change.diff', content: diff }],
            scope: [file],
            diff,
            requirement: GENERIC_REQUIREMENT,
        });
    }

    const council = JSON.parse(fs.readFileSync(path.join(root, 'internal/bench/adversarial-council/corpus.json'), 'utf8')) as {
        items: { id: string; is_clean: boolean; files: FixtureFile[] }[];
    };
    for (const item of council.items.filter((i) => i.is_clean)) {
        out.push({
            id: `ac-${item.id}`,
            source: 'adversarial-council',
            kind: 'control',
            contested: true,
            planted_file: null,
            files: item.files,
            scope: item.files.map((f) => f.path),
            diff: null,
            requirement: GENERIC_REQUIREMENT,
        });
    }
    return out;
}

/** The user prompt — identical text for both arms; states scope, change, requirement, question. */
export function userPrompt(fx: SlimFixture): string {
    const change =
        fx.diff !== null
            ? ['Change (also in `change.diff` in the working directory):', '```diff', fx.diff.trimEnd(), '```']
            : ['Change: the files in scope, as they stand in the working directory.'];
    return [
        `Scope: ${fx.scope.join(', ')}`,
        ...change,
        `Requirement: ${fx.requirement}`,
        'Question: is this change ready to ship?',
        '',
        'Answer in exactly this format, with nothing after it:',
        'FINDING: <file>:<line> — <severity> — <one-line reason>   (one line per finding; no line if there are none)',
        'VERDICT: READY | NOT READY',
    ].join('\n');
}

function stripFrontmatter(text: string): string {
    return text.replace(/^---\n[\s\S]*?\n---\n/, '').trim();
}

function agentBody(root = ROOT): string {
    return stripFrontmatter(fs.readFileSync(path.join(root, 'src/subagents/production-validator.md'), 'utf8'));
}

function packetSections(packet: string, wanted: readonly string[]): string {
    const parts = packet.split(/^(?=## )/m);
    return parts
        .filter((p) => wanted.some((w) => p.startsWith(`## ${w}\n`)))
        .join('')
        .trim();
}

/** The review digest the slim arm carries in place of the instruction hierarchy. */
export function reviewDigest(root = ROOT): string {
    const packet = reviewerPrompt({
        slug: 'fixture',
        headSha: 'n/a',
        scopeHash: 'n/a',
        roadmapGiven: false,
        acGiven: false,
        changedFiles: [],
    });
    const ctx = (rel: string): string => stripFrontmatter(fs.readFileSync(path.join(root, rel), 'utf8'));
    return [
        '# Review digest',
        '',
        render_floor(),
        '',
        '## Review context — verification mechanics',
        '',
        ctx('src/agent-src/contexts/execution/verification-mechanics.md'),
        '',
        '## Review context — evaluator independence',
        '',
        ctx('src/rules/evaluator-independence.md'),
        '',
        '## Review packet (dispatch_r2_reviewer)',
        '',
        packetSections(packet, ['Review mode', 'Severity', 'Rules']),
        '',
        '## Acceptance block',
        '',
        'The requirement stated in the task prompt is the acceptance criterion for this review.',
    ].join('\n');
}

export function agentPrompt(arm: ArmId, root = ROOT): string {
    return arm === 'slim' ? `${agentBody(root)}\n\n${reviewDigest(root)}` : agentBody(root);
}

export function agentsJson(arm: ArmId, model: string, root = ROOT): string {
    const def: Record<string, unknown> = {
        description: 'Audits that the shipped path is real and the change is ready.',
        prompt: agentPrompt(arm, root),
        tools: ['Read', 'Grep', 'Glob', 'Bash'],
        model,
    };
    if (arm === 'slim') def['omitClaudeMd'] = true;
    return JSON.stringify({ [AGENT_NAME]: def });
}

/** The parent session's only job: dispatch the reviewer once, verbatim, and add nothing. */
export function parentPrompt(reviewPrompt: string): string {
    return [
        `Dispatch the \`${AGENT_NAME}\` subagent exactly once with the text between the markers as its prompt, verbatim.`,
        'Do not read, review or judge anything yourself. When it returns, reply with only the word DONE.',
        '<<<PROMPT',
        reviewPrompt,
        'PROMPT>>>',
    ].join('\n');
}

export function cliArgs(prompt: string, agentsFile: string, model: string, perCallUsd: number): string[] {
    return [
        '--print',
        '--output-format',
        'stream-json',
        '--verbose',
        '--model',
        model,
        '--max-budget-usd',
        String(perCallUsd),
        '--permission-mode',
        'bypassPermissions',
        '--no-session-persistence',
        '--agents',
        agentsFile,
        '--',
        parentPrompt(prompt),
    ];
}

interface Tokens {
    input: number;
    output: number;
    cache_write: number;
    cache_read: number;
}

export interface CallResult {
    /** The subagent's final message — what is scored. */
    text: string;
    errored: boolean;
    reason: string;
    dispatched: boolean;
    usd_envelope: number;
    usd_priced: number;
    /** Whole call: parent + subagent. */
    tokens: Tokens;
    /** Billed input of the subagent's first request: its loaded context. */
    subagent_first_input: number;
    subagent_requests: number;
    /** The host's own `<usage>subagent_tokens` footer on the hand-back: the subagent's whole token use. */
    subagent_tokens: number;
    models: string[];
    num_turns: number;
    wall_s: number;
}

function num(v: unknown): number {
    return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

function obj(v: unknown): Record<string, unknown> {
    return v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function parts(e: Record<string, unknown>): Record<string, unknown>[] {
    const c = obj(e['message'])['content'];
    return Array.isArray(c) ? c.map(obj) : [];
}

function contentText(c: unknown): string {
    if (typeof c === 'string') return c;
    if (Array.isArray(c)) return c.map((p) => (typeof obj(p)['text'] === 'string' ? (obj(p)['text'] as string) : '')).join('\n');
    return '';
}

export function parseStream(stdout: string, rates: Parameters<typeof cost_usd>[1]): Omit<CallResult, 'wall_s'> {
    const events: Record<string, unknown>[] = [];
    for (const line of stdout.split('\n')) {
        if (!line.trim().startsWith('{')) continue;
        try {
            events.push(obj(JSON.parse(line)));
        } catch {
            continue;
        }
    }
    let dispatchId: string | null = null;
    for (const e of events) {
        if (e['type'] !== 'assistant' || e['parent_tool_use_id'] || dispatchId !== null) continue;
        const call = parts(e).find((p) => p['type'] === 'tool_use' && obj(p['input'])['subagent_type'] === AGENT_NAME);
        if (call) dispatchId = String(call['id']);
    }
    let text = '';
    let firstInput = 0;
    let requests = 0;
    for (const e of events) {
        if (dispatchId === null) break;
        if (e['type'] === 'user') {
            const res = parts(e).find((p) => p['type'] === 'tool_result' && p['tool_use_id'] === dispatchId);
            if (res) text = contentText(res['content']);
        }
        if (e['type'] === 'assistant' && e['parent_tool_use_id'] === dispatchId) {
            const u = obj(obj(e['message'])['usage']);
            if (requests === 0) {
                firstInput = num(u['input_tokens']) + num(u['cache_creation_input_tokens']) + num(u['cache_read_input_tokens']);
            }
            requests++;
        }
    }
    const result = events.filter((e) => e['type'] === 'result').pop() ?? {};
    const mu = obj(result['modelUsage']);
    const tokens: Tokens = { input: 0, output: 0, cache_write: 0, cache_read: 0 };
    let usdPriced = 0;
    for (const sRaw of Object.values(mu)) {
        const s = obj(sRaw);
        const b = {
            input_tokens: num(s['inputTokens']),
            output_tokens: num(s['outputTokens']),
            cache_creation_input_tokens: num(s['cacheCreationInputTokens']),
            cache_read_input_tokens: num(s['cacheReadInputTokens']),
        };
        tokens.input += b.input_tokens;
        tokens.output += b.output_tokens;
        tokens.cache_write += b.cache_creation_input_tokens;
        tokens.cache_read += b.cache_read_input_tokens;
        usdPriced += cost_usd(b, rates);
    }
    const noEvents = events.length === 0;
    const isError = noEvents || Boolean(result['is_error']);
    const reason = noEvents ? 'no events' : isError ? String(result['subtype'] ?? 'error') : dispatchId === null ? 'no dispatch' : 'ok';
    return {
        text,
        errored: isError || dispatchId === null,
        reason,
        dispatched: dispatchId !== null,
        usd_envelope: num(result['total_cost_usd']),
        usd_priced: usdPriced,
        tokens,
        subagent_first_input: firstInput,
        subagent_tokens: Number(/subagent_tokens:\s*(\d+)/.exec(text)?.[1] ?? 0),
        subagent_requests: requests,
        models: Object.keys(mu),
        num_turns: num(result['num_turns']),
    };
}

interface LedgerEntry {
    at: string;
    kind: 'probe' | 'run';
    fixture: string;
    arm: ArmId;
    seed: number;
    usd: number;
}

function ledgerTotal(file: string): number {
    if (!fs.existsSync(file)) return 0;
    return fs
        .readFileSync(file, 'utf8')
        .split('\n')
        .filter(Boolean)
        .reduce((a, l) => a + num((JSON.parse(l) as LedgerEntry).usd), 0);
}

interface Opts {
    mode: 'dry-run' | 'probe' | 'run';
    model: string;
    capUsd: number;
    perCallUsd: number;
    seeds: number;
    out: string;
    only: string[] | null;
}

function parseArgs(argv: readonly string[]): Opts | string {
    const o: Opts = {
        mode: 'dry-run',
        model: 'claude-sonnet-4-6',
        capUsd: HARD_CAP_USD,
        perCallUsd: 2,
        seeds: 1,
        out: path.join(ROOT, 'agents/evidence/analysis/slim-reviewer-2026-11-06'),
        only: null,
    };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        const next = (): string => {
            const v = argv[++i];
            if (v === undefined) throw new Error(`${a} needs a value`);
            return v;
        };
        if (a === '--dry-run') o.mode = 'dry-run';
        else if (a === '--probe') o.mode = 'probe';
        else if (a === '--run') o.mode = 'run';
        else if (a === '--model') o.model = next();
        else if (a === '--cap-usd') o.capUsd = Math.min(Number(next()), HARD_CAP_USD);
        else if (a === '--per-call-usd') o.perCallUsd = Number(next());
        else if (a === '--seeds') o.seeds = Number(next());
        else if (a === '--out') o.out = path.resolve(next());
        else if (a === '--only') o.only = next().split(',');
        else return `unknown argument: ${a}`;
    }
    if (!(o.perCallUsd > 0) || !(o.capUsd > 0) || !(o.seeds >= 1)) return 'cap, per-call and seeds must be positive';
    return o;
}

function materialize(fx: SlimFixture): string {
    fs.mkdirSync(RUN_BASE, { recursive: true });
    const dir = fs.mkdtempSync(path.join(RUN_BASE, `${fx.id}-`));
    for (const f of fx.files) {
        const p = path.join(dir, f.path);
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, f.content);
    }
    return dir;
}

function callArm(arm: ArmId, prompt: string, cwd: string, o: Opts, rates: Parameters<typeof cost_usd>[1]): CallResult {
    const bin = claude_executable();
    if (bin === null) throw new Error('claude CLI not found');
    const agentsFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'slim-rev-agents-')), `${arm}.json`);
    fs.writeFileSync(agentsFile, agentsJson(arm, o.model));
    const t0 = Date.now();
    const r = spawnSync(bin, cliArgs(prompt, agentsFile, o.model, o.perCallUsd), {
        cwd,
        encoding: 'utf8',
        timeout: 600_000,
        maxBuffer: 64 * 1024 * 1024,
    });
    fs.rmSync(path.dirname(agentsFile), { recursive: true, force: true });
    const env = parseStream(r.stdout ?? '', rates);
    if (r.status !== 0 && !env.errored) {
        env.errored = true;
        env.reason = `exit ${r.status}: ${(r.stderr ?? '').slice(0, 200)}`;
    }
    return { ...env, wall_s: (Date.now() - t0) / 1000 };
}

function writeFile(p: string, text: string): void {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, text);
}

function renderArtefacts(o: Opts, fixtures: readonly SlimFixture[]): void {
    writeFile(path.join(o.out, 'prompts', 'agent-full.md'), agentPrompt('full'));
    writeFile(path.join(o.out, 'prompts', 'agent-slim.md'), agentPrompt('slim'));
    for (const fx of fixtures) writeFile(path.join(o.out, 'prompts', `${fx.id}.md`), userPrompt(fx) + '\n');
}

export function main(argv: readonly string[]): number {
    const parsed = parseArgs(argv);
    if (typeof parsed === 'string') {
        process.stderr.write(`${parsed}\nusage: bench_slim_reviewer [--dry-run|--probe|--run] [--model id] [--cap-usd n<=20] [--per-call-usd n] [--seeds n] [--out dir] [--only id,id]\n`);
        return 2;
    }
    const o = parsed;
    let fixtures = loadFixtures();
    if (o.only) fixtures = fixtures.filter((f) => o.only?.includes(f.id));
    renderArtefacts(o, fixtures);
    const [pricing] = load_pricing(path.join(ROOT, 'internal/bench/pricing.yaml'));
    const rates = pricing[o.model];
    if (!rates) {
        process.stderr.write(`no pricing row for ${o.model} in internal/bench/pricing.yaml\n`);
        return 2;
    }
    const ledger = path.join(o.out, 'ledger.jsonl');

    if (o.mode === 'dry-run') {
        const calls = fixtures.length * 2 * o.seeds;
        process.stdout.write(
            [
                `fixtures: ${fixtures.length} (${fixtures.filter((f) => f.kind === 'planted').length} planted, ${fixtures.filter((f) => f.kind === 'control').length} controls, ${fixtures.filter((f) => f.contested).length} contested)`,
                `calls: ${calls} · seeds ${o.seeds} · per-call cap $${o.perCallUsd} · total cap $${o.capUsd} · ledger so far $${ledgerTotal(ledger).toFixed(4)}`,
                `agent prompt chars: full ${agentPrompt('full').length}, slim ${agentPrompt('slim').length}`,
                `prompts written to ${path.relative(ROOT, path.join(o.out, 'prompts'))}/ — zero calls made`,
            ].join('\n') + '\n',
        );
        return 0;
    }

    const record = (e: Omit<LedgerEntry, 'at'>): void => {
        fs.appendFileSync(ledger, JSON.stringify({ at: new Date().toISOString(), ...e }) + '\n');
    };
    const guard = (): boolean => {
        const spent = ledgerTotal(ledger);
        if (spent + o.perCallUsd > o.capUsd) {
            process.stderr.write(`STOP: ledger $${spent.toFixed(4)} + per-call $${o.perCallUsd} would exceed cap $${o.capUsd}\n`);
            return false;
        }
        return true;
    };

    if (o.mode === 'probe') {
        fs.mkdirSync(RUN_BASE, { recursive: true });
        const dir = fs.mkdtempSync(path.join(RUN_BASE, 'probe-'));
        const probe =
            'Reply with two lines and nothing else. Line 1: OK. Line 2: YES if any instruction text in your context ' +
            "contains the phrase 'Rust Token Killer', otherwise NO.";
        for (const arm of ['full', 'slim'] as const) {
            if (!guard()) return 1;
            const r = callArm(arm, probe, dir, o, rates);
            const usd = Math.max(r.usd_envelope, r.usd_priced);
            record({ kind: 'probe', fixture: 'probe', arm, seed: 0, usd });
            writeFile(path.join(o.out, 'raw', `probe-v3.${arm}.json`), JSON.stringify(r, null, 2) + '\n');
            process.stdout.write(
                `${arm}: ${r.reason} · dispatched ${r.dispatched} · subagent_tokens ${r.subagent_tokens} · models ${r.models.join(',')} · in ${r.tokens.input} cw ${r.tokens.cache_write} cr ${r.tokens.cache_read} out ${r.tokens.output} · $${usd.toFixed(4)} · ${JSON.stringify(r.text.trim())}\n`,
            );
        }
        return 0;
    }

    const rows: ScoredFixture[] = [];
    let stopped = false;
    for (let seed = 1; seed <= o.seeds && !stopped; seed++) {
        for (const fx of fixtures) {
            const dir = materialize(fx);
            const res: Partial<Record<ArmId, CallResult>> = {};
            // Alternate arm order per fixture so a warm cache never favours one arm systematically.
            const order: ArmId[] = rows.length % 2 === 0 ? ['full', 'slim'] : ['slim', 'full'];
            for (const arm of order) {
                if (!guard()) {
                    stopped = true;
                    break;
                }
                const r = callArm(arm, userPrompt(fx), dir, o, rates);
                const usd = Math.max(r.usd_envelope, r.usd_priced);
                record({ kind: 'run', fixture: fx.id, arm, seed, usd });
                writeFile(path.join(o.out, 'raw', `${fx.id}.${arm}.s${seed}.json`), JSON.stringify(r, null, 2) + '\n');
                res[arm] = r;
                process.stderr.write(`  ${fx.id} s${seed} ${arm}: ${r.reason} $${usd.toFixed(4)} turns ${r.num_turns}\n`);
            }
            fs.rmSync(dir, { recursive: true, force: true });
            if (stopped || !res.slim || !res.full) break;
            const toOutcome = (r: CallResult) => ({ text: r.text, usd: Math.max(r.usd_envelope, r.usd_priced), errored: r.errored });
            const row: ScoredFixture = {
                meta: { id: seed > 1 ? `${fx.id}#s${seed}` : fx.id, kind: fx.kind, contested: fx.contested, planted_file: fx.planted_file },
                slim: scoreFixture(fx, toOutcome(res.slim)),
                full: scoreFixture(fx, toOutcome(res.full)),
            };
            rows.push(row);
        }
    }
    const summary = summarize(rows);
    const bar = evaluateBar(summary, AGREEMENT_BAR);
    const report = {
        model: o.model,
        seeds: o.seeds,
        complete: !stopped && rows.length === fixtures.length * o.seeds,
        ledger_total_usd: ledgerTotal(ledger),
        summary,
        bar,
        rows,
    };
    writeFile(path.join(o.out, 'results.json'), JSON.stringify(report, null, 2) + '\n');
    process.stdout.write(JSON.stringify({ summary, bar, complete: report.complete, ledger_total_usd: report.ledger_total_usd }, null, 2) + '\n');
    return stopped ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
    process.exit(main(process.argv.slice(2)));
}
