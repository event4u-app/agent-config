/**
 * The durable RED-run record — `agents/runtime/state/test-results.json`.
 *
 * WHY THIS EXISTS, AND WHAT IT DISCHARGES.
 * `src/config/assurance-capability-registry.json` records `test-red-evidence` as
 * `projection: null` with the rationale "an observed failing test is a fact
 * about a run, and no repository scan can recover it", and a `revisit_if` that
 * names its own exit condition: "a durable RED-run identifier is emitted
 * somewhere a later reader can check, at which point this becomes projectable."
 * This module is that emission, so the registry entry moves in the same change
 * rather than being left describing a gap that closed.
 *
 * WHAT IT IS NOT. It is not a test runner, and it does not decide whether a
 * failure is a legitimate RED. The failure CLASSES belong to the TDD skill
 * (`src/skills/test-driven-development/SKILL.md`, Test-Red row) and this module
 * stores the class the caller observed. A store that classified would be a
 * second opinion competing with the contract.
 *
 * WHY IT LIVES UNDER `agents/runtime/`. It is per-run state, gitignored, and
 * rebuildable by running the test again — a Class-A artefact under ADR-124, not
 * a tracked record. A committed RED log would be a claim about a run nobody can
 * reproduce, which is the shape this repository keeps removing.
 *
 * THE ONE THING IT DELIBERATELY DOES NOT USE: commit order. A squash or a rebase
 * destroys it, so "the test commit came before the code commit" is not evidence
 * of anything. The run identifier is.
 */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

/** Repo-relative location of the record. */
export const TEST_RESULTS_REL = path.join('agents', 'runtime', 'state', 'test-results.json');

/**
 * The failure classes the TDD skill's Test-Red row admits as a legitimate RED,
 * plus the ones it rejects. Kept as one union so a caller cannot record an
 * unlisted class, and so the invalid set stays visible beside the valid one —
 * the discriminator is whether the failure is about the behaviour under test.
 */
export const RED_FAILURE_CLASSES = [
    // Valid — the failure is about the behaviour under test.
    'assertion',
    'missing-target',
    'contract',
    // Invalid — the failure is about the harness, and a RED claimed on one of
    // these is a RED nobody observed.
    'broken-fixture',
    'test-syntax-error',
    'missing-unrelated-dependency',
    'runner-fault',
] as const;

export type RedFailureClass = (typeof RED_FAILURE_CLASSES)[number];

/** The three classes that count as an observed RED. */
export const VALID_RED_CLASSES: readonly RedFailureClass[] = [
    'assertion',
    'missing-target',
    'contract',
] as const;

export function isValidRed(cls: RedFailureClass): boolean {
    return (VALID_RED_CLASSES as readonly string[]).includes(cls);
}

export interface RedRun {
    /** The test target observed failing — a file, a filter, or a test name. */
    target: string;
    /** The observed failure class. */
    failure_class: RedFailureClass;
    /** True only for the three behaviour-relevant classes. */
    valid_red: boolean;
    /** Stable identifier a later reader can cite. */
    run_id: string;
    /** ISO instant the record was written. */
    observed_at: string;
    /** Optional free text — the runner's own first failing line, trimmed. */
    detail?: string;
}

export interface TestResultsState {
    schema: 1;
    runs: RedRun[];
}

/**
 * A run identifier stable for the same (target, class, instant), carrying no
 * path from the machine that produced it. Twelve hex characters is enough to
 * cite in prose and short enough to read aloud.
 */
export function runId(target: string, cls: string, at: string): string {
    return crypto.createHash('sha256').update(`${target} ${cls} ${at}`).digest('hex').slice(0, 12);
}

export function readState(root: string): TestResultsState {
    const p = path.join(root, TEST_RESULTS_REL);
    let raw: string;
    try {
        raw = fs.readFileSync(p, 'utf8');
    } catch {
        return { schema: 1, runs: [] };
    }
    try {
        const parsed = JSON.parse(raw) as TestResultsState;
        if (parsed.schema !== 1 || !Array.isArray(parsed.runs)) return { schema: 1, runs: [] };
        return parsed;
    } catch {
        // A corrupt record reads as absent rather than throwing. This is
        // advisory state: a broken file must not break the run that reads it.
        return { schema: 1, runs: [] };
    }
}

/** Append one observed run. Returns the record written. */
export function recordRed(
    root: string,
    target: string,
    failure_class: RedFailureClass,
    opts: { detail?: string; now?: string } = {},
): RedRun {
    const observed_at = opts.now ?? new Date().toISOString();
    const run: RedRun = {
        target,
        failure_class,
        valid_red: isValidRed(failure_class),
        run_id: runId(target, failure_class, observed_at),
        observed_at,
        ...(opts.detail !== undefined ? { detail: opts.detail.slice(0, 400) } : {}),
    };
    const state = readState(root);
    // Newest first, and bounded: this is advisory state, not an audit log, and
    // an unbounded file in a gitignored directory is the growth shape
    // `scale-discipline` R-A7 exists to stop.
    state.runs = [run, ...state.runs].slice(0, 200);
    const p = path.join(root, TEST_RESULTS_REL);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
    return run;
}

/**
 * The most recent VALID red for `target`, or `null`.
 *
 * Matching is exact on the target string. Deliberately not fuzzy: a guard that
 * accepted a near-match would clear a production edit on a red observed for a
 * different behaviour, which is the failure the guard exists to catch.
 */
export function latestValidRed(root: string, target: string): RedRun | null {
    for (const r of readState(root).runs) {
        if (r.target === target && r.valid_red) return r;
    }
    return null;
}
