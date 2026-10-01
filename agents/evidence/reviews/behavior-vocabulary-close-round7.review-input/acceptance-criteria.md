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

      **No recommendation:** the grep over all seven touched source files
      returns 8 lines, every one classified in step 3.3's evidence — one
      pre-existing native-axis basis string naming the composer manifest
      section, one comment explaining why the behaviour axis avoids the
      phrase, one pre-existing test title, and the forbidden-substring list
      inside the assertion that enforces the prohibition. Two further strings
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
