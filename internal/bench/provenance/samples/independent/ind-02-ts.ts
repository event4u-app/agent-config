export class BoundedCache<K, V> {
    private data = new Map<K, V>();

    constructor(private readonly limit: number) {}

    has(key: K): boolean {
        return this.data.has(key);
    }

    peek(key: K): V | undefined {
        return this.data.get(key);
    }

    access(key: K): V | undefined {
        if (!this.data.has(key)) {
            return undefined;
        }
        const val = this.data.get(key) as V;
        this.touch(key, val);
        return val;
    }

    put(key: K, val: V): void {
        if (!this.data.has(key) && this.data.size >= this.limit) {
            const firstKey = [...this.data.keys()][0] as K;
            this.data.delete(firstKey);
        }
        this.touch(key, val);
    }

    private touch(key: K, val: V): void {
        this.data.delete(key);
        this.data.set(key, val);
    }
}
