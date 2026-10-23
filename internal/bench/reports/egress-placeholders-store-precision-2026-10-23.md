# Egress placeholders — precision of the store rows (PREREG endpoint b, store reading)

Pre-registration: `internal/bench/egress-placeholders-PREREG.md`, endpoint (b), unchanged.
Scorer: `internal/bench/egress-detection/run.ts --store`, for step 4.4 of
`road-to-a-tick-the-shipped-path-earns`. Raw reading: the JSON beside this file.

**What is new.** The 2026-10-19 reading measured the context-bearing rows of the rule
table. The two text stores (knowledge ingestion, cross-repo retrieval) do not apply those
rows: they apply `STORAGE_IDENTIFIER_RULES` (`src/scripts/_lib/identifier_redaction.ts`),
the identifier rows with their context words dropped. Nothing had measured that. This
reading does, at commit `7c33852caccbac7097d7d80381a8e0de96d2533b` on a clean tree, next
to the naive drop-every-context form the stores shipped until `50aa48d301`.

**Self-test first.** With the IBAN row's checksum disabled the store scorer fails (b).

## (b) Precision on code — W4, the tree

| Rows | Tracked text files with any identifier detection | Bar | Verdict |
|---|---|---|---|
| store rows, as shipped from `50aa48d301` | **82 of 14,873 (0.55 %)** | < 1 % of files | pass |
| naive store rows (every context word dropped) | 286 of 14,873 (1.92 %) | < 1 % of files | fail |

The earlier reading of the naive rows was 1.29 % on a smaller tree; on this tree they
read 1.92 %.

## (b) Labelled negatives, 400 documents

| Rows | E-mail | IBAN | Card | Phone |
|---|---:|---:|---:|---:|
| store rows | 0 | 0 | 40 | 2 |
| naive store rows | 0 | 0 | 44 | 3 |

The bar counts e-mail and IBAN only, and both are zero. Card and phone are tallied so the
reading hides nothing: the 40 card hits are the `card-shaped-no-context` negatives, which a
store tags by design (it drops the card word and keeps Luhn); the 2 phone hits are the
numeric head of a GitHub noreply identity, still open.

## What changed in the store rows

- Phone and card digits may not touch a letter on either side, and may not follow a
  decimal point (`(?![0-9A-Za-z])`, `(?<![0-9A-Za-z.])`): a digit-led hex SHA and a
  decimal fraction are not cards or phones.
- A national number may not continue a `-` or `/` list (`ADR-046/047/048`).
- A North-American number keeps its context word; a second row tags it without one only
  when it is written formatted (two separators or a bracketed area code). `2147483647`
  is untouched; `212-555-0142` is still tagged.
- A `+` at a line start (a diff's added line) needs a grouped number after the country
  code; a dotted quad is never a phone. `+192.168.100.200` is untouched.

## What this does and does not show

- **The tree count includes true positives.** Many of the 82 files hold deliberate
  synthetic PII (fixtures, evidence about redaction); they are counted as hits, not
  sorted, so 0.55 % is a ceiling on false positives in tree text.
- **Recall moved.** A compact US number without a phone word is no longer tagged in a
  store. That is the price of not tagging `2147483647`. On the frozen W1 corpus the store
  rows still find every planted value (IBAN, e-mail, card and tax ID 200/200 each, phone
  400/400), but W1 plants no North-American number, so that loss is not in this count.
- One tree, one commit. A tree that grows more digit-dense text can cross the bar again.
