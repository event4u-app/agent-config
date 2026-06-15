// Deterministic topological sort (Kahn's algorithm).
//
// Input: a plain object mapping each task to the list of tasks it depends on
// (its prerequisites). Every prerequisite must appear before the task that
// needs it in the returned order.
//
//   topoSort({ build: ['compile'], compile: ['fetch'], fetch: [] })
//     -> ['fetch', 'compile', 'build']
//
// Determinism: among tasks that become ready at the same time, the one whose
// name sorts first (localeCompare) is emitted first, so the output is stable.
//
// A genuine dependency cycle throws Error('cycle detected').

export function topoSort(deps) {
  const inDegree = new Map();
  const dependents = new Map(); // prereq -> [tasks that need it]

  // Seed structures from the declared tasks.
  for (const task of Object.keys(deps)) {
    if (!inDegree.has(task)) {
      inDegree.set(task, 0);
    }
    if (!dependents.has(task)) {
      dependents.set(task, []);
    }
    for (const prereq of deps[task]) {
      inDegree.set(task, inDegree.get(task) + 1);
      if (!dependents.has(prereq)) {
        dependents.set(prereq, []);
      }
      dependents.get(prereq).push(task);
    }
  }

  // Ready set: every task with no remaining prerequisites.
  let ready = [];
  for (const [task, degree] of inDegree) {
    if (degree === 0) {
      ready.push(task);
    }
  }
  ready.sort((a, b) => a.localeCompare(b));

  const order = [];
  while (ready.length > 0) {
    const task = ready.shift();
    order.push(task);
    const next = [];
    for (const dep of dependents.get(task)) {
      inDegree.set(dep, inDegree.get(dep) - 1);
      if (inDegree.get(dep) === 0) {
        next.push(dep);
      }
    }
    next.sort((a, b) => a.localeCompare(b));
    ready = ready.concat(next);
    ready.sort((a, b) => a.localeCompare(b));
  }

  if (order.length !== inDegree.size) {
    throw new Error('cycle detected');
  }

  return order;
}
