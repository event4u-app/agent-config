---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
relates:
  - slug: road-to-governed-harness-evolution
    relation: extends
    note: >
      The parent this roadmap was split out of on 2026-08-31. It keeps Phases
      1-6 and every acceptance criterion except AC-9; this file owns the
      promotion bridge, step 0.8, AC-9 and the merge-authority blocker. The
      parent marks the transferred items `[-] MERGED` and points here.
estate_offset_exempt: "Adds one active roadmap with NO offsetting disposal, and none is available. AI council 2026-08-31 (anthropic/claude-sonnet-4-5 + openai/codex-default, 2/2 convergent) ruled Option 3 on the Phase 7 disposition: split at the phase boundary into a NEW ACTIVE roadmap. Both seats explicitly REJECTED parking it in agents/roadmaps/later/ on the ground that later/ is excluded from the dashboard and from /roadmap:process-*, so it does not preserve active-estate membership — which is the exact property the preservation test of roadmap-progress-sync Iron Law 3 requires. The parent cannot archive as the offset: Phases 4, 5 and 6 still carry open steps, and archiving it would be the silent drop the verdict exists to prevent. Parking either file is the disposition the council refused. So the addition is unoffsettable by construction, and the reason is a recorded verdict rather than an authoring preference."
estate_growth_exempt: "Covers the growth half the offset half does not: active_roadmaps 3 -> 4 against an exact floor of 3 with zero headroom. The growth creates NO new work — every step, criterion and blocker in this file is transferred verbatim out of road-to-governed-harness-evolution, which sheds exactly what this file gains, and open_blockers is unchanged at 31 because blocker: merge-authority moves rather than multiplies. What grows is the file count alone, and it grows because the AI council of 2026-08-31 (anthropic + openai, 2/2 convergent) ruled that Phase 7 must remain inside the mechanically governed active estate while its owner-reserved gate is open. The alternative the ratchet would otherwise force — hold the work in a parent that cannot archive, or park it where the dashboard cannot see it — is the disposition both seats rejected by name."
---
# Road to harness promotion bridge

> **Split out of `road-to-governed-harness-evolution.md` on 2026-08-31, on a
> recorded AI-council verdict — 2/2 convergent, anthropic/claude-sonnet-4-5 +
> openai/codex-default, Option 3.** The question was what to do with a Phase 7
> that is fully specified and cannot be entered, because it is gated on the
> OPEN, owner-reserved `blocker: merge-authority` (ADR-239 § Decision 3) while
> Phases 4-6 of the parent still carry executable work.
>
> **Both seats rejected `agents/roadmaps/later/` by name.** `later/` is excluded
> from the dashboard and from `/roadmap:process-*`, so parking there does not
> preserve active-estate membership — and preservation is precisely what
> `roadmap-progress-sync` Iron Law 3 tests before a deferred item may be
> resolved by anything other than the owner. This file is therefore **ACTIVE**,
> blocked, and visible to every estate mechanism, which is the whole point of
> the split.
>
> **`[-] MERGED` in the parent means TRANSFERRED, never cancelled and never
> satisfied.** Both seats warned that a later reader must not read the parent's
> `[-]` marks as completion or as a decision to drop the work. Nothing here is
> met; nothing here has been weakened. The carrier moved and the obligation did
> not.
>
> **Transferred verbatim:** Phase 7 steps 7.1-7.7 with their prose and their
> `verify:` lines, step 0.8, AC-9, the `merge-authority` blocker entry whole,
> and the Phase 0 carried condition on mechanical non-promotion. The only
> non-verbatim edits are recorded where they occur.

## Goal

The promotion bridge of `road-to-governed-harness-evolution` is executed: a
candidate that has passed evaluation can be promoted into canonical
`agent-config` through one evidence package, one existing governance
vocabulary, a scope ladder with a transfer gate, a no-op rejection, a canary
rollout, a post-promotion lifecycle that can retire what it promoted, and a
best-known-state rollback on regression. When this is finished, AC-9 closes:
at least one promoted artefact has been through post-promotion re-evaluation
and at least one RETIRE path has been exercised.

None of it may start while the gate below is open.

## Resume condition

> **Resume when:** ADR-239 § Decision 3 is settled by the owner in a way that
> grants the merge authority required to execute Phase 7. If the owner refuses
> or otherwise does not grant that authority, do not resume execution and do
> not weaken, cancel, retire, or mark complete any transferred step or
> acceptance criterion; route the receiver's disposition to the owner.

> **Revisit-if:** ADR-239 § Decision 3 is settled, or any change proposes or
> creates a promotion path before this roadmap resumes. In the latter case, the
> `merge-authority` blocker and the carried mechanical non-promotion condition
> bind to that earlier change.

Both paragraphs are the exact text both council seats converged on. They are
reproduced without edit because the difference between them and the wording an
earlier round proposed is load-bearing: the earlier version pre-authorised
converting AC-9 to "specified but not exercised" on owner refusal, which is a
weakening, and `roadmap-progress-sync` Iron Law 3 reserves that to the owner.

## Carried blocking condition

> **Carried blocking condition:** Before or in the first commit that creates any
> promotion path — including the lifecycle `promoted` transition or the
> promotion verb set — mechanically enforce the non-promotion boundary. A check
> over a population of zero does not discharge this condition.

**This condition BLOCKS, it does not merely sit here.** Every step in Phase 7
below creates or extends a promotion path by construction, so no step in this
roadmap may be marked `[x]` while the condition is undischarged, independently
of whether `blocker: merge-authority` has closed. The two gates are separate:
the blocker asks *who may promote*, the condition asks *what mechanically
prevents promotion until they do*. Settling one does not settle the other.

**An observation, recorded and deliberately NOT adjudicated.** The parent's
steps 3.4 (candidate lifecycle enum) and 3.6 (operator verb set) closed `[x]`
before this split, and `src/scripts/evolution_lab.ts:858-888` now carries a
`promote` verb that returns `EXIT_REFUSED` unconditionally, printing the
lifecycle gate's own message plus the `merge-authority` blocker. That is a
population that is no longer zero and a refusal that is mechanical rather than
stated. Whether it DISCHARGES the condition is a judgement the 2026-08-31
verdict does not make and this transfer does not make either — it is routed by
the `Revisit-if` paragraph above, which binds the condition to the earlier
change that created the path. Recorded here so the next reader inherits the
fact rather than rediscovering it, and so that no one reads the condition as
already satisfied.

The condition's verbatim origin block, carried out of the parent's Phase 0 on
2026-08-30 and transferred here on 2026-08-31, is reproduced under
§ Provenance below.

## Phase 0 — Merge authority (carried from the parent)

- [~] **0.8 Merge authority resolved.** Deferred: owner decision, see Blockers. <!-- blocked-by: merge-authority -->

**Transferred from `road-to-governed-harness-evolution` Phase 0 on 2026-08-31,
still `[~]`, still deferred, still owned by the maintainer.** The words are
verbatim; the only change is a REFLOW — in the parent the step wrapped across
two lines and the `<!-- blocked-by: merge-authority -->` annotation therefore
sat on a continuation line, where `lint_roadmap_blockers`' cross-reference rule
(`BLOCKED_BY_LINE_RE`, which matches only a real `- [ ]` checkbox line) could
not see it. Here it sits on the checkbox line, so the reference to the blocker
below is live and machine-checked instead of merely written. No word was added,
removed or reordered.

## Phase 7 — Promotion bridge and the lifecycle after it

> **Every step below is gated twice and may not be entered on either gate
> alone.** (1) `blocker: merge-authority` is OPEN and owner-reserved — see
> § Blockers. (2) The carried blocking condition above binds to the first
> commit that creates any promotion path, which every step here does by
> construction. The steps, their prose and their `verify:` lines are transferred
> **verbatim** from `road-to-governed-harness-evolution` Phase 7 on 2026-08-31;
> nothing in them was rewritten, re-scoped or re-verified in the move.

- [ ] **7.1 One evidence package per promotion, in the fuller form.** The master
      adopted a 9-field package; the skipped parent's has 14, and the five extra
      are exactly the fields that make 3.2, 4.4 and 7.3 auditable: pathology
      cell, candidate lineage, mutation dimension, selection results, sealed
      result, cost, scope.
      verify: a promotion attempt with any field absent is refused.
- [ ] **7.2 Route through the existing gate, not a second governance system.**
      Reuse the evidence-grading vocabulary already in the tree
      (`authority_basis`, `evidence.strength`, `reopen_policy`,
      `protected_dimensions`).
      verify: no new governance verb, no new approval path.
- [ ] **7.3 Promote by scope, with a transfer gate.** `from-skipped-parent`,
      raised to doctrine level in both parents and absent from the master's
      promotion path: a candidate carries a scope (episode → repo → stack →
      profile/pack → global) and moving up a level requires independent transfer
      evidence from a second solver or host configuration. Without it, every
      promotion goes straight to canonical and the anti-bloat doctrine has no
      teeth. This is not what the parked curriculum generator was.
      verify: a promotion with no scope field is refused, and a scope raise with
      one configuration's evidence is refused.
- [ ] **7.4 Reject semantic no-ops.** A no-op detector plus a minimum
      material-improvement threshold. The master kept the cooldown and lineage
      from the same attack and dropped both gates.
      **Marker corrected 2026-08-26:** this step carried
      `from-skipped-parent`, and it should not have. The clause is at
      `road-to-evidence-driven-harness-evolution.md:1200-1201` — a **declared**
      parent — and the skipped parent contains no no-op gate at all (its only
      paraphrase mention, `:1342` "Avoid five paraphrases", is about candidate
      diversity at generation time, which is a different mechanism). So the
      master dropped this having read it, not having missed it. That is the
      second misattributed marker found in this pair; see
      `agents/evidence/analysis/skipped-parent-lineage-2026-08-26.md`
      § Marker reliability.
      verify: a paraphrase-only candidate is refused before the cascade.
- [ ] **7.5 Roll out by canary, never silently.** `from-skipped-parent`: opt-in
      candidate bundles.
      verify: no promotion changes a shipped default without an opt-in stage.
- [ ] **7.6 A promoted artefact is not immortal.** `from-skipped-parent`, and
      it is the only anti-monotonic-growth mechanism *after* the gate — the
      `artifact-count delta` row guards the gate, the estate needs its own:
      post-promotion re-evaluation with `KEEP / REVISE / MERGE / SPLIT /
      RETIRE`. The master's promotion phase ends at the evidence package plus a
      cooldown, so nothing reopens a promoted artefact and the lifecycle is
      manual-only at exactly the point where growth accumulates.
      verify: a promoted artefact reaching its review trigger produces one of the
      five verdicts, and at least one `RETIRE` path is exercised in a fixture.
- [ ] **7.7 Best-known-state reference on regression.** Roll back to the
      recorded best-known state; lineage, not endless append.
      verify: an injected regression triggers the rollback path in a fixture.

## Blockers

> **Moved whole from `road-to-governed-harness-evolution` on 2026-08-31.** The
> entry below is transferred verbatim, including its 2026-08-29 scoping note,
> its 2026-08-30 field-shape repair and its `Resolved when` amendment. It is
> removed from the parent in the same change, so the blocker has exactly one
> live owner and `open_blockers` is unchanged across the split.

### blocker: merge-authority

- **Status:** open — **SCOPED 2026-08-29, and it is divisible in the same shape
  as `b-adr-088` on `road-to-capability-native-execution`. Option (c) is taken
  and is council-decidable; options (a) and (b) are OWNER-RESERVED and were not
  taken.** AI council 2026-08-29, anthropic + openai, **2/2 convergent**.

  **Taken, council-decidable — the scoping half.** Phases 1–6 are declared legal
  while ADR-239 § Decision 3 remains open. They build measurement and isolation
  and promote nothing, so where merge authority lands does not touch them. Phase
  7 stays gated on this blocker.

  **Not taken, owner-reserved.** (a) **granting** preauthorized merge authority
  weakens a human-in-the-loop promotion guarantee — the shape
  `non-destructive-by-default` protects — and (b) refusing it settles an ADR §
  Decision that is recorded as open. Either is a resolution of ADR-239 itself,
  which a council may recommend and may not perform.

  **The condition that makes (c) real rather than a promise, and it is an
  addition to what the blocker proposed:** the non-promotion property of Phases
  1–6 must be **mechanically enforced**, not merely stated. A phase that
  promises to promote nothing while nothing prevents it from promoting is the
  same class of guarantee ADR-239 § Decision 3 is open about. Carried into Phase
  0's exit criteria rather than left here.

  **FOUND UNCARRIED 2026-08-30, and carried now.** The sentence above said the
  condition was carried into Phase 0's exit criteria. It was not: a tree-wide
  grep for `mechanically enforced` / `non-promotion` over this roadmap returned
  only these lines, inside this blocker. The condition existed exactly where the
  paragraph said it should not be left.

  This is the **third instance in this cohort of the same defect shape** — a
  criterion with no phase, no step and no owner, which Risk 11 names for AC-8
  and which the `Resolved when` twin above records for `b-adr-088`. It is
  recorded as a pattern rather than a slip because that is now three.

  The condition is carried as a Phase 0 exit-criterion note (see the
  **CARRIED CONDITION** block at the head of Phase 0), which is where the
  council put it. It is carried **unmet**, with the reason it cannot be
  discharged today stated there rather than being quietly satisfied by a check
  that would scan nothing.

  **The `Resolved when` field below was AMENDED 2026-08-29, and the amendment
  now lives inside the field's value rather than in a heading above it.** The
  original — *"ADR-239 § Decision 3 no longer reads as an open question and its
  `review_trigger` no longer names the `merge-authority` blocker"* — is
  **unsatisfiable by option (c) and by any council**, because (c) leaves §
  Decision 3 open by construction. It bundled two things one authority cannot
  discharge, exactly as `b-adr-088` did.

  **Why the fix is a field edit and not a paragraph, 2026-08-30.** The 2026-08-29
  amendment was written as prose here and left the original `- **Resolved
  when:**` field standing three fields below, still stating the unsatisfiable
  condition — two contradictory closure conditions on one blocker, with
  `lint_roadmap_blockers` green throughout. This is the **same defect, in a
  second roadmap**: `road-to-capability-native-execution`'s
  `b-adr-088-external-runtime-federation` carried an identical stale twin, found
  and fixed on 2026-08-29, and its own note predicted the recurrence by naming
  the mechanism. The gate matches a literal label
  (`/^-[ \t]*\*\*Resolved when:\*\*/im`, `src/scripts/lint_roadmap_blockers.ts:52`),
  so a heading that says *"Resolved when (AMENDED …)"* satisfies nothing and the
  contradictory line was the only thing keeping the blocker legal.

  **Searched rather than assumed:** a tree-wide grep for `Resolved when` outside
  the literal `- **Resolved when:**` field across `agents/roadmaps/**` returns
  these two blockers and no third. Both are now fixed the same way — rename the
  amended field to the literal label first, delete the stale one second, because
  the other order turns the gate red in between.
- **`revisit-if`:** ADR-239 § Decision 3 is settled, or a Phase 1–6 step is
  proposed that would promote anything — in which case the scoping decision above
  no longer covers it and this blocker binds earlier than Phase 7.
- **Owner:** maintainer
- **Blocks:** Phase 0 step 0.8, and by consequence every promotion step in
  Phase 7.
- **What to do:** pick exactly one — (a) resolve ADR-239 § Decision 3 by
  granting preauthorized merge authority with its scope written into that
  record, or (b) resolve it by refusing preauthorized merge authority, making
  "only humans promote" a property rather than an intention, or (c) declare
  Phases 1–6 legal while it is unresolved and gate only Phase 7 on it — the
  cheapest option and the one this roadmap is cut for. Read
  `docs/decisions/ADR-239-drain-command-surface-and-merge-authority.md:79-81`
  and its decision table at `:188`.
- **Resolved when:** *(AMENDED 2026-08-29 — the marker sits inside the value on
  purpose; see the note above this field.)* the Phases 1–6 scope decision is
  recorded above and needs nothing further. This blocker closes when the
  **owner** settles ADR-239 § Decision 3 in either direction, at which point
  Phase 7 becomes enterable or is redesigned.
- **Recommendation:** (c). Phases 1–6 build measurement and isolation and
  promote nothing, so they are unaffected by where merge authority lands; (a)
  and (b) are owner-reserved and should not be forced by a plan that merely
  wants to start.
- **If you do nothing:** Phases 1–6 remain executable and Phase 7 cannot be
  entered, because the guardrail it rests on is documented in this tree as
  undecided. All three source proposals asserted that guardrail as a fact;
  verified 2026-08-26, it is not one.

## Acceptance Criteria

> **AC-9 is transferred verbatim from `road-to-governed-harness-evolution` on
> 2026-08-31, carrying its 2026-08-31 audit note unchanged.** The parent marks
> it `[-] MERGED`, which means the carrier moved — not that it was met, dropped
> or weakened. It is the only acceptance criterion this split moves; AC-1 to
> AC-8, AC-10 and AC-11 stay with the parent and were not touched.

- [ ] AC-9 — At least one promoted artefact has been through post-promotion
      re-evaluation and at least one RETIRE path has been exercised, so the
      lifecycle is shown to close in both directions.
      **Audited 2026-08-31: not met, and not closeable from this branch.**
      Every Phase 7 step is `[ ]` and the phase is gated on the OPEN,
      owner-reserved `blocker: merge-authority`. Nothing in this tree is
      promoted, so no promoted artefact can reach post-promotion re-evaluation.
      The RETIRE half was checked separately and does not rescue it: 5.5 carries
      `RETIRE` in E6's seven-op set and tests its arity
      (`tests/scripts/curator_ops.test.ts:63-66`), but every screened proposal
      there carries `lifecycle: 'candidate'` as a literal type, so that RETIRE
      retires a candidate and never a promoted artefact — which is the direction
      this criterion is about. What closes it is 7.6, after `merge-authority`.

## Provenance

**The council question and its full two-seat response are local-only and are
not cited by path here** — `agents/runtime/council/` is gitignored and pruned
after the retention window, so a path would rot. The verdict of 2026-08-31,
anthropic/claude-sonnet-4-5 + openai/codex-default, 2/2 convergent, is Option 3:
split at the phase boundary into a new ACTIVE roadmap; both seats rejected
`later/` by name; the transfer is atomic; `[-] MERGED` denotes carrier transfer;
an owner refusal returns the whole receiver to the owner and weakens nothing.

### The carried condition as the parent recorded it

Reproduced verbatim from `road-to-governed-harness-evolution` Phase 0, where it
was placed on 2026-08-30 and from where it transfers here on 2026-08-31. The
normative form is the four-line **Carried blocking condition** above; this block
is the reasoning that produced it, kept so the split loses no context.

> **CARRIED CONDITION, placed here 2026-08-30 — the `merge-authority` council's
> own instruction, executed late.** When the AI council scoped `merge-authority`
> on 2026-08-29 (anthropic + openai, 2/2) it declared Phases 1–6 legal while
> ADR-239 § Decision 3 stays open, and attached one condition it called *"an
> addition to what the blocker proposed"*: **the non-promotion property of
> Phases 1–6 must be MECHANICALLY ENFORCED, not merely stated** — *"a phase that
> promises to promote nothing while nothing prevents it from promoting is the
> same class of guarantee ADR-239 § Decision 3 is open about."* It said the
> condition belonged in this phase's exit criteria. It was never written here;
> found on 2026-08-30 and carried now.
>
> **It is carried UNMET, and that is the honest state.** Nothing in this tree
> promotes anything: there is no promotion path, no candidate, and no merge
> verb — `grep -rln 'assertWithinBudget|discloseToProposer' src/ tests/` returns
> the guards, their tests and their config, and no caller. A gate written today
> to assert "no Phase 1–6 code promotes" would scan a population of zero and
> exit green, which is worse than no gate because it would look like the
> mechanical enforcement the council asked for. That is the vacuous-check
> refusal 1.4 and 2.3 both already made on this roadmap.
>
> **What discharges it, falsifiably.** The first commit that creates a promotion
> path — a verb, a state transition into `promoted`, or any write into `src/`
> derived from a candidate — owes the enforcement in the same change. Concretely:
> the 3.4 lifecycle enum's `promoted` transition and the 3.6 verb set are where
> the population stops being empty, so the check lands there and this note is
> what stops it being read as already-satisfied when it does.
>
> **This does not resolve `merge-authority` and does not touch it.** ADR-239 §
> Decision 3 — *"Preauthorized merge authority is granted or refused | owner |
> open"*, re-verified at `ADR-239:188` on 2026-08-30 — is owner-reserved in both
> directions, and no council verdict may perform it. Option (c) stands, Phase 7
> stays gated, 0.8 stays `[~]`.
