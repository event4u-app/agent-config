---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
---
# Road to standing payload diet

> **Source:** `agents/tmp.old/40k` — an external token-economy analysis pass,
> re-verified against this tree on 2026-08-22. Every number below was re-measured
> here; where the source pass and the tree disagree, the tree wins and the
> divergence is recorded rather than quietly corrected.

## Goal

The standing per-session and per-spawn rule payload is back inside the two
ceilings that already gate it, and it got there by shortening rule **bodies** —
not by re-scoping triggers and not by de-duplicating layers, because both of
those levers are already spent. When this is finished, `check_preamble_payload_budget`
and `check_standing_rule_delivery` both read green on a maintainer machine, a
per-PR delta against the merge-base makes any future growth visible at review
time instead of at ratchet time, and the per-rule before/after is published
including the rules where the diet achieved nothing.

> **Closed 2026-08-23, and the Goal above is NOT fully met — recorded here
> rather than rewritten, so the roadmap can be checked against what it set out
> to do.** What landed: the `norm` mechanism plus its lint, the two-sided per-PR
> delta, the re-derived attribution, the published per-rule table with its
> misses, and a measured **−1,360** on `check_preamble_payload_budget`.
>
> Two clauses of the Goal did not land, both for reasons the execution measured:
>
> 1. **Neither gate reads green.** The preamble ratchet is +28,702 over its
>    ceiling after the diet. The pilot was three rules of 120 by design (step 1.3
>    forbids a corpus-wide rewrite), so the residual is recorded with four named
>    closing mechanisms rather than absorbed — AC-6 forbids moving the baseline
>    and it was not moved.
> 2. **`check_standing_rule_delivery` cannot read green *because of this work* at
>    all** — it cannot observe a rule-body diet without a global reinstall. AC-5
>    is descoped to `agents/roadmaps/stubs/standing-rule-delivery-observability.md`
>    with the measurement and three candidate mechanisms.
>
> The Goal's premise — that body length is a real, un-pulled lever — held: three
> rules yielded 34.7 %, 19.9 % and 3.6 %, and the spread is itself the finding
> (`agents/evidence/analysis/standing-payload-diet-per-rule.md` § 2).

## Context

Two gates measure the same corpus from two angles, and both are red today.
Measured in this tree on 2026-08-22:

- `check_preamble_payload_budget` (`taskfiles/ci-fast.yml:796`, verified) reads
  **135,436 tok against a 107,646 ceiling** — project-scope rules 120,282 ·
  preloaded skills catalog 14,408 · CLAUDE.md hierarchy 746. Its baseline is
  102,520 (`src/config/preamble-payload-budget.json`), so the tree is +32,916
  over baseline. This bucket is paid on **every subagent spawn**, not once.
- `check_standing_rule_delivery` reads **120,857 tok against a 110,000 cap
  (109.9 %)** over **118 files — 103 global + 15 project**. Run inside a
  worktree it reports only the 103 global files (108,889 tok, 99.0 %) because
  `.claude/rules/` is gitignored and generated; the 118-file reading requires
  the main checkout. Both readings are machine-local by construction, which is
  why that gate is deliberately not wired into CI (its own module docstring
  states this).

**The critical framing, and the reason this roadmap exists at all:** the two
obvious explanations for the overrun are both already ruled out.

1. **Layer duplication is gone.** ADR-236 (`docs/decisions/ADR-236-one-artefact-one-layer.md`,
   accepted 2026-08-19, supersedes ADR-226) partitions the two rule layers
   instead of duplicating them. Measured here: `comm -12` over the two rule
   directories returns **0 shared basenames**. The installer refuses to create
   the doubled state at all — `_gate_rule_layer_overlap` in
   `src/scripts/install.ts` (verified at `install.ts:2216`, called at
   `install.ts:5021`). So the 120,857 is 118 *distinct* artefacts.
2. **Trigger re-scoping already shipped.** `src/scripts/condense.ts` emits
   `paths:` frontmatter from `derive_trigger_globs` (imported at
   `condense.ts:269`, called at `condense.ts:1304` and `:1324`, written at
   `condense.ts:1373`). The per-rule census is at
   `agents/evidence/analysis/rule-paths-coverage-census.md`. The repair pass
   landed **−3,929 exact-BPE tokens** by restoring `paths:` on two of nineteen
   rules (`agents/roadmaps/later/road-to-mixed-trigger-activation-cost.md:486`),
   and that roadmap is parked in `later/` on blocker `b-behavioural-bench-spend`
   for the remaining fifteen.

Both phases the source pass proposed for those two levers are therefore
**dropped from this roadmap**, deliberately, and the reason is written down so a
later reader does not re-propose them: one is shipped, the other is already
owned by a parked sibling with a named blocker.

What is left is **pure body length**, and it has exactly one untouched lever.
`norm` is absent from `src/scripts/schemas/rule.schema.json` and from every file
in `src/rules/` (0 hits, verified 2026-08-22). Nothing in this tree pins how much
of a rule file is normative obligation versus explanation, so nothing objects
when a rule grows by 200 lines of rationale.

### The source pass's attribution figure does not reproduce

The source draft attributed the overrun to a burst of authoring: *"+19,679 /
−300 lines in `src/rules` since 2026-08-15"*. Re-measured here on 2026-08-22
over the same window and the same path, across 37 commits:

    git log --since=2026-08-15 --numstat --pretty=format: -- src/rules/
    → added: 1036  deleted: 382

That is off by a factor of roughly nineteen on the added side and inverts the
deleted side. `src/rules/*.md` totals 9,717 lines today, so a +19,679 inflow in
one week is not merely wrong, it is arithmetically impossible against the
current tree. **Phase 0 therefore re-derives its own attribution and does not
consume the source figure at all.** The divergence is recorded here rather than
silently replaced because a roadmap that quietly fixes its own source cannot be
checked against it later.

## Phase 0 — stop the drift before dieting

A ratchet that fails on growth tells you *after* the growth is committed. The
gate runs; nothing diffs it against the merge-base, so a PR that adds 4,000
tokens of rule prose passes review and is discovered at the next ratchet read.
Verified: no workflow under `.github/workflows/` computes a merge-base delta
(`grep -rln "merge-base\|merge_base" .github/workflows/` returns nothing);
PR-comment machinery exists in the tree, so the mechanism is not novel here.

- [x] **0.1 Re-derive the inflow attribution from this tree, not from the source
      pass.** Produce a per-file and per-commit ranking of what actually grew
      `src/rules/` and the projected corpus since the last green ratchet read,
      and write it to `agents/evidence/analysis/`. Name the top contributors by
      file and token delta. If the answer is "no burst — the corpus was already
      over and the ratchet baseline is stale", say that; it is a legitimate
      finding and it changes what Phase 1 should target.
      verify (discharged): the command returns `1225 408` on this branch and that pair is quoted verbatim in `agents/evidence/analysis/standing-payload-inflow-attribution.md` § 2a; the analysis file exists (334 lines). It ALSO re-derived the window in the gated unit, which lines are not: **+11,779 exact-BPE tokens, 110,119 → 121,898 over 116 → 120 files** (§ 2b). Two findings the step invited: **40 % of the inflow is four NEW rules**, which a body diet cannot reverse; and **there is no burst** — the gate is +35,188 over baseline against a +11,779 window, so ~67 % predates 2026-08-15 and the 102,520 baseline (registered 2026-07-31) is stale by construction. Defect uncovered in the step's own premise: the roadmap's Context quoted +1,036/−382 measured 2026-08-22, which is the SAME command one day earlier — recorded as drift rather than corrected, so § 2a carries both.
- [x] **0.2 Record the source-pass divergence as a finding, not a correction.**
      The +19,679/−300 claim and the measured +1,036/−382 both go into the
      analysis file with the command that produced each. State which environment
      could have produced the source figure, or state that none could.
      verify (discharged): `grep -c "19,679\|1,036" agents/evidence/analysis/standing-payload-inflow-attribution.md` → **7**, and both figures appear in the § 4 table beside the command that produced each. The step asked which environment could have produced +19,679/−300: § 4 states that **none reachable from this history can**, argues it arithmetically (a 19,679-line inflow against a 9,880-line corpus with only 300 lines removed is impossible), and records two candidate explanations as candidates — a dropped path filter (whole-tree magnitude wearing a `src/rules` label) and a line/token unit confusion.
- [x] **0.3 Emit a per-PR standing-payload delta against the merge-base.** A
      workflow step that measures the gated buckets at the merge-base and at
      HEAD and posts the signed delta as a sticky PR comment. It **reports**, it
      does not gate — the ratchet already gates, and a second blocking gate on
      the same number would double-fail every legitimate addition.
      verify (discharged): the grep returns **8 hits, all in the new `.github/workflows/standing-payload-delta.yml`**. Pre-state recorded in § 4b of the analysis file: `grep -rln "merge-base\|merge_base" .github/workflows/` returned **nothing (exit 1)** across 29 workflow files. Report-only is enforced in the gate itself, not just in the prose — `check_standing_payload_delta` returns 0 on any delta and fails only when it cannot measure, and its `--self-test` (4/4, 2 rejecting) uses an unreadable ref and a usage error as its reject cases precisely so that "the number moved" is not one. Three measurement defects found in the step's own first run and closed: the `CLAUDE.md` symlink fabricating a +744 debit, `git archive`'s `export-ignore` dropping that file silently, and `origin/main` (moved to `2a7a8e221`) attributing four unrelated merges to the branch — hence `git merge-base` plus `fetch-depth: 0`.
- [x] **0.4 Register the delta comment in the gate ledger under CI-identical
      argv.** A reporting step still has to be discoverable; an unregistered
      workflow step is invisible to `check_gate_coverage`.
      verify (discharged): `check_gate_coverage` ends `✅  every enforced gate cleared its coverage floor.` with `check_standing_payload_delta` present and its `no_canary_reason` printed; both its ratchets stay green (`gate-hardening:unhardened-scan-scope` 0 violations, `gate-self-test:registered-non-adopters` 24 at baseline, unmoved because the new gate adopts a self-test). Registered under CI-identical argv `["--base", "HEAD", "--quiet"]` with `min_scanned: 3` — the full bucket set, because the population is fixed at three by the ratchet it reports beside, so two of three is a moved root rather than a legitimate deletion.
- [x] **0.5 Book the credit side, so the ledger is two-sided.** Steps 0.3 and
      0.4 measure only the debit — what a PR ADDS to the standing payload. A
      one-sided ledger can only ever report drift, so a change that *removes*
      standing payload scores zero and reads as neutral. Extend the same delta
      comment with a credit column, and take the first booking from a saving
      that is already measured and already shipped: the ADR-236 one-rule-one-layer
      partition. `src/scripts/check_rule_layer_partition.ts:15-21` publishes a
      per-host split measured 2026-08-22 in a freshly generated worktree with
      `partitionActive: true` — `.cursor/rules` 126 files / 26 package-only /
      100 global-only, `.windsurf/rules` 113 / 13 / 100, `.augment/rules`
      118 / 15 / 103, against `.claude/rules` 13 / 13 / 0 and `.clinerules`
      14 / 13 / 0. The withheld files are the credit; the two symlink trees at
      zero global-only are the control that says the number is a partition
      effect and not a counting artefact. Book it against the same buckets the
      debit uses, so a reader can see net movement rather than inflow alone.
      verify (discharged): the partition gate reproduces a five-host split on the maintainer's main checkout (`.claude/rules` 15/15/0/0/103 · `.cursor/rules` 16/16/0/0/103 · `.clinerules` 15/15/0/0/103 · `.windsurf/rules` 16/16/0/0/103 · `.augment/rules` 119/15/**103**/1/103), and the rendered comment carries a `credit` column plus a `Credit side (standing bookings)` table whose booking names `check_rule_layer_partition`. Credit measured: the 103 global-owned rules withheld from the project layer on the four partitioned hosts = **108,978 exact-BPE tokens**. Control that makes it a partition effect rather than a counting artefact: `.augment/rules`, same machine same run, still duplicates all 103 and the gate reds on it. Defect uncovered in the step's own premise: the split the step quoted (`.cursor` 126/26/100, `.claude` 13/13/0) does NOT reproduce — every host now reads `global 103` and the two symlink trees read 15/16 package-only, not 0. Recorded as a divergence in § 4b rather than reconciled (different projection states, gate is machine-local), and the control above is chosen so it does not depend on which reading holds.

## Phase 1 — the body diet: a `norm` pin plus its lint

The lever nothing has pulled. Today a rule file mixes three things at one
uniform cost: the obligation (an Iron Law and its clauses), the routing
(pointers to skills and guidelines), and the rationale (why the rule exists,
what it measured, what it declines to claim). All three are re-sent on every
session and every spawn. Only the first two have to be.

`norm:` names the normative fraction and pins it. The rationale does not
disappear — it moves to a guideline or a mechanics context that loads on demand,
which is the P4 migration pattern this tree already uses in roughly forty rules.

**This phase is bounded by `preservation-guard`**
(`src/rules/preservation-guard.md:30` — *"EVERY PASSAGE STAYS — PARAGRAPH FOR
PARAGRAPH, BULLET FOR BULLET, FENCE FOR FENCE"*). A diet that deletes a passage
is a rule violation, not an optimisation. Every token removed from a rule body
must land somewhere a reader can still reach it.

- [x] **1.1 Define `norm` in the rule schema.** Add the key to
      `src/scripts/schemas/rule.schema.json` with an explicit semantic: the
      declared token ceiling for the rule's normative core, and the pointer to
      where the non-normative remainder lives. Optional at introduction — a
      required key would red every one of the existing rule files on the day it
      lands, which is the gate-that-teaches-you-to-ignore-it failure the
      preamble budget file already warns about in its own `_comment`.
      verify (discharged): the grep returns `58:    "norm": {`, and the pre-state command returned **0** — verified at the merge-base before the edit. `norm` is an object requiring BOTH `tokens` (an exact-BPE integer ceiling) and `remainder` (≥1 guideline/context/skill path), because the schema is where "a pin without a destination is malformed" is actually enforceable — `preservation-guard` forbids deleting a passage, so a pin with nowhere to point is a licence to delete. Optional at introduction: `validate_frontmatter` passes 443 artefacts with 3 declaring the key and 117 rules not (its one failure, `playbook-precedence.md`, is pre-existing on the merge-base and untouched by this branch).
- [x] **1.2 Lint the pin.** A gate that, for every rule declaring `norm`,
      measures the body with the exact tokenizer and fails when the measured
      normative section exceeds its declared pin. Rules without `norm` are
      skipped, reported as a count, and the count is the phase's own progress
      metric.
      verify (discharged): `./scripts-run src/scripts/lint_rule_norm_pin` exits 0 and prints `lint_rule_norm_pin: 3 rule(s) declare \`norm\`, 117 do not (un-pinned remainder).` — the un-pinned count is printed on the GREEN path, because a number visible only on failure is not a progress metric. It measures with the exact tokenizer and **refuses rather than falling back**: no `js-tiktoken` → exit 2, since a pin derived in exact BPE and enforced against `chars/4` is enforced against a number nobody can reproduce. `--self-test` 5/5, 3 rejecting (pin exceeded → 1, dead scan root → 3, usage error → 2), with two accepting cases including "no rule declares a pin" — the case that would otherwise have reddened the gate on day one.
- [x] **1.3 Pilot on the highest-ranked eligible rules from Phase 0's census.**
      Exclude every rule named in the frozen exclusion manifest recorded under
      blocker `b-behavioural-bench-spend`. From the remaining census, select the
      highest-token rules and migrate their rationale out under the P4 pattern,
      declaring `norm` on each. Do not modify the exclusion manifest or any
      excluded rule within this roadmap. Do not batch the whole corpus — a pilot
      that misses its target is a cheap finding, while a corpus-wide rewrite that
      misses is an unreviewable diff. *(Wording replaced verbatim with the AI
      council's own text, 2026-08-23 — see the blocker.)*
      verify (discharged): three rules dieted, all eligible, none in the 17-rule manifest — `evaluator-independence` 2,294 → 1,497 (**−797**), `context-hygiene` 2,470 → 1,979 (**−491**), `roadmap-progress-sync` 2,479 → 2,391 (**−88**); total **−1,376 exact-BPE** body tokens, each declaring a `norm` pin derived from its own post-diet measurement. `check_source_size_budget` did **not** regress: 18,571 violations at baseline, age 0d, unchanged — that gate sums lines above 1,500 per FILE and no rule file is near that. **Defect uncovered in this step's own verify command:** `check_standing_rule_delivery` cannot observe the diet at all — all three dieted rules live in its *global* layer (`~/.claude/rules/`, a past-install snapshot), and its *project* layer carries only the 15 package-only rules, none of them. The observable gate is `check_preamble_payload_budget`, which reads the in-repo projection: **137,708 → 136,348 (−1,360)**, reproducible in CI. Full measurement + the projection-state trap: `agents/evidence/analysis/standing-payload-diet-per-rule.md` § 3.
- [x] **1.4 Prove the moved prose is still reachable.** Every passage relocated
      in 1.3 has an inbound pointer from the rule it left.
      verify (discharged): `check_references` → `✅  No broken references found.` over 1,534 scanned references; `check_condensation` → `✅  Condensation quality check passed.` over 468 artefacts, which under ADR-201 asserts `dist == rewrite(src)` **byte-for-byte** — so the projection cannot have dropped a relocated passage. Every migrated block landed in a destination the rule links inbound, and each destination names the rule and the section it came from, so the trail runs both ways.

## Phase 2 — publish the per-rule before/after, misses included

A diet with no published per-rule number is unfalsifiable. The failure mode this
phase exists to prevent is the one where a total drops, the roadmap closes, and
nobody can say which rules actually got shorter and which were merely counted.

- [x] **2.1 Publish the per-rule before/after table.** One row per rule touched:
      measured tokens before, after, delta, and where the remainder went. Exact
      tokenizer, never the chars/4 proxy, and the method named in the table
      header — this tree already distinguishes the two and a table that hides
      which one it used is not evidence.
      verify (discharged): `agents/evidence/analysis/standing-payload-diet-per-rule.md` § 1 carries one row per rule touched — before, after, delta, the `norm` pin, and the destination path. The header names **both** methods and says which figure uses which: per-rule is exact BPE over the body below frontmatter (`gpt_tokens(strip_frontmatter(text))`, the same function `lint_rule_norm_pin` enforces with), gate totals are quoted in each gate's own basis. `check_standing_rule_delivery` prints `tokens_gpt: exact (tiktoken cl100k_base); tokens_claude: proxy (chars/3.6)`, quoted in the header. The pin-derivation rule is published too (measured post-diet body rounded up to the next 50), because Risk 3 is that a pin becomes a number nobody derived.
- [x] **2.2 Publish the misses in the same table.** Every rule that was targeted
      and did not shrink, with one sentence on why. A rule whose body is
      irreducibly normative is a legitimate row, and it is the row that tells the
      next reader where the lever stops working.
      verify (discharged): `grep -ci "no reduction\|irreducible\|miss" agents/evidence/analysis/standing-payload-diet-per-rule.md` → **4**. § 2 publishes four rows of it: (2a) the near-miss `roadmap-progress-sync` at −88 = 3.6 %, with its per-section line counts showing every remaining section is an Iron Law or an operational checklist, i.e. **irreducibly normative** — this is where the lever stops working; (2b) `active-remediation`, examined and dropped before any edit, recorded because "we looked and found nothing" differs from "we did not look"; (2c) the largest un-taken target, named rather than skipped — **five rules carry a bespoke 10–20 line duplicate** of the same `pre_tool_use` host-enforcement correction (`grep -ln "2026-08-17" src/rules/*.md`), four of them left for the next pass; (2d) zero targeted rules missed, stated explicitly along with why that says less than 2a–2c do.
- [x] **2.3 Reconcile against both gates and record the residual.** If either
      gate is still over its ceiling after the diet, the residual is written down
      with the mechanism that would close it — never re-baselined to make the
      read green.
      verify (discharged): both quoted in § 3. `check_preamble_payload_budget`: **137,708 → 136,348 (−1,360)** against a 107,646 ceiling, leaving a **+28,702 residual** written down with four named closing mechanisms and their expected magnitudes — none claimed sufficient alone. `check_standing_rule_delivery`: **cannot observe this diet**, measured and explained in § 3b, with the worktree's 204,392/217-file reading recorded separately as a projection-state sensitivity check and explicitly not as a replication. `git diff` over `src/config/preamble-payload-budget.json` is **empty** on this branch — `baseline_tokens` stays 102,520 (AC-6). Per the council obligation added at `b-behavioural-bench-spend`, § 3a item 3 reports the excluded tranche's own opportunity separately and claims no corpus-wide sufficiency.

## Blockers

### blocker: b-behavioural-bench-spend
- **Status:** resolved
- **Resolved by:** AI council, 2026-08-23, **unanimous 2/2 for option (b)** —
  `agents/runtime/council/responses/spd-behavioural-bench-spend.md`
  (anthropic/claude-sonnet-4-5 + openai/codex-default, 2 rounds, blind chairman,
  $0.0404). Both seats named constraint 3 (attribution) as decisive: two levers on
  the same files make the published delta unattributable to either. Both also
  rejected option (a) on a second, independent ground the roadmap had not stated —
  the parked sibling's own A/B arms **differ by 2 rules, not by 15**, so the run
  could not have answered a fifteen-rule question even if it had been authorised.
  Spend was pre-authorised throughout; the council decided HOW, and chose the
  option that costs nothing today.
- **Prerequisite the council added, and it changed the count:** both seats refused
  to let "exclude the fifteen" stand as the exclusion, because the sibling's own
  document reports 19, 17 and 15 for overlapping-but-undefined sets. They required
  a **frozen, basename-by-basename manifest reconciled against the sibling's
  19-row disposition table**. Reconciled here from the tree rather than from the
  document: `./scripts-run src/scripts/rule_activation_census` reports **17 mixed
  rules by name** — the sibling's 19 minus the two the amendment already restored
  to `paths:` (`design-review-after-ui-write`, `ui-audit-gate`). The "fifteen" is
  the sibling's further subset of those 17 whose *dispositions* rest on an
  unverified premise; one of the two rules it excludes from that subset
  (`design-review-after-ui-write`) is already out of the mixed set entirely, which
  is the arithmetic defect the council flagged. **The manifest is therefore the 17,
  a strict superset of the fifteen, so the attribution guarantee is stronger than
  the blocker asked for.**
- **The frozen exclusion manifest (17):** `augment-edit-discipline` ·
  `design-fidelity` · `doc-screenshot-hygiene` · `domain-adoption-policy` ·
  `framework-neutrality-in-generic-skills` · `image-likeness-and-rights` ·
  `laravel-translations` · `lethal-trifecta-guard` ·
  `linked-projects-onboarding-gate` · `low-impact-corpus-privacy-floor` ·
  `markdown-safe-codeblocks` · `onboarding-gate` · `persona-governance` ·
  `php-coding` · `provider-lifecycle-discipline` · `roadmap-ci-steps-policy` ·
  `settings-ask-protocol`. No rule in this list was read for targets, edited, or
  counted in this roadmap's claimed reduction.
- **Owner:** maintainer
- **Class:** 2 — consent-once (name a budget, or defer to the budget ledger)
- **Blocks:** nothing any more. It gated Phase 1.3's target selection; 1.3 now
  excludes the manifest above by name.
- **What to do:** *(discharged)* option (b) — the 17 are out of scope for this roadmap for
  its duration. Phase 1.3's wording was replaced with the council's own text, and
  Phase 2.3 carries the reporting obligation both seats required: the excluded
  tranche's opportunity is reported separately and no corpus-wide sufficiency is
  claimed (`standing-payload-diet-per-rule.md` § 3a item 3).
- **Kill criteria** (union of both seats): the sibling unparks while this roadmap
  is open · no stable disjoint manifest can be derived · the sibling edits an
  eligible pilot rule before measurements freeze · the eligible corpus cannot
  materially affect the residual · P4 relocation turns out to change trigger reach,
  disproving lever independence · the published delta is read as covering the whole
  estate.
- **If you do nothing:** *(historical)* Phase 1.3's pilot would have picked targets
  without knowing whether they were contended, making the Phase 2 numbers
  uninterpretable.
- **Resolved when:** option (b) recorded with a frozen reconciled manifest, and
  Phase 1.3 excluding exactly it. **Both done** — see the manifest above and the
  amended 1.3.

### blocker: b-colleague-machine-readings
- **Status:** resolved
- **Resolved by:** AI council, 2026-08-23, **unanimous 2/2 for option (b)** —
  `agents/runtime/council/responses/spd-colleague-machine-readings.md`
  (anthropic/claude-sonnet-4-5 + openai/codex-default, 2 rounds, $0.0256). Both
  seats took constraint 2 as decisive: option (a) needs another person's consent
  and filesystem, so an autonomous run picking it picks a step it cannot
  discharge. Both also **rejected** the partial substitute the question offered —
  a second reading on the same machine under a different projection state is a
  *projection-state sensitivity check*, never a replication, because measuring one
  filesystem twice with different slicing criteria creates no independent
  evidence. It is recorded separately and never as a table row.
- **Owner:** maintainer
- **Class:** 2 — consent-once (another person's filesystem)
- **Blocks:** nothing any more. Phase 2's scope line and AC-5's replacement text
  both landed.
- **What to do:** *(discharged)* option (b) — scope the claim, tightened by both seats from
  "same machine" to **same machine AND same projection state**, since the supplied
  facts already showed the projection state moves the file set from 118 to 103.
  One seat's proposed hardware/OS wording was explicitly rejected by the other as
  inventing detail the facts did not establish, and the rejection was adopted: the
  scope line names no hardware.
- **Scope line, verbatim, now in the Phase 2 table header:** *"All
  `check_standing_rule_delivery` and `check_rule_layer_partition` figures in this
  document are machine-local measurements from the maintainer's machine, and each
  before/after comparison uses the same checkout and projection state. They
  establish only the change for that measured local installation; they do not
  establish a reduction on other machines or installations. Any worktree reading
  is reported separately as a projection-state sensitivity check, never as an
  independent replication."*
- **Kill criteria:** the resolution is falsified if any Phase 2 text describes the
  result as general, typical, representative or repository-wide without the
  machine-local qualifier; if the before and after were taken under different
  projection states; or if the figures cannot be reproduced from the documented
  local state. A later second-machine failure does **not** falsify the scoped
  result — it falsifies any generalisation of it.
- **If you do nothing:** *(historical)* Phase 2 would publish a single-machine
  number phrased as a general one.
- **Resolved when:** either a second machine's readings appear, or the table header
  carries the explicit single-machine scope. **The header carries it**
  (`agents/evidence/analysis/standing-payload-diet-per-rule.md`, § Measurement
  scope).

**Consequence this decision did not cover, recorded here because it landed on the
same surface:** executing Phase 2 showed `check_standing_rule_delivery` cannot
observe this diet on ANY machine without a global reinstall — all three dieted
rules live in its global layer, which is a past-install snapshot. AC-5 was
descoped to `agents/roadmaps/stubs/standing-rule-delivery-observability.md` after
the council returned INCONCLUSIVE on the re-scope (0/2 present, quota exhausted).
Full measurement: `standing-payload-diet-per-rule.md` § 3b.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-22 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The diet deletes instead of relocating | implementation | `preservation-guard` requires every paragraph, bullet and fence to survive a transformation. A body diet is exactly the transform it governs, and the cheapest way to hit a token target is to drop the rationale outright | Phase 1.4 gates on `check_references` and `check_condensation`; the `norm` semantic in 1.1 requires a pointer to where the remainder went, so a pin without a destination is malformed | Phase 1 — the body diet: a `norm` pin plus its lint |
| 2 | Phase 0's re-derivation finds no burst at all | product | The source figure does not reproduce by a factor of nineteen. The real answer may be that the corpus was already over and the 102,520 baseline is simply stale, which would mean the diet has no recent inflow to reverse and must shrink long-standing prose instead | 0.1 explicitly accepts "no burst" as a finding and says it changes Phase 1's target selection; the pilot in 1.3 is driven by the census ranking, not by recency | Phase 0 — stop the drift before dieting |
| 3 | `norm` becomes a number nobody derives | implementation | A per-rule pin invented at authoring time is an invented threshold. If pins are guessed, the lint enforces guesses and the gate teaches authors to pick a comfortable number | 1.1 makes the key optional and 1.2 reports the un-pinned count; pins land only on rules the Phase 0 census actually measured, so every pin has a measurement behind it | Phase 1 — the body diet: a `norm` pin plus its lint |
| 4 | The delta comment becomes a second blocking gate | implementation | A per-PR number that fails a build duplicates the ratchet and double-fails every legitimate rule addition, which is how a reporting surface becomes noise people route around | 0.3 states report-only in the step itself; the ratchet stays the only failing gate on this number | Phase 0 — stop the drift before dieting |
| 5 | Two levers contend for the same fifteen rules | implementation | The parked sibling holds fifteen always-on rules behind `b-behavioural-bench-spend`. If the diet also targets them, the published before/after cannot attribute its delta to either lever | `b-behavioural-bench-spend` forces an explicit in-or-out decision before 1.3 picks targets | Phase 1 — the body diet: a `norm` pin plus its lint |
| 6 | Phase 2's number is single-machine and reads as general | product | Both gates are machine-local by construction; the global layer's file count is whatever one developer projected | `b-colleague-machine-readings` forces either a second reading or an explicit scope line in the table header | Phase 2 — publish the per-rule before/after, misses included |

## Acceptance Criteria

- [x] AC-1 — `src/scripts/schemas/rule.schema.json` carries a `norm` key with a
      stated semantic, and at least one rule file declares it. Before this
      roadmap the key existed nowhere in the tree (0 hits, measured 2026-08-22).
      **Met:** `rule.schema.json:58`; pre-state `git show HEAD:… | grep -c '"norm"'`
      = 0. Three rules declare it — `context-hygiene` (2000),
      `roadmap-progress-sync` (2400), `evaluator-independence` (1500) — and each
      pin names the destination its remainder went to, because the schema requires
      `tokens` and `remainder` together.
- [x] AC-2 — A lint measures every declared `norm` pin with the exact tokenizer
      and reports the un-pinned remainder as a count, so the un-pinned fraction
      is a published number rather than an unknown.
      **Met:** `src/scripts/lint_rule_norm_pin.ts`, exact BPE over the body below
      frontmatter, printing `3 rule(s) declare \`norm\`, 117 do not` on the green
      path. It refuses rather than falling back to the proxy (exit 2 with no
      tokenizer). `--self-test` 5/5, 3 rejecting.
- [x] AC-3 — A per-PR standing-payload delta against the merge-base is posted on
      pull requests and is registered in the gate ledger under CI-identical argv.
      It reports; it does not fail a build.
      **Met, with one part verified by this PR's own CI rather than locally.**
      `.github/workflows/standing-payload-delta.yml` resolves
      `git merge-base origin/<base_ref> HEAD` (with `fetch-depth: 0`), renders the
      comment via `check_standing_payload_delta --rank`, and posts it with the
      same pinned sticky-comment action `bench-drift.yml` already uses. Registered
      in `src/config/gate-coverage.yml` under `["--base", "HEAD", "--quiet"]` with
      `min_scanned: 3`; `check_gate_coverage` is green with the entry present. The
      rendered body is verified locally (it reports this branch's own
      **−1,360 credit**). Report-only is proven locally, not asserted: the gate
      returns 0 on any delta and its self-test's reject cases are an unreadable
      ref and a usage error, never a moved number. **What only CI can confirm is
      that GitHub renders the comment**, and that is observable on this PR.
- [x] AC-4 — A per-rule before/after table exists under
      `agents/evidence/analysis/`, names its tokenizer method in the header, and
      contains the rules where the diet achieved nothing alongside the rules
      where it worked.
      **Met:** `agents/evidence/analysis/standing-payload-diet-per-rule.md` — § 1
      the three rows, § 2 the misses in four parts including the near-miss at
      −88 with its per-section evidence and the largest un-taken target named.
      The header states both bases and which figure uses which.
- [-] AC-5 — **DESCOPED**, not met and not silently dropped:
      `agents/roadmaps/stubs/standing-rule-delivery-observability.md`.
      It asked `check_standing_rule_delivery` for a lower total. Executing it
      established that this gate **cannot observe a rule-body diet at all** — all
      three dieted rules live in its global layer (`~/.claude/rules/`, a
      past-install snapshot, still carrying pre-diet bodies), and its project
      layer carries only the 15 package-only rules. Making it observable needs a
      `agent-config install` that rewrites the developer's home directory, which
      an autonomous run does not do. Re-scoping the criterion onto the sibling
      gate is a criterion weakening, so it was put to the AI council, which
      returned **INCONCLUSIVE (0/2 present, quota exhausted: anthropic 53/50,
      openai 50/50)**. The substantive reduction the criterion existed to protect
      is recorded against the gate that CAN observe it — `−1,360` on
      `check_preamble_payload_budget`, § 3a — and the stub carries the three
      candidate mechanisms plus a reopen-or-retire decision for the next pass.
      Measurement: `standing-payload-diet-per-rule.md` § 3b.
- [x] AC-6 — `baseline_tokens` in `src/config/preamble-payload-budget.json` is
      unchanged by this roadmap. Any remaining overrun is recorded as a residual
      with its closing mechanism named, never absorbed by moving the ratchet.
      **Met:** `git diff` over that file is empty on this branch; the baseline
      stays 102,520 and no `baseline_history` entry was added. The **+28,702**
      residual is written down in § 3a with four named closing mechanisms and
      their expected magnitudes, none claimed sufficient alone.
- [x] AC-7 — The re-derived inflow attribution and the source-pass divergence are
      both written down with the commands that produced them, so the drift can be
      re-measured later against a stated method rather than a remembered one.
      **Met:** `agents/evidence/analysis/standing-payload-inflow-attribution.md`
      — § 2a/§ 2b the re-derivation (+1,225/−408 lines; +11,779 exact-BPE tokens)
      with both commands, § 4 the divergence table quoting the source's
      +19,679/−300 verbatim beside it, § 5 a five-command reproduction block.
