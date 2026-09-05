---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
relates: []
# relates: manual sweep over agents/roadmaps/**/*.md on 2026-09-04 for
# `ai-code-blindspots`, `feature-planning`, `laravel-mail` and
# `retires_phrasings` — no roadmap owns any of the four lists. The 2026-09-c
# round's road-to-declared-coverage-truth had the adjacent shape (a claim that
# is false) and is archived; this one is the other shape (a list that is short).
estate_offset_exempt: "Adds one active roadmap against a floor of 1. Its four items share one shape and no file with either sibling roadmap in this change, so folding would mix a corpus line and a detector line with four list edits. Parking it defers four one-file fixes that are each cheaper than the note explaining why they were parked."
---
# Road to checklist rows

> **Source:** `agents/tmp.old/inbox-2026-09-d/set-1/` — the small half of an
> external research pass. Four lists in the tree name a surface and do not carry
> the rows that surface needs. Each was re-checked against `main@46022ddd8`, and
> one item the source raised had already been closed by the drain that landed in
> between.

## Goal

Four lists gain the rows they are missing. The invisible-control checklist
covers a rendered surface for security and not for completeness; the two
planning skills judge a plan without the criteria a plan is judged by; no skill
carries what a transactional email needs to survive a mail client; and a
withdrawn claim's retirement list holds two literal strings while the strongest
surviving instance of that claim is published in a third wording. None of the
four needs a new artefact.

## Phase 1 — The render surface has security rows and no completeness rows

- [x] **1.1 Add the state matrix to the render row.**
      `src/skills/ai-code-blindspots/SKILL.md:50` covers a user-controlled
      render for output encoding, `dangerouslySetInnerHTML`, client secrets and
      token storage — every row is a security control.
      `grep -icE 'empty state|loading state|error state'` over the skill returns
      zero, so the checklist that exists to catch what an agent omits does not
      ask about the four states an agent most reliably omits: empty, loading,
      error, and the keyboard path. Add them to the render surface in the
      skill's existing row shape, each with its backstop grep column.
      verify: the four states appear as rows on the render surface, each with a
      grep, and the existing security rows are unchanged.
      DONE: `src/skills/ai-code-blindspots/SKILL.md:60` — a four-row
      `### Render surface — the completeness rows` sub-table (Empty, Loading,
      Error, Keyboard path), each with an assert cell and a grep cell. The step's
      wording was self-contradicting — the "existing row shape" is a 3-column
      table with no grep column — so the shape went to the council (2/2,
      Option 1: sub-table with the column labelled `heuristic`, plus a pointer
      from the render row). The 13 security rows keep every requirement they had;
      the render row gained navigation text only. The grep POLARITY is inverted
      versus the main table (zero hits is the prompt here) and the sub-table says
      so, because reading it the other way is the failure mode it would have.
- [x] **1.2 Keep it a checklist row, not a new evidence mode.** The source asks
      for a declared "task-completion evidence mode" for UI work. That is a
      contract change with its own consumers; the row in the checklist is the
      part that is cheap and immediately useful, and it is what this step does.
      verify: no new evidence type is added by this phase.
      DONE: the change is four table rows and prose in one SKILL.md. No evidence
      enum, artifact type, or completion-review type was touched — the diff for
      this phase is `src/skills/ai-code-blindspots/SKILL.md` only.

## Phase 2 — The plan criteria the planning skills do not name

- [x] **2.1 Write the four criteria into the two planning skills.**
      `grep -ricE 'necessity|sufficiency|groundedness|premature|scope creep'`
      over `src/skills/feature-planning/` and
      `src/skills/complexity-first-planning/` returns zero across both. Plans
      are produced and judged — `judge-spec-compliance` exists — with no stated
      criteria for whether a plan is necessary, sufficient, ordered, and
      grounded in verbs and tools that exist. Add the four as checkable lines in
      both skills, phrased so a reviewer can fail a plan on one of them.
      verify: each criterion appears in both skills as a line a reviewer can
      apply, and each says what failing it looks like.
      DONE: `src/skills/feature-planning/SKILL.md:179` and
      `src/skills/complexity-first-planning/SKILL.md:65` — Necessity,
      Sufficiency, Ordering, Groundedness, each with an explicit **Fails when**
      clause. The complexity-first copy states that it owns Ordering and carries
      the other three so a plan reviewed on ordering alone cannot pass while
      being unnecessary or ungrounded.
- [x] **2.2 Make groundedness the machine-checkable one.** Of the four,
      groundedness is decidable: does the plan reference verbs and tools that
      exist? The capabilities index is already the answer to that question, so
      the criterion points at it rather than describing a new check.
      verify: the groundedness line names the index it is checked against.
      DONE: both copies name `CAPABILITIES.yaml` at the repository root — the
      generated capability index (`src/scripts/generate_capabilities_index.ts`,
      drift-checked with `--check`) listing every shipped skill and command per
      capability area — plus the project's own script/task entry points for what
      the index does not cover.

## Phase 3 — Transactional email

- [x] **3.1 Cover what a mail client needs, in a skill that exists.** The only
      hit for `outlook` across `src/skills/` is in
      `humanizer/data/patterns.md`, which is about prose. `laravel-mail`
      carries one line — `:173`, "Use Markdown templates for consistent styling
      across email clients" — across 204 lines, and no client matrix, no
      table-layout requirement, no inline-style requirement. Add the smallest
      section that covers it in that skill: table-based layout, inline styles,
      the client list worth testing, and what breaks in each.
      verify: the section exists in `laravel-mail`, and no new skill was
      created.
      DONE: `src/skills/laravel-mail/SKILL.md:170` — `## Surviving the mail
      client`: four ordered requirements (table layout, inline styles, no web
      fonts or background images, explicit image width and alt) and a six-row
      client table naming what breaks in each, including the Gmail ~102 KB clip
      and dark-mode inversion. `git status src/skills/` shows four modified
      files and no new directory.

## Phase 4 — A retirement enforced against two literal strings

- [x] **4.1 Retire the wording, not only the phrase.**
      `docs/CLAIMS.md:215` retires `claim:no-runtime-daemon` with
      `retires_phrasings: zero runtime daemon | no background daemon` — two
      literal strings. `README.md:486` publishes "**Zero overhead by default** —
      nothing runs until you ask for it", which asserts a property *stronger*
      than the retired one and is contradicted by the successor entry, which
      records that a supervised resident process is permitted. It survives
      because it shares no substring with either retired phrase. Add the
      wording to `retires_phrasings` and repair the README line to say what is
      actually true.
      verify: `check_claims` flags the README line before the repair and is
      clean after it.
      DONE, both halves observed. With the two needles added and README.md
      untouched, `check_claims` reported 2 findings, both on README.md, both
      naming `claim:no-runtime-daemon` — one per needle. After the repair it
      returns clean (97 entries scanned). Needle set is now `zero runtime daemon
      | no background daemon | zero overhead by default | nothing runs until you
      ask`; both new needles clear the 12-char floor. `README.md:486` now reads
      "**Governed runtime** — resident processes require supervision, scoped
      writes, and a stop control" — the council's wording (2/2 on retiring both
      phrases; split on the replacement, and the normative `require` form was
      taken because the alternative asserted an unbacked comparative property
      and the successor entry records that nothing supervised ships today).
- [x] **4.2 Say what the phrase list can and cannot reach.** A substring list
      catches republication of a wording and cannot catch a synonym. That is a
      real limit, not a bug to fix here, and the entry should say so rather than
      leaving the next reader to assume coverage.
      verify: the claim entry carries one line naming the limit.
      DONE: `docs/CLAIMS.md`, the `no-runtime-daemon` entry's `non_inference`
      field now closes with `WHAT THE PHRASE LIST REACHES, STATED 2026-09-04`,
      which says the scan is a literal case-insensitive substring match over the
      five publish surfaces, catches republication of a wording and cannot catch
      a paraphrase, and uses this entry as its own worked example — the two
      needles added today shared no substring with the original pair and so
      shipped on README.md for the whole window since the 2026-08-27 withdrawal.
      The list is a record of what was caught, never a coverage proof.

## Not in scope

The source's central finding — skill activation measured near zero, the
delivery projection measured and the shipped default still `eager-all`, the
trigger corpus at 100 of 299 — is not planned here. It is owned by
`agents/roadmaps/later/road-to-mixed-trigger-activation-cost.md` and held by
that roadmap's own blockers, one of which is spend-bearing and owner-reserved.
Planning it here would be a second stem on an owned subject.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-04 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The blindspot checklist stops being scannable | product | Its value is that an agent reads it before finishing; four more rows on one surface is growth on the one artefact whose length is its cost | 1.1 puts them on the render surface only, in the existing row shape, and 1.2 forbids the larger contract change the source asked for | Phase 1 — The render surface has security rows and no completeness rows |
| 2 | The plan criteria become unfalsifiable prose | implementation | Necessity and sufficiency are easy to state and hard to fail a plan on, which produces four lines nobody applies | 2.1 requires each line to say what failing it looks like, and 2.2 makes the one decidable criterion point at the index that decides it | Phase 2 — The plan criteria the planning skills do not name |
| 3 | The README repair weakens a true statement | product | The line is a positioning statement, and replacing it with a hedge costs more than it fixes; the honest version still has to say something | 4.1 requires the replacement to state what is true rather than to delete the bullet, and `check_claims` decides the result | Phase 4 — A retirement enforced against two literal strings |
| 4 | The email section grows into a skill | implementation | Mail-client compatibility is a large subject and the smallest useful version is a section, not a new artefact | 3.1 names the skill it lands in and its verification is that no new skill exists | Phase 3 — Transactional email |

## Acceptance Criteria

- [x] AC-1 — The render surface of `ai-code-blindspots` carries empty, loading,
      error and keyboard-path rows with backstop greps, and its security rows
      are unchanged.
- [x] AC-2 — Both planning skills carry the four plan criteria as lines a
      reviewer can fail a plan on, and groundedness names the index it is
      checked against.
- [x] AC-3 — `laravel-mail` carries a transactional-email section with
      table layout, inline styles and a client list, and no new skill exists.
- [x] AC-4 — `check_claims` flags the README wording before the repair and is
      clean afterwards, and the claim entry states what a substring list cannot
      reach.
