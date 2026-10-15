<!-- evidence-type: analysis -->

# Council review of PR #2366 — egress rule table, placeholder tokens, secret detector refactor

Six rounds, 2026-10-15, with two seats configured (`anthropic/claude-sonnet-4-5`,
`openai/codex-default`, CLI transport, `--prompt-mode pr --rounds 2`). Prompts,
committed verbatim before each run:
`agents/evidence/council/pr2366-egress-review-20261015.question.md` (round 1) and
`agents/evidence/council/pr2366-egress-review-r2-20261015.question.md` (round 2).
The full responses are local run output and are summarised here, with the seats'
stances in their own words.

## Round 1 — verdicts

| Seat | Stance |
|---|---|
| anthropic/claude-sonnet-4-5 | "REQUEST_CHANGES" — blocking: forged token bypass, detection regression. "Highest-leverage change: Fix the forged-token bypass — it's attacker-controllable and undermines the entire replacement layer." |
| openai/codex-default | "REQUEST_CHANGES — forged token substrings can bypass replacement and the scanner migration loses established coverage; the highest-leverage pre-merge change is to remove unauthenticated overlap suppression and add an executable old-versus-new adversarial parity suite covering embedded tokens and every changed boundary." |

## Round 1 — findings and dispositions

| # | Severity (seats) | Finding | Disposition | Red-proof |
|---|---|---|---|---|
| 1 | high / high | `replaceValues` dropped every span overlapping any syntactically valid token, so a token-shaped substring inside a credential left the credential in plaintext | fixed — a span is left alone only inside a token this scope minted (`TokenScope.owns`) | six embedded-forgery tests (one per credential type whose class admits `_`) red before the fix |
| 2 | high / high | bounding quantifiers narrowed the commit-time scanner (1,024-char keys lost a suffix, 8,192-char JWT segments and 256-char userinfo missed, more than 16 spaces evaded `generic-assignment`) | fixed — quantifiers unbounded wherever linear, with a required per-rule `linearity` argument; two bounds kept where the unbounded form was quadratic, published as `DETECTION_CEILINGS` and in the contract | frozen pre-move rule pack vs table on every changed boundary: 16 cases red before |
| 3 | medium (both) | the contract claimed foreign or invented tokens are always unresolved; with a 24-bit fingerprint that holds only with probability 1 − 2^-24 per guess | fixed in the contract — probability stated; what a successful guess returns (an identifier, locally) stated | contract text |
| 4 | medium / medium | token identity ignored the class, so identifier-then-credential minting kept a credential restorable | fixed — minting one (type, value) under a second class throws | test red before, both orders |
| 5 | medium / medium | the non-retention test serialised the sanitised `snapshot()` | fixed — the test walks every string reachable from the scope, first proving it reaches the stored identifier | red with the credential branch neutralised to store its value |
| 6 | low / low | global or sticky exclusion regexes kept `lastIndex` between calls | fixed — reset before each test | red before, both flags |
| 7 | medium (one seat) | the contract's logging rule contradicts the scanner's masked preview | documented — named exception in the contract, owned by step 2.2; scanner behaviour unchanged because `secret-vcs-guard` asks for the preview | contract text |
| 8 | medium (one seat) | "no rule matches a token" was untested and false for `generic-assignment` after a keyword | fixed — explicit test that it can match (fingerprint-dependent entropy); idempotence rests on the scope check | test |

Seat disagreement noted: one seat rated finding 3 not blocking and fail-closed;
the other showed an exact collision aliases the existing entry. The contract
change follows the second reading.

## Round 2 — verdicts

Prompt built from the post-fix diff at `a652ab9e2` (49.9 KB, omissions named in
the prompt). Both seats judged all eight round-1 findings resolved or resolved by
disclosure (one seat rated finding 4 "partially resolved" because of the key
issue below), and both asked for changes on new defects:

| Seat | Stance |
|---|---|
| anthropic/claude-sonnet-4-5 | "REQUEST_CHANGES — offset ambiguity and mutable key bypass are correctness/security defects that can leave credential bytes in plaintext or breach class isolation." |
| openai/codex-default | "REQUEST_CHANGES — ambiguous capture offsets can leave credential bytes plaintext and caller-controlled keys can defeat class/scope isolation; the highest-leverage change is to introduce one authoritative, index-based span extraction path and exercise replacement end to end with adversarial repeated-substring tests." |

## Round 2 — findings and dispositions

| # | Severity (seats) | Finding | Disposition | Red-proof |
|---|---|---|---|---|
| R2-1 | high / high | a captured value was placed with `m[0].indexOf(value)`; when the value repeats the keyword its first copy is at offset 0, so the wrong bytes were replaced | fixed — `generic-assignment` carries the `d` flag; the table and the commit-time scanner read `m.indices`; a value-group rule without the flag is refused | replacement test (`AuthToken=AuthToken=AuthToken=`) and scanner column test red before. The seat's own example does not pass the value gate, so a self-overlapping value that does was used |
| R2-2 | high / high | `TokenScope` kept a caller-owned mutable key; mutation bypassed the class check and two scopes sharing a key resolved each other's tokens | fixed — the constructor takes no key and draws 32 random bytes | shared-key test red before |
| R2-3 | medium / medium | `mint()` accepted types and numbers the recogniser rejects, breaking second-pass stability | fixed — type and number range refused at mint | two tests red before |
| R2-4 | medium (one seat) | the parity suite bypassed validators, context and exclusions | fixed — every case also runs through `findSpans` against the pre-move pattern plus a frozen pre-move value gate | red (6 cases) with the validator neutralised |
| R2-5 | note (one seat) | `resolve()` does not check the fingerprint against the number | not a defect — the lookup key is the whole token string, fingerprint included, so a mismatched fingerprint finds nothing | existing forged-fingerprint test |

The round-2 fixes were reviewed in round 3.

Not changed and not raised as defects: the JWT linearity wording and the
`findUnboundedQuantifier` name (one seat raised them as minor; the other judged
them not to be defects).

## Round 3 — verdicts

Prompt: `agents/evidence/council/pr2366-egress-review-r3-20261015.question.md`
(diff at `338287df2`, omissions named in the prompt). Quorum 1 of 2.

| Seat | Stance |
|---|---|
| anthropic/claude-sonnet-4-5 | **No verdict — degraded.** The seat returned an empty text (transport timeout); it is recorded as absent, not as agreement. |
| openai/codex-default | "REQUEST_CHANGES — cross-type minting can retain and resolve credential bytes, violating the central security invariant; the single highest-leverage change is to enforce class identity with a keyed canonical-value-only index independent of token type, then add a same-value/different-type regression test." |

## Round 3 — findings and dispositions

| # | Severity | Finding | Disposition | Red-proof |
|---|---|---|---|---|
| R3-1 | high | class identity keyed by (type, value): one value minted as APIKEY/credential then EMAIL/identifier kept and resolved the credential | fixed — the class is indexed by a keyed digest of the canonical value alone and a second class is refused before anything is stored; the old per-(type, value) check is removed | test red before, both orders; red again with the new check neutralised |
| R3-2 | high | the contract stated a (type, value) invariant and concluded a stronger one | fixed — contract states one class per value whatever its type, indexed by a keyed digest, never the value | contract text |
| R3-3 | medium | `formatToken()` emitted parts the recogniser rejects | fixed — the writer applies the recogniser's type, number range and fingerprint shape | test red before |
| R3-4 | medium | the ceiling check in the parity suite compared counts only | fixed — exact expectation per ceiling case | red on the dotted-scheme case with the trailing `@` removed from the pattern, which the count check accepted |
| R3-5 | medium | contract spelled the type as upper-case letters while the code allows digits | fixed — contract spells `[A-Z][A-Z0-9]{1,15}` | contract text |
| R3-6 | low (seat) / medium (coordinator) | the scanner ignored context and exclusions and fell back to the match start without the `d` flag | fixed — `evaluateMatch` in the table applies every field; both readers call it; `scanText` takes an optional row set for tests | context, exclusion and missing-flag tests red before |

The round-3 prompt also carried the parity-test fixtures quoted verbatim; their
lines are pinned in `.secret-allow` after audit.

## Round 4 — verdicts

Prompt: `agents/evidence/council/pr2366-egress-review-r4-20261015.question.md`
(diff at `c4760bd90`, omissions named). Quorum 2 of 2; no re-run was needed.
Both seats judged the round-3 class-identity, formatter and ceiling findings
resolved, and both asked for changes:

| Seat | Stance |
|---|---|
| anthropic/claude-sonnet-4-5 | "REQUEST_CHANGES — the multiline semantic drift means the commit-time scanner and replacement engine disagree on detection, undermining the 'one rule table' claim; the token identity contract contradicts itself." |
| openai/codex-default | "REQUEST_CHANGES — token numbering contradicts the contract's first-seen guarantee and token identity remains misstated; highest-leverage change: pre-mint replacements in ascending span order, add a two-value ordering regression test, and clarify identity as `(type, canonical value)`." |

## Round 4 — findings and dispositions

| # | Severity | Finding | Disposition | Red-proof |
|---|---|---|---|---|
| R4-1 | medium (one seat, new) | `replaceValues` minted inside the right-to-left substitution, so the last value of a type got number 1 | fixed — mint in text order, then substitute | two-key ordering test red before |
| R4-2 | medium (both) | the contract promised one token per value while the code issues one per (type, value) | fixed in the contract — identity is the (type, canonical value) pair; class is per value regardless of type | contract text |
| R4-3 | low (both) | the contract omitted the 999,999 number ceiling | fixed in the contract | contract text |
| R4-4 | medium (anthropic) / low-to-medium (openai) | the scanner reads one line at a time and the replacer the whole text, so an assignment split across lines is replaced but not reported | documented as intended — line scope is the pre-move scanner behaviour, and the replacer seeing more is the safe direction for egress; a test pins that every scanner finding is also a replacer span, and that the split assignment is the documented difference | subset test red with the scanner column shifted by one |
| R4-5 | low (openai) | no tests at the grammar boundaries | added — 2- and 16-character types, a digit after the first letter, 999,999; 17 characters and a leading digit refused | tests (they pass on the current code; they guard drift) |
| R4-6 | low (both) | `matchesFromStart` is misleadingly named | renamed `testWholeValue` | — |

The round-4 fixes were reviewed in round 5.

## Round 5 — verdicts

Prompt: `agents/evidence/council/pr2366-egress-review-r5-20261015.question.md`
(sent by the coordinating session). Quorum 1 of 2.

| Seat | Stance |
|---|---|
| anthropic/claude-sonnet-4-5 | **No verdict — degraded.** The seat exited with an error (`exit_1`) and an empty text; recorded as absent, not as agreement. |
| openai/codex-default | "REQUEST_CHANGES — the replacement path can send private-key material in plaintext and the scanner introduces trivial coverage bypasses; highest-leverage change: separate detection spans from full replacement spans and gate every rule with end-to-end tests proving no planted credential bytes survive." |

## Round 5 — strategy shift and dispositions

Each of five rounds had found new defects, so the response changed shape
rather than patching rule by rule: detection span (what the scanner reports) and
replacement span (every byte that must not leave) are now separate concepts with
a declared policy per rule, a rule that cannot prove its replacement span makes
the replacer refuse the whole text, and an end-to-end suite asserts on what
actually leaves.

| # | Severity | Finding | Disposition | Red-proof |
|---|---|---|---|---|
| R5-1 | critical | `pem-private-key` replaced the header only; the key body left in plaintext | fixed — each rule declares `replacement`: the detection span, or a `through` function proving the end; PEM replaces through its END marker (one sticky scan to the nearest key marker); no provable end → `EgressRefusedError`, never a partial replacement | end-to-end PEM cases and both fail-closed cases red before; red again with the PEM policy set back to the detection span |
| R5-2 | high | parity of detection was treated as safety of replacement | fixed — `egress_replacement_e2e.test.ts`: every credential rule has a fixture (multi-line key, key inside a JSON string, glued JWT, 33-character scheme, multi-kilobyte values) and no planted sensitive byte may survive; a meta-test fails if a credential rule has no fixture | red on PEM, glued JWT, long scheme and fail-closed before the fixes |
| R5-3 | high | one base64url character before a JWT hid it (documented ceiling) | fixed — one attempt per character run with an atomic prefix up to the first `eyJ`; no ceiling | parity cases red once the ceiling was removed, green after |
| R5-4 | medium | a 33-character undotted scheme hid a connection URI | fixed — same construction up to the first word-boundary letter; no ceiling | as R5-3 |
| R5-5 | medium | the 24-bit tag had no enforced guess budget | fixed — 64 failed resolutions per scope, then nothing resolves; credential lookups spend nothing; spelling unchanged | two tests red before |

`DETECTION_CEILINGS` is now empty, and the contract ceiling section says none.

## Round 6 — verdicts

Prompt: `agents/evidence/council/pr2366-egress-review-r6-20261015.question.md`
(diff at `01f295811`, omissions named). The CLI reported one seat absent before
the run and both present after it; both returned a verdict, so no re-run was
needed. Both judged round-5 findings 3–5 resolved and both asked for changes:

| Seat | Stance |
|---|---|
| anthropic/claude-sonnet-4-5 | "REQUEST_CHANGES" — "The PEM label-mismatch defect (Reviewer B) is a secret-disclosure path that contradicts the contract's fail-closed promise. The e2e test gaps (Reviewer A) undermine the whole point of having an e2e suite." |
| openai/codex-default | "REQUEST_CHANGES — a mismatched PEM end label can truncate the replacement span and leak remaining private-key bytes; the single highest-leverage change is to require exact BEGIN/END label equality, fail closed on any intervening marker, and add an exact-boundary end-to-end regression test." |

## Round 6 — findings and dispositions

| # | Severity | Finding | Disposition | Red-proof |
|---|---|---|---|---|
| R6-1 | critical / high | `pemBlockEnd` accepted the nearest END of any label, so an earlier END with another label cut the block short | fixed — the nearest marker must be an END with the header's own label; anything else refuses the text | mismatched-label test red before |
| R6-2 | high (both) | the end-to-end suite checked that chosen substrings were absent, which a partial replacement of a long value also satisfies | fixed — each fixture is split into before / replacement span / after and the output must equal before + one token + after; this also covers the URI username | red with the PEM extent shortened by its END marker, which the old assertion accepted |
| R6-3 | medium (openai) | fixture coverage was self-declared | fixed — each fixture asserts its named rule detects it at the secret's start | — |
| R6-4 | medium (anthropic) / dropped (openai) | PEM header regex claimed quadratic | not a defect — openai traced it as linear (one label run per header, the dash excluded from the class); the restart-heavy `pem-label` timing input agrees | — |
| R6-5 | low (anthropic) | the generic-assignment value gate skips secrets under 16 characters | not changed — it is the pre-move gate, kept for parity; the floor is part of the frozen reference | — |
| R6-6 | advisory (anthropic) | 999,999 tokens per type | not changed — the refusal is a throw, not silent | — |

**The round-6 fixes have not been re-reviewed by the council.**
