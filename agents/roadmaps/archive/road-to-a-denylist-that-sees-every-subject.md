---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Archiving is not available — this names a live gate gap, not finished work. Parking costs more than adding: the eight uncaught names are already written in plaintext inside an un-consumed inbox folder, so every hour parked is an hour in which a copy-paste lands them in the tracked tree with the gate green. Merging into road-to-a-scorecard-that-runs costs more still: that lane is a draft blocked on an owner decision about whether a second command exists at all, so folding this in would gate a four-line data fix behind a programme decision it does not depend on."
relates:
  - slug: road-to-corpus-refresh-cadence-shape
    relation: extends
    note: "a subject set with a refresh cadence gains subjects over time; every added subject is a denylist row, and this states that obligation in the gate rather than in a habit"
---

# Road to a denylist that sees every subject

> **Source:** `agents/tmp.old/inbox-2026-09-ab/t06/` — a comparative audit
> package naming ten external reference subjects, delivered alongside nine
> drafted roadmaps whose source-confidentiality assurance rests on
> `check_no_external_sources` catching those names. No `relates:` row points at
> those nine: none of them exists in the estate yet, and a `relates:` slug that
> resolves to nothing is a ghost parent — the defect this round's lineage read
> already found twice inside the supplied set.

## Goal

`check_no_external_sources` catches every subject name the current comparison
corpus uses. This roadmap is closed when a file naming any of the ten reds the
gate, and when adding an eleventh subject cannot silently skip the row.

**The Goal's original figure did not reproduce, and the corrected reading is
below.** As written this Goal said the gate catches **two of ten**, "only the two
subjects that entered the tree through an earlier harvest". Re-measured at
execution — unit and command published in step 1.2 — it catches **five of ten**:
S1, S2, S3, S4 and S6 already carried `deny` patterns from earlier ecosystem
sweeps, and the original gloss undercounts those sweeps by three. Uncaught:
S5, S7, S8, S9, S10. The shape of the defect is unchanged and still real — the
gate was green on a tracked file that could name five external subjects in
plaintext, and the round that produced nine roadmaps read that green as
confirmation its files were clean — but the size is five, not eight, and no
step below carries the `2 of 10` figure forward.

## Phase 1 — Make the gap reproducible before closing it

- [x] **1.1 Add a fixture that names every current subject and assert the gate reds on it.**
      The fixture is one file under `tests/fixtures/` holding the ten subject
      names as prose, exactly as an author would type them. It exists first and
      fails first: a denylist change verified only by "the gate is green on the
      tree" is verified against a tree that does not contain the names, which is
      the condition that produced this gap. Write the test RED, with the eight
      uncaught names named in the failure output, before touching the denylist.
      verify: `./scripts-run src/scripts/check_no_external_sources <fixture>` exits non-zero and its output names eight tokens, not two
      Done 2026-09-29. `tests/scripts/external_source_subject_registry.test.ts`.
      **The verify command as written is not executable and was substituted, not
      skipped.** `check_no_external_sources` takes no path argument — it walks
      `git ls-files` over the whole tracked tree — so "run the gate against a
      fixture" is only reachable by giving the gate a tree of its own. The test
      does exactly that, reusing the harness the sibling
      `check_no_external_sources.test.ts` already established: the SHIPPED config
      and the real gate are planted in a throwaway git repo, the fixture is
      written there, and the gate is run for real. · **The fixture is generated
      at run time and never committed**, per Risk 2 and AC-5: its body is
      synthesised from the `subjects` registry, one subject per line, so the
      assertion is over LINE POSITIONS and the test file names nothing. ·
      **Written RED first, and shown red by removing the ten new `deny` rows from
      a backed-up copy** (`cp` to the scratchpad, edit, re-run, restore from the
      copy — never `git checkout`). Exactly three of eight tests failed, and the
      third is the fixture limb: `expected [ 1, 2, 3, 4, 6 ] to deeply equal
      [ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 ]` — five subjects uncaught, at the exact
      positions 1.2 predicts. The binding limb printed `5 of 10 registry subjects
      have no deny pattern … expected [ 'S5', 'S7', 'S8', 'S9', 'S10' ] to deeply
      equal []`. · **The step's own "names eight tokens, not two" is the Goal's
      wrong figure restated**; the failure output names five IDS, not eight
      tokens, because naming the tokens is the leak AC-5 forbids.

- [x] **1.2 Record the two-of-ten reading as a dated measurement.**
      One line in the test's module docstring: the date, the command, the
      denominator, and the two names that WERE caught. A gap fixed without its
      before-reading recorded is indistinguishable from a gap that never
      existed, and the next author who widens the corpus has nothing to compare
      against.
      verify: the docstring carries a date, a command reproducible from a clone, and the figure `2 of 10`
      Done 2026-09-29. The docstring of
      `tests/scripts/external_source_subject_registry.test.ts` carries the date,
      the base commit (`dbf1c917956745119e20ab3c3551fe20e33c26c6`), a `node -e`
      one-liner that reads that commit's denylist with `git show` and applies the
      predicate, and the figure. · **The figure is `5 of 10`, not `2 of 10`, and
      that is the finding this step exists to prevent being lost.** Measurement
      unit, stated before the number: a subject is CAUGHT when at least one
      `deny` pattern, compiled case-insensitively exactly as the gate compiles
      it, matches its canonical `owner/repo` slug. Against the base commit's
      `deny` array that returns S1, S2, S3, S4, S6 — five. · **It is not prose.**
      The suite's last case re-runs that predicate against
      `git show <base>:src/scripts/external_sources_denylist.json` and asserts
      `toHaveLength(5)` plus the exact id list, so the docstring's figure is
      executable and cannot rot; a shallow clone with no such object warns and
      declines rather than asserting a reading nobody could take. · The
      roadmap's own `2 of 10` is quoted in the docstring and named as
      non-reproducing, so a later reader meets the correction, not just the
      correct number.

## Phase 2 — Close it for the eight, and only the eight

- [x] **2.1 Add one `deny` pattern per uncaught subject, word-bounded.**
      Eight rows. Word-bounded (`\b…\b`) for the same reason the two existing
      subject rows are: an unbounded token for a short common word matches
      ordinary prose and turns a confidentiality gate into a vocabulary ban.
      Two of the eight are ordinary English words in other contexts and take the
      `_excluded_tokens` treatment or an owner/repo-qualified pattern rather than
      a bare word — decide per row, in the diff, with the reason in the row.
      verify: the Phase-1 fixture goes green; `./scripts-run src/scripts/check_no_external_sources` stays green on the unchanged tree
      Done 2026-09-29. **Ten rows for five subjects, not eight rows for eight** —
      the step's "eight" is the Goal's wrong figure; the count that matters is
      one row per uncaught subject MINIMUM, and each of S5, S7, S8, S9 and S10
      got two (an owner half and a repo half) so a document naming either half
      alone still reds. The rows themselves are in
      `src/scripts/external_sources_denylist.json` and are deliberately NOT
      quoted here — see the note below. · **The two ordinary-word decisions the
      step anticipated are real and are recorded per row**, in `_excluded_tokens`
      beside the reason: S8's repo half is a common given name, so that subject
      takes its owner token plus an owner-qualified slug — the same standard a
      pre-existing row in the array already meets — and the stem S9 and S10 share
      is a three-letter acronym, so those two take four fully qualified rows
      instead of one bare stem. S10's repo half is denied in its hyphenated form
      only; the spaced English phrase is ordinary prose and stays allowed. ·
      `\b` holds around an internal hyphen (a hyphen is a non-word character, so
      the anchors sit at the outer edges), verified by the end-to-end case. ·
      **Both limbs green**: the suite reports `Test Files 1 passed · Tests 8
      passed`, and `./scripts-run src/scripts/check_no_external_sources --json`
      over the tracked tree reports `ok=true hits=0`.
      **A self-inflicted finding, kept in the record because it is the best
      evidence in this roadmap that the change works.** The first draft of this
      very step quoted all ten patterns as literals, and the pre-commit run of
      the gate reported `❌ 7 external-source reference(s)` at three lines of this
      file — six of them raised by rows added minutes earlier, one by a row that
      had been in the array for months. Written out, the patterns ARE the names;
      an evidence note is not a carve-out; and the only reason this was caught
      before the push is that `agents/**` is inside the scan, which is precisely
      the property the eight uncaught names were relying on being absent.

- [x] **2.2 Prove no false positive landed on the existing tree.**
      Eight new patterns over a tree of this size is exactly where a
      too-broad pattern surfaces as a wall of findings in unrelated files. Run
      the gate over the whole tracked tree and read the delta against the
      pre-change run, not the absolute count.
      verify: full-tree run reports the same finding count as before the eight rows were added
      Done 2026-09-29. Read as a DELTA against a pre-change run of the same
      command, not as an absolute count. `check_no_external_sources --json` over
      the whole tracked tree, before the rows and after:

      | | hits | shape.block | shape.warn | ratchet baseline |
      |---|---:|---:|---:|---:|
      | before | 0 | 148 | 181 | 148 |
      | after | 0 | 148 | 181 | 148 |
      | delta | 0 | 0 | 0 | — |

      Every column is unchanged, so no added pattern is over-broad and Risk 1 did
      not materialise for this subject set. · **Measured independently as well,
      because a zero delta on a tree that never contained the names would prove
      nothing on its own**: each of the eleven candidate patterns considered —
      including the two rejected bare words — was matched line-by-line against
      all 11,598 tracked files (same case-insensitive compile, same binary-
      extension skip set as the gate). Every one returned **0 line hits**. That
      is why `serena` and `gsd` were still excluded: the exclusion is a policy
      choice about future prose, not a reaction to a live collision, and the row
      notes say so rather than implying a measurement forced them.

## Phase 3 — Make the next subject impossible to forget

- [x] **3.1 Bind the subject registry to the denylist in one test.**
      Wherever the comparison corpus records its subject set, a test asserts
      every subject id in it has at least one matching `deny` pattern. That is
      the mechanism the habit was standing in for: eight subjects were added to
      the corpus across three rounds and none of them reached the denylist,
      because nothing connected the two files.
      verify: adding a subject row to the registry fixture without a denylist row reds the test
      Done 2026-09-29. **The comparison corpus recorded its subject set
      nowhere** — the step says "wherever the corpus records its subject set",
      and the honest answer at execution is that no such tracked file existed;
      the ten identities live only in a maintainer-held annex outside the repo.
      So the registry was created, and it was created INSIDE
      `src/scripts/external_sources_denylist.json` rather than as a new file.
      That is the only placement that does not leak: the denylist is the single
      path `skip_paths` exempts from the gate's own scan, and it already had to
      carry these tokens as `deny` data, so a `subjects` block beside them
      discloses nothing the array did not. A registry in any new file would
      itself red the gate — or would need a `skip_paths` entry, which
      `check_suppression_hygiene` forbids growing. · The test asserts every
      `subjects[].slug` is matched by ≥ 1 `deny` pattern. · **Polarity is its own
      case**, because a predicate never shown its own denial has untested
      sensitivity: a synthetic row (`example-owner/example-unregistered-subject`)
      is asserted to come back uncovered while the ten real rows do not, so the
      passing test above cannot be a tautology. · The live probe under step 1.1
      is the same assertion seen red for real: `5 of 10 registry subjects have no
      deny pattern … expected [ 'S5', 'S7', 'S8', 'S9', 'S10' ] to deeply equal
      []`. · Two dead-scope guards ship with it — the registry and the `deny`
      array are each asserted non-empty — because every other case loops over
      `cfg.subjects`, and a loop over an emptied registry passes silently.

- [x] **3.2 State in `external_sources_denylist.json`'s own `_README` that the registry is a producer.**
      The `_README` today names the 2026-06-13 sweep and the encryption escape
      and does not say that a subject added to a comparison corpus owes a row
      here. One sentence, so the obligation is readable from the file a future
      author opens.
      verify: `grep -c "comparison" src/scripts/external_sources_denylist.json` returns non-zero
      Done 2026-09-29. `grep -c "comparison" src/scripts/external_sources_denylist.json`
      → `2`. · **This verify was already non-zero BEFORE the change and is
      therefore not evidence on its own** — the `_README`'s first sentence has
      always read "inspiration/harvest/comparison source names", so the grep
      would have passed against an untouched file. Recording that is the point of
      the step, not a technicality: a verify that cannot fail proves nothing, and
      the substance is the sentence, not the count. The `_README` now states that
      a comparison corpus is a PRODUCER of the file, that every audited subject
      owes at least one `deny` row, that the `subjects` block is that binding,
      and which test reds when a row is missing. · One drive-by, stated because
      it is in the same string: both filename pointers in the `_README` read
      `check_no_external_sources.py` and `link_crypto.py`, files retired in the
      ADR-200 Python teardown. Corrected to `.ts` with the correction noted
      inline, since the sentence was being rewritten anyway.

## Acceptance criteria

- [x] AC-1 — A file naming any of the ten current subjects reds `check_no_external_sources`; a test fixture proves it for all ten, not for a sample. *(All ten, proven through the real gate in a throwaway tracked repo; the line set of the hits equals `[1..10]`. The fixture is synthesised at run time — see AC-5.)*
- [x] AC-2 — The pre-change reading (~~`2 of 10`~~ **`5 of 10`**, dated, with the reproducing command) is recorded in the test that closes it. *(Met with the corrected figure: the roadmap's `2 of 10` does not reproduce, the measured reading is `5 of 10`, both are recorded, and the reading is an executable assertion against the base commit rather than prose. Step 1.2 carries the unit and the command.)*
- [x] AC-3 — Adding a subject to the comparison registry without a denylist row reds a test. *(Asserted, and shown red for real under the step-1.1 sabotage probe; a synthetic uncovered row is its own polarity case.)*
- [x] AC-4 — The whole-tree finding count is unchanged by the ~~eight~~ **ten** added patterns, so no pattern is over-broad. *(hits 0 → 0, shape block 148 → 148, warn 181 → 181; plus a per-pattern scan of all 11,598 tracked files returning 0 hits for every candidate.)*
- [x] AC-5 — No subject name appears in plaintext in any file this roadmap adds, including the fixture's own failure output assertions, which match on token counts and positions rather than on the names. *(The one file this roadmap ADDS is the test, and it names no subject: its corpora are synthesised from the registry at run time and every assertion is over ids, counts or line positions. The slugs live only in `external_sources_denylist.json`, which is not a file this roadmap adds and is the one path exempt from the gate's own scan — it already had to carry the same tokens as `deny` data.)*

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-29 | reviewer: agent -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | An over-broad pattern floods the tree with findings | implementation | Two of the eight subjects are ordinary English words; a bare word-bounded token for either would match unrelated prose across the estate | Step 2.2 reads the whole-tree delta rather than the absolute count, and step 2.1 requires a qualified pattern or an `_excluded_tokens` row per ambiguous name, decided in the diff | Phase 2 — Close it for the eight, and only the eight |
| 2 | The fixture itself becomes the leak | product | A fixture whose purpose is to hold ten plaintext subject names is a tracked file holding ten plaintext subject names | AC-5: the fixture is generated at test time from the encrypted registry and never committed with names resolved; if that is not achievable the fixture is gitignored and the test skips with a stated reason rather than committing the names | Phase 1 — Make the gap reproducible before closing it |

## Null path

If step 1.1 cannot be written without committing the names, and generating the
fixture from the encrypted registry at test time proves unavailable, this
roadmap closes as an honest null: the gap is recorded, the eight rows are still
added under Phase 2 (they carry patterns, not prose), and AC-1 downgrades to
"proved for the two subjects a committed fixture can safely name". Say that in
the closing note rather than shipping a fixture that leaks what the gate exists
to stop.

**The null path did not fire.** Generating the corpus at run time proved
available, so AC-1 is met for all ten and nothing is downgraded. One detail of
the null path's own premise was wrong in the same direction as the Goal's
figure: it assumed an *encrypted* registry to generate from, and none existed.
The registry had to be created, and placing it inside the denylist — the one
file already exempt from the gate and already holding the same tokens — removes
the need for encryption entirely, because nothing new is disclosed.

## Closing note

Closed 2026-09-29. Two of this roadmap's own factual claims did not survive
execution, and both are recorded in the steps rather than quietly fixed:

1. **`2 of 10` is `5 of 10`.** Three subjects the Goal counted as uncaught were
   already denied by earlier ecosystem sweeps. Five rows were owed, not eight.
   The corrected reading is an executable assertion against the base commit, not
   a sentence — so the next author who widens the corpus compares against a
   number that can be re-derived.
2. **Step 3.2's verify could not fail.** `grep -c "comparison"` was already
   non-zero before the change. The sentence was still written, because the
   sentence was the point; the grep never was.

A third is smaller and worth naming anyway: step 1.1's verify passes a path to a
gate that takes none. The substitution — plant the shipped gate and config in a
throwaway tracked repo — is what the sibling suite already does, and it is
strictly stronger than the written form would have been, because it exercises
the real `git ls-files` walk rather than a file argument that does not exist.

What is now true and was not: a file naming any of the ten reds the gate; a
near-miss of every one of them stays clean; and an eleventh subject cannot enter
the comparison registry without its `deny` row, because the row and the registry
are asserted against each other in a test that has been seen red.
