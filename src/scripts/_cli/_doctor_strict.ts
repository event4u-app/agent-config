/**
 * `doctor --strict` — the failing exit mode, its threshold, and its kill switch.
 *
 * A separate module rather than more lines in `cmd_doctor.ts`, which is already
 * far past the source-size budget: every line added there is counted excess by
 * `check_source_size_budget`, and a ratchet that only turns one way is a
 * standing instruction to put new code somewhere else.
 */
/** Structural, so this module needs no import from its caller. */
type Dict = Record<string, unknown>;
interface StrictOptions {
    strict: boolean;
    strict_level: string;
}

function eprint(msg: string): void {
    process.stderr.write(`${msg}\n`);
}

/** Raised on an unknown `--strict-level`; the caller maps it to its argparse exit. */
export class StrictLevelError extends Error {}

/**
 * `--strict` — the failing exit mode, and the ONE decision behind it.
 *
 * `doctor-exit-contract` was resolved by AI council on 2026-09-03 (members
 * anthropic, openai), unanimously **(b)**: `doctor` keeps its exit contract and
 * a separate strict mode carries the failing exit, leaving current callers
 * untouched at the cost of one more surface. ADR-041 governs verb growth, so a
 * flag rather than a verb; and the existing contract is load-bearing for callers
 * that run `doctor` for information rather than for permission.
 *
 * WHAT WAS ALREADY TRUE, measured rather than assumed. The originating roadmap
 * says `doctor` "writes nothing and always exits zero". Half of that is wrong:
 * the default run already returns 1 on DRIFT (`return drift_present ? 1 : 0`),
 * and `--ci` already folds check failures in on top. What is genuinely missing
 * is a failing exit for check failures OUTSIDE the `--ci` JSON contract — `--ci`
 * forces `opts.json = true`, so there is no human-readable strict run — and that
 * gap is what `--strict` closes. Recorded here because a comment claiming to
 * implement a premise the code contradicts is worse than no comment.
 *
 * SEVERITY IS CONFIGURABLE, per a condition both council seats attached:
 * `--strict-level fail` (default) fails on `fail` rows; `--strict-level warn`
 * also fails on `warn`. A caller adopting strict picks its own bar rather than
 * inheriting one.
 *
 * THE KILL SWITCH is `AGENT_CONFIG_DOCTOR_NO_FAIL=1`, the other condition both
 * seats attached: an immediate way to disable failing exits that is not a code
 * rollback. When set, `--strict` still REPORTS every finding and still emits
 * `can_proceed: false`; only the exit code is suppressed, and the suppression is
 * announced on stderr so a green run cannot be silently bought. A switch that
 * hid the finding as well would be the "warning ignored eighteen times" shape
 * this repository already documents.
 */
export const STRICT_DEFAULT_LEVEL = 'fail';
export const STRICT_LEVELS: ReadonlySet<string> = new Set(['fail', 'warn']);
/** Env var that suppresses the failing exit without suppressing the finding. */
export const STRICT_KILL_SWITCH = 'AGENT_CONFIG_DOCTOR_NO_FAIL';

/** Statuses that trip `--strict` at the given level. */
export function strictTripping(level: string): ReadonlySet<string> {
    return level === 'warn' ? new Set(['fail', 'warn']) : new Set(['fail']);
}

/**
 * The machine-readable "may I proceed" answer — nothing in this tree carried
 * one before (`grep -rc can_proceed src` returned zero hits tree-wide).
 *
 * Deliberately independent of `--strict`: a caller asking the JSON whether it
 * may proceed gets the same answer whether or not the exit code was configured
 * to fail, because the two questions are different. The exit code is a policy;
 * `can_proceed` is a fact.
 */
export function canProceed(driftPresent: boolean, checks: readonly Dict[]): boolean {
    return !driftPresent && !checks.some((c) => c['status'] === 'fail');
}

export function validateStrictLevel(level: string): void {
    if (!STRICT_LEVELS.has(level)) {
        throw new StrictLevelError(
            `argument --strict-level: invalid choice: '${level}' (choose from 'fail', 'warn')`,
        );
    }
}

/**
 * The `--strict` verdict, or `null` when strict is off.
 *
 * Factored out because `main` has TWO exit paths and only one of them was
 * obvious: a project with no install manifest returns through
 * `_run_no_manifest` long before the drift branch, so a strict check written
 * only in the drift branch silently never fires there. Measured, not guessed —
 * the first implementation exited 0 on a tree carrying a `fail` check row and a
 * `can_proceed: false` payload, because this repository has no manifest of its
 * own. Both paths call this now, so the two cannot diverge again.
 */
export function strictExit(
    opts: StrictOptions,
    checks: readonly Dict[],
    driftPresent: boolean,
): number | null {
    if (!opts.strict) {
        return null;
    }
    const tripping = strictTripping(opts.strict_level);
    const tripped = checks.filter((c) => tripping.has(c['status'] as string));
    if (!driftPresent && tripped.length === 0) {
        return 0;
    }
    if (process.env[STRICT_KILL_SWITCH] === '1') {
        // The finding is NEVER suppressed — only the exit code is, and the
        // suppression announces itself. A switch that hid the finding as well
        // would be the ignored-warning shape this repository already documents.
        eprint(
            `⚠️  doctor --strict: ${String(tripped.length)} finding(s) at or above ` +
                `'${opts.strict_level}'` +
                (driftPresent ? ' plus manifest drift' : '') +
                `, but ${STRICT_KILL_SWITCH}=1 suppressed the failing exit. ` +
                'The findings above still stand; unset it to restore the gate.',
        );
        return 0;
    }
    return 1;
}

/**
 * The `can_proceed` / `status` pair, written onto a `--json` payload.
 *
 * Lives here rather than inline in `_emit_json` for the source-budget reason
 * this whole module exists for. `status` is the roll-up a human reads;
 * `can_proceed` is the boolean a caller branches on without parsing prose. Both
 * are facts about the tree and never about the exit policy — a caller running
 * with the kill switch set still gets `can_proceed: false`.
 */
export function attachProceedFields(
    payload: Dict,
    driftPresent: boolean,
    checks: readonly Dict[],
): void {
    const proceed = canProceed(driftPresent, checks);
    payload['can_proceed'] = proceed;
    payload['status'] = proceed
        ? checks.some((c) => c['status'] === 'warn')
            ? 'warn'
            : 'ok'
        : 'fail';
}

/** Argv wiring, exported as fragments so the caller spends one line each. */
export const STRICT_STORE_TRUE = { '--strict': 'strict' } as const;
export const STRICT_VALUE_FLAGS = { '--strict-level': 'strict_level' } as const;
export const STRICT_DEFAULTS = { strict: false, strict_level: STRICT_DEFAULT_LEVEL } as const;
export const STRICT_USAGE = '                           [--strict] [--strict-level {fail,warn}]\n';

/** Validate, mapping the module's error onto the caller's argparse exit. */
export function validateStrictLevelOr(level: string, onError: (msg: string) => never): void {
    try {
        validateStrictLevel(level);
    } catch (e) {
        if (e instanceof StrictLevelError) onError(e.message);
        throw e;
    }
}
