export class Debouncer<TArgs extends unknown[]> {
    private handle: ReturnType<typeof setTimeout> | null = null;

    constructor(
        private readonly action: (...args: TArgs) => void,
        private readonly delayMs: number,
    ) {}

    trigger(...args: TArgs): void {
        this.cancel();
        this.handle = setTimeout(() => {
            this.handle = null;
            this.action(...args);
        }, this.delayMs);
    }

    cancel(): void {
        if (this.handle !== null) {
            clearTimeout(this.handle);
            this.handle = null;
        }
    }
}

export function debounce<TArgs extends unknown[]>(
    action: (...args: TArgs) => void,
    delayMs: number,
): (...args: TArgs) => void {
    const instance = new Debouncer(action, delayMs);
    return (...args: TArgs) => instance.trigger(...args);
}
