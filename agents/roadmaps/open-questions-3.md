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
| 🎯 Strategic | 0 |
| ✅ Resolved | 3 (Q36, Q42, Q43) |
| 🛑 Artifact drafting | 0 |
| 🌐 Cross-repo | 0 |
| 💰 Budget | 0 |
| 📦 External dependency | 0 |
| 🟡 Autonomous default | 5 (Q37-Q41 carry both tags) |

## Questions by roadmap

### `road-to-governance-cleanup.md` (carry-over: P0.6 territory)

- **Q36** ✅ `resolved` — **Always-rule budget breach fixed on
  `feat/road-to-governance`.** `tests/test_always_budget.py`
  was failing because the top-5 always-rules summed to **28,685 chars**
  (cap: 28,000). Sizes before:

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

  **Resolved via Option 1 on `language-and-tone.md`** — trimmed the
  duplicated "source of language truth" fenced block, the canonical-
  failure paragraph, the German/English signal lists in the pre-send
  gate, the numbered slip-recovery list (now prose), and the failure-
  modes parenthetical (already in the linked guideline). No Iron Law
  changed. New size: **5,760 chars** (was 6,586). Top-5 now **27,859 /
  28,000** (141 chars headroom). Full pytest 1,877 green;
  `check_references`, `check_portability`, `skill_linter` clean.

  **Status:** ✅ resolved 2026-05-02 on `feat/road-to-governance`.

### `road-to-council-modes.md` — Phase 2b decisions taken autonomously

The roadmap's *Decisions Required* block lists five questions. All
five carry an explicit *Recommend:* line. The autonomous Phase-2b
pass took each recommendation as the default; user override flips
the decision and re-runs the affected work.

- **Q37** ✅ `architecture` — **Mode precedence confirmed
  2026-05-02.** Invocation flag > per-member setting > global setting
  > built-in default (`api`). Mirrors `cost_profile` resolution.
  Already wired in `scripts/ai_council/modes.py::resolve_mode()`,
  15 tests in `test_modes.py` green. No further work.

- **Q38** ✅ `architecture` — **Manual-mode rendering confirmed
  2026-05-02.** One Markdown block per member; sequential
  copy-paste; per-member follow-up loop. Matches the orchestrator
  flow. Already wired in `ManualClient.ask()`, 8 tests in
  `test_manual_client.py` green. No further work.

- **Q39** ✅ `architecture` — **Project-context fallback confirmed
  2026-05-02.** Silent-empty preamble when no manifest is present;
  `original_ask` carries the load. Already implemented in Phase 2a
  (E1.1 — `ProjectContext` fields all `Optional`); tests in
  `test_project_context.py` and `test_prompts.py` cover the empty
  case. No further work.

- **Q40** ✅ `architecture` — **Playwright adapter scope confirmed
  2026-05-02.** v1 = Claude.ai + ChatGPT.com only. Adapter ABC
  designed so adding a third provider is one new file under
  `scripts/ai_council/playwright_adapters/`. Phase 2c stays
  capture-only — decision applies when the phase is unblocked.

- **Q41** ✅ `architecture` — **Playwright login detection
  confirmed 2026-05-02.** Always-ask before the first submit per
  session; no DOM heuristic. DOM selectors at Claude.ai / ChatGPT.com
  drift too often to rely on; one user confirmation per session is
  cheap. Phase 2c stays capture-only — decision applies when the
  phase is unblocked.

### Block B — `road-to-ai-council.md` retroactive validation (Phase 1 already shipped)

- **Q44** ✅ `security` — **install-key tests confirmed 2026-05-02.**
  Both `tests/test_install_openai_key.sh` and
  `tests/test_install_anthropic_key.sh` to be written. Coverage:
  `/dev/tty` enforcement, mode 0600, atomic write, format check
  (`sk-` for OpenAI, `sk-ant-` for Anthropic), overwrite confirmation,
  no `--force` bypass, no env-var bypass. Pattern reusable for future
  providers. Unblocks A1.2 from `[-]` deferred → `[x]` done.

- **Q45** ✅ `architecture` — **v1 council roster confirmed
  2026-05-02.** Anthropic + OpenAI only. `ExternalAIClient` ABC stays
  open; adding a third provider (Gemini, Mistral, Ollama) is a future
  PR with its own client file, key-install script, and settings
  entry. No Phase-1 code change.

- **Q46** ✅ `security` — **explicit opt-in confirmed 2026-05-02.**
  Key install ≠ permission to spend. Both `install_openai_key.sh` and
  `install_anthropic_key.sh` to print a hint line on success:
  `"To enable: set ai_council.members.<provider>.enabled: true in
  .agent-settings.yml"`. Default `enabled: false` stays. Hard-Floor
  rationale: council is billable, billable ops require explicit
  user sign-off.

- **Q47** ✅ `architecture` — **Phase-2 hook UX confirmed
  2026-05-02.** Always-ask after `/roadmap-create`, `/create-pr`,
  `/review-changes`, `/feature-plan` — `1 yes council / 2 no`.
  Suppressed under `personal.autonomy: on` (council = billable
  side effect). Decision applies when Phase 2 is unblocked. Hybrid
  setting+flag rejected as over-engineered before real-user data.

- **Q48** ✅ `architecture` — **stacked output rendering confirmed
  2026-05-02.** Per-member section block with provider/model header,
  full text, then a convergence/divergence summary written by the
  host agent. Already implemented in `commands/council.md` Step 5.
  Side-by-side rejected (breaks at <120 cols); compact-diff rejected
  (loses provenance).

- **Q49** ✅ `architecture` — **roadmap-mode bundle scope confirmed
  2026-05-02.** `bundle_roadmap()` reads only the roadmap file; the
  bundle manifest signals what was *not* included. User can expand
  manually via `/council files:<paths>`. Auto-crawl rejected — more
  context = more cost + bias surface (council sees what the host
  agent chose to link, breaking neutrality).

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

- **Q43** ✅ `resolved` — **`.agent-src/commands/council.md`
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

  **Resolved 2026-05-02** — Option 1 selected. Compression sweep to
  run **now** as a dedicated `artifact-drafting-protocol` session
  (Understand → Research → Draft). Phase 2c has no committed
  timeline; deferring further would land a fourth drift layer on
  the next phase-pass. Compression contract must hold.

  **Landed 2026-05-02.** `.agent-src/commands/council.md` rewritten
  Pre-Phase-1 → Phase-2b in a single `artifact-drafting-protocol`
  pass: original-ask capture, `mode:api|manual` invocation flag,
  per-member mode resolution (Step 2.5), price-table load + staleness
  gate, billable-only cost estimate with all-manual short-circuit,
  `consult(..., project, original_ask, on_overrun)`, four new
  failure modes (manual aborted, invalid mode, stale-table refresher
  fail, corrupt prices). `compress.py --check` green;
  `compress.py --changed` clean for `commands/council.md`.

## See also

- [`archive/open-questions.md`](archive/open-questions.md) — Pass 1 (Q1-Q25)
- [`archive/open-questions-2.md`](archive/open-questions-2.md) — Pass 2 (Q26-Q35)
- [`road-to-council-modes.md`](road-to-council-modes.md) — source roadmap for Q37-Q41
- [`road-to-governance-cleanup.md`](road-to-governance-cleanup.md) — P0.6 lint regressions, related to Q36
