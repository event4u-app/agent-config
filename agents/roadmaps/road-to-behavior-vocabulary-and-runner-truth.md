---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Nothing in the active estate can be archived to pay for this one, and the two neighbours that look like payers are not. The stub it extends holds a stack-and-rig decision that is still owner-reserved, so archiving it would delete that decision rather than settle it; the sibling stub on proposal adoptability holds a different owner-reserved decision and would take the same loss. What is here is the residue neither holds: three places where this tree states one thing and does another, each re-verified at 20bfb1f53 and each fixable without settling either owner-reserved decision."
relates:
  - slug: road-to-executable-specification-adapter
    relation: extends
    note: >
      That stub holds the stack-specific and rig-shaped half behind an
      owner-gated promotion condition. This takes only the detection and
      vocabulary residue, which needs no runner chosen and no dependency pushed
      into a consumer repository.
  - slug: road-to-a-proposal-that-can-be-adopted
    relation: disjoint
    note: >
      That stub asks what makes a prepared proposal adoptable at all. This
      roadmap deliberately carries none of the proposal's architecture, only the
      tree facts that were independently re-verified here.
  - slug: road-to-trigger-eval-freshness-has-no-writer
    relation: disjoint
    note: >
      That roadmap owns whether a trigger suite's freshness is evidenced. This
      one adds rows to a suite; neither waits on the other.
---

# Road to behavior vocabulary and runner truth

> **Source:** `agents/tmp.old/inbox-2026-09-ab/t02/` — an externally prepared
> proposal set (four plan revisions plus the chat that commissioned them),
> delivered as finished roadmaps. Its architecture is not adopted here; only the
> defects it named that were independently re-verified against this tree are.

## Goal

Three surfaces in this tree assert a capability they do not have, and each
assertion is falsifiable in one command. A prompt written in behaviour-driven
vocabulary reaches no skill; two commands describe themselves as stack-adaptive
while loading one stack's skill unconditionally; and the toolchain resolver's
runner vocabulary omits three native runners and every behaviour-driven runner,
so a repository that has one is indistinguishable from one that has none. When
this roadmap closes, each of the three either does what it says or says what it
does — and no new skill, verb, dependency or contract format has been added to
get there.

## Context — three measured facts, re-verified at `20bfb1f53` (2026-09-28)

1. **Behaviour vocabulary routes nowhere.**
   `grep -rliE 'gherkin|bdd|cucumber|behat' src/skills/*/evals/*.json` returns
   **0** files across the 101 skills that carry a trigger suite. The tree does
   own the decision this vocabulary should reach — `Does this change owe an
   executable behavior contract?` at `src/skills/test-case-discovery/SKILL.md:40`
   with its anti-script rule at `:98–116` — so the gap is routing, not knowledge.
2. **Two commands' frontmatter contradicts their own body.**
   `src/domains/engineering-base/tests/create/command.md:8` binds
   `skills: [test-case-discovery, pest-testing, quality-tools]` and `:9` describes
   the command as `stack-adaptive (pest / phpunit / vitest / jest / pytest / …)`;
   `tests/execute/command.md:8` binds `[pest-testing, quality-tools]` with the
   same description. Both bodies already resolve correctly — `create/command.md:25`
   and `execute/command.md:26` route through the toolchain resolver and
   `create:26` says "never a hard-coded one". The defect is therefore narrower
   than the source claimed: the instructions are right and the static binding is
   wrong. `ls src/skills | grep -iE 'jest|vitest|pytest|rspec|junit'` is empty, so
   there is no per-stack skill to bind instead — the binding has to become
   resolver-driven or drop to the neutral pair.
3. **The resolver's runner vocabulary is short by three natives and all
   behaviour-driven runners.** `KNOWN_RUNNERS` at
   `src/agent-src/templates/scripts/work_engine/stack/runner.ts:46–56` holds nine
   labels — pest, phpunit, vitest, jest, playwright, cypress, pytest, go-test,
   cargo-test. No rspec, no junit, no dotnet-test, and no behaviour-driven runner
   of any ecosystem. The resolver is already list-shaped and carries `ecosystem`,
   `confidence`, `basis` and speed per runner (`runner.ts:103–123`), and the
   frontend detector already has a refusal vocabulary for a genuine conflict
   (`detect.ts:48–56`, two mutually exclusive workspaces produce `unknown` plus
   both names). So the seam exists; only the labels and one second axis are missing.

## Phase 1 — Make behaviour vocabulary reach the decision that already exists

- [x] **1.1 Add behaviour-driven trigger rows to `test-case-discovery`'s suite.**
      `src/skills/test-case-discovery/evals/triggers.json` is 52 lines and 10
      queries, none of which use the vocabulary a person asking for this actually
      types. Add at least 8 should-trigger rows spanning EN and DE phrasings, and
      at least 4 should-not-trigger near-misses: a refactor with no behaviour
      change, "one scenario per unit case", a selector-and-click step script, and
      "install a behaviour runner we do not have". The near-misses matter more
      than the positives — the discriminator's four no-cases at `SKILL.md:40` are
      what they protect.
      verify: `./scripts-run src/scripts/description_route_check` green; the
      grep in Fact 1 returns ≥ 1 file where it returned 0.

      **Evidence (2026-10-01).** The suite went from 10 queries (5 positives,
      5 near-misses) to 26 — **15 exemplars**, 10 of them new and split across
      both languages. The six English ones ask whether a change owes a Gherkin
      feature file, request BDD scenarios for a refund rule, turn acceptance
      criteria into given-when-then, weigh an executable specification against
      a unit case, use specification-by-example phrasing, and use
      living-documentation phrasing. The four German ones — quoted verbatim in
      `evals/triggers.json` rather than here, since this file is English — ask
      the cucumber-versus-unit-tests question, request acceptance criteria as
      executable scenarios, weigh a Behat scenario against plain cases, and ask
      which scenarios belong in a feature file. Alongside them: **11
      negatives**, 9 near-misses and 2 counterexamples. The four the step
      names are all present and all carry the discriminator's own reason:
      the refactor with no observable change (`SKILL.md` no-case 1), the
      scenario-per-unit-case translation job, the selector-and-click step
      script (the anti-script rule), and installing a runner the repository
      does not have. A fifth negative covers no-case 2, the internal invariant
      with no external vocabulary. `grep -rliE 'gherkin|bdd|cucumber|behat'
      src/skills/*/evals/*.json` now returns
      `src/skills/test-case-discovery/evals/triggers.json` — 1 file where
      Fact 1 measured 0. `./scripts-run src/scripts/description_route_check`
      exits 0 on the advisory path (no description surface changed), and the
      scoped-dry tier CI runs for a `SKILL.md` diff forces exit 0 by
      construction (`--dry`; the backend is substring-on-unit-name and says of
      itself that its findings are plumbing output, not a routing result).
      `check_trigger_evals` reports no finding for this suite.

      Two things deliberately NOT done, both recorded rather than silently
      skipped. **`last_eval` was not bumped**: `skill_trigger_eval` needs an
      on-disk key plus a controlling-terminal confirmation, so no live pass
      ran; bumping the date would assert a measurement that did not happen.
      The file carries `_eval_note` saying so. **The frontmatter description
      was not touched**: it is the production routing condition, and rewriting
      it is a separate decision with its own blast radius — this step was
      scoped to the corpus and the body.

      One trap met and cleared: `lint_skill_trigger_corpus` applies a
      CASE-CLASS discipline (`class: exemplar | near-miss | counterexample`,
      polarity-checked, all three required) to **diff-touched** files only, so
      it is invisible until the file is committed. Proven both directions
      against a fixture root — a class-stripped copy reports `[class-missing]
      26 case(s)` and `[class-coverage]`; the shipped file reports no finding.
- [x] **1.2 State in the skill which vocabulary it answers to.**
      One sentence in `test-case-discovery/SKILL.md` naming the terms the new
      rows route on, so a later reader can tell an intentional trigger from a
      lucky keyword. No new section, no new skill — the word count is 1,842 and
      ADR-225's tripwire is 3,000, and this roadmap is not the change that should
      spend that headroom.
      verify: `wc -w src/skills/test-case-discovery/SKILL.md` ≤ 1,900.

      **Evidence (2026-10-01, figures re-measured after round 3).** One
      sentence added directly under the
      `## Does this change owe an executable behavior contract?` heading — the
      decision the vocabulary is meant to reach — naming **five** terms:
      *Gherkin*, *BDD*, *Cucumber*, *Behat* and *given-when-then*, plus
      "their German phrasings". Each occurs in at least one should-trigger
      query, checked against the corpus rather than against the sentence. It
      points at
      `evals/triggers.json` as where they are pinned, and closes the promise
      exactly where Risk 1 says it must close: it is a decision, not a guide
      to writing a contract. No new section and no new heading.
      `wc -w src/skills/test-case-discovery/SKILL.md` stays **inside the
      ≤ 1,900 budget** this step sets and well under ADR-225's 3,000-word
      tripwire. The exact count is not recorded — it moved on four of the
      seven review rounds and was recorded wrong on three of them, so the
      budget is the claim and `wc -w` is the check.

      Three rounds corrected this paragraph. **Round 3** caught it claiming
      eight terms — including *feature file* and *executable specification*,
      which the sentence did not contain — against a draft that round 2 had
      replaced. **Round 5** measured the terms against the CORPUS rather than
      the sentence and found *acceptance scenario* pinned in no query at all:
      it appeared only in the corpus file's own description, so the term was
      dropped. **Round 7** applied that same check to the German sub-claim and
      found it false for *given-when-then*; the claim now names the two terms
      a German exemplar actually carries. Each round checked one direction and
      the next found the direction it had not.
      `./scripts-run src/scripts/skill_linter --path
      src/skills/test-case-discovery/SKILL.md` → `[PASS] … No issues found`.
- [~] **1.3 Register the canonical spellings.** Deferred by decision, not by
      omission: the blocker below is **resolved with option (b)** on
      2026-10-01 — the terms stay unregistered for this roadmap and Phase 1
      routes on the vocabulary without pinning its spelling.

      **Evidence (2026-10-01).** `grep -n 'behavior contract'
      src/config/canonical-terms.yml` returns nothing, which is the recorded
      state option (b) asks for rather than a gap. The reasoning is the
      blocker's own and was re-checked rather than inherited: registering a
      term in `canonical-terms.yml` arms `lint_canonical_terms`, which
      ratchets, so every later variant spelling anywhere in the tree becomes a
      build failure — a cost worth paying once a term has several consumers and
      not before. After this roadmap the terms have exactly one consumer
      (`test-case-discovery`), so the ratchet would buy consistency across a
      set of size one. **What a future session needs to close this instead:** a
      second surface that genuinely uses the terms — the stack-and-rig half
      held by `road-to-executable-specification-adapter` is the expected one —
      at which point registering both spellings becomes cheap and the drift
      this defers becomes real. Revisit-if: a second artefact in `src/` states
      *behavior contract* or *acceptance scenario* in its own prose.

## Phase 2 — Make the two commands' frontmatter match their own instructions

- [x] **2.1 Resolve the `skills:` binding against the toolchain, or drop it.**
      Either the binding becomes resolver-driven, or `pest-testing` leaves the
      static list and the body's existing resolver step is the only stack
      authority. Pick one and say which in the command, because the present state
      is that a React-only repository loads PHP testing guidance before reading
      the instruction telling it not to.
      verify: `grep -n 'skills:' src/domains/engineering-base/tests/{create,execute}/command.md`
      shows no unconditional single-stack skill, or the description no longer
      claims stack-adaptive.

      **Evidence (2026-10-01).** Resolution taken: **drop `pest-testing` from
      the static list; the body's existing resolver step becomes the only
      stack authority**, and the description keeps its stack-adaptive claim
      because that claim is TRUE — the bodies already route through
      `toolchain-resolver` and `create` already says "never a hard-coded one".
      The false half was the binding, and only the binding was changed.
      `create/command.md:8` → `skills: [test-case-discovery, quality-tools]`;
      `execute/command.md:8` → `skills: [quality-tools]`. The grep now shows no
      single-stack skill in either file.

      The other resolution — making the binding resolver-driven — was
      checked and is not expressible: `skills:` is a static array in
      `command.schema.json` with no conditional form, and
      `ls src/skills | grep -iE 'jest|vitest|pytest|rspec|junit'` is still
      empty, so there is no per-stack skill to bind in `pest-testing`'s place
      even if the field could branch. Dropping to the neutral set is the
      resolution the tree can actually hold.

      "Pick one and say which in the command" is discharged literally: both
      bodies now carry a paragraph directly under the resolver step — *The
      resolver is the only stack authority, and `skills:` deliberately names
      none* — recording what the binding used to do (a React-only repository
      was handed PHP testing guidance before reading the instruction not to
      hard-code a stack), why no replacement binding exists, and that a later
      reader should not restore one. Without that paragraph the removal reads
      as an oversight and the next editor puts `pest-testing` back.

      `validate_frontmatter` → 451 artefacts, 0 failing, 0 warnings.
      `check_references` → no broken references.
- [x] **2.2 Re-check the three other places that repeat the claim.**
      `src/domains/engineering-base/tests/command.md:32–33` and
      `src/domains/meta/README.md:151,154` carry the same wording and are
      generated or hand-maintained copies; whichever resolution 2.1 picks has to
      reach them in the same change.
      verify: `grep -rn 'stack-adaptive' src/ | wc -l` matches the count the
      change intends, and `task sync` leaves the tree clean.

      **Evidence (2026-10-01).** All five sites enumerated and dispositioned,
      and the disposition follows from 2.1's resolution rather than being
      chosen separately. **The intended count is 8 — unchanged.** Because 2.1
      kept the claim and fixed the binding, every copy of the claim became
      true the moment the binding changed; a count that dropped would be the
      signature of Risk 3's cheap edit, so holding at 8 is the evidence, not
      the absence of it. `grep -rn 'stack-adaptive' src/ | wc -l` → **8**,
      the same 8 lines as before: `tests/command.md:32,33`,
      `execute/command.md:9,25`, `create/command.md:9`,
      `meta/README.md:151,154`, `toolchain-resolver.md:5`.

      Per-site disposition:

      - `src/domains/engineering-base/tests/command.md:32–33` — the cluster
        head's routing table. Hand-maintained, and already consistent: lines
        41–43 state "Both sub-commands resolve the runner via the
        `toolchain-resolver` — they adapt to the consumer's stack instead of
        assuming one." That sentence was the correct claim all along; what
        contradicted it lived in the sub-commands' frontmatter and is now gone.
        No edit needed, and the reason is recorded rather than the file being
        passed over silently.
      - `src/domains/meta/README.md:151,154` — **generated**, first line reads
        `# Generated by generate_pack_manifests. Do not edit.` Both lines are
        verbatim copies of the two `description:` fields, so they track 2.1
        automatically. Hand-editing them would have been a source-of-truth
        violation; `task sync` regenerated and left both lines byte-identical,
        which is the correct outcome for a generated copy of a claim that
        stayed true.
      - `src/agent-src/contexts/execution/toolchain-resolver.md:5` — the
        resolver's own definition of the term. Untouched; it is the authority
        the other four now defer to.

      `task sync` + `task generate-tools` run; the only generated change is
      `src/domains/meta/pack.yaml`'s `token_passport`, which grows by the
      recorded paragraphs plus the ecosystem lines the command bodies gained.
      **The figures are not quoted here** — read them from the committed
      `pack.yaml`, whose four components sum to its own `total_tokens`. A
      repeat `task sync` produces no further change, so the regenerated state
      is a fixed point. `check_pack_size` → within budget.

      **Why the numbers are gone rather than corrected.** This paragraph
      carried a stale passport delta three times running, each one re-measured
      and each one stale again by the next commit — because every later edit
      to a command body moves the passport, so any number written here is
      wrong before the branch lands. Rounds 2 through 7 corrected six stale
      figures across this file: a budget, a test count twice, a term list, a
      word count twice, this passport three times. Re-measuring harder was the
      wrong fix; the right one is **not to quote a derived, volatile figure in
      completion evidence at all — name the artefact that holds it and the
      command that reads it.** A figure that must be true at HEAD is either
      re-derived by the reader or it is a liability. Where a number is genuinely
      load-bearing — a budget ceiling, an acceptance threshold — it stays, and
      is re-measured at the commit it describes.

## Phase 3 — Give the resolver the labels and the second axis it is missing

- [x] **3.1 Add the three missing native runner labels.**
      `rspec`, `junit`, `dotnet-test` into `KNOWN_RUNNERS`, each with a
      presence fixture and an absence fixture, because the set is the single
      source of truth the state schema and tests validate against
      (`runner.ts:40–45`).
      verify: the resolver's own test file asserts each new label on its
      presence fixture and asserts its absence on a repository without it.

      **Evidence (2026-10-01).** `KNOWN_RUNNERS` in
      `src/agent-src/templates/scripts/work_engine/stack/runner.ts` goes from
      9 labels to 12 — `rspec`, `junit`, `dotnet-test` — each with a real
      detector, not just a label.

      One correction to this step's own premise, from round 2 of the
      completion review: the step calls the set "the single source of truth
      the state schema and tests validate against", quoting the module's
      comment. **There is no state schema.** `grep -rln 'toolchain' src/scripts/schemas/`
      returns nothing, and the only `toolchain.json` mentions outside this
      module are the contract doc and an unrelated test-fixture string. Those
      two greps were run by the implementing session, whose tool access is not
      the reviewer's; the reviewer correctly recorded the question as
      unverified rather than asserting it, which is what made it checkable at
      all. The comment is corrected in the same change, and the membership
      tests added for round 1's finding 3 are what makes the remaining half of
      the claim true.

      - **rspec** (`ruby`) — `rspec` in the Gemfile, `.rspec`, or
        `spec/spec_helper.rb`; `bundle exec rspec`. **Deliberately no MEDIUM
        default**, unlike the PHP and Python branches: minitest ships in
        Ruby's stdlib, so a Gemfile with no rspec signal is most likely a
        minitest project and emitting `rspec` would be a guess wearing a
        confidence label. No signal → no row.
      - **junit** (`jvm`) — `pom.xml`, `build.gradle[.kts]` or
        `settings.gradle[.kts]`, tested for PRESENCE rather than content so an
        empty root build file in a multi-project tree still counts; HIGH when
        a build file names junit, MEDIUM when none does (the same gradation
        the PHP branch already uses). Wrapper-first like the existing
        `make test` rule: `./mvnw test` / `./gradlew test` when the wrapper
        exists, because the wrapper pins the build-tool version.
      - **dotnet-test** (`dotnet`) — HIGH only when a project file NAMES a
        test stack (`Microsoft.NET.Test.Sdk`, xunit, nunit, mstest); a bare
        project or solution file, `global.json` or `Directory.Build.props` is
        MEDIUM. `.NET` is the one ecosystem whose marker has no fixed
        FILENAME, so it is an extension scan rather than a `_MANIFESTS`
        entry — and the consequence (a project-file-only root contributes
        nothing to `latest_manifest_mtime`, so its cache key does not move)
        is written into the code rather than left to be discovered from a
        stale cache.

      Fixtures, in `tests/scripts/work_engine/stack_runner.test.ts`: each
      label has a presence case AND an absence case, plus wrapper cases, a
      polyglot case asserting all three ecosystems in one root, and a case
      proving `--php` still narrows `selected` now that more ecosystems
      exist. **97 tests green** in that file, and the figure reconciles: 92
      literal `it()` blocks plus one `it.each` expanding to 5 cases. It has
      been re-measured at each review round rather than carried forward — an
      earlier version said 70, and then 93 with a parenthetical whose
      arithmetic did not add up.

      **The absence fixtures were seen red.** Neutralising the rspec guard
      (`if (false && …)`, so a Gemfile always emits rspec) fails exactly 1
      test — `rspec ABSENT: a Gemfile with no rspec signal emits NO rspec
      row` — and nothing else. The implementation was restored from a copy
      taken before the probe, never by checking the file out.
- [x] **3.2 Add a behaviour-runner axis, scoped and list-shaped — not a scalar.**
      The axis mirrors the existing per-runner record: ecosystem, runner,
      command, scope root, confidence, basis. A scalar is wrong here for the
      reason the existing resolver is already a list: one repository can carry a
      behaviour runner in one workspace and native tests in another, and a
      repository-wide answer erases which. Two behaviour runners in one scope
      resolve to a refusal naming both, exactly as `detect.ts:48–56` refuses
      between conflicted workspaces.
      verify: a monorepo fixture with a behaviour runner in one package and none
      in another returns two scoped rows, not one; a conflict fixture returns the
      refusal with both names.

      **Evidence (2026-10-01).** `BehaviorRunnerResult` mirrors
      `RunnerResult`'s fields and adds `scope_root` and `conflict`:
      ecosystem · runner · command · scope root · confidence · basis.
      `resolve_behavior_runners(root)` returns one row per scope;
      `ToolchainResult.behavior_runners` and the `behavior_runners` key in
      `to_config()` carry it to `agents/runtime/state/toolchain.json`.

      Eight labels across six ecosystems: `behat` (php), `cucumber-js` (js),
      `cucumber-ruby` (ruby), `cucumber-jvm` (jvm), `behave` and `pytest-bdd`
      (python), `reqnroll` and `specflow` (dotnet) — in a **separate**
      `KNOWN_BEHAVIOR_RUNNERS` set, asserted disjoint from `KNOWN_RUNNERS`,
      because `selected` is what a command actually invokes and a behaviour
      suite must not become runnable by a label appearing.

      Scopes are the root plus each declared workspace package, read from
      `package.json#workspaces` and `pnpm-workspace.yaml#packages`. That is a
      LOCAL re-read rather than an import of the frontend detector: this
      module's contract is leaf (stdlib only, no intra-`work_engine`
      imports), and breaking it to share a parser would couple the toolchain
      resolver to the stack labeller for a list of directory names. A
      mid-path glob (`a/*/deep`) is skipped rather than half-expanded — a
      reported scope that does not exist is worse than one fewer — and
      `_MAX_BEHAVIOR_SCOPES` caps the scan at 200.

      Both verify conditions are fixtures, and both were seen red:

      - **Monorepo** — `packages/web` (cucumber-js), `packages/legacy`
        (behat), `packages/api` (vitest only) returns a row for web and for
        legacy and **none** for api. Collapsing `_behavior_scopes` to the
        root alone — the scalar this step rejects — fails exactly 4 tests,
        all four scope-dependent, with no collateral.
      - **Conflict** — two runners of the SAME ecosystem in one scope
        (`behave` + `pytest-bdd`) return a single row: `runner: "unknown"`,
        `ecosystem: "python"`, `confidence: LOW`, `command: ""`,
        `conflict: ["behave", "pytest-bdd"]`, and a basis naming both.
        Collapsing the ecosystem grouping fails exactly 2 tests, both the
        polyglot and the conflict case, with no collateral. A sibling case
        proves a conflicted ecosystem does not poison a clean one in the same
        package, and another proves the same runner matched by two signals is
        one answer rather than a conflict.

        **Corrected 2026-10-01 by round 3 of the completion review.** This
        bullet first recorded the conflict fixture as *behat and cucumber-js*
        — which the branch's own test now asserts is the opposite case. Two
        ecosystems' behaviour runners are not mutually exclusive, so a PHP app
        with a JS frontend returns TWO rows; round 2 found the code refusing
        it, and this record still described the refused behaviour as correct
        after the code was fixed. The evidence had been written against an
        earlier state of the branch and not re-run against the final commit.

      Doc-Impact: `src/agent-src/contexts/execution/toolchain-resolver.md`
      gains the three native rows and a `## 2b` section for the axis. Its
      self-declared size budget was **raised from its original 6,000 chars**,
      recorded in that file's own header with its reason rather than absorbed
      silently: the resolver covered 9 runners on one axis when the old number
      was written and now covers 12 across two. **The current ceiling is
      whatever that header states** — it is not restated here, because this
      record quoted it wrong twice. The enforced ceiling is
      `check_depth_budget`'s 16,000 per depth file, and the file is far under
      it.

      **The sequence, which is the part worth keeping.** The budget moved
      three times and each move taught something. 7,000 was set first, and a
      real sentence was deleted from § 4 to fit it — then put back, because
      deleting content to satisfy a budget is the failure this repository
      keeps recording and doing it to one's own number is worse. Round 1's
      findings then corrected the three rows this change ADDED (no
      pre-existing row was touched) and the file grew past 7,000, so the
      ceiling moved again. Round 6 caught the result as a **trap rather than a
      constraint**: the ceiling then sat four characters above the file with a
      shrink-only clause beside it, which told the next author only that they
      may not write. The final value leaves real headroom and drops that
      clause. What this paragraph no longer does is name the number.
- [x] **3.3 Record detection only — never adoption.**
      No table row, no output line and no skill may recommend installing a
      behaviour runner. Detection answers what a repository has; choosing one is
      the owner-gated question the related stub holds.
      verify: `grep -rniE 'composer require|npm i |pip install|gem install' `
      over every file this phase touches returns nothing.

      **Evidence (2026-10-01).** Three enforcement layers, and one honest
      correction to the verify as written.

      1. **Structural.** The axis emits no install field by construction —
         `BehaviorRunnerResult` has no "recommended" field, no ranking, and
         `command` is how to RUN a suite the repository already owns.
      2. **Unreachable from execution.** A test asserts that a root carrying
         both pest and behat selects `['vendor/bin/pest']` and that `behat`
         never appears in `runners`. The axis is reported, never scheduled.
      3. **Asserted.** A test joins every emitted `command`, `basis` and
         `runner` across a two-package fixture and asserts none contains
         `composer require`, `npm i `, `npm install`, `pip install`,
         `gem install`, `recommend` or `should install`.

      **Layer 3 was seen red for a real reason, and it changed the code.**
      The first behat `basis` read `behat/behat in composer require` —
      naming the composer manifest SECTION, copied from the sibling pest
      string — and the assertion caught it. A grep cannot tell a manifest
      section from an install instruction, and this axis is the one place
      that ambiguity is expensive, so the string is now `behat/behat in the
      composer manifest` and the reason sits in the code beside it.

      **The verify as literally written cannot return nothing, and saying so
      is the honest discharge.** Run over the two files this phase touches it
      returns 8 lines, every one classified:

      Anchored by CONSTRUCT rather than by line, because round 3 found all
      four line numbers here already dead — they were captured mid-branch and
      every later commit moved them:

      - `runner.ts`, the `_php_runners` basis
        `'pestphp/pest in composer require'` — the **pre-existing**
        native-axis string. A manifest-section reference on a line this change
        did not author; left alone under `minimal-safe-diff` rather than
        rewritten for a grep's benefit.
      - `runner.ts`, the comment above the behat basis in
        `_behavior_runners_in_scope`, explaining why the behaviour axis avoids
        the phrase.
      - `stack_runner.test.ts`, the pre-existing test titled
        `php: pest in composer require`.
      - `stack_runner.test.ts`, the forbidden-substring list inside the
        assertion that enforces this step.

      Nothing in that list recommends installing anything; three of the four
      groups exist BECAUSE of the prohibition. The substantive condition —
      no behaviour-axis output is an adoption instruction — holds, and is
      machine-checked by layer 3 rather than by the grep.

### blocker: canonical-behaviour-wording-ratchet

- **Status:** resolved 2026-10-01 — option (b) taken, the terms stay
  unregistered for this roadmap.
- **Owner:** maintainer
- **Blocks:** step 1.3
- **What to do:** pick exactly one — (a) register `behavior contract` and
  `acceptance scenario` in `src/config/canonical-terms.yml` now, accepting that
  `lint_canonical_terms` ratchets and every later variant spelling becomes a
  build failure; or (b) leave the terms unregistered for this roadmap and let
  Phase 1 route on the vocabulary without pinning its spelling, revisiting once a
  second surface uses the terms.
- **Resolved when:** `grep -n 'behavior contract' src/config/canonical-terms.yml`
  returns a line, or this blocker carries a dated note recording choice (b).
- **Recommendation:** (b). Phase 1 needs the routing, not the spelling, and one
  skill is not yet the two consumers that make a ratcheted term worth its cost.
- **If you do nothing:** step 1.3 stays deferred and Phases 1–3 close without it;
  the risk is a second surface later spelling the terms differently, which is
  cheap to fix while there is one consumer and expensive once there are several.
- **Resolution note (2026-10-01):** option **(b)**, the stated recommendation,
  taken on execution. The condition was executed rather than read off the
  status line: `grep -n 'behavior contract' src/config/canonical-terms.yml`
  returns nothing, and this note is the dated record the `Resolved when`
  clause names as the alternative. The argument held on re-check — after
  Phase 1 the terms have exactly one consumer, so arming a ratchet would
  enforce consistency across a set of size one while making every future
  variant spelling in the whole tree a build failure. Revisit-if: a second
  artefact in `src/` states *behavior contract* or *acceptance scenario* in
  its own prose; the expected candidate is the stack-and-rig half held by
  `road-to-executable-specification-adapter`.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-29 | reviewer: agent -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The trigger rows make the vocabulary route to a skill that then has nothing to say | product | Phase 1 routes behaviour-driven prompts to a discriminator that decides whether a contract is owed, but the tree still has no guidance on how to write one well. A person who gets routed and then gets nothing is worse off than one who was never routed | 1.2 states which vocabulary the skill answers to, which bounds the promise to the decision the skill actually makes; the formulation half stays with the related stub rather than being half-built here | Phase 1 — Make behaviour vocabulary reach the decision that already exists |
| 2 | The second resolver axis grows into the adapter the stub is holding back | implementation | Detection and adoption sit one commit apart: once a repository's behaviour runner is a known label, wiring a step-definition path looks like the obvious next line | 3.3 makes recommend-an-install a verifiable failure, and the axis records scope and basis only — it emits no command a consumer must adopt | Phase 3 — Give the resolver the labels and the second axis it is missing |
| 3 | 2.1 is resolved by editing the description instead of the binding | implementation | Deleting the words "stack-adaptive" makes the contradiction disappear without making any repository better served, and it is the one-line fix | 2.1 names both resolutions explicitly so whichever lands is a recorded choice; 2.2 forces the same choice through three further copies, which makes the cheap edit visible as a decision | Phase 2 — Make the two commands' frontmatter match their own instructions |

## Acceptance Criteria

All six verified 2026-10-01 at branch `drain/behavior-vocabulary-close`.

- [x] AC-1 — `grep -rliE 'gherkin|bdd|cucumber|behat' src/skills/*/evals/*.json`
      returns at least one file, and `description_route_check` is green.

      Returns `src/skills/test-case-discovery/evals/triggers.json` — 1 file
      where Fact 1 measured 0 across 102 suites. `description_route_check`
      exits 0 on the advisory path (no `description:` field changed), and the
      scoped-dry tier CI runs on a `SKILL.md` diff forces exit 0 by
      construction. Recorded because it is a limit, not a pass: the dry
      backend is substring-on-unit-name, so it cannot confirm that a
      behaviour-driven prompt reaches this skill in production — that is the
      proxy gap the checker documents about itself.
- [x] AC-2 — No command in `src/` describes itself as stack-adaptive while its
      frontmatter binds a single stack's skill unconditionally.

      `grep -rln 'description:.*stack-adaptive' src/domains/` returns exactly
      the two `/tests` sub-commands, and their bindings are now
      `[test-case-discovery, quality-tools]` and `[quality-tools]` — no
      single-stack skill in either. The sweep is over all of `src/domains/`,
      not only the two the roadmap named, so the claim is about the estate
      rather than about the files that were already known.
- [x] AC-3 — `KNOWN_RUNNERS` contains `rspec`, `junit` and `dotnet-test`, each
      asserted by a presence fixture and an absence fixture.

      All three present and asserted by name in the constants test. Presence
      and absence fixtures exist for each; the rspec absence fixture was seen
      red under a neutralised guard, failing exactly 1 test with no
      collateral. 97 tests green in `stack_runner.test.ts`.
- [x] AC-4 — The behaviour-runner axis returns per-scope rows; a monorepo fixture
      returns more than one row and a conflict fixture returns a refusal naming
      both runners.

      The monorepo fixture returns a row for `packages/web` (cucumber-js) and
      `packages/legacy` (behat) and none for `packages/api`; the conflict
      fixture — two runners of the SAME ecosystem, `behave` + `pytest-bdd` —
      returns one row with `runner: "unknown"` and
      `conflict: ["behave", "pytest-bdd"]`. Both were seen red: collapsing the
      scope list fails exactly 4 tests, collapsing the ecosystem grouping
      fails exactly 2, neither with collateral.

      **Corrected 2026-10-01 by round 3.** This criterion was first marked
      verified on the behat + cucumber-js pair, which is the POLYGLOT
      non-conflict case the branch's own test asserts returns two rows. The
      criterion's substance held — a refusal naming both runners does exist —
      but the narrative it was verified against was refuted by the diff's own
      suite.
- [x] AC-5 — No file this roadmap touches recommends installing a dependency, and
      `src/skills` gains no new skill.

      **No new skill:** `ls src/skills | wc -l` is 299 on both `origin/main`
      and this branch; `git diff --name-status origin/main...HEAD -- src/skills/`
      shows two `M` lines and no `A`.

      **No recommendation:** step 3.3 runs the grep over the two files its
      phase touches — `runner.ts` and `stack_runner.test.ts` — and classifies
      every line it returns: one pre-existing native-axis basis string naming
      the composer manifest section, one comment explaining why the behaviour
      axis avoids the phrase, one pre-existing test title, and the
      forbidden-substring list inside the assertion that enforces the
      prohibition. (This criterion previously attributed that result to "all
      seven touched source files", a scope that excludes the test file where
      two of the four classified lines live and therefore returns fewer. The
      classification was right; the scope named for it was not.) Two further strings
      are worth naming rather than leaving for a reader to find: the new
      trigger corpus carries *"install Cucumber and wire a step-definition
      folder into this repository"* and the skill body is unchanged on this
      point. The corpus line is a **near-miss with `trigger: false`** — a
      prompt the skill must NOT fire on, i.e. the inverse of a
      recommendation, and the only place in the diff where adopting a runner
      is mentioned at all.
- [x] AC-6 — The blocker above is resolved or carries a dated note recording
      option (b); step 1.3 is not silently closed.

      The blocker's `Resolved when` was executed rather than read off its
      status line: `grep -n 'behavior contract' src/config/canonical-terms.yml`
      returns nothing, which is the state option (b) describes, and the
      blocker now carries a dated resolution note taking (b) with its
      argument re-checked. Step 1.3 stays `[~]` with a paragraph naming what
      a future session needs — a second surface using the terms — and a
      `revisit-if`. Deferred by decision, visibly, rather than closed.

## Status on close — 13/13 done, 1 deferred, NOT archived

All three phases are closed, the blocker is resolved, and every acceptance
criterion is verified. The file stays in `agents/roadmaps/` rather than moving
to `archive/`, and the reason is a gate rather than a preference:
`update_roadmap_progress --archive` refuses it under **Iron Law 3** —
*roadmaps with unresolved `[~]` deferred items must NOT auto-archive; resolve
via `roadmap-management § 4b` (spawn follow-up, restore, or cancel)*. That
resolution is an owner decision about step 1.3's future, and an execution
session has no standing to take it by moving the file.

So the one thing left here is a choice between three dispositions for 1.3,
all of which are cheap:

1. **Spawn a follow-up** carrying the `revisit-if` (a second surface in `src/`
   using *behavior contract* or *acceptance scenario*), and archive this file.
2. **Restore 1.3 to `[ ]`** and register the two terms in
   `src/config/canonical-terms.yml` now — option (a) of the resolved blocker,
   accepting the ratchet while there is one consumer.
3. **Cancel 1.3** as not-wanted, and archive this file.

The recommendation is 1: it preserves the condition under which registering
the terms becomes worth its ratchet, and it is the only one of the three that
neither spends the ratchet early nor loses the trigger.

### Residue carried out of the review rounds

Seven completion-review rounds produced 71 findings; 61 are fixed and 10 are
`accepted-risk`, each with a stated `revisit-if`.

**The dominant defect class was never the code.** Four highs across rounds 2–4
and roughly a third of everything else were this branch asserting something
about itself that was not so — a doc comment, a contract bullet, a completion
figure. The durable lesson is in step 2.2: a derived, volatile figure is not
quoted in completion evidence at all, because re-measuring it harder failed
three rounds running. What remains open:

- **Maven gates on content where Gradle gates on presence.** An empty or
  unreadable `pom.xml` emits no junit row, against a contract row added in the
  same change. Left as a decision rather than a correction: the realistic
  trigger is the unreadable path, and emitting a MEDIUM row for a file we
  could not read is not obviously better than emitting none.

- **Two detector precision gaps**, both named by round 6 and both the same
  shape as ones that were fixed: `io.cucumber` over JVM build text and
  `Reqnroll` / `SpecFlow` over .NET project text are still unanchored word
  matches, where the python and ruby signals are anchored to a declaration.
  Lower exposure than the python case — those tokens are not English words —
  but the same class. Related: `_dotnet_project_text` folds solution text into
  the buffer it matches against, so a project *named* `Billing.SpecFlow` can
  raise a HIGH row from a filename. Closing that needs two buffers rather than
  one, which is a restructure, not a correction.
- **The wrapper claim is wider than the wrappers.** `_task_runner_wrappers`
  emits only `php-test` and `js-test` roles, while the contract states
  "task-runner wrappers win" for the resolver as a whole. Pre-existing for
  Python, Go and Rust; this change widens it by three ecosystems. Naming it
  here rather than inventing wrapper semantics for Ruby, JVM and .NET under a
  review round — which is how an unmeasured guess ships.

- **Cost trades, three of them**, accepted with `revisit-if` conditions in the
  round-3, round-4 and round-5 artefacts: duplicate root-scope reads
  (`_jvm_build`, `_ruby_gemfile_text`, `_dotnet_project_text` each run once
  per axis), the standalone `latest_manifest_mtime` cost, and the double
  listing in `_dotnet_project_text` (`_has_dotnet_solution` lists a directory
  the walk then lists again). Each triggers on a profile showing it dominating
  a resolve pass.
- **Two cache-key gaps the round-5 note surfaced and did not close**:
  `setup.cfg` and `pytest.ini` are read by the python branch and are in
  neither name list, so a `pytest.ini`-only repository emits a pytest row
  while its key reports the greenfield sentinel. Pre-existing, and the honest
  place for it is here rather than inside a note that enumerates the gap it
  sits in.

`task roadmap-progress-check` exits 1 on this Iron-Law-3 notice and also names
`road-to-host-claims-the-tree-contradicts.md` (8/8 done, 2 deferred), which
predates this work — the notice is estate-wide, not a defect of this roadmap.
CI runs the narrow `roadmap-dashboard-untracked-check` instead, deliberately,
so a pre-existing estate condition is not a merge block; that narrow check is
green.
