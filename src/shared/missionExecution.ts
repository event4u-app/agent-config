/**
 * Mission execution posture — the loop bound, its escalation ladder, and the
 * one setting whose value differs inside a mission.
 *
 * `road-to-adversarial-verification-and-long-runs` Phase 0. Three facts that
 * were previously either absent or stated only in prose get one module, because
 * all three are read by more than one surface (`doctor --json`, `settings:get`,
 * the recovery ladder) and a constant restated per reader is the standard way a
 * default drifts.
 *
 * **Why a mission changes `quality.local_auto_run` and nothing else does.** The
 * template's own justification for shipping `false` is that remote CI is the
 * authoritative gate and a local full-pipeline run duplicates it at wall-clock
 * cost. That argument is about a CHAT turn, where the human is present, the next
 * action is theirs, and the pipeline's result arrives long after the reply. It is
 * not an argument about an autonomous mission, where nobody is waiting, the next
 * action is the agent's own, and a red found after twenty more steps costs more
 * than the pipeline run that would have found it at step one. The roadmap
 * template already says as much about the sibling cadence knob — that
 * `end_of_roadmap` lets errors compound across phases — so the two knobs are
 * corrected together rather than one at a time.
 *
 * The resolution is deliberately NOT a settings-layer precedence trick. A layer
 * is a place a human wrote a value; a mission is a runtime condition. Folding
 * the condition into the layer stack would make `settings:get` report a source
 * file for a value no file contains.
 */

/** The escalation rungs, in the order the recovery ladder walks them. */
export const ESCALATION_LADDER: readonly string[] = [
    'independent',
    'council',
    'team',
    'owner_owned_check',
] as const;

/** Default bound on consecutive failed fix attempts against one target. */
export const FIX_LOOP_MAX_DEFAULT = 10;

/** Default for `quality.local_auto_run_in_mission`. */
export const MISSION_AUTO_RUN_DEFAULT = true;

/** Where a resolved `quality.local_auto_run` value came from. */
export type AutoRunOrigin = 'mission' | 'settings';

export interface AutoRunResolution {
    /** The value a reader should act on. */
    readonly value: boolean;
    /** `mission` when the mission condition decided, `settings` otherwise. */
    readonly origin: AutoRunOrigin;
}

export interface AutoRunInputs {
    /** `quality.local_auto_run` as the settings layers resolved it. */
    readonly configured: boolean;
    /** `quality.local_auto_run_in_mission`, or `undefined` for the default. */
    readonly missionValue?: boolean | undefined;
    /** True only inside an autonomous mission (a claimed roadmap run). */
    readonly inMission: boolean;
}

/**
 * Resolve `quality.local_auto_run` for the current run.
 *
 * Outside a mission the configured value wins unchanged — that is the whole
 * point of leaving chat alone. Inside one, `local_auto_run_in_mission` decides.
 *
 * One asymmetry is deliberate: a mission never LOWERS the configured value. An
 * operator who set `local_auto_run: true` asked for pipeline runs everywhere,
 * and a mission is not a reason to give them fewer.
 */
export function resolveLocalAutoRun(inputs: AutoRunInputs): AutoRunResolution {
    if (inputs.configured) return { value: true, origin: 'settings' };
    if (!inputs.inMission) return { value: false, origin: 'settings' };
    const mission = inputs.missionValue ?? MISSION_AUTO_RUN_DEFAULT;
    return mission ? { value: true, origin: 'mission' } : { value: false, origin: 'settings' };
}

/**
 * Fold `execution.*` out of a settings-override stream, last layer wins.
 *
 * Takes the same `[dotted, value, file]` tuples `iter_setting_overrides` emits,
 * so a caller never re-implements the cascade. Keys outside the `execution.`
 * prefix are ignored rather than collected: this is a narrow reader, and a
 * reader that accidentally carries the whole settings tree is how a doctor
 * payload grows a field nobody declared.
 */
export function executionPostureFromOverrides(
    layers: Iterable<readonly [string, unknown, string]>,
): ExecutionPosture {
    const raw: Record<string, unknown> = {};
    for (const [key, value] of layers) {
        if (key === 'execution.fix_loop_max') raw['fix_loop_max'] = value;
        else if (key === 'execution.escalation') raw['escalation'] = value;
    }
    return resolveExecutionPosture(raw);
}

export interface ExecutionPosture {
    readonly fix_loop_max: number;
    readonly escalation: readonly string[];
}

/**
 * The `execution:` block as a reader should see it, defaults filled in.
 *
 * A non-integer, non-positive or absent `fix_loop_max` falls back to the default
 * rather than propagating: a bound of `0` would make every first attempt
 * terminal, which is a configuration that can only be a mistake.
 */
export function resolveExecutionPosture(raw: unknown): ExecutionPosture {
    const block = (raw ?? {}) as Record<string, unknown>;
    const rawMax = block['fix_loop_max'];
    const max =
        typeof rawMax === 'number' && Number.isInteger(rawMax) && rawMax > 0
            ? rawMax
            : FIX_LOOP_MAX_DEFAULT;
    const rawLadder = block['escalation'];
    const ladder =
        Array.isArray(rawLadder) &&
        rawLadder.length > 0 &&
        rawLadder.every((r) => typeof r === 'string')
            ? (rawLadder as string[])
            : ESCALATION_LADDER;
    return { fix_loop_max: max, escalation: ladder };
}
