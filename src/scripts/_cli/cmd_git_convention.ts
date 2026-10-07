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
 * Exit codes: `0` every key readable · `1` a key is `malformed` or `invalid` ·
 * `2` usage error.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
    GIT_CONVENTION_KEYS,
    checkoutSource,
    describeRefusal,
    readGitConvention,
    type GitConventionReading,
} from '../_lib/git_convention.js';

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

function show(args: readonly string[], cwd: string): GitConventionResult {
    let json = false;
    for (const a of args) {
        if (a === '--json') json = true;
        else return { code: 2, out: [], err: [`unknown argument: ${a}`, USAGE] };
    }
    const readings = readGitConvention(checkoutSource(cwd));
    const validator = commitMessageValidator(cwd);
    const ok = !GIT_CONVENTION_KEYS.some((k) => _blocking(readings[k]));
    const code: 0 | 1 = ok ? 0 : 1;

    if (json) {
        const keys: Record<string, Omit<GitConventionReading, 'key'>> = {};
        for (const k of GIT_CONVENTION_KEYS) {
            const { key: _key, ...rest } = readings[k];
            keys[k] = rest;
        }
        return { code, out: [JSON.stringify({ ok, keys, commit_message_validator: validator }, null, 2)], err: [] };
    }

    const out: string[] = [];
    for (const k of GIT_CONVENTION_KEYS) {
        const r = readings[k];
        out.push(r.value === null ? `git.${k} — unknown` : `git.${k} = ${r.value}`);
        out.push(`  state     ${r.state}`);
        out.push(`  source    ${r.source ?? '(template default)'}`);
        if (r.reason !== null) out.push(`  ⚠️  ${describeRefusal(r)}`);
    }
    out.push(
        validator === null
            ? 'commit-message validator: none in this repository'
            : `commit-message validator: ${validator.kind} at ${validator.path} — it outranks git.commit_format`,
    );
    return { code, out, err: [] };
}

export const SUBCOMMANDS: Readonly<Record<string, (args: readonly string[], cwd: string) => GitConventionResult>> = {
    show,
};

const USAGE = `usage: agent-config git:convention <${Object.keys(SUBCOMMANDS).join('|')}> [--json]`;

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
