// Dependency-order resolver.
//
// `graph` maps a node id to the list of node ids it directly depends on.
// resolveOrder(graph, start) returns a build order: a list in which every
// dependency appears BEFORE the node that needs it, `start` appears last,
// and each node appears exactly ONCE. The graph may contain cycles; a node
// already being expanded on the current path is not expanded again, so the
// resolver always terminates.

/**
 * @param {Record<string, string[]>} graph  adjacency: node -> direct deps.
 * @param {string} start  the node whose build order we want.
 * @returns {string[]} dependency-first order, ending with `start`.
 */
export function resolveOrder(graph, start) {
  const order = [];

  function visit(node, onPath) {
    if (onPath.has(node)) {
      // Already being expanded above us on this path — a cycle. Stop here.
      return;
    }
    onPath.add(node);

    const deps = graph[node] ?? [];
    for (const dep of deps) {
      visit(dep, onPath);
    }

    onPath.delete(node);
    order.push(node);
  }

  visit(start, new Set());
  return order;
}
