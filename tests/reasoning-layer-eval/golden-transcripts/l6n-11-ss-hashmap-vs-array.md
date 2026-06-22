# Transcript — slot 11: ss-hashmap-vs-array

- **Band:** standard · **Mechanism:** stateless
- **Captured:** 2026-06-22 (controlled system-prompt differential; rater 2 = model scorer)

## Prompt

Should I use a hash map or a sorted array for a read-heavy lookup of about 500 stable keys?

## Transcript — distributed (claude-haiku-4-5-20251001)

~~~text
## Working notes

**Constraints & facts:**
- 500 keys (small, fits in L3 cache)
- Read-heavy (writes are rare/absent)
- Keys are stable (no churn)
- Lookup is the bottleneck, not insertion/deletion

**What matters here:**
1. Cache locality (sorted array wins; hash map has pointer chasing)
2. Constant-factor overhead (hash map: hashing + probing; array: binary search or linear scan)
3. Memory footprint (sorted array is denser)
4. Implementation friction (language, stdlib, existing code pattern)

**The deciding factor:**
At 500 items in a read-heavy path, **cache misses dominate CPU time**, not algorithmic complexity. A sorted array with binary search will outperform a hash map on modern hardware because:
- Array access is sequential/predictable → CPU prefetch works
- Hash map requires indirection (hash → bucket → collision chain) → cache miss per lookup
- 500 items fit in L3; you're not doing "large hash map" tricks

**Edge case that flips the answer:**
If keys are non-integer and hashing is cheap (e.g., string interning with identity hash), hash map can be competitive. If you need sub-microsecond latency on every lookup, array + binary search is safer.

---

## Answer

**Use a sorted array.**

For 500 stable keys in a read-heavy workload, a sorted array with binary search (or linear scan if keys are accessed sequentially) will beat a hash map on latency and cache behavior. The 500-item size means you stay cache-resident, and the CPU can prefetch sequential memory. Hash map lookups require indirection that causes cache misses.

**Hash map wins only if:**
- You need O(1) worst-case latency guarantees (binary search is O(log n), but with better constants on real hardware)
- You insert/delete frequently enough to amortize the cost of maintaining sorted order
- Profiling shows hash lookups are not your bottleneck (measure first)

**Recommendation:** Benchmark both on your actual key distribution and access pattern. Start with a sorted array; it's simpler, and you'll likely see better numbers.
~~~

**Tokens:** in 672 / out 512 / est $0.009696 · rater2 {"dim1":3,"dim2":3,"dim3":3,"dim4":3,"reasoning_extraction_refusal":false,"note":"Excellent: grounded constraints, resolved cache-locality as load-bearing factor, clean answer with evidence-based conclusion."}

## Transcript — orchestrated (claude-haiku-4-5-20251001)

~~~text
## Working notes

**Constraints & facts:**
- 500 stable keys (no churn, insertions/deletions are rare or absent)
- Read-heavy workload (lookup dominates)
- Trade-off space: hash map vs. sorted array
- Unknown: access patterns (uniform? hot-spot?), latency sensitivity, memory constraints, language/platform context

**Load-bearing unknowns:**
1. Do you need range queries or prefix matching? (sorted array only)
2. Is cache locality / memory footprint a concern? (sorted array wins)
3. Are you in a latency-sensitive context (e.g., microsecond-scale)? (hash map typically better)
4. Language/runtime? (GC pressure, hash quality, branch prediction matter)

**Real goal inference:** Maximize read throughput and minimize latency for ~500 stable lookups, with minimal implementation complexity.

---

## Answer

**Use a hash map** unless you have a specific reason not to.

**Why:**
- For simple key-value lookups on 500 stable keys, a hash map gives **O(1) amortized lookup** vs. O(log 500) ≈ O(9) for sorted array. The constant factors are low.
- Hash map insertion/rehash is not a concern (keys are stable).
- You avoid branch misprediction cost from binary search.

**Switch to sorted array only if:**
- You need **range queries, prefix matching, or iteration in sorted order** (hash map can't do this efficiently).
- You're in an **embedded or memory-constrained environment** (sorted array is denser).
- Profiling shows cache misses dominate, and the workload is **extremely latency-sensitive** (sorted array can fit in cache and has sequential access patterns). This is rare at 500 keys.

**Quick sanity check:** 500 keys in a hash map is trivial. Collision likelihood is negligible with a decent hash function. No special tuning needed.

If you haven't profiled yet and latency/throughput isn't a known bottleneck, go with hash map—it's the safer default and simpler to reason about.
~~~

**Tokens:** in 826 / out 497 / est $0.009933 · rater2 {"dim1":3,"dim2":2,"dim3":2,"dim4":3,"reasoning_extraction_refusal":false,"note":"Strong notes-first; answer clean. Grounding partial (assumes simple lookup). Some premature hash-map lean before all gaps closed."}

**Output-token overhead (orchestrated vs distributed):** -2.9%
