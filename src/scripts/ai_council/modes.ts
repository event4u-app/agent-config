/**
 * Mode resolution for council members (Phase 2b).
 *
 * Ported from the retired Python `src/scripts/ai_council/modes.py` (ADR-200 —
 * Python→TS migration, Phase 1). Pure resolver — never touches the
 * filesystem or environment. Callers pass in already-loaded values from
 * `.agent-settings.yml`.
 *
 * Each council member runs in exactly one transport mode per invocation:
 *
 * - `api`      — direct SDK call against the provider's API (billable).
 * - `manual`   — copy-paste loop with the user as transport (free).
 * - `cli`      — shell out to a locally-installed provider CLI under the
 *                user's subscription auth. `billable=False`.
 * - `auto`     — resolve per provider per invocation (cli → api → unavailable).
 *                Accepted here as a VALUE; the concrete transport is chosen by
 *                `transport_resolver.ts`, which owns the chain and the billing
 *                classification. `manual` is never part of the auto chain.
 *
 * Resolution precedence — first non-empty wins:
 *
 *     1. Invocation flag      e.g. `/council mode:manual`
 *     2. Per-member setting   `ai_council.members.<name>.mode`
 *     3. Global setting       `ai_council.mode` OR `ai_council.defaults.mode`
 *                             (see `resolve_global_mode` — both shapes reach
 *                             this resolver, and they must agree)
 *     4. Built-in default     `manual`
 *
 * ## Two distinct defaults — the reconciliation (road-to-zero-ceremony-detection)
 *
 * The contract used to describe a single fallback (`"api"`) while this module
 * implemented `manual`. Both were right about different layers, and the docs
 * conflated them. They are now named separately:
 *
 * - **Loader default** — when a config file omits `defaults.mode` entirely,
 *   `config.ts::_build_defaults` fills `api`. Unchanged; this is what every
 *   real config observes, because the loader always populates the key.
 * - **Built-in fallback** — when NO layer supplies a mode at all (a settings
 *   dict handed straight to the resolver, no config file involved), the answer
 *   is `manual`, below. That is the fail-closed direction the no-silent-spend
 *   Iron Law requires: a caller who supplied no transport preference has not
 *   asked to spend money, so the free transport wins.
 */

export const VALID_MODES: ReadonlySet<string> = new Set(['api', 'manual', 'cli', 'auto']);

/**
 * Built-in fallback when no layer supplies a mode. `manual` — free, no key,
 * no spend. NOT the same as the loader's `defaults.mode` default (`api`); see
 * the module header.
 */
export const DEFAULT_MODE = 'manual';

/** Raised when a configured / invoked mode is not in `VALID_MODES`. */
export class InvalidModeError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'InvalidModeError';
    }
}

/** Mirror Python `sorted(VALID_MODES)` for error messages: ['api','cli','manual']. */
function _sortedValidModes(): string[] {
    return Array.from(VALID_MODES).sort();
}

function _normalise(value: unknown): string | null {
    if (value === null || value === undefined) {
        return null;
    }
    if (typeof value !== 'string') {
        return null;
    }
    const s = value.trim().toLowerCase();
    return s || null;
}

function _validate(mode: string | null, source: string): string | null {
    if (mode === null) {
        return null;
    }
    if (!VALID_MODES.has(mode)) {
        throw new InvalidModeError(
            `${source} requested mode=${_pyRepr(mode)}; ` +
                `expected one of: ${_pyReprList(_sortedValidModes())}`,
        );
    }
    return mode;
}

/** Python repr() for a string: single-quoted. */
function _pyRepr(s: string): string {
    return `'${s}'`;
}

/** Python repr() for a list of strings: ['a', 'b']. */
function _pyReprList(items: string[]): string {
    return `[${items.map((i) => _pyRepr(i)).join(', ')}]`;
}

/**
 * Extract the global transport mode from an `ai_council` block, accepting BOTH
 * shapes the block legitimately arrives in.
 *
 * `council_cli.ts::_synthesize_ai_council_block` FLATTENS the loader's
 * `defaults.mode` onto a top-level `mode` key, so the normal path presents the
 * flat shape. But `build_members` is on the exported surface, and callers that
 * hand it a RAW `.ai-council.yml`-shaped dict present the nested shape. Reading
 * only the flat key silently dropped the configured default on that path and
 * fell through to `DEFAULT_MODE`.
 *
 * Flat wins when both are present — it is the synthesized, already-resolved
 * value. Returns `null` when neither shape carries a usable string, letting the
 * precedence chain continue to the built-in.
 */
export function resolve_global_mode(
    aiBlock: ReadonlyMap<string, unknown> | Record<string, unknown> | null | undefined,
): string | null {
    if (aiBlock === null || aiBlock === undefined) {
        return null;
    }
    const flat = _normalise(_settingsGet(aiBlock, 'mode'));
    if (flat !== null) {
        return flat;
    }
    const defaults = _settingsGet(aiBlock, 'defaults');
    if (defaults === null || defaults === undefined) {
        return null;
    }
    if (!(defaults instanceof Map) && typeof defaults !== 'object') {
        return null;
    }
    if (Array.isArray(defaults)) {
        return null;
    }
    return _normalise(
        _settingsGet(defaults as ReadonlyMap<string, unknown> | Record<string, unknown>, 'mode'),
    );
}

export interface ResolveModeOptions {
    invocationMode?: string | null;
    memberSettings?: ReadonlyMap<string, unknown> | Record<string, unknown> | null;
    globalMode?: string | null;
}

function _settingsGet(
    settings: ReadonlyMap<string, unknown> | Record<string, unknown> | null | undefined,
    key: string,
): unknown {
    if (settings === null || settings === undefined) {
        return undefined;
    }
    if (settings instanceof Map) {
        return settings.get(key);
    }
    return (settings as Record<string, unknown>)[key];
}

/**
 * Resolve the effective transport mode for one member.
 *
 * Returns one of `VALID_MODES`. Never `null`.
 *
 * Throws `InvalidModeError` if any non-empty layer requests a mode not
 * in `VALID_MODES`. The earliest layer (highest priority) is checked
 * first; later layers are not validated when an earlier one already won.
 */
export function resolve_mode(memberName: string, opts: ResolveModeOptions = {}): string {
    const invocationMode = opts.invocationMode ?? null;
    const memberSettings = opts.memberSettings ?? null;
    const globalMode = opts.globalMode ?? null;

    const inv = _validate(
        _normalise(invocationMode),
        `/council mode= for ${_pyRepr(memberName)}`,
    );
    if (inv !== null) {
        return inv;
    }

    let memberModeRaw: unknown = null;
    if (memberSettings !== null) {
        const v = _settingsGet(memberSettings, 'mode');
        memberModeRaw = v === undefined ? null : v;
    }
    const member = _validate(
        _normalise(memberModeRaw),
        `ai_council.members.${memberName}.mode`,
    );
    if (member !== null) {
        return member;
    }

    const glob = _validate(_normalise(globalMode), 'ai_council.mode');
    if (glob !== null) {
        return glob;
    }

    return DEFAULT_MODE;
}

export interface ResolveModesOptions {
    invocationMode?: string | null;
    membersSettings?:
        | ReadonlyMap<string, ReadonlyMap<string, unknown> | Record<string, unknown>>
        | Record<string, ReadonlyMap<string, unknown> | Record<string, unknown>>
        | null;
    globalMode?: string | null;
}

/**
 * Resolve modes for a batch of members. Convenience wrapper.
 *
 * `membersSettings` is the full `ai_council.members` mapping; each
 * member's sub-dict is forwarded to `resolve_mode()`.
 */
export function resolve_modes(
    memberNames: string[],
    opts: ResolveModesOptions = {},
): Record<string, string> {
    const out: Record<string, string> = {};
    const settings = opts.membersSettings ?? {};
    for (const name of memberNames) {
        out[name] = resolve_mode(name, {
            invocationMode: opts.invocationMode ?? null,
            memberSettings: (_settingsGet(settings, name) as
                | ReadonlyMap<string, unknown>
                | Record<string, unknown>
                | undefined) ?? null,
            globalMode: opts.globalMode ?? null,
        });
    }
    return out;
}
