/**
 * The executable bound of the `/roadmap:process-*` drain loop.
 *
 * A roadmap's finite step list is the loop's SUCCESS condition (`count_open`
 * reaches zero), not an iteration cap: a step that keeps re-opening, or steps
 * the run adds to its own roadmap, leave the loop running with nothing
 * counting. The run calls `agent-config sessions:claim <slug> --step` before
 * each step; this module decides whether that step may start.
 *
 * Two refusals, each a terminal reason the command already names:
 *
 * - `iteration-cap` — more ticks than {@link processLoopIterationCap} allows for
 *   the open count the run started with. Fires even while every tick shows
 *   movement, which is the case the stall window alone cannot see.
 * - `stagnated` — the open count has not fallen across
 *   {@link PROCESS_LOOP_STALL_WINDOW} consecutive ticks.
 *
 * Pure: the caller reads the roadmap and persists the state. No clock, no
 * subprocess, so the decision is the same on every host.
 */

/** Floor of the iteration cap, so a one-step roadmap still has room to retry. */
export const PROCESS_LOOP_MIN_CAP = 12;

/**
 * Consecutive ticks without a falling open count that end the run. Three, the
 * same budget the command gives a red it cannot clear (halt condition 5).
 */
export const PROCESS_LOOP_STALL_WINDOW = 3;

/** Maximum ticks for a run that began with `openAtStart` open steps. */
export function processLoopIterationCap(openAtStart: number): number {
    return Math.max(PROCESS_LOOP_MIN_CAP, 2 * Math.max(0, openAtStart) + 2);
}

export interface ProcessLoopState {
    /** Open steps when the first tick was taken. */
    readonly open_at_start: number;
    /** Open steps at every tick, oldest first. */
    readonly open_history: readonly number[];
}

export type ProcessLoopVerdict =
    | { readonly ok: true; readonly iteration: number; readonly cap: number }
    | { readonly ok: false; readonly reason: 'iteration-cap' | 'stagnated'; readonly detail: string };

/** Record one tick at `openNow` open steps and decide whether the step may start. */
export function tickProcessLoop(
    state: ProcessLoopState | null,
    openNow: number,
): { state: ProcessLoopState; verdict: ProcessLoopVerdict } {
    const next: ProcessLoopState =
        state === null
            ? { open_at_start: openNow, open_history: [openNow] }
            : { open_at_start: state.open_at_start, open_history: [...state.open_history, openNow] };
    const iteration = next.open_history.length;
    const cap = processLoopIterationCap(next.open_at_start);
    if (openNow === 0) return { state: next, verdict: { ok: true, iteration, cap } };
    if (iteration > cap) {
        return {
            state: next,
            verdict: {
                ok: false,
                reason: 'iteration-cap',
                detail: `tick ${String(iteration)} exceeds the cap of ${String(cap)} for a run that began with ${String(next.open_at_start)} open step(s)`,
            },
        };
    }
    const h = next.open_history;
    if (h.length > PROCESS_LOOP_STALL_WINDOW && (h[h.length - 1] ?? 0) >= (h[h.length - 1 - PROCESS_LOOP_STALL_WINDOW] ?? 0)) {
        return {
            state: next,
            verdict: {
                ok: false,
                reason: 'stagnated',
                detail: `${String(openNow)} step(s) still open after ${String(PROCESS_LOOP_STALL_WINDOW)} ticks without the count falling`,
            },
        };
    }
    return { state: next, verdict: { ok: true, iteration, cap } };
}
