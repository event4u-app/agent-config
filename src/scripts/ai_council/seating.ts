/**
 * Who is seated for a run, decided once and frozen.
 *
 * Selection today is config-static ask-all: every enabled member, every
 * question, no per-question seating. This adds an OPTIONAL declaration of what
 * a run wants from its seats, and computes the answer once.
 *
 * FAMILY DIVERSITY ONLY — no band ordering. `blocker: b-ladder-order-benchmark-spend`
 * was resolved (b) on 2026-08-22: nothing in this tree establishes that a higher
 * capability band reviews better, the archived benchmark substrate would have to
 * be re-run to support it, and the council that would have decided otherwise had
 * no quota. So `tier` keeps its single documented meaning — a capability rank
 * read only as a chairman-selection input — and nothing here reads it. A seat
 * declaration carries MISSION, never RANK.
 *
 * "Family" is the PROVIDER, not a capability band. For a council, diversity means
 * independent providers: two Claude bands share a vendor, a training pipeline and
 * a failure mode, so seating `opus` beside `sonnet` buys none of what a second
 * opinion is for. (`MODEL_FAMILIES` in the orchestration-record hook enumerates
 * Claude bands for a different purpose — token attribution — and is deliberately
 * not reused here.)
 *
 * Absent declaration ⇒ today's behaviour, byte-identical. That is asserted by a
 * test rather than intended.
 */
import type { MemberConfig } from './config.js';

/** A member's provider family. The map key IS the provider in this config shape. */
export function familyOf(member: MemberConfig): string {
    return member.name;
}

/**
 * Read the optional `seat_constraints:` block out of a raw council config.
 *
 * DELIBERATELY NOT A FIELD ON `CouncilConfig`, and the reason is a ratchet
 * rather than a design preference. `config.ts` is 2,205 lines — 705 over the
 * 1,500-line source-size line — and `check_source_size_budget` counts only the
 * excess above that line, so the 39 lines this feature first added there were a
 * straight +39 against a shrink-only baseline. The gate's own message is
 * explicit that raising the baseline is "a defect, not a fix". Extraction is the
 * sanctioned repair, and this file is 169 lines, so the same code costs nothing
 * here.
 *
 * THE TRADE-OFF, stated rather than buried: validation moves from LOAD time to
 * READ time. A malformed `min_families` no longer fails the moment the config
 * is parsed; it fails when a caller asks for the constraints. Today that
 * difference is unobservable — Phase 2 ships the DECLARATION and no caller
 * reads it yet — but it is a real change in when a bad config is caught, and
 * whoever wires the first caller should call this at run start so the failure
 * lands before any seat is used.
 *
 * Fails CLOSED on a malformed value rather than falling back to absent: a run
 * that declared a diversity floor and silently got none is the exact silent
 * fallback the degradation line exists to prevent.
 */
export function readSeatConstraints(raw: unknown, label = 'seat_constraints'): SeatConstraints {
    if (raw === null || raw === undefined) return {};
    if (typeof raw !== 'object' || Array.isArray(raw)) {
        throw new TypeError(`${label} must be a mapping (got ${typeof raw}).`);
    }
    const block = (raw as Record<string, unknown>)['seat_constraints'] ?? raw;
    if (block === null || block === undefined) return {};
    if (typeof block !== 'object' || Array.isArray(block)) {
        throw new TypeError(`${label} must be a mapping (got ${typeof block}).`);
    }
    const mf = (block as Record<string, unknown>)['min_families'];
    if (mf === null || mf === undefined) return {};
    if (typeof mf !== 'number' || !Number.isInteger(mf) || mf < 1) {
        throw new TypeError(`${label}.min_families must be an integer >= 1 when set (got ${String(mf)}).`);
    }
    return { min_families: mf };
}

export interface SeatConstraints {
    /**
     * Minimum distinct provider families the run wants seated.
     *
     * Absent (or 1) ⇒ no constraint and no degradation line: ask-all, unchanged.
     */
    readonly min_families?: number;
}

export interface Seating {
    /** The seated members, in deterministic config order. */
    readonly seats: readonly MemberConfig[];
    /** Distinct families actually seated. */
    readonly families: readonly string[];
    /**
     * Exactly ONE line when the constraint could not be met, `null` otherwise.
     *
     * One line, not a wall: a degradation nobody reads is the same as a silent
     * fallback, and N warnings is how a reader learns to skip the header.
     */
    readonly degraded: string | null;
}

/**
 * Compute the seating once.
 *
 * Deterministic and side-effect-free: the same members and constraints always
 * produce the same seats, which is what makes freezing it meaningful. Seating
 * that changed between round 1 and round 3 would silently invalidate the
 * anonymised-peer-reply contract the council skill depends on — a "reviewer B"
 * in round 3 that is not the "reviewer B" of round 1 makes every cross-reference
 * in the synthesis wrong while looking fine.
 */
export function resolveSeating(
    members: readonly MemberConfig[],
    constraints: SeatConstraints = {},
): Seating {
    const enabled = members.filter((m) => m.enabled);
    const families = [...new Set(enabled.map(familyOf))];
    const want = constraints.min_families ?? 1;

    if (want <= 1 || families.length >= want) {
        return { seats: enabled, families, degraded: null };
    }
    return {
        seats: enabled,
        families,
        degraded:
            `tier-degraded: asked for ${String(want)} model families, seated ${String(families.length)} ` +
            `(${families.join(', ')}). The run proceeds with what is enabled — a council that refused to ` +
            `convene on a diversity shortfall would fail closed on the common single-provider install, ` +
            `which is worse than a stated shortfall.`,
    };
}

/**
 * Freeze a seating so a later config mutation cannot change it.
 *
 * Returns a structurally frozen snapshot. This is the mechanism behind "resolve
 * once per run": the caller resolves at run start, freezes, and passes the
 * snapshot down — so there is no path by which round 3 re-reads the config.
 */
export function freezeSeating(s: Seating): Seating {
    return Object.freeze({
        seats: Object.freeze([...s.seats]),
        families: Object.freeze([...s.families]),
        degraded: s.degraded,
    });
}

/**
 * Vendor sentinels and "latest in band" aliases — an id that cannot go stale.
 *
 * Read from the providers' own CLI surfaces on 2026-08-22, never from recall:
 * `claude --help` documents 'fable', 'opus' and 'sonnet' as aliases for the
 * latest model in their band, and `codex-default` is the openai transport's
 * documented "let the CLI choose".
 */
export const ADMISSIBLE_SENTINELS: ReadonlySet<string> = new Set([
    'codex-default',
    'fable',
    'opus',
    'sonnet',
    'haiku',
]);

export interface AdmissibilityResult {
    readonly admissible: boolean;
    readonly reason: string | null;
}

/**
 * Is this member's `model:` id from an admissible SOURCE?
 *
 * THE CRITERION AS WRITTEN COULD NOT BE IMPLEMENTED, and the deviation is
 * recorded here rather than papered over. The roadmap step says a declared seat
 * "resolves through the shipped `model_tier` bands; a model id that no tier maps
 * to is rejected at config load". But `TIER_TO_CLAUDE_MODEL`
 * (`_lib/model_tier.ts:36-41`) maps tiers onto CLAUDE aliases only — there is no
 * entry any `gemini-*`, `grok-*` or `sonar-*` id could resolve through. Taken
 * literally, that rule rejects every non-anthropic member in the shipped starter
 * config, i.e. it fails closed on a valid config.
 *
 * What the step is actually protecting is stated in its own title: "including
 * the host's own recall". The failure mode is a plausible-sounding model id
 * TYPED FROM MEMORY, which is indistinguishable from a real one at review time
 * and would silently undo the pin refresh. So admissibility is checked against
 * the SOURCE of the id, over the two things this tree can actually verify:
 *
 *   1. a vendor sentinel or documented "latest in band" alias — cannot go stale,
 *      and read from the provider's own surface; or
 *   2. a dated pin carrying a `verified_at` stamp — which records that a human
 *      looked at the provider's surface on a named date, and which
 *      `check_council_pin_staleness` ages out.
 *
 * An id that is neither is exactly the recall case: a bare dated id nobody
 * recorded checking.
 */
export function checkModelAdmissibility(member: MemberConfig): AdmissibilityResult {
    const id = member.model.trim().toLowerCase();
    if (ADMISSIBLE_SENTINELS.has(id)) {
        return { admissible: true, reason: null };
    }
    if (member.verified_at !== null && member.verified_at !== undefined) {
        return { admissible: true, reason: null };
    }
    return {
        admissible: false,
        reason:
            `members.${member.name}.model is '${member.model}' — a dated id with no verified_at stamp. ` +
            `An id must come from a source this tree can check: a vendor sentinel or documented ` +
            `"latest in band" alias (${[...ADMISSIBLE_SENTINELS].join(', ')} — see src/scripts/_lib/model_tier.ts ` +
            `for the tier vocabulary these bands come from), or a pin carrying verified_at: "YYYY-MM-DD" ` +
            `recorded from the provider's own surface. A model id remembered rather than read is not an ` +
            `admissible source, and is indistinguishable from a real one at review time.`,
    };
}
