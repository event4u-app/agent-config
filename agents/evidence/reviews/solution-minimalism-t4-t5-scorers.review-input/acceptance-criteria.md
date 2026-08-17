## Acceptance criteria

- [x] S0.1 produced a rung-by-rung table and the new-vs-extend decision follows
      the stated disjointness test, not preference.
      14 rows, one collision citation each, 12 EXTEND / 2 NEW. The re-scope
      followed the tally, and the repo's own complexity budget corroborated it
      independently.
- [x] S0.2 answered both questions with committed transcript evidence, and any
      real subagent-propagation gap left as its own change rather than being
      fixed here.
      YES / YES. No gap exists, so nothing was handed back and nothing was fixed
      here. The `SubagentStart` finding supersedes a prior "unverified" record.
- [x] The ladder ships as projected rule text (never a description-triggered
      skill), carrying **both axes** and the precedence table, with floors
      routed, zero safety-floor files touched, credits landed, and no effect
      claim anywhere.
      Ships as edits to `improve-before-implement` (a projected rule) and its
      routed guideline — never as a description-triggered skill, per F1. Both
      axes and the precedence ladder are in. Floors are **routed and untouched**:
      `engineering-safety-floor`, `security-sensitive-stop`,
      `senior-engineering-discipline` and `scale-discipline` have zero changed
      lines in this diff. No percentage appears anywhere in it. **Credits:
      cancelled, not forgotten** — see the cancelled Phase-1 step for the three
      reasons and the recorded council split.
- [x] The review lens passes its golden set **including** the lean fixture where
      it must emit the null and the fixture where the simpler form is longer, and
      no `delete:` finding can be emitted without its fence line.
      17 assertions green over five fixtures, with four negative cases proving
      the scorer discriminates. Contract-level, deterministic, no model call —
      the find-the-plant half is stated as needing a scored eval run rather than
      claimed.
- [ ] Phase 3 either reports from the full tier with every pre-registered <!-- blocked-by: phase3-harness-deltas-9-10 -->
      endpoint — added lines **paired** with cognitive complexity, plus
      search-adherence and the safety tier — or publishes the null; no number
      appears anywhere except rendered from the pinned report.
      ~~**Open — blocked, see the Phase 3 halt note.** Spend is the user's grant;
      the metric pair additionally needs a complexity endpoint that does not
      exist yet.~~
      **Corrected 2026-08-16 — both halves of that sentence are now wrong, and it
      is struck rather than rewritten.** The spend grant was given 2026-08-14 and
      the complexity endpoint landed 2026-08-16. The criterion stays **open** for
      a third reason it never named: the run itself needs deltas #9/#10
      ([`phase3-harness-deltas-9-10`](#blocker-phase3-harness-deltas-9-10)), and
      two of the pre-registered endpoints — the safety tier (T4) and
      search-adherence (T5) — are still unimplemented, so a run made today would
      report `INCONCLUSIVE` on them by design.
- [x] The scorer demonstrably refuses a size win that came with a complexity
      regression (proven on a golfed fixture, not asserted).
      ~~**Open — blocked with Phase 3.** The *lens* scorer already demonstrably
      refuses a golfed finding (`shrink:` where `flatten:` was required, proven
      on the `flatten-longer` fixture); the *benchmark* scorer this criterion
      names cannot exist before delta #11.~~
      **Closed 2026-08-16 — delta #11 landed, so the precondition this note named
      is spent.** The struck text is left in place rather than rewritten: it was
      an accurate reading at the time, and the pattern that keeps costing screens
      is a stale claim silently replaced instead of visibly superseded.
      The *benchmark* scorer refuses a golfed win on synthetic paired records: 8
      seeds where the ladder arm's median added lines fall from 30 to 10 while its
      median complexity rises from 3 to 9. Both moves are significant, and the
      verdict is `REFUSED-GOLFING` — the lines win is real, which is what makes
      the refusal load-bearing rather than an artefact of a weak sample.
      **The golfed *fixture* is the unit suite's, and it is a separate artefact
      from the scorer test — stated plainly because the first draft of this note
      implied one pair did both jobs.** There, a flat `classify` and its one-line
      nested-ternary twin are scored by the real parser: the shorter file scores
      strictly higher, which is the property that makes the T2 number able to see
      golfing at all. The scorer test then asks a different question — given such
      a pair of *distributions*, does the verdict refuse — and needs no parser.
      Neither test alone would be enough: a metric that cannot separate the
      fixtures makes the verdict vacuous, and a verdict that ignores the metric
      makes the fixtures decorative.
- [ ] All quality gates pass — see `quality-tools`.
