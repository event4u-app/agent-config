# Spike results — road-to-reachable-code-memory Phase 0

> Pre-registered falsification spikes (S0a–S0d) from
> `agents/roadmaps/archive/road-to-reachable-code-memory.md`. Each spike's threshold
> was fixed in the roadmap BEFORE execution; results below apply the
> threshold in writing. Run date: 2026-07-27, HEAD = 9.8.0 lineage,
> branch `feat/road-to-reachable-code-memory`.

## S0a — reachability-zero

**Pre-registered threshold:** from a clean `npm pack` tarball installed into a
scratch project, attempt all six invocations documented in
`src/skills/code-intelligence/SKILL.md`. 0/6 resolve confirms the diagnosis;
≥1 resolving means the diagnosis is wrong (rewrite before code).

**Method:** `npm pack` at HEAD → fresh scratch project → `npm i <tarball>`
(189 packages) → for each documented form (`code_graph detect`, `build`,
`query <symbol>`, `affected <symbol>`, `path <a> <b>`, `explain <symbol>`):
checked (a) bare command on PATH, (b) `npx --no-install agent-config
code_graph <verb>`, (c) npm scripts referencing the engine, (d) the CLI
`--help` registry surface.

**Result: 0/6 resolve — CONFIRMED.**

| Invocation | bare on PATH | via `agent-config` CLI |
|---|---|---|
| `code_graph detect` | no | `unknown command: code_graph` |
| `code_graph build` | no | `unknown command: code_graph` |
| `code_graph query <symbol>` | no | `unknown command: code_graph` |
| `code_graph affected <symbol>` | no | `unknown command: code_graph` |
| `code_graph path <a> <b>` | no | `unknown command: code_graph` |
| `code_graph explain <symbol>` | no | `unknown command: code_graph` |

Zero npm scripts, zero task targets, zero registry entries, zero MCP tools
reference the engine. The engine sources DO ship in the tarball
(`src/scripts/code_graph/*.ts` present in the unpacked package), so Phase 1
registration is a wiring fix, not a packaging fix.

**Threshold applied:** 0/6 < 1 → diagnosis stands; Phase 1 proceeds as cut.

## S0b — consumer-scale build cost

**Pre-registered threshold:** two external repos (PHP ≥50k LOC, TS ≥30k LOC):
cold build ≤60 s AND cache ≤80 MB on both. Miss → Phase 2 downgrades to
explicit-invocation-only.

**Method:** corpus candidates registered in
`docs/wedge/code-graph-corpus/CORPUS.md` — PHP arm `galawork-api`
(399,713 LOC PHP @ `834b189d3`, 8× the 50k floor), TS arm
`galawork-app-react-native` (74,596 LOC TS @ `3826d57`, 2.5× the 30k floor).
Cold `code_graph build` per arm via `npx tsx src/scripts/code_graph/cli.ts
build --root <repo> --out <scratch>`; wall time via `/usr/bin/time -p`.

**Result: PASS on both arms.**

| Arm | Cold build | Cache | Sidecar | Nodes / edges |
|---|---:|---:|---:|---|
| PHP `galawork-api` | 3.7 s | 36.1 MB | 34.0 MB | 20,441 / 89,539 |
| TS `galawork-rn` | 1.7 s | 3.2 MB | 3.7 MB | 1,225 / 14,841 |

**Threshold applied:** 3.7 s ≤ 60 s and 36.1 MB (70.1 MB incl. sidecar)
≤ 80 MB on the worst arm → Phase 2 proceeds un-downgraded (no
explicit-invocation-only fallback needed).

## S0c — denylist losslessness

**Pre-registered threshold:** 20 real structure questions re-answered against
a builtin-denylisted graph: 20/20 unchanged AND ≥35% edge reduction. Any
regression → Phase 3 abandoned.

**Method:** prototype post-filter implementing exactly the Phase-3 mechanism
(curated static per-language denylist: ~300 common PHP internal functions,
PHPUnit/Pest + Jest/Vitest test matchers, JS globals, JS prototype methods;
only UNRESOLVED `symbol:<name>` call targets dropped — repo-local symbols
sharing a builtin name survive by construction). Two corpora: the 400k-LOC
PHP Laravel corpus arm and this package (mixed TS/JS/PHP, 100,678 edges).
20 questions (affected/query mix, 10 per corpus, rank-spread repo-local
symbols), answers normalized to repo-local relations.

**Result: losslessness PASS, reduction MISS.**

| Corpus | Total edge reduction | Calls reduction | AMBIGUOUS share |
|---|---:|---:|---|
| mixed TS/JS/PHP (this package) | **34.8%** | 47.8% | 42.7% → 22.6% |
| pure PHP Laravel | **7.9%** | 13.7% | 41.0% → 42.7% |

- 20/20 answers unchanged on both corpora (only denylisted builtin noise
  dropped; zero repo-local relationship changed). ✓
- Edge reduction: 34.8% < 35% on the best corpus; 7.9% on PHP (its noise is
  candidate-bearing dynamic dispatch, which a builtin denylist does not
  touch). ✗
- Phase 3's separate acceptance "AMBIGUOUS ≤15%" is unreachable on both
  corpora via a builtin denylist alone.

**Threshold applied: MISS → Phase 3 abandoned (honest null).** The
conjunctive pass condition ("20/20 AND ≥35%") failed on the reduction
clause on every measured corpus. AI-council debate 2026-07-27
(anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2 rounds) converged on the
strict-miss disposition: the pre-registration is binding, an unpinned corpus
is not a license to select the best one post-hoc, and re-cutting acceptance
after measurement is threshold-shopping. The noise cut is genuinely lossless
but under-delivers against its own pre-registered benefit bar. The spike
artifacts (denylist prototype, measured per-language reductions) are retained
here for any FUTURE, separately pre-registered noise-cut proposal (e.g. a
candidates-aware mechanism for PHP dynamic dispatch — a different mechanism
that would need its own spike).

## S0d — sidecar verdict replay

**Pre-registered threshold:** ≥30 synthetic intake signals across ≥3 origins:
≥1 PROMOTED, ≥1 correctly withheld single-origin, byte-stable output for
fixed `--now`. Miss → Phase 4 ships entry points but not surfacing.

**Method:** 30 synthetic signals across 5 origins (claude, cursor, augment,
gemini, cline) in a scratch intake dir — claim A (12 signals, 3 origins,
`preferred`), claim B (10 signals, single origin), claim C (8 signals,
2 origins, `dead_end`). Two runs of `learning_sidecar.ts --intake-dir …
--now 2026-07-27T00:00:00Z --write` into separate out-dirs.

**Result: PASS on all four clauses.**

- ≥1 PROMOTED: claim A surfaced as verdict `preferred` ✓
- ≥1 correctly withheld single-origin: claim B (10 signals, 1 origin) absent
  from the lesson set ✓
- Byte-stable: `.agent-learning.json` and `LESSONS.md` byte-identical across
  the two runs ✓
- Dead-end ledger: claim C surfaced as verdict `dead_end` ✓ (bonus check)

**Threshold applied:** all clauses met → Phase 4 ships entry points AND
surfacing.

## Phase 8 invariant 3 — tripwire full-history scan (pre-registered honest-null)

**Pre-registered rule (roadmap Phase 8):** hand-authored personal-context
tripwire over tracked memory files, "with its own honest-null rule: zero
fires across the full history → drop invariant 3 as unfounded, keep 1–2
(structural)".

**Method:** `lint_memory_tripwire.ts --history` — every unique blob of every
`agents/memory/**` file across ALL commits (`git log --all`), DE+EN
first-person/preference vocabulary, word-boundary anchored.

**Result: 0 fires** (2 commits, 4 unique blobs — the tracked memory surface
is young; the worktree scan is also clean).

**Threshold applied:** zero fires → invariant 3 is UNFOUNDED per its own
pre-registration. The tripwire script is retained as evidence and an
on-demand tool but is deliberately NOT CI-wired; invariants 1
(`lint_store_boundary`, CI-gated via vitest) and 2 (provenance gate in
`memory_signal.emit`, unit-gated) carry the ADR-130 boundary.

## Phase 4 dogfood — 30-day replay of this repo's own write path

**Method:** ran the sidecar over the repo's real intake surface
(`learning_sidecar.ts --now 2026-07-27T00:00:00Z`) after creating
`agents/memory/intake/`.

**Finding (recorded, not papered over): 0 signals, 0 lessons.** The write
path did not exist for the entire trailing 30 days — `agents/memory/intake/`
was absent from the repo (the roadmap's own core finding), the MCP
`memory_signal` tool therefore had no landing surface here, and no
chat-history JSONL exists on this machine
(`agents/runtime/.agent-chat-history/` absent). Zero accumulated signal is
the expected consequence of an orphaned write path, and it is exactly why
`memory.learn_on_session_end` ships OFF: the 30-day dogfood window with the
write path now wired (this change) is the promotion gate's evidence window,
not this retrospective zero.
