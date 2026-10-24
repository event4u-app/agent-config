<!-- evidence-type: analysis -->

# Independent verdict — removing `tests/lib/provenance_signature.test.ts`

**Date:** 2026-10-24 · **Reviewers:** AI council, `anthropic` (claude-sonnet-4-5) and `openai`
(codex-default), prompt mode, one deliberation, USD 0.00 · **Prompt:**
`agents/evidence/council/sigstore-test-removal-review-20261024.question.md`, committed verbatim ·
**Raised by:** `check_test_weakening` (18 assertions net-removed)

## Verdict — removal justified, 2/2

| Seat | Verdict |
|---|---|
| `openai` | `removal-justified` |
| `anthropic` | `removal-justified-with-conditions` — add a test that `verify_release_provenance` refuses an unparseable certificate |

The deleted file tested `verify_attestation_signature` and `dssePae`, which this change removes
together with the certificate-bound check they implemented; nothing in the tree calls them. Their
properties are either gone with the code, or covered by the new suite against the real 17.3.0
attestation (edited payload, wrong identity, missing attestation, self-signed certificate — the last
asserted as the limitation in the deleted file and as a refusal now). The one property both seats
found uncovered was an unparseable certificate.

## Condition, discharged

`tests/lib/sigstore_provenance.test.ts` › *refuses a certificate that cannot be parsed* — the real
SLSA bundle with its certificate bytes replaced by non-DER bytes is refused. Added in the same change
and run green before the deletion shipped.
