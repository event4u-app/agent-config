---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: Consumes a six-document inbox drop that no active roadmap covers; nothing in the current estate is complete enough to archive as its offset.
estate_growth_exempt: The inbox drop consolidates six documents into one roadmap; the active estate has no completed member to archive as its offset in the same change.
---
# Road to Redundancy Governance

> **Source:** `agents/tmp.old/redundanz/` — six documents from two chat sessions
> (two transcripts, four single-topic roadmaps, two competing consolidations),
> all drafted against `a36d4658`, which is this branch's base. Verified against
> the tree on 2026-08-25; the measurement corrections are in Phase 1.

## Goal

The package states one honest authority for shared knowledge, and it applies
that standard at all three moments a human or agent touches code — writing it,
reviewing it, and refactoring it. Today the standard exists only for the first
moment and only for code comments: `code-review` carries the word `DRY` and
nothing behind it, `code-refactoring` carries no redundancy content at all, and
no carrier states when duplication should be *kept*. When this is finished, one
taxonomy and one verdict set are cited by all three carriers, a measured
baseline exists that later ratchets can quote, and the one confirmed delivery
defect — seven divergent script twins that both ship — is recorded with the
per-twin decision put to the maintainer rather than guessed.

Explicitly NOT in scope: the ~534-file spine extraction, the gate-kernel
consolidation, and any clone-detector dependency. Those collide with the active
`road-to-merge-surface-zero` on the same files and are parked below with reasons.

## Phase 1 — One measured baseline

- [x] **1.1 Write the measured redundancy baseline.** Create
      `agents/evidence/analysis/redundancy-baseline-2026-08-25.md` recording each
      confirmed count with the command that produced it, plus the four
      corrections the verification pass found against the inbox claims: the
      entry-guard block is 534 files, not 373; `REPO_ROOT` declarations are 245
      but only 22 use the two-level depth, so the copies are not
      interchangeable; `ArgparseExit` is 37 but the sibling classes `ArgError`
      and `ArgExit` add 39 more; the jscpd figure is unverifiable here because
      neither `jscpd` nor `ast-grep` is a dependency.
      verify: `grep -c '^| ' agents/evidence/analysis/redundancy-baseline-2026-08-25.md`
      returns at least 12 rows, and every command quoted in the file reproduces
      its stated number when run.

- [x] **1.2 Record the seven divergent shipped twins as a table.** In the same
      artifact, list each `src/scripts/<n>.ts` against
      `src/agent-src/templates/scripts/<n>.ts` with its measured
      `git diff --numstat` changed-line count, and state the observed fact that `package.json` `files` carries
      both paths, so both copies reach consumers with no sync mechanism between
      them. Facts only — no side is declared correct here.
      verify: the table has exactly 7 rows and each named file pair exists.

## Phase 2 — One authority, cited at all three moments

- [x] **2.1 Write the shared redundancy taxonomy as one guideline.** Create
      `docs/guidelines/redundancy-taxonomy.md` holding the implementation
      classes (exact clone, renamed clone, near clone, structural pattern,
      boilerplate, test repetition, intentional independence, wrong
      abstraction), the knowledge classes (knowledge, policy, contract and
      delivery-authority duplication), the representation classes (exact echo,
      paraphrase echo, structural narration, decorative metadata, feedback echo,
      accessibility conflict), the verdict set, and the Information Delta Test.
      `keep-duplicated` and `de-abstract` are stated as successful verdicts, and
      an accessibility conflict is a hard guard that never becomes a deletion.
      One authority, three consumers — a taxonomy copied into three carriers
      would be the defect this roadmap is about.
      verify: `test -f docs/guidelines/redundancy-taxonomy.md` and the file names
      all six representation classes and both keep-side verdicts.

- [x] **2.2 Point the authoring moment at it.** In
      `docs/guidelines/code-clarity.md`, add the Information Delta Test as the
      decision procedure the existing comment-discipline section already implies
      but never states, and link the taxonomy for the representation classes.
      No new rule and no new skill: both source consolidations converged on the
      finding that new prose carriers are themselves the redundancy problem.
      verify: `grep -c 'redundancy-taxonomy' docs/guidelines/code-clarity.md`
      returns at least 1, and `./scripts-run src/scripts/check_references`
      exits 0.

- [x] **2.3 Give the review moment a real redundancy dimension.** In
      `src/skills/code-review/SKILL.md`, replace the bare `DRY` token in the
      Quality dimension with a dimension that names the taxonomy, requires a
      verdict rather than a finding, and states the diff-aware rule: newly
      introduced high-confidence knowledge duplication is the finding, existing
      duplication is baseline and does not block an unrelated change.
      verify: `grep -c 'redundancy-taxonomy' src/skills/code-review/SKILL.md`
      returns at least 1 and the bare `DRY,` token is gone.

- [x] **2.4 Gate the refactoring moment.** In
      `src/skills/code-refactoring/SKILL.md` — which today carries zero
      redundancy content while being the skill that performs extractions — add
      the safe-abstraction check that runs before any extract: is this the same
      knowledge, does it change for the same reason, is there one honest name at
      every call site, can the core stay free of caller flags, and would a
      future divergence be a defect or legitimate evolution. A `keep-duplicated`
      outcome ends the refactor successfully.
      verify: `grep -c 'redundancy-taxonomy' src/skills/code-refactoring/SKILL.md`
      returns at least 1, and `./scripts-run src/scripts/skill_linter --all --quiet`
      exits 0.

- [x] **2.5 Regenerate the projections.** Run `task sync` then
      `task generate-tools` so `dist/agent-src/` and the per-tool trees carry the
      edited skills.
      verify: `git status --short dist/agent-src` shows the two edited skills and
      `./scripts-run src/scripts/check_condensation --quiet` exits 0.

## Phase 3 — The delivery defect, decided by its owner

- [x] **3.1 Name the ADR the twins need.** Add a short proposal section to the
      baseline artifact stating what an ADR must settle: whether
      `src/scripts/` becomes the sole authority with the template copies
      generated at build time, and what happens to consumers pinned to the
      current template behaviour.
      verify: the section names both alternatives and the consumer-impact
      question.

- [x] **3.2 Decide the intended behaviour per divergent twin.** Seven pairs,
      up to 787 changed lines each. Which side is correct is a behavioural
      judgement per file, not a mechanical one, and each resolution is a bugfix
      that changes what consumers already run. Deferred to the maintainer with
      the Phase 1.2 table as its input.

      **Resolved 2026-08-25 by the maintainer, as a SPLIT rather than one
      answer** — and the split is the work: three of the seven turned out to
      need no behavioural judgement at all, which was not visible from the diff
      table this step was handed.

      **Classification added to the baseline artefact**, splitting each diff into
      lines inside comments and lines outside, with the command that produced it:

      | Twin | changed | outside comments | class |
      |---|---:|---:|---|
      | `memory_hash.ts` | 6 | **0** | comment-only |
      | `memory_status.ts` | 16 | 4 | structural-only |
      | `memory_report.ts` | 28 | 8 | structural-only |
      | `memory_signal.ts` | 57 | 36 | **behavioural** |
      | `check_memory_proposal.ts` | 60 | 45 | **behavioural** |
      | `check_memory.ts` | 262 | 195 | **behavioural** |
      | `memory_lookup.ts` | 750 | 506 | **behavioural** |

      **The first three: `keep-duplicated`, and the ground is verifiable rather
      than plausible.** Every non-comment difference in them is the
      `__AGENT_CONFIG_BUNDLE__` entry guard. That flag is defined in exactly
      three places — `package.json`'s `build:install-bundle`, `build:hooks` and
      `build:mcp-bundle`, each an `esbuild --define` whose entrypoint sits under
      `src/scripts/` — and `git grep` finds it in **no** file under
      `src/agent-src/templates/`. The guard exists because every module in an
      esbuild bundle shares the bundle's `import.meta.url`; a consumer template
      ships as source, is run directly, and is an input to none of the three
      bundles. Reconciling would put a guard into a file that can never be
      bundled.

      **One loose end is recorded rather than absorbed into that verdict.**
      `memory_report.ts`'s dev side exports `CuratedTuple` and
      `_iter_curated_entries`, and `git grep` finds no test and no caller for
      either — surplus surface on one copy, not a divergence between them. A
      verdict that quietly covered it would be a verdict about something nobody
      examined, so it travels to the follow-up as its own step (1.4).

      **The remaining four: carried to
      `road-to-memory-twin-reconciliation.md`**, created in this same change with
      the classification as its input.

      **This step's resolution does NOT archive this roadmap**, and the
      distinction is worth stating because a dashboard reading of "Deferred: 1"
      suggested otherwise: five further `[~]` items remain here — 4.5, 4.6, 4.7
      and two numbered 5.3 — each with its own owner and its own condition. Iron
      Law 3 requires all of them resolved, so 3.2 closing moves the count from
      six to five and nothing else. They diverge in **both** directions, so no
      blanket rule resolves them — the dev side of `memory_signal.ts` has a
      provenance gate the template lacks, while the **template** side of
      `check_memory_proposal.ts` refuses `--intake-id` with `--proposal` as
      mutually exclusive and the dev side does not.

      `check_memory.ts` (195) and `memory_lookup.ts` (506) are deliberately
      **not** characterised here. Guessing at them would be the failure this step
      exists to avoid, and the follow-up's 1.3 requires an unread subtree to be
      named rather than implied.

## Phase 4 — The dual: one concept, one word

Second inbox drop (`agents/tmp.old/reduntanz-2/`), same workstream. It audited
this branch and found three defects in it; those are 4.0. The rest extends the
taxonomy rather than creating a second authority, which is this roadmap's own
core finding applied to itself.

**Council: invoked, no verdict.** `council_cli run --depth deep` on the scope and
sequencing questions returned `quorum_result: inconclusive`, `present: 0` — both
configured members reported `unavailable` (CLI transport, `api_on_quota: off`).
The decisions below are therefore taken from tree evidence and named as such, not
presented as council-backed.

- [x] **4.0a Fix the 22-vs-29 contradiction.** This file said "29 at the
      two-level depth" in two places while the baseline artifact, the PR body and
      re-measurement said 22. The same number encoded twice and diverged — a
      knowledge duplication by this roadmap's own taxonomy, found by an external
      audit of it. 29 is the count of *any* depth using that resolve shape; 22 is
      the two-level literal.
      verify: `grep -rho 'only [0-9]* use the two-level' agents/roadmaps/archive/road-to-redundancy-governance.md
      agents/evidence/analysis/redundancy-baseline-2026-08-25.md | sort -u` yields
      exactly one distinct value, and it matches the measurement command in the
      baseline. (Matching on the bare number cannot work — this very line would
      match it. `corrected-from-reproduction`.)
- [x] **4.0b Pin the twin-diff metric.** `diff -u | wc -l` counts context lines,
      so it moved with the local diff implementation — 980/384 here, 975/381 on
      the auditing machine. Restated as `git diff --numstat`, which reproduces
      anywhere git does. `corrected-from-reproduction`.
      verify: the baseline table carries added/removed/changed columns and the
      loop in it uses `--numstat`.
- [x] **4.0c Canonicalise this branch's own spelling.** The branch mixed
      `artefact` (5) and `artifact` (6) across its own files while introducing a
      taxonomy about exactly that. Unified to `artifact`, which is the spelling
      the `evidence-artifact-types` contract governing the baseline file already
      uses.
      verify: `grep -c artefact` returns 0 across the files this branch touches.

- [x] **4.1 Write the wording baseline.**
      `agents/evidence/analysis/wording-baseline-2026-08-25.md` — nine measured
      spelling pairs with their commands, the identifier-layer table, and the
      concept-cluster honest null.
      verify: every row reproduces from its stated command.
- [x] **4.2 Teach the taxonomy the dual defect.** Naming classes (spelling
      variant, synonym drift, homonym collision) and verdicts
      (`canonicalize-term`, `keep-distinct`, `defer-for-context`) in
      `redundancy-taxonomy.md`, with the prose-vs-identifier split stated as
      decisive.
      verify: the section names all three classes and all three verdicts.
- [x] **4.3 The three moments carry naming.** `code-clarity` (before introducing
      a term, search for the incumbent), `code-review` (a diff introducing a
      second term for an existing concept is the finding; an existing split is
      baseline), `code-refactoring` (a rename to the canonical term is an
      outcome). No new carrier.
      verify: `check_references` exits 0; `skill_linter --all` warn count
      unchanged at 1.
- [x] **4.4 Close the reuse-citation gap.** `component-oriented-and-oop-development.md`
      had **0** skill citations while being the authority on when repetition earns
      an abstraction. Now cited from `code-review` (diff creates a unit → what was
      searched, what was found) and `code-refactoring` (reuse question before a
      new unit).
      verify: `grep -rl 'component-oriented-and-oop-development' src/skills/ | wc -l`
      returns 2, was 0.

- [-] **4.5 Decide the canonical side per mechanical pair.** Nine measured pairs.
      The majority side is the obvious proposal for seven of them, and two are
      not mechanical at all: `behaviour`/`behavior` splits 57/43 with the
      *British* side ahead, against a tree that is otherwise American, and
      `license`/`licence` is a genuine noun/verb distinction in one dialect plus
      quoted licence names. A term map is a maintainer decision.

      **CARRIED, not cancelled** → `road-to-canonical-terms.md` step 1.1 and its
      blocker `b-dialect-decision-is-owner-reserved`, created in the same change.
      The nine pairs, the 57/43 split and the noun/verb case travel verbatim; the
      blocker names the three options and states why the recommendation is not
      the agent's to make.
- [-] **4.6 Sweep the prose layer, then gate it.** ~5000 occurrences across the
      three largest pairs; sequenced behind `road-to-merge-surface-zero` (13 open
      steps) because a tree-wide text sweep against its conflicting branches
      multiplies the merge surface. The gate is
      `lint_canonical_terms.ts` as the fourth member of the existing vocabulary
      linter family, ratchet mode, reusing `check_md_language`'s
      frontmatter/fence/marker skip machinery. Gated on 4.5.

      **CARRIED, not cancelled** → `road-to-canonical-terms.md` Phase 2. The
      sequencing behind `road-to-merge-surface-zero` travels with it, and 2.2's
      verify is tightened rather than copied: the gate must be shown green on the
      same word inside a fence, a frontmatter value AND a quoted licence name,
      because a matcher that reds on those is the failure this gate would
      otherwise introduce.
- [x] **4.7 The identifier layer stays `keep-duplicated` until someone renames
      it deliberately.** Five `check_/lint_/move_artefact*` scripts with five
      matching tests and four taskfile references against three
      `*-artifact-*.md` contracts. Measured: nothing imports across the split, so
      the divergence costs nothing at runtime. A rename is ~14 files plus
      references — a refactor with its own blast radius, not a text substitution.

      **Closed 2026-08-25 as `keep-duplicated`, and the correction is that this
      was never an open question.** The step's own title states the verdict and
      its own body states the measurement; it was marked `[~]` while carrying
      both, which made a decided item read as a pending one.

      **The measurement was re-verified live rather than taken from the text**,
      because a count written days ago is not evidence today. All six
      `*artefact*` / `*artifact*` scripts under `src/scripts/`
      (`check_artefact_checksums`, `check_artefact_count_messaging`,
      `check_generated_artefact_headers`, `lint_artefact_frontmatter`,
      `lint_evidence_artifacts`, `move_artefact`) are imported by **0** files
      across the spelling split. Reproduce:

      ```
      for f in $(git ls-files 'src/scripts/*artefact*' 'src/scripts/*artifact*'); do
        b=$(basename "$f" .ts)
        printf '%-42s %s\n' "$b" \
          "$(git grep --files-with-matches "from '\./$b" -- 'src/*' | wc -l)"
      done
      ```

      So the divergence still costs nothing at runtime, and the verdict stands
      unchanged. A deliberate rename remains available and is not what this step
      asked for.

## Phase 5 — Propagation: the change that only half landed

- [x] **5.1 Write the closed-set procedure — in a guideline, not in the rule.**
      `src/rules/downstream-changes.md` carried the find-ALL-callers Iron Law and
      the defect-pattern sweep, and `grep -icE 'enum|variant|union|switch|case'`
      over it returned **0** — the exact case that produces bad refactors was
      absent. The procedure now lives in
      `docs/guidelines/agent-infra/downstream-changes-mechanics.md`: the Iron
      Law, discover-by-shape, the three-way classification (exhaustive /
      deliberate fallback / missing case), the finding that a `default` clause
      suppresses an exhaustiveness report entirely, and the synthetic-member
      probe. No blanket rule against `default` — that would be refuted by every
      protocol parser in the tree.
      **The rule itself is untouched, and that is a measured constraint rather
      than a preference.** `corrected-from-reproduction`: the first attempt added
      38 lines to the rule and reddened `check_preamble_payload_budget` —
      project-scope rules are a gated bucket of the per-spawn standing payload,
      that payload measures 138,212 tok against a grace ceiling of exactly
      138,212, and the config states the ceiling may never move up. At that
      margin the rule cannot grow by a single table row. Guidelines are an
      excluded bucket, so the obligation is carried by the guideline plus the two
      skills that fire when it matters.
      verify: `check_preamble_payload_budget` reports the same measured total as
      clean `origin/main` (net 0 in the gated buckets), and
      `npx vitest run tests/scripts/check_preamble_payload_budget.test.ts` is
      green — it was red at 138,833, so its sensitivity is known.
- [x] **5.2 Wire the procedure into the two skills that need it.** Exactly one
      skill cited `downstream-changes` before this, and the closed-set procedure
      had no carrier at all. `code-review` gains a propagation
      dimension (closed-set consumers listed with status; sibling-occurrence
      sweep with a reported count, zero included), `code-refactoring` gains the
      shape-search step where identifier search is insufficient.
      verify: the propagation dimension exists and both skills resolve the rule
      link; `check_references` exits 0.
- [-] **5.3 Put the closed-set row in the rule once the payload budget allows.**
      The row belongs in the rule's own table, next to the sweep it extends —
      that is where an agent looks. It costs ~95 tok and the gated payload has
      zero headroom, so it waits on a reduction. The budget config records that
      no reduction mechanism is committed, which makes this item's blocker the
      same one milestone 1 (2026-11-10) already carries.

      **CARRIED, not cancelled** → `road-to-canonical-terms.md` Phase 3 and its
      blocker `b-payload-headroom-for-the-closed-set-row`. That blocker records
      what this item only implies: `preamble-payload-budget.json`'s
      `committed_reduction_mechanism` reads **NONE**, so the wait is unfunded —
      and it therefore offers the guideline placement as a recordable outcome
      rather than an indefinite hold.
- [x] **5.3 Measure the exhaustiveness lint rule before enabling it.**
      `eslint.config.js` carries no exhaustiveness rule. The available one is
      type-aware, so it needs a TypeScript program built before linting — a real
      cost against 134 + 135 gate scripts. Repo culture is measure-then-default,
      and the same check exists in cheaper non-type-aware linters worth
      benchmarking against it. Deferred to a measurement, not to a preference.

      **Measured 2026-08-25, and the premise this step deferred on is refuted.**
      The stated cost was *"it needs a TypeScript program built before linting"*.
      That program is **already built**: `eslint.config.js:38` sets
      `project: ['./tsconfig.json', './tsconfig.ui.json', './tsconfig.test.json']`,
      and `consistent-type-imports` is already a type-aware rule. The cost the
      deferral was protecting against is paid whether or not this rule is on.

      | configuration | scope | real | exhaustiveness findings |
      |---|---|---:|---:|
      | rule off | `src/scripts/**` | 10.26s | — |
      | rule on, defaults | `src/scripts/**` | 9.74s | **21** |
      | rule on, `considerDefaultExhaustiveForUnions` | `src/scripts/**` | 9.69s | **0** |
      | rule off | `src/**` + `tests/**` | 15.77s | — |
      | rule on, option | `src/**` + `tests/**` | 15.27s | **0** |

      **No measurable overhead** — the with-rule readings are *lower* than the
      without-rule ones, so the difference is run-to-run variance. Total findings
      are identical at 342 either way (305 `no-unused-vars`, 32
      `no-explicit-any`, all pre-existing in `tests/`), which is the control: the
      rule adds nothing to the count.

      **The option is the whole finding.** On defaults the rule reports 21
      violations in `src/scripts/` alone — and **every one is a switch that HAS a
      `default` clause**, which is precisely the *deliberate fallback* that step
      5.1's three-way classification calls a legitimate outcome. Enabling it
      without the option would have contradicted 5.1 from inside the same
      roadmap. With `considerDefaultExhaustiveForUnions: true`, 0 violations.

      **Enabled, with both directions of its sensitivity demonstrated** rather
      than assumed — a rule reporting 0 on the current tree proves nothing about
      what it would catch:

      - a union switch with a missing case and **no** fallback →
        `Switch is not exhaustive. Cases not matched: "c"`, **red**;
      - the same missing case **with** a `default` → **green**.

      The non-type-aware alternatives were not benchmarked, and that is stated
      rather than implied: with the type-aware program already built and its
      marginal cost measured at zero, the comparison has nothing left to decide.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-25 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The taxonomy becomes prose nobody reads | product | A guideline that three carriers link but no gate enforces is exactly the attention-dilution the source documents warn about; it can be added and change nothing | Enforcement is deliberately out of scope until the corpus exists; the carriers cite one authority rather than restating it, so the cost is one file, and the parking lot names the measurement that would justify a gate | Phase 2 — One authority, cited at all three moments |
| 2 | A review dimension that fires on legacy debt | implementation | A redundancy dimension with no diff-awareness turns every unrelated PR red against 534 pre-existing entry-guard copies | 2.3 states the diff-aware rule as part of the dimension itself: new duplication is the finding, existing duplication is baseline | Phase 2 — One authority, cited at all three moments |
| 3 | The safe-abstraction check reads as permission to skip extraction | implementation | `keep-duplicated` as a first-class verdict can be quoted to avoid any consolidation work | The check requires a named verdict with its reason, so a keep decision is recorded and reviewable rather than silent | Phase 2 — One authority, cited at all three moments |
| 4 | Baseline numbers rot before they are used | implementation | Counts measured today drift as the tree moves, and a stale baseline is worse than none because it looks like evidence | Every row carries the command that produced it, so any consumer can re-derive rather than trust the number | Phase 1 — One measured baseline |
| 5 | A term sweep destroys a real distinction | product | `route`, `dispatch`, `delegate`, `spawn` and `forward` read as synonyms and denote five different mechanisms here; a sweep over them deletes information | 4.1 measured the concept clusters and found no defect; only the mechanical spelling pairs are sweep candidates, and `keep-distinct` is a first-class verdict | Phase 4 — The dual: one concept, one word |
| 6 | The closed-set procedure becomes a blanket ban on `default` | implementation | An agent reading "a default hides the missing case" as "never write a default" would break every protocol parser and boundary parse in the tree | 5.1 states the three-way classification with deliberate fallback as a legitimate outcome, and says the blanket rule would be refuted | Phase 5 — Propagation: the change that only half landed |
| 7 | The naming extension inflates the one authority it was meant to protect | product | `redundancy-taxonomy.md` grew from 132 to ~180 lines; a document nobody finishes reading enforces nothing | The carriers cite rather than restate, so the growth is paid once; the guideline stays inside its size band and the parked items keep enforcement out of it | Phase 4 — The dual: one concept, one word |

## Acceptance Criteria

- [x] AC-1 — One file states the redundancy taxonomy and verdict set, and the
      authoring, review and refactoring carriers each cite it rather than
      restating it.
- [x] AC-2 — `src/skills/code-refactoring/SKILL.md` cannot reach an extraction
      without a recorded verdict, and `keep-duplicated` is available as a
      successful outcome.
- [x] AC-3 — A reader can reproduce every number in the baseline artifact from
      the commands it quotes, and the four corrections against the inbox claims
      are visible there.
- [x] AC-4 — The seven divergent shipped twins are recorded with measured diff
      sizes and the decision is in front of the maintainer, not guessed.
      **Decided 2026-08-25**, and the decision arrived as a split: three closed
      here with a `keep-duplicated` verdict on verifiable grounds, four carried
      to `road-to-memory-twin-reconciliation.md` with the classification as
      input. Nothing was guessed — the two largest twins are explicitly recorded
      as un-characterised rather than summarised.
- [x] AC-5 — The taxonomy covers naming as well as duplication, and the same
      three carriers cite it for both without restating either.
- [x] AC-6 — A closed-set change cannot be called done from an identifier
      search alone: the rule names the shapes, the classification, and the probe
      that proves the sweep fired.
- [x] AC-7 — Every number this branch asserts is reproducible with the command
      printed beside it, and no number appears twice with two values.

## How the six deferrals were resolved (2026-08-25)

Recorded here rather than only at each item, because the dispositions differ and
a reader arriving at the archive should see the split without reconstructing it.

| item | disposition | where it went |
|---|---|---|
| 3.2 twins | **split** — 3 closed `keep-duplicated`, 4 carried | `road-to-memory-twin-reconciliation.md` |
| 4.5 dialect | carried | `road-to-canonical-terms.md` 1.1 + blocker |
| 4.6 prose sweep | carried | `road-to-canonical-terms.md` Phase 2 |
| 4.7 identifiers | **closed** — verdict re-verified live, 0 cross-imports | — |
| 5.3 closed-set row | carried | `road-to-canonical-terms.md` Phase 3 + blocker |
| 5.3 exhaustiveness lint | **closed** — measured, premise refuted, rule enabled | — |

**Two were closed because they were not open.** 4.7's own title and body already
carried a `keep-duplicated` verdict and its measurement; the exhaustiveness 5.3
deferred on a cost — *"it needs a TypeScript program built before linting"* —
that `eslint.config.js:38` shows was already being paid. Both were `[~]` while
holding their own answer.

**The three carried ones are `[-]` and each says `CARRIED, not cancelled`.**
`decision-revisit-gate`'s preservation test reserves a genuine DROP to the owner
and leaves a carry to the council, provided the follow-up roadmap is created in
the SAME change. `road-to-canonical-terms.md` lands in this commit, carries all
three verbatim, and turns two implicit conditions into named blockers with
options and a recommendation. Nothing was weakened; the glyph is `[-]` because
the item is closed **here**, and the sentence beside it says where it continues.

## Parking lot — deliberately not now

- **Spine extraction** (entry guard 534, `python_compat`, `_lib/cli.ts`,
  `_lib/schema.ts`): ~500 files of churn against an active
  `road-to-merge-surface-zero` with 13 open steps on the same surface. Needs
  that roadmap closed first.
- **`REPO_ROOT` consolidation**: measured refutation — 245 declarations, 22 at
  the two-level depth. The copies encode different caller depths, so the verdict
  today is `keep-duplicated` until caller-location tests exist.
- **Clone-detector dependency** (`jscpd`, `ast-grep`): neither is a dependency,
  so the 45,807-line figure is unverified. Adding a scanner is a supply-chain
  intake decision, not an analysis step.
- **Gate kernel / gate consolidation** (134 `check_*` + 135 `lint_*`, 441
  taskfile references): a real finding, and a separate program.
- **Mechanical comment and label linters**: both source consolidations require a
  validated corpus before any such gate is written. The corpus does not exist.
