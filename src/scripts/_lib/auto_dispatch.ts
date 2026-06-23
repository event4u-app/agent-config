/**
 * Auto-dispatch classification (v1 — deterministic).
 *
 * Pure, no-I/O encoding of the rule-based classifier described in
 * `src/agent-src/contexts/execution/auto-dispatch-classification.md`.
 *
 * Decides whether a task is delegable to subagents and which
 * `subagent-orchestration` mode fits — with NO per-turn LLM meta-call.
 *
 * Contract highlights:
 * - A task is delegable only on an enumerated structural signal.
 * - Trivial tasks below the size floor never delegate.
 * - Ambiguity → `ask` (when `auto == 'ask'`) or in-session, never speculative
 *   spawn.
 * - The activation gate (`enabled`, `auto != off`, `subagent_spawn`) runs
 *   first; any failure short-circuits to in-session.
 */

/** Minimum task-size estimate (exclusive) below which a task never delegates. */
export const SIZE_FLOOR = 1;

export type AutoMode = 'off' | 'ask' | 'on';
export type DispatchMode = 'do-in-steps' | 'do-in-parallel';
export type DispatchAction = 'dispatch' | 'ask' | 'in-session';

/** Task descriptor — structural signals only, no task body. */
export interface TaskSignals {
    /** Frontmatter `parallelizable:` value of the skill/command in play, if any. */
    parallelizable?: 'steps' | 'files' | 'independent' | null;
    /** Task is an explicit ordered plan (numbered steps / phase / checklist). */
    ordered_plan?: boolean;
    /** Count of independent same-shape targets (e.g. 5 files to review). */
    independent_slices?: number;
    /** Orchestrator's pre-dispatch size estimate (abstract units). */
    size_estimate: number;
}

/** Activation inputs resolved from settings + the host-capability manifest. */
export interface ActivationInputs {
    enabled: boolean;
    auto: AutoMode;
    subagent_spawn: boolean;
}

export interface Classification {
    delegable: boolean;
    action: DispatchAction;
    mode: DispatchMode | null;
    reason: string;
}

function inSession(reason: string): Classification {
    return { delegable: false, action: 'in-session', mode: null, reason };
}

/**
 * Classify a task for auto-dispatch. Activation gate first, then the
 * deterministic delegable-signal rules.
 */
export function classifyTask(signals: TaskSignals, activation: ActivationInputs): Classification {
    // ── Activation gate — any failure short-circuits to in-session ──
    if (!activation.enabled) return inSession('subagents.enabled is false');
    if (activation.auto === 'off') return inSession('subagents.auto is off');
    if (!activation.subagent_spawn) return inSession('host has no subagent_spawn primitive');

    // ── Size floor — trivial tasks never delegate ──
    if (!(signals.size_estimate > SIZE_FLOOR)) {
        return inSession(`task below size floor (${signals.size_estimate} <= ${SIZE_FLOOR})`);
    }

    // ── Delegable-signal rules (enumerated; ambiguity never spawns) ──
    const slices = signals.independent_slices ?? 0;
    let mode: DispatchMode | null = null;
    let reason = '';

    if (signals.parallelizable === 'steps' || signals.ordered_plan === true) {
        mode = 'do-in-steps';
        reason = signals.parallelizable === 'steps' ? 'declared parallelizable: steps' : 'ordered-plan structure';
    } else if (signals.parallelizable === 'files' || signals.parallelizable === 'independent' || slices >= 2) {
        mode = 'do-in-parallel';
        reason = signals.parallelizable ? `declared parallelizable: ${signals.parallelizable}` : `independent slices (${slices})`;
    }

    if (mode === null) {
        // No enumerated signal matched → ambiguous. Ask under `ask`, else in-session.
        if (activation.auto === 'ask') {
            return { delegable: false, action: 'ask', mode: null, reason: 'no delegable signal — borderline, ask' };
        }
        return inSession('no enumerated delegable signal matched');
    }

    // Matched a signal. Dispatch under `on`, ask under `ask`.
    const action: DispatchAction = activation.auto === 'on' ? 'dispatch' : 'ask';
    return { delegable: true, action, mode, reason };
}
