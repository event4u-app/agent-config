/**
 * `agent-config git:convention <subcommand>` — the git convention as code an
 * installed command can reach.
 *
 * A consumer project has neither `scripts-run` nor `node_modules`, so a command
 * that needs the strategy, the commit format or the branch pattern can only ask
 * the `agent-config` binary. `settings:get` answers "not set" for a file that
 * does not parse, which is the reading that turns an unreadable `rebase` into a
 * merge; this verb reports the five states of `_lib/git_convention.ts` instead.
 *
 * Subcommands live in one table so a new one is a row, not a new verb.
 *
 * Every key is read through `_lib/git_convention_carrier.ts`: the committed
 * `.git-convention.yml` over the developer layers, `update_strategy` at the
 * commit the branch is judged against. Where this checkout's own value differs,
 * it is printed as a candidate beside the value in force.
 *
 * Exit codes: `0` every key readable · `1` a key, or this checkout's candidate
 * for it, is `malformed` or `invalid` · `2` usage error. An `unresolvable`
 * target is reported, not an exit: `sync_pr_branch` refuses on it.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { GIT_CONVENTION_KEYS, describeRefusal, type GitConventionReading } from '../_lib/git_convention.js';
import { CARRIER_PATH, readCommittedConvention, type TargetDeps } from '../_lib/git_convention_carrier.js';

export interface GitConventionResult {
    code: 0 | 1 | 2;
    out: string[];
    err: string[];
}

export interface CommitMessageValidator {
    kind: 'commit-msg hook' | 'commitlint config';
    path: string;
}

const COMMITLINT_FILES = [
    'commitlint.config.js',
    'commitlint.config.cjs',
    'commitlint.config.mjs',
    'commitlint.config.ts',
    '.commitlintrc',
    '.commitlintrc.json',
    '.commitlintrc.yml',
    '.commitlintrc.yaml',
    '.commitlintrc.js',
    '.commitlintrc.cjs',
] as const;

function _git(cwd: string, ...args: string[]): string | null {
    const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
    return r.status === 0 ? r.stdout.trim() : null;
}

function _isExecutableFile(p: string): boolean {
    try {
        const st = fs.statSync(p);
        return st.isFile() && (st.mode & 0o111) !== 0;
    } catch {
        return false;
    }
}

/**
 * A repository-level commit-message validator, which outranks
 * `git.commit_format` because it rejects the commit the setting would shape.
 * The hook path comes from git so `core.hooksPath` and worktrees resolve.
 */
export function commitMessageValidator(cwd: string): CommitMessageValidator | null {
    const top = _git(cwd, 'rev-parse', '--show-toplevel') ?? cwd;
    const hook = _git(cwd, 'rev-parse', '--git-path', 'hooks/commit-msg');
    if (hook !== null) {
        const abs = path.resolve(cwd, hook);
        if (_isExecutableFile(abs)) return { kind: 'commit-msg hook', path: abs };
    }
    const husky = path.join(top, '.husky', 'commit-msg');
    if (fs.existsSync(husky)) return { kind: 'commit-msg hook', path: husky };
    for (const name of COMMITLINT_FILES) {
        const p = path.join(top, name);
        if (fs.existsSync(p)) return { kind: 'commitlint config', path: p };
    }
    try {
        const pkg = JSON.parse(fs.readFileSync(path.join(top, 'package.json'), 'utf-8')) as Record<string, unknown>;
        if (pkg.commitlint !== undefined) return { kind: 'commitlint config', path: path.join(top, 'package.json') };
    } catch {
        // No package.json, or one that does not parse: neither declares a validator.
    }
    return null;
}

function _blocking(reading: GitConventionReading): boolean {
    return reading.state === 'malformed' || reading.state === 'invalid';
}

function _short(sha: string | null | undefined): string {
    return sha === null || sha === undefined ? '?' : sha.slice(0, 12);
}

/** `show` with the target lookups injectable; the verb passes none. */
export function showConvention(args: readonly string[], cwd: string, deps?: TargetDeps): GitConventionResult {
    let json = false;
    let base: string | null = null;
    for (let i = 0; i < args.length; i++) {
        const a = args[i] as string;
        if (a === '--json') json = true;
        else if (a === '--base' && args[i + 1] !== undefined && !(args[i + 1] as string).startsWith('--')) base = args[++i] as string;
        else return { code: 2, out: [], err: [`unknown argument: ${a}`, USAGE] };
    }
    const read = readCommittedConvention(cwd, { override: base, ...(deps ? { deps } : {}) });
    const readings = read.readings as Record<(typeof GIT_CONVENTION_KEYS)[number], GitConventionReading>;
    const validator = commitMessageValidator(cwd);
    const ok = !GIT_CONVENTION_KEYS.some((k) => _blocking(readings[k]) || (read.candidates[k] !== undefined && _blocking(read.candidates[k] as GitConventionReading)));
    const code: 0 | 1 = ok ? 0 : 1;

    if (json) {
        const keys: Record<string, unknown> = {};
        for (const k of GIT_CONVENTION_KEYS) {
            const { key: _key, ...rest } = readings[k];
            const cand = read.candidates[k];
            keys[k] = {
                ...rest,
                read_at: read.readAt[k] ?? null,
                candidate: cand === undefined ? null : { value: cand.value, source: cand.source, state: cand.state, reason: cand.reason },
            };
        }
        return {
            code,
            out: [JSON.stringify({ ok, keys, target: read.target, commit_message_validator: validator }, null, 2)],
            err: [],
        };
    }

    const out: string[] = [];
    for (const k of GIT_CONVENTION_KEYS) {
        const r = readings[k];
        out.push(r.value === null ? `git.${k} — unknown` : `git.${k} = ${r.value}`);
        out.push(`  state     ${r.state}`);
        out.push(`  source    ${r.source ?? '(template default)'}`);
        const at = read.readAt[k];
        if (k === 'update_strategy' && read.target !== null) {
            out.push(`  read at   ${_short(read.target.sha)} — ${read.target.ref}, the commit this branch is judged against`);
        } else if (at !== null && at !== undefined) {
            out.push(`  read at   ${_short(at)} — HEAD`);
        }
        if (r.reason !== null) out.push(`  ⚠️  ${describeRefusal(r)}`);
        const cand = read.candidates[k];
        if (cand !== undefined) {
            out.push(
                `  candidate ${cand.value ?? 'unknown'} (${cand.state}) from ${cand.source ?? '(template default)'} — this checkout's value; the value above is in force`,
            );
            if (cand.reason !== null) out.push(`  ⚠️  ${describeRefusal(cand)}`);
        }
    }
    out.push(`team declaration: ${CARRIER_PATH} at the repository root (ADR-282)`);
    out.push(
        validator === null
            ? 'commit-message validator: none in this repository'
            : `commit-message validator: ${validator.kind} at ${validator.path} — it outranks git.commit_format`,
    );
    return { code, out, err: [] };
}

export const SUBCOMMANDS: Readonly<Record<string, (args: readonly string[], cwd: string) => GitConventionResult>> = {
    show: (args, cwd) => showConvention(args, cwd),
};

const USAGE = `usage: agent-config git:convention <${Object.keys(SUBCOMMANDS).join('|')}> [--json] [--base REF]`;

export function runGitConvention(argv: readonly string[], cwd: string): GitConventionResult {
    const [sub, ...rest] = argv;
    if (sub === '-h' || sub === '--help') return { code: 0, out: [USAGE], err: [] };
    const handler = sub === undefined ? undefined : SUBCOMMANDS[sub];
    if (handler === undefined) {
        return { code: 2, out: [], err: [sub === undefined ? USAGE : `unknown subcommand: ${sub}`, ...(sub === undefined ? [] : [USAGE])] };
    }
    return handler(rest, cwd);
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    const result = runGitConvention(argv, process.cwd());
    for (const line of result.out) process.stdout.write(`${line}\n`);
    for (const line of result.err) process.stderr.write(`${line}\n`);
    return result.code;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) return true;
    try {
        return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exitCode = main();
}
