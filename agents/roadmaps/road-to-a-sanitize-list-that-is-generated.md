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

> **BLOCKED — all three steps. The detector was BUILT and then REFUSED**, on
> 2026-09-29, by an independent two-provider council review of this branch. It
> is reverted rather than patched, and the two findings are why:
>
> - **`aria-hidden` is not a hiding channel.** Its content is VISIBLE to
>   sighted readers; it is a screen-reader affordance. Stripping it deletes
>   legitimate visible text, silently, leaving no trace in the output for anyone
>   debugging the corrupted result. That is a design error in the channel list,
>   not a bug in the matcher — Risk 2 of this register named over-stripping and
>   the per-channel fixtures did not catch it, because a fixture written from
>   the same wrong list agrees with it.
> - **A handwritten matcher mis-parses adversarial markup.** Named by the
>   review: a comment containing a same-name opening tag, tag-like text inside
>   `<script>`/`<style>`, nested same-name hidden and visible elements,
>   unterminated markup. A stripper that can be confused by the content it is
>   defending against is worse than none, because it reports success.
>
> The review's own recommendation was the split this change makes: land the
> generated inventory gate, hold the transform. What it needs before returning
> is named — a parser rather than a matcher, adversarial fixtures for each shape
> above, an explicit removal policy (silent irreversible deletion leaves callers
> unable to debug), and `aria-hidden` off the channel list. A frozen corpus is
> NOT required to test declared channels, but the review was explicit that one
> IS required before claiming detection adequacy for the class.
>
> **What the tree says meanwhile:** `retrieval_sanitize.ts`'s header states that
> structural hiding has no coverage anywhere in this package, rather than
> leaving a reader to infer it from silence. The percentage rule in
> `check_read_surface_coverage` is kept and made silent on the detector's
> absence — a detector arriving later must not arrive without the rule already
> watching it.
>
> **Resolved when** a parser-backed detector lands with those fixtures.

- [ ] **3.1 Add a markup-aware pre-pass ahead of the codepoint floor.**
      Cover HTML comments, inline-style hiding (`display:none`,
      `visibility:hidden`, `opacity:0`, `font-size:0`, zero width or height),
      `aria-hidden`, and `<template>`. A grep for any of these in the sanitize
      path returns zero today, so for fetched markdown and HTML the dominant
      hiding class has no coverage at all.
      verify: one fixture per listed channel, each asserted to lose the hidden
      span and keep the visible text
- [ ] **3.2 Ship a known-gap register in the same file as the detector.**
      Name what it does not catch — stylesheet-driven and class-driven hiding,
      off-screen positioning, background-coloured text, fragmentation and
      homoglyph obfuscation, image-borne text. An inline-style substring matcher
      that is cited as "the taxonomy" is how a detector like this becomes a false
      green.
      verify: the register exists in the detector's own file and is cited from
      every surface that claims the coverage
- [ ] **3.3 Publish no recall or coverage percentage.**
      A number requires a frozen corpus, and none exists. State the covered
      channel list and the gap register instead.
      verify: no percentage appears in the detector, its header, or any surface
      citing it

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

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-09-29 | reviewer: agent -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The generated table under-reports because a fetch reaches the tree through a shape the generator does not recognise | implementation | Step 1.1 recognises outside bytes by import shape — an `await fetch`, a subprocess read, a parse of fetched markup. A subprocess wrapper, a host tool result or an MCP response does not match those shapes, so the module holding it is simply absent from the table. That is strictly worse than the prose list it replaces: a missing row reads as no surface, and the generated table carries an authority the hand-written one never claimed. | Step 1.1 emits an explicit `unclassified` row for a module the generator cannot decide, rather than omitting it, so an unrecognised shape appears in the same table as a visible gap. Step 1.2 makes a divergence between the table and the header a failure rather than a warning, so the two cannot drift back into the state this roadmap is repairing. | Phase 1 — The coverage list stops being prose |
| 2 | The structural pre-pass strips legitimate content | product | Step 3.1 removes HTML comments, `aria-hidden` subtrees, `<template>` blocks and inline-style-hidden spans. Each of those has honest uses: a quoted HTML example inside fetched documentation, a screen-reader affordance, a framework template block. Stripping them silently corrupts the content the agent then reasons over, and the damage is invisible because the removed text leaves no trace in the output. | Step 3.1 requires one fixture per channel asserting both directions — the hidden span is lost and the visible text is kept — so a pre-pass that over-strips fails a test rather than shipping. The transform applies only to the model-facing copy of fetched markup and never to repository files, and Step 2.1 keeps the raw fetched payload byte-exact wherever it is archived. | Phase 3 — The structural channel class gets a detector that publishes its gaps |
| 3 | Sanitizing the provider response changes bytes a caller compares or hashes | implementation | Step 2.2 rewrites the string `_lib/llm_proposer_transport.ts` returns into the run. Any caller that hashes that response, caches on it, diffs two runs or asserts an exact match now sees a different value than it stored, and because sanitization is a no-op on ordinary text the breakage appears only on the rare input that carries a vector — the worst possible failure schedule. | Step 2.2 places the call at the transport choke point, which is one site rather than a flag every caller must remember, so there is no partially-sanitized state where some callers see raw bytes and others do not. Its verify pins the returned shape in a unit test that fails when the call is removed, so a downstream comparison breaks loudly at test time instead of silently in a run. | Phase 2 — The two named uncovered paths close |
| 4 | The known-gap register reads as a coverage claim because it sits beside a working detector | product | Step 3.2 lists what the detector misses — stylesheet-driven hiding, off-screen positioning, background-coloured text, homoglyphs, image-borne text. A register printed next to a detector that demonstrably works invites the opposite reading: that the listed gaps are the only gaps and everything else is handled. This file's own header records the same failure once already, where a list named by intent let the legacy-envelope gap go unnoticed. | Step 3.2 restricts the register to uncovered classes only and requires it to be cited from every surface claiming the coverage, so the caveat travels with the claim rather than staying in one file. Step 3.3 forbids any recall or coverage percentage anywhere, which removes the single artefact that would most readily be quoted as measured coverage of a corpus that does not exist. | Phase 3 — The structural channel class gets a detector that publishes its gaps |
