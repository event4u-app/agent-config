/**
 * The `memory_signal` tool's answer shapes, kept out of `tools.ts`.
 *
 * `memorySignal` is passed in rather than imported so `tools.ts` keeps loading
 * the module lazily; the type-only import below is erased at runtime.
 */
import type * as MemorySignal from '../../agent-src/templates/scripts/memory_signal.js';

/** Run `emit` through `run` (the caller's chdir window) and shape every outcome. */
export async function memorySignalAnswer(
    memorySignal: typeof MemorySignal,
    run: <T>(fn: () => T | Promise<T>) => Promise<T>,
    entryType: string,
    anchorPath: string,
    body: string,
): Promise<Record<string, unknown>> {
    let record: Record<string, unknown> | null;
    try {
        record = await run(() => memorySignal.emit(entryType, anchorPath, body));
    } catch (e) {
        // A capture refusal is an answer, not a tool failure: the caller learns
        // which category refused it and the intake file is untouched.
        if (e instanceof memorySignal.CaptureRefusedError) {
            return {
                recorded: false,
                refused: true,
                category: e.category,
                reason: e.message,
                entry_type: entryType,
                path: anchorPath,
            };
        }
        throw e;
    }
    if (record === null) {
        return {
            recorded: false,
            skipped: true,
            reason:
                `already emitted within the ` +
                `${memorySignal.RATE_LIMIT_WINDOW_DAYS}d rate-limit window`,
            entry_type: entryType,
            path: anchorPath,
        };
    }
    return { recorded: true, signal: record };
}
