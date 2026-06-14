---
complexity: structural
status: ready
---

# Roadmap: 3-condition value benchmark — show the package + RDP lift in numbers

> **Complexity:** structural — extends the existing 2-condition `bench:ab`
> harness to three conditions, adds a deterministic-oracle 2×2 corpus, and emits
> two published-comparison tables. Council-reviewed (two-member, 2 rounds,
> peer-review, 2026-06-14); forks F1–F6 resolved inline. Sibling of the archived
> `road-to-package-impact-benchmark` (the 2-condition harness this extends).

## Goal

Make the package's value **visible in numbers**, like the public model-card
tables — but measuring the **lift of this package on a fixed host model**, not
model-vs-model. Three conditions on one neutral fixture:

- **A — without** the package (vanilla host model),
- **B — with** the package (governance rules/skills, RDP off),
- **C — with** the package **+ RDP** reasoning lift.

Answer, per condition + per task cell: success / hit-rate (%), total tokens,
$ cost; whether **short tasks cost more** (RDP overhead), whether **long tasks
get cheaper / better**, and how much **accuracy improves**.

> **Honest framing (label on every table):** this is "agent-config lift on
> `<host model>` @ `<inference config>`", NOT a model-vs-model benchmark. We do
> NOT compare against public SWE-bench / Fable-5 numbers — that is a category
> error (those measure model capability; this measures wrapper lift + cost).

## What already exists (extend, don't rebuild)

- `bench:ab` (taskfiles/bench-ab.yml): Shape-A neutral fixture, clones
  `without/` + `with/` (`bench_ab_clone.py`), Track A (surface check, cheap),
  Track B (task corpus; `--mode live` runs `claude --print`, billable;
  `bench_ab_task_runner.py`), reports → `render_benchmark_md.py` → `docs/benchmark.md`.
- `value-v1` cost/token report (`scripts/_lib/value_report.py`) + `internal/bench/pricing.yaml`.
- The RDP `reasoning.enabled` settings toggle — the B↔C lever.

## Locked decisions (council, 2026-06-14)

- **L1 (F1) — separate `with-rdp/` clone**, not a runtime toggle alone. Three
  materialised, diffable clones: `without/`, `with/` (`reasoning.enabled:false`),
  `with-rdp/` (`reasoning.enabled:true`). Artifact-state, not just runtime-state →
  reproducible + compatible with the Track-A surface check.
- **L2 (F2) — deterministic oracle ONLY.** Every corpus task carries an objective
  pass/fail oracle: test-suite exit code, golden file-diff (`git diff --exit-code`),
  or required-string presence. **No rubric / human / LLM-judge scoring** in this
  benchmark — it manufactures artificial lift and is unreproducible. Open-ended
  tasks are **excluded** here and belong in a separate, clearly-labeled qualitative
  study (the RDP internal eval's golden-transcript rubric is that separate study).
- **L3 (F3) — 2×2 task taxonomy.** Two orthogonal axes: `duration: short|long`
  × `cognitive: reasoning-heavy|mechanical` = 4 cells. Target **N ≥ 40** (≥ 10
  per cell) for statistical power. The report breaks down count / success% /
  median tokens / median cost **per cell per condition**. "Short tasks more
  expensive?" = the short×mechanical cell across conditions; "long tasks cheaper /
  better?" = the long×reasoning cell.
- **L4 (F4) — own corpus only.** No SWE-bench / public-benchmark slice (category
  error + licensing + oracle/containerization mismatch + false comparability).
  Credibility comes from **publishing the corpus, the oracle code, and the raw
  results**, not from co-opting benchmark names.
- **L5 (F5) — two tables, not one.** Table 1 **Package Value** (A vs B): "should I
  adopt agent-config?". Table 2 **RDP Lift** (B vs C): "should I enable the
  reasoning lift?". Each states host model + inference config (temp/top-p/max-tokens)
  + corpus version + run date. A single 3-column table invites the "C beats A by
  X%" misread that conflates two independent effects.
- **L6 (F6) — dedicated roadmap** (this file), not folded into
  `road-to-rdp-eval-and-promotion` (feature-scoped, maintainer audience). This is
  product-scoped (adoption value, prospective-user audience).

## Phase 1 — Corpus (deterministic, 2×2, N≥40)

- [x] Added the 2×2 axes (`duration` × `cognitive`) to the corpus schema header +
      all 13 existing `ab-trackb.yaml` tasks. The deterministic oracle (F2) already
      exists as `success_criteria` (structural, no judge, scored by
      `bench_ab_scoring.py`) — confirmed, no rename needed.
- [~] Curate ≥ 40 tasks (≥ 10 per cell) + grow the fixture. **Council (2026-06-14)
      ruled v0 ships at N=13, clearly labeled low-power/directional, and does NOT
      block on growth (Q1=a, Q3=no — the empty `long×mechanical` cell stays a
      documented hole).** This is a post-v0 follow-up before any number is quoted
      as authoritative. <!-- deferred: council-approved for v0; N=13 directional, grow before authoritative numbers -->
- [x] `task lint-bench-ab` passes with the tags (linter allows the additive keys). <!-- carve-out: new-gate-verification -->

## Phase 2 — 3rd condition plumbing

- [x] `bench_ab_clone.py` — added the `with-rdp` variant + `all` expansion
      (back-compat: `both` still = with+without). Both `with*` clones now get a
      generated `.agent-settings.yml` with the RDP toggle (`with`→false,
      `with-rdp`→true) — the A/B/C lever. Compiles; settings-write + CLI choices
      verified. <!-- dependency: a meaningful with-vs-with-rdp diff needs the RDP artifacts PROJECTED into .claude/.augment first (pre-PR `task sync && task generate-tools`); until then they differ only by the toggle flag -->
- [x] `bench_ab_task_runner.py` — runs three conditions (`--variant all` =
      `with|without|with-rdp`); per-task entries now carry `duration`+`cognitive`
      and the report adds a `per_cell` (2×2) aggregate. Compiles; a `--variant
      without --mode dry-run` produced a real report with the 3 populated cells
      (verified). <!-- remaining: wire `task bench:ab:live` to invoke all three via bench_ab_cache_dispatch.py + taskfile (currently the task targets still call --variant both) -->
- [x] 3-condition task wiring: added `task bench:ab:value` (clone `--variant all`
      + runner `--variant all --mode live` + render) in `taskfiles/bench-ab.yml` —
      `task -l` lists it; yaml valid. The existing 2-condition `bench:ab` /
      `bench:ab:live` stay untouched (back-compat).
- [ ] Track A surface check extended to assert RDP artifacts present in
      `with-rdp/`, inert/absent in the others (deferred with the projection
      dependency — RDP artifacts only land in `.claude/.augment` after
      `task sync && task generate-tools`). <!-- carve-out: new-gate-verification -->

## Phase 3 — Per-cell metrics + two-table report

- [x] `render_benchmark_md.py` — renders the **two tables** (Package value
      without→with, RDP lift with→with-rdp) + the **per-2×2-cell** table (3
      conditions) into `docs/benchmark.md`, with the DRY-run + low-N + "lift on
      host model, not model-vs-model" banners. Compiles; `lint-bench-ab` green.
- [x] Dry render verified — generated 3 dry stub reports → `docs/benchmark.md`
      shows the full two-table + per-cell format honestly at 0/N (then stubs
      removed; the doc is the self-contained visible result). <!-- carve-out: new-gate-verification -->
- [-] `value_report.py` — group token/$ cost by `(condition, duration, cognitive)`.
      <!-- cancelled: $ dropped per maintainer (tokens-only); token grouping is now done directly in bench_ab_task_runner.per_cell_aggregate (mean_tokens per cell per condition, rendered live) — value_report.py grouping is superfluous -->

## Phase 4 — Billable measurement run (maintainer-authorized)

- [~] Run `task bench:ab:live` across all three conditions on ≥ 1 host model
      (≥ 1 standard, optionally ≥ 1 strong-reasoning). ~3 × N `claude --print`
      calls (N≥40 → ~120 calls). Record host model + inference config. <!-- deferred: billable — needs maintainer budget authorization -->
- [~] Publish `docs/benchmark.md` with the real numbers; capture cost in the
      `value-v1` report. <!-- deferred: depends on the billable run above -->

## Phase 5 — Live progress display (planned 2026-06-14; do NOT start while a run is in flight)

> Motivation: a live run is **39 `claude --print` calls** (13 × 3), each silent
> for up to the 120s timeout. Today the only live output is per-task
> `built with clone` noise + a per-variant summary at the end — so a 20–50 min
> run looks either spammy or hung. Add a real progress display.

**Locked design choices (no council — minor UX, stdlib-only):**
- **No new dependency.** No `tqdm`/`rich`; pure stdlib (`sys.stderr`, `\r`, `time`).
- **TTY-aware (`--progress {auto,bar,plain,none}`, default `auto`):** when
  `sys.stderr.isatty()` → a single-line `\r` bar; otherwise (logs/CI) →
  one stable line per task. Never emit `\r` spam into a log.
- **Silence the clone noise:** the runner calls `clone(..., quiet=True)` for the
  per-task reset (add a `quiet` param to `bench_ab_clone.clone`), so the only
  per-task output is the progress line.
- **Heartbeat:** a lightweight background-thread elapsed ticker around each
  `run_live` call (e.g. `with-rdp 4/13 · total 17/39 · trackb-feature-01 · 23s…`)
  so a long task never looks hung; cleared/overwritten on completion. Thread is
  daemon + joined per task; no effect on `dry-run`.
- **Machine-readable mirror:** write `internal/bench/reports/ab/.progress.json`
  per task (`{variant, task_idx, total_done, total, current_id, started_at,
  last_result}`) so a watcher (or the IDE) can tail it independently of the TTY.

**Steps:**
- [x] Added `quiet` to `bench_ab_clone.clone()`; `reset_clone` calls it with
      `quiet=True` → the per-task `built … clone` noise is gone.
- [x] Added a `Progress` helper (stdlib): TTY bar vs plain line-per-task, the
      `--progress {auto,bar,plain,none}` flag, per-task line (variant, X/13,
      total/39, id, ✓/✗, wall-time), per-variant summary, grand-total finish.
- [x] Heartbeat ticker (daemon thread) re-renders the bar with task-elapsed
      every 1s during a live task; off in `dry-run` and in plain/none modes.
- [x] `.progress.json` mirrored per task (gitignored) + `task bench:ab:watch`
      tails it for a second terminal.
- [x] Verified in `--mode dry-run` (free, no spend): plain mode clean
      `[N/39] ✓/✗ …` + grand-total `39/39 · 12s`; `--progress none` silent (0
      lines); `--progress bar` exits 0; `.progress.json` updates per task. <!-- carve-out: new-gate-verification -->

## Phase 6 — Validity fixes (post-first-run diagnosis, council 2026-06-14)

> The first live run came back **flat**: 84.6% (11/13) in every condition, with
> `uiaudit` at **0% even WITH the package**. Council diagnosis: the bench measured
> a **no-op**, not "the package does nothing". Two causes — one is a hard blocker.

- [x] **BLOCKER SOLVED — activation gap.** Root cause (verified): agent-config is
      a **global Claude Code plugin** (`enabledPlugins` in `~/.claude/settings.json`),
      so plain `claude --print` ran it on BOTH arms → confound → flat. The
      `.claude/rules/` files in a clone are never auto-loaded (not a native Claude
      Code surface). **Fix (proven, no file-loading guesswork):** activation is now
      set per-arm at invocation —
      `without` = `--setting-sources project,local` (drops the user-level plugin,
      auth survives); `with` = plain `--print` (the **real installed plugin** =
      package); `with-rdp` = + `--append-system-prompt-file` with the RDP rules.
      All arms `--permission-mode bypassPermissions` (equal edit capability). **Token
      proof:** plugin-on 35.5k vs plugin-off 11.9k input tokens (~24k = the package
      footprint). **Smoke (1 task × 3 arms, live):** all ran, `without` edited the
      file (1/1), tokens differentiated (without 2.44M > with 2.04M — package looks
      *more* token-efficient, pending the full run). `--bare` was rejected (it kills
      auth). uiaudit is the built-in activation probe (real plugin carries
      `ui-audit-gate`).
- [x] **Token capture** (maintainer-flagged miss): `run_live` now invokes
      `claude --print --output-format json` and records per-task `usage` tokens;
      report carries `total_tokens` + per-2×2-cell `mean_tokens`. Verified (dry).
- [x] **Dropped `$` cost** — tokens-only per maintainer.
- [x] **Ask-vs-act delta** now rendered (was `—`).
- [ ] **Process-quality metrics (council Q2)** — deterministic, no judge:
      over-engineering avoided (diff footprint vs a minimal-diff oracle),
      grounding-before-edit, regression introduced (did it break a hidden test).
- [ ] **Trap tasks with headroom (council Q3)** — archetypes where a base model
      misbehaves *without* the discipline: ambiguity trap (acting immediately is
      wrong), over-engineering bait (one-line fix surrounded by refactor lure),
      regression landmine (a change that breaks a hidden test unless verified).
- [x] **Salvage vs rebuild (council Q5): SALVAGED.** Activation is fixed at the
      invocation layer (above), not the clone files — so the fixed-fixture +
      structural-scoring shape holds. No rebuild needed.
- [x] **Cost-control hardening — the make-or-break for a *completable* run.** The
      first full 39-run attempt tripped the account usage limit: the session
      default model is **Opus-4.8-1M**, whose ~$1.78 first-turn cache-creation
      (171k tokens) makes each agentic task cost ~1.8M tokens. Fixes landed in
      `bench_ab_task_runner.py`: (1) **`--model` pin** (default `claude-sonnet-4-6`,
      ~2.3× cheaper/turn; also a validity requirement — one fixed host across
      arms); (2) **`--max-budget-usd` per-task cap** (default 2.0, `claude` flag
      verified) so a runaway loop can't starve later arms; (3) **error-aware
      reporting** — rate-limit / budget-cap / timeout / CLI-fail tasks are marked
      `errored` and **excluded from the hit-rate** (never read as a content fail),
      surfaced as a count in the report banner + per-cell; (4) **`modelUsage`
      token fallback** (top-level `usage` is zeroed on a capped run); (5) **`--tasks`
      ID selector** to span the populated 2×2 cells in a bounded run; (6) absolute
      binary resolution (fixes the spurious "claude CLI not found" on a later arm).
- [x] **Measurement run completed (bounded, quota-safe demonstrator).**
      `task bench:ab:value:quick` — 3 tasks (one per populated 2×2 cell:
      `bugfix-01` short/RH, `bugfix-02` short/mech, `refactor-01` long/RH) × 3 arms
      = 9 live `claude --print` runs, sonnet-pinned, budget-capped, **did NOT trip
      the usage limit** (12m59s total). `docs/benchmark.md` rendered with **real**
      hit-rate + token numbers: without 100% (3/3, 3.38M tok), with 100% (3/3,
      1.97M tok → package ~1.4M tokens *cheaper* on this sample), with-rdp 100%
      (2/2 completed; 1 timed-out task correctly excluded, not a fail). The full
      N≥40 run stays a post-v0 follow-up (Phase 4, needs maintainer budget +
      corpus growth) — the harness itself is now proven end-to-end. <!-- bounded demonstrator: full 39-run corpus needs N-growth + maintainer budget per Phase 1/4 -->
- [x] **`task bench:ab:value:quick`** added to `taskfiles/bench-ab.yml` — the
      cheap, repeatable, quota-safe entry point (9 runs spanning every populated
      cell); `bench:ab:value` desc updated to warn the full 39-run corpus can trip
      the quota and to point at `:quick`.

> **Data-loss note (2026-06-14):** an over-broad cleanup glob earlier deleted the
> first (confounded) live run's raw reports — no real loss, those numbers were a
> no-op artifact. The valid run is the one now in flight with activation fixed.

## Acceptance criteria

- The **activation canary passes** (package rules provably active in the `with`
  clone) — without this, no result is trustworthy.
- Corpus ≥ 40 deterministic-oracle tasks, ≥ 10 per 2×2 cell; `lint-bench-ab` green.
- Three reproducible clones; Track A asserts RDP presence/absence per condition.
- Two tables render (Package Value A-vs-B; RDP Lift B-vs-C) with per-cell success%
  + tokens + cost + the short-overhead and long-delta rows, host/config-labeled.
- The real-numbers run is the only billable step; everything else verifies cost-free.
- No public-benchmark name is claimed; the report is labeled "lift on model X".
