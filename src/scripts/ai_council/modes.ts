/**
 * Mode resolution for council members (Phase 2b).
 *
 * TypeScript twin of `src/scripts/ai_council/modes.py` (ADR-096 —
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
 *
 * Resolution precedence — first non-empty wins:
 *
 *     1. Invocation flag      e.g. `/council mode:manual`
 *     2. Per-member setting   `ai_council.members.<name>.mode`
 *     3. Global setting       `ai_council.mode`
 *     4. Built-in default     `manual`
 */

export const VALID_MODES: ReadonlySet<string> = new Set(['api', 'manual', 'cli']);

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
