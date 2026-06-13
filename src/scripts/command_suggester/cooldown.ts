/**
 * Suppress recently-shown suggestions per conversation.
 *
 * TypeScript twin of `src/scripts/command_suggester/cooldown.py`
 * (ADR-094 py2ts).
 *
 * Cooldown key is `(command_name, evidence)` so two distinct triggers
 * for the same command (e.g. `/commit` from "git status shows changes"
 * vs. from "save this to git") track separately. The user explicitly
 * invoking a command via `/command` clears that command's cooldown so
 * the next genuine match surfaces immediately.
 *
 * The store is in-memory; persistence is the agent's job (conversation
 * state). Phase 5 wires the per-conversation `disabled_for_conversation`
 * flag into the same store.
 *
 * Timing note (ADR-094 OS/clock determinism): the wall-clock comparison
 * in `is_cooled_down` is time-dependent. Tests inject a fixed `now`
 * (the Python tests do the same via the `now=` kwarg); golden parity
 * never byte-compares a raw timestamp, only the structural decision.
 */

import {
    CommandSpec,
    CooldownState,
    cooldownKey,
    cooldownKeyCommand,
    Match,
    Settings,
} from './types.js';

const _DURATION_RE = /^\s*(\d+)\s*([smhd])\s*$/i;
const _DISABLE_DIRECTIVE_RE = /(?:^|\s)\/command-suggestion-(off|on)\b/gi;
const _EXPLICIT_SLASH_RE = /^\s*\/[A-Za-z][A-Za-z0-9_-]*\b/;

/**
 * Return true when the message starts with an explicit `/command`.
 *
 * Per the `command-suggestion` rule, explicit slash invocations
 * bypass the suggestion layer entirely — they're handled by
 * `slash-command-routing-policy` directly. The engine should not score in that
 * case. Helper exposed for the runtime caller and the GT-CS4 golden.
 */
export function is_explicit_slash_invocation(message: string): boolean {
    if (!message) {
        return false;
    }
    return _EXPLICIT_SLASH_RE.test(message);
}

/**
 * Detect a `/command-suggestion-off` / `-on` directive in the user message.
 *
 * Returns `true` to disable for the rest of the conversation,
 * `false` to re-enable, `null` when no directive is present.
 * The latest occurrence in the message wins (order-stable on tie).
 * Mutating the `CooldownStore` is the caller's responsibility — this
 * helper stays pure so tests don't have to fake time.
 */
export function detect_disable_directive(message: string): boolean | null {
    if (!message) {
        return null;
    }
    let last: boolean | null = null;
    // Fresh regex state each call (the literal is shared + global).
    _DISABLE_DIRECTIVE_RE.lastIndex = 0;
    let m: RegExpExecArray | null = _DISABLE_DIRECTIVE_RE.exec(message);
    while (m !== null) {
        last = (m[1] ?? '').toLowerCase() === 'off';
        m = _DISABLE_DIRECTIVE_RE.exec(message);
    }
    return last;
}

/**
 * Convert `'10m'` / `'30s'` / `'1h'` / `'2d'` to seconds.
 *
 * Returns `default_seconds` for any malformed or missing input —
 * keeping the runtime fail-soft. The schema validator caps the
 * string length, so we never see absurd inputs in practice.
 */
export function parse_cooldown(
    value: string | null | undefined,
    default_seconds: number,
): number {
    if (!value) {
        return default_seconds;
    }
    const m = _DURATION_RE.exec(String(value));
    if (!m) {
        return default_seconds;
    }
    const n = parseInt(m[1]!, 10);
    const unit = (m[2] ?? '').toLowerCase();
    const factor: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
    return n * (factor[unit] ?? 1);
}

/**
 * Thin wrapper around `CooldownState` with time-aware helpers.
 *
 * Tests inject a fixed `now` to make decay deterministic; runtime
 * leaves it as the wall clock (`Date.now() / 1000`, matching Python's
 * `time.time()` seconds-since-epoch float).
 */
export class CooldownStore {
    readonly state: CooldownState;
    private readonly _now: () => number;

    constructor(options: { state?: CooldownState | null; now?: () => number } = {}) {
        this.state = options.state ?? new CooldownState();
        this._now = options.now ?? (() => Date.now() / 1000);
    }

    is_cooled_down(
        command: string,
        evidence: string,
        options: { window_seconds: number },
    ): boolean {
        const last = this.state.last_shown.get(cooldownKey(command, evidence));
        if (last === undefined) {
            return false;
        }
        return this._now() - last < options.window_seconds;
    }

    record_shown(matches: Match[]): void {
        const ts = this._now();
        for (const m of matches) {
            this.state.last_shown.set(cooldownKey(m.command, m.evidence), ts);
        }
    }

    /**
     * Clear the cooldown when the user explicitly types `/command`.
     *
     * We drop every entry for that command (across all evidences)
     * so a deliberate invocation always produces a clean slate.
     */
    record_explicit_invocation(command: string): void {
        const ts = this._now();
        this.state.explicit_invocations.set(command, ts);
        const keys_to_drop: string[] = [];
        for (const k of this.state.last_shown.keys()) {
            if (cooldownKeyCommand(k) === command) {
                keys_to_drop.push(k);
            }
        }
        for (const k of keys_to_drop) {
            this.state.last_shown.delete(k);
        }
    }
}

export function apply_cooldown(
    matches: Match[],
    store: CooldownStore,
    settings: Settings,
    specs_by_name: Map<string, CommandSpec> | ReadonlyMap<string, CommandSpec>,
): Match[] {
    if (store.state.disabled_for_conversation) {
        return [];
    }
    const out: Match[] = [];
    for (const m of matches) {
        const spec = specs_by_name.get(m.command);
        const per_cmd = spec ? spec.cooldown : null;
        const window = parse_cooldown(per_cmd, settings.cooldown_seconds);
        if (store.is_cooled_down(m.command, m.evidence, { window_seconds: window })) {
            continue;
        }
        out.push(m);
    }
    return out;
}
