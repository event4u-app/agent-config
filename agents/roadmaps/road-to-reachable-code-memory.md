---
complexity: structural
status: ready
---

# Road to reachable code memory — wire the orphaned engine, accumulate locally, decide the substrate honestly

> **Source:** `agents/tmp.old/consumer-index.txt` — the freshest intake:
> measured 2026-07-26 against HEAD = 9.8.0 (fresh clone, engine invoked
> directly), six roadmap revisions across two lineages, plus **maintainer
> decisions recorded in the source chat** (SQLite substrate decided;
> ADR-116's ship-gate clause overridden with a three-point rationale; a
> single-user storage model with a `subject` axis).
> **Core findings independently re-verified before this cut:** the
> code-graph engine is ORPHANED (zero registry/npm/task/MCP entry points
> while the SHIPPED code-intelligence skill instructs six `code_graph …`
> invocations — confirmed: 0 registry matches, skill lines verified),
> `agents/memory/intake/` absent even here, `learning_sidecar.ts` (decay,
> ≥2-origin corroboration, dead-end ledger) has no entry point.
> **Council:** AI council debate 2026-07-27 (anthropic/claude-sonnet-4-5 +
> openai/gpt-4o, 2 rounds). Round 2 resolved the freeze-line dispute:
> reachability is the dead-postinstall defect class and ships ungated;
> engine-quality phases couple to it behind their spikes ("you cannot ship
> a registry entry that points at broken queries" vs "you cannot claim
> operational necessity for unreachable code" — the spikes arbitrate);
> the one contested default ships OFF; this council round itself
> constitutes the procedural review of the ADR-116 reopening.
> **Activated 2026-07-27 by maintainer decision.**

## Goal

Make what already exists reachable and honest: the shipped
code-intelligence skill must name only commands that resolve from a fresh
consumer install (and a lint must make that bug CLASS impossible); the
built-but-orphaned learning sidecar gets its entry points and a local,
zero-token accumulation path with promotion staying human; the
maintainer-decided `node:sqlite` substrate lands with zero new
dependencies, JSON staying canonical and thresholds as ROLLBACK triggers;
shared project memory stops colliding on merge; upgrades are zero-touch;
and the user/project storage boundary becomes enforceable — all while the
parked default-on questions STAY parked and install friction stays
strictly zero-delta.

## Council convergence (2026-07-27, 2 rounds)

- **Phase 1 reachability + `lint_documented_commands` = defect-fix tier**
  (dead-postinstall class), ships regardless of every spike outcome —
  a shipped skill naming non-resolving commands is a defect under any
  benchmark result.
- **Engine-quality phases (freshness, denylist, perf substrate) couple to
  reachability behind their pre-registered spikes** — registry entries
  pointing at 1s-latency, 42.8%-ambiguous queries would defer the defect,
  not scope it; the spikes (S0b/S0c) arbitrate what ships.
- **`memory.learn_on_session_end` ships OFF** (council overrides the
  source file's default-on): measure-before-default-flip applies to
  out-of-box experience regardless of write-side framing; the flip is
  PROPOSED only after the 30-day dogfood shows non-trivial signal AND
  session-end p95 < 2 s.
- **All MCP graph tools stay behind the mcp-full-power N0 gate** (a
  council-approved tool batch) + the maintainer scope decision; nothing
  in this roadmap implements an MCP tool.
- **Subject-axis privacy work = security tier, do now** — the tracked,
  public `agents/memory/*.yml` carry the personal-context leak surface
  today.
- **ADR-116 handling confirmed honest:** a new ADR records the
  maintainer-directed override (rationale: the precautionary lock's
  conditions no longer hold — measured 90× delta with byte-identical
  answers, zero new deps, recorded ranking defects), rollback thresholds
  stated as such, ADR-094's Layer-2 sunset explicitly untouched. No
  silent relitigation; this council session is the review the reopening
  required.

## Non-goals — parked owners stay intact

- Default-on for `hooks.code_graph.enabled` and `memory.session_index`:
  STAYS in `later/road-to-native-code-intelligence.md` Phase 5 and
  `road-to-memory-retrieval-economy` Phase 5, both behind
  benchmark-spend authorization. This roadmap only makes those benchmarks
  RUNNABLE.
- **D5 five-verb MCP graph surface**: gated on the maintainer scope
  decision + N0 batch, and sequenced BEHIND the launch (MCP on a package
  nobody installed moves adoption by zero).
- **Content retrieval (code chunks, RRF fusion)**: gated on an explicit
  maintainer scope decision — it turns a structure-query tool into a
  content-retrieval tool ("a different product"); when it ever runs, a
  secret redactor at the output boundary is MANDATORY (snippets without
  redaction is a security regression) and no vector/embedding tier
  (external API, network, non-determinism — rejected as an adoption
  decision; embeddings remain at most a future bench arm).
- **Language expansion** beyond PHP/TS/JS: cost, not feature, until a
  consumer ships a fourth stack.
- Inherited blockers, not duplicated: benchmark-spend-authorization;
  consumer-scale corpus (one PHP ≥50k LOC + one TS ≥30k LOC — and the
  corpus floor is NOT lowered to fit candidates); adoption gap.

## Phase 0 — Falsification spikes (pre-registered, cheap)

- [ ] **S0a reachability-zero:** from a clean `npm pack` tarball in a
  scratch project, attempt all six documented invocations. Threshold:
  0/6 resolve (≥1 resolves → the diagnosis is wrong; rewrite before code).
- [ ] **S0b consumer-scale build cost:** two external repos (PHP ≥50k,
  TS ≥30k LOC): cold build ≤60 s AND cache ≤80 MB on both (the embedded-
  engine doctrine ceiling). Miss → Phase 2 downgrades to
  explicit-invocation-only. Blocked by the corpus blocker; record
  candidates in `docs/wedge/code-graph-corpus/CORPUS.md` (repo, SHA,
  license, LOC, floor-clearance) — honest-null: no arm clears the floor →
  say so, leave the parked benchmark parked.
- [ ] **S0c denylist losslessness:** 20 real structure questions
  re-answered against a builtin-denylisted graph: 20/20 unchanged AND
  ≥35% edge reduction. Any regression → Phase 3 abandoned (the noise is
  load-bearing; record it).
- [ ] **S0d sidecar verdict replay:** ≥30 synthetic intake signals across
  ≥3 origins: ≥1 PROMOTED, ≥1 correctly withheld single-origin,
  byte-stable output for fixed `--now`. Miss → Phase 4 ships entry points
  but not surfacing.
  *Verify (all):* spike results committed with their thresholds applied
  in writing.

## Phase 1 — Reachability (ungated defect fix)

- [ ] Register the engine as ONE CLI command `code-graph` with its six
  existing verbs (delegate to the engine CLI); add `memory:get` (CLI twin
  of the existing MCP tool — closes a drift the code comments already
  assume) and `memory:learn` (sidecar entry; read-only by default,
  `--write` to emit).
  *Verify:* all resolve from a fresh consumer install (S0a re-run green).
- [ ] Rewrite `src/skills/code-intelligence/SKILL.md` + its dist twin to
  use only registered forms, plus the one-line fallback: "if this command
  is not available, grep and say so".
  *Verify:* zero non-resolving commands in the shipped skill.
- [ ] **`lint_documented_commands` (the load-bearing item):** every
  backtick-quoted command in ANY shipped skill/rule/command doc must
  resolve to a registry entry, MCP tool, npm script or task target —
  the bug CLASS becomes impossible, not just this instance.
  *Verify:* lint wired into CI; seeded non-resolving command fails
  red/green; current tree green.
- [ ] Explicitly NOT here: MCP graph tools (N0 gate; see Non-goals) and
  any `build`-as-side-effect — builds are never model-triggered.

## Phase 2 — Freshness without a daemon (gated on S0b)

- [ ] `code-graph detect` emits a machine-readable three-state verdict
  ABSENT / STALE(n commits behind) / FRESH; add `code-graph refresh`
  (= `build --update` when STALE, no-op when FRESH, full build when
  ABSENT) with a hard wall-clock budget (default 60 s) that aborts
  leaving the old cache intact; the nudge hook (still default-OFF, still
  never blocking) names the real command on ABSENT; cache documented as
  local-only and disposable.
  *Verify:* verdict JSON stable; budget abort tested; nudge text honest.

## Phase 3 — Cut the noise (gated on S0c)

- [ ] Per-language builtin/stdlib denylist in the extractor (unresolved
  calls to known builtins/test-matchers dropped, not emitted AMBIGUOUS;
  repo-local symbols sharing a builtin name still resolve); golden-
  checksum determinism re-run; before/after recorded as a dated evidence
  note (measured note, not marketing).
  *Verify:* AMBIGUOUS share ≤15%; 20/20 answers unchanged; determinism
  green.

## Phase 4 — Memory that accumulates (local, human-promoted)

- [ ] Create `agents/memory/intake/` (+ .gitkeep + 2-line README) so the
  write path exists on a fresh clone; wire `memory:learn` into the
  EXISTING `session_end` hook event (joins the existing concern set — NO
  new hook file); local-only, budget-capped, fail-open.
- [ ] **`memory.learn_on_session_end` ships `off`** (council decision).
  The default-flip is proposed as its own follow-up ONLY after the
  dogfood item below shows non-trivial signal AND session-end p95 < 2 s —
  the source file's demotion trigger becomes our promotion gate.
- [ ] Promotion stays human: a PROMOTED sidecar lesson (≥2 origins,
  uncontested) renders as a reviewable proposal through the existing
  memory-proposal flow; nothing auto-writes into curated
  `agents/memory/*.yml`. One-line session-end visibility marker via the
  existing memory-visibility contract.
- [ ] **Dogfood:** replay this repo's own last 30 days through the write
  path; ~0 signals is a FINDING for the evidence note, not something to
  paper over.
  *Verify:* fresh-clone write path exists; hook fires with the setting
  on; zero writes with it off; proposal flow renders a candidate;
  dogfood note committed.

## Phase 5 — Shared project context (defect tier, before the substrate)

- [ ] Apply the shipped-but-never-applied `merge=union` .gitattributes
  fragment: in THIS repo (dogfood — it currently has none), via an
  idempotent installer append for consumers (skip if present; never touch
  unrelated lines; report in the install summary), fragment updated to
  cover BOTH curated layouts + intake JSONL; doctor check
  (`memory-merge-union`) warns with the exact one-line fix for
  already-installed repos; CI tier-split assertion (nothing under
  `agents/runtime/` and no `*.sqlite3` tracked; `agents/memory/**` stays
  tracked).
  *Verify:* two-writer append merge test passes; doctor + CI assertions
  red/green.

## Phase 6 — The substrate (maintainer-decided; recorded honestly)

- [ ] **Write the superseding ADR**: engine confirmed (`node:sqlite`
  FTS5 verified available, unflagged, on the current Node), the prior
  ADR's scale-only activation condition retired and its ship-gate clause
  overridden BY MAINTAINER DIRECTION with the recorded three-point
  rationale (separator-recall gap is a correctness defect you don't
  A/B against; byte-identical answers at ~1/90 latency make a lift-gate
  the wrong instrument; the clause was written for a scale question) —
  Layer-2 sunset (no service, no vector, no daemon) explicitly untouched;
  thresholds below stated as ROLLBACK triggers, never undisclosed ship
  gates.
- [ ] Extract a shared `sqlite_guard` (lazy import, FTS5 probe, narrow
  warning silencer) and migrate BOTH telemetry twins onto it (net-zero
  surface, proven by existing tests first).
- [ ] **Graph store:** build additionally emits a derived
  `code-graph-v1.sqlite3`; the query path prefers it, falls back to JSON
  when absent or on old Node. JSON stays canonical and byte-deterministic
  (golden checksum untouched). Rollback triggers: query p95 ≤ 50 ms,
  heap ≤ 10 MB — a miss reverts THAT store to fallback + incident note.
- [ ] **Memory store:** FTS5 index over both curated layouts + intake,
  rebuilt batch/lazy (post-session or first lookup, never inline
  per-write); the substring scorer becomes the documented fallback.
  Rollback trigger: the 24-query replay reports recall AND
  tie-distribution against the recorded `mean_tie_set_size: 4.11`
  baseline.
- [ ] Extend the versioned-cache lint to cover `.sqlite3`/`.db`; **CI
  install-friction guard:** the diff adds zero `dependencies`, no
  node-gyp/postinstall/prebuild; scratch old-Node install passes smoke on
  the fallback path.
  *Verify (all):* identical graph answers on both stores; zero new deps
  CI-asserted; rollback = delete the derived files.

## Phase 7 — Zero-touch upgrades

- [ ] `PRAGMA user_version` stamps ALL derived sqlite stores (telemetry —
  fixing its recorded never-read SCHEMA_VERSION bug — graph, memory);
  rebuild-on-drift silently on first lookup (version mismatch / absent /
  corrupt → rebuild from committed truth; corruption is a non-event,
  tested with a truncated file); legacy-path sweep on first run; **N→N+1
  CI upgrade test** (install, seed, upgrade, first lookup succeeds, no
  user action in the transcript).
  *Verify:* upgrade test green; truncated-file test green.

## Phase 8 — Storage boundary: the `subject` axis (security tier)

- [ ] **Partition rule recorded as a successor note to the knowledge-store
  ADRs:** project-local holds everything derived FROM the repo;
  user-global holds everything ABOUT repos; `subject: user` records live
  global-only and may NEVER be written into a project artifact;
  `subject: project` (default) promotable via the existing gate.
  Read-open / write-closed asymmetry; arbitration test: "appropriate for
  a colleague who checks out the repo?".
- [ ] **Three invariants:** (1) store-boundary lint — no homedir/global-
  root literals in index code outside the path module; (2) provenance
  gate at the WRITE edge — a record whose origin resolves to the global
  store is refused entry into tracked project artifacts (reachability
  check on an origin field, no model call); (3) hand-authored tripwire
  over tracked memory files (first-person/preference vocabulary, DE+EN)
  that HALTS, never rewrites — with its own honest-null rule: zero fires
  across the full history → drop invariant 3 as unfounded, keep 1–2
  (structural).
- [ ] Resolve the recorded `cli_call_budget` wording contradiction (move
  under the profile, or correct the schema wording to machine-wide
  spend).
  *Verify:* lints red/green; ADR note merged; no `subject: user` record
  reaches a tracked artifact (CI-enforced).

## Phase 9 — Engine deltas (small, each self-gated)

- [ ] **D2 stat-before-read + git fast-path** (the extractor sidecar
  already caches by content hash; the delta is skipping the read):
  acceptance ≥70% wall-time reduction on a single-file-edit rebuild AND
  unchanged golden checksum; below 70% → the cost was extraction not IO —
  record and close without merging.
- [ ] **D4 `recommended_reads`:** every edge dropped by the output budget
  + every under-threshold result names {path, line range} — a read plan
  instead of silent truncation. Cheap; token-economy fit.
- [ ] **D3 intent-conditioned verb selection** (regex table only, no
  model call): PRE-REGISTER a 30-query labelled set BEFORE implementing;
  ship only if intent selection beats always-`query` on correct-verb
  rate; null → publish, leave the nudge generic.
  *Verify:* each delta's threshold applied in writing.

## Acceptance criteria (roadmap-level)

1. Reachability total and CI-enforced (lint, not review); the shipped
   skill names only resolving commands (Phase 1).
2. No benchmark-gated default flipped; `learn_on_session_end` ships off
   with its promotion gate recorded (Phase 4); the parked Phase-5
   default-on questions stay with their owners.
3. Layer-2 sunset intact: no service, no vector tier, no daemon, no
   auto-promotion into curated memory; promotion stays human.
4. Install friction strictly zero-delta, CI-asserted (zero new deps; old
   Node degrades gracefully); zero-touch upgrade proven by the N→N+1
   test, not documentation.
5. The substrate decision is RECORDED, not implied: the superseding ADR
   states the maintainer override + rationale + rollback triggers;
   determinism (golden checksum) green throughout.
6. Shared project context genuinely shared (merge=union applied +
   doctor + CI tier-split); the subject-axis write boundary CI-enforced.
7. Every gated phase leaves a dated evidence note incl. honest nulls;
   nothing from Non-goals ships without its named gate.
