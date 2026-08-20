---
complexity: structural
execution:
  mode: phase-checkpoints
---

# Road to standing context 40k — the registered destination, given a route

> **Source:** `agents/tmp.old/mixed-trigger-cleanup/road-to-standing-context-40k.md`
> — external analysis session, 2026-08-17, drafted against `de76c38b932d1612d36cfc85d6b9fbaff4832350`.
> Adopted 2026-08-17 via `/analyze:inbox` after per-claim verification against
> `origin/main` @ `097ab6549`.

---

## Outcome — checkpoint closed 2026-08-20, outcome state `narrowed`

**Archived does not mean achieved, and this roadmap is not archived.** The
registered destination — 40k median standing context — is **not reached and is
not claimed**. What closed on 2026-08-20 is one blocker checkpoint. Of the nine
lines: three done, **four still open**, one deferred (`3.1`, the fork), one
cancelled as a tracking line (`1.2`). Six were open when this run started and
**no line moved to done** — the run's product is a corrected disposition and four
preconditions **re-verified against the tree today** rather than inherited from
an earlier note.

| Phase | Outcome | Where it stands |
|---|---|---|
| 0 — rule out double delivery | **transferred** | 0.1 names hardware an agent cannot reach plus a per-machine settings write. Unchanged, stays `[ ]`. |
| 1 — pull the lever that exists | **narrowed** | 1.1 landed. 1.2's owner closed 2026-08-20 with its machinery `satisfied` **opt-in**; the default flip is transferred to the release maintainer, so the tracking line is discharged here. AC-1 is *not* met — below. |
| 2 — shrink the structural payload | **transferred** | 2.1 and 2.2 share one unmet sequencing precondition, re-verified today: the `norm:` pin does not exist in schema, script, or any rule. |
| 3 — runtime carrier or retire the triggers | **narrowed** | 3.0's host premise stays refuted. 3.1's fork stays open, re-dated to 2026-09-17, on a **corrected** ground: an absent producer, not an unfilled window. |
| 4 — per-turn injection aggregate | **satisfied** | Both steps landed 2026-08-19; AC-4 met and evidenced at the step. |

**AC-1 is narrowed, not met, and the number in circulation is the wrong one.**
AC-1 asks for the census on a scoped consumer install "measured with the
exact-BPE path and recorded". What exists is the owning roadmap's Phase-1 exit:
an **estimated** delta on a *fixture* install
([`road-to-request-scoped-rule-load.md`](road-to-request-scoped-rule-load.md)
§ Phase 1 Exit, "est. −50k tok eager"). That roadmap's own step-level done-note
corrects the headline: *"16 rules ≈ 13.9k tok eager (external '63 ≈ 50k' was a
naive tag read)"* — a ~3.6× overstatement — while its Outcome table still reads
"the ~50k lever". The larger figure is therefore **not** repeated here as fact.
Independently, no consumer install is scoped **by default**, so the population
AC-1 measures does not yet exist.

**AC-3 forbids a third state, and the third state is what holds.** The fork is
neither (a) nor (b). That is recorded openly with a date and a named producer
rather than resolved by picking a side the evidence does not support.

## 0. The defect, stated first

**The standing context is too large by the repo's own instruments, and the gate
that knows it is red.**

### D-0 — The dominant term on real machines is the double delivery

`archive/road-to-rule-delivery-integrity` measured it: both rule layers together
(`~/.claude/rules/` plus the project `.claude/rules/`) came to **176,354 tokens**
exact-BPE, with 91 duplicate basenames and 42 % redundancy. The installer
`--layer` gate and the `claudeMdExcludes` suppression shipped — but they protect
**new** installs only. An existing machine stays doubled, silently, and that is
the cheapest candidate explanation for a "slow since the update" perception that
survives the dispatcher-latency honest null.

### D-1 — The census is over its own ceiling

`src/config/preamble-payload-budget.json` registers a deterministic in-repo
standing baseline of **102,520 tokens** against a recorded destination of 40k
median / 50k p95, and its own milestone note records the measured total at
registration as **~23k ABOVE** that baseline. The gate is red on the tree as it
stands, and the baseline was deliberately not raised to hide it — raising a
ratchet baseline to clear a failing check is the config-weakening move this repo
blocks by construction. More than half of a 200k window is spent before any work
happens.

### D-2 — Rule routing on Claude Code is eager-all minus six

Claude Code reads only `paths:` frontmatter. The emitter deliberately gives no
frontmatter at all to a rule carrying keyword or phrase triggers, so it loads
unconditionally — because emitting `paths:` would silently delete the keyword
reach. At `origin/main`: **6 of 117 rules carry only path triggers; 19 more
declare paths and keywords and therefore load every session.** The earlier
scoping pass tried to widen that and was refuted 4/4 by the routing matrix within
the hour. **Window pin:** those nineteen became unconditional *at 12.1.0*, not
"structurally forever" — see `road-to-mixed-trigger-activation-cost`, which owns
the flip itself. This roadmap owns the token half.

### D-3 — The compile-time router has no runtime consumer for rules

`dist/router.json` is consumed by telemetry, lint and `route:explain`-class CLI
tools only. No hook or host-side loader resolves rules from it at runtime, so the
`triggers:` blocks of roughly a hundred `type: auto` rules are dead weight on
Claude at runtime. Skills got their first runtime carrier via `skill-route`; rules
did not.

### D-4 — Advisory injectors stack on the same slots

`user_prompt_submit` on claude binds several injectors-or-potential-injectors in
one slot, plus the session canary. Per-fire caps exist in
`hook-token-budget.json`, but there is **no per-turn aggregate cap** across
concerns, and no interference test asserting that two advisories do not
contradict each other or a loaded rule.

## 1. Verified provenance

Verified 2026-08-17 against `origin/main` @ `097ab6549`.

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| 1 | Baseline 102,520 tokens; 40k/50k recorded as destination | **still-true** | `src/config/preamble-payload-budget.json` `baseline_tokens` and `_comment` |
| 2 | Measured total ~23k above baseline; gate red; baseline deliberately not raised | **still-true** | same file, milestone note: "MEASURED total at registration time … ~23k ABOVE both baseline_tokens (102520) and the derived ceiling, i.e. the gate is red on the tree as it stands" |
| 3 | Rules with non-path triggers get no frontmatter and load unconditionally | **still-true** | `_has_non_path_trigger` branch inside `_claude_paths_plan`, `src/scripts/condense.ts` |
| 4 | 6 path-only rules; the earlier scoping pass refuted 4/4; ~13,630 tokens structural | **still-true** | commit `3b06e61`; the 6 are enumerated in `road-to-mixed-trigger-activation-cost` § 1 claim 2 |
| 5 | Silent keyword deletion by scoping was a fixed defect class | **still-true** | commit `33c7c20` |
| 6 | `router.json` consumers are telemetry / lint / CLI, not runtime | **still-true** | no importer of the router-match path under `src/scripts/hooks/` |
| 7 | Rule corpus size | **overtaken** | 117 files in `src/rules/` at `origin/main`, not 116 — the draft's count predates a later addition. The argument is unaffected |
| 8 | Per-fire injection caps exist; no per-turn aggregate | **still-true** | `src/config/hook-token-budget.json` default cap plus named exceptions; no aggregate row |
| 9 | Consumer scoping default is legacy-all behind a named human gate | **still-true** | `src/install/rule_scope.ts` header |
| 10 | The double-delivery measurement and its install-time mitigations | **still-true** | `agents/roadmaps/archive/road-to-rule-delivery-integrity.md` done-notes |

## Phases

### Phase 0 — Rule out the double-delivery layer first

The cheapest decisive check in this roadmap, and the one that can close the
colleague's report on its own.

- [ ] **0.1** Run the standing-rule-delivery dev task on the maintainer machine
      and on each affected colleague machine. A red result means the machine
      predates the installer gate: apply the `claudeMdExcludes` suppression for the
      unchosen layer — one settings entry, no deletion of anything.
      `verify:` the task's own output, recorded per machine with its date.
      **NOT executed 2026-08-19 — human action, by the step's own wording.** "On
      the maintainer machine and on each affected colleague machine" names
      hardware an agent cannot reach, and the remedy is a settings write per
      machine. This is a `/roadmap:next` disqualifier (a blocker whose resolution
      is a human ACTION), recorded here so the next screen does not re-derive it.
      **Re-verified 2026-08-20 — unchanged, and no council disposition covers
      it.** The drain-run dispositions transferred several host- and
      machine-bound items, but none of them is this one, so it is not silently
      absorbed elsewhere. Stays `[ ]`: an agent cannot read a colleague's machine.
- **AC-0:** every machine in the team reports under the governed cap on that gate,
  or carries a dated exemption note saying why it does not.

### Phase 1 — Pull the lever that already exists

> **Superseded in scope, deliberately.** `later/road-to-request-scoped-rule-load`
> owns consumer rule scoping, sits at 34/36 done, and its resume condition
> **fired** when P2.1 of rule-delivery-integrity closed — the same day, and nothing
> resumed it. This roadmap does not rebuild that; its contribution is the
> resumption evidence note. Steps 1.1 and 1.2 stay below as a description of what
> the resumption delivers, not as work to duplicate.
>
> **Update 2026-08-20 — the two facts above are now stale, in the good
> direction.** That roadmap is no longer in `later/` and no longer at 34/36: it
> is in the active tree and **closed 2026-08-20 at 36/36**, outcome state
> `narrowed`, with its Phase 4 recorded as a terminal honest null. Its Phase 1
> ("consumer-scoped rule projection") and Phase 1b ("the lever reaches actual
> consumer installs") both read **satisfied** — but satisfied as **opt-in**, not
> as a default flip. That distinction is what discharges 1.2 below; the stale
> counts are corrected here rather than left to mislead the next screen.

- [x] **1.1** Write the resumption evidence note into that roadmap's park block:
      the resume condition, the date it was satisfied, the artefact that satisfied
      it, and the fact that no resumption event followed. Move the file out of
      `later/` under its own disposition rules.
      `verify:` the file is in the active tree and the dashboard counts it.
      **DONE 2026-08-19 — in its own PR, as the prior screen's note asked for.**
      [`road-to-request-scoped-rule-load.md`](road-to-request-scoped-rule-load.md)
      is in the active tree with `status: ready`; the park block is kept verbatim
      and discharged by an appended note carrying all four required facts. The
      condition — *"Resume when P2.1 of `road-to-rule-delivery-integrity` closes"* —
      was satisfied **2026-08-08** by
      [`skill-catalogue-description-delivery.md`](../evidence/analysis/skill-catalogue-description-delivery.md)
      (parent roadmap archived 2026-08-09, `259039157`, which is what the
      machine-decidable probe reports FIRED on). **No resumption event followed for
      eleven days:** `git log` over the parked file since 2026-08-08 returns zero
      commits. Three consecutive screens logged the FIRED probe and each declined
      it — correctly, since Phase 4 is maintainer-owned; both its steps stay `[ ]`
      and stay council-parked. Two gate consequences, both handled here rather than
      left for the reader: the resumed file carries `estate_offset_exempt` (the
      ratchet gates `active_roadmaps` and `later_roadmaps` separately with no
      cross-metric offset, so without it an un-park is unrecordable and `later/`
      becomes a one-way door), and `lint_roadmap_family_cap` is unaffected — the
      file is a `road-to-request-*` singleton.
- [-] **1.2** (Owned by that roadmap, tracked here for the interlock only.) The
      machinery is built and tested; only the human gate is unpulled. Consumer
      installs default to workspace-derived scope, `legacy-all` becomes the
      explicit opt-out, and the install prints the delta warn-first for one release.
      **Cancelled AS A TRACKING LINE 2026-08-20 — and read the next sentence
      before reading that as a scope drop.** Cancelling this line does **not**
      cancel the default flip. The flip is *transferred*, and it now has two
      independent owners of record, neither of them this roadmap. (1) The owning
      roadmap **closed 2026-08-20** with its scoping machinery `satisfied` and
      shipped **opt-in**, so the half this line tracked as "built and tested" is
      done and the half it tracked as "unpulled" is no longer its to pull.
      (2) The council disposition `default-flip-release-gate` — **B,
      transferred** — moves "the shipped-default decision and merge action to the
      maintainer release gate", with the preferred choice recorded as *keep the
      current default and ship opt-in until the human benchmark passes*, and a
      re-entry probe: *"merged settings diff plus attached census, or a dated
      opt-in decision in the release record"*
      ([`drain-blocker-dispositions-a.md`](../evidence/council/drain-blocker-dispositions-a.md)).
      A shipped-default flip is also a Hard-Floor action under
      `non-destructive-by-default`, so it could never have closed here autonomously
      regardless of the disposition. There is no interlock left to carry: `[-]`
      records that this roadmap has nothing to do, not that nobody does.
- **AC-1:** the census on a scoped consumer install of the default pack set reports
  a materially lower standing total, measured with the exact-BPE path and recorded.

### Phase 2 — Shrink the structural payload without touching reach

The revert proved the nineteen must stay **unconditional**. It did not prove their
**bodies** must stay their current length.

- [ ] **2.1** Condense pass over the unconditional set only, prioritised by body
      size, with the routing matrix as the unchanged hard gate: reach is pinned,
      prose is not. The per-rule norm line from
      `road-to-cost-parity-1-rule-payload-diet` is the snapshot anchor — sequence
      condensation *after* that lint exists, so the obligation sentence is pinned
      before any prose shrinks.
      `verify:` routing matrix green; the diff contains zero `triggers:` edits,
      machine-checkable by byte-comparing every `triggers:` block.
      **NOT executed 2026-08-19 — its own sequencing condition is unmet, and this
      is a one-command check rather than a reading of intent.** The step says to
      sequence condensation *after* the per-rule norm lint exists, so the
      obligation sentence is pinned before any prose shrinks. That lint is
      `road-to-cost-parity-1-rule-payload-diet` step 3.1, still `[ ]`, and no
      `norm`-pinning script exists under `src/scripts/`. Condensing first would
      shrink prose with nothing holding the obligation — precisely the ordering
      this step was written to prevent.
      **Re-verified 2026-08-20 — precondition still unmet, checked three ways
      rather than re-read from the note above.** (1) `road-to-cost-parity-1-rule-payload-diet`
      steps 3.1 *and* 3.2 (the drift lint) are both still `[ ]`. (2) `src/scripts/`
      contains no script whose name matches `norm`. (3) The field does not exist
      where it would have to: `src/scripts/schemas/rule.schema.json` declares no
      `norm` property, and **zero** files in `src/rules/` carry a `norm:`
      frontmatter key. Stays `[ ]`.

  > **Prioritisation input — supplied 2026-08-17 by `road-to-rule-stub-projection`
  > Phase 0.** "Prioritised by body size" had no measurement; this is one, in
  > exact BPE, largest residue first. Full table with its per-rule criterion:
  > [`rule-stub-projection-phase0.md`](../evidence/analysis/rule-stub-projection-phase0.md).
  > **Regenerate rather than trust it** — a table written into another roadmap
  > ages with the corpus, and a stale prioritisation is worse than none because it
  > looks authoritative:
  > `./scripts-run src/scripts/check_rule_stub_ceiling --report`.
  >
  > Measured over the 44 rules that already declare their body migrated:
  > **17,383 residue tokens** against **7,463 floor**, out of 24,845 body tokens.
  > The top eight carry 10,469 of that residue — 60 % of it in 18 % of the rules:
  >
  > | rule | residue | floor |
  > |---|---:|---:|
  > | `context-hygiene` | 2229 | 218 |
  > | `design-fidelity` | 1662 | 583 |
  > | `autonomous-execution` | 1550 | 83 |
  > | `active-remediation` | 1309 | 293 |
  > | `ui-audit-gate` | 1171 | 108 |
  > | `architecture` | 873 | 82 |
  > | `roadmap-progress-sync` | 839 | 585 |
  > | `git-history-discipline` | 836 | 369 |
  >
  > Two bounds on reading it. The split is a **judgment with a mechanical
  > criterion**, published per rule so a row can be disputed without discarding
  > the total. And it covers only rules that ALREADY carry a migration pointer —
  > the unconditional set this step targets is wider, so this is a floor on the
  > available residue, never a ceiling.
  >
  > **A named prospect this table does NOT cover.**
  > `rule-body-migration-inventory.md` calls `legal-safety-floor` "already the
  > best existing exemplar of the P4 pattern applied within a safety floor" and a
  > template for six siblings that have not had it: `finance-safety-floor`,
  > `strategy-safety-floor`, `engineering-safety-floor`,
  > `domain-safety-disclaimer`, `domain-safety-pii`, `domain-safety-retention`.
  > None carries a migration pointer, so none appears above — the table's
  > population is rules that already declare a migration, which is a floor on the
  > available residue and not a survey of it.
  >
  > Moves made under 2.2 now land against **per-rule ceilings**
  > (`src/config/rule-stub-ceilings.json`, gated by `check_rule_stub_ceiling`), so
  > each move's effect is visible per rule instead of only in the aggregate
  > census. Re-anchor that baseline in the same commit as any move. 2.2 already
  > binds `preservation-guard`; nothing here restates its method.
- [ ] **2.2** Move long rationale and history sections out of rule bodies into
      linked context or guideline files, which load on demand rather than every
      session. The `preservation-guard` contract binds here: every passage moves,
      none is deleted, and Iron Law headings survive verbatim at their level.
      `verify:` the condensation gate is green and each moved passage is reachable
      from its rule by a link.
      **NOT executed 2026-08-19 — same sequencing as 2.1, for the same reason.**
      Moving rationale out of a rule body is a `preservation-guard` transform over
      the same corpus 2.1 condenses, and it shares 2.1's precondition: with no
      norm-line pinned, "which passage is the obligation" is a judgement per rule
      rather than a checkable field, and `preservation-guard`'s every-passage-stays
      rule cannot distinguish a legitimate move from a quiet softening. Sequence
      it behind 2.1, not beside it.
      **Re-verified 2026-08-20 alongside 2.1 — same three checks, same verdict.**
      Stays `[ ]`.
- **AC-2:** the unconditional-corpus token count falls against the committed
  census bucket; routing matrix green; zero trigger edits in the diff.

### Phase 3 — Give rules a runtime carrier, or retire the dead triggers

> **Fork option (a) as originally drafted is dropped.** A `rule-route` hook
> sibling collides with the recorded rule-delivery-integrity non-goal ("no hook
> that matches keywords and injects rule bodies; `intent:` was retired on exactly
> that finding") and duplicates `later/road-to-deferred-rule-retriever`, which owns
> the runtime-carrier question behind the registered `rules_efficiency` gate and a
> pre-registered comparison against the shipped lexical core. The fork below is
> restated accordingly.

- [ ] **3.0** Register the `InstructionsLoaded` observer first. The host fires that
      event per loaded `CLAUDE.md` / `.claude/rules/*.md` with a load-reason
      matcher, which turns "rules carried" from an emitter simulation into a
      per-session ground-truth count — exactly the demand-signal datum the
      retriever's own gate reads. Decide the fork *after* the observer has data.
      `verify:` the observer records a load event with its reason on this tree.
      **NOT executed 2026-08-19, and the reason is a refuted premise rather than
      effort.** This step reads "the host fires that event" as given. Nothing in
      this tree establishes it: `InstructionsLoaded` appears in no
      `EVENT_VOCABULARY` (`dispatch_hook.ts:99-110`, ten events, not this one),
      in no `native_event_aliases` row for any platform, and
      `check_standing_rule_delivery.instructionsLoadedRecord`'s own docblock calls
      it "a host feature this suite does not yet bind" while returning a path that
      is *expected* not to exist. So "register the observer" is not a binding task
      today — it is first a host-capability question, and binding an event whose
      existence was never confirmed is designing against an assumption, which
      `source-discovery-gate` forbids by name.
      **What would close it:** one recorded observation that the installed host
      emits the event (version-stamped, like the `subagent_start`/`subagent_stop`
      evidence that justified those two rows), *then* the vocabulary + alias +
      platform-row change, *then* the concern. Until the first exists the rest is
      speculative wiring.
      **Re-verified 2026-08-20, and PRESERVED per the council disposition.**
      `EVENT_VOCABULARY` in `src/scripts/hooks/dispatch_hook.ts` still lists ten
      events and `InstructionsLoaded` is not among them; the only mentions of the
      name in `src/` are `check_standing_rule_delivery.ts` and `routing_doctor.ts`,
      both of which document it as *unbound* and print a filesystem-projection
      caveat in its absence. The disposition's instruction to "preserve Step 3.0's
      observer" is discharged by leaving this step and its analysis intact —
      nothing here is deleted or downgraded. Stays `[ ]`.
      **Consequence for the blocker below:** its Recommendation says to land this
      observer first and re-date the fork against it. That recommendation is not
      actionable as written, so the fork stays open on a *different* ground than
      the one recorded there — see the correction in the blocker itself.
- [~] **3.1** Fork, stated so it cannot be half-done. **(a)** Execute
      `later/road-to-deferred-rule-retriever` when its `rules_efficiency` gate
      converts, lexical-core comparison first, per its own text. **(b)** If the
      demand signal never materialises on a sustained basis, record the null and
      **delete the trigger frontmatter from rules instead** — a compile-time field
      nothing consumes is documentation pretending to be mechanism. Blocked on
      `b-rules-efficiency-signal`.
      <!-- decision 2026-08-20: council disposition C (outcome `narrowed`) applied
      from agents/evidence/council/drain-blocker-dispositions-a.md:138-140 —
      "Record the current rules_efficiency window as unfilled, preserve Step 3.0's
      observer, and re-date the fork to 2026-09-17; do not start the retriever
      before the registered lexical-index comparison." All four instructions are
      applied: the window is recorded unfilled (blocker entry below), step 3.0 is
      preserved verbatim and still [ ], the fork is re-dated to 2026-09-17, and no
      retriever work starts — the pre-registered comparison against
      src/scripts/_lib/lexical_index.ts remains the first deliverable of
      later/road-to-deferred-rule-retriever.

      PREMISE CHECK ON THE RESOLUTION CLAUSE — HOLDS. The clause reads: "the
      metric reads against its bar and the fork resolves to (a) or (b), OR the
      window is recorded as unfilled with a new date." The second arm licenses
      exactly this recording, so this is not a null the instrument was never
      allowed to return.

      EMITTER CHECK — AND IT CORRECTS THE DISPOSITION'S GROUND. The disposition's
      Rationale calls the emptiness a "measured absence". It is not: it is an
      ABSENT PRODUCER. Four checks, all re-run 2026-08-20 on this tree:
        1. The instrument declines to read it as a value. dispatch_economy_report
           prints "envelopes with pair=0 · median quota=— · low-quota signal
           (< 0.2): no data" — "no data", never "0.00". The registered threshold
           is a median "below 0.2"; a median of nothing cannot be below 0.2, so
           the clause's FIRST arm is unsatisfiABLE, not merely unsatisfied.
        2. The schema itself calls null a non-measurement. Both rows in
           src/agent-src/contexts/execution/orchestration-telemetry.md:67-68 read
           "`null` = not measured". So the nulls are non-measurements, not
           measurements of zero.
        3. The automatic producer cannot ever populate the pair. The concern that
           fires per dispatch, src/scripts/hooks/orchestration_record_hook.ts,
           contains ZERO occurrences of `rules_carried` or `rules_used` in any
           branch of buildRecordInput. Tree-wide, the only assignment sites are
           the manual CLI reading argv (src/scripts/orchestration_record.ts:146)
           and the builder's `?? null` default
           (src/scripts/_lib/orchestration_record.ts:370).
        4. Nothing ever passes the flags. The only hits for `--rules-carried`
           outside its own definition are a usage docblock and an archived
           roadmap noting the flag exists.
      THE DISCRIMINATOR: dispatch activity was abundant. The audit log holds 579
      orchestration lines for 2026-08, and `rules_carried` is null on 579 of 579
      with zero numeric values. Had the emptiness been "nothing happened" there
      would be no lines, or lines carrying the pair with a low reading. A full
      month of dispatches with the field absent on every one is a fact about the
      CODE, not about the sessions.
      CONSEQUENCE, recorded rather than silently absorbed: by the council's own
      framework rule 4 ("instrument broken -> B"), this is a TRANSFER, not a
      measured null. The recording half of C is still correct and still applied,
      because the clause licenses it and the window genuinely is unfilled. What
      changes is the trajectory: waiting cannot fill this window, so the
      2026-09-17 date is a checkpoint re-date and NOT a prediction that data will
      arrive. The fork's real gate is a producer for the pair — see the blocker's
      Correction B and its re-entry probe. -->
- **AC-3:** either (a) ships behind the registered gate with a pre-registered
  adoption metric, or (b) a dated null closes the fork. No third state.

### Phase 4 — Per-turn injection aggregate

- [x] **4.1** Add an aggregate row to `hook-token-budget.json`: the sum of all
      concern emissions per session-turn, capped outside `session_start`, with the
      dispatcher enforcing by dropping lowest-severity advisories first and
      recording each drop in dispatch issues. The cap exempts `severity: blocking`
      and fail-closed concerns by construction, so the policy can never hide a
      safety-relevant warning.
      `verify:` the injection bench reports the aggregate; a fixture exceeding the
      cap drops the right advisory and records it.
      **Landed 2026-08-19.** `per_turn_aggregate_bytes` in
      `src/config/hook-token-budget.json`; `bench_hook_injection.perTurnAggregate`
      derives and prints it on **every** run from the same `slotSums` the
      per-slot rows come from, so the local reading and the CI gate run are the
      same number. Runtime enforcement is
      `src/scripts/hooks/injection_budget.shapeEmissions`, wired into
      `dispatch_hook` between reduction and `emitFor`.
      **The ceiling is DERIVED, not a new number:** 47,104 B is
      `4096 + (2048 + 2048) × 10 + 2048`, i.e. the arithmetic consequence of the
      per-slot rows already registered above it. A tighter per-turn ceiling would
      contradict per-slot decisions that are already committed; a looser one would
      let the composition exceed what every part was capped at.
      `tests/scripts/bench_hook_injection_aggregate.test.ts` asserts that
      derivation against the live config, so the two cannot drift.
      **`gate_on_ceiling: false`, and the reason is a measurement, not caution.**
      Under the committed fixtures a turn injects 1,140 B against a 47,104 B
      ceiling — the row sits roughly forty times above the only reading that
      exists, and arming an inequality nobody has approached would gate on
      nothing. The flag governs **CI only**; runtime shaping is always on.
      **Two findings this step produced and did not fix.** (a) The bench reading
      MOVES between runs — 922 B and 1,140 B minutes apart — because the
      stop-slot `end-review-nudge` is session-state-conditional and replay skips
      its writes but not its reads. That is a pre-existing bench
      non-determinism this row surfaces rather than introduces, and it is one
      more reason the ceiling is unarmed. (b) A `nudge_rank` tie between two
      concerns is a manifest defect that nothing detects; `lint_hook_manifest`
      is where it belongs and the check does not exist. Both are noted at the
      code, not silently carried.
      `verify:` `./scripts-run src/scripts/bench_hook_injection` ·
      `npx vitest run tests/scripts/hooks/injection_budget.test.ts tests/scripts/bench_hook_injection_aggregate.test.ts tests/hooks/injection_budget_dispatch.test.ts`
- [x] **4.2** Interference fixture: one routing-matrix-style corpus file asserting
      that for each prompt class at most one nudge fires. The delegation-nudge and
      skill-route overlap is the first known pair to pin.
      `verify:` the fixture is green and fails when a second nudge is forced.
      **Landed 2026-08-19.** `tests/eval/nudge-interference/prompts.yaml` +
      `tests/scripts/nudge_interference.test.ts`, same shape as
      `tests/eval/orchestration-matrix/`: positives AND pinned near-misses,
      executed against the real `classifyPrompt` / `routePointers` predicates
      with the ranks read live from the manifest.
      **The overlap was MEASURED before the policy was written, so this file
      pins a fact rather than a hypothesis.** The prompt "Use when starting
      parallel work in isolation from the current branch — spawn a git worktree
      with ignore-safety checks and a clean test baseline for src/a.ts, src/b.ts,
      src/c.ts and src/d.ts, each independently" fires **both** carriers: its
      first clause is `using-git-worktrees`' own description (ranker top-1 58,
      over skill-route's 31/100 floor) and its trailing clause carries four file
      tokens (over delegation-nudge's `FILE_SIGNAL_FLOOR` of 3). Four near-miss
      rows pin the classes that must fire exactly one carrier, or none.
      **Each row pins TWO expectations on purpose** — the pre-policy fire set
      *and* the post-shaping emission. A trigger change that shrinks the overlap
      then reads as a corpus failure instead of being silently absorbed by the
      fix that hides it.
      **The precedence is a decision and is stated as one:** delegation-nudge
      outranks skill-route because the delegation verdict changes the *shape* of
      the work while a skill pointer is a hint, and the suppressed pointer has a
      first-class recovery path the suppressed verdict would not —
      `suggest_skill_for_task` ranks the same catalogue on demand. Losing the
      pointer costs one tool call; losing the verdict costs the plan. It lives in
      the manifest as `nudge_rank`, so changing it is a reviewable one-line diff
      rather than an edit to a hardcoded pair.
      **A test-fixture trap worth carrying:** the first version of the
      end-to-end fixture wrote a folded multi-line `description:` into its
      `SKILL.md`. The catalogue loader reads that as its first line only, which
      halved the ranker's score, and the co-fire the test exists to reproduce
      never fired — a green-looking fixture over the wrong measurement. The
      description must be ONE physical line.
      `verify:` `npx vitest run tests/scripts/nudge_interference.test.ts`
- **AC-4:** the aggregate appears in the bench output and the overlap fixture is
  green. **Met 2026-08-19** — the bench prints its own
  `per-turn aggregate … B (ceiling 47104 B, reported, not gated)` line, and the
  overlap fixture is green; 50 tests across four files, including the end-to-end
  proof that the shaping is *wired* and not merely defined.
  <!-- The byte figure this note used to quote (1140 B) was removed 2026-08-19.
  `end-review-nudge` decides whether to fire from the LIVE working-tree diff plus
  a once-per-session latch, so the reading is a property of the checkout at the
  moment of the run: the same commit gives 1140 B with uncommitted changes present
  and 922 B without them. What AC-4 actually asks is that the line EXISTS and the
  fixture is green, and both are stable; the ceiling itself lives in the config
  row. Found while hardening this phase, and `bench_hook_injection`'s header
  carries the same correction — it was the file claiming the fixture path is
  "deterministic, CI-reproducible". Leaving the figure here while that header
  said no reading may be pinned as acceptance evidence was a contradiction an R2
  review caught within this branch. -->

## Blockers

### blocker: b-rules-efficiency-signal
- **Status:** open
- **Owner:** maintainer
- **Class:** 2 — consent-once (wait for the observer, or record the window unfilled and re-date)
- **Blocks:** Phase 3 step 3.1 only. Step 3.0's observer is repo work and proceeds
  without it.
- **What to do:** the fork needs the registered `rules_efficiency` metric in
  `dispatch-economy-metrics.json` to have accumulated enough sessions to read
  against its low-quota bar. Either wait for the observer from step 3.0 to fill
  it, or record here that the window is unfilled and re-date the fork — which is
  itself progress, per the same discipline the telemetry-count gates use. Do not
  build a retriever before the comparison against `src/scripts/_lib/lexical_index.ts`
  that `later/road-to-deferred-rule-retriever` pre-registered.
- **Correction A, 2026-08-19:** the Recommendation below is **not actionable as
  written**, and the reason is checkable rather than a judgement — step 3.0's
  observer cannot be landed today because `InstructionsLoaded` is in no event
  vocabulary and no alias table in this tree, and the one module that names it
  documents it as unbound (evidence at step 3.0). The Recommendation is kept
  verbatim below rather than rewritten, because *what it wanted* is still right —
  a ground-truth count before deciding the fork — and only its stated route is
  unavailable. The fork therefore stays open on the missing HOST CAPABILITY, not
  on an unfilled metric window.
- **Recommendation:** **land step 3.0's observer first and re-date this blocker
  against it.** The fork cannot be decided today in either direction: option (a)
  needs a demand signal that does not exist, and option (b) would delete trigger
  frontmatter on the *absence* of a measurement rather than on a measured null —
  which is the unbacked-claim failure this repo gates against. The observer converts
  the metric from an emitter simulation into a per-session ground truth, and it is
  repo work needing no decision.
- **If you do nothing:** roughly a hundred `type: auto` rules keep carrying
  `triggers:` blocks that no runtime consumer reads on this host — documentation
  presenting itself as mechanism — and the fork stays open indefinitely, which is
  the third state AC-3 explicitly forbids.
- **Correction B, 2026-08-20 — the window is unfilled because NOTHING PRODUCES
  THE FIELD, not because no sessions occurred.** Kept alongside Correction A
  rather than replacing it: A found step 3.0's named filler unavailable, B finds
  that no *other* filler exists either, so the two together are why this cannot
  converge by waiting. Evidence, all re-run today and cited at step 3.1's
  `decision 2026-08-20:` comment: `dispatch_economy_report` prints **`no data`**
  for `rules_efficiency`, never `0.00`; the telemetry contract states `null` =
  *not measured* for both fields; `orchestration_record_hook.ts` — the concern
  that fires per dispatch — contains **zero** occurrences of either field name in
  any branch; and the audit log holds **579 orchestration lines for 2026-08 with
  `rules_carried` null on 579 of 579, zero numeric**. Abundant dispatch with the
  field absent on every line is a property of the code, not of the sessions.
  **By the disposition framework's own rule 4 ("instrument broken → `B`") this is
  a TRANSFER, not a measured null**, and it is recorded as one here even though
  the recorded disposition was `C`. The recording half of `C` still stands and is
  still applied: the clause licenses it and the window genuinely is unfilled.
- **Recorded resolution 2026-08-20 (checkpoint only — this blocker stays OPEN).**
  Council disposition `C`, outcome `narrowed`, from
  [`drain-blocker-dispositions-a.md`](../evidence/council/drain-blocker-dispositions-a.md).
  The `rules_efficiency` window is hereby recorded **unfilled**: 0 envelopes
  carrying the pair, median quota unreadable, low-quota bar (< 0.2) not evaluable.
  Step 3.0's observer is **preserved** (still `[ ]`, premise unchanged). The fork
  is **re-dated to 2026-09-17**. No retriever work starts before the
  pre-registered comparison against `src/scripts/_lib/lexical_index.ts`.
  **The new date is a checkpoint, not a forecast** — per Correction B nothing in
  the tree will fill this window by 2026-09-17 or any later date without a
  producer, so a bare re-date on that day would be the parking-lot failure the
  framework's rule 1 names. No metric file was edited and no line was appended to
  fill the window; the emptiness is reported as found.
- **Re-entry producer + probe (the transfer half, per framework rule 6).**
  Producer: whatever first writes a numeric `rules_carried`/`rules_used` pair —
  either the worker thin projection of `road-to-token-economy-dispatch` Phase 3
  (whose own `projection_quality.status` still reads
  `armed-awaiting-projection`), or an explicit extension of
  `orchestration_record_hook.buildRecordInput` to emit the pair. Probe, one
  command and mechanically decidable: `./scripts-run
  src/scripts/dispatch_economy_report` reports `envelopes with pair` **> 0** for
  `rules_efficiency`. Until that reads non-zero, neither fork arm has evidence:
  (a) has no demand signal, and (b) would delete trigger frontmatter on an
  absence-of-measurement rather than a measured null — the unbacked-claim failure
  this repository gates against.
- **Resolved when:** the metric reads against its bar and the fork resolves to (a)
  or (b), or the window is recorded as unfilled with a new date.

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-08-17 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Condensing bodies weakens obligations subtly | product | A shorter rule can read the same and bind less; the estate's whole value is that the governed text stays true | The routing matrix pins reach, `preservation-guard` forbids deleting a passage, and the per-rule norm line is snapshot-tested byte-identical through the condensation | Phase 2 — Shrink the structural payload |
| 2 | Scoped consumer default breaks a consumer relying on a rule outside their packs | product | Scoping ships fewer rules, so an obligation someone depended on can vanish from their install without a message | Warn-first release with the printed delta, and `legacy-all` stays supported as the explicit opt-out | Phase 1 — Pull the lever that already exists |
| 3 | The suppression in Phase 0 removes a layer someone actually loads from | implementation | `claudeMdExcludes` silences a layer; silencing the wrong one leaves a machine under-governed rather than merely lighter | The installer gate exits non-zero on undeclared overlap and never deletes; the suppression is one reversible settings entry, and the reading is repeated after | Phase 0 — Rule out the double-delivery layer |
| 4 | The 40k destination turns out to be unreachable and the ratchet becomes theatre | product | If the CLAUDE.md hierarchy bucket rather than the rule corpus is the dominant term, every phase here can succeed while the destination stays out of reach | The honest-null consequence below names the public re-examination, and the census already reports the per-bucket split so the dominant term is a fact rather than a guess | Honest-null consequence |
| 5 | The advisory-drop policy in Phase 4 hides a safety-relevant warning | product | An aggregate cap that drops by severity could drop something that needed to be seen | The cap exempts `severity: blocking` and fail-closed concerns by construction, and every drop is recorded in dispatch issues rather than being silent | Phase 4 — Per-turn injection aggregate |
| 6 | Deleting trigger frontmatter in fork (b) destroys future routing capability | implementation | The triggers are dead *at runtime on this host*, not meaningless — another host or a future carrier could consume them | Fork (b) fires only on a sustained measured null, the deletion is one commit against a tracked tree, and the observer from 3.0 is the instrument that makes the null a measurement rather than an assumption | Phase 3 |

## CUT list — do not re-litigate

- **Re-scoping the nineteen refuted rules via `paths:` as the earlier pass did.**
  Refuted 4/4 by the matrix (`3b06e61`). The re-adjudication path with a
  semantics amendment is owned by `road-to-mixed-trigger-activation-cost`. Cut.
- **Raising the ratchet baseline to clear the red gate.** The repo names this the
  config-weakening move it blocks by construction. Cut.
- **A blind sweep of the uncondensed intermediate tree.** Already rejected — it is
  a live generated intermediate, not dead debt. Cut.
- **Re-testing "our projection is missing skill descriptions".** Refuted: 414 of
  414 installed skills carry a description on disk, and the loss is host-side. Cut.
- **A second retriever design.** `later/road-to-deferred-rule-retriever` owns it.
  Cut.
- **Per-model-band rule sets.** No evidence yet connects a model band to rule
  need; it would be additive push rather than harvest. Cut until a measured demand
  signal exists.

## Honest-null consequence

If Phases 1 and 2 together do not move the census materially, the 40k destination
is re-examined **in public**: either the `CLAUDE.md` hierarchy bucket is the true
dominant term — and the census already names the split — and gets its own
roadmap, or the destination is re-registered with the measurement that justifies
the change. Never silently.
