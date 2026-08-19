---
complexity: structural
status: ready
estate_offset_exempt: "adopted from a four-draft inbox reconciliation (agents/tmp.old/double-rules/) that consumed and replaced three parallel drafts plus a cross-review; the estate gains one roadmap and loses a four-way ambiguity. No sibling exists to archive against it: the defect is live at 185.3 % of the standing cap on a freshly regenerated tree, and no active roadmap owns it — road-to-standing-context-40k owns body LENGTH, which the Non-goals here separate from duplication by construction."
---

# Road to single delivery — one artefact, one layer, no duplicates

> **The invariant, decided by the operator 2026-08-19: PARTITION, not
> de-duplication.** Every rule and every skill is delivered from **exactly one**
> layer. What exists only for this package stays in the project layer and is not
> installed globally; everything else lives globally and is not projected into
> this repo. No artefact appears in both. ADR-226, which decided the opposite for
> this repository, is superseded rather than worked around.

> Measured 2026-08-19 on a **freshly regenerated** projection at `b490f3845`:
> **110 rules** arrive twice — the one figure both layers' shapes support (file
> against file). A further **290 skills and 40 commands** share a name across layers
> of DIFFERENT shape (project symlinks into `dist/`, global real directories and
> files), which is a delivery collision whose payload equivalence is **unverified**;
> an earlier revision summed all three as "440 delivered twice" and R2 review
> refused it. Standing rule prose is **203,873 tok against a 110,000 cap (185.3 %)**,
> and for 7 rules the unscoped global copy defeats the project copy's `paths:`
> scoping.

> Source (consumed inbox): `agents/tmp.old/double-rules/` — four drafts and two
> transcripts, reconciled here. See § Where this came from.

## The decision this roadmap implements

The operator's instruction, 2026-08-19, in their own framing: this package does
not need its own *global* rules; rules and skills that exist **only** for this
package may be kept locally and not installed globally, and the reverse; the
duplicates are to stop; and **ADR-226 is to be amended or deprecated and
replaced** rather than treated as binding.

That is an owner decision about this repository's delivery topology, and it
resolves by fiat a question three inbox drafts tried to answer by measurement:
*which copy wins.* Neither — the artefact exists once, and its scope decides
where. Recorded here because the roadmap's whole shape follows from it and a
later reader must not mistake it for an agent's inference.

**What it does not authorise, stated so the boundary is visible:** a change to
what a *consumer* receives. The 16 package-only rules are already excluded from
consumer installs by their `workspaces:` field, so the partition below moves this
repository's own topology and nothing else. Any consumer-visible default change
remains permission-gated ([`scope-control`](../../src/rules/scope-control.md)).

### The partition, measured

`workspaces:` already carries the answer — no new metadata is needed:

| | exclusively `[agent-config-maintainer]` → **project layer only** | everything else → **global layer only** |
|---|---:|---:|
| rules (117) | **16** | 101 |
| skills (290) | **0** | 290 |

So the target topology is **16 rules and zero skills** in `<repo>/.claude/`, and
**101 rules plus 290 skills** in `~/.claude/`. Overlap: zero, by construction
rather than by suppression.

The 16: `augment-edit-discipline`, `domain-adoption-policy`,
`framework-neutrality-in-generic-skills`, `low-impact-corpus-privacy-floor`,
`no-roadmap-references`, `package-ci-checks`, `persona-governance`,
`preservation-guard`, `rule-type-governance`, `size-enforcement`, `skill-quality`,
`source-confidentiality`, `source-of-truth`, `telegraph-speak`,
`token-budget-discipline`, `token-optimizer-maintenance` — enumerated in full,
because "and two more" left AC-3's target set unenumerated anywhere (R2 review).

**Zero skills is not an error and is worth stating twice.** No skill in the tree
declares `workspaces: [agent-config-maintainer]` alone, so under the partition
this repo's `.claude/skills/` is **empty** and every skill is delivered globally.
That removes all 290 duplicate catalogue entries in one move, which is the largest
single win available here.

## Context — the defect, measured

**Two producers, neither aware of the other.**

- **Path A, consumer: two installs.** `src/scripts/_lib/scope_guard.sh`
  classifies an install at the other scope `OK` / `WARN` / `DRIFT`. Same version
  → `WARN`, and its own comment at `:15` reads *"Same content; duplicate
  registration but no drift."* — the caller proceeds.
  `docs/contracts/install-scopes.md:28` states it as policy. **Refuted by cost:**
  the guard classifies by drift risk and never by context cost, and the live case
  is ~90k standing tokens at *identical* versions.
- **Path B, maintainer: one install plus one generation.** The project layer is
  written by `task generate-tools`, the global layer by an install. Verified:
  `generate_tool_configs.ts` and `condense.ts` contain **zero** references to
  `rule_layer_overlap`, `scope_guard` or `_gate_rule_layer_overlap`. An
  install-time gate cannot see a layer written afterwards by another producer.

**The existing gate covers a fraction.** `_gate_rule_layer_overlap`
(`install.ts:2216`) is rules-only, Claude-only, install-time-only, is not
exercised by `--dry-run` (its own docstring says so), and its remedy
`claudeMdExcludes` is absent from both layers on this machine. No skill-layer
equivalent exists: `compareLayers` / `rule_layer_overlap` / `readRuleLayer`
appear in exactly three files.

**A gate written for this was inert.** `check_rule_projection_integrity` exists
for "stale tree on a developer's working checkout" and is ordered first in
preflight. Run locally it reports *"no host rule tree is active
(`agents/.agent-tools.yml` selects zero tools) — nothing to audit."* So the stale
projection that produced two refuted inbox drafts was invisible to the one gate
meant to see it.

**The primitive the partition needs already exists.** `rule_in_scope(p, scope,
pack_scope)` is used at `condense.ts:1111`, `:1610` and `:1632`. The partition is
a different *predicate* for the project layer, not new machinery.

### Scope defeat — narrowed by the partition from 7 rules to 4

Of the 110 shared rules, **7 disagree on `paths:`** — project carries it, global
does not. `report_carrier_divergence` names the mechanism in its own output: **a
copy that lacks `paths:` defeats the other copy's scoping.** So these 7 load
unconditionally today and the project layer's scoping of them is inert.

ADR-227:79-80 records that *path-scoped rules are **not re-injected after
`/compact`**, so an obligation that must survive compaction cannot be
path-scoped at all.* The unscoped global twin is therefore **accidentally
preserving compaction survival** for these 7.

Under the partition the set splits, and only one half keeps the problem:

- **3 go global-only** — `design-review-after-ui-write`, `roadmap-progress-sync`,
  `ui-audit-gate`. The global copy has no `paths:`, so they load unconditionally
  and survive `/compact`. Resolved by the partition itself.
- **4 stay project-only and keep their `paths:`** — `no-roadmap-references`,
  `rule-type-governance`, `skill-quality`, `source-confidentiality`. Once their
  unscoped global twin is gone they become path-scoped only, and stop surviving
  `/compact`. Three of the four carry Iron Laws.

That residue is a real correctness question the partition does not answer, so it
is `[~]` behind a blocker rather than decided here.

## Non-goals

- **Deleting anything under `~/.claude/`.** Hard Floor
  ([`non-destructive-by-default`](../../src/rules/non-destructive-by-default.md)).
  The partition changes what producers *write*, never what is removed by hand.
- **Changing what a consumer receives.** See § The decision above.
- **Shrinking rule bodies.** Owned by `road-to-standing-context-40k` Phase 2 and
  `road-to-cost-parity-1-rule-payload-diet`. Duplication and length are separate
  terms; conflating them is how a 185 % reading gets blamed on prose.
- **Re-deriving `paths:` as a corpus lever.** ADR-227 recorded it saturated. Here
  it is read only as a divergence axis and a compaction property.

## Where this came from — four drafts, two of them refuted

| draft | contributed | status |
|---|---|---|
| `ac-chat/road-to-single-delivery.md` | per-type census incl. the skills half; the two-producer diagnosis; the gate-coverage audit | **census refuted** — stale projection |
| `gpt/road-to-single-delivery-invariant.md` + `-consolidated.md` | complementary layers; ADR-226; the delivery-manifest framing | ADR-226 pointer **confirmed** |
| `claude/road-to-single-copy-delivery.md` | the ADR-227 `/compact` precondition | **confirmed, load-bearing** |
| `claude/cross-review-single-delivery.md` | that the ac census was stale; that `claudeMdExcludes` is file-glob capable | **both confirmed** |

The refutation, verified here rather than accepted: the ac draft measured a
project tree of **92 symlinks into `dist/agent-src/rules/` dated 5 July** with
**zero** `paths:` frontmatter — the pre-#1231 shape. After
`task sync && task generate-tools` the same checkout emits **111 real files, 8
carrying `paths:`**:

| | stale tree (ac draft) | **fresh tree** |
|---|---:|---:|
| rules in both | 91 | **110** |
| rules global-only | 24 | **5** |
| skills in both | 261 | **290** |
| shared rules PROSE-divergent | 0 | **0** |
| shared rules FRONTMATTER-divergent | 0 | **110** |
| of those, `paths:`-disagreement | 0 | **7** |
| standing total | 195,383 tok (177.6 %) | **203,873 tok (185.3 %)** |

Three consequences: the "24 global-only live obligations" is **5** and they are
not safety floors (`analysis-skill-routing`, `brand-consistency`, `guidelines`,
`package-ci-checks`, `size-enforcement`); the duplication is **worse**, not
better; and `install --layer` is unavailable on a fresh tree at all, because the
gate refuses a suppression over divergence and a fresh tree is 110-way divergent.
The partition sidesteps that remedy rather than repairing it.

## Phase 0 — Pin the measurement so no fifth draft repeats the fourth's error

- [x] **0.1** Commit the fresh-projection census as an evidence artefact:
      per-type counts, the divergence breakdown, the 7 `paths:`-disagreement rules
      by name, the 16/101 and 0/290 partition sizes, and the stale-versus-fresh
      table — each with the command that produced it.
      `verify:` the artefact carries the projection shape (symlink vs emitted, and
      the `paths:`-carrying count) as a REQUIRED field, since its absence is what
      produced two refuted drafts.
      **DONE 2026-08-19:**
      [`single-delivery-partition-census.md`](../evidence/analysis/single-delivery-partition-census.md).
      The projection-shape block is the artefact's first section and states
      `EMITTED REAL FILES (post-PR-#1231) · 111 real files, 0 symlinks · 8 carrying
      paths:`, with the reason a census is uninterpretable without it. Also records
      the `grep -l` over-count (73 vs the measured 16) because that is the number a
      casual probe returns.
- [x] **0.2** Record the gate reach hole as a finding:
      `check_rule_projection_integrity` reports "nothing to audit" when
      `agents/.agent-tools.yml` selects zero tools, the maintainer's normal local
      state. Name what it would have caught, and that CI activates all eight so
      the hole is local-only.
      `verify:` the gate's own output is quoted in the artefact.
      **DONE 2026-08-19** — quoted verbatim in the census § "The gate that should
      have caught the stale tree, and did not", with the local-only bound stated so
      it is not read as a CI gap.

**AC-0:** any future reader can tell from the artefact alone whether a census was
taken on a stale or a fresh projection.

## Phase 1 — Replace ADR-226

- [x] **1.1** Write the successor ADR recording the partition decision, its
      owner, and its reasoning; mark ADR-226 `superseded_by` it and state in
      ADR-226 what changed (the operator's topology decision, not a refuted
      measurement — its `source-of-truth.md` asymmetry was confirmed, and the
      partition keeps that rule in the project layer where ADR-226 wanted it).
      `verify:` the ADR index regenerates consistently and `check_references` is
      green on both records.
      **DONE 2026-08-19:**
      [`ADR-235`](../../docs/decisions/ADR-235-one-artefact-one-layer.md) accepted,
      `supersedes: ADR-226`; ADR-226 flipped to `status: superseded` with
      `superseded_by: ADR-235` and a Status section stating which of its arguments
      were re-verified (both) and which two figures expired (22 → 5 rules, and
      prose divergence 2 → 0). Index regenerated with
      `adr/regenerate_index --dir docs/decisions` — note the flag: the script
      defaults to `docs/adr/` and prints `adr-dir not found` on this repo's legacy
      layout, which reads like a failure and is an argument error.

**AC-1:** ADR-226 is not silently bypassed; the tree records which decision is
live and why the earlier one was replaced.

## Phase 2 — Make the producers write disjoint layers

> **HALTED 2026-08-19 on a precondition this phase did not state — discovered
> while implementing 2.1, and recorded rather than assumed away.** The partition
> reduces `<repo>/.claude/` from 111 rules and 338 skills to **16 rules and zero
> skills**. Every artefact it removes is then delivered *only* by the global
> layer — so the phase silently assumes **the global install is present and
> current on every machine that opens this repository.** It is not stated
> anywhere, nothing checks it, and where it fails the consequence is not a token
> cost but an **under-governed checkout**: a fresh clone with no global install
> would receive 16 rules and no skills, where it receives 111 and 338 today.
>
> That is the same class of unstated-assumption failure that produced two refuted
> drafts in this roadmap's own inbox, so it gets a precondition step and a blocker
> rather than a best guess. `process-full` halt condition 4 —
> scope-out-of-roadmap work discovered.

- [ ] **2.0** State and check the precondition the partition rests on: a machine
      that holds the project layer must also hold a current global layer, and
      something must say so when it does not. Decide where that check lives and
      what it does on failure — refuse to project, warn, or project the full set
      as a fallback.
      **Blocked on `partition-requires-global-layer`.**
      `verify:` a checkout with no global rules layer produces a stated outcome
      rather than a silently reduced one.
- [~] **2.1** The project projection emits only exclusively-package-only
      artefacts: `<repo>/.claude/rules/` carries the 16, `<repo>/.claude/skills/`
      carries none. The predicate goes beside `rule_in_scope`
      (`condense.ts:1111`) — specifically beside `_scoped_rule_basenames()`
      (`condense.ts:1106-1122`), which is the selection this phase narrows — not
      into a new subsystem.
      `verify:` after `task sync && task generate-tools`, the project rule count
      is 16 and the project skill count is 0, and every one of the 16 is
      exclusively `[agent-config-maintainer]`.
      **Blocked on `partition-requires-global-layer` (2.0).**
- [~] **2.2** The global install excludes exclusively-package-only artefacts, so
      the partition holds from the other side too and a re-install cannot
      re-create the overlap.
      `verify:` a global install carries none of the 16.
      **Blocked on `partition-requires-global-layer` (2.0).**
- [~] **2.3** Re-measure standing delivery and the overlap after 2.1, and record
      both against the pre-partition figures.
      `verify:` `check_standing_rule_delivery` reports overlap 0; the total is
      recorded whether or not it clears the 110,000 cap, because the residue
      belongs to body length and not to this roadmap.
      **Blocked on 2.1.**

**AC-2:** overlap is zero for rules and skills, from either producer, and the
project layer contains exactly the package-only set.

## Phase 3 — Stop the two surfaces that call duplication free

- [x] **3.1** `scope_guard.sh` reports the cost. `WARN` means "same version,
      therefore fine" today; it must carry the overlap count per type. The verdict
      vocabulary is unchanged; the caller keeps deciding.
      `verify:` the guard names an overlap count for a two-scope layout.
      **DONE 2026-08-19.** `count_overlap()` added; WARN lines gain an **appended**
      field 6, so every existing field-indexed consumer keeps working — verified
      that `install.sh` parses with `awk -F'\t' '$1=="WARN" {... $2,$3,$4}'`, which
      an appended field cannot break. The header contract documents field 6 and
      replaces the refuted "Same content; duplicate registration but no drift"
      wording with the measurement. `install.sh`'s own WARN message said "(same
      version, no drift)" and now states the doubling with the per-tool count.
      **`-1` is returned rather than `0` when the count cannot be taken** — the
      copilot probe compares a single file, not a directory, and reporting "0
      overlap" for "did not look" is how a gate starts reading as coverage.
      Verified across all four branches by sourcing the script (it guards `main`
      behind `BASH_SOURCE`): 3 shared of 6 → `3`, two empty dirs → `0`,
      non-directory → `-1`, missing path → `-1`. And the counter **independently
      reproduces the census**: 110 rules, 290 skills on the live layers.
      **Honest gap:** no automated test covers this shell guard — none existed
      before this change either — so the verification above is manual and
      reproducible rather than pinned. A regression here would not red CI.
- [x] **3.2** Correct `docs/contracts/install-scopes.md:28`, which states the
      refuted premise as policy, and point it at the partition invariant.
      `verify:` `./scripts-run src/scripts/check_references` green.
      **DONE 2026-08-19** — the WARN row now reads "No drift, but **not free**"
      with the overlap count, and says in as many words what the old wording
      taught. A paragraph above the installer section carries the measurement and
      links the census and ADR-235.

**AC-3:** neither the guard nor the contract can be read as saying that
same-version duplication is free.

## Phase 4 — One producer-agnostic invariant check

- [x] **4.1** Ship a check that asserts the partition for **all** artefact types
      — rules, skills, commands, agents — independent of which producer wrote
      either layer, reporting `paths:` scope defeat separately from raw overlap
      because the two need different remedies.
      `verify:` the check reports overlap 0 after Phase 2 and reproduces a
      non-zero count on a deliberately re-created overlap.
      **DONE 2026-08-19 —** `src/scripts/check_single_delivery.ts`.
      **It found a third duplicated type on its first run: 40 commands.** The
      census's first version read `commands 93 / 0 / 0` because it was taken in the
      stale main checkout where no commands were projected; against a fresh
      worktree it is 93 / 40 with **40 in both**. Total delivered twice is
      therefore **440**, not 400, and the census is corrected.
      **Reports by default, `--enforce` exits 1.** Deliberate: the invariant is not
      true while Phase 2 is halted, and a blocking default would red every run on a
      defect nobody can currently fix — which is how a gate teaches readers to
      ignore it. The zero-overlap half of the verify above is therefore **pending
      Phase 2** and is stated as pending rather than claimed.
      Six paths verified with real exit codes — captured **without a pipe**, after
      a first attempt reported 0 for every case because `$?` after `| tail` is
      tail's: live report-only 0 · live `--enforce` 1 · disjoint layers `--enforce`
      0 · **read-nothing `--enforce` 1** · unknown flag 1 · `--global` without a
      value 1. The read-nothing case is the one that matters: a gate that compared
      nothing must not pass, and it does not.
      Two defects in the first draft were found by reading its own output:
      `types_compared` printed **-2** (it subtracted absent LAYERS from TYPES), and
      the exit-code verification was worthless for the reason above. Both fixed,
      and the field now prints `N of 4`.
- [x] **4.2** `task generate-tools` states the consequence it creates: it writes
      one layer and is silent about the other existing.
      `verify:` generating while the other layer holds an overlapping name prints
      the count and points at the check.
      **DONE 2026-08-19** — `_warn_layer_overlap()` in `condense.ts`, after the
      summary. Verified on a real run: `⚠️ a global layer holds the same names
      (rules=110 skills=290 commands=40)`, the same figures the census and
      `check_single_delivery` report independently.
      **Advisory, never failing.** `generate-tools` is the normal build step, and
      failing it on a topology the operator may not be able to change today would
      make the build unusable rather than the duplication visible. The check that
      can refuse is `check_single_delivery --enforce`.
      It skips silently when one layer is absent — nothing is doubled there, and a
      warning would be noise on exactly the topology this roadmap wants.
- [ ] **4.3** Bind the check where the person who can act on it sees it.
      **Blocked on `overlap-check-binding-surface`.**
      `verify:` the binding is named and a deliberate overlap surfaces there.

**AC-4:** the invariant is machine-checked, not maintained by hand.

## Phase 5 — The residue the partition does not resolve

Both `[~]`: authored here, decided elsewhere. Never started.

- [~] **5.1** The 4 project-only rules that carry `paths:` — `no-roadmap-references`,
      `rule-type-governance`, `skill-quality`, `source-confidentiality` — stop
      surviving `/compact` once their unscoped global twin is gone.
      **Blocked on `compact-survival-of-package-only-rules`.**
- [~] **5.2** Whether any host mechanism suppresses a *skill* registration, for
      the case where a consumer legitimately holds both layers.
      **Blocked on `host-skill-suppression-capability`.**

**AC-5:** each carries a recorded decision or a recorded null; neither is closed
by an agent's inference.

## Honest null consequence

If Phase 5.1 resolves that those 4 must keep an unscoped copy to survive
compaction, the partition is exact for 113 of 117 rules and all 290 skills, and
4 rules keep a deliberate, documented second copy. Publish that residue rather
than reporting a clean invariant that does not hold.

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-08-19 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The partition removes an obligation from a layer that was silently carrying it | product | The whole estate's value is that governed text arrives. A predicate that mis-classifies one rule drops it from the layer a session actually loads, and the failure is silent | The predicate reads `workspaces:`, which already governs consumer delivery, so it is not a new judgement; 2.1's verify asserts the count AND that every survivor is exclusively package-only; Phase 4 machine-checks the invariant afterwards | Phase 2 — Make the producers write disjoint layers |
| 2 | Compaction survival is lost for four Iron-Law rules | product | Once the unscoped global twin is gone, the 4 remaining project-only `paths:`-carrying rules are path-scoped only, and ADR-227:79-80 records that path-scoped rules are not re-injected after `/compact` | The 4 are named, 5.1 is `[~]` behind a blocker so no run picks a direction silently, and the Honest null consequence names the documented-second-copy outcome | Phase 5 — The residue the partition does not resolve |
| 3 | A census is taken on a stale projection and the design leans on it | product | This happened twice in the inbox that produced this roadmap: a 5-July symlink tree reported 24 global-only rules where a fresh tree reports 5 | Phase 0.1 makes projection shape a required artefact field, and the stale-vs-fresh table stays in this file rather than being deleted after the correction | Phase 0 — Pin the measurement so no fifth draft repeats the fourth's error |
| 4 | ADR-226 is treated as merely refuted | product | Its secondary argument moved (0 prose-divergent on a fresh tree) while its primary one — `source-of-truth.md` project-only, structural generated-vs-installed divergence — was confirmed; a successor that claims the record was wrong would discard reasoning that is still correct | 1.1 requires the successor to state what changed as a topology DECISION, and the partition keeps `source-of-truth` in the project layer exactly where ADR-226 wanted it | Phase 1 — Replace ADR-226 |
| 5 | A new check joins the set nothing invokes | implementation | `check_standing_rule_delivery` measures this defect and is registered in `taskfiles/dev.yml:136` — an earlier revision of this row said `ci-fast`, which is wrong against the tree and was corrected on R2 review; `dev.yml` documents it as a deliberate local reading, so it is a weaker precedent than claimed but still one nobody runs; `check_rule_projection_integrity` is inert with zero tools selected | 4.3 is blocked on an explicit binding decision rather than defaulted, and 0.2 records the second hole so it is not rediscovered as a surprise | Phase 4 — One producer-agnostic invariant check |
| 6 | A checkout without a current global layer is left under-governed | product | The partition delivers all but 16 rules and all 290 skills from the global layer alone, so a fresh clone, a CI runner or a colleague who never ran the installer would drop from 111 rules and 338 skills to 16 and 0 — silently. This is the risk that HALTED Phase 2: it was not in the phase when it was written, and it was found by implementing it | Phase 2.0 makes the precondition an explicit step, blocker `partition-requires-global-layer` reserves the fallback choice, and the recommendation makes the partition conditional on a machine holding both layers so omission cannot cost governance | Phase 2 — Make the producers write disjoint layers |
| 7 | The projector change reds a wide set of generated-output gates | implementation | Changing what the project layer emits moves counts, byte-stability baselines and projection-integrity readings at once, which is the classic multi-gate cascade | 2.1 is one predicate beside an existing filter rather than a restructure, 2.3 re-measures immediately, and the phase order puts the measurement and the ADR before the mechanism so a halt leaves a coherent partial state | Phase 2 — Make the producers write disjoint layers |

## Blockers

### blocker: partition-requires-global-layer
- **Status:** open
- **Owner:** maintainer
- **Class:** 2 (a design decision with an under-governance failure mode)
- **Blocks:** Phase 2 entirely — steps 2.0, 2.1, 2.2 and through 2.1 also 2.3.
  Phases 0, 1, 3 and 4 do not depend on it: the census, the ADR, the two
  cost-classification surfaces and the invariant check all land while the
  partition itself waits.
- **The question:** the partition leaves `<repo>/.claude/` with 16 rules and zero
  skills, so every other artefact is delivered *only* by the global layer. What
  happens on a machine that has the project layer and no current global one — a
  fresh clone, a CI runner, a colleague who never ran the installer? Today such a
  checkout receives 111 rules and 338 skills; after the partition it would receive
  16 and 0, and nothing would say so.
- **Why an agent may not decide it:** the failure mode is an under-governed
  session, which is the one class of regression this estate exists to prevent, and
  the fallback choice (refuse / warn / project the full set) is a trade between
  silent under-governance and silently re-creating the duplication. Both are
  operator calls.
- **What to do:** pick one of three enumerated options and record it.
  **(a)** `task generate-tools` refuses to write a partitioned project layer when
  `~/.claude/rules/` is absent or older than the installed release, pointing at
  `agent-config install`; **(b)** it warns and partitions anyway; **(c)** it falls
  back to projecting the full set, so a machine without the global layer keeps
  today's behaviour and only a machine with both gets the partition. Probe the
  current state with
  `ls ~/.claude/rules | wc -l` and `agent-config routing:doctor` before choosing.
- **Recommendation:** **(agent-drafted 2026-08-19 — from the measurement, not a
  maintainer decision.)** Option (c). It makes the partition a *property of a
  machine that has both layers* rather than a global behaviour change, so no
  checkout can lose governance by omission, and the duplication it leaves behind
  on a single-layer machine is not duplication at all — there is only one layer
  there. (a) turns a missing optional install into a hard failure of the normal
  build; (b) is the silent under-governance itself.
- **If you do nothing:** Phase 2 stays halted and the duplication stays live. That
  is the safe direction of this particular non-decision, which is why the phase
  halts rather than shipping a default.
- **Resolved when:** the option is recorded in ADR-235 or an amendment to it, and
  2.0's verify can be run against it.

### blocker: compact-survival-of-package-only-rules
- **Status:** open
- **Owner:** maintainer
- **Class:** 2 (a correctness trade-off with no dominant option)
- **Blocks:** Phase 5 step 5.1 only. Phases 0-4 measure, decide the topology and
  ship the partition; 4.1 deliberately counts scope defeat separately so this
  decision has a number.
- **The question:** `no-roadmap-references`, `rule-type-governance`,
  `skill-quality` and `source-confidentiality` are exclusively package-only AND
  carry `paths:`. Under the partition their unscoped global twin disappears, so
  they become path-scoped only and stop surviving `/compact` (ADR-227:79-80).
  Three of the four carry Iron Laws. Which property is kept?
- **What to do:** run
  `grep -l '^paths:' src/rules/{no-roadmap-references,rule-type-governance,skill-quality,source-confidentiality}.md`
  to confirm the set, then pick one of three enumerated options and record it:
  **(a)** delete the `paths:` key from those four in `src/rules/` so they load
  unconditionally in the project layer; **(b)** keep `paths:` and accept that they
  do not survive compaction; **(c)** grant those four a documented exception to
  the partition and keep an unscoped global copy.
- **Recommendation:** **(agent-drafted 2026-08-19 — from the measurement, not a
  maintainer decision.)** Option (a). ADR-227 already found `paths:` saturated as
  a corpus lever, so the scoping buys little, while an Iron Law vanishing after a
  compact is a silent correctness failure. (a) also keeps the partition exact,
  where (c) puts a permanent exception into an invariant Phase 4 has to check.
- **If you do nothing:** Phase 2 ships and those four silently lose compaction
  survival — the worst of the three outcomes, because it is the one nobody chose.
- **Resolved when:** the option is recorded in the successor ADR or an amendment
  to ADR-227.

### blocker: host-skill-suppression-capability
- **Status:** open
- **Owner:** maintainer
- **Class:** 3 (host capability — needs one first-party observation)
- **Blocks:** Phase 5 step 5.2 only. The partition removes the duplicate skills
  at the producer, so nothing in Phases 0-4 waits on this; it matters for a
  consumer who legitimately holds both layers.
- **The question:** does `claudeMdExcludes` — or anything else the host offers —
  suppress a *skill* registration? The tree records it as file-glob capable for
  instruction files (`agents/evidence/analysis/claude-code-rules-dir-contract.md:81-92`,
  where the host's own example excludes a single file), but the skill catalogue is
  a different surface and nothing establishes the key reaches it.
- **What to do:** on a machine holding both layers, add
  `"claudeMdExcludes": ["<abs>/.claude/skills/**"]` to `~/.claude/settings.json`,
  start a session, and run the `capture_skill_catalogue` probe
  (`./scripts-run src/scripts/capture_skill_catalogue`) to see whether the
  excluded entries are absent from the delivered catalogue. Record the host
  version with the result. Either outcome closes this.
- **Recommendation:** **(agent-drafted 2026-08-19.)** Probe before designing.
  If the key does not reach the catalogue, the producer-side partition this
  roadmap ships is the only available lever and 5.2 closes as a recorded null
  rather than as work.
- **If you do nothing:** consumers who hold both layers keep paying duplicate
  catalogue entries, and this roadmap's win stays maintainer-local.
- **Resolved when:** the capability is recorded with its host version and source.

### blocker: overlap-check-binding-surface
- **Status:** open
- **Owner:** maintainer
- **Class:** 2 (a decision whose consequence the operator owns)
- **Blocks:** Phase 4 step 4.3 only. 4.1 and 4.2 land without it.
- **The question:** preflight, a session-start surface, or CI?
- **What to do:** pick one and register the check there — `task preflight` via
  `taskfiles/`, a `session_start` concern in `src/scripts/hook_manifest.yaml`, or
  a workflow under `.github/workflows/`. Then confirm a deliberately-created
  overlap surfaces on the chosen one.
- **Recommendation:** **(agent-drafted 2026-08-19.)** Preflight. The overlap is a
  property of the developer machine rather than of the branch, so CI would measure
  a topology no contributor has and be green while every local session pays. Two
  gates in this area are already unreachable where it matters, so a third unbound
  one would read as coverage while adding none.
- **If you do nothing:** Phase 4 ships a check with the same reach as the two that
  already exist, and a re-created overlap goes unnoticed.
- **Resolved when:** the surface is named and 4.3's verify runs against it.

## Acceptance criteria

- [ ] The fresh-projection census is committed with its projection shape as a
      required field.
- [ ] ADR-226 carries `superseded_by`, and the successor records the partition
      decision and its owner.
- [ ] `<repo>/.claude/rules/` carries exactly the exclusively-package-only set and
      `<repo>/.claude/skills/` is empty, after a normal
      `task sync && task generate-tools`.
- [ ] `check_standing_rule_delivery` reports overlap 0.
- [ ] Neither `scope_guard.sh` nor `install-scopes.md` states that same-version
      duplication is free.
- [ ] One check asserts the partition for every artefact type, counting scope
      defeat separately.
- [ ] Both Phase-5 questions carry a recorded decision or a recorded null.

## CUT list — do not re-litigate

- **Deleting `~/.claude/rules/` or `~/.claude/skills/`.** Hard Floor. Cut.
- **`install --layer` as the remedy.** Superseded by the partition, and
  unavailable anyway: the gate refuses over 110-way divergence. Cut.
- **Keeping both layers because ADR-226 said so.** Replaced by an owner decision;
  Phase 1 records the replacement rather than ignoring the record. Cut.
- **Reading "0 prose-divergent" as "safe to suppress".** The ac draft did, on a
  stale tree where the figure was 0 for the opposite reason. Cut, and recorded
  rather than deleted.
- **`paths:` as a corpus-shrinking lever.** ADR-227 found it saturated. Cut.
- **A census without its projection shape.** The failure that produced two of the
  four inbox drafts. Cut.
