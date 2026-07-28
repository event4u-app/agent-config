export function debounce<Args extends unknown[]>(
    callback: (...args: Args) => void,
    waitMs: number,
): (...args: Args) => void {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    return function debounced(...args: Args): void {
        if (timeoutId !== undefined) {
            clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => {
            timeoutId = undefined;
            callback(...args);
        }, waitMs);
    };
}
