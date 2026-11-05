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
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

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

const QUOTA_TEXT = /usage limit|rate[_ ]limit|limit reached|quota|too many requests|\b429\b/i;

/**
 * A run that never did any work because the account ran out: it errored, and
 * either spent nothing or said so. Kept apart from an ordinary error so the
 * sweep can stop instead of filling the report with empty runs.
 */
export function is_quota_exhausted(run: Record<string, unknown>): boolean {
    if (run['errored'] !== true) return false;
    const breakdown = (run['tokens_breakdown'] ?? {}) as Record<string, unknown>;
    const spent = ['input_tokens', 'output_tokens', 'cache_read_input_tokens', 'cache_creation_input_tokens']
        .reduce((a, k) => a + (typeof breakdown[k] === 'number' ? (breakdown[k] as number) : 0), 0);
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
    /** The token in use; `rotate()` moves it to the next account in the pool. */
    token: string;
    package_skills: ReadonlySet<string>;
    pool?: TokenPool;
}

/** Arms that load the package (no `--setting-sources` on the host path) run on `bench-ac`. */
export function arm_loads_package(spec: { setting_sources: string | null }): boolean {
    return spec.setting_sources === null;
}

export function trial_container(ctx: ContainerCtx, spec: { setting_sources: string | null }): ContainerSpec & { token: string } {
    return { image: arm_loads_package(spec) ? ctx.ac_image : ctx.base_image, token: ctx.token };
}

/**
 * The trial fields the container path adds. A load mismatch turns the trial
 * into an errored one, so every statistic that already drops errored runs drops
 * it too, and the reason says which check failed.
 */
export function container_fields(run: Record<string, unknown>, spec: { setting_sources: string | null }, ctx: ContainerCtx): Record<string, unknown> {
    const check = load_check(String(run['stream'] ?? ''), arm_loads_package(spec), ctx.package_skills);
    const image = arm_loads_package(spec) ? ctx.ac_image : ctx.base_image;
    const base = { image, load_check: check };
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

/** Moves through the pool once; an account that ran out is not tried again in this sweep. */
export class TokenPool {
    private i = 0;
    constructor(readonly entries: readonly PoolEntry[]) {
        if (entries.length === 0) throw new Error('empty token pool');
    }
    get current(): PoolEntry {
        return this.entries[this.i] as PoolEntry;
    }
    /** Advance to the next account; false when none is left. */
    rotate(): boolean {
        if (this.i + 1 >= this.entries.length) return false;
        this.i += 1;
        return true;
    }
}

/**
 * Run one trial, and when it did no work because the account ran out, run it
 * again on the next account in the pool. The record names the account that
 * produced it, never its token.
 */
export function with_rotation(ctx: ContainerCtx, run: () => Record<string, unknown>, log: (m: string) => void = (m) => process.stderr.write(m)): Record<string, unknown> {
    for (;;) {
        const r = run();
        if (!ctx.pool) return r;
        if (!is_quota_exhausted(r) || !ctx.pool.rotate()) return { ...r, account: ctx.pool.current.name };
        ctx.token = ctx.pool.current.token;
        log(`bench_ab_v2: account exhausted — continuing on ${ctx.pool.current.name}\n`);
    }
}
