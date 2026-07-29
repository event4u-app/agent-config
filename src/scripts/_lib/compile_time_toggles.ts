/**
 * Compile-time rule toggles — the single definition, shared by the router compiler
 * and the projector.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * The map used to live only in `compile_router.ts`, which meant a disabled rule was
 * dropped from `dist/router.json` while its **body still shipped** as a file in
 * `dist/agent-src/rules/` (and through the `.claude/rules/` symlink). ADR
 * `telegraph/0002` originally claimed that flipping the toggle gave "zero-cost
 * dormancy". That was measured and found half wrong on 2026-07-29: the router entry
 * governs *trigger-routing*; **file existence governs always-loaded injection**, and
 * the host reads the file — a maintainer session's context listed the body verbatim
 * as "project instructions", never having consulted the router.
 *
 * Two surfaces, one switch. Sharing the definition is what lets the projector honour
 * it, so `speak: false` means what the ADR assumed instead of the ADR being weakened
 * to match a partial implementation.
 */

/** Loose settings shape — the toggles only ever read nested plain objects. */
export type ToggleSettings = Record<string, unknown>;

/** rule-id → predicate. A rule is emitted (router AND projection) only when its
 * predicate returns true. A rule absent from this map is always emitted. */
export const COMPILE_TIME_TOGGLES: Record<string, (s: ToggleSettings) => boolean> = {
    // `speak` defaults FALSE (dormant) per docs/adrs/telegraph/0002 — the absent-key
    // fallback used to be `true`, which silently contradicted ADR 0001 (accepted,
    // "default off until bench"). Measured basis: median vs_terse −9.27% (API) /
    // −5.47% (exact cl100k_base) — telegraph emits MORE than a plain "be terse".
    // Opt back in with an explicit `telegraph.speak: true` once an output-side bench
    // clears the kill-criterion bar. `enabled` keeps its true default: it is the
    // family master switch, and flipping it would silence sibling telegraph settings
    // that were never measured negative.
    //
    // This predicate deliberately does NOT read `speak_scope`. That key disables the
    // rule's *behaviour* and never removed its token cost — the trap the measurement
    // exposed.
    'telegraph-speak': (s: ToggleSettings): boolean => {
        const tg = (s['telegraph'] as ToggleSettings | undefined) ?? {};
        const enabled = tg['enabled'] === undefined ? true : tg['enabled'];
        const speak = tg['speak'] === undefined ? false : tg['speak'];
        return Boolean(enabled) && Boolean(speak);
    },
};

/** True when the rule may be emitted. Unknown ids are always emitted — the map is an
 * opt-in list of gated rules, never an allowlist of permitted ones. */
export function rule_is_compile_enabled(rule_id: string, settings: ToggleSettings): boolean {
    const predicate = COMPILE_TIME_TOGGLES[rule_id];
    return predicate === undefined ? true : predicate(settings);
}
