// HIDDEN capability check — not named in the prompt.
// Verifies the build-order invariants on a range of graph shapes:
//   (1) every node reachable from `start` appears EXACTLY ONCE,
//   (2) for every acyclic edge node -> dep, `dep` comes before `node`,
//   (3) `start` is the last element,
//   (4) cyclic graphs terminate (no infinite recursion).
// Sibling order is free — only the invariants are asserted, so any correct
// resolver passes regardless of which equally-valid order it emits.
import { resolveOrder } from '../src/resolve.mjs';

let failed = false;
function fail(msg) {
  console.error('FAIL ' + msg);
  failed = true;
}

// Reachable set from start (ignoring nothing; cycles fine).
function reachable(graph, start) {
  const seen = new Set();
  const stack = [start];
  while (stack.length) {
    const n = stack.pop();
    if (seen.has(n)) continue;
    seen.add(n);
    for (const d of graph[n] ?? []) stack.push(d);
  }
  return seen;
}

function check(label, graph, start) {
  let order;
  try {
    order = resolveOrder(graph, start);
  } catch (e) {
    fail(`${label}: threw ${e.constructor.name} (did not terminate / errored)`);
    return;
  }

  // (1) exactly once, and exactly the reachable set.
  const want = reachable(graph, start);
  if (order.length !== new Set(order).size) {
    fail(`${label}: duplicate entries in output ${JSON.stringify(order)}`);
  }
  if (new Set(order).size !== want.size) {
    fail(`${label}: expected ${want.size} unique nodes, got ${new Set(order).size} (${JSON.stringify(order)})`);
  }
  for (const n of want) {
    if (!order.includes(n)) fail(`${label}: missing reachable node ${n}`);
  }

  // (3) start last.
  if (order[order.length - 1] !== start) {
    fail(`${label}: start "${start}" must be last, got ${JSON.stringify(order)}`);
  }

  // (2) dependency-before-dependent for every edge NOT on a cycle.
  const pos = new Map(order.map((n, i) => [n, i]));
  for (const node of want) {
    for (const dep of graph[node] ?? []) {
      if (!want.has(dep)) continue;
      // Skip edges that close a cycle (dep can reach node back).
      const depReachesNode = reachable(graph, dep).has(node);
      if (depReachesNode) continue; // part of a cycle — order undefined, allowed
      if (pos.get(dep) >= pos.get(node)) {
        fail(`${label}: dep "${dep}" must come before "${node}" — got ${JSON.stringify(order)}`);
      }
    }
  }
}

check('chain', { a: ['b'], b: ['c'], c: [] }, 'a');
check('diamond', { a: ['b', 'c'], b: ['d'], c: ['d'], d: [] }, 'a');
check('wide-shared', { a: ['b', 'c', 'd'], b: ['e'], c: ['e'], d: ['e'], e: [] }, 'a');
check('deep-shared', { a: ['b', 'c'], b: ['d', 'e'], c: ['e', 'f'], d: ['g'], e: ['g'], f: ['g'], g: [] }, 'a');
check('two-cycle', { a: ['b'], b: ['a'] }, 'a');
check('cycle-with-diamond', { a: ['b', 'c'], b: ['d'], c: ['d'], d: ['a'] }, 'a');
check('self-loop', { a: ['a', 'b'], b: [] }, 'a');

if (failed) {
  process.exit(1);
}
console.log('ok');
