#!/usr/bin/env tsx
/**
 * Worker-resume bench (road-to-a-cold-start-paid-once 6.2 / 3.5) — a
 * MANUFACTURED window (owner decision O6): real, useful work — a citation audit
 * of four roadmaps — run in two arms so resumed and fresh runs of one
 * definition can be compared.
 *
 *   FRESH  — each session: 9 tasks, each a NEW named `ac-researcher` spawn (r1…r9).
 *   REUSE  — each session: task 1 spawns `r`; tasks 2–9 re-task `r` by SendMessage.
 *
 * Sessions run sequentially from an empty scratch project whose settings bind
 * this checkout's hook bundle, so the subagent ledger is written to the scratch
 * project. Child sessions get read-only tools only; no permission bypass.
 * A refused or rate-limited session stops the run; nothing is invented.
 *
 * Usage: npx tsx internal/bench/worker-resume/run.ts --scratch <dir> [--sessions 8] [--dry-run]
 */
import { execFileSync, spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseOrchestratorAnswers, scoreSession } from './score.js';
import { buildPool, sampleTasks, taskPrompt, type CitationTask } from './tasks.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
export const TASKS_PER_SESSION = 9;
export type Arm = 'fresh' | 'reuse';

const HOOKS: ReadonlyArray<[native: string, event: string]> = [
    ['PreToolUse', 'pre_tool_use'],
    ['PostToolUse', 'post_tool_use'],
    ['SubagentStart', 'subagent_start'],
    ['SubagentStop', 'subagent_stop'],
    ['StopFailure', 'agent_error'],
];

export function settingsFor(proj: string): object {
    const hooks: Record<string, unknown> = {};
    for (const [native, event] of HOOKS) {
        const command = `node ${path.join(REPO, 'dist', 'hooks', 'dispatch.js')} --platform claude --event ${event} --native-event ${native} --project-dir ${proj} --min-version 1`;
        hooks[native] = [{ hooks: [{ type: 'command', command }] }];
    }
    return { hooks };
}

/** The package definition, as the host's `--agents` JSON: real body and tools, model haiku. */
export function agentsFor(): object {
    const md = fs.readFileSync(path.join(REPO, 'src', 'subagents', 'ac-researcher.md'), 'utf8');
    const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(md);
    if (!m) throw new Error('ac-researcher.md has no frontmatter');
    const fm = m[1]!;
    const description = /^description:\s*(.+)$/m.exec(fm)?.[1]?.trim() ?? '';
    const tools = [...(/^tools:\n((?:\s+-\s+\S+\n?)+)/m.exec(fm)?.[1] ?? '').matchAll(/-\s+(\S+)/g)].map((x) => x[1]!);
    return { 'ac-researcher': { description, prompt: m[2]!.trim(), tools, model: 'haiku' } };
}

export function promptFor(arm: Arm, tasks: readonly CitationTask[]): string {
    const list = tasks.map((t, i) => `Task ${i + 1}: ${taskPrompt(REPO, t)}`).join('\n');
    const how =
        arm === 'fresh'
            ? `For each task i = 1…${tasks.length}, in order: spawn the 'ac-researcher' subagent with name 'r<i>' (r1, r2, …), synchronously (not in the background), with exactly the task text as its prompt, and wait for it to return before the next task. Never use SendMessage.`
            : `Task 1: spawn the 'ac-researcher' subagent with name 'r', synchronously (not in the background), with exactly the task text as its prompt, and wait for it. Tasks 2…${tasks.length}: send exactly the task text to 'r' with SendMessage (to: 'r') and wait for its reply before the next task. Never spawn a second subagent.`;
    return [
        'You orchestrate a citation audit and do no lookup yourself.',
        how,
        list,
        `Finally print one JSON line and nothing after it: {"answers":[...]} with the ${tasks.length} replies in task order, each copied verbatim from the subagent (JSON-escaped).`,
    ].join('\n\n');
}

function setupScratch(scratch: string): { proj: string; settings: string; agents: string } {
    const proj = path.join(scratch, 'proj');
    fs.mkdirSync(proj, { recursive: true });
    if (!fs.existsSync(path.join(proj, '.git'))) {
        execFileSync('git', ['-C', proj, 'init', '-q']);
        execFileSync('git', ['-C', proj, '-c', 'user.name=bench', '-c', 'user.email=bench@invalid', 'commit', '-q', '--allow-empty', '-m', 'bench']);
    }
    const settings = path.join(scratch, 'settings.json');
    const agents = path.join(scratch, 'agents.json');
    fs.writeFileSync(settings, JSON.stringify(settingsFor(proj), null, 1));
    fs.writeFileSync(agents, JSON.stringify(agentsFor()));
    return { proj, settings, agents };
}

const RATE_LIMIT = /rate.?limit|usage limit|429|overloaded/i;

export function main(argv: string[] = process.argv.slice(2)): number {
    const arg = (k: string): string | undefined => {
        const i = argv.indexOf(k);
        return i >= 0 ? argv[i + 1] : undefined;
    };
    const scratch = arg('--scratch');
    if (!scratch) {
        process.stderr.write('--scratch <dir> is required\n');
        return 2;
    }
    const sessions = Number(arg('--sessions') ?? 8);
    const dry = argv.includes('--dry-run');
    const pool = buildPool(REPO);
    fs.mkdirSync(scratch, { recursive: true });
    fs.writeFileSync(path.join(scratch, 'pool.json'), JSON.stringify(pool, null, 1));
    const { proj, settings, agents } = setupScratch(scratch);
    const results = path.join(scratch, 'results.jsonl');
    for (let k = 0; k < sessions; k++) {
        const seed = 1000 + k;
        const tasks = sampleTasks(pool.tasks, seed, TASKS_PER_SESSION);
        // Alternate which arm runs first, so warm-cache carry-over between sessions favours neither.
        const arms: Arm[] = k % 2 === 0 ? ['fresh', 'reuse'] : ['reuse', 'fresh'];
        for (const arm of arms) {
            const prompt = promptFor(arm, tasks);
            if (dry) {
                process.stdout.write(`${arm} #${k}\n${prompt}\n\n`);
                continue;
            }
            const started = new Date().toISOString();
            const r = spawnSync(
                'claude',
                ['-p', '--setting-sources', 'project,local', '--settings', settings, '--agents', fs.readFileSync(agents, 'utf8'), '--add-dir', REPO, '--model', 'sonnet', '--output-format', 'json', '--allowedTools', 'Read,Grep,Glob,Agent,SendMessage'],
                { cwd: proj, input: prompt, encoding: 'utf8', timeout: 20 * 60_000, env: { ...process.env, CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: '1' }, maxBuffer: 64 * 1024 * 1024 },
            );
            let out: Record<string, unknown> = {};
            try {
                out = JSON.parse(r.stdout) as Record<string, unknown>;
            } catch {
                out = { unparsed_stdout: r.stdout.slice(0, 2000) };
            }
            const result = typeof out['result'] === 'string' ? out['result'] : '';
            const answers = parseOrchestratorAnswers(result);
            const scores = scoreSession(tasks, answers ?? []);
            const record = {
                window: 'manufactured',
                arm,
                session_index: k,
                seed,
                started,
                finished: new Date().toISOString(),
                exit: r.status,
                signal: r.signal,
                session_id: out['session_id'] ?? null,
                is_error: out['is_error'] ?? null,
                subtype: out['subtype'] ?? null,
                api_error_status: out['api_error_status'] ?? null,
                terminal_reason: out['terminal_reason'] ?? null,
                total_cost_usd: out['total_cost_usd'] ?? null,
                subagent_stats: out['subagent_stats'] ?? null,
                answers_parsed: answers !== null,
                tasks: tasks.map((t) => t.id),
                answers,
                passes: scores.map((s) => s.pass),
                stderr_tail: r.stderr.slice(-500),
            };
            fs.appendFileSync(results, `${JSON.stringify(record)}\n`);
            process.stdout.write(`${arm} #${k} session=${String(record.session_id)} pass=${scores.filter((s) => s.pass).length}/${tasks.length} err=${String(record.is_error)}\n`);
            if (record.is_error === true || r.status !== 0 || RATE_LIMIT.test(`${String(out['api_error_status'] ?? '')} ${result.slice(0, 300)} ${r.stderr.slice(-300)}`) && answers === null) {
                process.stdout.write('stopping: the session failed or was rate-limited; counts recorded, nothing invented\n');
                return 1;
            }
        }
    }
    return 0;
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) process.exit(main());
