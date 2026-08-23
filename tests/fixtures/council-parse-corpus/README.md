# Council findings-parse corpus

Recorded, verbatim member answers fed to
[`parse_findings_outcome`](../../../src/scripts/ai_council/consensus.ts) so the
three outcomes (`parsed` / `empty` / `parse_failed`) have a fixed population to
be measured over.

**One file, one answer, byte-for-byte.** No file is edited to make a parser
happy — a fixture rewritten to parse is a fixture that has stopped being
evidence. `expected.json` records the outcome each file must produce.

## What this corpus is NOT

It is **not live traffic**. Every rate computed here has this directory as its
denominator, and the rate row in
`docs/CLAIMS.md` says so in the same sentence it states the number. A corpus
assembled to cover the failure shapes over-represents them by construction:
these six answers were chosen because they are the six distinct shapes, not
because that is how often each occurs in a real run.

## Reproduce

```
./scripts-run src/scripts/council_parse_rate
```

Prints the outcome per fixture and the rate rows, and exits non-zero if any
fixture's outcome drifts from `expected.json`.
