#!/usr/bin/env tsx
/**
 * Gate — every registered evaluator emits output conforming to
 * `evaluator-output.schema.json`, over recorded verifier fixtures.
 *
 * Ships in the SAME change as the schema on purpose: the estate's standing
 * constraint is that a convention without a machine backstop is dead text, so a
 * schema landing without its check would be exactly the failure the roadmap's
 * Risk-Register rank-5 names.
 *
 * WHY FIXTURES RATHER THAN LIVE RUNS. The adapters are pure functions from a
 * verifier's captured `{stdout, stderr, exitCode}` to the contract shape, so the
 * mapping — the part that can be wrong — is fully exercised without re-running
 * three verifiers CI already runs once. Running them here would double their CI
 * cost to test code that never touches them. `--live` re-records nothing and is
 * not offered: a fixture that drifts from its verifier is caught by that
 * verifier's own gate changing shape, which is a review event, not a silent one.
 *
 * The corpus is (evaluator x fixture) pairs, and it includes deliberately RED
 * and DEGRADED fixtures — a gate that only ever sees green output cannot tell a
 * working mapping from one that hardcodes success.
 *
 * Exit codes:
 *   0 — every pair conforms and every expectation holds
 *   1 — one or more pairs violate the schema or their expected reading
 *   2 — the gate could not run (fixture directory missing or empty)
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import * as os from 'node:os';

import { EVALUATORS, validateEvaluatorOutput, type RawRun } from './_lib/evaluator_contract.js';
import { GateLedger } from './_lib/gate_ledger.js';
import { runGateCli, runSelfTest } from './_lib/gate_self_test.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const FIXTURE_DIR = path.join(process.cwd(), 'tests', 'fixtures', 'evaluator-output');

/** What each fixture flavour must read as, so a green-only corpus cannot pass. */
const EXPECTED: Readonly<Record<string, { pass: boolean; metric_state: string }>> = {
    green: { pass: true, metric_state: 'present' },
    red: { pass: false, metric_state: 'present' },
    degraded: { pass: true, metric_state: 'unreadable' },
};

function readRun(name: string, flavour: string): RawRun | null {
    const base = path.join(FIXTURE_DIR, `${name}.${flavour}`);
    if (!fs.existsSync(`${base}.stdout`)) return null;
    return {
        stdout: fs.readFileSync(`${base}.stdout`, 'utf-8'),
        stderr: fs.existsSync(`${base}.stderr`) ? fs.readFileSync(`${base}.stderr`, 'utf-8') : '',
        exitCode: fs.existsSync(`${base}.exit`)
            ? Number(fs.readFileSync(`${base}.exit`, 'utf-8').trim())
            : 0,
    };
}

/**
 * `--self-test` — prove, from the shipped binary, that the rejections still fire.
 *
 * Each case builds a throwaway tree holding only a fixture directory and runs
 * this gate against it with `cwd` pointing there, so the cases exercise the CLI
 * a contributor actually invokes rather than an imported function.
 */
function selfTest(): number {
    const mk = (files: Record<string, string>): string => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ces-selftest-'));
        const dir = path.join(root, 'tests', 'fixtures', 'evaluator-output');
        fs.mkdirSync(dir, { recursive: true });
        for (const [rel, body] of Object.entries(files)) {
            fs.writeFileSync(path.join(dir, rel), body, 'utf-8');
        }
        return root;
    };
    const run = (root: string): number =>
        runGateCli(REPO_ROOT, 'src/scripts/check_evaluator_schema.ts', ['--quiet'], root);

    const GREEN_FM = '\n== Frontmatter schema: 437 artefacts, 0 failing, 0 with warnings ==\n';

    return runSelfTest({
        gate: 'check_evaluator_schema',
        minCases: 4,
        minRejectCases: 3,
        cases: [
            {
                name: 'a conformant green fixture passes',
                expect: 'accept',
                run: () =>
                    run(
                        mk({
                            'validate_frontmatter.green.stdout': GREEN_FM,
                            'validate_frontmatter.green.exit': '0\n',
                        }),
                    ),
            },
            {
                name: 'a green fixture with no parseable count is rejected — unreadable is not present',
                expect: 'reject',
                run: () =>
                    run(
                        mk({
                            'validate_frontmatter.green.stdout': 'done, nothing to report\n',
                            'validate_frontmatter.green.exit': '0\n',
                        }),
                    ),
            },
            {
                name: 'a red fixture that exits 0 is rejected — pass must follow the exit code',
                expect: 'reject',
                run: () =>
                    run(
                        mk({
                            'validate_frontmatter.red.stdout':
                                '\n== Frontmatter schema: 437 artefacts, 3 failing, 0 with warnings ==\n',
                            'validate_frontmatter.red.exit': '0\n',
                        }),
                    ),
            },
            {
                name: 'an empty fixture directory is rejected — a gate that scanned nothing has verified nothing',
                expect: 'reject',
                run: () => run(mk({})),
            },
        ],
    });
}

function main(argv?: readonly string[]): number {
    const args = argv ?? process.argv.slice(2);
    if (args.includes('--self-test')) return selfTest();
    const quiet = args.includes('--quiet');
    const problems: string[] = [];
    let scanned = 0;

    if (!fs.existsSync(FIXTURE_DIR)) {
        process.stderr.write(
            `❌  check_evaluator_schema: fixture directory absent (${FIXTURE_DIR}) — the gate cannot run\n`,
        );
        return 2;
    }

    // Every (evaluator x flavour) pair is PLANNED before the loop, so a pair
    // that falls through without a terminal outcome is a finalize() throw rather
    // than a silently smaller denominator. A missing fixture is a real skip with
    // a named reason, never an invisible `continue`.
    const ledger = new GateLedger('check_evaluator_schema');
    const flavours = Object.keys(EXPECTED);
    ledger.plan(EVALUATORS.flatMap((a) => flavours.map((f) => `${a.name}.${f}`)));

    for (const adapter of EVALUATORS) {
        for (const flavour of flavours) {
            const pair = `${adapter.name}.${flavour}`;
            const raw = readRun(adapter.name, flavour);
            if (raw === null) {
                ledger.skip(pair, 'no_applicable_files');
                continue;
            }
            scanned += 1;

            let out;
            try {
                out = adapter.parse(raw);
            } catch (exc) {
                problems.push(`${pair}: adapter threw — ${String(exc)}`);
                ledger.fail(pair, 'adapter threw');
                continue;
            }
            const before = problems.length;

            for (const v of validateEvaluatorOutput(out)) {
                problems.push(`${pair}: schema — ${v}`);
            }

            const want = EXPECTED[flavour]!;
            if (out.pass !== want.pass) {
                problems.push(`${pair}: pass is ${out.pass}, fixture asserts ${want.pass}`);
            }
            if (out.metric_state !== want.metric_state) {
                problems.push(
                    `${pair}: metric_state is ${String(out.metric_state)}, fixture asserts ${want.metric_state}`,
                );
            }
            // The higher-is-better invariant is the one a consumer relies on
            // without checking, so it is asserted rather than documented.
            if (out.metric_state === 'present' && out.direction === 'minimize') {
                if (out.score !== -(out.metric ?? NaN)) {
                    problems.push(
                        `${pair}: score ${out.score} is not the negation of metric ${String(out.metric)}`,
                    );
                }
            }

            if (problems.length > before) {
                ledger.fail(pair, `${String(problems.length - before)} violation(s)`);
            } else {
                ledger.complete(pair);
            }
        }
    }

    ledger.finalize();

    if (scanned === 0) {
        process.stderr.write(
            `❌  check_evaluator_schema: 0 evaluator/fixture pairs found — a gate that scanned nothing has not verified anything\n`,
        );
        return 2;
    }

    process.stderr.write(`scanned: ${scanned}\n`);

    if (problems.length > 0) {
        process.stdout.write(
            `❌  check_evaluator_schema: ${problems.length} violation(s) across ${scanned} pair(s)\n\n`,
        );
        for (const p of problems) process.stdout.write(`  ${p}\n`);
        process.stdout.write(`\nContract: docs/contracts/evaluator-output.md\n`);
        return 1;
    }

    if (!quiet) {
        process.stdout.write(
            `✅  check_evaluator_schema: ${scanned} evaluator/fixture pair(s) conform, ${EVALUATORS.length} evaluator(s) registered.\n`,
        );
    }
    return 0;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) return true;
    try {
        return (
            fs.realpathSync(fileURLToPath(import.meta.url)) ===
            fs.realpathSync(path.resolve(process.argv[1]))
        );
    } catch {
        return false;
    }
}

if (_isCliEntry() || process.argv[1] === _HERE) {
    process.exit(main());
}

export { main };
