/**
 * "What is a gate?" — asserted once, read by everything that needs the answer.
 *
 * Three call sites each carried their own regex and each got a different number
 * (measured 2026-08-04):
 *
 * | Site | Pattern | Population |
 * |---|---|---:|
 * | `check_gate_coverage` (the ratchet) | `(lint\|check\|audit)_` minus `.d.ts` | 223 |
 * | `sweep_dead_scan_roots` | `(lint\|audit\|check\|verify)_` | 225 |
 * | the manifest-registration test | `(lint\|check\|audit\|skill)_` | 232 |
 *
 * Harmless while the numbers were only reported. Load-bearing the moment the
 * ratchet read one of them, which it now does — and it read the narrowest:
 *
 * - it counted `check_secret_leak.test.ts`, a **test file**, which can never be
 *   hardened, so its target of 0 was unreachable by construction;
 * - it missed 10 real gates the other two definitions caught — 8 × `skill_*`
 *   (including `skill_linter`, which already carries an enforced floor of 380 in
 *   the coverage manifest, so the manifest and the ratchet openly disagreed
 *   about whether it is a gate) and 2 × `verify_*`.
 *
 * ## Why a prefix filter and not manifest membership
 *
 * AI council 2026-08-04 (anthropic/claude-sonnet-4-5 + openai/gpt-4o, 3 rounds):
 * making manifest registration the classifier inverts a dependency that runs the
 * other way in practice. A new gate script lands BEFORE anyone registers it —
 * that is precisely how the registration test found the drift — so a
 * manifest-driven population would ignore every gate during the window when it
 * is least proven. Classification is structural (this filter); registration is
 * operational and layered on top (`enforced_manifest_ids`).
 *
 * The prefix set is a proxy for "this script certifies something and can lie
 * about it", and an imperfect one: `skill_usage_report` reports rather than
 * validates. It is kept because it is mechanical and over-inclusive in the safe
 * direction — a reporting script that asserts its scan scope loses nothing,
 * while a validator missing from the population is invisible exposure.
 */

/** Prefixes that mark a script as gate-shaped. */
const GATE_PREFIX = /^(lint|check|audit|skill|verify)_/;

/**
 * Is this filename a gate script?
 *
 * Structural only — takes a bare filename, never touches disk, so it answers
 * for a file that does not exist yet (a diff, a plan, a test fixture).
 */
export function matchesGatePattern(filename: string): boolean {
    if (!filename.endsWith('.ts')) return false;
    // A type declaration has no runtime behaviour to harden; a test file cannot
    // be hardened at all, and counting one made the ratchet's own target
    // unreachable.
    if (filename.endsWith('.d.ts') || filename.endsWith('.test.ts')) return false;
    return GATE_PREFIX.test(filename);
}

/** The gate scripts in `dir`, as bare ids (no `.ts`), sorted. Missing dir → `[]`. */
export function listGateScripts(dir: string, readdir: (d: string) => string[]): string[] {
    let entries: string[];
    try {
        entries = readdir(dir);
    } catch {
        return [];
    }
    return entries
        .filter(matchesGatePattern)
        .map((f) => f.replace(/\.ts$/, ''))
        .sort();
}
