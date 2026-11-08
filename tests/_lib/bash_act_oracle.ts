/**
 * Real bash as the oracle for the act recogniser. A command runs in an empty temp
 * directory with `git` and `gh` as logging executables; the result is the set of
 * bound acts bash reached.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

export const C = 'git commit';
export const P = 'git push';
export const G = 'gh pr create';
export const ACTS = [C, P, G] as const;

export const hasBash = spawnSync('bash', ['-c', 'true']).status === 0;

// `git` and `gh` are executables on PATH, not functions, so `command`, `exec` and
// `nohup` treat them as bash does. `sudo` is a function that applies its leading
// `VAR=value` arguments, as sudo(8) documents, then runs the rest.
const GIT_STUB = '#!/bin/sh\nwhile [ "$1" = -C ] || [ "$1" = -c ]; do shift 2; done\nprintf "git %s\\n" "$1" >> "$ACT_LOG"\n';
const GH_STUB = '#!/bin/sh\nprintf "gh %s %s\\n" "$1" "$2" >> "$ACT_LOG"\n';
const STUBS = [
    'cat() { command cat > /dev/null; }',
    'sudo() { while [ $# -gt 0 ]; do case $1 in [A-Za-z_]*=*) export "$1"; shift ;; *) break ;; esac; done; "$@"; }',
    'make() { :; }', 'npm() { :; }', 'sleep() { :; }', 'cd() { :; }',
    // A generated word fragment such as `sh` must not execute text piped into it.
    'sh() { :; }', 'bash() { :; }',
].join('\n');

/**
 * Acts bash invokes, as the union of four runs: `true` and `cond` each succeeding
 * and failing. The recogniser reports a potential act, so both `&&` and `||` branches
 * have to be reachable for bash to be its oracle.
 */
export function bashActs(command: string): string[] {
    const acts = new Set<string>(ACTS);
    const runs = [0, 1].flatMap((t) => [0, 1].map((c) => bashRun(command, t, c)));
    return [...new Set(runs.flat())].filter((a) => acts.has(a)).sort();
}

/**
 * One run with `true` and `cond` returning the given statuses. `cond` is the
 * condition the generated `if` forms use: kept apart from the `true` gates of
 * `&&`/`||` chains so that reaching an `else` never requires `true` to succeed
 * and fail in the same run.
 */
function bashRun(command: string, trueStatus: number, condStatus: number): string[] {
    const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'acts-oracle-'));
    try {
        const log = path.join(dir, 'acts.log');
        fs.writeFileSync(log, '');
        const bin = path.join(dir, 'bin');
        fs.mkdirSync(bin);
        fs.writeFileSync(path.join(bin, 'git'), GIT_STUB, { mode: 0o755 });
        fs.writeFileSync(path.join(bin, 'gh'), GH_STUB, { mode: 0o755 });
        const r = spawnSync('bash', ['-c', `${STUBS}\ntrue() { return ${trueStatus}; }\ncond() { return ${condStatus}; }\n${command}\nwait`], { cwd: dir, env: { PATH: `${bin}${path.delimiter}${process.env['PATH'] ?? ''}`, ACT_LOG: log }, encoding: 'utf8', timeout: 10_000 });
        if (r.error || r.signal) throw new Error(`bash did not finish: ${String(r.error ?? r.signal)}`);
        return fs.readFileSync(log, 'utf8').split('\n').filter((l) => l !== '');
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

