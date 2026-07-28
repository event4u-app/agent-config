type AnyFunction = (...args: any[]) => void;

/**
 * Returns a wrapped version of `fn` that only runs after `delayMs`
 * milliseconds have passed without another call.
 */
export function makeDebounced<F extends AnyFunction>(fn: F, delayMs: number): F {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const wrapper = (...args: Parameters<F>): void => {
        if (timer !== undefined) {
            clearTimeout(timer);
        }
        timer = setTimeout(() => fn(...args), delayMs);
    };

    return wrapper as F;
}
