/**
 * The failure corpus for `lint_agent_security` — road-to-scan-that-fails-closed
 * Phase 2.1, then the red half of Phase 2.2.
 *
 * WHY THIS FILE EXISTS. The umbrella spawns five child linters and throws away
 * every child's exit code, while an unparsable child stdout becomes zero
 * findings. A child that crashed, failed to spawn, or printed a stack trace is
 * therefore indistinguishable from a child that ran and found nothing: the
 * aggregate prints its clean line and exits 0. That exit code is what
 * `docs/CLAIMS.md` offers as evidence that every shipped artifact is scanned.
 *
 * THE FOUR CASES, and the fourth is not like the others:
 *
 *   a. exit non-zero, empty stdout        — the child answered with nothing
 *   b. exit 0, unparsable stdout          — the child answered with garbage
 *   c. never spawned (`status === null`)  — the child did not answer at all
 *   d. exit non-zero, VALID findings      — NEGATIVE CONTROL
 *
 * (d) is the one that must not move. A child linter legitimately exits 1 when
 * it finds something; reading that as "the run failed" would convert every real
 * finding into a run failure and lose the finding text. It is green before the
 * repair and green after, and it is the assertion that stops the repair from
 * being implemented as "non-zero child ⇒ umbrella failure".
 *
 * STATE OF THIS FILE: POST-REPAIR (Phase 2.2). Cases a, b, c and c2 were first
 * written asserting the fail-OPEN — the aggregate exiting 0 while a child did
 * not answer — and were GREEN in that state, which is what makes them a
 * reproduction rather than a description of a fix. Commit b4bed8c56 carries
 * that state; this commit flips those four to the fail-closed expectations.
 * (d) and the all-clean case did not move in either direction, which is the
 * only evidence that the repair did not simply make every non-zero child a
 * failure.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { main, SKIP_REASONS, type ChildRunResult, type ChildRunner } from '../../src/scripts/lint_agent_security.js';
import { runInProc } from '../_lib/run_in_process.js';
import type { ProbeResult } from '../../src/scripts/_lib/counted_probe.js';

/** A child that completed cleanly: exit 0, an empty findings array. */
function clean(): ProbeResult {
    return { ok: true, stdout: '[]', stderr: 'scanned: 100\n', status: 0, failure: null };
}

/** The child under test, keyed by script name; every other child is clean. */
function runnerFor(script: string, result: ChildRunResult): ChildRunner {
    return (s) => (s === script ? result : clean());
}

function run(runChild: ChildRunner) {
    return runInProc((argv: string[]) => main(argv, { runChild }), []);
}

/** The single blocking finding shape the child linters emit. */
const BLOCKING_FINDING = JSON.stringify([
    {
        path: 'src/skills/x/SKILL.md',
        line: 12,
        check: 'instruction-smuggling',
        severity: 'HIGH',
        message: 'disclosure-suppression imperative in prose',
        weight: 1.0,
    },
]);

describe('lint_agent_security — a child that fails to answer cannot produce an aggregate pass', () => {
    it('(a) exit non-zero with empty stdout is a run failure naming the child', () => {
        const r = run(runnerFor('lint_confusables.ts', { ok: false, stdout: '', stderr: '', status: 3, failure: 'exited 3' }));
        expect(r.status, r.stdout + r.stderr).toBe(1);
        expect(r.stdout).toContain('mixed-script-confusable: did not complete');
        expect(r.stdout).toContain('1 of 5 child linter(s) did not complete');
        expect(r.stdout).not.toContain('clean (0 blocking');
    });

    it('(b) exit 0 with unparsable stdout is a run failure naming the child', () => {
        const r = run(
            runnerFor('lint_hidden_unicode.ts', {
                ok: true,
                stdout: 'Traceback (most recent call last):\n  File "x"\n',
                stderr: '',
                status: 0,
                failure: null,
            }),
        );
        expect(r.status, r.stdout + r.stderr).toBe(1);
        expect(r.stdout).toContain('hidden-unicode: did not complete');
        expect(r.stdout).toContain('stdout was not JSON');
    });

    it('(c) a child that never spawned is a run failure naming the child', () => {
        const r = run(
            runnerFor('lint_mcp_config_security.ts', {
                ok: false,
                stdout: '',
                stderr: '',
                status: null,
                failure: 'spawn ENOENT',
            }),
        );
        expect(r.status, r.stdout + r.stderr).toBe(1);
        expect(r.stdout).toContain('mcp-config-security: did not complete');
        expect(r.stdout).toContain('never ran (spawn ENOENT)');
    });

    it('(c2) a child whose stdout is valid JSON but not an array is a run failure', () => {
        // The old parse accepted any JSON and then discarded a non-array as
        // zero findings — the same silent-zero as (b), one layer down.
        const r = run(
            runnerFor('lint_skill_frontmatter_safety.ts', {
                ok: true,
                stdout: '{"error":"boom"}',
                stderr: '',
                status: 0,
                failure: null,
            }),
        );
        expect(r.status, r.stdout + r.stderr).toBe(1);
        expect(r.stdout).toContain('dangerous-frontmatter: did not complete');
        expect(r.stdout).toContain('not a findings array');
    });

    it('(d) NEGATIVE CONTROL — exit non-zero WITH valid findings stays findings, not a run failure', () => {
        const r = run(
            runnerFor('lint_instruction_smuggling.ts', {
                ok: false,
                stdout: BLOCKING_FINDING,
                stderr: 'scanned: 100\n',
                status: 1,
                failure: 'exited 1',
            }),
        );
        // Exit 1 either way — but for the FINDING reason, with the finding
        // count in the message, never the run-failure wording.
        expect(r.status, r.stdout + r.stderr).toBe(1);
        expect(r.stdout).toContain('1 blocking finding(s)');
        expect(r.stdout).not.toMatch(/did not complete/i);
    });

    it('all five children completing cleanly still passes', () => {
        const r = run(() => clean());
        expect(r.status, r.stdout + r.stderr).toBe(0);
        expect(r.stdout).toContain('clean (0 blocking');
    });

    it('a skip is a legal non-failing terminal state, and it is never silent', () => {
        // No child produces a skip today. This exercises the third state through
        // the runner seam so the branch is not dead code, and pins the two
        // properties that make it safe to have: it does not fail the aggregate,
        // and it prints the child and the reason rather than passing quietly.
        const r = run(runnerFor('lint_confusables.ts', { skipped: SKIP_REASONS.PLATFORM_NOT_APPLICABLE }));
        expect(r.status, r.stdout + r.stderr).toBe(0);
        expect(r.stdout).toContain('mixed-script-confusable: skipped — not applicable on this platform');
        expect(r.stdout).toContain('clean (0 blocking');
    });
});

describe('lint_agent_security — SARIF carries execution state in its own invocation objects', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lint-agent-sec-sarif-'));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    interface Sarif {
        runs: Array<{
            invocations: Array<{ commandLine: string; executionSuccessful: boolean; exitCode?: number }>;
            results: unknown[];
        }>;
    }

    function sarifFor(runChild: ChildRunner): Sarif {
        const out = path.join(tmp, 'r.sarif');
        runInProc((argv: string[]) => main(argv, { runChild }), ['--sarif', out]);
        return JSON.parse(fs.readFileSync(out, 'utf-8')) as Sarif;
    }

    it('a deliberately broken child has executionSuccessful false; the others true', () => {
        const sarif = sarifFor(
            runnerFor('lint_hidden_unicode.ts', { ok: false, stdout: '', stderr: '', status: 2, failure: 'exited 2' }),
        );
        const invocations = sarif.runs[0]!.invocations;
        expect(invocations).toHaveLength(5);
        const broken = invocations.find((i) => i.commandLine.includes('lint_hidden_unicode.ts'));
        expect(broken?.executionSuccessful).toBe(false);
        expect(broken?.exitCode).toBe(2);
        for (const i of invocations.filter((x) => !x.commandLine.includes('lint_hidden_unicode.ts'))) {
            expect(i.executionSuccessful, i.commandLine).toBe(true);
            expect(i.exitCode, i.commandLine).toBe(0);
        }
    });

    it('a child that never ran reports executionSuccessful false and omits exitCode', () => {
        // SARIF `exitCode` is an integer; there is no exit code when the process
        // never started, and inventing 1 there would assert a run that did not
        // happen — the same substitution this whole repair removes.
        const sarif = sarifFor(
            runnerFor('lint_confusables.ts', { ok: false, stdout: '', stderr: '', status: null, failure: 'spawn ENOENT' }),
        );
        const never = sarif.runs[0]!.invocations.find((i) => i.commandLine.includes('lint_confusables.ts'));
        expect(never?.executionSuccessful).toBe(false);
        expect(never && 'exitCode' in never).toBe(false);
    });

    it('an all-clean run reports every invocation successful', () => {
        const sarif = sarifFor(() => clean());
        expect(sarif.runs[0]!.invocations.every((i) => i.executionSuccessful)).toBe(true);
    });
});
