# Consolidated decision sheet — 20 decisions owned by you

> Generated 2026-08-20 by `agent-config gates --sheet` over `agents/roadmaps/`.
> Sorted by unblock count, descending. **Accept-all-defaults is a valid answer**
> (`road-to-estate-drawdown` blocker `b-consolidated-decision-sheet`, option (a));
> answering only the two largest-unblock items and deferring the rest is option (c),
> which the roadmap itself recommends. Whichever you pick, the agent writes the answers
> back into each roadmap at its own blocker — that is not your work.
>
> **Provenance of the 20 defaults: 14 maintainer-recorded ·
> 5 `agent-drafted` · 0 with no recommendation at all ·
> 1 legacy `> Blocked until …` note(s) that have no field to carry one.**
> The distinction is in every row on purpose: an agent-drafted default is the
> least-examined thing on this sheet, and accept-all-defaults would accept those too.
>
> This file is DERIVED — every line above and below comes from the roadmaps themselves,
> so regenerating is deterministic and an answer written into this file would be lost.
> Answers go back into each roadmap at its own blocker; the agent does that.
>
> **ANSWERED 2026-08-20 — option (a) — accept all rendered defaults.**
> Recorded in `agents/decisions/consolidated-decision-sheet-answer.md` (not derived);
> authority `agents/evidence/council/drain-blocker-dispositions-b.md`.
> The rows below are the ones still OPEN: an answered
> row stays here until the work its own entry names is done, so this is a work
> queue and not a count of unanswered questions.

| # | Decision | Roadmap | Unblocks | Default source |
|---:|---|---|---:|---|
| 1 | `skill-activation-window` | road-to-cost-parity-1-rule-payload-diet.md | 49 | `agent-drafted` |
| 2 | `autonomy-defaults-sheet` | road-to-user-out-of-the-loop.md | 31 | maintainer-recorded |
| 3 | `kernel-soak-window` | road-to-user-out-of-the-loop.md | 31 | maintainer-recorded |
| 4 | `dpo-signoff` | road-to-org-telemetry.md | 17 | maintainer-recorded |
| 5 | `sink-choice` | road-to-org-telemetry.md | 17 | maintainer-recorded |
| 6 | `compaction-census-session` | road-to-context-fidelity.md | 12 | maintainer-recorded |
| 7 | blocked-until note | road-to-gated-reach-followup.md | 12 | none — legacy note |
| 8 | `real-orchestration-usage` | road-to-orchestration-scope-decision.md | 6 | `agent-drafted` |
| 9 | `telemetry-sample-size` | road-to-subagent-value-realization-followup.md | 6 | maintainer-recorded |
| 10 | `human-gated-live-trigger-eval` | road-to-skill-description-measurement.md | 4 | `agent-drafted` |
| 11 | `b-guard-tool-partition` | road-to-per-turn-hook-economy.md | 3 | maintainer-recorded |
| 12 | `b-injection-scan-unwrap-security` | road-to-per-turn-hook-economy.md | 3 | maintainer-recorded |
| 13 | `b-payload-read-parse-dominates` | road-to-per-turn-hook-economy.md | 3 | maintainer-recorded |
| 14 | `b-per-turn-composite-bar` | road-to-per-turn-hook-economy.md | 3 | maintainer-recorded |
| 15 | `b-stdin-read-failure-policy` | road-to-per-turn-hook-economy.md | 3 | maintainer-recorded |
| 16 | `b-stop-async-split-prerequisites` | road-to-per-turn-hook-economy.md | 3 | maintainer-recorded |
| 17 | `maintainer-blind-ratings` | road-to-council-blind-review.md | 2 | `agent-drafted` |
| 18 | `manual-rubric-rater` | road-to-scale-history-bench-run.md | 2 | `agent-drafted` |
| 19 | `b-delegate-gate-maintainer-profile` | road-to-gate-autonomy.md | 1 | maintainer-recorded |
| 20 | `b-gate-budget-preauth` | road-to-gate-autonomy.md | 1 | maintainer-recorded |

## 1 · `skill-activation-window`

- **Roadmap:** road-to-cost-parity-1-rule-payload-diet.md
- **Unblocks:** 49 open step(s) — Phase 1.3's skill-usage evidence column; Phase 2's trigger-accuracy bars
- **Question** (derived from the first `What to do:` step)**:** `road-to-skill-description-measurement.md` is blocked on `human-gated-live-trigger-eval` with the same gap under a different name — its pre-registration (≥ 100 requests, ≥ 3 shapes, no skill degrading > 20 %) is the bar Phase 2 needs.
- **Default:** **(agent-drafted 2026-08-18 — this entry predates the field; drafted from the roadmap's own text for the consolidated decision sheet, not from a maintainer decision.)** Do NOT commission a second eval.
- **Default source:** `agent-drafted` — written into the roadmap’s `Recommendation:` field and marked there, NOT a maintainer decision
- **Recommendation (full):** **(agent-drafted 2026-08-18 — this entry predates the field; drafted from the roadmap's own text for the consolidated decision sheet, not from a maintainer decision.)** Do NOT commission a second eval. This entry is a pointer, and its own text says the sibling's pre-registration IS the bar Phase 2 needs — so adopt that pre-registration as this roadmap's window and resume when the sibling's predictions JSON exists. One human sitting then discharges two blockers instead of one, and a parallel window would produce a second number nobody can reconcile with the first.
- **If you do nothing:** 49 steps stay open behind an instrument whose depth on this store is unverified, and Phase 1.3's evidence column stays a column with no evidence in it. The independently recorded facts — 6 of 288 skills ever invoked, 0 declaring a trigger, a host that truncates the catalogue — stay true and stay unmeasurable from transcripts.
- **Done when:** the pilot tranche PR cites its activation baseline and the window it was measured over.
- **Your answer:** _(accept default · override · defer)_

## 2 · `autonomy-defaults-sheet`

- **Roadmap:** road-to-user-out-of-the-loop.md
- **Unblocks:** 31 open step(s) — Phase 1 (preselection), Phase 2 (lane cap), Phase 4 (late-artifact default), Phase 5 (policy breadth)
- **Question** (recorded `Question:`)**:** Four preference settings that determine how aggressive the first iteration is; each has a conservative and a consequent option.
- **Default:** Preselect `autonomous` at the contract screen, cap lanes at two, default late artifacts to `auto-research`, and keep the deferred policy limited to the follow-up-draft option.
- **Default source:** maintainer-recorded `Recommendation:` in the roadmap
- **Recommendation (full):** Preselect `autonomous` at the contract screen, cap lanes at two, default late artifacts to `auto-research`, and keep the deferred policy limited to the follow-up-draft option. Rationale: each is reversible, each carries its own kill criterion in the phase text, and the conservative variant of all four together produces a plan that measures nothing because nothing changes.
- **If you do nothing:** the phases can still be built with the conservative variant of each; the measurement in Phase 0 then compares a smaller delta and takes proportionally longer to reach significance.
- **Done when:** the four values are named, and they are recorded in the decision sheet the Phase 1 contract screen renders.
- **Your answer:** _(accept default · override · defer)_

## 3 · `kernel-soak-window`

- **Roadmap:** road-to-user-out-of-the-loop.md
- **Unblocks:** 31 open step(s) — Phase 1 (batch elicitation carve-out — the only true kernel delta), Phase 2 (set-scoped autonomy form), Phase 4 (late-artifact policy), Phase 5 (deferred-policy delta)
- **Question** (recorded `Question:`)**:** Is the ONE kernel delta (`ask-when-uncertain`) authorized to proceed as its own PR with the required soak window — and do you want the other three deltas, which are NOT kernel, done as ordinary rule edits or held with it?
- **Default:** Authorize `ask-when-uncertain` on its own with the soak, and let the other three proceed as ordinary rule edits in the order 5-2, 4-4, 2-3 — the deferred-policy delta first because it is the smallest.
- **Default source:** maintainer-recorded `Recommendation:` in the roadmap
- **Recommendation (full):** Authorize `ask-when-uncertain` on its own with the soak, and let the other three proceed as ordinary rule edits in the order 5-2, 4-4, 2-3 — the deferred-policy delta first because it is the smallest. Holding three non-kernel edits behind a soak window they do not need is the cost this blocker was accidentally imposing.
- **If you do nothing:** Phases 1, 2, 4, and 5 each stop at their rule-delta step. Everything else in the plan still runs — the measurement foundation, the mode-derivation ladder, the decision sheet, the set command, stacking, the merge train, the memo channel, and the session work touch no kernel rule. The plan degrades to roughly two thirds of its scope rather than stalling.
- **Done when:** the user authorizes or declines the `ask-when-uncertain` delta, and says whether the three non-kernel deltas proceed independently.
- **Your answer:** _(accept default · override · defer)_

## 4 · `dpo-signoff`

- **Roadmap:** road-to-org-telemetry.md
- **Unblocks:** 17 open step(s) — Phase 3 (org-wide enablement onward)
- **Question** (recorded `Question:`)**:** Does the company data-protection process approve the Class-A field list and the disclosure text?
- **Default:** run it as a written review of exactly two artefacts — the Class-A field list from Phase 1 and the one-line disclosure from Phase 3 — rather than of the roadmap.
- **Default source:** maintainer-recorded `Recommendation:` in the roadmap
- **Recommendation (full):** run it as a written review of exactly two artefacts — the Class-A field list from Phase 1 and the one-line disclosure from Phase 3 — rather than of the roadmap. The design was built to make this review short: no content fields exist to argue about, and the pseudonymous hash is salted outside the public repository.
- **If you do nothing:** every phase through 2 still runs, and a single-machine enablement remains legitimate for testing. Only enablement across colleagues waits. The measurement in Phase 4 needs at least three distinct users, so the null it publishes without this sign-off would be an artifact of the missing approval rather than a finding about adoption — which is worth knowing before reading that number.
- **Done when:** a written internal sign-off exists and is referenced from the ADR.
- **Your answer:** _(accept default · override · defer)_

## 5 · `sink-choice`

- **Roadmap:** road-to-org-telemetry.md
- **Unblocks:** 17 open step(s) — Phase 2 (sink stand-up)
- **Question** (recorded `Question:`)**:** Should the sink be a minimal ingest endpoint, or a private repository used as an append-only store?
- **Default:** the private repository.
- **Default source:** maintainer-recorded `Recommendation:` in the roadmap
- **Recommendation (full):** the private repository. The volume is small, the write path is an existing authenticated primitive rather than new infrastructure to operate, and the Phase 6 clustering runs offline over the file set. An ingest endpoint is the better answer only if the volume outgrows a repository, which the current zero makes unlikely in the measurement window this roadmap needs.
- **If you do nothing:** Phases 0 and 1 still run in full — the spikes and the local emission need no sink. The plan stalls at the first outbound flush, which is also the first point at which any data would leave a machine, so the cost of the delay is bounded and the privacy posture is unaffected.
- **Done when:** the sink and its location are named, and the identifier exists in the org pack rather than in this repository.
- **Your answer:** _(accept default · override · defer)_

## 6 · `compaction-census-session`

- **Roadmap:** road-to-context-fidelity.md
- **Unblocks:** 12 open step(s) — Phase 0 (cf01 compaction-survival census), and transitively all of Phase 1, whose build-or-close decision reads cf01's number
- **Question** (recorded `Question:`)**:** cf01 needs an instrumented live session with a manual compaction, repeated across five sessions — and cf03 has since shown that no manual compaction has ever been recorded here.
- **Default:** Establish manual detectability first, then decide.
- **Default source:** maintainer-recorded `Recommendation:` in the roadmap
- **Recommendation (full):** Establish manual detectability first, then decide. **Corrected on R2 finding 6** — the earlier recommendation here said "re-specify cf01 against the automatic path" because "a manual-compaction census measures a path production never takes", and that overstated what cf03 can support. cf03 recorded 29 events across 473 sessions, all 29 tagged `auto` and none manual — but the detector is pinned to one OBSERVED auto event (`src/scripts/_lib/session_eol.ts:11-19`) and nothing establishes that a manual compaction writes a `compact_boundary` record at all. Zero manual is absence of a RECORD. So the cheap first move is a single manual compaction in one instrumented session to see whether it leaves a trace: if it does, cf01 runs as written; if it does not, cf01's null would be uninterpretable and the automatic path is the only measurable one. The automatic path needs no special session — probes placed in a session that is going to cross 1M tokens, which about half the recorded sessions do (239 of 473 end above 400k).
- **If you do nothing:** Phase 1 stays unstarted, which is the correct state rather than a stall — it is exactly what a pre-registered honest-null threshold is for. Phase 2 is unaffected: its own gate now reads cf02, which is done. Phase 3 is withdrawn on its own grounds and does not wait on this. The plan degrades to its memory half, and the memory half is the one with a measured defect behind it.
- **Done when:** a `context-fidelity-cf01.md` finding exists under `agents/evidence/eval-findings/` carrying a per-probe-class number and a host stamp, or the user records that the compaction-survival question is closed unmeasured and Phase 1 is cancelled. (The filename is deliberately not written as a full path here: `check_references` resolves a path in prose and the file does not exist yet, so a link would be a broken reference by construction. The step's own `verify:` probe holds the full path, which is where it belongs.)
- **Your answer:** _(accept default · override · defer)_

## 7 · blocked-until note

- **Roadmap:** road-to-gated-reach-followup.md
- **Unblocks:** 12 open step(s) — entire roadmap
- **Question** (derived from the first `What to do:` step)**:** `yt-dlp` and a JavaScript runtime are installed **by a human** on the machine that runs this.
- **Default:** _this is a legacy `> Blocked until …` note, not a `### blocker:` entry, so it has no `Recommendation:` field to read. Converting it into a real blocker entry is what gives it a default._
- **Default source:** none — legacy note
- **Done when:** condition described above clears
- **Your answer:** _(accept default · override · defer)_

## 8 · `real-orchestration-usage`

- **Roadmap:** road-to-orchestration-scope-decision.md
- **Unblocks:** 6 open step(s) — Phase 2 (and thereby Phase 3's decision)
- **Question** (derived from the first `What to do:` step)**:** the build work is done; only real delegable work produces the telemetry.
- **Default:** **(agent-drafted 2026-08-18 — this entry predates the field; drafted from the roadmap's own text for the consolidated decision sheet, not from a maintainer decision.)** Run the payload probe FIRST and treat its answer as the decision, rather than accumulating more usage.
- **Default source:** `agent-drafted` — written into the roadmap’s `Recommendation:` field and marked there, NOT a maintainer decision
- **Recommendation (full):** **(agent-drafted 2026-08-18 — this entry predates the field; drafted from the roadmap's own text for the consolidated decision sheet, not from a maintainer decision.)** Run the payload probe FIRST and treat its answer as the decision, rather than accumulating more usage. The entry's own re-measurement is decisive on this: at 367 orchestration lines the quality columns are `null` 367/367 and `spawn_count ≥ 2` is 0 of 367, so more of the same telemetry cannot populate the columns PROVE needs. If no hook slot sees the task-completion payload, Phase 3's verdict is an **honest null** and this roadmap terminates on that finding instead of waiting; only if a slot does see it is the ≥ 20-populated-line window worth opening.
- **If you do nothing:** 6 steps wait on a window that the entry's own numbers suggest may never fill, and the roadmap keeps reading as resumable to every feasibility screen — the exact misreading the 2026-08-17 rewrite of the Resolved-when was written to stop. A blocker whose condition cannot be reached is a park or a null, not a wait.
- **Done when:** a probe result records whether any hook slot sees the task-completion payload, and — if one does — the current-month audit log carries ≥ 20 orchestration lines whose **quality** columns are populated rather than `null`. **Rewritten 2026-08-17.** The bare line-count condition this field carried until today (*"the current-month audit log holds ≥20 orchestration lines"*) was satisfied at 99 lines when it was written and stands at **367** now, while the blocker never stopped being open — a resolution test that is already met cannot resolve anything, and every feasibility screen that trusted it read this roadmap as resumable. The sibling `road-to-subagent-value-realization-followup` had the identical defect repaired on 2026-08-16; this one was missed in the same pass.
- **Your answer:** _(accept default · override · defer)_

## 9 · `telemetry-sample-size`

- **Roadmap:** road-to-subagent-value-realization-followup.md
- **Unblocks:** 6 open step(s) — Phase 1 — Seed real telemetry
- **Question** (derived from the first `What to do:` step)**:** 1.
- **Default:** stop treating this as a usage-volume blocker and run the live-host semantics probe instead — does **any** hook slot receive the task-completion notification payload, and does that payload carry the usage fields a background dispatch withholds at `post_tool_use`?
- **Default source:** maintainer-recorded `Recommendation:` in the roadmap
- **Recommendation (full):** stop treating this as a usage-volume blocker and run the live-host semantics probe instead — does **any** hook slot receive the task-completion notification payload, and does that payload carry the usage fields a background dispatch withholds at `post_tool_use`? Same shape as `background-continuation-probe`, not a code fix. It is the recommended option because it is the only one that can move the exit criterion: the line count is already met at 99, and the missing columns are documented behaviour of the slot, so more usage produces more of the same nulls.
- **If you do nothing:** the log keeps growing and Phase 1 stays open forever — `≥ 20 **usable** dispatches` is unreachable at this slot regardless of volume, so the roadmap's last acceptance criterion (re-evaluating the ADR-117 `auto: on` default on real telemetry) never gets the evidence it names, and the default stands unexamined by default rather than by decision.
- **Done when:** a probe result records whether any hook slot sees the task-completion payload, and — if one does — `agents/runtime/state/audit/YYYY-MM.jsonl` carries ≥ 20 orchestration lines whose quality columns are populated rather than `null`. The bare line-count condition this field carried until 2026-08-16 was already satisfied at 99 lines while the blocker stayed open, which made it unusable as a resolution test.
- **Your answer:** _(accept default · override · defer)_

## 10 · `human-gated-live-trigger-eval`

- **Roadmap:** road-to-skill-description-measurement.md
- **Unblocks:** 4 open step(s) — all of Phase 1 — 1.1 and 1.2 both need a live model run
- **Question** (derived from the first `What to do:` step)**:** run the live trigger-eval to produce the predictions JSON for both tree states — `./scripts-run src/scripts/rule_trigger_eval` on the maintainer machine, once per tree state, same protocol both times.
- **Default:** **(agent-drafted 2026-08-18 — this entry predates the field; drafted from the roadmap's own text for the consolidated decision sheet, not from a maintainer decision.)** Run both tree states in ONE sitting under the same protocol, or park the roadmap in `later/` with exactly that as its resume condition.
- **Default source:** `agent-drafted` — written into the roadmap’s `Recommendation:` field and marked there, NOT a maintainer decision
- **Recommendation (full):** **(agent-drafted 2026-08-18 — this entry predates the field; drafted from the roadmap's own text for the consolidated decision sheet, not from a maintainer decision.)** Run both tree states in ONE sitting under the same protocol, or park the roadmap in `later/` with exactly that as its resume condition. Two sittings is the failure mode to avoid: the entry's Resolved-when requires both JSONs to come from the *same* protocol, and a protocol that drifted between runs produces two files that look comparable and are not. This blocker also gates `road-to-cost-parity-1-rule-payload-diet`'s `skill-activation-window`, so one sitting discharges two entries — which is why it outranks its own step count.
- **If you do nothing:** all of Phase 1 stays open, and the description rewrite ships with no before/after activation reading — the claim it exists to test stays unmeasured while reading as ordinary open work.
- **Done when:** a predictions JSON exists for the pre-rewrite and the post-rewrite tree state, produced by the same protocol.
- **Your answer:** _(accept default · override · defer)_

## 11 · `b-guard-tool-partition`

- **Roadmap:** road-to-per-turn-hook-economy.md
- **Unblocks:** 3 open step(s) — nothing in this roadmap — step 5.1 is cancelled and Phases 1-4 proceed without it. It records the one reachable form of 5.1's goal so a later attempt starts from the decision rather than re-deriving it.
- **Question** (derived from the first `What to do:` step)**:** decide whether the three blocking `pre_tool_use` guards (`block-no-verify`, `block-kernel-rule-writes`, `block-config-weakening`) may carry a **claude-only** host tool filter.
- **Default:** **option (c) — decline, and revisit only if Phase 4's registered composite exceeds its bar.** The gain is real but unmeasured, and the cost is a silently-skippable filter in front of the two guards that exist because a bypass must be impossible: `matcher` is a plain non-match, so unlike `if` it does not fail open, and a Claude tool-name addition (a renamed Bash variant, a new edit tool) would disable a guard with nothing in the tree noticing.
- **Default source:** maintainer-recorded `Recommendation:` in the roadmap
- **Recommendation (full):** **option (c) — decline, and revisit only if Phase 4's registered composite exceeds its bar.** The gain is real but unmeasured, and the cost is a silently-skippable filter in front of the two guards that exist because a bypass must be impossible: `matcher` is a plain non-match, so unlike `if` it does not fail open, and a Claude tool-name addition (a renamed Bash variant, a new edit tool) would disable a guard with nothing in the tree noticing. Option (a) is the version worth having *after* the composite says the dispatch count is the binding cost; option (b) is strictly waste.
- **If you do nothing:** the dispatcher keeps firing on every tool call regardless of whether any concern can act, the in-process `tools:` filter keeps absorbing the per-concern half on all eight platforms, and Phase 4's composite row is what tells anyone whether the remaining per-turn cost is worth a security-surface decision at all.
- **Done when:** one option is recorded at this blocker, and — for (a) — the partition ships with a per-class absent-invocation proof and a test that fails when a claude tool name is added to no class.
- **Your answer:** _(accept default · override · defer)_

## 12 · `b-injection-scan-unwrap-security`

- **Roadmap:** road-to-per-turn-hook-economy.md
- **Unblocks:** 3 open step(s) — nothing in this roadmap. It is the half of `b-payload-mis-nested-readers` that option (b) deliberately did not ship, kept as a blocker rather than a prose note so it stays visible to the estate's own blocker count.
- **Question** (derived from the first `What to do:` step)**:** decide whether to fix `injection_scan_hook.ts`'s unwrap.
- **Default:** **(a), as its own PR.** The fixtures are the deliverable, not the one-line change — without them the fix is a coverage change nobody can review, which is exactly the reason the council split it out of the `ship-diff-volume` PR rather than shipping the pair.
- **Default source:** maintainer-recorded `Recommendation:` in the roadmap
- **Recommendation (full):** **(a), as its own PR.** The fixtures are the deliverable, not the one-line change — without them the fix is a coverage change nobody can review, which is exactly the reason the council split it out of the `ship-diff-volume` PR rather than shipping the pair.
- **If you do nothing:** the scanner's production coverage stays a property of its fallback rather than of its contract, and the next envelope change can remove it with every test still green.
- **Done when:** one option is recorded at this blocker and — for (a) or (b) — `injection-scan` carries a test that fails against the pre-fix unwrap, with the valid / missing / malformed payload shapes named.
- **Your answer:** _(accept default · override · defer)_

## 13 · `b-payload-read-parse-dominates`

- **Roadmap:** road-to-per-turn-hook-economy.md
- **Unblocks:** 3 open step(s) — nothing — Phase 2 has landed and published its null. This records the finding that null produced, so the next attempt at D-2 starts from the measurement rather than from the roadmap's original attribution.
- **Question** (derived from the first `What to do:` step)**:** decide whether to open a step against the dispatcher's OWN read + parse of the payload, which two independent measurements now name as the dominant term of the large-payload cell.
- **Default:** **(a) first, and it is cheap.** The read-and-exit measurement is one small script plus one bench cell and it settles whether option (b) is a conclusion or a shrug.
- **Default source:** maintainer-recorded `Recommendation:` in the roadmap
- **Recommendation (full):** **(a) first, and it is cheap.** The read-and-exit measurement is one small script plus one bench cell and it settles whether option (b) is a conclusion or a shrug. Without it "the host makes us pay this" is an assumption of exactly the kind Phase 1 and Phase 2 have each already falsified once in this file.
- **If you do nothing:** the large-payload cell stays roughly 60 % above the small one with no owner, and D-2's remaining cost keeps being attributed to per-concern churn in any future reading of § 0 — which is the specific error two phases of measurement have now refuted.
- **Done when:** one option is recorded at this blocker and — for (a) — the read-and-exit cell exists on the § 2 matrix, so the unavoidable transport share of the large-payload cell is a number rather than an assumption.
- **Your answer:** _(accept default · override · defer)_

## 14 · `b-per-turn-composite-bar`

- **Roadmap:** road-to-per-turn-hook-economy.md
- **Unblocks:** 3 open step(s) — Phase 4 step 4.2 only. Step 4.1 registers the composite as a measured row and 4.3 refreshes the census; both proceed without the bar.
- **Question** (derived from the first `What to do:` step)**:** pre-register the per-turn composite bar.
- **Default:** **option (b) — register the row observe-only for one release.** No prior exists for a per-turn composite in this tree, so any number named today would be invented, and an invented bar on a summed metric is the flappiest possible gate.
- **Default source:** maintainer-recorded `Recommendation:` in the roadmap
- **Recommendation (full):** **option (b) — register the row observe-only for one release.** No prior exists for a per-turn composite in this tree, so any number named today would be invented, and an invented bar on a summed metric is the flappiest possible gate. One release of observation produces the distribution the bar should come from. Option (a) is right afterwards, not now; option (c) leaves D-1 permanently unmeasurable, which is the defect itself.
- **If you do nothing:** the per-turn cost stays structurally invisible — every slot green, the number the user feels unrepresented — and Phases 1, 2, 3 and 5 land with no bar to prove they helped. The budget-ownership discipline this repo follows says the bar precedes the lever, so the phases would be shipping against no registered target at all.
- **Done when:** one option is recorded at this blocker and — for (a) or (b) — the row exists in `hook-latency-budget.json` with its bar or its observe-only marker.
- **Your answer:** _(accept default · override · defer)_

## 15 · `b-stdin-read-failure-policy`

- **Roadmap:** road-to-per-turn-hook-economy.md
- **Unblocks:** 3 open step(s) — nothing — F-1's trigger is fixed and the residual failure is now loud. This records the half that is a policy call rather than a bug fix.
- **Question** (derived from the first `What to do:` step)**:** decide what the dispatcher does when the stdin read **fails**, as distinct from stdin being empty.
- **Default:** **option (c).** The bypass F-1 records is only consequential where a guard can refuse, and `pre_tool_use` is the one block-capable slot on this host; denying there costs a retryable refusal on an I/O error the retry budget already survived ten seconds of, while denying on `stop` or `post_tool_use` would refuse nothing and could break a turn end.
- **Default source:** maintainer-recorded `Recommendation:` in the roadmap
- **Recommendation (full):** **option (c).** The bypass F-1 records is only consequential where a guard can refuse, and `pre_tool_use` is the one block-capable slot on this host; denying there costs a retryable refusal on an I/O error the retry budget already survived ten seconds of, while denying on `stop` or `post_tool_use` would refuse nothing and could break a turn end. Option (b) is the status quo and leaves a documented allow-on-failure on a security path; option (a) is right in spirit and pays for it on slots where it buys nothing.
- **If you do nothing:** the residual failure stays an allow. It is no longer silent — that was the actual defect and it is fixed — but a reader of `hook-architecture-v1`'s fail-closed contract would still expect a refusal that does not happen, and nothing in the tree records the gap except this blocker.
- **Done when:** one option is recorded at this blocker and, for (a) or (c), `_readStdin`'s failure path returns a deny for the named slots with a test that fails when it allows.
- **Your answer:** _(accept default · override · defer)_

## 16 · `b-stop-async-split-prerequisites`

- **Roadmap:** road-to-per-turn-hook-economy.md
- **Unblocks:** 3 open step(s) — step 5.3 only. Phases 1-4 are unaffected and Phase 2 has landed.
- **Question** (derived from the first `What to do:` step)**:** decide whether to open the prerequisite work that makes 5.3 buildable.
- **Default:** **(a), and P3 before anything else.** P3 is a live data-integrity defect that does not need the split to matter: `dispatch-issues.jsonl` already has no lock today, and any second concurrent dispatcher — two platforms installed into one workspace, which the manifest supports — can truncate it.
- **Default source:** maintainer-recorded `Recommendation:` in the roadmap
- **Recommendation (full):** **(a), and P3 before anything else.** P3 is a live data-integrity defect that does not need the split to matter: `dispatch-issues.jsonl` already has no lock today, and any second concurrent dispatcher — two platforms installed into one workspace, which the manifest supports — can truncate it. Fixing it is small, independently valuable, and turns the riskiest part of a future split into a non-issue. Option (b) is tempting and is the wrong first move: it pays P1's contract change for one concern while leaving the collisions in place. Option (c) is defensible only if Phase 4's composite says turn-end wall clock is not the binding cost.
- **If you do nothing:** turn-end wall clock keeps carrying eight concerns that cannot refuse anything, `dispatch-issues.jsonl` stays corruption-capable under any concurrent dispatch, and the classification above rots — it is pinned to `hook_manifest.yaml` as it stands today, and every added `stop` concern makes it less true.
- **Done when:** one option is recorded at this blocker and — for (a) or (b) — P3's three files are written under a lock with a tmp+rename and a test that fails against the current unlocked write, before any group split ships.
- **Your answer:** _(accept default · override · defer)_

## 17 · `maintainer-blind-ratings`

- **Roadmap:** road-to-council-blind-review.md
- **Unblocks:** 2 open step(s) — Ü2 and Ü3 adoption (Phase 2 pre-registered decision rules) and the Ü2/Ü3 half of Phase 3's merge-or-null. **Ü1 is NOT blocked** — it is decided, adopted and merged (`blind_chairman` default true, opt-out flag, mandatory post-verdict de-anon map, 26/26 test-pinned).
- **Question** (derived from the first `What to do:` step)**:** rate the prepared blind packet at `internal/bench/council-blind-review/blind-rating-packet.md`, blind to arms.
- **Default:** **(agent-drafted 2026-08-18 — this entry predates the field; drafted from the roadmap's own text for the consolidated decision sheet, not from a maintainer decision.)** Do R1 and R2 in one sitting against the prepared packet, and accept an **honest null** as a full outcome for either — the entry's own Resolved-when asks for adopt-or-honest-null and explicitly refuses a deferral, so "the preference was not majority" closes Ü2 exactly as cleanly as adoption does.
- **Default source:** `agent-drafted` — written into the roadmap’s `Recommendation:` field and marked there, NOT a maintainer decision
- **Recommendation (full):** **(agent-drafted 2026-08-18 — this entry predates the field; drafted from the roadmap's own text for the consolidated decision sheet, not from a maintainer decision.)** Do R1 and R2 in one sitting against the prepared packet, and accept an **honest null** as a full outcome for either — the entry's own Resolved-when asks for adopt-or-honest-null and explicitly refuses a deferral, so "the preference was not majority" closes Ü2 exactly as cleanly as adoption does. The sitting is bounded: the packet is already prepared, Ü1 is already adopted and out of scope, and the two readings have pre-registered decision rules rather than open-ended judgement.
- **If you do nothing:** Ü2 and Ü3 stay undecided and Phase 3's merge-or-null cannot be written at all, so the roadmap cannot terminate in either direction. Ü1's shipped behaviour is unaffected, which is what makes this the cheapest kind of blocker to leave open and the easiest to forget.
- **Done when:** both readings exist, and each of Ü2 / Ü3 carries an adopt-or-honest-null verdict rather than a deferral.
- **Your answer:** _(accept default · override · defer)_

## 18 · `manual-rubric-rater`

- **Roadmap:** road-to-scale-history-bench-run.md
- **Unblocks:** 2 open step(s) — Phase 1 step 1's scoring half, and thereby step 2's verdict
- **Question** (derived from the first `What to do:` step)**:** score each produced artifact against `internal/bench/scale-history/rubric.md`, blind to arm, **before** any `score.ts` output is viewed.
- **Default:** **(agent-drafted 2026-08-18 — this entry predates the field; drafted from the roadmap's own text for the consolidated decision sheet, not from a maintainer decision.)** Score the artifacts in ONE sitting and do it before any `score.ts` output is on screen — the anti-anchor ordering is binding per the rubric's own first line, so a sitting split across days is the likeliest way to void the result without noticing.
- **Default source:** `agent-drafted` — written into the roadmap’s `Recommendation:` field and marked there, NOT a maintainer decision
- **Recommendation (full):** **(agent-drafted 2026-08-18 — this entry predates the field; drafted from the roadmap's own text for the consolidated decision sheet, not from a maintainer decision.)** Score the artifacts in ONE sitting and do it before any `score.ts` output is on screen — the anti-anchor ordering is binding per the rubric's own first line, so a sitting split across days is the likeliest way to void the result without noticing. If that sitting is not going to happen in the near term, the honest move is to park this roadmap in `later/` with the rubric pass as its probe-able resume condition, rather than leaving it in the active tree reading as ordinary open work.
- **If you do nothing:** Phase 1 step 1's scoring half stays open and step 2 has no verdict, so the bench run produces only the SECONDARY `lint_persistence` count — a number the pre-registration explicitly does not accept as the defect count. The roadmap then reads as spend-blocked when it is in fact rater-blocked, which is the misreading its own Surfaced note records.
- **Done when:** a human rubric score exists per artifact, recorded before the secondary `lint_persistence` pass for that artifact. - **Surfaced 2026-08-14** by the continuation sweep. It was always true and was never written down, which is why this roadmap read as spend-blocked-only.
- **Your answer:** _(accept default · override · defer)_

## 19 · `b-delegate-gate-maintainer-profile`

- **Roadmap:** road-to-gate-autonomy.md
- **Unblocks:** 1 open step(s) — Phase 3 step 3.1 and therefore 3.2.
- **Question** (derived from the first `What to do:` step)**:** decide whether to enable the team surface and `allow_delegate` in the maintainer profile only.
- **Default:** **option (a) — enable both in the maintainer profile.** The blast-radius controls already exist and are unchanged by this: the per-day call cap, the code gate as the enforcement point, and the orchestration ledger as the audit trail.
- **Default source:** maintainer-recorded `Recommendation:` in the roadmap
- **Recommendation (full):** **option (a) — enable both in the maintainer profile.** The blast-radius controls already exist and are unchanged by this: the per-day call cap, the code gate as the enforcement point, and the orchestration ledger as the audit trail. Option (b) permits consultation but not delegated writes, which leaves "a particular agent run" a human task — the exact class Phase 3 exists to remove. Note what makes (a) low-risk here specifically: it moves one profile's setting, not a shipped default, so no consumer install changes.
- **If you do nothing:** class-1 entries whose `run:` is an agent run stay human-typed, so the acting half of the gate layer is missing precisely where the work is largest. `road-to-estate-drawdown`'s recurring pass (its Phase 4) has no delegate path to run on and cannot exist.
- **Done when:** one option is recorded at this blocker, and for (a) or (b) the profile carries the setting with the cap named.
- **Your answer:** _(accept default · override · defer)_

## 20 · `b-gate-budget-preauth`

- **Roadmap:** road-to-gate-autonomy.md
- **Unblocks:** 1 open step(s) — Phase 2 step 2.3, and therefore every class-1 execution. Steps 2.1 and 2.2 ship the class-0 path and the render path without it. Also blocks the over-budget half of 2.1's `verify:` clause and AC-2's class-1 half: both need a budget to compare against, and this entry is where that budget is decided.
- **Question** (derived from the first `What to do:` step)**:** decide the standing budget shape for class-1 gates.
- **Default:** **option (a) — per-run and per-week caps with the receipt ledger.** It is the only option that actually removes the couriering while keeping a real spend bound: a per-run cap alone bounds one mistake, not a week of them.
- **Default source:** maintainer-recorded `Recommendation:` in the roadmap
- **Recommendation (full):** **option (a) — per-run and per-week caps with the receipt ledger.** It is the only option that actually removes the couriering while keeping a real spend bound: a per-run cap alone bounds one mistake, not a week of them. Option (b) preserves today's friction for every billable gate, which leaves the defect in place while adding a ledger. Option (c) collapses class 1 into class 2 and makes the four-class taxonomy a three-class one — defensible, but it gives up the class where the mechanism has the most to offer.
- **If you do nothing:** every billable gate keeps needing a keystroke, the live trigger eval keeps blocking three roadmaps, and class 1 exists on paper with no mechanism behind it. Phase 2 still ships the class-0 path, so the estate gets the free half of the acting layer and none of the paid half.
- **Done when:** one option is recorded at this blocker and — for (a) or (b) — the settings keys and the ledger path exist.
- **Your answer:** _(accept default · override · defer)_
