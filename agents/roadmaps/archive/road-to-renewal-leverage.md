---
complexity: structural
status: ready
parent: road-to-package-renewal.md
---

# Road to renewal — Leverage (execution flows + documented-failure fixes)

> Sub-roadmap of [`road-to-package-renewal.md`](road-to-package-renewal.md).
> ~~Blocked until Foundation Phase 1 is green.~~ **UNBLOCKED 2026-08-02** —
> Foundation Phase 1 went green in PR #1109 and the whole Foundation
> sub-roadmap is now complete and archived.
> (Council-locked ordering: fix the oracle before shipping behavior changes
> it must validate.)
>
> **Harvest-freeze lock note (council 2026-08-02, loop 1, unanimous):** the
> restraint decision of 2026-07-20 freezes capability-adoption until the first
> documented external adopter. Phase 2 below carries ONLY borrows that pass
> the return-prevention discriminator — each closes a RECORDED internal
> failure and cites its incident. The purely additive borrows are frozen and
> listed in the central roadmap under "Findings not carried forward". Each
> borrow lands re-derived against house standards per code-provenance.

## Phase 1 — execution flows

- [-] Work-engine batching: collapse the one-CLI-round-trip-per-step loop by
      batching directives per invocation (most steps are no-op precondition
      gates); respect the ADR-124 embedded-engine doctrine — this changes call
      granularity, not the engine's shape; verify: one real roadmap run
      before/after (invocations per phase recorded in the PR description)
      <!-- refused 2026-08-02 — premise falsified by measurement; council
      2026-08-02 (anthropic/claude-sonnet-4-5 + openai/gpt-4o) unanimous on the
      falsification. MEASURED, full backend flow driven end to end: 7 CLI
      invocations (refine · analyze · plan · implement · test · verify ·
      SUCCESS), 506 ms each. The step's premise — "most steps are no-op
      precondition gates" — does NOT hold: of 24 directive modules only 4 are
      pure no-op gates (1 of them dead code) and 2 validation-only; 18 do real
      work. No-op gates already cost nothing — the dispatcher walks all 8 slots
      IN-PROCESS and only exits on a halt. The round-trip is therefore one per
      HALTING directive, and every halt is a genuine agent handoff whose next
      directive is computed from the answer the agent just produced. There is
      no batch to collapse.
      TRANSPORT FINDING (recorded, not shipped here): 87% of the per-cycle cost
      is transport, not the engine — 506 ms via `./agent-config work`, 241 ms
      invoking the engine directly through tsx, 67 ms from an esbuild bundle.
      ADR-204 already ships exactly this mechanism (`dist/cli-delegate/`,
      measured 5.7x there) but its build covers only `src/scripts/_cli/cmd_*.ts`
      — the work engine is the one Tier-0 flow that never got a bundle.
      BLOCKER on adopting it: a trial bundle reproduces the recorded
      esbuild entry-guard landmine — 13 modules under
      `src/agent-src/templates/scripts/` use an `_isCliEntry()` guard with NO
      `__AGENT_CONFIG_BUNDLE__` short-circuit, so inside a bundle (where every
      module shares one `import.meta.url`) a transitively imported CLI hijacks
      argv (`memory_lookup: unrecognized arguments: --state-file`). Adopting
      the bundle is a 13-file guard hardening plus a pack-size check against
      thin headroom (27.45 of max 28) — a distinct change with its own
      verification, out of this step's scope. -->
- [-] Opt-in parallel step dispatch in `/roadmap:process-full` for independent
      steps (subagent fan-out with verified returns; subagent locks from the
      A1 contract stay: verify every return, N=3 budget, no Hard-Floor
      delegation)
      <!-- refused 2026-08-02 — council unanimous (both members, option (a)):
      architecturally incompatible with the constraints that already bind this
      runner. (1) The atomic-flip Iron Law requires each step's checkbox to
      flip in the same reply that lands its work, before the loop advances —
      two concurrent workers editing one markdown file need pessimistic locking
      (which re-serialises) or optimistic merging (which violates
      verify-before-adopt). (2) Roadmap steps are frequently NOT independent:
      later steps read files earlier steps create, and the precondition-gate
      pattern used in this very roadmap has one step CLOSE a later step based
      on its own finding — P1.5 gating P1.6 below is the live instance.
      Automatic independence inference (option c) would have to predict that.
      Fan-out stays where it already is and is already used: read-only
      reconnaissance subagents dispatched BEFORE the sequential loop. -->
      <!-- verify: 4 read-only recon subagents were dispatched in parallel at the
      start of this run; the step loop itself stayed sequential. -->
- [x] Flip `roadmap.dashboard_regen_cadence` default from `per_step` to
      `every_5_steps` (file-shape touches still regen immediately per
      roadmap-progress-sync Iron Law 1)
- [x] Feed the ~1,900-line no-invocation-path finding (analysis estimate —
      enumerate first: file list + method) as input evidence into
      `road-to-surface-consolidation.md` Phase 3, which OWNS the
      utilization-window disposition sweep (window elapses ~2026-08-26;
      pre-window deletions forbidden by its verify). No parking action here
      <!-- done 2026-08-02: enumerated (method + result table in
      road-to-surface-consolidation.md Phase 3 § Input evidence). The estimate
      is a NULL — 0 commands / 0 lines have no invocation path, not ~1,900.
      Of 193 commands: 53 suggestion-eligible, 65 hub-routed, 73 named in a
      stable surface, 2 residuals reachable only under their `replaces:`
      aliases. By-product fed into Phase 3: hub/contract/disk disagreement on
      sub-commands (see P1.5 below for the measured extent). A first
      by-product reading — "space vs colon slug form is drift" — was CHECKED
      AND DISMISSED: `docs/contracts/command-clusters.md:157` makes
      `/<cluster> <sub>` a first-class equivalent. No parking action, no
      deletion. -->
- [x] Precondition gate for hub generation: name the measured cost the
      generator would remove (projection token footprint of hub bodies, or a
      concrete hub↔contract drift bug); no cost nameable → close the next
      step as `[-]` with that finding
      <!-- gate evaluated 2026-08-02. TOKEN LIMB: NOT satisfied — hub bodies
      are outside every measured budget. `check_always_budget` reads only
      `dist/agent-src/rules` + its load_context closure;
      `measure_augment_budget` reads only AGENTS.md + `.augment/rules`; the
      per-spawn preamble ratchet counts rules, the one-line skill
      descriptions, and the instruction hierarchy — never command bodies,
      which load on invocation only. The 37 orchestrator bodies are ~97,159
      chars (~24.3k tok) and touch exactly one gate: the npm tarball, at ~2%
      of a budget with ~8% headroom. There is no projection token cost to
      remove.
      DRIFT LIMB: SATISFIED, two instances verified first-hand plus a
      systematic third. (1) `/roadmap` has 6 subs on disk, its table lists 5 —
      `materialize` is in neither the table nor the locked contract.
      (2) `/memory` has 6 on disk, its table lists 5 — `learn-low-impact` is
      missing from the hub although the contract registers it. (3) `routes_to:`
      is incomplete on 12 of the 25 contract-listed dispatch clusters.
      `check_cluster_patterns` structurally cannot see this class: it iterates
      the CONTRACT, never the filesystem; it checks `routes_to` for
      resolvability, never completeness; and it matches the `## Sub-commands`
      table HEADER, never its rows.
      Gate verdict: one of the two named costs IS nameable, so the next step is
      NOT auto-cancelled by this gate — it is decided on its own merits below.
      Dismissed on inspection: hubs mixing `/worktree create` with
      `/analyze:decision` is style, not drift — command-clusters.md:157 makes
      the space form a first-class equivalent. -->
      <!-- verify: node - <<'EOF' enumerating src/domains/**/command.md against each dispatcher's table + routes_to; reproduced 12/25 clusters with drift. EOF -->
- [-] Generate cluster hub bodies from frontmatter (41 cluster-hub command
      files, ~87 lines avg of repeated dispatch ceremony); verify: generated
      output equals the current hand-written bodies or the intended diff is
      reviewed, with a regen assertion in CI
      <!-- refused 2026-08-02 — council unanimous (both members, option (c)):
      the drift is real but a generator is the wrong instrument for it. The
      measured shape: 19 of 37 orchestrators (51%) carry at least one
      non-standard section that frontmatter cannot produce — a hand-authored
      natural-language→sub-command routing table with confidence tiers and a
      safety carve-out ("`cleanup` is never auto-selected below HIGH
      confidence"), legacy-forwarding rules for removed command names, per-hub
      exceptions. Only 8 of 37 carry the full canonical boilerplate set, so the
      generator would apply cleanly to ~22% of the corpus and would have to
      preserve the rest behind markers. The counts are also softer than the
      step assumed: 41 is the union of two definitions, 4 of the 41 are not
      dispatchers at all but full commands with one nested sub (951 lines,
      25% of the total), and the true average is 91.4 lines, not ~87.
      Decisively: generation would fix hub-derived-from-disk drift only — the
      contract-side half (rows with no file, orchestrators with no row) would
      survive it untouched. SUBSTITUTED, same step, narrower instrument:
      extend the existing `check_cluster_patterns` gate to enumerate the
      filesystem so the drift class becomes CI-visible, and fix the instances
      it surfaces. That removes the named cost without minting a generator —
      and honours the recorded restraint decision, which requires a new
      mechanism to name what it retires (this adds none: the assertions land
      inside the gate that already owns cluster shape). -->
      <!-- verify: ./scripts-run src/scripts/check_cluster_patterns -->
- [x] Extend `check_cluster_patterns` with filesystem enumeration (substitutes
      the refused generator above): every on-disk `<sub>/command.md` of an
      orchestrator must appear in the hub's `## Sub-commands` table and in its
      `routes_to:`; fix the instances it surfaces
      <!-- verify: ./scripts-run src/scripts/check_cluster_patterns -->
- [-] Trim `post_tool_use` hook fan-out: 7 concerns run on every tool call on
      6 platforms — gate concerns by event relevance; verify: hook manifest
      shows per-event registration + a unit test asserting a non-matching
      event skips the gated concerns
      <!-- closed 2026-08-02 as a non-problem, on the council's own measurement
      gate (both members: option (b) IF the pre-guard cost exceeds ~5 ms, else
      close). MEASURED on the bundled dispatcher, plain `Read` payload — the
      non-matching case the latency harness itself calls "the fast path
      consumers pay on every tool call" — 20 runs per event, against a project
      root carrying a real 65 KB `.agent-settings.yml`:
        · `pre_compact`   (0 concerns bound) → 70 ms   ← the floor
        · `pre_tool_use`  (5 concerns)       → 75 ms
        · `post_tool_use` (7 concerns)       → 80 ms
      All seven concerns together cost ~10 ms, ~1.4 ms each, against a p95
      budget of 250 ms (harness p95 today: 81 ms). 88% of a tool call's hook
      cost is the dispatcher/Node floor, not the fan-out. Per-event
      registration already exists and already filters (`_resolve_concerns`
      matches platform + event); the manifest schema forbids a per-TOOL matcher
      (`_check_platforms` requires a flat list of concern names), so option (a)
      would mean schema + lint + dispatcher + tests + a 6-platform projection
      review to reclaim single-digit milliseconds — ceremony, not cost removal.
      Four of the seven already self-filter by tool for free; the two that do
      work before their guard (injection-scan re-reads settings, chat-history
      touches its log before the cadence bail) are inside the same ~1.4 ms and
      do not clear the gate either.
      REAL COST, recorded not fixed: the 70 ms floor. It is a transport
      property of the dispatcher, shared with the work-engine transport finding
      in P1.1 above, and out of this step's scope. -->
      <!-- verify: echo '<Read payload>' | node dist/hooks/dispatch.js --event <ev> --platform claude — 20 runs per event; and npx tsx src/scripts/bench_hook_latency.ts -->

## Phase 2 — documented-failure fixes with borrowed shape

> Discriminator (council loop 1): "would this borrow's absence cause a RETURN
> to a previously-documented failure state?" Every item cites its incident.
> Loop-2 audit note: the PreCompact re-injection borrow was moved to the
> frozen list — its incident citation did not verify (the hot-context cache
> was a capability ADOPT, not an incident fix) and the shipped
> `hot_context_hook.ts` already restores on SessionStart source=compact.

- [x] Worktree seeding allow/deny list (adapted from Source W's committed
      manifest, re-scoped to the cheaper rung): encode the documented trap
      list — symlink `node_modules`, copy `.augment/`, NEVER copy
      `.agent-settings.yml` — directly in the existing worktree-creating
      flows; a committed manifest file only if flow-external tools need it.
      Incidents: the recorded worktree-trap family (partial node_modules
      fakes failures; pre-push projection trap; stale dist fakes generator
      drift)
- [x] Config-protection hook (adapted from Source E): PreToolUse guard that
      blocks edits weakening gates/thresholds/allowlists in config while a
      fix-loop is active — "fix the code, not the config". Incident: the
      documented allowlist-growth antipattern (>20 entries in one session =
      the linter is wrong; recorded as a silent budget bypass)
      <!-- done 2026-08-02 — `src/scripts/hooks/block_config_weakening.ts`,
      registered on the three `pre_tool_use` platforms + the concern registry,
      `fail_closed: false`. Council 2026-08-02 split on the shape and both
      halves are honoured: NO invented "fix-loop is active" predicate (both
      members rejected it as speculative — no such state exists and defining
      entry/exit invites two-sided false positives). The step's phrase "while a
      fix-loop is active" resolves to the window the recorded rule ALREADY
      names — one SESSION — read from the envelope's session id, so nothing is
      invented. Mechanically-decidable surface BLOCKS (allowlist entry growth,
      cumulative per session per file: silent below 5, warn 5-20, block past
      the rule's own cap of 20, deny message naming the human action). The
      contextual surface WARNS only (violation baselines, budget thresholds) —
      a rising baseline may be a legitimate ratchet reset after a refactor and
      the edit alone cannot tell, which is exactly the false-positive class the
      dissenting member warned about. Counting parses JSON string leaves rather
      than lines, so a reformat is not read as growth, and a shrinking
      allowlist banks no credit. The enforced-by pointer is recorded in
      `autonomous-execution` § Antipattern. -->
      <!-- verify: npx vitest run tests/scripts/hooks/block_config_weakening.test.ts (19 green) + an end-to-end dispatcher probe: 1-entry add → exit 0, 24-entry add → exit 1 (blocked), unrelated file → exit 0 -->
- [-] Inline-Brief fallback in orchestrating commands (adapted from Source W):
      2-3-line essence of each dispatched skill so a missing skill degrades
      gracefully instead of breaking the flow. Incident: the recorded UI-track
      failure dispatching to nonexistent skills
      <!-- refused 2026-08-02 — the borrow FAILS this phase's own
      discriminator: "would this borrow's absence cause a RETURN to a
      previously-documented failure state?" No, because the cited failure state
      is already prevented by a shipped gate — the same loop-2 audit move this
      phase already applied to the PreCompact borrow.
      The incident was the UI track dispatching to `ui-apply-<stack>` /
      `ui-design-review-<stack>` / `ui-polish-<stack>` names with no SKILL.md
      behind them, with `plain` (the fallback for every unrecognised stack)
      redirecting to a laravel-pack skill a non-Laravel consumer never
      installed. Both halves are closed: `docs/contracts/ui-stack-extension.md`
      now states those strings are directive VERBS the agent interprets, not
      skill paths (only 2 of the engine's 11 literal verbs name a skill at
      all), and `STACK_BUNDLES` moved the verb→skill mapping out of prose into
      a checked module. `lint_ui_stack_bundles` asserts every bundle member
      resolves to a real skill AND that no pack-agnostic lane names a
      pack-only skill — it reports 8 lanes clean on this branch.
      Nor does a generic version have a live failure to prevent: command bodies
      name skills as markdown links, and `check_references` validates those
      (1,042 scanned, 0 broken this run). Adding a 2-3-line brief per dispatched
      skill across 37 orchestrators is a large ADDITIVE surface under an active
      harvest freeze, for a degradation path that no longer exists.
      RESIDUAL, recorded not fixed (out of this step's shape, and not a
      breakage): the `skills:` frontmatter field is unvalidated — 26 command
      files name entries that resolve to no `src/skills/<name>/SKILL.md`
      because the field is used loosely for rules, sibling commands, and tool
      names alike. `skill_linter`'s `command_missing_skill_references` only
      asserts the field is NON-EMPTY, never that entries resolve. Nothing
      dispatches off it at runtime, so it misleads readers rather than breaking
      flows — a validation question for whoever next owns that field, not an
      inline-brief question. -->
      <!-- verify: npx tsx src/scripts/lint_ui_stack_bundles.ts → 8 lane(s) clean; npx tsx src/scripts/check_references.ts → 1042 scanned, no broken references -->

## Phase 3 — tracker clarification (docs-only)

- [x] Document the existing `## Blockers` section convention
      (Status/Owner/Blocks/What to do/Resolved when) as the canonical
      "awaiting-evidence" signal in the roadmap-management skill — no new
      status glyph (the proposed `awaiting-evidence` state is frozen per the
      harvest-freeze split; the convention already carries the need)

## Verification

- Every behavior change re-runs the gates it touches; flow changes get a
  before/after on one real roadmap run (steps/hour, tokens/step). Measurement
  precondition: the run enables the orchestration/artifact-engagement
  telemetry for that session — it is default-off, so an unconfigured run has
  no data source (subagents themselves ship enabled per ADR-117).
