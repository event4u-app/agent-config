export function topologicalSort(nodes: string[], edges: Array<[string, string]>): string[] {
    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();

    for (const node of nodes) {
        inDegree.set(node, 0);
        adjacency.set(node, []);
    }

    for (const [from, to] of edges) {
        adjacency.get(from)!.push(to);
        inDegree.set(to, (inDegree.get(to) ?? 0) + 1);
    }

    const queue: string[] = nodes.filter((node) => inDegree.get(node) === 0);
    const order: string[] = [];

    while (queue.length > 0) {
        const current = queue.shift()!;
        order.push(current);

        for (const neighbor of adjacency.get(current) ?? []) {
            const remaining = (inDegree.get(neighbor) ?? 0) - 1;
            inDegree.set(neighbor, remaining);
            if (remaining === 0) {
                queue.push(neighbor);
            }
        }
    }

    if (order.length !== nodes.length) {
        throw new Error('graph contains a cycle');
    }

    return order;
}
