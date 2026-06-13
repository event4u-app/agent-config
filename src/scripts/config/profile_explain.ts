// profile_explain — the `profile-overlay` explain envelope + renderer.
//
// Phase 2 of road-to-session-profile-observability: answer "why is the agent
// behaving differently / why is the surface different?" over the
// session-profile overlay, in plain language by default (`technical` for an
// engineering lead).
//
// Trust boundary (AI-council amendment): the renderer is a **pure template**
// over the envelope fields — it NEVER calls an LLM and NEVER reads beyond the
// overlay state it is handed. `build_profile_envelope` is the only place that
// reads state; `render_profile_overlay` is a pure function of the envelope
// (golden-testable).
//
// Reuses the explain-modes two-views-over-one-envelope convention
// (`docs/contracts/explain-modes.md`).
//
// Twin of `src/scripts/config/profile_explain.py`.

// `any` mirrors Python's `dict[str, Any]` envelope; values are heterogeneous
// (lists, ints, bools, the `?` placeholder string) and consumed only through
// the missing-field-tolerant getter `_g`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EnvelopeValue = any;
export type Envelope = Record<string, EnvelopeValue>;

export const ENVELOPE_TYPE = 'profile-overlay';

/**
 * Build the `profile-overlay` envelope from the `show`/`surface` state.
 *
 * Only the persisted overlay state is available, so seed-vs-closure split and
 * staleness-age-in-days are intentionally NOT fields (the overlay stores the
 * effective pack set, no request log, no timestamp — see the contract). The
 * overlay set is reported as the effective `active_packs`; staleness is
 * persistence, not an age.
 */
export function build_profile_envelope(
    active_packs: string[],
    commands_shown: number,
    skills_shown: number,
    hidden_total: number,
): Envelope {
    return {
        envelope_type: ENVELOPE_TYPE,
        active: [...active_packs],
        commands_shown,
        skills_shown,
        hidden_total,
        // deterministic "what changed vs the full surface"
        delta: { hidden_behind_inactive_packs: hidden_total },
        // staleness = persistence (no timestamp in the overlay)
        persists_across_sessions: Boolean(active_packs.length),
    };
}

/**
 * Missing-field-tolerant getter — the renderer never throws on a partial
 * envelope (a missing field renders a placeholder, per the coverage spec).
 */
function _g(env: Envelope, key: string, def: EnvelopeValue): EnvelopeValue {
    const v = Object.prototype.hasOwnProperty.call(env, key) ? env[key] : def;
    return v === null || v === undefined ? def : v;
}

/**
 * Pure render of the `profile-overlay` envelope. `plain` (default) for a
 * non-technical employee; `technical` for an engineering lead. Never raises on
 * a partial envelope.
 */
export function render_profile_overlay(envelope: Envelope, mode = 'plain'): string {
    const active = _g(envelope, 'active', []);
    const cmds = _g(envelope, 'commands_shown', '?');
    const skills = _g(envelope, 'skills_shown', '?');
    const hidden = _g(envelope, 'hidden_total', '?');

    // Python `if not active:` — falsy for `[]`, `""`, `0`, `None`.
    if (!_pyTruthy(active)) {
        if (mode === 'technical') {
            return 'profile-overlay: none active — full surface (no filtering).';
        }
        return (
            "Nothing is filtered — no profile is active, so you see every command " +
            "and skill. The agent isn't hiding anything."
        );
    }

    const names = Array.isArray(active) ? active.join(', ') : String(active);
    if (mode === 'technical') {
        return [
            `profile-overlay: active=[${names}]`,
            `  surfaced: commands=${cmds} skills=${skills}`,
            `  hidden:   ${hidden} (behind inactive packs)`,
            '  delta:    surface = full ∖ (artefacts whose packs ∉ active)',
            '  staleness: persists across sessions (overlay has no timestamp)',
        ].join('\n');
    }
    return [
        `Why the surface looks different: a profile is active (${names}).`,
        `It shows you ${cmds} commands and ${skills} skills, and hides ${hidden} ` +
            "behind packs you haven't turned on — that's why some commands aren't visible.",
        'Nothing is broken; the overlay just narrows the surface to this profile.',
        'It stays this way across sessions until you run `/profile deactivate`.',
    ].join('\n');
}

/** Python truthiness for the values `active` can take (list / str / number). */
function _pyTruthy(value: EnvelopeValue): boolean {
    if (value === null || value === undefined) return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'string') return value.length > 0;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'boolean') return value;
    return true;
}
