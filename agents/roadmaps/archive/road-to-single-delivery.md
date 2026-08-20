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
      [`ADR-236`](../../docs/decisions/ADR-236-one-artefact-one-layer.md) accepted,
      `supersedes: ADR-226`; ADR-226 flipped to `status: superseded` with
      `superseded_by: ADR-236` and a Status section stating which of its arguments
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

- [x] **2.0** State and check the precondition the partition rests on: a machine
      that holds the project layer must also hold a current global layer, and
      something must say so when it does not. Decide where that check lives and
      what it does on failure — refuse to project, warn, or project the full set
      as a fallback.
      `verify:` a checkout with no global rules layer produces a stated outcome
      rather than a silently reduced one.
      **UNBLOCKED 2026-08-19 (option (c) recorded) and then HALTED AGAIN, one level
      deeper — `process-full` halt condition 4, discovered while implementing it.**
      Option (c) partitions only where a **current** global layer exists, and both
      council seats attached that same word: openai's condition reads *"absent or
      older than the installed release"*. **Measured: "older than" has no data
      source.** There is **no `package.json` beside `~/.claude/`** — it is a host
      directory, not an install root — so `installed_version_at` returns `unknown`
      for the global layer, verified directly. Present-vs-absent is decidable;
      **stale-vs-current is not**, and ADR-226 already recorded why a
      refresh-until-they-agree definition has no fixed point in a repository that
      is ahead of its own release by construction.
      **What closes it:** either a version marker the global layer actually carries
      (an installer-written stamp beside it), or a redefinition of the predicate to
      the half that is decidable — present/absent — with the staleness half
      explicitly dropped and its cost stated. Both are decisions, not measurements,
      and the second is a narrowing of a verdict the council just gave.
      **Not attempted on a guess:** building the partition on an undecidable
      predicate is how a mechanism ships against an assumption, which is the failure
      this roadmap's own Phase 0 exists to prevent.
      **Blocked on `partition-current-layer-undecidable`** — recorded as a blocker
      after R2 review, because the first version of this note left the halt as PROSE
      while flipping the earlier blocker to `resolved`. The effect was that **no open
      blocker blocked Phase 2**: the dashboard stopped explaining the halt, the
      decidability fields never applied to the live decision, and `open_blockers`
      walked 74 → 73 while the number of open *decisions* had not changed. That is
      the ratchet being satisfied by not recording a decision, which is the exact
      failure `check_estate_count`'s own history warns about from the other side.
      **CLOSED 2026-08-20.** The blocker is resolved (see its entry: operator
      decision on a 2/2 council round, plus the two measurements that decided it —
      the 5.85 s figure was a shell artefact worth 61 ms in Node, and version
      equality was measurably insufficient at 153 project-only skills under an
      identical version string).
      **Where the check lives:** `_resolve_partition_verdict()` in
      `src/scripts/condense.ts`, directly beside `_scoped_rule_basenames()` as this
      step required — not in a new subsystem. It reads the existing
      `installed.lock` and delegates the decision to
      `src/install/partitionEligibility.ts::partitionVerdict`, a total function
      that never throws and never refuses.
      **What it does on failure:** option (c)'s fallback — full projection, always.
      Absent host layer, absent install record, absent version, version mismatch in
      either direction, absent fingerprint, content drift, or an unreadable layer
      all resolve to `standalone/full`. A refusal was eliminated by fact, not
      preference: `.github/workflows/consistency.yml:169` runs `task generate-tools`
      on a fresh checkout whose host layers are absent by that workflow's own
      comment at `:172-174`.
      `verify:` **RAN, four states, 2026-08-20** — each prints its outcome and
      none silently reduces:
      · no host layer → `standalone/full — no host-global layer on this machine`, 113 rules
      · host layer, legacy record → `standalone/full — install predates host-layer fingerprinting`, 113 rules
      · verified layer → `dual-layer/partitioned — host layer verified at 14.6.0`, **13 rules**
      · layer drifted after the record → `standalone/full — host-layer content differs`, 113 rules
      **The mode line is emitted via `success()`, not `info()`, and that was a
      defect caught in this step rather than a stylistic choice:** `info()` prints
      only at `verbose`, so the first implementation withheld ~100 rules while
      printing nothing in the default `minimal` run — the silent partition both
      council seats explicitly required this line to prevent.
      **Finding against AC-2, recorded not adjusted: the projected count is 13, not
      16.** 16 is the SOURCE set (`workspaces: [agent-config-maintainer]` exclusively,
      measured). Three never reach a project symlink under any mode, for reasons that
      pre-date this phase: `package-ci-checks` and `size-enforcement` are `type:
      manual` (ADR-004 — a manual rule costs zero workspace budget), and
      `telegraph-speak` is compile-disabled by default (it is dormant absent
      `telegraph.speak`). So the acceptance criterion's "16" describes the selection
      input and "13" the emission; both are correct about different things, and the
      AC is amended below rather than the measurement being bent to fit it.
      Tests: `tests/scripts/single_delivery_partition.test.ts` (17 cases, and the
      mechanism was sabotaged in three places to confirm they go red — a test never
      seen red has unknown sensitivity).
- [x] **2.1** The project projection emits only exclusively-package-only
      artefacts: `<repo>/.claude/rules/` carries the 16, `<repo>/.claude/skills/`
      carries none. The predicate goes beside `rule_in_scope`
      (`condense.ts:1111`) — specifically beside `_scoped_rule_basenames()`
      (`condense.ts:1106-1122`), which is the selection this phase narrows — not
      into a new subsystem.
      `verify:` after `task sync && task generate-tools`, the project rule count
      is 16 and the project skill count is 0, and every one of the 16 is
      exclusively `[agent-config-maintainer]`.
      **DONE 2026-08-20, and the placement this step demanded was honoured:** the
      partition filter is a `.filter()` inside `_scoped_rule_basenames()` itself,
      and the verdict resolver `_resolve_partition_verdict()` sits immediately
      above it. No new subsystem.
      `verify:` **RAN.** Generated against a synthetic verified host layer:
      `rules=13 skills=0 commands=0`, and the project skill directory is **empty
      on disk** (0 entries). Against an unverified layer: `rules=113 skills=290
      commands=48`, 338 entries on disk. Both counted with
      `tests/scripts/single_delivery_emission.test.ts` and reproduced by direct
      generation.
      **The skill count of 0 is not an assumption — it is measured.** NO skill in
      `src/skills/` carries `workspaces: [agent-config-maintainer]` exclusively
      (0 of 290), so the package-only set is empty on that axis and the whole
      skill corpus is delivered globally. Had even one been package-only, "carries
      none" would have been wrong and this step would have had to say so.
      **Two findings this step produced, neither of them cosmetic:**
      · **Commands share the skills directory, and were silently in scope.**
      `generate_claude_commands` writes into `CLAUDE_SKILLS_DIR`, not a
      `commands/` directory — while the host layer keeps them apart in
      `~/.claude/commands`. Emptying the project directory therefore withholds
      commands too, so `_host_layer_inputs` was widened to fingerprint
      `~/.claude/commands` BEFORE anything was withheld. Withholding an artefact
      class that the verification did not cover would have been precisely the
      under-governance this phase's precondition exists to prevent.
      · **A partitioned run left 8 symlinks behind while both counters read
      zero.** `brand`, `brand-identity`, `brand-strategy`,
      `design-system-capture`, `estimate-ticket`, `refine-ticket`,
      `review-routing`, `upstream-contribute` — every one a skill whose name is
      also a command slug. The skill prune protects command slugs (so the command
      generator, running after it into the same directory, does not lose entries
      it is about to write) and the command prune skips symlinks by construction,
      so under a partition — where both generators write nothing — those eight
      were unreachable from both sides. The counters said 0; the directory said 8.
      Fixed by emptying the protection set under `dual-layer/partitioned`, and the
      test asserts the DIRECTORY, not the counters.
      **The regression test had to be rewritten before it could be believed.** Its
      first version re-seeded a fresh project root per mode, so nothing was left
      over to leak; it passed with the fix reverted. The leak is a *transition*
      failure, so the case that catches it generates full-then-partitioned on ONE
      root — verified red with the fix reverted, green with it in place.
      **AC-2 amendment, stated rather than fudged:** the projected rule count is
      **13**, not 16. 16 is the source selection; three never reach a project
      symlink under any mode and for reasons that pre-date this phase —
      `package-ci-checks` and `size-enforcement` are `type: manual` (ADR-004: a
      manual rule costs zero workspace budget), `telegraph-speak` is
      compile-disabled by default. Both numbers are correct about different
      things.
- [x] **2.2** The global install excludes exclusively-package-only artefacts, so
      the partition holds from the other side too and a re-install cannot
      re-create the overlap.
      `verify:` a global install carries none of the 16.
      **DONE 2026-08-20, in two parts — and only one of them is end-to-end
      verified. Stated that way rather than reported as one green step.**
      **Part 1, the exclusion — VERIFIED.** `_rule_filter_for_source`
      (`install.ts`), the single filter both `_deploy_global_content` and
      `_preview_global_reap` consume, now composes
      `ruleFileArrives(...) && !isExclusivelyPackageOnly(...)`.
      `verify:` **RAN** over the real shipped tree —
      `tests/scripts/single_delivery_global_exclusion.test.ts` walks every
      `dist/agent-src/rules/*.md`, asserts the leaked set is EMPTY by name (not by
      count), and separately asserts that `non-destructive-by-default` — the Hard
      Floor — still arrives. Sensitivity confirmed: reverting the exclusion turns
      it red.
      **The verified number is 15, not 16, and it is measured rather than
      reconciled.** The source set is 16; `telegraph-speak` is compile-disabled by
      default and has NO `dist/agent-src/rules/` counterpart, so it cannot be
      excluded from a global install that never carried it. Confirmed by diffing
      the two directories.
      **Part 2, the fingerprint stamp — IMPLEMENTED, NOT END-TO-END VERIFIED.**
      Without it the partition is unreachable in practice, so it belongs here:
      `install_global` now writes `host_layer_fingerprint` into the existing
      `installed.lock`. Placement is the load-bearing part and was gotten wrong
      first: it runs AFTER the deploy and after the failed-tool postcheck, never
      at the earlier `write_lockfile`, which fires BEFORE the redeploy — a
      fingerprint taken there would describe the previous install and then verify
      against a layer this run had replaced.
      **What is NOT verified, and why it was not forced:** no test executes
      `install_global` itself. A real global install rewrites `~/.claude` on the
      maintainer's machine, which is a Hard-Floor action
      (`non-destructive-by-default`), and the repo's hermetic harness covers
      `_deploy_global_content` rather than `install_global`. So the *reachability*
      of that line is carried by review, not by a gate. Recorded as a gap instead
      of claimed as coverage.
      **What IS structurally closed instead — the drift vector, which is the
      failure that would have mattered more.** If the installer fingerprinted one
      set of directories and the build another, every comparison would mismatch,
      every branch would fall back to `standalone/full` with a plausible reason,
      and the partition would be unreachable forever while nothing failed. There
      is now exactly ONE definition — `hostLayerInputs` in
      `src/install/hostLayerFingerprint.ts` — and a test asserts both consumers
      import it and neither re-lists the directories inline.
      **Fail-safe on the write path:** a fingerprint that cannot be computed is
      warned about and NOT written. A missing fingerprint means full projection; a
      wrong one would authorise a partition against an unverified layer. The two
      errors are not symmetric and the code never prefers the second.
- [x] **2.3** Re-measure standing delivery and the overlap after 2.1, and record
      both against the pre-partition figures.
      `verify:` `check_standing_rule_delivery` reports overlap 0; the total is
      recorded whether or not it clears the 110,000 cap, because the residue
      belongs to body length and not to this roadmap.
      **DONE 2026-08-20 — measured with `measureStandingDelivery`, the same
      function the gate itself calls, over both host-layer states:**

      | | global layer | project layer | received | overlap rules | overlap tok |
      |---|---|---|---|---|---|
      | **pre-partition** | 118 f / 117,074 t | 113 f / 93,411 t | **210,485** | **113** | **93,411** |
      | **post-partition** | 103 f / 105,569 t | 13 f / 8,332 t | **113,901** | **0** | **0** |

      **`overlap 0` — the verify condition — holds.** Delta: **−96,584 tokens
      (−45.9 %)** of standing rule prose per session, and the doubled delivery is
      gone rather than reduced.
      **The total does NOT clear the cap, and this step records that rather than
      rounding it away:** 113,901 against 110,000 is **103.5 %**. The residue is
      body length, which this roadmap's Non-goals separate from duplication by
      construction and `road-to-standing-context-40k` owns. Duplication was 185.3 %
      → 103.5 %; the last 3.5 % is not this roadmap's defect.
      **How it was measured, stated because it is not the live machine.** The
      post-partition figure needs BOTH sides moved — a project layer per 2.1 AND a
      global layer per 2.2 — and moving the second on this machine means
      re-installing `~/.claude`, a Hard-Floor action. So both rows were produced
      hermetically: a temp `HOME` carrying a host layer built from the real
      `dist/agent-src/rules/` (the post row applying 2.2's exclusion, the pre row
      not), then the real `generate_rule_symlinks()` against it, then the gate's
      own measurement function. What is measured is therefore the mechanism, not a
      model of it; what is NOT measured is a real `agent-config install` (see 2.2
      part 2).
      **Live baseline for comparison, unchanged and still true:** on this machine
      today `check_standing_rule_delivery` reports 115 global files / 115,781 tok /
      105.3 % with an EMPTY project layer — the partition is inactive here because
      the install predates fingerprinting, exactly as the fail-safe intends.

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
      links the census and ADR-236.

**AC-3:** neither the guard nor the contract can be read as saying that
same-version duplication is free.

> **DEFECT FOUND IN THIS PHASE AFTER IT WAS MARKED DONE, by the Phase 2
> investigation — recorded rather than quietly repaired.** 3.1 instruments the
> `WARN` verdict with a per-type overlap count, and `install.sh` now states the
> doubling. **Measured 2026-08-19: that branch never executes on this machine.**
> `probe_tool` reaches `WARN` only when `other_ver == this_ver`, and
> `installed_version_at` returns **`unknown`** for `~/.claude/…` because there is
> no `package.json` beside it — so a live guard run reports
> `DRIFT · claude-code · unknown · 14.5.0` for each of the three tools that have a
> layer at both scopes on this machine (claude-code, augment, cursor; the other
> three report OK because no second layer exists) — and the cost message,
> field 6 and `count_overlap` all sit on a path that does not fire.
>
> **What survives:** the contract correction (3.2) is unconditional prose and
> stands; the header docstring stating the measured cost stands; `count_overlap`
> and its `-1` semantics are correct and tested-by-hand. **What does not:** the
> claim that a two-scope consumer install now *sees* the cost. On a machine whose
> global layer carries no version marker it sees `DRIFT` instead — which does block,
> so the operator is not left uninformed, but the number this phase added is not
> what they read.
>
> This is the same shape as the unreachable-`-1` case R2 found in `count_overlap`'s
> own docstring: a path documented as the important one, which the control flow
> never reaches. It is a **new** finding against completed work, so it gets a
> blocker rather than a silent edit — `warn-path-unreachable-without-version-marker`.

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
      **DONE 2026-08-19** — `src/scripts/_lib/layer_overlap_notice.ts` plus a
      `report_layer_overlap` CLI, wired as its own step of `task generate-tools`.
      **Not a call inside `condense.ts`, and the reason is a gate rather than taste:**
      the first version put it there and CI refused — `check_source_size_budget` is a
      shrink-only ratchet, `condense.ts` is already over its 1500-line ceiling, and the
      inline function was **+60**. Extraction took it to +2 (an import and a call),
      which the ratchet still refuses, so the notice moved out of that module entirely
      and `condense.ts` is byte-for-line back at its trunk value. Re-pinning the
      baseline is named a defect in the gate's own message. Verified on a real run: `⚠️ a global layer holds the same names
      (rules=110 skills=290 commands=40)`, the same figures the census and
      `check_single_delivery` report independently.
      **Advisory, never failing.** `generate-tools` is the normal build step, and
      failing it on a topology the operator may not be able to change today would
      make the build unusable rather than the duplication visible. The check that
      can refuse is `check_single_delivery --enforce`.
      It skips silently when one layer is absent — nothing is doubled there, and a
      warning would be noise on exactly the topology this roadmap wants.
- [x] **4.3** Bind the check where the person who can act on it sees it.
      `verify:` the binding is named and a deliberate overlap surfaces there.
      **DONE 2026-08-19 — preflight, on a CONVERGED council verdict (2/2), with both
      seats' refinements adopted rather than just the bare option.** Registered in
      `taskfiles/ci-fast.yml` beside `check_detector_corpus`, with the measured
      reason written at the call site: `.claude/` is gitignored and no CI leg
      installs at user scope, so a CI run of this check finds ZERO layers and
      measures a topology no contributor has.
      **REPORT MODE, deliberately.** The invariant is not true until Phase 2 ships,
      so `--enforce` here would red every preflight on a defect nobody can currently
      fix — which is how a gate teaches people to skip it. The flip lands with
      Phase 2, and a test asserts the absence of `--enforce` so an early flip has to
      be argued rather than slipped in.
      **The binding is PROVEN live, which is the condition both seats attached** —
      `tests/scripts/preflight_single_delivery_binding.test.ts`, mutation-checked:
      removing the registration line fails 2 assertions.
      **Corrected after R2 review — "PROVEN live" overstated it.** The recipe
      assertions parse the `preflight` task's own command list now; the first version
      read `ci-fast.yml` as a flat string, so moving the command into a task nobody
      invokes left them green — it proved PRESENCE where it claimed REACHABILITY,
      which is the very failure it exists to prevent. Two gates in
      this exact area already report to nobody, and that is the failure this test
      exists to prevent a third time. Honest bound: it proves the registration
      exists and that the binary refuses on a real overlap; **no test can prove
      anyone runs preflight**, so the gap closed is "registered where nothing reads
      it", not "a human skipped the step".

**AC-4:** the invariant is machine-checked, not maintained by hand.

## Phase 5 — The residue the partition does not resolve

Both `[~]`: authored here, decided elsewhere. Never started.

- [x] **5.1** The 4 project-only rules that carry `paths:` — `no-roadmap-references`,
      `rule-type-governance`, `skill-quality`, `source-confidentiality` — stop
      surviving `/compact` once their unscoped global twin is gone.
      **DECIDED AND SHIPPED 2026-08-20 — option (a): the path triggers are removed,
      all four load unconditionally.** AI council 2/2 convergent (blind peer
      review, two rounds) over three alternatives.
      **The verdict rested on two independent arguments, and the second one is the
      finding this step contributes.** anthropic: path-scoping is the wrong shape
      for an **authoring-time preventive control**, compaction aside — the decision
      these rules govern happens *before* any file exists for a path trigger to
      match, so at greenfield artefact creation they are absent exactly when they
      matter most. openai: the measurable gap, and specifically that
      `rule-type-governance` has **no deterministic gate at all** (verified: the
      other three carry `check_no_roadmap_refs`/`check_council_references`,
      `skill_linter`, `check_no_external_sources`), so for that one there is no
      compensating control whatsoever. Both seats rejected keeping an unscoped
      global copy (it re-creates the duplication the partition removes) and both
      rejected splitting the four by gate coverage as the wrong axis — a validator
      observes an outcome, it does not hold an obligation during the session.
      `verify:` **RAN.** After `task sync && task generate-tools`, all four
      projected rules carry **zero** `paths:` lines and therefore load
      unconditionally; `check_rule_activation_census` reports `4 scoped · 17 mixed`
      (was 8 scoped) and is green against a re-anchored baseline carrying the
      reason.
      **Cost, measured — and my own first figure was wrong by about half.** I told
      the council 1,754 tokens (1.8 %) from a `chars / 4` proxy over the projected
      files. The census counts with the exact BPE tokenizer and measured the
      unconditional corpus at **108,130 → 111,642, i.e. +3,512**. A DRY pass then
      collapsed the four duplicated rationale sections into one shared record in
      `source-confidentiality` with three pointers, bringing it to +3,156 — and then
      `check_rule_stub_ceiling` refused the three short pointers outright, because a
      migrated stub is held at its pointer's size and prose added there is prose in
      the wrong place by that gate's own contract. Removing those three notes landed
      the final **+2,882 (3.0 %** of the 96,584 the partition returns), with the one
      shared record in `source-confidentiality`, which is not a migrated stub and has
      no ceiling. All three figures are recorded rather than quietly replaced,
      because the first is the one the council was given. Neither seat's argument depends on it: one held
      the token axis was the wrong one entirely, the other that cost is legitimate
      but loses this comparison — both readings survive 3.3 %.
      **Where it is written down:** one `## Why this rule is not path-scoped` section
      in `source-confidentiality`, naming all four. The other three are migrated
      POINTER stubs that `check_rule_stub_ceiling` holds at their pointer's size, so
      they carry no note of their own — the gate caught the first attempt to give
      them one, and it was right.
- [x] **5.2** Whether any host mechanism suppresses a *skill* registration, for
      the case where a consumer legitimately holds both layers.
      **MEASURED 2026-08-20 — RECORDED NULL, and the null is stronger than the
      question asked for.** Host: Claude Code **2.1.237**. Probe: `claude -p` with
      `--settings <file>`, which is a real second process rather than this
      session's own context.
      | probe | `claudeMdExcludes` | result |
      |---|---|---|
      | catalogue size | — | 444 entries (self-report) |
      | catalogue size | `~/.claude/skills/**` | 443 entries — a delta of 1 over a 444-item list, i.e. counting noise, not suppression |
      | named skill `accessibility-auditor` present? | — | YES |
      | named skill `accessibility-auditor` present? | `~/.claude/skills/**` | **YES** — unchanged |
      **The control probe is what makes this conclusive, and it inverts the
      blocker's premise.** The blocker assumed the key is "file-glob capable for
      instruction files" and asked only whether it also reaches the skill
      catalogue. Pointed at `~/.claude/CLAUDE.md` — the surface it IS documented
      for — the exclusion had **no effect either**: the excluded file's content
      (`RTK`) was still reported present. So the failure is not "the key does not
      reach skills"; it is that **`claudeMdExcludes` had no observable effect on
      either surface** in this host version.
      **And the measurement method is itself verified**, which is the part that
      turns this from an inconclusive probe into a null: the same
      `--settings` file carrying `{"env": {"SD_PROBE_MARKER": …}}` *did* take
      effect — the marker was readable in the probe session. The settings file is
      read; the key does nothing.
      **Honest limits.** The catalogue side is `self-report` by construction —
      `capture_skill_catalogue` documents that no local transcript or file carries
      the injected catalogue on this host, so there is no deterministic channel to
      read instead. n=1 per condition on the size probe, which is why the named-skill
      question and the control probe carry the verdict rather than the counts.
      **Consequence, exactly as the blocker's own recommendation anticipated:** the
      producer-side partition this roadmap ships is the only available lever, and
      a consumer holding both layers cannot suppress the duplicate catalogue
      entries by configuration. Closed as a recorded null, which the blocker names
      as a valid close ("Either outcome closes this").

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
- **Status:** resolved
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
- **RESOLVED 2026-08-19 — option (c), and the measurement is what decided it, not
  a vote.** AI council, 2/2 seats present, **split**: anthropic chose (a), openai
  chose (c). Both seats independently named the same unresolved fact — *is the
  generated projection contractually machine-local, or a reproducible repository
  output?* — and anthropic's own answer carried its own kill condition: *"if
  `task generate-tools` is contractually required to work on a fresh clone, then
  none of these options work"*.
  **Measured, and it fires that condition:** `.github/workflows/consistency.yml:169`
  runs `task generate-tools` on a fresh checkout, and the workflow's own comment at
  `:172-174` states *"on a fresh checkout the host rule trees are gitignored and
  absent"*. So **(a) would break the Consistency pipeline** — it is eliminated by
  fact, not by preference. And `.claude/` is machine-local by measurement: **0
  tracked files**, `.gitignore:123`, which is exactly the condition openai attached
  to (c) (*"tolerable only if `.claude/` is explicitly a machine-local, gitignored
  projection and generation clearly reports which mode it selected"*).
  **Therefore (c), with the refinement BOTH seats required rather than the bare
  option:** generation must print the mode it selected — `standalone/full` or
  `dual-layer/partitioned` — and that mode must be covered by fixtures for absent,
  stale and current global installs. Recorded here rather than in the ADR because
  it is an implementation choice inside ADR-236, not a change to it.
- **Resolved when:** DONE — the option is recorded above with the measurement that
  eliminated (a), and 2.0's verify runs against option (c)'s mode reporting.

### blocker: warn-path-unreachable-without-version-marker
- **Status:** resolved
- **Owner:** maintainer
- **Class:** 2 (a decision about what the guard should compare)
- **Blocks:** nothing in this roadmap — Phase 3 shipped and its contract half is
  unconditional. It is recorded here because it falsifies part of a completed
  phase's claim, and a finding against done work has nowhere else to live.
- **The question:** `scope_guard.sh` reaches its `WARN` verdict only when the two
  scopes report the SAME version, and `installed_version_at` returns `unknown` for
  `~/.claude/…` — there is no `package.json` beside the host layer. So every real
  cross-scope install classifies as `DRIFT`, and the per-type overlap count Phase
  3.1 added to `WARN` never prints. Verified: a live run reports
  `DRIFT · claude-code · unknown · 14.5.0`.
- **What to do:** pick one. **(a)** have the installer write a version stamp beside
  each host layer it writes, so `unknown` stops being the normal answer;
  **(b)** report the overlap count on the `DRIFT` line too, since that is the line
  operators actually see; **(c)** treat `unknown` as "same version" for the overlap
  half only, keeping DRIFT's block but printing the cost. Probe first with
  `bash src/scripts/_lib/scope_guard.sh project "$PWD" "$PWD"`.
- **Recommendation:** **(agent-drafted 2026-08-19 — from the measurement.)** (b).
  It is the smallest change that puts the number in front of the person deciding,
  it needs no new artefact on disk, and it does not weaken the DRIFT block the way
  (c) would. (a) is the principled fix and a larger one — it changes what the
  installer writes, which is a consumer-facing surface.
- **If you do nothing:** the cost instrumentation stays live and unreachable, which
  is strictly worse than absent — it reads as coverage in the diff and in this
  roadmap, and only a live run refutes it.
- **RESOLVED 2026-08-20 — option (b), and the reasoning was already on record.**
  The AI council round that decided the delivery partition had put it plainly,
  unprompted: *"overlap reporting should not depend on version equality in the
  first place. Duplicate files can and should be reported whether versions match,
  drift, or are unknown."* A duplicate is a duplicate at any version pair, so the
  count now prints on **both** verdicts.
  **What shipped:** `count_overlap` moved above the branch in
  `src/scripts/_lib/scope_guard.sh`; the `DRIFT` line gains a sixth field.
  `verify:` **RAN** — a live guard run now emits
  `DRIFT · claude-code · unknown · 14.6.0 · 290`, `DRIFT · augment · … · 290`,
  `DRIFT · cursor · … · 110`. The instrumentation Phase 3.1 added is reachable for
  the first time, on the line the guard actually produces.
  **Wire compatibility checked, not assumed:** the only structured consumer,
  `src/server/routes/wizard.ts:650`, destructures the first five fields and ignores
  the rest, so a sixth field is additive.
  **Why not (a):** stamping a version beside every host layer alters a
  consumer-facing installer surface to repair a reporting line — the larger change
  for the smaller problem. The version question itself is answered elsewhere and
  better: ADR-236's partition predicate reads the **existing**
  `~/.event4u/agent-config/installed.lock`, which already carries
  `agent_config_version`, rather than inventing a marker beside `~/.claude/`.
  **Why not (c):** treating `unknown` as "same version" for the overlap half would
  weaken the DRIFT block itself, which is the one thing this line must not do.
- **Resolved when:** DONE — the option is recorded and a live guard run prints the
  count on the line it actually emits (above).

### blocker: partition-current-layer-undecidable
- **Status:** resolved
- **Owner:** maintainer
- **Class:** 2 (a definition the council's own verdict left open)
- **Blocks:** Phase 2 entirely — steps 2.0, 2.1, 2.2 and through 2.1 also 2.3.
  Phases 0, 1, 3 and 4 are landed and do not depend on it.
- **The question:** option (c) partitions only where a **current** global layer
  exists, and both council seats attached that word — openai's condition reads
  *"absent or older than the installed release"*. **Measured: "older than" has no
  data source.** There is no `package.json` beside `~/.claude/`; it is a host
  directory, not an install root, so `installed_version_at` returns `unknown`.
  Present-vs-absent is decidable, stale-vs-current is not, and ADR-226 already
  recorded why a refresh-until-they-agree definition has no fixed point in a
  repository that is ahead of its own release by construction.
- **Why an agent may not decide it:** narrowing a verdict the council just gave is
  the council's or the owner's call, and the alternative — inventing a staleness
  proxy — would build the partition on a predicate nothing in the tree supports.
- **What to do:** pick one. **(a)** have the installer write a version stamp beside
  each host layer it writes (`~/.claude/.agent-config-version` or equivalent), which
  makes `unknown` stop being the normal answer and also fixes
  `warn-path-unreachable-without-version-marker`; **(b)** redefine the predicate to
  the decidable half — present/absent — and drop staleness explicitly, stating the
  cost (a stale global layer would partition against outdated rules); **(c)** compare
  content instead of versions (hash the shared set), which is decidable but pays a
  read of both layers on every generation. Probe with
  `bash -c 'source src/scripts/_lib/scope_guard.sh project . .; installed_version_at "$HOME/.claude"'`.
- **Recommendation:** **(agent-drafted 2026-08-19 — from the measurement.)** (a),
  because it is the one option that closes two blockers with one change and turns
  an absent fact into a present one rather than working around it. (b) ships a
  partition that can silently prefer an outdated global rule over a fresh local
  one — the same class of silent wrongness this roadmap exists to remove. (c) is
  correct but pays on every build for a question (a) answers once.
- **If you do nothing:** Phase 2 stays halted and the duplication stays live. That
  is the safe direction of this non-decision, which is why the phase halts rather
  than shipping a proxy.
- **RESOLVED 2026-08-20 — option (a), in the refined form the council converged
  on, and TWO of the facts that decided it were measurements this branch took
  rather than arguments anyone made.**
  Operator decision after an AI council round (2/2 present, blind peer review, 2
  rounds): **an atomically written manifest carrying release version AND a
  content fingerprint of the host layers**, with every uncertainty falling back
  to the full projection and never to a build refusal.
  **Measurement 1 — the 5.85 s in this blocker's own `What to do` was wrong, and
  it was the number arguing against option (c).** It was a shell artefact: the
  probe spawned one `cat` per file. Re-measured in Node on the same tree, the
  identical digest costs **61 ms** over 664 source files and **103 ms** over 1019
  host files. So the cost objection to content comparison never described the
  mechanism, and the option it was used to rank down is the one that shipped.
  Recorded here rather than silently corrected because the figure is quoted in
  the recommendation above and a reader would otherwise carry it forward.
  **Measurement 2 — version equality is measurably insufficient on the
  maintainer's own machine.** `package.json` and the published release both read
  `14.6.0`, while **153 skills existed only in the project layer** and 37 only in
  the global one (`comm -23` over both directory listings, 2026-08-20). A
  version-equality predicate would have reported "current" and authorised the
  partition, dropping 153 skills. That is what moved the verdict from anthropic's
  bare stamp to openai's manifest: a version proves which installer *claims* to
  have written the layer, not that the layer holds what this checkout is about to
  omit.
  **What both seats required and what shipped:** exact equality rather than `>=`
  (a newer global layer is not a superset — a later release may have renamed or
  removed an artefact this checkout still expects); the record written last and
  atomically; absent / malformed / mismatched treated as *not verified*; and
  generation **printing** the mode it selected.
  **Implemented, with the reuse noted:** no second artefact was invented. The
  fingerprint rides on the **existing** `~/.event4u/agent-config/installed.lock`
  (`src/scripts/_lib/installed_lock.ts`), which already carried
  `schema_version`, `agent_config_version` and a tempfile+rename atomic write —
  so `installed_version_at` returning `unknown` for `~/.claude` stopped being
  the obstacle it looked like: the version was never missing, it was being read
  from the wrong place. New: `src/install/hostLayerFingerprint.ts` (deterministic
  digest over layer-relative path + bytes) and `src/install/partitionEligibility.ts`
  (the total, non-throwing verdict function + the package-only predicate).
  **Residual, not smoothed over:** an installer that crashes mid-write and still
  reaches the lockfile would fingerprint its own partial layer, and that
  fingerprint then verifies. Ordering narrows the window (the lockfile is written
  last) without closing it; a per-artefact manifest would close it and is not
  built here. Second residual: at `output.level: silent` the mode line is
  dropped — an explicit operator choice, and the partition stays fail-safe
  either way.
- **Resolved when:** DONE — the option is recorded above and 2.0's verify ran
  against it in all four states (see 2.0).

### blocker: compact-survival-of-package-only-rules
- **Status:** resolved
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
- **STILL OPEN, and the council SPLIT — but one side's premise is now measured
  false, which narrows the question rather than answering it.** anthropic chose
  **(b)** (keep `paths:`, rely on CI gates) on the premise that *"all four rules are
  semantically path-specific AND have CI gates"*; openai chose **(a)** (remove
  `paths:`) on the ground that a CI backstop cannot substitute for an obligation
  the model must hold *during* the session — naming `source-confidentiality` as a
  rule whose harm precedes CI.
  **Measured 2026-08-19:** `no-roadmap-references` → `check_no_roadmap_refs`-class
  gates present · `skill-quality` → present · `source-confidentiality` →
  `check_no_external_sources` present · **`rule-type-governance` → NO gate found.**
  So anthropic's premise holds for three of four and fails for one, and the failing
  one is the case openai's argument generalises to. That does **not** select an
  option for the other three, and a per-rule split is a fourth option neither seat
  proposed — which is precisely the kind of call this entry reserves.
  **What is now decided:** nothing. **What is now cheaper:** the question is no
  longer "(a) or (b) for four rules" but "does the CI-backstop argument hold
  per rule", with one measured counter-example already in hand.
- **RESOLVED 2026-08-20 — option (a), AI council 2/2 convergent (blind peer
  review, two rounds), shipped in the same change.** The split this entry recorded
  is closed: both seats chose (a), and the seat that had chosen (b) in the earlier
  round did so on a premise this branch measured false for `rule-type-governance`
  (no deterministic gate at all).
  **Two independent decisive arguments, neither of them the token count.** First:
  path-scoping is the wrong shape for an **authoring-time preventive control** —
  the decision these rules govern happens before any file exists for a path
  trigger to match, so they are absent at greenfield artefact creation whether or
  not a compaction occurs. Second: a CI validator observes an *outcome*; it does
  not hold an obligation *during* the session, so gate coverage cannot substitute
  and splitting the four along it (the fourth option) was rejected by both seats
  as the wrong axis. Keeping an unscoped global copy was rejected because it
  re-creates the duplication the partition exists to remove.
  **Shipped and verified:** path triggers removed from all four in `src/rules/`;
  after `task sync && task generate-tools` all four projected rules carry zero
  `paths:` lines; `check_rule_activation_census` green at `4 scoped · 17 mixed`
  against a re-anchored baseline whose `baseline_history` entry states the reason.
  **Cost, corrected in public:** the 1,754-token figure given to the council was a
  `chars / 4` proxy and understated the exact-BPE cost by about half. Measured:
  +3,512, then +3,156 by collapsing four duplicated rationale sections into one,
  then **+2,882 (3.0 %** of the partition's 96,584-token saving) once
  `check_rule_stub_ceiling` refused prose in the three migrated pointer stubs —
  which is the gate agreeing that a shared record was the right shape.
- **Resolved when:** DONE — the option is recorded, shipped and verified above.
  to ADR-227.

### blocker: host-skill-suppression-capability
- **Status:** resolved
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
- **RESOLVED 2026-08-20 — recorded null, and the null is broader than this entry
  asked for.** Host: Claude Code **2.1.237**. Probe: `claude -p --settings <file>`,
  a real second process.
  `claudeMdExcludes: ["~/.claude/skills/**"]` left the catalogue unchanged — 444
  vs 443 entries (a delta of 1 over a 444-item list, i.e. counting noise) and the
  named skill `accessibility-auditor` still present in BOTH conditions.
  **The control probe inverts this entry's premise.** It assumed the key is
  file-glob capable for instruction files and asked only whether it *also* reaches
  the skill catalogue. Pointed at `~/.claude/CLAUDE.md` — the surface it is
  documented for — the exclusion had **no effect either**: the excluded content was
  still reported present. So the finding is not "the key does not reach skills",
  it is that the key had **no observable effect on either surface** in this version.
  **The method is verified, which is what makes this a null rather than an
  inconclusive probe:** the same settings file carrying `{"env": {…}}` DID take
  effect, so the file is read and the key does nothing.
  **Honest limits:** the catalogue side is `self-report` by construction — no local
  transcript or file carries the injected catalogue on this host — and n=1 per
  condition on the size probe, which is why the named-skill result and the control
  carry the verdict rather than the counts.
  **Consequence, as this entry's own recommendation anticipated:** the
  producer-side partition is the only available lever, and a consumer holding both
  layers cannot suppress the duplicate catalogue entries by configuration.
- **Resolved when:** DONE — capability recorded above with its host version and method.

### blocker: overlap-check-binding-surface
- **Status:** resolved
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
  a topology no contributor has while every local session pays. **Corrected on R2
  review:** an earlier revision predicted CI would "be green" there; measured, the
  gate returned **1** in a CI-shaped run, because `.claude/` is gitignored and no leg
  installs at user scope. That was a defect in the gate (finding 1, fixed) rather than
  an argument for CI — the reason to prefer preflight is the topology, not the colour. Two
  gates in this area are already unreachable where it matters, so a third unbound
  one would read as coverage while adding none.
- **If you do nothing:** Phase 4 ships a check with the same reach as the two that
  already exist, and a re-created overlap goes unnoticed.
- **RESOLVED 2026-08-19 — preflight, and the council CONVERGED on it (2/2).**
  Both seats added the same two refinements the bare option did not carry, and both
  are adopted: **(i)** bind the check so it is reached by the path that can actually
  introduce the defect — `task generate-tools` — rather than as a standalone check
  someone must remember; **(ii)** add a test proving the binding is live and fails
  on a real overlap, *"so it can't silently degrade the way the prior gates did"*.
  That second point is the whole reason this was a blocker: two gates in this area
  already report to nobody, and a third would have been the same mistake a third
  time.
- **Resolved when:** DONE — the surface is named (preflight) and 4.3's verify runs
  against it.
- **PARTIALLY adopted, corrected after R2 review.** An earlier version of this line
  read "preflight, reached via `task generate-tools`", which was false:
  `taskfiles/content.yml` has `generate-tools` run `condense --generate-tools` plus
  the advisory `report_layer_overlap`, and neither invokes preflight or this check.
  Refinement (ii) — a test proving the binding — is adopted. Refinement (i) —
  reaching the check from the path that can introduce the defect — is **not
  implemented**, and claiming it was is the kind of unearned adoption this roadmap
  keeps catching. It is carried as a known gap rather than re-opening the blocker:
  the surface decision (preflight) is settled and correct; only the second entry
  point is missing.

## Acceptance criteria

- [x] The fresh-projection census is committed with its projection shape as a
      required field.
- [x] ADR-226 carries `superseded_by`, and the successor records the partition
      decision and its owner.
- [x] `<repo>/.claude/rules/` carries exactly the exclusively-package-only set and
      `<repo>/.claude/skills/` is empty, after a normal
      `task sync && task generate-tools`.
      **AMENDED 2026-08-20, twice, and both amendments are findings rather than
      relaxations.**
      · **The count is 13, not 16.** 16 is the source selection
      (`workspaces: [agent-config-maintainer]` exclusively, measured); three never
      reach a project symlink under ANY mode, for reasons that pre-date this
      roadmap — `package-ci-checks` and `size-enforcement` are `type: manual`
      (ADR-004: a manual rule costs zero workspace budget), `telegraph-speak` is
      compile-disabled by default. Verified emission: 13 rules, 0 skills, 0
      commands, and the skill directory empty **on disk** (the counters alone
      once read zero while 8 symlinks remained — see 2.1).
      · **It holds under `dual-layer/partitioned`, not unconditionally.** The
      criterion as written describes a state the resolved blocker deliberately
      does NOT guarantee everywhere: on a machine with no verified global layer —
      every fresh clone, every CI run — the projection stays full BY DESIGN, and a
      partition there would be the under-governance the precondition exists to
      prevent. Amending the criterion to name the mode is the honest reading;
      leaving it unqualified would make the fail-safe look like a failure.
- [x] `check_standing_rule_delivery` reports overlap 0.
      **MET 2026-08-20 — `overlap_rules=0`, `overlap_tokens=0`** under the
      partition, measured with the gate's own `measureStandingDelivery` (2.3).
      Pre-partition on the same inputs: 113 overlapping rules / 93,411 doubled
      tokens. Measured hermetically, because the post state needs a re-installed
      global layer and that is a Hard-Floor action on this machine — the
      limitation is recorded at 2.3 rather than implied away here.
- [x] Neither `scope_guard.sh` nor `install-scopes.md` states that same-version
      duplication is free.
- [x] One check asserts the partition for every artefact type, counting scope
      defeat separately.
- [x] Both Phase-5 questions carry a recorded decision or a recorded null.
      **MET 2026-08-20.** 5.1 carries a **decision** — option (a), AI council 2/2
      convergent, shipped and verified (four rules load unconditionally, census
      re-anchored with its reason). 5.2 carries a **recorded null** — Claude Code
      2.1.237, `claudeMdExcludes` has no observable effect on the skill catalogue
      **or** on the instruction file it is documented for, with a control probe
      proving the settings file itself is read.
      **This AC was reported OPEN earlier the same day, on the reasoning that both
      steps were "not runnable by an agent" under ADR-235.**
      [ADR-237](../../docs/decisions/ADR-237-end-to-end-execution-authority.md)
      supersedes that: the capability screen asks whether the agent can execute a
      thing at all, not who conventionally does it. 5.2 was a **measurement** the
      whole time — `claude -p --settings` is a machine-executable probe — and 5.1
      was a decision the council could take on evidence the run itself produced.
      Neither was ever externally impossible. Recorded here rather than silently
      corrected, because the earlier report is the exact failure ADR-237 exists to
      remove: a convention read as a constraint.

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
