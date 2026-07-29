---
complexity: structural
status: ready
---

# Road to runtime encoding hardening — prove the sanitize floor runs, then close the half it deliberately left open

> Two findings, in severity order.
>
> **The floor's wiring is unproven where it matters most.** `retrieval_sanitize.ts`
> says in its header that it strips hidden-instruction vectors on the
> `retrieve_v1` / `memory_get_v1` read surfaces "before it is emitted". Those two
> functions live in `memory_lookup.ts`, which has **zero imports**; the MCP tool
> layer calls them **directly**; the floor's only production caller is
> `second_brain_retrieval.ts`; and the test case titled "sanitize floor already
> applied on the read surface" asserts only against fixtures passed to
> `sanitize_text` by hand. The algorithm is proven. The surface is not.
>
> **And where the floor does run, it covers half the space by design.** It strips
> the **invisible** class and states that it will not touch visible text, because
> rewriting it would corrupt legitimate rule bodies and code snippets. That
> decision is defensible and it leaves a named hole: a reviewer reads `ignore`,
> the model reads a token whose `o` is U+043E. The visible class is linted at
> **authoring** time over this package's own corpus and is **unguarded at
> runtime**.
>
> Source + council cut:
> [`elder-ponytail-harvest-cut`](../settings/contexts/elder-ponytail-harvest-cut.md).

## Goal

First establish — with an end-to-end probe, not a header and not a unit test —
which read surfaces the sanitize floor actually runs on. Then decide whether the
visible encoding layer is worth canonicalizing there, and if so close it without
corrupting legitimate content. Extend the existing sanitizer and the existing
pressure corpus. Add no new security layer.

## Context (verified in-tree 2026-07-29, do not relitigate)

- **`src/scripts/_lib/retrieval_sanitize.ts` (71 LOC)** strips bidi,
  zero-width, Unicode-Tag and deprecated-format codepoints (classes shared with
  `lint_hidden_unicode._classify`) plus C0/C1 controls, and caps fields at
  `MAX_FIELD_CHARS = 8192`. **No NFKC. No confusable folding. By design.**
  **Where it is applied is the open question, not a context fact** — its header
  names `retrieve_v1` / `memory_get_v1`, the wiring evidence points the other
  way, and Phase 0 settles it. Do not cite the header as coverage.
- **`lint_confusables.ts` (217 LOC)** already owns a high-precision visible
  mixed-script signature (Latin-majority token + ≥1 TR39-confusable
  Cyrillic/Greek letter + minimum letter count, with math operators excluded so
  `ΔNWC` is never flagged). It runs at authoring time over
  `src/{skills,rules,agent-src,domains}/**/*.md`. **Its confusable table is the
  asset this roadmap reuses — do not write a second one.**
- **This package's rules are prose read by a model, not a deterministic
  matcher.** The drafted "canonicalize before policy matching" has almost no
  target: the only deterministic matchers are the hooks and the lint scripts.
  The retrieval sanitizer is the one genuinely deterministic runtime surface, so
  it is the only place this work is real.
- The channel taxonomy from the sweep sources is a **superset** of the earlier
  9-channel plan, but the majority of it (image/audio/PDF/DNS/TCP/file-metadata
  stego) is **out of this package's threat model** — it governs text, not
  arbitrary files or packets. Scoping it out shrinks the work and is recorded so
  coverage is never over-claimed.
- The `injection-defense-pressure-corpus` work already shipped. This is an
  **amendment to that corpus**, not a parallel surface.

> **Scope boundary.** No AGPL code enters the tree. The channel *taxonomy* (the
> list of technique names) crossed the boundary; no source, no payload. Every
> fixture is own code.

## Blockers

- `golden-set-freeze` — the labelled corpus is frozen and hashed **before** any
  detector runs against it. No tuning against the test split. Blocks Phase 2
  onward.

## Phase 0 — Does the floor run at all? (this outranks the visible-layer question)

The first pass of this roadmap read the sanitizer's header as fact and recorded
"applied on the `retrieve_v1` / `memory_get_v1` read surfaces". Measuring instead
produced a more severe finding, so it goes first.

- [ ] **S0.0 — Wiring, not algorithm.** Establish for **every** named read
      surface whether the sanitize floor is actually on the path. Measured
      starting point, to be confirmed or refuted: `retrieve_v1` and
      `memory_get_v1` are defined in `memory_lookup.ts`, which has **zero
      imports**; `mcp_server/tools.ts` calls both **directly**; the floor's only
      production caller is `second_brain_retrieval.ts`; and
      `tests/scripts/consumer_flow_wiring.test.ts` has a case titled "sanitize
      floor already applied on the read surface" whose every assertion calls
      `sanitize_text(...)` on a fixture — proving the algorithm, never the
      surface.
      *Verify:* a table of read surface → does the floor run → what proves it.
      An end-to-end probe (poisoned entry in, retrieved output out, through the
      real entry point) decides each row; a unit test on the algorithm does not
      count as evidence for a row.
      **If the floor is not on the primary path:** that is the finding, it
      outranks everything below, and the fix is wiring plus a test that
      exercises the **entry point** — not a new detector. Same class as the
      active gates-that-can-fail work: proven through an injection seam,
      unproven at the default entry.
- [ ] **S0.0b — The second surface the drafts named and the first pass dropped:
      the inter-agent / subagent message channel.** No `sanitize` call exists
      anywhere under the hook or subagent scripts. Decide, with evidence,
      whether content crossing that boundary is untrusted in the same sense
      retrieved content is — and if it is, whether the same floor applies or the
      channel is structurally different.
      *Verify:* a stated verdict per direction (orchestrator → subagent,
      subagent → orchestrator) with the reasoning, so a later reader cannot
      mistake silence for coverage.
- [ ] **Header-vs-wiring hygiene, once the table exists:** whichever way S0.0
      lands, the sanitizer's header prose must describe what it actually does.
      A doc claiming a surface it does not cover is the failure class this
      package's own claims discipline exists to prevent.
      *Verify:* the header and the wiring table agree line for line.

**Exit:** it is known whether the floor runs on each named surface.
**Rollback:** read-only.

## Phase 1 — Measure the visible-layer gap before writing a single check

- [ ] Author the in-scope channel list as an explicit table: zero-width ·
      invisible-tag · variation-selector · homoglyph/confusable ·
      bidi/directional-override · combining-diacritic runs · invisible fillers
      (e.g. Hangul filler) · math-alphanumeric and other Unicode style blocks ·
      punycode/IDN · nested multibase · confusable whitespace · XML/HTML
      entities · structured-data key ordering. Mark each **already covered by
      `retrieval_sanitize`** / **uncovered** / **out of scope**, citing the
      codepoint class or the sanitizer line that decides it.
      *Verify:* every row cites a file:line or a codepoint range; the
      out-of-scope rows name the reason (not text, or semantic).
- [ ] Run the uncovered channels through the **live** sanitizer as a throwaway
      probe and record what survives verbatim.
      *Verify:* a committed before/after table; the invisible-class rows must
      show the sanitizer already neutralising them (if they do not, that is a
      higher-severity finding than this roadmap assumed — stop and surface it).
- [ ] **Pre-registered null condition:** if the live sanitizer already
      neutralises ≥ 90 % of the uncovered in-scope channels, publish
      `honest-null: runtime-sanitizer-already-covers-visible-layer` with the
      numbers and **close this roadmap** without shipping a detector.
      *Verify:* the prediction is written down before the probe runs —
      expected outcome is *partial* coverage: the invisible class covered, the
      visible class (confusable, math-alphanumeric, full-width, punycode) fully
      through.
- [ ] Decide and record the **normalise-vs-flag** question, which is the real
      design decision and the reason the sanitizer stopped where it did: a
      visible-layer finding may (a) be folded to a Latin skeleton, corrupting
      any body that legitimately contains mixed script, (b) be flagged in a
      structured finding while the text passes through unchanged, or (c) cause
      the entry to be quarantined. Pick per channel, with the corruption risk of
      each named.
      *Verify:* the decision table exists and the default for anything with a
      false-positive risk is **flag, not rewrite**.

**Exit:** a measured coverage table and a per-channel disposition. **Rollback:**
nothing shipped yet.

## Phase 2 — Frozen union corpus (gated on `golden-set-freeze`)

- [ ] Own encoder emitting each **in-scope text-layer** channel with
      ground-truth labels. Own code, built from the taxonomy, never from any
      source repo.
      *Verify:* the encoder round-trips each channel and the label matches what
      it encoded.
- [ ] Positives N ≥ 300, balanced across in-scope channels over varied carrier
      text. Negatives M ≥ 300 drawn from **real** rule snippets, retrieval
      chunks and inter-agent messages, so the false-positive rate is measured
      against realistic traffic rather than toy text.
      *Verify:* the channel histogram is balanced; the negatives are traceable
      to real files.
- [ ] Freeze: `sha256` manifest committed. Add a **scope-guard test** asserting
      the corpus contains **zero** file/network-layer channels, so it can never
      silently drift into claiming out-of-scope coverage.
      *Verify:* the guard fails when a deliberately out-of-scope fixture is
      added.

## Phase 3 — Extend the sanitizer, do not rebuild it

Only the channels Phase 1 proved uncovered, only the dispositions Phase 1 chose.

- [ ] Reuse `lint_confusables`' TR39 confusable set as the single source of
      truth for the visible mixed-script signature — import it, do not restate
      it. Same containment discipline (math operators are not confusables).
      *Verify:* one table in the tree; a test asserts both call sites agree.
- [ ] Add the remaining uncovered structural checks per the Phase 1 table
      (variation-selector runs · combining-mark density bound · invisible
      fillers folded into the existing invisible set · Unicode style-block fold ·
      punycode/IDN in text-expected fields · nested-multibase depth guard ·
      structured-data key-order canonicalization before comparison).
      *Verify:* each emits a structured finding; none rewrites visible text
      except where Phase 1 explicitly chose folding.
- [ ] Keep the deterministic property: no model call, no network, CI-runnable.
      *Verify:* the added path is pure and exercised by the frozen corpus.
- [ ] **Named exclusion, so it does not return as a suggestion:** the
      word-order-permutation channel. The source draft carried it as a stretch
      item and said itself that its precision is likely poor. It sits on the wrong
      side of the line this roadmap draws — carrier text with legitimate word
      order is indistinguishable from permuted carrier text without semantics, so
      a structural check cannot own it. Same exclusion as word choice, sentence
      length and misspelling.
      *Verify:* the channel appears in the Phase 1 table marked out-of-scope with
      this reason, not omitted silently.

## Phase 4 — Gate on the frozen corpus

- [ ] **Pre-registered acceptance (adopt ⇔ all true):** recall on in-scope
      positives ≥ **0.95**, with the unambiguous classes (zero-width, bidi,
      variation-selector) ≥ **0.99**; false-positive rate on the clean negative
      corpus ≤ **0.5 %**; zero added runtime model spend; added latency
      < **2 ms p95** per message.
      *Verify:* the numbers render from a committed report, never hand-typed.
- [ ] **Honest-null exit:** recall clears but FP > 0.5 % → ship
      **detect-and-flag only**, no automatic quarantine, and publish the FP
      number. Do not claim "blocks steganography".
      *Verify:* the shipped default matches whichever branch the measurement
      selected.
- [ ] Record the coverage boundary as a claim: **text-layer only, by
      construction**, backed by the Phase 2 scope-guard test. Never for
      file/network channels; never for semantic evasion (word choice, phrasing,
      garden-path constructions) — a sanitizer cannot own those and the claim
      surface must say so.
      *Verify:* the claim entry names the scope-guard test as its evidence.

## Acceptance criteria

- [ ] The S0.0 wiring table exists with an end-to-end probe per read surface,
      and the header prose matches it.
- [ ] The Phase 1 coverage table exists with a citation per row, and the
      normalise-vs-flag decision is recorded per channel.
- [ ] Either the honest null is published, **or** the union corpus is frozen with
      its scope guard green and the detector deltas ship on the branch the
      measurement selected.
- [ ] `lint_confusables`' confusable table has exactly one definition in the
      tree.
- [ ] No AGPL code in the tree; no coverage claim past the text layer.
- [ ] All quality gates pass — see `quality-tools`.
