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
 * STATE OF THIS FILE: PRE-REPAIR (Phase 2.1). Cases a, b, c and c2 currently
 * assert the fail-OPEN — the aggregate exits 0 while a child did not answer —
 * and they are green, which is what makes them a reproduction rather than a
 * description of a fix that has not happened yet. Phase 2.2 flips those four to
 * the fail-closed expectations; (d) and the all-clean case do not move. The
 * history of this file therefore carries both states, which is the only way a
 * later reader can tell a repaired defect from a test written after the fact.
 */
import { describe, expect, it } from 'vitest';

import { main, type ChildRunner } from '../../src/scripts/lint_agent_security.js';
import { runInProc } from '../_lib/run_in_process.js';
import type { ProbeResult } from '../../src/scripts/_lib/counted_probe.js';

/** A child that completed cleanly: exit 0, an empty findings array. */
function clean(): ProbeResult {
    return { ok: true, stdout: '[]', stderr: 'scanned: 100\n', status: 0, failure: null };
}

/** The child under test, keyed by script name; every other child is clean. */
function runnerFor(script: string, result: ProbeResult): ChildRunner {
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
    it('(a) exit non-zero with empty stdout REPRODUCES THE FAIL-OPEN: aggregate exits 0', () => {
        const r = run(runnerFor('lint_confusables.ts', { ok: false, stdout: '', stderr: '', status: 3, failure: 'exited 3' }));
        expect(r.status, r.stdout + r.stderr).toBe(0);
        expect(r.stdout).toContain('clean (0 blocking');
    });

    it('(b) exit 0 with unparsable stdout REPRODUCES THE FAIL-OPEN: aggregate exits 0', () => {
        const r = run(
            runnerFor('lint_hidden_unicode.ts', {
                ok: true,
                stdout: 'Traceback (most recent call last):\n  File "x"\n',
                stderr: '',
                status: 0,
                failure: null,
            }),
        );
        expect(r.status, r.stdout + r.stderr).toBe(0);
        expect(r.stdout).toContain('clean (0 blocking');
    });

    it('(c) a child that never spawned REPRODUCES THE FAIL-OPEN: aggregate exits 0', () => {
        const r = run(
            runnerFor('lint_mcp_config_security.ts', {
                ok: false,
                stdout: '',
                stderr: '',
                status: null,
                failure: 'spawn ENOENT',
            }),
        );
        expect(r.status, r.stdout + r.stderr).toBe(0);
        expect(r.stdout).toContain('clean (0 blocking');
    });

    it('(c2) a child whose stdout is valid JSON but not an array REPRODUCES THE FAIL-OPEN: aggregate exits 0', () => {
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
        expect(r.status, r.stdout + r.stderr).toBe(0);
        expect(r.stdout).toContain('clean (0 blocking');
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
});
