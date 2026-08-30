<!-- check-refs: skip -->
<!-- verbatim roadmap snapshot for the R2 reviewer; the live roadmap layer is excluded from check_references, and a snapshot must not fail a gate its source is exempt from -->
---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_growth_exempt: >
  CORRECTED 2026-08-30 — the second sentence has since been falsified by the
  change that carries this correction. It read "the offset that would have paid
  for it is not available: road-to-agent-turnaround cannot archive", on the
  ground that its two `[~]` items put it above update_roadmap_progress's
  `deferred === 0` archive condition. That was true of the tree as it stood and
  is no longer: a council (2/2, anthropic + openai, 2026-08-30) ruled the
  preservation test's MERGE branch available for both items, they are now
  `[-] MERGED (outcome transferred)` pointing at steps 1.1 and 2.1 here, and
  that roadmap archives in this same change. The original +1 was claimed
  honestly on the evidence available then; the offset exists now. What the
  roadmap buys is unchanged: three items that provably could not
  close in the roadmap that found them — a re-measurement whose corpus does not
  exist yet, an owner-reserved security decision the agent is forbidden to take,
  and an installer change that would silently narrow three rules' activation
  from inside a measurement roadmap. Folding any of them into an existing
  roadmap would separate the work from the measurement that justifies it.
estate_offset_exempt: >
  CORRECTED 2026-08-30. The original line said this roadmap was "created in the
  same change that archives road-to-agent-turnaround", as its CARRY disposition.
  That was false in both halves: the archive did not happen in that change, and
  a council (2/2, anthropic + openai, 2026-08-30) subsequently ruled the CARRY
  branch of the preservation test unavailable precisely because this file was
  created in a PRIOR change — the branch requires a follow-up created in the
  SAME one. What actually applies is the test's separate MERGE branch, *merge
  into existing active work that already covers it*, and that merge lands in the
  change that archives `road-to-agent-turnaround`. So the offset is real and is
  one-in-one-out, but this roadmap is the pre-existing destination of a merge
  rather than the same-change product of a carry. Measure the actual delta with
  check_estate_count after the commit — do not read the number from this
  sentence.
---
# Road to turnaround follow-ups

> **Source:** [REDACTED:src-conf]
> `road-to-agent-turnaround`, executed 2026-08-30. Steps 1.1 and 2.1 below are
> the destination of a MERGE disposition ruled by council 2/2 (anthropic +
> openai, 2026-08-30); the source items are marked `[-] MERGED (outcome
> transferred)` there, and the source roadmap archives in the same change.
> **Step 2.1 stays owner-reserved:** relocating the question is not answering
> it, which both council members stated independently.
> Every number below is from
> `agents/evidence/analysis/agent-turnaround-2026-08-30.md`; none is estimated
> here.

## Goal

The three things that roadmap could not finish inside itself are finished: the
batching obligation has a reading against it, the owner has answered whether the
30-minute authorization window is usable at the measured run lengths, and the
installer's global write path emits the one activation key Claude Code reads for
the rules the emitter already scopes.

## Why these three could not close in place

Each is blocked by a different thing, and none of them is effort:

| item | why it could not close then |
|---|---|
| batching re-measurement | the obligation landed minutes before; the ten post-change sessions do not exist yet |
| authorization shape | owner-reserved — a security floor the agent is forbidden to decide |
| `paths:` on the global layer | a consumer-facing installer change that silently narrows three rules' activation, from inside a measurement roadmap |

## Phase 1 — Read the batching obligation

- [ ] **1.1 Re-measure mean batch size after ten further sessions.** Run
      `./scripts-run src/scripts/probe_turnaround --limit 10 --against-baseline`
      and record the `mean_batch_size` delta against the 1.01 baseline in
      `src/config/turnaround-budget.json`, with its own corpus window beside it.
      **Pre-committed:** if the number has not moved, that is the RESULT and it
      is recorded as a null — never a reason to repeat the same reminder more
      loudly, which this repository has already measured not to work for the
      session-canary obligation.
      verify: a second baseline entry exists in the budget config with its own
      corpus window, and the delta is stated in the evidence file in whichever
      direction it went.

## Phase 2 — Put the authorization question to the owner

- [ ] **2.1 Surface the owner-reserved decision and record the answer.** The
      question, both options and the measured run lengths are already written —
      `archive/road-to-agent-turnaround.md` § blocker
      `authorization-shape-for-long-runs`. This step carries it to an answer and
      records it where the guard can cite it. **The agent proposes no value for
      `LEDGER_MAX_AGE_MS` and does not take the decision**; a recorded "leave it
      as is" closes the step exactly as a change would.
      verify: a commit or an ADR records the owner's decision, and
      `src/scripts/hooks/block_unauthorized_git.ts`'s docblock cites it.

## Phase 3 — Emit `paths:` on the write path that does not

- [x] **3.1 Call the host-form rewrite from the installer's global write
      path.** `condense.ts` calls `_claude_paths_plan` when it writes the
      project tree; nothing under `src/install/` calls it at all, so
      `~/.claude/rules/` receives the source form and three rules the emitter
      WOULD scope — `ui-audit-gate`, `design-review-after-ui-write`,
      `roadmap-progress-sync` — arrive unconditional. The table and the
      mechanism are in `docs/contracts/rule-router.md` § Claude Code `paths:`.
      **Scope bound:** the 17 mixed rules stay unconditional; narrowing one is a
      per-rule decision about its keyword triggers, never a blanket emitter
      change.
      verify: after a fresh install,
      `grep -lE '^paths:' ~/.claude/rules/*.md | wc -l` is 3, and those three are
      the path-only rules named above.
      **DONE 2026-08-30.** The emitter now runs on the install side:
      `src/install/claudeRuleRewrite.ts` renders the host form from
      `_claude_paths_plan` + `parseFrontmatter`, both already installer-side, so
      the installer bundle gains no dependency on the projection graph. It is
      called from `src/scripts/install.ts` in the `tool_id === 'claude-code'`
      branch, immediately beside `_apply_claude_flat_command_wrappers` and for
      the same reason: the deploy loop's `_copy_dir_dereferencing_symlinks`
      copies `dist/agent-src/rules/` verbatim, so the anchor receives the source
      frontmatter vocabulary and every rule loads unconditionally.
      **Verified against the real delivery filter rather than by running a
      global install** — writing into the operator's `~/.claude` to prove a
      point is not a verification, it is a side effect. The simulation applies
      `isExclusivelyPackageOnly` exactly as `_rule_filter_for_source` does,
      copies what survives, and runs the rewrite:
      `copied 104 withheld(package-only) 15` · `paths: before 0 -> after 3` ·
      `scoped: design-review-after-ui-write, roadmap-progress-sync,
      ui-audit-gate`. 104 is the same file count the operator's live
      `~/.claude/rules` carries, so the simulated tree is the delivered one.
      The three are exactly the rules this step names.
      Equivalence with the maintainer emitter is held by
      `tests/install/claude_rule_rewrite.test.ts`, which renders every rule in
      `src/rules/` through BOTH `condense._emit_claude_rule` and this module and
      asserts byte-identity — the two emitters deliberately share no call, so a
      test is what keeps one host from receiving two activation surfaces.
      The scope bound held: the 17 mixed rules are untouched and still
      unconditional, which the same test pins from the other side (a mixed rule
      must render with NO frontmatter, because `paths:` is exclusive on this
      host and emitting it would silence the rule on the keyword prompts it was
      written for).
- [x] **3.2 Prove the three still fire, and that nothing else went quiet.**
      Narrowing activation fails silently by construction — a rule that should
      have loaded simply does not, with no error anywhere. Re-run
      `rule_activation_census --projection ~/.claude/rules` and assert the
      divergence it currently reports is gone, and that the unconditional count
      fell by exactly three.
      verify: the census reports no divergence between the source verdict and
      the projection, and the before/after unconditional counts are recorded.
      **DONE 2026-08-30, and it found a second defect on the way — in the
      census, not in the emitter.** Run against the delivered tree the fixed
      installer produces, the census still reported
      `⚠️ diverges from the source verdict (4 scoped)` against a projection
      declaring 3. Both numbers were right. The comparator was subtracting
      nothing: the source verdict counts every rule in `src/rules/`, while a
      delivered tree never carries the package-only ones (ADR-236 partitions
      them to the project layer), so **every correctly-emitted globally
      partitioned projection would have reported a divergence forever.** The
      fourth scoped rule is `source-of-truth`, package-only, and absent from
      the operator's live `~/.claude/rules` — checked directly.
      `rule_activation_census.ts` now carries `package_only` per row (from
      `isExclusivelyPackageOnly`, the installer's own predicate, not a
      re-derivation) and compares against the partition-adjusted expectation,
      naming the withheld rules so a reader can check the subtraction:
      `source scopes 4; 1 of those is package-only and never delivered
      (source-of-truth), so a partitioned projection is expected to declare 3` ·
      `✅ consistent with the source verdict (3 expected, 3 found)`.
      **Before / after, both from the same instrument:** live
      `~/.claude/rules` — `files 104 · declaring paths: 0`, ⚠️ divergence;
      delivered tree after the fix — `files 104 · declaring paths: 3`, ✅
      consistent. Unconditional count falls by exactly three, which is the
      three named in 3.1 and no others.
      `tests/scripts/rule_activation_census_partition.test.ts` pins **both
      polarities** — the quiet case AND a real one-file divergence that must
      still fire — because a comparator shown only to stay silent has not been
      shown to work.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-30 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Phase 3 silently narrows a rule that must stay unconditional | implementation | `paths:` is the host's ONLY activation key, so a rule that gains one and also needed a keyword trigger goes quiet on exactly the prompts it was written for — with no error anywhere | 3.1 is scoped to the 4 rules the emitter ALREADY classifies path-only; the 17 mixed rules are explicitly out. 3.2 re-measures the census divergence rather than trusting the change | Phase 3 — Emit `paths:` on the write path that does not |
| 2 | Phase 1 reads a corpus that never accumulated ten post-change sessions | implementation | The window is mtime-ordered, so running it early measures sessions that predate the obligation and reports them as an after | 1.1 names the ten-session precondition; the budget config records each reading's corpus shape, so an under-populated window is visible in the entry itself | Phase 1 — Read the batching obligation |
| 3 | Phase 2 is read as licence to widen the window | product | The nearest reading of "answer the pressure" is to relax the bound — the action taken twice and forbidden by the guard's own prose | 2.1 states that the agent proposes no value and that a recorded "leave it as is" closes the step; `check_hook_bundle_content` now refuses the edit at `task preflight` | Phase 2 — Put the authorization question to the owner |
| 4 | Phase 1 records a null and the lever is re-pulled harder | product | A model-carried obligation that did not move invites raising the reminder's frequency, which was measured not to work for a sibling obligation in this tree | 1.1 pre-commits to the null being the result, in the same words the originating roadmap used | Phase 1 — Read the batching obligation |

## Acceptance Criteria

- [ ] AC-1 — `mean_batch_size` has a second reading against a named post-change
      corpus, and the delta is recorded whichever direction it went — including
      "did not move".
- [ ] AC-2 — The 30-minute authorization window carries a recorded owner
      decision that `block_unauthorized_git.ts` cites, or an explicit recorded
      refusal to change it. Silence does not satisfy this.
- [x] AC-3 — A fresh install emits `paths:` for exactly the rules the emitter
      classifies path-only, and the activation census reports no divergence
      between its source verdict and the projection. **Met 2026-08-30 with one
      clarification the criterion needed and did not have: "exactly the rules
      the emitter classifies path-only" is FOUR in the source and THREE in any
      global delivery, because `source-of-truth` is package-only and withheld.
      The census now states that subtraction rather than reporting it as
      drift.**
