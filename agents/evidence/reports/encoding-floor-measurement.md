# Encoding floor — measurement against the frozen corpus (Phase 4)

Deliverable for `road-to-runtime-encoding-hardening` Phase 4. Every number here
is **rendered** by `encoding_corpus_report`, never hand-typed. Reproduce with:

```bash
npx tsx src/scripts/encoding_corpus.ts --check      # corpus matches its freeze
npx tsx src/scripts/encoding_corpus_report.ts       # the numbers below
```

Measured 2026-07-29 on `feat/runtime-encoding-hardening`.

## Pre-registered acceptance — recorded before the detector existed

The thresholds were written into the roadmap in Phase 4 and the corpus was
frozen in Phase 2, **both before any Phase-3 detector code was written**. They
are encoded as `THRESHOLDS` in `encoding_corpus_report.ts` so a run cannot pass
by moving the bar.

| Gate | Threshold | Measured | Verdict |
|---|---|---|---|
| recall, all in-scope positives | ≥ 95 % | **99.00 %** | PASS |
| recall, unambiguous classes | ≥ 99 % | **100.00 %** | PASS |
| false-positive rate, clean negatives | ≤ 0.5 % | **0.00 %** | PASS |
| added runtime model spend | 0 | **0** (structural — no model call on this path) | PASS |
| added latency p95 per message | < 2 ms | **0.018 ms** | PASS |

**Selected branch: ADOPT.** The roadmap's honest-null exit (recall clears but FP
over budget → ship detect-and-flag only and publish the FP number) did **not**
fire. Note that nothing in this change quarantines anything regardless — six of
the seven channels are flag-only by Phase 1's disposition — so the branch records
which outcome the measurement selected rather than switching behaviour after the
fact.

## Per-channel recall

| Channel | Detected | Recall |
|---|---|---|
| bidi-control | 20/20 | 100 % |
| combining-mark-run | 20/20 | 100 % |
| control-char | 20/20 | 100 % |
| deprecated-format | 20/20 | 100 % |
| fullwidth-forms | 20/20 | 100 % |
| invisible-filler | 20/20 | 100 % |
| invisible-tag-block | 20/20 | 100 % |
| math-alphanumeric | 20/20 | 100 % |
| private-use-area | 20/20 | 100 % |
| punycode-idn | 20/20 | 100 % |
| variation-selector-run | 20/20 | 100 % |
| zero-width | 20/20 | 100 % |
| zero-width-joiner-bom | 20/20 | 100 % |
| **confusable-cyrillic** | **19/20** | **95 %** |
| **confusable-greek** | **18/20** | **90 %** |

`detected` means the floor either **stripped** the signal (`sanitize_text`
changed the value) or **reported** it (`scan_encoding_findings` returned a
finding). Both mean the vector did not reach the model unnoticed, which is the
property under test.

## The three misses, named exactly

The corpus is frozen, so these were **not** engineered away. Two distinct
causes, and only one of them is a real limitation:

**Corpus artifact (2 of 3).** `pos-confusable-cyrillic-007` and
`pos-confusable-greek-007` encode a **single-letter** token (`а`, `α`). The
shared signature requires `MIN_LETTERS = 3` before it will fire, so a one-letter
token can never match. These two positives are also not a realistic attack — a
single swapped letter in a one-letter word carries no instruction.

**Real limitation (1 of 3).** `pos-confusable-greek-019` encodes `dαtα`: two
Latin letters, two Greek. The containment rule declines any token whose foreign
letters do **not** lose the majority vote, because a mostly-foreign token is a
*foreign word*, not a homoglyph attack. So an attacker who swaps **half or more**
of a token's letters escapes this signature.

That is the deliberate price of the 0.00 % false-positive rate, and it is worth
stating plainly: this detector catches the *subtle* homoglyph swap — the one a
human reviewer cannot see — and deliberately does not catch the blatant one,
which a reviewer reading `dαtα` has a fair chance of noticing. Buying that last
5 % would mean flagging genuine Cyrillic and Greek words, and this corpus's
negatives include real multi-script content.

**Both causes were left in place on purpose.** Adjusting `MIN_LETTERS`, or
re-emitting the corpus without the awkward fixtures, would be tuning against the
test split — precisely what the `golden-set-freeze` blocker exists to prevent.
A recall of 99 % with two named artifacts and one named limitation is worth more
than a 100 % produced by moving the target.

## Coverage boundary — the claim, with its evidence

```
TEXT LAYER ONLY, BY CONSTRUCTION.
```

- **Never** for file or network channels — image, audio, PDF, DNS, TCP or
  file-metadata steganography. Backed by the Phase-2 **scope-guard test**, which
  asserts every corpus entry is `layer: text` and which is itself falsified by a
  test that splices in a `layer: file` PNG-metadata fixture and requires the
  guard to fail.
- **Never** for semantic evasion — word choice, phrasing, garden-path
  constructions, word-order permutation. A structural check cannot own these:
  carrier text with legitimate word order is indistinguishable from permuted
  carrier text without semantics.
- **Not** a claim to "block steganography". Of the seven channels this change
  adds, exactly **one** (invisible fillers) removes bytes; the other six report
  and pass the text through unchanged. A flag is a signal to a human or a
  downstream gate, not a block.

## What this measurement does NOT establish

- Recall is per **channel representative**, over 20 encoded variants each. It is
  not a claim about every possible member of a class.
- The negatives are 353 real in-repo snippets from three content kinds. A 0.00 %
  false-positive rate on *this* traffic is not a guarantee for a consumer corpus
  containing, say, heavy multi-script prose — the confusable signature is the
  component most exposed there, and its containment rules are the reason the rate
  is 0 here.
- Latency is measured in-process on the frozen corpus, not under production
  load. It bounds the algorithm's cost (18 µs p95), not a deployed system's.
