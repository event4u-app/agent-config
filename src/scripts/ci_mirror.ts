#!/usr/bin/env tsx
/**
 * ci_mirror — replay the CI gate jobs locally, every step, and report every
 * failure at once.
 *
 * Why this exists. The pre-push hook used to run three hand-kept subsets of CI
 * (`task consistency`, the 22-gate `task preflight`, a changed-files
 * typecheck) while the PR workflows ran ~380 gates. A green push therefore
 * predicted nothing, and because each CI job stopped at its first red step,
 * every fix-push revealed the next red one. PR #2949 needed four pushes for
 * four failures that were all decidable on the pushing machine.
 *
 * What it does. It reads the jobs named in `src/config/ci-mirror.json` FROM
 * THE WORKFLOW FILES — there is no second gate list to drift — and runs each
 * job's `run:` steps in a throwaway worktree of HEAD, with the expressions and
 * `if:` conditions those steps carry evaluated the way Actions evaluates them
 * (`_lib/gha_expr.ts`). Jobs run in parallel; inside a job, steps run in order
 * and keep running after a failure exactly when the workflow says they do.
 *
 * What it does not do. `uses:` steps (checkout, setup-node, artifact uploads)
 * and pure `npm ci` steps are the runner's setup; the mirror replaces them with
 * the worktree plus a copy-on-write clone of the caller's `node_modules`. Steps
 * that cannot run on this machine are listed in the config with a reason and
 * reported as CI-only, never skipped silently.
 *
 * Verdict classes, and which of them block:
 *   failed            — blocks (exit 1)
 *   owner-decision    — a configured step refused with its owner marker: the
 *                       merge is the owner's; reported, does not block a push
 *   not-reproducible  — an expression outside the supported subset, or exit
 *                       127 (a tool this machine lacks): reported, not blocking,
 *                       because it is a fact about the machine, not the change
 *   passed · skipped (condition false) · ci-only · setup
 *
 * The working tree is never touched: the worktrees are created from HEAD in
 * the system temp directory and removed afterwards; logs stay there.
 *
 * Usage:
 *   ./scripts-run src/scripts/ci_mirror               # run all mirrored jobs
 *   ./scripts-run src/scripts/ci_mirror --list        # print the plan only
 *   ./scripts-run src/scripts/ci_mirror --job rule-backstops.yml:rule-backstops
 *   ./scripts-run src/scripts/ci_mirror --json report.json --keep
 *
 * Exit: 0 no blocking failure · 1 blocking failure · 2 usage or setup error.
 */
import { execFileSync, spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import {
    type ExprContext,
    type ExprValue,
    UnsupportedExpression,
    evaluateCondition,
    interpolate,
} from './_lib/gha_expr.js';

const _HERE = fileURLToPath(import.meta.url);

export interface MirrorConfig {
    jobs: Array<{ workflow: string; job: string }>;
    ci_only_steps: Array<{ workflow: string; job: string; step: string; reason: string }>;
    owner_decision_steps: Array<{ workflow: string; job: string; step: string; marker: string; meaning: string }>;
    local_only_steps?: Array<{ name: string; run: string; reason: string }>;
}

export interface StepPlan {
    index: number;
    name: string;
    id?: string | undefined;
    kind: 'setup' | 'run' | 'ci-only';
    run?: string | undefined;
    if?: string | boolean | undefined;
    env: Record<string, string>;
    workingDirectory?: string | undefined;
    continueOnError: boolean;
    ciOnlyReason?: string | undefined;
    ownerMarker?: RegExp | undefined;
}

export interface JobPlan {
    workflow: string;
    job: string;
    displayName: string;
    env: Record<string, string>;
    timeoutMinutes: number;
    steps: StepPlan[];
    /** Runs in the caller's checkout, not a worktree: gates whose question is about this machine. */
    inCaller?: boolean;
}

export const LOCAL_JOB_ID = '(local):local-only';

export type StepVerdict = 'passed' | 'failed' | 'owner-decision' | 'not-reproducible' | 'skipped' | 'ci-only' | 'setup';

export interface StepResult {
    index: number;
    name: string;
    verdict: StepVerdict;
    exitCode?: number | undefined;
    detail?: string | undefined;
    logFile?: string | undefined;
    seconds?: number | undefined;
}

export interface JobResult {
    workflow: string;
    job: string;
    displayName: string;
    seconds: number;
    steps: StepResult[];
}

const CONFIG_PATH = 'src/config/ci-mirror.json';

export function loadConfig(root: string): MirrorConfig {
    return JSON.parse(fs.readFileSync(path.join(root, CONFIG_PATH), 'utf8')) as MirrorConfig;
}

function stringMap(v: unknown): Record<string, string> {
    const out: Record<string, string> = {};
    if (v && typeof v === 'object') {
        for (const [k, val] of Object.entries(v as Record<string, unknown>)) out[k] = String(val);
    }
    return out;
}

/** Name a step the way the Actions UI does, so a report line can be found there. */
export function stepDisplayName(s: Record<string, unknown>): string {
    if (typeof s.name === 'string') return s.name;
    if (typeof s.uses === 'string') return `uses ${s.uses.split('@')[0]}`;
    if (typeof s.run === 'string') return `run ${(s.run.split('\n')[0] ?? '').slice(0, 60)}`;
    return '(unnamed step)';
}

/**
 * A step whose every command is `npm ci` / `npm install` is the runner's
 * dependency setup. The mirror supplies dependencies itself (a copy-on-write
 * clone per worktree), so replaying the install would only spend a network
 * round per job.
 */
export function isInstallStep(run: string | undefined): boolean {
    if (!run) return false;
    const commands = run.split('\n').map((l) => l.trim()).filter((l) => l !== '' && !l.startsWith('#'));
    return commands.length > 0 && commands.every((l) => /^npm (ci|install)\b/.test(l));
}

type RawStep = Record<string, unknown>;
interface RawWorkflow {
    env?: unknown;
    jobs?: Record<string, { name?: unknown; env?: unknown; steps?: RawStep[]; 'timeout-minutes'?: unknown }>;
}

export function planJobs(root: string, config: MirrorConfig, only?: string[]): JobPlan[] {
    const plans: JobPlan[] = [];
    for (const { workflow, job } of config.jobs) {
        if (only && only.length > 0 && !only.includes(`${workflow}:${job}`)) continue;
        const doc = parseYaml(fs.readFileSync(path.join(root, '.github/workflows', workflow), 'utf8')) as RawWorkflow;
        const def = doc.jobs?.[job];
        if (!def) throw new Error(`${workflow} has no job "${job}" (named in ${CONFIG_PATH})`);
        const steps: StepPlan[] = (def.steps ?? []).map((s, index) => {
            const run = typeof s.run === 'string' ? s.run : undefined;
            const name = stepDisplayName(s);
            const ciOnly = config.ci_only_steps.find((c) => c.workflow === workflow && c.job === job && c.step === name);
            const owner = config.owner_decision_steps.find((c) => c.workflow === workflow && c.job === job && c.step === name);
            const base: StepPlan = {
                index,
                name,
                id: typeof s.id === 'string' ? s.id : undefined,
                kind: s.uses || isInstallStep(run) ? 'setup' : ciOnly ? 'ci-only' : 'run',
                run,
                if: typeof s.if === 'string' || typeof s.if === 'boolean' ? s.if : undefined,
                env: stringMap(s.env),
                workingDirectory: typeof s['working-directory'] === 'string' ? s['working-directory'] : undefined,
                continueOnError: s['continue-on-error'] === true,
                ciOnlyReason: ciOnly?.reason,
                ownerMarker: owner ? new RegExp(owner.marker, 'm') : undefined,
            };
            return base;
        });
        plans.push({
            workflow,
            job,
            displayName: typeof def.name === 'string' ? def.name : job,
            env: { ...stringMap(doc.env), ...stringMap(def.env) },
            timeoutMinutes: typeof def['timeout-minutes'] === 'number' ? def['timeout-minutes'] : 30,
            steps,
        });
    }
    const local = config.local_only_steps ?? [];
    if (local.length > 0 && (!only || only.length === 0 || only.includes(LOCAL_JOB_ID))) {
        plans.push({
            workflow: '(local)',
            job: 'local-only',
            displayName: 'Local-only gates (no CI counterpart)',
            env: {},
            timeoutMinutes: 10,
            inCaller: true,
            steps: local.map((l, index) => ({
                index, name: l.name, kind: 'run', run: l.run, if: '${{ !cancelled() }}', env: {}, continueOnError: false,
            })),
        });
    }
    return plans;
}

export interface RunFacts {
    baseRef: string;
    baseSha: string;
    headSha: string;
    headRef: string;
    prNumber: string;
    runnerTemp: string;
    workspace: string;
}

export function makeContext(
    facts: RunFacts,
    env: Record<string, string>,
    steps: ExprContext['steps'],
    jobSucceeded: boolean,
): ExprContext {
    const table: Record<string, ExprValue> = {
        'github.event_name': 'pull_request',
        'github.base_ref': facts.baseRef,
        'github.head_ref': facts.headRef,
        'github.ref': `refs/pull/${facts.prNumber}/merge`,
        'github.sha': facts.headSha,
        'github.repository': 'event4u-app/agent-config',
        'github.workspace': facts.workspace,
        'github.run_attempt': '1',
        'github.run_id': '0',
        'github.event.pull_request.base.sha': facts.baseSha,
        'github.event.pull_request.base.ref': facts.baseRef,
        'github.event.pull_request.head.sha': facts.headSha,
        'github.event.pull_request.head.ref': facts.headRef,
        'github.event.pull_request.number': facts.prNumber,
        'github.event.merge_group.base_sha': '',
        'runner.os': process.platform === 'darwin' ? 'macOS' : process.platform === 'win32' ? 'Windows' : 'Linux',
        'runner.temp': facts.runnerTemp,
    };
    return {
        lookup(p: string) {
            if (p in table) return table[p];
            if (p.startsWith('env.')) return env[p.slice(4)] ?? '';
            if (p.startsWith('secrets.')) return '';
            return undefined;
        },
        steps,
        jobSucceeded,
    };
}

/** Every expression a step would evaluate, rendered once against neutral facts: what cannot be rendered cannot be mirrored. */
export function unreproducibleSteps(plan: JobPlan): Array<{ step: string; reason: string }> {
    const facts: RunFacts = {
        baseRef: 'main', baseSha: '0'.repeat(40), headSha: '1'.repeat(40), headRef: 'topic',
        prNumber: '1', runnerTemp: os.tmpdir(), workspace: '.',
    };
    const out: Array<{ step: string; reason: string }> = [];
    for (const s of plan.steps) {
        if (s.kind !== 'run') continue;
        const ctx = makeContext(facts, plan.env, {}, true);
        try {
            evaluateCondition(s.if, ctx);
            interpolate(s.run ?? '', ctx);
            for (const v of Object.values(s.env)) interpolate(v, ctx);
            for (const v of Object.values(plan.env)) interpolate(v, ctx);
        } catch (e) {
            if (e instanceof UnsupportedExpression) out.push({ step: s.name, reason: e.message });
            else throw e;
        }
    }
    return out;
}

function parseKeyFile(file: string): Record<string, string> {
    if (!fs.existsSync(file)) return {};
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    const out: Record<string, string> = {};
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? '';
        const heredoc = /^([^=<]+)<<(.+)$/.exec(line);
        if (heredoc) {
            const key = heredoc[1] ?? '';
            const delim = heredoc[2] ?? '';
            const body: string[] = [];
            for (i++; i < lines.length && lines[i] !== delim; i++) body.push(lines[i] ?? '');
            out[key] = body.join('\n');
            continue;
        }
        const eq = line.indexOf('=');
        if (eq > 0) out[line.slice(0, eq)] = line.slice(eq + 1);
    }
    return out;
}

/** Git exports these inside hooks; a step that inherits them operates on the caller's repo, not the worktree. */
const GIT_HOOK_ENV = ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_PREFIX', 'GIT_COMMON_DIR', 'GIT_OBJECT_DIRECTORY', 'GIT_ALTERNATE_OBJECT_DIRECTORIES'];

function baseEnv(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(process.env)) {
        if (v === undefined) continue;
        if (GIT_HOOK_ENV.includes(k)) continue;
        if (k.startsWith('GITHUB_') || k.startsWith('RUNNER_')) continue;
        out[k] = v;
    }
    return out;
}

function runShell(script: string, cwd: string, env: Record<string, string>, logFile: string, timeoutMs: number): Promise<number> {
    return new Promise((resolve) => {
        const scriptFile = `${logFile}.sh`;
        fs.writeFileSync(scriptFile, script);
        const log = fs.openSync(logFile, 'w');
        const child = spawn('bash', ['--noprofile', '--norc', '-eo', 'pipefail', scriptFile], {
            cwd, env, stdio: ['ignore', log, log], detached: true,
        });
        const timer = setTimeout(() => {
            fs.writeSync(log, `\n[ci_mirror] step exceeded the job's remaining ${Math.round(timeoutMs / 1000)}s — killed\n`);
            try { process.kill(-(child.pid ?? 0), 'SIGKILL'); } catch { /* already gone */ }
        }, Math.max(timeoutMs, 1000));
        child.on('close', (code, signal) => {
            clearTimeout(timer);
            fs.closeSync(log);
            resolve(code ?? (signal ? 137 : 1));
        });
    });
}

export async function runJob(plan: JobPlan, facts: RunFacts, workdir: string, logDir: string): Promise<JobResult> {
    const started = Date.now();
    const deadline = started + plan.timeoutMinutes * 60_000;
    const steps: ExprContext['steps'] = {};
    const results: StepResult[] = [];
    let jobSucceeded = true;
    const jobEnv: Record<string, string> = { ...plan.env };
    const extraPath: string[] = [];
    const tag = `${plan.workflow.replace(/\.ya?ml$/, '')}--${plan.job}`;

    for (const s of plan.steps) {
        const record = (r: Omit<StepResult, 'index' | 'name'>) => results.push({ index: s.index, name: s.name, ...r });
        if (s.kind === 'setup') { record({ verdict: 'setup' }); continue; }
        if (s.kind === 'ci-only') { record({ verdict: 'ci-only', detail: s.ciOnlyReason }); continue; }

        const ctx = makeContext(facts, jobEnv, steps, jobSucceeded);
        let script: string;
        let stepEnv: Record<string, string>;
        try {
            if (!evaluateCondition(s.if, ctx)) {
                record({ verdict: 'skipped', detail: `if: ${String(s.if ?? 'success()')}` });
                if (s.id) steps[s.id] = { outputs: {}, outcome: 'skipped' };
                continue;
            }
            script = interpolate(s.run ?? '', ctx);
            stepEnv = Object.fromEntries(Object.entries({ ...jobEnv, ...s.env }).map(([k, v]) => [k, interpolate(v, ctx)]));
        } catch (e) {
            if (!(e instanceof UnsupportedExpression)) throw e;
            record({ verdict: 'not-reproducible', detail: e.message });
            continue;
        }

        const n = String(s.index).padStart(3, '0');
        const logFile = path.join(logDir, `${tag}--${n}.log`);
        const outputFile = `${logFile}.output`;
        const envFile = `${logFile}.env`;
        const pathFile = `${logFile}.path`;
        for (const f of [outputFile, envFile, pathFile]) fs.writeFileSync(f, '');
        const env: Record<string, string> = {
            ...baseEnv(),
            ...stepEnv,
            CI: 'true',
            GITHUB_ACTIONS: 'true',
            GITHUB_EVENT_NAME: 'pull_request',
            GITHUB_EVENT_PATH: path.join(facts.runnerTemp, 'event.json'),
            GITHUB_BASE_REF: facts.baseRef,
            GITHUB_HEAD_REF: facts.headRef,
            GITHUB_REF: `refs/pull/${facts.prNumber}/merge`,
            GITHUB_SHA: facts.headSha,
            GITHUB_REPOSITORY: 'event4u-app/agent-config',
            GITHUB_WORKSPACE: workdir,
            GITHUB_OUTPUT: outputFile,
            GITHUB_ENV: envFile,
            GITHUB_PATH: pathFile,
            GITHUB_STEP_SUMMARY: path.join(logDir, `${tag}--summary.md`),
            RUNNER_TEMP: facts.runnerTemp,
            RUNNER_OS: process.platform === 'darwin' ? 'macOS' : 'Linux',
        };
        if (extraPath.length > 0) env.PATH = `${extraPath.join(':')}:${env.PATH ?? ''}`;

        const t0 = Date.now();
        const code = await runShell(script, path.join(workdir, s.workingDirectory ?? ''), env, logFile, deadline - Date.now());
        const seconds = Math.round((Date.now() - t0) / 100) / 10;
        Object.assign(jobEnv, parseKeyFile(envFile));
        extraPath.unshift(...fs.readFileSync(pathFile, 'utf8').split('\n').filter(Boolean));
        steps[s.id ?? `__${s.index}`] = { outputs: parseKeyFile(outputFile), outcome: code === 0 ? 'success' : 'failure' };

        if (code === 0) { record({ verdict: 'passed', exitCode: 0, logFile, seconds }); continue; }
        if (!s.continueOnError) jobSucceeded = false;
        const log = fs.readFileSync(logFile, 'utf8');
        if (s.ownerMarker && s.ownerMarker.test(log)) {
            record({ verdict: 'owner-decision', exitCode: code, logFile, seconds });
        } else if (code === 127) {
            record({ verdict: 'not-reproducible', exitCode: code, logFile, seconds, detail: 'exit 127 — a command this machine does not have' });
        } else if (s.continueOnError) {
            record({ verdict: 'passed', exitCode: code, logFile, seconds, detail: 'failed, but continue-on-error: true' });
        } else {
            record({ verdict: 'failed', exitCode: code, logFile, seconds });
        }
    }
    return { workflow: plan.workflow, job: plan.job, displayName: plan.displayName, seconds: Math.round((Date.now() - started) / 1000), steps: results };
}

function git(args: string[], cwd: string): string {
    const env = baseEnv();
    return execFileSync('git', args, { cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function tryGit(args: string[], cwd: string): string | null {
    try { return git(args, cwd); } catch { return null; }
}

function prFacts(cwd: string, branch: string): { number: string; labels: string[] } {
    try {
        const out = execFileSync('gh', ['pr', 'view', branch, '--json', 'number,labels'], {
            cwd, encoding: 'utf8', timeout: 15_000, stdio: ['ignore', 'pipe', 'ignore'],
        });
        const j = JSON.parse(out) as { number: number; labels: Array<{ name: string }> };
        return { number: String(j.number), labels: j.labels.map((l) => l.name) };
    } catch {
        return { number: '0', labels: [] };
    }
}

const ICON: Record<StepVerdict, string> = {
    passed: '✅', failed: '❌', 'owner-decision': '⏸', 'not-reproducible': '⚠️', skipped: '·', 'ci-only': '☁', setup: '·',
};

function tail(file: string | undefined, lines: number): string {
    if (!file || !fs.existsSync(file)) return '';
    return fs.readFileSync(file, 'utf8').trimEnd().split('\n').slice(-lines).map((l) => `      ${l}`).join('\n');
}

export function summarize(results: JobResult[]): { blocking: number; text: string } {
    const lines: string[] = [];
    let blocking = 0;
    for (const j of results) {
        const count = (v: StepVerdict) => j.steps.filter((s) => s.verdict === v).length;
        const failed = count('failed');
        blocking += failed;
        const parts = [`${count('passed')} passed`];
        for (const v of ['failed', 'owner-decision', 'not-reproducible', 'ci-only', 'skipped'] as StepVerdict[]) {
            if (count(v) > 0) parts.push(`${count(v)} ${v}`);
        }
        lines.push(`  ${failed > 0 ? '❌' : '✅'} ${j.displayName} — ${parts.join(', ')} (${j.seconds}s)`);
    }
    const section = (verdict: StepVerdict, title: string, withLog: boolean) => {
        const hits = results.flatMap((j) => j.steps.filter((s) => s.verdict === verdict).map((s) => ({ j, s })));
        if (hits.length === 0) return;
        lines.push('', title);
        for (const { j, s } of hits) {
            lines.push(`  ${ICON[verdict]} ${j.displayName} › ${s.name}${s.exitCode !== undefined ? ` (exit ${s.exitCode})` : ''}`);
            if (s.detail) lines.push(`      ${s.detail}`);
            if (withLog) {
                lines.push(tail(s.logFile, 25));
                if (s.logFile) lines.push(`      full log: ${s.logFile}`);
            }
        }
    };
    section('failed', `❌ ${blocking} blocking failure(s) — CI fails on exactly these:`, true);
    section('owner-decision', '⏸  Owner decision required — reported, does not block the push (CI shows this step red until the owner decides):', true);
    section('not-reproducible', '⚠️  Not verified on this machine — CI is the only runner for these:', false);
    section('ci-only', '☁  CI-only by configuration (src/config/ci-mirror.json):', false);
    return { blocking, text: lines.join('\n') };
}

interface Args { list: boolean; keep: boolean; json?: string; jobs: string[]; base: string }

function parseArgs(argv: string[]): Args | string {
    const a: Args = { list: false, keep: false, jobs: [], base: 'main' };
    for (let i = 0; i < argv.length; i++) {
        const v = argv[i];
        const next = () => { const n = argv[++i]; if (n === undefined || n.startsWith('--')) throw new Error(`${v} needs a value`); return n; };
        try {
            if (v === '--list') a.list = true;
            else if (v === '--keep') a.keep = true;
            else if (v === '--json') a.json = next();
            else if (v === '--job') a.jobs.push(next());
            else if (v === '--base') a.base = next();
            else return `unknown argument: ${v}`;
        } catch (e) {
            return (e as Error).message;
        }
    }
    return a;
}

/**
 * Give a worktree its OWN node_modules. Never a symlink: a replayed step that
 * writes into node_modules (an install, a prepack, a cache) would write through
 * it into the caller's checkout — measured on the first run of this tool, when
 * three parallel `npm ci` steps emptied the caller's node_modules. A
 * copy-on-write clone costs ~2.5s for 295 MB on APFS; elsewhere `--reflink=auto`
 * clones where the filesystem can and copies where it cannot.
 */
export function cloneNodeModules(from: string, to: string): void {
    const args = process.platform === 'darwin' ? ['-cR', from, to] : ['-R', '--reflink=auto', from, to];
    try {
        execFileSync('cp', args, { stdio: 'pipe' });
    } catch {
        fs.cpSync(from, to, { recursive: true, verbatimSymlinks: true });
    }
    if (fs.lstatSync(to).isSymbolicLink()) throw new Error(`${to} must be a copy, never a link`);
}

export async function main(argv: string[]): Promise<number> {
    const args = parseArgs(argv);
    if (typeof args === 'string') { process.stderr.write(`ci_mirror: ${args}\n`); return 2; }
    const root = tryGit(['rev-parse', '--show-toplevel'], process.cwd());
    if (!root) { process.stderr.write('ci_mirror: not inside a git checkout\n'); return 2; }
    const config = loadConfig(root);
    const plans = planJobs(root, config, args.jobs);
    if (plans.length === 0) { process.stderr.write('ci_mirror: no job matched\n'); return 2; }

    if (args.list) {
        for (const p of plans) {
            process.stdout.write(`${p.workflow}:${p.job} — ${p.displayName}\n`);
            for (const s of p.steps) process.stdout.write(`  [${s.index}] ${s.kind.padEnd(7)} ${s.name}${s.ciOnlyReason ? `  (ci-only: ${s.ciOnlyReason})` : ''}${s.ownerMarker ? '  (owner-decision)' : ''}\n`);
            for (const u of unreproducibleSteps(p)) process.stdout.write(`  ⚠️  not reproducible: ${u.step} — ${u.reason}\n`);
        }
        return 0;
    }

    const nodeModules = path.join(root, 'node_modules');
    if (!fs.existsSync(nodeModules)) { process.stderr.write(`ci_mirror: ${nodeModules} is missing — run npm ci first\n`); return 2; }
    const headSha = git(['rev-parse', 'HEAD'], root);
    const headRef = tryGit(['symbolic-ref', '--short', 'HEAD'], root) ?? 'HEAD';
    const baseSha = tryGit(['rev-parse', `origin/${args.base}`], root) ?? tryGit(['rev-parse', args.base], root);
    if (!baseSha) { process.stderr.write(`ci_mirror: cannot resolve the base ${args.base}\n`); return 2; }
    const pr = prFacts(root, headRef);

    const scratch = fs.mkdtempSync(path.join(os.tmpdir(), `ci-mirror-${headSha.slice(0, 7)}-`));
    const logDir = path.join(scratch, 'logs');
    fs.mkdirSync(logDir);
    process.stdout.write(`🔍 CI mirror — replaying ${plans.length} CI job(s) on ${headSha.slice(0, 10)} against origin/${args.base}, in parallel throwaway worktrees\n`);
    process.stdout.write(`   logs: ${logDir}\n`);

    const worktrees: string[] = [];
    try {
        const results = await Promise.all(plans.map(async (plan, i) => {
            const workdir = plan.inCaller ? root : path.join(scratch, `wt-${i}`);
            const runnerTemp = path.join(scratch, `tmp-${i}`);
            fs.mkdirSync(runnerTemp);
            if (!plan.inCaller) {
                git(['worktree', 'add', '--detach', '--quiet', workdir, headSha], root);
                worktrees.push(workdir);
                cloneNodeModules(nodeModules, path.join(workdir, 'node_modules'));
            }
            fs.writeFileSync(path.join(runnerTemp, 'event.json'), JSON.stringify({
                pull_request: {
                    number: Number(pr.number),
                    base: { ref: args.base, sha: baseSha },
                    head: { ref: headRef, sha: headSha },
                    labels: pr.labels.map((name) => ({ name })),
                },
            }));
            const facts: RunFacts = { baseRef: args.base, baseSha, headSha, headRef, prNumber: pr.number, runnerTemp, workspace: workdir };
            const r = await runJob(plan, facts, workdir, logDir);
            process.stdout.write(`   … ${plan.displayName} finished (${r.seconds}s)\n`);
            return r;
        }));
        const { blocking, text } = summarize(results);
        process.stdout.write(`\n${text}\n`);
        if (args.json) fs.writeFileSync(args.json, JSON.stringify({ head: headSha, base: baseSha, blocking, jobs: results }, null, 2));
        process.stdout.write(blocking > 0
            ? `\n❌ CI mirror: ${blocking} blocking failure(s). Fix them all, commit, and push again.\n`
            : '\n✅ CI mirror: no blocking failure in the mirrored jobs.\n');
        return blocking > 0 ? 1 : 0;
    } finally {
        if (!args.keep) {
            for (const wt of worktrees) tryGit(['worktree', 'remove', '--force', wt], root);
            tryGit(['worktree', 'prune'], root);
            for (const entry of fs.readdirSync(scratch)) {
                if (entry !== 'logs') fs.rmSync(path.join(scratch, entry), { recursive: true, force: true });
            }
        }
    }
}

const _isMain = (() => {
    const entry = process.argv[1];
    if (!entry) return false;
    try {
        return path.resolve(entry) === path.resolve(_HERE);
    } catch {
        return false;
    }
})();

if (_isMain) {
    main(process.argv.slice(2)).then((code) => process.exit(code), (e: unknown) => {
        process.stderr.write(`ci_mirror: ${e instanceof Error ? e.stack ?? e.message : String(e)}\n`);
        process.exit(2);
    });
}
