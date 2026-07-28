// Kahn-style ordering: every item appears after all its prerequisites.
export function orderByDependency(items: string[], deps: Array<[string, string]>): string[] {
    const incoming = new Map<string, number>();
    const graph = new Map<string, string[]>();

    for (const item of items) {
        incoming.set(item, 0);
        graph.set(item, []);
    }

    for (const [before, after] of deps) {
        graph.get(before)!.push(after);
        incoming.set(after, (incoming.get(after) ?? 0) + 1);
    }

    const ready: string[] = items.filter((item) => incoming.get(item) === 0);
    const result: string[] = [];

    while (ready.length > 0) {
        const item = ready.shift()!;
        result.push(item);

        for (const next of graph.get(item) ?? []) {
            const left = (incoming.get(next) ?? 0) - 1;
            incoming.set(next, left);
            if (left === 0) {
                ready.push(next);
            }
        }
    }

    if (result.length !== items.length) {
        throw new Error('graph contains a cycle');
    }

    return result;
}
