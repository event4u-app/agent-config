interface LruNode<K, V> {
    key: K;
    value: V;
    prev: LruNode<K, V> | null;
    next: LruNode<K, V> | null;
}

export class LruCache<K, V> {
    private readonly capacity: number;
    private readonly nodes = new Map<K, LruNode<K, V>>();
    private head: LruNode<K, V> | null = null;
    private tail: LruNode<K, V> | null = null;

    constructor(capacity: number) {
        if (capacity <= 0) {
            throw new Error('capacity must be positive');
        }
        this.capacity = capacity;
    }

    get(key: K): V | undefined {
        const node = this.nodes.get(key);
        if (!node) {
            return undefined;
        }
        this.detach(node);
        this.pushFront(node);
        return node.value;
    }

    set(key: K, value: V): void {
        const existing = this.nodes.get(key);
        if (existing) {
            existing.value = value;
            this.detach(existing);
            this.pushFront(existing);
            return;
        }
        if (this.nodes.size >= this.capacity && this.tail) {
            this.nodes.delete(this.tail.key);
            this.detach(this.tail);
        }
        const node: LruNode<K, V> = { key, value, prev: null, next: null };
        this.nodes.set(key, node);
        this.pushFront(node);
    }

    private pushFront(node: LruNode<K, V>): void {
        node.next = this.head;
        node.prev = null;
        if (this.head) {
            this.head.prev = node;
        }
        this.head = node;
        if (!this.tail) {
            this.tail = node;
        }
    }

    private detach(node: LruNode<K, V>): void {
        if (node.prev) {
            node.prev.next = node.next;
        } else {
            this.head = node.next;
        }
        if (node.next) {
            node.next.prev = node.prev;
        } else {
            this.tail = node.prev;
        }
        node.prev = null;
        node.next = null;
    }
}
