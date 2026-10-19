# Egress placeholders — identifier recall and precision (PREREG endpoints a, b)

Pre-registration: `internal/bench/egress-placeholders-PREREG.md`, endpoints (a)
and (b), committed before any Phase 2–3 data. Scorer:
`internal/bench/egress-detection/run.ts`; corpus, generated from seed 20261019
and frozen with this reading: `tests/fixtures/egress-detection/`. Raw reading:
the JSON beside this file.

**Self-test first.** With the IBAN row's checksum disabled the scorer fails
endpoint (b) — checksum-invalid IBANs in the negative corpus are reported — so
the green reading below is a reading of the validators, not of a scorer that
passes everything.

## (a) Recall per class — W1, 200 planted values per type

| Type | Found | Bar | Verdict |
|---|---|---|---|
| `EMAIL` | 200 / 200 | ≥ 99% | pass |
| `IBAN` (checksum-valid; DE, AT, NL, FR, CH; compact and spaced) | 200 / 200 | ≥ 99% | pass |
| `CARD` (Luhn-valid, card word in the phrase) | 200 / 200 | reported, no bar | — |
| `PHONE` (200 with country code, 200 national with a phone word) | 400 / 400 | reported, no bar | — |
| `TAXID` (structured, ISO 7064 check digit, tax word in the phrase) | 200 / 200 | reported, no bar | — |

## (b) Precision on code — W4

| Reading | Value | Bar | Verdict |
|---|---|---|---|
| tracked text files with any identifier detection | 21 of 14,268 (0.15%) | < 1% of files | pass |
| labelled negatives with a detection (bad IBAN checksums, documentation and reserved domains, no-reply and GitHub noreply identities, card-shaped ids with no card word, hashes, UUIDs, dates after a diff marker, retina asset names, git remotes; 400 in all) | 0 | 0 | pass |

## What this does and does not show

- **The corpus and the rules come from one session.** The generator emits the
  shapes the rows were written to accept, so 100% recall says the rows accept
  what their author meant them to accept and nothing about values phrased
  another way; phone, card and tax-ID recall is a property of the phrasing by
  design (PREREG (a)). An independent corpus is the next reading worth taking.
- **The tree count includes true positives.** Most of the 21 files hold
  deliberate synthetic PII in tests and evidence; they are counted as hits, not
  sorted, so the precision reading is a ceiling on false positives.
- **Not measured here:** endpoints (c) round trip, (e) paired quality and (f)
  latency, and every credential type (W2).
