---
complexity: structural
status: ready
---

# Roadmap: Metadata & Command-Surface Leanness

> Active (`status: ready`). It exists to capture the *defensible* slice of the
> "merge commands / drop tier+visibility metadata" idea **without
> relitigating decisions two AI councils already locked**.

## Goal

Remove the genuinely redundant parts of the command-surface metadata and
command tree — the `tier:`↔`visibility:` dual-field and the already-deprecated
`fix:pr-*` variants — while explicitly *not* touching the `tier`/`visibility`
fields that are load-bearing and *not* re-opening the council-locked
"keep every cluster" / "keep every skill" verdicts.

## Premise correction (read before scoping any phase)

The triggering question assumed two things the evidence contradicts. Both are
recorded here so no phase below silently re-derives them:

1. **`tier:` / `visibility:` are NOT unnecessary metadata — they are
   load-bearing.**
   - Rule `tier` (`kernel`/`tier-1`/`tier-2` + legacy values) compiles into
     `dist/router.json` via `src/scripts/compile_router.py` and drives
     session-start rule activation per profile. Removing it breaks routing.
   - Command `tier`/`visibility` drives CLI filtering
     (`src/cli/commands/commands.ts` `--visible`), per-pack visible-command
     budgets (`src/scripts/audit_command_surface.py`), and the published
     discovery manifest (`src/scripts/build_discovery_manifest.py`). Enforced
     in CI by `src/scripts/lint_command_tiers.py`.
   - Skill `tier: senior` gates the senior-structure linter checks
     (`src/scripts/skill_linter.py`, `src/scripts/lint_handoffs.py`);
     `model_tier` (distinct field, 227/227 skills) drives model selection.
   - **The only real redundancy is command `tier` vs `visibility`** — two
     fields encoding the same 3-level classification. That, and only that, is
     the metadata-simplification target (Phase 3).

2. **Merging command files does NOT make the runtime "lighter" and does not
   avoid "loading subclasses."**
   - Sub-commands load lazily — only when the parent routes to them. The
     Claude/Cursor/etc. projections are symlinks (0 bytes materialized). File
     count carries a *build-time* and *navigation* cost, not a per-session
     token cost. The benefit of merging is fewer file entities + clearer
     mental model, not load savings.
   - A command-surface AI council already concluded **"keep · 0 merge ·
     0 retire"** — every flagged overlap (`roadmap:process-*` scope ladder,
     `council:*` / `judge:*` specialists, `ghostwriter:*` CRUD, thin aliases)
     is an intentional structural pattern, not duplication. See
     `agents/reports/command-surface.md` and `command-budget-audit.md`.

## Out of scope (locked — do NOT re-open in this roadmap)

- **Skill consolidation.** `agents/evidence/metrics/skill-rationalization-candidates.md`
  is locked at **210 keep · 0 merge · 0 retire** (maintainer override
  2026-05-16); the 208 → ≤160 target was *dropped*. Re-opening starts from the
  never-run 2026-06-15 activation re-analysis gate, not from re-deriving
  structural overlap. Not this roadmap.
- **Scope-ladder / dispatcher / specialist clusters** — `roadmap:process-*`,
  `council:*`, `judge:*`, `image:*`, `video:*`, `memory:*`, `agents:user:*`,
  `optimize:*`. Council-kept; merging adds runtime-dispatch complexity for no
  load gain.
- **`pr:create:description-only`** — intentional standalone surface (draft a PR
  body without opening the PR). Keep.
- **Hard removal of rule `tier` legacy values** — owned by the kernel/router
  track, not here.
- **Re-evaluation of council-locked merges** (`commit`+`commit:in-chunks`,
  scope-ladder / dispatcher / specialist clusters). If usage telemetry or a
  new subsuming abstraction later invalidates a prior verdict, that is a
  *new* roadmap or standalone ADR — never smuggled into this one. Trigger:
  ≥90% drop in the variant's invocation over 6 months, OR a `--mode`-style
  flag subsuming ≥3 variants. Not met as of 2026-06-13.

## Phase 1 — Lock the evidence base

- [x] Capture the consumer inventory for `tier` (rules/commands/skills) and
      `visibility` as a context note under `agents/settings/contexts/` so future
      sessions don't re-trace it. Cite `compile_router.py`,
      `audit_command_surface.py`, `build_discovery_manifest.py`,
      `commands.ts`, `lint_command_tiers.py`, `skill_linter.py`.
      <!-- done: agents/settings/contexts/tier-visibility-and-merge-evidence.md -->
- [x] Record the two council verdicts inline in that note (command-surface
      "keep · 0 merge"; skill rationalization "210 keep · 0 merge", target
      dropped) with date + members, per `no-roadmap-references` (inline
      convergence, no transient-path links).
- [x] State the file-count-≠-runtime-load fact with the projection mechanism
      (lazy routing + symlink projection) so "leaner" is never re-claimed as a
      token-load argument.

## Phase 2 — Finalize the already-deprecated `fix:pr-*` variants

> Uncontested. `src/domains/engineering-base/fix/command.md` lines 39–40
> already mark `fix pr-bot-comments` and `fix pr-developer-comments` as
> **Deprecated → `fix pr-comments`**. This phase finishes the deprecation.

- [x] **Usage gate before deletion** (council blocking #1). These names
      (`pr-bot-comments`, `pr-developer-comments`) could be invoked by a
      script/hook, not just interactively. Before deleting: grep the tree +
      any session/analytics logs for invocations; absent usage telemetry,
      require an explicit maintainer override ("interactive-only, safe to
      delete") recorded in the PR. Zero-evidence-of-use is the precondition,
      not an assumption.
- [x] **Downstream-first:** `fix/pr-comments/command.md` currently *delegates*
      to the two deprecated files for its actual instructions (lines 22, 55,
      62 reference "follow the full `/fix pr-bot-comments` instructions").
      Inline the bot- and developer-comment procedures *into* `pr-comments`
      first, so it is self-contained before anything is deleted. **Diff the
      metadata first:** if `pr-bot-comments` / `pr-developer-comments` carry
      `model_tier:`, `skills:`, or budget overrides not present in
      `pr-comments`, inline them too or document why dropping them is safe.
- [x] Delete `src/domains/engineering-base/fix/pr-bot-comments/command.md` and
      `src/domains/engineering-base/fix/pr-developer-comments/command.md`.
- [x] Update `fix/command.md`: drop the two rows from the routing table, remove
      `fix-pr-bot-comments` / `fix-pr-developer-comments` from `routes_to:` and
      the `description:` line, keep the auto-detection pointing only at
      `pr-comments`.
- [x] Grep the tree for stale references to the two deleted command names
      (skills, contexts, README, catalog, other commands) and repoint to
      `fix pr-comments` (per `downstream-changes` + `check-refs`).
- [x] Re-run `task sync` + `task generate-tools` and `python3
      src/scripts/lint_command_tiers.py` + `task check-refs` — confirm green
      for the touched surface. <!-- done: commands 150→148; lint_command_tiers green; zero stale .md refs; check-refs failures all pre-existing in untracked agents/.harvest-local/ + road-to-reaping-catches (not this change) -->
      generate-tools skipped `.claude/` projection locally (known `tools:[]` limitation; dist regenerated).

## Phase 3 — Collapse the `tier:`↔`visibility:` command dual-field

> The one real metadata redundancy. ADR-090 (2026-06-13) made `visibility:`
> the source of truth and `tier:` a back-compat alias, **deferring** the
> `tier:` drop (Option B) "once readers and the manifest have fully migrated".
> This phase assesses whether that window can close — it does not unilaterally
> drop `tier:`.

- [ ] Inventory consumers that still read the integer `tier` (not `visibility`):
      grep `src/` for `tier` reads, confirm `commands.ts`,
      `audit_command_surface.py`, `build_discovery_manifest.py` all already
      prefer `visibility` (ADR-090 step 3). Note any reader still keyed on the
      integer.
- [ ] Determine whether the **published discovery manifest** still needs to
      dual-emit `tier` — are there external consumers of the integer key?
      **Hard stop on unknown** (council blocking #2): the manifest is a
      published API surface, so the burden of proof is "no consumers exist",
      not "we searched and found none". Three outcomes only:
      **none-evidenced** → window closeable; **consumers found** → migration
      timeline (dual-emit soak); **unknown** → Phase 3 terminates `[~]`
      deferred, no ADR, no backfill. Re-open only on positive zero-consumer
      evidence (e.g. manifest-fetch telemetry zero for a soak window + repo
      search zero hits).
- [ ] Author a follow-up ADR closing ADR-090's deferred Option B —
      **three-outcome**, decided by the step above, not pre-assumed:
      accept (drop `tier:`), reject (keep dual-emit / lock indefinitely), or
      defer (insufficient evidence). **Gate:** ADR authoring only; backfill is
      gated behind ADR *acceptance*, and is its own task (per `scope-control`
      authoring-vs-implementation).
- [ ] If the ADR accepts the drop: scripted backfill-removal of `tier:` from
      the 150 command sources, schema edit (remove the `tier` property +
      consistency clause), reader cleanup (drop the `tier`-fallback branches),
      manifest stops dual-emitting. One reviewable diff. `lint_command_tiers.py`
      then enforces `visibility` alone.

## Phase 4 — `commit` + `commit:in-chunks`: decision recorded, not pursued

> The triggering example. A validation council (2026-06-13, anthropic/
> claude-sonnet-4-5 + openai/gpt-4o, deep + peer-review) flagged a *self-
> contradiction* in the earlier draft: re-running a council on this pair
> here contradicts the out-of-scope lock against re-litigating council-kept
> clusters. Both members converged on **document-why-not**, not re-decide.
> This phase therefore records the decision rather than reopening it.

- [ ] Record the rationale (no file change to the commands):
      `commit.md` (197 lines) vs `commit/in-chunks.md` (149 lines) share ~80%
      procedure, but the 20% delta is an **execution-semantics fork**, not a
      thin variant: `/commit` has a confirmation/preview gate; `in-chunks` is
      autonomous per `autonomous-execution`. Folding into a `--autonomous`
      flag means `commit.md` carries two conditional paths + the flag becomes
      a permanent first-class feature — higher long-term maintenance than two
      files. The command-surface council already concluded "keep · 0 merge".
- [ ] Add the re-evaluation trigger to the out-of-scope list (below) so a
      *future, separate* roadmap — not this one — owns any merge: re-open only
      on positive evidence, e.g. ≥90% drop in `commit:in-chunks` invocation
      over 6 months, OR a new universal `--mode` flag that subsumes ≥3 command
      variants. Not met as of 2026-06-13.
- [ ] Close this phase `[-]` cancelled (decision = keep both), rationale
      inline. No command file touched.

## Acceptance criteria

- Phase 1 context note exists and is linked from this roadmap; no later phase
  re-derives the consumer inventory or the council verdicts.
- `fix:pr-bot-comments` and `fix:pr-developer-comments` no longer exist;
  `fix pr-comments` is self-contained; zero stale references; command-tier lint
  and ref-check green for the touched surface.
- A follow-up ADR records the three-outcome `tier:` decision (accept / reject /
  defer); if accepted, command frontmatter carries `visibility:` only and the
  consistency check is gone.
- **Discovery surface stable** after Phase 2: `task generate-tools` tool count
  drops by exactly the deleted variants, discovery-manifest JSON still
  validates, and the CLI `--visible` filter returns the expected command set
  (spot-check vs pre-Phase-2 baseline).
- Phase 4 ends as `[-]` cancelled with the keep-both rationale recorded — no
  unilateral merge, no in-roadmap council re-run against the prior verdict.
- No skill files merged/retired; no scope-ladder / dispatcher cluster touched.
