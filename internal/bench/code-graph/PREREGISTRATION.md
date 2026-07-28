# Pre-registration — code-graph vs grep (2-arm, deterministic)

Registered 2026-07-28, BEFORE the first benchmark run. Fulfils
`road-to-feedback-9.8.0-followups` Phase 2 step 1; design per the roadmap's
council convergence Q2 (2026-07-26: exactly 2 arms; extra arms rejected under
the ADR-133 freeze).

## What is measured — and what is not

**Measured:** tool-level retrieval quality. For each pre-registered
code-structure question, each arm receives the SAME single probe token and
returns a set of repo files; the sets are scored against hand-verified ground
truth. This tests ADR-124's own criterion — whether the graph changes *what
the tool can answer* — at the retrieval layer, deterministically and
reproducibly (zero model calls, zero spend, re-runnable by anyone).

**Not measured:** agent-in-the-loop answer quality (an agent may compose
multiple greps, read files, reason). A model-driven replication is a recorded
possible extension, not part of this run. This scope narrowing is declared
here, before any result exists.

## Arms — uniform strategies, no per-question tuning

- **Arm A (grep):** `rg -n --no-heading` over the target repo, excluding
  `vendor/ node_modules/ dist/ .nuxt/ .git/ storage/`. Probe kind `symbol` →
  pattern `\b<probe>\b`; kind `literal` → fixed-string search (`-F`).
  Answer set = files containing ≥1 hit.
- **Arm B (code graph):** `agent-config code-graph build --root <repo> --out
  <graph>` once per repo (build time recorded, amortized), then per question
  `code-graph affected <probe> --graph <graph> --budget 500` and
  `code-graph query <probe> --graph <graph> --budget 500`. Answer set = files
  appearing in any returned relation endpoint whose symbol segment matches
  the probe (plus the defining file). No grep access for arm B; no graph
  access for arm A.

## Questions

18 questions across 3 real repos (anonymized: repo-a = a Laravel monolith,
~2.6k PHP files; repo-b = a TypeScript/React frontend, ~270 TS/TSX files;
repo-c = a mixed legacy-PHP + React repo, ~2.1k parseable files).
Categories: impact analysis (7), call path (3), symbol ownership (2),
refactor scope (2), hidden/dynamic dispatch (3, incl. one cross-language
seam), grep-optimal negative controls (3, one doubling as the cross-language
literal).

The question texts, hand-verified ground-truth keys (file:line + rationale,
3–12 sites each, decoys marked), and the per-question probe tokens contain
internal repo paths and therefore live OUTSIDE the public tree, bound here by
content hash (SHA-256). Any post-registration edit changes the hash and
voids the run:

```
3355305af382ca7ae24e97b3dd92c9a5c6d014d13380f34660d1e5221f5c15af  repo-a-questions.yaml
a5c8abf09ab0515b52c16dc4798f9e3a9ae0e5550f74769811a0f52098ce6161  repo-b-questions.yaml
41389a46be59f0dc17fe92232b0bd65fd25e0d64ca4eef94bd68b5c4e70c0336  repo-c-questions.yaml
284cea15b5a869dc0628d51a431151e8fe3ff693fe53d1720363b8fd8158e24d  probes.yaml
```

## Metrics (per question, per arm)

- **Recall** — |answer ∩ truth_files| / |truth_files| (file level; truth
  entries marked DECOY are expected-absent and count against precision when
  returned).
- **Precision** — |answer ∩ truth_files| / |answer|.
- **Missed / wrong** — explicit file lists (kept in the local detail report).
- **Wall time** per question + arm; graph build time reported separately and
  amortized over the repo's question count.
- **Output bytes** per arm (context-cost proxy for an agent consuming the
  tool's output).

## Win threshold — declared before the run

Graph-shaped questions = all categories except negative controls (15 of 18).

**Arm B wins** iff ALL of:
1. mean recall(B) − mean recall(A) ≥ **+10 percentage points** on the
   graph-shaped questions;
2. mean precision(B) ≥ mean precision(A) − 5 pp on the same set;
3. on the negative controls, mean recall(B) ≥ 0.9 × mean recall(A)
   (the graph must not collapse where grep is the ideal tool).

Anything else is a **null**. Null consequence is physical (council Q2,
roadmap Phase 2): `code_graph.enabled: false` stays permanent, deprecation
notice at the next major, removal the major after — never a silently
maintained engine.

## Publication policy

The committed results report carries per-question rows as: question id,
category, per-arm precision/recall, wall time, output bytes — **no repo
paths**. The full detail rows (missed/wrong file lists) stay in the local
gitignored directory alongside the truth files.

## Runner

`internal/bench/code-graph/run_bench.ts` — committed alongside this document;
reads the hashed local files, verifies their SHA-256 against the list above
before running, refuses on mismatch.
