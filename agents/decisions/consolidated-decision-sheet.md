# Consolidated decision sheet — 21 decisions owned by you

> Generated 2026-08-18 by `agent-config gates --sheet` over `agents/roadmaps/`.
> Sorted by unblock count, descending. **Accept-all-defaults is a valid answer**
> (`road-to-estate-drawdown` blocker `b-consolidated-decision-sheet`, option (a));
> answering only the two largest-unblock items and deferring the rest is option (c),
> which the roadmap itself recommends. Whichever you pick, the agent writes the answers
> back into each roadmap at its own blocker — that is not your work.
>
> **Provenance of the 21 defaults: 14 maintainer-recorded ·
> 6 `agent-drafted` · 0 with no recommendation at all ·
> 1 legacy `> Blocked until …` note(s) that have no field to carry one.**
> The distinction is in every row on purpose: an agent-drafted default is the
> least-examined thing on this sheet, and accept-all-defaults would accept those too.
>
> This file is DERIVED — every line above and below comes from the roadmaps themselves,
> so regenerating is deterministic and an answer written into this file would be lost.
> Answers go back into each roadmap at its own blocker; the agent does that.

| # | Decision | Roadmap | Unblocks | Default source |
|---:|---|---|---:|---|
| 1 | `skill-activation-window` | road-to-cost-parity-1-rule-payload-diet.md | 49 | `agent-drafted` |
| 2 | `autonomy-defaults-sheet` | road-to-user-out-of-the-loop.md | 31 | maintainer-recorded |
| 3 | `kernel-soak-window` | road-to-user-out-of-the-loop.md | 31 | maintainer-recorded |
| 4 | `dpo-signoff` | road-to-org-telemetry.md | 26 | maintainer-recorded |
| 5 | `sink-choice` | road-to-org-telemetry.md | 26 | maintainer-recorded |
| 6 | `compaction-census-session` | road-to-context-fidelity.md | 19 | maintainer-recorded |
| 7 | `b-per-turn-composite-bar` | road-to-per-turn-hook-economy.md | 16 | maintainer-recorded |
| 8 | `legacy` | road-to-gated-reach-followup.md | 12 | none — legacy note |
| 9 | `real-orchestration-usage` | road-to-orchestration-scope-decision.md | 6 | `agent-drafted` |
| 10 | `telemetry-sample-size` | road-to-subagent-value-realization-followup.md | 6 | maintainer-recorded |
| 11 | `human-gated-live-trigger-eval` | road-to-skill-description-measurement.md | 4 | `agent-drafted` |
| 12 | `b-live-trigger-eval` | road-to-catalogue-host-fit.md | 3 | maintainer-recorded |
| 13 | `b-consolidated-decision-sheet` | road-to-estate-drawdown.md | 3 | maintainer-recorded |
| 14 | `b-convergence-machine` | road-to-carrier-layer-convergence.md | 2 | `agent-drafted` |
| 15 | `maintainer-blind-ratings` | road-to-council-blind-review.md | 2 | `agent-drafted` |
| 16 | `b-behavioural-bench-spend` | road-to-mixed-trigger-activation-cost.md | 2 | maintainer-recorded |
| 17 | `manual-rubric-rater` | road-to-scale-history-bench-run.md | 2 | `agent-drafted` |
| 18 | `b-delegate-gate-maintainer-profile` | road-to-gate-autonomy.md | 1 | maintainer-recorded |
| 19 | `b-gate-budget-preauth` | road-to-gate-autonomy.md | 1 | maintainer-recorded |
| 20 | `b-detector-demotion-bars` | road-to-stop-gate-honesty.md | 1 | maintainer-recorded |
| 21 | `benchmark-spend` | road-to-surface-consolidation.md | 1 | maintainer-recorded |

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
- **Unblocks:** 26 open step(s) — Phase 3 (org-wide enablement onward)
- **Question** (recorded `Question:`)**:** Does the company data-protection process approve the Class-A field list and the disclosure text?
- **Default:** run it as a written review of exactly two artefacts — the Class-A field list from Phase 1 and the one-line disclosure from Phase 3 — rather than of the roadmap.
- **Default source:** maintainer-recorded `Recommendation:` in the roadmap
- **Recommendation (full):** run it as a written review of exactly two artefacts — the Class-A field list from Phase 1 and the one-line disclosure from Phase 3 — rather than of the roadmap. The design was built to make this review short: no content fields exist to argue about, and the pseudonymous hash is salted outside the public repository.
- **If you do nothing:** every phase through 2 still runs, and a single-machine enablement remains legitimate for testing. Only enablement across colleagues waits. The measurement in Phase 4 needs at least three distinct users, so the null it publishes without this sign-off would be an artifact of the missing approval rather than a finding about adoption — which is worth knowing before reading that number.
- **Done when:** a written internal sign-off exists and is referenced from the ADR.
- **Your answer:** _(accept default · override · defer)_

## 5 · `sink-choice`

- **Roadmap:** road-to-org-telemetry.md
- **Unblocks:** 26 open step(s) — Phase 2 (sink stand-up)
- **Question** (recorded `Question:`)**:** Should the sink be a minimal ingest endpoint, or a private repository used as an append-only store?
- **Default:** the private repository.
- **Default source:** maintainer-recorded `Recommendation:` in the roadmap
- **Recommendation (full):** the private repository. The volume is small, the write path is an existing authenticated primitive rather than new infrastructure to operate, and the Phase 6 clustering runs offline over the file set. An ingest endpoint is the better answer only if the volume outgrows a repository, which the current zero makes unlikely in the measurement window this roadmap needs.
- **If you do nothing:** Phases 0 and 1 still run in full — the spikes and the local emission need no sink. The plan stalls at the first outbound flush, which is also the first point at which any data would leave a machine, so the cost of the delay is bounded and the privacy posture is unaffected.
- **Done when:** the sink and its location are named, and the identifier exists in the org pack rather than in this repository.
- **Your answer:** _(accept default · override · defer)_

## 6 · `compaction-census-session`

- **Roadmap:** road-to-context-fidelity.md
- **Unblocks:** 19 open step(s) — Phase 0 (cf01 compaction-survival census), and transitively all of Phase 1, whose build-or-close decision reads cf01's number
- **Question** (recorded `Question:`)**:** cf01 needs an instrumented live session with a manual compaction, repeated across five sessions — and cf03 has since shown that no manual compaction has ever been recorded here.
- **Default:** Establish manual detectability first, then decide.
- **Default source:** maintainer-recorded `Recommendation:` in the roadmap
- **Recommendation (full):** Establish manual detectability first, then decide. **Corrected on R2 finding 6** — the earlier recommendation here said "re-specify cf01 against the automatic path" because "a manual-compaction census measures a path production never takes", and that overstated what cf03 can support. cf03 recorded 29 events across 473 sessions, all 29 tagged `auto` and none manual — but the detector is pinned to one OBSERVED auto event (`src/scripts/_lib/session_eol.ts:11-19`) and nothing establishes that a manual compaction writes a `compact_boundary` record at all. Zero manual is absence of a RECORD. So the cheap first move is a single manual compaction in one instrumented session to see whether it leaves a trace: if it does, cf01 runs as written; if it does not, cf01's null would be uninterpretable and the automatic path is the only measurable one. The automatic path needs no special session — probes placed in a session that is going to cross 1M tokens, which about half the recorded sessions do (239 of 473 end above 400k).
- **If you do nothing:** Phase 1 stays unstarted, which is the correct state rather than a stall — it is exactly what a pre-registered honest-null threshold is for. Phase 2 is unaffected: its own gate now reads cf02, which is done. Phase 3 is withdrawn on its own grounds and does not wait on this. The plan degrades to its memory half, and the memory half is the one with a measured defect behind it.
- **Done when:** a `context-fidelity-cf01.md` finding exists under `agents/evidence/eval-findings/` carrying a per-probe-class number and a host stamp, or the user records that the compaction-survival question is closed unmeasured and Phase 1 is cancelled. (The filename is deliberately not written as a full path here: `check_references` resolves a path in prose and the file does not exist yet, so a link would be a broken reference by construction. The step's own `verify:` probe holds the full path, which is where it belongs.)
- **Your answer:** _(accept default · override · defer)_

## 7 · `b-per-turn-composite-bar`

- **Roadmap:** road-to-per-turn-hook-economy.md
- **Unblocks:** 16 open step(s) — Phase 4 step 4.2 only. Step 4.1 registers the composite as a measured row and 4.3 refreshes the census; both proceed without the bar.
- **Question** (derived from the first `What to do:` step)**:** pre-register the per-turn composite bar.
- **Default:** **option (b) — register the row observe-only for one release.** No prior exists for a per-turn composite in this tree, so any number named today would be invented, and an invented bar on a summed metric is the flappiest possible gate.
- **Default source:** maintainer-recorded `Recommendation:` in the roadmap
- **Recommendation (full):** **option (b) — register the row observe-only for one release.** No prior exists for a per-turn composite in this tree, so any number named today would be invented, and an invented bar on a summed metric is the flappiest possible gate. One release of observation produces the distribution the bar should come from. Option (a) is right afterwards, not now; option (c) leaves D-1 permanently unmeasurable, which is the defect itself.
- **If you do nothing:** the per-turn cost stays structurally invisible — every slot green, the number the user feels unrepresented — and Phases 1, 2, 3 and 5 land with no bar to prove they helped. The budget-ownership discipline this repo follows says the bar precedes the lever, so the phases would be shipping against no registered target at all.
- **Done when:** one option is recorded at this blocker and — for (a) or (b) — the row exists in `hook-latency-budget.json` with its bar or its observe-only marker.
- **Your answer:** _(accept default · override · defer)_

## 8 · `legacy`

- **Roadmap:** road-to-gated-reach-followup.md
- **Unblocks:** 12 open step(s) — entire roadmap
- **Question** (derived from the first `What to do:` step)**:** `yt-dlp` and a JavaScript runtime are installed **by a human** on the machine that runs this.
- **Default:** _this is a legacy `> Blocked until …` note, not a `### blocker:` entry, so it has no `Recommendation:` field to read. Converting it into a real blocker entry is what gives it a default._
- **Default source:** none — legacy note
- **Done when:** condition described above clears
- **Your answer:** _(accept default · override · defer)_

## 9 · `real-orchestration-usage`

- **Roadmap:** road-to-orchestration-scope-decision.md
- **Unblocks:** 6 open step(s) — Phase 2 (and thereby Phase 3's decision)
- **Question** (derived from the first `What to do:` step)**:** the build work is done; only real delegable work produces the telemetry.
- **Default:** **(agent-drafted 2026-08-18 — this entry predates the field; drafted from the roadmap's own text for the consolidated decision sheet, not from a maintainer decision.)** Run the payload probe FIRST and treat its answer as the decision, rather than accumulating more usage.
- **Default source:** `agent-drafted` — written into the roadmap’s `Recommendation:` field and marked there, NOT a maintainer decision
- **Recommendation (full):** **(agent-drafted 2026-08-18 — this entry predates the field; drafted from the roadmap's own text for the consolidated decision sheet, not from a maintainer decision.)** Run the payload probe FIRST and treat its answer as the decision, rather than accumulating more usage. The entry's own re-measurement is decisive on this: at 367 orchestration lines the quality columns are `null` 367/367 and `spawn_count ≥ 2` is 0 of 367, so more of the same telemetry cannot populate the columns PROVE needs. If no hook slot sees the task-completion payload, Phase 3's verdict is an **honest null** and this roadmap terminates on that finding instead of waiting; only if a slot does see it is the ≥ 20-populated-line window worth opening.
- **If you do nothing:** 6 steps wait on a window that the entry's own numbers suggest may never fill, and the roadmap keeps reading as resumable to every feasibility screen — the exact misreading the 2026-08-17 rewrite of the Resolved-when was written to stop. A blocker whose condition cannot be reached is a park or a null, not a wait.
- **Done when:** a probe result records whether any hook slot sees the task-completion payload, and — if one does — the current-month audit log carries ≥ 20 orchestration lines whose **quality** columns are populated rather than `null`. **Rewritten 2026-08-17.** The bare line-count condition this field carried until today (*"the current-month audit log holds ≥20 orchestration lines"*) was satisfied at 99 lines when it was written and stands at **367** now, while the blocker never stopped being open — a resolution test that is already met cannot resolve anything, and every feasibility screen that trusted it read this roadmap as resumable. The sibling `road-to-subagent-value-realization-followup` had the identical defect repaired on 2026-08-16; this one was missed in the same pass.
- **Your answer:** _(accept default · override · defer)_

## 10 · `telemetry-sample-size`

- **Roadmap:** road-to-subagent-value-realization-followup.md
- **Unblocks:** 6 open step(s) — Phase 1 — Seed real telemetry
- **Question** (derived from the first `What to do:` step)**:** 1.
- **Default:** stop treating this as a usage-volume blocker and run the live-host semantics probe instead — does **any** hook slot receive the task-completion notification payload, and does that payload carry the usage fields a background dispatch withholds at `post_tool_use`?
- **Default source:** maintainer-recorded `Recommendation:` in the roadmap
- **Recommendation (full):** stop treating this as a usage-volume blocker and run the live-host semantics probe instead — does **any** hook slot receive the task-completion notification payload, and does that payload carry the usage fields a background dispatch withholds at `post_tool_use`? Same shape as `background-continuation-probe`, not a code fix. It is the recommended option because it is the only one that can move the exit criterion: the line count is already met at 99, and the missing columns are documented behaviour of the slot, so more usage produces more of the same nulls.
- **If you do nothing:** the log keeps growing and Phase 1 stays open forever — `≥ 20 **usable** dispatches` is unreachable at this slot regardless of volume, so the roadmap's last acceptance criterion (re-evaluating the ADR-117 `auto: on` default on real telemetry) never gets the evidence it names, and the default stands unexamined by default rather than by decision.
- **Done when:** a probe result records whether any hook slot sees the task-completion payload, and — if one does — `agents/runtime/state/audit/YYYY-MM.jsonl` carries ≥ 20 orchestration lines whose quality columns are populated rather than `null`. The bare line-count condition this field carried until 2026-08-16 was already satisfied at 99 lines while the blocker stayed open, which made it unusable as a resolution test.
- **Your answer:** _(accept default · override · defer)_

## 11 · `human-gated-live-trigger-eval`

- **Roadmap:** road-to-skill-description-measurement.md
- **Unblocks:** 4 open step(s) — all of Phase 1 — 1.1 and 1.2 both need a live model run
- **Question** (derived from the first `What to do:` step)**:** run the live trigger-eval to produce the predictions JSON for both tree states — `./scripts-run src/scripts/rule_trigger_eval` on the maintainer machine, once per tree state, same protocol both times.
- **Default:** **(agent-drafted 2026-08-18 — this entry predates the field; drafted from the roadmap's own text for the consolidated decision sheet, not from a maintainer decision.)** Run both tree states in ONE sitting under the same protocol, or park the roadmap in `later/` with exactly that as its resume condition.
- **Default source:** `agent-drafted` — written into the roadmap’s `Recommendation:` field and marked there, NOT a maintainer decision
- **Recommendation (full):** **(agent-drafted 2026-08-18 — this entry predates the field; drafted from the roadmap's own text for the consolidated decision sheet, not from a maintainer decision.)** Run both tree states in ONE sitting under the same protocol, or park the roadmap in `later/` with exactly that as its resume condition. Two sittings is the failure mode to avoid: the entry's Resolved-when requires both JSONs to come from the *same* protocol, and a protocol that drifted between runs produces two files that look comparable and are not. This blocker also gates `road-to-cost-parity-1-rule-payload-diet`'s `skill-activation-window`, so one sitting discharges two entries — which is why it outranks its own step count.
- **If you do nothing:** all of Phase 1 stays open, and the description rewrite ships with no before/after activation reading — the claim it exists to test stays unmeasured while reading as ordinary open work.
- **Done when:** a predictions JSON exists for the pre-rewrite and the post-rewrite tree state, produced by the same protocol.
- **Your answer:** _(accept default · override · defer)_

## 12 · `b-live-trigger-eval`

- **Roadmap:** road-to-catalogue-host-fit.md
- **Unblocks:** 3 open step(s) — Phase 0 only. Phases 1, 1b, 2 and 3 are repo work and proceed without it — Phase 0 sits first because of its cross-roadmap leverage, not because it gates this file.
- **Question** (derived from the first `What to do:` step)**:** run the human-gated live trigger eval.
- **Default:** **option (a) — run it now, in one sitting.** This is the highest-leverage human action in the estate and the arithmetic is not close: one run commits the selection-accuracy baseline, satisfies a resume condition on `road-to-cost-parity-1-rule-payload-diet`, and satisfies a resume gate on `later/road-to-token-saving`.
- **Default source:** maintainer-recorded `Recommendation:` in the roadmap
- **Recommendation (full):** **option (a) — run it now, in one sitting.** This is the highest-leverage human action in the estate and the arithmetic is not close: one run commits the selection-accuracy baseline, satisfies a resume condition on `road-to-cost-parity-1-rule-payload-diet`, and satisfies a resume gate on `later/road-to-token-saving`. Option (b) is strictly slower for the same spend and makes three roadmaps wait on a mechanism that does not exist yet. Option (c) strands all three indefinitely.
- **If you do nothing:** three roadmaps stay blocked on a command whose only human ingredients are one confirmation and a bounded amount of spend — the canonical runnable-but-waiting gate `road-to-gate-autonomy` § 0 uses as its own worked example. The skill-selection accuracy of the rewritten descriptions stays unmeasured, so nothing can say whether they helped.
- **Done when:** the eval's baseline is committed, or option (b) or (c) is recorded at this blocker with its date.
- **Your answer:** _(accept default · override · defer)_

## 13 · `b-consolidated-decision-sheet`

- **Roadmap:** road-to-estate-drawdown.md
- **Unblocks:** 3 open step(s) — Phase 0 step 0.2, and through it the class-1 tranche in 1.2. Step 0.1 generates the sheet without it, and Phase 2's triage sweep proceeds independently.
- **Question** (derived from the first `What to do:` step)**:** answer the consolidated decision sheet that step 0.1 produces — thirteen user-owned blockers, sorted by unblock count, each with a one-line question, a rendered or agent-drafted recommendation, and a default.
- **Default:** **option (c) — answer the two largest-unblock items, defer the rest.** It discharges most of the blocked step count for a fraction of the reading, which is the whole point of sorting the sheet by unblock count.
- **Default source:** maintainer-recorded `Recommendation:` in the roadmap
- **Recommendation (full):** **option (c) — answer the two largest-unblock items, defer the rest.** It discharges most of the blocked step count for a fraction of the reading, which is the whole point of sorting the sheet by unblock count. Option (a) is faster still but accept-all-defaults over thirteen items includes the agent-drafted defaults, and those are the ones risk 2 flags as least examined. Option (b) is the most careful and the most likely not to happen — this blocker exists because thirteen reading assignments already did not happen once.
- **If you do nothing:** thirteen user-owned blockers stay open, the two largest unblocks keep holding their step counts, and the campaign starts from a count that rose rather than fell — 44 active after this cohort. Phase 2's triage sweep still runs, so verdicts land, but every DECISION-SHEET verdict routes back to this same unanswered sheet.
- **Done when:** each of the thirteen carries either an answer or an explicit deferral recorded at its own blocker, and the sheet records which option was used.
- **Your answer:** _(accept default · override · defer)_

## 14 · `b-convergence-machine`

- **Roadmap:** road-to-carrier-layer-convergence.md
- **Unblocks:** 2 open step(s) — Phase 3 only (Phases 1-2 are repo work)
- **Question** (derived from the first `What to do:` step)**:** Phase 3's before/after pair needs the maintainer machine, since the two-layer topology is a property of the install rather than of the repo.
- **Default:** **(agent-drafted 2026-08-18 — this entry predates the field; drafted from the roadmap's own text for the consolidated decision sheet, not from a maintainer decision.)** Take all three steps in ONE sitting — reading, `install --layer`, reading — and record both readings against a named commit in the same note.
- **Default source:** `agent-drafted` — written into the roadmap’s `Recommendation:` field and marked there, NOT a maintainer decision
- **Recommendation (full):** **(agent-drafted 2026-08-18 — this entry predates the field; drafted from the roadmap's own text for the consolidated decision sheet, not from a maintainer decision.)** Take all three steps in ONE sitting — reading, `install --layer`, reading — and record both readings against a named commit in the same note. Do not try to reproduce the two-layer topology in the repo: the entry already states that the topology is a property of the install, so a repo-side reconstruction would measure something else and read as the same number. Phases 1-2 are repo work and proceed meanwhile; only Phase 3 waits.
- **If you do nothing:** Phases 1-2 land and Phase 3 stays open, which means the convergence claim ships with no before/after pair behind it — the shape where a number is published and the measurement that would falsify it was never taken.
- **Done when:** both readings exist at a named commit.
- **Your answer:** _(accept default · override · defer)_

## 15 · `maintainer-blind-ratings`

- **Roadmap:** road-to-council-blind-review.md
- **Unblocks:** 2 open step(s) — Ü2 and Ü3 adoption (Phase 2 pre-registered decision rules) and the Ü2/Ü3 half of Phase 3's merge-or-null. **Ü1 is NOT blocked** — it is decided, adopted and merged (`blind_chairman` default true, opt-out flag, mandatory post-verdict de-anon map, 26/26 test-pinned).
- **Question** (derived from the first `What to do:` step)**:** rate the prepared blind packet at `internal/bench/council-blind-review/blind-rating-packet.md`, blind to arms.
- **Default:** **(agent-drafted 2026-08-18 — this entry predates the field; drafted from the roadmap's own text for the consolidated decision sheet, not from a maintainer decision.)** Do R1 and R2 in one sitting against the prepared packet, and accept an **honest null** as a full outcome for either — the entry's own Resolved-when asks for adopt-or-honest-null and explicitly refuses a deferral, so "the preference was not majority" closes Ü2 exactly as cleanly as adoption does.
- **Default source:** `agent-drafted` — written into the roadmap’s `Recommendation:` field and marked there, NOT a maintainer decision
- **Recommendation (full):** **(agent-drafted 2026-08-18 — this entry predates the field; drafted from the roadmap's own text for the consolidated decision sheet, not from a maintainer decision.)** Do R1 and R2 in one sitting against the prepared packet, and accept an **honest null** as a full outcome for either — the entry's own Resolved-when asks for adopt-or-honest-null and explicitly refuses a deferral, so "the preference was not majority" closes Ü2 exactly as cleanly as adoption does. The sitting is bounded: the packet is already prepared, Ü1 is already adopted and out of scope, and the two readings have pre-registered decision rules rather than open-ended judgement.
- **If you do nothing:** Ü2 and Ü3 stay undecided and Phase 3's merge-or-null cannot be written at all, so the roadmap cannot terminate in either direction. Ü1's shipped behaviour is unaffected, which is what makes this the cheapest kind of blocker to leave open and the easiest to forget.
- **Done when:** both readings exist, and each of Ü2 / Ü3 carries an adopt-or-honest-null verdict rather than a deferral.
- **Your answer:** _(accept default · override · defer)_

## 16 · `b-behavioural-bench-spend`

- **Roadmap:** road-to-mixed-trigger-activation-cost.md
- **Unblocks:** 2 open step(s) — Phase 3 steps 3.1 and 3.2. Step 3.3's observer is repo work and proceeds without it.
- **Question** (derived from the first `What to do:` step)**:** authorise the paired A/B run, which bills model tokens across 5–8 tasks in two arms.
- **Default:** **defer it to the class-1 budget ledger** rather than naming a one-off budget now.
- **Default source:** maintainer-recorded `Recommendation:` in the roadmap
- **Recommendation (full):** **defer it to the class-1 budget ledger** rather than naming a one-off budget now. The bench is the most expensive step in this roadmap and the least urgent: Phase 2's dispositions are justified by the token census on their own, and the bench decides only whether they are *mandatory* or merely *available*. Paying for it before the ledger exists spends the consent twice — once here, once again for the next bench — which is the exact couriering `road-to-gate-autonomy` was opened to end.
- **If you do nothing:** the behavioural-regression claim stays an argument rather than a number. Phase 2 can still ship on the token census, but the roadmap loses its falsifiability spine — nothing would refute the premise if it were wrong, and the honest-null consequence below becomes unreachable.
- **Done when:** a budget is named at this blocker, or the step is re-dated against the ledger mechanism with that dependency stated.
- **Your answer:** _(accept default · override · defer)_

## 17 · `manual-rubric-rater`

- **Roadmap:** road-to-scale-history-bench-run.md
- **Unblocks:** 2 open step(s) — Phase 1 step 1's scoring half, and thereby step 2's verdict
- **Question** (derived from the first `What to do:` step)**:** score each produced artifact against `internal/bench/scale-history/rubric.md`, blind to arm, **before** any `score.ts` output is viewed.
- **Default:** **(agent-drafted 2026-08-18 — this entry predates the field; drafted from the roadmap's own text for the consolidated decision sheet, not from a maintainer decision.)** Score the artifacts in ONE sitting and do it before any `score.ts` output is on screen — the anti-anchor ordering is binding per the rubric's own first line, so a sitting split across days is the likeliest way to void the result without noticing.
- **Default source:** `agent-drafted` — written into the roadmap’s `Recommendation:` field and marked there, NOT a maintainer decision
- **Recommendation (full):** **(agent-drafted 2026-08-18 — this entry predates the field; drafted from the roadmap's own text for the consolidated decision sheet, not from a maintainer decision.)** Score the artifacts in ONE sitting and do it before any `score.ts` output is on screen — the anti-anchor ordering is binding per the rubric's own first line, so a sitting split across days is the likeliest way to void the result without noticing. If that sitting is not going to happen in the near term, the honest move is to park this roadmap in `later/` with the rubric pass as its probe-able resume condition, rather than leaving it in the active tree reading as ordinary open work.
- **If you do nothing:** Phase 1 step 1's scoring half stays open and step 2 has no verdict, so the bench run produces only the SECONDARY `lint_persistence` count — a number the pre-registration explicitly does not accept as the defect count. The roadmap then reads as spend-blocked when it is in fact rater-blocked, which is the misreading its own Surfaced note records.
- **Done when:** a human rubric score exists per artifact, recorded before the secondary `lint_persistence` pass for that artifact. - **Surfaced 2026-08-14** by the continuation sweep. It was always true and was never written down, which is why this roadmap read as spend-blocked-only.
- **Your answer:** _(accept default · override · defer)_

## 18 · `b-delegate-gate-maintainer-profile`

- **Roadmap:** road-to-gate-autonomy.md
- **Unblocks:** 1 open step(s) — Phase 3 step 3.1 and therefore 3.2.
- **Question** (derived from the first `What to do:` step)**:** decide whether to enable the team surface and `allow_delegate` in the maintainer profile only.
- **Default:** **option (a) — enable both in the maintainer profile.** The blast-radius controls already exist and are unchanged by this: the per-day call cap, the code gate as the enforcement point, and the orchestration ledger as the audit trail.
- **Default source:** maintainer-recorded `Recommendation:` in the roadmap
- **Recommendation (full):** **option (a) — enable both in the maintainer profile.** The blast-radius controls already exist and are unchanged by this: the per-day call cap, the code gate as the enforcement point, and the orchestration ledger as the audit trail. Option (b) permits consultation but not delegated writes, which leaves "a particular agent run" a human task — the exact class Phase 3 exists to remove. Note what makes (a) low-risk here specifically: it moves one profile's setting, not a shipped default, so no consumer install changes.
- **If you do nothing:** class-1 entries whose `run:` is an agent run stay human-typed, so the acting half of the gate layer is missing precisely where the work is largest. `road-to-estate-drawdown`'s recurring pass (its Phase 4) has no delegate path to run on and cannot exist.
- **Done when:** one option is recorded at this blocker, and for (a) or (b) the profile carries the setting with the cap named.
- **Your answer:** _(accept default · override · defer)_

## 19 · `b-gate-budget-preauth`

- **Roadmap:** road-to-gate-autonomy.md
- **Unblocks:** 1 open step(s) — Phase 2 step 2.3, and therefore every class-1 execution. Steps 2.1 and 2.2 ship the class-0 path and the render path without it. Also blocks the over-budget half of 2.1's `verify:` clause and AC-2's class-1 half: both need a budget to compare against, and this entry is where that budget is decided.
- **Question** (derived from the first `What to do:` step)**:** decide the standing budget shape for class-1 gates.
- **Default:** **option (a) — per-run and per-week caps with the receipt ledger.** It is the only option that actually removes the couriering while keeping a real spend bound: a per-run cap alone bounds one mistake, not a week of them.
- **Default source:** maintainer-recorded `Recommendation:` in the roadmap
- **Recommendation (full):** **option (a) — per-run and per-week caps with the receipt ledger.** It is the only option that actually removes the couriering while keeping a real spend bound: a per-run cap alone bounds one mistake, not a week of them. Option (b) preserves today's friction for every billable gate, which leaves the defect in place while adding a ledger. Option (c) collapses class 1 into class 2 and makes the four-class taxonomy a three-class one — defensible, but it gives up the class where the mechanism has the most to offer.
- **If you do nothing:** every billable gate keeps needing a keystroke, the live trigger eval keeps blocking three roadmaps, and class 1 exists on paper with no mechanism behind it. Phase 2 still ships the class-0 path, so the estate gets the free half of the acting layer and none of the paid half.
- **Done when:** one option is recorded at this blocker and — for (a) or (b) — the settings keys and the ledger path exist.
- **Your answer:** _(accept default · override · defer)_

## 20 · `b-detector-demotion-bars`

- **Roadmap:** road-to-stop-gate-honesty.md
- **Unblocks:** 1 open step(s) — Phase 2 step 2.1, and therefore any demotion. Steps 1.x, 2.2 and 3.x are repo work and proceed without it.
- **Question** (derived from the first `What to do:` step)**:** pre-register the demotion bar per detector, before reading Phase 1's data — pre-registration after the fact is not pre-registration.
- **Default:** **option (a) — per-detector bars.** The three detectors have genuinely different legitimacy profiles: A fires on the agent's own promissory language, B on a language mismatch against a fresh pin, C on an edit with no verifier.
- **Default source:** maintainer-recorded `Recommendation:` in the roadmap
- **Recommendation (full):** **option (a) — per-detector bars.** The three detectors have genuinely different legitimacy profiles: A fires on the agent's own promissory language, B on a language mismatch against a fresh pin, C on an edit with no verifier. A single shared bar (option b) would be set by whichever detector fires most and would either demote a detector that was working or protect one that was not. Option (c) is defensible on the round-5 evidence but forecloses the question permanently, and this roadmap's whole premise is that a blocking gate should carry a number.
- **If you do nothing:** the gate keeps refusing turn-ends at an unmeasured rate, and the estate keeps a blocking concern with no registered kill standard while every advisory around it has one. Phase 1's counts would accumulate with nothing authorised to act on them — measurement without a decision rule, which is the shape this roadmap was opened to fix.
- **Done when:** the bars, or option (c), are recorded at this blocker with their reasoning, and the record predates the first read of Phase 1 data.
- **Your answer:** _(accept default · override · defer)_

## 21 · `benchmark-spend`

- **Roadmap:** road-to-surface-consolidation.md
- **Unblocks:** 1 open step(s) — lazy-catalog A/B, team/adversarial-council benchmarks, the Unified Verification Router decision (gated on those verdicts)
- **Question** (derived from the first `What to do:` step)**:** each is a spend-bearing (or corpus-gated) paid run, authorized per run and never as a bundle.
- **Default:** (a) alone, if anything.
- **Default source:** maintainer-recorded `Recommendation:` in the roadmap
- **Recommendation (full):** (a) alone, if anything. It is the only one of the three with a runner and a spend cap already in the tree, so it is the only one that can be authorized against a real estimate rather than a guess; (b) needs a runner named first, and until either verdict exists (c) is a decision about a question nobody has asked recently.
- **If you do nothing:** nothing degrades and nothing is at risk — which is precisely why this has not moved. The cost is that the Unified Verification Router decision stays parked indefinitely while reading as pending, so the roadmap cannot close and a reader cannot tell a deferred decision from a forgotten one.
- **Done when:** the maintainer authorizes the specific run with an estimate, or records (c).
- **Your answer:** _(accept default · override · defer)_
