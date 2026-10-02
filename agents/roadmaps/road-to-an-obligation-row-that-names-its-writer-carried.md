---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
parent_roadmap: road-to-an-obligation-row-that-names-its-writer
---
# Road to an obligation row that names its writer — carried

> **Source:** carried by the archival sweep on 2026-10-02 from
> [`road-to-an-obligation-row-that-names-its-writer`](archive/road-to-an-obligation-row-that-names-its-writer.md), which closed every other step.
> Each step below was `[~]` there and is restated verbatim as open work, so
> archiving the parent buried nothing. Blockers the steps name moved with them.

## Goal

Every step road-to-an-obligation-row-that-names-its-writer deferred is either done here or explicitly disposed
of — a step that still cannot run is re-deferred with its reason, never
left to read as finished.

## Phase 1 — Deferred steps carried from road-to-an-obligation-row-that-names-its-writer

- [ ] <!-- blocked-by: shadow-corpus-is-one-machine | asked: no — non-interactive process-full run: it reports once at the end and cannot put a question, and the decision amends a pre-registered public claim the claims register itself records as owner-reserved --> **2.2 Resolve the corpus blocker below.** The reporter makes the question
      answerable with a number; the answer is not an agent's to give.
      verify: the blocker's `Status` reads `resolved` with the chosen option named

      **OPEN, deliberately, and this step is not agent-closable by its own
      terms.** The blocker's owner is `maintainer` and this step says in its own
      words that the answer is not an agent's to give; choosing among (a), (b)
      and (c) amends a pre-registered public claim and is owner-reserved. An
      agent closing it would be manufacturing the decision the step exists to
      route away from itself.

      What Phase 2 could do for the decision, it has done — the question is now
      answerable with a number rather than with a paragraph:

      - The split is computable: `./scripts-run
        src/scripts/report_obligation_writer_split --root <checkout>`.
      - Its first reading is in 2.1 above: 8 ledgers, 179 `delivered` rows, **0
        shadow rows** against a pre-registered floor of 100, every row `absent`.
      - **That reading is SUPERSEDED on its qualification half, by a change that
        landed after Phase 2 ran.** `docs/CLAIMS.md` clause (9), filed
        2026-09-29 by `road-to-a-stop-that-holds` step 3.1 and confirmed live
        here (`git merge-base --is-ancestor 5c9415258 origin/main` exits 0),
        RESET the window at that commit: until it, the settle hook resolved its
        session from `CLAUDE_CODE_SESSION_ID`, which the dispatcher never sets,
        so every dispatched stop event was a non-reading. The sample is empty as
        of the reset, and the zero-shadow half of every earlier reading is
        explained by that defect rather than by clean turns. Neither 2.1's
        figures nor the "Why now" section's may be cited as a base rate.
      - **RE-READ 2026-09-30, same unit as 2.1** — one row in one `*.json`
        ledger under `<root>/agents/runtime/state/obligations/`, `--root` the
        maintainer checkout, counted per row array:

        ```
        rows          package consumer  unknown   absent    total
        delivered          13        0        0      190      203
        discharged          0        0        0        0        0
        shadow              0        0        0        0        0
        ```

        The field is producing rows: **13 `package`** where 2.1 read 0 and
        called every row `absent`. So the split the step promised is now
        non-trivially readable rather than only computable. **`consumer` is 0**,
        and that is the observation the blocker's question is about — it is a
        reading and not a property of the corpus, which is live, gitignored and
        janitor-pruned and grows between any two readings. The number the bar
        counts is unchanged in every reading taken so far: **shadow rows = 0**.
        Nothing here is a verdict on (a), (b) or (c).
      - **A finding for whoever decides:** option (a) is smaller than it looks.
        Clause (7) of `obligation-settle-shadow-bar` ALREADY says the corpus "is
        one machine's gitignored runtime state … and measures THIS install rather
        than the package's population. A bar read off it is a statement about
        this operator's turns." What (a) adds is the explicit negative — that a
        passing reading is not evidence about a consumer — not the scope bound
        itself, which is already filed. (a) is therefore an amendment of one
        sentence, not a new position.
      - Nothing here recommends an option. The roadmap's own `Recommendation:`
        line stands as written and is the author's, not this execution's.

      **Evidence (2026-10-01).** Marked `[~]` deferred rather than left bare
      `[ ]`: the glyph now says a session looked and routed it, not that nobody
      reached it. Nothing about the disposition changed — the step is still not
      agent-closable, for the reason it already gave, now re-checked rather than
      inherited.

      THE BLOCKER'S `Resolved when` WAS EXECUTED, not trusted. It reads: "the
      chosen option is written into the claim in `docs/CLAIMS.md`, and the
      roadmap step that reads the bar cites it." Neither half holds —
      `grep -n 'shadow-corpus-is-one-machine' docs/CLAIMS.md` returns exactly
      one line, clause (8), and that line is the register recording the question
      as still open: "whether to accept the one-machine corpus … to widen the
      corpus to a second real tree, or to file the window `resolved-null`, is
      owner-reserved and open as the `shadow-corpus-is-one-machine` blocker on
      that roadmap." No option is named anywhere in the claim. `Status: open` is
      accurate.

      WHY THIS RUN DID NOT PICK ONE, stated as a routing decision and not as
      timidity. The blocker is `Ownership: business-owned`. Option (b) needs a
      second real operator's tree running the built dispatcher, which no agent
      can supply. Options (a) and (c) amend a pre-registered public claim
      downward, which is the owner-reserved row in `decision-revisit-gate`
      ("creates / removes / weakens a … public commitment") — and clause (8),
      already merged to `main`, says so in the committed register itself. An
      agent instruction is not the owner's word, so picking here would
      manufacture the decision this step exists to route away from itself.

      THE OTHER THREE ACCEPTANCE CRITERIA WERE RE-VERIFIED LIVE, since a
      deferral is only honest if what it sits on still holds:

      - The enumerated shape survives: `sed -n '/^export type WriterRole/,/unknown.;/p'`
        prints the three literals and nothing else, and the only
        `payload|notes|extra` hit in `src/scripts/_lib/obligations.ts` is the
        comment at `:78` documenting their absence.
      - `tests/scripts/obligations.test.ts` (39) and
        `tests/scripts/obligation_writer_split.test.ts` (18) — **57 passed**.
      - The window reset is live: `git merge-base --is-ancestor 5c9415258
        origin/main` exits 0.

      RE-READ 2026-10-01, same published unit as 2.1 and the 2026-09-30 read —
      one row in one `*.json` ledger under
      `<root>/agents/runtime/state/obligations/`, `--root` the maintainer
      checkout, counted per row array:

      ```
      scanned: <checkout>/agents/runtime/state/obligations
        ledgers: 10

      rows          package consumer  unknown   absent    total
      delivered          39        0        0      190      229
      discharged          0        0        0        0        0
      shadow              0        0        0        0        0
      all                39        0        0      190      229

      shadow rows — the only array the pre-registered bar counts: 0
      EXIT=0
      ```

      ONE NEW OBSERVATION, and it is a trend rather than a point reading, which
      is the first thing in this roadmap that is: across three readings spanning
      three days, `package` went **0 → 13 → 39** while `consumer` stayed **0 → 0
      → 0** and `absent` froze at **190** after the field reached the built
      dispatcher. `absent` freezing is the expected terminal behaviour — no new
      pre-field row can appear — and it is what makes the other two readable as
      a trend instead of noise. The bearing on the blocker is option (b)'s: the
      corpus is not widening on its own, so (b) describes work somebody must do
      and not a state the window might drift into. That is an observation. It is
      not a verdict on (a), (b) or (c), and this run reaches none.

      THE DECISION IS STILL CHEAP, which is the one thing that argues for taking
      it soon rather than later, and it is 1.3's argument re-measured. The bar
      counts **shadow rows = 0** in every reading ever taken, against a
      pre-registered floor of **100**, with **>= 50 affected sessions** also
      unmet and **2 of the >= 30 calendar days** elapsed since the 2026-09-29
      reset. Clause (5) governs: "UNDERPOWERED is neither a pass nor a null."
      Nothing has accumulated that could become the argument for its own
      retention, so whichever option the owner picks costs nothing to pick now.

      EXACTLY WHAT A FUTURE SESSION NEEDS, and all four are owner inputs, not
      lookups:

      1. The owner names exactly one of (a), (b) or (c) from the blocker below.
      2. It is written into `docs/CLAIMS.md` under `obligation-settle-shadow-bar`
         as a new clause (10), naming the option and its reason, in the shape
         clauses (8) and (9) already use.
      3. The blocker's `Status:` flips to `resolved` with that option named, and
         this step flips `[~]` → `[x]` citing clause (10).
      4. Then this roadmap archives, and the arming decision in
         `road-to-a-ledger-that-closes-the-loop` unblocks.

## Blockers

### blocker: shadow-corpus-is-one-machine
- **Status:** open
- **Owner:** maintainer
- **Ownership:** business-owned — the decision amends `obligation-settle-shadow-bar`,
  a pre-registered claim in `docs/CLAIMS.md`, and clause (8) of that claim already
  records the question as owner-reserved. Options (a) and (c) weaken a public
  commitment; (b) requires a second real operator's tree. None is a technical
  judgement the closure ladder could have closed, which is why it is filed here
  rather than resolved as a `## Decisions` row.
- **Blocks:** 2.2, and the arming decision in `road-to-a-ledger-that-closes-the-loop`
- **What to do:** exactly one of —
  (a) accept the one-machine corpus, and amend the pre-registered bar to say in
      its own words that a passing reading describes this checkout's habits and
      is not evidence about a consumer;
  (b) widen the corpus deliberately — a second tree that runs the built
      dispatcher — and restate the sample floor against the widened population;
  (c) file the window `resolved-null` now on the ground that the population it
      needs does not exist, and require a new pre-registered claim before any
      arming.
- **Resolved when:** the chosen option is written into the claim in
  `docs/CLAIMS.md`, and the roadmap step that reads the bar cites it.
- **Recommendation:** (a) is the cheapest honest move and loses nothing that is
  not already lost — the bar's own sample floor is unreachable at the observed
  rate, and an amended bar that says so is a smaller claim than a green one.
- **If you do nothing:** the window keeps accumulating rows that cannot be
  separated by writer, and the first reading that clears the floor will be cited
  as evidence about a population it never measured.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-02 | reviewer: archive-sweep/auto-carry -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Carried steps stay blocked indefinitely | implementation | A step deferred once for elapsed time or a decision can sit here as long as it sat in the parent | It now counts as open work in the dashboard instead of as 100 %, and its blocker is listed where the estate gates count it | Phase 1 — Deferred steps carried from road-to-an-obligation-row-that-names-its-writer |

## Acceptance Criteria

- [ ] AC-1 — No step carried from `road-to-an-obligation-row-that-names-its-writer` is still `[ ]` without a recorded disposition.
