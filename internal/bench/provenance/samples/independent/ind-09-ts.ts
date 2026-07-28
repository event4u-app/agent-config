type AnyFunction = (...args: any[]) => void;

/**
 * Returns a throttled wrapper that invokes `fn` at most once per
 * `intervalMs`, running immediately on the first call.
 */
export function throttle<F extends AnyFunction>(fn: F, intervalMs: number): F {
    let lastCallTime = 0;
    let pendingArgs: Parameters<F> | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const invoke = (args: Parameters<F>): void => {
        lastCallTime = Date.now();
        fn(...args);
    };

    const wrapper = (...args: Parameters<F>): void => {
        const now = Date.now();
        const elapsed = now - lastCallTime;

        if (elapsed >= intervalMs) {
            invoke(args);
            return;
        }

        pendingArgs = args;
        if (timer === null) {
            timer = setTimeout(() => {
                timer = null;
                if (pendingArgs) {
                    invoke(pendingArgs);
                    pendingArgs = null;
                }
            }, intervalMs - elapsed);
        }
    };

    return wrapper as F;
}
