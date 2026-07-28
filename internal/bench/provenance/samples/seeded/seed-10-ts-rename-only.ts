// Fixed-size cache that evicts the item touched longest ago.
export class RecentUseCache<TKey, TValue> {
    private readonly maxSize: number;
    private readonly table: Map<TKey, TValue> = new Map();

    constructor(maxSize: number) {
        if (maxSize <= 0) {
            throw new Error('maxSize must be positive');
        }
        this.maxSize = maxSize;
    }

    read(k: TKey): TValue | undefined {
        if (!this.table.has(k)) {
            return undefined;
        }
        const v = this.table.get(k) as TValue;
        this.table.delete(k);
        this.table.set(k, v);
        return v;
    }

    write(k: TKey, v: TValue): void {
        if (this.table.has(k)) {
            this.table.delete(k);
        } else if (this.table.size >= this.maxSize) {
            const staleKey = this.table.keys().next().value as TKey;
            this.table.delete(staleKey);
        }
        this.table.set(k, v);
    }
}
