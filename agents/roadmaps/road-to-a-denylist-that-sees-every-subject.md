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
corpus uses. Measured on 2026-09-29 against `src/scripts/external_sources_denylist.json`
it catches **two of ten**: only the two subjects that entered the tree through
an earlier harvest have `deny` patterns, and the other eight — including every
subject added by the most recent comparison round — match no pattern at all. The
gate is therefore green on a tracked file that names eight external subjects in
plaintext, and the round that produced those nine roadmaps read that green as
confirmation its files were clean. This roadmap is closed when a file naming any
of the ten reds the gate, and when adding an eleventh subject cannot silently
skip the row.

## Phase 1 — Make the gap reproducible before closing it

- [ ] **1.1 Add a fixture that names every current subject and assert the gate reds on it.**
      The fixture is one file under `tests/fixtures/` holding the ten subject
      names as prose, exactly as an author would type them. It exists first and
      fails first: a denylist change verified only by "the gate is green on the
      tree" is verified against a tree that does not contain the names, which is
      the condition that produced this gap. Write the test RED, with the eight
      uncaught names named in the failure output, before touching the denylist.
      verify: `./scripts-run src/scripts/check_no_external_sources <fixture>` exits non-zero and its output names eight tokens, not two

- [ ] **1.2 Record the two-of-ten reading as a dated measurement.**
      One line in the test's module docstring: the date, the command, the
      denominator, and the two names that WERE caught. A gap fixed without its
      before-reading recorded is indistinguishable from a gap that never
      existed, and the next author who widens the corpus has nothing to compare
      against.
      verify: the docstring carries a date, a command reproducible from a clone, and the figure `2 of 10`

## Phase 2 — Close it for the eight, and only the eight

- [ ] **2.1 Add one `deny` pattern per uncaught subject, word-bounded.**
      Eight rows. Word-bounded (`\b…\b`) for the same reason the two existing
      subject rows are: an unbounded token for a short common word matches
      ordinary prose and turns a confidentiality gate into a vocabulary ban.
      Two of the eight are ordinary English words in other contexts and take the
      `_excluded_tokens` treatment or an owner/repo-qualified pattern rather than
      a bare word — decide per row, in the diff, with the reason in the row.
      verify: the Phase-1 fixture goes green; `./scripts-run src/scripts/check_no_external_sources` stays green on the unchanged tree

- [ ] **2.2 Prove no false positive landed on the existing tree.**
      Eight new patterns over a tree of this size is exactly where a
      too-broad pattern surfaces as a wall of findings in unrelated files. Run
      the gate over the whole tracked tree and read the delta against the
      pre-change run, not the absolute count.
      verify: full-tree run reports the same finding count as before the eight rows were added

## Phase 3 — Make the next subject impossible to forget

- [ ] **3.1 Bind the subject registry to the denylist in one test.**
      Wherever the comparison corpus records its subject set, a test asserts
      every subject id in it has at least one matching `deny` pattern. That is
      the mechanism the habit was standing in for: eight subjects were added to
      the corpus across three rounds and none of them reached the denylist,
      because nothing connected the two files.
      verify: adding a subject row to the registry fixture without a denylist row reds the test

- [ ] **3.2 State in `external_sources_denylist.json`'s own `_README` that the registry is a producer.**
      The `_README` today names the 2026-06-13 sweep and the encryption escape
      and does not say that a subject added to a comparison corpus owes a row
      here. One sentence, so the obligation is readable from the file a future
      author opens.
      verify: `grep -c "comparison" src/scripts/external_sources_denylist.json` returns non-zero

## Acceptance criteria

- [ ] AC-1 — A file naming any of the ten current subjects reds `check_no_external_sources`; a test fixture proves it for all ten, not for a sample.
- [ ] AC-2 — The pre-change reading (`2 of 10`, dated, with the reproducing command) is recorded in the test that closes it.
- [ ] AC-3 — Adding a subject to the comparison registry without a denylist row reds a test.
- [ ] AC-4 — The whole-tree finding count is unchanged by the eight added patterns, so no pattern is over-broad.
- [ ] AC-5 — No subject name appears in plaintext in any file this roadmap adds, including the fixture's own failure output assertions, which match on token counts and positions rather than on the names.

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
