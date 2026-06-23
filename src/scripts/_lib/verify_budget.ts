/**
 * Verification-budget model (Phase 4).
 *
 * Pure, no-I/O. Decides HOW a delegated sub-task's output is verified so the
 * cross-model judge Iron Law and verify-before-complete are preserved WITHOUT
 * double-costing every trivial delegation. Contract:
 * `src/agent-src/contexts/execution/verify-budget.md`.
 *
 * - Trivial (below the change-size floor, read-only / no file writes) →
 *   `deterministic` verification (diff + dry-run + structural checks, no LLM).
 * - Otherwise → `judge` (full cross-model judge per subagent-orchestration).
 * - A required verification that did not run is a SURFACED safety gap, never a
 *   silent pass.
 */

export type VerifyMode = 'deterministic' | 'judge' | 'none';

/** Max changed-line count (inclusive) that still counts as trivial. */
export const TRIVIAL_CHANGE_FLOOR = 20;

export interface VerifyInputs {
    /** Changed lines the sub-task produced. */
    change_size: number;
    /** Did the sub-task write/modify files? */
    file_writes: boolean;
    /** Was the sub-task read-only (query/analysis, no mutation)? */
    read_only: boolean;
}

/**
 * Select the verification mode for a completed sub-task.
 * Trivial + non-mutating → deterministic; anything else → judge.
 */
export function selectVerifyMode(inp: VerifyInputs): VerifyMode {
    if (inp.read_only) return 'deterministic';
    const trivial = inp.change_size <= TRIVIAL_CHANGE_FLOOR && !inp.file_writes;
    return trivial ? 'deterministic' : 'judge';
}

/**
 * Detect a verification safety gap: a mode was required but the recorded mode
 * was `none`. Returns a human-readable gap string, or null when clean.
 * The orchestrator surfaces a non-null result — it is never a silent pass.
 */
export function verificationGap(required: VerifyMode, recorded: VerifyMode): string | null {
    if (required === 'none') return null;
    if (recorded === 'none') {
        return `verification gap: '${required}' required but none recorded`;
    }
    if (required === 'judge' && recorded === 'deterministic') {
        return `verification gap: non-trivial change verified deterministically (judge required)`;
    }
    return null;
}
