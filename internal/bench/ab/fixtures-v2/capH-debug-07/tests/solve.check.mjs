// HIDDEN behavior check — not named in the prompt.
// Asserts the full LRU contract: BOTH get and set refresh recency, and an
// in-place value update of an existing key must NOT change cache size or evict
// anything. A fix that only patches the reported symptom but lets the
// existing-key branch fall through to eviction will break the size/identity
// cases below.
import { LruCache } from '../src/lru.mjs';

let failed = false;
function ok(cond, label) {
  if (!cond) {
    console.error(`FAIL ${label}`);
    failed = true;
  }
}
function eqArr(a, b) {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

// --- Case 1: the reported symptom ---
// set('a'), set('b'), set('c')  -> cache [a,b,c], cap 3
// set('a', 99)                  -> updating 'a' must make 'a' most-recent
// set('d', 4)                   -> full, evict LRU which is now 'b'
{
  const c = new LruCache(3);
  c.set('a', 1);
  c.set('b', 2);
  c.set('c', 3);
  c.set('a', 99); // update existing -> refreshes recency of 'a'
  c.set('d', 4);  // evict LRU
  ok(c.get('b') === undefined, "case1: 'b' should be evicted (was LRU)");
  ok(c.get('a') === 99, "case1: 'a' kept and value updated");
  ok(c.get('c') === 3, "case1: 'c' kept");
  ok(c.get('d') === 4, "case1: 'd' inserted");
}

// --- Case 2: in-place update must not change size or evict ---
{
  const c = new LruCache(2);
  c.set('x', 1);
  c.set('y', 2);
  c.set('x', 10); // update existing while full -> NO eviction, size stays 2
  ok(c.keys().length === 2, 'case2: size stays 2 after in-place update');
  ok(c.get('x') === 10, "case2: 'x' updated");
  ok(c.get('y') === 2, "case2: 'y' must NOT be evicted by an update");
}

// --- Case 3: get also refreshes recency (regression guard) ---
{
  const c = new LruCache(2);
  c.set('p', 1);
  c.set('q', 2);
  c.get('p');     // touch 'p' -> 'q' is now LRU
  c.set('r', 3);  // evict LRU which is 'q'
  ok(c.get('q') === undefined, "case3: 'q' should be evicted after get('p')");
  ok(c.get('p') === 1, "case3: 'p' kept");
  ok(c.get('r') === 3, "case3: 'r' inserted");
}

// --- Case 4: insertion eviction order, no touches ---
{
  const c = new LruCache(2);
  c.set('m', 1);
  c.set('n', 2);
  c.set('o', 3); // evict 'm'
  ok(eqArr(c.keys(), ['n', 'o']), 'case4: plain insertion eviction order');
}

if (failed) {
  process.exit(1);
}
console.log('ok');
