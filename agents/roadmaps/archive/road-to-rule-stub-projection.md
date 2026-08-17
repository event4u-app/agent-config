---
complexity: lightweight
execution:
  mode: autonomous
---

# Road to rule-stub projection — hold a migrated rule at the size its pointer claims

> **Source:** `agents/tmp.old/performance-regression/road-to-rule-stub-projection.md`
> — external analysis session, 2026-08-17, drafted against `de76c38b`. Adopted
> 2026-08-17 via `/analyze:inbox` after per-claim verification against
> `origin/main` @ `86cdbf652`. The draft's status line said PROPOSAL and its IDs
> were proposal IDs; § 1 records which claims survived, which were overtaken, and
> the two that are refuted as written. § 2 records what was kept, folded, and cut.

> **Why the scope is narrower than the draft's.** The draft proposed building a
> stub tier: a generated one-liner per rule, a three-class delivery taxonomy, and
> a new emitter phase. Verification found that **most of that already shipped** —
> the stub form exists and 42 rules carry it, the projection mechanism exists
> (`type: manual`, ADR-004), and the per-rule classification exists and is closed.
> What does not exist is the invariant that keeps a migrated rule *at* stub size.
> This roadmap owns exactly that, and hands the one remaining body-moving job to
> the roadmap that already owns it.

## Goal

Every rule whose body declares itself migrated is held at a machine-checked
per-rule size ceiling, so the always-on corpus cannot re-grow past a pointer that
says the body left — measured against the committed census baseline of **103,265**
exact-BPE tokens.

---

## 0. The defect, stated first

The stub pattern is in production. 42 of the 117 rules in `src/rules/` carry a
line of the shape *"Body migrated to `guideline:X` … Trigger-set above activates
this routing on demand"* — norm line, binds line, pointer, which is the form the
draft proposed building. The projection half is in production too:
`_is_manual_rule` (`src/scripts/condense.ts:1086`) excludes a `type: manual` rule
from every per-tool tree (filter sites at `:1114`, `:1613`, `:1635`) and
`compile_router` omits it from `dist/router.json`, so such a rule costs zero
workspace budget by construction. Five rules use it today:
`analysis-skill-routing`, `brand-consistency`, `guidelines`, `package-ci-checks`,
`size-enforcement`.

**Nothing asserts that a migrated rule stays small.** Migration was executed as an
event and never encoded as a state, so the 42 pointers are hand-authored prose
that no gate reads. Measured at `origin/main`, the 42 span **~300 bytes to 10,988
bytes** and total **128,261 bytes**; the largest four are
`design-review-after-ui-write` (10,569 B), `design-fidelity` (10,544 B),
`settings-ask-protocol` (9,374 B) and `ui-audit-gate` (8,209 B) — every one of
them carrying a pointer that says the body moved.

The sharpest single case: `src/rules/context-hygiene.md` is **10,988 bytes** and
declares its body migrated to
`docs/guidelines/agent-infra/context-hygiene-mechanics.md`, which is **3,491
bytes**. The rule is three times the size of the file it migrated into. That is
the "second truth that drifts" the draft predicted for hand-authored stubs —
already realized, in the pointer itself.

The aggregate census ratchet does not catch this and is not meant to.
`src/config/rule-activation-census.json` pins the *corpus* token total and walks
it down only; one rule growing while another shrinks is a green run. Per-rule
re-growth under an aggregate cap is precisely the gap.

---

## 1. Per-claim verification of the draft

| # | Draft claim | Verdict | Evidence |
|---|---|---|---|
| 1 | Corpus baseline 107,194 exact-BPE tokens; 6 scoped · 19 mixed | **overtaken** | `src/config/rule-activation-census.json` @ `86cdbf652`: **103,265** tokens, **8** scoped, **17** mixed. `baseline_history` 2026-08-17 records the authorized move (mixed-trigger Phase 2 restored `paths:` on two rules, −3,929) |
| 2 | 116 rules | **overtaken** | `ls src/rules/*.md \| wc -l` = **117** |
| 3 | Rules have no "description always, body on demand" tier; the emitter's only choices are unconditional or `paths:` | **refuted as written** | a third choice ships: `type: manual` → `_is_manual_rule`, `condense.ts:1086`, honoured by the per-tool projection and by `compile_router`. Five rules use it |
| 4 | The stub form (norm line + binds line + pointer) must be built | **refuted as written** | it exists in 42 rules as the P4 migration pointer of `road-to-kernel-and-router`. What is missing is not the form but its enforcement |
| 5 | A three-class taxonomy (hook-enforced / contact-bound / guidance) must be authored per rule | **overtaken** | `agents/decisions/rule-activation-dispositions.yml` holds 76 rows with four adjudicated dispositions — `digest` 30, `keep` 46, `skill` 0, `drop` 0. Its line 1 marks the record **CLOSED**: "the migration this file drove is complete … New dispositions belong in the emitting rule's own frontmatter and the rule-migrations ledger, not here" |
| 6 | Class A (hook-enforced) is the risk-free half and covers a large share | **narrower than claimed** | of the 33 rules declaring `enforced_by:`, the values split **16 validator · 9 hook · 9 none · 1 observer**. Only the 9 hook rows deliver an explanation at violation time; a CI validator does not reach the session. 84 rules declare no `enforced_by:` at all |
| 7 | `paths:` loads a rule mid-turn on file contact | **still-true** | `archive/road-to-rule-delivery-integrity.md` P3.1 done-note, "VERIFIED FIRST-PARTY … the host injected `.claude/rules/augment-edit-discipline.md` on its own" |
| 8 | The `if`-gated carrier is available for class B | **not yet** | `road-to-mixed-trigger-activation-cost` step 2.3 is open and gated on `road-to-per-turn-hook-economy` 5.1 landing the matcher/if split. Only the `paths:` carrier is live |
| 9 | Non-goal: no keyword hook injecting rule bodies | **still-true** | `archive/road-to-rule-delivery-integrity.md` § Non-goals, line 93 |
| 10 | P3.2 chose rule→skill conversion 0 times | **still-true** | same file, P3.2 done-note: `skill` = 0 rows, because P2.1 measured 5 of 8 sampled catalogue entries reaching the model with no description |
| 11 | Norm line per rule under a drift lint is owned work | **still-true, unbuilt** | `road-to-cost-parity-1-rule-payload-diet` steps 3.1 (`norm:` field) and 3.2 (drift lint) are both `- [ ]`. The draft's invariant "rides the cost-parity-1 drift lint" has no lint to ride yet |
| 12 | `rules_efficiency` gate at 0.2 owns runtime retrieval | **still-true** | `later/road-to-deferred-rule-retriever.md`: "Phase 1.3 registered `rules_efficiency` … low-quota bar 0.2" in `src/config/dispatch-economy-metrics.json` |
| 13 | `InstructionsLoaded` measures actual per-session rule loads | **still-true, already owned twice** | `road-to-mixed-trigger-activation-cost` 3.3 and `road-to-standing-context-40k` 3.0 both register the observer. Not this roadmap's to build |
| 14 | ~80 tokens/skill catalogue median; ~50 % baseline / ~84 % forced-eval pointer compliance | **unverifiable here** | external figures with no in-tree derivation. Indicative only; nothing in this roadmap is gated on them |

The two `refuted as written` rows are the reason the scope changed. Neither
refutes the draft's *reasoning* — the mechanism it asked for is right, and it is
the mechanism the repo already chose. It refutes the draft's assumption that the
mechanism has to be built.

---

## 2. Disposition of the draft's proposals

| Proposal | Disposition | Reason |
|---|---|---|
| A generated stub form per rule | **FOLD** | into Phase 1 as a check on the 42 existing pointers, not a new emitter tier |
| A new emitter projection phase | **CUT** | `type: manual` is the tier (claim 3) |
| Three-class taxonomy authored per rule | **CUT** | the disposition record is closed with four dispositions already adjudicated (claim 5); a second classification of one corpus drifts with nothing to reconcile it — the record's own done-note says so |
| Phase-0 classification sweep over 116 rules | **FOLD** | into Phase 0 as a *measurement* of the 42 migrated rules, reconciled against the closed record |
| Class-A-ships-first | **CUT** | 9 hook-backed rules (claim 6) is not a half, and their bodies are not what the corpus is made of |
| Class-B carrier verification before stubbing | **CUT** | the `if` carrier is not available (claim 8); `paths:` scoping is owned by mixed-trigger Phase 2 and already executed for two rules |
| Class C measured, never assumed | **CUT** | the model-compliance question is `later/road-to-deferred-rule-retriever`'s behind its registered gate (claim 12). This roadmap never asks a model to follow a pointer |
| Norm-line byte-identity invariant | **KEEP, deferred** | needs cost-parity-1 3.1/3.2 (claim 11). Phase 1 checks the pointer's *target*, which needs no norm line |
| Census re-baseline in the same commit as any flip | **KEEP** | already the documented procedure; Phase 2 follows it |
| Hand-authored stubs are drift by construction | **KEEP** | verified realized, `context-hygiene` vs its own guideline (§ 0) |

---

## 3. The invariant this roadmap adds

A rule that declares its body migrated is making a checkable claim about itself.
Three parts, none of which exists today:

1. **The target resolves.** The path or `guideline:`/`skill:` reference in the
   pointer names a file that exists.
2. **The rule is under its own ceiling.** A per-rule, shrink-only byte budget
   derived from the rule's measured size at adoption — the same posture as the
   census ratchet's token axis and the rich-class ceiling, one level finer.
3. **A raise is a stated decision.** Raising a per-rule ceiling needs a
   `reason` sentence in the baseline file, exactly as
   `rule-activation-census.json` requires for its token axis. Raising a ceiling
   to clear a red is the config-weakening move this repo blocks by construction.

What it deliberately does **not** add: any judgment about which prose should
move. That is `road-to-standing-context-40k` step 2.2, and Phase 3 feeds it.

---

## Prerequisites

- [x] Read `AGENTS.md`, `docs/contracts/kernel-membership.md`, and
      `src/rules/preservation-guard.md` — the last one binds every later phase:
      Iron Law headings and fenced blocks survive verbatim, so they are floor,
      not residue.
- [x] Read `agents/decisions/rule-activation-dispositions.yml` header. It is a
      closed record; this roadmap reads it and never adds a row.
      **Done:** read, reconciled in 0.3, and unchanged — same 76 rows, same
      dispositions.

## Context

Traces to the same operator report as `road-to-mixed-trigger-activation-cost`
("slow since 12.1"). That roadmap found and priced the activation flip; this one
covers the orthogonal half its § 0 exposed — the corpus that stayed
unconditional is body-heavy, and 42 of those bodies already declare that they
should not be.

Siblings and their boundaries, so no step here duplicates an owner:

- `road-to-standing-context-40k` — owns the 40k destination, the condense pass
  (2.1) and the rationale-extraction pass (2.2). **Owns the moving.**
- `road-to-cost-parity-1-rule-payload-diet` — owns the `norm:` field and its
  drift lint (3.1/3.2, both open).
- `road-to-mixed-trigger-activation-cost` — owns the trigger axis, the census
  ratchet (4.1, landed) and the `if` carrier (2.3, open).
- `later/road-to-deferred-rule-retriever` — owns runtime retrieval behind
  `rules_efficiency ≤ 0.2`.

## Phase 0 — Size the migrated corpus, do not reclassify it

- [x] **0.1** Enumerate the rules carrying a migration pointer and measure each
      one in exact BPE via the tokenizer path `rule_activation_census.ts` already
      uses — never bytes ÷ 4, which is the proxy error `road-to-mixed-trigger-activation-cost`
      claim 11 exists to record. Emit one row per rule: name, exact tokens,
      pointer target, target exists yes/no.
      <!-- verify: ./scripts-run src/scripts/check_rule_stub_ceiling --report -->
      **Done:** [`rule-stub-projection-phase0.md`](../../evidence/analysis/rule-stub-projection-phase0.md).
      **44 rules, not 42** — the live count via the ledger gate's own matcher.
      **All 45 pointers resolve; zero broken.**
      **The step's own measurement path is refuted:** `rule_activation_census.ts`
      imports no tokenizer and prints no token figure. The exact-BPE path is
      `_lib/token_count.ts` (`gpt_tokens`), which the census *checker* uses. Its
      `verify:` annotation was also unrunnable (`scripts-run` appends `.ts`, so
      the annotation asked for `…census.ts.ts`); both corrected above.
      Sixth recording of the class: read the tree, not the step's prose.
- [x] **0.2** Split each migrated rule's retained body into **floor** and
      **residue**. Floor = what `preservation-guard` requires to stay (Iron Law
      headings at their level, their fenced blocks byte-for-byte, negation
      clauses) plus the pointer itself. Residue = everything else. Report both
      totals; the split is the input Phase 3 hands on, and the reason no step
      here proposes a deletion.
      **Done: floor 7,463 · residue 17,383 tokens** of 24,845 body tokens,
      criterion published per rule.
      Two imprecisions stated in the artifact, one of which biases residue
      *downward* — against this roadmap's own premise, the safe direction.
- [x] **0.3** Reconcile the row set against the closed disposition record: for
      each migrated rule, note its recorded disposition (`digest` / `keep` /
      absent) without changing it. A `keep` row that also carries a migration
      pointer is a contradiction worth reporting — `keep` means "stays always-on
      and monolithic, deliberately", and a pointer says the opposite.
      **Done: 25 `digest` · 1 `keep` · 18 absent.** The 18 absences are expected,
      not drift — the record covers non-kernel rules with no path trigger, and
      every absent rule has one. The `keep` row is `legal-safety-floor`; this step
      first called it a contradiction and **that was retracted** — see 3.3. The
      record is unchanged either way.
- **Pre-registered expectation, to falsify:** residue ≥ 25 % of the 103,265-token
  baseline. Priors that make this a measurement rather than a hope: the 42
  migrated rules total 128,261 bytes, and the four largest each exceed 8 KB while
  the fully-migrated ones sit near 300–1,400 B. **If residue < 10 %**, the
  stub-ceiling lever is small, Phase 2 ships as pure regression protection, and
  § Honest-null consequence is the finding.
- **RESULT — the pre-registration is FALSIFIED, and it is not an honest null
  either.** Measured **17,383 / 103,265 = 16.8 %**, against a ≥ 25 % bar with a
  < 10 % null threshold. The lever is real but smaller than pre-registered:
  ~18k tokens of always-on corpus sit in bodies that already declare they should
  be elsewhere. Recorded as a miss rather than reframed — writing the bar down
  first is what makes a 16.8 % result mean anything.
- **Exit:** a committed table covering every migrated rule with both totals.
  **Met** — [`rule-stub-projection-phase0.md`](../../evidence/analysis/rule-stub-projection-phase0.md).
- **Rollback:** the table is an evidence artifact; deleting it reverts the phase.

## Phase 1 — Make the pointer machine-checked

- [x] **1.1** A gate that reads every rule declaring a migration pointer and
      fails when the pointer's target does not resolve. Fail-closed on an
      unparseable pointer, and report the pointer form it matched so a reworded
      pointer surfaces as a finding rather than as silence.
      <!-- verify: ./scripts-run src/scripts/check_rule_stub_ceiling --self-test -->
      **Done:** `src/scripts/check_rule_stub_ceiling.ts`. Self-test 8/8, six of
      them rejecting — including the reworded-pointer case, which is the Risk-3
      mitigation made executable rather than promised.
      **Partly already shipped, found before building:** `lint_rule_migration_ledger`
      already resolves every *ledger row's* `target` anchor. What it never
      validates is the rule's own inline pointer (`migrated_to` is declared in its
      interface and read by nothing). This gate covers that half, and the header
      says so instead of claiming the whole.
      **The resolver was wrong once and it mattered:** resolving relative hrefs
      from `src/rules/` reported 12 of 44 broken — a false red, because bodies are
      authored for the projected tree. `check_references`'s strip-and-try-prefixes
      strategy is adopted verbatim; a gate disagreeing with the reference checker
      would be worse than none.
- [x] **1.2** Register the gate in the gate ledger under CI-identical argv, with
      the skip reason drawn from the existing closed union. A gate that scans
      nothing exits green, so its green line publishes the count of rules it
      actually read.
      <!-- verify: the gate's green line names a non-zero rule count -->
      **Done:** `src/config/gate-coverage.yml` (`min_scanned: 100`),
      `taskfiles/ci-fast.yml`, `Taskfile.yml`, and
      `.github/workflows/rule-backstops.yml` beside the census it complements.
      Green line: `44 migrated rule(s) under ceiling · 45 pointer(s) resolved ·
      24845 body tokens (exact BPE) · 117 rule file(s)`. The manifest floor is
      keyed to the **117-rule scan root**, not to the 44-rule subset — a floor on
      the subset would fall as rules legitimately finish migrating.
- **Exit:** gate registered, red on the fixture, green on the tree. **Met.**
- **Rollback:** de-register the gate; no rule content changed in this phase.

## Phase 2 — Per-rule shrink-only ceilings

- [x] **2.1** Extend the Phase-1 gate with a per-rule token ceiling read from a
      committed baseline, generated from Phase 0's measurement — never
      hand-edited, regenerated by an explicit `--write-baseline` flag, same
      posture as `rule-activation-census.json`.
      <!-- verify: ./scripts-run src/scripts/check_rule_stub_ceiling --self-test -->
      **Done:** `src/config/rule-stub-ceilings.json`, 44 ceilings, exact BPE.
- [x] **2.2** Require a `reason` sentence per raise in the baseline's history
      array, and make the gate refuse a raise whose reason is empty or a
      restatement of the number. The census baseline's own comment carries the
      sentence to mirror.
      <!-- verify: ./scripts-run src/scripts/check_rule_stub_ceiling --self-test -->
      **Done — and the first implementation of it was unreachable.** The reason
      was consulted only inside the `tokens > ceiling` branch, which a raise by
      definition fixes, so a raise with an empty reason sailed through. The gate's
      own self-test caught it. The requirement now validates the baseline's
      history *independently* of any rule's current size, plus a second check that
      a history entry and the committed ceiling agree — the signature of a
      hand-edit. This is the case for writing the self-test before believing the
      gate.
- [x] **2.3** Record in the baseline that the ceilings are a floor-plus-residue
      snapshot, not a target: a rule at its ceiling is not thereby correct, only
      not worse.
      **Done:** stated in the baseline's `_comment`, in the gate header, and in
      the Taskfile description.
- **Exit:** both fixtures red, tree green, baseline committed with its generation
  command. **Met** — 8/8 self-test, 6 rejecting.
- **Rollback:** revert the baseline and the ceiling check; Phase 1's
  target-resolution half stands on its own.

## Phase 3 — Hand the sized residue to its owner

- [x] **3.1** Write Phase 0's residue table into `road-to-standing-context-40k`
      step 2.1 as its prioritisation input. That step says "prioritised by body
      size" and no measurement exists for it; this supplies one, in exact BPE,
      largest residue first.
      **Done:** top-eight table plus the regeneration command, under 2.1. The
      top 8 carry **10,469 of the 17,383 residue tokens — 60 % in 18 % of the
      rules**, which is what makes a prioritisation worth having. Written with
      its generation command so a reader regenerates rather than trusts it
      (Risk 5).
- [x] **3.2** Note in the same place that 2.2's moves land against per-rule
      ceilings from Phase 2, so each move's effect is visible per rule instead of
      only in the aggregate census. Do not restate 2.2's method — it already
      binds `preservation-guard`.
      **Done**, one sentence, no restatement.
- [x] **3.3** Report the contradictions from 0.3 (pointer-carrying `keep` rows,
      if any) as findings on this roadmap, not as edits to the closed record.
      **RETRACTED 2026-08-17 — there is no contradiction, and the retraction is
      the finding.** This step reported `legal-safety-floor` as recorded `keep`
      while carrying a migration pointer, called the two statements opposites, and
      handed the choice to a maintainer. Checked against the record's own text, all
      three parts were wrong:
      (a) the register defines `keep` against `digest` — "stays always-on and
      monolithic, deliberately" rules out demotion to a shared digest, not a
      migration that already happened;
      (b) the row records `body_lines: 139`, the rule's size TODAY — the migration
      landed 2026-07-11 (`6ef4102d6`) and the disposition was measured 2026-08-09,
      so the two never described the same body;
      (c) `rule-body-migration-inventory.md` classes it `stay` *because* of the
      migration, calling it "already the best existing exemplar of the P4 pattern
      applied within a safety floor".
      **The real finding:** that inventory names this rule as the template for six
      sibling safety floors that have NOT had the treatment —
      `finance-safety-floor`, `strategy-safety-floor`, `engineering-safety-floor`,
      `domain-safety-disclaimer`, `domain-safety-pii`, `domain-safety-retention`.
      None carries a pointer, so none is in this roadmap's population; they are a
      named prospect for `road-to-standing-context-40k`, not a defect here.
      **Mechanism, because it recurs:** the reconciliation compared two labels and
      inferred a contradiction from their plain-English connotations without opening
      the definition section 280 lines above the row. A label is not a definition.
- **Exit:** the receiving roadmap carries the table; this roadmap owns no
  body-moving step. **Met.**
- **Rollback:** revert the edit to the sibling roadmap; the table survives in
  Phase 0's artifact.

## Acceptance Criteria

- [x] Every rule carrying a migration pointer has an exact-BPE measurement and a
      floor/residue split in a committed table. — 44 rows, regenerable.
- [x] A pointer naming a missing target fails CI; the gate's green line reports
      how many rules it read. — self-test case 2; green line reports 117.
- [x] A migrated rule padded past its per-rule ceiling fails CI; a raise without
      a real reason sentence fails CI. — self-test cases 3 and 4.
- [x] The aggregate census baseline is unchanged by Phases 1–2, and any change in
      Phase 3's wake is re-baselined in the same commit with its reason. —
      `src/config/rule-activation-census.json` is untouched by this branch; no
      rule body changed, so there was nothing to re-baseline.
- [x] `road-to-standing-context-40k` step 2.1 carries the prioritisation table;
      no step in this roadmap moves prose out of a rule body. — no `src/rules/`
      content edit is in this diff.
- [x] The closed disposition record has the same row count and the same
      dispositions it had at adoption. — 76 rows, read-only; verifiable as an
      empty diff on `agents/decisions/rule-activation-dispositions.yml`.

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-08-17 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A per-rule ceiling freezes a rule that legitimately needs to grow | product | Several of the 42 are kernel-adjacent and gain material when a measured finding lands; a ceiling that reads as a prohibition would suppress the finding instead of the bloat | The ceiling is shrink-only with an explicit raise path, and 2.2 requires a real reason rather than refusing the raise; the same mechanism the census token axis already runs under | Phase 2 — Per-rule shrink-only ceilings |
| 2 | Phase 0's floor/residue split is a judgment dressed as a measurement | implementation | "What `preservation-guard` requires" is decidable for Iron Law headings and fenced blocks and much less so for a table or a marker list, and 46 rules were already adjudicated `keep` on exactly that ambiguity | The split reports floor and residue separately with the criterion per rule, so a reader can disagree with a row without discarding the total; 0.3 surfaces the `keep` overlap rather than resolving it | Phase 0 — Size the migrated corpus |
| 3 | The pointer gate hardens a hand-authored prose convention into a contract | implementation | 42 pointers were written by hand over months in at least two phrasings; a gate keyed to one phrasing silently stops seeing the others | 1.1 fails closed on an unparseable pointer and 1.2 publishes the count it read, so a phrasing the gate cannot see shows up as a falling number instead of as silence | Phase 1 — Make the pointer machine-checked |
| 4 | The residue is small and the roadmap's premise is thin | product | If the 42 rules' retained bodies are mostly Iron Law floor, the lever is regression protection only and the corpus problem lies elsewhere | Phase 0 pre-registers the band and § Honest-null consequence states the outcome in advance; Phases 1–2 keep their value as protection even at a null | Phase 0 — Size the migrated corpus |
| 5 | Phase 3's edit to a sibling roadmap goes stale | implementation | A table written into another roadmap ages with the corpus, and a stale prioritisation is worse than none because it looks authoritative | 3.1 writes the table with its generation command and its measurement commit, so a reader can regenerate rather than trust it | Phase 3 — Hand the sized residue to its owner |

## CUT list — do not re-litigate

- **A new emitter projection tier.** `type: manual` is it (claim 3). Cut.
- **Re-opening the disposition record.** Line 1 marks it closed and names where
  new dispositions go. Cut.
- **A three-class taxonomy over 117 rules.** A second classification of one
  corpus drifts with nothing to reconcile it — the record's own done-note.
  Cut.
- **Any model-compliance bet on pointer-following.** Owned by
  `later/road-to-deferred-rule-retriever` behind `rules_efficiency ≤ 0.2`. This
  roadmap asks no model to follow a pointer. Cut.
- **A keyword hook injecting rule bodies.** Recorded non-goal (claim 9). Cut.
- **Deleting a rule body to hit a ceiling.** `preservation-guard`: every passage
  moves, none is deleted. The ceiling is satisfied by moving, and the moving has
  an owner. Cut.
- **Bulk deletion of low-usage rules framed as stubbing.** A different decision
  with a different owner; the census refuses a rate. Cut.

## Honest-null consequence

If Phase 0 measures residue under 10 % of the 103,265-token baseline, the finding
is that the migration pointers are honest and the always-on corpus is Iron Law
floor rather than stranded prose. Then this roadmap closes at its measured size:
Phases 1–2 ship as regression protection for a state that is already good, the
prioritisation table Phase 3 hands over says "little to prioritise", and the
remaining reduction against the 40k destination belongs to
`road-to-standing-context-40k` Phase 2 condensing floor material — a harder job
than moving residue, and one this roadmap should not pretend to have made easier.

## Notes

- The draft's own risk row "stub tier becomes a second truth that drifts" is the
  one thing verification found **already realized** rather than prospective
  (`context-hygiene` at 10,988 B against a 3,491 B target). That inversion is why
  the roadmap enforces the existing pointer instead of generating a new one.
- Two of the draft's four cited body sizes had moved by adoption
  (`design-review-after-ui-write` 9.2 → 10.6 KB, `ui-audit-gate` 6.9 → 8.2 KB),
  measured fresh in § 0. A size quoted from a draft is a stale number by the time
  it is read; Phase 0 regenerates rather than cites.
