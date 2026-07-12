/**
 * ai_team configuration loader — single source of truth for the `/team`
 * cross-model review family.
 *
 * Mirrors the fail-closed validation posture of the council loader
 * (`src/scripts/ai_council/config.ts`) at a fraction of its surface: the
 * `ai_team` block has five flat keys and no nested sub-schemas, so this
 * loader is deliberately lean — defaults, per-key type checks, and hard
 * unknown-key rejection. Contract: `docs/contracts/ai-team-config.md`.
 *
 * Unlike the council (ALWAYS user-global `.ai-council.yml`, ADR-104),
 * `ai_team` lives in the PROJECT settings cascade (`.agent-settings.yml`
 * via `load_agent_settings`) — team mode is a per-project posture
 * (default-off), not a per-developer credential store; the codex CLI
 * carries the subscription auth itself.
 *
 * Validation contract (all enforced at load time, fail-closed):
 *
 * 1. `ai_team` absent → defaults (feature off). Non-mapping → error.
 * 2. Unknown keys under `ai_team` are rejected — a typo must never
 *    silently disable a gate (`allow_delegate` misspelled = delegation
 *    stays off AND the load fails loudly).
 * 3. `enabled`, `allow_delegate`, `suppress_setup_hint` are booleans.
 * 4. `model` is a non-empty string. `'auto'` = pass no `--model` flag
 *    (the codex CLI default applies); any other value passes through
 *    verbatim.
 * 5. `max_calls_per_day` is a non-negative integer (bools rejected).
 */
import { load_agent_settings, type SettingsDict } from '../_lib/agent_settings.js';

/** Raised when the `ai_team` block of `.agent-settings.yml` violates the schema. */
export class TeamConfigError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'TeamConfigError';
    }
}

export interface AiTeamConfig {
    readonly enabled: boolean;
    readonly model: string;
    readonly allow_delegate: boolean;
    readonly max_calls_per_day: number;
    readonly suppress_setup_hint: boolean;
}

/** Shipped defaults — byte-parity with `src/config/agent-settings.template.yml`. */
export const AI_TEAM_DEFAULTS: AiTeamConfig = Object.freeze({
    enabled: false,
    model: 'auto',
    allow_delegate: false,
    max_calls_per_day: 50,
    suppress_setup_hint: false,
});

/**
 * Sentinel: `model: 'auto'` means "pass NO --model flag" so the codex
 * CLI's own default applies (tracks the subscription's strongest model
 * instead of pinning a stale ID).
 */
export const AI_TEAM_MODEL_AUTO = 'auto';

const _KNOWN_KEYS: ReadonlySet<string> = new Set([
    'enabled',
    'model',
    'allow_delegate',
    'max_calls_per_day',
    'suppress_setup_hint',
]);

function _isDict(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function _isBool(value: unknown): value is boolean {
    return typeof value === 'boolean';
}

function _requireBool(raw: Record<string, unknown>, key: string, fallback: boolean): boolean {
    if (!(key in raw)) {
        return fallback;
    }
    const value = raw[key];
    if (!_isBool(value)) {
        throw new TeamConfigError(
            `\`ai_team.${key}\` must be a boolean (got ${JSON.stringify(value)}).`,
        );
    }
    return value;
}

/**
 * Validate a raw `ai_team` mapping and return the typed config.
 *
 * `raw = null | undefined` (block absent) returns the defaults — the
 * feature is off, never an error. Every other shape is validated
 * fail-closed per the module contract above.
 */
export function build_ai_team_config(raw: unknown): AiTeamConfig {
    if (raw === null || raw === undefined) {
        return AI_TEAM_DEFAULTS;
    }
    if (!_isDict(raw)) {
        throw new TeamConfigError('`ai_team` must be a mapping.');
    }

    for (const key of Object.keys(raw)) {
        if (!_KNOWN_KEYS.has(key)) {
            throw new TeamConfigError(
                `ai_team.${key}: unknown key; valid: ` +
                    `[${[..._KNOWN_KEYS].map((k) => `'${k}'`).join(', ')}].`,
            );
        }
    }

    const enabled = _requireBool(raw, 'enabled', AI_TEAM_DEFAULTS.enabled);
    const allow_delegate = _requireBool(raw, 'allow_delegate', AI_TEAM_DEFAULTS.allow_delegate);
    const suppress_setup_hint = _requireBool(
        raw,
        'suppress_setup_hint',
        AI_TEAM_DEFAULTS.suppress_setup_hint,
    );

    let model = AI_TEAM_DEFAULTS.model;
    if ('model' in raw) {
        const value = raw['model'];
        if (typeof value !== 'string' || value.trim() === '') {
            throw new TeamConfigError(
                `\`ai_team.model\` must be a non-empty string (got ${JSON.stringify(value)}).`,
            );
        }
        model = value;
    }

    let max_calls_per_day = AI_TEAM_DEFAULTS.max_calls_per_day;
    if ('max_calls_per_day' in raw) {
        const value = raw['max_calls_per_day'];
        if (_isBool(value) || typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
            throw new TeamConfigError(
                '`ai_team.max_calls_per_day` must be a non-negative integer ' +
                    `(got ${JSON.stringify(value)}).`,
            );
        }
        max_calls_per_day = value;
    }

    return { enabled, model, allow_delegate, max_calls_per_day, suppress_setup_hint };
}

/**
 * Load the `ai_team` config from the merged project settings cascade.
 *
 * `opts.settings` injects a pre-merged settings dict (test seam — no
 * filesystem access); otherwise `load_agent_settings` walks the normal
 * `.agent-settings.yml` cascade from `opts.cwd` (default: process cwd).
 */
export function load_ai_team_config(
    opts: { settings?: SettingsDict | null; cwd?: string | null } = {},
): AiTeamConfig {
    const settings = opts.settings ?? load_agent_settings({ cwd: opts.cwd ?? process.cwd() });
    return build_ai_team_config((settings as Record<string, unknown>)['ai_team']);
}
