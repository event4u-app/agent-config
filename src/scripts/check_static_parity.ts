/**
 * check_static_parity — prove that static operation is unregressed by the
 * collector (`road-to-supervised-telemetry-collector` step 4.2, AC-7).
 *
 * The Goal of the governance roadmap says static operation still works.
 * Nothing tested it. This does, and the step's `verify:` is exact about how:
 *
 * > the existing suite passes with the collector absent AND with it
 * > present-but-off, and the two results are COMPARED rather than each declared
 * > green.
 *
 * Two green runs are not the assertion. Two runs whose per-test verdicts are
 * IDENTICAL is, and the difference is the whole point: a suite that passes both
 * times while a test silently changed from pass to skip has regressed static
 * operation in the one way "both green" cannot see.
 *
 * ## What "absent" means here
 *
 * Not a disabled flag. Run B aliases `collector_denominator` to
 * `tests/_lib/collector-absent-stub.ts`, so `dispatch_hook` resolves a module
 * that does nothing and the real one is never loaded. Run A is the real module
 * with no opt-in marker — present, and off.
 *
 * ## Why the parity set is scoped, and why that is not a dodge
 *
 * The collector's ENTIRE contact with the rest of the tree is one call in
 * `dispatch_hook.main`. A test that never reaches that function cannot diverge
 * between the two runs, because nothing differs on the path it takes. So the
 * parity set is *every test file that reaches the dispatcher*, discovered by
 * grep rather than by a hand-maintained list — and the discovery is printed, so
 * a reader can check the denominator of the claim instead of trusting it.
 *
 * The honest limit, stated rather than implied: this proves parity for the
 * dispatcher surface. It does not prove that the whole suite is byte-identical
 * under both runs, and it is not evidence about a future collector call site
 * placed somewhere else. Adding one is what re-runs the grep.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { reportScanned } from './_lib/scan_scope.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');

// The alias itself lives in `vitest.config.ts` — it has to, because vitest reads
// its resolver config at startup and this process only sets the environment
// variable that switches it on. The two paths involved are
// `src/scripts/_lib/collector_denominator.ts` and
// `tests/_lib/collector-absent-stub.ts`; naming them again here as constants
// would be a second source of truth that nothing reads.

/** Where the two runs' JSON reports land. */
function reportPath(tag: string): string {
    return path.join(os.tmpdir(), `static-parity-${tag}-${process.pid}.json`);
}

export interface TestVerdict {
    readonly name: string;
    readonly status: string;
}

export interface RunResult {
    readonly verdicts: readonly TestVerdict[];
    readonly exitCode: number;
}

/**
 * Every test file that reaches `dispatch_hook`.
 *
 * Discovered, never listed: a hand-written set goes stale the first time a test
 * file is added, and a stale parity set reports parity over the wrong
 * population.
 */
export function parityFiles(repo: string = REPO): string[] {
    const grep = spawnSync(
        'grep',
        ['-rl', '--include=*.test.ts', 'dispatch_hook', 'tests', 'src'],
        { cwd: repo, encoding: 'utf8' },
    );
    if (grep.status !== 0 && grep.status !== 1) {
        throw new Error(`check_static_parity: grep failed (${grep.status}): ${grep.stderr}`);
    }
    return grep.stdout
        .split('\n')
        .filter((line) => line.length > 0)
        .sort();
}

/** Compare two verdict sets, returning the differences in a stable order. */
export function compare(
    a: readonly TestVerdict[],
    b: readonly TestVerdict[],
): string[] {
    const byName = (list: readonly TestVerdict[]): Map<string, string> =>
        new Map(list.map((v) => [v.name, v.status]));
    const left = byName(a);
    const right = byName(b);
    const differences: string[] = [];

    for (const [name, status] of left) {
        if (!right.has(name)) {
            differences.push(`present-but-off only: ${name} (${status})`);
            continue;
        }
        const other = right.get(name) as string;
        if (other !== status) {
            differences.push(`${name}: present-but-off=${status} · absent=${other}`);
        }
    }
    for (const [name, status] of right) {
        if (!left.has(name)) differences.push(`absent only: ${name} (${status})`);
    }
    return differences.sort();
}

function readVitestJson(file: string): TestVerdict[] {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as {
        testResults?: { name?: string; assertionResults?: { fullName?: string; status?: string }[] }[];
    };
    const verdicts: TestVerdict[] = [];
    for (const suite of raw.testResults ?? []) {
        for (const assertion of suite.assertionResults ?? []) {
            verdicts.push({
                name: `${path.relative(REPO, suite.name ?? '')} › ${assertion.fullName ?? ''}`,
                status: assertion.status ?? 'unknown',
            });
        }
    }
    return verdicts.sort((x, y) => (x.name < y.name ? -1 : x.name > y.name ? 1 : 0));
}

function runSuite(tag: string, files: string[], aliasStub: boolean): RunResult {
    const report = reportPath(tag);
    fs.rmSync(report, { force: true });

    const env = { ...process.env };
    if (aliasStub) env.AGENT_CONFIG_COLLECTOR_ABSENT = '1';

    const result = spawnSync(
        path.join(REPO, 'node_modules', '.bin', 'vitest'),
        [
            'run',
            ...files,
            '--reporter=json',
            `--outputFile=${report}`,
        ],
        { cwd: REPO, encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'pipe'] },
    );

    if (!fs.existsSync(report)) {
        throw new Error(
            `check_static_parity: run '${tag}' produced no report.\n`
                + `${result.stdout ?? ''}\n${result.stderr ?? ''}`,
        );
    }
    const verdicts = readVitestJson(report);
    fs.rmSync(report, { force: true });
    return { verdicts, exitCode: result.status ?? 1 };
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    const quiet = argv.includes('--quiet');
    const files = parityFiles();

    // Publishes the count AND asserts it is non-zero, in one call, so the number
    // printed is by construction the number that was validated. No `allowEmpty`
    // reason: an empty parity set here is a broken discovery, never a clean bill
    // of health — a gate that scans nothing exits green, and this one would
    // compare two suites of zero tests and report them identical.
    try {
        reportScanned({
            gate: 'check_static_parity',
            scanned: files.length,
            units: 'test file(s) reaching the dispatcher',
            roots: ['tests', 'src'],
        });
    } catch (err) {
        process.stderr.write(`${(err as Error).message}\n`);
        return 1;
    }

    if (!quiet) {
        process.stdout.write(`check_static_parity: ${files.length} file(s) reach the dispatcher\n`);
        for (const file of files) process.stdout.write(`  · ${file}\n`);
    }

    const present = runSuite('present-off', files, false);
    const absent = runSuite('absent', files, true);

    const differences = compare(present.verdicts, absent.verdicts);

    process.stdout.write(
        `\npresent-but-off: ${present.verdicts.length} test(s), exit ${present.exitCode}\n`
            + `absent:          ${absent.verdicts.length} test(s), exit ${absent.exitCode}\n`,
    );

    if (present.verdicts.length === 0) {
        process.stderr.write('❌  the present-but-off run reported zero tests — nothing was compared\n');
        return 1;
    }
    if (present.exitCode !== 0 || absent.exitCode !== 0) {
        process.stderr.write('❌  one of the two runs is red; parity over a red suite proves nothing\n');
        return 1;
    }
    if (differences.length > 0) {
        process.stderr.write(`❌  ${differences.length} divergence(s) between the two runs:\n`);
        for (const line of differences) process.stderr.write(`  · ${line}\n`);
        return 1;
    }

    process.stdout.write('✅  static operation is unregressed — per-test verdicts are identical\n');
    return 0;
}

const invokedDirectly =
    process.argv[1] !== undefined && process.argv[1].includes('check_static_parity');
if (invokedDirectly) {
    process.exitCode = main();
}
