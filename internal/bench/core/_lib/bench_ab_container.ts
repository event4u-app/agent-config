/**
 * One benchmark trial inside a fresh container — the `--isolation container` path.
 *
 * The host path separates arms by CLI flags and by where a clone sits on disk,
 * and its package arm loads the operator's whole user scope. Here the ONLY
 * difference between arms is the image: `bench-base` (CLI + toolchain) or
 * `bench-ac` (the same plus agent-config, installed at build time). Both run the
 * same CLI arguments, so `--setting-sources` is never passed.
 *
 * The subscription credential crosses into the container by NAME (`-e NAME`),
 * so its value is never on an argv that `ps` or a crash log could show, and
 * `ANTHROPIC_API_KEY` is removed from the docker client's environment: the CLI
 * prefers an API key over the subscription token without saying so.
 */
import { spawnSync } from 'node:child_process';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { countedTrials, type Receipt } from '../../../../src/scripts/_lib/eval_publication.js';

import { loaded_package_skills, parse_init_event, type InitInfo } from './bench_ab_delivery_probe.js';

export const CONTAINER_WORKDIR = '/work';
export const CONTAINER_SYSPROMPT = '/bench/sysprompt.txt';
export const TOKEN_ENV = 'CLAUDE_CODE_OAUTH_TOKEN';
export const DEFAULT_TOKEN_FILE = path.join(os.homedir(), '.event4u', 'agent-config', 'secrets', 'claude-oauth-token');
/** One token file per account; a sweep moves to the next when one account runs out. */
export const DEFAULT_TOKEN_DIR = path.join(os.homedir(), '.event4u', 'agent-config', 'secrets', 'claude-oauth-tokens');

/** Credential variables that would override or bypass the subscription token. */
const OVERRIDING_CREDENTIALS = ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_BASE_URL', 'CLAUDE_CODE_USE_BEDROCK', 'CLAUDE_CODE_USE_VERTEX'];

export interface ContainerSpec {
    /** Image id (`sha256:…`) the trial runs in. */
    image: string;
    cpus?: string;
    memory?: string;
    /** `--name` for the container, so a timed-out trial can be removed: killing the docker client does not stop it. */
    name?: string;
}

/**
 * The `docker run` argv for one trial. `cli_args` is what the host path would
 * pass to `claude`; a host-side `--append-system-prompt-file` path is mounted
 * read-only and rewritten to its container path.
 */
export function container_argv(spec: ContainerSpec, clone: string, cli_args: readonly string[]): string[] {
    const argv = [
        'run', '--rm', '--init',
        '--cpus', spec.cpus ?? '2',
        '--memory', spec.memory ?? '4g',
        '-v', `${clone}:${CONTAINER_WORKDIR}`,
        '-w', CONTAINER_WORKDIR,
        '-e', TOKEN_ENV,
    ];
    if (spec.name) argv.push('--name', spec.name);
    const cli = [...cli_args];
    const i = cli.indexOf('--append-system-prompt-file');
    if (i >= 0 && cli[i + 1]) {
        argv.push('-v', `${cli[i + 1]}:${CONTAINER_SYSPROMPT}:ro`);
        cli[i + 1] = CONTAINER_SYSPROMPT;
    }
    const s = cli.indexOf('--setting-sources');
    if (s >= 0) cli.splice(s, 2);
    return [...argv, spec.image, 'claude', ...cli];
}

/** A container name unique to this process and call. */
export function container_name(): string {
    return `bench-ab-${process.pid}-${crypto.randomBytes(6).toString('hex')}`;
}

/** Force-remove a container by name; false when docker refused or did not answer within 30 s. */
export function stop_container(name: string, spawn: typeof spawnSync = spawnSync): boolean {
    const r = spawn('docker', ['rm', '-f', name], { encoding: 'utf-8', timeout: 30_000, killSignal: 'SIGKILL' });
    return r.status === 0;
}

/** The docker client's environment: the caller's, minus overriding credentials, plus the token. */
export function container_env(base: NodeJS.ProcessEnv, token: string): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(base)) {
        if (typeof v === 'string' && !OVERRIDING_CREDENTIALS.includes(k)) out[k] = v;
    }
    out[TOKEN_ENV] = token;
    return out;
}

/**
 * The subscription token, from the environment or the token file. Refuses a file
 * any other user can read, and a value that does not look like one token.
 */
export function read_oauth_token(env: NodeJS.ProcessEnv = process.env, file: string = DEFAULT_TOKEN_FILE): string {
    const fromEnv = env[TOKEN_ENV];
    const raw = fromEnv ?? (() => {
        if (!fs.existsSync(file)) {
            throw new Error(`no ${TOKEN_ENV} in the environment and no token file at ${file} — create one with \`claude setup-token\` (see internal/bench/containers/README.md)`);
        }
        if ((fs.statSync(file).mode & 0o077) !== 0) {
            throw new Error(`${file} is readable by other users; run: chmod 600 ${file}`);
        }
        return fs.readFileSync(file, 'utf-8');
    })();
    const token = raw.trim();
    if (!token || /\s/.test(token)) throw new Error(`${TOKEN_ENV} is empty or not a single token`);
    return token;
}

/** Replace every occurrence of the token in a text that is about to be written to disk. */
export function redact(text: string, token: string): string {
    return token ? text.split(token).join('[REDACTED]') : text;
}

export interface LoadCheck {
    ok: boolean;
    reason: string;
    package_skills: number;
}

/**
 * Whether what the CLI reports having loaded matches the arm's image: a package
 * image must load package skills, a base image must load none. A run with no
 * init event cannot be checked and counts as a mismatch.
 */
export function load_check(stream: string, expects_package: boolean, packageSkills: ReadonlySet<string>): LoadCheck {
    const init: InitInfo | null = parse_init_event(stream);
    if (init === null) return { ok: false, reason: 'no system/init event in the stream', package_skills: 0 };
    const n = loaded_package_skills(init, packageSkills).length;
    if (expects_package && n === 0) return { ok: false, reason: 'package image, but no package skill loaded', package_skills: 0 };
    if (!expects_package && n > 0) return { ok: false, reason: `base image, yet ${n} package skill(s) loaded`, package_skills: n };
    return { ok: true, reason: `${n} package skill(s) loaded`, package_skills: n };
}

function tokens_spent(run: Record<string, unknown>): number {
    const breakdown = (run['tokens_breakdown'] ?? {}) as Record<string, unknown>;
    return ['input_tokens', 'output_tokens', 'cache_read_input_tokens', 'cache_creation_input_tokens']
        .reduce((a, k) => a + (typeof breakdown[k] === 'number' ? (breakdown[k] as number) : 0), 0);
}

/**
 * `false` only on positive evidence that the run ended before any model call:
 * it errored, its stream has no `system/init` event, and it spent no tokens.
 * Anything less certain counts as reached (eval-measurement-integrity § A run
 * that never reached the model is not a trial).
 */
export function reached_model(run: Record<string, unknown>): boolean {
    if (typeof run['reached_model'] === 'boolean') return run['reached_model'];
    if (run['errored'] !== true) return true;
    if (typeof run['stream'] !== 'string') return true;
    if (parse_init_event(run['stream']) !== null) return true;
    return tokens_spent(run) > 0;
}

/**
 * Run `attempt` until one reaches the model, at most `maxReruns` reruns; the
 * counted trial is chosen by `countedTrials`. A trial that never reached the
 * model is returned errored with `environment_failure: true`, so every
 * statistic that drops errored runs drops it, and the reason names the count.
 */
export function with_pre_model_reruns(attempt: () => Record<string, unknown>, maxReruns: number): Record<string, unknown> {
    const runs: Record<string, unknown>[] = [];
    const receipts: Receipt[] = [];
    for (let n = 1; n <= maxReruns + 1; n += 1) {
        const run = attempt();
        runs.push(run);
        const reached = reached_model(run);
        receipts.push({ caseId: 'trial', configuration: 'arm', attempt: n, outcome: reached ? 'pass' : 'aborted', failureReason: reached ? undefined : 'timeout', reachedModel: reached });
        if (reached) break;
    }
    const verdict = countedTrials(receipts, maxReruns);
    const counted = verdict.trials[0];
    if (counted === undefined) {
        const last = runs[runs.length - 1] as Record<string, unknown>;
        const n = verdict.environmentFailures[0]?.preModelAborts ?? runs.length;
        return { ...last, errored: true, environment_failure: true, pre_model_aborts: n, reason: `environment_failure: ${String(n)} pre-model abort(s); last: ${String(last['reason'] ?? 'no reason')}` };
    }
    return { ...(runs[counted.attempt - 1] as Record<string, unknown>), pre_model_aborts: verdict.excludedPreModel };
}

const QUOTA_TEXT = /usage limit|rate[_ ]limit|limit reached|quota|too many requests|\b429\b/i;

/**
 * A run that never did any work because the account ran out: it errored, and
 * either spent nothing or said so. Kept apart from an ordinary error so the
 * sweep can stop instead of filling the report with empty runs.
 */
export function is_quota_exhausted(run: Record<string, unknown>): boolean {
    if (run['errored'] !== true) return false;
    const spent = tokens_spent(run);
    const said = QUOTA_TEXT.test(`${String(run['reason'] ?? '')}\n${String(run['transcript'] ?? '').slice(-2000)}`);
    return said || spent === 0;
}

/**
 * Sweep brake: a guard that stops the sweep after `limit` consecutive
 * quota-exhausted runs. A run with work in between resets the count.
 */
export function quota_brake(limit = 3): (record: Record<string, unknown>) => string | null {
    let streak = 0;
    return (record) => {
        streak = is_quota_exhausted(record) ? streak + 1 : 0;
        return streak >= limit
            ? `sweep stopped: ${limit} consecutive runs did no work (quota or usage limit) — the account is exhausted, resume later with the checkpoint`
            : null;
    };
}

/** Everything a container sweep needs per trial, resolved once in `main`. */
export interface ContainerCtx {
    base_image: string;
    ac_image: string;
    /** The full-rule-layer image (`init --full`), when built; arms with `ac_layer: 'full'` need it. */
    ac_full_image?: string;
    token: string;
    package_skills: ReadonlySet<string>;
    /** Every configured account, for the brake's resume hint; never rotated through. */
    pool?: readonly PoolEntry[];
    account?: string;
}

/** Arms that load the package (no `--setting-sources` on the host path) run on `bench-ac`. */
export function arm_loads_package(spec: { setting_sources: string | null }): boolean {
    return spec.setting_sources === null;
}

type ImageSpec = { setting_sources: string | null; ac_layer?: 'full' };

/** The image an arm runs on. An arm asking for the full layer without that image is refused, never run on the default one. */
export function image_for(ctx: ContainerCtx, spec: ImageSpec): string {
    if (!arm_loads_package(spec)) return ctx.base_image;
    if (spec.ac_layer !== 'full') return ctx.ac_image;
    if (ctx.ac_full_image === undefined) {
        throw new Error('arm needs the full-rule-layer image: build it with bench_ab_images --with-full-layer');
    }
    return ctx.ac_full_image;
}

export function trial_container(ctx: ContainerCtx, spec: ImageSpec): ContainerSpec & { token: string } {
    return { image: image_for(ctx, spec), token: ctx.token };
}

/**
 * The trial fields the container path adds. A load mismatch turns the trial
 * into an errored one, so every statistic that already drops errored runs drops
 * it too, and the reason says which check failed.
 */
export function container_fields(run: Record<string, unknown>, spec: ImageSpec, ctx: ContainerCtx): Record<string, unknown> {
    const check = load_check(String(run['stream'] ?? ''), arm_loads_package(spec), ctx.package_skills);
    const image = image_for(ctx, spec);
    const base = { image, load_check: check, reached_model: reached_model(run) };
    if (check.ok || run['errored'] === true) return base;
    return { ...base, errored: true, reason: `load_mismatch: ${check.reason}` };
}

export interface PoolEntry {
    name: string;
    token: string;
}

/**
 * Every configured token: the single file first, then one file per account in
 * the pool directory, each held to the same 0600 rule. Duplicates are dropped.
 */
export function read_token_pool(env: NodeJS.ProcessEnv = process.env, file: string = DEFAULT_TOKEN_FILE, dir: string = DEFAULT_TOKEN_DIR): PoolEntry[] {
    const out: PoolEntry[] = [];
    if (env[TOKEN_ENV] || fs.existsSync(file)) out.push({ name: env[TOKEN_ENV] ? 'env' : 'default', token: read_oauth_token(env, file) });
    if (fs.existsSync(dir)) {
        for (const f of fs.readdirSync(dir).filter((n) => !n.startsWith('.')).sort()) {
            out.push({ name: f, token: read_oauth_token({}, path.join(dir, f)) });
        }
    }
    if (out.length === 0) read_oauth_token(env, file);
    return out.filter((e, i) => out.findIndex((o) => o.token === e.token) === i);
}

/**
 * The account a sweep runs on: the one named, or the first in the pool. A sweep
 * never moves to another account on its own — when its account runs out, the
 * brake stops it and the operator chooses where to resume (`next_account_hint`).
 */
export function select_account(pool: readonly PoolEntry[], name: string | null = null): PoolEntry {
    if (pool.length === 0) throw new Error('no token configured');
    if (name === null) return pool[0] as PoolEntry;
    const hit = pool.find((e) => e.name === name);
    if (!hit) throw new Error(`no token for account "${name}"; configured: ${pool.map((e) => e.name).join(', ')}`);
    return hit;
}

/** The line the brake adds: which other accounts have a token, and how to resume on one. */
export function next_account_hint(pool: readonly PoolEntry[], current: string): string {
    const others = pool.map((e) => e.name).filter((n) => n !== current);
    return others.length === 0
        ? `account "${current}" is exhausted and no other account has a token`
        : `account "${current}" is exhausted; resume on another with --account <name> (configured: ${others.join(', ')})`;
}
