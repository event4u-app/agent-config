# Claims ledger (fixture)

### claim: masked-exec

- claim: A fixture claim whose re-run reads `head`'s exit code.
- evidence: exec:vitest run tests/x.test.ts | head -5 -> 0
- status: backed

### claim: clean-exec

- claim: A fixture claim whose re-run reads the verifier's exit code.
- evidence: exec:vitest run tests/x.test.ts -> 0
- status: backed
