/**
 * Run every gate's `--self-test` — the gates are discovered, never listed.
 *
 * A self-test that exists and never runs is how three of them sat red on main
 * for weeks (road-to-checks-that-name-their-catch, B1). Discovery is a source
 * scan for a self-test harness call in a top-level `src/scripts/*.ts`, so a gate
 * gains coverage the moment it gains a self-test.
 *
 * Usage: run_gate_self_tests [--json <path>] [--only <gate,gate>] [--jobs <n>]
 * Exit: 0 every self-test passed · 1 at least one failed · 2 usage error.
 */
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const SCRIPTS_DIR = path.join(REPO_ROOT, 'src', 'scripts');
const SELF_TEST_CALL = /\brunSelfTest\s*\(/;
const TIMEOUT_MS = 180_000;

export interface SelfTestRun {
    gate: string;
    exit: number | null;
    signal: string | null;
    ms: number;
    tail: string;
}

/** Gate names (file stem) whose source calls the self-test harness. */
export function discoverSelfTestGates(scriptsDir: string = SCRIPTS_DIR): string[] {
    return fs
        .readdirSync(scriptsDir)
        .filter((f) => f.endsWith('.ts') && !f.endsWith('.d.ts') && !f.endsWith('.test.ts'))
        .filter((f) => SELF_TEST_CALL.test(fs.readFileSync(path.join(scriptsDir, f), 'utf-8')))
        .map((f) => f.slice(0, -3))
        .sort();
}

export function runOne(gate: string, root: string = REPO_ROOT): Promise<SelfTestRun> {
    const tsx = path.join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
    const started = Date.now();
    return new Promise((resolve) => {
        const child = spawn(tsx, [path.join(root, 'src', 'scripts', `${gate}.ts`), '--self-test'], {
            cwd: root,
            env: { ...process.env, GATE_SELF_TEST_CHILD: '' },
        });
        let out = '';
        const keep = (b: Buffer): void => {
            out = (out + b.toString('utf-8')).slice(-4000);
        };
        child.stdout.on('data', keep);
        child.stderr.on('data', keep);
        const timer = setTimeout(() => child.kill('SIGKILL'), TIMEOUT_MS);
        child.on('close', (code, signal) => {
            clearTimeout(timer);
            resolve({ gate, exit: code, signal, ms: Date.now() - started, tail: out.trim().split('\n').slice(-6).join('\n') });
        });
    });
}

export async function runAll(gates: readonly string[], jobs: number): Promise<SelfTestRun[]> {
    const results: SelfTestRun[] = [];
    let next = 0;
    const worker = async (): Promise<void> => {
        while (next < gates.length) {
            const gate = gates[next++]!;
            results.push(await runOne(gate));
        }
    };
    await Promise.all(Array.from({ length: Math.max(1, jobs) }, worker));
    return results.sort((a, b) => a.gate.localeCompare(b.gate));
}

async function main(argv: readonly string[]): Promise<number> {
    let values: { json?: string; only?: string; jobs?: string };
    try {
        ({ values } = parseArgs({
            args: [...argv],
            strict: true,
            options: { json: { type: 'string' }, only: { type: 'string' }, jobs: { type: 'string' } },
        }));
    } catch (e) {
        process.stderr.write(`run_gate_self_tests: ${(e as Error).message}\n`);
        return 2;
    }
    const all = discoverSelfTestGates();
    const gates = values.only ? values.only.split(',').filter((g) => all.includes(g)) : all;
    const jobs = values.jobs ? Number(values.jobs) : Math.max(1, os.cpus().length - 1);
    if (!Number.isInteger(jobs) || jobs < 1) {
        process.stderr.write('run_gate_self_tests: --jobs must be a positive integer\n');
        return 2;
    }
    const started = Date.now();
    const results = await runAll(gates, jobs);
    const failed = results.filter((r) => r.exit !== 0);
    for (const r of failed) {
        process.stdout.write(`❌  ${r.gate} (exit ${String(r.exit)}${r.signal ? `, ${r.signal}` : ''})\n${r.tail}\n\n`);
    }
    process.stdout.write(
        `scanned: ${String(results.length)}\n` +
            `${failed.length === 0 ? '✅' : '❌'}  ${String(results.length - failed.length)}/${String(results.length)} ` +
            `self-test(s) passed in ${String(Math.round((Date.now() - started) / 1000))} s on ${String(jobs)} job(s)\n`,
    );
    if (values.json) {
        fs.writeFileSync(values.json, `${JSON.stringify(results.map(({ tail: _t, ...r }) => r), null, 2)}\n`);
    }
    return failed.length === 0 ? 0 : 1;
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
    main(process.argv.slice(2)).then((c) => process.exit(c), (e) => {
        process.stderr.write(`run_gate_self_tests: ${String(e)}\n`);
        process.exit(2);
    });
}
