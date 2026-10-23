# Egress placeholders — identifier round trip (PREREG endpoint c, identifier half)

Date: 2026-10-22. Revision measured: `e7d10fac53` (`main` at the time of the
run), engine `src/scripts/_lib/egress_token.ts` + rule table
`src/scripts/_lib/egress_rules.ts`, unmodified. Pre-registration:
`internal/bench/egress-placeholders-PREREG.md`, endpoint (c), committed before
any Phase 2–3 data. Scorer: `internal/bench/egress-roundtrip/` (`scorer.ts`,
`corpus.ts`, `run.ts`); raw figures in the JSON beside this file. Nothing was
sent anywhere.

Reproduce:

```bash
node_modules/.bin/tsx internal/bench/egress-roundtrip/run.ts --json internal/bench/reports/egress-placeholders-identifier-roundtrip-2026-10-22.json
npx vitest run tests/scripts/egress_roundtrip_scorer.test.ts
```

**Why a new scorer.** The credential half (`egress-engine/run.ts`, 2026-10-20)
scores idempotence only — a credential token never restores. The identifier
half needs the restore, so `scorer.ts` adds it and keeps the credential
scorer's idempotence definition (second pass under the same scope).

**Restore, as measured.** Every token in the replaced text that the issuing
`TokenScope` owns is substituted by `scope.resolve(token)`; a token it does not
own is left in place, so a lost mapping fails the round trip. This is the
in-scope map. The session-table path (`restoreToken`, which re-derives a value
from its origin file) is not measured here.

## Falsification, before any reading counted

| Planted defect | Reading on W1 (1,200 documents) | Rejected |
|---|---|---|
| restore that drops the last byte of each restored value | 0 / 1,200 exact restores, bar fails | yes |
| replacer whose second pass appends one byte to text already carrying a token | 1,200 / 1,200 idempotence mismatches, bar fails | yes |

Both are also pinned in `tests/scripts/egress_roundtrip_scorer.test.ts`
(5 tests, green).

## Corpora

- **W1** — the frozen identifier corpus the PREREG names,
  `tests/fixtures/egress-detection/w1-identifiers.json` (seed 20261019), one
  phrase per document. It carries no SSN and no North American phone.
- **W1x** — generated at run time from seed `20261022`, 120 documents per type:
  prose (support mail, German letter), YAML, `.env`, TypeScript and JSON
  carriers; each value planted twice, as a second spelling of the same entity
  where the type has one (spaced vs compact IBAN, grouped vs bare card, spaced
  vs E.164 phone, `(NXX) NXX-XXXX` vs dotted NANP), so 600 documents exercise
  the `_vK` variant tokens; plus 120 `MIXED` tickets holding all seven types at
  once. Checksums (IBAN mod 97, Luhn, ISO 7064 tax ID, SSN area rules) are
  computed; no value is real.

## Results

| Corpus | Type | Documents | Tokens replaced | Fully replaced | Byte-exact restore | Idempotence mismatches | Fresh-scope mismatches |
|---|---|---|---|---|---|---|---|
| W1 | `IBAN` | 200 | 200 | 200 | 200 / 200 | 0 | 0 |
| W1 | `CARD` | 200 | 200 | 200 | 200 / 200 | 0 | 0 |
| W1 | `EMAIL` | 200 | 200 | 200 | 200 / 200 | 0 | 0 |
| W1 | `PHONE` | 400 | 400 | 400 | 400 / 400 | 0 | 0 |
| W1 | `TAXID` | 200 | 200 | 200 | 200 / 200 | 0 | 0 |
| W1x | `IBAN` | 120 | 240 | 120 | 120 / 120 | 0 | 0 |
| W1x | `CARD` | 120 | 240 | 120 | 120 / 120 | 0 | 0 |
| W1x | `EMAIL` | 120 | 270 | 120 | 120 / 120 | 0 | 0 |
| W1x | `PHONE` (international) | 120 | 240 | 120 | 120 / 120 | 0 | 0 |
| W1x | `PHONE` (NANP) | 120 | 240 | 120 | 120 / 120 | 0 | 0 |
| W1x | `TAXID` | 120 | 240 | 120 | 120 / 120 | 0 | 0 |
| W1x | `SSN` | 120 | 240 | 120 | 120 / 120 | 0 | 0 |
| W1x | `MIXED` (all seven) | 120 | 1,080 | 120 | 120 / 120 | 0 | 0 |

`EMAIL` on W1x counts 270 tokens because one carrier also names a support
address. "Fresh-scope mismatches" is an extra reading, not a PREREG bar: the
replaced text passed through a scope that minted none of its tokens — a
non-zero count would mean a token itself matches an identifier rule.

## Verdict against the PREREG bar

Bar (c): zero tolerance — `restore(replace(x)) == x` byte for byte and
`replace(replace(x)) == replace(x)` for every W1/W2 document. **Identifier half:
passes** — 0 restore mismatches and 0 idempotence mismatches over 1,200 W1
documents, and the same on 960 W1x documents. With the credential half
(`egress-placeholders-engine-2026-10-20.md`, 0 of 1,800), endpoint (c) has no
recorded mismatch on either class.

**What a null would have looked like.** One document in any type whose
restored bytes differ from the input, or whose second pass changes the replaced
text, fails the endpoint for the whole class (PREREG: "One mismatch fails the
endpoint"); the scorer would have printed the per-type count and this report
would carry that number as the verdict. The two planted defects above are what
such a reading looks like.

## What this does and does not show

- **Round trip only where a value was replaced.** A missed value round-trips
  trivially; the "fully replaced" column shows every planted value was removed,
  so no row here passes by not being replaced. Recall itself is endpoint (a).
- **Corpus and rules share an author lineage.** W1x was written knowing the
  rows' context words; values phrased outside them are not tested here.
- **In-scope restore only.** `restoreToken` over a persisted session table is
  a different path (origin re-derivation, destination binding) and is not
  covered by this reading.
- **Not measured:** (e) paired quality and (f) on the CI runner class.
