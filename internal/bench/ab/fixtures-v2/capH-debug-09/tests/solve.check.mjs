// HIDDEN behavior check — not named in the prompt.
// A prerequisite that is only ever referenced (never declared as a key) is a
// real task and MUST appear in the output before its dependents. Fixing this
// must NOT disable cycle detection: a genuine cycle still has to throw.
import { topoSort } from '../src/toposort.mjs';

let failed = false;
function ok(cond, label) {
  if (!cond) {
    console.error(`FAIL ${label}`);
    failed = true;
  }
}
function before(order, x, y) {
  return order.indexOf(x) !== -1 && order.indexOf(y) !== -1 && order.indexOf(x) < order.indexOf(y);
}
function sameSet(a, b) {
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.length === sb.length && sa.every((v, i) => v === sb[i]);
}

// --- Case 1: the reported symptom (diamond rooted at an undeclared prereq) ---
{
  let order;
  let threw = false;
  try {
    order = topoSort({ build: ['lint', 'test'], lint: ['setup'], test: ['setup'] });
  } catch (e) {
    threw = true;
  }
  ok(!threw, 'case1: must not throw on a valid graph');
  if (!threw) {
    ok(sameSet(order, ['setup', 'lint', 'test', 'build']), 'case1: output contains all four tasks (incl. undeclared setup)');
    ok(before(order, 'setup', 'lint'), 'case1: setup before lint');
    ok(before(order, 'setup', 'test'), 'case1: setup before test');
    ok(before(order, 'lint', 'build'), 'case1: lint before build');
    ok(before(order, 'test', 'build'), 'case1: test before build');
  }
}

// --- Case 2: fully-declared diamond still orders correctly ---
{
  const order = topoSort({ a: [], b: ['a'], c: ['a'], d: ['b', 'c'] });
  ok(sameSet(order, ['a', 'b', 'c', 'd']), 'case2: all nodes present');
  ok(before(order, 'a', 'd'), 'case2: a before d');
  ok(before(order, 'b', 'd'), 'case2: b before d');
  ok(before(order, 'c', 'd'), 'case2: c before d');
}

// --- Case 3: a real cycle MUST still be detected (regression guard) ---
{
  let threw = false;
  try {
    topoSort({ x: ['y'], y: ['z'], z: ['x'] });
  } catch (e) {
    threw = e.message === 'cycle detected';
  }
  ok(threw, 'case3: genuine cycle must throw "cycle detected"');
}

// --- Case 4: deterministic tie-break by name ---
{
  const order = topoSort({ root: [], beta: ['root'], alpha: ['root'] });
  // root first; then alpha before beta (localeCompare)
  ok(order[0] === 'root', 'case4: root first');
  ok(before(order, 'alpha', 'beta'), 'case4: alpha before beta (tie-break)');
}

// --- Case 5: chain with an undeclared leaf at the deep end ---
{
  let order;
  let threw = false;
  try {
    order = topoSort({ a: ['b'], b: ['c'] }); // c undeclared
  } catch (e) {
    threw = true;
  }
  ok(!threw, 'case5: must not throw on a valid chain');
  if (!threw) {
    ok(sameSet(order, ['a', 'b', 'c']), 'case5: undeclared deep leaf present');
    ok(before(order, 'c', 'b') && before(order, 'b', 'a'), 'case5: c, b, a order');
  }
}

if (failed) {
  process.exit(1);
}
console.log('ok');
