/**
 * rtk allowlist for worker tool loops (road-to-lean-agent-init Phase 4).
 *
 * Wraps ONLY the command class with a MEASURED ~55% output saving —
 * `internal/bench/rtk-savings/RESULTS.md` is the single source of the
 * numbers (referenced, never duplicated here). The ~0%-savings class stays
 * unwrapped: wrap overhead without return. Congruence with RESULTS.md is
 * enforced by `tests/scripts/_lib_rtk_allowlist.test.ts`, which parses the
 * results table and asserts every allowlisted pattern measured ≥ the
 * threshold and every excluded pattern measured below it.
 */

/** A worker wraps a command with rtk only when its saving measured ≥ this. */
export const RTK_WRAP_THRESHOLD_PCT = 50;

/**
 * Command patterns in the measured high-savings class. Matched against the
 * command a worker is about to run; first match wins.
 */
export const RTK_WRAP_ALLOWLIST: ReadonlyArray<{ pattern: RegExp; benchCommand: string }> = [
    { pattern: /^git status\b/, benchCommand: 'git status' },
    // Full-format git log (NOT --oneline — that class measured ~0%).
    { pattern: /^git log(?!.*--oneline)\b/, benchCommand: 'git log -10' },
    { pattern: /^ls -la?\b/, benchCommand: 'ls -la src/scripts' },
];

/**
 * Measured-near-zero class — never wrapped (documented so nobody "helpfully"
 * adds them back without a new measurement).
 */
export const RTK_NO_WRAP: ReadonlyArray<{ pattern: RegExp; benchCommand: string }> = [
    { pattern: /^git log .*--oneline\b/, benchCommand: 'git log --oneline -50' },
    { pattern: /^git diff .*--stat\b/, benchCommand: 'git diff --stat HEAD~5..HEAD' },
    { pattern: /^git branch\b/, benchCommand: 'git branch -a' },
    { pattern: /^npm ls\b/, benchCommand: 'npm ls --depth=0' },
    { pattern: /^git show .*--stat\b/, benchCommand: 'git show --stat HEAD' },
];

/** Should a worker wrap this command with rtk? Deterministic, measured-class only. */
export function shouldWrapWithRtk(command: string): boolean {
    const cmd = command.trim();
    if (RTK_NO_WRAP.some((e) => e.pattern.test(cmd))) return false;
    return RTK_WRAP_ALLOWLIST.some((e) => e.pattern.test(cmd));
}
