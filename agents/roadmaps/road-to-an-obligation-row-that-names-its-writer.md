---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: >-
  Nothing in the active estate can be archived to pay for this one. The receiver
  it would otherwise join, road-to-a-ledger-that-closes-the-loop, is the roadmap
  that WROTE the honest prose bound this roadmap turns into a field, and it is
  mid-window under a pre-registered bar that resets on any change to the
  detector's exposure - so folding a schema change into it would reset the very
  qualification it is accumulating. Parking it loses the one measurement that is
  cheap only while the window is still empty.
relates:
  - slug: road-to-a-ledger-that-closes-the-loop
    relation: extends
    note: >-
      That roadmap owns the detector, the shadow bar and the refutation. This
      one adds the writer-identity field its own corpus bound already describes
      in prose, and asks the corpus question its refutation surfaced.
---
# Road to an obligation row that names its writer

> **Source:** `agents/tmp.old/inbox-2026-09-ab/t04/` — a round of independent
> code-level review outputs against one pinned head, plus a supplied audit
> artifact. Three of the reviewers converged on the same unaddressed
> consequence of this tree's own strongest self-refutation.

## Goal

An obligation-ledger row records **which tree wrote it**, so a later reader can
separate rows produced inside the maintainer checkout from rows produced by an
installed consumer copy — and the pre-registered shadow bar cannot be satisfied
by a corpus that is one machine, without that fact being visible in the data
rather than only in a roadmap paragraph. Falsifiable: after Phase 1, every new
row carries a writer field, and a reader can compute the maintainer-versus-other
split from the ledger alone.

## Why now, and what changed since the source was written

The source read the tree at a head where the detector commit was unreleased and
attributed the empty window to that. Re-measured against this tree on
2026-09-29, nine days later:

- `git merge-base --is-ancestor 70b3559bd 16.1.0` now exits **0** — the detector
  IS in a cut release. The release the earlier reading treated as the unblocker
  has happened.
- `grep -rl appendDelivered` over the installed global tree still returns **0**
  files. The installed copy does not carry the writer.
- `agents/runtime/state/obligations/` holds **7** session ledgers (2 at the
  source's pin). Every one carries `"shadow": []`. Total `delivered` rows: 121.
  Shadow rows: **0** of the pre-registered floor of 100.

> **The two counts above did not reproduce at execution, and step 2.1 records
> the re-measurement.** 8 ledgers and 179 `delivered` rows, same day, by a
> published unit. The corpus is live and janitor-pruned, so it grows between any
> two readings and neither count is a property of it. The figure the bar counts
> is unchanged in both readings: **shadow rows = 0**. Quote that one, not these.

So the release changed the tag and changed nothing the bar counts, exactly as
`road-to-a-ledger-that-closes-the-loop` predicted in prose — and the prose is
still the only place that fact lives. A row is `{rule, class, at}`; the ledger
is `{discharged, shadow, session_id, delivered}`. Nothing in either says which
tree produced it.

## Phase 1 — Make the writer visible in the row

- [x] **1.1 Add a writer-identity field to the ledger record.** A stable,
      non-identifying discriminator — the resolved dispatcher root's role, not a
      path, not a username, not a hostname — so the field cannot carry a
      developer's directory layout into a record set the bar will be read from.
      Absent or unresolvable is its own value, never a guess.
      verify: a newly written ledger under `agents/runtime/state/obligations/`
      carries the field, and `node -e` over it prints the discriminator

      **Done.** `src/scripts/_lib/obligations.ts` gains `WriterRole` — a closed
      union of `package` | `consumer` | `unknown` — and `resolveWriterRole(root)`,
      which reads `hasSentinel` from `repo_root.ts` for the package branch and the
      canonical `manifest_path()` for the consumer branch. Both are shape probes
      on the root; neither value ever enters the row. `package` is tested FIRST
      because this repository installs itself, so a consumer-first order would
      label the maintainer checkout `consumer` on exactly the machine the bar is
      read from. All three arrays — `delivered`, `discharged`, `shadow` — carry
      it, because the array the pre-registered bar actually counts is `shadow`.

      The field is STAMPED by the append functions from the `root` they were
      already given, never supplied: callers take `WriterInput<T>` (the stored
      shape minus `writer`), so a caller able to set it wrong does not exist.

      verify — a ledger written into a fresh temp root carrying the sentinel,
      then read back off disk:

      ```
      $ node --import tsx wprobe.mjs
      {
        "discharged": [],
        "shadow": [],
        "session_id": "demo-session",
        "delivered": [
          {
            "rule": "minimal-safe-diff",
            "class": "hook",
            "at": "2026-09-29T13:57:47Z",
            "writer": "package"
          }
        ]
      }
      ```

      Covered by `tests/scripts/obligations.test.ts` (39 tests, green).
      SENSITIVITY, each probe applied to a copy and reverted from a copy:
      inverting the resolution order failed exactly 1 test (the order contract);
      dropping the delivered stamp failed exactly 3; dropping the discharge and
      shadow stamps failed exactly 2. A test never seen red has unknown
      sensitivity, so each was seen red before this step closed.
- [x] **1.2 Confirm the field cannot hold free-form content.** The record type
      gains one enumerated field and no `payload`, `notes` or `extra` slot, so
      privacy is a property of the shape rather than of a scrubber.
      verify: the type declaration lists only enumerated members; grep the
      writer path for any interpolation of a filesystem path into the record

      **Done — and the shape is the control, not a check.** The type declaration
      is a union of three string literals and nothing else:

      ```
      $ sed -n '/^export type WriterRole/,/unknown.;/p' src/scripts/_lib/obligations.ts
      export type WriterRole =
          | 'package'
          | 'consumer'
          | 'unknown';
      ```

      No `payload`, `notes` or `extra` slot was added to any row type:

      ```
      $ grep -nE '(payload|notes|extra)' src/scripts/_lib/obligations.ts
      (no output)
      ```

      And the writer path interpolates no filesystem path into the record. `root`
      is read only to build probe paths inside `resolveWriterRole`; what the
      function returns is one of the three literals, and no serialiser sees a
      path:

      ```
      $ grep -nE 'serialise|merged\.push|shadow: \[' src/scripts/_lib/obligations.ts \
          | grep -E 'root|cwd|homedir|hostname'
      (no output)
      ```

      Asserted rather than only grepped, because a grep is a snapshot and a test
      is a ratchet: `tests/scripts/obligations.test.ts` pins the stored row at
      exactly four keys (`at`, `class`, `rule`, `writer`) and asserts that a
      ledger written under a root named `a-directory-name-nobody-should-see`
      contains neither that name nor `os.homedir()`. SENSITIVITY: adding one
      `root: process.cwd()` field to the serialiser failed exactly those 2 tests.
- [x] **1.3 State in the bar whether the field resets qualification.** The
      pre-registered clause resets on any change to the detector's exposure and
      carries an additive carve-out for a field that leaves every count and
      every allow path untouched. Say which this is, in the claim, before the
      field ships.
      verify: `docs/CLAIMS.md` obligation-settle-shadow-bar names this change
      and its qualification effect

      **Done. The verdict is ADDITIVE CARVE-OUT APPLIES — qualification is NOT
      reset** — and `docs/CLAIMS.md` carries it as clause (8) of
      `obligation-settle-shadow-bar`, with the reason stated so a later reader
      can check it rather than trust it. Clause (2) names five surfaces whose
      change resets qualification; this change touches none of them.

      `touchedPaths` and `computeVerdict` live in
      `src/scripts/hooks/obligation_settle_hook.ts` and `REFUSABLE_CLASSES` in
      `src/scripts/_lib/obligation_frequency.ts`. Neither file is in the diff,
      and neither is the dispatch gate — the whole changed set is:

      ```
      $ git diff --name-only ; git ls-files --others --exclude-standard
      agents/roadmaps/road-to-an-obligation-row-that-names-its-writer.md
      docs/CLAIMS.md
      src/scripts/_lib/obligations.ts
      src/scripts/hooks/rule_inject_hook.ts
      tests/scripts/obligations.test.ts
      src/scripts/report_obligation_writer_split.ts
      tests/scripts/obligation_writer_split.test.ts
      ```

      The injector's delivered-row write keeps the rule id as its idempotency
      key, so the SET of rows written and every `added` count are identical; the
      concern still returns `EXIT_ALLOW` on every path. The field adds a column;
      it moves no count and opens no allow path.

      The decision was taken while the window is still empty — 0 shadow rows —
      and is therefore cheap to restart if a later reader disagrees with this
      carve-out reading. That ordering is the point: deciding it after the window
      had filled would have made the accumulated rows the argument.

## Phase 2 — Report the split, decide the corpus

- [x] **2.1 Report the maintainer-versus-other split, read-only.** A reporter
      over the existing ledgers that prints rows by writer class. It writes
      nothing into the tracked tree.
      verify: run it against the current 7 ledgers; it prints a split and exits 0

      **Done.** `src/scripts/report_obligation_writer_split.ts` — read-only,
      creates nothing (not even the ledger directory it looks for), gates
      nothing, exits 0 on every path but a usage error.

      THE UNIT, published before the number: **one row in one `*.json` ledger
      file under `<root>/agents/runtime/state/obligations/`, counted per row
      array.** A file that will not parse is counted as `unreadable` rather than
      skipped in silence. `absent` (no `writer` field — a row written before this
      change) is reported APART from `unknown` (a field present and outside the
      vocabulary), because folding them together would let the whole pre-field
      corpus read as "we looked and could not tell", which is a stronger claim
      than the rows support. An ABSENT ledger directory is reported as the
      absence of a corpus and never as a corpus of zero — the two produce the
      same count and answer different questions.

      ```
      $ ./scripts-run src/scripts/report_obligation_writer_split --root <checkout>
      scanned: <checkout>/agents/runtime/state/obligations
        ledgers: 8

      rows          package consumer  unknown   absent    total
      delivered           0        0        0      179      179
      discharged          0        0        0        0        0
      shadow              0        0        0        0        0
      all                 0        0        0      179      179

      shadow rows — the only array the pre-registered bar counts: 0
      EXIT=0
      ```

      **THIS ROADMAP'S OWN FIGURES DO NOT REPRODUCE, and no figure from them is
      carried forward.** The "Why now" section above records **7** ledgers and
      **121** `delivered` rows, measured 2026-09-29. Re-measured the same day by
      the unit above: **8** ledgers and **179** `delivered` rows. The corpus is
      live, gitignored and janitor-pruned, so it grows between any two readings
      and neither figure is wrong — which is exactly why a point-in-time count
      may not be quoted as a property of the corpus, and why the unit is
      published above rather than the total. The number the bar actually counts
      is identical in both readings and is the one that matters: **shadow rows =
      0**, against a pre-registered floor of 100. Every row in the corpus reads
      `absent`, i.e. predates this field; the rows that will decide the bar do
      not exist yet.

      Covered by `tests/scripts/obligation_writer_split.test.ts` (18 tests,
      green). SENSITIVITY, each probe applied to a copy and reverted from a copy:
      making an absent directory report as an existing one failed exactly 2
      tests; folding `absent` into `unknown` failed exactly 2; dropping the
      `unreadable` count and the empty-directory wording failed exactly 2.
- [ ] **2.2 Resolve the corpus blocker below.** The reporter makes the question
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

### blocker: shadow-corpus-is-one-machine

**Status:** open
**Owner:** maintainer
**Blocks:** 2.2, and the arming decision in `road-to-a-ledger-that-closes-the-loop`
**What to do:** exactly one of —
  (a) accept the one-machine corpus, and amend the pre-registered bar to say in
      its own words that a passing reading describes this checkout's habits and
      is not evidence about a consumer;
  (b) widen the corpus deliberately — a second tree that runs the built
      dispatcher — and restate the sample floor against the widened population;
  (c) file the window `resolved-null` now on the ground that the population it
      needs does not exist, and require a new pre-registered claim before any
      arming.
**Resolved when:** the chosen option is written into the claim in
`docs/CLAIMS.md`, and the roadmap step that reads the bar cites it.
**Recommendation:** (a) is the cheapest honest move and loses nothing that is
not already lost — the bar's own sample floor is unreachable at the observed
rate, and an amended bar that says so is a smaller claim than a green one.
**If you do nothing:** the window keeps accumulating rows that cannot be
separated by writer, and the first reading that clears the floor will be cited
as evidence about a population it never measured.

## Acceptance criteria

- Every obligation-ledger row written after Phase 1 carries a writer field.
- The split reporter runs read-only against the existing ledgers and prints a
  number for each class.
- The pre-registered bar states whether this change reset its qualification.
- The corpus blocker carries a resolved status with one named option.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-29 | reviewer: agent -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The writer field becomes a path or a hostname | implementation | The obvious implementation of "which tree wrote this" is the dispatcher root's filesystem path, which carries a developer's directory layout and usually their username. A governance ledger becomes a privacy surface in one field, and because the bar is read by quoting rows, every row already written would have to be discarded rather than scrubbed. | Step 1.1 restricts the field to a resolved role discriminator with absent as its own value, never a guess. Step 1.2 makes the enumerated shape the control — no `payload`, `notes` or `extra` slot — the same by-construction posture the telemetry event uses, and its verify greps the writer path for any interpolation of a filesystem path. | Phase 1 — Make the writer visible in the row |
| 2 | The field resets the shadow window's qualification unnoticed | implementation | The pre-registered bar resets qualification on any change to the detector's exposure, with an additive carve-out for a change leaving every count and every allow path untouched. Shipping the field without deciding which side it falls on means the window keeps accumulating under a qualification nobody confirmed still holds, and the reset surfaces when the window is read — at which point the accumulated rows are worth nothing. | Step 1.3 puts the qualification question into `docs/CLAIMS.md` before the field ships, and its verify requires the obligation-settle-shadow-bar claim to name this change and its effect. The decision is taken while the window is still empty and therefore cheap to restart. | Phase 1 — Make the writer visible in the row |
| 3 | The split is reported and read as licence to arm early | product | A reporter that prints a maintainer-versus-other split hands the arming discussion its first real number, and a number is read as a verdict. Arming the detector on the observed corpus — 7 ledgers, 121 delivered rows, 0 of a pre-registered floor of 100 shadow rows — would put a live gate behind a bar that measured one machine's habits. | Step 2.2 routes the decision to the corpus blocker rather than to the reporter's output, and all three of that blocker's options name arming as owner-reserved. The reporter itself writes nothing into the tracked tree and reaches no verdict; it prints a split and exits 0. | Phase 2 — Report the split, decide the corpus |
| 4 | Widening the corpus is read as an instruction to generate traffic | product | Option (b) asks for a second real tree running the built dispatcher. The cheap misreading is to manufacture shadow rows — synthetic sessions, replayed prompts, a loosened detector threshold — until the floor of 100 is cleared. That satisfies the count and destroys the only thing the count was ever evidence for. | The blocker's option (b) names a second real tree, and neither alternative offers a synthetic path: (a) amends the bar downward in the open, (c) files the window `resolved-null`. Four of the source's reviewers independently refused threshold-tuning, and that refusal is recorded beside the options rather than left implicit. | Phase 2 — Report the split, decide the corpus |
