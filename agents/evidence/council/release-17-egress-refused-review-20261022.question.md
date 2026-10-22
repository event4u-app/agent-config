<!-- evidence-type: analysis -->

# Decision — how eight egress-refused test files are covered by the 17.0.0 self-review

The 17.0.0 self-review sends diff chunks to a model through the vendor CLI. Before
every send, the package's own egress guard (`councilEgress().check`) refuses any
payload that matches a high-confidence credential rule. Scanned file by file, 8 of
the 1,308 in-scope files trip it on their own — all tests of the secret detector
and the egress guard, carrying deliberately fake credentials as fixtures:

- `src/scripts/_lib/egress_legacy_superset.test.ts` (pem-private-key)
- `src/scripts/_lib/egress_rules_parity.test.ts` (pem-private-key)
- `src/scripts/_lib/egress_token.test.ts` (db-connection-uri)
- `src/scripts/_lib/secret_detector.test.ts` (db-connection-uri)
- `tests/scripts/ai_council/council_egress.test.ts` (db-connection-uri)
- `tests/scripts/hooks/egress_injection.test.ts` (pem-private-key)
- `tests/scripts/network_sources.test.ts` (db-connection-uri)
- `tests/scripts/self_repair_release.test.ts` (aws-access-key)

Every other in-scope file is reviewed by the external model. The release is held
until the review is "actually completed" with every finding dispositioned.

## Options

1. **Redacted external review.** Replace each matched literal in these 8 diffs
   with a typed placeholder (`<FAKE-PEM-KEY>`, `<FAKE-DB-URI>`, `<FAKE-AWS-KEY>`)
   before sending, so the guard passes, and review them like every other file.
   The reviewer sees the test logic but not the exact fixture strings.
2. **In-session review.** The orchestrating agent reviews the 8 diffs locally,
   unredacted, and records them in the ledger as reviewed by the implementing
   session — not independent of the authors of the change.
3. **Recorded gap.** The 8 files are listed in the ledger as unreviewed by egress
   policy, and the review is called complete for the rest.
4. **Lower the guard** for this run (allow these rules to egress).

Which should be done: **1**, **2**, **3** or **4**? Give the choice, the reason,
and the condition under which you would require more.
