<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-22 for branch feat/subagent-system-2583,
     round 6 of the identifier-rows review, committed verbatim. Not edited after the run. -->

# Review branch feat/subagent-system-2583, round 6 — the egress rule table and the engine chunk ceiling

Ratification review under ADR-268 § 4. Gated files: `src/scripts/_lib/egress_rules.ts` and
`src/config/hook-bundle-budget.json`; subject digest
`194216ae395d58d032c2edbc91e38af5a49f626ca6ab25315ea27aca625fda21` at revision `dc8648b9ac`.
The full diff against `origin/main` was given in round 5
(`agents/evidence/council/one-detector-identifier-rows-review-20261022-r5.question.md`).

Round 5 (both seats refused) converged on one blocking finding: `OM` was missing from
`IBAN_LENGTHS`, so a valid Omani IBAN matched the pattern and was rejected by the validator
before the checksum, leaving it unmasked. Both seats also asked for the three new credential
rows to be exercised at their exact minimum lengths and for their linearity arguments to exist.

What changed since round 5:

- `IBAN_LENGTHS` gains `OM23` and the other registry countries it lacked: `BI27 DJ27 FK18 HN28
  LY25 MN20 NI28 RU33 SD18 SO23 YE30`; the table comment now says a missing country leaves its
  IBANs unmasked, so the table errs towards inclusion (every candidate still needs MOD-97).
- Tests: the official Omani example `OM81 0180 0000 0129 9123 456` is valid and detected; a
  checksum-valid IBAN generated for each added country is detected
  (`src/scripts/_lib/egress_identifier_rules.test.ts`). The IBAN pattern accepts 12-35
  characters, so `RU33` is inside it.
- Each of `huggingface-token`, `nvidia-api-key`, `replicate-api-token` is tested at exactly its
  minimum body length (30 / 40 / 30) as masked and one shorter as not, and `nvapi-` with `-` and
  `_` in the body (`tests/scripts/_lib_egress_free_tier_prefixes.test.ts`). Their linearity
  arguments are in `src/scripts/_lib/egress_rules_linearity.ts` (`PREFIX_RUN`), required by
  `egress_rules.test.ts` › every rule states why it is linear.
- Engine chunk now measures 30,493 bytes against the proposed 32,000 ceiling.

Review it. For each defect report file:line, the failure scenario and a severity. Say whether
the round-5 finding is closed. Close with a classification (`ratified`,
`confirmed-non-expanding`, or a refusal) and a one-line stance.

## Diff since round 5 (gated file)

```diff
diff --git a/src/scripts/_lib/egress_rules.ts b/src/scripts/_lib/egress_rules.ts
index 69ce4126ab..a2218b3598 100644
--- a/src/scripts/_lib/egress_rules.ts
+++ b/src/scripts/_lib/egress_rules.ts
@@ -196,9 +196,10 @@ export function pemMaskEnd(text: string, span: SpanBounds): number | null {
 // each row carries a checksum, a context word, or both, because a false positive
 // here damages ordinary code and review text.
 
-// IBAN length per country (ISO 13616 registry), packed as `CCnn` pairs.
+// IBAN length per country (ISO 13616 registry), packed as `CCnn` pairs. A country
+// missing here leaves its IBANs unmasked, so the table errs towards inclusion.
 const IBAN_LENGTHS =
-    'AD24AE23AL28AT20AZ28BA20BE16BG22BH22BR29BY28CH21CR22CY28CZ24DE22DK18DO28EE20EG29ES24FI18FO18FR27GB22GE22GI23GL18GR27GT28HR21HU28IE22IL23IQ23IS26IT27JO30KW30KZ20LB28LC32LI21LT20LU20LV21MC27MD24ME22MK19MR27MT31MU30NL18NO15PK24PL28PS29PT25QA29RO24RS22SA24SC31SE24SI19SK24SM27ST25SV28TL23TN24TR26UA29VA22VG24XK20';
+    'AD24AE23AL28AT20AZ28BA20BE16BG22BH22BI27BR29BY28CH21CR22CY28CZ24DE22DJ27DK18DO28EE20EG29ES24FI18FK18FO18FR27GB22GE22GI23GL18GR27GT28HN28HR21HU28IE22IL23IQ23IS26IT27JO30KW30KZ20LB28LC32LI21LT20LU20LV21LY25MC27MD24ME22MK19MN20MR27MT31MU30NI28NL18NO15OM23PK24PL28PS29PT25QA29RO24RS22RU33SA24SC31SD18SE24SI19SK24SM27SO23ST25SV28TL23TN24TR26UA29VA22VG24XK20YE30';
 
 export function isValidIban(value: string): boolean {
     const iban = value.replace(/ /g, '').toUpperCase();
```
