/**
 * Self-test harness — a gate proving, on demand, that its rejections fire.
 *
 * WHY. Every gate in this tree has fixtures in `tests/`, and those fixtures run
 * in CI on the test job. That leaves one gap: nothing proves the gate binary a
 * contributor actually invokes still rejects anything. A gate whose detection
 * silently stopped matching — a regex that no longer fires, a scan root that
 * moved, a suppression that widened — passes its unit tests against imported
 * functions while the CLI it ships reports clean forever.
 *
 * `--self-test` closes that: the gate builds known-bad fixtures in a temporary
 * directory and invokes ITSELF against them, asserting each rejection fires.
 *
 * **The floor is the load-bearing part.** A self-test is itself a checker, so a
 * truncated case list must fail rather than print success — otherwise deleting
 * cases is the cheapest way to a green self-test. {@link runSelfTest} refuses
 * to pass below its declared minimum, and the minimum is a constant in the
 * gate's own source where a reviewer sees it change.
 *
 * **Gaming risk.** The obvious degenerate pass is a case whose `expect` is
 * `accept` and whose fixture is empty — it asserts nothing and still counts
 * toward the floor. Mitigated by requiring at least one `reject` case and by
 * counting reject cases separately in the floor check; the residual is that no
 * harness can judge whether a fixture is *representative*, which stays a human
 * read at review time.
 */
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import process from 'node:process';

/**
 * Invoke a gate's real CLI against a fixture.
 *
 * Deliberately shells out rather than calling `main()` in-process: the thing
 * under test is the binary a contributor runs, including its argv parsing and
 * its entry guard. An in-process call would skip exactly the layers that have
 * silently no-opped in this repository before.
 */
export function runGateCli(
    repoRoot: string,
    scriptRelPath: string,
    args: readonly string[],
    cwd: string,
): number {
    const tsx = path.join(
        repoRoot,
        'node_modules',
        '.bin',
        process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
    );
    const res = spawnSync(tsx, [path.join(repoRoot, scriptRelPath), ...args], {
        cwd,
        encoding: 'utf-8',
        maxBuffer: 64 * 1024 * 1024,
        // The child must not recurse into its own self-test.
        env: { ...process.env, GATE_SELF_TEST_CHILD: '1' },
    });
    lastGateOutput = `${res.stdout ?? ''}${res.stderr ?? ''}`;
    // A signal, a timeout or a spawn failure leaves `status` null; a signal
    // that kills the gate under the tsx wrapper surfaces as 128+N instead.
    // Either is the harness failing, never the gate rejecting — reading it as
    // exit 1 let a crashed child count as a catch.
    if (res.status === null || res.status >= SIGNAL_EXIT_BASE) return HARNESS_ERROR;
    return res.status;
}

/**
 * Exit code {@link runGateCli} returns when the child produced no exit status
 * (killed by a signal, timed out, failed to spawn). Negative so no gate can
 * ever emit it; {@link runSelfTest} reports it as a harness error.
 */
export const HARNESS_ERROR = -1;

/** Shell convention: a process killed by signal N exits 128+N. No gate uses these codes. */
const SIGNAL_EXIT_BASE = 128;

let lastGateOutput: string | null = null;

/** The trailer Node prints after an uncaught exception's stack. */
const UNCAUGHT_CRASH = /^Node\.js v\d+\.\d+/m;

/** Combined stdout+stderr of the most recent {@link runGateCli} call, or null. */
export function lastGateCliOutput(): string | null {
    return lastGateOutput;
}

/**
 * The exit codes a gate means by "found something" and "could not run". Optional:
 * a gate that declares it lets the harness tell a catch from a usage error.
 * No gate has to change its codes to declare them.
 */
export interface GateExitDialect {
    finding: number;
    cannot_run: number;
}

/** Exit code a `refuse` case expects when the gate declares no dialect. */
export const DEFAULT_CANNOT_RUN = 2;

export interface SelfTestCase {
    /** Short description, printed per case. */
    name: string;
    /**
     * `reject` — the gate must report a finding on this fixture. `accept` — it
     * must pass. `refuse` — it must decline to run (dead scope, bad argv,
     * unreadable input), which is not the same verdict as a finding.
     */
    expect: 'reject' | 'accept' | 'refuse';
    /** Runs the fixture and returns the gate's exit code. */
    run: () => number;
    /**
     * What the gate must say it caught. Matched against the output of the
     * {@link runGateCli} call this case made; a reject that exits non-zero for
     * another reason no longer counts.
     */
    names?: RegExp;
}

export interface SelfTestOptions {
    gate: string;
    cases: readonly SelfTestCase[];
    /**
     * The gate's declared exit dialect. When present, a `reject` case must exit
     * with `finding` and a `refuse` case with `cannot_run`; when absent, any
     * non-zero exit is a reject and `refuse` expects {@link DEFAULT_CANNOT_RUN}.
     */
    exit?: GateExitDialect;
    /** Minimum total cases. Below this, the run FAILS regardless of results. */
    minCases: number;
    /** Minimum `reject` or `refuse` cases. A suite that only proves passes proves nothing. */
    minRejectCases?: number;
    write?: (chunk: string) => unknown;
}

/**
 * Run a gate's self-test suite.
 *
 * @returns process exit code — 0 when every case behaved and the floor held.
 */
export function runSelfTest(opts: SelfTestOptions): number {
    const write = opts.write ?? process.stdout.write.bind(process.stdout);
    const minReject = opts.minRejectCases ?? 1;
    // A refusal proves discrimination exactly as a finding does: both are the
    // gate declining to pass. The floor counts every case that must not pass.
    const rejectCases = opts.cases.filter((c) => c.expect !== 'accept').length;

    if (opts.cases.length < opts.minCases || rejectCases < minReject) {
        write(
            `❌  ${opts.gate} --self-test: ${String(opts.cases.length)} case(s) ` +
                `(${String(rejectCases)} rejecting) is below the declared floor of ` +
                `${String(opts.minCases)} (${String(minReject)} rejecting). A truncated self-test ` +
                'must fail rather than print success — deleting cases is otherwise the cheapest ' +
                'route to a green one.\n',
        );
        return 1;
    }

    let failed = 0;
    for (const testCase of opts.cases) {
        let exit: number;
        lastGateOutput = null;
        try {
            exit = testCase.run();
        } catch (e) {
            write(`❌  ${opts.gate} --self-test: ${testCase.name} — threw: ${String(e)}\n`);
            failed += 1;
            continue;
        }
        const verdict = judgeCase(testCase, exit, opts.exit, lastGateOutput);
        if (verdict === null) {
            write(`✅  ${testCase.name} (expected ${testCase.expect}, exit ${String(exit)})\n`);
        } else {
            write(`❌  ${testCase.name}: ${verdict}\n`);
            failed += 1;
        }
    }

    write(
        `\n${opts.gate} --self-test: ${String(opts.cases.length - failed)}/${String(opts.cases.length)} ` +
            `case(s) behaved (${String(rejectCases)} rejecting, floor ${String(opts.minCases)})\n`,
    );
    return failed > 0 ? 1 : 0;
}

/**
 * Decide whether one case behaved. Returns null when it did, otherwise the
 * reason it did not. Exported for the harness's own tests.
 */
export function judgeCase(
    testCase: Pick<SelfTestCase, 'expect' | 'names'>,
    exit: number,
    dialect: GateExitDialect | undefined,
    output: string | null,
): string | null {
    if (exit === HARNESS_ERROR) {
        return 'harness error: no exit status (signal/timeout) — a crash is never a catch';
    }
    if (output !== null && UNCAUGHT_CRASH.test(output)) {
        return 'harness error: uncaught exception — a crash is never a catch';
    }
    let behaved: boolean;
    if (testCase.expect === 'accept') behaved = exit === 0;
    else if (testCase.expect === 'refuse') behaved = exit === (dialect?.cannot_run ?? DEFAULT_CANNOT_RUN);
    else behaved = dialect !== undefined ? exit === dialect.finding : exit !== 0;
    if (!behaved) {
        return `expected ${testCase.expect}, got exit ${String(exit)}`;
    }
    if (testCase.names !== undefined) {
        if (output === null) {
            return '`names` set but no gate output captured';
        }
        if (!testCase.names.test(output)) {
            return `did not name its catch: ${String(testCase.names)}`;
        }
    }
    return null;
}
