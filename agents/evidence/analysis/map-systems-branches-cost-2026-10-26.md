<!-- evidence-type: analysis -->

# What the systems, provenance and branch lanes cost on this repository — 2026-10-26

> Measured once, on this repository's worktree for
> `road-to-a-map-across-systems-branches-and-time` step 6.2, at the branch's
> state after Phase 5 (12,095 commits of history, 16,182 tracked files), on one
> developer machine. One reading, not a distribution: the figures say what order
> of cost each lane adds, not a bound.

## Build

`buildFromRepo(root, cache, { lanes: true })`, whole tree, cold cache.

| Lane | ms | facts | relations |
|---|---:|---:|---:|
| runtime | 1,574 | 314 | 28 |
| history | 1,243 | 0 | 1,291 |
| interfaces | 962 | 22 | 44 |
| delivery | 277 | 351 | 334 |
| decisions | 106 | 242 | 949 |
| data | 576 | 0 | 0 |
| **systems (new)** | **3,900** | **1,322** | **4,788** |
| flows | 38 | 124 | 0 |
| whole build with lanes | 19,567 | — | — |

The systems lane is the most expensive lane here: 20 % of the whole build. Most
of it is the tool-config scan, which tests every npm package name against every
config file — 1,322 packages on this repository. If the build budget gets
tight, that scan is the first thing to bound.

## Provenance

`readProvenance(root)`: 1,228 ms for 12,095 commits, run once per HEAD and cached
under `.build/provenance.json`. The full index is 7.1 MB. The map carries only
the commits its own files and routes reference: about 1.1 MB for 11,376 files and
5,342 commits (estimated over the map's file list before this change).

## Branches

| Step | ms | fact files written | store after |
|---|---:|---:|---|
| index `origin/main` (empty store) | 54,080 | 5,372 | 0.70 MB manifests, 4.68 MB facts |
| index `HEAD` (this branch, ~100 files apart) | 2,422 | 107 | 1.39 MB manifests, 4.84 MB facts |

The first branch pays for every file. A second branch pays only for the files
it changes: 107 fact files and 0.17 MB of facts for this branch. Manifests are
full path→blob listings, about 0.7 MB per branch here. A manifest stored as a
diff against its parent would be the lever if many branches are indexed at once.

## Not measured

- Build time on a consumer repository. The fixtures prove behaviour, not cost.
- The detached refresh with the chain status. It runs local git only and was
  not timed.
