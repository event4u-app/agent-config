/**
 * Registry of `check:` exits a skill's `procedure.yaml` may name
 * (road-to-steps-the-skill-cannot-skip 3.2).
 *
 * A step's exit is data, and no string from that data is ever executed. A
 * `check: <id>` exit therefore names a function registered here — deterministic,
 * read-only and offline — and a manifest can only name an id that exists in this
 * map. The registry starts empty: a check is added with the pilot step that
 * needs it, never speculatively.
 */

export interface ProcedureCheckContext {
    /** Absolute path of the project the procedure runs against. */
    projectRoot: string;
    /** Absolute path of the skill directory that owns the procedure. */
    skillDir: string;
}

export interface ProcedureCheckResult {
    ok: boolean;
    /** Why the exit is not met; shown to the agent as the step's PARTIAL reason. */
    reason?: string;
}

export type ProcedureCheck = (ctx: ProcedureCheckContext) => ProcedureCheckResult;

export const PROCEDURE_CHECKS: Readonly<Record<string, ProcedureCheck>> = Object.freeze({});

export function registeredCheckIds(): Set<string> {
    return new Set(Object.keys(PROCEDURE_CHECKS));
}
