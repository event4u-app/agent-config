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
    return res.status ?? 1;
}

export interface SelfTestCase {
    /** Short description, printed per case. */
    name: string;
    /** `reject` — the gate must fail on this fixture. `accept` — it must pass. */
    expect: 'reject' | 'accept';
    /** Runs the fixture and returns the gate's exit code. */
    run: () => number;
}

export interface SelfTestOptions {
    gate: string;
    cases: readonly SelfTestCase[];
    /** Minimum total cases. Below this, the run FAILS regardless of results. */
    minCases: number;
    /** Minimum `reject` cases. A suite that only proves passes proves nothing. */
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
    const rejectCases = opts.cases.filter((c) => c.expect === 'reject').length;

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
        try {
            exit = testCase.run();
        } catch (e) {
            write(`❌  ${opts.gate} --self-test: ${testCase.name} — threw: ${String(e)}\n`);
            failed += 1;
            continue;
        }
        const behaved = testCase.expect === 'reject' ? exit !== 0 : exit === 0;
        if (behaved) {
            write(`✅  ${testCase.name} (expected ${testCase.expect}, exit ${String(exit)})\n`);
        } else {
            write(
                `❌  ${testCase.name}: expected the gate to ${testCase.expect} this fixture, ` +
                    `got exit ${String(exit)}. The gate's detection has stopped firing on a case ` +
                    'it is supposed to catch.\n',
            );
            failed += 1;
        }
    }

    write(
        `\n${opts.gate} --self-test: ${String(opts.cases.length - failed)}/${String(opts.cases.length)} ` +
            `case(s) behaved (${String(rejectCases)} rejecting, floor ${String(opts.minCases)})\n`,
    );
    return failed > 0 ? 1 : 0;
}
