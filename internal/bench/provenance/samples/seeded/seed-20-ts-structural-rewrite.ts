type VisitState = 'unvisited' | 'visiting' | 'done';

export function topologicalSort(nodes: string[], edges: Array<[string, string]>): string[] {
    const adjacency = new Map<string, string[]>();
    for (const node of nodes) {
        adjacency.set(node, []);
    }
    for (const [from, to] of edges) {
        adjacency.get(from)!.push(to);
    }

    const state = new Map<string, VisitState>(nodes.map((n) => [n, 'unvisited']));
    const stack: string[] = [];

    function visit(node: string): void {
        const status = state.get(node);
        if (status === 'done') {
            return;
        }
        if (status === 'visiting') {
            throw new Error('graph contains a cycle');
        }
        state.set(node, 'visiting');
        for (const neighbor of adjacency.get(node) ?? []) {
            visit(neighbor);
        }
        state.set(node, 'done');
        stack.push(node);
    }

    for (const node of nodes) {
        visit(node);
    }

    return stack.reverse();
}
