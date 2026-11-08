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

// `BASH_ORACLE_IMAGE=ubuntu:24.04` runs every case in one long-lived container of that
// image instead of the host bash, so a local run can check another bash version
// (macOS ships 3.2, CI runs 5.x). The temp root is mounted at the same path.
let containerId: string | null | undefined;
function oracleContainer(): string | null {
    if (containerId !== undefined) return containerId;
    const image = process.env['BASH_ORACLE_IMAGE'];
    if (!image) return (containerId = null);
    const tmp = fs.realpathSync(os.tmpdir());
    const r = spawnSync('docker', ['run', '-d', '--rm', '-v', `${tmp}:${tmp}`, image, 'sleep', '3600'], { encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`cannot start ${image}: ${r.stderr}`);
    containerId = r.stdout.trim();
    process.on('exit', () => spawnSync('docker', ['rm', '-f', containerId as string]));
    return containerId;
}

/** The version of the bash the oracle runs, for the record of a sweep. */
export function oracleBashVersion(): string {
    const c = oracleContainer();
    const r = c ? spawnSync('docker', ['exec', c, 'bash', '-c', 'echo $BASH_VERSION'], { encoding: 'utf8' }) : spawnSync('bash', ['-c', 'echo $BASH_VERSION'], { encoding: 'utf8' });
    return r.stdout.trim();
}

// `git` and `gh` are executables on PATH, not functions, so `command`, `exec` and
// `nohup` treat them as bash does. `sudo` is a function that applies its leading
// `VAR=value` arguments, as sudo(8) documents, then runs the rest.
const GIT_STUB = '#!/bin/sh\nwhile [ "$1" = -C ] || [ "$1" = -c ]; do shift 2; done\nprintf "git %s\\n" "$1" >> "$ACT_LOG"\n';
// time(1) as POSIX describes it, so the result does not depend on whether the host
// has /usr/bin/time: an optional -p, then the utility named by the rest.
const TIME_STUB = '#!/bin/sh\n[ "$1" = -p ] && shift\nexec "$@"\n';
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
        fs.writeFileSync(path.join(bin, 'time'), TIME_STUB, { mode: 0o755 });
        const script = `${STUBS}\ntrue() { return ${trueStatus}; }\ncond() { return ${condStatus}; }\n${command}\nwait`;
        const container = oracleContainer();
        const r = container
            ? spawnSync('docker', ['exec', '-w', dir, '-e', `ACT_LOG=${log}`, '-e', `PATH=${bin}:/usr/local/bin:/usr/bin:/bin`, container, 'bash', '-c', script], { encoding: 'utf8', timeout: 20_000 })
            : spawnSync('bash', ['-c', script], { cwd: dir, env: { PATH: `${bin}${path.delimiter}${process.env['PATH'] ?? ''}`, ACT_LOG: log }, encoding: 'utf8', timeout: 10_000 });
        if (r.error || r.signal) throw new Error(`bash did not finish: ${String(r.error ?? r.signal)}`);
        return fs.readFileSync(log, 'utf8').split('\n').filter((l) => l !== '');
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}


/** Major version of the oracle's bash; the recogniser follows bash 5 where versions differ. */
export function oracleBashMajor(): number {
    return Number.parseInt(oracleBashVersion(), 10);
}

/** Whether the oracle's bash accepts `command` as syntax (`bash -n`). */
export function bashAccepts(command: string): boolean {
    const c = oracleContainer();
    const r = c ? spawnSync('docker', ['exec', c, 'bash', '-n', '-c', command], { encoding: 'utf8' }) : spawnSync('bash', ['-n', '-c', command], { encoding: 'utf8' });
    return r.status === 0;
}
