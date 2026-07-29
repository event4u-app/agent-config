# Text-layer encoding channels — coverage and disposition (Phase 1)

Deliverable for `road-to-runtime-encoding-hardening` Phase 1. Two questions:
**which channels does the live sanitizer already neutralise**, and **for each one
it does not, should the value be folded, flagged, or quarantined?**

Measured 2026-07-29 on `feat/runtime-encoding-hardening` by running each channel
through the **live** `sanitize_text` — not by reading its source.

## Pre-registration — recorded before the probe ran

The roadmap wrote the expected outcome into Phase 1 before any measurement:
*"expected outcome is partial coverage: the invisible class covered, the visible
class (confusable, math-alphanumeric, full-width, punycode) fully through."*

**Result: confirmed exactly.** Every invisible and control channel is
neutralised; every visible-layer channel passes through untouched. One nuance
the prediction did not name is called out under Finding B.

**Null condition — did NOT fire.** The roadmap pre-committed to publishing
`honest-null: runtime-sanitizer-already-covers-visible-layer` and closing the
roadmap if the live sanitizer already neutralised **≥ 90 %** of in-scope
channels. Measured: **11 of 22 (50 %)**. The null threshold is not met, so the
roadmap continues into Phase 2.

## Coverage table

Verdict legend — `COVERED`: every hostile codepoint stripped · `CAPPED`: length
bounded · `THROUGH`: survives verbatim · `no-op`: nothing for a codepoint-level
filter to act on.

| # | Channel | Verdict | What decides it |
|---|---|---|---|
| 1 | zero-width (ZWSP/ZWNJ/ZWJ) | COVERED | `_ZERO_WIDTH`, `lint_hidden_unicode.ts:44` |
| 2 | zero-width no-break / word joiner (U+FEFF, U+2060) | COVERED | `_ZERO_WIDTH`, `:44` |
| 3 | soft hyphen (U+00AD) | COVERED | `_ZERO_WIDTH`, `:44` |
| 4 | invisible tag block (U+E0000–E007F) | COVERED | `_classify`, `:56` |
| 5 | bidi override (U+202A–202E) | COVERED | `_BIDI`, `:41` |
| 6 | bidi isolate (U+2066–2069) | COVERED | `_BIDI`, `:41` |
| 7 | deprecated format / interlinear (U+206A–206F, U+FFF9–FFFB) | COVERED | `_DEPRECATED`, `:45` |
| 8 | private-use area | COVERED | `_classify`, `:62-68` |
| 9 | C0 controls (incl. ESC → ANSI) | COVERED | `_isStrippableControl`, `retrieval_sanitize.ts:25` |
| 10 | C1 controls (NEL, CSI) | COVERED | same, `:29` |
| 11 | unbounded length | CAPPED | `MAX_FIELD_CHARS = 8192`, `retrieval_sanitize.ts:22` |
| 12 | variation-selector run (U+FE00–FE0F, U+E0100+) | **THROUGH** | not in `_classify`; `_isVS` is a **lint-only** concept (`lint_hidden_unicode.ts:77`) |
| 13 | confusable Cyrillic (U+0456, U+043E) | **THROUGH** | visible layer, excluded by design |
| 14 | confusable Greek (U+03BF) | **THROUGH** | visible layer, excluded by design |
| 15 | math-alphanumeric (U+1D5C2 …) | **THROUGH** | visible layer, excluded by design |
| 16 | fullwidth forms (U+FF29 …) | **THROUGH** | visible layer, excluded by design |
| 17 | combining-mark run (U+0301 x12) | **THROUGH** | visible layer, excluded by design |
| 18 | invisible filler (U+3164, U+115F) | **THROUGH** | invisible, but in neither set |
| 19 | confusable whitespace (U+00A0, U+2007, U+202F) | **THROUGH** | visible layer, excluded by design |
| 20 | punycode / IDN (`xn--…`) | no-op | ASCII; nothing for a codepoint filter to strip |
| 21 | HTML / XML entities (`&#x200b;`) | no-op | ASCII; nothing to strip |
| 22 | nested multibase (base64) | no-op | ASCII; nothing to strip |

## Finding A — the visible layer is exactly as open as documented

Rows 13–17 and 19 pass through because `retrieval_sanitize` says it will not
rewrite visible text. That is the documented contract, not a defect, and this
report does not reclassify it as one. What changes is that the gap is now
**measured** rather than asserted.

## Finding B — two rows the "invisible class is covered" framing missed

**Variation selectors (row 12) are invisible and survive.** `_isVS` exists only
in `lint_hidden_unicode`, which flags runs of ≥ 3 as a steganography signature at
**authoring** time; `_classify` — the set the runtime sanitizer shares — does not
include them, so nothing strips them at runtime. This is defensible: U+FE0F is
the emoji presentation selector and appears in legitimate content, so
unconditional stripping would corrupt real text. It is nonetheless a hole in the
class the roadmap treated as closed, and Phase 3 already lists it.

**Hangul fillers (row 18) are invisible and survive.** U+3164 / U+115F render as
blank but are not whitespace and are in neither the zero-width nor the bidi set.
Unlike variation selectors they have no legitimate role in this corpus.

Neither is a higher-severity finding than the roadmap assumed — both are named
in Phase 3's channel list — but recording them here stops "the invisible class is
covered" from being repeated as a blanket claim.

## Finding C — three channels are structurally not a sanitizer's job

Rows 20–22 are pure ASCII. A codepoint filter has nothing to act on, and the
"fix" would be worse than the gap:

- **HTML entities** — decoding `&#x200b;` would *create* the payload the floor
  exists to remove. The sanitizer must leave entities alone; whoever decodes
  them owns the decoded value.
- **nested multibase** — base64 appears legitimately throughout this repo
  (hashes, data URIs, lockfile digests). A depth guard would fire on real
  content constantly; this is a semantic judgement, not a structural one.
- **punycode / IDN** — worth *surfacing* in a text-expected field, never
  rewriting: `xn--` labels are valid DNS.

## Disposition — normalise vs flag vs quarantine

The roadmap's rule: **the default for anything with false-positive risk is flag,
not rewrite.** Applied per channel:

| Channel | Disposition | Why not the stronger action |
|---|---|---|
| invisible filler (U+3164, U+115F) | **STRIP** — fold into the existing invisible set | Invisible by nature, no legitimate use in this corpus; same class as ZWSP, so the existing mechanism already fits |
| variation-selector run ≥ 3 | **FLAG** | U+FE0F is legitimate emoji presentation; unconditional stripping corrupts real text. A *run* is the signal, a single VS is not |
| confusable Cyrillic / Greek | **FLAG**, reusing `lint_confusables`' TR39 set | Folding to a Latin skeleton corrupts any body legitimately containing mixed script — and this corpus contains real non-Latin text |
| math-alphanumeric | **FLAG** | NFKC would fold it, but NFKC is not surgical: it also rewrites ligatures and CJK punctuation in legitimate content. Out of step with "never rewrite visible text" |
| fullwidth forms | **FLAG** | Fullwidth is correct in CJK text; folding would corrupt it |
| combining-mark run | **FLAG** above a density bound | Diacritics are legitimate in many languages; only an absurd run is signal |
| confusable whitespace (NBSP etc.) | **NO ACTION** | NBSP is pervasive and benign in real prose (French typography, non-breaking joins). A check here is nearly all false positive |
| punycode / IDN | **FLAG** | `xn--` is valid DNS; rewriting it breaks real links |
| HTML entities | **NO ACTION** | Decoding would create the payload |
| nested multibase | **NO ACTION** | Precision too low; semantic not structural |
| word-order permutation | **OUT OF SCOPE** | Carried as a stretch item by the source draft, which conceded its precision is poor. Carrier text with legitimate word order is indistinguishable from permuted carrier text without semantics, so a structural check cannot own it — same exclusion as word choice, sentence length and misspelling |

**Nothing is quarantined.** Quarantine drops a whole entry, and every channel
above is either a strip (one codepoint class, no ambiguity) or a flag (ambiguous
by construction). Dropping a retrieval entry on an ambiguous signal would deny
the agent real content on a guess.

Net effect for Phase 3: **one strip, six flags, three no-actions, one named
exclusion.** Exactly one channel changes emitted bytes, which keeps the
byte-identical-for-clean-content property that the v1 envelope contract needs.

## Scope boundary — recorded so coverage is never over-claimed

**Text layer only.** The channel taxonomy from the sweep sources is a superset of
what is measured here; the majority of it — image, audio, PDF, DNS, TCP and
file-metadata steganography — governs files and packets, not text, and is out of
this package's threat model. Rows 20–22 are in scope as *text* but are not a
codepoint filter's business, which is a different exclusion and is recorded as
such above.

## What this report does NOT establish

- Coverage numbers are per **channel**, not per payload. A channel marked
  COVERED was probed with one representative payload; that proves the class is
  handled, not that every member of the class is.
- The `THROUGH` rows are measured against `sanitize_text` **only**. Whether a
  given consumer downstream normalises them is not tested here.
- No claim about detection *quality* for the flag dispositions — that is Phase
  4's frozen-corpus measurement, against the pre-registered recall and
  false-positive thresholds.
