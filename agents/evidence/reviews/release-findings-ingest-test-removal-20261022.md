# Independent test review — removed assertions in tests/scripts/release_findings_ingest.test.ts

<!-- evidence-type: analysis -->

**Reviewer:** codex (openai), read-only, 2026-10-22. **Implementer:** claude-opus-5.5 on fix/release-without-review-gate.

**Verdict on the first pass:** weakening — three removed assertions covered live behaviour: the workflow file exists, its `contents: read` floor, and `if-no-files-found: ignore` on the findings upload. All three were restored; the restored upload assertion was seen red with the value changed to `error`.

**Everything else removed is legitimate:** the assertions tested the deleted ledger jobs and the deleted exports (`ledgerOnBranchArgv`, `blockingWithoutDisposition`, `dispositionStopMessage`, `ledgerAbsentMessage`, `settleFindingsLedger`), and a repository-wide search found no remaining caller.

## Prompt

Independent test review. A test file lost 49 assertions in this branch. Decide for each removed test block whether it tested (a) code or workflow jobs that this branch deleted, so the assertions have nothing left to test, or (b) behaviour that still exists, so removing it is a weakening. Name every case of (b) with the test title. Verdict: 'legitimate' if every removed assertion is (a), otherwise 'weakening'.

Inspect in this repository: git diff origin/main..HEAD -- tests/scripts/release_findings_ingest.test.ts src/scripts/_lib/release_findings_ingest.ts .github/workflows/self-review-gate.yml src/scripts/release.ts, and grep for any remaining caller of the deleted exports.
