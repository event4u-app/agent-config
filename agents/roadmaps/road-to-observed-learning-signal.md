---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
estate_growth_exempt: "Carries the only five items of an inbox round that survived verification against a tree where the same subject already shipped once — the experience loop's machinery is built and its input stream is a producer constant, which no parked or archived roadmap covers and which a shipped experience card's falsifier names and has not fired."
estate_offset_exempt: "Offsets nothing: it is a new plan, not a carried deferral, and it deliberately does not reopen either `later/` receiver of `road-to-experience-loop-broadening`, whose carry semantics cover their parent's own criteria and not unrelated work."
---
# Road to an observed learning signal

> **Source:** `agents/tmp.old/inbox-2026-09-p/` — verified against the tree at `93d63073e` on 2026-09-05.

## Goal

The experience loop's machinery already exists and is starved. `road-to-experience-loop-broadening` closed with 44 of 47 boxes done and shipped every downstream reader this round's drafts proposed to build: the per-asset report that reports `unknown` as its own share and `win_rate` as `null` rather than `0`, the five activation/adherence states where `null` is not a pessimistic `false`, the ≥2-origin corroboration rule, the committed outcome-vocabulary module, the experience-card variant, and the one-file-per-record store. None of that is re-planned here. What did not close is AC-9, and its recorded reason is the whole subject of this roadmap: no failure pattern exists to mine, because every audit line ever written carries the same literal `rules_applied` value. This roadmap is done when the audit stream carries at least one field computed from what actually happened rather than from what the producer always writes; when a model-noticed observation has a durable, target-addressed place to wait for its second occurrence instead of being handed to a host-native tool no reader of this repository can query; when a roadmap parked in `later/` cannot pass its gate on a status word alone; and when the two documents that still assert a retired doctrine and a non-existent artefact have been corrected.

## Phase 1 — Correct the two documents that mislead the next reader

- [ ] **1.1 Remove the retired no-decay / no-runtime doctrine from the pipeline skill.** `src/skills/skill-improvement-pipeline/SKILL.md:84-86` states "no auto-write, no decay, no runtime (the writable per-project learning store stays rejected)". Both halves are contradicted in the tree: `src/scripts/learning_sidecar.ts:37` sets `HALF_LIFE_DAYS = 30` and computes a decay over a per-project intake store, and ADR-249 `:85-87` permits a supervised resident process in core, superseding the no-daemon clause it inherited. Rewrite the sentence to say what is actually true — no auto-write and no auto-promotion, decay and runtime governed rather than prohibited — and keep the no-auto-write half, which is still the live boundary.
      verify: `grep -n "no decay\|no runtime" src/skills/skill-improvement-pipeline/SKILL.md` returns nothing, and the surviving sentence names `learning_sidecar.ts` or ADR-249 as the reason.
- [ ] **1.2 Retire the `capture-learnings` name from the four documents that assert it exists.** `docs/contracts/rule-classification.md:110`, `docs/contracts/linear-ai-rules-inclusion.md:92`, `docs/guidelines/agent-infra/self-improvement-pipeline.md:8` and `docs/guidelines/agent-infra/naming.md:37` name it as a current artefact. Neither `src/rules/capture-learnings.md` nor `src/skills/capture-learnings/` exists; the live rule is `src/rules/skill-improvement-trigger.md` and the live skill is `skill-improvement-pipeline`. Replace each with the live name, or mark the line historical where it is describing a past state. Leave the string literal in `src/scripts/build_rule_trigger_matrix.ts:129` alone unless that matrix row is itself dead.
      verify: for every remaining match of `grep -rn "capture-learnings" docs src`, the line either names a live artefact or is explicitly marked historical.

## Phase 2 — Give the first model-noticed observation a target-addressed waiting room

- [ ] **2.1 Add `model-noticed` as a third `DefectSource`.** `src/scripts/_lib/self_repair.ts:34` admits only `user-reported` and `self-detected`, both of which require a detector to have fired. A model that notices an edge case in a rule, or a methodology the user just explained that no skill carries, has no record type. Widen the union in place; the store, the fingerprint derivation at `:548-557` and the noclobber path are unchanged, and no second store is introduced.
      verify: a unit test writes a `model-noticed` finding, reads it back through the existing store reader, and the record round-trips with its source intact.
- [ ] **2.2 Add a closed `target` field and validate it against the tree at write time.** `suggested_surface` at `:62-63` is free text the agent writes, so no record can be joined to the asset it is about. Add `target: string[]` whose entries match `rule:<id> | skill:<id> | command:<id> | hook:<concern>`, validated against the tree when the record is written; an unresolvable target is written to a `proposes` field instead of being silently accepted. An empty target list stays legal — a real observation with no identified home is information, not an error.
      verify: a fixture with `target: ["rule:does-not-exist"]` is rejected and lands in `proposes`; a fixture with `target: ["rule:scope-control"]` is accepted.
- [ ] **2.3 Widen the status enum and require a wake condition on the parked state.** `:71` admits only `open | released`, so a declined record stays `open` in the queue line for ever and a partially actioned one cannot be expressed. Move to `open | candidate | actioned | declined | superseded | parked`, with `parked_until` required whenever the status is `parked`, and migrate existing `released` records to `actioned` carrying a resolution line that says the migration is why.
      verify: a `parked` record without `parked_until` fails validation; the migration is idempotent, proven by running it twice over a fixture store and diffing.
- [ ] **2.4 Count occurrences per target, not only per fingerprint.** `:70` counts occurrences against the fingerprint, which is class plus normalised evidence shape — so two different manifestations of one rule's weakness are two records with one occurrence each, and the escalation rule at `src/skills/skill-improvement-pipeline/SKILL.md:196-199` ("a third recurrence of the same violation class converts an observation into a deterministic gate") has nothing that could ever establish a third recurrence. Aggregate occurrences by target as a derived read over the record files, regenerable and gitignored.
      verify: three records with distinct fingerprints and one shared target report a per-target count of three; deleting the derived index and rebuilding it is byte-stable.
- [ ] **2.5 Replace the `remember` routing in the pipeline skill with the record write.** `src/skills/skill-improvement-pipeline/SKILL.md:59` sends the seen-once-but-generalizable learning to a host-native `remember` tool. That tool is not target-addressed, is not readable by anything in this repository, appears in no corroboration counter, and is simply absent on hosts that do not ship it — so the ≥2 counter at `src/scripts/learning_sidecar.ts:39` restarts at one every time and the second occurrence can never be recognised as the second. Route that branch to the `model-noticed` record from 2.1 instead.
      verify: `grep -n "remember" src/skills/skill-improvement-pipeline/SKILL.md` returns no routing instruction, and the replacement line names the record write.

## Phase 3 — Make the park gate read a condition instead of a status word

Tagged `corrected-from-reproduction`: the round's drafts identified this gate as accepting the bare word `trigger` in 11 of 82 files. Reproducing the gate's own control flow showed a larger hole one branch earlier, and the steps below carry the corrected wording.

- [ ] **3.1 Remove the status short-circuit that lets a parked roadmap carry no wake condition at all.** `src/scripts/lint_roadmap_later_disposition.ts:179` reads `if (status !== 'later' && !RESUME_RE.test(body))`, so a file whose frontmatter says `status: later` passes without any resume text being present. Measured over the current tree: 62 of 81 parked roadmaps pass on the status word alone, 8 on a real `Blocked until` / `Resume when`, and 11 on the bare word `trigger` — so 73 of 81 carry no machine-readable wake condition. Require a wake condition regardless of status.
      verify: a fixture carrying `status: later` and no resume text is rejected; the current tree's violation count is reported and becomes the ratchet's starting floor rather than a silent pass.
- [ ] **3.2 Read the structured `entry_condition` field and stop accepting the bare word `trigger`.** Three files already carry `entry_condition:` and the lint reads none of them (`check()` at `:150-192` consults only `status:` and `RESUME_RE` over the body). Make `entry_condition` the field the gate reads; drop `trigger` from `RESUME_RE`, keeping the four unambiguous phrases, so a body that merely mentions the word in passing no longer satisfies a governance gate.
      verify: a fixture whose body says "the trigger fires on push" and carries no `entry_condition` is rejected; a fixture carrying `entry_condition` and no resume phrase passes.
- [ ] **3.3 Require the wake condition to name what would change the decision, when it could arrive, and who would have to act.** A condition that cannot be observed is a deferral wearing a condition's clothes. Specify the three parts in the field's contract and check that all three are present and non-empty; `none` is a legal answer for the third and blankness is not.
      verify: a fixture with a one-word `entry_condition` is rejected with a message naming the missing part.
- [ ] **3.4 Require `review_by` in the frontmatter of every parked roadmap.** Measured: 13 of 81 carry it, 68 do not. Ratchet from the current count rather than failing the tree in one change.
      verify: the gate reports 68 as its starting floor and refuses any increase.

## Phase 4 — Make one field in the audit stream an observation

- [ ] **4.1 Compute `rules_applied` from rules that actually fired, in both shipped producers.** `src/scripts/_lib/audit_field_provenance.ts:31-35` registers `rules_applied` as a producer constant with the value `['delegation-policy']`, and `agents/knowledge/experience-rules-applied-is-a-producer-constant.md` records the same as the tree's only experience card, with the falsifier "a producer computes `rules_applied` from rules that actually fired, and the mined pattern's count falls below the audit line count". The falsifier has not fired and the situation has worsened: mining the stream now returns exactly one pattern at count 1074 over 1104 lines, against 914 over 935 when the card was written. Every per-asset reader downstream — `src/scripts/_lib/experience_report.ts:116` included — is aggregating over a constant, so the corroboration and escalation machinery built in the previous roadmap has no varying input to work on. Change `_lib/orchestration_record.ts` and `_lib/review_skipped_record.ts` to write the rules the run actually carried; where a producer genuinely cannot know, write an empty list, which is an honest absence and is what `_lib/activation_receipt_producer.ts:300` already does.
      verify: `./scripts-run src/scripts/extract_audit_patterns --min-count 2` over a fixture stream of mixed runs returns more than one pattern, and the top pattern's count is strictly below the fixture's line count.
- [ ] **4.2 Retire the constant registration and the card together, in the same change, only once the falsifier has fired.** Removing the `PRODUCER_CONSTANT_FIELDS` row is the assertion that the field is now observed, and `:27-30` of that module says as much. Leaving the card standing after its falsifier fires would make the tree assert something false about itself, which is the failure the card exists to prevent.
      verify: the row is absent from `PRODUCER_CONSTANT_FIELDS`, the card is marked retired with the run that falsified it, and the module's own test asserting that the named producers still match the registered value passes on the new shape.
- [ ] **4.3 State plainly what does not follow.** A varying `rules_applied` does not make the loop productive; it makes it measurable. Record the residual honestly: whether the corroboration gate then mints anything at all is a question for the parked operational-proof roadmap, which is blocked on elapsed time rather than on effort, and this roadmap must not claim its criterion.
      verify: the closing note names `agents/roadmaps/later/road-to-experience-lifecycle-operational-proof.md` as the holder of the operational criterion and claims nothing about it.

## Phase 5 — Make the handoff carry falsifiable uncertainty

- [ ] **5.1 Add four self-critique sections to the handoff contract.** The template at `src/domains/meta/agent-handoff/command.md:94-127` carries Done, Open, Resume pointer, Repeatable workflow, Errors + fixes, Feedback history, Key decisions and Relevant files — every one of them a statement about what happened, none about what the outgoing session is least sure of. Add `Least confident`, `Biggest thing missed`, `Breaks in three months because` and `Not done`, and require every line in them to carry a `verify:` naming the command or observable state that would confirm or kill it. An unverifiable line of self-doubt is filler.
      verify: a fixture handoff with a `## Not done` line and no `verify:` is rejected by `src/scripts/lint_handoffs.ts`; `none` is accepted as the whole section body and blankness is not, matching the existing treatment of `## Open questions` at `:895-928`.
- [ ] **5.2 Capture, do not chase.** A finding surfaced while writing a handoff becomes a `model-noticed` record from 2.1, never a fix inside the handoff turn — the handoff exists because the session is ending, and a fix started there is the least-verified change in the whole run.
      verify: the contract states this and names the record write as the destination.

## Blockers

### blocker: estate-placement-of-this-roadmap

- **Status:** open
- **Owner:** maintainer
- **Blocks:** Phase 1 — Correct the two documents that mislead the next reader
- **Recommendation:** keep it as one standalone roadmap rather than folding into either parked receiver — folding into a parked carrier is outside the carry semantics the archival contract grants it and would silently unpark work waiting on elapsed time; splitting across three files to dodge a threshold is the alternative nobody should take silently.
- **If you do nothing:** the roadmap has no settled place in the estate, and Phase 1 lands without the estate-slot question ever having been answered.
- **What to do:**
  1. Decide standalone vs. fold vs. split, reading `agents/roadmaps/later/road-to-experience-lifecycle-operational-proof.md` and `agents/roadmaps/later/road-to-experience-loop-owner-decisions.md` first to confirm neither is a legal receiver.
  2. Run `./scripts-run src/scripts/check_estate_count` to confirm the chosen placement holds against the measured floor before Phase 1 lands.
- **Resolved when:** the owner records which placement (standalone / fold / split) this roadmap takes, and `check_estate_count` is green under that placement.

Whether these five phases stand as one active roadmap or fold into an existing file is not a decision the analysis can take. The round's drafts recommend folding, on a premise that has since expired — they counted four active roadmaps at their pin and there is one at `93d63073e`. The two candidate receivers, `agents/roadmaps/later/road-to-experience-lifecycle-operational-proof.md` and `agents/roadmaps/later/road-to-experience-loop-owner-decisions.md`, are parked carriers of their parent's own criteria; adding unrelated work to a parked carrier is outside the carry semantics the archival contract grants them, and reopening either would also unpark work that is deliberately waiting on elapsed time. Standing alone costs one estate slot against a floor measured on the base ref per ADR-243 `:90-94`. The alternative nobody should take silently is splitting the five phases across three files to keep each below a threshold.

### blocker: per-turn-injection-budget-for-record-overlay

- **Status:** open
- **Owner:** maintainer
- **Blocks:** nothing in this roadmap — it gates work deliberately excluded from it.
- **Recommendation:** none; this is the owner's call — it turns on how much of the `skill-route` concern's per-turn budget the owner is willing to spend on a second payload, which is a policy trade-off, not a technical one.
- **If you do nothing:** the overlay is never built, and the evidence-firewall risk it would create (a run treating its own record-overlay view as a second independent observation) stays theoretical rather than realized.
- **What to do:**
  1. Decide whether the `skill-route` concern's threshold at `src/scripts/hook_manifest.yaml:755-758` may carry a second payload alongside its 30/100 floor, or whether record visibility must reach the agent through a separate, lower-frequency carrier.
  2. Record the decision (e.g. in `docs/decisions/` or an update to this blocker); if approved, adjust the threshold math to account for the added payload.
- **Resolved when:** the owner states either that the `skill-route` slot may carry the overlay, or that record visibility routes through a different mechanism.

The round's drafts propose surfacing open records at routing time, as an extra line on the `skill-route` concern. That concern's threshold is already tuned against a measured corpus — `src/scripts/hook_manifest.yaml:755-758` records a 30/100 floor at the p90 of 496 prompt lines, firing on 13.9 % of them, chosen explicitly because "a median floor would speak on half of all turns, which is the per-turn-reminder shape this estate has already measured failing". Adding a second payload to the same slot spends budget the owner set, and the retrieval it enables is also the mechanism the drafts' own evidence-firewall argument warns about: a run that has already seen a record's overlay is not an independent second observation of it. No step in this roadmap builds the overlay, and none should until the budget question is answered.

### blocker: live-harness-evaluation-of-promoted-changes

- **Status:** open
- **Owner:** maintainer
- **Blocks:** nothing in this roadmap — it gates work deliberately excluded from it.
- **Recommendation:** none; this is the owner's call — live multi-turn harness evaluation was already refused once in this estate's scouting work, and reopening it turns on evaluator-independence exposure only the owner can accept.
- **If you do nothing:** only the single-turn half (`bench_ab_*`, `src/scripts/_lib/paired_verdict.ts`) validates promoted changes; no promoted change gets a live multi-turn check.
- **What to do:**
  1. Decide whether a live-harness, multi-turn evaluation path is worth reopening given the prior refusal, and if so, whether it wraps a third-party evaluator CLI or extends `src/scripts/_lib/paired_verdict.ts` in-house.
  2. If approved, name the harness and cite the evaluator-independence guardrail (`src/rules/evaluator-independence.md`) it runs under before any roadmap schedules it.
- **Resolved when:** the owner records either that live-harness evaluation stays out of scope, or the harness + guardrail choice that would let a future roadmap schedule it.

Both parent drafts want every behavioural change validated in a real agent harness before promotion, one of them by wrapping external evaluation CLIs. Live evaluation floors are parked on evaluator independence, and shelling out to a third-party evaluator was already refused in this estate's scouting work. The single-turn half of the ask is not missing — `bench_ab_*` and `src/scripts/_lib/paired_verdict.ts` are the shipped mechanism — so what is blocked is specifically the multi-turn, live-harness half. This roadmap does not schedule it.

### blocker: artefact-family-registry

- **Status:** open
- **Owner:** maintainer
- **Blocks:** nothing in this roadmap — it gates work deliberately excluded from it.
- **Recommendation:** none; this is the owner's call — building the registry now would produce a measurement tool with no consumer, since `src/scripts/audit_skill_overlap.ts` already surfaces the clusters it would enumerate.
- **If you do nothing:** a shared rule changed in one family member and not its siblings stays undetected until a human notices it by hand.
- **What to do:**
  1. Wait for one recorded instance of a shared-rule propagation failure (a change landed in one family member and not its siblings), or decide to build the registry preemptively without waiting for one.
  2. If a real instance occurs, cite it in this blocker and open a roadmap that reads `audit_skill_overlap.ts`'s cluster output as the registry's seed data.
- **Resolved when:** either a propagation-failure instance is recorded here, or the owner decides to build the registry without waiting for one.

The drafts propose a declared family registry with shared and member-specific columns, so that a change to one member's shared rule is checked against its siblings. `src/scripts/audit_skill_overlap.ts` already surfaces the clusters a registry would enumerate, and nothing in the tree reads a registry today, so building one produces a measurement rather than a gate. It is recorded here rather than declined outright because the propagation failure it guards against is real and simply has no recorded instance yet; the condition that would reopen it is one recorded case of a shared rule being changed in one member and not its siblings.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-05 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A varying `rules_applied` still mints nothing | product | Phase 4 makes the field an observation, which is necessary and not sufficient: the stream may still be almost all `implement:success`, in which case the corroboration gate has more input and no failures to corroborate. The round's temptation is to read a fixed field as the whole cause of an empty loop | 4.3 requires the residual to be stated rather than claimed away, and points the operational criterion at the parked roadmap that owns it. The verify on 4.1 asserts variation in a fixture, never productivity in the real stream | Phase 4 — Make one field in the audit stream an observation |
| 2 | The widened record becomes a queue nobody drains | implementation | Adding a third source and a sixth status multiplies what can sit open. The self-repair store is empty on at least one checkout today, so the failure mode is not volume but a queue that grows once and is never read | 2.3 makes `declined` and `superseded` expressible so a record can leave the queue, and requires `parked_until` so a parked one names when it returns. No step adds a prompt-time surface that would make an unread queue costly | Phase 2 — Give the first model-noticed observation a target-addressed waiting room |
| 3 | Phase 3 reds the tree on the change that lands it | implementation | 73 of 81 parked roadmaps fail the corrected gate, and 68 lack `review_by`. A gate that fails its own tree on day one is reverted rather than adopted | 3.1 and 3.4 both ratchet from the measured current count instead of asserting a clean floor, which is how the shrink-only gates in this estate already work | Phase 3 — Make the park gate read a condition instead of a status word |
| 4 | Target validation goes stale against a moving tree | implementation | 2.2 validates `target` against the tree at write time. A rule renamed later leaves records pointing at an id that no longer resolves, and a silent unresolvable target is worse than free text because it looks joined | The derived per-target index in 2.4 is regenerable, so a rebuild surfaces unresolvable targets as a countable set rather than as silent misses; the byte-stability verify makes that rebuild routine | Phase 2 — Give the first model-noticed observation a target-addressed waiting room |
| 5 | The doctrine correction over-corrects | product | 1.1 removes "no decay, no runtime" because both are contradicted in the tree. The adjacent "no auto-write" clause is still the live boundary and reads as part of the same sentence, so a careless edit deletes a real constraint along with two retired ones | The step names the half to keep explicitly, and the verify checks that a surviving sentence remains and cites its authority | Phase 1 — Correct the two documents that mislead the next reader |
| 6 | Handoff sections become ritual | product | Four new required sections invite `none` four times, which passes every check and carries nothing. The existing `## Open questions` treatment shows the estate already met this shape once | 5.1 requires a `verify:` command on every non-`none` line, so a line that says something must say how it would be killed; the fixture pins both directions | Phase 5 — Make the handoff carry falsifiable uncertainty |

## Acceptance Criteria

- [ ] AC-1 — No document in `docs/` or `src/` asserts a no-decay or no-runtime doctrine, and no document names `capture-learnings` as a current artefact.
- [ ] AC-2 — A record written from a model's own noticing carries a source, a validated target or an explicit `proposes`, and a status drawn from a six-value closed enum, and it survives a round trip through the existing store with no second store present in the tree.
- [ ] AC-3 — A per-target occurrence count exists as a regenerable derived read, so the third-recurrence escalation stated at `src/skills/skill-improvement-pipeline/SKILL.md:196-199` has a counter that could establish its own precondition.
- [ ] AC-4 — The pipeline skill routes a seen-once generalizable learning to a record this repository can read, and no routing instruction in it names a host-native memory tool.
- [ ] AC-5 — A roadmap under `agents/roadmaps/later/` cannot pass its gate on a frontmatter status word alone, on the bare word `trigger`, or on a wake condition that omits what would change the decision, when it could arrive, or who would act.
- [ ] AC-6 — `rules_applied` is absent from `PRODUCER_CONSTANT_FIELDS`, the experience card asserting it is a constant is retired against the run that falsified it, and mining a mixed fixture stream returns more than one pattern.
- [ ] AC-7 — A handoff carries four self-critique sections in which every substantive line names the command or observable state that would confirm or kill it, and an empty section is rejected while `none` is accepted.
- [ ] AC-8 — The estate carries no new skill and no new hook concern as a result of this roadmap.
