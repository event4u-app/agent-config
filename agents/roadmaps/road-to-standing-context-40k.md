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
- **AC-0:** every machine in the team reports under the governed cap on that gate,
  or carries a dated exemption note saying why it does not.

### Phase 1 — Pull the lever that already exists

> **Superseded in scope, deliberately.** `later/road-to-request-scoped-rule-load`
> owns consumer rule scoping, sits at 34/36 done, and its resume condition
> **fired** when P2.1 of rule-delivery-integrity closed — the same day, and nothing
> resumed it. This roadmap does not rebuild that; its contribution is the
> resumption evidence note. Steps 1.1 and 1.2 stay below as a description of what
> the resumption delivers, not as work to duplicate.

- [ ] **1.1** Write the resumption evidence note into that roadmap's park block:
      the resume condition, the date it was satisfied, the artefact that satisfied
      it, and the fact that no resumption event followed. Move the file out of
      `later/` under its own disposition rules.
      `verify:` the file is in the active tree and the dashboard counts it.
- [ ] **1.2** (Owned by that roadmap, tracked here for the interlock only.) The
      machinery is built and tested; only the human gate is unpulled. Consumer
      installs default to workspace-derived scope, `legacy-all` becomes the
      explicit opt-out, and the install prints the delta warn-first for one release.
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
- [~] **3.1** Fork, stated so it cannot be half-done. **(a)** Execute
      `later/road-to-deferred-rule-retriever` when its `rules_efficiency` gate
      converts, lexical-core comparison first, per its own text. **(b)** If the
      demand signal never materialises on a sustained basis, record the null and
      **delete the trigger frontmatter from rules instead** — a compile-time field
      nothing consumes is documentation pretending to be mechanism. Blocked on
      `b-rules-efficiency-signal`.
- **AC-3:** either (a) ships behind the registered gate with a pre-registered
  adoption metric, or (b) a dated null closes the fork. No third state.

### Phase 4 — Per-turn injection aggregate

- [ ] **4.1** Add an aggregate row to `hook-token-budget.json`: the sum of all
      concern emissions per session-turn, capped outside `session_start`, with the
      dispatcher enforcing by dropping lowest-severity advisories first and
      recording each drop in dispatch issues. The cap exempts `severity: blocking`
      and fail-closed concerns by construction, so the policy can never hide a
      safety-relevant warning.
      `verify:` the injection bench reports the aggregate; a fixture exceeding the
      cap drops the right advisory and records it.
- [ ] **4.2** Interference fixture: one routing-matrix-style corpus file asserting
      that for each prompt class at most one nudge fires. The delegation-nudge and
      skill-route overlap is the first known pair to pin.
      `verify:` the fixture is green and fails when a second nudge is forced.
- **AC-4:** the aggregate appears in the bench output and the overlap fixture is
  green.

## Blockers

### blocker: b-rules-efficiency-signal
- **Status:** open
- **Owner:** maintainer
- **Blocks:** Phase 3 step 3.1 only. Step 3.0's observer is repo work and proceeds
  without it.
- **What to do:** the fork needs the registered `rules_efficiency` metric in
  `dispatch-economy-metrics.json` to have accumulated enough sessions to read
  against its low-quota bar. Either wait for the observer from step 3.0 to fill
  it, or record here that the window is unfilled and re-date the fork — which is
  itself progress, per the same discipline the telemetry-count gates use. Do not
  build a retriever before the comparison against `src/scripts/_lib/lexical_index.ts`
  that `later/road-to-deferred-rule-retriever` pre-registered.
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
