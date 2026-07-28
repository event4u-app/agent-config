export function sortByDependencies(all: string[], pairs: Array<[string, string]>): string[] {
    const indegree: Record<string, number> = {};
    const outgoing: Record<string, string[]> = {};

    all.forEach((n) => {
        indegree[n] = 0;
        outgoing[n] = [];
    });

    pairs.forEach(([a, b]) => {
        outgoing[a]?.push(b);
        indegree[b] = (indegree[b] ?? 0) + 1;
    });

    const queue = all.filter((n) => indegree[n] === 0);
    const sorted: string[] = [];

    let i = 0;
    while (i < queue.length) {
        const node = queue[i] as string;
        i += 1;
        sorted.push(node);
        for (const next of outgoing[node] ?? []) {
            indegree[next] = (indegree[next] ?? 0) - 1;
            if (indegree[next] === 0) {
                queue.push(next);
            }
        }
    }

    if (sorted.length !== all.length) {
        throw new Error('cycle detected');
    }

    return sorted;
}
