/**
 * CLI-layer error type used by the dispatcher entry point.
 *
 * TypeScript twin of `work_engine/errors.py` (ADR-094 py2ts Phase 1 —
 * work_engine foundation). Lives in its own module so the helper modules
 * (`state_io`, `input_builders`, etc.) can raise it without depending on
 * `cli.ts`, which would create an import cycle.
 *
 * Behaviour is identical to the original `cli._CLIError` it replaced
 * in P2.3 of `road-to-post-pr29-optimize.md` — same name (private,
 * underscore-prefixed) and same role: convert to exit code `2` at the
 * `main()` boundary.
 */

/** Raised on configuration or I/O problems. Converted to exit code 2. */
export class _CLIError extends Error {
    constructor(message?: string) {
        super(message);
        // Restore the prototype chain so `instanceof _CLIError` works under
        // the ES2022 target (Error subclassing caveat).
        Object.setPrototypeOf(this, _CLIError.prototype);
        this.name = '_CLIError';
    }
}
