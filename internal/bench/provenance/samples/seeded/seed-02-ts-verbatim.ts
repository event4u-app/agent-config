export class LruCache<K, V> {
    private readonly capacity: number;
    private readonly store: Map<K, V> = new Map();

    constructor(capacity: number) {
        if (capacity <= 0) {
            throw new Error('capacity must be positive');
        }
        this.capacity = capacity;
    }

    get(key: K): V | undefined {
        if (!this.store.has(key)) {
            return undefined;
        }
        const value = this.store.get(key) as V;
        this.store.delete(key);
        this.store.set(key, value);
        return value;
    }

    set(key: K, value: V): void {
        if (this.store.has(key)) {
            this.store.delete(key);
        } else if (this.store.size >= this.capacity) {
            const oldestKey = this.store.keys().next().value as K;
            this.store.delete(oldestKey);
        }
        this.store.set(key, value);
    }
}
