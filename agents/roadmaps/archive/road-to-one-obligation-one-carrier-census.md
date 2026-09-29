---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: >-
  Nothing in the active estate can be archived to pay for this one. The nearest
  existing instrument, report_carrier_divergence, measures two copies of the
  SAME rule disagreeing across install scopes - a different condition, and its
  own header forbids it acquiring the threshold this census would need. The
  estate stubs it might otherwise join count roadmaps, not obligation bodies.
  Parking it is the outcome the source's own convergence argues against: seven
  independent readings named this as the single largest remaining cost and none
  of them produced an artifact, which is how the theme has survived unmeasured.
relates:
  - slug: road-to-estate-triage-remaining-batches
    relation: disjoint
    note: >-
      That stub counts roadmaps. This counts obligation bodies across artifact
      classes. Neither number is derivable from the other.
---
# Road to one obligation one carrier census

> **Source:** `agents/tmp.old/inbox-2026-09-ab/t04/` — a round of independent
> code-level review outputs against one pinned head. This is the strongest
> convergence in the set: seven of the reviewers, scoring the tree between
> 9.2 and 10, named the same thing as the bottleneck in different words —
> mechanism density, estate restraint, runtime simplicity, and a proposed
> north star of "one obligation, one authoritative carrier, and delete the
> redundant copy". None of them produced a measurement, and the theme has now
> arrived across consecutive rounds as prose only.

## Goal

A read-only census that answers, per obligation, **how many distinct artifacts
carry its body** — so "mechanism density" stops being an impression and becomes
a number with named rows. Falsifiable: after Phase 2 a reader can name the ten
obligations with the most carriers, and open each carrier. The census
deliberately does **not** delete anything and does **not** become a gate.

## Non-goals, stated first because the source insisted on them

Every reviewer in the set who named this theme also named what not to build,
and the lists agree: no universal ledger, no shared state database, no second
registry with runtime behaviour, no new enforcement layer. This roadmap builds
a reporter and a table. If it ever grows a threshold it has become the thing
the source warned against.

## Phase 1 — Define what a carrier is, before counting anything

- [x] **1.1 Enumerate the carrier classes.** An obligation's body can sit in a
      kernel rule, a tier-2 rule, a skill, a context file, a guideline, a hook
      concern's injected text, or a command. List the classes and say which
      ones the census reads. A class left out is a named exclusion, never a
      silent one.
      verify: the reporter's header lists every class and the reason for each
      exclusion

      **Evidence.** `src/scripts/report_obligation_carriers.ts` prints its own
      header on every run. Six classes are READ, one root each: `rule`
      (`src/rules`), `skill` (`src/skills`), `command` (`src/domains`), `context`
      (`src/agent-src/contexts`), `guideline` (`docs/guidelines`), `contract`
      (`docs/contracts`). Six classes are EXCLUDED, each with a reason and the
      file count it withholds -- established by grepping the whole tree for an
      `Iron Law` heading or an inline `**Iron Law` restatement, so the cost of
      each exclusion is measured rather than asserted:

      | excluded class | withholds | reason, in short |
      |---|---|---|
      | hook concern injected text | n/a | the body is a TypeScript string literal, has no fence, needs a code parser. The largest honest gap. |
      | generated projections | ~150 files | `dist/` and the per-tool trees are byte-equal copies of `src/`; counting them doubles every row by construction |
      | workspace records under `agents/` | ~12 files (+~8 policies) | roadmaps / evidence / decisions record work ABOUT obligations |
      | `docs/decisions/` | 4 files | an ADR quotes an obligation as evidence, not as a second delivery |
      | templates | 1 file | `templates/rule.md` states a `{placeholder}` |
      | narrative documentation | 3 files | `ONBOARDING.md`, `docs/architecture.md`, `docs/hook-payload-capture.md` |

      The exclusion list is pinned by a test that fails if any entry loses its
      reason (`prints every exclusion with a reason`).
- [x] **1.2 Define carrier identity without a similarity matcher.** Two
      artifacts carry the same obligation when they state the same binding
      sentence, not when they score similar. Use the structural anchors this
      tree already has — the Iron Law fence, the named rule slug, the explicit
      cross-reference — and report `unknown` where none resolves.
      verify: run the matcher over three obligations known to be duplicated and
      three known not to be; the six verdicts are correct and `unknown` appears
      where it should

      **Evidence.** Three structural anchors, no score anywhere in the code:
      `fence-identity` (the fenced block under an `Iron Law` heading, equal after
      whitespace collapse), `explicit-cross-reference` (the file's own
      `Body migrated to X` / `Body merged into X`, resolved to a path) and
      `named-slug` (a ``canonical: [`X`]`` phrase naming the artifact that homes
      the law). A token that resolves to no file is recorded as
      `unknown:<token>`, never dropped.

      The six verdicts are pinned against a fixture tree built in the test rather
      than against the live corpus, so a rule edit elsewhere cannot make a stale
      number pass. All six correct:

      ~~~
      DUPLICATED    alpha    2  fence-identity           (same law, different wrapping)
                    beta     2  explicit-cross-reference (stub + the skill it named)
                    gamma    2  named-slug               (second rule names it canonical)
      NOT           delta    1  nothing points at it
                    epsilon  1  RESEMBLES alpha, different words - a similarity
                                matcher would fuse them; a structural one must not
                    zeta     1  LINKS gamma in prose without a canonicality claim
      ~~~

      `unknown` appears where it should and nowhere else: a rule whose
      ``Body migrated to `skill:never-built` `` resolves to nothing yields a
      carrier `unknown:skill:never-built` with `unresolved: true`; the `beta` row,
      whose pointer resolves, has `unresolved: false`.

      Sensitivity proven by sabotage, not asserted. `cp` backup first, restore
      from the copy, never a checkout:

      ~~~
      sabotage                                   tests that failed
      disable the named-slug anchor              2  (gamma verdict; "the fixed definition finds it")
      neutralise the migrated-to anchor          3  (beta verdict; the unknown row; "fixed definition finds it")
      drop assertScanned                         2  (both dead-scope tests)
      drop the SLUG_SHAPE guard                  1  (the false-positive regression)
      restored from the copy                    29 passed (29)
      ~~~

      One defect was found this way and fixed. The `canonical:?` pattern matched
      ``canonical `Phase <id>` form parsed by the dashboard`` in
      `roadmap-progress-mechanics.md` -- a claim about a heading format, not about
      a carrier -- and the census reported that obligation as carried by three
      artifacts, two of them `unknown`. A token must now be slug-shaped
      (`SLUG_SHAPE`), which is structural, not fuzzy; a regression test pins both
      live phrasings.
- [x] **1.3 Show the matcher red first.** Plant a duplicate that the current
      definition misses, watch the census under-count, then fix the definition.
      A census never seen under-count has unknown sensitivity.
      verify: the planted case is recorded with the count before and after

      **Evidence.** The planted case is the shape this tree actually uses: a
      migration stub restating a law in prose beside the artifact that now holds
      the body. `fence-identity` alone is blind to it -- the stub's law is prose,
      so there is no fence to compare.

      On the fixture, count BEFORE (`anchors: ['fence-identity']`) and AFTER
      (all three):

      ~~~
      obligation   before   after
      beta              0       2     (the stub does not appear in the table at all)
      gamma             1       2
      ~~~

      On the live tree, the same before/after, run twice from the CLI:

      ~~~
      $ ./scripts-run src/scripts/report_obligation_carriers --fence-only --no-write
      scanned 1073 markdown file(s) across 6 root(s)
      140 obligation(s); 3 carried by more than one artifact     <- the under-count

      $ ./scripts-run src/scripts/report_obligation_carriers --no-write
      scanned 1073 markdown file(s) across 6 root(s)
      171 obligation(s); 46 carried by more than one artifact    <- after the fix
      ~~~

      The blind definition's three rows are all `docs/contracts/pilot/` copies of
      two rules. Shipping it would have published "this tree has essentially no
      duplication", which is Risk 3 exactly -- the most comforting available
      output and the one most likely to be taken. `--fence-only` is kept as a flag
      so the under-count stays reproducible rather than merely recorded, and the
      test suite pins both counts so the fix cannot silently regress to the blind
      definition.

## Phase 2 — Report the census, read-only

- [x] **2.1 Emit the table.** One row per obligation: its slug, its carrier
      count, and each carrier's path. Output goes to stdout and to a gitignored
      path, never into the tracked tree.
      verify: run it; it prints rows and exits 0, and `git status` is unchanged

      **Evidence.** One row per obligation: slug, carrier count, and each
      carrier's path with its class and the anchor that put it there. Output goes
      to stdout and to `agents/runtime/reports/obligation-carriers.json`.

      ~~~
      $ git status --porcelain
       M src/agent-src/contexts/execution/autonomy-mechanics.md
      ?? src/scripts/report_obligation_carriers.ts
      ?? tests/scripts/report_obligation_carriers.test.ts

      $ ./scripts-run src/scripts/report_obligation_carriers --top 3
      ... wrote agents/runtime/reports/obligation-carriers.json

      $ git status --porcelain
       M src/agent-src/contexts/execution/autonomy-mechanics.md
      ?? src/scripts/report_obligation_carriers.ts
      ?? tests/scripts/report_obligation_carriers.test.ts     <- byte-identical

      $ git check-ignore -v agents/runtime/reports/obligation-carriers.json
      .gitignore:196:/agents/runtime/  agents/runtime/reports/obligation-carriers.json
      ~~~

      The reporter exits 0 on every corpus it can read. Its ONLY non-zero exit is
      a dead scope -- `assertScanned` refuses a walk that read zero files, because
      reporting `0 obligations` from an empty walk is the single most comforting
      wrong answer available. That refusal is an assertion about the instrument,
      not a verdict on any carrier count, and the script is invoked by no CI
      workflow, so it reds no build.
- [x] **2.2 Publish the ten highest counts with their paths.** Not a
      recommendation to delete — the input to the decision about whether to.
      verify: the ten rows exist and every path in them opens

      **Evidence.** `--top 10` at the head of the ordering. Nothing in this tree
      is carried by more than three artifacts, so the head is a plateau of four
      rows at 3 followed by a long tail at 2; the rows are listed in the
      reporter's own sort order.

      | n | obligation | carriers |
      |---|---|---|
      | 3 | `commit-policy` - NEVER COMMIT. NEVER ASK ABOUT COMMITTING. | `src/rules/commit-policy.md` / `src/rules/scope-control.md` / `src/agent-src/contexts/execution/autonomy-mechanics.md` |
      | 3 | `direct-answers` - DO NOT CLAIM WHAT YOU HAVEN'T VERIFIED. | `src/rules/direct-answers.md` / `docs/contracts/pilot/direct-answers.md` / `src/rules/session-canary.md` |
      | 3 | `direct-answers` - THE SHORTEST REPLY THAT FULLY ANSWERS THE QUESTION | `src/rules/direct-answers.md` / `docs/contracts/pilot/direct-answers.md` / `src/rules/session-canary.md` |
      | 3 | `non-destructive-by-default` - HARD FLOOR OVERRIDES EVERYTHING. | `src/rules/non-destructive-by-default.md` / `src/rules/autonomous-execution.md` / `src/rules/scope-control.md` |
      | 2 | `active-remediation` - NEVER IGNORE A REAL ISSUE YOU SPOT | `src/rules/active-remediation.md` / `docs/guidelines/agent-infra/active-remediation-mechanics.md` |
      | 2 | `analysis-skill-routing` (pointer) | `src/rules/analysis-skill-routing.md` / `src/skills/analysis-skill-router/SKILL.md` |
      | 2 | `brand-consistency` (pointer) | `src/rules/brand-consistency.md` / `src/rules/brand-source-of-truth.md` |
      | 2 | `broken-access-control` - AUTHENTICATED IS NOT AUTHORIZED. | `src/rules/broken-access-control.md` / `src/skills/authz-review/SKILL.md` |
      | 2 | `cli-output-handling` (pointer) | `src/rules/cli-output-handling.md` / `src/skills/rtk-output-filtering/SKILL.md` |
      | 2 | `code-comment-discipline` - A COMMENT STATES A WHY OR A CONSTRAINT | `src/rules/code-comment-discipline.md` / `docs/guidelines/code-clarity.md` |

      All twenty distinct paths open -- checked mechanically by extracting every
      path from the `--top 10` output and testing each with `test -f`; twenty
      `OK`, zero `MISS`.

      **Read it as what it is.** The number counts artifacts a reader can meet
      the obligation in. It is NOT a count of redundant bodies: a `named-slug`
      carrier may be a genuine second copy or a bare pointer, and no structural
      anchor separates the two, because the difference is whether the surrounding
      prose restates the law -- a judgement, not a structure. Narrowing it would
      mean scoring prose, which is the trade this census refuses. The limitation
      is stated in the reporter's own header so it travels with every run.

## Phase 3 — One decision, on evidence

- [x] **3.1 Take the top row and decide it, in writing.** One obligation, one
      chosen authoritative carrier, one recorded reason, and the redundant
      copies either removed or recorded as deliberately retained. One row, not
      ten — the source's own warning is that a consolidation programme is
      itself a mechanism.
      verify: the decision is recorded with the carrier it chose and the reason;
      the census re-run shows that row's count changed or states why it did not

      **The row.** `commit-policy` - `NEVER COMMIT. NEVER ASK ABOUT COMMITTING.
      EXCEPTIONS ARE EXPLICIT, NOT INFERRED.` Three carriers.

      **The authoritative carrier: `src/rules/commit-policy.md`.** It is the
      always-loaded rule whose whole subject is the obligation; `agent-authority`
      already names it the canonical for band 3; and both other carriers already
      name it canonical themselves, so choosing it contradicts nothing and is the
      choice the tree had half-made.

      **Removed: `src/agent-src/contexts/execution/autonomy-mechanics.md`
      section "Commit policy summary".** It restated the Iron Law, the four
      exceptions and the never-ask clause in three bullets. Two facts decided it.
      Nothing linked to the section -- a grep across `src/` and `docs/` found
      exactly one hit, its own heading -- so it was reachable only by scrolling.
      And it had already gone incomplete: it named the one-shot pre-scan ask as
      "the **only** permitted commit-related question", without the clause in
      `commit-mechanics` that retires that ask entirely when a roadmap declares
      `execution.mode`. A reader who followed the copy would have asked a question
      the execution contract had already covered. That is the failure mode
      redundancy produces first -- incompleteness, not contradiction; it reads as
      authoritative right up to the case it was never updated for. Replaced by the
      pointer it should always have been, with the reason left in the file so a
      future reader meets it there rather than in an archived roadmap.

      **Deliberately retained: `src/rules/scope-control.md` git-operations
      section.** Its line is one clause of a seven-clause git-ops list -- commit
      sits beside push, merge, rebase, branch, PR and tag. Deleting it would leave
      the list naming six of seven git operations and silently omitting the one
      most often attempted, which is a worse failure than the duplication it
      removes. The line names the canonical rule directly above it, so a reader
      who needs the exceptions is one hop away.

      **The census re-run: the count did NOT change, and this is the reason.**
      Still 3. The `named-slug` anchor fires on the ``canonical [`commit-policy`]``
      phrase, which the edit deliberately KEEPS -- what was deleted is the
      restated body underneath it. The instrument counts artifacts that name the
      obligation, and it cannot distinguish a restatement from a pointer, because
      that difference lives in prose and this census refuses to score prose. So a
      row whose redundant copy is replaced by the pointer it should have been
      keeps its count. That is a finding about the instrument rather than a
      failure of the decision, and it is now recorded in the reporter's own header
      (`WHAT A COUNT DOES NOT DISTINGUISH`) so no later reader takes a flat count
      as evidence that nothing moved.

      **One row, not ten.** Risk 4 says working the queue is itself a mechanism.
      The other 45 multi-carrier rows are published and untouched.

## Acceptance criteria

- The census names every carrier class it reads and every one it excludes.
- Carrier identity resolves structurally; no similarity score decides a match.
- The matcher was seen under-counting a planted duplicate before it was fixed.
- The reporter writes nothing into the tracked tree.
- Exactly one obligation's carrier set is decided in Phase 3, with its reason.
- The census carries no threshold and reds no build.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-29 | reviewer: agent -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The census acquires a threshold and becomes a gate | product | A count with named rows invites a ceiling, and a ceiling in this tree becomes a gate. The convergence this roadmap answers was that mechanism density is the bottleneck; a census that reds a build on carrier count would add one more mechanism while claiming to measure them, which is the outcome every reviewer in the source set named as the thing not to build. | The Non-goals section and the last acceptance criterion both forbid it, and step 2.1 fixes the output as a report to stdout and a gitignored path with no exit-code opinion. A threshold would fail a stated criterion rather than merely disappoint an intention. | Phase 2 — Report the census, read-only |
| 2 | Carrier identity is decided by a similarity matcher | implementation | "Same obligation" is easiest to approximate with a similarity score, and a score makes every count unfalsifiable: a reader who disagrees with a row cannot check it, only re-tune the threshold until it goes away. The census would then publish numbers nobody can contest or reproduce, on a question whose whole value is that it is checkable. | Step 1.2 requires the structural anchors this tree already has — the Iron Law fence, the named rule slug, the explicit cross-reference — and an explicit `unknown` where none resolves. Its verify runs six known cases, three duplicated and three not, and demands the correct verdict on each. | Phase 1 — Define what a carrier is, before counting anything |
| 3 | The census under-counts and its zero is read as "no duplication" | implementation | A matcher built from anchors will miss duplicates stated in different words, and a low count is the most comforting output available — it would be published as evidence the density concern was overstated. An untested matcher cannot support that reading, and the reading is the one most likely to be taken. | Step 1.3 requires a planted duplicate to be missed and the under-count observed before the definition is fixed, with the counts before and after recorded. A census never seen under-count has unknown sensitivity and is not evidence about anything. | Phase 1 — Define what a carrier is, before counting anything |
| 4 | Phase 3 turns into a consolidation programme | product | Ten rows with open-able paths is an obvious work queue, and working the queue is itself a mechanism — the thing the source explicitly warned against. A sweep would also delete carriers on the strength of a count whose sensitivity had only just been established, trading a measurement problem for a deletion one. | Step 3.1 caps the phase at exactly one obligation and that cap is an acceptance criterion, not advice. The redundant copies of that single obligation are either removed or recorded as deliberately retained, so the decision is visible in both directions. | Phase 3 — One decision, on evidence |
| 5 | The count is published and nothing is decided | product | The theme has arrived across consecutive review rounds as prose, from seven independent readings scoring the tree between 9.2 and 10, and has produced no artifact. A census that stops at a table repeats that failure one level up: the number exists, nothing moves, and the next round names the same bottleneck in different words again. | Phase 3 exists for exactly that, and its verify requires a recorded decision naming the chosen authoritative carrier and the reason, plus a census re-run showing that row's count changed or stating why it did not. | Phase 3 — One decision, on evidence |
