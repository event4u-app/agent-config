---
complexity: lightweight
status: ready
estate_growth_exempt: "Re-opened from the archive on the owner's instruction of 2026-10-09 to carry Phase 2, the retirement of 47 settings keys the owner selected from the retirement audit; the work belongs to this roadmap's own ratchet and no live roadmap covers it."
estate_offset_exempt: "No active roadmap is finished or parkable in this change: every other active (ready) roadmap still holds at least one open step (measured 2026-10-09), so archiving one to offset this re-opening would bury live work."
execution:
  mode: phase-checkpoints
---
# Road to settings classes derivable surface stagnation

> **Source:** `task lint-settings-classes`, red on PR #2267
> (`drain/neighbours-carried-20261008`, an unrelated roadmap-disposition
> change touching no settings file) and, by construction of the gate, equally
> red on `origin/main` itself — `src/config/gate-violation-baselines.json`'s
> `lint_settings_classes:derivable-surface` entry carries `"landed":
> "2026-08-12"` with no `reaffirmed` block, and the 56-day non-stagnation
> clause fires purely on elapsed calendar time, independent of any diff.

## Goal

The `lint_settings_classes:derivable-surface` ratchet stops failing CI for a
reason unrelated to the PR that happens to trip it: either the 83-of-134
`derivable`-classified settings-template leaves are walked down (the
mechanism each one names gets built, the key deleted), or the baseline is
re-audited and a `reaffirmed: {date, reason}` block is added honestly —
meaning each of the 83 was actually re-read, not merely re-stamped.

## Phase 1 — Decide how to spend this debt

- [x] **1.1 Pick a disposition for the stalled `derivable`
      queue.** Either (a) begin draining it — implement the mechanism a batch
      of entries names and delete those keys — or (b) re-read all 83 entries
      against the current tree and add a `reaffirmed: {date, reason}` block to
      `lint_settings_classes:derivable-surface` in
      `src/config/gate-violation-baselines.json` stating what was checked and
      why none are yet repairable. A reaffirmation written without re-reading
      the population is the same laundering the ratchet exists to catch.
      verify: `./scripts-run src/scripts/lint_settings_classes` -> 0

## Phase 2 — Retire the 47 keys whose absence changes no default

The 2026-10-09 retirement audit
(`agents/evidence/analysis/settings-derivable-retirement-audit-2026-10-09.md`)
asked the question the reaffirm in 1.1 did not: does retiring a key **together
with every reader of it** change an effective default? For 51 of 83 it does not —
the key has no reader, or every reader's fallback, rule or code default already
equals the template value. The reaffirm's "0 of 83" stands for its own question
(no key is deletable while its readers remain); the two readings do not conflict.

The owner selected 47 of the 51 (D1). Each step below retires one group: remove
the key from `src/config/agent-settings.template.yml`, its row from
`docs/contracts/settings-classes.md`, every reader (code, schema, wizard, rule
and command prose) so behaviour equals the old default, then lower the
`lint_settings_classes:derivable-surface` count by the group's size in
`src/config/gate-violation-baselines.json`. A reader the audit missed that turns
out to change behaviour moves its key back to the queue instead of being
retired. Re-verify each key against the audit table before deleting it — the
table is a measurement of one commit, not a licence.

- [x] **2.1 Output and tone (9).** `personal.minimal_output`,
      `personal.play_by_play`, `personal.pr_comment_bot_icon`,
      `verbosity.intent_announcements`, `verbosity.preview_artifacts`,
      `verbosity.routine_confirmations`, `verbosity.post_action_reports`,
      `telegraph.speak`, `tokens.rich_skills`.
      Retired, all nine (count 83 → 74). Re-verified against the tree: the
      only code reader was `compile_time_toggles.ts` (`telegraph.speak`, now a
      fixed `false`); every other reader was rule, command or context prose,
      rewritten to state the old default. `personal.pr_comment_bot_icon` had a
      prose reader claiming default `true` (`fix/pr-comments`), contradicted by
      the template's `false` and by the universal 🤖 ban — the retirement keeps
      the template value. One reader could not be edited here: the kernel rule
      `direct-answers` § Narration carve-out names `personal.play_by_play` and
      `verbosity.intent_announcements`. Its behaviour is unchanged (the
      carve-out needs both `true`, which can no longer happen), but its text is
      stale; a kernel edit ships in its own PR — recorded as D2 and the reason
      AC-2 stays open.
      verify: `./scripts-run src/scripts/lint_settings_classes` -> 0
- [x] **2.2 Reasoning protocol switches (10).** `reasoning.auto_gate` and the
      nine `reasoning.components.*` (orchestrator, notes_first, grounding,
      intent, complexity_first, verifier_default, prediction_tracking,
      decision_ledger, uncertainty_budget). `reasoning.enabled` is NOT in this
      group: the audit left it `unclear` because `bench_ab_clone.ts` uses it as
      the without-RDP arm of an A/B benchmark.
      Retired, all ten (count 74 → 64). Re-verified: no code reader; the
      only reader was `rdp-gate.md` signal 1, plus `bench_ab_clone.ts`, which
      wrote `auto_gate: true` (the default) into its benchmark settings and now
      writes `reasoning.enabled` alone — the A/B lever it exists for. The
      components keep running exactly as before: every switch defaulted
      `true`, and the gate's task and host signals now decide alone.
      verify: `./scripts-run src/scripts/lint_settings_classes` -> 0
- [x] **2.3 Roadmap cadence (3).** `roadmap.skip_pre_run_gate`,
      `roadmap.quality_cadence`, `roadmap.dashboard_regen_cadence`.
      Retired two (count 64 → 62): `roadmap.skip_pre_run_gate` and
      `roadmap.dashboard_regen_cadence`. Both had prose readers only
      (`roadmap-process-loop` § 2, § 4 and step 6; `roadmap-progress-sync`
      pre-send step 3; `roadmap-progress-mechanics`), each stating the same
      default as the template; they now state the fixed behaviour.
      **Moved back to the queue: `roadmap.quality_cadence`.** The audit read
      the reader fallback (`end_of_roadmap`) as equal to the template value,
      but the template and the Zod schema have shipped `per_phase` since
      2026-09-13 while `roadmap-process-loop` § 4, the reference page and the
      class contract still said `end_of_roadmap`. Two defaults: retiring the
      key fixes one of them as the behaviour and silently changes it for
      whoever relied on the other. The contract row now records both; which
      one wins is the decision that would let the key go.
      verify: `./scripts-run src/scripts/lint_settings_classes` -> 0
- [x] **2.4 Command suggestion and PR creation (8).** `commands.auto_detect`,
      `commands.suggestion.enabled`, `commands.suggestion.confidence_floor`,
      `commands.suggestion.cooldown_seconds`, `commands.suggestion.max_options`,
      `commands.create_pr.api_examples`, `commands.create_pr.ui_paths`,
      `commands.create_pr.api_paths`.
      Retired, all eight (count 62 → 54). Re-verified: the one code reader
      was `command_suggester/settings.ts`, which read the four suggestion
      knobs with the same defaults the template shipped (`true` · 0.6 ·
      600 · 4); it now reads only `blocklist`, and the four values stay as
      `Settings` engine constants. `commands.auto_detect` had a prose reader
      only (`non-interactive-contract` § 7–8); the per-orchestrator
      front-matter switch and `--no-auto-detect` remain. The three
      `create_pr` keys were read only by `/create-pr` prose, whose default
      path (grounded examples, light heuristic) is now the only path.
      verify: `./scripts-run src/scripts/lint_settings_classes` -> 0
- [x] **2.5 Memory and knowledge sharing (7).** `memory.cadence`,
      `memory.review_threshold` and the five `knowledge.global_sharing.*`
      leaves (`redaction.enabled`, `redaction.halt_on_trigger`,
      `auto_promote_threshold`, `freshness.hypothesis_after_days`,
      `freshness.stale_after_days`).
      Retired, all seven (count 54 → 47). Re-verified: `memory.cadence` was
      read by the work-engine hook settings loader (fallback `always`, the
      template value), which no longer reads it; the hook's own default
      stays `always`. `memory.review_threshold` had one prose reader
      (`/memory load`), now a fixed 10. The five `knowledge.global_sharing`
      leaves were read through `load_global_sharing_config`, whose code
      defaults equal the template; it now merges only `enabled` and
      `allowed_tiers`. All six left the user-global whitelist in both
      loader copies.
      verify: `./scripts-run src/scripts/lint_settings_classes` -> 0
- [x] **2.6 Hooks and engine (5).** `hooks.concern_budget.max_per_event`,
      `hooks.concern_budget.hard_fail`, `decision_engine.surface_traces`,
      `decision_engine.on_block_fallback`, `explain.enable_last`.
      Retired, all five (count 47 → 42). Re-verified: `lint_hook_concern_budget`
      read the two budget keys through its own line walker with defaults equal
      to the template (8, warn-only) and now reads only `tier1_concerns`;
      `--strict` stays the hard-fail lever. The work-engine `decision_engine:`
      parser read `surface_traces` and `on_block_fallback` (defaults `false`,
      `stop`); it now fixes both, and keeps accepting the two keys because it
      rejects unknown keys hard — dropping them from the allowed set would
      have thrown away every gate a consumer configured next to the template's
      leftover lines. `cmd_explain` read `enable_last` (`=== false` disables)
      and now always renders. Consequence worth knowing: with
      `surface_traces` gone, nothing in settings registers
      `DecisionTraceHook`, so the per-phase decision-trace file is not written
      — the default it always had.
      verify: `./scripts-run src/scripts/lint_settings_classes` -> 0
- [x] **2.7 Remaining (5).** `project.pr_template`,
      `pipelines.skill_improvement`, `consistency.cross_source`,
      `subagents.downshift`, `ai_team.suppress_setup_hint`.
      Retired, all five (count 42 → 37). Re-verified: `project.pr_template`
      had no reader (`/create-pr` reads the GitHub path itself); the two
      readers of `subagents.downshift` (`routing_doctor`, `delegation_nudge_hook`,
      both `!== false`) now fix it on; `consistency.cross_source` and
      `pipelines.skill_improvement` had rule and skill prose readers only,
      rewritten to the always-on default. `ai_team.suppress_setup_hint`
      had two readers: the installer hint (now unconditional) and the
      `ai_team` loader, which rejects unknown keys fail-closed — so the key
      moved to its accepted-and-ignored set rather than out of it, or every
      wizard-made settings file would have broken `/team`.
      verify: `./scripts-run src/scripts/lint_settings_classes` -> 0

<!-- Release holds — emitted commented out, because the default is that there is
     not one. Uncomment ONLY if an intermediate tree state of this roadmap must
     not be published. Template rule 28 is the contract; the authoring order is
     re-sequence -> guard -> hold, and a hold is the last resort, never the
     first tool.

     Record the outcome either way. A roadmap that considered a hold and reached
     rung 1 or 2 instead writes the one-line `resequenced:` / `guarded:` note
     below and deletes the entry; that note is a counted outcome, not a comment.

     resequenced: <one line — the broken intermediate state, and the phase cut
     that removed it, so no window was ever needed.>

     ## Release holds

     ### hold: <kebab-id>
     - **Channel:** all             (all | latest; omitted parses to all)
     - **Opened by:** <phase.step>  (the checkbox whose [x] opens the window)
     - **Cleared by:** <phase.step> (the checkbox whose [x] closes it)
     - **State:** <one sentence naming what is broken in the tree while open.>
     - **Why not a guard:** <why the guard rung failed, concretely. Mandatory —
       an entry without it is malformed and reddens CI.>

     Both named steps carry an inline HTML-comment marker on the checkbox line
     itself — `opens-hold: <kebab-id>` on the opener, `clears-hold: <kebab-id>`
     on the clearer — so the binding is readable from the checkbox and not only
     from this section. The clearing step MUST carry a `verify:` field: a hold
     cleared by an unverified flip is a hold cleared by assertion.
-->

## Blockers

### blocker: settings-derivable-audit-scope
- **Status:** resolved
- **Owner:** owner
- **Blocks:** 1.1
- **What to do:** pick exactly one — (a) authorize draining the 83-key queue (likely several PRs, since each key names a distinct replacement mechanism), or (b) authorize a one-time re-audit-and-reaffirm pass now, recorded with the keys actually checked.
- **Resolved when:** the owner's answer is recorded under this blocker with date.
- **Recommendation:** (b) first — a reaffirm costs one audit pass and buys 56 more days without a CI-wide red; draining 83 keys is real engineering work better scoped into its own roadmap once the audit shows which ones are cheap.
- **If you do nothing:** every PR touching no settings file at all keeps tripping this gate until someone reads and reaffirms or drains it.
- **Answer (2026-10-09):** the owner chose **(b)**, the one-time re-audit-and-reaffirm
  pass, which is also what this entry recommended. Carried out and merged as
  `6d603d93e` (#2268).

  The audit ran **before** the stamp and is the reason in the block, which is the
  order Risk 1 asks for: a drain was attempted first and yielded **0 of 83**. The
  cause is the same in every row — the named replacement mechanism was built and
  the old key was never retired from its original consumer, so the replacement is
  additive rather than substitutive. Worth recording because it nearly went the
  other way: a grep for the dotted literal suggested about 25 drainable keys, and
  every one of those 25 had a real reader once checked against its owning module.
  TypeScript consumers read nested settings by object access and rule or command
  consumers name the key only in prose, so a zero from that grep is a property of
  the grep.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | product-owned | owner | Retire 47 of the 51 keys the 2026-10-09 audit found default-neutral. Kept: `hooks.code_graph.enabled`, because `docs/MIGRATION.md` publicly promises the key stays registered, and `planning.closure_pass`, `planning.risk_review`, `planning.completion_review`, because they are the only off-switches for those gates. | Owner answer 2026-10-09 (option 2 of a numbered choice that also offered all 51, 37 without the reasoning switches, or none). Audit: `agents/evidence/analysis/settings-derivable-retirement-audit-2026-10-09.md`. | the MIGRATION promise is withdrawn, or a planning gate gains a different off-switch |
| D2 | reversible-technical | agent | Phase 2 retired 46 of the 47, not 47: the derivable count stands at 37, so AC-2 (36) stays open. `roadmap.quality_cadence` moved back to the queue (step 2.3, two defaults: template and schema `per_phase`, reader fallback `end_of_roadmap`). Separately, the kernel rule `direct-answers` § Narration carve-out still names the retired `personal.play_by_play` and `verbosity.intent_announcements`; behaviour is unchanged, but the sentence is stale and a kernel edit ships in its own PR with the 24-hour soak (`scope-control` § Kernel-rule edits), so it was not made in the Phase 2 PR. | `lint_settings_classes` after step 2.7: `112 settings key(s) classified — A=9 B=3 C=100`, derivable 37. Step 2.3 prose for the cadence evidence. | the owner decides `quality_cadence`'s default (then it can be retired), or the kernel edit lands |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-09 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A reaffirm is written without re-reading the 83 entries | implementation | Re-stamping the date without checking is the exact laundering the 56-day clause exists to catch | Step 1.1's `verify:` is the gate itself passing, and the `reaffirmed.reason` must name what was actually checked | Phase 1 — Decide how to spend this debt |
| 2 | A retired key silently changes behaviour for a consumer who had set it | product | "Default-neutral" covers the shipped default only; a consumer who set a non-default value loses that setting | Each Phase 2 step re-verifies its keys against the audit table and moves back any key a reader turns out to depend on; the release notes name the retired keys | Phase 2 — Retire the 47 keys whose absence changes no default |

## Acceptance Criteria

- [x] AC-1 — the settings-classes lint passes on `main` without the
      `derivable-surface` finding appearing again before this roadmap's own
      disposition (drain or honest reaffirm) is recorded.
      Measured after `6d603d93e` merged: `lint_settings_classes` reports
      `158 settings key(s) classified — A=26 B=3 C=129`, exit 0. The disposition
      was recorded first, in the `reaffirmed.reason` the same commit added.
      verify: `./scripts-run src/scripts/lint_settings_classes` -> 0
- [ ] AC-2 — the `lint_settings_classes:derivable-surface` count stands at 36
      (83 − 47), every retired key is absent from the template, the contract
      and every reader, and the settings-classes lint passes.
      verify: `./scripts-run src/scripts/lint_settings_classes` -> 0
