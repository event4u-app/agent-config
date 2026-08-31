---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_growth_exempt: "open_blockers 30 → 31: this change adds one ## Blockers entry so the AC-1 release condition has an owner, a class and a Resolved when that gates --all can read, instead of a condition living in prose — the failure the previous drain run recorded three times in one run. It is one-for-one with a criterion that was already open: AI council 2026-08-30 (anthropic + openai, 2/2) ruled AC-1 not-met, which is a verdict about an existing criterion, not a new item of work. No offsetting disposal is claimed and none is available — the roadmap cannot archive while AC-1 is open, which is that same verdict's direct consequence. The narrative this key used to carry is preserved verbatim in estate_growth_exempt_history below; it was moved because check_estate_count reads a claim only from an ADDED `estate_growth_exempt:` key line, so amending a block scalar in place is invisible to it."
estate_growth_exempt_history: >
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

> **Source:** the two deferred items and one recorded-but-unrepaired defect from
> `road-to-agent-turnaround`, executed 2026-08-30. Steps 1.1 and 2.1 below are
> the destination of a MERGE disposition ruled by council 2/2 (anthropic +
> openai, 2026-08-30); the source items are marked `[-] MERGED (outcome
> transferred)` there, and the source roadmap archives in the same change.
> **Step 2.1 stays owner-reserved:** relocating the question is not answering
> it, which both council members stated independently.
> **Amended 2026-08-30 — read this together with the line above.** Step 2.1 is
> closed by [`ADR-251`](../../docs/decisions/ADR-251-authorization-window-shape-not-width.md)
> on a council 2/2 verdict, and the line above stays true of the half that
> mattered: raising `LEDGER_MAX_AGE_MS` was not taken and remains
> owner-reserved. What the council could settle, and did, is the half that
> lowers nothing — keeping the 30-minute value and changing expiry from
> termination to pause-and-renew. Step 1.1 went the other way: the same council
> ruled AC-1 `not-met`, so this roadmap does NOT close in this change, and its
> open condition has an owner at § Blockers rather than living in prose.
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

- [~] **1.1 Re-measure mean batch size after ten further sessions.**
      <!-- deferred-resolution: carried-to=road-to-obligation-delivery-verification -->
      **OUTCOME 2026-08-31: MERGED — the unresolved half, its blocker, its
      evidence threshold and its releasing condition are transferred WITHOUT
      WEAKENING to
      [`road-to-obligation-delivery-verification.md`](road-to-obligation-delivery-verification.md)
      step 1.2, by AI council (anthropic + openai, 2/2 convergent, round 2,
      2026-08-31).** The glyph stays `[~]` and not `[-]` on the mechanism, not
      on taste: `archive_completed_roadmaps.ts` parses `[~]` items only
      (`DEFERRED_STEP_RE`), so a `[-]` here would carry an annotation no
      carry-integrity check could read and the destination would never be
      verified. `[~]` here means TRANSFERRED, not unfinished business returning
      to this roadmap — one seat argued for `[-]` on exactly that semantic
      ground and is answered by this sentence. Archiving this roadmap does not
      satisfy, cancel, or weaken the requirement. Run
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
      **READING TAKEN 2026-08-30 — and the number did not move.** (Whether that
      closes the step is settled at the end of this entry: it does not.)
      `mean_batch_size` 1.01 → 1.01 (unrounded
      1.008959 = 3266/3237). The finer signal moved the same way and no
      further: multi-block requests were 27 of 2,889 (0.93 %) and are now 26 of
      3,237 (0.80 %). Recorded as `subsequent_readings[0]` in
      `src/config/turnaround-budget.json` with its own corpus window, and as
      `# Re-reading — road-to-turnaround-followups step 1.1` (R1–R5) in
      `agents/evidence/analysis/agent-turnaround-2026-08-30.md`.
      **Recorded as a READING, not as a second gating baseline**, because the
      number did not move and there is nothing to re-baseline: the gating
      `baseline` and `empty_corpus` keys are untouched, so `readBudget` and
      `compare` behave identically. Promoting it to a second `baseline` key
      would be inert — `compare` reads only `baseline` — and would imply a
      ratchet change this step did not authorize.
      **The precondition was NOT met, and that is the load-bearing finding.**
      The obligation landed in `af0cf0bf0` at 2026-08-30 14:38:40Z. Of the ten
      sessions in the window, by first transcript timestamp **one** began after
      it, two span it, and seven ended entirely before — exactly risk 2 of this
      roadmap's own register. Stronger: `grep -rl` for the obligation's heading
      over `~/.claude` hits **no installed tree**, only transcripts, so the
      number of sessions that could have RECEIVED the reminder is at most one
      and plausibly zero. **The null is real, and it is a null about an
      undelivered reminder** — which makes the pre-commitment bind harder, not
      less: raising the reminder's frequency would be tuning a channel that is
      not connected.
      **Two gate readings deliberately NOT acted on**, recorded so a later
      reader does not mistake restraint for oversight: `blocking_share` moved
      +0.0439 (0.6202 → 0.6641) and the probe therefore exits 1 — not this
      step's metric, one local mtime-window reading, and raising a baseline
      needs its own reason in its own change. `context_floor_max` fell 4,177
      (230,705 → 226,528), in the gated direction, and was **not** lowered: a
      ratchet is never tightened on a single local reading.
      **One correction to the step's own command line**, since a later reader
      will re-run it: the probe's real usage is
      `probe_turnaround [--store PATH] [--limit N] [--json] [--against-baseline]
      [--include-current]` (`src/scripts/probe_turnaround.ts:319`). Run verbatim
      from a worktree it measures zero sessions and exits 1 — fail-closed
      working correctly, since the worktree slug names no transcript directory.
      The reading was taken with `--store` pointed at the store the 1.01
      baseline measured, and both artefacts say so.
      **DEFERRED, not done — AI council 2026-08-30, anthropic + openai, 2/2
      convergent: `not-met`.** The reading was taken and is recorded; the step
      is not finished, because the corpus could not answer the question the step
      asks. Both seats held that *"post-change corpus"* must mean a corpus
      **exposed** to the change, not merely one that postdates it by date, and
      that recording this as a behavioural null creates what one seat called
      poisoned evidence — a later reader citing *"batching obligations measured
      at 1.01 → 1.01"* without knowing zero sessions were exposed. One seat also
      named the finer point: **the pre-commitment's trigger condition was never
      met.** It binds on *"if the number has not moved"* in a valid measurement;
      what happened here is *"there is no number"*. The pre-commitment therefore
      does **not** license closing on this reading — and equally does not
      license re-pulling the lever, which stays forbidden.
      **Released when** `mean_batch_size` is measured across ≥ 10 sessions
      initiated after the obligation's install timestamp, where the delivery
      mechanism in effect at measurement time is documented to propagate a
      config change to a running agent. Per the council, that documentation is
      **not** this step's work: the delivery finding is routed to
      [`stubs/road-to-obligation-delivery-verification.md`](stubs/road-to-obligation-delivery-verification.md),
      which owns it and does not block this roadmap.

## Phase 2 — Put the authorization question to the owner

- [x] **2.1 Surface the owner-reserved decision and record the answer.** The
      question, both options and the measured run lengths are already written —
      `archive/road-to-agent-turnaround.md` § blocker
      `authorization-shape-for-long-runs`. This step carries it to an answer and
      records it where the guard can cite it. **The agent proposes no value for
      `LEDGER_MAX_AGE_MS` and does not take the decision**; a recorded "leave it
      as is" closes the step exactly as a change would.
      verify: a commit or an ADR records the owner's decision, and
      `src/scripts/hooks/block_unauthorized_git.ts`'s docblock cites it.
      **DONE 2026-08-30 —
      [`ADR-251`](../../docs/decisions/ADR-251-authorization-window-shape-not-width.md),
      and the value did NOT move.** AI council 2026-08-30, anthropic
      (claude-sonnet-4-5) + openai (gpt-4o), **2/2 convergent on Option B** — a
      different authorization SHAPE, never a wider window — and both seats
      independently proposed the same shape without seeing each other's answer:
      at expiry the run **pauses, reports, and asks for re-authorization**
      instead of terminating. `LEDGER_MAX_AGE_MS` is unchanged at 30 minutes and
      raising it remains forbidden.
      **On the authority bound this step carries.** The step and its source
      blocker say the agent may not take the decision, and a prior council 2/2
      ruled it may only move the question, not settle it. What made this
      settleable is that the reserved-decision table routes *lowering* a
      security floor to the owner and *keeping or strengthening* one to the
      council — and Option B lowers nothing. Both seats reached that reading
      independently and both classified their verdict
      `within-council-authority`. **Raising the constant was and stays
      owner-reserved, and this record did not take it** — which is why the ADR
      carries `reopen_policy: owner` and `protected_dimensions: security_floor`.
      **The mechanism was verified, not assumed.** `git_authorization_hook.ts`
      is stateless per prompt — no first-authorization-only branch and no
      once-per-session latch — and every human-typed prompt rewrites the
      session ledger with a fresh `detected_at` (`:530`, `:537`), which is the
      value `block_unauthorized_git.ts:599` compares against. So a mid-run reply
      carrying the re-authorization already resets the age. Option B is a
      behaviour and contract change, **not new machinery**, and it introduces no
      agent-writable authorization store — the property ADR-239's reopen trigger
      watches for.
      **The bundle did not change, and the local gate could not prove it.**
      `check_hook_bundle_content` exits 0 with `scanned: 0` here: this worktree
      self-hosts no `dist/hooks/dispatch.js`, so the gate is structurally blind.
      The evidence is an out-of-tree build instead — the dispatcher built from
      this checkout before and after the docblock edit is byte-identical,
      sha256 `355fd72d…`, 1.2 MB both times, because esbuild strips non-legal
      comments. **No rebuild was needed and none was performed.**
      **The residual is named rather than closed:** the ledger binds neither PR
      number nor HEAD sha, so it verifies *"the user consented recently"*, not
      *"the user consented to THIS merge"*. ADR-251 records that as unresolved
      with its own reopen condition; it is not something this step fixed.

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
      **CORRECTED after the completion review of 2026-08-30.** The first
      simulation reproduced the delivery FILTER and the REWRITE and omitted the
      step between them — `_inject_package_tag` (`install.ts:2818`), which
      writes `package: event4u/agent-config` during the copy. That omission is
      why the review, not this step, found the high finding: the rewrite rebuilt
      each file from the activation plan alone and DELETED the tag, and
      `reap_tagged_orphans` matches on that literal line — its own docblock
      calls itself "the only path with ownership proof independent of inventory
      history". Every file under the anchor would have lost it, the marker-based
      reaper would have been dead for that subtree, and doctor's
      `_check_stale_orphans` would have read `ok` there permanently. The rewrite
      now carries `PRESERVED_KEYS` across, including onto rules with no `paths:`
      block, which is 101 of the 104. Re-run with the injector in the loop:
      `package tag: 104 -> 104` · `paths: 0 -> 3` · `rewritten 104 failed 0`.
      Four regression tests pin it — scoped, unscoped, every declared key, and
      idempotence with the tag present.
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
      **A third polarity was added after the completion review**, which found
      the first version of this subtraction UNCONDITIONAL and therefore a
      regression of its own: it hardcoded "this projection is a globally
      partitioned host layer", so against a full or project-layer projection —
      also the fail-safe default `partitionEligibility` returns on a fresh
      checkout, an absent install record, or a version or fingerprint mismatch —
      it printed that `source-of-truth` was "never delivered", when that layer
      is the one place it IS delivered and the only rule there declaring
      `paths:`. The partition is now DETECTED rather than assumed: if a
      package-only rule's file is present in the projection, this is not a
      global layer and nothing is subtracted. The third test pins that case.

## Blockers

### blocker (TRANSFERRED, no longer live here): batching-corpus-never-received-the-obligation

> **MOVED 2026-08-31 to
> [`road-to-obligation-delivery-verification.md`](road-to-obligation-delivery-verification.md)
> § Blockers, whole and unweakened**, by AI council (anthropic + openai, 2/2
> convergent, round 2). It is still OPEN — at the receiver, in the active
> estate, with the same Class, the same owner and the same `Resolved when`.
>
> **The `### blocker:` prefix is deliberately broken on this heading**, and this
> note is why. `lint_roadmap_blockers` keys on that literal prefix, so leaving it
> intact here would parse this stub as a second LIVE entry with the same id —
> one blocker with two live owners, which is exactly what the atomic-transfer
> requirement forbids, and `check_estate_count` would read `open_blockers +1`
> for a blocker that merely moved. A future reader "repairing" the prefix would
> re-create that defect. The five-field body below is retained verbatim as a
> historical record of what was transferred, and is not a live contract.

- **Status:** open AT THE RECEIVER — created 2026-08-30 by the drain run that executed step 1.1.
  **AI council 2026-08-30, anthropic + openai, 2/2 convergent: AC-1 is
  `not-met`.** The reading was taken and is recorded; what is missing is a
  corpus that was exposed to the obligation. This entry exists so the condition
  has an owner rather than living only in prose — the recurring failure the
  previous drain run named three times was *"a criterion with no phase, no step
  and no owner"*.
- **Owner:** council — the disposition keeps AC-1 alive and unweakened and
  routes the delivery half to a separate item, which the preservation test makes
  council-decidable. Nothing here lowers a floor or descopes a criterion.
- **Class:** 3
- **Blocks:** step 1.1 and AC-1 only. Phases 2 and 3 are untouched.
- **What to do:** nothing in this roadmap. The obligation reached at most one of
  the ten measured sessions and plausibly zero, so the measurement cannot be
  repeated usefully until delivery is either instrumented or documented. That
  work is
  [`stubs/road-to-obligation-delivery-verification.md`](stubs/road-to-obligation-delivery-verification.md).
  **Do not raise the reminder's frequency** — the parent pre-commitment forbids
  it and a disconnected channel is not fixed by sending more down it.
- **Recommendation:** leave it open and let the stub carry the delivery
  question. Closing AC-1 on the temporal reading would record *"we measured it
  and it did nothing"* where the truthful statement is *"we could not measure
  it"* — one seat called this poisoned evidence, and this repository's own
  failure catalogue holds that a false null is harder to remediate later than a
  deferred condition surfaced now.
- **If you do nothing:** AC-1 stays open, this roadmap stays active and does not
  archive, and the batching obligation's effect stays unmeasured. Nothing
  regresses and nothing is silently lost — the cost is that one roadmap remains
  in the active estate.
- **Resolved when:** `mean_batch_size` is measured across ≥ 10 sessions
  initiated after the obligation's install timestamp, where the delivery
  mechanism in effect at measurement time is documented to propagate a config
  change to a running agent — and step 1.1 is re-closed citing that reading.
  Per-session self-report is explicitly NOT the bar; a documented propagation
  model satisfies it.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-30 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Phase 3 silently narrows a rule that must stay unconditional | implementation | `paths:` is the host's ONLY activation key, so a rule that gains one and also needed a keyword trigger goes quiet on exactly the prompts it was written for — with no error anywhere | 3.1 is scoped to the 4 rules the emitter ALREADY classifies path-only; the 17 mixed rules are explicitly out. 3.2 re-measures the census divergence rather than trusting the change | Phase 3 — Emit `paths:` on the write path that does not |
| 2 | Phase 1 reads a corpus that never accumulated ten post-change sessions | implementation | The window is mtime-ordered, so running it early measures sessions that predate the obligation and reports them as an after | 1.1 names the ten-session precondition; the budget config records each reading's corpus shape, so an under-populated window is visible in the entry itself | Phase 1 — Read the batching obligation |
| 3 | Phase 2 is read as licence to widen the window | product | The nearest reading of "answer the pressure" is to relax the bound — the action taken twice and forbidden by the guard's own prose | 2.1 states that the agent proposes no value and that a recorded "leave it as is" closes the step; `check_hook_bundle_content` now refuses the edit at `task preflight` | Phase 2 — Put the authorization question to the owner |
| 4 | Phase 1 records a null and the lever is re-pulled harder | product | A model-carried obligation that did not move invites raising the reminder's frequency, which was measured not to work for a sibling obligation in this tree | 1.1 pre-commits to the null being the result, in the same words the originating roadmap used | Phase 1 — Read the batching obligation |

## Acceptance Criteria

- [-] **AC-1 — TRANSFERRED to
      [`road-to-obligation-delivery-verification.md`](road-to-obligation-delivery-verification.md),
      not met and not weakened.** AI council 2026-08-31, anthropic + openai,
      **2/2 convergent, round 2**. `[-]` here means TRANSFERRED — the criterion
      is open in the receiver, in the ACTIVE estate, with its blocker, its
      ten-session floor and its propagation-model requirement carried verbatim.
      It does not mean cancelled and it does not mean satisfied.
      **Why the receiver and not the stub the first round chose.** Both seats
      attached the same falsifiable precondition to their round-1 Option-1
      verdict — verify stub governance BEFORE transferring. The check was run
      and it failed: `archive_completed_roadmaps.ts` builds its carry-destination
      candidate list as exactly `agents/roadmaps/<slug>.md` and
      `agents/roadmaps/later/<slug>.md`, so a carry naming `stubs/` blocks;
      `lint_roadmap_blockers.ts:35` scans `agents/roadmaps/*.md` non-recursively,
      so the three stub files carrying `### blocker:` headings today appear in no
      gate; `update_roadmap_progress` reports three roadmaps and no stub; and
      `resume_probe` reads `later/` only. Both seats then changed their answer to
      promoting the stub into the active estate, and said so plainly.
      **Not `later/` either**: a parallel council round the same day ruled 2/2
      that `later/` is excluded from the dashboard and from
      `/roadmap:process-*`, so it does not preserve active-estate membership.
      **The receiver's active placement is a narrow, expiring exception** to the
      Later-disposition Iron Law, with a named blocker, a measurable releasing
      condition, `owner: council`, and a kill switch — `review_by: 2026-09-30`,
      after which it moves to `later/` without a further council round.
      Original criterion, kept verbatim for the record: `mean_batch_size` has a
      second reading against a named post-change
      corpus, and the delta is recorded whichever direction it went — including
      "did not move".
      **STAYS OPEN — AI council 2026-08-30, anthropic + openai, 2/2 convergent:
      `not-met`.** The second conjunct is unambiguously met: a reading exists
      and its delta is recorded as a null. The FIRST conjunct is not, and it is
      the load-bearing one — *"post-change corpus"* is read by both seats as a
      corpus **exposed** to the change, and at most one of the ten sessions
      could have received it. Closing on the temporal reading would record
      *"we measured it and it did nothing"* where the truthful statement is
      *"we could not measure it"*.
      **Releasing condition, from the verdict:** `mean_batch_size` measured
      across ≥ 10 sessions initiated after the obligation's install timestamp,
      where the delivery mechanism in effect at measurement time is documented
      to propagate a config change to a running agent. Per-session self-report
      was explicitly REJECTED as the bar — one seat noted it would require
      instrumentation this repository does not have and that AC-1 never asked
      for; a documented propagation model satisfies it instead.
      **The delivery half is NOT this criterion's work.** It is routed to
      [`stubs/road-to-obligation-delivery-verification.md`](stubs/road-to-obligation-delivery-verification.md),
      which both seats required as a separate item and which does not block this
      roadmap.
- [x] AC-2 — The 30-minute authorization window carries a recorded owner
      decision that `block_unauthorized_git.ts` cites, or an explicit recorded
      refusal to change it. Silence does not satisfy this.
      **Met 2026-08-30 by
      [`ADR-251`](../../docs/decisions/ADR-251-authorization-window-shape-not-width.md),
      with one substitution stated rather than hidden: the decision-maker is the
      COUNCIL, not the owner.** The criterion says "owner decision"; what it
      got is a council verdict (anthropic + openai, 2/2 convergent) on the half
      of the question that is council-decidable — keeping the 30-minute value
      and changing the behaviour at expiry, neither of which lowers a floor. The
      owner-reserved half, **raising the constant**, was not taken by anyone and
      stays open in exactly the state it was in; the ADR carries
      `reopen_policy: owner` and `protected_dimensions: security_floor` so a
      later reader cannot mistake the substitution for a grant of authority.
      The criterion's own alternative branch is what is actually satisfied — *"an
      explicit recorded refusal to change it"* — and the citation the guard now
      carries is at `src/scripts/hooks/block_unauthorized_git.ts:526-544`.
      Silence did not satisfy it, and does not.
- [x] AC-3 — A fresh install emits `paths:` for exactly the rules the emitter
      classifies path-only, and the activation census reports no divergence
      between its source verdict and the projection. **Met 2026-08-30 with one
      clarification the criterion needed and did not have: "exactly the rules
      the emitter classifies path-only" is FOUR in the source and THREE in any
      global delivery, because `source-of-truth` is package-only and withheld.
      The census now states that subtraction rather than reporting it as
      drift.**
