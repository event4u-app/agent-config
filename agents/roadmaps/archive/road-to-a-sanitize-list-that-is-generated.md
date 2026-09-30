---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Nothing in the estate holds this defect: the sanitize floor's own coverage list is the artefact being repaired, it is prose inside a shipped module rather than a plan, and archiving or parking any active roadmap would retire unrelated work while leaving the wrong list shipped."
relates: []
---

# Road to a sanitize list that is generated

> **Source:** `agents/tmp.old/inbox-2026-09-ab/t09/` — a defect-first analysis plan
> supplied beside its own transcript, drawn from a set of external code
> references that are named nowhere in this file.

## Goal

`src/scripts/_lib/retrieval_sanitize.ts` carries a hand-maintained prose list of
the read surfaces it covers, and its own header states the rule for anything not
on that list: uncovered. Read at `main@20bfb1f53`, that list is now wrong in both
directions — one path that reaches the outside world and **is** sanitized is
absent from it (`_lib/reddit_thread_parse.ts:64,166` decode-then-`sanitize_text`
on fetched HTML), and two paths that carry fetched bytes toward a model-facing
surface are neither listed nor covered (`update_prices.ts:151,157` writes fetched
rows into a tracked markdown doc; `_lib/llm_proposer_transport.ts:128` returns a
provider response into the run). The header already records that an earlier
version of this list "named surfaces by intent, and the legacy-envelope gap went
unnoticed for exactly that reason", which is the same failure arriving a second
time in a list that is maintained the same way. This roadmap replaces the prose
with a generated table, closes the two uncovered paths it names, and adds the one
channel class the floor has zero coverage for anywhere — structurally hidden
content in fetched markup.

## Phase 1 — The coverage list stops being prose

- [x] **1.1 Generate the read-surface table from the imports, not from intent.**
      Emit one row per module that both brings outside bytes in (an `await fetch`,
      a subprocess read of remote output, a parse of fetched markup) and hands a
      string onward, each row marked `covered` (it imports `sanitize_text` /
      `sanitize_entry` on that string) or `uncovered`. The current list is hand-
      written and already disagrees with the tree in both directions, which is
      exactly what a derived list cannot do.
      verify: the generator's output names `_lib/reddit_thread_parse.ts` as
      covered and `update_prices.ts` and `_lib/llm_proposer_transport.ts` as
      uncovered, and re-running it after 1.2 flips the two
      **Evidence (2026-09-29).** `check_read_surface_coverage` → `24 read
      surface(s) ... match the tree (6 covered, 15 uncovered, 3 unclassified)`.
      All three named modules appear: `_lib/reddit_thread_parse.ts`,
      `update_prices.ts` and `_lib/llm_proposer_transport.ts`. The two that
      began `uncovered` read `covered` now, which is the post-Phase-2 half of
      this verify — the roadmap asks for the flip and the flip is what the table
      shows. Risk 1's mitigation shipped: three modules the generator could not
      decide are emitted as `unclassified` ROWS rather than omitted, so an
      unrecognised fetch shape is a visible gap instead of an absent one.
- [x] **1.2 Drift-check the generated table against the module header.**
      The header prose becomes a pointer to the generated table rather than a
      second copy of it; a divergence between the two is a failure, not a
      warning, because two copies is how the first list went stale.
      verify: a seeded edit that adds an unsanitized fetch-derived emit makes the
      drift check exit non-zero, and reverting the seed makes it exit zero
      **Evidence (2026-09-29).** The gate fails, not warns, and BOTH directions
      were probed rather than one. Seeding the table (flipping one `covered`
      cell to `uncovered`) → `❌ ... disagrees with the tree`. Seeding the TREE
      instead — removing the `sanitize_text` import from `update_prices.ts`,
      leaving the table untouched → the same refusal. Restoring each from a copy
      returns it to green. A check that only read one side would pass whenever
      the two drifted together, which is the state this roadmap is repairing.
      The module header is a pointer to `docs/contracts/retrieval-read-surfaces.md`
      rather than a second copy of it.

## Phase 2 — The two named uncovered paths close

- [x] **2.1 Sanitize the fetched rows before they reach the tracked doc.**
      `update_prices.ts` renders remote price rows into a committed markdown file
      that agents read. Apply the floor to the model-facing rendering only; the
      fetched payload, if archived at all, stays byte-exact.
      verify: a fixture whose fetched row carries a zero-width-joined
      instruction renders with the vector stripped, and the raw fixture is
      unchanged on disk
      **Evidence (2026-09-29).** `update_prices.ts` imports `sanitize_text` and
      applies it to the rendered rows; `tests/scripts/fetched_bytes_sanitized.test.ts`
      asserts both halves — the model-facing rendering loses the vector, and the
      raw fixture is unchanged on disk. The table now reads the module `covered`.
- [x] **2.2 Sanitize the provider response before it is returned into the run.**
      `_lib/llm_proposer_transport.ts` returns provider text directly. The
      transport is the choke point and it is one call site, so no caller has to
      remember a flag — a switch the caller must remember is the instruction-only
      enforcement this package diagnoses in itself.
      verify: a stubbed transport response carrying a bidi-control vector comes
      back through the transport with the vector removed, asserted in a unit test
      that fails when the call is removed
      **Evidence (2026-09-29).** `_lib/llm_proposer_transport.ts` sanitizes at
      the transport choke point — one call site, so no caller has to remember a
      flag, which is the instruction-only enforcement this package diagnoses in
      itself. Asserted in a unit test that fails when the call is removed.

## Phase 3 — The structural channel class gets a detector that publishes its gaps

> **The 2026-09-29 refusal is CLEARED.** The detector was built, refused by an
> independent two-provider council review, and reverted. Its four stated return
> conditions are now met and the detector has landed: a real tokenizer instead
> of a matcher, one adversarial fixture per shape the review named, an explicit
> removal policy, and `aria-hidden` off the channel list. The refusal is kept as
> a structured entry under `## Blockers` (`structural-detector-parser-backed`,
> `Status: resolved`) rather than deleted, because the record of what the review
> caught is the reason the replacement is shaped the way it is.

- [x] **3.1 Add a markup-aware pre-pass ahead of the codepoint floor.**
      Cover HTML comments, inline-style hiding (`display:none`,
      `visibility:hidden`, `opacity:0`, `font-size:0`, zero width or height),
      and `<template>`. A grep for any of these in the sanitize path returned
      zero before this, so for fetched markdown and HTML the dominant hiding
      class had no coverage at all. `aria-hidden` is NOT on this list — see the
      blocker entry.
      verify: one fixture per listed channel, each asserted to lose the hidden
      span and keep the visible text
      **Evidence (2026-09-30).** `src/scripts/_lib/structural_hiding.ts` is a
      TOKENIZER (`tokenize`) plus a tree walk over an explicit open-element
      stack, not a forward scanner. `npx vitest run
      tests/scripts/structural_hiding.test.ts` → **60 passed**. The per-channel
      suite is driven off `STRUCTURAL_HIDING_CHANNELS` itself, so a channel
      added without a fixture fails rather than passing silently, and each
      channel asserts BOTH directions — the hidden span is lost and the visible
      text is kept.
      **Sensitivity probed, not assumed.** Four mechanism-neutralisation runs,
      each restored from a pristine copy: RAWTEXT state off → shapes 2 and 2b
      fail (2 failed / 48 passed); comment tokenization off → the html-comment
      channel and shapes 1, 1b and 4 fail (6 failed / 44 passed); nesting depth
      untracked inside a hidden subtree → shape 3 fails (1 failed / 49 passed);
      `aria-hidden` restored as a channel → both aria-hidden retention tests
      fail (2 failed / 48 passed); and, after the council round, removing the
      `hidden="until-found"` exemption reds both the predicate case and the new
      end-to-end one (2 failed / 58 passed). The first probe also caught a WEAK FIXTURE of
      mine: shape 2 passed for the wrong reason, because escaped quotes made the
      payload not-a-tag under any parser. The fixture was rewritten and now
      discriminates.
      Composed into the floor by `retrieval_sanitize.sanitize_markup`, whose
      ordering is pinned by five further tests (`retrieval_sanitize.test.ts`,
      12 passed).
- [x] **3.2 Ship a known-gap register in the same file as the detector.**
      Name what it does not catch — stylesheet-driven and class-driven hiding,
      off-screen positioning, background-coloured text, fragmentation and
      homoglyph obfuscation, image-borne text. An inline-style substring matcher
      that is cited as "the taxonomy" is how a detector like this becomes a false
      green.
      verify: the register exists in the detector's own file and is cited from
      every surface that claims the coverage
      **Evidence (2026-09-30).** `STRUCTURAL_HIDING_GAPS` is exported from the
      detector's own file with nine entries, and a test asserts it lists ONLY
      uncovered classes (no declared channel id appears in it). The citation
      half is machine-checked rather than asserted: `check_read_surface_coverage`
      now walks every surface that mentions `structural_hiding` — today
      `retrieval_sanitize.ts` and `docs/contracts/retrieval-read-surfaces.md` —
      and fails one that claims the coverage without naming the register. A
      rejecting self-test case pins it.
      A second register, `STRUCTURAL_HIDING_NON_CHANNELS`, records what is
      deliberately NOT a channel and why. It exists because its first and only
      entry was the shipped defect: without it, a later reader finds
      `aria-hidden` missing, reads the omission as an oversight, and restores it.
- [x] **3.3 Publish no recall or coverage percentage.**
      A number requires a frozen corpus, and none exists. State the covered
      channel list and the gap register instead.
      verify: no percentage appears in the detector, its header, or any surface
      citing it
      **Evidence (2026-09-30).** The rule is back in
      `check_read_surface_coverage`, which is what that gate's own comment
      promised — it was removed in review round 3 for watching a detector file
      that did not exist, and it returns "written against a detector that
      exists, with its own adversarial tests". `--self-test` → **11/11 case(s)
      behaved (8 rejecting, floor 10)**; the gate on the real tree → **24 read
      surface(s) ... match the tree (6 covered, 15 uncovered, 3 unclassified)**.
      **Both polarities are pinned, and the second one is not decoration.** The
      first version of this rule RED on the tree — it read
      `transform: translate(-100%, 0)` in the gap register as a published rate.
      That is a precision defect in the rule, so the fix went into the predicate
      (code spans are stripped before the test) rather than into the register's
      wording: a gate that makes honest prose contort around it gets switched
      off. A widened matcher that no longer catches what it was written for
      fails silently, so both directions have a case — a rate in prose is
      rejected, a CSS percentage in a code span is accepted.
      The gate is silent when the detector is absent, so a future revert
      reopens Phase 3 rather than reding the build.

## Acceptance criteria

- The read-surface table is generated from the tree, not written by hand, and a
  drift between it and the module header fails rather than warns.
- Both paths this roadmap names by `file:line` read `covered` in the regenerated
  table, and the fetch-derived path that was already covered appears in it.
- Every listed structural-hiding channel has a fixture that loses the hidden span
  and keeps the visible text.
- The raw fetched bytes are unchanged wherever they are archived; only the
  model-facing copy is transformed.
- No recall or coverage percentage is published for the structural detector.

## Blockers

### blocker: structural-detector-parser-backed
- **Status:** resolved
- **Owner:** implementer
- **Blocks:** Phase 3 — The structural channel class gets a detector that publishes its gaps
- **Class:** 0
- **Run:** `npx vitest run tests/scripts/structural_hiding.test.ts && ./scripts-run src/scripts/check_read_surface_coverage --self-test`
- **Question:** May the structural-hiding transform return, and in what shape?
- **Recommendation:** Return it parser-backed. The review refused a
  SHAPE, not the capability — its own recommendation was the split that shipped
  (land the inventory gate, hold the transform), and it named the four
  conditions for the transform's return rather than closing the question.
- **If you do nothing:** The dominant hiding class for fetched markup stays
  uncovered. A codepoint floor cannot see an HTML comment, so an instruction in
  one reaches the model intact on every fetched-markup read surface.
- **What to do:**
  1. Replace the matcher with a tokenizer — `src/scripts/_lib/structural_hiding.ts`,
     `tokenize()` plus a tree walk over an explicit open-element stack. A scanner
     cannot answer "is this `<` a tag?", because the answer depends on parser state.
  2. Add one adversarial fixture per shape the review named, in
     `tests/scripts/structural_hiding.test.ts`: a comment containing a same-name
     tag, tag-like text inside `<script>`/`<style>`, nested same-name hidden and
     visible elements, unterminated markup.
  3. State an explicit removal policy — silent irreversible deletion leaves
     callers unable to debug. Sentinel in place, structured removal records with
     offsets into the input, closed sentinel vocabulary, fail-closed on
     unterminated markup.
  4. Take `aria-hidden` OFF the channel list and record WHY in
     `STRUCTURAL_HIDING_NON_CHANNELS`, so the omission is not later read as an
     oversight and restored.
  5. Prove sensitivity: neutralise each mechanism, watch the matching fixtures go
     red, restore. A test never seen red has unknown sensitivity.
- **Resolved when:** `npx vitest run tests/scripts/structural_hiding.test.ts`
  exits 0 with a fixture per declared channel AND per named adversarial shape,
  `./scripts-run src/scripts/check_read_surface_coverage --self-test` exits 0,
  and `aria-hidden` is absent from `STRUCTURAL_HIDING_CHANNELS`.
  **Met 2026-09-30** — 60 passed; 11/11 self-test cases; `aria-hidden` is in
  `STRUCTURAL_HIDING_NON_CHANNELS` with a test asserting its content SURVIVES.
  An independent two-provider council review of the landed branch returned
  REQUEST_CHANGES on fixture discriminating power — not on the tokenizer, which
  it found correct for every case it examined — and all nine findings were
  taken, which is the 50 → 60 delta. Recorded in
  `agents/evidence/ratifications/drain-sanitize-structural-detector.md`,
  including what the round did NOT see.

  **Not claimed:** detection adequacy for the class. Both review seats were
  explicit that a frozen corpus is required before such a claim, and none
  exists; Step 3.3 forbids the percentage that would imply one. What is claimed
  is exactly the declared channel list, with its gap register beside it.

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-09-29 | reviewer: agent -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The generated table under-reports because a fetch reaches the tree through a shape the generator does not recognise | implementation | Step 1.1 recognises outside bytes by import shape — an `await fetch`, a subprocess read, a parse of fetched markup. A subprocess wrapper, a host tool result or an MCP response does not match those shapes, so the module holding it is simply absent from the table. That is strictly worse than the prose list it replaces: a missing row reads as no surface, and the generated table carries an authority the hand-written one never claimed. | Step 1.1 emits an explicit `unclassified` row for a module the generator cannot decide, rather than omitting it, so an unrecognised shape appears in the same table as a visible gap. Step 1.2 makes a divergence between the table and the header a failure rather than a warning, so the two cannot drift back into the state this roadmap is repairing. | Phase 1 — The coverage list stops being prose |
| 2 | The structural pre-pass strips legitimate content | product | Step 3.1 removes HTML comments, `aria-hidden` subtrees, `<template>` blocks and inline-style-hidden spans. Each of those has honest uses: a quoted HTML example inside fetched documentation, a screen-reader affordance, a framework template block. Stripping them silently corrupts the content the agent then reasons over, and the damage is invisible because the removed text leaves no trace in the output. | Step 3.1 requires one fixture per channel asserting both directions — the hidden span is lost and the visible text is kept — so a pre-pass that over-strips fails a test rather than shipping. The transform applies only to the model-facing copy of fetched markup and never to repository files, and Step 2.1 keeps the raw fetched payload byte-exact wherever it is archived. | Phase 3 — The structural channel class gets a detector that publishes its gaps |
| 3 | Sanitizing the provider response changes bytes a caller compares or hashes | implementation | Step 2.2 rewrites the string `_lib/llm_proposer_transport.ts` returns into the run. Any caller that hashes that response, caches on it, diffs two runs or asserts an exact match now sees a different value than it stored, and because sanitization is a no-op on ordinary text the breakage appears only on the rare input that carries a vector — the worst possible failure schedule. | Step 2.2 places the call at the transport choke point, which is one site rather than a flag every caller must remember, so there is no partially-sanitized state where some callers see raw bytes and others do not. Its verify pins the returned shape in a unit test that fails when the call is removed, so a downstream comparison breaks loudly at test time instead of silently in a run. | Phase 2 — The two named uncovered paths close |
| 4 | The known-gap register reads as a coverage claim because it sits beside a working detector | product | Step 3.2 lists what the detector misses — stylesheet-driven hiding, off-screen positioning, background-coloured text, homoglyphs, image-borne text. A register printed next to a detector that demonstrably works invites the opposite reading: that the listed gaps are the only gaps and everything else is handled. This file's own header records the same failure once already, where a list named by intent let the legacy-envelope gap go unnoticed. | Step 3.2 restricts the register to uncovered classes only and requires it to be cited from every surface claiming the coverage, so the caveat travels with the claim rather than staying in one file. Step 3.3 forbids any recall or coverage percentage anywhere, which removes the single artefact that would most readily be quoted as measured coverage of a corpus that does not exist. | Phase 3 — The structural channel class gets a detector that publishes its gaps |
