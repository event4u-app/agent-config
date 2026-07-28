// Delays invocation until the pause period elapses without a new call.
export function delayUntilIdle<TArgs extends unknown[]>(
    fn: (...a: TArgs) => void,
    pauseMs: number,
): (...a: TArgs) => void {
    let pendingHandle: ReturnType<typeof setTimeout> | undefined;

    return function wrapped(...a: TArgs): void {
        if (pendingHandle !== undefined) {
            clearTimeout(pendingHandle);
        }
        pendingHandle = setTimeout(() => {
            pendingHandle = undefined;
            fn(...a);
        }, pauseMs);
    };
}
