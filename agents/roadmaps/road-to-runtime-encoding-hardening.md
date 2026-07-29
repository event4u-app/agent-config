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

- [x] **S0.0 — Wiring, not algorithm.** Establish for **every** named read
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
      **RESULT (2026-07-29) — the starting point above was REFUTED, and the
      reason is itself a finding.** The "zero imports" reading was a
      **measurement artifact**: `memory_lookup.ts` carries a raw NUL byte
      (line 125), so `grep` classifies it as binary and silently skips it; with
      `grep -a` it imports `sanitize_entry` at line 38. End-to-end probes then
      showed the header is **accurate** — `retrieve_v1` (`:1140`) and
      `memory_get_v1` (`:1264`) strip every invisible + control class. The real
      gap is the surface the header never names: `retrieve()` /
      `retrieve_with_meta()` and therefore the **CLI default** (`--envelope`
      defaults to `legacy` at `:1337` → `:1435`), which emits every vector
      intact — and that is the path `rules/security-sensitive-stop.md:63`
      documents for agents. Separately `second_brain_retrieval.ts` computes the
      sanitized body at `:202` for a **counter only** and prompts with the raw
      body at `:218`, making its `poisoned_rejection_rate` a property of the
      algorithm rather than of the pipeline. Full table, method, and explicit
      non-claims:
      [`sanitize-floor-wiring.md`](../evidence/reports/sanitize-floor-wiring.md).
- [x] **S0.0b — The second surface the drafts named and the first pass dropped:
      the inter-agent / subagent message channel.** No `sanitize` call exists
      anywhere under the hook or subagent scripts. Decide, with evidence,
      whether content crossing that boundary is untrusted in the same sense
      retrieved content is — and if it is, whether the same floor applies or the
      channel is structurally different.
      *Verify:* a stated verdict per direction (orchestrator → subagent,
      subagent → orchestrator) with the reasoning, so a later reader cannot
      mistake silence for coverage.
      **RESULT (2026-07-29).** Outbound (orchestrator → subagent): **not
      untrusted in the same sense** — our own material, and knowledge crosses as
      **refs, never bodies** (`subagent_spawn.ts:63` rejects newlines / >200
      chars, max 5 refs). Inbound (subagent → orchestrator): **untrusted in
      kind, but the floor is structurally impossible to apply** — the spawn and
      return are the host's primitive, no code we own ever holds the bytes,
      there is no `SubagentStop` hook event to attach to, and
      `subagent-boundary.md:56-60` already disclaims the limit. The existing
      `delegation-policy` / `verify-budget` machinery is **not** coverage here:
      it guards claim-correctness, not injection. **Two genuinely uncovered
      items surfaced instead** — (a) `ai_team/team_dispatch.ts:386` preserves
      verbatim model text (`raw: text`) with zero sanitize calls anywhere in
      `ai_team/` or `ai_council/`, a real in-repo inter-agent carrier; (b)
      `untrusted-input-defense.md:28` enumerates untrusted sources without
      naming a subagent return. Both are closed in Phase 3.
      Verdict table + reasoning:
      [`sanitize-floor-wiring.md`](../evidence/reports/sanitize-floor-wiring.md)
      § S0.0b.
- [x] **Header-vs-wiring hygiene, once the table exists:** whichever way S0.0
      lands, the sanitizer's header prose must describe what it actually does.
      A doc claiming a surface it does not cover is the failure class this
      package's own claims discipline exists to prevent.
      *Verify:* the header and the wiring table agree line for line.
      **DONE.** `retrieval_sanitize.ts` now carries a `WHERE IT ACTUALLY RUNS`
      block enumerating each surface with the probe row that backs it, plus the
      explicit instruction not to widen the list without a probe. The wiring
      gaps S0.0 measured are closed in the same change rather than documented as
      known holes:
      1. **`_retrieve_internal` choke point** (`memory_lookup.ts:997`) —
         sanitizes after scoring/ranking, so `retrieve()`,
         `retrieve_with_meta()`, `find_duplicate()` and the CLI default are all
         covered by one 3-line change; ranking and hit order unchanged;
         idempotent, so `retrieve_v1`'s existing pass is a no-op and the v1
         envelope contract holds. Re-probed: the CLI default now strips all four
         invisible/control classes and still preserves the visible confusable.
      2. **`second_brain_retrieval.ts`** — the sanitized body is now the value
         that reaches `_prompt`, so `poisoned_rejection_rate` describes the
         pipeline instead of the algorithm.
      3. **`ai_team/team_dispatch.ts`** — `sanitize_text` per emitted field
         (`raw`, `evidence`, `suggested_fix`, `location`, `summary`).
         Deliberately NOT payload-wide: `MAX_FIELD_CHARS` would truncate a
         long-but-valid review before `JSON.parse`.
      4. **The two tautological tests** in `consumer_flow_wiring.test.ts` now
         assert the **surface** — no `sanitize_text` call inside the test, and
         the fixture's on-disk hostility is asserted so the check cannot go
         vacuous. **Mutation-verified:** removing the wiring fix turns both red
         (2 failed), restoring it turns them green (10 passed).

- [x] **S0.0c — Raw control bytes make a text source invisible to tools.**
      *Added during execution, not planned* — this is the defect that produced
      S0.0's wrong premise, so closing it is part of closing Phase 0.
      25 tracked text-intended source files carried a raw C0 control byte
      (almost always `NUL`, used as a composite map-key separator written as the
      literal byte instead of `\0`). Valid TypeScript, correct behaviour — but
      `file(1)`, `grep`, and every binary-sniffing tool classify such a file as
      binary and **skip it silently**, so `grep -n "sanitize_entry"
      src/scripts/memory_lookup.ts` exited 0 with no output. Indistinguishable
      from "the symbol is not there", which is exactly how this roadmap came to
      assert "zero imports".
      *Verify:* every occurrence escaped; the census committed; an EXISTING gate
      owns detection; the gate states its own scope; a regression test proves the
      gate can still fail.
      **DONE.** (a) All 51 NUL occurrences plus four other raw C0 bytes
      (`0x01`, `0x07`, `0x1F`) replaced with language escapes — machine-applied,
      machine-checked for the `\0`-before-a-digit octal hazard (none present),
      `typecheck-ts` clean. `dist/` was regenerated via `task sync`, never
      hand-edited. (b) Detection **extends `lint_hidden_unicode`** rather than
      adding a gate: its `_classify` already flagged NUL as `control-char`; only
      its `.md`-only scope was wrong. The new `_scanSourceControlBytes` pass
      flags raw C0 **only** — a bidi or zero-width codepoint in a `.ts` file is
      often a legitimate regex class or hostile-input fixture, so flagging those
      would need an allowlist that grows until the gate is worthless; a raw
      control byte always has a behaviour-identical escape, so the
      false-positive rate is structurally zero. (c) Two exclusions, both stated:
      generated projections (an authoring rule — fix the source) and
      `agents/evidence/analysis/` (verbatim captures — escaping one would
      falsify the record). (d) The gate now **prints its scope on every run**
      (`source pass: 5982 tracked text file(s) read …`) because a bare "clean"
      cannot be told apart from a pass whose file list was empty. (e) Six
      regression assertions, including a `> 500` eligible-file scope assertion
      so the lock cannot pass vacuously.
      Census + fix rationale + honest scope:
      [`nul-byte-source-census.md`](../evidence/reports/nul-byte-source-census.md).

**Exit:** it is known whether the floor runs on each named surface.
**Rollback:** read-only.

**PHASE 0 OUTCOME.** The floor's algorithm was never the problem and the header
was not lying about `retrieve_v1` / `memory_get_v1`. Three things were true and
unmeasured: the legacy default envelope bypassed the floor entirely, one caller
measured the floor instead of applying it, and one in-repo inter-agent carrier
had no floor at all. All three are closed and mutation-verified. The severity-1
framing in this roadmap's header is therefore **superseded** — see the S0.0
result. The `grep`-blindness that produced the wrong premise is a defect in its
own right and is tracked as S0.0c below.

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
