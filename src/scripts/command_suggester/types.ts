/**
 * Type definitions for the command suggestion engine.
 *
 * Ported from the retired Python `src/scripts/command_suggester/types.py`
 * (ADR-090 py2ts). Plain data carriers — no third-party deps. Kept in
 * a sibling module so match/rank/cooldown/render can import without
 * cycles.
 *
 * The Python module uses frozen / mutable dataclasses. Here:
 *  - `CommandSpec`, `Match`, `Settings` are small classes that mirror
 *    the dataclass field order and default values exactly, so callers
 *    can construct them positionally-by-name like the Python fixtures.
 *  - `CooldownState` is a mutable class (the Python `@dataclass` is
 *    mutable on purpose).
 *
 * The public field names stay snake_case to mirror the Python module
 * 1:1 (per ADR-090 — Python style is part of the contract).
 */

/**
 * Loaded command metadata that drives matching.
 *
 * Fields mirror the `suggestion:` frontmatter block plus the
 * command's `name` and `description`. Ineligible commands are
 * represented with `eligible=false` and are never returned by the
 * matcher; the loader keeps them so cross-referencing stays simple.
 *
 * Mirrors `@dataclass(frozen=True)` — the field order and defaults
 * match the Python dataclass.
 */
export interface CommandSpecInit {
    name: string;
    description: string;
    eligible: boolean;
    trigger_description?: string;
    trigger_context?: string;
    rationale?: string;
    confidence_floor?: number | null;
    cooldown?: string | null;
}

export class CommandSpec {
    readonly name: string;
    readonly description: string;
    readonly eligible: boolean;
    readonly trigger_description: string;
    readonly trigger_context: string;
    readonly rationale: string;
    readonly confidence_floor: number | null;
    readonly cooldown: string | null;

    constructor(init: CommandSpecInit) {
        this.name = init.name;
        this.description = init.description;
        this.eligible = init.eligible;
        this.trigger_description = init.trigger_description ?? '';
        this.trigger_context = init.trigger_context ?? '';
        this.rationale = init.rationale ?? '';
        this.confidence_floor = init.confidence_floor ?? null;
        this.cooldown = init.cooldown ?? null;
    }
}

/**
 * A scored candidate. `score` is 0.0–1.0 inclusive.
 *
 * `matched_trigger` is "description" | "context" | "both" and lets
 * the renderer surface why a command surfaced. `evidence` is the
 * short substring that fired (debugging / golden tests / explain).
 * `has_structural_bonus` is true when a heavy-signal pattern (ticket
 * key, file path, glob) co-occurred in the message — the ranker
 * treats those as specific enough to bypass vague-input suppression.
 *
 * Mirrors `@dataclass(frozen=True)`.
 */
export interface MatchInit {
    command: string;
    score: number;
    matched_trigger: string;
    evidence: string;
    has_structural_bonus?: boolean;
}

export class Match {
    readonly command: string;
    readonly score: number;
    readonly matched_trigger: string;
    readonly evidence: string;
    readonly has_structural_bonus: boolean;

    constructor(init: MatchInit) {
        this.command = init.command;
        this.score = init.score;
        this.matched_trigger = init.matched_trigger;
        this.evidence = init.evidence;
        this.has_structural_bonus = init.has_structural_bonus ?? false;
    }
}

/**
 * Engine knobs. Only `blocklist` comes from `.agent-settings.yml`; the
 * other four are fixed defaults (their settings keys were retired), still
 * overridable by a caller that constructs `Settings` directly.
 * Per-command frontmatter values override the floor / cooldown.
 *
 * Mirrors `@dataclass(frozen=True)`. The Python default `blocklist`
 * is an empty tuple; here it is a readonly string array, canonicalized
 * in insertion order (the loader already preserves order).
 */
export interface SettingsInit {
    enabled?: boolean;
    confidence_floor?: number;
    cooldown_seconds?: number;
    max_options?: number;
    blocklist?: readonly string[];
}

export class Settings {
    readonly enabled: boolean;
    readonly confidence_floor: number;
    readonly cooldown_seconds: number;
    readonly max_options: number;
    readonly blocklist: readonly string[];

    constructor(init: SettingsInit = {}) {
        this.enabled = init.enabled ?? true;
        this.confidence_floor = init.confidence_floor ?? 0.6;
        this.cooldown_seconds = init.cooldown_seconds ?? 600; // 10m
        this.max_options = init.max_options ?? 4;
        this.blocklist = init.blocklist ?? [];
    }

    /**
     * Structural equality mirroring Python dataclass `==`. Used by the
     * ported tests (`out === Settings()` in Python compares by value).
     */
    equals(other: Settings): boolean {
        if (this.enabled !== other.enabled) {
            return false;
        }
        if (this.confidence_floor !== other.confidence_floor) {
            return false;
        }
        if (this.cooldown_seconds !== other.cooldown_seconds) {
            return false;
        }
        if (this.max_options !== other.max_options) {
            return false;
        }
        if (this.blocklist.length !== other.blocklist.length) {
            return false;
        }
        for (let i = 0; i < this.blocklist.length; i += 1) {
            if (this.blocklist[i] !== other.blocklist[i]) {
                return false;
            }
        }
        return true;
    }
}

/**
 * Per-conversation cooldown tracker — mutable on purpose.
 *
 * Mirrors the mutable `@dataclass CooldownState`. The Python keys are
 * `(command_name, trigger_evidence)` tuples; JS Maps cannot key on
 * tuples by value, so we encode the pair as a single string via
 * `cooldownKey()` and decode it where the command component is needed
 * (`record_explicit_invocation`).
 */
export class CooldownState {
    /** Key: encoded (command_name, trigger_evidence). Value: unix timestamp. */
    last_shown: Map<string, number>;

    /** Commands the user explicitly typed; clears their cooldown. */
    explicit_invocations: Map<string, number>;

    /** Set by the `/command-suggestion-off` directive (Phase 5). */
    disabled_for_conversation: boolean;

    constructor() {
        this.last_shown = new Map();
        this.explicit_invocations = new Map();
        this.disabled_for_conversation = false;
    }
}

/**
 * Encode a `(command, evidence)` pair into a single Map key.
 *
 * A NUL byte separates the two components so no command/evidence
 * combination can collide with another (neither can contain a NUL in
 * practice; the separator is unambiguous regardless).
 */
export function cooldownKey(command: string, evidence: string): string {
    return `${command}\0${evidence}`;
}

/** Decode the command component of a cooldown key. */
export function cooldownKeyCommand(key: string): string {
    const idx = key.indexOf('\0');
    return idx === -1 ? key : key.slice(0, idx);
}
