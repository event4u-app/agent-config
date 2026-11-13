// A run that outlives its timeout must end within the timeout plus a stated
// grace (roadmap road-to-a-package-measured-against-no-rules step 1.6).
//
// The confirmation run recorded two trials as `timeout after 180s` that took
// 915 s and 15,301 s: spawnSync sends one SIGTERM at the timeout and then blocks
// until the child exits, so a child that ignores or slowly handles SIGTERM — the
// docker client waiting on its container — holds the sweep. The fake CLIs below
// ignore SIGTERM on purpose.
import type { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { container_argv, stop_container } from '../../internal/bench/core/_lib/bench_ab_container.js';
import { run_live } from '../../internal/bench/core/bench_ab_task_runner.js';

const TIMEOUT_S = 1;
/** Stated grace: SIGKILL delivery plus the post-timeout container removal. */
const GRACE_S = 3;
/** How long the fake CLI would run if nothing stopped it. */
const HANG_S = 10;
const IMAGE = `sha256:${'d'.repeat(64)}`;

const dirs: string[] = [];
const saved = { CLAUDE_CLI: process.env['CLAUDE_CLI'], PATH: process.env['PATH'] };

function tmp(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ab-timeout-'));
    dirs.push(d);
    return d;
}

function script(dir: string, name: string, body: string): string {
    const p = path.join(dir, name);
    fs.writeFileSync(p, `#!/bin/sh\n${body}\n`, { mode: 0o755 });
    return p;
}

/** One argv per line, `--` between calls, so a path with a space cannot shift an index. */
function dockerCalls(log: string): string[][] {
    return fs.readFileSync(log, 'utf-8').split('--\n').filter(Boolean).map((c) => c.trim().split('\n'));
}

/** A fake `docker`: `run` does `runBody`, `rm` exits `rmStatus`; every call is logged. */
function fakeDocker(bin: string, log: string, runBody: string, rmStatus = 0): void {
    script(bin, 'docker', `printf '%s\\n' "$@" >> '${log}'\necho -- >> '${log}'\nif [ "$1" = run ]; then ${runBody}; fi\nif [ "$1" = rm ]; then exit ${rmStatus}; fi`);
    process.env['PATH'] = `${bin}${path.delimiter}${saved.PATH ?? ''}`;
}

const CTR = { image: IMAGE, token: 'sk-ant-oat01-abcdefghijklmnop' };
const nameOf = (call: string[] | undefined): string | undefined => call?.[call.indexOf('--name') + 1];

afterEach(() => {
    for (const [k, v] of [['CLAUDE_CLI', saved.CLAUDE_CLI], ['PATH', saved.PATH]] as const) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
    }
    for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

describe('run_live — the timeout holds', () => {
    it('a host CLI that ignores SIGTERM ends within the timeout plus the grace', () => {
        const bin = tmp();
        process.env['CLAUDE_CLI'] = script(bin, 'claude', `trap '' TERM\nexec sleep ${HANG_S}`);
        const t0 = Date.now();
        const run = run_live({ prompt: 'p' }, tmp(), TIMEOUT_S, {});
        const wall = (Date.now() - t0) / 1000;

        expect(run.reason).toBe(`timeout after ${TIMEOUT_S}s`);
        expect(run.errored).toBe(true);
        expect(wall).toBeLessThan(TIMEOUT_S + GRACE_S);
        expect(run.wall_time_seconds).toBeLessThan(TIMEOUT_S + GRACE_S);
    }, (HANG_S + 5) * 1000);

    it('a container run that outlives its timeout ends in time and its named container is removed', () => {
        const bin = tmp();
        const log = path.join(bin, 'docker.log');
        fakeDocker(bin, log, `trap '' TERM; exec sleep ${HANG_S}`);
        const t0 = Date.now();
        const run = run_live({ prompt: 'p' }, tmp(), TIMEOUT_S, { container: CTR });
        const wall = (Date.now() - t0) / 1000;

        expect(run.reason).toBe(`timeout after ${TIMEOUT_S}s`);
        expect(run.container_stopped).toBeUndefined();
        expect(wall).toBeLessThan(TIMEOUT_S + GRACE_S);
        const calls = dockerCalls(log);
        const name = nameOf(calls.find((c) => c[0] === 'run'));
        expect(name).toMatch(/^bench-ab-/);
        expect(calls).toContainEqual(['rm', '-f', name]);
    }, (HANG_S + 5) * 1000);

    it('a docker client killed for another reason also removes its container', () => {
        const bin = tmp();
        const log = path.join(bin, 'docker.log');
        fakeDocker(bin, log, 'kill -9 $$');
        run_live({ prompt: 'p' }, tmp(), 30, { container: CTR });

        const calls = dockerCalls(log);
        expect(calls).toContainEqual(['rm', '-f', nameOf(calls.find((c) => c[0] === 'run'))]);
    });

    it('a container that could not be removed is marked on the run', () => {
        const bin = tmp();
        const log = path.join(bin, 'docker.log');
        fakeDocker(bin, log, `trap '' TERM; exec sleep ${HANG_S}`, 1);
        const run = run_live({ prompt: 'p' }, tmp(), TIMEOUT_S, { container: CTR });

        expect(run.reason).toBe(`timeout after ${TIMEOUT_S}s`);
        expect(run.container_stopped).toBe(false);
    }, (HANG_S + 5) * 1000);

    it('a run that finishes inside its timeout is not cut off, is named, and removes nothing', () => {
        const bin = tmp();
        const log = path.join(bin, 'docker.log');
        fakeDocker(bin, log, `echo '{"type":"result","result":"ok","usage":{}}'`);
        const run = run_live({ prompt: 'p' }, tmp(), 30, { container: CTR });

        expect(run.reason).not.toMatch(/timeout/);
        const calls = dockerCalls(log);
        expect(nameOf(calls.find((c) => c[0] === 'run'))).toMatch(/^bench-ab-/);
        expect(calls.some((c) => c[0] === 'rm')).toBe(false);
    });
});

describe('container naming and removal', () => {
    it('container_argv names the container only when a name is given', () => {
        expect(container_argv({ image: IMAGE }, '/c', ['--print'])).not.toContain('--name');
        const argv = container_argv({ image: IMAGE, name: 'bench-ab-x1' }, '/c', ['--print']);
        expect(argv[argv.indexOf('--name') + 1]).toBe('bench-ab-x1');
        expect(argv.indexOf('--name')).toBeLessThan(argv.indexOf(IMAGE));
    });

    it('stop_container force-removes by name and reports a failure instead of throwing', () => {
        const seen: string[][] = [];
        const ok = stop_container('bench-ab-x1', ((cmd: string, args: string[]) => {
            seen.push([cmd, ...args]);
            return { status: 0 };
        }) as unknown as typeof spawnSync);
        expect(ok).toBe(true);
        expect(seen).toEqual([['docker', 'rm', '-f', 'bench-ab-x1']]);
        expect(stop_container('y', (() => ({ status: 1 })) as unknown as typeof spawnSync)).toBe(false);
    });
});
