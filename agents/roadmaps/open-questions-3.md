# Open Questions 3 — Council-Modes + Pre-Existing Budget Breach

> Created during the autonomous Phase-2b pass on **2026-05-02**.
> Continuation of [`archive/open-questions-2.md`](archive/open-questions-2.md) (Q1-Q35).
> Pass 3 starts at **Q36**.
>
> Each entry maps 1:1 to either a `[-]` skipped roadmap item or an
> autonomous-default decision the agent took with recommendations
> from the roadmap's *Decisions Required* section. Tick or override
> the decision here to re-validate the affected work.

## How to read this file

- **Grouped by roadmap** — same pattern as Pass 1 / 2.
- **Each entry is a Question**, not a task.
- **Autonomy-blocked items** are tagged:
  - 🛑 `artifact-drafting` — needs Understand → Research → Draft
  - 🌐 `cross-repo` — belongs in `@event4u/agent-memory` or consumer repo
  - 🎯 `strategic` — needs user sign-off on scope / priority
  - 🔬 `architecture` — contract-shape / data-model decision
  - 💰 `budget` — needs paid API access or external service
  - 📦 `external-dependency` — blocked on a package/service not yet shipped
  - 🟡 `autonomous-default` — agent took the roadmap-recommended default;
    user can confirm or override

## Triage summary — Pass 3 (2026-05-02)

| Category | Count |
|---|---|
| 🔬 Architecture | 5 (Q37-Q41) |
| 🎯 Strategic | 2 (Q36, Q43) |
| ✅ Resolved | 1 (Q42) |
| 🛑 Artifact drafting | 0 |
| 🌐 Cross-repo | 0 |
| 💰 Budget | 0 |
| 📦 External dependency | 0 |
| 🟡 Autonomous default | 5 (Q37-Q41 carry both tags) |

## Questions by roadmap

### `road-to-governance-cleanup.md` (carry-over: P0.6 territory)

- **Q36** 🎯 `strategic` — **Always-rule budget breach is
  pre-existing on `feat/optimize-agent-config`.** `tests/test_always_budget.py`
  fails because the top-5 always-rules sum to **28,685 chars**
  (cap: 28,000). Sizes today:

  | Rule | Bytes |
  |---|---|
  | `language-and-tone.md` | 6,586 |
  | `non-destructive-by-default.md` | 6,382 |
  | `scope-control.md` | 5,799 |
  | `ask-when-uncertain.md` | 5,196 |
  | `direct-answers.md` | 4,722 |
  | **Top-5 total** | **28,685** |
  | Cap | **28,000** |
  | Overrun | **685** |

  Total across all eight always-rules is 39,140 / 49,000 (well below
  the global cap), so the breach is concentrated at the top.

  **Not introduced by Phase 2a.** The Phase-2a diff only touches
  `scripts/ai_council/`, `tests/ai_council/`, the council skill, and
  the `/council` command. The rule sizes that breach the cap predate
  this work — the breach exists on `HEAD` before Phase 2a was added.

  **Decision required:** which lever to pull? Three honest options:

  1. **Compress one of the top-5** to free ≥ 685 chars. Cheapest
     candidates (longest with most ceremony):
     - `language-and-tone.md` — Iron Law block + duplicate "source of
       language truth" section likely compressible without semantic
       loss.
     - `non-destructive-by-default.md` — section "Bulk deletions
       during WIP" lists allowed/floor-fires with overlapping bullets.
  2. **Demote one always-rule to `auto`** — e.g. `direct-answers.md`
     (lowest of the top-5, arguably already covered by guideline
     references). Risk: it stops triggering on every reply.
  3. **Raise the top-5 cap** to 30,000 with a written rationale in
     the test. Risk: budget creep — every future addition compounds.

  **Recommendation:** Option 1 on `language-and-tone.md` — the file
  duplicates "source of language truth" twice, and the failure-mode
  list can move into the existing examples guideline. Frees ≥ 685
  chars without losing any Iron Law.

  **Status:** parked-open. Phase 2b ships with the breach unaddressed
  because (a) it's pre-existing, (b) compression of an always-rule
  needs an `artifact-drafting-protocol` session per `preservation-guard`,
  and (c) the Phase 2b code paths never load these rules.

### `road-to-council-modes.md` — Phase 2b decisions taken autonomously

The roadmap's *Decisions Required* block lists five questions. All
five carry an explicit *Recommend:* line. The autonomous Phase-2b
pass took each recommendation as the default; user override flips
the decision and re-runs the affected work.

- **Q37** 🔬🟡 `architecture` `autonomous-default` — **Mode
  precedence.** Invocation flag > per-member setting > global setting
  > built-in default (`api`). Mirrors `cost_profile` resolution.
  Roadmap recommendation taken verbatim.
  **Override path:** if user wants per-member to win over invocation,
  flip the order in `resolve_mode()` and update `test_mode_resolver.py`.

- **Q38** 🔬🟡 `architecture` `autonomous-default` — **Manual-mode
  rendering granularity.** One Markdown block per member (one
  copy-paste per member), not one combined block.
  Matches the sequential orchestrator and keeps the follow-up loop
  scoped to one provider at a time.
  **Override path:** if user wants a single combined block, refactor
  `ManualClient.ask()` to render once and dispatch the same prompt
  to every member; lose the per-member follow-up loop.

- **Q39** 🔬🟡 `architecture` `autonomous-default` — **Project-context
  fallback when no manifest is present.** Send the preamble with
  empty stack/purpose silently. The original ask is the load-bearing
  part. User can extend manually via `/council mode:manual`.
  Already implemented in Phase 2a (E1.1 ProjectContext fields are all
  Optional). No new work needed.

- **Q40** 🔬🟡 `architecture` `autonomous-default` — **Playwright
  provider-adapter scope (Phase 2c).** v1 = Claude.ai + ChatGPT.com
  only. Adapter ABC designed so adding Gemini / Mistral is one new
  file. Decision is captured for Phase 2c; **no code lands in this
  pass** (Phase 2c stays capture-only per Hard Floor — browser
  automation introduces a new dependency + login flow).

- **Q41** 🔬🟡 `architecture` `autonomous-default` — **Playwright
  login detection.** Always ask the user "ready?" before the first
  submit per session. DOM heuristics drift; one explicit user
  confirmation per session is cheap.
  **Captured for Phase 2c. No code lands in this pass.**

### Cross-cutting follow-ups (surfaced during Phase 2b pass)

- **Q42** ✅ `architecture` — **Roadmap dashboard regex drops
  digit+letter phase ids.** `PHASE_RE` in
  `.agent-src.uncompressed/scripts/update_roadmap_progress.py`
  accepted numeric (`Phase 0`), Roman (`Phase III`), and letter-track
  (`Phase A`, `Phase B1`) — but not digit-then-letter (`Phase 2a`).
  Side effect: `road-to-council-modes.md` produced zero detected
  phases and was silently dropped from `agents/roadmaps-progress.md`.

  **Resolved (2026-05-02)** — Option 1 applied:
  - `\d+` extended to `\d+[a-z]?` (numeric+sub branch); lowercase
    only so `Phase abc` and `Phase 2A` still fall through.
  - Mirrored to `.agent-src/scripts/update_roadmap_progress.py`.
  - Tests added under `tests/test_update_roadmap_progress.py`:
    new `NUMERIC_SUB_FIXTURE`, parametrised regex matches for
    `Phase 2a`/`2b`/`10c`/`1z`, rejection guards for `Phase 2A`
    and `Phase 2ab`, render assertions for the fixture.
  - Dashboard now shows `road-to-council-modes.md` (14/20, 70%).

  **Out of scope:** `road-to-1-15-followups.md` is still missing
  from the dashboard, but for an unrelated reason (zero `## Phase`
  headings — no phase structure at all).

- **Q43** 🎯 `strategic` — **`.agent-src/commands/council.md`
  compressed mirror is stale on Pre-Phase-1.** The compressed
  command file does not yet reflect Phase-1 (pricing / estimate gate
  / overrun callback), Phase-2a (handoff preamble), or Phase-2b
  (mode selection / non-billable bypass). The uncompressed source is
  current; `compress.py --changed` flags it; the hash-based
  `--check` is satisfied because earlier passes ran `--mark-done`
  to defer the recompression deliberately.

  Each phase-pass deferred the LLM-recompression step deliberately
  to avoid landing partial compressed updates. The skill mirror
  (`.agent-src/skills/ai-council/SKILL.md`) was updated in this pass
  with a structured Execution-modes section, but the `/council`
  command is a heavier compression rewrite (Pre-Phase-1 → Phase-2b
  in one go).

  **Decision required:** when to do the compression sweep?

  1. **Now**, in a dedicated session per `artifact-drafting-protocol`
     (Understand → Research → Draft) — single PR.
  2. **After Phase 2c** lands so the compressed file covers all
     three execution modes in one rewrite.
  3. **Never** — keep the compressed file frozen at Pre-Phase-1 and
     point readers at the uncompressed source. Lowest effort, but
     the compression contract is broken.

  **Recommendation:** Option 1 — Phase 2c is gated on Phase 2a
  end-to-end verification which has no committed timeline.

  **Status:** parked. `compress.py --check` will continue to flag
  `commands/council.md` as drifted until this is resolved.

## See also

- [`archive/open-questions.md`](archive/open-questions.md) — Pass 1 (Q1-Q25)
- [`archive/open-questions-2.md`](archive/open-questions-2.md) — Pass 2 (Q26-Q35)
- [`road-to-council-modes.md`](road-to-council-modes.md) — source roadmap for Q37-Q41
- [`road-to-governance-cleanup.md`](road-to-governance-cleanup.md) — P0.6 lint regressions, related to Q36
