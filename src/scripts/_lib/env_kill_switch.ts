/**
 * One definition of "is this env kill-switch on?".
 *
 * WHY THIS EXISTS: the predicate was written out twice, byte-for-byte —
 * `ai_council/events_log.ts` and `ai_team/review_gate.ts` each carried a
 * private `_kill_switch_active()` with the identical body AND the identical
 * env var (`AGENT_CONFIG_NO_EVENTS_LOG`). `diff` over the two blocks was empty
 * and no shared helper existed. Two copies of a boolean coercion is two places
 * for the next accepted spelling to land in only one.
 *
 * The subtle half is why `'false'` is listed at all: `process.env` values are
 * strings, so the obvious `Boolean(process.env.X)` reads the *string* `'false'`
 * as true and silently arms a switch the operator explicitly disarmed. The
 * off-set is therefore explicit — unset, `''`, `'0'`, `'false'`, `'False'` —
 * and everything else is on, so a typo fails toward the safer direction (the
 * switch suppresses a log; a spurious suppression is visible, a spurious write
 * is not).
 *
 * SCOPE, stated because the source over-claimed it. `grep -rn "=== 'false'"
 * src/scripts/` returns 10 hits; only the two migrated here share one
 * predicate. The others are deliberately different and stay put:
 * `orchestration_record.ts` is a CLI-flag coercion whose invalid-string
 * fall-through is documented, `turn_end_gate_hook.ts` additionally accepts
 * `yes`/`on`, and `validate_frontmatter.ts` is a YAML scalar parser. Folding
 * those in would change three behaviours to remove three lines.
 */

/** The env values that mean "off". Everything else — including a typo — is on. */
const _OFF_VALUES: ReadonlySet<string> = new Set(['', '0', 'false', 'False']);

/**
 * True when the named environment variable is set to anything outside the
 * off-set. Unset reads as off.
 */
export function isEnvKillSwitchActive(name: string): boolean {
    return !_OFF_VALUES.has(process.env[name] ?? '');
}
