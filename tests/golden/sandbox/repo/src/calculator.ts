/**
 * Toy calculator — fixture for the golden-capture sandbox (TS twin of the
 * retired `calculator.py`).
 *
 * Intentionally tiny. Each Golden Transcript scenario adds (or fails to add)
 * one operation. The shape is locked: integer arithmetic only, no I/O, no
 * dependencies — keeping every transcript deterministic.
 *
 * `power` ships with a known sign-handling bug (it drops the sign of `a` via
 * `Math.abs`) so GT-3 (test-failure-recovery) has a deterministic failure to
 * exercise. The fix recipe lives in `../../recipes/gt3_recovery.ts`.
 */
export function add(a: number, b: number): number {
    return a + b;
}

export function subtract(a: number, b: number): number {
    return a - b;
}

/** Buggy stub — see GT-3 recovery recipe for the fix. */
export function power(a: number, b: number): number {
    return Math.abs(a) ** b;
}
